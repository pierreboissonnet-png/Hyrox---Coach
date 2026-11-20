import test from 'node:test'
import assert from 'node:assert/strict'
import { pastData, split } from '../src/lib/session.js'
import { SEGS } from '../src/lib/hyrox.js'
import { fillStats, soloTime, expectedCurve, valueAt, dayNum } from '../src/lib/trend.js'
import { sessionRPE } from '../src/lib/load.js'

test('Hyrox saisi après coup : points de passage, Roxzone déduite du total, ressenti', () => {
  const times = {}; SEGS.forEach(g => { if (g.type === 'run') times[g.id] = 300; else if (g.type === 'st') times[g.id] = 240 })
  const d = pastData({ times, total: 8 * 300 + 8 * 240 + 450, date: '2026-11-15', start: '09:30', rpe: 9 })
  assert.equal(d.cp.length, SEGS.length); assert.equal(d.cp[d.cp.length - 1], (8 * 300 + 8 * 240 + 450) * 1000)
  assert.equal(split(d, 0), 300); assert.equal(split(d, 1), 30)   // 450 s / 15 transitions
  assert.equal(new Date(d.startedAt).getHours(), 9); assert.equal(d.rpe, 9)
  assert.ok(pastData({ times, total: 3000, date: '2026-11-15' }).error)
  assert.equal(sessionRPE({ data: d }), 9)
})

test('courbe de progression : estimation solo et trajectoire attendue', () => {
  assert.equal(fillStats({ pace: 300, st: { ski: 270 } }), null)   // trop peu d'ateliers
  const t = soloTime({ pace: 300, st: { ski: 270, push: 200, row: 280 }, rox: 20 })   // ateliers connus = repères → reste aux repères
  assert.equal(t, 8 * 300 + 270 + 200 + 270 + 300 + 280 + 120 + 270 + 330 + 15 * 20)
  const E = expectedCurve('2026-11-01', 6000, '2027-02-01', 5000)
  assert.equal(E[0][1], 6000); assert.equal(E[E.length - 1][1], 5000)
  const mid = valueAt(E, dayNum('2026-12-17'))
  assert.ok(mid < 5500, 'progrès plus rapides au début')
})
