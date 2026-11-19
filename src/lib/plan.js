// Plan d'entraînement jusqu'à la course : semaines figées (phases, progression, semaines allégées),
// séances ciblées sur les lacunes (les miennes et celles du coéquipier), suivi des séances validées,
// recalcul en cas de retard ou d'avance. Repères généraux de préparation, pas un avis médical.
import { STATION, STATIONS, fmt } from './hyrox.js'
import { phaseFor, DRILLS } from './program.js'
import { stationGaps } from './gaps.js'

const pad = n => String(n).padStart(2, '0')
export const isoOf = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
export const addDays = (iso, n) => { const d = new Date(iso + 'T12:00:00'); d.setDate(d.getDate() + n); return isoOf(d) }
export const mondayOf = iso => { const d = new Date(iso + 'T12:00:00'); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return isoOf(d) }
export const DAYS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche']
const SLOTS = { 3: [0, 2, 5], 4: [0, 1, 3, 5], 5: [0, 1, 3, 4, 5], 6: [0, 1, 2, 3, 4, 5] }
const TEMPLATES = {
  fondation: ['z2', 'force', 'ateliers', 'z2', 'seuil', 'z2'],
  developpement: ['seuil', 'force', 'ateliers', 'z2', 'compromis', 'z2'],
  specifique: ['compromis', 'force', 'seuil', 'z2', 'simu', 'ateliers'],
  affutage: ['seuil', 'ateliers', 'z2', 'simu', 'z2', 'repos'],
  course: ['z2', 'rappel', 'repos', 'z2', 'repos', 'repos'],
  entretien: ['z2', 'force', 'ateliers', 'seuil', 'z2', 'z2'],
}
export const INTENSE = ['seuil', 'compromis', 'simu', 'rappel', 'allure']
const ZONE = { z2: 'Z2', seuil: 'Z4', allure: 'Z4', force: 'Z3', ateliers: 'Z3–Z4', compromis: 'Z4', simu: 'Z4', rappel: 'Z4', repos: '—' }
const BASE_MIN = { z2: 45, seuil: 50, allure: 50, force: 60, ateliers: 55, compromis: 55, simu: 75, rappel: 35, repos: 20 }

// --------------------------------------------------------------- blocs prêts à lancer
const r5 = v => Math.round(v / 5) * 5, r25 = v => Math.round(v / 2.5) * 2.5
const sc = (n, f) => Math.max(2, Math.round(n * f))
const DRILL = {
  ski: f => ({ ex: 'ski', sets: sc(6, f), rest: 60, target: { meters: 250 }, note: 'allure course, poussée des hanches' }),
  push: f => ({ ex: 'push', sets: sc(6, f), rest: 90, target: { meters: 12.5 }, note: 'lourd, gainage, petits pas rapides' }),
  pull: f => ({ ex: 'pull', sets: sc(5, f), rest: 90, target: { meters: 12.5 }, note: 'pieds calés, bras-jambes' }),
  burp: f => ({ ex: 'burp', sets: sc(5, f), rest: 60, target: { meters: 10 }, note: 'rythme régulier, atterrissage pieds à plat' }),
  row: f => ({ ex: 'row', sets: sc(4, f), rest: 90, target: { meters: 500 }, note: 'cadence 26–30' }),
  farm: f => ({ ex: 'farm', sets: sc(4, f), rest: 90, target: { meters: 100 }, note: 'lourd, épaules basses' }),
  lunge: f => ({ ex: 'lunge', sets: sc(4, f), rest: 90, target: { meters: 20 }, note: 'genou arrière qui frôle le sol' }),
  wb: f => ({ ex: 'wb', sets: sc(5, f), rest: 60, target: { reps: 20 }, note: 'sans pause, respiration en haut' }),
}
const blk = (o) => ({ name: '', w: 'A', note: '', ...o })
const quarter = st => STATION[st].u === ' reps' ? { reps: 25 } : { meters: Math.round(STATION[st].tot / 4) }

