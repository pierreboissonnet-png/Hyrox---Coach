// Pictogramme d'une posture d'étirement (silhouette filaire)
import React from 'react'
import { POSES } from '../lib/poses.js'

export function Pose({ id, size = 120, color = 'var(--accent)' }) {
  const P = POSES[id]; if (!P) return null
  const L = (a, b, k) => <line key={k} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} />
  const limb = (from, x, k) => x ? [L(from, x[0], k + '1'), L(x[0], x[1], k + '2')] : null
  const torso = P.c ? <path d={`M${P.n[0]} ${P.n[1]} Q${P.c[0]} ${P.c[1]} ${P.p[0]} ${P.p[1]}`} fill="none" /> : L(P.n, P.p, 't')
  return <svg viewBox="0 0 100 80" width={size} height={size * 0.8} role="img" aria-label="Illustration de la posture" style={{ display: 'block' }}>
    <g stroke="var(--ink-3)" strokeWidth="1.2" fill="none" opacity=".7">
      <line x1="2" y1="77" x2="98" y2="77" />
      {P.wall != null && <line x1={P.wall} y1="4" x2={P.wall} y2="77" strokeWidth="2" />}
      {P.door != null && <><line x1={P.door + 2} y1="4" x2={P.door + 2} y2="77" strokeWidth="2" /><line x1={P.door + 2} y1="4" x2="98" y2="4" strokeWidth="2" /></>}
      {P.box && <rect x={P.box[0]} y={P.box[1]} width={P.box[2]} height={P.box[3]} rx="1.5" />}
      {P.roller && <circle cx={P.roller[0]} cy={P.roller[1]} r="5" fill="var(--fill)" />}
      {P.spin && <path d={`M${P.spin[0] - 7} ${P.spin[1]} a7 4 0 1 0 7 -4`} markerEnd="" strokeDasharray="2 2" />}
    </g>
    {P.strap && <line x1={P.strap[0][0]} y1={P.strap[0][1]} x2={P.strap[1][0]} y2={P.strap[1][1]} stroke="#ff9f0a" strokeWidth="1.6" strokeDasharray="2 1.5" />}
    <g stroke={color} strokeWidth="3.6" strokeLinecap="round" strokeLinejoin="round" fill="none">
      {limb(P.p, P.m, 'm')}{limb(P.n, P.b, 'b')}
      {torso}{L(P.n, [P.n[0] + (P.h[0] - P.n[0]) * 0.35, P.n[1] + (P.h[1] - P.n[1]) * 0.35], 'cou')}
      {limb(P.p, P.l, 'l')}{limb(P.n, P.a, 'a')}
    </g>
    <circle cx={P.h[0]} cy={P.h[1]} r="5.4" fill={color} />
  </svg>
}
