// Programme : plan jusqu'à la course, lacunes (moi + coéquipier), suivi des séances validées, recalcul retard/avance.
import React, { useMemo, useState } from 'react'
import { useApp } from '../App.jsx'
import { api } from '../lib/api.js'
import { Page, Sec, List, Row, Seg, Icon, Empty, useToast, useLoad } from '../ui.jsx'
import { fmt, frDate, todayISO, daysUntil, STATION } from '../lib/hyrox.js'
import { buildProgram, wellNorm } from '../lib/program.js'
import { createPlan, replan, progress, weekDone, mondayOf, addDays, blocksFor, INTENSE } from '../lib/plan.js'
import { gapsOf, duoAdjust } from '../lib/gaps.js'
import { athleteStats, summary, hrBySegment } from '../lib/analyze.js'
import { predictDuo } from '../lib/predict.js'
import { customInsights, trainingLoad } from '../lib/load.js'
import { isCustom, isPlanned, customSummary, fmtTarget, newBlock, EX } from '../lib/custom.js'
import { activeZones, adaptBlocks, hits, maxLevel, ZONE } from '../lib/pain.js'
import { sleepStats } from '../lib/sleep.js'
import { cycleInfo, phaseOn, PHASE_LABEL, PHASE_COLOR } from '../lib/health.js'
import { mainRace, plansOf, isAthlete } from './common.js'
import { QuickSheet } from './Activity.jsx'

const PH_COLOR = { fondation: '#64d2ff', developpement: '#0a84ff', specifique: '#bf5af2', affutage: '#ff9f0a', course: '#ff375f', entretien: '#8e8e93' }
// Une séance « compte » si quelque chose a été réalisé (pas une séance seulement planifiée)
const realDone = s => !isPlanned(s)

/** Analyse partagée : lacunes, duo, allure, plan enregistré, suivi */
export function usePlanData() {
  const { profile, races, sessions, teams } = useApp()
  const today = todayISO()
  const race = mainRace(races)
  const plans = plansOf(teams)
  const planJ = useLoad(() => api.journal.list('plan'), [])
  const doneJ = useLoad(() => api.journal.list('program_done'), [])
  const entry = (planJ.data || [])[0] || null, plan = entry && entry.data
  const ins = useMemo(() => customInsights(sessions, profile.id), [sessions])
  const last = sessions.find(s => !isCustom(s) && isAthlete(s, profile.id))
  const hr = useLoad(async () => { if (!last || !profile.consent_health) return null; const rows = await api.hr.list(last.id); const r = rows.find(x => x.user_id === profile.id); return r ? hrBySegment(last, r, profile) : null }, [last && last.id])
  const an = useMemo(() => {
    const mine = athleteStats(profile.id, sessions, plans)
    const gaps = gapsOf(mine, { profile, e1rm: ins.e1rm, weakSt: ins.weakSt, z5: hr.data ? hr.data.zones[4] : null })
    const team = race && race.team_id ? teams.find(t => t.id === race.team_id) : null
    const pm = team && team.members.find(m => m.user_id !== profile.id && !m.left_at)
    let duo = null
    if (pm) {
      const ps = athleteStats(pm.user_id, sessions, plans), pg = gapsOf(ps, { profile: pm.profile })
      const pred = mine && ps ? predictDuo(mine, ps, team.plan) : null
      duo = { partner: pm.profile.display_name, gaps: pg, ...duoAdjust(gaps, pg, pred ? pred.share : {}, { partner: pm.profile.display_name }), hasData: ps.sessions > 0 }
    }
    const goalPace = race && race.goal_seconds ? race.goal_seconds * 0.5 / 8 : null
    const pace = Math.round(goalPace || (mine.pace ? mine.pace * 0.98 : 330))
    return { mine, gaps, duo, pace }
  }, [sessions, teams, race && race.id, ins, hr.data])
  // séances réalisées par date, cases cochées par semaine
  const byDate = useMemo(() => { const m = {}; sessions.filter(s => isAthlete(s, profile.id) && realDone(s)).forEach(s => { (m[s.session_date] = m[s.session_date] || []).push(s) }); return m }, [sessions])
  const manual = useMemo(() => { const m = {}; (doneJ.data || []).forEach(e => { (e.data.done || []).forEach(i => { m[addDays(e.day, i)] = true }) }); return m }, [doneJ.data])
  const doneOn = d => !!(manual[d] || byDate[d])
  const ach14 = useMemo(() => { const v = sessions.filter(s => isCustom(s) && isAthlete(s, profile.id) && s.session_date >= addDays(today, -14) && s.session_date < today).map(s => customSummary(s).achievement).filter(x => x != null); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null }, [sessions])
  const extras = useMemo(() => { if (!plan) return 0; const keyOf = {}; plan.weeks.forEach(w => w.days.forEach(d => { keyOf[d.date] = d.key })); let n = 0; Object.entries(byDate).forEach(([d, L]) => { if (d >= addDays(today, -14) && d < today) n += Math.max(0, L.length - (keyOf[d] && keyOf[d] !== 'repos' ? 1 : 0)) }); return n }, [plan, byDate])
  const raceChanged = !!(plan && race && (plan.raceId !== race.id || plan.raceDate !== race.race_date)) || !!(plan && !race && plan.raceId)
  const prog = plan ? progress(plan, doneOn, today, { ach: ach14, extras, raceChanged }) : null
  const params = (o = {}) => ({ race, from: today, perWeek: o.perWeek || (plan && plan.perWeek) || 4, gaps: an.gaps, duo: an.duo, e1rm: ins.e1rm, pace: an.pace, level: o.level })
  return { race, plan, entry, planJ, doneJ, an, ins, doneOn, byDate, manual, prog, extras, params, today }
}

