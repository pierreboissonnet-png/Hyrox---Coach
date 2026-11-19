// Lecture des données envoyées par l'iPhone (Raccourci « Hyrox Santé » ou application Health Auto Export).
// Fonctions pures (testées dans tests/healthsync.test.js).

export type Sample = [number, number]               // [ms epoch, bpm]
export type SleepRec = { a: number; b: number; v: string }

/** Dates acceptées : ISO 8601, « 2026-11-19 18:01:02 +0100 », secondes ou millisecondes epoch */
export function parseDate(x: unknown): number | null {
  if (x == null || x === '') return null
  if (typeof x === 'number') return x > 1e11 ? x : x * 1000
  const s = String(x).trim()
  if (/^\d{9,13}(\.\d+)?$/.test(s)) { const n = +s; return n > 1e11 ? n : n * 1000 }
  let m = s.match(/^(\d{4}-\d\d-\d\d)[ T](\d\d:\d\d(?::\d\d(?:\.\d+)?)?)\s*(Z|[+-]\d\d:?\d\d)?$/)
  if (m) { const tz = m[3] ? (m[3] === 'Z' ? 'Z' : m[3].replace(/^([+-]\d\d)(\d\d)$/, '$1:$2')) : ''; const t = Date.parse(`${m[1]}T${m[2].length === 5 ? m[2] + ':00' : m[2]}${tz}`); return isNaN(t) ? null : t }
  const t = Date.parse(s); return isNaN(t) ? null : t
}
const list = (x: unknown): unknown[] => Array.isArray(x) ? x : typeof x === 'string' ? x.split(/\r?\n/).map(v => v.trim()).filter(v => v !== '') : []
const num = (x: unknown) => { const v = parseFloat(String(x).replace(',', '.').replace(/[^\d.\-]/g, '')); return isFinite(v) ? v : null }

/** Extrait les mesures de FC et les plages de sommeil, quel que soit l'expéditeur */
export function extract(body: any): { hr: Sample[]; sleep: SleepRec[]; sleepNights: any[]; source: string } {
  const hr: Sample[] = [], sleep: SleepRec[] = [], sleepNights: any[] = []
  let source = 'Raccourci iPhone'
  // 1) Health Auto Export : {data:{metrics:[{name:'heart_rate', data:[{date, Avg|qty}]}, {name:'sleep_analysis', data:[…]}]}}
  const metrics = body && body.data && Array.isArray(body.data.metrics) ? body.data.metrics : null
  if (metrics) {
    source = 'Health Auto Export'
    for (const mt of metrics) {
      const name = String(mt.name || '').toLowerCase()
      if (name === 'heart_rate') for (const d of mt.data || []) { const t = parseDate(d.date), v = num(d.Avg ?? d.avg ?? d.qty ?? d.value); if (t != null && v != null) hr.push([t, v]) }
      if (name === 'sleep_analysis') for (const d of mt.data || []) {
        if (d.startDate && d.endDate && d.value) { const a = parseDate(d.startDate), b = parseDate(d.endDate); if (a != null && b != null) sleep.push({ a, b, v: String(d.value) }) }
        else {
          const h = (k: string) => { const v = num(d[k]); return v == null ? null : Math.round(v * 60) }   // heures → minutes
          const asleep = h('totalSleep') ?? h('asleep')
          if (asleep && asleep >= 60) sleepNights.push({ start: parseDate(d.sleepStart ?? d.inBedStart), end: parseDate(d.sleepEnd ?? d.inBedEnd), date: d.date, asleep, deep: h('deep'), rem: h('rem'), core: h('core'), awake: h('awake') })
        }
      }
    }
    return { hr, sleep, sleepNights, source }
  }
  // 2) Raccourci : {heart_rate:{dates, values}, sleep:{starts, ends, values}} — listes ou textes (une valeur par ligne)
  const H = body && (body.heart_rate || body.hr)
  if (H) { const ds = list(H.dates), vs = list(H.values); for (let i = 0; i < Math.min(ds.length, vs.length); i++) { const t = parseDate(ds[i]), v = num(vs[i]); if (t != null && v != null) hr.push([t, v]) } }
  const S = body && body.sleep
  if (S) { const as = list(S.starts), bs = list(S.ends), vs = list(S.values); for (let i = 0; i < Math.min(as.length, bs.length); i++) { const a = parseDate(as[i]), b = parseDate(bs[i]); if (a != null && b != null && b > a) sleep.push({ a, b, v: String(vs[i] ?? 'Asleep') }) } }
  return { hr: hr.filter(([, v]) => v > 25 && v < 250), sleep, sleepNights, source }
}

