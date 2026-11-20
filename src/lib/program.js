// Programme d'entraînement hebdomadaire, ajusté à la date de course, aux points faibles et à l'état de forme.
// Repères généraux de préparation Hyrox ; pas un avis médical.
import { STATION } from './hyrox.js'

export const DRILLS = {
  ski: 'SkiErg : 6 × 250 m à allure course, récup 1 min ; travail de la poussée des hanches',
  push: 'Sled push : 6 × 12,5 m lourd + 4 × 25 m allure course ; gainage, bras tendus, petits pas rapides',
  pull: 'Sled pull : 5 × 12,5 m, technique bras-jambes, pieds calés ; tirage horizontal au poulie',
  burp: 'Burpees broad jump : 5 × 10 répétitions à rythme régulier, atterrissage pieds à plat',
  row: 'Rameur : 4 × 500 m à allure course, cadence 26–30, récup 1 min 30',
  farm: 'Farmers carry : 4 × 100 m lourd, épaules basses ; grip : suspensions à la barre 3 × 40 s',
  lunge: 'Fentes sandbag : 4 × 20 m + fentes bulgares 3 × 10 par jambe',
  wb: 'Wall balls : 5 × 20 répétitions sans pause, puis 3 × 30 ; respiration en haut du mouvement',
}

export function phaseFor(weeks) {
  if (weeks == null) return { id: 'entretien', label: 'Entretien', note: 'Pas de course planifiée : on garde la forme, sans pic.' }
  if (weeks <= 1) return { id: 'course', label: 'Semaine de course', note: 'Volume divisé par deux, quelques rappels d’intensité, sommeil prioritaire.' }
  if (weeks <= 3) return { id: 'affutage', label: 'Affûtage', note: 'Volume en baisse (−30 à −40 %), intensité conservée, une dernière simulation courte.' }
  if (weeks <= 8) return { id: 'specifique', label: 'Spécifique', note: 'Simulations partielles, « compromised running », allure course.' }
  if (weeks <= 16) return { id: 'developpement', label: 'Développement', note: 'Seuil, force spécifique sur les ateliers, volume en hausse progressive.' }
  return { id: 'fondation', label: 'Fondation', note: 'Endurance en zone 2, force générale, technique des ateliers.' }
}

/**
 * @param {object} o
 *  weeks : semaines avant la prochaine course (ou null) ; format : 'solo'|'duo'
 *  weak : identifiants d'ateliers à travailler ; z5 : part du temps en zone 5 (0–1) sur la dernière séance
 *  well : entrées « forme du jour » du journal (échelle 0–5) ; todayISO : date du jour ; cycle : {phase} ; crp : mg/L ; perWeek : 3 à 6
 */
