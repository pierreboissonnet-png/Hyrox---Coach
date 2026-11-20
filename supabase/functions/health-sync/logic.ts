// Lecture des données envoyées par l'iPhone (Raccourci « Hyrox Santé » ou application Health Auto Export).
// Fonctions pures (testées dans tests/healthsync.test.js).

export type Sample = [number, number]               // [ms epoch, bpm]
export type SleepRec = { a: number; b: number; v: string }

// Fuseau de l'utilisateur (minutes), pour les dates sans fuseau écrites « à la française » par Raccourcis
let LOCAL_TZ = 60
export function setLocalTz(min: number) { LOCAL_TZ = min }
const MOIS: Record<string, number> = { janv: 1, jan: 1, janvier: 1, fevr: 2, févr: 2, fev: 2, fév: 2, fevrier: 2, février: 2, mars: 3, avr: 4, avril: 4, mai: 5, juin: 6, juil: 7, juillet: 7, aout: 8, août: 8, sept: 9, septembre: 9, oct: 10, octobre: 10, nov: 11, novembre: 11, dec: 12, déc: 12, decembre: 12, décembre: 12 }
/** « 19 nov. 2026 à 07:05 », « 19 novembre 2026 à 07:05:12 », « 19/11/2026 07:05 » (heure locale) */
function parseFr(s: string): number | null {
  let m = s.match(/^(\d{1,2})\s+([a-zéûè]+)\.?\s+(\d{4})(?:\s+(?:à\s+)?(\d{1,2})[:h](\d{2})(?::(\d{2}))?)?/i), y, mo, d
  if (m) { mo = MOIS[m[2].toLowerCase()]; if (!mo) return null; d = +m[1]; y = +m[3] }
  else { m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(?:à\s+)?(\d{1,2})[:h](\d{2})(?::(\d{2}))?)?/); if (!m) return null; d = +m[1]; mo = +m[2]; y = +m[3] }
  return Date.UTC(y, mo - 1, d, +(m[4] || 0), +(m[5] || 0), +(m[6] || 0)) - LOCAL_TZ * 6e4
}

