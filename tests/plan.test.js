import test from 'node:test'
import assert from 'node:assert/strict'
import { createPlan, replan, progress, mondayOf, addDays, blocksFor } from '../src/lib/plan.js'
import { gapsOf, duoAdjust } from '../src/lib/gaps.js'
import { expand, newGroup, newBlock, achievement, stepLabel, isPlanned, fmtTarget } from '../src/lib/custom.js'
import { adaptBlocks, redFlags } from '../src/lib/pain.js'
import { playSteps, ROUTINE, suggestRoutine } from '../src/lib/stretch.js'
import { LIBRARY } from '../src/lib/library.js'
import { quickSession } from '../src/lib/activity.js'

const P = { sex: 'M', birth_year: 1990, weight_kg: 80 }
test('lacunes : atelier lent, course, force', () => {
  const stats = { st: { ski: 270, push: 200, pull: 270, burp: 300, row: 280, farm: 120, lunge: 270, wb: 480 }, pace: 420, sessions: 3 }
  const g = gapsOf(stats, { profile: P, e1rm: { squat: 70 } })
  assert.equal(g[0].id, 'wb'); assert.ok(g.some(x => x.kind === 'run')); assert.ok(g.some(x => x.kind === 'force'))
  const none = gapsOf({ st: {}, pace: null }, { profile: P }); assert.equal(none[none.length - 1].kind, 'test')
  const d = duoAdjust(g, [{ kind: 'station', st: 'push', label: 'Sled Push', why: 'lent' }, { kind: 'station', st: 'wb', label: 'Wall Balls', why: 'lent' }], { push: 0.62 }, { partner: 'Marine' })
  assert.deepEqual(d.both, ['wb']); assert.deepEqual(d.carry, ['push']); assert.ok(d.notes[0].includes('62 %'))
})
test('plan jusqu’à la course : phases, allègement, ciblage, retard', () => {
  const from = '2026-11-18', race = { id: 'r', name: 'Paris', race_date: '2027-03-14', format: 'duo' }
  const gaps = [{ kind: 'station', st: 'wb', label: 'Wall Balls', score: 0.3 }, { kind: 'run', id: 'run', label: 'Course', score: 0.2 }]
  const p = createPlan({ race, from, perWeek: 4, gaps, duo: { focus: ['push'], both: [], carry: ['push'], partner: 'Marine' }, pace: 320 })
  assert.equal(p.weeks[0].start, mondayOf(from)); assert.equal(p.weeks[p.weeks.length - 1].start, mondayOf(race.race_date))
  assert.equal(p.weeks[p.weeks.length - 1].phase.id, 'course'); assert.ok(p.weeks.some(w => w.deload))
  assert.ok(p.weeks.some(w => w.days.some(d => d.key === 'allure')), 'course faible → séance allure')
  assert.ok(p.weeks[0].focus.includes('wb')); assert.ok(p.weeks.some(w => w.days.some(d => d.duo && d.focus.includes('push'))))
  assert.ok(p.weeks.every(w => w.days.filter(d => d.key !== 'repos').length <= 4))
  // suivi : rien fait pendant 2 semaines → retard
  const later = addDays(from, 15), pr = progress(p, () => false, later)
  assert.equal(pr.status, 'behind')
  const q = replan(p, { race, from: later, perWeek: 4, gaps, level: -1 }, 'retard')
  assert.equal(q.weeks[0].start, p.weeks[0].start, 'historique conservé'); assert.equal(q.level, -1)
  const wk = q.weeks.find(w => w.start === mondayOf(later)), wk0 = p.weeks.find(w => w.start === mondayOf(later))
  assert.ok(wk.factor <= wk0.factor)
  const pr2 = progress(p, () => true, later, { ach: 1.1 }); assert.equal(pr2.status, 'ahead')
  assert.equal(progress(p, () => true, later, { raceChanged: true }).status, 'race')
  assert.equal(blocksFor('simu', {}), null); assert.ok(blocksFor('force', { e1rm: { squat: 100 }, phase: 'developpement' })[0].target.load === 80)
})
test('création : séries variables, EMOM, Tabata, AMRAP', () => {
  const st = expand([{ ...newBlock('bench'), sets: 2, setTargets: [{ reps: 10, load: 50 }, { reps: 6, load: 60 }] }, newGroup('emom'), newGroup('tabata'), newGroup('amrap'), newGroup('circuit')])
  assert.deepEqual(st.slice(0, 2).map(x => x.target.load), [50, 60])
  const em = st.filter(x => x.grp && x.grp.fmt === 'emom'); assert.equal(em.length, 10); assert.equal(em[1].window, 60); assert.ok(em[1].autoStart && !em[0].autoStart)
  const tb = st.filter(x => x.grp && x.grp.fmt === 'tabata'); assert.equal(tb.length, 8); assert.equal(tb[0].target.time, 20); assert.ok(tb[0].auto)
  const am = st.find(x => x.ex === 'amrap'); assert.equal(am.target.time, 720)
  assert.equal(achievement({ ...am, s: 0, e: 720000, done: { rounds: 6 } }), 6 / 5)
  assert.equal(achievement({ ...tb[0], s: 0, e: 20000, done: { reps: 8 } }), 1)
  assert.equal(st.filter(x => x.grp && x.grp.fmt === 'circuit').length, 12); assert.ok(stepLabel(em[2]).includes('min 3/10'))
  assert.ok(fmtTarget({ cal: 12, rir: 2 }).includes('12 cal'))
  LIBRARY.forEach(t => assert.ok(expand(t.blocks).length > 0, t.id))
})
test('activité hors plan et séance prévue', () => {
  const q = quickSession({ uid: 'u', ex: 'run', date: '2026-11-18', minutes: 40, km: 8, rpe: 6 })
  assert.equal(q.data.steps[0].e, 2400000); assert.equal(q.data.steps[0].done.meters, 8000); assert.ok(!isPlanned(q))
  assert.ok(isPlanned({ data: { format: 'custom', startedAt: null, steps: expand([newBlock('squat')]) } }))
})
test('douleurs et étirements', () => {
  const a = adaptBlocks([newBlock('squat'), newBlock('run'), newGroup('circuit')], ['genou'])
  assert.equal(a.blocks[0].ex, 'hipthrust'); assert.equal(a.blocks[1].ex, 'elliptical'); assert.ok(a.swaps.length >= 3)
  assert.equal(redFlags({ data: { level: 8, when: ['nuit'] } }).length, 2)
  assert.equal(playSteps(ROUTINE['apres-course'].items).length, 12)
  assert.equal(suggestRoutine({ data: { format: 'custom', blocks: [newBlock('bench')] } }).id, 'haut-corps')
})
test('bilan de niveau : complète les séances', async () => {
  const { withLevel } = await import('../src/lib/gaps.js')
  const W = withLevel({ st: { ski: 250 }, pace: null }, { squat: 90 }, { data: { st: { ski: 999, wb: 420 }, run: { k5: 1500 }, rm: { squat: { load: 80, reps: 5 }, deadlift: { load: 100, reps: 3 } } } })
  assert.equal(W.stats.st.ski, 250); assert.equal(W.stats.st.wb, 420); assert.equal(Math.round(W.stats.pace), 330)
  assert.equal(W.e1rm.squat, 93.33333333333333 > 90 ? 80 * (1 + 5 / 30) : 90); assert.equal(Math.round(W.e1rm.deadlift), 110)
})
test('semaine type, suggestions de course, lacunes comparées', async () => {
  const m = await import('../src/lib/plan.js')
  const T = [{ type: 'coach', act: 'spinning', intensity: 'modere', min: 45 }, { type: 'free' }, { type: 'renfo' }, { type: 'free' }, { type: 'free' }, { type: 'free' }, { type: 'rest' }]
  const p = m.createPlan({ race: { id: 'r', name: 'X', race_date: '2027-03-14', format: 'solo' }, from: '2026-11-20', perWeek: 4, gaps: [{ kind: 'test', label: 'Données insuffisantes' }], template: T })
  assert.deepEqual(p.gapsAt, [])
  p.weeks.slice(0, -1).forEach(w => { assert.equal(w.days[0].key, 'coach'); assert.equal(w.days[6].key, 'repos'); assert.ok(w.days.filter(d => d.key !== 'repos').length <= 4) })
  assert.ok(p.weeks[2].days[2].title.includes('renfo sans coach'))
  const R = m.runSuggestions({ week: p.weeks[0], doneOn: () => false, today: p.weeks[0].days[5].date, gaps: [] })
  assert.equal(R.list[0].title, 'Footing de reprise')
  const q = m.addToWeek(p, p.weeks[0].start, R.days[0].date, R.list[0]); assert.ok(q.weeks[0].days.find(d => d.date === R.days[0].date).added)
})
