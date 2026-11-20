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
  // VO2max de la montre bien en dessous des repères de l'âge → moteur à développer
  const age = p.birth_year ? new Date().getFullYear() - p.birth_year : 35, vref = (F ? 38 : 45) - 0.3 * Math.max(0, age - 30)
  if (o.vo2 && o.vo2 < vref * 0.9 && !(o.z5 != null && o.z5 > 0.25)) out.push({ id: 'engine', kind: 'engine', label: 'Endurance (moteur)', score: (1 - o.vo2 / vref) * 1.2, why: `VO2max ${String(o.vo2).replace('.', ',')} (repère ≈ ${Math.round(vref)} pour votre âge)` })
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

/**
 * Bilan de niveau déclaré (journal « level ») : complète les données des séances quand elles manquent.
 * level.data : {exp, run:{k1, k5}, st:{id: s pour l'atelier complet}, rm:{squat:{load, reps}…}, pdc:{pullup, pushup}, hyrox:{best}}
 * Renvoie {stats, e1rm, src} : les séances priment ; le bilan remplit les trous.
 */
export function withLevel(stats, e1rmIn = {}, level) {
  const L = (level && level.data) || {}, st = { ...((stats && stats.st) || {}) }, src = {}
  Object.entries(L.st || {}).forEach(([id, v]) => { if (v && !st[id]) { st[id] = +v; src[id] = 'bilan' } })
  let pace = stats && stats.pace
  if (!pace && L.run) { if (L.run.k5) pace = L.run.k5 / 5 * 1.1; else if (L.run.k1) pace = L.run.k1 * 1.25; if (pace) src.run = 'bilan' }
  const e1rm = { ...e1rmIn }
  Object.entries(L.rm || {}).forEach(([k, x]) => { const v = x && x.load ? x.load * (1 + Math.min(+x.reps || 1, 12) / 30) : null; if (v && !(e1rm[k] >= v)) { e1rm[k] = v; src[k] = 'bilan' } })
  return { stats: { ...(stats || {}), st, pace }, e1rm, src }
}

// ------------------------------------------------------------------ auto-évaluation (ressenti)
// level.data.self[id] = {state, urgency (1–3), cur, target}  — id : atelier, 'run' ou 'force'
export const WEIGHTED = ['push', 'pull', 'farm', 'lunge', 'wb']
export const SELF_STATES = {
  station: [['maitrise', 'Maîtrisé, à maintenir'], ['charge', 'Technique OK, charge à augmenter'], ['vitesse', 'Technique OK, à accélérer'], ['technique', 'Technique à travailler'], ['physique', 'Physiquement très dur'], ['inconnu', 'Jamais fait']],
  run: [['maitrise', 'Allure maîtrisée'], ['endurance', 'Je tiens mal les 8 km'], ['vitesse', 'Il me manque de la vitesse'], ['compromis', 'Dur de courir après les ateliers']],
  force: [['maitrise', 'Suffisante'], ['charge', 'À développer'], ['technique', 'Technique à apprendre']],
}
export const URGENCY = [[1, 'Faible'], [2, 'Moyenne'], [3, 'Haute']]
// Charges standards Open / Pro (kg ; farmers = par main). À vérifier selon le règlement de la course.
export const STD_LOADS = { push: { F: 102, M: 152, PF: 152, PM: 202 }, pull: { F: 78, M: 103, PF: 103, PM: 153 }, farm: { F: 16, M: 24, PF: 24, PM: 32 }, lunge: { F: 10, M: 20, PF: 20, PM: 30 }, wb: { F: 4, M: 6, PF: 6, PM: 9 } }
const U_SCORE = { 1: 0.12, 2: 0.25, 3: 0.45 }
const stateLabel = (kind, s) => ((SELF_STATES[kind] || []).find(x => x[0] === s) || [0, s])[1]
/** Fusionne le ressenti avec les lacunes calculées (le ressenti peut en ajouter, en renforcer ou en atténuer) */
export function withSelf(gaps, self) {
  if (!self) return gaps
  let out = gaps.map(g => ({ ...g }))
  const add = (id, kind, label, st, S, extraWhy) => {
    if (!S || !S.state) return
    const i = out.findIndex(g => g.id === id)
    if (S.state === 'maitrise') { if (i >= 0) out[i].score *= 0.5; return }
    if (S.state === 'inconnu') { const g = { id, kind, label, st, score: 0.1, why: 'jamais fait : à découvrir dans les premières semaines', need: 'inconnu' }; if (i >= 0) out[i] = { ...out[i], need: 'inconnu', score: Math.max(out[i].score, 0.1) }; else out.push(g); return }
    const u = U_SCORE[S.urgency || 2], why = stateLabel(kind === 'station' ? 'station' : kind, S.state).toLowerCase() + (extraWhy || '') + ` (ressenti, urgence ${['', 'faible', 'moyenne', 'haute'][S.urgency || 2]})`
    if (i >= 0) out[i] = { ...out[i], score: Math.max(out[i].score, u) + 0.05, why: why + ' ; ' + out[i].why, need: S.state, self: S }
    else out.push({ id, kind, label, st, score: u, why, need: S.state, self: S })
  }
  for (const x of STATIONS) { const S = self[x.id]; add(x.id, 'station', x.label, x.id, S, S && S.state === 'charge' && S.cur && S.target ? ` : ${S.cur} → ${S.target} kg` : '') }
  const R = self.run; add('run', 'run', 'Course', undefined, R, R && R.cur && R.target ? ` : ${fmtPace(R.cur)} → ${fmtPace(R.target)}/km` : '')
  add('force', 'force', 'Force', undefined, self.force, '')
  out = out.filter(g => g.kind === 'test' || g.score > 0.02)
  const test = out.filter(g => g.kind === 'test'), rest = out.filter(g => g.kind !== 'test').sort((a, b) => b.score - a.score)
  return [...rest, ...test]
}
const fmtPace = s => Math.floor(s / 60) + ':' + String(Math.round(s % 60)).padStart(2, '0')
