// Courbe de progression (façon « courbe de croissance ») : temps Hyrox estimé au fil des semaines,
// comparé à la trajectoire attendue entre le point de départ et l'objectif du jour J.
import { STATIONS } from './hyrox.js'
import { athleteStats, summary } from './analyze.js'
import { withLevel, REF, REF_PACE } from './gaps.js'
import { predictDuo, estimatePartner } from './predict.js'
import { isCustom, isPlanned, isQuick } from './custom.js'

const DAY = 864e5
export const dayNum = iso => Math.round(Date.parse(iso + 'T12:00:00Z') / DAY)
export const isoOfNum = n => new Date(n * DAY).toISOString().slice(0, 10)
const used = s => !isPlanned(s) && !isQuick(s)
const isAth = (s, uid) => !!(s.athletes && Object.values(s.athletes).includes(uid))

/** Ateliers manquants complétés au prorata des ateliers connus (repères REF). null si trop peu de données. */
export function fillStats(stats) {
  if (!stats || !stats.pace) return null
  const st = stats.st || {}, known = STATIONS.filter(x => st[x.id] > 0)
  // Peu d'ateliers connus (séances duo sans relais pointés, pas de bilan) : on complète d'après l'allure de course,
  // pour afficher une première courbe (marquée « approximative ») plutôt que rien.
  const rs = known.map(x => st[x.id] / REF[x.id]); if (known.length < 3) rs.push(stats.pace / REF_PACE)
  const ratio = rs.reduce((a, b) => a + b, 0) / rs.length
  const full = {}; STATIONS.forEach(x => { full[x.id] = st[x.id] > 0 ? st[x.id] : REF[x.id] * ratio })
  return { ...stats, st: full, rox: stats.rox || 25, filled: STATIONS.length - known.length, rough: known.length < 3 }
}
/** Temps solo estimé (8 × 1 km + 8 ateliers + 15 transitions) */
export function soloTime(stats) {
  const f = fillStats(stats); if (!f) return null
  return Math.round(8 * f.pace + STATIONS.reduce((a, x) => a + f.st[x.id], 0) + 15 * f.rox)
}
/** Statistiques d'un athlète avec les seules séances faites jusqu'à une date, complétées par le bilan */
export function statsAt(uid, sessions, plans, level, iso) {
  return withLevel(athleteStats(uid, sessions.filter(s => used(s) && s.session_date <= iso), plans), {}, level).stats
}
/** Dates utiles : début, chaque jour de séance, aujourd'hui (au plus ~40 points) */
export function datesOf(uids, sessions, from, to) {
  const D = new Set([from, to])
  sessions.forEach(s => { if (used(s) && uids.some(u => isAth(s, u)) && s.session_date > from && s.session_date < to) D.add(s.session_date) })
  let L = [...D].sort()
  if (L.length > 40) { const k = Math.ceil(L.length / 40); L = L.filter((d, i) => i % k === 0 || d === to) }
  return L
}
export function soloSeries(uid, sessions, plans, level, dates) {
  return dates.map(d => [dayNum(d), soloTime(statsAt(uid, sessions, plans, level, d))])
}
/**
 * Temps du duo estimé à chaque date. Sans données sur un coéquipier, on l'estime à partir de l'autre,
 * pondéré par les profils (sexe, âge, poids) : même méthode que « Temps prédit ».
 */
export function duoSeries(A, B, sessions, plans, levelA, plan, dates, pA = null, pB = null, levelB = null) {
  return dates.map(d => {
    let a = fillStats(statsAt(A, sessions, plans, levelA, d)), b = B ? fillStats(statsAt(B, sessions, plans, levelB, d)) : null
    if (!a && !b) return [dayNum(d), null]
    if (!a) a = estimatePartner(b, pB, pA); if (!b) b = estimatePartner(a, pA, pB)
    return [dayNum(d), predictDuo(a, b, plan).total]
  })
}
/** Temps réels des Hyrox complets (simulations, courses) */
export function realResults(sessions, plans, keep) {
  return sessions.filter(s => !isCustom(s) && keep(s)).map(s => ({ s, sum: summary(s, s.plan || plans[s.team_id]) }))
    .filter(x => x.sum.complete).map(x => [dayNum(x.s.session_date), x.sum.all.t]).sort((a, b) => a[0] - b[0])
}
/**
 * Trajectoire attendue : progrès plus rapides au début, puis de plus en plus fins (comme une courbe de croissance).
 * E0 au départ → objectif au jour J ; points hebdomadaires.
 */
export function expectedCurve(fromIso, E0, raceIso, goal) {
  const a = dayNum(fromIso), b = dayNum(raceIso); if (!(b > a) || !E0 || !goal) return []
  if (goal >= E0) return [[a, goal], [b, goal]]   // objectif déjà à portée : la ligne d'objectif suffit
  const at = x => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return E0 - (E0 - goal) * (1 - Math.pow(1 - t, 1.6)) }
  const pts = []; for (let x = a; x < b; x += 7) pts.push([x, Math.round(at(x))]); pts.push([b, goal])
  return pts
}
export const valueAt = (pts, x) => {
  const L = pts.filter(p => p[1] != null); if (!L.length) return null
  if (x <= L[0][0]) return L[0][1]
  for (let i = 1; i < L.length; i++) if (x <= L[i][0]) { const [x0, y0] = L[i - 1], [x1, y1] = L[i]; return y0 + (y1 - y0) * (x - x0) / (x1 - x0 || 1) }
  return L[L.length - 1][1]
}
/** Dernier point connu d'une série */
export const lastOf = pts => { const L = pts.filter(p => p[1] != null); return L.length ? L[L.length - 1] : null }
export const firstOf = pts => pts.find(p => p[1] != null) || null
