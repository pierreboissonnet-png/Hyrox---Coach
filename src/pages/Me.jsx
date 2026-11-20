import React, { useMemo, useState } from 'react'
import { useApp } from '../App.jsx'
import { api, setDemo, COACH_MODE } from '../lib/api.js'
import { Page, Sec, List, Row, Field, Seg, Switch, Sheet, Empty, Icon, Stat, useToast, useLoad, parseNum } from '../ui.jsx'
import { LineChart, Bars } from '../charts.jsx'
import { durationMin, fmtH, sleepStats, sleepAdvice, readAppleSleep } from '../lib/sleep.js'
import { fmt, frDate, todayISO, daysUntil, STATION } from '../lib/hyrox.js'
import { buildProgram, DRILLS, wellNorm } from '../lib/program.js'
import { customInsights, trainingLoad, sessionKcal, sessionMinutes, dayTypeFromKcal } from '../lib/load.js'
import { isCustom, fmtTarget, newBlock } from '../lib/custom.js'
import { targets, DAY_TYPES, MEALS, SUPPLEMENTS, ANTI_DOPING, raceDay } from '../lib/nutrition.js'
import { DIETS, FOODS, SUPPS, gaps, recommend } from '../lib/diet.js'
import { MARKERS, markersFor, refOf, flag, cycleInfo, PHASE_LABEL, PHASE_COLOR, phaseOn, cycles, cycleAverages } from '../lib/health.js'
import { summary, hrBySegment, cyclePerformance } from '../lib/analyze.js'
import { zonesOf } from '../lib/hr.js'
import { detect, athletesIn, convert } from '../lib/importers.js'
import { upcoming, plansOf, activeTeams, RACE_TYPE, mainRace } from './common.js'
import { slotsOf } from './Teams.jsx'
import { Pains } from './Body.jsx'

export function Me() {
  const { profile, races } = useApp()
  const next = upcoming(races)[0]
  return <Page title="Moi" subtitle={`${profile.display_name} · ${profile.sex === 'F' ? 'Femme' : profile.sex === 'M' ? 'Homme' : 'Autre'} · ${new Date().getFullYear() - profile.birth_year} ans · ${profile.weight_kg} kg`}>
    <Sec title="Entraînement">
      <List>
        <Row icon="cal" color="#5e5ce6" title="Programme jusqu’à la course" sub={next ? next.name + ' · J−' + daysUntil(next.race_date) : 'Sans course planifiée'} href="#/moi/programme" />
        <Row icon="chart" color="#ff375f" title="Mon niveau" sub="Bilan : temps de course, ateliers, force. Sert de base au plan" href="#/moi/niveau" />
        <Row icon="bolt" color="#bf5af2" title="Bibliothèque de séances" sub="Séances types et mes modèles, à lancer ou planifier" href="#/seance/specifique?lib=1" />
        <Row icon="timer" color="#0a84ff" title="Mes séances" sub="Historique, séances prévues, activités" href="#/seances" />
        <Row icon="leaf" color="#64d2ff" title="Étirements et mobilité" sub="Routines minutées, banque par zone" href="#/moi/etirements" />
      </List>
    </Sec>
    <Sec title="Santé et forme">
      <List>
        <Row icon="spark" color="#30d158" title="Forme du jour" sub="Fatigue, sommeil, courbatures : adapte le programme" href="#/moi/sante?t=forme" />
        <Row icon="heart" color="#ff9f0a" title="Douleurs" sub="Mouvements à éviter, programme adapté" href="#/moi/sante?t=douleurs" />
        <Row icon="moon" color="#ff375f" title="Santé" sub={'Sommeil, poids, prises de sang' + (profile.sex === 'F' ? ', cycle' : '')} href="#/moi/sante" />
      </List>
    </Sec>
    <Sec title="Nutrition">
      <List>
        <Row icon="leaf" color="#30d158" title="Coach nutrition" sub="Mon alimentation, besoins du jour, jour de course" href="#/moi/nutrition" />
        <Row icon="pill" color="#ff9f0a" title="Compléments" sub="Ce qui est prouvé, doses, précautions" href="#/moi/complements" />
      </List>
    </Sec>
    <Sec title="Compte">
      <List>
        <Row icon="user" color="#8e8e93" title="Profil et zones cardio" href="#/moi/profil" />
        <Row icon="gear" color="#8e8e93" title="Réglages" sub="Apparence, accords, coach IA" href="#/moi/reglages" />
        <Row icon="upload" color="#0a84ff" title="Importer Chrono Hyrox Duo" sub="Sauvegarde de l’artefact ou de l’app iPhone" href="#/moi/import" />
        <Row icon="spark" color="#5e5ce6" title="Analyses approfondies" sub="2e temps du coach : demandes à Claude et réponses" href="#/moi/analyses" />
        <Row icon="bug" color="#ff453a" title="Signalements" sub="Signaler un problème, suivre les corrections" href="#/moi/bugs" />
      </List>
    </Sec>
  </Page>
}

// ---------------- Nutrition ----------------
/** Séances du jour (où l'on est athlète) → dépense estimée, durée et type de journée */
function useToday() {
  const { sessions, profile } = useApp()
  const list = sessions.filter(s => s.session_date === todayISO() && Object.values(s.athletes || {}).includes(profile.id))
  const rows = useLoad(() => list.length ? api.hr.listMany(list.map(s => s.id)) : [], [list.map(s => s.id).join()])
  const kcal = list.reduce((a, s) => a + sessionKcal(s, (rows.data || []).find(r => r.session_id === s.id && r.user_id === profile.id), profile), 0)
  const min = list.reduce((a, s) => a + sessionMinutes(s), 0)
  const withHR = list.filter(s => (rows.data || []).some(r => r.session_id === s.id && r.user_id === profile.id)).length
  return { list, kcal, min, withHR, type: list.length ? dayTypeFromKcal(kcal, min) : null }
}
function TodayCard({ T }) {
  if (!T.list.length) return <p className="note">Aucune séance aujourd’hui : choisissez le type de journée. Après une séance, la dépense mesurée (cardio de la montre) ajuste automatiquement les besoins.</p>
  return <div className="glass card small"><b>Séances du jour</b> : {T.list.map(s => s.name).join(', ')} · {Math.round(T.min)} min · <b>{T.kcal} kcal</b> dépensées ({T.withHR ? 'd’après votre fréquence cardiaque' : 'estimation sans cardio'}). Journée considérée comme « {(DAY_TYPES.find(x => x.id === T.type) || {}).label} ».</div>
}
export function Nutrition() {
  const { profile, races } = useApp()
  const T = useToday()
  const [day, setDay] = useState(null), [start, setStart] = useState('10:00')
  const dayId = day || T.type || 'entrainement'
  const t = targets(profile, dayId), next = upcoming(races)[0]
  // Avec une dépense mesurée : métabolisme de base × 1,35 (vie quotidienne) + séances du jour
  const kcalAdj = T.list.length && !day ? Math.round((t.bmr * 1.35 + T.kcal) / 10) * 10 : null
  const [view, setView] = useState('alimentation')
  return <Page back="#/moi" title="Coach nutrition" subtitle={`Pour ${profile.weight_kg} kg`}>
    <Seg value={view} onChange={setView} options={[['alimentation', 'Mon alimentation'], ['besoins', 'Besoins et jour J']]} />
    {view === 'alimentation' ? <DietCoach T={T} /> : <>
    <TodayCard T={T} />
    <Seg value={dayId} onChange={setDay} options={DAY_TYPES.map(x => [x.id, x.label])} />
    <div className="stats">
      <Stat k="Énergie" v={(kcalAdj || t.kcal) + ' kcal'} d={kcalAdj ? 'base ' + t.bmr + ' + séances ' + T.kcal : 'métabolisme de base ' + t.bmr} />
      <Stat k="Glucides" v={t.carbs + ' g'} d={t.day.carbs + ' g/kg'} />
      <Stat k="Protéines" v={t.prot + ' g'} d={t.day.prot + ' g/kg'} />
      <Stat k="Lipides" v={t.fat + ' g'} />
      <Stat k="Eau" v={t.water.toString().replace('.', ',') + ' L'} d="+ 0,5 à 1 L par heure d’effort" />
    </div>
    <Sec title="Journée type"><List>{MEALS.map(m => <Row key={m.when} title={m.when} sub={m.what} />)}</List></Sec>
    <Sec title={'Jour de course' + (next ? ' · ' + next.name : '')} foot="Testez tout à l’entraînement : rien de nouveau le jour J.">
      <List><Field label="Heure de départ"><input type="time" value={start} onChange={e => setStart(e.target.value)} /></Field>
        {raceDay(profile, start).map((r, i) => <Row key={i} title={r.what} value={r.time} />)}</List>
    </Sec>
    <p className="foot">Estimations générales (formule de Mifflin-St Jeor). Pour un suivi personnalisé, consultez un(e) diététicien(ne) du sport.</p>
    </>}
  </Page>
}
function Stepper({ value, onChange, step = 1 }) {
  const v = +value || 0
  return <span className="row-gap" style={{ gap: 4, flexShrink: 0 }}>
    <button className="icon-btn glass" style={{ width: 32, height: 32 }} aria-label="Moins" onClick={() => onChange(Math.max(0, +(v - step).toFixed(1)))}>−</button>
    <b className="num" style={{ minWidth: 28, textAlign: 'center' }}>{String(v).replace('.', ',')}</b>
    <button className="icon-btn glass" style={{ width: 32, height: 32 }} aria-label="Plus" onClick={() => onChange(+(v + step).toFixed(1))}>+</button>
  </span>
}
const REC_STYLE = { remplacer: ['Remplacer', 'warn'], ajouter: ['Ajouter', 'accent'], 'complément': ['Complément', ''], ok: ['Bien', 'good'] }

