import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useApp } from '../App.jsx'
import { hasB } from '../lib/session.js'
import { api, COACH_MODE } from '../lib/api.js'
import { Page, List, Row, Field, Seg, Empty, Icon, Stat, Sheet, Switch, useToast, useLoad } from '../ui.jsx'
import { LineChart, DeltaBars, ZoneBar, COLORS } from '../charts.jsx'
import { SEGS, N, STATION, STATIONS, normPlan, planRelays, fmt, fd, fp, tone, frDate, parseT, fmtU, kmStr } from '../lib/hyrox.js'
import { normData, nextIdx, segStart, split, objCum, actions, relDur, relObj, relAmt, stStats, runKm, athKm, unitOf } from '../lib/session.js'
import { summary, insights, hrBySegment, slotOf, segmentDetail, cyclePerformance } from '../lib/analyze.js'
import { phaseOn, adjustTime, PHASE_LABEL, PHASE_COLOR } from '../lib/health.js'
import { isCustom, customEnd, customSummary, doneOf, achievement, exLabel, fmtTarget, progression, isQuick, isPlanned } from '../lib/custom.js'
import { QuickSheet } from './Activity.jsx'
import { CustomChrono, CustomResults, CustomStats, hrBySteps } from './Custom.jsx'
import { StretchSuggest } from './Body.jsx'
import { localCoach } from '../lib/coachLocal.js'
import { readHRFile, series, zonesOf, ZONE_NAMES, seriesFromSamples } from '../lib/hr.js'
import { KIND, plansOf, profileOf, nameOf, isKeeperOnly, isAthlete, athleteNames } from './common.js'
import { KeeperPicker } from './Sessions.jsx'
import { logError } from '../lib/bugs.js'

const TABS = [['chrono', 'Chrono'], ['temps', 'Temps'], ['cardio', 'Cardio'], ['stats', 'Stats'], ['coach', 'Coach']]

export default function SessionPage({ id, tab: tab0 }) {
  const app = useApp()
  const { sessions, teams, profile, reload } = app
  const toast = useToast()
  const base = sessions.find(s => s.id === id)
  const [s, setS] = useState(base || null)
  const hist = useRef([])
  useEffect(() => { if (!s && base) setS(base) }, [base])
  useEffect(() => { if (!base) api.sessions.get(id).then(x => x && setS(x)) }, [id])
  // Suivi en direct : les autres membres voient les temps arriver
  useEffect(() => api.sessions.subscribe(id, row => setS(cur => (!cur || (row.updated_at || '') > (cur.updated_at || '')) ? { ...cur, ...row } : cur)), [id])
  const [editing, setEditing] = useState(null)
  const team = s && teams.find(t => t.id === s.team_id)
  const plan = useMemo(() => normPlan((s && s.plan) || (team && team.plan)), [team, s && s.plan])
  if (!s) return <Page back="#/seances" title="Séance"><p className="muted">Chargement…</p></Page>
  const d = normData(s.data)
  const duo = hasB(s)
  const who = w => { const uid = s.athletes[w]; if (uid === profile.id) return profile.display_name; const p = profileOf(uid, teams, profile); return (p && p.display_name) || (s.names && s.names[w]) || 'Athlète ' + w }
  const keeperOnly = isKeeperOnly(s, profile.id, teams)

  async function commit(nd, extra = {}) {
    hist.current.push(s.data); if (hist.current.length > 60) hist.current.shift()
    const next = { ...s, ...extra, data: nd, updated_at: new Date().toISOString() }
    setS(next)
    try { const row = await api.sessions.save({ id: s.id, data: nd, ...extra }); setS(cur => ({ ...cur, updated_at: row.updated_at })) }
    catch (e) { toast('Enregistrement impossible : ' + e.message); logError('save session: ' + e.message) }
  }
  async function patch(extra) { setS({ ...s, ...extra }); await api.sessions.save({ id: s.id, ...extra }); reload(['sessions']) }
  function undo() { const prev = hist.current.pop(); if (prev) { setS({ ...s, data: prev }); api.sessions.save({ id: s.id, data: prev }) } }
  const ctx = { s, d, plan, team, duo, who, commit, patch, undo, canUndo: hist.current.length > 0, keeperOnly }
  const custom = isCustom(s)
  // Séance terminée : on ouvre l'analyse plutôt que le chrono
  const finished = custom ? customSummary(s).complete : d && d.cp && d.cp[d.cp.length - 1] != null
  const tab = tab0 || (finished ? (keeperOnly ? 'temps' : 'stats') : 'chrono')
  const T = custom ? [['chrono', 'Chrono'], ['temps', 'Réalisé'], ['cardio', 'Cardio'], ['stats', 'Analyse'], ['coach', 'Coach']] : TABS
  const tabs = keeperOnly ? T.filter(([k]) => k === 'chrono' || k === 'temps') : T
  const go = t => { window.__hxReplace = true; location.replace('#/seance/' + id + '/' + t) }

  const canEdit = !keeperOnly && (s.owner === profile.id || isAthlete(s, profile.id))
  const editBtn = canEdit && <button className="btn glass small" onClick={() => isQuick(s) ? setEditing('quick') : isPlanned(s) ? (location.hash = '#/seance/specifique?edit=' + s.id) : setEditing('info')}><Icon name="gear" size={14} />Modifier</button>
  return <Page back="#/seances" title={tab === 'chrono' ? null : s.name} actions={editBtn} subtitle={tab === 'chrono' ? null : `${frDate(s.session_date)} · ${KIND[s.kind]}${team ? ' · ' + team.name : duo ? ' · duo' : ' · solo'}`}>
    {editing === 'quick' && <QuickSheet session={s} onClose={ok => { setEditing(null); if (ok) api.sessions.get(s.id).then(x => x && setS(x)) }} />}
    {editing === 'info' && <InfoSheet s={s} onClose={ok => { setEditing(null); if (ok) api.sessions.get(s.id).then(x => x && setS(x)) }} />}
    <Seg value={tab} onChange={go} options={tabs} />
    {tab === 'chrono' && <KeeperBar {...ctx} setS={setS} />}
    {tab === 'chrono' && (custom ? <CustomChrono {...ctx} /> : <Chrono {...ctx} />)}
    {tab === 'chrono' && custom && <CustomCoachTrigger s={s} who={who} />}
    {tab === 'temps' && (custom ? <CustomResults {...ctx} /> : <Times {...ctx} />)}
    {tab === 'cardio' && <Cardio {...ctx} />}
    {tab === 'stats' && (custom ? <CustomStats {...ctx} /> : <Stats {...ctx} />)}
    {tab === 'coach' && <Coach {...ctx} />}
  </Page>
}

