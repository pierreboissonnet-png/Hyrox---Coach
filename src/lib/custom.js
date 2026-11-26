// Séances spécialisées : blocs d'exercices (ateliers Hyrox, course, musculation…) avec objectifs
// en temps, mètres, répétitions, charge ; réalisé ; liens avec cardio, prédictions, programme et nutrition.
import { STATION, fmt, parseT } from './hyrox.js'

// cat : 'hyrox' (atelier), 'run', 'cardio', 'force' (barre), 'halt' (haltères / kettlebell), 'machine', 'pdc' (poids du corps),
//       'core' (gainage), 'mob' (mobilité), 'sport' (activités hors plan), 'libre'
// m : mesures utiles (les seules affichées par défaut) ; st : atelier Hyrox équivalent (prédictions)
// met : dépense (MET) ; z : zones sollicitées (douleurs) ; uni : exercice unilatéral (objectif par côté)
const X = (id, label, cat, m, o = {}) => ({ id, label, cat, m, ...o })
export const EXERCISES = [
  X('run', 'Course', 'run', ['meters', 'time'], { z: ['genou', 'cheville', 'mollet', 'hanche', 'ischio'] }),
  X('ski', 'SkiErg', 'hyrox', ['meters', 'time', 'cal'], { st: 'ski', z: ['epaule', 'dos'] }),
  X('push', 'Sled Push', 'hyrox', ['meters', 'load', 'time'], { st: 'push', z: ['genou', 'mollet', 'epaule'] }),
  X('pull', 'Sled Pull', 'hyrox', ['meters', 'load', 'time'], { st: 'pull', z: ['dos', 'epaule', 'coude'] }),
  X('burp', 'Burpees Broad Jump', 'hyrox', ['meters', 'time'], { st: 'burp', z: ['genou', 'poignet', 'epaule', 'cheville'] }),
  X('row', 'Rameur', 'hyrox', ['meters', 'time', 'cal'], { st: 'row', z: ['dos', 'genou'] }),
  X('farm', 'Farmers Carry', 'hyrox', ['meters', 'load', 'time'], { st: 'farm', z: ['poignet', 'dos', 'epaule'] }),
  X('lunge', 'Fentes sandbag', 'hyrox', ['meters', 'load', 'time'], { st: 'lunge', z: ['genou', 'hanche'] }),
  X('wb', 'Wall Balls', 'hyrox', ['reps', 'load', 'time'], { st: 'wb', z: ['genou', 'epaule', 'poignet'] }),
  X('bike', 'Vélo', 'cardio', ['time', 'meters'], { z: ['genou'] }),
  X('airbike', 'Air bike / Assault bike', 'cardio', ['cal', 'time'], { met: 11, z: ['genou'] }),
  X('elliptical', 'Elliptique', 'cardio', ['time'], { met: 7 }),
  X('swim', 'Natation', 'cardio', ['meters', 'time'], { met: 8, z: ['epaule'] }),
  X('stairs', 'Stepper / escaliers', 'cardio', ['time'], { met: 9, z: ['genou'] }),
  X('walk', 'Marche rapide', 'cardio', ['meters', 'time'], { met: 4.5 }),
  X('rope', 'Corde à sauter', 'cardio', ['time', 'reps'], { met: 11, z: ['mollet', 'cheville'] }),
  X('squat', 'Squat', 'force', ['reps', 'load'], { z: ['genou', 'hanche', 'dos'] }),
  X('frontsquat', 'Front squat', 'force', ['reps', 'load'], { z: ['genou', 'poignet', 'dos'] }),
  X('deadlift', 'Soulevé de terre', 'force', ['reps', 'load'], { z: ['dos', 'ischio', 'hanche'] }),
  X('rdl', 'Soulevé de terre jambes tendues', 'force', ['reps', 'load'], { z: ['dos', 'ischio'] }),
  X('bench', 'Développé couché', 'force', ['reps', 'load'], { z: ['epaule', 'coude', 'poignet'] }),
  X('ohp', 'Développé militaire', 'force', ['reps', 'load'], { z: ['epaule', 'dos', 'coude'] }),
  X('bentrow', 'Rowing barre', 'force', ['reps', 'load'], { z: ['dos', 'coude'] }),
  X('hipthrust', 'Hip thrust', 'force', ['reps', 'load'], { z: ['hanche'] }),
  X('thruster', 'Thruster', 'force', ['reps', 'load'], { z: ['epaule', 'genou', 'poignet'] }),
  X('clean', 'Épaulé (power clean)', 'force', ['reps', 'load'], { z: ['poignet', 'dos', 'genou'] }),
  X('dbpress', 'Développé haltères', 'halt', ['reps', 'load'], { z: ['epaule', 'coude'] }),
  X('dbrow', 'Rowing haltère', 'halt', ['reps', 'load'], { uni: true, z: ['dos', 'coude'] }),
  X('lunges', 'Fentes haltères', 'halt', ['reps', 'load'], { uni: true, z: ['genou', 'hanche'] }),
  X('bulgarian', 'Fentes bulgares', 'halt', ['reps', 'load'], { uni: true, z: ['genou', 'hanche'] }),
  X('goblet', 'Goblet squat', 'halt', ['reps', 'load'], { z: ['genou', 'hanche'] }),
  X('stepup', 'Step-up', 'halt', ['reps', 'load'], { uni: true, z: ['genou'] }),
  X('kbswing', 'Kettlebell swing', 'halt', ['reps', 'load'], { z: ['dos', 'ischio'] }),
  X('dbsnatch', 'Arraché haltère', 'halt', ['reps', 'load'], { uni: true, z: ['epaule', 'dos'] }),
  X('sbclean', 'Sandbag clean', 'halt', ['reps', 'load'], { z: ['dos', 'poignet'] }),
  X('curl', 'Curl biceps', 'halt', ['reps', 'load'], { z: ['coude'] }),
  X('triceps', 'Extension triceps', 'halt', ['reps', 'load'], { z: ['coude'] }),
  X('lateral', 'Élévations latérales', 'halt', ['reps', 'load'], { z: ['epaule'] }),
  X('legpress', 'Presse à cuisses', 'machine', ['reps', 'load'], { met: 4.5, z: ['genou'] }),
  X('latpull', 'Tirage vertical', 'machine', ['reps', 'load'], { met: 4.5, z: ['epaule', 'coude'] }),
  X('seatedrow', 'Tirage horizontal', 'machine', ['reps', 'load'], { met: 4.5, z: ['dos'] }),
  X('legcurl', 'Leg curl', 'machine', ['reps', 'load'], { met: 4, z: ['ischio'] }),
  X('legext', 'Leg extension', 'machine', ['reps', 'load'], { met: 4, z: ['genou'] }),
  X('chestpress', 'Chest press', 'machine', ['reps', 'load'], { met: 4, z: ['epaule'] }),
  X('calf', 'Mollets (machine ou marche)', 'machine', ['reps', 'load'], { met: 4, z: ['mollet', 'cheville'] }),
  X('pullup', 'Tractions', 'pdc', ['reps'], { z: ['epaule', 'coude'] }),
  X('pushup', 'Pompes', 'pdc', ['reps'], { z: ['poignet', 'epaule'] }),
  X('burpee', 'Burpees', 'pdc', ['reps', 'time'], { met: 9, z: ['poignet', 'genou', 'epaule'] }),
  X('boxjump', 'Box jumps', 'pdc', ['reps'], { z: ['genou', 'cheville', 'mollet'] }),
  X('dips', 'Dips', 'pdc', ['reps'], { z: ['epaule', 'coude'] }),
  X('airsquat', 'Squat poids du corps', 'pdc', ['reps'], { z: ['genou'] }),
  X('jumplunge', 'Fentes sautées', 'pdc', ['reps'], { uni: true, z: ['genou', 'cheville'] }),
  X('mountain', 'Mountain climbers', 'pdc', ['reps', 'time'], { z: ['poignet', 'epaule'] }),
  X('invrow', 'Rowing inversé', 'pdc', ['reps'], { z: ['coude'] }),
  X('t2b', 'Toes to bar', 'pdc', ['reps'], { z: ['epaule', 'dos'] }),
  X('plank', 'Gainage', 'core', ['time'], { met: 4, z: ['epaule'] }),
  X('sideplank', 'Gainage latéral', 'core', ['time'], { met: 4, uni: true, z: ['epaule'] }),
  X('hollow', 'Hollow hold', 'core', ['time'], { met: 4, z: ['dos'] }),
  X('deadbug', 'Dead bug', 'core', ['reps'], { met: 3.5 }),
  X('russian', 'Russian twist', 'core', ['reps', 'load'], { met: 4, z: ['dos'] }),
  X('abwheel', 'Roue abdominale', 'core', ['reps'], { met: 4, z: ['dos', 'epaule'] }),
  X('legraise', 'Relevés de jambes', 'core', ['reps'], { met: 4, z: ['dos'] }),
  X('pallof', 'Pallof press', 'core', ['reps', 'load'], { met: 3.5, uni: true }),
  X('mobility', 'Mobilité / étirements', 'mob', ['time'], { met: 2.5 }),
  X('foam', 'Rouleau de massage', 'mob', ['time'], { met: 2 }),
  X('yoga', 'Yoga', 'mob', ['time'], { met: 3 }),
  X('strength', 'Renforcement (séance libre)', 'sport', ['time'], { met: 5 }),
  X('hike', 'Randonnée', 'sport', ['meters', 'time'], { met: 6, z: ['genou', 'cheville'] }),
  X('teamsport', 'Sport collectif', 'sport', ['time'], { met: 8, z: ['genou', 'cheville'] }),
  X('racket', 'Sport de raquette', 'sport', ['time'], { met: 7.5, z: ['epaule', 'coude', 'genou'] }),
  X('climbing', 'Escalade', 'sport', ['time'], { met: 8, z: ['epaule', 'coude', 'poignet'] }),
  X('combat', 'Sport de combat', 'sport', ['time'], { met: 10 }),
  X('winter', 'Ski / sports d’hiver', 'sport', ['time'], { met: 7, z: ['genou'] }),
  X('other', 'Autre activité', 'sport', ['time'], { met: 6 }),
  X('free', 'Exercice libre', 'libre', ['time', 'reps']),
  X('amrap', 'AMRAP', 'fmt', ['rounds', 'reps']),
]
export const EX = Object.fromEntries(EXERCISES.map(e => [e.id, e]))
export const CATS = [['hyrox', 'Ateliers Hyrox'], ['run', 'Course'], ['cardio', 'Cardio'], ['force', 'Musculation (barre)'], ['halt', 'Haltères, kettlebell, sandbag'], ['machine', 'Machines'], ['pdc', 'Poids du corps'], ['core', 'Gainage et abdos'], ['mob', 'Mobilité'], ['sport', 'Activités'], ['libre', 'Libre']]
export const STRENGTH = ['force', 'halt', 'machine']
export const METRICS = { time: ['Temps', 'mm:ss'], meters: ['Distance', 'm'], reps: ['Répétitions', 'reps'], load: ['Charge', 'kg'], cal: ['Calories', 'kcal'], rounds: ['Tours', 'tours'], res: ['Résistance', 'niveau'] }
const MET_CAT = { hyrox: 10, run: 10, cardio: 8, force: 5, halt: 5.5, machine: 4.5, pdc: 7, core: 4, mob: 2.5, sport: 7, libre: 6, fmt: 9 }
export const metOf = ex => { const e = EX[ex] || {}; return e.met || MET_CAT[e.cat] || 6 }
/** Formats de bloc : circuit, superset, EMOM, AMRAP, Tabata, intervalles */
export const FORMATS = {
  circuit: { label: 'Circuit', hint: 'Les exercices s’enchaînent, récupération après chaque tour.' },
  superset: { label: 'Superset', hint: '2 exercices sans pause, récupération après la paire.' },
  emom: { label: 'EMOM', hint: 'Chaque minute, un exercice ; le reste de la minute sert de récupération.' },
  amrap: { label: 'AMRAP', hint: 'Un maximum de tours en un temps donné.' },
  tabata: { label: 'Tabata', hint: '8 × (20 s d’effort, 10 s de récup), enchaînés automatiquement.' },
  interval: { label: 'Intervalles', hint: 'Travail / récupération chronométrés, enchaînés automatiquement.' },
}
export const newGroup = (fmt = 'circuit') => ({ type: 'group', fmt, rounds: fmt === 'tabata' ? 8 : fmt === 'superset' ? 3 : 4, minutes: fmt === 'amrap' ? 12 : 10,
  work: fmt === 'tabata' ? 20 : 40, rest: fmt === 'tabata' ? 10 : fmt === 'interval' ? 20 : 90, restItem: 0, target: fmt === 'amrap' ? { rounds: 5 } : {},
  items: fmt === 'superset' ? [itemOf('bench'), itemOf('bentrow')] : fmt === 'tabata' ? [itemOf('burpee', { reps: 8 })] : [itemOf('ski'), itemOf('wb'), itemOf('burpee')] })