export function buildProgram(o = {}) {
  const ph = o.phase || phaseFor(o.weeks), perWeek = Math.min(6, Math.max(3, o.perWeek || 4))
  const weak = (o.weak || []).filter(id => STATION[id]).slice(0, 2)
  const notes = [ph.note]
  let light = false
  const W = wellbeingImpact(o.well || [], o.todayISO)
  // Sans « forme du jour » saisie, la montre prend le relais (FC au repos, variabilité cardiaque)
  if (!W.day) { const V = vitalsImpact(o.vitals || [], o.todayISO); if (V) W.day = V }
  if (W.week) { light = true; notes.push(`Forme moyenne des 5 derniers jours dégradée (${W.week}) : semaine allégée, les séances intenses deviennent de l’endurance facile.`) }
  if (o.sleepAvg != null && o.sleepAvg < 360) { light = true; notes.push(`Sommeil moyen de ${Math.floor(o.sleepAvg / 60)} h ${String(Math.round(o.sleepAvg % 60)).padStart(2, '0')} sur 7 nuits : semaine allégée, priorité au sommeil (objectif 8 h).`) }
  else if (o.sleepAvg != null && o.sleepAvg < 420) notes.push(`Sommeil moyen de ${Math.floor(o.sleepAvg / 60)} h ${String(Math.round(o.sleepAvg % 60)).padStart(2, '0')} : visez au moins 7 h 30, surtout les veilles de séances intenses.`)
  if (o.loadRatio != null && o.loadRatio > 1.5) { light = true; notes.push(`Charge des 7 derniers jours ${o.loadRatio.toFixed(1).replace('.', ',')} fois supérieure à votre moyenne des 4 semaines : semaine allégée pour limiter le risque de blessure.`) }
  else if (o.loadRatio != null && o.loadRatio < 0.8) notes.push('Charge en baisse par rapport à vos 4 dernières semaines : vous pouvez reprendre progressivement le volume.')
  if (o.crp != null && o.crp > 5) { light = true; notes.push(`CRP à ${o.crp} mg/L (au-dessus de 5) : possible inflammation ou infection. Séances légères et avis médical si cela persiste.`) }
  if (o.z5 != null && o.z5 > 0.25) notes.push(`${Math.round(o.z5 * 100)} % du temps en zone 5 lors de la dernière séance : ajoutez du volume en zone 2 pour mieux encaisser l’intensité.`)
  if (o.cycle && o.cycle.phase) {
    const c = { menstruelle: 'Phase menstruelle : adaptez l’intensité à vos sensations, hydratation et fer à surveiller.',
      folliculaire: 'Phase folliculaire : bonne fenêtre pour les séances intenses et la force.',
      ovulatoire: 'Autour de l’ovulation : échauffement soigné (laxité ligamentaire possiblement plus élevée).',
      luteale: 'Phase lutéale : température corporelle plus haute, hydratez davantage ; intensité selon sensations.',
      premenstruelle: 'Phase prémenstruelle : intensités réduites cette semaine sur les jours concernés, priorité à la technique et au volume facile.' }[o.cycle.phase]
    if (c && !o.cycleDays) notes.push(c)
  }
  if (o.cycleDays && o.cycleDays.some(Boolean)) notes.push('Programme adapté jour par jour à votre cycle déclaré (pastille de couleur sur chaque jour).')
  const duo = o.format === 'duo'
  const S = {
    z2: { title: 'Endurance fondamentale', zone: 'Z2', min: 45, detail: 'Course ou vélo facile, on peut parler. Fin : 4 lignes droites.' },
    seuil: { title: 'Course au seuil', zone: 'Z4', min: 50, detail: ph.id === 'fondation' ? '3 × 8 min au seuil, récup 2 min.' : '5 × 1 km allure course Hyrox, récup 1 min 30.' },
    force: { title: 'Force spécifique', zone: 'Z3', min: 60, detail: forceDetail(o.e1rm, ph.id) },
    ateliers: { title: 'Ateliers ' + (weak.length ? weak.map(id => STATION[id].label).join(' + ') : 'techniques'), zone: 'Z3–Z4', min: 55, detail: weak.length ? weak.map(id => DRILLS[id]).join(' · ') : 'Rotation sur les 8 ateliers à technique propre, 3 tours.' },
    compromis: { title: 'Compromised running', zone: 'Z4', min: 55, detail: `4 tours : 1 km allure course + 1 atelier (${(weak[0] && STATION[weak[0]].label) || 'Wall Balls'}, puis rotation)${duo ? ', en relais comme le jour J' : ''}.` },
    simu: { title: duo ? 'Simulation duo' : 'Simulation', zone: 'Z4', min: 75, detail: ph.id === 'affutage' ? 'Demi-simulation (4 courses + 4 ateliers) à allure course, pointage dans l’app.' : 'Simulation complète ou 3/4, pointage dans l’app, stratégie de relais du plan.' },
    rappel: { title: 'Rappel d’intensité', zone: 'Z4', min: 35, detail: '3 × 500 m allure course + 2 ateliers courts. Rien de nouveau.' },
    repos: { title: 'Repos ou mobilité', zone: '—', min: 20, detail: 'Marche, étirements, rouleau. Sommeil 8 h.' },
  }
  const templates = {
    fondation: ['z2', 'force', 'ateliers', 'z2', 'seuil', 'z2'],
    developpement: ['seuil', 'force', 'ateliers', 'z2', 'compromis', 'z2'],
    specifique: ['compromis', 'force', 'seuil', 'z2', 'simu', 'ateliers'],
    affutage: ['seuil', 'ateliers', 'z2', 'simu', 'z2', 'repos'],
    course: ['z2', 'rappel', 'repos', 'z2', 'repos', 'repos'],
    entretien: ['z2', 'force', 'ateliers', 'seuil', 'z2', 'z2'],
  }
  let keys = templates[ph.id].slice(0, perWeek)
  if (light) keys = keys.map(k => ['seuil', 'compromis', 'simu', 'rappel'].includes(k) ? 'z2' : k)
  const DAYS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche']
  const slots = { 3: [0, 2, 5], 4: [0, 1, 3, 5], 5: [0, 1, 3, 4, 5], 6: [0, 1, 2, 3, 4, 5] }[perWeek]
  let days = DAYS.map((d, i) => { const k = slots.indexOf(i); return k >= 0 ? { day: d, ...S[keys[k]], key: keys[k] } : { day: d, ...S.repos, key: 'repos' } })
  // Semaine issue du plan jusqu'à la course : on garde ses séances et on n'applique que les adaptations du moment
  if (o.baseDays) days = o.baseDays.map(d => light && INTENSE.includes(d.key) ? { ...d, ...S.z2, key: 'z2', blocks: null, was: d.title, adapted: 'Semaine allégée (voir les raisons ci-dessus)' } : { ...d })
  if (o.cycleDays) days = days.map((d, i) => adaptToCycle(d, o.cycleDays[i], S))
  // Forme du jour : n'adapte que la séance du jour et celle du lendemain
  if (W.day && o.today != null && !light) {
    let touched = false
    days = days.map((d, i) => {
      const di = d.date ? (new Date(d.date + 'T12:00:00').getDay() + 6) % 7 : i   // jour de la semaine (une journée peut compter 2 séances)
      if (di !== o.today && di !== o.today + 1) return d
      if (W.day.hard && INTENSE.includes(d.key)) { touched = true; return { ...S.z2, day: d.day, date: d.date, focus: d.focus, blocks: null, key: 'z2', cycle: d.cycle, was: d.title, adapted: 'Adapté à votre forme du jour (' + W.day.why + ')' } }
      if (W.day.mid && d.key !== 'repos') { touched = true; return { ...d, min: Math.round(d.min * 0.8 / 5) * 5, adapted: 'Volume réduit d’environ 20 % (' + W.day.why + ')' } }
      return d
    })
    if (touched) notes.push(W.day.hard ? `Forme du jour (${W.day.why}) : la séance intense d’aujourd’hui ou de demain passe en endurance facile. Le reste de la semaine est inchangé.` : `Forme du jour (${W.day.why}) : volume réduit d’environ 20 % aujourd’hui et demain, intensité conservée.`)
  }
  return { phase: ph, days, notes, light, weak }
}

