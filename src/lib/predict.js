// Prédiction de temps d'un duo à partir des capacités individuelles, et estimation d'un nouveau partenaire.
import { SEGS, STATIONS, normPlan, changeObjective } from './hyrox.js'

const age = p => p && p.birth_year ? new Date().getFullYear() - p.birth_year : 35
const W = p => (p && +p.weight_kg) || 75
// Groupes d'ateliers selon ce qui compte le plus
export const GROUP = { push: 'force', pull: 'force', farm: 'force', ski: 'erg', row: 'erg', burp: 'corps', lunge: 'corps', wb: 'mixte', run: 'course' }

/** Indice de capacité relatif (1 = homme de 30 ans, 75 kg) pour un groupe d'effort. Heuristique volontairement simple. */
export function capacity(p, group) {
  const sexF = p && p.sex === 'F' ? (group === 'force' ? 0.78 : group === 'course' ? 0.9 : 0.85) : p && p.sex === 'X' ? 0.92 : 1
  const a = age(p), ageF = 1 - 0.006 * Math.max(0, a - 30) - 0.004 * Math.max(0, 22 - a)
  const w = W(p) / 75
  const wF = group === 'force' ? Math.pow(w, 0.4) : group === 'erg' ? Math.pow(w, 0.2) : group === 'course' || group === 'corps' ? Math.pow(w, -0.15) : 1
  return sexF * ageF * wF
}

/**
 * Estime les capacités d'un nouveau partenaire à partir de l'ancien partenaire (pondération par profil)
 * coef : réglage manuel (1 = identique ; 0,9 = 10 % plus rapide ; 1,1 = 10 % plus lent)
 */
export function estimatePartner(prevStats, prevProfile, newProfile, coef = 1) {
  if (!prevStats) return null
  const st = {}
  STATIONS.forEach(x => {
    const v = prevStats.st[x.id]; if (v == null) { st[x.id] = null; return }
    st[x.id] = v * capacity(prevProfile, GROUP[x.id]) / capacity(newProfile, GROUP[x.id]) * coef
  })
  const pace = prevStats.pace == null ? null : prevStats.pace * capacity(prevProfile, 'course') / capacity(newProfile, 'course') * coef
  return { st, pace, rox: prevStats.rox, estimated: true }
}

/**
 * Temps d'un duo : chaque atelier est partagé pour que chacun travaille autant de temps.
 * Si A met TA pour 100 % et B met TB, A fait TB/(TA+TB) de l'atelier et le travail dure 2·TA·TB/(TA+TB).
 * Les courses se font ensemble : l'allure est celle du plus lent.
 */
export function predictDuo(A, B, planRaw, { runKm = 1 } = {}) {
  const plan = normPlan(planRaw), seg = {}, share = {}
  let total = 0, missing = []
  STATIONS.forEach(x => {
    const a = A && A.st[x.id], b = B && B.st[x.id]
    let work = null
    if (a && b) { work = 2 * a * b / (a + b); share[x.id] = b / (a + b) }
    else if (a || b) { work = (a || b); share[x.id] = null }
    if (work == null) { missing.push(x.label); seg[x.id] = plan.obj[x.id]; }
    else seg[x.id] = Math.round(work + changeObjective(plan, x.id))
  })
  const paces = [A && A.pace, B && B.pace].filter(Boolean)
  const pace = paces.length ? Math.max(...paces) : null
  const roxs = [A && A.rox, B && B.rox].filter(Boolean)
  const rox = roxs.length ? roxs.reduce((x, y) => x + y, 0) / roxs.length : null
  SEGS.forEach(g => {
    if (g.type === 'run') seg[g.id] = pace ? Math.round(pace * runKm) : plan.obj[g.id]
    else if (g.type === 'rox') seg[g.id] = rox ? Math.round(rox) : plan.obj[g.id]
    total += seg[g.id] || 0
  })
  return { seg, share, total, pace, missing, estimated: !!((A && A.estimated) || (B && B.estimated)) }
}

/** Plan avec objectifs remplacés par la prédiction (pour « Appliquer au plan ») */
export function planFromPrediction(planRaw, pred) {
  const plan = normPlan(planRaw)
  return { ...plan, obj: { ...plan.obj, ...pred.seg } }
}
