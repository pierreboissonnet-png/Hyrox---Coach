// Bilan de niveau : ce que l'on sait déjà de soi (temps de course, ateliers, force) pour un plan juste dès le départ.
import React, { useMemo, useState } from 'react'
import { useApp } from '../App.jsx'
import { api } from '../lib/api.js'
import { Page, Sec, List, Field, Seg, Icon, Chips, Switch, useToast, useLoad, parseNum, TIME, maskT } from '../ui.jsx'
import { STATIONS, SEGS, normPlan, fmt, parseT, todayISO, frDate } from '../lib/hyrox.js'
import { athleteStats } from '../lib/analyze.js'
import { customInsights } from '../lib/load.js'
import { gapsOf, withLevel, withSelf, SELF_STATES, URGENCY, WEIGHTED, STD_LOADS } from '../lib/gaps.js'
import { plansOf, mainRace } from './common.js'
import { addDays } from '../lib/plan.js'
import { datesOf, soloSeries, duoSeries, realResults, expectedCurve, firstOf, isoOfNum } from '../lib/trend.js'
import { slotsOf } from './Teams.jsx'
import { TrendCard } from './Trend.jsx'
import { COLORS } from '../charts.jsx'

const EXP = [['debut', 'Débutant'], ['inter', 'Intermédiaire'], ['confirme', 'Confirmé']]
const RM = [['squat', 'Squat'], ['deadlift', 'Soulevé de terre'], ['bench', 'Développé couché']]
const tIn = (v, set) => <input {...TIME} defaultValue={v ? fmt(v) : ''} onBlur={e => { const n = parseT(e.target.value); set(n == null || Number.isNaN(n) ? null : n) }} />

export function LevelPage() {
  const { profile, sessions, teams } = useApp(), toast = useToast()
  const j = useLoad(() => api.journal.list('level'), [])
  const cur = (j.data || [])[0]
  if (j.loading) return <Page back="#/moi" title="Mon niveau"><p className="muted">Chargement…</p></Page>
  return <LevelForm key={cur ? cur.id : 'new'} cur={cur} onSaved={() => j.reload()} profile={profile} sessions={sessions} teams={teams} toast={toast} />
}