const itemOf = (ex, target) => ({ ex, name: '', target: target || defaultTarget(ex, true), note: '' })
export const isGroup = b => !!(b && b.type === 'group')

export const isCustom = s => !!(s && s.data && s.data.format === 'custom')
export const exLabel = b => (b.ex === 'free' && b.name) ? b.name : (EX[b.ex] || {}).label || b.name || 'Exercice'

/** Bloc : {ex, name, sets, rest, w ('A'|'B'|'AB'), target:{time, meters, reps, load, cal, rir}, setTargets?:[{reps, load…}], tempo, note}
 *  ou groupe : {type:'group', fmt, rounds, minutes, work, rest, restItem, target, items:[{ex, name, target, note}], w} */
export const newBlock = (ex = 'ski') => ({ ex, name: '', sets: STRENGTH.includes((EX[ex] || {}).cat) ? 3 : 1, rest: STRENGTH.includes((EX[ex] || {}).cat) ? 90 : 60, w: 'A', target: defaultTarget(ex), note: '' })
export function defaultTarget(ex, inGroup) {
  const st = STATION[ex]
  if (ex === 'run') return inGroup ? { meters: 400 } : { meters: 1000, time: 300 }
  if (st) return st.u === ' reps' ? { reps: inGroup ? 15 : 25 } : { meters: Math.round(st.tot / (inGroup ? 8 : 4)) }
  const e = EX[ex] || {}
  if (STRENGTH.includes(e.cat)) return { reps: inGroup ? 10 : 8, load: e.cat === 'force' ? 40 : 16 }
  if (e.cat === 'pdc') return e.m[0] === 'time' ? { time: 60 } : { reps: inGroup ? 10 : 15 }
  if (e.cat === 'core') return e.m[0] === 'time' ? { time: 45 } : { reps: 12 }
  if (e.m && e.m[0] === 'cal') return { cal: inGroup ? 12 : 20 }
  if (e.cat === 'cardio') return { time: inGroup ? 60 : 300 }
  if (e.cat === 'mob') return { time: 600 }
  if (e.cat === 'sport') return { time: 3600 }
  return { time: 120 }
}