// ---------- adaptation au cycle menstruel ----------
const INTENSE = ['seuil', 'compromis', 'simu', 'rappel', 'allure']
/** Ajuste une journée selon la phase du cycle (c = {phase, day, symptoms}) */
export function adaptToCycle(d, c, S) {
  if (!c || !c.phase) return d
  const out = { ...d, cycle: c }
  const swap = (key, why) => ({ ...S[key], key, day: d.day, date: d.date, focus: d.focus, blocks: null, cycle: c, adapted: why, was: d.title })
  if (c.phase === 'menstruelle') {
    if (INTENSE.includes(d.key) && (c.day <= 2 || c.symptoms)) return swap('z2', `J${c.day} des règles${c.symptoms ? ' (' + c.symptoms + ')' : ''} : séance intense remplacée par de l’endurance facile. Si vous vous sentez bien, gardez la séance prévue.`)
    if (INTENSE.includes(d.key)) out.adapted = 'Règles : gardez la séance si vous vous sentez bien, sinon passez en zone 2 ; hydratez-vous davantage.'
    else if (d.key === 'force') out.adapted = 'Règles : charges modérées, sans aller à l’échec.'
  } else if (c.phase === 'folliculaire') {
    if (d.key === 'force') out.adapted = 'Phase folliculaire : bonne fenêtre pour progresser en force, augmentez les charges si la technique reste propre.'
    else if (INTENSE.includes(d.key)) out.adapted = 'Phase folliculaire : bonne fenêtre pour les intensités, visez le haut de la fourchette.'
    else if (d.key === 'z2' && c.day >= 6) return swap('seuil', 'Phase folliculaire : endurance facile remplacée par une séance au seuil (fenêtre favorable).')
  } else if (c.phase === 'ovulatoire') {
    out.adapted = 'Autour de l’ovulation : échauffement articulaire soigné, attention aux sauts et changements de direction (burpees broad jump, fentes).'
  } else if (c.phase === 'luteale') {
    if (INTENSE.includes(d.key)) out.adapted = 'Phase lutéale : température plus élevée, buvez davantage et ajoutez des glucides avant la séance ; intensité selon sensations.'
  } else if (c.phase === 'premenstruelle') {
    if (INTENSE.includes(d.key)) return swap(d.key === 'simu' ? 'ateliers' : 'z2', 'Phase prémenstruelle : séance intense remplacée par un travail plus facile ; reprenez l’intensité après les règles.')
    if (d.key === 'force') out.adapted = 'Phase prémenstruelle : volume de force réduit d’un tiers, priorité à la technique.'
  }
  return out
}