/** Catégorie d'une plage de sommeil (valeurs anglaises ou françaises de Santé) */
export function sleepKind(v: string): 'deep' | 'rem' | 'core' | 'asleep' | 'awake' | 'inbed' {
  const s = v.toLowerCase()
  if (/awake|éveil|eveil/.test(s)) return 'awake'
  if (/inbed|in bed|au lit/.test(s)) return 'inbed'
  if (/deep|profond/.test(s)) return 'deep'
  if (/rem|paradox/.test(s)) return 'rem'
  if (/core|léger|leger|essentiel/.test(s)) return 'core'
  return 'asleep'
}

/** Nuits (jour du réveil, heure locale donnée par tzMin) à partir des plages ; doublons iPhone/montre fusionnés */
export function nights(recs: SleepRec[], tzMin = 60) {
  const N: Record<string, any> = {}
  const loc = (t: number) => new Date(t + tzMin * 6e4).toISOString()
  for (const { a, b, v } of recs) {
    const k = sleepKind(v), end = loc(b), day = end.slice(0, 10), hour = +end.slice(11, 13), m = (b - a) / 6e4
    const n = N[day] || (N[day] = { iv: [], deep: 0, rem: 0, core: 0, awake: 0, nap: 0, start: null, end: null })
    const asleep = k !== 'awake' && k !== 'inbed'
    if (asleep && hour >= 13) { n.nap += m; continue }
    if (asleep) { n.iv.push([a, b]); if (k === 'deep') n.deep += m; if (k === 'rem') n.rem += m; if (k === 'core') n.core += m }
    if (k === 'awake') n.awake += m
    if (k !== 'awake') { if (n.start == null || a < n.start) n.start = a; if (n.end == null || b > n.end) n.end = b }
  }
  return Object.entries(N).map(([day, n]) => {
    const iv = n.iv.sort((x: number[], y: number[]) => x[0] - y[0]); let tot = 0, cur: number[] | null = null
    for (const [a, b] of iv) { if (!cur || a > cur[1]) { if (cur) tot += cur[1] - cur[0]; cur = [a, b] } else cur[1] = Math.max(cur[1], b) }
    if (cur) tot += cur[1] - cur[0]
    return { day, data: { asleep: Math.round(tot / 6e4), deep: Math.round(n.deep) || null, rem: Math.round(n.rem) || null, core: Math.round(n.core) || null, awake: Math.round(n.awake) || null, nap: Math.round(n.nap) || null,
      bed: n.start ? loc(n.start).slice(11, 16) : null, wake: n.end ? loc(n.end).slice(11, 16) : null } }
  }).filter(x => x.data.asleep >= 60)
}

/** Nuits déjà agrégées (Health Auto Export) */
export function nightsFromAggregates(list: any[], tzMin = 60) {
  const loc = (t: number) => new Date(t + tzMin * 6e4).toISOString()
  return list.map(n => {
    const end = n.end ?? parseDate(n.date), day = end ? loc(end).slice(0, 10) : String(n.date).slice(0, 10)
    return { day, data: { asleep: n.asleep, deep: n.deep || null, rem: n.rem || null, core: n.core || null, awake: n.awake || null, nap: null, bed: n.start ? loc(n.start).slice(11, 16) : null, wake: n.end ? loc(n.end).slice(11, 16) : null } }
  })
}

/** Répartit les mesures par jour UTC : {day: Map(sec → bpm)} */
export function byDay(hr: Sample[]) {
  const out: Record<string, Map<number, number>> = {}
  for (const [t, v] of hr) { const d = new Date(t).toISOString().slice(0, 10), s = Math.round((t - Date.parse(d + 'T00:00:00Z')) / 1000); (out[d] || (out[d] = new Map())).set(s, Math.round(v)) }
  return out
}
/** Fusionne une journée existante {t, bpm} avec de nouvelles mesures */
export function mergeDay(old: { t: number[]; bpm: number[] } | null, add: Map<number, number>) {
  const m = new Map<number, number>(); if (old) old.t.forEach((x, i) => m.set(x, old.bpm[i])); add.forEach((v, k) => m.set(k, v))
  const t = [...m.keys()].sort((a, b) => a - b); return { t, bpm: t.map(k => m.get(k) as number) }
}
/** Série d'une séance (secondes depuis le départ) à partir des journées */
export function sessionSeries(days: { day: string; t: number[]; bpm: number[] }[], startMs: number, endMs: number) {
  const pts: Sample[] = []
  for (const d of days) { const base = Date.parse(d.day + 'T00:00:00Z'); d.t.forEach((s, i) => { const ms = base + s * 1000; if (ms >= startMs - 60e3 && ms <= endMs + 120e3) pts.push([ms, d.bpm[i]]) }) }
  pts.sort((a, b) => a[0] - b[0])
  const m = new Map<number, number>(); pts.forEach(([ms, v]) => m.set(Math.round((ms - startMs) / 1000), v))
  const t = [...m.keys()].sort((a, b) => a - b); return { t, bpm: t.map(k => m.get(k) as number) }
}