/** Développe les blocs en étapes à chronométrer (séries, tours, minutes…) */
export function expand(blocks) {
  const out = []
  const step = (o) => ({ s: null, e: null, done: null, rest: 0, w: 'A', note: '', name: '', ...o })
  blocks.forEach((b, gi) => {
    if (!isGroup(b)) {
      const n = Math.max(1, +b.sets || 1)
      for (let k = 0; k < n; k++) out.push(step({ g: gi, set: k + 1, of: n, ex: b.ex, name: b.name, rest: +b.rest || 0, w: b.w || 'A', target: { ...b.target, ...((b.setTargets && b.setTargets[k]) || {}) }, tempo: b.tempo || '', note: b.note || '' }))
      return
    }
    const items = (b.items || []).filter(i => i && i.ex), L = items.length, w = b.w || 'A', grp = { fmt: b.fmt, gi, label: (FORMATS[b.fmt] || {}).label || 'Bloc' }
    if (!L) return
    const it = (j, extra) => ({ g: gi + ':' + j, ex: items[j].ex, name: items[j].name, w, target: { ...items[j].target }, note: items[j].note || '', grp, ...extra })
    if (b.fmt === 'amrap') {
      const lbl = items.map(i => [i.target && i.target.reps ? i.target.reps : i.target && i.target.meters ? i.target.meters + ' m' : i.target && i.target.cal ? i.target.cal + ' cal' : '', exLabel(i)].filter(Boolean).join(' ')).join(' + ')
      out.push(step({ g: String(gi), set: 1, of: 1, ex: 'amrap', name: `AMRAP ${+b.minutes || 12} min : ${lbl}`, w, target: { time: (+b.minutes || 12) * 60, ...(b.target && b.target.rounds ? { rounds: +b.target.rounds } : {}) }, hold: true, auto: true, grp, items }))
    } else if (b.fmt === 'emom') {
      const n = Math.max(1, +b.minutes || 10)
      for (let m = 0; m < n; m++) out.push(step(it(m % L, { set: m + 1, of: n, window: 60, autoStart: m > 0 })))
    } else if (b.fmt === 'tabata' || b.fmt === 'interval') {
      const n = Math.max(1, +b.rounds || 8), work = +b.work || 20
      for (let r = 0; r < n; r++) { const x = it(r % L, { set: r + 1, of: n, rest: +b.rest || 0, hold: true, auto: true, autoStart: r > 0 }); x.target = { ...x.target, time: work }; out.push(step(x)) }
    } else {   // circuit / superset
      const n = Math.max(1, +b.rounds || 1)
      for (let r = 0; r < n; r++) items.forEach((_, j) => out.push(step(it(j, { set: r + 1, of: n, rest: j < L - 1 ? (+b.restItem || 0) : (+b.rest || 0) }))))
    }
  })
  return out
}
export function emptyCustom(blocks, title) { return { format: 'custom', title: title || '', startedAt: null, steps: expand(blocks), blocks, note: '' } }