/** Alimentation déclarée → apports → recommandations */
function DietCoach({ T }) {
  const { profile } = useApp(), toast = useToast()
  const j = useLoad(() => api.journal.list('diet'), [])
  const saved = (j.data || [])[0]
  const [d, setD] = useState(null), [day0, setDay] = useState(null), [edit, setEdit] = useState(false)
  const day = day0 || (T && T.type) || 'entrainement'
  const diet = d || (saved && saved.data) || { type: 'omnivore', q: {}, s: {} }
  const set = patch => setD({ ...diet, ...patch })
  const setQ = (k, v) => set({ q: { ...diet.q, [k]: v } }), setS = (k, v) => set({ s: { ...diet.s, [k]: v } })
  const filled = Object.values(diet.q || {}).some(v => +v > 0)
  const G = gaps(diet, profile, day), R = recommend(diet, profile, day)
  async function save() {
    const data = { ...diet, updated: todayISO() }
    if (saved) await api.journal.update(saved.id, { data, day: todayISO() }); else await api.journal.add({ kind: 'diet', day: todayISO(), data })
    setD(null); j.reload(); setEdit(false); toast('Alimentation enregistrée')
  }
  if (j.loading) return <p className="muted">Chargement…</p>
  const editor = <>
    <h2 className="sec">Régime actuel</h2>
    <Seg value={diet.type} onChange={v => set({ type: v })} options={DIETS} />
    <h2 className="sec">Ce que vous mangez en moyenne</h2>
    <List>{FOODS.filter(f => !(diet.type === 'vegetalien' && ['viande', 'volaille', 'charcuterie', 'poisson_gras', 'poisson', 'oeufs', 'laitiers', 'fromage'].includes(f.id)) && !(['vegetarien'].includes(diet.type) && ['viande', 'volaille', 'charcuterie', 'poisson_gras', 'poisson'].includes(f.id)) && !(diet.type === 'pescetarien' && ['viande', 'volaille', 'charcuterie'].includes(f.id))).map(f =>
      <div className="row" key={f.id} style={f.sub ? { paddingLeft: 32 } : null}><span className="label"><span className="t">{f.label}</span><span className="s">{f.portion} · portions par {f.per === 'j' ? 'jour' : 'semaine'}</span></span>
        <Stepper value={diet.q[f.id]} onChange={v => setQ(f.id, v)} step={f.per === 'j' ? 0.5 : 1} /></div>)}</List>
    <h2 className="sec">Compléments pris</h2>
    <List>{SUPPS.map(x => <div className="row" key={x.id}><span className="label"><span className="t">{x.label}</span><span className="s">{x.unit}</span></span><Stepper value={diet.s[x.id]} onChange={v => setS(x.id, v)} /></div>)}</List>
    <button className="btn block" style={{ marginTop: 14 }} onClick={save}>Enregistrer et analyser</button>
  </>
  if (!saved || edit) return <>{!saved && <p className="note">Décrivez votre alimentation habituelle par grandes familles : l’app estime vos apports, les compare à vos besoins de sportif(ve) et propose quoi ajouter ou remplacer.</p>}{editor}</>
  return <>
    <div className="row-gap" style={{ marginBottom: 8 }}><span className="badge accent">{(DIETS.find(x => x[0] === diet.type) || [])[1]}</span><span className="small muted">mis à jour le {frDate(saved.day)}</span><span className="spacer" /><button className="btn glass small" onClick={() => setEdit(true)}>Modifier</button></div>
    {T && T.list.length > 0 && <TodayCard T={T} />}
    <Seg value={day} onChange={setDay} options={DAY_TYPES.map(x => [x.id, x.label])} />
    <h2 className="sec">Apports estimés par jour</h2>
    <div className="glass card">{G.map(g => { const pct = Math.min(1.5, g.ratio), col = g.k === 'kcal' ? (g.ratio < 0.85 || g.ratio > 1.15 ? 'var(--warn)' : 'var(--good)') : g.ratio < 0.7 ? 'var(--bad)' : g.ratio < 0.9 ? 'var(--warn)' : 'var(--good)'
      return <div key={g.k} style={{ display: 'grid', gridTemplateColumns: '120px 1fr 104px', gap: 8, alignItems: 'center', padding: '5px 0', fontSize: 14 }}>
        <span>{g.label}</span>
        <span style={{ position: 'relative', height: 10, background: 'var(--fill)', borderRadius: 99 }}><span style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: (pct / 1.5 * 100) + '%', background: col, borderRadius: 99 }} /><span style={{ position: 'absolute', left: (100 / 1.5) + '%', top: -3, bottom: -3, width: 1.5, background: 'var(--ink-3)' }} /></span>
        <span className="num small" style={{ textAlign: 'right' }}>{Math.round(g.have)} / {Math.round(g.need)} {g.unit}</span></div> })}
      <p className="small muted" style={{ marginBottom: 0 }}>Le trait vertical marque le besoin estimé ({DAY_TYPES.find(x => x.id === day).label.toLowerCase()}). Estimations à partir de portions moyennes : un ordre de grandeur, pas une pesée.</p></div>
    <h2 className="sec">Recommandations</h2>
    <List>{R.map((r, i) => <div className="row stack" key={i}><div className="row-gap"><span className={'badge ' + REC_STYLE[r.type][1]}>{REC_STYLE[r.type][0]}</span><b style={{ flex: 1, minWidth: 0 }}>{r.text}</b></div><span className="small muted">{r.why}</span></div>)}</List>
    <p className="foot">Repères ANSES et recommandations pour sportifs. Pour un suivi personnalisé (perte de poids, troubles digestifs, grossesse, pathologie), consultez un(e) diététicien(ne) du sport.</p>
  </>
}