/** Dates acceptées : ISO 8601, « 2026-11-19 18:01:02 +0100 », format français, secondes ou millisecondes epoch */
export function parseDate(x: unknown): number | null {
  if (x == null || x === '') return null
  if (typeof x === 'number') return x > 1e11 ? x : x * 1000
  const s = String(x).trim().replace(/\u202f|\u00a0/g, ' ')
  const fr = parseFr(s); if (fr != null) return fr
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
  // Champs à plat (raccourci simplifié) : dates/values = FC ; starts/ends/values = sommeil
  const flatSleep = body && body.starts && body.ends ? { starts: body.starts, ends: body.ends, values: body.values } : null
  const H = body && (body.heart_rate || body.hr || (!flatSleep && body.dates && body.values ? { dates: body.dates, values: body.values } : null))
  if (H) { const ds = list(H.dates), vs = list(H.values); for (let i = 0; i < Math.min(ds.length, vs.length); i++) { const t = parseDate(ds[i]), v = num(vs[i]); if (t != null && v != null) hr.push([t, v]) } }
  const S = body && (body.sleep || flatSleep)
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

// ------------------------------------------------------------------ autres données de Santé
// Mesures du jour : poids, masse grasse, FC au repos, VFC, VO2max, pas, énergie active, fréquence respiratoire, règles
export type Metrics = Record<string, Sample[]>
const ALIASES: Record<string, string[]> = {
  weight: ['weight_body_mass', 'body_mass', 'weight', 'poids'], fat: ['body_fat_percentage', 'body_fat', 'masse_grasse', 'fat'],
  rhr: ['resting_heart_rate', 'rhr', 'fc_repos'], hrv: ['heart_rate_variability', 'heart_rate_variability_sdnn', 'hrv', 'vfc'],
  vo2: ['vo2_max', 'vo2max', 'vo2'], steps: ['step_count', 'steps', 'pas'], kcal: ['active_energy', 'active_energy_burned', 'active_kcal', 'energie_active', 'kcal'],
  resp: ['respiratory_rate', 'frequence_respiratoire'], flow: ['menstrual_flow', 'menstruation', 'regles', 'flow'],
}
const keyOf = (name: string) => { const n = name.toLowerCase().replace(/[\s-]+/g, '_'); return Object.keys(ALIASES).find(k => ALIASES[k].includes(n)) || null }
/** Valeur ramenée à l'unité de l'app (kg, %, bpm, ms, mL/kg/min, pas, kcal) */
function conv(key: string, v: number, unit = '') {
  const u = unit.toLowerCase()
  if (key === 'weight' && /lb/.test(u)) return v * 0.45359237
  if (key === 'kcal' && /kj/.test(u)) return v / 4.184
  if (key === 'fat' && v > 0 && v <= 1) return v * 100
  return v
}
const flowVal = (v: unknown) => { const s = String(v ?? '').toLowerCase(); if (/none|aucun|^0$/.test(s)) return 0; const n = num(v); return n != null ? n : s ? 1 : 0 }
export function extractMetrics(body: any): Metrics {
  const out: Metrics = {}
  const push = (k: string, t: number | null, v: number | null) => { if (t == null || v == null || !isFinite(v)) return; (out[k] = out[k] || []).push([t, v]) }
  const metrics = body && body.data && Array.isArray(body.data.metrics) ? body.data.metrics : null
  if (metrics) {
    for (const mt of metrics) {
      const k = keyOf(String(mt.name || '')); if (!k) continue
      for (const d of mt.data || []) {
        const t = parseDate(d.date ?? d.startDate)
        if (k === 'flow') { if (flowVal(d.value ?? d.qty) > 0) push(k, t, 1); continue }
        const v = num(d.qty ?? d.Avg ?? d.avg ?? d.value); push(k, t, v == null ? null : conv(k, v, mt.units))
      }
    }
    return out
  }
  // Raccourci : {metrics: {weight: {dates, values}}}, {weight: {dates, values}} ou à plat {weight_dates, weight_values}
  const src: any = { ...(body && typeof body.metrics === 'object' && !Array.isArray(body.metrics) ? body.metrics : body || {}) }
  for (const k of Object.keys(body || {})) { const m = k.match(/^(.+)_dates$/); if (m && body[m[1] + '_values'] != null) src[m[1]] = { dates: body[k], values: body[m[1] + '_values'] } }
  for (const name of Object.keys(src)) {
    const k = keyOf(name), M = src[name]; if (!k || !M || typeof M !== 'object') continue
    const ds = list(M.dates), vs = list(M.values)
    for (let i = 0; i < ds.length; i++) {
      const t = parseDate(ds[i])
      if (k === 'flow') { if (flowVal(vs[i] ?? 1) > 0) push(k, t, 1); continue }
      const v = num(vs[i]); push(k, t, v == null ? null : conv(k, v, M.unit))
    }
  }
  return out
}
const dayOf = (t: number, tzMin: number) => new Date(t + tzMin * 6e4).toISOString().slice(0, 10)
/** Agrégat par jour local : pas et énergie additionnés, poids/VO2 = dernière valeur, FC repos = min, VFC/resp = moyenne */
export function vitalsByDay(m: Metrics, tzMin = 60) {
  const days: Record<string, any> = {}
  const acc: Record<string, Record<string, number[]>> = {}
  for (const k of Object.keys(m)) for (const [t, v] of [...m[k]].sort((a, b) => a[0] - b[0])) { if (k === 'flow') continue; const d = dayOf(t, tzMin); ((acc[d] = acc[d] || {})[k] = acc[d][k] || []).push(v) }
  for (const d of Object.keys(acc)) {
    const a = acc[d], o: any = {}, avg = (x: number[]) => x.reduce((p, q) => p + q, 0) / x.length, r1 = (x: number) => Math.round(x * 10) / 10
    if (a.steps) o.steps = Math.round(a.steps.reduce((p, q) => p + q, 0))
    if (a.kcal) o.kcal = Math.round(a.kcal.reduce((p, q) => p + q, 0))
    if (a.rhr) o.rhr = Math.round(Math.min(...a.rhr))
    if (a.hrv) o.hrv = Math.round(avg(a.hrv))
    if (a.resp) o.resp = r1(avg(a.resp))
    if (a.vo2) o.vo2 = r1(a.vo2[a.vo2.length - 1])
    if (a.weight) o.weight = r1(a.weight[a.weight.length - 1])
    if (a.fat) o.fat = r1(a.fat[a.fat.length - 1])
    days[d] = o
  }
  return days
}
/** Jours de règles consécutifs (1 jour d'écart toléré) → périodes {start, end} */
export function periods(m: Metrics, tzMin = 60) {
  const D = [...new Set((m.flow || []).map(([t]) => dayOf(t, tzMin)))].sort()
  const out: { start: string; end: string }[] = []
  const gap = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 864e5)
  for (const d of D) { const last = out[out.length - 1]; if (last && gap(last.end, d) <= 2) last.end = d; else out.push({ start: d, end: d }) }
  return out
}