/** Valeurs réalisées d'une étape (le temps vient du chrono si non saisi) */
export function doneOf(st) {
  const d = st.done || {}
  const time = d.time != null && d.time !== '' ? +d.time : (st.s != null && st.e != null ? (st.e - st.s) / 1000 : null)
  const n = k => d[k] != null && d[k] !== '' ? +d[k] : null
  return { time, meters: n('meters'), reps: n('reps'), load: n('load'), cal: n('cal'), rounds: n('rounds'), rpe: d.rpe != null ? +d.rpe : null }
}
/** Taux de réalisation de l'objectif (1 = atteint) ; pour le temps, plus court = mieux quand une distance/reps est visée */
export function achievement(st) {
  const t = st.target || {}, d = doneOf(st), parts = []
  if (t.meters && d.meters != null) parts.push(d.meters / t.meters)
  if (t.reps && d.reps != null) parts.push(d.reps / t.reps)
  if (t.load && d.load != null) parts.push(d.load / t.load)
  if (t.cal && d.cal != null) parts.push(d.cal / t.cal)
  if (t.rounds && d.rounds != null) parts.push(d.rounds / t.rounds)
  // temps : plus court = mieux quand une quantité est visée ; sinon durée à tenir. Ignoré pour les efforts à durée imposée (Tabata, AMRAP…)
  if (t.time && d.time != null && !(st.hold && parts.length) && !(st.hold && st.auto)) parts.push((t.meters || t.reps || t.cal) && !st.hold ? t.time / d.time : d.time / t.time)
  return parts.length ? Math.min(2, parts.reduce((a, b) => a + b, 0) / parts.length) : null   // plafonné à 200 %
}
export const e1rm = (load, reps) => load && reps ? load * (1 + Math.min(reps, 12) / 30) : null   // formule d'Epley
export function paceOf(st) {
  const d = doneOf(st); if (!d.time) return null
  if (d.meters && (st.ex === 'run')) return { v: d.time / (d.meters / 1000), u: '/km' }
  if (d.meters && ['ski', 'row', 'bike'].includes(st.ex)) return { v: d.time / (d.meters / 500), u: '/500 m' }
  if (d.reps) return { v: d.reps / (d.time / 60), u: 'reps/min', rate: true }
  return null
}

