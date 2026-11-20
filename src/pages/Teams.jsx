import React, { useMemo, useState } from 'react'
import { useApp } from '../App.jsx'
import { api } from '../lib/api.js'
import { Page, Sec, List, Row, Field, Seg, Sheet, Empty, Icon, Stat, useToast, useLoad, TIME } from '../ui.jsx'
import { LineChart, DeltaBars, COLORS } from '../charts.jsx'
import { STATIONS, SEGS, STATION, normPlan, planRelays, fmt, fd, parseT, frDate, fmtU, tone } from '../lib/hyrox.js'
import { summary, athleteStats, isComplete, cyclePerformance } from '../lib/analyze.js'
import { normData } from '../lib/session.js'
import { predictDuo, estimatePartner, planFromPrediction } from '../lib/predict.js'
import { plansOf, partnerOf, RACE_TYPE, upcoming } from './common.js'
import { gapsOf, withSelf, SELF_STATES } from '../lib/gaps.js'
import { datesOf, soloSeries, duoSeries, realResults, expectedCurve, firstOf, lastOf, valueAt, isoOfNum, dayNum, statsAt, fillStats } from '../lib/trend.js'
import { addDays } from '../lib/plan.js'
import { TrendCard } from './Trend.jsx'
import { todayISO } from '../lib/hyrox.js'

export const slotsOf = t => {
  const p = (t.plan && t.plan.slots) || {}
  const ms = [...t.members].sort((a, b) => (a.joined_at || '').localeCompare(b.joined_at || ''))
  return { A: p.A || (ms[0] && ms[0].user_id), B: p.B || (ms[1] && ms[1].user_id) }
}
export const slotName = (t, w) => { const id = slotsOf(t)[w]; const m = t.members.find(x => x.user_id === id); return m ? m.profile.display_name : w === 'A' ? 'Athlète A' : 'Athlète B' }

export function Teams() {
  const { teams, profile } = useApp()
  const [sheet, setSheet] = useState(null)
  const act = teams.filter(t => t.members.some(m => m.user_id === profile.id && !m.left_at))
  const old = teams.filter(t => !act.includes(t))
  return <Page title="Équipe" subtitle="Un duo = deux partenaires, avec son plan, ses objectifs et ses séances.">
    <div className="row-gap" style={{ marginBottom: 8 }}>
      <button className="btn" style={{ flex: 1 }} onClick={() => setSheet('create')}><Icon name="plus" size={18} />Créer un duo</button>
      <button className="btn glass" style={{ flex: 1 }} onClick={() => setSheet('join')}>Rejoindre</button>
    </div>
    <Sec title="Mes duos">
      {act.length ? <List>{act.map(t => { const p = partnerOf(t, profile.id); return <Row key={t.id} icon="team" color="#30d158" title={t.name} sub={(p ? 'Avec ' + p.profile.display_name : 'Code d’invitation : ' + t.invite_code) + ' · ' + (t.division === 'pro' ? 'Pro' : 'Open') + ' ' + t.category} href={'#/equipe/' + t.id} /> })}</List>
        : <div className="glass card"><Empty icon="team">Pas encore de duo. Créez-en un et partagez le code à votre partenaire.</Empty></div>}
    </Sec>
    {old.length > 0 && <Sec title="Anciens duos" foot="Vos séances passées restent dans vos statistiques personnelles et servent à estimer vos temps avec un nouveau partenaire.">
      <List>{old.map(t => <Row key={t.id} icon="team" color="#8e8e93" title={t.name} sub={'Avec ' + ((partnerOf(t, profile.id) || {}).profile || {}).display_name} href={'#/equipe/' + t.id} />)}</List>
    </Sec>}
    {sheet && <TeamSheet mode={sheet} onClose={() => setSheet(null)} />}
  </Page>
}

