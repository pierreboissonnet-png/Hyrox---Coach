// Graphique cardio agrandi et interactif (séance Hyrox ou perso)
import React, { useEffect, useRef, useState } from 'react'
import { Sheet } from '../ui.jsx'
import { fmt } from '../lib/hyrox.js'

/** Graphique cardio agrandi et interactif : on touche ou on glisse pour lire la minute, l'exercice et le cardio de chacun */
export function HRZoom({ ser, bands, labelAt, onClose, range }) {
  const box = useRef(null), [W, setW] = useState(340), [cur, setCur] = useState(null)
  const all = ser.flatMap(x => x.pts), X0 = Math.min(...all.map(p => p[0])), X1 = Math.max(...all.map(p => p[0]))
  const [win, setWin] = useState(range ? [Math.max(X0, range[0]), Math.min(X1, range[1])] : [X0, X1])
  useEffect(() => { const el = box.current; if (!el) return; const f = () => setW(Math.round(el.getBoundingClientRect().width)); f(); const ro = new ResizeObserver(f); ro.observe(el); return () => ro.disconnect() }, [])
  const H = Math.min(420, Math.max(260, Math.round(W * 0.62))), L = 34, R = 8, T = 10, B = 22
  const [a, b] = win, vis = all.filter(p => p[0] >= a && p[0] <= b && p[1] != null)
  const y0 = Math.floor((Math.min(...vis.map(p => p[1])) - 5) / 5) * 5, y1 = Math.ceil((Math.max(...vis.map(p => p[1])) + 5) / 5) * 5
  const X = v => L + (v - a) / (b - a || 1) * (W - L - R), Y = v => T + (1 - (v - y0) / (y1 - y0 || 1)) * (H - T - B)
  const at = (pts, t) => { let lo = 0, hi = pts.length - 1; if (hi < 0) return null; while (lo < hi) { const m = (lo + hi) >> 1; if (pts[m][0] < t) lo = m + 1; else hi = m } const c = [pts[lo], pts[lo - 1]].filter(Boolean).sort((p, q) => Math.abs(p[0] - t) - Math.abs(q[0] - t))[0]; return c && Math.abs(c[0] - t) <= 20 ? c : null }
  const pick = e => { const r = box.current.getBoundingClientRect(), x = Math.min(W - R, Math.max(L, e.clientX - r.left)); setCur(a + (x - L) / (W - L - R) * (b - a)) }
  const path = pts => { let d = '', pen = false, prev = null; pts.forEach(([x, y]) => { if (x < a || x > b || y == null) { pen = false; return } if (prev != null && x - prev > 30) pen = false; d += (pen ? 'L' : 'M') + X(x).toFixed(1) + ' ' + Y(y).toFixed(1); pen = true; prev = x }); return d }
  const yt = Array.from({ length: 5 }, (_, i) => Math.round(y0 + (y1 - y0) * i / 4)), xt = Array.from({ length: 5 }, (_, i) => a + (b - a) * i / 4)
  const zoomIn = () => { const c = cur ?? (a + b) / 2, h = (b - a) / 4; const na = Math.max(X0, c - h), nb = Math.min(X1, na + 2 * h); setWin([Math.max(X0, nb - 2 * h), nb]) }
  const shift = k => { const w = b - a, na = Math.min(X1 - w, Math.max(X0, a + k * w * 0.5)); setWin([na, na + w]) }
  const vals = cur == null ? [] : ser.map(x => ({ ...x, v: at(x.pts, cur) }))
  // Étiquette à côté de la ligne verticale (jamais sur les points touchés)
  const tipLeft = cur == null ? 0 : X(cur) > W / 2 ? Math.max(0, X(cur) - 182) : Math.min(W - 170, X(cur) + 12), tipTop = 6
  return <Sheet title="Cardio de la séance" onClose={onClose}>
    <p className="small muted" style={{ marginTop: 0 }}>Touchez ou glissez sur la courbe : minute exacte, exercice en cours et cardio de chacun.</p>
    <div ref={box} style={{ position: 'relative', touchAction: 'none', userSelect: 'none' }} onPointerDown={e => { e.currentTarget.setPointerCapture(e.pointerId); pick(e) }} onPointerMove={pick}>
      <svg className="chart" viewBox={`0 0 ${W} ${H}`} style={{ display: 'block' }}>
        {bands.filter(x => x.b > a && x.a < b).map((x, i) => <rect key={i} x={X(Math.max(a, x.a))} y={T} width={Math.max(0, X(Math.min(b, x.b)) - X(Math.max(a, x.a)))} height={H - T - B} fill={x.color} opacity=".14" />)}
        {yt.map((v, i) => <g key={i}><line className="grid" x1={L} x2={W - R} y1={Y(v)} y2={Y(v)} /><text x={L - 5} y={Y(v) + 4} textAnchor="end">{v}</text></g>)}
        {xt.map((v, i) => <text key={i} x={X(v)} y={H - 5} textAnchor={i === 0 ? 'start' : i === 4 ? 'end' : 'middle'}>{fmt(v)}</text>)}
        {ser.map((x, i) => <path key={i} d={path(x.pts)} fill="none" stroke={x.color} strokeWidth="1.8" strokeLinejoin="round" />)}
        {cur != null && <line x1={X(cur)} x2={X(cur)} y1={T} y2={H - B} stroke="var(--ink-2)" strokeWidth="1" strokeDasharray="3 3" />}
        {vals.map((x, i) => x.v && <circle key={i} cx={X(x.v[0])} cy={Y(x.v[1])} r="5" fill={x.color} stroke="var(--bg, #fff)" strokeWidth="2" />)}
      </svg>
      {cur != null && <div className="glass" style={{ position: 'absolute', top: tipTop, left: tipLeft, width: 170, padding: '8px 10px', borderRadius: 12, fontSize: 13, pointerEvents: 'none' }}>
        <div className="num" style={{ fontWeight: 700 }}>{fmt(cur)}</div>
        <div className="small" style={{ marginBottom: 4, lineHeight: 1.25 }}>{labelAt(cur)}</div>
        {vals.map((x, i) => <div key={i} className="row-gap" style={{ gap: 6 }}><span style={{ width: 9, height: 9, borderRadius: 5, background: x.color, display: 'inline-block' }} /><span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{x.name}</span><b className="num">{x.v ? x.v[1] + ' bpm' : '—'}</b></div>)}
      </div>}
    </div>
    <div className="row-gap" style={{ marginTop: 10, justifyContent: 'center' }}>
      <button className="btn glass small" disabled={a <= X0} onClick={() => shift(-1)} aria-label="Plus tôt">◀</button>
      <button className="btn glass small" onClick={zoomIn}>Zoom +</button>
      <button className="btn glass small" disabled={a <= X0 && b >= X1} onClick={() => setWin([X0, X1])}>Tout voir</button>
      <button className="btn glass small" disabled={b >= X1} onClick={() => shift(1)} aria-label="Plus tard">▶</button>
    </div>
    <div className="legend" style={{ justifyContent: 'center' }}>{ser.map((x, i) => <span key={i}><span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 5, background: x.color, marginRight: 4 }} />{x.name}</span>)}<span><span style={{ display: 'inline-block', width: 10, height: 10, background: '#5e5ce633', marginRight: 4 }} />Ateliers</span></div>
  </Sheet>
}