/** Séance de force avec charges calculées sur les 1RM estimés (séances spécialisées) */
function forceDetail(rm, phase) {
  const pct = phase === 'affutage' || phase === 'course' ? 0.7 : phase === 'specifique' ? 0.75 : 0.8
  const reps = pct >= 0.8 ? '4 × 5' : pct >= 0.75 ? '4 × 6' : '3 × 6'
  const L = [['squat', 'Squat'], ['deadlift', 'Soulevé de terre'], ['bench', 'Développé couché'], ['ohp', 'Développé militaire'], ['bentrow', 'Rowing barre'], ['frontsquat', 'Front squat'], ['hipthrust', 'Hip thrust']]
    .filter(([k]) => rm && rm[k]).map(([k, l]) => `${l} ${reps} à ≈ ${Math.round(rm[k] * pct / 2.5) * 2.5} kg`)
  return L.length ? L.join(' · ') + ` (${Math.round(pct * 100)} % du 1RM estimé). Fentes et gainage en fin de séance.` : 'Squat, soulevé de terre, fentes, tirage ; 4 × 6–8. Finir par 10 min de gainage.'
}

/** Entrée « forme du jour » ramenée à l'échelle 0–5 (anciennes saisies 1–5 converties) */
export function wellNorm(e) {
  const d = (e && e.data) || {}
  if (d.v === 2) return d
  const c = x => x == null ? null : Math.round((x - 1) * 1.25 * 10) / 10
  return { fatigue: c(d.fatigue), sleep: c(d.sleep), soreness: c(d.soreness), mood: c(d.mood), v: 2 }
}
const isoMinus = (iso, n) => { const d = new Date(iso + 'T12:00:00'); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10) }
/**
 * Impact de la forme déclarée (échelle 0–5, sommeil : 0 = très mauvais, 5 = excellent)
 *  - jour : saisie d'aujourd'hui ou d'hier → adapte seulement aujourd'hui et demain
 *      fatigue ou courbatures ≥ 4, ou sommeil ≤ 1 → séance intense remplacée par de l'endurance facile
 *      fatigue ou courbatures = 3, ou sommeil = 2 → volume −20 %
 *  - semaine : moyenne des 5 derniers jours (au moins 3 saisies) avec fatigue/courbatures ≥ 3,5 ou sommeil ≤ 1,5
 */
