// Ressenti vs effort estimé d'après le cœur : carte de séance et historique (suivi)
import React, { useMemo } from 'react'
import { useApp } from '../App.jsx'
import { api } from '../lib/api.js'
import { useLoad } from '../ui.jsx'
import { LineChart } from '../charts.jsx'
import { frDate } from '../lib/hyrox.js'
import { addDays } from '../lib/plan.js'
import { wellNorm } from '../lib/program.js'
import { isPlanned } from '../lib/custom.js'
import { effortHistory, effortPoint, readEffort, KIND_LABEL } from '../lib/effort.js'

const n1 = v => v == null ? '—' : String(Math.round(v * 10) / 10).replace('.', ',')
const isAth = (s, uid) => !!(s.athletes && (s.athletes.A === uid || s.athletes.B === uid))

/** Historique ressenti / estimé de l'utilisateur (séances des ~10 dernières semaines) */
export function useEffort(days = 70) {
  const { sessions, profile } = useApp()
  const health = !!profile.consent_health, female = profile.sex === 'F'
  const from = addDays(new Date().toISOString().slice(0, 10), -days)
  const mine = useMemo(() => sessions.filter(s => isAth(s, profile.id) && !isPlanned(s) && s.session_date >= from), [sessions])
  const rows = useLoad(() => api.hr.listMany(mine.map(s => s.id)), [mine.map(s => s.id).join()])
  const vit = useLoad(() => health ? api.journal.list('vitals') : [], [])
  const cyc = useLoad(() => health && female ? api.journal.list('cycle') : [], [])
  const wb = useLoad(() => health ? api.journal.list('wellbeing') : [], [])
  const sl = useLoad(() => health ? api.journal.list('sleep') : [], [])
  const rest = ((vit.data || []).find(e => e.data && e.data.rhr) || { data: {} }).data.rhr || 60
  const loading = rows.loading || vit.loading || cyc.loading || wb.loading || sl.loading
  const history = useMemo(() => loading ? [] : effortHistory(mine, profile.id, rows.data || [], profile, rest), [loading, mine, rows.data, rest])
  return { loading, history, rows: rows.data || [], rest, cycle: cyc.data || [], wb: wb.data || [], sleep: sl.data || [], profile }
}

/** Carte « Ressenti vs effort estimé » d'une séance (pour l'utilisateur, ses données restent privées) */
export function EffortCard({ s }) {
  const { profile } = useApp()
  const E = useEffort()
  if (!isAth(s, profile.id)) return null
  if (E.loading) return null
  const row = E.rows.find(r => r.session_id === s.id && r.user_id === profile.id)
  const p = effortPoint(s, profile.id, row, profile, E.rest)
  if (!p || p.felt == null) return null
  const w = E.wb.find(e => e.day === s.session_date), sl = E.sleep.find(e => e.day === s.session_date)
  const R = readEffort(p, { history: E.history, cycle: E.cycle, well: w ? wellNorm(w) : null, sleepH: sl && sl.data && sl.data.asleep ? sl.data.asleep / 60 : null })
  if (!R) return null
  const col = { trend: 'var(--bad)', dip: 'var(--warn, #ff9f0a)', cycle: '#bf5af2', easy: 'var(--good, #30d158)', ok: 'var(--accent)', start: 'var(--ink-3)', nohr: 'var(--ink-3)' }[R.level]
  const same = E.history.filter(x => x.kind === p.kind && x.date <= s.session_date).slice(-10)
  return <>
    <h2 className="sec">Ressenti vs effort estimé</h2>
    <div className="glass card" style={{ borderLeft: '4px solid ' + col }}>
      <div className="row-gap"><b>{R.title}</b></div>
      <div className="small" style={{ marginTop: 4 }}>Ressenti <b className="num">{n1(p.felt)}/10</b>{p.est != null && <> · effort estimé d’après le cœur <b className="num">{n1(p.est)}/10</b> <span className="muted">(FC moyenne {p.avg} bpm)</span></>}</div>
      {R.level !== 'nohr' && R.level !== 'start' && <div className="tiny muted" style={{ marginTop: 2 }}>D’habitude en {KIND_LABEL[p.kind]}, votre ressenti est {R.usual > 0 ? 'au-dessus' : R.usual < 0 ? 'en dessous' : 'au niveau'} de l’estimation de {n1(Math.abs(R.usual))} point{Math.abs(R.usual) >= 2 ? 's' : ''} ; aujourd’hui {R.dev > 0 ? '+' : ''}{n1(R.dev)} par rapport à cette habitude.</div>}
      <p className="small" style={{ margin: '8px 0 0' }}>{R.text}</p>
      {R.why && R.why.length > 0 && <div style={{ marginTop: 6 }}>{R.why.map((x, i) => <div key={i} className="tip"><span className="dot" /><span className="small">{x}</span></div>)}</div>}
      {same.length >= 3 && <div style={{ marginTop: 8 }}>
        <LineChart height={110} yMin={1} yMax={10} xFmt={v => frDate(new Date(v * 864e5).toISOString().slice(0, 10)).slice(0, 5)} yFmt={v => Math.round(v)}
          series={[{ color: '#ff9f0a', dots: true, pts: same.map(x => [Date.parse(x.date) / 864e5, x.felt]) }, { color: '#0a84ff', dots: true, dash: '4 3', pts: same.map(x => [Date.parse(x.date) / 864e5, x.est]) }]} />
        <div className="legend"><span><span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 5, background: '#ff9f0a', marginRight: 4 }} />Ressenti</span><span><span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 5, background: '#0a84ff', marginRight: 4 }} />Estimé (cœur)</span><span className="faint">{same.length} dernières séances {KIND_LABEL[p.kind]}</span></div>
      </div>}
      <p className="tiny muted" style={{ margin: '6px 0 0' }}>Effort estimé : FC moyenne de la séance en % de votre réserve cardiaque (FC max {E.profile.hr_max || 'estimée'}, FC repos {E.rest}). Le renfo fait peu monter le cœur : la comparaison se fait donc avec vos séances du même type.</p>
    </div>
  </>
}

