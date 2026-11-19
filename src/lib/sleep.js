// Suivi du sommeil : durée, régularité, dette, et import depuis l'export Santé de l'iPhone.
import { normDate, lineScanner, streamText, streamZip } from './hr.js'

/** Durée en minutes entre deux heures « HH:MM » (coucher la veille → lever) */
export function durationMin(bed, wake) {
  if (!bed || !wake) return null
  const [bh, bm] = bed.split(':').map(Number), [wh, wm] = wake.split(':').map(Number)
  let d = (wh * 60 + wm) - (bh * 60 + bm); if (d <= 0) d += 1440
  return d
}
export const fmtH = m => m == null ? '—' : `${Math.floor(m / 60)} h ${String(Math.round(m % 60)).padStart(2, '0')}`
/** Minutes du coucher rapportées autour de minuit (22:30 → −90, 00:45 → 45) pour mesurer la régularité */
const bedMin = bed => { const [h, m] = bed.split(':').map(Number); const v = h * 60 + m; return v > 720 ? v - 1440 : v }
const sd = a => { if (a.length < 2) return 0; const m = a.reduce((x, y) => x + y, 0) / a.length; return Math.sqrt(a.reduce((x, y) => x + (y - m) ** 2, 0) / (a.length - 1)) }

/**
 * Statistiques sur les N dernières nuits.
 * entries : [{day, data:{asleep (min), bed, wake, quality 1-5, awakenings, nap (min)}}]
 */
export function sleepStats(entries, { days = 7, target = 480, today = new Date() } = {}) {
  const from = new Date(today.getTime() - days * 864e5).toISOString().slice(0, 10)
  const L = entries.filter(e => e.day > from && e.data && e.data.asleep > 0)
  if (!L.length) return null
  const mins = L.map(e => e.data.asleep + (+e.data.nap || 0))
  const avg = mins.reduce((a, b) => a + b, 0) / L.length
  const q = L.filter(e => e.data.quality).map(e => +e.data.quality)
  const beds = L.filter(e => e.data.bed).map(e => bedMin(e.data.bed))
  const debt = L.reduce((a, e, i) => a + Math.max(0, target - mins[i]), 0)
  const short = mins.filter(m => m < 420).length
  return { n: L.length, avg, debt, short, quality: q.length ? q.reduce((a, b) => a + b, 0) / q.length : null, regularity: beds.length >= 3 ? sd(beds) : null, last: L[0] }
}

/** Conseils tirés des statistiques (repères généraux pour sportifs) */
export function sleepAdvice(st, { daysToRace = null } = {}) {
  const out = []
  if (!st) return out
  if (st.avg < 360) out.push({ tone: 'bad', text: `Moyenne de ${fmtH(st.avg)} : nettement insuffisant. La récupération, la force et la prise de décision en pâtissent ; le programme passe en semaine allégée.` })
  else if (st.avg < 420) out.push({ tone: 'bad', text: `Moyenne de ${fmtH(st.avg)} : visez au moins 7 h 30, idéalement 8 h ou plus en période de charge.` })
  else if (st.avg < 480) out.push({ tone: 'even', text: `Moyenne de ${fmtH(st.avg)} : correct ; une demi-heure de plus aiderait la récupération.` })
  else out.push({ tone: 'good', text: `Moyenne de ${fmtH(st.avg)} : bon volume de sommeil.` })
  if (st.debt > 300) out.push({ tone: 'bad', text: `Dette de sommeil de ${fmtH(st.debt)} sur ${st.n} nuits : couchez-vous plus tôt plusieurs soirs, ou ajoutez une sieste de 20 à 30 min en début d’après-midi.` })
  if (st.regularity != null && st.regularity > 60) out.push({ tone: 'bad', text: `Heure de coucher irrégulière (± ${Math.round(st.regularity)} min) : des horaires stables améliorent la qualité du sommeil.` })
  else if (st.regularity != null) out.push({ tone: 'good', text: `Horaires réguliers (± ${Math.round(st.regularity)} min).` })
  if (st.quality != null && st.quality < 2.6) out.push({ tone: 'bad', text: 'Qualité ressentie faible : écrans coupés 1 h avant, chambre fraîche (18–19 °C), pas de caféine après 14 h, dîner léger.' })
  if (daysToRace != null && daysToRace >= 0 && daysToRace <= 7) out.push({ tone: 'even', text: 'Semaine de course : la nuit d’avant compte moins que les 3 à 4 précédentes. Allongez-les ; une nuit agitée juste avant le départ est normale.' })
  if (st.avg < 360 || (st.debt > 600)) out.push({ tone: 'bad', text: 'Fatigue persistante malgré un temps de sommeil suffisant, ronflements ou réveils fréquents : parlez-en à un médecin.' })
  return out
}