function TeamSheet({ mode, onClose }) {
  const { reload, profile } = useApp(), toast = useToast()
  const [f, setF] = useState({ name: '', division: 'open', category: 'mixte', code: '' })
  const [err, setErr] = useState('')
  async function go() {
    setErr('')
    try {
      const id = mode === 'create' ? await api.teams.create(f.name.trim() || 'Duo de ' + profile.display_name, f.division, f.category) : await api.teams.join(f.code)
      await reload(); toast(mode === 'create' ? 'Duo créé : partagez le code' : 'Bienvenue dans le duo'); onClose(); location.hash = '#/equipe/' + id
    } catch (e) { setErr(e.message) }
  }
  return <Sheet title={mode === 'create' ? 'Nouveau duo' : 'Rejoindre un duo'} onClose={onClose}>
    {mode === 'create' ? <>
      <List><Field label="Nom du duo"><input value={f.name} onChange={e => setF({ ...f, name: e.target.value })} placeholder="Les Rox" /></Field></List>
      <h2 className="sec">Division</h2><Seg value={f.division} onChange={v => setF({ ...f, division: v })} options={[['open', 'Open'], ['pro', 'Pro']]} />
      <h2 className="sec">Catégorie</h2><Seg value={f.category} onChange={v => setF({ ...f, category: v })} options={[['homme', 'Hommes'], ['femme', 'Femmes'], ['mixte', 'Mixte']]} />
      <p className="note">Changement de partenaire ? Créez un nouveau duo : l’ancien partenaire ne verra pas vos nouvelles séances, et vos temps passés serviront à proposer des objectifs.</p>
    </> : <List><Field label="Code reçu"><input value={f.code} onChange={e => setF({ ...f, code: e.target.value.toUpperCase() })} placeholder="AB12CD" autoCapitalize="characters" /></Field></List>}
    {err && <p className="err">{err}</p>}
    <button className="btn block" style={{ marginTop: 14 }} onClick={go} disabled={mode === 'join' && f.code.length < 4}>{mode === 'create' ? 'Créer' : 'Rejoindre'}</button>
  </Sheet>
}

export function TeamDetail({ id }) {
  const { teams, sessions, races, profile, reload } = useApp(), toast = useToast()
  const t = teams.find(x => x.id === id)
  const plans = plansOf(teams)
  const ts = useMemo(() => t ? sessions.filter(s => s.team_id === t.id) : [], [sessions, t])
  const sums = useMemo(() => t ? ts.map(s => ({ s, sum: summary(s, t.plan) })) : [], [ts, t])
  if (!t) return <Page back="#/equipe" title="Équipe"><Empty>Équipe introuvable.</Empty></Page>
  const me = t.members.find(m => m.user_id === profile.id), active = me && !me.left_at
  const partner = partnerOf(t, profile.id)
  const complete = sums.filter(x => x.sum.complete).sort((a, b) => a.s.session_date.localeCompare(b.s.session_date))
  const best = complete.length ? complete.reduce((a, b) => a.sum.all.t < b.sum.all.t ? a : b) : null
  const lastSum = sums.find(x => x.sum.st.n)
  const plan = normPlan(t.plan)
  const objTotal = SEGS.reduce((a, g) => a + (plan.obj[g.id] || 0), 0)
  const teamRaces = races.filter(r => r.team_id === t.id)
  async function leave() { if (!confirm('Quitter ce duo ? Vos séances restent dans vos statistiques.')) return; await api.teams.leave(t.id); await reload(); location.hash = '#/equipe' }
  async function share() {
    const text = `Rejoins mon duo « ${t.name} » sur Hyrox Coach avec le code ${t.invite_code} : ${location.origin}`
    try { if (navigator.share) await navigator.share({ text }); else { await navigator.clipboard.writeText(text); toast('Invitation copiée') } } catch {}
  }
  return <Page back="#/equipe" title={t.name} subtitle={`${t.division === 'pro' ? 'Pro' : 'Open'} · ${t.category}${active ? '' : ' · ancien duo'}`}>
    <List>
      {t.members.map(m => <Row key={m.user_id} icon="user" color={slotsOf(t).A === m.user_id ? COLORS.A : COLORS.B} title={m.profile.display_name + (m.user_id === profile.id ? ' (moi)' : '')} sub={[m.profile.sex === 'F' ? 'Femme' : m.profile.sex === 'M' ? 'Homme' : '', m.profile.weight_kg ? m.profile.weight_kg + ' kg' : '', m.left_at ? 'a quitté le duo' : ''].filter(Boolean).join(' · ')} />)}
      {t.members.length < 2 && <Row icon="plus" color="#8e8e93" title={'Code d’invitation : ' + t.invite_code} sub="À transmettre à votre partenaire" onClick={share} />}
    </List>

    <h2 className="sec">Statistiques du duo</h2>
    <div className="stats">
      <Stat k="Séances" v={ts.length} d={complete.length + ' complètes'} />
      <Stat k="Meilleur temps" v={best ? fmt(best.sum.all.t) : '—'} d={best ? frDate(best.s.session_date) : ''} />
      <Stat k="Objectif du plan" v={fmt(objTotal)} d={best ? fd(best.sum.all.t - objTotal) : ''} tone={best ? tone(best.sum.all.t - objTotal) : ''} />
    </div>
    <TeamTrend t={t} objTotal={objTotal} />
    {lastSum && <div className="glass card"><div className="small muted" style={{ marginBottom: 6 }}>Ateliers vs objectif · {lastSum.s.name}</div><DeltaBars rows={lastSum.sum.stations.map(x => ({ label: x.label, d: x.d }))} /></div>}

    <Predictions team={t} />

    <h2 className="sec">Plan et objectifs</h2>
    <List>
      <Row icon="chart" color="#5e5ce6" title="Objectifs et stratégie de relais" sub={`Total visé ${fmt(objTotal)} · course ${plan.runKm} km`} href={'#/equipe/' + t.id + '/plan'} />
      <Row icon="timer" color="#0a84ff" title="Séances du duo" value={ts.length} href={'#/seances?team=' + t.id} />
      {active && <Row icon="plus" color="#ff9f0a" title="Programmer un Hyrox avec ce duo" onClick={() => { try { localStorage.setItem('hx-race-prefill', JSON.stringify({ format: 'duo', team_id: t.id, division: t.division, category: t.category })) } catch {} location.hash = '#/courses' }} />}
      {teamRaces.map(r => <Row key={r.id} icon="flag" color="#ff9f0a" title={r.name} sub={frDate(r.race_date) + ' · ' + RACE_TYPE(r)} value={r.goal_seconds ? fmt(r.goal_seconds) : ''} href="#/courses" />)}
    </List>
    {active && <><div className="row-gap" style={{ marginTop: 16 }}>
      <button className="btn glass small" onClick={share}><Icon name="copy" size={16} />Inviter ({t.invite_code})</button>
      <span className="spacer" /><button className="btn plain small" style={{ color: 'var(--bad)' }} onClick={leave}>Quitter le duo</button></div></>}
  </Page>
}