/** Suivi : ressenti et effort estimé semaine après semaine */
export function EffortWeeks({ weeks }) {
  const E = useEffort(7 * Math.max(8, weeks.length + 1))
  if (E.loading || E.history.length < 2) return null
  const W = weeks.map(w => { const L = E.history.filter(x => x.date >= w.ws && x.date <= addDays(w.ws, 6)); return { w, felt: L.length ? L.reduce((a, x) => a + x.felt, 0) / L.length : null, est: L.length ? L.reduce((a, x) => a + x.est, 0) / L.length : null, n: L.length } })
  if (W.filter(x => x.n).length < 2) return null
  const last = E.history[E.history.length - 1], R = readEffort(last, { history: E.history, cycle: E.cycle })
  return <div className="glass card" style={{ marginTop: 8 }}>
    <div className="small" style={{ fontWeight: 600 }}>Ressenti vs effort estimé (par semaine)</div>
    <LineChart height={130} yMin={1} yMax={10} xFmt={i => (weeks[Math.round(i)] || {}).label || ''} yFmt={v => Math.round(v)}
      series={[{ color: '#ff9f0a', dots: true, pts: W.map((x, i) => [i, x.felt]) }, { color: '#0a84ff', dots: true, dash: '4 3', pts: W.map((x, i) => [i, x.est]) }]} />
    <div className="legend"><span><span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 5, background: '#ff9f0a', marginRight: 4 }} />Ressenti moyen</span><span><span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 5, background: '#0a84ff', marginRight: 4 }} />Estimé d’après le cœur</span></div>
    {R && R.level !== 'start' && <p className="small" style={{ margin: '6px 0 0' }}>Dernière séance ({frDate(last.date).slice(0, 5)}) : <b>{R.title.toLowerCase()}</b>.{R.recDev != null && R.recDev >= 1 ? ' Les 3 dernières semaines sont vécues plus dures que d’habitude : fatigue de fond probable.' : ' Pas de dérive sur les dernières semaines.'}{R.phase ? ' Phase du cycle prise en compte.' : ''}</p>}
    <p className="tiny muted" style={{ margin: '4px 0 0' }}>Si l’orange s’écarte du bleu plusieurs semaines de suite, c’est la fatigue qui s’installe. Un seul point isolé = un coup de mou.</p>
  </div>
}