// =====================================================================
// Pointeur : qui enregistre les temps
// =====================================================================
function KeeperBar({ s, keeperOnly, who, duo, setS }) {
  const { profile, reload } = useApp(), toast = useToast()
  const [open, setOpen] = useState(false)
  const keeper = useLoad(() => s.timekeeper && s.timekeeper !== profile.id ? api.profiles.get(s.timekeeper) : null, [s.timekeeper])
  if (keeperOnly) return <div className="note" style={{ marginTop: 0 }}><b>Vous enregistrez les temps</b> de {duo ? who('A') + ' et ' + who('B') : who('A')}. Ils les voient arriver en direct.</div>
  const label = !s.timekeeper ? 'Vous / les athlètes' : s.timekeeper === profile.id ? 'Vous' : (keeper.data && keeper.data.display_name) || (s.names && s.names.keeper) || 'Une autre personne'
  async function choose(uid) {
    try { const row = await api.sessions.setKeeper(s.id, uid); setS(cur => ({ ...cur, timekeeper: row.timekeeper })); reload(['sessions']); toast(uid ? 'Pointage confié' : 'Vous pointez vous-même'); setOpen(false) } catch (e) { toast(e.message) }
  }
  async function share() {
    const text = `Peux-tu enregistrer mes temps sur Hyrox Coach ? Séances › Pointer un athlète › code ${s.keeper_code} : ${location.origin}`
    try { if (navigator.share) await navigator.share({ text }); else { await navigator.clipboard.writeText(text); toast('Invitation copiée') } } catch {}
  }
  return <>
    <List><Row icon="timer" color="#30d158" title={'Pointage : ' + label} sub={s.keeper_code ? 'Code de pointage : ' + s.keeper_code : ''} onClick={() => setOpen(true)} /></List>
    <div style={{ height: 12 }} />
    {open && <Sheet title="Qui enregistre les temps ?" onClose={() => setOpen(false)}>
      <KeeperPicker value={s.timekeeper} onChange={choose} exclude={Object.values(s.athletes || {}).filter(Boolean)} />
      {s.keeper_code && <div className="glass card center" style={{ marginTop: 12 }}>
        <div className="small muted">Code de pointage à donner</div>
        <div className="num" style={{ fontSize: 38, fontWeight: 800, letterSpacing: '.12em' }}>{s.keeper_code}</div>
        <button className="btn tinted small" onClick={share}><Icon name="copy" size={16} />Envoyer le code</button>
      </div>}
      <p className="foot">La personne qui pointe peut enregistrer et corriger les temps, sans voir votre cardio ni vos données de santé. Vous pouvez toujours pointer en même temps qu’elle.</p>
    </Sheet>}
  </>
}

// =====================================================================
// Chrono
// =====================================================================
function useNow(on) {
  const [n, setN] = useState(Date.now())
  useEffect(() => { if (!on) return; const t = setInterval(() => setN(Date.now()), 100); return () => clearInterval(t) }, [on])
  return n
}
function Chrono({ s, d, plan, duo, who, commit, undo, canUndo, keeperOnly }) {
  const { profile } = useApp(), toast = useToast()
  const i = nextIdx(d), started = d.startedAt != null, done = i < 0
  const now = useNow(started && !done)
  const t = started ? now - d.startedAt : 0
  const autoAsked = useRef(false)
  useEffect(() => {
    if (done && started && coachAllowed(profile) && isAthlete(s, profile.id) && !autoAsked.current) {
      autoAsked.current = true
      api.coach.list(s.id).then(list => { if (!list.length) { toast('Séance terminée : analyse du coach en cours…'); askCoach(s, d, plan, who, profile).then(() => toast('Conseils du coach disponibles')).catch(e => toast(e.message)) } })
    }
  }, [done])
  if (!started) return <div className="glass card center">
    <div className="clock num">0:00</div>
    <p className="muted">{SEGS.length} segments : 8 courses de {kmStr(d.runKm)}, les Rox et les 8 ateliers{duo ? ' en relais' : ''}.</p>
    <button className="btn green block" style={{ minHeight: 70, fontSize: 20 }} onClick={() => commit({ ...actions.start(d, Date.now()), cp: d.cp })}><Icon name="play" />Départ</button>
  </div>
  if (done) { const tot = d.cp[N - 1] / 1000, o = objCum(plan, N - 1); return <div className="glass card center">
    <div className="small muted">Temps final</div><div className="clock num">{fmt(tot)}</div>
    <div className={'num ' + tone(tot - o)} style={{ fontWeight: 600 }}>{fd(tot - o)} vs objectif ({fmt(o)})</div>
    <div className="row-gap" style={{ justifyContent: 'center', marginTop: 16 }}>
      {keeperOnly ? <a className="btn" href={'#/seance/' + s.id + '/temps'}>Voir les temps</a> : <><a className="btn" href={'#/seance/' + s.id + '/stats'}>Voir les stats</a><a className="btn glass" href={'#/seance/' + s.id + '/coach'}>Conseils du coach</a></>}
    </div>
    {canUndo && <button className="btn plain small" style={{ marginTop: 10 }} onClick={undo}><Icon name="undo" size={16} />Annuler le dernier pointage</button>}
  </div> }

  const g = SEGS[i], segT = (t - segStart(d, i)) / 1000, objSeg = plan.obj[g.id] || 0
  const ahead = t / 1000 - objCum(plan, i - 1) - Math.min(segT, objSeg)
  const st = g.type === 'st' ? g : g.type === 'rox' && g.dir === 'in' ? SEGS[i + 1] : null
  const rels = st ? d.relays[st.id] || [] : []
  const open = rels.length && rels[rels.length - 1].e == null ? rels[rels.length - 1] : null
  const pr = st ? planRelays(plan, st.id) : []
  const nextPlanned = pr[rels.length] || null
  const nm = w => who(w) || w
  const other = w => w === 'A' ? 'B' : 'A'
  const act = (fn, ...a) => commit(fn(d, Date.now() - d.startedAt, ...a))
  const sBtn = (w, label, fn, small) => <button key={w + label} className={'btn ' + (w === 'B' ? 'who-b' : 'who-a')} onClick={() => act(fn, w, plan)}>{label}<small>{small}</small></button>

  let pad
  if (g.type === 'run') pad = <button className="btn full" onClick={() => act(actions.endSegment)}>Fin de la course {g.k + 1}<small>→ Rox vers {STATION[SEGS[i + 2].id].label}</small></button>
  else if (g.type === 'rox' && g.dir === 'out') pad = <button className="btn full" onClick={() => act(actions.endSegment)}>Départ course {g.k + 2}<small>fin du Rox</small></button>
  else if (g.type === 'rox' && !duo) pad = <button className="btn full" onClick={() => act(actions.endSegment)}>Début {STATION[st.id].label}<small>fin du Rox</small></button>
  else if (g.type === 'rox') { const first = (pr[0] && pr[0].w) || 'A'; pad = <>{sBtn(first, 'Départ ' + nm(first), actions.roxStart, 'premier relais (plan)')}{sBtn(other(first), 'Départ ' + nm(other(first)), actions.roxStart, 'hors plan')}</> }
  else if (!duo) pad = <button className="btn full" onClick={() => act(actions.endSegment)}>Fin {STATION[st.id].label}<small>→ Rox</small></button>
  else if (open) pad = <>
    {sBtn(other(open.w), 'Relais → ' + nm(other(open.w)), actions.swapRelay, nextPlanned ? (nextPlanned.w === other(open.w) ? 'prévu ' + nextPlanned.label : 'hors plan') : 'au-delà du plan')}
    <button className="btn red" onClick={() => act(actions.exitStation)}>Sortie atelier<small>fin du dernier relais</small></button>
    <button className="btn glass full small" style={{ minHeight: 44 }} onClick={() => act(actions.stopRelay)}>Fin du relais de {nm(open.w)} (pause)</button>
  </>
  else pad = <>{sBtn((nextPlanned && nextPlanned.w) || 'A', 'Départ ' + nm((nextPlanned && nextPlanned.w) || 'A'), actions.startRelay, nextPlanned ? nextPlanned.label : '')}{sBtn(other((nextPlanned && nextPlanned.w) || 'A'), 'Départ ' + nm(other((nextPlanned && nextPlanned.w) || 'A')), actions.startRelay, '')}
    <button className="btn red full" onClick={() => act(actions.exitStation)}>Sortie atelier</button></>

  const relT = open ? (t - open.s) / 1000 : null, ro = open ? relObj(d, plan, st.id, rels.length - 1, open) : null
  return <>
    <div className="glass card">
      <div className="clock num">{fmt(t / 1000)}</div>
      <div className={'center num small ' + tone(ahead)}>{fd(ahead)} sur l’objectif</div>
      <div className="progress"><i style={{ width: (i / N * 100) + '%' }} /></div>
      <div className="cur">{g.label}{g.sub ? ' · ' + g.sub : ''}</div>
      <div className="cur-sub num">{fmt(segT, true)} / {fmt(objSeg)}{open ? ` · ${nm(open.w)} : ${fmt(relT)}${ro ? ' / ' + fmt(ro) : ''}${open.a != null ? ' (' + fmtU(open.a, plan.strat[st.id].u) + '→' + fmtU(open.b, plan.strat[st.id].u) + ')' : ''}` : ''}</div>
      {st && duo && pr.length > 0 && <div className="row-gap" style={{ justifyContent: 'center', marginBottom: 10 }}>{pr.map((r, k) => <span key={k} className={'badge ' + (k < rels.length ? '' : k === rels.length ? 'accent' : '')} style={{ opacity: k < rels.length - (open ? 1 : 0) ? .5 : 1 }}><span className={r.w === 'A' ? 'dotA' : 'dotB'} />{r.label}</span>)}</div>}
      <div className="pad">{pad}</div>
    </div>
    <div className="row-gap">
      <button className="btn glass small" disabled={!canUndo} onClick={undo}><Icon name="undo" size={16} />Annuler</button>
      <span className="spacer" />
      <span className="small muted">Segment {i + 1}/{N}</span>
    </div>
    {d.cp.some(v => v != null) && <List className="" ><LastSplits d={d} plan={plan} i={i} /></List>}
  </>
}
function LastSplits({ d, plan, i }) {
  const rows = []; for (let k = i - 1; k >= 0 && rows.length < 4; k--) { const v = split(d, k), o = plan.obj[SEGS[k].id]; rows.push(<Row key={k} title={SEGS[k].label} value={fmt(v)} sub={fd(v - o) + ' vs ' + fmt(o)} />) }
  return <>{rows}</>
}