export function Supplements() {
  const { profile } = useApp()
  return <Page back="#/moi" title="Compléments">
    <p className="note">{ANTI_DOPING}</p>
    <List>{SUPPLEMENTS.map(s => <div className="row stack" key={s.id}>
      <div className="row-gap"><b>{s.name}</b><span className="spacer" /><span className={'badge ' + (s.level === 'Fort' ? 'good' : s.level === 'Modéré' ? 'accent' : s.level === 'Si carence' ? 'warn' : '')}>{s.level}</span></div>
      <div className="small">{s.dose(profile)}</div><div className="small muted">{s.why}</div><div className="small warn">{s.care}</div>
    </div>)}</List>
    <p className="foot">Informations générales, pas un avis médical. Grossesse, traitement en cours ou maladie : parlez-en à votre médecin avant toute prise.</p>
  </Page>
}

// ---------------- Santé ----------------
export function Health() {
  const { profile } = useApp()
  const asked = new URLSearchParams(location.hash.split('?')[1] || '').get('t')
  const [tab, setTab] = useState(asked && (asked !== 'cycle' || profile.sex === 'F') ? asked : 'sommeil')
  if (!profile.consent_health) return <Page back="#/moi" title="Santé"><div className="glass card"><h3>Accord nécessaire</h3><p className="muted small">Pour enregistrer poids, prises de sang{profile.sex === 'F' ? ', cycle' : ''} et forme, activez « Données de santé » dans les réglages. Ces données restent strictement privées.</p><a className="btn small" href="#/moi/reglages">Réglages</a></div></Page>
  const tabs = [['sommeil', 'Sommeil'], ['poids', 'Poids'], ['sang', 'Sang'], ...(profile.sex === 'F' ? [['cycle', 'Cycle']] : []), ['forme', 'Forme'], ['douleurs', 'Douleurs']]
  return <Page back="#/moi" title="Santé" subtitle="Privé : visible par vous seul(e).">
    <div style={{ overflowX: 'auto', margin: '0 -16px', padding: '0 16px' }}><div className="seg" role="group" style={{ minWidth: 'max-content' }}>{tabs.map(([v, l]) => <button key={v} aria-pressed={tab === v} onClick={() => setTab(v)} style={{ whiteSpace: 'nowrap' }}>{l}</button>)}</div></div>
    {tab === 'douleurs' && <Pains />}
    {tab === 'sommeil' && <Sleep />}{tab === 'poids' && <Weight />}{tab === 'sang' && <Blood />}{tab === 'cycle' && profile.sex === 'F' && <Cycle />}{tab === 'forme' && <Wellbeing />}
  </Page>
}
function Sleep() {
  const { races, settings, setSettings } = useApp(), toast = useToast()
  const j = useLoad(() => api.journal.list('sleep'), [])
  const target = settings.sleepTarget || 480
  const yest = new Date(Date.now() - 864e5)
  const [f, setF] = useState({ day: todayISO(), bed: '23:00', wake: '07:00', awake: '', quality: 3, awakenings: '', nap: '', note: '' })
  const [imp, setImp] = useState('')
  const all = j.data || []
  const st = sleepStats(all, { days: 7, target }), st30 = sleepStats(all, { days: 30, target })
  const next = upcoming(races)[0]
  const tips = sleepAdvice(st, { daysToRace: next ? daysUntil(next.race_date) : null })
  const dur = durationMin(f.bed, f.wake), asleep = dur != null ? Math.max(0, dur - (+f.awake || 0)) : null
  const nights = Array.from({ length: 14 }, (_, i) => { const d = new Date(Date.now() - (13 - i) * 864e5), iso = new Date(d - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10), e = all.find(x => x.day === iso); return { label: iso.slice(8, 10), v: e ? (e.data.asleep + (+e.data.nap || 0)) / 60 : null } })
  async function save() {
    if (!asleep) return
    const data = { asleep, bed: f.bed, wake: f.wake, quality: +f.quality, awakenings: f.awakenings === '' ? null : +f.awakenings, nap: f.nap === '' ? null : +f.nap, note: f.note || '' }
    const ex = all.find(e => e.day === f.day)
    if (ex) await api.journal.update(ex.id, { data }); else await api.journal.add({ kind: 'sleep', day: f.day, data })
    j.reload(); toast('Nuit enregistrée : ' + fmtH(asleep))
  }
  async function importHealth(file) {
    setImp('Lecture 0 %')
    try {
      const nights = (await readAppleSleep(file, p => setImp('Lecture ' + Math.round(p * 100) + ' %'))).slice(0, 120)
      const have = new Set(all.map(e => e.day)); let n = 0
      for (const x of nights) { if (have.has(x.day)) continue; await api.journal.add({ kind: 'sleep', day: x.day, data: x.data }); n++; if (n % 10 === 0) setImp(`Enregistrement… ${n}`) }
      setImp(''); j.reload(); toast(n ? `${n} nuit(s) importée(s)` : 'Aucune nouvelle nuit à importer')
    } catch (e) { setImp(''); toast(e.message) }
  }
  return <>
    {st ? <div className="stats">
      <Stat k="Moyenne 7 nuits" v={fmtH(st.avg)} d={st30 && st30.n > st.n ? '30 nuits : ' + fmtH(st30.avg) : st.n + ' nuit(s)'} tone={st.avg < 420 ? 'bad' : st.avg >= target ? 'good' : 'even'} />
      <Stat k="Dette (7 nuits)" v={fmtH(st.debt)} d={'objectif ' + fmtH(target) + ' / nuit'} tone={st.debt > 300 ? 'bad' : 'good'} />
      <Stat k="Régularité du coucher" v={st.regularity != null ? '± ' + Math.round(st.regularity) + ' min' : '—'} d={st.short ? st.short + ' nuit(s) < 7 h' : 'aucune nuit < 7 h'} tone={st.short ? 'bad' : 'good'} />
      <Stat k="Qualité ressentie" v={st.quality != null ? st.quality.toFixed(1).replace('.', ',') + '/5' : '—'} />
    </div> : <p className="note">Notez vos nuits (ou importez-les depuis l’app Santé) : l’app calcule votre moyenne, votre dette de sommeil et adapte le programme.</p>}
    {nights.some(x => x.v) && <div className="glass card"><div className="small muted">14 dernières nuits (heures, siestes comprises)</div><Bars items={nights} target={target / 60} low={7} fmtV={v => fmtH(v * 60)} color="#5e5ce6" /></div>}
    {tips.length > 0 && <div className="glass card">{tips.map((t, i) => <div className="tip" key={i}><span className={'dot ' + t.tone} /><span className="small">{t.text}</span></div>)}</div>}
    <h2 className="sec">Nuit dernière</h2>
    <List>
      <Field label="Réveil le"><input type="date" value={f.day} onChange={e => setF({ ...f, day: e.target.value })} /></Field>
      <Field label="Coucher"><input type="time" value={f.bed} onChange={e => setF({ ...f, bed: e.target.value })} /></Field>
      <Field label="Lever"><input type="time" value={f.wake} onChange={e => setF({ ...f, wake: e.target.value })} /></Field>
      <Field label="Éveillé dans la nuit" sub="minutes, facultatif"><input inputMode="numeric" value={f.awake} onChange={e => setF({ ...f, awake: e.target.value })} placeholder="0" /></Field>
      <Field label="Réveils" sub="facultatif"><input inputMode="numeric" value={f.awakenings} onChange={e => setF({ ...f, awakenings: e.target.value })} placeholder="0" /></Field>
      <Field label="Sieste de la veille" sub="minutes, facultatif"><input inputMode="numeric" value={f.nap} onChange={e => setF({ ...f, nap: e.target.value })} placeholder="0" /></Field>
      <div className="row stack"><div className="row-gap"><span>Qualité ressentie</span><span className="spacer" /><b className="num">{f.quality}/5</b></div>
        <input type="range" min="1" max="5" value={f.quality} onChange={e => setF({ ...f, quality: +e.target.value })} aria-label="Qualité" /><div className="row-gap tiny faint"><span>très mauvaise</span><span className="spacer" /><span>excellente</span></div></div>
    </List>
    <button className="btn block" style={{ marginTop: 12 }} disabled={!asleep} onClick={save}>Enregistrer · {fmtH(asleep)} de sommeil</button>
    <h2 className="sec">Objectif et import</h2>
    <List>
      <div className="row"><span className="label"><span className="t">Objectif par nuit</span></span><div className="seg" style={{ margin: 0, width: 230 }}>{[[450, '7 h 30'], [480, '8 h'], [510, '8 h 30'], [540, '9 h']].map(([v, l]) => <button key={v} aria-pressed={target === v} onClick={() => setSettings({ sleepTarget: v })}>{l}</button>)}</div></div>
      <label className="row"><span className="label"><span className="t">Importer depuis l’app Santé</span><span className="s">{imp || 'iPhone : Santé › photo de profil › Exporter toutes les données de santé (export.zip). Montre ou iPhone : durée, phases, heures.'}</span></span><span className="btn tinted small">{imp ? '…' : 'Choisir'}</span><input type="file" hidden accept=".zip,.xml" onChange={e => e.target.files[0] && importHealth(e.target.files[0])} /></label>
    </List>
    <p className="foot">Repères pour sportifs : 7 à 9 h par nuit, davantage en période de charge. Le fichier est lu dans votre navigateur ; seules les durées et heures des nuits sont enregistrées.</p>
    <JournalList items={all} render={e => `${fmtH(e.data.asleep)}${e.data.bed ? ' · ' + e.data.bed + ' → ' + e.data.wake : ''}${e.data.quality ? ' · qualité ' + e.data.quality + '/5' : ''}${e.data.deep ? ' · profond ' + fmtH(e.data.deep) : ''}${e.data.nap ? ' · sieste ' + e.data.nap + ' min' : ''}`} onDel={j.reload} />
  </>
}