// Entraînements enregistrés par la montre → activités de l'app (si aucune séance chronométrée ne les couvre)
export type Workout = { name: string; a: number; b: number; km: number | null; kcal: number | null; hr: number | null }
export function extractWorkouts(body: any): Workout[] {
  const out: Workout[] = []
  const W = body && body.data && Array.isArray(body.data.workouts) ? body.data.workouts : null
  const q = (x: any) => x == null ? null : typeof x === 'object' ? num(x.qty) : num(x)
  if (W) for (const w of W) {
    const a = parseDate(w.start), b = parseDate(w.end); if (a == null || b == null || b <= a) continue
    let km = q(w.distance); const du = String((w.distance && w.distance.units) || '').toLowerCase(); if (km != null && /mi/.test(du)) km *= 1.609; if (km != null && /^m$/.test(du)) km /= 1000
    let kcal = q(w.activeEnergyBurned ?? w.activeEnergy); if (kcal != null && /kj/.test(String((w.activeEnergyBurned || {}).units || '').toLowerCase())) kcal /= 4.184
    out.push({ name: String(w.name || 'Entraînement'), a, b, km, kcal, hr: q(w.avgHeartRate ?? w.heartRate?.avg) })
  }
  const S = body && body.workouts && !Array.isArray(body.workouts) ? body.workouts : null
  if (S) { const n = list(S.names), as = list(S.starts), bs = list(S.ends), ks = list(S.distances), cs = list(S.kcal), hs = list(S.avg_hr)
    for (let i = 0; i < Math.min(as.length, bs.length); i++) { const a = parseDate(as[i]), b = parseDate(bs[i]); if (a != null && b != null && b > a) out.push({ name: String(n[i] ?? 'Entraînement'), a, b, km: num(ks[i]), kcal: num(cs[i]), hr: num(hs[i]) }) } }
  return out.filter(w => w.b - w.a >= 5 * 6e4)
}
const ACT: [RegExp, string][] = [[/run|course|jog/i, 'run'], [/cycl|vélo|velo|bike|spin/i, 'bike'], [/row|aviron|rameur/i, 'row'], [/swim|natation|nage/i, 'swim'], [/hik|rando/i, 'hike'], [/walk|marche/i, 'walk'],
  [/ellipt/i, 'elliptical'], [/stair|escalier/i, 'stairs'], [/yoga|pilates/i, 'yoga'], [/tennis|padel|squash|badminton|racket|raquette/i, 'racket'], [/soccer|football|basket|hand|rugby|volley|team|collectif/i, 'teamsport'],
  [/climb|escalade/i, 'climbing'], [/box|martial|kick|combat|judo|karat/i, 'combat'], [/ski|snow|surf des neiges/i, 'winter'], [/strength|renfo|muscu|functional|fonctionnel|cross|hiit|core|training|circuit/i, 'strength']]
export const activityOf = (name: string) => (ACT.find(([r]) => r.test(name)) || [null, 'other'])[1]