export function wellbeingImpact(entries, today) {
  if (!today || !entries.length) return { day: null, week: null }
  const recent = entries.filter(e => e.day && e.day >= isoMinus(today, 1) && e.day <= today).sort((a, b) => b.day.localeCompare(a.day) || String(b.created_at || '').localeCompare(String(a.created_at || '')))[0]
  let day = null
  if (recent) {
    const w = wellNorm(recent), f = w.fatigue || 0, so = w.soreness || 0, sl = w.sleep
    const why = [f >= 3 && 'fatigue ' + fmt1(f), so >= 3 && 'courbatures ' + fmt1(so), sl != null && sl <= 2 && 'sommeil ' + fmt1(sl)].filter(Boolean).join(', ') + '/5'
    if (f >= 4 || so >= 4 || (sl != null && sl <= 1)) day = { hard: true, why }
    else if (f >= 3 || so >= 3 || (sl != null && sl <= 2)) day = { mid: true, why }
  }
  const last5 = entries.filter(e => e.day && e.day >= isoMinus(today, 4) && e.day <= today).map(wellNorm)
  let week = null
  if (last5.length >= 3) {
    const avg = k => { const v = last5.map(x => x[k]).filter(x => x != null); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null }
    const f = avg('fatigue'), so = avg('soreness'), sl = avg('sleep')
    if ((f != null && f >= 3.5) || (so != null && so >= 3.5) || (sl != null && sl <= 1.5))
      week = [f != null && f >= 3.5 && 'fatigue ' + fmt1(f), so != null && so >= 3.5 && 'courbatures ' + fmt1(so), sl != null && sl <= 1.5 && 'sommeil ' + fmt1(sl)].filter(Boolean).join(', ') + '/5'
  }
  return { day, week }
}
const fmt1 = x => String(Math.round(x * 10) / 10).replace('.', ',')

/**
 * État de récupération d'après la montre : FC au repos et VFC du jour comparées à la moyenne des 28 jours précédents.
 * FC repos ≥ moyenne + 7 ou VFC ≤ 75 % → séance intense allégée ; ≥ + 4 ou ≤ 85 % → volume −20 %.
 */
export function vitalsImpact(entries, today) {
  if (!today || !entries || !entries.length) return null
  const y = isoMinus(today, 1), cur = entries.filter(e => e.day === today || e.day === y).sort((a, b) => b.day.localeCompare(a.day))
  const base = entries.filter(e => e.day < y && e.day >= isoMinus(today, 29))
  const avg = k => { const v = base.map(e => e.data && e.data[k]).filter(x => x != null); return v.length >= 5 ? v.reduce((a, b) => a + b, 0) / v.length : null }
  const val = k => { const e = cur.find(x => x.data && x.data[k] != null); return e ? e.data[k] : null }
  const r = val('rhr'), rb = avg('rhr'), h = val('hrv'), hb = avg('hrv'), why = []
  let hard = false, mid = false
  if (r != null && rb != null) { if (r >= rb + 7) hard = true; else if (r >= rb + 4) mid = true; if (r >= rb + 4) why.push(`FC au repos ${r} bpm (moyenne ${Math.round(rb)})`) }
  if (h != null && hb != null) { if (h <= hb * 0.75) hard = true; else if (h <= hb * 0.85) mid = true; if (h <= hb * 0.85) why.push(`variabilité cardiaque ${h} ms (moyenne ${Math.round(hb)})`) }
  if (!hard && !mid) return null
  return { hard, mid: !hard && mid, why: 'montre : ' + why.join(', ') }
}
