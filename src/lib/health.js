// Suivi santé : marqueurs sanguins (repères indicatifs) et cycle menstruel.
// Les valeurs de référence varient selon les laboratoires : celles du compte rendu font foi.

export const MARKERS = [
  { id: 'ferritine', label: 'Ferritine', unit: 'µg/L', ref: { F: [15, 150], M: [30, 400] }, why: 'Réserves de fer ; basse = fatigue, baisse d’endurance.' },
  { id: 'hb', label: 'Hémoglobine', unit: 'g/dL', ref: { F: [12, 16], M: [13, 17] }, why: 'Transport de l’oxygène.' },
  { id: 'vitd', label: 'Vitamine D (25-OH)', unit: 'ng/mL', ref: { all: [30, 60] }, why: 'Os, muscles, immunité.' },
  { id: 'crp', label: 'CRP', unit: 'mg/L', ref: { all: [0, 5] }, why: 'Inflammation ou infection (peut monter juste après un effort intense).' },
  { id: 'ck', label: 'CK (créatine kinase)', unit: 'U/L', ref: { F: [25, 170], M: [40, 200] }, why: 'Dommages musculaires ; très élevée 24–72 h après une séance dure.' },
  { id: 'tsh', label: 'TSH', unit: 'mUI/L', ref: { all: [0.4, 4] }, why: 'Thyroïde : énergie, métabolisme.' },
  { id: 'glycemie', label: 'Glycémie à jeun', unit: 'g/L', ref: { all: [0.7, 1.0] }, why: 'Sucre sanguin.' },
  { id: 'magnesium', label: 'Magnésium', unit: 'mmol/L', ref: { all: [0.7, 1.0] }, why: 'Contraction musculaire.' },
  { id: 'cortisol', label: 'Cortisol (matin)', unit: 'µg/dL', ref: { all: [6, 23] }, why: 'Stress, récupération (prélèvement à 8 h).' },
  { id: 'testo', label: 'Testostérone totale', unit: 'ng/mL', ref: { F: [0.1, 0.6], M: [3, 10] }, why: 'Récupération, masse musculaire ; basse si surentraînement ou déficit énergétique.' },
  // Hormones féminines : pas de norme unique, elles varient selon la phase du cycle
  { id: 'oestradiol', label: 'Œstradiol', unit: 'pg/mL', ref: null, sex: 'F', why: 'Varie selon la phase du cycle : notez le jour du cycle.' },
  { id: 'progesterone', label: 'Progestérone', unit: 'ng/mL', ref: null, sex: 'F', why: 'Élevée en phase lutéale ; notez le jour du cycle.' },
  { id: 'lh', label: 'LH', unit: 'UI/L', ref: null, sex: 'F', why: 'Pic à l’ovulation.' },
  { id: 'fsh', label: 'FSH', unit: 'UI/L', ref: null, sex: 'F', why: 'Varie selon la phase du cycle.' },
]
export const markersFor = sex => MARKERS.filter(m => !m.sex || m.sex === sex)
export function refOf(m, sex) { if (!m.ref) return null; return m.ref.all || m.ref[sex === 'F' ? 'F' : 'M'] }
export function flag(m, sex, v) {
  const r = refOf(m, sex); if (!r || v == null || v === '') return ''
  return +v < r[0] ? 'bas' : +v > r[1] ? 'haut' : 'ok'
}

/**
 * Cycle menstruel déclaré : entrées {day: début des règles, data: {end: fin des règles, symptoms}}.
 * Phases : menstruelle (règles), folliculaire, ovulatoire (autour de J = durée − 14), lutéale, prémenstruelle (5 derniers jours).
 */
