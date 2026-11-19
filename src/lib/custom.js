// Séances spécialisées : blocs d'exercices (ateliers Hyrox, course, musculation…) avec objectifs
// en temps, mètres, répétitions, charge ; réalisé ; liens avec cardio, prédictions, programme et nutrition.
import { STATION, fmt, parseT } from './hyrox.js'

// cat : 'hyrox' (atelier), 'run', 'cardio', 'force', 'pdc' (poids du corps), 'libre'
// m : mesures proposées par défaut ; st : atelier Hyrox équivalent (pour les prédictions)
export const EXERCISES = [
  { id: 'run', label: 'Course', cat: 'run', m: ['meters', 'time'] },
  { id: 'ski', label: 'SkiErg', cat: 'hyrox', m: ['meters', 'time'], st: 'ski' },
  { id: 'push', label: 'Sled Push', cat: 'hyrox', m: ['meters', 'load', 'time'], st: 'push' },
  { id: 'pull', label: 'Sled Pull', cat: 'hyrox', m: ['meters', 'load', 'time'], st: 'pull' },
  { id: 'burp', label: 'Burpees Broad Jump', cat: 'hyrox', m: ['meters', 'time'], st: 'burp' },
  { id: 'row', label: 'Rameur', cat: 'hyrox', m: ['meters', 'time'], st: 'row' },
  { id: 'farm', label: 'Farmers Carry', cat: 'hyrox', m: ['meters', 'load', 'time'], st: 'farm' },
  { id: 'lunge', label: 'Fentes sandbag', cat: 'hyrox', m: ['meters', 'load', 'time'], st: 'lunge' },
  { id: 'wb', label: 'Wall Balls', cat: 'hyrox', m: ['reps', 'load', 'time'], st: 'wb' },
  { id: 'bike', label: 'Vélo / Air bike', cat: 'cardio', m: ['time', 'meters'] },
  { id: 'rope', label: 'Corde à sauter', cat: 'cardio', m: ['time', 'reps'] },
  { id: 'squat', label: 'Squat', cat: 'force', m: ['reps', 'load'] },
  { id: 'bench', label: 'Développé couché', cat: 'force', m: ['reps', 'load'] },
  { id: 'deadlift', label: 'Soulevé de terre', cat: 'force', m: ['reps', 'load'] },
  { id: 'ohp', label: 'Développé militaire', cat: 'force', m: ['reps', 'load'] },
  { id: 'bentrow', label: 'Rowing barre', cat: 'force', m: ['reps', 'load'] },
  { id: 'frontsquat', label: 'Front squat', cat: 'force', m: ['reps', 'load'] },
  { id: 'hipthrust', label: 'Hip thrust', cat: 'force', m: ['reps', 'load'] },
  { id: 'lunges', label: 'Fentes haltères', cat: 'force', m: ['reps', 'load'] },
  { id: 'kbswing', label: 'Kettlebell swing', cat: 'force', m: ['reps', 'load'] },
  { id: 'thruster', label: 'Thruster', cat: 'force', m: ['reps', 'load'] },
  { id: 'pullup', label: 'Tractions', cat: 'pdc', m: ['reps'] },
  { id: 'pushup', label: 'Pompes', cat: 'pdc', m: ['reps'] },
  { id: 'burpee', label: 'Burpees', cat: 'pdc', m: ['reps', 'time'] },
  { id: 'boxjump', label: 'Box jumps', cat: 'pdc', m: ['reps'] },
  { id: 'plank', label: 'Gainage', cat: 'pdc', m: ['time'] },
  { id: 'free', label: 'Exercice libre', cat: 'libre', m: ['time', 'reps'] },
]
export const EX = Object.fromEntries(EXERCISES.map(e => [e.id, e]))
export const CATS = [['hyrox', 'Ateliers Hyrox'], ['run', 'Course'], ['cardio', 'Cardio'], ['force', 'Musculation'], ['pdc', 'Poids du corps'], ['libre', 'Libre']]
export const METRICS = { time: ['Temps', 'mm:ss'], meters: ['Distance', 'm'], reps: ['Répétitions', 'reps'], load: ['Charge', 'kg'] }

export const isCustom = s => !!(s && s.data && s.data.format === 'custom')
export const exLabel = b => (b.ex === 'free' && b.name) ? b.name : (EX[b.ex] || {}).label || b.name || 'Exercice'