/** Résumé d'une séance spécialisée */
export function customSummary(s) {
  const d = s.data || {}, steps = d.steps || []
  const done = steps.filter(x => x.e != null || (x.done && Object.values(x.done).some(v => v != null && v !== '')))
  const work = steps.reduce((a, x) => a + (doneOf(x).time || 0), 0)
  const total = d.startedAt != null && steps.some(x => x.e != null) ? (Math.max(...steps.map(x => x.e || 0)) - 0) / 1000 : work
  const ach = done.map(achievement).filter(v => v != null)
  return { steps, done: done.length, n: steps.length, work, total, rest: Math.max(0, total - work), achievement: ach.length ? ach.reduce((a, b) => a + b, 0) / ach.length : null, complete: done.length === steps.length && steps.length > 0 }
}
/** Fin (ms depuis le départ) : pour rattacher le cardio */
export const customEnd = d => Math.max(0, ...((d.steps || []).map(x => x.e || x.s || 0)))

/**
 * Équivalents « atelier Hyrox complet » tirés des étapes chronométrées (pour les prédictions).
 * Exemple : 250 m de SkiErg en 58 s → 1000 m ≈ 232 s ; pondération 0,7 car effort frais, hors enchaînement.
 */
export function stationEquivalents(s, uid) {
  if (!isCustom(s)) return []
  const out = [], slot = s.athletes && s.athletes.A === uid ? 'A' : s.athletes && s.athletes.B === uid ? 'B' : null
  if (!slot) return out
  ;(s.data.steps || []).forEach(x => {
    if (x.w !== slot && x.w !== 'AB') return
    const e = EX[x.ex], d = doneOf(x); if (!e || !d.time) return
    if (e.st) { const st = STATION[e.st], amt = st.u === ' reps' ? d.reps : d.meters; if (amt) out.push({ st: e.st, full: d.time * st.tot / amt, frac: Math.min(1, amt / st.tot), w: 0.7 }) }
    else if (x.ex === 'run' && d.meters >= 400) out.push({ run: true, pace: d.time / (d.meters / 1000), km: d.meters / 1000, w: 0.7 })
  })
  return out
}