/** Import des nuits depuis l'export Santé (export.zip ou export.xml) : une entrée par nuit (date du réveil) */
export async function readAppleSleep(file, onProg) {
  const recs = []
  const reType = /type="HKCategoryTypeIdentifierSleepAnalysis"/, reS = /startDate="([^"]+)"/, reE = /endDate="([^"]+)"/, reV = /value="([^"]+)"/
  const onLine = line => {
    if (line.indexOf('SleepAnalysis"') < 0 || !reType.test(line)) return
    const s = line.match(reS), e = line.match(reE), v = line.match(reV)
    if (!s || !e || !v) return
    const a = normDate(s[1]), b = normDate(e[1]); if (a == null || b == null || b <= a) return
    recs.push({ a, b, v: v[1] })
  }
  const name = file.name.toLowerCase()
  if (name.endsWith('.zip')) await streamZip(file, lineScanner(onLine), onProg)
  else if (name.endsWith('.xml')) await streamText(file, lineScanner(onLine), onProg)
  else throw new Error('Choisissez l’export Santé de l’iPhone (export.zip ou export.xml).')
  return nightsFrom(recs)
}
export function nightsFrom(recs) {
  const nights = {}
  const local = t => { const d = new Date(t); return new Date(d - d.getTimezoneOffset() * 6e4).toISOString() }
  recs.forEach(({ a, b, v }) => {
    // Une nuit est rattachée au jour du réveil ; les siestes de l'après-midi aussi (comptées à part)
    const endISO = local(b), day = endISO.slice(0, 10), hour = +endISO.slice(11, 13)
    const n = nights[day] || (nights[day] = { iv: [], deep: 0, rem: 0, core: 0, awake: 0, nap: 0, start: null, end: null })
    const m = (b - a) / 6e4
    const asleep = /Asleep/.test(v)
    if (asleep && hour >= 13) { n.nap += m; return }
    if (asleep) { n.iv.push([a, b]); if (/Deep/.test(v)) n.deep += m; else if (/REM/.test(v)) n.rem += m; else if (/Core/.test(v)) n.core += m }
    else if (/Awake/.test(v)) n.awake += m
    if (asleep || /InBed/.test(v)) { if (n.start == null || a < n.start) n.start = a; if (n.end == null || b > n.end) n.end = b }
  })
  // Union des plages « endormi » : l'iPhone et la montre enregistrent souvent la même nuit en double
  Object.values(nights).forEach(n => {
    const iv = n.iv.sort((x, y) => x[0] - y[0]); let tot = 0, cur = null
    iv.forEach(([a, b]) => { if (!cur || a > cur[1]) { if (cur) tot += cur[1] - cur[0]; cur = [a, b] } else cur[1] = Math.max(cur[1], b) })
    if (cur) tot += cur[1] - cur[0]
    n.asleep = tot / 6e4
  })
  return Object.entries(nights).filter(([, n]) => n.asleep >= 60).map(([day, n]) => ({
    day, data: { asleep: Math.round(n.asleep), deep: Math.round(n.deep) || null, rem: Math.round(n.rem) || null, awake: Math.round(n.awake) || null, nap: Math.round(n.nap) || null,
      bed: n.start ? local(n.start).slice(11, 16) : null, wake: n.end ? local(n.end).slice(11, 16) : null, source: 'Santé (iPhone)' },
  })).sort((x, y) => y.day.localeCompare(x.day))
}