/** Bloc du modèle : {ex, name, sets, rest, w ('A'|'B'|'AB'), target:{time, meters, reps, load}, note} */
export const newBlock = (ex = 'ski') => ({ ex, name: '', sets: 1, rest: 60, w: 'A', target: defaultTarget(ex), note: '' })
export function defaultTarget(ex) {
  const st = STATION[ex]
  if (ex === 'run') return { meters: 1000, time: 300 }
  if (st) return st.u === ' reps' ? { reps: 25 } : { meters: Math.round(st.tot / 4) }
  const e = EX[ex] || {}
  if (e.cat === 'force') return { reps: 8, load: 40 }
  if (e.cat === 'pdc') return e.m[0] === 'time' ? { time: 60 } : { reps: 15 }
  if (e.cat === 'cardio') return { time: 300 }
  return { time: 120 }
}

/** Développe les séries : un bloc de 4 séries devient 4 étapes (pour le chrono et le réalisé) */
export function expand(blocks) {
  const out = []
  blocks.forEach((b, gi) => { const n = Math.max(1, +b.sets || 1); for (let k = 0; k < n; k++) out.push({ g: gi, set: k + 1, of: n, ex: b.ex, name: b.name, rest: +b.rest || 0, w: b.w || 'A', target: { ...b.target }, note: b.note || '', s: null, e: null, done: null }) })
  return out
}
export function emptyCustom(blocks, title) { return { format: 'custom', title: title || '', startedAt: null, steps: expand(blocks), blocks, note: '' } }

/** Valeurs réalisées d'une étape (le temps vient du chrono si non saisi) */
export function doneOf(st) {
  const d = st.done || {}
  const time = d.time != null && d.time !== '' ? +d.time : (st.s != null && st.e != null ? (st.e - st.s) / 1000 : null)
  return { time, meters: d.meters != null && d.meters !== '' ? +d.meters : null, reps: d.reps != null && d.reps !== '' ? +d.reps : null, load: d.load != null && d.load !== '' ? +d.load : null, rpe: d.rpe != null ? +d.rpe : null }
}
/** Taux de réalisation de l'objectif (1 = atteint) ; pour le temps, plus court = mieux quand une distance/reps est visée */
export function achievement(st) {
  const t = st.target || {}, d = doneOf(st), parts = []
  if (t.meters && d.meters != null) parts.push(d.meters / t.meters)
  if (t.reps && d.reps != null) parts.push(d.reps / t.reps)
  if (t.load && d.load != null) parts.push(d.load / t.load)
  if (t.time && d.time != null) parts.push((t.meters || t.reps) ? t.time / d.time : d.time / t.time)   // effort chronométré vs durée à tenir
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
  const w = +(p && p.weight_kg) || 70, MET = { hyrox: 10, run: 10, cardio: 8, force: 5, pdc: 7, libre: 6 }
  return Math.round(steps.reduce((a, x) => { const d = doneOf(x); return a + (d.time ? MET[(EX[x.ex] || {}).cat || 'libre'] * w * d.time / 3600 : 0) }, 0))
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
    if (a >= 1.0 && !hard) {
      if (t.load) { next.load = Math.round((t.load * 1.05) / 2.5) * 2.5; why = 'objectif atteint : +5 % de charge' }
      else if (t.time && (t.meters || t.reps)) { next.time = Math.round(t.time * 0.97); why = 'objectif atteint : temps cible −3 %' }
      else if (t.reps) { next.reps = t.reps + Math.max(1, Math.round(t.reps * 0.1)); why = 'objectif atteint : +10 % de répétitions' }
      else if (t.time) { next.time = Math.round(t.time * 1.1); why = 'objectif atteint : +10 % de durée' }
      if (easy) why += ' (FC restée modérée : marge de progression)'
    } else if (a < 0.9 || hard) {
      if (t.load) { next.load = Math.round((t.load * 0.95) / 2.5) * 2.5; why = 'objectif manqué ou effort maximal : −5 % de charge' }
      else if (t.time && (t.meters || t.reps)) { next.time = Math.round(t.time * 1.03); why = 'objectif manqué : temps cible +3 %' }
      else why = 'objectif manqué : on garde la même cible'
      if (veryHard) why += ' (FC très élevée)'
    } else why = 'objectif presque atteint : même cible'
    // Force : 1RM estimé
    const best = done.map(d => e1rm(d.load, d.reps)).filter(Boolean)
    return { label: exLabel(b), ex: b.ex, achievement: a, target: t, next, why, e1rm: best.length ? Math.max(...best) : null, hmax }
  }).filter(Boolean)
}
export const fmtTarget = t => [t.meters ? t.meters + ' m' : null, t.reps ? t.reps + ' reps' : null, t.load ? t.load + ' kg' : null, t.time ? fmt(t.time) : null].filter(Boolean).join(' · ') || '—'
export { parseT }