/** Séance de force : charges calculées sur les 1RM estimés quand ils existent */
export function forceBlocks(rm = {}, phase, f = 1, avoid = []) {
  const pct = phase === 'affutage' || phase === 'course' ? 0.7 : phase === 'specifique' ? 0.75 : 0.8
  const reps = pct >= 0.8 ? 5 : 6, sets = phase === 'affutage' || phase === 'course' ? 3 : sc(4, f)
  const load = k => rm[k] ? r25(rm[k] * pct) : null
  const L = [
    blk({ ex: 'squat', sets, rest: 150, target: { reps, ...(load('squat') ? { load: load('squat') } : {}), rir: 2 } }),
    blk({ ex: 'deadlift', sets: Math.max(2, sets - 1), rest: 150, target: { reps, ...(load('deadlift') ? { load: load('deadlift') } : {}), rir: 2 } }),
    blk({ ex: 'bentrow', sets: 3, rest: 90, target: { reps: 8, ...(load('bentrow') ? { load: r25(rm.bentrow * 0.72) } : {}) } }),
    blk({ ex: 'lunges', sets: 3, rest: 90, target: { reps: 10 }, note: 'par jambe' }),
    { type: 'group', fmt: 'superset', rounds: 3, rest: 60, restItem: 0, minutes: 10, work: 40, target: {}, w: 'A', items: [{ ex: 'plank', name: '', target: { time: 45 }, note: '' }, { ex: 'pallof', name: '', target: { reps: 10 }, note: 'par côté' }] },
  ]
  return L.filter(b => !avoid.includes(b.ex))
}
/**
 * Blocs d'une journée (null pour la simulation, qui se fait au format Hyrox, et pour le repos)
 * ctx : {focus:[st], e1rm, phase, factor, pace (s/km), min}
 */
export function blocksFor(key, ctx = {}) {
  const f = ctx.factor || 1, pace = ctx.pace || 330, focus = (ctx.focus && ctx.focus.length ? ctx.focus : ['wb', 'lunge']).filter(st => STATION[st])
  switch (key) {
    case 'z2': return [blk({ ex: 'run', sets: 1, rest: 0, target: { time: (ctx.min || 45) * 60 }, note: 'zone 2 : vous pouvez parler en phrases complètes (vélo ou rameur possibles)' })]
    case 'seuil': return ctx.phase === 'fondation' || ctx.phase === 'entretien'
      ? [blk({ ex: 'run', sets: 1, rest: 60, target: { time: 600 }, note: 'échauffement' }), blk({ ex: 'run', sets: 3, rest: 120, target: { time: 480 }, note: 'au seuil (Z4), allure tenue 3 fois' })]
      : [blk({ ex: 'run', sets: 1, rest: 60, target: { time: 600 }, note: 'échauffement' }), blk({ ex: 'run', sets: sc(5, f), rest: 90, target: { meters: 1000, time: Math.round(pace) }, note: 'allure course Hyrox' })]
    case 'allure': return [blk({ ex: 'run', sets: 1, rest: 60, target: { time: 600 }, note: 'échauffement' }), blk({ ex: 'run', sets: 3, rest: 120, target: { meters: 2000, time: Math.round(pace * 2) }, note: 'allure course : objectif de régularité' })]
    case 'force': return forceBlocks(ctx.e1rm, ctx.phase, f)
    case 'ateliers': return focus.slice(0, 3).map(st => blk(DRILL[st](f)))
    case 'compromis': {
      const a = focus[0], b = focus[1] || (a === 'wb' ? 'ski' : 'wb')
      return [{ type: 'group', fmt: 'circuit', rounds: f < 0.9 ? 1 : 2, rest: 120, restItem: 0, minutes: 10, work: 40, target: {}, w: 'A',
        items: [{ ex: 'run', name: '', target: { meters: 1000, time: Math.round(pace) }, note: 'allure course' }, { ex: a, name: '', target: quarter(a), note: '' }, { ex: 'run', name: '', target: { meters: 1000, time: Math.round(pace) }, note: '' }, { ex: b, name: '', target: quarter(b), note: '' }] }]
    }
    case 'rappel': return [blk({ ex: 'run', sets: 3, rest: 90, target: { meters: 500, time: Math.round(pace / 2) }, note: 'allure course, rien de nouveau' }), ...focus.slice(0, 2).map(st => blk({ ex: st, sets: 1, rest: 90, target: quarter(st) }))]
    default: return null
  }
}

