import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { SEGS, N, defaultPlan, fmt, parseT } from '../src/lib/hyrox.js'
import { emptyData, actions, split, stStats, nextIdx } from '../src/lib/session.js'
import { summary, athleteStats, insights } from '../src/lib/analyze.js'
import { predictDuo, estimatePartner } from '../src/lib/predict.js'
import { buildProgram, phaseFor, wellNorm } from '../src/lib/program.js'
import { targets } from '../src/lib/nutrition.js'
import { cycleInfo, flag, MARKERS } from '../src/lib/health.js'
import { convert, athletesIn, detect } from '../src/lib/importers.js'
import { parseCSV } from '../src/lib/hr.js'

test('31 segments, formats', () => {
  assert.equal(N, 31); assert.equal(fmt(3725), '1:02:05'); assert.equal(parseT('5:30'), 330); assert.ok(Number.isNaN(parseT('a:1')))
})
test('pointage duo complet', () => {
  const plan = defaultPlan(); let d = actions.start(emptyData(1), 0), t = 0
  while (nextIdx(d) >= 0) {
    const g = SEGS[nextIdx(d)]; t += 20000
    if (g.type === 'rox' && g.dir === 'in') d = actions.roxStart(d, t, 'A', plan)
    else if (g.type === 'st') { d = actions.swapRelay(d, t, 'B', plan); t += 20000; d = actions.exitStation(d, t) }
    else d = actions.endSegment(d, t)
  }
  assert.equal(d.cp[N - 1], t)
  const i = SEGS.findIndex(g => g.id === 'ski'), x = stStats(d, i)
  assert.equal(x.work.A, 20); assert.equal(x.work.B, 20); assert.equal(x.trans, 0)
  const s = { id: 'x', team_id: 't', athletes: { A: 'u1', B: 'u2' }, session_date: '2026-11-10', data: d }
  const sum = summary(s, plan); assert.ok(sum.complete); assert.equal(sum.all.n, 31)
  const st = athleteStats('u1', [s], { t: plan }); assert.ok(st.pace > 0)
  assert.ok(Array.isArray(insights(sum)))
})
test('prédiction : moyenne harmonique et estimation', () => {
  const A = { st: { ski: 200 }, pace: 300, rox: 25 }, B = { st: { ski: 300 }, pace: 330, rox: 30 }
  const p = predictDuo(A, B, defaultPlan())
  assert.equal(Math.round(p.share.ski * 100), 60)
  assert.ok(p.seg.ski === 240 + 28); assert.equal(p.seg.r1, 330)
  const e = estimatePartner(B, { sex: 'M', birth_year: 1985, weight_kg: 80 }, { sex: 'F', birth_year: 1990, weight_kg: 60 })
  assert.ok(e.st.ski > 300 && e.estimated)
})
test('programme, nutrition, santé', () => {
  assert.equal(phaseFor(1).id, 'course'); assert.equal(phaseFor(30).id, 'fondation')
  // Forme 0–5 : une seule mauvaise journée n'adapte qu'aujourd'hui et demain (lundi = 0 → seuil du lundi remplacé)
  const E = (day, d) => ({ day, data: { ...d, v: 2 } })
  const base = buildProgram({ weeks: 10, perWeek: 4 })
  const p1 = buildProgram({ weeks: 10, perWeek: 4, well: [E('2026-11-16', { fatigue: 5, sleep: 3, soreness: 1 })], todayISO: '2026-11-16', today: 0 })
  assert.ok(!p1.light); assert.equal(p1.days[0].key, 'z2'); assert.equal(base.days[0].key, 'seuil'); assert.equal(p1.days[3].key, base.days[3].key)
  const p2 = buildProgram({ weeks: 10, perWeek: 4, well: [E('2026-11-16', { fatigue: 3, sleep: 3, soreness: 1 })], todayISO: '2026-11-16', today: 0 })
  assert.equal(p2.days[0].key, 'seuil'); assert.ok(p2.days[0].min < base.days[0].min)
  // Semaine allégée seulement sur la moyenne de 5 jours (≥ 3 saisies)
  const bad = ['2026-11-12', '2026-11-13', '2026-11-14', '2026-11-15', '2026-11-16'].map(d => E(d, { fatigue: 4, sleep: 2, soreness: 3 }))
  const p = buildProgram({ weeks: 5, weak: ['wb'], well: bad, todayISO: '2026-11-16', today: 0, perWeek: 4 })
  assert.equal(p.days.length, 7); assert.ok(p.light); assert.ok(!p.days.some(d => d.key === 'seuil'))
  // Anciennes saisies 1–5 converties : fatigue 5 → 5, sommeil 1 → 0
  assert.deepEqual(wellNorm({ data: { fatigue: 5, sleep: 1, soreness: 3, mood: 3 } }), { fatigue: 5, sleep: 0, soreness: 2.5, mood: 2.5, v: 2 })
  const t = targets({ sex: 'M', weight_kg: 80, height_cm: 180, birth_year: 1986 }); assert.equal(t.prot, 144)
  const c = cycleInfo(['2026-09-01', '2026-09-29', '2026-10-27'], new Date('2026-11-05T12:00'))
  assert.equal(c.len, 28); assert.equal(c.day, 10)
  assert.equal(flag(MARKERS.find(m => m.id === 'crp'), 'M', 8), 'haut')
})
test('CSV FC', () => {
  const r = parseCSV('Date;FC (bpm)\n10/11/2026 18:00:00;120\n10/11/2026 18:00:05;125')
  assert.equal(r.length, 2); assert.equal(r[1][1], 125)
})
test('import sauvegarde Chrono Hyrox Duo', { skip: !fs.existsSync('/mnt/user-data/outputs/sauvegarde-hyrox-duo-2026-11-19.json') }, () => {
  const j = JSON.parse(fs.readFileSync('/mnt/user-data/outputs/sauvegarde-hyrox-duo-2026-11-19.json', 'utf8'))
  assert.equal(detect(j), 'chrono'); assert.deepEqual(athletesIn(j), ['L', 'P'])
  const r = convert(j, { P: 'A', L: 'B' })
  assert.equal(r.sessions.length, 2)
  const s = r.sessions.find(x => x.session_date === '2026-11-10')
  assert.ok(s.hr.A && s.hr.B); assert.equal(s.data.runs.r6.A, 0.3)
  assert.ok(Object.values(s.data.relays).flat().every(x => x.w === 'A' || x.w === 'B'))
  assert.ok(r.strat.burp.t.every(x => x.w === 'A' || x.w === 'B'))
})
test('sommeil', async () => {
  const { durationMin, sleepStats, sleepAdvice, nightsFrom } = await import('../src/lib/sleep.js')
  assert.equal(durationMin('23:30', '07:00'), 450)
  const E = [0, 1, 2, 3, 4].map(i => ({ day: `2026-11-${18 - i}`, data: { asleep: 360 + i * 10, bed: i % 2 ? '23:00' : '00:30', quality: 2 } }))
  const st = sleepStats(E, { today: new Date('2026-11-19T08:00') })
  assert.equal(st.n, 5); assert.ok(st.debt > 400); assert.ok(sleepAdvice(st).some(a => a.tone === 'bad'))
  const t = Date.parse('2026-11-18T23:00:00')
  const n = nightsFrom([{ a: t, b: t + 3 * 36e5, v: 'HKCategoryValueSleepAnalysisAsleepCore' }, { a: t + 36e5, b: t + 7 * 36e5, v: 'HKCategoryValueSleepAnalysisAsleepUnspecified' }])
  assert.equal(n.length, 1); assert.equal(n[0].data.asleep, 420)
})
test('alimentation : apports et recommandations', async () => {
  const { intakes, recommend, gaps } = await import('../src/lib/diet.js')
  const p = { sex: 'F', weight_kg: 62, height_cm: 168, birth_year: 1990 }
  const vegan = { type: 'vegetalien', q: { feculents: 3, legumes: 2, fruits: 2, legumineuses: 4, soja: 1, oleagineux: 1, mg_ajoutees: 2 }, s: {} }
  const I = intakes(vegan); assert.ok(I.p > 40 && I.p < 90); assert.equal(I.b12 < 1, true)
  const R = recommend(vegan, p)
  assert.ok(R.some(r => /B12/.test(r.text) && r.type === 'complément'))
  assert.ok(R.some(r => /algue/.test(r.why)))
  const junk = { type: 'omnivore', q: { feculents: 2, boissons_sucrees: 2, sucres: 3, charcuterie: 5 }, s: {} }
  const R2 = recommend(junk, { sex: 'M', weight_kg: 80 })
  assert.ok(R2.filter(r => r.type === 'remplacer').length >= 3)
  assert.equal(gaps(junk, { sex: 'M', weight_kg: 80 }).length, 11)
})
test('cycle : phases, adaptation, pondération', async () => {
  const { phaseOn, cycles, phaseEffects, adjustTime } = await import('../src/lib/health.js')
  const { adaptToCycle, buildProgram } = await import('../src/lib/program.js')
  const E = [{ day: '2026-10-01', data: { end: '2026-10-05' } }, { day: '2026-10-29', data: { end: '2026-11-02', symptoms: 'crampes' } }]
  assert.equal(cycles(E)[0].len, 28); assert.equal(cycles(E)[0].period, 5)
  assert.equal(phaseOn(E, '2026-10-03').phase, 'menstruelle')
  assert.equal(phaseOn(E, '2026-10-10').phase, 'folliculaire')
  assert.equal(phaseOn(E, '2026-10-14').phase, 'ovulatoire')
  assert.equal(phaseOn(E, '2026-10-20').phase, 'luteale')
  assert.equal(phaseOn(E, '2026-10-26').phase, 'premenstruelle')
  assert.equal(phaseOn(E, '2026-11-30').day, 5)   // projection sur le cycle suivant
  const p = buildProgram({ weeks: 6, perWeek: 4, cycleDays: Array(7).fill({ phase: 'premenstruelle', day: 25 }) })
  assert.ok(!p.days.some(d => ['seuil', 'compromis', 'simu'].includes(d.key)))
  const ef = phaseEffects([{ phase: 'menstruelle', rel: 0.06 }, { phase: 'menstruelle', rel: 0.05 }, { phase: 'folliculaire', rel: 0.0 }, { phase: 'folliculaire', rel: 0.01 }])
  assert.ok(ef.menstruelle.effect > ef.folliculaire.effect)
  assert.ok(adjustTime(5000, 'menstruelle', ef) < 5000)
})
test('séance spécialisée : réalisé, progression, équivalents Hyrox, charge', async () => {
  const C = await import('../src/lib/custom.js'), Ld = await import('../src/lib/load.js')
  const blocks = [{ ex: 'ski', sets: 2, rest: 60, w: 'A', target: { meters: 250, time: 55 } }, { ex: 'squat', sets: 1, rest: 0, w: 'A', target: { reps: 6, load: 80 } }, { ex: 'plank', sets: 1, rest: 0, w: 'A', target: { time: 60 } }]
  const d = C.emptyCustom(blocks); assert.equal(d.steps.length, 4)
  d.startedAt = 0
  d.steps[0].s = 0; d.steps[0].e = 50000; d.steps[0].done = { meters: 250 }
  d.steps[1].s = 110000; d.steps[1].e = 170000; d.steps[1].done = { meters: 250 }
  d.steps[2].s = 200000; d.steps[2].e = 230000; d.steps[2].done = { reps: 6, load: 80, rpe: 7 }
  d.steps[3].s = 240000; d.steps[3].e = 300000; d.steps[3].done = { time: 70 }
  const s = { id: 'x', session_date: '2026-11-19', athletes: { A: 'u', B: null }, data: d }
  assert.ok(C.achievement(d.steps[0]) > 1); assert.ok(C.achievement(d.steps[1]) < 1); assert.ok(C.achievement(d.steps[3]) > 1)
  const sum = C.customSummary(s); assert.equal(sum.done, 4); assert.equal(sum.total, 300)
  const pr = C.progression(s); const sq = pr.find(p => p.ex === 'squat')
  assert.equal(sq.next.load, 85); assert.ok(sq.e1rm > 90)
  const eq = C.stationEquivalents(s, 'u'); assert.equal(eq.length, 2); assert.equal(Math.round(eq[0].full), 200)
  const { athleteStats } = await import('../src/lib/analyze.js')
  const st = athleteStats('u', [s], {}); assert.ok(st.st.ski > 200 && st.st.ski < 240)
  assert.ok(C.kcalFromHR(150, 60, { sex: 'M', weight_kg: 80, birth_year: 1986 }) > 600)
  assert.equal(Ld.dayTypeFromKcal(800, 60), 'intense')
  const tl = Ld.trainingLoad([s], 'u', new Date('2026-11-20T10:00')); assert.ok(tl.acute > 0)
})
test('coach intégré (gratuit)', async () => {
  const { localCoach } = await import('../src/lib/coachLocal.js')
  const C = await import('../src/lib/custom.js'), { defaultPlan } = await import('../src/lib/hyrox.js'), S = await import('../src/lib/session.js')
  const plan = defaultPlan(); let d = S.actions.start(S.emptyData(1), 0), t = 0
  const { SEGS } = await import('../src/lib/hyrox.js')
  while (S.nextIdx(d) >= 0) { const g = SEGS[S.nextIdx(d)]; t += g.type === 'st' ? 300000 : 20000; if (g.type === 'rox' && g.dir === 'in') d = S.actions.roxStart(d, t, 'A', plan); else if (g.type === 'st') { d = S.actions.swapRelay(d, t, 'B', plan); t += 20000; d = S.actions.exitStation(d, t) } else d = S.actions.endSegment(d, t) }
  const txt = localCoach({ id: 'x', athletes: { A: 'a', B: 'b' }, data: d }, plan, w => w)
  assert.match(txt, /En bref/); assert.match(txt, /À travailler/); assert.match(txt, /Prochaine séance/); assert.match(txt, /relais/i)
  const cd = C.emptyCustom([{ ex: 'squat', sets: 1, rest: 0, w: 'A', target: { reps: 6, load: 80 } }]); cd.startedAt = 0; cd.steps[0].s = 0; cd.steps[0].e = 30000; cd.steps[0].done = { reps: 6, load: 80 }
  assert.match(localCoach({ athletes: { A: 'a' }, data: cd }, null, w => w), /Squat/)
})