function LevelForm({ cur, onSaved, profile, sessions, teams, toast }) {
  const d0 = (cur && cur.data) || {}
  const [f, setF] = useState({ share: !!d0.share, exp: d0.exp || 'inter', hours: d0.hours ?? '', run: { ...(d0.run || {}) }, st: { ...(d0.st || {}) }, rm: JSON.parse(JSON.stringify(d0.rm || {})), pdc: { ...(d0.pdc || {}) }, hyrox: { ...(d0.hyrox || {}) }, self: JSON.parse(JSON.stringify(d0.self || {})) })
  const [nums, setNums] = useState(!!(d0.run || d0.st || d0.rm) && !d0.self)
  const [busy, setBusy] = useState(false)
  const F = profile.sex === 'F'
  const sub = (k, key, v) => setF(x => ({ ...x, [k]: { ...x[k], [key]: v } }))
  const preview = useMemo(() => {
    const ins = customInsights(sessions, profile.id), W = withLevel(athleteStats(profile.id, sessions, plansOf(teams)), ins.e1rm, { data: f })
    const G = withSelf(gapsOf(W.stats, { profile, e1rm: W.e1rm, weakSt: ins.weakSt }), f.self); return G.filter(g => g.kind !== 'test').slice(0, 4)
  }, [f, sessions])
  async function save(over) {
    setBusy(true)
    try {
      const data = { ...f, ...(over && !over.nativeEvent && !over.target ? over : {}), hours: parseNum(f.hours), updated: todayISO() }
      if (cur) await api.journal.update(cur.id, { day: todayISO(), data }); else await api.journal.add({ kind: 'level', day: todayISO(), data })
      // Copie partagée avec le duo (sur accord) : mise à jour à chaque enregistrement, retirée si on ne partage plus
      let shareErr = ''
      try { if (data.share) await api.levels.share(profile.id, data); else await api.levels.unshare(profile.id) } catch (e) { shareErr = e.message }
      toast(shareErr && data.share ? 'Bilan enregistré, mais partage indisponible (script « partage-niveau.sql » à exécuter dans Supabase)' : over && 'share' in over ? (data.share ? 'Niveau partagé avec votre duo' : 'Niveau de nouveau privé') : 'Bilan enregistré'); onSaved()
    } catch (e) { toast('Enregistrement impossible : ' + e.message) } finally { setBusy(false) }
  }
  return <Page back="#/moi" title="Mon niveau" subtitle={cur ? 'Bilan du ' + frDate(cur.day) + '. Mettez-le à jour quand vous progressez.' : 'Renseignez ce que vous savez déjà. Tout est facultatif : chaque temps connu affine le plan.'}>
    <LevelTrend level={cur} />
    <div className="note small" style={{ marginTop: 0 }}>Le plan s’appuie d’abord sur vos séances enregistrées ; ce bilan comble ce qu’elles ne disent pas encore. Pas de temps connu ? Faites la séance <a className="link" href="#/seance/specifique?tpl=test-niveau">« Test de niveau »</a> : ses résultats sont pris en compte automatiquement.</div>
    <Sec title="Mon ressenti" foot="Le plus important : ce que vous ressentez sur chaque partie. Le plan et le coach s’en servent pour cibler le travail (technique, charge, vitesse), même sans aucun chiffre.">
      <List>
        <SelfRow id="run" label="Course" kind="run" v={f.self.run} set={v => sub('self', 'run', v)} />
        {STATIONS.map(x => <SelfRow key={x.id} id={x.id} label={x.label} kind="station" v={f.self[x.id]} set={v => sub('self', x.id, v)} sex={profile.sex} />)}
        <SelfRow id="force" label="Force générale" kind="force" v={f.self.force} set={v => sub('self', 'force', v)} />
      </List>
    </Sec>
    <button className="btn glass block" style={{ margin: '4px 0 8px' }} onClick={() => setNums(n => !n)}>{nums ? 'Masquer les chiffres' : 'Ajouter des chiffres (facultatif)'}</button>
    {nums && <>
    <Sec title="Expérience">
      <Seg value={f.exp} onChange={v => setF({ ...f, exp: v })} options={EXP} />
      <List><Field label="Heures d’entraînement" sub="Par semaine, en moyenne sur les derniers mois"><span className="row-gap" style={{ gap: 6, flexWrap: 'nowrap' }}><input inputMode="decimal" style={{ width: 56 }} value={f.hours} onChange={e => setF({ ...f, hours: e.target.value })} placeholder="5" aria-label="Heures par semaine" /><span className="small muted">h / sem.</span></span></Field>
        <Field label="Meilleur temps Hyrox" sub="Si vous en avez déjà fait un"><input {...TIME} placeholder="h:mm:ss" defaultValue={f.hyrox.best ? fmt(f.hyrox.best) : ''} onBlur={e => { const n = parseT(e.target.value); sub('hyrox', 'best', n == null || Number.isNaN(n) ? null : n) }} /></Field>
        {f.hyrox.best && <Field label="Format de ce Hyrox"><select value={f.hyrox.format || 'solo'} onChange={e => sub('hyrox', 'format', e.target.value)}><option value="solo">Solo</option><option value="duo">Duo</option><option value="relay">Relais à 4</option></select></Field>}</List>
    </Sec>
    <Sec title="Course" foot="Votre meilleur temps récent (record des 6 derniers mois), sur du plat. Pas un temps moyen.">
      <List><Field label="1 km" sub="Meilleur temps récent">{tIn(f.run.k1, v => sub('run', 'k1', v))}</Field>
        <Field label="5 km" sub="Meilleur temps récent">{tIn(f.run.k5, v => sub('run', 'k5', v))}</Field></List>
    </Sec>
    <Sec title="Ateliers Hyrox" foot={`Temps pour l’atelier complet, seul(e), au poids de votre catégorie (Open ${F ? 'femme' : 'homme'}). Laissez vide si vous ne savez pas.`}>
      <List>{STATIONS.map(x => <Field key={x.id} label={x.label} sub={x.sub}>{tIn(f.st[x.id], v => sub('st', x.id, v))}</Field>)}</List>
    </Sec>
    <Sec title="Force" foot="Une charge que vous savez soulever, et pour combien de répétitions : le maximum (1RM) est estimé.">
      <List>{RM.map(([k, l]) => <div className="row" key={k}><span className="label"><span className="t">{l}</span>{f.rm[k] && f.rm[k].load ? <span className="s">1RM estimé ≈ {Math.round(f.rm[k].load * (1 + Math.min(+f.rm[k].reps || 1, 12) / 30))} kg</span> : null}</span>
        <input style={{ width: 64 }} inputMode="decimal" placeholder="kg" aria-label={l + ' : charge'} defaultValue={(f.rm[k] || {}).load || ''} onBlur={e => sub('rm', k, { ...(f.rm[k] || {}), load: parseNum(e.target.value) })} />
        <span className="small muted">×</span>
        <input style={{ width: 48 }} inputMode="numeric" placeholder="reps" aria-label={l + ' : répétitions'} defaultValue={(f.rm[k] || {}).reps || ''} onBlur={e => sub('rm', k, { ...(f.rm[k] || {}), reps: parseNum(e.target.value) })} /></div>)}
        <Field label="Tractions" sub="Maximum d’affilée"><input inputMode="numeric" style={{ width: 64 }} defaultValue={f.pdc.pullup ?? ''} onBlur={e => sub('pdc', 'pullup', parseNum(e.target.value))} /></Field>
        <Field label="Pompes" sub="Maximum d’affilée"><input inputMode="numeric" style={{ width: 64 }} defaultValue={f.pdc.pushup ?? ''} onBlur={e => sub('pdc', 'pushup', parseNum(e.target.value))} /></Field>
        <Field label="Wall balls" sub="Maximum d’affilée, poids de votre catégorie"><input inputMode="numeric" style={{ width: 64 }} defaultValue={f.pdc.wb ?? ''} onBlur={e => sub('pdc', 'wb', parseNum(e.target.value))} /></Field>
      </List>
    </Sec>
    </>}
    <Sec title="Partage avec mon duo" foot="Votre coéquipier voit alors votre courbe, votre ressenti et vos objectifs (charges, allure) sur la page du duo, pour viser ensemble les bons ateliers. Vos données de santé (sommeil, poids, cycle…) ne sont jamais partagées. Désactivable à tout moment.">
      <List><div className="row"><span className="label"><span className="t">Partager avec mon duo</span><span className="s">{f.share ? 'Partagé : visible par vos coéquipiers actuels' : 'Privé : visible par vous seul(e)'}</span></span>
        <Switch checked={f.share} label="Partager mon niveau avec mon duo" onChange={v => { setF(x => ({ ...x, share: v })); save({ share: v }) }} /></div></List>
    </Sec>
    <h2 className="sec">Ce que le plan en retient</h2>
    <div className="glass card">{preview.length ? preview.map((g, i) => <div className="tip" key={g.id}><span className={'dot ' + (i === 0 ? 'bad' : 'warn')} /><span className="small"><b>{g.label}</b> : {g.why}.</span></div>) : <div className="small muted">Pas de lacune nette avec ces informations : le plan alternera les ateliers.</div>}</div>
    <button className="btn block" style={{ marginTop: 14 }} disabled={busy} onClick={() => save()}>{busy ? 'Enregistrement…' : cur ? 'Mettre à jour mon bilan' : 'Enregistrer mon bilan'}</button>
    {cur && <a className="btn glass block" style={{ marginTop: 8 }} href="#/moi/programme"><Icon name="cal" size={16} />Voir le programme</a>}
    <p className="foot">Après un bilan, ouvrez le Programme : si vos lacunes ont changé, un lien propose de mettre le plan à jour.</p>
  </Page>
}