/** Dépense énergétique d'après la FC (formule de Keytel 2005), kcal */
export function kcalFromHR(avgHR, minutes, p) {
  if (!avgHR || !minutes) return null
  const a = p && p.birth_year ? new Date().getFullYear() - p.birth_year : 35, w = +(p && p.weight_kg) || 70
  const k = p && p.sex === 'F' ? (-20.4022 + 0.4472 * avgHR - 0.1263 * w + 0.074 * a) : (-55.0969 + 0.6309 * avgHR + 0.1988 * w + 0.2017 * a)
  return Math.max(0, Math.round(k / 4.184 * minutes))
}
/** Estimation sans cardio, par MET moyen selon le type d'exercice */
export function kcalFromMET(steps, p) {
  const w = +(p && p.weight_kg) || 70
  return Math.round(steps.reduce((a, x) => { const d = doneOf(x); return a + (d.time ? metOf(x.ex) * w * d.time / 3600 : 0) }, 0))
}

/**
 * Objectifs proposés pour la prochaine fois (progression) à partir du réalisé et, si disponible, de la FC.
 * hrBy : {indexÉtape: {avg, max}} ; zones : seuils FC du profil
 */
export function progression(s, hrBy = {}, zones = null) {
  const steps = (s.data && s.data.steps) || [], groups = {}
  steps.forEach((x, i) => { (groups[x.g] = groups[x.g] || []).push({ x, i }) })
  return Object.values(groups).map(L => {
    const b = L[0].x, t = b.target || {}, done = L.map(({ x }) => doneOf(x)), ach = L.map(({ x }) => achievement(x)).filter(v => v != null)
    if (!ach.length) return null
    const a = ach.reduce((p, q) => p + q, 0) / ach.length
    const hrs = L.map(({ i }) => hrBy[i]).filter(Boolean), hmax = hrs.length ? Math.max(...hrs.map(h => h.max)) : null
    const veryHard = zones && hmax != null && hmax >= zones[4] + 8, easy = zones && hmax != null && hmax < zones[3]
    const rpe = done.map(d => d.rpe).filter(v => v != null), rpeAvg = rpe.length ? rpe.reduce((p, q) => p + q, 0) / rpe.length : null
    let next = { ...t }, why
    const hard = veryHard || (rpeAvg != null && rpeAvg >= 9)
    const hold = !!b.hold
    if (a >= 1.0 && !hard) {
      if (t.load) { next.load = Math.round((t.load * 1.05) / 2.5) * 2.5; why = 'objectif atteint : +5 % de charge' }
      else if (t.time && (t.meters || t.reps || t.cal) && !hold) { next.time = Math.round(t.time * 0.97); why = 'objectif atteint : temps cible −3 %' }
      else if (t.rounds) { next.rounds = t.rounds + 1; why = 'objectif atteint : un tour de plus' }
      else if (t.reps) { next.reps = t.reps + Math.max(1, Math.round(t.reps * 0.1)); why = 'objectif atteint : +10 % de répétitions' }
      else if (t.cal) { next.cal = t.cal + Math.max(1, Math.round(t.cal * 0.1)); why = 'objectif atteint : +10 % de calories' }
      else if (t.time && !hold) { next.time = Math.round(t.time * 1.1); why = 'objectif atteint : +10 % de durée' }
      else why = 'objectif atteint'
      if (easy) why += ' (FC restée modérée : marge de progression)'
    } else if (a < 0.9 || hard) {
      if (t.load) { next.load = Math.round((t.load * 0.95) / 2.5) * 2.5; why = 'objectif manqué ou effort maximal : −5 % de charge' }
      else if (t.time && (t.meters || t.reps || t.cal) && !hold) { next.time = Math.round(t.time * 1.03); why = 'objectif manqué : temps cible +3 %' }
      else why = 'objectif manqué : on garde la même cible'
      if (veryHard) why += ' (FC très élevée)'
    } else why = 'objectif presque atteint : même cible'
    // Force : 1RM estimé
    const best = done.map(d => e1rm(d.load, d.reps)).filter(Boolean)
    return { label: b.ex === 'amrap' ? 'AMRAP' : exLabel(b), ex: b.ex, achievement: a, target: t, next, why, e1rm: best.length ? Math.max(...best) : null, hmax }
  }).filter(Boolean)
}
export const fmtTarget = t => !t ? '—' : [t.rounds ? t.rounds + ' tours' : null, t.meters ? t.meters + ' m' : null, t.cal ? t.cal + ' cal' : null, t.reps ? t.reps + ' reps' : null, t.load ? t.load + ' kg' : null, t.time ? fmt(t.time) : null, t.rir != null && t.rir !== '' ? 'RIR ' + t.rir : null, t.res ? 'résistance ' + t.res : null].filter(Boolean).join(' · ') || '—'
/** Libellé d'une étape avec sa position (série, tour, minute) */
export function stepLabel(x) {
  const base = exLabel(x)
  if (x.of <= 1) return base
  if (x.grp && x.grp.fmt === 'emom') return `${base} · min ${x.set}/${x.of}`
  if (x.grp) return `${base} · tour ${x.set}/${x.of}`
  return `${base} · série ${x.set}/${x.of}`
}
/** Séance prévue à l'avance (créée mais rien de réalisé) */
export const isPlanned = s => isCustom(s) && s.data.startedAt == null && !(s.data.steps || []).some(x => x.e != null || (x.done && Object.values(x.done).some(v => v != null && v !== '' && v !== false)))
/** Activité saisie rapidement (hors plan) */
export const isQuick = s => isCustom(s) && !!s.data.quick
/** Toutes les zones sollicitées par une liste de blocs */
export function zonesOfBlocks(blocks) {
  const z = new Set(); (blocks || []).forEach(b => (isGroup(b) ? b.items : [b]).forEach(i => ((EX[i.ex] || {}).z || []).forEach(x => z.add(x)))); return [...z]
}
export { parseT }