// =====================================================================
// Temps (tableau, édition)
// =====================================================================
function Times({ s, d, plan, duo, who, commit, patch, keeperOnly }) {
  const { reload } = useApp(), toast = useToast()
  const [edit, setEdit] = useState(false)
  function setSplit(i, str) {
    const v = parseT(str); if (v == null || Number.isNaN(v)) return
    const old = split(d, i); if (old == null) return
    const delta = Math.round((v - old) * 1000), nd = JSON.parse(JSON.stringify(d)), lim = d.cp[i - 1] ?? 0
    nd.cp = nd.cp.map((c, k) => c != null && k >= i ? c + delta : c)
    Object.values(nd.relays).forEach(rs => rs.forEach(r => { ['s', 'e'].forEach(f => { if (r[f] != null && r[f] > lim) r[f] += delta }) }))
    commit(nd)
  }
  function setRun(id, key, v) { const nd = JSON.parse(JSON.stringify(d)); nd.runs[id] = { ...(nd.runs[id] || {}), [key]: v === '' ? null : +String(v).replace(',', '.') }; commit(nd) }
  async function del() { if (!confirm('Supprimer définitivement cette séance ?')) return; await api.sessions.remove(s.id); await reload(['sessions']); location.hash = '#/seances' }
  let cum = 0
  return <>
    <div className="row-gap" style={{ marginBottom: 8 }}><span className="spacer" /><button className="btn glass small" onClick={() => setEdit(!edit)}>{edit ? 'Terminer' : 'Modifier'}</button></div>
    <div className="glass card scroll-x"><table className="tbl"><thead><tr><th>Segment</th><th className="r">Temps</th><th className="r">Obj.</th><th className="r">Écart</th><th className="r">Cumul</th></tr></thead><tbody>
      {SEGS.map((g, i) => { const v = split(d, i), o = plan.obj[g.id]; if (v != null) cum += v; return <tr key={g.id} className={g.type}>
        <td>{g.label}{g.type === 'run' && runKm(d, g.id) !== 1 ? <span className="faint small"> · {kmStr(runKm(d, g.id))}</span> : ''}</td>
        <td className="r num">{edit && v != null ? <input defaultValue={fmt(v, true)} onBlur={e => e.target.value !== fmt(v, true) && setSplit(i, e.target.value)} style={{ width: 70, textAlign: 'right', border: 0, background: 'var(--fill)', borderRadius: 6, padding: 3 }} /> : fmt(v, g.type === 'rox')}</td>
        <td className="r num faint">{fmt(o)}</td><td className={'r num ' + tone(v != null ? v - o : null)}>{v != null ? fd(v - o) : '—'}</td>
        <td className={'r num ' + tone(v != null ? cum - objCum(plan, i) : null)}>{v != null ? fmt(cum) : ''}</td></tr> })}
    </tbody></table></div>
    {edit && <>
      <h2 className="sec">Distances de course</h2>
      <List>
        <Field label="Distance par défaut" sub="km"><input type="number" step="0.05" defaultValue={d.runKm} onBlur={e => commit({ ...d, runKm: +e.target.value || 1 })} /></Field>
        {SEGS.filter(g => g.type === 'run').map(g => <div className="row" key={g.id}><span className="label"><span className="t">{g.label}</span>{duo && <span className="s">Si un athlète n’a pas tout couru</span>}</span>
          <input type="number" step="0.05" placeholder={String(d.runKm)} defaultValue={(d.runs[g.id] || {}).km ?? ''} onBlur={e => setRun(g.id, 'km', e.target.value)} style={{ width: 64 }} aria-label="km" />
          {duo && ['A', 'B'].map(w => <input key={w} type="number" step="0.05" placeholder={who(w)} defaultValue={(d.runs[g.id] || {})[w] ?? ''} onBlur={e => setRun(g.id, w, e.target.value)} style={{ width: 70 }} aria-label={'km ' + who(w)} />)}</div>)}
      </List>
      <h2 className="sec">Séance</h2>
      <List>
        <Field label="Nom"><input defaultValue={s.name} onBlur={e => patch({ name: e.target.value })} /></Field>
        <Field label="Date"><input type="date" defaultValue={s.session_date} onBlur={e => patch({ session_date: e.target.value })} /></Field>
        <Field label="Type"><select defaultValue={s.kind} onChange={e => patch({ kind: e.target.value })}>{Object.entries(KIND).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></Field>
        <Field label="Effort ressenti" sub="1 à 10"><select value={d.rpe || ''} onChange={e => commit({ ...d, rpe: e.target.value ? +e.target.value : null })}><option value="">—</option>{[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(v => <option key={v} value={v}>{v}/10</option>)}</select></Field>
        <div className="row stack"><span className="small muted">Note</span><textarea defaultValue={d.note} onBlur={e => commit({ ...d, note: e.target.value })} /></div>
      </List>
      {!keeperOnly && <button className="btn plain block" style={{ color: 'var(--bad)', marginTop: 10 }} onClick={del}>Supprimer la séance</button>}
    </>}
    {!edit && (d.rpe || d.avgHR) && <p className="note">{[d.rpe && 'Effort ressenti ' + d.rpe + '/10', d.avgHR && 'FC moyenne ' + d.avgHR + ' bpm', d.manual && 'temps saisis après coup'].filter(Boolean).join(' · ')}</p>}
    {!edit && d.note && <p className="note">{d.note}</p>}
  </>
}

// =====================================================================
// Cardio
// =====================================================================
function Cardio({ s, d, duo, who }) {
  const { teams, profile } = useApp(), toast = useToast()
  const rows = useLoad(() => api.hr.list(s.id), [s.id])
  const [busy, setBusy] = useState(null)
  const firstSt = SEGS.findIndex((g, i) => g.type === 'st' && d.cp[i] != null)
  const [seg, setSeg] = useState(firstSt >= 0 ? firstSt : 0)
  const slots = duo ? ['A', 'B'] : ['A']
  const custom = isCustom(s)
  const end = (custom ? customEnd(s.data) : Math.max(0, ...d.cp.filter(v => v != null))) || 3600e3
  async function upload(w, file) {
    if (!d.startedAt) return toast('Lancez d’abord la séance')
    setBusy(w + ' 0 %')
    try {
      const r = await readHRFile(file, d.startedAt, end, p => setBusy(w + ' ' + Math.round(p * 100) + ' %'))
      await api.hr.save({ session_id: s.id, user_id: s.athletes[w], t: r.t, bpm: r.bpm, source: file.name, offset_s: 0 })
      toast(`${r.t.length} mesures importées pour ${who(w)}`); rows.reload()
    } catch (e) { toast(e.message); logError('import FC: ' + e.message) } finally { setBusy(null) }
  }
  // Fréquence cardiaque déjà reçue automatiquement de l'app Santé (synchro iPhone)
  async function fromHealth(w) {
    if (!d.startedAt) return toast('Lancez d’abord la séance')
    setBusy(w + ' Santé…')
    try {
      const st = d.startedAt, e = st + end, days = [...new Set([new Date(st).toISOString().slice(0, 10), new Date(e).toISOString().slice(0, 10)])]
      const ser = seriesFromSamples(await api.health.samples(profile.id, days), st, e)
      if (ser.t.length < 10) { toast('Aucune mesure Santé pendant cette séance : la synchro de l’iPhone a-t-elle eu lieu ?'); return }
      await api.hr.save({ session_id: s.id, user_id: profile.id, t: ser.t, bpm: ser.bpm, source: 'Santé (auto) · app', offset_s: 0 })
      toast(`${ser.t.length} mesures récupérées depuis Santé`); rows.reload()
    } catch (e) { toast(e.message) } finally { setBusy(null) }
  }
  async function shift(row, by) { await api.hr.save({ ...row, offset_s: (row.offset_s || 0) + by }); rows.reload() }
  const get = w => (rows.data || []).find(r => r.user_id === s.athletes[w])
  const bands = custom ? (s.data.steps || []).filter(x => x.s != null && x.e != null).map(x => ({ a: x.s / 1000, b: x.e / 1000, color: '#5e5ce6' })) : SEGS.map((g, i) => g.type === 'st' && d.cp[i] != null ? { a: segStart(d, i) / 1000, b: d.cp[i] / 1000, color: '#5e5ce6' } : null).filter(Boolean)
  const ser = slots.map(w => { const S = series(get(w)); return S && { color: COLORS[w], pts: S.t.map((x, k) => [x, S.b[k]]) } }).filter(Boolean)
  const by = custom ? {} : Object.fromEntries(slots.map(w => [w, get(w) ? hrBySegment(s, get(w), profileOf(s.athletes[w], teams, profile)) : null]))
  return <>
    <List>{slots.map(w => { const r = get(w); return <div className="row stack" key={w}>
      <span className="label"><span className="t"><span className={w === 'A' ? 'dotA' : 'dotB'} />{who(w)}</span><span className="s">{r ? `${r.t.length} mesures · ${r.source}${r.offset_s ? ` · décalage ${r.offset_s > 0 ? '+' : ''}${r.offset_s} s` : ''}` : 'Export Santé (.zip), .fit, .tcx, .gpx ou .csv'}</span></span>
      <div className="row-gap">{r && <><button className="btn glass small" onClick={() => shift(r, -5)} aria-label="Décaler de -5 s">−5 s</button><button className="btn glass small" onClick={() => shift(r, 5)} aria-label="Décaler de +5 s">+5 s</button></>}
      {!s.athletes[w] && <span className="small muted">Pas encore inscrit : son cardio lui sera rattaché quand il rejoindra le duo.</span>}
      {s.athletes[w] === profile.id && profile.consent_health && <button className="btn tinted small" onClick={() => fromHealth(w)}><Icon name="heart" size={15} />Depuis Santé</button>}
      {s.athletes[w] && <label className="btn tinted small">{busy && busy.startsWith(w) ? busy.slice(2) : r ? 'Remplacer' : 'Importer'}<input type="file" hidden accept=".zip,.xml,.fit,.tcx,.gpx,.csv,.txt" onChange={e => e.target.files[0] && upload(w, e.target.files[0])} /></label>}</div>
    </div> })}</List>
    <p className="foot">Avec la synchro Santé (Moi › Réglages), le cardio de l’Apple Watch arrive tout seul après l’entraînement. Sinon : import d’un fichier, lu dans votre navigateur.</p>
    {ser.length > 0 && <>
      <div className="glass card" style={{ marginTop: 12 }}>
        <LineChart series={ser} bands={bands} height={200} />
        <div className="legend">{slots.map(w => <span key={w}><span className={w === 'A' ? 'dotA' : 'dotB'} />{who(w)}</span>)}<span><span style={{ display: 'inline-block', width: 10, height: 10, background: '#5e5ce633', marginRight: 4 }} />Ateliers</span></div>
      </div>
      {custom ? <><p className="foot">Détail par exercice, dépense et progression : onglet Analyse.</p></> : <>
      <SegmentDetail s={s} d={d} slots={slots} rows={Object.fromEntries(slots.map(w => [w, get(w)]))} who={who} seg={seg} setSeg={setSeg} />
      <h2 className="sec">Séance complète</h2>
      {slots.map(w => by[w] && <div className="glass card" key={w}><div className="row-gap"><b>{who(w)}</b><span className="spacer" /><span className="num">moy. {Math.round(by[w].all.avg)} · max {by[w].all.max} bpm</span></div><ZoneBar z={by[w].zones} /></div>)}
      <div className="glass card scroll-x"><table className="tbl"><thead><tr><th>Segment</th>{slots.map(w => <th key={w} className="r">{who(w)}</th>)}</tr></thead><tbody>
        {SEGS.map((g, i) => g.type !== 'rox' && <tr key={g.id} className={g.type} onClick={() => { setSeg(i); window.scrollTo({ top: 0, behavior: 'smooth' }) }} style={{ cursor: 'pointer' }}><td>{g.label}</td>{slots.map(w => { const x = by[w] && by[w].segs[i], partial = g.type === 'run' && duo && athKm(d, g.id, w) < runKm(d, g.id) * 0.8; return <td key={w} className="r num">{x ? Math.round(x.avg) : '—'}{partial ? <span className="faint">*</span> : ''}</td> })}</tr>)}
      </tbody></table></div>
      </>}
    </>}
    {!rows.loading && !ser.length && <div className="glass card"><Empty icon="heart">Aucune donnée cardio pour cette séance.</Empty></div>}
  </>
}

function SegmentDetail({ s, d, slots, rows, who, seg, setSeg }) {
  const { teams, profile } = useApp()
  const profiles = Object.fromEntries(slots.map(w => [w, profileOf(s.athletes[w], teams, profile)]))
  const det = segmentDetail(s, rows, profiles, seg)
  const choices = SEGS.map((g, i) => [i, g]).filter(([i, g]) => g.type !== 'rox' && d.cp[i] != null)
  if (!choices.length) return null
  const pad = det ? Math.max(20, det.dur * 0.15) : 0
  const ser = det ? slots.map(w => { const S = series(rows[w]); if (!S) return null; const pts = S.t.map((x, k) => [x, S.b[k]]).filter(([x]) => x >= det.a - pad && x <= det.e + pad); return pts.length ? { color: COLORS[w], pts } : null }).filter(Boolean) : []
  const rel = det && det.seg.type === 'st' ? (d.relays[det.seg.id] || []).filter(r => r.s != null && r.e != null).map(r => ({ a: r.s / 1000, b: r.e / 1000, color: COLORS[r.w] })) : []
  return <>
    <h2 className="sec">Détail par exercice</h2>
    <List><Field label="Exercice"><select value={seg} onChange={e => setSeg(+e.target.value)} style={{ width: '60%', direction: 'ltr' }}>{choices.map(([i, g]) => <option key={i} value={i}>{g.label}</option>)}</select></Field></List>
    {!det || !Object.keys(det.ath).length ? <div className="glass card small muted">Pas de mesures cardio pendant cet exercice.</div> : <>
      <div className="glass card" style={{ marginTop: 10 }}>
        <div className="row-gap small"><b>{det.seg.label}</b><span className="spacer" /><span className="num muted">{fmt(det.dur)}</span></div>
        {ser.length > 0 && <LineChart series={ser} bands={rel} marks={[det.a, det.e]} height={170} />}
        {det.seg.type === 'st' && rel.length > 0 && <div className="legend">{slots.map(w => <span key={w}><span className={w === 'A' ? 'dotA' : 'dotB'} />relais de {who(w)}</span>)}</div>}
      </div>
      {slots.map(w => { const x = det.ath[w]; return x && <div className="glass card" key={w}>
        <div className="row-gap"><b>{who(w)}</b><span className="spacer" /><span className="num">moy. {Math.round(x.avg)} · max {x.max} · min {Math.round(x.min)} bpm</span></div>
        <div className="small muted num">À l’entrée {x.startHR != null ? Math.round(x.startHR) : '—'} bpm · à la sortie {x.endHR != null ? Math.round(x.endHR) : '—'} bpm</div>
        <ZoneBar z={x.zones} />
      </div> })}
      {det.relays.length > 0 && <div className="glass card scroll-x"><div className="small muted" style={{ marginBottom: 4 }}>Relais : FC de celui qui travaille, de celui qui récupère, et baisse de FC dans les 30 s après son relais</div>
        <table className="tbl"><thead><tr><th>Relais</th><th className="r">Durée</th><th className="r">Effort moy/max</th><th className="r">Repos moy</th><th className="r">Récup 30 s</th></tr></thead><tbody>
          {det.relays.map(r => <tr key={r.k}><td><span className={r.w === 'A' ? 'dotA' : 'dotB'} />{r.k + 1}. {who(r.w)}</td><td className="r num">{fmt(r.dur)}</td>
            <td className="r num">{r.work ? Math.round(r.work.avg) + ' / ' + r.work.max : '—'}</td><td className="r num">{r.rest ? Math.round(r.rest.avg) : '—'}</td>
            <td className={'r num ' + (r.recovery == null ? '' : r.recovery >= 15 ? 'good' : r.recovery < 5 ? 'bad' : 'even')}>{r.recovery != null ? '−' + Math.round(r.recovery) : '—'}</td></tr>)}
        </tbody></table></div>}
    </>}
  </>
}

/** Phase du cycle le jour de la séance et temps ajusté (visible par l'athlète elle-même uniquement) */
function CycleCard({ s, sum }) {
  const { profile, sessions, teams } = useApp()
  const show = profile.sex === 'F' && profile.consent_health && isAthlete(s, profile.id)
  const cyc = useLoad(() => show ? api.journal.list('cycle') : [], [show])
  const E = cyc.data || []
  const perf = useMemo(() => E.length ? cyclePerformance(profile.id, sessions, plansOf(teams), E) : null, [E, sessions])
  if (!show || !E.length || !sum.all.n) return null
  const ph = phaseOn(E, s.session_date); if (!ph) return null
  const eff = perf.effects[ph.phase], adj = adjustTime(sum.all.t, ph.phase, perf.effects), adjD = sum.all.o ? adj - sum.all.o : null
  return <div className="glass card">
    <div className="row-gap"><span className="badge" style={{ background: PHASE_COLOR[ph.phase] + '33', color: 'var(--ink)' }}><span style={{ width: 8, height: 8, borderRadius: 4, background: PHASE_COLOR[ph.phase], display: 'inline-block' }} />J{ph.day} · phase {PHASE_LABEL[ph.phase].toLowerCase()}</span><span className="spacer" /><span className="small muted">privé</span></div>
    <div className="row-gap" style={{ marginTop: 8 }}><span className="small">Temps ajusté au cycle</span><span className="spacer" /><b className="num">{fmt(adj)}</b><span className={'num small ' + tone(adjD)}>{fd(adjD)}</span></div>
    <p className="small muted" style={{ marginBottom: 0 }}>Effet estimé de cette phase sur vos temps : {(eff.effect > 0 ? '+' : '') + (eff.effect * 100).toFixed(1).replace('.', ',')} % ({eff.n ? `d’après ${eff.n} séance(s) dans cette phase` : 'valeur moyenne des études, en attendant vos données'}). Détail dans Santé › Cycle.</p>
  </div>
}

/** Analyse du coach IA lancée automatiquement à la fin d'une séance spécialisée */
function CustomCoachTrigger({ s, who }) {
  const { profile } = useApp(), toast = useToast(), asked = useRef(false)
  const steps = (s.data && s.data.steps) || [], finished = s.data.startedAt != null && steps.length && steps.every(x => x.e != null) && steps.every(x => x.done)
  useEffect(() => {
    if (!finished || asked.current || !coachAllowed(profile) || !isAthlete(s, profile.id)) return
    asked.current = true
    api.coach.list(s.id).then(l => { if (!l.length) { toast('Séance terminée : analyse du coach en cours…'); askCoach(s, normData(s.data), null, who, profile).then(() => toast('Conseils du coach disponibles')).catch(e => toast(e.message)) } })
  }, [finished])
  return null
}

/** 2e temps : demande d'analyse approfondie par Claude (traitée comme les signalements de bugs) */
function DeepRequest({ s, d, plan, who, hasFirst, onDone }) {
  const { profile } = useApp(), toast = useToast()
  const reqs = useLoad(() => api.coach.requests(s.id), [s.id])
  const [open, setOpen] = useState(false), [q, setQ] = useState(''), [hr, setHr] = useState(true), [ok, setOk] = useState(false), [busy, setBusy] = useState(false)
  const athlete = isAthlete(s, profile.id)
  const ST = { new: ['En attente', 'warn'], doing: ['En cours d’analyse', 'accent'], done: ['Analyse disponible', 'good'], cancelled: ['Annulée', ''] }
  async function send() {
    setBusy(true)
    try {
      const payload = await coachPayload(s, d, plan, who, profile, { hrFor: hr && athlete ? [profile.id] : [] }); delete payload.insights
      try { const lv = (await api.journal.list('level'))[0]; if (lv) payload.bilan_niveau = lv.data } catch {}   // ressenti et niveau déclarés : contexte pour le coach
      const r = await api.coach.request({ session_id: s.id, pseudo: profile.display_name || '', question: q.trim().slice(0, 1000), payload })
      toast(`Demande n°${r.no} envoyée : l’analyse approfondie apparaîtra ici`); setOpen(false); setQ(''); reqs.reload(); onDone && onDone()
    } catch (e) { toast(e.message) } finally { setBusy(false) }
  }
  const pending = (reqs.data || []).filter(r => r.status === 'new' || r.status === 'doing')
  return <div className="glass card" style={{ marginTop: 12 }}>
    <div className="row-gap"><b>2e temps : analyse approfondie</b><span className="spacer" /><span className="badge">Claude</span></div>
    <p className="small muted" style={{ margin: '4px 0 8px' }}>La 1re analyse est faite tout de suite par l’application. Pour aller plus loin, demandez une analyse approfondie : votre demande est transmise à Claude, qui l’étoffe (lecture fine des relais, du cardio, de votre historique) et la dépose ici, comme pour le suivi des bugs.</p>
    {(reqs.data || []).map(r => <div className="row-gap small" key={r.id} style={{ marginBottom: 4 }}><span className="num faint">n°{r.no}</span><span className={'badge ' + ST[r.status][1]}>{ST[r.status][0]}</span><span className="muted">{new Date(r.created_at).toLocaleDateString('fr-FR')}{r.question ? ' · « ' + r.question.slice(0, 50) + (r.question.length > 50 ? '…' : '') + ' »' : ''}</span></div>)}
    {!open ? <button className="btn tinted block small" disabled={!hasFirst || pending.length > 0} onClick={() => setOpen(true)}>{pending.length ? 'Demande en cours de traitement' : hasFirst ? 'Demander l’analyse approfondie' : 'Lancez d’abord la 1re analyse'}</button> : <>
      <List><div className="row stack"><span className="small muted">Votre question (facultatif)</span><textarea rows={3} value={q} onChange={e => setQ(e.target.value)} placeholder="Ex. faut-il changer la répartition sur le Sled Push ? Quelle allure viser en course ?" /></div>
        {athlete && <div className="row"><span className="label"><span className="t">Inclure mon cardio</span><span className="s">FC par segment ou par exercice</span></span><Switch checked={hr} onChange={setHr} label="Inclure mon cardio" /></div>}
        <div className="row"><span className="label"><span className="t">J’accepte la transmission à Claude</span><span className="s">Temps, objectifs, réalisé{athlete && hr ? ', mon cardio' : ''}, prénom, sexe, âge et poids. Jamais le journal santé.</span></span><Switch checked={ok} onChange={setOk} label="Accord de transmission" /></div></List>
      <div className="row-gap" style={{ marginTop: 8 }}><button className="btn glass small" onClick={() => setOpen(false)}>Annuler</button><button className="btn small" style={{ flex: 1 }} disabled={!ok || busy} onClick={send}>{busy ? 'Envoi…' : 'Envoyer la demande'}</button></div>
    </>}
  </div>
}

// =====================================================================
// Statistiques
// =====================================================================
function Stats({ s, d, plan, duo, who }) {
  const { sessions, teams, profile } = useApp()
  const sum = useMemo(() => summary(s, plan), [s, plan])
  const prev = useMemo(() => { const o = sessions.filter(x => x.team_id === s.team_id && x.id !== s.id && x.session_date <= s.session_date)[0]; return o ? summary(o, plan) : null }, [sessions, s])
  const tips = insights(sum, prev)
  const [askBusy, setAskBusy] = useState(null), toast = useToast()
  if (!sum.all.n) return <div className="glass card"><Empty icon="chart">Les statistiques apparaissent après le premier pointage.</Empty></div>
  async function askStation(x) {
    if (!coachAllowed(profile)) return toast('Activez le coach IA dans Moi › Réglages')
    setAskBusy(x.id)
    try { await askCoach(s, d, plan, who, profile, { scope: 'station', station: x.label }); location.hash = '#/seance/' + s.id + '/coach' } catch (e) { toast(e.message) } finally { setAskBusy(null) }
  }
  return <>
    <div className="stats">
      <Stat k="Total" v={fmt(sum.all.t)} d={fd(sum.all.d) + ' · ' + fp(sum.all.d, sum.all.o)} tone={tone(sum.all.d)} />
      <Stat k="Courses" v={fmt(sum.run.t)} d={sum.pace ? fmt(sum.pace) + '/km' : ''} />
      <Stat k="Ateliers" v={fmt(sum.st.t)} d={fd(sum.st.d)} tone={tone(sum.st.d)} />
      <Stat k="Rox" v={fmt(sum.rox.t)} d={fd(sum.rox.d)} tone={tone(sum.rox.d)} />
    </div>
    <CycleCard s={s} sum={sum} />
    {tips.length > 0 && <div className="glass card">{tips.map((t, i) => <div className="tip" key={i}><span className={'dot ' + t.tone} /><span className="small">{t.text}</span></div>)}</div>}
    <h2 className="sec">Ateliers vs objectif</h2>
    <div className="glass card"><DeltaBars rows={sum.stations.map(x => ({ label: x.label, d: x.d }))} /></div>
    <h2 className="sec">Détail des ateliers</h2>
    <List>{sum.stations.filter(x => x.t != null).map(x => <div className="row stack" key={x.id}>
      <div className="row-gap"><b>{x.label}</b><span className="spacer" /><span className="num">{fmt(x.t)}</span><span className={'num small ' + tone(x.d)}>{fd(x.d)}</span></div>
      {duo && x.rel.length > 0 && <div className="small muted num">
        <span className="dotA" />{who('A')} {fmt(x.work.A)} ({x.n.A}) · <span className="dotB" />{who('B')} {fmt(x.work.B)} ({x.n.B}){x.trans != null ? ` · changements ${fmt(x.trans)}` : ''}
        <div className="row-gap" style={{ marginTop: 4 }}>{x.rel.map((r, k) => { const dur = relDur(r), o = relObj(d, plan, x.id, k, r), am = relAmt(d, plan, x.id, k, r), u = unitOf(d, plan, x.id); return <span key={k} className="badge"><span className={r.w === 'A' ? 'dotA' : 'dotB'} />{am ? fmtU(am.a, u) + '→' + fmtU(am.b, u) + ' ' : ''}{fmt(dur)}{o ? <span className={tone(dur - o)}>&nbsp;{fd(dur - o)}</span> : ''}</span> })}</div>
      </div>}
      <button className="link small" style={{ alignSelf: 'flex-start' }} onClick={() => askStation(x)} disabled={askBusy === x.id}>{askBusy === x.id ? 'Analyse…' : 'Conseil du coach sur cet atelier'}</button>
    </div>)}</List>
    <StretchSuggest s={s} />
  </>
}

// =====================================================================
// Coach IA
// =====================================================================
/** Résumé envoyé à Claude : temps, relais, cardio (si accord), historique. Aucune donnée de santé du journal. */
export async function coachPayload(s, d, plan, who, me, opts = {}) {
  const hrOk = p => p && (opts.hrFor ? opts.hrFor.includes(p.id) : p.consent_ai)   // cardio transmis seulement avec accord
  if (isCustom(s)) {   // séance spécialisée : objectifs et réalisé par exercice, FC par étape (si accord)
    const slots = hasB(s) ? ['A', 'B'] : ['A'], profs = await api.profiles.many(slots.map(w => s.athletes[w]))
    let rows = []; try { rows = await api.hr.list(s.id) } catch {}
    const hr = {}; slots.forEach(w => { const p = profs.find(x => x.id === s.athletes[w]), r = rows.find(x => x.user_id === s.athletes[w]); if (hrOk(p) && r) hr[w] = hrBySteps(s, r) })
    const sum = customSummary(s), age = p => p && p.birth_year ? new Date().getFullYear() - p.birth_year : null
    return {
      seance: { type: 'séance spécialisée (exercices au choix, pas un format Hyrox complet)', nom: s.name, date: s.session_date, note: s.data.note || undefined },
      athletes: Object.fromEntries(slots.map(w => { const p = profs.find(x => x.id === s.athletes[w]) || {}; return [w, { prenom: who(w), sexe: p.sex, age: age(p), poids: p.weight_kg }] })),
      bilan: { etapes: sum.n, realisees: sum.done, objectifs_atteints_pct: sum.achievement != null ? Math.round(sum.achievement * 100) : null, duree: fmt(sum.total), travail: fmt(sum.work) },
      exercices: sum.steps.map((x, i) => { const dn = doneOf(x), a = achievement(x); return { exercice: exLabel(x), serie: x.of > 1 ? x.set + '/' + x.of : undefined, athlete: s.athletes.B ? (x.w === 'AB' ? 'les deux' : who(x.w)) : undefined, objectif: fmtTarget(x.target), realise: fmtTarget(dn), atteint_pct: a != null ? Math.round(a * 100) : null, effort_ressenti: dn.rpe || undefined, fc: Object.fromEntries(Object.entries(hr).filter(([, h]) => h[i]).map(([w, h]) => [who(w), Math.round(h[i].avg) + ' moy / ' + h[i].max + ' max'])) } }),
      progression_proposee: progression(s, (s.athletes.A === me.id ? hr.A : hr.B) || {}).map(p => ({ exercice: p.label, prochaine_cible: fmtTarget(p.next), raison: p.why })),
      insights: [],
    }
  }
  const sum = summary(s, plan), slots = hasB(s) ? ['A', 'B'] : ['A']
  const profs = await api.profiles.many(slots.map(w => s.athletes[w]))
  const age = p => p && p.birth_year ? new Date().getFullYear() - p.birth_year : null
  let hr = {}
  try {
    const rows = await api.hr.list(s.id)
    slots.forEach(w => { const p = profs.find(x => x.id === s.athletes[w]), r = rows.find(x => x.user_id === s.athletes[w]); if (hrOk(p) && r) { const b = hrBySegment(s, r, p); if (b) hr[who(w)] = { moyenne: Math.round(b.all.avg), max: b.all.max, zones_pct: b.zones.map(z => Math.round(z * 100)), ateliers: Object.fromEntries(SEGS.map((g, i) => g.type === 'st' && b.segs[i] ? [g.label, Math.round(b.segs[i].avg)] : null).filter(Boolean)) } } })
  } catch {}
  return {
    seance: { nom: s.name, date: s.session_date, type: s.kind, km_par_course: d.runKm, note: d.note || undefined },
    athletes: Object.fromEntries(slots.map(w => { const p = profs.find(x => x.id === s.athletes[w]) || {}; return [w, { prenom: who(w), sexe: p.sex, age: age(p), poids: p.weight_kg }] })),
    total: { temps: fmt(sum.all.t), objectif: fmt(sum.all.o), ecart_s: Math.round(sum.all.d || 0), segments_pointes: sum.all.n },
    courses: SEGS.map((g, i) => g.type === 'run' && split(d, i) != null ? { course: g.k + 1, temps: fmt(split(d, i)), objectif: fmt(plan.obj[g.id]), km: runKm(d, g.id) } : null).filter(Boolean),
    rox_total: { temps: fmt(sum.rox.t), objectif: fmt(sum.rox.o) },
    ateliers: sum.stations.filter(x => x.t != null).map(x => ({ atelier: x.label, temps: fmt(x.t), objectif: fmt(x.o), ecart_s: Math.round(x.d), travail: slots.length > 1 ? { [who('A')]: fmt(x.work.A), [who('B')]: fmt(x.work.B) } : undefined, changements_s: x.trans != null ? Math.round(x.trans) : undefined, relais: x.rel.map((r, k) => ({ qui: who(r.w), duree: fmt(relDur(r)), objectif: relObj(d, plan, x.id, k, r) ? fmt(relObj(d, plan, x.id, k, r)) : undefined })) })),
    allure_moyenne: sum.pace ? fmt(sum.pace) + '/km' : null,
    frequence_cardiaque: Object.keys(hr).length ? hr : 'non fournie',
    constats_automatiques: insights(sum).map(t => t.text),
    insights: insights(sum),
  }
}
/** Coach local : aucun envoi de données, donc pas d'accord IA requis */
export const coachAllowed = p => COACH_MODE === 'local' || !!(p && p.consent_ai)
export async function askCoach(s, d, plan, who, me, opt = {}) {
  if (COACH_MODE === 'local') {   // gratuit : analyse rédigée par l'application elle-même
    let rows = []; try { rows = await api.hr.list(s.id) } catch {}
    const slots = hasB(s) ? ['A', 'B'] : ['A'], hrBy = {}
    let hrSteps = {}, profs = []
    try { profs = await api.profiles.many(slots.map(w => s.athletes[w]).filter(Boolean)) } catch {}
    slots.forEach(w => { const r = rows.find(x => x.user_id === s.athletes[w]); if (!r) return
      if (isCustom(s)) { if (s.athletes[w] === me.id) hrSteps = hrBySteps(s, r) }
      else hrBy[w] = hrBySegment(s, r, profs.find(p => p.id === s.athletes[w]) || null) })
    const content = localCoach(s, plan, who, { hrBy, hrSteps, ...opt })
    return api.coach.save({ session_id: s.id, scope: opt.scope || 'session', station: opt.station || null, content, model: 'coach intégré' })
  }
  const summaryJson = await coachPayload(s, d, plan, who, me)
  return api.coach.ask({ session_id: s.id, summary: summaryJson, ...opt })
}
function md(text) {
  // Mise en forme minimale : **gras**, titres, puces
  return text.split('\n').map((l, i) => {
    const h = l.match(/^#+\s*(.*)/), b = l.match(/^\s*[-*•]\s+(.*)/)
    const inline = str => str.split(/(\*\*[^*]+\*\*)/).map((p, k) => p.startsWith('**') ? <b key={k}>{p.slice(2, -2)}</b> : p)
    if (h) return <div key={i} style={{ fontWeight: 650, marginTop: 10 }}>{inline(h[1])}</div>
    if (b) return <div key={i} style={{ paddingLeft: 14, textIndent: -10 }}>• {inline(b[1])}</div>
    return <div key={i}>{inline(l) || ' '}</div>
  })
}
function Coach({ s, d, plan, who }) {
  const { profile } = useApp(), toast = useToast()
  const list = useLoad(() => api.coach.list(s.id), [s.id])
  const [busy, setBusy] = useState(false)
  async function ask() {
    setBusy(true)
    try { await askCoach(s, d, plan, who, profile); list.reload() } catch (e) { toast(e.message); logError('coach: ' + e.message) } finally { setBusy(false) }
  }
  async function copyForClaude() {
    const data = await coachPayload(s, d, plan, who, profile); delete data.insights
    const text = `Tu es mon coach Hyrox. Analyse cette séance et donne-moi : en bref, ce qui a marché, 3 points à travailler (chiffrés), la prochaine séance conseillée${s.athletes.B ? ' et la répartition des relais' : ''}.\n\n` + JSON.stringify(data, null, 1)
    try { await navigator.clipboard.writeText(text); toast('Copié : collez-le dans l’app Claude') } catch { toast('Copie impossible') }
  }
  return <>
    {COACH_MODE === 'local' && <p className="note" style={{ marginTop: 0 }}>Coach intégré (gratuit) : l’analyse est rédigée par l’application, sans service payant ni envoi de données. Pour un avis plus fin, « Copier pour Claude » prépare la séance à coller dans votre app Claude.</p>}
    {!coachAllowed(profile) ? <div className="glass card"><h3>Coach IA désactivé</h3><p className="muted small">Activez « Coach IA » dans Moi › Réglages pour recevoir l’analyse de Claude à la fin de chaque séance.</p><a className="btn small" href="#/moi/reglages">Réglages</a></div>
      : <button className="btn block" onClick={ask} disabled={busy || (!isCustom(s) && !d.cp.some(v => v != null))}><Icon name="spark" size={18} />{busy ? 'Analyse en cours…' : list.data && list.data.length ? 'Relancer l’analyse' : 'Analyser la séance'}</button>}
    <DeepRequest s={s} d={d} plan={plan} who={who} hasFirst={!!(list.data && list.data.some(c => !c.request_id))} onDone={list.reload} />
    <button className="btn glass block small" style={{ marginTop: 8 }} onClick={copyForClaude}><Icon name="copy" size={16} />Copier pour Claude</button>
    <p className="foot">L’analyse se lance automatiquement à la fin de la séance. Relancez-la après l’import du cardio pour en tenir compte.</p>
    {(list.data || []).map(c => <div className="glass card" key={c.id} style={{ marginTop: 12 }}>
      <div className="row-gap small muted" style={{ marginBottom: 6 }}><Icon name="spark" size={16} />{c.request_id ? <span className="badge accent">2e temps · analyse approfondie</span> : <span className="badge">1re analyse · {c.model || 'coach'}</span>}{c.scope === 'station' ? 'Atelier ' + c.station : 'Séance'} · {new Date(c.created_at).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}</div>
      <div className="coach">{md(c.content)}</div>
    </div>)}
    {list.data && !list.data.length && <div className="glass card" style={{ marginTop: 12 }}><Empty icon="spark">Pas encore de conseils pour cette séance.</Empty></div>}
  </>
}

/** Modifier le nom, la date et le type d'une séance déjà faite */
function InfoSheet({ s, onClose }) {
  const { reload } = useApp(), toast = useToast()
  const [f, setF] = useState({ name: s.name, date: s.session_date, kind: s.kind })
  async function save() {
    if (!f.name.trim()) return toast('Donnez un nom à la séance')
    try { await api.sessions.save({ id: s.id, name: f.name.trim(), session_date: f.date, kind: f.kind }); await reload(['sessions']); toast('Séance modifiée'); onClose(true) } catch (e) { toast(e.message) }
  }
  return <Sheet title="Modifier la séance" onClose={() => onClose(false)} footer={<button className="btn block" onClick={save}>Enregistrer</button>}>
    <List>
      <Field label="Nom"><input value={f.name} onChange={e => setF({ ...f, name: e.target.value })} /></Field>
      <Field label="Date"><input type="date" value={f.date} onChange={e => setF({ ...f, date: e.target.value })} /></Field>
      {!isCustom(s) && <Field label="Type"><select value={f.kind} onChange={e => setF({ ...f, kind: e.target.value })}>{Object.entries(KIND).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></Field>}
    </List>
    <p className="foot">Les temps, objectifs et valeurs réalisées se corrigent dans l’onglet « {isCustom(s) ? 'Réalisé' : 'Temps'} » de la séance.</p>
  </Sheet>
}