function Weight() {
  const { profile, setProfile } = useApp(), toast = useToast()
  const j = useLoad(() => api.journal.list('weight'), [])
  const [f, setF] = useState({ day: todayISO(), kg: '', fat: '' })
  const pts = [...(j.data || [])].reverse()
  async function add() {
    const kg = parseNum(f.kg), fat = parseNum(f.fat)
    if (kg == null) return toast(String(f.kg).trim() ? 'Poids illisible : saisissez par exemple 72,5' : 'Saisissez votre poids en kg')
    if (kg < 30 || kg > 250) return toast('Poids hors limites (30 à 250 kg)')
    if (String(f.fat).trim() && (fat == null || fat < 2 || fat > 70)) return toast('Masse grasse : entre 2 et 70 %')
    if (!f.day) return toast('Choisissez une date')
    try {
      await api.journal.add({ kind: 'weight', day: f.day, data: { kg, fat } })
      if (f.day >= todayISO()) setProfile(await api.profiles.update(profile.id, { weight_kg: kg }))
      setF({ ...f, kg: '', fat: '' }); j.reload(); toast('Pesée enregistrée')
    } catch (e) { toast('Enregistrement impossible : ' + e.message) }
  }
  const t0 = pts.length ? new Date(pts[0].day).getTime() : 0
  return <>
    {pts.length > 1 && <div className="glass card"><LineChart height={170} series={[{ color: '#ff375f', dots: true, pts: pts.map(p => [(new Date(p.day) - t0) / 864e5, p.data.kg]) }]} xFmt={v => frDate(new Date(t0 + v * 864e5).toISOString().slice(0, 10)).slice(0, 5)} yFmt={v => v.toFixed(1).replace('.', ',')} />
      <div className="small muted">{pts[0].data.kg} → {pts[pts.length - 1].data.kg} kg ({(pts[pts.length - 1].data.kg - pts[0].data.kg).toFixed(1).replace('.', ',')} kg)</div></div>}
    <List>
      <Field label="Date"><input type="date" value={f.day} onChange={e => setF({ ...f, day: e.target.value })} /></Field>
      <Field label="Poids (kg)"><input inputMode="decimal" value={f.kg} onChange={e => setF({ ...f, kg: e.target.value })} placeholder={String(profile.weight_kg)} /></Field>
      <Field label="Masse grasse (%)" sub="Facultatif"><input inputMode="decimal" value={f.fat} onChange={e => setF({ ...f, fat: e.target.value })} /></Field>
    </List>
    <button className="btn block" style={{ marginTop: 12 }} onClick={add}>Ajouter</button>
    <JournalList items={j.data} render={e => `${e.data.kg} kg${e.data.fat ? ' · ' + e.data.fat + ' %' : ''}`} onDel={j.reload} />
  </>
}
function JournalList({ items, render, onDel }) {
  if (!items || !items.length) return null
  return <><h2 className="sec">Historique</h2><List>{items.slice(0, 30).map(e => <div className="row" key={e.id}><span className="label"><span className="t">{render(e)}</span><span className="s">{frDate(e.day)}</span></span>
    <button className="icon-btn" aria-label="Supprimer" onClick={async () => { if (confirm('Supprimer ?')) { await api.journal.remove(e.id); onDel() } }}><Icon name="trash" size={18} /></button></div>)}</List></>
}
function Blood() {
  const { profile } = useApp(), toast = useToast()
  const j = useLoad(() => api.journal.list('blood'), [])
  const [open, setOpen] = useState(false)
  const ms = markersFor(profile.sex)
  const latest = {}; [...(j.data || [])].reverse().forEach(e => Object.entries(e.data).forEach(([k, v]) => { if (v != null && v !== '' && k !== 'cycleDay') latest[k] = { v, day: e.day } }))
  return <>
    <button className="btn block" onClick={() => setOpen(true)}><Icon name="plus" size={18} />Saisir une prise de sang</button>
    <h2 className="sec">Derniers résultats</h2>
    <List>{ms.filter(m => latest[m.id]).map(m => { const f = flag(m, profile.sex, latest[m.id].v), r = refOf(m, profile.sex); return <Row key={m.id} title={m.label} sub={(r ? `repère ${r[0]}–${r[1]} ${m.unit}` : m.why) + ' · ' + frDate(latest[m.id].day)} value={<span className={f === 'ok' ? 'good' : f ? 'bad' : ''}>{latest[m.id].v} {m.unit}{f && f !== 'ok' ? ' · ' + f : ''}</span>} /> })}
      {!Object.keys(latest).length && <div className="row"><span className="muted small">Aucun résultat saisi.</span></div>}</List>
    <p className="foot">Repères indicatifs : les normes de votre laboratoire font foi. Une valeur hors repère se discute avec votre médecin.</p>
    <JournalList items={j.data} render={e => Object.entries(e.data).filter(([k, v]) => v != null && v !== '' && ms.some(m => m.id === k)).map(([k, v]) => ((MARKERS.find(m => m.id === k) || {}).label || k) + ' ' + v).join(' · ')} onDel={j.reload} />
    {open && <BloodSheet onClose={() => setOpen(false)} onSaved={() => { j.reload(); toast('Résultats enregistrés') }} />}
  </>
}
function BloodSheet({ onClose, onSaved }) {
  const { profile } = useApp()
  const [day, setDay] = useState(todayISO()), [v, setV] = useState({})
  async function save() {
    const data = Object.fromEntries(Object.entries(v).filter(([, x]) => x !== '').map(([k, x]) => [k, k === 'cycleDay' ? +x : +String(x).replace(',', '.')]))
    if (!Object.keys(data).length) return
    await api.journal.add({ kind: 'blood', day, data }); onSaved(); onClose()
  }
  return <Sheet title="Prise de sang" onClose={onClose} actions={<button className="btn plain" onClick={save}>OK</button>}>
    <List>
      <Field label="Date"><input type="date" value={day} onChange={e => setDay(e.target.value)} /></Field>
      {profile.sex === 'F' && <Field label="Jour du cycle" sub="Pour interpréter les hormones"><input inputMode="numeric" value={v.cycleDay || ''} onChange={e => setV({ ...v, cycleDay: e.target.value })} /></Field>}
      {markersFor(profile.sex).map(m => <Field key={m.id} label={m.label} sub={m.unit}><input inputMode="decimal" value={v[m.id] || ''} onChange={e => setV({ ...v, [m.id]: e.target.value })} /></Field>)}
    </List>
    <button className="btn block" style={{ marginTop: 12 }} onClick={save}>Enregistrer</button>
  </Sheet>
}
function Cycle() {
  const { profile, sessions, teams } = useApp(), toast = useToast()
  const j = useLoad(() => api.journal.list('cycle'), [])
  const [f, setF] = useState({ start: todayISO(), end: '', symptoms: '' })
  const E = j.data || [], ci = cycleInfo(E), avg = cycleAverages(E), C = cycles(E).reverse()
  const open = C.find(c => !c.end && c.start >= new Date(Date.now() - 12 * 864e5).toISOString().slice(0, 10))
  const perf = useMemo(() => E.length ? cyclePerformance(profile.id, sessions, plansOf(teams), E) : null, [E, sessions])
  const strip = E.length ? Array.from({ length: 28 }, (_, i) => { const d = new Date(Date.now() + i * 864e5), iso = new Date(d - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10); return { iso, ph: phaseOn(E, iso) } }) : []
  async function add() {
    if (f.end && f.end < f.start) return toast('La fin doit suivre le début')
    const ex = E.find(e => e.day === f.start)
    const data = { end: f.end || null, symptoms: f.symptoms }
    if (ex) await api.journal.update(ex.id, { data: { ...ex.data, ...data } }); else await api.journal.add({ kind: 'cycle', day: f.start, data })
    setF({ start: todayISO(), end: '', symptoms: '' }); j.reload(); toast('Cycle enregistré')
  }
  async function endToday(c) { const e = E.find(x => x.day === c.start); await api.journal.update(e.id, { data: { ...e.data, end: todayISO() } }); j.reload(); toast('Fin des règles enregistrée') }
  return <>
    {ci ? <div className="stats">
      <Stat k="Jour du cycle" v={'J' + ci.day} d={`cycle moyen ${avg.len} j · règles ${avg.period} j`} />
      <Stat k="Phase" v={PHASE_LABEL[ci.phase]} d={ci.projected ? 'estimation (pas de nouveau cycle déclaré)' : ''} />
      <Stat k="Prochaines règles" v={frDate(ci.next).slice(0, 5)} d={ci.irregular ? 'cycles irréguliers' : 'estimation'} />
    </div> : <p className="note">Déclarez le début et la fin de vos règles : l’app calcule les phases, adapte chaque jour du programme et pondère vos résultats.</p>}
    {strip.length > 0 && <div className="glass card"><div className="small muted" style={{ marginBottom: 6 }}>Les 4 prochaines semaines</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(14, 1fr)', gap: 3 }}>{strip.map(x => <div key={x.iso} title={x.ph ? PHASE_LABEL[x.ph.phase] : ''} style={{ textAlign: 'center' }}><div style={{ height: 22, borderRadius: 6, background: x.ph ? PHASE_COLOR[x.ph.phase] : 'var(--fill)', opacity: x.ph && x.ph.projected ? .55 : .9 }} /><div className="tiny faint">{x.iso.slice(8)}</div></div>)}</div>
      <div className="legend">{Object.entries(PHASE_LABEL).map(([k, l]) => <span key={k}><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 4, background: PHASE_COLOR[k], marginRight: 4 }} />{l}</span>)}</div></div>}
    {open && <button className="btn glass block" style={{ marginBottom: 10 }} onClick={() => endToday(open)}>Mes règles se terminent aujourd’hui</button>}
    <List>
      <Field label="Début des règles"><input type="date" value={f.start} onChange={e => setF({ ...f, start: e.target.value })} /></Field>
      <Field label="Fin des règles" sub="Facultatif, ajoutable plus tard"><input type="date" value={f.end} onChange={e => setF({ ...f, end: e.target.value })} /></Field>
      <Field label="Symptômes" sub="Facultatif"><input value={f.symptoms} onChange={e => setF({ ...f, symptoms: e.target.value })} placeholder="crampes, fatigue…" /></Field>
    </List>
    <button className="btn block" style={{ marginTop: 12 }} onClick={add}>Enregistrer</button>
    {perf && perf.points.length > 0 && <>
      <h2 className="sec">Vos performances selon la phase</h2>
      <div className="glass card scroll-x"><table className="tbl"><thead><tr><th>Phase</th><th className="r">Séances</th><th className="r">Écart moyen à l’objectif</th><th className="r">Pondération</th></tr></thead><tbody>
        {Object.keys(PHASE_LABEL).map(k => { const x = perf.effects[k]; return <tr key={k}><td><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 4, background: PHASE_COLOR[k], marginRight: 6 }} />{PHASE_LABEL[k]}</td><td className="r num">{x.n}</td>
          <td className="r num">{x.mean != null ? (x.mean > 0 ? '+' : '') + (x.mean * 100).toFixed(1).replace('.', ',') + ' %' : '—'}</td><td className="r num">{(x.effect > 0 ? '+' : '') + (x.effect * 100).toFixed(1).replace('.', ',') + ' %'}</td></tr> })}
      </tbody></table>
      <p className="small muted" style={{ marginBottom: 0 }}>La pondération est l’effet estimé de chaque phase sur vos temps. Elle part de valeurs prudentes issues des études (effets en moyenne faibles et très variables d’une femme à l’autre), puis s’ajuste à vos propres séances. Elle sert à afficher un « temps ajusté au cycle » dans les stats de séance et à moins compter les séances en phase défavorable dans vos prédictions.</p></div>
    </>}
    <p className="foot">Estimation simple, ni contraception ni diagnostic. Hormones (œstradiol, progestérone, LH, FSH) : onglet « Sang ». Cycles très irréguliers ou absents : parlez-en à un médecin (cela peut signaler un déficit énergétique). Sous contraception hormonale, les phases calculées ne reflètent pas le cycle naturel.</p>
    {C.length > 0 && <><h2 className="sec">Historique</h2><List>{C.slice(0, 24).map(c => <div className="row" key={c.start}><span className="label"><span className="t">{frDate(c.start)}{c.end ? ' → ' + frDate(c.end) : ''}</span><span className="s">{[c.period ? 'règles ' + c.period + ' j' : 'fin non déclarée', c.len ? 'cycle ' + c.len + ' j' : 'cycle en cours', c.symptoms].filter(Boolean).join(' · ')}</span></span>
      <button className="icon-btn" aria-label="Supprimer" onClick={async () => { if (confirm('Supprimer ?')) { await api.journal.remove(c.id); j.reload() } }}><Icon name="trash" size={18} /></button></div>)}</List></>}
  </>
}
function Wellbeing() {
  const j = useLoad(() => api.journal.list('wellbeing'), []), toast = useToast()
  const [v, setV] = useState({ fatigue: 1, sleep: 3, soreness: 1, mood: 3 })
  const L = {
    fatigue: ['Fatigue', ['Aucune', 'Très légère', 'Légère', 'Modérée', 'Forte', 'Extrême']],
    sleep: ['Qualité du sommeil', ['Très mauvais', 'Mauvais', 'Moyen', 'Correct', 'Bon', 'Excellent']],
    soreness: ['Courbatures', ['Aucune', 'Très légères', 'Légères', 'Modérées', 'Fortes', 'Très fortes']],
    mood: ['Moral', ['Très bas', 'Bas', 'Moyen', 'Correct', 'Bon', 'Excellent']],
  }
  const todayRow = (j.data || []).find(e => e.day === todayISO())
  async function save() {
    try {
      const data = { ...v, v: 2 }
      if (todayRow) await api.journal.update(todayRow.id, { data }); else await api.journal.add({ kind: 'wellbeing', day: todayISO(), data })
      j.reload(); toast(todayRow ? 'Forme du jour mise à jour' : 'Forme du jour enregistrée')
    } catch (e) { toast('Enregistrement impossible : ' + e.message) }
  }
  const lbl = (k, x) => x == null ? '–' : L[k][1][Math.max(0, Math.min(5, Math.round(x)))].toLowerCase()
  return <>
    <List>{Object.entries(L).map(([k, [l, names]]) => <div className="row stack" key={k}><div className="row-gap"><span>{l}</span><span className="spacer" /><b>{names[v[k]]}</b><span className="num small muted">{v[k]}/5</span></div>
      <input type="range" min="0" max="5" step="1" value={v[k]} onChange={e => setV({ ...v, [k]: +e.target.value })} aria-label={l} aria-valuetext={names[v[k]]} /><div className="row-gap tiny faint"><span>0 · {names[0].toLowerCase()}</span><span className="spacer" /><span>5 · {names[5].toLowerCase()}</span></div></div>)}</List>
    <button className="btn block" style={{ marginTop: 12 }} onClick={save}>{todayRow ? 'Mettre à jour la forme du jour' : 'Enregistrer la forme du jour'}</button>
    {todayRow && <a className="btn glass block" style={{ marginTop: 8 }} href="#/moi/programme"><Icon name="cal" size={16} />Voir le programme du jour</a>}
    <p className="foot">Effet sur le programme : une fatigue ou des courbatures à 4–5 (ou un sommeil à 0–1) transforment seulement la séance intense d’aujourd’hui ou de demain en endurance facile ; à 3 (ou sommeil à 2), le volume baisse d’environ 20 %. La semaine entière n’est allégée que si la moyenne des 5 derniers jours (au moins 3 saisies) reste haute.</p>
    <JournalList items={j.data} render={e => { const w = wellNorm(e); return `Fatigue ${lbl('fatigue', w.fatigue)} · sommeil ${lbl('sleep', w.sleep)} · courbatures ${lbl('soreness', w.soreness)} · moral ${lbl('mood', w.mood)}` }} onDel={j.reload} />
  </>
}