// ---------- Relais d'un exercice fait à deux (séances perso) ----------
/** Unité naturelle des relais d'une étape : m, reps, kcal, ou s (temps) */
export const relayUnit = x => { const t = x.target || {}, d = x.done || {}; return (x.relays || []).find(r => r.u)?.u || (t.meters != null || d.meters != null ? 'm' : t.reps != null || d.reps != null ? 'reps' : t.cal != null ? 'kcal' : 's') }
/** Quantité totale de l'étape dans une unité (pour le temps : durée chronométrée) */
export function stepTotal(x, u) {
  const d = doneOf(x), t = x.target || {}
  if (u === 's') return d.time != null ? Math.round(d.time) : t.time || null
  const k = u === 'm' ? 'meters' : u === 'reps' ? 'reps' : 'cal'
  return d[k] ?? t[k] ?? null
}
/** Relais alternés : « X commence, relais tous les N » jusqu'au total (le dernier relais est plus court si besoin) */
export function genRelays(first, every, total, u) {
  const out = []; if (!(every > 0) || !(total > 0)) return out
  let w = first, done = 0
  while (done < total - 1e-9 && out.length < 400) { const q = Math.min(every, total - done); out.push({ w, q: Math.round(q * 100) / 100, u }); done += q; w = w === 'A' ? 'B' : 'A' }
  return out
}
/** Temps de chaque relais : en secondes = cumul exact ; sinon au prorata des quantités sur la durée de l'étape (estimé) */
export function timeRelays(x, relays) {
  if (x.s == null || x.e == null || !relays.length) return relays.map(r => ({ ...r, s: r.s ?? null, e: r.e ?? null }))
  const dur = x.e - x.s, q = relays.map(r => +r.q > 0 ? +r.q : 0), tot = q.reduce((a, b) => a + b, 0)
  let c = x.s
  return relays.map((r, k) => {
    const part = r.u === 's' ? q[k] * 1000 : tot > 0 ? dur * q[k] / tot : dur / relays.length
    const s = Math.round(c), e = k === relays.length - 1 ? x.e : Math.min(x.e, Math.round(c + part)); c += part
    return { ...r, s, e, est: r.u !== 's' }
  })
}