const D0 = s => new Date(s + 'T00:00:00')
const diff = (a, b) => Math.round((D0(b) - D0(a)) / 864e5)
const isoOf = d => new Date(d - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10)
export function cycles(entries) {
  const L = [...entries].filter(e => e && e.day).sort((a, b) => a.day.localeCompare(b.day))
  return L.map((e, i) => {
    const next = L[i + 1], end = e.data && e.data.end
    const len = next ? diff(e.day, next.day) : null, period = end ? diff(e.day, end) + 1 : null
    return { id: e.id, start: e.day, end: end || null, len: len >= 18 && len <= 45 ? len : null, period: period >= 1 && period <= 10 ? period : null, symptoms: (e.data && e.data.symptoms) || '' }
  })
}
const mean = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : null
export function cycleAverages(entries) {
  const C = cycles(entries)
  const lens = C.map(c => c.len).filter(Boolean).slice(-6), per = C.map(c => c.period).filter(Boolean).slice(-6)
  return { len: Math.round(mean(lens) || 28), period: Math.round(mean(per) || 5), irregular: lens.length >= 3 && Math.max(...lens) - Math.min(...lens) > 9, n: C.length }
}
/** Phase du cycle à une date (ISO) ; null si aucune donnée antérieure */
export function phaseOn(entries, iso) {
  const C = cycles(entries); if (!C.length) return null
  const avg = cycleAverages(entries)
  let c = null; for (const x of C) if (x.start <= iso) c = x
  if (!c) return null
  const len = c.len || avg.len, period = c.period || (c.end ? null : avg.period) || avg.period
  let day = diff(c.start, iso) + 1
  const late = !c.len && day > len
  if (!c.len && day > len) day = ((day - 1) % len) + 1   // projection au-delà du dernier cycle déclaré
  const ov = len - 14
  const phase = day <= period ? 'menstruelle' : day < ov - 1 ? 'folliculaire' : day <= ov + 1 ? 'ovulatoire' : day > len - 5 ? 'premenstruelle' : 'luteale'
  return { day, len, period, phase, projected: !c.len && diff(c.start, iso) + 1 > len, late, symptoms: day <= period ? c.symptoms : '', start: c.start }
}
/** Résumé du cycle en cours (compatibilité) */
export function cycleInfo(entries, today = new Date()) {
  if (!entries || !entries.length) return null
  // accepte une liste de dates (ancienne forme) ou d'entrées
  const E = typeof entries[0] === 'string' ? entries.map(d => ({ day: d, data: {} })) : entries
  const iso = isoOf(today), ph = phaseOn(E, iso); if (!ph) return null
  const avg = cycleAverages(E)
  const last = cycles(E).slice(-1)[0]
  const next = isoOf(new Date(D0(last.start).getTime() + Math.ceil((diff(last.start, iso) + 1) / ph.len) * ph.len * 864e5))
  return { ...ph, len: ph.len, next, irregular: avg.irregular, periodAvg: avg.period }
}
export const PHASE_LABEL = { menstruelle: 'Menstruelle', folliculaire: 'Folliculaire', ovulatoire: 'Ovulatoire', luteale: 'Lutéale', premenstruelle: 'Prémenstruelle' }
export const PHASE_COLOR = { menstruelle: '#ff375f', folliculaire: '#30d158', ovulatoire: '#ffd60a', luteale: '#bf5af2', premenstruelle: '#ff9f0a' }

// ---------- pondération des performances selon la phase ----------
// Effet moyen a priori (fraction de temps en plus). Les études montrent des effets faibles et très individuels :
// on part de ces valeurs prudentes puis on les remplace progressivement par vos propres données.
export const PRIOR = { menstruelle: 0.015, folliculaire: 0, ovulatoire: 0, luteale: 0.005, premenstruelle: 0.012 }
/**
 * points : [{phase, rel}] avec rel = (temps − objectif) / objectif d'une séance
 * Renvoie {phase: {n, effect, mean}} ; effect = écart à votre moyenne, rapproché de PRIOR quand il y a peu de séances
 */
export function phaseEffects(points, k = 2) {
  const all = mean(points.map(p => p.rel)) ?? 0, out = {}
  Object.keys(PRIOR).forEach(ph => {
    const L = points.filter(p => p.phase === ph).map(p => p.rel), n = L.length, m = n ? mean(L) - all : 0
    out[ph] = { n, mean: n ? mean(L) : null, effect: (n * m + k * PRIOR[ph]) / (n + k) }
  })
  return out
}
/** Temps « ramené à une phase neutre » */
export const adjustTime = (t, phase, effects) => t / (1 + ((effects && effects[phase]) ? effects[phase].effect : PRIOR[phase] || 0))
/** Poids d'une séance dans les moyennes (prédictions) : les séances en phase défavorable comptent moins */
export const phaseWeight = (phase, effects) => Math.max(0.5, 1 - 15 * Math.max(0, (effects && effects[phase] ? effects[phase].effect : PRIOR[phase] || 0)))