function GapList({ gaps, empty }) {
  const G = gaps.filter(g => g.kind !== 'test').slice(0, 4), test = gaps.find(g => g.kind === 'test')
  return <>
    {G.length ? G.map((g, i) => <div className="tip" key={g.id}><span className={'dot ' + (i === 0 ? 'bad' : 'warn')} /><span className="small"><b>{g.label}</b> : {g.why}.</span></div>) : <div className="small muted">{empty}</div>}
    {test && <div className="tip"><span className="dot" /><span className="small muted">{test.why}</span></div>}
  </>
}

export function Program() {
  const { profile, sessions, teams } = useApp(), toast = useToast()
  const P = usePlanData(), { race, plan, entry, an, ins, doneOn, byDate, prog, today } = P
  const [perWeek, setPerWeek] = useState((plan && plan.perWeek) || 4)
  const [sel, setSel] = useState(null), [busy, setBusy] = useState(false), [quick, setQuick] = useState(false), [showDuo, setShowDuo] = useState(false)
  // contexte « du moment » pour la semaine affichée
  const well = useLoad(() => profile.consent_health ? api.journal.list('wellbeing') : [], [])
  const sleep = useLoad(() => profile.consent_health ? api.journal.list('sleep') : [], [])
  const blood = useLoad(() => profile.consent_health ? api.journal.list('blood') : [], [])
  const pains = useLoad(() => profile.consent_health ? api.journal.list('pain') : [], [])
  const female = profile.sex === 'F'
  const cyc = useLoad(() => profile.consent_health && female ? api.journal.list('cycle') : [], [female])
  const zones = activeZones(pains.data || [])
  const tl = useMemo(() => trainingLoad(sessions, profile.id), [sessions])

  async function save(data, msg) {
    setBusy(true)
    try {
      if (entry) await api.journal.update(entry.id, { data }); else await api.journal.add({ kind: 'plan', day: today, data })
      P.planJ.reload(); setSel(null); toast(msg)
    } catch (e) { toast('Enregistrement impossible : ' + e.message) } finally { setBusy(false) }
  }
  const make = () => save(createPlan(P.params({ perWeek })), 'Plan créé jusqu’à ' + (race ? race.name : 'dans 8 semaines'))
  const adjust = kind => {
    const level = kind === 'behind' ? Math.max(-1, (plan.level || 0) - 1) : kind === 'ahead' ? Math.min(1, (plan.level || 0) + 1) : plan.level || 0
    const why = kind === 'behind' ? `Retard (${prog.why}) : volume ramené au niveau réellement suivi, séances manquées non rattrapées, séances clés conservées.`
      : kind === 'ahead' ? `Avance (${prog.why}) : volume et objectifs relevés d’un cran.`
      : kind === 'race' ? 'Course modifiée : plan recalculé.' : `Plan recalculé (${perWeek} séances par semaine, lacunes mises à jour).`
    return save(replan(plan, P.params({ perWeek, level }), why), 'Plan adapté')
  }

  if (!plan) return <Page back="#/moi" title="Programme" subtitle={race ? `${race.name} · J−${daysUntil(race.race_date)}` : 'Sans course planifiée'}>
    <div className="glass card">
      <h3 style={{ marginTop: 0 }}>Votre plan jusqu’à la course</h3>
      <p className="small muted">Un plan semaine par semaine {race ? `jusqu’au ${frDate(race.race_date)}` : 'sur 8 semaines'} : phases (fondation, développement, spécifique, affûtage), semaines allégées, séances ciblées sur vos lacunes{an.duo ? ` et celles de ${an.duo.partner}` : ''}. Il suit les séances que vous validez et se recalcule si vous prenez du retard ou de l’avance.</p>
      <h4>Vos lacunes</h4><GapList gaps={an.gaps} empty="Pas encore assez de données : le plan alterne tous les ateliers." />
      {an.duo && <><h4>{an.duo.partner}</h4><GapList gaps={an.duo.gaps} empty={an.duo.hasData ? 'Aucune lacune nette.' : 'Pas encore de séance commune.'} /></>}
      <div style={{ marginTop: 10 }}><Seg value={perWeek} onChange={setPerWeek} options={[[3, '3 séances / sem.'], [4, '4'], [5, '5'], [6, '6']]} /></div>
      <button className="btn block" disabled={busy} onClick={make}><Icon name="cal" size={18} />Créer mon plan</button>
    </div>
  </Page>

  const weeks = plan.weeks, curIdx = Math.max(0, weeks.findIndex(w => w.start === mondayOf(today)))
  const wi = sel != null ? sel : curIdx, week = weeks[wi] || weeks[0]
  const isCur = week.start === mondayOf(today)
  // adaptations du moment (semaine en cours seulement)
  const cycleDays = isCur && female && (cyc.data || []).length ? week.days.map(d => phaseOn(cyc.data, d.date)) : null
  const crp = ((blood.data || []).find(b => b.data.crp != null) || {}).data
  const sst = sleepStats(sleep.data || [])
  const adapted = isCur ? buildProgram({ phase: week.phase, baseDays: week.days, cycleDays, perWeek: plan.perWeek, well: well.data || [], todayISO: today, today: (new Date().getDay() + 6) % 7,
    loadRatio: tl.chronic > 30 ? tl.ratio : null, cycle: female ? cycleInfo(cyc.data || []) : null, crp: crp ? +crp.crp : null, sleepAvg: sst ? sst.avg : null }) : { days: week.days, notes: [week.phase.note] }
  const ctxOf = d => ({ focus: d.focus, e1rm: ins.e1rm, phase: week.phase.id, factor: week.factor, pace: an.pace, min: d.min })
  const days = adapted.days.map(d => {
    let blocks = d.blocks || blocksFor(d.key, ctxOf(d)), painNote = null
    if (zones.length && d.key !== 'repos') {
      const strong = zones.filter(z => maxLevel(pains.data, z) >= 7)
      if (blocks) { const a = adaptBlocks(blocks, zones); blocks = a.blocks; if (a.swaps.length) painNote = 'Adapté à votre douleur : ' + [...new Set(a.swaps.map(x => x.to ? EX[x.from].label + ' → ' + EX[x.to].label : EX[x.from].label + ' à éviter'))].join(', ') }
      else if (d.key === 'simu') painNote = 'Douleur déclarée (' + zones.map(z => ZONE[z].toLowerCase()).join(', ') + ') : préférez les ateliers adaptés à une simulation complète.'
      if (strong.length && blocks && blocks.some(b => (b.type === 'group' ? b.items : [b]).some(i => hits(i.ex, strong).length))) painNote = 'Douleur forte (' + strong.map(z => ZONE[z].toLowerCase()).join(', ') + ') : séance remplacée par du repos ou un travail sans la zone, et un avis médical.'
    }
    return { ...d, blocks, painNote }
  })
  const W = weekDone(week, doneOn, today)
  const manualIdx = ((P.doneJ.data || []).find(e => e.day === week.start) || { data: { done: [] } }).data.done || []
  async function toggle(i, d) {
    if (byDate[d.date]) return
    const row = (P.doneJ.data || []).find(e => e.day === week.start)
    const next = manualIdx.includes(i) ? manualIdx.filter(x => x !== i) : [...manualIdx, i].sort()
    try { if (row) await api.journal.update(row.id, { data: { done: next } }); else await api.journal.add({ kind: 'program_done', day: week.start, data: { done: next } }); P.doneJ.reload() } catch (e) { toast(e.message) }
  }
  function launch(d) {
    try { localStorage.setItem('hx-prefill', JSON.stringify({ blocks: d.blocks, title: d.title, date: d.date })) } catch {}
    location.hash = '#/seance/specifique?date=' + d.date + '&plan=' + d.date + '&back=' + encodeURIComponent('#/moi/programme')
  }
  const plannedOn = date => sessions.find(s => isPlanned(s) && s.session_date === date && isAthlete(s, profile.id))
  const banner = prog.status !== 'ok' && <div className="glass card" style={{ borderLeft: '4px solid ' + (prog.status === 'ahead' ? 'var(--good, #30d158)' : 'var(--warn, #ff9f0a)') }}>
    <b>{prog.status === 'behind' ? 'Vous avez pris du retard' : prog.status === 'ahead' ? 'Vous êtes en avance' : 'Votre course a changé'}</b>
    <div className="small muted">{prog.why}. {prog.status === 'behind' ? 'Plutôt que de tout rattraper (risque de surcharge), le plan repart du niveau réellement suivi et garde les séances clés.' : prog.status === 'ahead' ? 'Le plan peut monter d’un cran : un peu plus de volume et des objectifs plus ambitieux.' : 'Le plan doit être recalculé pour la nouvelle date.'}</div>
    <button className="btn small" style={{ marginTop: 8 }} disabled={busy} onClick={() => adjust(prog.status)}>{prog.status === 'behind' ? 'Adapter le plan au retard' : prog.status === 'ahead' ? 'Relever le plan' : 'Recalculer le plan'}</button>
  </div>
  return <Page back="#/moi" title="Programme" subtitle={`${week.phase.label}${plan.raceName ? ` · ${plan.raceName} J−${Math.max(0, daysUntil(plan.raceDate))}` : ''}`}>
    {banner}
    <div className="glass card">
      <div className="row-gap small"><b>Plan : {prog.doneAll}/{prog.total} séances</b><span className="spacer" />{prog.adh != null && <span className="muted">assiduité {Math.round(prog.adh * 100)} %</span>}</div>
      <div style={{ display: 'flex', gap: 3, marginTop: 8, overflowX: 'auto' }}>{weeks.map((w, i) => { const x = weekDone(w, doneOn, today); return <button key={w.start} onClick={() => setSel(i)} aria-label={'Semaine ' + (i + 1)} aria-pressed={i === wi}
        style={{ flex: '1 0 22px', minWidth: 22, height: 34, borderRadius: 6, border: i === wi ? '2px solid var(--ink)' : '0', padding: 0, background: PH_COLOR[w.phase.id] + (w.start > today ? '44' : 'cc'), color: '#fff', fontSize: 10, fontWeight: 700, position: 'relative', overflow: 'hidden' }}>
        <span style={{ position: 'absolute', left: 0, bottom: 0, height: (x.n ? x.done / x.n * 100 : 0) + '%', width: '100%', background: 'rgba(255,255,255,.35)' }} /><span style={{ position: 'relative' }}>{w.deload ? '↓' : i + 1}</span></button> })}</div>
      <div className="tiny muted" style={{ marginTop: 6 }}>{[...new Set(weeks.map(w => w.phase.id))].map(id => <span key={id} style={{ marginRight: 10 }}><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: PH_COLOR[id], marginRight: 3 }} />{weeks.find(w => w.phase.id === id).phase.label}</span>)}↓ = semaine allégée</div>
    </div>

    <div className="row-gap" style={{ gap: 6 }}>
      <a className="btn glass small" style={{ flex: 1 }} href="#/moi/sante?t=forme"><Icon name="spark" size={14} />Forme</a>
      <a className="btn glass small" style={{ flex: 1 }} href="#/moi/sante?t=douleurs"><Icon name="heart" size={14} />Douleur</a>
      <a className="btn glass small" style={{ flex: 1 }} href="#/seance/specifique?lib=1&back=%23%2Fmoi%2Fprogramme"><Icon name="bolt" size={14} />Séances</a>
    </div>
    <div className="row-gap" style={{ margin: '14px 4px 6px' }}>
      <button className="icon-btn glass" disabled={wi === 0} onClick={() => setSel(wi - 1)} aria-label="Semaine précédente"><Icon name="back" size={18} /></button>
      <div style={{ flex: 1, textAlign: 'center' }}><b>Semaine {wi + 1}/{weeks.length}</b><div className="tiny muted">du {frDate(week.start).slice(0, 5)} au {frDate(addDays(week.start, 6)).slice(0, 5)} · {W.done}/{W.n} faites{week.deload ? ' · allégée' : ''}</div></div>
      <button className="icon-btn glass" disabled={wi >= weeks.length - 1} onClick={() => setSel(wi + 1)} aria-label="Semaine suivante"><Icon name="chev" size={18} /></button>
    </div>
    {isCur && adapted.notes.length > 0 && <div className="glass card">{adapted.notes.map((n, i) => <div className="tip" key={i}><span className={'dot ' + (i === 0 ? '' : 'bad')} /><span className="small">{n}</span></div>)}</div>}
    <List>{days.map((d, i) => { const done = doneOn(d.date), auto = !!byDate[d.date], isToday = d.date === today, pl = plannedOn(d.date); return <div className="row stack" key={d.date} style={isToday ? { background: 'var(--accent-soft)' } : null}>
      <div className="row-gap"><b>{d.day}</b><span className="small muted">{frDate(d.date).slice(0, 5)}</span>{isToday && <span className="badge accent">Aujourd’hui</span>}{d.duo && <span className="badge">duo</span>}<span className="spacer" /><span className="badge">{d.zone}</span><span className="small muted">{d.min} min</span>
        {d.key !== 'repos' && <label className="row-gap small" style={{ gap: 6, flexShrink: 0 }} title={auto ? 'Séance enregistrée ce jour-là' : 'Cocher quand la séance est faite'}>
          <input type="checkbox" checked={done} disabled={auto} onChange={() => toggle(i, d)} style={{ width: 22, height: 22, accentColor: 'var(--good, #30d158)' }} aria-label={'Séance de ' + d.day + ' faite'} />Fait</label>}</div>
      <div style={{ fontWeight: 600, textDecoration: done && d.key !== 'repos' ? 'line-through' : 'none', opacity: done && d.key !== 'repos' ? .65 : 1 }}>{d.title}</div>
      <div className="small muted">{d.detail}</div>
      {d.focus && d.focus.length > 0 && ['ateliers', 'compromis', 'rappel'].includes(d.key) && <div className="tiny muted">Ciblé : {d.focus.map(st => STATION[st] ? STATION[st].label : st).join(', ')}{d.duo && an.duo ? ` (dont lacunes de ${an.duo.partner})` : ''}</div>}
      {d.cycle && <div className="small" style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}><span className="badge" style={{ background: PHASE_COLOR[d.cycle.phase] + '33', color: 'var(--ink)', flexShrink: 0 }}>J{d.cycle.day} · {PHASE_LABEL[d.cycle.phase]}</span>{d.adapted && <span className="muted">{d.adapted}{d.was ? ' (prévu : ' + d.was + ')' : ''}</span>}</div>}
      {d.adapted && !d.cycle && <div className="small muted">{d.adapted}{d.was ? ' (prévu : ' + d.was + ')' : ''}</div>}
      {d.painNote && <div className="small" style={{ color: 'var(--warn, #ff9f0a)' }}>⚠ {d.painNote}</div>}
      {auto && <div className="tiny muted">Validée : {byDate[d.date].map(s => s.name).join(', ')}</div>}
      {!done && d.date >= today && <div className="row-gap" style={{ gap: 6 }}>
        {pl ? <a className="btn small" href={'#/seance/' + pl.id + '/chrono'}><Icon name="play" size={14} />Lancer « {pl.name} »</a>
          : d.key === 'simu' ? <a className="btn small tinted" href="#/seance/nouvelle"><Icon name="play" size={14} />Simulation au format Hyrox</a>
          : d.key === 'repos' ? <a className="btn small glass" href="#/moi/etirements"><Icon name="leaf" size={14} />Étirements</a>
          : d.blocks ? <button className="btn small tinted" onClick={() => launch(d)}>{d.date === today ? <><Icon name="play" size={14} />Préparer et lancer</> : <><Icon name="cal" size={14} />Pré-enregistrer</>}</button> : null}
      </div>}
    </div> })}</List>
    <button className="btn glass block" style={{ marginTop: 10 }} onClick={() => setQuick(true)}><Icon name="plus" size={18} />Ajouter une séance faite en plus du plan</button>

    <h2 className="sec">Lacunes travaillées</h2>
    <div className="glass card"><GapList gaps={an.gaps} empty="Pas de lacune nette : le plan alterne les ateliers." />
      {plan.gapsAt && plan.gapsAt.join() !== an.gaps.filter(g => g.kind !== 'test').slice(0, 4).map(g => g.label).join() && <div className="small muted" style={{ marginTop: 6 }}>Vos lacunes ont évolué depuis la création du plan. <button className="btn plain small" disabled={busy} onClick={() => adjust('refresh')}>Mettre à jour le plan</button></div>}
    </div>
    {an.duo && <>
      <h2 className="sec">Duo avec {an.duo.partner}</h2>
      <div className="glass card">
        <GapList gaps={an.duo.gaps} empty={an.duo.hasData ? 'Aucune lacune nette chez votre partenaire.' : 'Pas encore de séance commune : faites une simulation ensemble pour affiner.'} />
        {an.duo.notes.length > 0 && <button className="btn plain small" onClick={() => setShowDuo(x => !x)}>{showDuo ? 'Masquer' : 'Voir'} les ajustements du plan</button>}
        {showDuo && an.duo.notes.map((n, i) => <div className="tip" key={i}><span className="dot" /><span className="small">{n}</span></div>)}
        {an.duo.focus.length > 0 && <div className="small muted" style={{ marginTop: 6 }}>Vos séances duo et vos ateliers intègrent : {an.duo.focus.map(id => STATION[id].label).join(', ')}.</div>}
      </div></>}

    {ins.targets.length > 0 && <>
      <h2 className="sec">Vos prochaines cibles (séances personnalisées)</h2>
      <List>{ins.targets.slice(0, 6).map((t, i) => <div className="row stack" key={i}><div className="row-gap"><b>{t.label}</b><span className="spacer" /><span className="small muted">{frDate(t.date).slice(0, 5)}</span></div>
        <span className="small">{fmtTarget(t.target)} → <b>{fmtTarget(t.next)}</b></span><span className="small muted">{t.why}{t.e1rm ? ' · 1RM estimé ' + Math.round(t.e1rm) + ' kg' : ''}</span></div>)}</List>
    </>}

    <h2 className="sec">Réglages du plan</h2>
    <Seg value={perWeek} onChange={setPerWeek} options={[[3, '3 séances / sem.'], [4, '4'], [5, '5'], [6, '6']]} />
    <button className="btn glass block" disabled={busy} onClick={() => adjust('refresh')}>Recalculer à partir de cette semaine</button>
    <div className="glass card small" style={{ marginTop: 12 }}><b>Charge d’entraînement</b> · 7 derniers jours : {Math.round(tl.acute)} (minutes × effort) en {tl.n7} séance(s){tl.ratio != null && tl.chronic > 30 ? ` · ${tl.ratio.toFixed(2).replace('.', ',')} × votre moyenne des 4 semaines` : ''}. Repère : entre 0,8 et 1,3.</div>
    {(plan.log || []).length > 0 && <><h2 className="sec">Historique du plan</h2><List>{[...plan.log].reverse().slice(0, 6).map((l, i) => <Row key={i} title={l.text} sub={frDate(l.date)} />)}</List></>}
    <p className="foot">Repères généraux de préparation. Adaptez à vos sensations ; en cas de douleur ou de problème de santé, demandez l’avis d’un professionnel.</p>
    {quick && <QuickSheet onClose={() => setQuick(false)} />}
  </Page>
}

/** Séance du jour pour l'accueil (plan si existant) */
export function useTodayPlan() {
  const P = usePlanData()
  if (!P.plan) return null
  const w = P.plan.weeks.find(x => x.start === mondayOf(P.today)); if (!w) return null
  const d = w.days.find(x => x.date === P.today)
  return d ? { d, phase: w.phase, done: P.doneOn(P.today), prog: P.prog } : null
}