function Predictions({ team }) {
  const { teams, sessions, profile, reload } = useApp(), toast = useToast()
  const [coef, setCoef] = useState(1)
  const plans = plansOf(teams)
  const partner = partnerOf(team, profile.id)
  // Pour une athlète qui déclare son cycle : les séances en phase défavorable comptent moins
  const female = profile.sex === 'F'
  const cyc = useLoad(() => female && profile.consent_health ? api.journal.list('cycle') : [], [female])
  const mine = useMemo(() => { const E = female ? cyc.data || [] : []; const w = E.length ? cyclePerformance(profile.id, sessions, plans, E).weight : null; return athleteStats(profile.id, sessions, plans, { weight: w }) }, [sessions, teams, cyc.data, female])
  const shared = partner ? sessions.filter(s => s.athletes && Object.values(s.athletes).includes(partner.user_id)) : []
  const pStats = useMemo(() => partner && shared.length ? athleteStats(partner.user_id, sessions, plans) : null, [sessions, partner])
  // Ancien partenaire avec le plus de séances communes : base de l'estimation
  const prev = useMemo(() => {
    let bestId = null, n = 0
    teams.filter(t => t.id !== team.id).forEach(t => t.members.forEach(m => {
      if (m.user_id === profile.id) return
      const k = sessions.filter(s => s.team_id === t.id && Object.values(s.athletes || {}).includes(m.user_id)).length
      if (k > n) { n = k; bestId = m }
    }))
    return bestId ? { member: bestId, stats: athleteStats(bestId.user_id, sessions, plans) } : null
  }, [sessions, teams])
  let other = pStats, note = ''
  if (!pStats && prev && partner) { other = estimatePartner(prev.stats, prev.member.profile, partner.profile, coef); note = `Estimation : temps de ${prev.member.profile.display_name} (ancien partenaire) pondérés par le profil de ${partner.profile.display_name} (sexe, âge, poids) × ${coef.toFixed(2).replace('.', ',')}.` }
  else if (!pStats && prev && !partner) { other = estimatePartner(prev.stats, prev.member.profile, prev.member.profile, coef); note = `En attendant votre partenaire : base ${prev.member.profile.display_name} × ${coef.toFixed(2).replace('.', ',')}.` }
  if (!mine.sessions && !other) return <><h2 className="sec">Temps prédit</h2><div className="glass card"><p className="muted small" style={{ margin: 0 }}>Les prédictions apparaissent après une première séance pointée.</p></div></>
  const plan = normPlan(team.plan)
  const pred = predictDuo(mine.sessions ? mine : null, other, team.plan, { runKm: 1 })
  const slots = slotsOf(team), meIsA = slots.A === profile.id
  async function apply() {
    const p = planFromPrediction(team.plan, pred)
    // Répartition suggérée : on recale les tranches de chaque atelier selon la part calculée
    await api.teams.update(team.id, { plan: { ...team.plan, obj: p.obj } }); await reload(['teams']); toast('Objectifs du plan mis à jour')
  }
  return <>
    <h2 className="sec">Temps prédit {pred.estimated && <span className="badge warn">estimation</span>}</h2>
    <div className="glass card">
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}><span style={{ fontSize: 34, fontWeight: 800, letterSpacing: '-.03em' }} className="num">{fmt(pred.total)}</span><span className="muted small">course officielle (8 × 1 km)</span></div>
      {note && <p className="small muted">{note}</p>}
      {pred.estimated && <><div className="small" style={{ marginTop: 6 }}>Réglage manuel du nouveau partenaire : {coef < 1 ? 'plus rapide' : coef > 1 ? 'plus lent' : 'identique'} ({Math.round((coef - 1) * 100)} %)</div>
        <input type="range" min="0.8" max="1.25" step="0.01" value={coef} onChange={e => setCoef(+e.target.value)} aria-label="Coefficient" /></>}
      <table className="tbl" style={{ marginTop: 8 }}><thead><tr><th>Atelier</th><th className="r">Prédit</th><th className="r">Objectif</th><th className="r">Part {profile.display_name}</th></tr></thead>
        <tbody>{STATIONS.map(x => <tr key={x.id}><td>{x.label}</td><td className="r num">{fmt(pred.seg[x.id])}</td><td className="r num faint">{fmt(plan.obj[x.id])}</td>
          <td className="r num">{pred.share[x.id] != null ? Math.round((meIsA || !partner ? pred.share[x.id] : 1 - pred.share[x.id]) * 100) + ' %' : '—'}</td></tr>)}
          <tr><td>Courses</td><td className="r num">{pred.pace ? fmt(pred.pace) + '/km' : '—'}</td><td className="r num faint">{fmt(plan.obj.r1)}</td><td /></tr></tbody></table>
      <p className="small muted">Chaque atelier est partagé pour que chacun travaille le même temps ; en course, le duo va à l’allure du plus lent.{pred.missing.length ? ' Sans données : ' + pred.missing.join(', ') + ' (objectif du plan).' : ''}</p>
      <button className="btn tinted small" onClick={apply}>Appliquer aux objectifs du plan</button>
    </div>
  </>
}

