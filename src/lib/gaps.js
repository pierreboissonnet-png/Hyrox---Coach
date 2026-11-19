// Lacunes d'un athlète : ateliers, course, force, moteur cardio. Comparaison à des repères ajustés au profil
// (sexe, âge, poids) et surtout à ses propres points forts : on cherche ce qui freine le plus SON chrono.
import { STATIONS, STATION } from './hyrox.js'
import { capacity, GROUP } from './predict.js'

// Repères « atelier complet en solo » (s) pour un homme de 30 ans, 75 kg, niveau Open correct ; allure course (s/km)
export const REF = { ski: 270, push: 200, pull: 270, burp: 300, row: 280, farm: 120, lunge: 270, wb: 330 }
export const REF_PACE = 330
const med = a => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.floor((s.length - 1) / 2)] : null }
const pctTxt = r => '+' + Math.round((r - 1) * 100) + ' %'

/**
 * @param stats  athleteStats(...) : {st:{id:s}, pace, n}
 * @param o      {profile, e1rm:{squat, deadlift…}, weakSt:[id] (objectifs manqués en séance perso), z5: part du temps en zone 5}
 * @returns [{id, kind: 'station'|'run'|'force'|'engine'|'test', label, score, why, st?}] trié du plus important au moins important
 */
export function gapsOf(stats, o = {}) {
  const p = o.profile || {}, out = [], st = (stats && stats.st) || {}
  const ratios = {}
  STATIONS.forEach(x => { if (st[x.id]) ratios[x.id] = st[x.id] / (REF[x.id] / capacity(p, GROUP[x.id])) })
  const runR = stats && stats.pace ? stats.pace / (REF_PACE / capacity(p, 'course')) : null
  const all = [...Object.values(ratios), ...(runR ? [runR] : [])], m = med(all)
  Object.entries(ratios).forEach(([id, r]) => {
    const rel = m ? r / m : 1
    let score = Math.max(0, rel - 1) + Math.max(0, r - 1.15) * 0.5
    if ((o.weakSt || []).includes(id)) score += 0.08
    if (score >= 0.06) out.push({ id, kind: 'station', st: id, label: STATION[id].label, score,
      why: rel > 1.06 ? `${pctTxt(rel)} plus lent que vos autres ateliers` : `${pctTxt(r)} au-dessus du repère pour votre profil` })
  })
  ;(o.weakSt || []).filter(id => !ratios[id] && STATION[id]).forEach(id => out.push({ id, kind: 'station', st: id, label: STATION[id].label, score: 0.08, why: 'objectifs manqués lors de vos séances personnalisées' }))
  if (runR && m && (runR / m > 1.05 || runR > 1.15)) out.push({ id: 'run', kind: 'run', label: 'Course', score: Math.max(0, runR / m - 1) + Math.max(0, runR - 1.15) * 0.6 + 0.02,
    why: runR / m > 1.05 ? `allure ${pctTxt(runR / m)} en retrait par rapport à vos ateliers` : `allure ${pctTxt(runR)} au-dessus du repère pour votre profil` })
  const bw = +p.weight_kg || 75, F = p.sex === 'F', rm = o.e1rm || {}
  const fz = [['squat', F ? 0.9 : 1.2, 'Squat'], ['deadlift', F ? 1.1 : 1.5, 'Soulevé de terre']].map(([k, ref, l]) => rm[k] ? { k, l, r: rm[k] / bw / ref } : null).filter(Boolean).filter(x => x.r < 0.92)
  if (fz.length) out.push({ id: 'force', kind: 'force', label: 'Force', score: Math.max(...fz.map(x => 1 - x.r)) * 0.8, why: fz.map(x => `${x.l} ≈ ${(x.r * (x.k === 'squat' ? (F ? 0.9 : 1.2) : (F ? 1.1 : 1.5))).toFixed(2).replace('.', ',')} × poids du corps`).join(', ') })
  else if (['push', 'pull', 'farm'].filter(id => out.some(g => g.id === id)).length >= 2) out.push({ id: 'force', kind: 'force', label: 'Force', score: 0.1, why: 'plusieurs ateliers de force (sled, farmers) en retrait' })
  if (o.z5 != null && o.z5 > 0.25) out.push({ id: 'engine', kind: 'engine', label: 'Endurance (moteur)', score: (o.z5 - 0.25) * 1.5 + 0.05, why: `${Math.round(o.z5 * 100)} % du temps en zone 5 sur la dernière séance : la base aérobie manque` })
  const unknown = STATIONS.filter(x => !st[x.id] && !(o.weakSt || []).includes(x.id)).map(x => x.label)
  out.sort((a, b) => b.score - a.score)
  if (unknown.length >= 5) out.push({ id: 'test', kind: 'test', label: 'Données insuffisantes', score: 0, why: `pas encore de temps sur : ${unknown.join(', ')}. Une simulation (même partielle) affinera le plan.` })
  return out
}
export const stationGaps = gaps => gaps.filter(g => g.kind === 'station').map(g => g.st)

/**
 * Lacunes du coéquipier → ajustements pour moi : je prends une plus grosse part des ateliers où il/elle est en retrait,
 * donc je dois être solide dessus ; et on travaille ensemble ses ateliers faibles lors des séances duo.
 * share : part de l'atelier que je fais (predictDuo), 0–1
 */
export function duoAdjust(myGaps, partnerGaps, share = {}, names = {}) {
  const pw = partnerGaps.filter(g => g.kind === 'station').slice(0, 3), mine = new Set(stationGaps(myGaps))
  const carry = pw.filter(g => !mine.has(g.st)).map(g => g.st)          // je compense
  const both = pw.filter(g => mine.has(g.st)).map(g => g.st)            // faible pour les deux : priorité absolue
  const notes = []
  pw.forEach(g => { const sh = share[g.st]; notes.push(`${names.partner || 'Votre partenaire'} : ${g.label} ${g.why}.${sh != null && sh > 0.5 ? ` Vous en prenez ≈ ${Math.round(sh * 100)} % en course.` : ''}`) })
  if (both.length) notes.push(`${both.map(id => STATION[id].label).join(', ')} : faible(s) pour vous deux, à travailler ensemble en priorité.`)
  if (partnerGaps.some(g => g.kind === 'run')) notes.push(`Courses à deux : l’allure est celle du plus lent. Faites des sorties communes à l’allure de ${names.partner || 'votre partenaire'} et gardez vos intervalles rapides en solo.`)
  return { carry, both, focus: [...both, ...carry], notes }
}