// ---------- Effort ressenti par athlète (séances à deux) ----------
/** Ressenti d'un athlète (slot A/B) sur une étape ou une séance ; sans slot : moyenne des deux */
export function rpeOf(o, slot) {
  if (!o) return null
  const by = o.rpeBy || {}
  if (slot) return by[slot] != null ? +by[slot] : (Object.keys(by).length ? null : (o.rpe != null ? +o.rpe : null))
  const v = Object.values(by).filter(x => x != null).map(Number); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : (o.rpe != null ? +o.rpe : null)
}
/** Enregistre le ressenti d'un athlète sans écraser celui de l'autre (rpe = moyenne, pour l'existant) */
export function withRpe(o, slot, v) {
  const by = { ...((o && o.rpeBy) || {}) }
  if (!o || !o.rpeBy) { if (o && o.rpe != null && slot) { /* ancien ressenti unique : on le laisse à son auteur inconnu */ } }
  by[slot] = v
  const vals = Object.values(by).filter(x => x != null)
  return { ...(o || {}), rpeBy: by, rpe: Math.round(vals.reduce((a, b) => a + b, 0) / vals.length * 10) / 10 }
}
/** Part d'un athlète sur une étape faite en relais : en quantité si saisie (m, reps, kcal), sinon en temps */
export function shareOf(x, slot) {
  const R = (x.relays || []).filter(r => r.w === 'A' || r.w === 'B'); if (!R.length) return null
  const byQ = R.some(r => +r.q > 0 && r.u && r.u !== 's')
  const val = r => byQ ? (+r.q > 0 ? +r.q : 0) : (r.s != null && r.e != null ? (r.e - r.s) / 1000 : 0)
  const tot = R.reduce((a, r) => a + val(r), 0), mine = R.filter(r => r.w === slot).reduce((a, r) => a + val(r), 0)
  const t = R.filter(r => r.w === slot && r.s != null && r.e != null).reduce((a, r) => a + (r.e - r.s) / 1000, 0)
  return tot > 0 ? { pct: mine / tot, amt: byQ ? mine : null, u: byQ ? (R.find(r => r.u) || {}).u : 's', t, n: R.filter(r => r.w === slot).length } : null
}