function describe(key, ctx) {
  const pace = ctx.pace ? fmt(ctx.pace) + '/km' : 'allure course'
  const fl = (ctx.focus || []).filter(st => STATION[st]).map(st => STATION[st].label)
  const duo = ctx.duo ? ` Avec ${ctx.partner || 'votre partenaire'}, en relais comme le jour J.` : ''
  switch (key) {
    case 'z2': return ['Endurance fondamentale', 'Course, vélo ou rameur facile, on peut parler. Fin : 4 lignes droites.']
    case 'seuil': return ['Course au seuil', ctx.phase === 'fondation' || ctx.phase === 'entretien' ? '3 × 8 min au seuil, récup 2 min.' : `${sc(5, ctx.factor || 1)} × 1 km à ${pace}, récup 1 min 30.`]
    case 'allure': return ['Allure course', `3 × 2 km à ${pace}, récup 2 min : la course est votre point à travailler.`]
    case 'force': return ['Force spécifique', 'Squat, soulevé de terre, rowing, fentes, gainage' + (ctx.e1rm && (ctx.e1rm.squat || ctx.e1rm.deadlift) ? ' (charges calculées sur vos 1RM estimés).' : ' ; 4 × 5–6, 2 répétitions en réserve.')]
    case 'ateliers': return ['Ateliers ' + (fl.length ? fl.slice(0, 3).join(' + ') : 'techniques'), (fl.length ? (ctx.focus || []).slice(0, 3).map(st => DRILLS[st]).join(' · ') : 'Rotation sur les 8 ateliers, technique propre, 3 tours.') + duo]
    case 'compromis': return [ctx.duo ? 'Compromised running en duo' : 'Compromised running', `${ctx.factor < 0.9 ? 2 : 4} × (1 km à ${pace} + 1 atelier : ${fl.slice(0, 2).join(', ') || 'Wall Balls, SkiErg'}).` + duo]
    case 'simu': return [ctx.duo ? 'Simulation duo' : 'Simulation', (ctx.phase === 'affutage' ? 'Demi-simulation (4 courses + 4 ateliers) à allure course.' : 'Simulation complète ou 3/4, pointage dans l’app.') + duo]
    case 'rappel': return ['Rappel d’intensité', '3 × 500 m allure course + 2 ateliers courts. Rien de nouveau.']
    default: return ['Repos ou mobilité', 'Marche, étirements, rouleau. Sommeil 8 h.']
  }
}

/**
 * Génère les semaines du plan à partir de la semaine de `from` jusqu'à la semaine de course (8 semaines sans course).
 * o : {race, from (ISO), perWeek, gaps, duo: {focus, partner, notes}, e1rm, pace, level (−1 retard / 0 / +1 avance), pains (zones)}
 */
export function generateWeeks(o) {
  const start = mondayOf(o.from), perWeek = Math.min(6, Math.max(3, o.perWeek || 4))
  const raceMon = o.race ? mondayOf(o.race.race_date) : null
  const W = raceMon ? Math.max(1, Math.round((new Date(raceMon) - new Date(start)) / (7 * 864e5)) + 1) : 8
  const myFocus = stationGaps(o.gaps || []), duo = o.duo && o.race && o.race.format === 'duo' ? o.duo : null
  let pool = [...new Set([...(duo ? duo.both || [] : []), ...myFocus, ...(duo ? duo.carry || [] : [])])]
  if (pool.length < 2) pool = [...new Set([...pool, ...STATIONS.map(x => x.id)])]
  const runGap = (o.gaps || []).slice(0, 4).some(g => g.kind === 'run'), engineGap = (o.gaps || []).slice(0, 4).some(g => g.kind === 'engine')
  const weeks = []
  let lastPhase = null, k = 0
  for (let w = 0; w < W; w++) {
    const ws = addDays(start, 7 * w)
    const left = o.race ? Math.ceil((new Date(o.race.race_date + 'T12:00:00') - new Date(ws + 'T12:00:00')) / (7 * 864e5)) : null
    const ph = phaseFor(o.race ? Math.max(0, left) : null)
    if (ph.id !== lastPhase) { k = 0; lastPhase = ph.id } else k++
    const build = ['fondation', 'developpement', 'specifique', 'entretien'].includes(ph.id)
    const deload = build && k % 4 === 3
    let factor = ph.id === 'affutage' ? 0.7 : ph.id === 'course' ? 0.5 : Math.min(1.15, 0.9 + 0.05 * (k % 4) + 0.02 * Math.floor(k / 4))
    if (deload) factor = 0.75
    factor = Math.max(0.5, Math.round((factor + 0.07 * (o.level || 0) * (build ? 1 : 0.4)) * 100) / 100)
    let keys = TEMPLATES[ph.id].slice(0, perWeek)
    if (runGap && (ph.id === 'developpement' || ph.id === 'specifique')) { const z = keys.lastIndexOf('z2'); if (z >= 0) keys[z] = 'allure' }
    if (deload) keys = keys.map(x => x === 'simu' ? 'ateliers' : x)
    const focus = [0, 1, 2].map(j => pool[(w * 2 + j) % pool.length]).filter((v, i, a) => a.indexOf(v) === i)
    const duoKey = duo ? ['simu', 'compromis', 'ateliers'].find(x => keys.includes(x)) : null
    const slots = SLOTS[perWeek]
    const days = DAYS.map((label, i) => {
      const j = slots.indexOf(i), key = j >= 0 ? keys[j] : 'repos', date = addDays(ws, i)
      const isDuo = !!duoKey && key === duoKey
      const ctx = { focus: isDuo ? [...new Set([...(duo.focus || []), ...focus])] : focus, e1rm: o.e1rm, phase: ph.id, factor, pace: o.pace, duo: isDuo, partner: duo && duo.partner }
      let min = r5(BASE_MIN[key] * (key === 'repos' ? 1 : factor) + (engineGap && key === 'z2' ? 10 : 0))
      ctx.min = min
      const [title, detail] = describe(key, ctx)
      return { date, day: label, key, title, detail, zone: ZONE[key], min, focus: ctx.focus.slice(0, 3), duo: isDuo, blocks: blocksFor(key, ctx) }
    })
    weeks.push({ start: ws, phase: { id: ph.id, label: ph.label, note: ph.note }, factor, deload, focus, days })
  }
  return weeks
}

