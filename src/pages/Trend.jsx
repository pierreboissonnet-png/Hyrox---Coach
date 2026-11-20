// Carte « courbe de progression » : estimé vs trajectoire attendue jusqu'au jour J
import React from 'react'
import { LineChart } from '../charts.jsx'
import { fmt, fd, frDate } from '../lib/hyrox.js'
import { isoOfNum, dayNum, valueAt, lastOf } from '../lib/trend.js'
import { todayISO } from '../lib/hyrox.js'

/**
 * lines : [{label, color, pts, width, dots, dash}] ; expected : points de la trajectoire attendue (facultatif)
 * main : index de la ligne comparée à la trajectoire (défaut 0)
 */
export function TrendCard({ title, lines, expected = [], raceIso, goal, main = 0, foot }) {
  const today = dayNum(todayISO())
  const L = lines.filter(l => l.pts.some(p => p[1] != null))
  if (!L.length) return null
  const band = expected.length ? [
    { color: 'var(--good)', width: 1, opacity: .45, dash: '3 4', pts: expected.map(([x, y]) => [x, Math.round(y * 0.975)]) },
    { color: 'var(--warn)', width: 1, opacity: .45, dash: '3 4', pts: expected.map(([x, y]) => [x, Math.round(y * 1.025)]) },
    { color: 'var(--ink-3)', width: 2.5, opacity: .8, dash: '7 5', pts: expected },
  ] : []
  const ref = lines[main] && lastOf(lines[main].pts), exp = ref && expected.length ? valueAt(expected, ref[0]) : null, d = ref && exp != null ? ref[1] - exp : null
  const allX = [...L.flatMap(l => l.pts), ...expected].map(p => p[0])
  const marks = [today, raceIso ? dayNum(raceIso) : null].filter(x => x != null && x >= Math.min(...allX) && x <= Math.max(...allX))
  return <div className="glass card">
    <div className="row-gap" style={{ alignItems: 'baseline' }}><b>{title}</b><span className="spacer" />
      {d != null && <span className={'badge ' + (d <= 30 ? (d < -30 ? 'good' : 'accent') : 'warn')}>{d < -30 ? 'en avance de ' + fmt(-d) : d > 30 ? 'en retard de ' + fmt(d) : 'dans la trajectoire'}</span>}</div>
    <LineChart height={190} series={[...band, ...L.map(l => ({ ...l, width: l.width || 2.5 }))]} marks={marks}
      xFmt={v => frDate(isoOfNum(Math.round(v))).slice(0, 5)} yFmt={v => fmt(v)} />
    <div className="row-gap tiny" style={{ marginTop: 4 }}>
      {L.map(l => <span key={l.label} className="row-gap" style={{ gap: 4 }}><span style={{ width: 14, height: 3, borderRadius: 2, background: l.color, display: 'inline-block' }} />{l.label}</span>)}
      {expected.length > 0 && <span className="row-gap" style={{ gap: 4 }}><span style={{ width: 14, height: 0, borderTop: '2px dashed var(--ink-3)', display: 'inline-block' }} />Trajectoire attendue (±2,5 %)</span>}
    </div>
    <p className="small muted" style={{ marginBottom: 0 }}>
      {ref ? <>Estimation actuelle <b>{fmt(ref[1])}</b>{exp != null ? <> · attendu à ce stade <b>{fmt(Math.round(exp))}</b> ({fd(Math.round(d))})</> : ''}{goal ? <> · objectif <b>{fmt(goal)}</b>{raceIso ? ' le ' + frDate(raceIso) : ''}</> : ''}. </> : ''}
      {expected.length && expected[0][1] === expected[expected.length - 1][1] && ref && ref[1] <= goal ? 'Objectif déjà à portée : vous pouvez viser plus ambitieux (onglet Courses). ' : 'Plus la courbe descend, plus le temps baisse. L’objectif : rester entre les deux pointillés fins. '}{foot || ''}</p>
  </div>
}