/** Une ligne d'auto-évaluation : état, urgence, charges ou allure actuelles et visées */
function SelfRow({ id, label, kind, v = {}, set, sex }) {
  const [open, setOpen] = useState(!!v.state)
  const states = kind === 'station' ? SELF_STATES.station.filter(([k]) => WEIGHTED.includes(id) ? k !== 'vitesse' : k !== 'charge') : SELF_STATES[kind]
  const cur = (states.find(x => x[0] === v.state) || [])[1]
  const std = STD_LOADS[id], F = sex === 'F'
  const fill = k => set({ ...v, target: std[k] })
  const paceIn = (val, key, ph) => <input inputMode="numeric" placeholder={ph} style={{ width: 64 }} defaultValue={val ? Math.floor(val / 60) + ':' + String(Math.round(val % 60)).padStart(2, '0') : ''}
    onInput={e => { e.target.value = maskT(e.target.value) }} onBlur={e => { const p = e.target.value.split(':'); const n = p.length === 2 ? +p[0] * 60 + +p[1] : null; set({ ...v, [key]: n && isFinite(n) ? n : null }) }} aria-label={label + ' ' + key} />
  return <div className="row stack">
    <button className="row-gap" onClick={() => setOpen(o => !o)} style={{ background: 'none', border: 0, padding: 0, color: 'inherit', font: 'inherit', textAlign: 'left', width: '100%' }}>
      <b style={{ flex: 1 }}>{label}</b><span className={'small ' + (v.state && v.state !== 'maitrise' ? '' : 'muted')}>{cur || 'à évaluer'}{v.state && v.state !== 'inconnu' && v.urgency ? ' · ' + ['', 'urgence faible', 'urgence moyenne', 'urgence haute'][v.urgency] : ''}</span>
      <Icon name="chev" size={14} style={{ transform: open ? 'rotate(90deg)' : 'none', opacity: .5 }} /></button>
    {open && <>
      <Chips value={v.state} onChange={st => set({ ...v, state: st, urgency: v.urgency || (st === 'maitrise' ? 1 : 2) })} label={label} options={states} />
      {v.state && v.state !== 'inconnu' && <div className="row-gap small" style={{ gap: 6 }}><span className="muted">Urgence</span><Chips value={v.urgency || 2} onChange={u => set({ ...v, urgency: u })} label="Urgence" options={URGENCY} /></div>}
      {kind === 'station' && WEIGHTED.includes(id) && v.state && v.state !== 'inconnu' && <div className="small" style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
        <span className="muted">Charge {id === 'farm' ? 'par main' : ''} actuelle</span><input inputMode="decimal" style={{ width: 56 }} defaultValue={v.cur ?? ''} onBlur={e => set({ ...v, cur: parseNum(e.target.value) })} aria-label={label + ' charge actuelle'} />
        <span className="muted">visée</span><input key={v.target} inputMode="decimal" style={{ width: 56 }} defaultValue={v.target ?? ''} onBlur={e => set({ ...v, target: parseNum(e.target.value) })} aria-label={label + ' charge visée'} /><span className="muted">kg</span>
        <span className="tiny muted" style={{ width: '100%' }}>Remplir avec : <button className="link" style={lk} onClick={() => fill(F ? 'F' : 'M')}>{F ? 'femme' : 'homme'} Open ({std[F ? 'F' : 'M']} kg)</button> · <button className="link" style={lk} onClick={() => fill(F ? 'M' : 'F')}>{F ? 'homme' : 'femme'} Open ({std[F ? 'M' : 'F']} kg)</button> · <button className="link" style={lk} onClick={() => fill(F ? 'PF' : 'PM')}>Pro ({std[F ? 'PF' : 'PM']} kg)</button> — à vérifier selon le règlement de votre course</span>
      </div>}
      {kind === 'run' && v.state && <div className="small" style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}><span className="muted">Allure actuelle</span>{paceIn(v.cur, 'cur', '5:30')}<span className="muted">visée</span>{paceIn(v.target, 'target', '5:00')}<span className="muted">/km (facultatif)</span></div>}
    </>}
  </div>
}
const lk = { background: 'none', border: 0, padding: 0, color: 'var(--accent)', font: 'inherit', textDecoration: 'underline' }