/**
 * Tendances du duo : trajectoire visée, temps du duo estimé, temps solo de chacun ;
 * puis objectifs de chaque coéquipier et prochain palier à atteindre.
 */
function TeamTrend({ t, objTotal }) {
  const { sessions, teams, races, profile, reload } = useApp(), toast = useToast()
  const sl0 = slotsOf(t), others = [sl0.A, sl0.B].filter(u => u && u !== profile.id)
  const lv = useLoad(() => api.journal.list('level'), [])
  const sh = useLoad(() => api.levels.shared(others), [others.join()])
  const T = useMemo(() => {
    if (lv.loading || sh.loading) return null
    const plans = plansOf(teams), today = todayISO(), sl = slotsOf(t), level = (lv.data || [])[0] || null
    // Mon bilan (privé) pour moi ; celui du coéquipier seulement s'il l'a partagé
    const lvOf = uid => uid === profile.id ? level : ((sh.data || []).find(x => x.user_id === uid) || null)
    const race = upcoming(races).filter(r => r.team_id === t.id).sort((a, b) => (a.priority === 'A' ? 0 : 1) - (b.priority === 'A' ? 0 : 1))[0] || null
    // Un seul objectif : le plus ambitieux entre la course et le plan
    const raceGoal = race && race.goal_seconds, goal = raceGoal && objTotal ? Math.min(raceGoal, objTotal) : (raceGoal || objTotal)
    const conflict = raceGoal && objTotal && Math.abs(raceGoal - objTotal) > 30 ? { raceGoal, objTotal } : null
    const ts = sessions.filter(s => s.team_id === t.id).map(s => s.session_date).filter(d => d <= today).sort()
    let from = ts[0] && ts[0] < addDays(today, -56) ? ts[0] : addDays(today, -56)
    if (from < addDays(today, -180)) from = addDays(today, -180)
    const ids = [sl.A, sl.B].filter(Boolean), dates = datesOf(ids, sessions, from, today)
    const prof = u => (t.members.find(x => x.user_id === u) || {}).profile || null
    const duo = duoSeries(sl.A, sl.B, sessions, plans, lvOf(sl.A), t.plan, dates, prof(sl.A), prof(sl.B), lvOf(sl.B))
    const solo = Object.fromEntries(ids.map(u => [u, soloSeries(u, sessions, plans, lvOf(u), dates)]))
    const real = realResults(sessions, plans, s => s.team_id === t.id)
    const E0 = firstOf(duo), raceIso = race ? race.race_date : null
    const expected = E0 && raceIso ? expectedCurve(isoOfNum(E0[0]), E0[1], raceIso, goal) : []
    // Objectifs individuels : même progression relative que le duo + objectifs déclarés dans « Mon niveau »
    const r = E0 ? Math.min(1, goal / E0[1]) : null
    const who = ids.map(u => {
      const m = t.members.find(x => x.user_id === u), pts = solo[u], s0 = firstOf(pts), now = lastOf(pts), L = lvOf(u)
      const G = withSelf(gapsOf(statsAt(u, sessions, plans, L, today), { profile: m ? m.profile : {} }), L && L.data && L.data.self).filter(g => g.kind !== 'test').slice(0, 3)
      return { u, me: u === profile.id, name: m ? m.profile.display_name : '?', color: u === sl.A ? COLORS.A : COLORS.B, now: now && now[1], target: s0 && r ? Math.round(s0[1] * r) : null, gaps: G,
        shared: u === profile.id ? !!(level && level.data && level.data.share) : !!L, self: (L && L.data && L.data.self) || null }
    })
    // Prochain palier : là où la trajectoire attend le duo dans 4 semaines (ou à la prochaine course avant)
    const nowD = lastOf(duo), next = upcoming(races).find(x => x.team_id === t.id && raceIso && x.race_date < raceIso)
    const stepIso = next && next.race_date < addDays(today, 42) ? next.race_date : raceIso && addDays(today, 28) > raceIso ? raceIso : addDays(today, 28)
    const stepV = expected.length ? Math.round(valueAt(expected, dayNum(stepIso))) : null
    const a = fillStats(statsAt(sl.A, sessions, plans, lvOf(sl.A), today)), b = sl.B ? fillStats(statsAt(sl.B, sessions, plans, lvOf(sl.B), today)) : null
    const pred = a || b ? predictDuo(a || estimatePartner(b, prof(sl.B), prof(sl.A)), b || estimatePartner(a, prof(sl.A), prof(sl.B)), t.plan) : null, plan = normPlan(t.plan)
    const prio = pred ? STATIONS.map(x => ({ x, d: pred.seg[x.id] - (plan.obj[x.id] || 0) })).sort((p, q) => q.d - p.d)[0] : null
    return { duo, solo, real, expected, goal, race, raceIso, who, nowD, stepIso, stepV, next, prio, sl, conflict }
  }, [lv.loading, sh.loading, sessions, teams, races, t])
  async function alignRace() {
    try { await api.races.save({ id: T.race.id, goal_seconds: T.conflict.objTotal }); await reload(['races']); toast('Objectif de la course aligné sur le plan') } catch (e) { toast('Modification impossible : ' + e.message) }
  }
  async function alignPlan() {
    const P = normPlan(t.plan), f = T.conflict.raceGoal / T.conflict.objTotal, obj = Object.fromEntries(Object.entries(P.obj).map(([k, v]) => [k, Math.round(v * f)]))
    try { await api.teams.update(t.id, { plan: { ...t.plan, obj } }); await reload(['teams']); toast('Objectifs du plan alignés sur la course') } catch (e) { toast('Modification impossible : ' + e.message) }
  }
  if (!T || !firstOf(T.duo)) return <div className="glass card small"><b>Tendances du duo</b><div className="muted">Les courbes apparaissent dès que l’app connaît l’allure de course et au moins 3 ateliers (séances du duo ou bilan « Mon niveau »).</div></div>
  const partnerHidden = T.who.find(w => !w.me && !w.shared), meHidden = T.who.find(w => w.me && !w.shared)
  return <>
    <TrendCard title="Tendances du duo" raceIso={T.raceIso} goal={T.goal} expected={T.expected}
      lines={[{ label: 'Duo (estimé)', color: COLORS.C, pts: T.duo, dots: true, width: 3 },
        ...T.who.map(w => ({ label: w.name + ' (solo)', color: w.color, pts: T.solo[w.u], width: 1.5, opacity: 0.8 })),
        ...(T.real.length ? [{ label: 'Séances complètes', color: '#ff375f', pts: T.real, dots: true, width: 0.01 }] : [])]}
      foot={T.race ? '' : 'Programmez un Hyrox avec ce duo pour voir la trajectoire jusqu’au jour J.'}>
      {T.conflict && <div className="note small" style={{ marginBottom: 0 }}>
        Deux objectifs différents : <b>{fmt(T.conflict.raceGoal)}</b> pour « {T.race.name} » et <b>{fmt(T.conflict.objTotal)}</b> dans le plan. La courbe vise le plus ambitieux ({fmt(T.goal)}).
        <div className="row-gap" style={{ marginTop: 6 }}>{T.conflict.raceGoal > T.conflict.objTotal
          ? <button className="btn tinted small" onClick={alignRace}>Mettre la course à {fmt(T.conflict.objTotal)}</button>
          : <button className="btn tinted small" onClick={alignPlan}>Ajuster le plan à {fmt(T.conflict.raceGoal)}</button>}</div></div>}
    </TrendCard>
    <h2 className="sec">Objectifs de chacun</h2>
    <List>{T.who.map(w => <div className="row stack" key={w.u}>
      <div className="row-gap"><span style={{ width: 10, height: 10, borderRadius: 5, background: w.color, display: 'inline-block' }} /><b>{w.name}{w.me ? ' (moi)' : ''}</b><span className="spacer" />
        <span className="small">solo estimé <b className="num">{w.now ? fmt(w.now) : '—'}</b>{w.target ? <> → visé <b className="num">{fmt(w.target)}</b></> : ''}</span></div>
      <DeclaredGoals self={w.self} sex={(t.members.find(x => x.user_id === w.u) || {}).profile?.sex} />
      {w.gaps.length > 0 && <span className="small muted">Priorités du plan : {w.gaps.map(g => g.label).join(', ')}.</span>}
      {!w.me && !w.shared && <span className="small muted">{w.name} n’a pas encore partagé son niveau : ses objectifs et sa courbe apparaîtront ici s’il ou elle l’active dans « Mon niveau ».</span>}
    </div>)}</List>
    {meHidden && <a className="btn glass small block" style={{ marginTop: 8 }} href="#/moi/niveau">Partager mon niveau avec {partnerHidden ? 'mon duo' : T.who.find(w => !w.me)?.name || 'mon duo'}</a>}
    {T.stepV != null && T.nowD && <>
      <h2 className="sec">Prochain objectif du duo</h2>
      <div className="glass card">
        <div className="row-gap" style={{ alignItems: 'baseline' }}><span style={{ fontSize: 28, fontWeight: 800 }} className="num">{fmt(T.stepV)}</span>
          <span className="muted small">d’ici le {frDate(T.stepIso)}{T.next && T.stepIso === T.next.race_date ? ' (' + T.next.name + ')' : ''}</span></div>
        <p className="small" style={{ margin: '6px 0 0' }}>{T.nowD[1] > T.stepV ? <>Soit <b>{fmt(T.nowD[1] - T.stepV)}</b> à gagner par rapport à l’estimation actuelle ({fmt(T.nowD[1])}).</> : <>Déjà atteint avec l’estimation actuelle ({fmt(T.nowD[1])}) : gardez le cap.</>}
          {T.prio && T.prio.d > 5 ? <> Plus gros levier : <b>{T.prio.x.label}</b> ({fd(T.prio.d)} sur l’objectif du plan).</> : ''}</p>
      </div></>}
  </>
}

