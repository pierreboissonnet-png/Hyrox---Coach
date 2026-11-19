// Graphiques SVG légers (sans bibliothèque).
import React from 'react'
import { fmt } from './lib/hyrox.js'

export const COLORS = { A: '#0a84ff', B: '#ff9f0a', C: '#30d158' }

/** Courbes temps → valeur. series: [{name, color, pts:[[x,y]]}] ; bands: [{a,b,color}] */
const yt0 = (a, b) => Array.from({ length: 5 }, (_, i) => a + (b - a) * i / 4)
export function LineChart({ series, bands = [], height = 180, xFmt = v => fmt(v), yFmt = v => Math.round(v), yMin, yMax, marks = [] }) {
  const W = 640, H = height * 1.25, R = 10, T = 10, B = 30
  const all = series.flatMap(s => s.pts)
  if (!all.length) return null
  const x0 = Math.min(...all.map(p => p[0])), x1 = Math.max(...all.map(p => p[0])) || 1
  let y0 = yMin ?? Math.min(...all.map(p => p[1])), y1 = yMax ?? Math.max(...all.map(p => p[1]))
  if (y1 === y0) { y1 += 1; y0 -= 1 }
  const pad = (y1 - y0) * 0.08; if (yMin == null) y0 -= pad; if (yMax == null) y1 += pad
  const L = 14 + 11 * Math.max(...yt0(y0, y1).map(v => String(yFmt(v)).length))
  const X = v => L + (v - x0) / (x1 - x0 || 1) * (W - L - R), Y = v => T + (1 - (v - y0) / (y1 - y0)) * (H - T - B)
  const ticks = 4, yt = Array.from({ length: ticks + 1 }, (_, i) => y0 + (y1 - y0) * i / ticks)
  const xt = Array.from({ length: 5 }, (_, i) => x0 + (x1 - x0) * i / 4)
  const path = pts => { let d = '', pen = false; pts.forEach(([x, y], i) => { if (y == null) { pen = false; return } d += (pen ? 'L' : 'M') + X(x).toFixed(1) + ' ' + Y(y).toFixed(1); pen = true }); return d }
  return <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Graphique">
    {bands.map((b, i) => <rect key={i} x={X(b.a)} y={T} width={Math.max(0, X(b.b) - X(b.a))} height={H - T - B} fill={b.color} opacity=".12" />)}
    {yt.map((v, i) => <g key={i}><line className="grid" x1={L} x2={W - R} y1={Y(v)} y2={Y(v)} /><text x={L - 7} y={Y(v) + 6} textAnchor="end">{yFmt(v)}</text></g>)}
    {xt.map((v, i) => <text key={i} x={X(v)} y={H - 6} textAnchor={i === 0 ? 'start' : i === 4 ? 'end' : 'middle'}>{xFmt(v)}</text>)}
    {marks.map((m, i) => <line key={i} x1={X(m)} x2={X(m)} y1={T} y2={H - B} stroke="var(--ink-3)" strokeWidth=".6" strokeDasharray="2 3" />)}
    {series.map((s, i) => <path key={i} d={path(s.pts)} fill="none" stroke={s.color} strokeWidth={s.width || 2} strokeLinejoin="round" strokeLinecap="round" />)}
    {series.filter(s => s.dots).map((s, i) => s.pts.map(([x, y], k) => y != null && <circle key={i + '-' + k} cx={X(x)} cy={Y(y)} r="3.2" fill={s.color} />))}
  </svg>
}

/** Barres horizontales d'écart à l'objectif (secondes) */
export function DeltaBars({ rows }) {
  const max = Math.max(10, ...rows.map(r => Math.abs(r.d || 0)))
  return <div>
    {rows.map(r => <div key={r.label} style={{ display: 'grid', gridTemplateColumns: '108px 1fr 58px', alignItems: 'center', gap: 8, padding: '5px 0', fontSize: 14 }}>
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.label}</span>
      <span style={{ position: 'relative', height: 10, background: 'var(--fill)', borderRadius: 99 }}>
        <span style={{ position: 'absolute', left: '50%', top: -2, bottom: -2, width: 1, background: 'var(--ink-3)' }} />
        {r.d != null && <span style={{ position: 'absolute', top: 0, bottom: 0, borderRadius: 99, background: r.d > 0 ? 'var(--bad)' : 'var(--good)', left: r.d > 0 ? '50%' : `${50 - Math.abs(r.d) / max * 50}%`, width: `${Math.abs(r.d) / max * 50}%` }} />}
      </span>
      <span className={'num ' + (r.d == null ? 'faint' : r.d > 2 ? 'bad' : r.d < -2 ? 'good' : 'even')} style={{ textAlign: 'right' }}>{r.d == null ? '—' : (r.d > 0 ? '+' : r.d < 0 ? '−' : '') + fmt(Math.abs(r.d))}</span>
    </div>)}
  </div>
}

export function ZoneBar({ z }) {
  return <>
    <div className="zones">{z.map((v, i) => <i key={i} className={'z' + (i + 1)} style={{ width: (v * 100) + '%' }} />)}</div>
    <div className="legend">{z.map((v, i) => <span key={i}><span className={'z' + (i + 1)} style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 4, marginRight: 4 }} />Z{i + 1} {Math.round(v * 100)} %</span>)}</div>
  </>
}

export function Ring({ value, size = 170, color = 'var(--accent)' }) {
  const r = 70, c = 2 * Math.PI * r
  return <svg className="ring" viewBox="0 0 170 170" width={size} height={size} aria-hidden="true">
    <circle cx="85" cy="85" r={r} fill="none" stroke="var(--fill)" strokeWidth="16" />
    <circle cx="85" cy="85" r={r} fill="none" stroke={color} strokeWidth="16" strokeLinecap="round" strokeDasharray={`${c * Math.max(0.02, Math.min(1, value))} ${c}`} transform="rotate(-90 85 85)" />
  </svg>
}

/** Barres verticales (ex. heures de sommeil par nuit) avec ligne d'objectif */
export function Bars({ items, target, height = 150, fmtV = v => v, color = 'var(--accent)', low }) {
  const W = 640, H = height * 1.25, L = 8, R = 8, T = 14, B = 30
  const max = Math.max(target || 0, ...items.map(i => i.v || 0)) * 1.12 || 1
  const bw = (W - L - R) / Math.max(1, items.length), Y = v => T + (1 - v / max) * (H - T - B)
  return <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Graphique en barres">
    {target && <><line x1={L} x2={W - R} y1={Y(target)} y2={Y(target)} stroke="var(--ink-3)" strokeDasharray="5 5" /><text x={W - R} y={Y(target) - 5} textAnchor="end">objectif {fmtV(target)}</text></>}
    {items.map((it, i) => <g key={i}>
      {it.v != null && <rect x={L + i * bw + bw * 0.18} width={bw * 0.64} y={Y(it.v)} height={H - B - Y(it.v)} rx={Math.min(8, bw * 0.2)} fill={low && it.v < low ? 'var(--warn)' : color} opacity={it.v ? 0.9 : 0.25} />}
      {(items.length <= 14 || i % 2 === 0) && <text x={L + i * bw + bw / 2} y={H - 8} textAnchor="middle">{it.label}</text>}
    </g>)}
  </svg>
}
