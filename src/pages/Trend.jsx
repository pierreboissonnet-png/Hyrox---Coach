// Carte « courbe de progression » : estimé vs trajectoire attendue jusqu'au jour J
import React, { useState } from 'react'
import { LineChart } from '../charts.jsx'
import { fmt, fd, frDate } from '../lib/hyrox.js'
import { isoOfNum, dayNum, valueAt, lastOf } from '../lib/trend.js'
import { todayISO } from '../lib/hyrox.js'

/**
 * lines : [{label, color, pts, width, dots, dash}] ; expected : points de la trajectoire attendue (facultatif)
 * main : index de la ligne comparée à la trajectoire (défaut 0)
 */
export function TrendCard({ title, lines, expected: expected0 = [], raceIso, goal, main = 0, foot, children }) {
  const today = dayNum(todayISO())
  const [all, setAll] = useState(false)
  if (!lines.some(l => l.pts.some(p => p[1] != null))) return null
  // Vue par défaut : 8 semaines d'historique + 4 à venir ; « Jusqu'au jour J » montre tout
  const lo = today - 56, hi = today + 28, race = raceIso ? dayNum(raceIso) : null
  const xs = [...lines.flatMap(l => l.pts.filter(p => p[1] != null)), ...expected0].map(p => p[0])
  const zoomable = (race != null && race > hi) || Math.min(...xs) < lo
  const win = pts => all || !zoomable ? pts : pts.filter(p => p[0] >= lo && p[0] <= hi)
  const expected = all || !zoomable || !expected0.length ? expected0 : [...[lo, today, hi].map(x => x >= expected0[0][0] && x <= expected0[expected0.length - 1][0] ? [x, Math.round(valueAt(expected0, x))] : null).filter(Boolean), ...expected0.filter(p => p[0] > lo && p[0] < hi)].sort((a, b) => a[0] - b[0])
  const L = lines.map(l => ({ ...l, pts: win(l.pts) })).filter(l => l.pts.some(p => p[1] != null))
  if (!L.length) return null
  const band = expected.length ? [
    { color: 'var(--good)', width: 1, opacity: .45, dash: '3 4', pts: expected.map(([x, y]) => [x, Math.round(y * 0.975)]) },
    { color: 'var(--warn)', width: 1, opacity: .45, dash: '3 4', pts: expected.map(([x, y]) => [x, Math.round(y * 1.025)]) },
    { color: 'var(--ink-3)', width: 2.5, opacity: .8, dash: '7 5', pts: expected },
  ] : []
  const ref = lines[main] && lastOf(lines[main].pts), exp = ref && expected0.length ? valueAt(expected0, ref[0]) : null, d = ref && exp != null ? ref[1] - exp : null
  const allX = [...L.flatMap(l => l.pts), ...expected].map(p => p[0])
  const marks = [today, raceIso ? dayNum(raceIso) : null].filter(x => x != null && x >= Math.min(...allX) && x <= Math.max(...allX))
  return <div className="glass card">
    <div className="row-gap" style={{ alignItems: 'baseline' }}><b>{title}</b><span className="spacer" />
      {d != null && <span className={'badge ' + (d <= 30 ? (d < -30 ? 'good' : 'accent') : 'warn')}>{d < -30 ? 'en avance de ' + fmt(-d) : d > 30 ? 'en retard de ' + fmt(d) : 'dans la trajectoire'}</span>}</div>
    {zoomable && <div className="row-gap" style={{ margin: '6px 0 2px' }}><span className="tiny muted">{all ? 'Toute la préparation' : '8 dernières semaines et 4 à venir'}</span><span className="spacer" />
      <button className="btn glass small" onClick={() => setAll(!all)}>{all ? 'Vue récente' : 'Jusqu’au jour J'}</button></div>}
    <LineChart height={190} invert series={[...band, ...L.map(l => ({ ...l, width: l.width || 2.5 }))]} marks={marks}
      xFmt={v => frDate(isoOfNum(Math.round(v))).slice(0, 5)} yFmt={v => fmt(v)} />
    <div className="row-gap tiny" style={{ marginTop: 4 }}>
      {L.map(l => <span key={l.label} className="row-gap" style={{ gap: 4 }}><span style={{ width: 14, height: 3, borderRadius: 2, background: l.color, display: 'inline-block' }} />{l.label}</span>)}
      {expected.length > 0 && <span className="row-gap" style={{ gap: 4 }}><span style={{ width: 14, height: 0, borderTop: '2px dashed var(--ink-3)', display: 'inline-block' }} />Trajectoire attendue (±2,5 %)</span>}
    </div>
    <p className="small muted" style={{ marginBottom: 0 }}>
      {ref ? <>Estimation actuelle <b>{fmt(ref[1])}</b>{exp != null ? <> · attendu à ce stade <b>{fmt(Math.round(exp))}</b> ({fd(Math.round(d))})</> : ''}{goal ? <> · objectif <b>{fmt(goal)}</b>{raceIso ? ' le ' + frDate(raceIso) : ''}</> : ''}. </> : ''}
      {expected0.length && expected0[0][1] === expected0[expected0.length - 1][1] && ref && ref[1] <= goal ? 'Objectif déjà à portée : vous pouvez viser plus ambitieux (onglet Courses). ' : 'Temps rapides en haut : plus la courbe monte, plus vous progressez. L’objectif : rester entre les deux pointillés fins. '}{foot || ''}</p>
    {children}
  </div>
}