/** Courbe de progression individuelle : temps solo estimé vs trajectoire attendue jusqu'à l'objectif principal */
export function LevelTrend({ level }) {
  const { profile, sessions, teams, races } = useApp()
  const planJ = useLoad(() => api.journal.list('plan'), [])
  const main0 = mainRace(races), team0 = main0 && main0.format === 'duo' && main0.team_id ? teams.find(t => t.id === main0.team_id) : null
  const other0 = team0 ? [slotsOf(team0).A, slotsOf(team0).B].find(u => u && u !== profile.id) : null
  const sh = useLoad(() => other0 ? api.levels.shared([other0]) : [], [other0])
  const T = useMemo(() => {
    if (planJ.loading || sh.loading) return null
    const plans = plansOf(teams), today = todayISO(), main = mainRace(races), plan = (planJ.data || [])[0]
    const mine = sessions.filter(s => s.athletes && Object.values(s.athletes).includes(profile.id)).map(s => s.session_date).filter(d => d <= today).sort()
    let from = (plan && plan.data && plan.data.created) || mine[0] || addDays(today, -28)
    if (from > addDays(today, -7)) from = addDays(today, -7)
    if (from < addDays(today, -180)) from = addDays(today, -180)
    const dates = datesOf([profile.id], sessions, from, today)
    const pts = soloSeries(profile.id, sessions, plans, level, dates)
    const real = realResults(sessions, plans, s => !s.team_id && s.athletes && s.athletes.A === profile.id)
    const E0 = firstOf(pts)
    let goal = null, why = ''
    const team = main && main.format === 'duo' && main.team_id ? teams.find(t => t.id === main.team_id) : null
    const planTot = team ? SEGS.reduce((x, g) => x + (normPlan(team.plan).obj[g.id] || 0), 0) : 0
    const target = main ? (main.goal_seconds && planTot ? Math.min(main.goal_seconds, planTot) : (main.goal_seconds || planTot || null)) : null   // le plus ambitieux
    if (target && E0) {
      if (team) {   // en duo : même progression relative que celle demandée au duo
        const sl = slotsOf(team), other = sl.A === profile.id ? sl.B : sl.A
        const op = (team.members.find(m => m.user_id === other) || {}).profile || null, ol = (sh.data || []).find(x => x.user_id === other) || null
        const start = duoSeries(profile.id, other, sessions, plans, level, team.plan, [isoOfNum(E0[0])], profile, op, ol)[0][1]
        if (start) { goal = Math.round(E0[1] * Math.min(1, target / start)); why = `En duo, votre objectif individuel suit la progression demandée au duo (${fmt(start)} → ${fmt(target)}).` }
      } else goal = target
    }
    return { pts, real, goal, raceIso: main ? main.race_date : null, expected: goal ? expectedCurve(isoOfNum(E0[0]), E0[1], main.race_date, goal) : [], why, main }
  }, [planJ.loading, sh.loading, sessions, teams, races, level])
  if (!T) return null
  if (!firstOf(T.pts)) return <div className="glass card small"><b>Ma courbe de progression</b><div className="muted">Elle apparaît dès que l’app connaît votre allure de course et au moins 3 ateliers (séances enregistrées ou temps du bilan ci-dessous).</div></div>
  return <TrendCard title="Ma courbe de progression" raceIso={T.raceIso} goal={T.goal} expected={T.expected}
    lines={[{ label: 'Mon temps solo estimé', color: COLORS.A, pts: T.pts, dots: true }, ...(T.real.length ? [{ label: 'Hyrox réalisés', color: COLORS.C, pts: T.real, dots: true, width: 0.01 }] : [])]}
    foot={(T.why ? T.why + ' ' : '') + (T.main ? (T.goal ? '' : 'Ajoutez un objectif de temps à « ' + T.main.name + ' » (onglet Courses) pour voir la trajectoire attendue.') : 'Programmez un Hyrox (onglet Courses) pour voir la trajectoire jusqu’au jour J.')} />
}
