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

test('autres données : mesures, poids, règles, entraînements', () => {
  const hae = { data: { metrics: [
    { name: 'weight_body_mass', units: 'kg', data: [{ date: '2026-11-18 07:10:00 +0100', qty: 79.4 }, { date: '2026-11-19 07:05:00 +0100', qty: 79.1 }] },
    { name: 'body_fat_percentage', units: '%', data: [{ date: '2026-11-19 07:05:00 +0100', qty: 0.17 }] },
    { name: 'resting_heart_rate', units: 'count/min', data: [{ date: '2026-11-19 00:00:00 +0100', qty: 52 }] },
    { name: 'heart_rate_variability', units: 'ms', data: [{ date: '2026-11-19 03:00:00 +0100', qty: 60 }, { date: '2026-11-19 05:00:00 +0100', qty: 70 }] },
    { name: 'step_count', units: 'count', data: [{ date: '2026-11-19 10:00:00 +0100', qty: 4000 }, { date: '2026-11-19 18:00:00 +0100', qty: 3500 }] },
    { name: 'active_energy', units: 'kJ', data: [{ date: '2026-11-19 18:00:00 +0100', qty: 2092 }] },
    { name: 'menstrual_flow', units: '', data: [{ date: '2026-11-02', value: 'Medium' }, { date: '2026-11-03', value: 'Light' }, { date: '2026-11-04', value: 'None' }, { date: '2026-11-30', value: 'Heavy' }] },
  ], workouts: [{ name: 'Outdoor Run', start: '2026-11-19 18:00:00 +0100', end: '2026-11-19 18:42:00 +0100', distance: { qty: 8.1, units: 'km' }, activeEnergyBurned: { qty: 520, units: 'kcal' } }] } }
  const M = L.extractMetrics(hae), V = L.vitalsByDay(M, 60)
  assert.equal(V['2026-11-19'].weight, 79.1); assert.equal(V['2026-11-19'].fat, 17); assert.equal(V['2026-11-19'].rhr, 52)
  assert.equal(V['2026-11-19'].hrv, 65); assert.equal(V['2026-11-19'].steps, 7500); assert.equal(V['2026-11-19'].kcal, 500)
  assert.deepEqual(L.periods(M, 60), [{ start: '2026-11-02', end: '2026-11-03' }, { start: '2026-11-30', end: '2026-11-30' }])
  const W = L.extractWorkouts(hae); assert.equal(W.length, 1); assert.equal(W[0].km, 8.1); assert.equal(L.activityOf(W[0].name), 'run')
  assert.equal(L.activityOf('Functional Strength Training'), 'strength'); assert.equal(L.activityOf('Cycling'), 'bike')
  // Raccourci
  const sc = { metrics: { weight: { dates: ['2026-11-19T07:00:00+01:00'], values: ['80,2'] }, rhr: { dates: '2026-11-19T00:00:00+01:00', values: '55' } }, workouts: { names: ['Natation'], starts: ['2026-11-19T12:00:00+01:00'], ends: ['2026-11-19T12:40:00+01:00'], distances: ['1,5'] } }
  const V2 = L.vitalsByDay(L.extractMetrics(sc), 60); assert.equal(V2['2026-11-19'].weight, 80.2); assert.equal(V2['2026-11-19'].rhr, 55)
  assert.equal(L.activityOf(L.extractWorkouts(sc)[0].name), 'swim')
})

test('raccourci « Hyrox Mesures » : clés courtes et valeurs avec unités', () => {
  const body = { rhr: { dates: '2026-11-19T07:00:00+01:00', values: '54 bpm' }, kcal: { dates: '2026-11-19T12:00:00+01:00\n2026-11-19T18:00:00+01:00', values: '300 kcal\n250 kcal' },
    vo2: { dates: ['2026-11-10T10:00:00+01:00'], values: ['44,5'] }, steps: { dates: ['2026-11-19T10:00:00+01:00'], values: ['4 000'] }, flow: { dates: ['2026-11-18', '2026-11-19'], values: ['Moyen', 'Léger'] } }
  const M = L.extractMetrics(body), V = L.vitalsByDay(M, 60)
  assert.equal(V['2026-11-19'].rhr, 54); assert.equal(V['2026-11-19'].kcal, 550); assert.equal(V['2026-11-19'].steps, 4000); assert.equal(V['2026-11-10'].vo2, 44.5)
  assert.equal(L.periods(M, 60).length, 1)
})

test('dates au format français (Raccourcis sans « Formater la date »)', () => {
  L.setLocalTz(60)
  assert.equal(new Date(L.parseDate('19 nov. 2026 à 07:05')).toISOString(), '2026-11-19T06:05:00.000Z')
  assert.equal(new Date(L.parseDate('19 novembre 2026 à 07:05:12')).toISOString(), '2026-11-19T06:05:12.000Z')
  assert.equal(new Date(L.parseDate('19/11/2026 07:05')).toISOString(), '2026-11-19T06:05:00.000Z')
  assert.equal(new Date(L.parseDate('2 févr. 2027 à 23:10')).toISOString(), '2027-02-02T22:10:00.000Z')
  const e = L.extract({ sleep: { starts: '18 nov. 2026 à 23:30\n19 nov. 2026 à 01:00', ends: '19 nov. 2026 à 01:00\n19 nov. 2026 à 07:00', values: 'Essentiel\nProfond' } })
  assert.equal(e.sleep.length, 2)
})

test('raccourci simplifié : champs à plat', () => {
  L.setLocalTz(60)
  const e = L.extract({ token: 'x', starts: '18 nov. 2026 à 23:30', ends: '19 nov. 2026 à 07:00', values: 'Essentiel' })
  assert.equal(e.sleep.length, 1); assert.equal(e.hr.length, 0)
  const h = L.extract({ token: 'x', dates: '19 nov. 2026 à 18:00\n19 nov. 2026 à 18:01', values: '120\n135' }); assert.equal(h.hr.length, 2)
  const V = L.vitalsByDay(L.extractMetrics({ token: 'x', rhr_dates: '19 nov. 2026 à 07:00', rhr_values: '53', weight_dates: '19/11/2026 07:10', weight_values: '79,6 kg' }), 60)
  assert.equal(V['2026-11-19'].rhr, 53); assert.equal(V['2026-11-19'].weight, 79.6)
})