/** Nouveau plan complet */
export function createPlan(o) {
  return { v: 1, created: o.from, raceId: o.race ? o.race.id : null, raceDate: o.race ? o.race.race_date : null, raceName: o.race ? o.race.name : null, format: o.race ? o.race.format : 'solo',
    perWeek: o.perWeek, level: 0, gapsAt: (o.gaps || []).slice(0, 4).map(g => g.label), weeks: generateWeeks(o), log: [{ date: o.from, text: 'Plan créé' + (o.race ? ' jusqu’à ' + o.race.name : '') + '.' }] }
}
/** Recalcule à partir de la semaine en cours en gardant l'historique des semaines passées */
export function replan(prev, o, why) {
  const mon = mondayOf(o.from), level = o.level != null ? o.level : prev.level || 0
  const past = (prev.weeks || []).filter(w => w.start < mon)
  // la semaine en cours garde ses jours passés tels quels
  const fresh = generateWeeks({ ...o, level })
  const cur = (prev.weeks || []).find(w => w.start === mon)
  if (cur && fresh[0]) fresh[0] = { ...fresh[0], days: fresh[0].days.map((d, i) => d.date < o.from ? cur.days[i] || d : d) }
  return { ...prev, raceId: o.race ? o.race.id : null, raceDate: o.race ? o.race.race_date : null, raceName: o.race ? o.race.name : null, format: o.race ? o.race.format : 'solo',
    perWeek: o.perWeek, level, gapsAt: (o.gaps || []).slice(0, 4).map(g => g.label), weeks: [...past, ...fresh], log: [...(prev.log || []), { date: o.from, text: why }].slice(-20) }
}

/**
 * Suivi : doneOn(dateISO) → true si une séance a été faite ce jour-là (ou cochée).
 * Renvoie l'assiduité, les séances manquées récentes et l'état (retard / avance / dans les temps).
 */
export function progress(plan, doneOn, today, o = {}) {
  const days = (plan.weeks || []).flatMap(w => w.days.map(d => ({ ...d, week: w.start })))
  const work = days.filter(d => d.key !== 'repos')
  // on ne compte que les jours depuis la création du plan (pas de « retard » sur des jours antérieurs)
  const past = work.filter(d => d.date < today && d.date >= (plan.created || '0')), recent = past.filter(d => d.date >= addDays(today, -14))
  const done = past.filter(d => doneOn(d.date)), rDone = recent.filter(d => doneOn(d.date))
  const missedKey = recent.filter(d => !doneOn(d.date) && INTENSE.includes(d.key))
  const total = work.length, doneAll = work.filter(d => d.date <= today && doneOn(d.date)).length
  const adh = past.length ? done.length / past.length : null, adh14 = recent.length ? rDone.length / recent.length : null
  let status = 'ok', why = ''
  if (recent.length >= 3 && adh14 < 0.6) { status = 'behind'; why = `${recent.length - rDone.length} séance(s) manquée(s) sur les 2 dernières semaines (${Math.round(adh14 * 100)} % réalisées)` }
  else if (recent.length >= 3 && adh14 >= 0.9 && ((o.ach != null && o.ach >= 1.02) || (o.extras || 0) >= 2)) { status = 'ahead'; why = `${Math.round(adh14 * 100)} % des séances faites${o.ach != null && o.ach >= 1.02 ? ', objectifs dépassés (' + Math.round(o.ach * 100) + ' %)' : ''}${(o.extras || 0) >= 2 ? `, ${o.extras} séances en plus` : ''}` }
  if (o.raceChanged) { status = 'race'; why = 'la course visée a changé (date ou objectif principal)' }
  return { total, doneAll, past: past.length, done: done.length, adh, adh14, missedKey, status, why }
}
/** Pourcentage réalisé d'une semaine (séances passées ou du jour) */
export function weekDone(week, doneOn, today) {
  const w = week.days.filter(d => d.key !== 'repos'); const p = w.filter(d => d.date <= today)
  return { n: w.length, done: w.filter(d => doneOn(d.date)).length, due: p.length }
}
