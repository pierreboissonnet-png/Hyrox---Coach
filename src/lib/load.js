// Charge d'entraînement et dépense : relie séances (Hyrox ou spécialisées), cardio, programme et nutrition.
import { normData } from './session.js'
import { isCustom, customSummary, doneOf, kcalFromHR, kcalFromMET, progression, e1rm, EX, rpeOf } from './custom.js'
import { series, hrStat } from './hr.js'

const isAth = (s, uid) => !!(s.athletes && (s.athletes.A === uid || s.athletes.B === uid))
/** Durée (minutes) d'une séance */
export function sessionMinutes(s) {
  if (isCustom(s)) return customSummary(s).total / 60
  const d = normData(s.data); const m = Math.max(0, ...d.cp.filter(v => v != null)); return m / 60000
}
/** Effort ressenti moyen (séances spécialisées) */
export function sessionRPE(s, uid) {
  // En duo, chacun a son propre ressenti (rpeBy.A / rpeBy.B) ; sans uid : moyenne
  const slot = uid && s.athletes ? (s.athletes.A === uid ? 'A' : s.athletes.B === uid ? 'B' : null) : null
  if (!isCustom(s)) return rpeOf(s.data, slot) || null   // Hyrox saisi après coup : ressenti déclaré
  const r = (s.data.steps || []).map(x => rpeOf(x.done, slot)).filter(v => v != null); return r.length ? r.reduce((a, b) => a + b, 0) / r.length : null
}
/** Dépense d'une séance (kcal) : d'après la FC si disponible, sinon par MET */
export function sessionKcal(s, hrRow, p) {
  const min = sessionMinutes(s); if (!min) return 0
  const S = hrRow ? series(hrRow) : null, h = S ? hrStat(S, 0, min * 60) : null
  if (h) return kcalFromHR(h.avg, min, p) || 0
  if (isCustom(s) && s.data.kcal) return s.data.kcal
  if (s.data && s.data.avgHR) return kcalFromHR(s.data.avgHR, min, p) || 0
  if (isCustom(s)) return kcalFromMET(s.data.steps || [], p)
  return Math.round(10 * ((p && +p.weight_kg) || 70) * min / 60)   // Hyrox ≈ 10 MET
}
const iso = d => new Date(d - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10)
/**
 * Charge aiguë (7 jours) et chronique (28 jours) en minutes × intensité (RPE, 7 par défaut).
 * ratio > 1,5 : hausse brutale → semaine allégée ; < 0,8 : charge en baisse.
 */
export function trainingLoad(sessions, uid, today = new Date()) {
  const t7 = iso(new Date(today.getTime() - 7 * 864e5)), t28 = iso(new Date(today.getTime() - 28 * 864e5))
  let a = 0, c = 0, n7 = 0
  sessions.filter(s => isAth(s, uid)).forEach(s => {
    const load = sessionMinutes(s) * (sessionRPE(s, uid) || 7)
    if (s.session_date > t28) c += load
    if (s.session_date > t7) { a += load; n7++ }
  })
  const chronic = c / 4
  return { acute: a, chronic, ratio: chronic > 0 ? a / chronic : null, n7 }
}
/** Type de journée pour la nutrition, d'après les séances du jour */
export function dayTypeFromKcal(kcal, minutes) {
  if (kcal >= 700 || minutes >= 75) return 'intense'
  if (kcal >= 200 || minutes >= 20) return 'entrainement'
  return 'repos'
}
/**
 * Prochaines cibles par exercice (séances spécialisées les plus récentes) et 1RM estimés pour la force.
 * Renvoie {targets: [{label, ex, next, why, date}], e1rm: {exId: kg}, weakSt: [stationId]}
 */
export function customInsights(sessions, uid) {
  const mine = sessions.filter(s => isCustom(s) && isAth(s, uid)).sort((x, y) => y.session_date.localeCompare(x.session_date))
  const seen = new Set(), targets = [], best = {}, weak = {}
  mine.forEach(s => progression(s).forEach(p => {
    if (!seen.has(p.ex + p.label)) { seen.add(p.ex + p.label); targets.push({ ...p, date: s.session_date, session: s.name }) }
    if (p.e1rm) best[p.ex] = Math.max(best[p.ex] || 0, p.e1rm)
    const st = (EX[p.ex] || {}).st; if (st && p.achievement < 0.9) weak[st] = (weak[st] || 0) + 1
  }))
  return { targets: targets.slice(0, 12), e1rm: best, weakSt: Object.keys(weak) }
}
export { e1rm }