// ---------------- Profil ----------------
export function Profile() {
  const { profile, setProfile } = useApp(), toast = useToast()
  const [f, setF] = useState({ ...profile, hr_zones: zonesOf(profile) })
  async function save() {
    const z = f.hr_zones.map(x => +x || 0)
    setProfile(await api.profiles.update(profile.id, { display_name: f.display_name, sex: f.sex, birth_year: +f.birth_year, weight_kg: +f.weight_kg, height_cm: f.height_cm ? +f.height_cm : null, hr_max: f.hr_max ? +f.hr_max : null, hr_zones: z }))
    toast('Profil enregistré')
  }
  return <Page back="#/moi" title="Profil" actions={<button className="btn small" onClick={save}>Enregistrer</button>}>
    <List>
      <Field label="Prénom"><input value={f.display_name} onChange={e => setF({ ...f, display_name: e.target.value })} /></Field>
      <Field label="Sexe"><select value={f.sex} onChange={e => setF({ ...f, sex: e.target.value })}><option value="F">Femme</option><option value="M">Homme</option><option value="X">Autre</option></select></Field>
      <Field label="Année de naissance"><input type="number" value={f.birth_year} onChange={e => setF({ ...f, birth_year: e.target.value })} /></Field>
      <Field label="Poids (kg)"><input type="number" step="0.1" value={f.weight_kg} onChange={e => setF({ ...f, weight_kg: e.target.value })} /></Field>
      <Field label="Taille (cm)"><input type="number" value={f.height_cm || ''} onChange={e => setF({ ...f, height_cm: e.target.value })} /></Field>
    </List>
    <h2 className="sec">Zones cardio</h2>
    <List>
      <Field label="FC max" sub="Laissez vide pour l’estimer"><input type="number" value={f.hr_max || ''} onChange={e => setF({ ...f, hr_max: e.target.value })} /></Field>
      {[1, 2, 3, 4].map(k => <Field key={k} label={`Début zone ${k + 1}`} sub={['', 'Facile', 'Modéré', 'Difficile', 'Très difficile'][k]}><input type="number" value={f.hr_zones[k]} onChange={e => { const z = [...f.hr_zones]; z[k] = e.target.value; setF({ ...f, hr_zones: z }) }} /></Field>)}
    </List>
    <p className="foot">Ces informations sont visibles par vos partenaires de duo (pas vos données de santé).</p>
  </Page>
}