/** Objectifs déclarés dans « Mon niveau » : charges et allure actuelles → visées, avec jauge, et ateliers urgents */
const URG = { 1: ['faible', ''], 2: ['moyenne', 'warn'], 3: ['haute', 'bad'] }
const paceTxt = s => Math.floor(s / 60) + ':' + String(Math.round(s % 60)).padStart(2, '0') + '/km'
function DeclaredGoals({ self }) {
  if (!self) return null
  const label = id => id === 'run' ? 'Course' : id === 'force' ? 'Force générale' : (STATION[id] || {}).label || id
  const kind = id => id === 'run' ? 'run' : id === 'force' ? 'force' : 'station'
  const L = Object.entries(self).filter(([, v]) => v && v.state && v.state !== 'maitrise' && v.state !== 'inconnu').sort((a, b) => (b[1].urgency || 2) - (a[1].urgency || 2)).slice(0, 4)
  if (!L.length) return <span className="small muted">Ressenti : tout est maîtrisé ou non renseigné.</span>
  return <div style={{ display: 'grid', gap: 6, margin: '2px 0' }}>{L.map(([id, v]) => {
    const st = ((SELF_STATES[kind(id)] || []).find(x => x[0] === v.state) || [0, v.state])[1]
    const run = id === 'run', has = v.cur && v.target, pct = has ? Math.max(0, Math.min(1, run ? v.target / v.cur : v.cur / v.target)) : null
    const u = URG[v.urgency || 2]
    return <div key={id} className="small">
      <div className="row-gap" style={{ gap: 6 }}><b>{label(id)}</b><span className="muted">{st.toLowerCase()}</span><span className="spacer" />{u[1] ? <span className={'badge ' + u[1]}>urgence {u[0]}</span> : null}</div>
      {has && <div className="row-gap" style={{ gap: 8, marginTop: 3, flexWrap: 'nowrap' }}>
        <span style={{ flex: 1, position: 'relative', height: 8, background: 'var(--fill)', borderRadius: 99 }}><span style={{ position: 'absolute', inset: 0, width: pct * 100 + '%', background: pct >= 1 ? 'var(--good)' : 'var(--accent)', borderRadius: 99 }} /></span>
        <span className="num" style={{ whiteSpace: 'nowrap' }}>{run ? paceTxt(v.cur) + ' → ' + paceTxt(v.target) : v.cur + ' → ' + v.target + ' kg'}</span></div>}
    </div>
  })}</div>
}

