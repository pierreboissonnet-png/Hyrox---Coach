import test from 'node:test'
import assert from 'node:assert/strict'
import { execSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
// La logique de la fonction serveur est en TypeScript : on la transpile pour la tester
const out = path.join(os.tmpdir(), 'hx-logic.mjs')
execSync(`npx esbuild supabase/functions/health-sync/logic.ts --format=esm --outfile=${out} --log-level=error`)
const L = await import(out)

test('dates', () => {
  assert.equal(L.parseDate('2026-11-19 18:01:02 +0100'), Date.parse('2026-11-19T17:01:02Z'))
  assert.equal(L.parseDate('2026-11-19T18:01:02+01:00'), Date.parse('2026-11-19T17:01:02Z'))
  assert.equal(L.parseDate(1794330694), 1794330694000)
})
test('Raccourci : FC + sommeil en français, doublons montre/iPhone', () => {
  const body = {
    heart_rate: { dates: '2026-11-19T18:00:00+01:00\n2026-11-19T18:00:05+01:00\n2026-11-19T18:00:10+01:00', values: '120\n125\n131' },
    sleep: { starts: ['2026-11-18T23:00:00+01:00', '2026-11-19T00:00:00+01:00', '2026-11-18T22:50:00+01:00'], ends: ['2026-11-19T03:00:00+01:00', '2026-11-19T06:30:00+01:00', '2026-11-19T06:40:00+01:00'], values: ['Essentiel', 'Profond', 'Au lit'] },
  }
  const r = L.extract(body)
  assert.equal(r.hr.length, 3); assert.equal(r.hr[2][1], 131)
  const n = L.nights(r.sleep, 60)
  assert.equal(n.length, 1); assert.equal(n[0].day, '2026-11-19'); assert.equal(n[0].data.asleep, 450); assert.equal(n[0].data.bed, '22:50'); assert.equal(n[0].data.wake, '06:40')
})
test('Health Auto Export', () => {
  const body = { data: { metrics: [
    { name: 'heart_rate', units: 'count/min', data: [{ date: '2026-11-19 18:00:00 +0100', Min: 110, Avg: 118, Max: 125 }] },
    { name: 'sleep_analysis', units: 'hr', data: [{ date: '2026-11-19 00:00:00 +0100', totalSleep: 7.25, deep: 1.1, rem: 1.5, core: 4.65, awake: 0.3, sleepStart: '2026-11-18 23:20:00 +0100', sleepEnd: '2026-11-19 06:55:00 +0100' }] },
  ] } }
  const r = L.extract(body)
  assert.equal(r.source, 'Health Auto Export'); assert.equal(r.hr[0][1], 118)
  const n = L.nightsFromAggregates(r.sleepNights, 60)
  assert.equal(n[0].day, '2026-11-19'); assert.equal(n[0].data.asleep, 435); assert.equal(n[0].data.bed, '23:20')
})
test('rattachement à une séance', () => {
  const st = Date.parse('2026-11-19T17:00:00Z')
  const hr = Array.from({ length: 50 }, (_, i) => [st + i * 5000 - 30000, 100 + i])
  const g = L.byDay(hr), d = Object.keys(g)[0]
  const m = L.mergeDay({ t: [0], bpm: [60] }, g[d])
  assert.equal(m.t[0], 0); assert.equal(m.t.length, 51)
  const s = L.sessionSeries([{ day: d, ...m }], st, st + 200000)
  assert.equal(s.t[0], -30); assert.ok(s.t.includes(0)); assert.equal(s.bpm[s.t.indexOf(0)], 106)
})