// ---------------- Réglages ----------------
export function Settings() {
  const { profile, setProfile, settings, setSettings, user } = useApp(), toast = useToast()
  const set = async patch => setProfile(await api.profiles.update(profile.id, patch))
  async function exportAll() {
    const [teams, races, sessions, journal] = await Promise.all([api.teams.list(), api.races.list(), api.sessions.list(), api.journal.list()])
    const blob = new Blob([JSON.stringify({ export: 'Hyrox Coach', date: new Date().toISOString(), profile, teams, races, sessions, journal }, null, 1)], { type: 'application/json' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'hyrox-coach-' + todayISO() + '.json'; a.click()
  }
  return <Page back="#/moi" title="Réglages">
    <Sec title="Apparence">
      <List>
        <div className="row stack"><div className="row-gap"><span>Verre</span><span className="spacer" /><span className="small muted">{settings.glass < 0.4 ? 'transparent' : settings.glass > 0.7 ? 'teinté' : 'équilibré'}</span></div>
          <input type="range" min="0.2" max="0.88" step="0.01" value={settings.glass} onChange={e => setSettings({ glass: +e.target.value })} aria-label="Transparence du verre" />
          <div className="row-gap tiny faint"><span>Transparent</span><span className="spacer" /><span>Teinté</span></div></div>
        <div className="row"><span className="label"><span className="t">Thème</span></span><div className="seg" style={{ margin: 0, width: 230 }}>{[['auto', 'Auto'], ['light', 'Clair'], ['dark', 'Sombre']].map(([v, l]) => <button key={v} aria-pressed={settings.theme === v} onClick={() => setSettings({ theme: v })}>{l}</button>)}</div></div>
      </List>
    </Sec>
    <Sec title="Accords" foot={COACH_MODE === 'claude' ? "Le coach IA envoie à Claude (Anthropic) les temps de la séance et, si vous l’acceptez ici, votre fréquence cardiaque. Votre journal santé n’est jamais envoyé." : "Le coach intégré analyse vos séances directement dans l’application : aucune donnée n’est envoyée à un service d’IA."}>
      <List>
        <div className="row"><span className="label"><span className="t">Données de santé</span><span className="s">{'Sommeil, poids, prises de sang' + (profile.sex === 'F' ? ', cycle menstruel' : '') + ', forme'}</span></span><Switch checked={profile.consent_health} onChange={v => set({ consent_health: v })} label="Données de santé" /></div>
        {COACH_MODE === 'claude' && <div className="row"><span className="label"><span className="t">Coach IA (Claude)</span><span className="s">Analyse automatique après chaque séance</span></span><Switch checked={profile.consent_ai} onChange={v => set({ consent_ai: v })} label="Coach IA" /></div>}
      </List>
    </Sec>
    <Sec title="Données">
      <List>
        <Row icon="heart" color="#ff375f" title="Synchronisation Santé (iPhone)" sub="Sommeil et cardio envoyés automatiquement" href="#/moi/sync" />
        <Row icon="upload" color="#0a84ff" title="Exporter mes données (JSON)" onClick={exportAll} />
        {api.demo && <Row icon="undo" color="#8e8e93" title="Réinitialiser la démo" onClick={() => { api.reset(); location.reload() }} />}
        {api.demo && <Row icon="close" color="#8e8e93" title="Quitter le mode démo" onClick={() => setDemo(false)} />}
        <Row icon="user" color="#ff453a" title="Se déconnecter" sub={user.email} onClick={() => api.auth.signOut()} />
      </List>
    </Sec>
    <p className="foot">Suppression du compte : demandez-la via « Signaler un bug » (catégorie suggestion) ; l’administrateur la fait depuis Supabase.</p>
  </Page>
}

// ---------------- Import ----------------
export function Import() {
  const { teams, profile, user, reload } = useApp(), toast = useToast()
  const [file, setFile] = useState(null), [json, setJson] = useState(null), [me, setMe] = useState(''), [team, setTeam] = useState('')
  const [ex, setEx] = useState(false), [busy, setBusy] = useState(''), [err, setErr] = useState(''), [otherName, setOtherName] = useState('')
  const { sessions } = useApp()
  const mine = activeTeams(teams, profile.id)
  const ath = json ? athletesIn(json) : []
  async function read(f) { setErr(''); setFile(f); try { const j = JSON.parse(await f.text()); if (!detect(j)) throw new Error('Fichier non reconnu.'); setJson(j); setMe(athletesIn(j)[0] || ''); setTeam(mine[0] ? mine[0].id : '') } catch (e) { setErr(e.message); setJson(null) } }
  async function run() {
    setErr('')
    try {
      const t = mine.find(x => x.id === team), slots = t ? slotsOf(t) : { A: user.id, B: null }
      const meSlot = slots.A === user.id ? 'A' : 'B', other = meSlot === 'A' ? 'B' : 'A'
      const map = { [me]: meSlot }; ath.filter(a => a !== me).forEach(a => { map[a] = other })
      const res = convert(json, map, { includeExamples: ex })
      const partner = t ? t.members.find(m => m.user_id !== user.id) : null
      const letter = ath.find(a => a !== me), oName = (partner && partner.profile.display_name) || otherName.trim() || ({ L: 'Laurent', P: 'Pierre' }[letter]) || 'Partenaire'
      const duoFile = ath.length > 1
      let n = 0, nh = 0, pending = 0, dup = 0
      for (const s of res.sessions) {
        setBusy(`Séance ${n + 1}/${res.sessions.length}`)
        // Déjà importée (même départ) : on ne la duplique pas
        if (sessions.some(x => x.data && x.data.startedAt && x.data.startedAt === s.data.startedAt && (x.team_id || null) === (t ? t.id : null))) { dup++; continue }
        const athletes = { A: null, B: null }; athletes[meSlot] = user.id; if (t && slots[other]) athletes[other] = slots[other]
        const names = { [meSlot]: profile.display_name, ...(duoFile ? { [other]: oName } : {}) }
        // Cardio du partenaire pas encore inscrit : gardé dans la séance, transféré automatiquement quand il rejoint le duo
        const data = { ...s.data }, pend = {}
        for (const [w, h] of Object.entries(s.hr)) if (!athletes[w]) { if (t) { pend[w] = h; pending++ } }
        if (Object.keys(pend).length) data.pendingHr = pend
        const row = await api.sessions.save({ owner: user.id, team_id: t ? t.id : null, name: s.name, session_date: s.session_date, kind: s.kind, athletes, names, data })
        for (const [w, h] of Object.entries(s.hr)) { if (!athletes[w]) continue; await api.hr.save({ session_id: row.id, user_id: athletes[w], ...h }); nh++ }
        n++
      }
      if (t && res.strat) await api.teams.update(t.id, { plan: { ...(t.plan || {}), strat: res.strat } })
      if (res.zones[meSlot] && res.zones[meSlot].hr_zones) await api.profiles.update(user.id, res.zones[meSlot])
      await reload(); setBusy(''); toast(`${n} séance(s) et ${nh} relevé(s) cardio importés${dup ? ` (${dup} déjà présente(s))` : ''}`)
      if (pending) setErr(`${pending} relevé(s) cardio de ${oName} sont gardés dans les séances : ils lui seront attribués automatiquement quand il rejoindra le duo avec le code d’invitation.`)
      else location.hash = '#/seances'
    } catch (e) { setErr(e.message); setBusy('') }
  }
  return <Page back="#/moi" title="Importer" subtitle="Sauvegarde « Chrono Hyrox Duo » (.json) ou export de l’app iPhone.">
    <List><label className="row"><span className="label"><span className="t">{file ? file.name : 'Choisir le fichier'}</span>{json && <span className="s">{detect(json) === 'chrono' ? Object.keys(json.collections.sessions || {}).length + ' séances' : '1 séance (app iPhone)'}</span>}</span><span className="btn tinted small">Parcourir</span><input type="file" accept=".json,application/json" hidden onChange={e => e.target.files[0] && read(e.target.files[0])} /></label></List>
    {json && <>
      <h2 className="sec">Correspondance</h2>
      <List>
        <Field label="Qui êtes-vous dans ce fichier ?"><select value={me} onChange={e => setMe(e.target.value)}>{ath.map(a => <option key={a} value={a}>{a}</option>)}</select></Field>
        <Field label="Duo de destination"><select value={team} onChange={e => setTeam(e.target.value)}>{mine.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}<option value="">Solo</option></select></Field>
        {ath.length > 1 && !(mine.find(t => t.id === team) || { members: [] }).members.some(m => m.user_id !== user.id) && <Field label="Prénom de l’autre athlète" sub="Il rejoindra le duo plus tard"><input value={otherName} placeholder={ath.find(a => a !== me) === 'L' ? 'Laurent' : ath.find(a => a !== me) === 'P' ? 'Pierre' : 'Partenaire'} onChange={e => setOtherName(e.target.value)} /></Field>}
        <div className="row"><span className="label"><span className="t">Inclure les séances d’exemple</span></span><Switch checked={ex} onChange={setEx} label="Exemples" /></div>
      </List>
      <p className="foot">La stratégie de relais et vos zones cardio sont aussi reprises. Pour un duo : créez d’abord le duo (onglet Équipe) puis importez dedans ; votre partenaire retrouvera ses temps et son cardio en rejoignant le duo avec le code. Un nouvel import ne crée pas de doublon.</p>
      <button className="btn block" style={{ marginTop: 12 }} disabled={!!busy} onClick={run}>{busy || 'Importer'}</button>
    </>}
    {err && <p className="err">{err}</p>}
  </Page>
}

// ---------------- Synchronisation automatique avec l'app Santé ----------------
const b64url = a => btoa(String.fromCharCode(...a)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
async function sha256hex(s) { const h = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))); return [...h].map(x => x.toString(16).padStart(2, '0')).join('') }