// ---------- éditeur de plan ----------
export function PlanEditor({ id }) {
  const { teams, reload } = useApp(), toast = useToast()
  const t = teams.find(x => x.id === id)
  const [plan, setPlan] = useState(() => normPlan(t && t.plan))
  const [open, setOpen] = useState(null)
  if (!t) return <Page back="#/equipe" title="Plan" />
  const nA = slotName(t, 'A'), nB = slotName(t, 'B')
  const setObj = (k, v) => { const s = parseT(v); if (!Number.isNaN(s) && s != null) setPlan(p => ({ ...p, obj: { ...p.obj, [k]: s } })) }
  const setRunAll = v => { const s = parseT(v); if (Number.isNaN(s) || s == null) return; setPlan(p => { const o = { ...p.obj }; for (let k = 1; k <= 8; k++) o['r' + k] = s; return { ...p, obj: o } }) }
  const setSt = (sid, patch) => setPlan(p => ({ ...p, strat: { ...p.strat, [sid]: { ...p.strat[sid], ...patch } } }))
  const total = SEGS.reduce((a, g) => a + (plan.obj[g.id] || 0), 0)
  async function save() { await api.teams.update(t.id, { plan: { ...t.plan, ...plan } }); await reload(['teams']); toast('Plan enregistré'); location.hash = '#/equipe/' + t.id }
  return <Page back={'#/equipe/' + t.id} title="Plan du duo" subtitle={'Total visé ' + fmt(total)} actions={<button className="btn small" onClick={save}>Enregistrer</button>}>
    <h2 className="sec">Courses et Rox</h2>
    <List>
      <Field label="Distance par course (entraînement)" sub="km"><input type="number" step="0.05" defaultValue={plan.runKm} onBlur={e => setPlan(p => ({ ...p, runKm: +e.target.value || 1 }))} /></Field>
      <Field label="Temps par course" sub="appliqué aux 8 courses"><input {...TIME} defaultValue={fmt(plan.obj.r1)} onBlur={e => setRunAll(e.target.value)} /></Field>
      <Field label="Rox entrée (chaque)"><input {...TIME} defaultValue={fmt(plan.obj.ri1)} onBlur={e => { const s = parseT(e.target.value); if (s) setPlan(p => { const o = { ...p.obj }; for (let k = 1; k <= 8; k++) o['ri' + k] = s; return { ...p, obj: o } }) }} /></Field>
      <Field label="Rox sortie (chaque)"><input {...TIME} defaultValue={fmt(plan.obj.ro1)} onBlur={e => { const s = parseT(e.target.value); if (s) setPlan(p => { const o = { ...p.obj }; for (let k = 1; k <= 7; k++) o['ro' + k] = s; return { ...p, obj: o } }) }} /></Field>
    </List>
    <h2 className="sec">Ateliers et relais</h2>
    <p className="foot" style={{ marginTop: -4, marginBottom: 8 }}><span className="dotA" />{nA} · <span className="dotB" />{nB}</p>
    <List>
      {STATIONS.map(x => { const st = plan.strat[x.id], rel = planRelays(plan, x.id); return <React.Fragment key={x.id}>
        <Row title={x.label} sub={rel.map(r => (r.w === 'A' ? nA : nB) + ' ' + r.label).join(' · ')} value={fmt(plan.obj[x.id])} onClick={() => setOpen(open === x.id ? null : x.id)} />
        {open === x.id && <div className="row stack" style={{ background: 'var(--fill)' }}>
          <div className="row-gap"><span className="small">Objectif</span><input className="num" style={{ width: 80, textAlign: 'right', background: 'var(--glass)', borderRadius: 8, padding: 6, border: 0 }} {...TIME} defaultValue={fmt(plan.obj[x.id])} onBlur={e => setObj(x.id, e.target.value)} />
            <span className="small">Unité</span><select value={st.u} onChange={e => { const u = e.target.value; setSt(x.id, { u, tot: u === 's' ? plan.obj[x.id] : x.tot, t: [] }) }} style={{ background: 'var(--glass)', borderRadius: 8, padding: 6, border: 0 }}><option value={x.u}>{x.u.trim()}</option><option value="s">secondes</option></select>
            <span className="small">Changement</span><input type="number" style={{ width: 52, background: 'var(--glass)', borderRadius: 8, padding: 6, border: 0 }} value={st.trans} onChange={e => setSt(x.id, { trans: +e.target.value })} /><span className="small">s</span></div>
          <div className="row-gap">{[1, 2, 4, 8, 10].map(n => <button key={n} className="btn glass small" onClick={() => { const step = st.tot / n; setSt(x.id, { t: Array.from({ length: n }, (_, i) => ({ a: Math.round(i * step), b: Math.round((i + 1) * step), w: i % 2 ? 'B' : 'A', n: '' })) }) }}>{n} tranche{n > 1 ? 's' : ''}</button>)}</div>
          {st.t.map((r, i) => <div key={i} className="row-gap">
            <span className="num small" style={{ width: 92 }}>{fmtU(r.a, st.u)} → {fmtU(r.b, st.u)}</span>
            <div className="seg" style={{ margin: 0, width: 150 }}>{['A', 'B'].map(w => <button key={w} aria-pressed={r.w === w} onClick={() => { const tt = st.t.map((q, k) => k === i ? { ...q, w } : q); setSt(x.id, { t: tt }) }}>{w === 'A' ? nA : nB}</button>)}</div>
            <input placeholder="note" value={r.n || ''} onChange={e => setSt(x.id, { t: st.t.map((q, k) => k === i ? { ...q, n: e.target.value } : q) })} style={{ flex: 1, minWidth: 70, background: 'var(--glass)', borderRadius: 8, padding: 6, border: 0 }} />
          </div>)}
        </div>}
      </React.Fragment> })}
    </List>
    <div className="row-gap" style={{ marginTop: 10 }}>
      <button className="btn glass small" onClick={() => setPlan(p => ({ ...p, slots: { A: slotsOf(t).B, B: slotsOf(t).A } }))}><Icon name="swap" size={16} />Inverser A et B</button>
    </div>
    <p className="foot">Les tranches consécutives d’un même athlète forment un seul relais. Le plan sert au pointage (qui part) et au calcul des objectifs de chaque relais.</p>
    <button className="btn block" style={{ marginTop: 14 }} onClick={save}>Enregistrer le plan</button>
  </Page>
}