export function HealthSync() {
  const { profile } = useApp(), toast = useToast()
  const toks = useLoad(() => api.health.tokens(), [])
  const [fresh, setFresh] = useState(null), [label, setLabel] = useState('iPhone'), [test, setTest] = useState('')
  const [how, setHow] = useState('raccourci')
  const url = api.health.endpoint()
  async function create() {
    const token = 'hx_' + b64url(crypto.getRandomValues(new Uint8Array(32)))
    await api.health.addToken(await sha256hex(token), label || 'iPhone'); setFresh(token); toks.reload()
  }
  const copy = async (t, m) => { try { await navigator.clipboard.writeText(t); toast(m || 'Copié') } catch { toast('Copie impossible : sélectionnez le texte') } }
  async function runTest() {
    setTest('Envoi…')
    try {
      const now = new Date(), iso = d => d.toISOString()
      const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json', 'x-sync-token': fresh }, body: JSON.stringify({ heart_rate: { dates: [iso(now)], values: [70] } }) })
      const j = await r.json(); setTest(r.ok ? 'Connexion réussie : la fonction répond et le jeton est accepté.' : 'Erreur : ' + (j.error || r.status))
    } catch (e) { setTest('Erreur : ' + e.message + ' (fonction « health-sync » déployée ?)') }
  }
  if (!profile.consent_health) return <Page back="#/moi/reglages" title="Synchro Santé"><div className="glass card"><p className="small">Activez d’abord « Données de santé » dans les réglages.</p></div></Page>
  return <Page back="#/moi/reglages" title="Synchro Santé" subtitle="Sommeil et fréquence cardiaque envoyés automatiquement par votre iPhone.">
    <div className="glass card small">
      <b>Comment ça marche</b> : une application web ne peut pas lire l’app Santé directement (Apple le réserve aux apps installées). C’est donc l’iPhone qui envoie les données, automatiquement :
      <div className="tip"><span className="dot good" /><span><b>chaque matin</b> : vos nuits (durée, phases, coucher et lever) ;</span></div>
      <div className="tip"><span className="dot good" /><span><b>à la fin de chaque entraînement</b> (Apple Watch) : votre fréquence cardiaque, rattachée automatiquement à la séance chronométrée dans l’app, avec le détail par atelier dans l’onglet Cardio.</span></div>
      Un import manuel garde toujours la priorité ; une saisie manuelle du sommeil n’est jamais écrasée.
    </div>

    <h2 className="sec">1. Votre jeton personnel</h2>
    {fresh ? <div className="glass card">
      <p className="small" style={{ marginTop: 0 }}><b>Copiez ce jeton maintenant</b> : il ne sera plus affiché. Il remplace votre mot de passe pour l’envoi des données ; ne le partagez pas.</p>
      <div className="mono small" style={{ wordBreak: 'break-all', padding: 10, borderRadius: 10, background: 'var(--fill)' }}>{fresh}</div>
      <div className="row-gap" style={{ marginTop: 8 }}><button className="btn small" onClick={() => copy(fresh, 'Jeton copié')}><Icon name="copy" size={16} />Copier le jeton</button><button className="btn glass small" onClick={runTest}>Tester la connexion</button></div>
      {test && <p className="small">{test}</p>}
    </div> : <List>
      <Field label="Nom de l’appareil"><input value={label} onChange={e => setLabel(e.target.value)} /></Field>
      <Row icon="plus" color="#30d158" title="Créer un jeton" onClick={create} />
    </List>}
    {(toks.data || []).length > 0 && <List className="" >{toks.data.map(t => <div className="row" key={t.id}><span className="label"><span className="t">{t.label}</span><span className="s">Créé le {frDate(t.created_at.slice(0, 10))}{t.last_used ? ` · dernier envoi ${new Date(t.last_used).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })} · ${t.last_summary}` : ' · jamais utilisé'}</span></span>
      <button className="btn plain small" style={{ color: 'var(--bad)' }} onClick={async () => { if (confirm('Révoquer ce jeton ? L’iPhone ne pourra plus envoyer de données.')) { await api.health.removeToken(t.id); toks.reload() } }}>Révoquer</button></div>)}</List>}

    <h2 className="sec">2. Adresse d’envoi</h2>
    <List><div className="row"><span className="label"><span className="t mono small" style={{ whiteSpace: 'normal', wordBreak: 'break-all' }}>{url}</span></span><button className="btn tinted small" onClick={() => copy(url, 'Adresse copiée')}>Copier</button></div></List>

    <h2 className="sec">3. Sur l’iPhone</h2>
    <Seg value={how} onChange={setHow} options={[['raccourci', 'Raccourcis (gratuit)'], ['hae', 'Health Auto Export']]} />
    {how === 'raccourci' ? <div className="glass card small" style={{ lineHeight: 1.5 }}>
      <b>Raccourci « Hyrox FC »</b> (app Raccourcis › +) :
      <ol style={{ paddingLeft: 18, margin: '6px 0' }}>
        <li><i>Rechercher des échantillons de santé</i> : Type <b>Fréquence cardiaque</b>, Date de début <b>au cours des 4 dernières heures</b>, trier par Date de début, aucune limite.</li>
        <li><i>Répéter avec chaque</i> élément : <i>Formater la date</i> (Date de début de l’élément, format <b>ISO 8601</b>, avec l’heure) ; puis <i>Ajouter à la variable</i> <b>dates</b>. Ajoutez la <i>Valeur</i> de l’élément à la variable <b>valeurs</b>.</li>
        <li><i>Obtenir le contenu de l’URL</i> : l’adresse ci-dessus, Méthode <b>POST</b>, En-têtes : <b>x-sync-token</b> = votre jeton, Corps <b>JSON</b> : clé <b>heart_rate</b> (dictionnaire) contenant <b>dates</b> = variable dates et <b>values</b> = variable valeurs.</li>
      </ol>
      <b>Raccourci « Hyrox Sommeil »</b> : même principe avec Type <b>Analyse du sommeil</b> sur <b>les dernières 24 heures</b>, trois variables <b>starts</b> (date de début), <b>ends</b> (date de fin), <b>values</b> (valeur), envoyées dans une clé <b>sleep</b>.
      <p style={{ marginBottom: 0 }}><b>Automatisations</b> (Raccourcis › Automatisation › +) : « <b>Apple Watch – Entraînement › se termine</b> » → Hyrox FC ; « <b>Heure de la journée</b> 9:00 » → Hyrox Sommeil ; choisissez <b>Exécuter immédiatement</b> pour qu’aucune confirmation ne soit demandée.</p>
    </div> : <div className="glass card small" style={{ lineHeight: 1.5 }}>
      Application <b>Health Auto Export – JSON+CSV</b> (abonnement Premium pour les automatisations) :
      <ol style={{ paddingLeft: 18, margin: '6px 0' }}>
        <li>Automations › New › <b>REST API</b> ; URL = l’adresse ci-dessus.</li>
        <li>Headers : <b>x-sync-token</b> = votre jeton.</li>
        <li>Data Type <b>Health Metrics</b> : cochez <b>Heart Rate</b> et <b>Sleep Analysis</b> ; Format <b>JSON</b> ; Period <b>Since last sync</b> ; Sync Cadence toutes les heures (ou après chaque entraînement).</li>
      </ol>
      Plus simple à régler et plus fiable que les Raccourcis pour de gros volumes de mesures.
    </div>}
    <p className="foot">Données reçues : uniquement la fréquence cardiaque et le sommeil, stockés dans votre espace privé. Votre partenaire ne voit votre cardio que sur les séances communes, comme pour un import manuel.</p>
  </Page>
}
