// Fonction « health-sync » : reçoit automatiquement les données de l'app Santé (iPhone)
// envoyées par le Raccourci « Hyrox Santé » ou par l'application Health Auto Export.
//  · sommeil  → journal privé (une entrée par nuit, sans écraser une saisie manuelle)
//  · FC       → mesures brutes privées, puis rattachement automatique aux séances de l'utilisateur
// Authentification : jeton personnel créé dans l'app (Moi › Réglages › Synchronisation Santé),
// envoyé dans l'en-tête « x-sync-token » (ou « Authorization: Bearer … » pour Health Auto Export).
// À déployer SANS vérification JWT (le jeton personnel remplace la session).
import { createClient } from 'npm:@supabase/supabase-js@2'


// ---- logique (contenu de logic.ts, regroupé ici pour un copier-coller en un seul fichier) ----
// Lecture des données envoyées par l'iPhone (Raccourci « Hyrox Santé » ou application Health Auto Export).
// Fonctions pures (testées dans tests/healthsync.test.js).

type Sample = [number, number]               // [ms epoch, bpm]
type SleepRec = { a: number; b: number; v: string }

/** Dates acceptées : ISO 8601, « 2026-11-19 18:01:02 +0100 », secondes ou millisecondes epoch */
function parseDate(x: unknown): number | null {
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
function extract(body: any): { hr: Sample[]; sleep: SleepRec[]; sleepNights: any[]; source: string } {
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
function sleepKind(v: string): 'deep' | 'rem' | 'core' | 'asleep' | 'awake' | 'inbed' {
  const s = v.toLowerCase()
  if (/awake|éveil|eveil/.test(s)) return 'awake'
  if (/inbed|in bed|au lit/.test(s)) return 'inbed'
  if (/deep|profond/.test(s)) return 'deep'
  if (/rem|paradox/.test(s)) return 'rem'
  if (/core|léger|leger|essentiel/.test(s)) return 'core'
  return 'asleep'
}

/** Nuits (jour du réveil, heure locale donnée par tzMin) à partir des plages ; doublons iPhone/montre fusionnés */
function nights(recs: SleepRec[], tzMin = 60) {
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
function nightsFromAggregates(list: any[], tzMin = 60) {
  const loc = (t: number) => new Date(t + tzMin * 6e4).toISOString()
  return list.map(n => {
    const end = n.end ?? parseDate(n.date), day = end ? loc(end).slice(0, 10) : String(n.date).slice(0, 10)
    return { day, data: { asleep: n.asleep, deep: n.deep || null, rem: n.rem || null, core: n.core || null, awake: n.awake || null, nap: null, bed: n.start ? loc(n.start).slice(11, 16) : null, wake: n.end ? loc(n.end).slice(11, 16) : null } }
  })
}

/** Répartit les mesures par jour UTC : {day: Map(sec → bpm)} */
function byDay(hr: Sample[]) {
  const out: Record<string, Map<number, number>> = {}
  for (const [t, v] of hr) { const d = new Date(t).toISOString().slice(0, 10), s = Math.round((t - Date.parse(d + 'T00:00:00Z')) / 1000); (out[d] || (out[d] = new Map())).set(s, Math.round(v)) }
  return out
}
/** Fusionne une journée existante {t, bpm} avec de nouvelles mesures */
function mergeDay(old: { t: number[]; bpm: number[] } | null, add: Map<number, number>) {
  const m = new Map<number, number>(); if (old) old.t.forEach((x, i) => m.set(x, old.bpm[i])); add.forEach((v, k) => m.set(k, v))
  const t = [...m.keys()].sort((a, b) => a - b); return { t, bpm: t.map(k => m.get(k) as number) }
}
/** Série d'une séance (secondes depuis le départ) à partir des journées */
function sessionSeries(days: { day: string; t: number[]; bpm: number[] }[], startMs: number, endMs: number) {
  const pts: Sample[] = []
  for (const d of days) { const base = Date.parse(d.day + 'T00:00:00Z'); d.t.forEach((s, i) => { const ms = base + s * 1000; if (ms >= startMs - 60e3 && ms <= endMs + 120e3) pts.push([ms, d.bpm[i]]) }) }
  pts.sort((a, b) => a[0] - b[0])
  const m = new Map<number, number>(); pts.forEach(([ms, v]) => m.set(Math.round((ms - startMs) / 1000), v))
  const t = [...m.keys()].sort((a, b) => a - b); return { t, bpm: t.map(k => m.get(k) as number) }
}

// ------------------------------------------------------------------ autres données de Santé
// Mesures du jour : poids, masse grasse, FC au repos, VFC, VO2max, pas, énergie active, fréquence respiratoire, règles
type Metrics = Record<string, Sample[]>
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
function extractMetrics(body: any): Metrics {
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
  // Raccourci : {metrics: {weight: {dates, values, unit?}, …}} ou directement {weight: {dates, values}}
  const src = body && typeof body.metrics === 'object' && !Array.isArray(body.metrics) ? body.metrics : body || {}
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
function vitalsByDay(m: Metrics, tzMin = 60) {
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
function periods(m: Metrics, tzMin = 60) {
  const D = [...new Set((m.flow || []).map(([t]) => dayOf(t, tzMin)))].sort()
  const out: { start: string; end: string }[] = []
  const gap = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 864e5)
  for (const d of D) { const last = out[out.length - 1]; if (last && gap(last.end, d) <= 2) last.end = d; else out.push({ start: d, end: d }) }
  return out
}

// Entraînements enregistrés par la montre → activités de l'app (si aucune séance chronométrée ne les couvre)
type Workout = { name: string; a: number; b: number; km: number | null; kcal: number | null; hr: number | null }
function extractWorkouts(body: any): Workout[] {
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
const activityOf = (name: string) => (ACT.find(([r]) => r.test(name)) || [null, 'other'])[1]

// ---- serveur ----
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-sync-token', 'Access-Control-Allow-Methods': 'POST, OPTIONS' }
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
async function sha(s: string) { const h = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))); return [...h].map(x => x.toString(16).padStart(2, '0')).join('') }
/** Décalage (minutes) du fuseau de l'utilisateur à une date donnée */
function tzOffset(tz: string, at = Date.now()) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).formatToParts(new Date(at)).map(x => [x.type, x.value]))
  return Math.round((Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute) - Math.floor(at / 6e4) * 6e4) / 6e4)
}

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'POST attendu' }, 405)
  const raw = req.headers.get('x-sync-token') || (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '')
  if (!raw || raw.length < 20) return json({ error: 'Jeton manquant' }, 401)
  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const { data: tok } = await db.from('health_tokens').select('id,user_id').eq('token_hash', await sha(raw)).maybeSingle()
  if (!tok) return json({ error: 'Jeton inconnu ou révoqué' }, 401)
  const uid = tok.user_id
  const { data: prof } = await db.from('profiles').select('consent_health').eq('id', uid).single()
  if (!prof || !prof.consent_health) return json({ error: "Activez « Données de santé » dans l'app" }, 403)

  let body: any
  try { body = await req.json() } catch { return json({ error: 'JSON invalide' }, 400) }
  const tzName = (body && body.timezone) || Deno.env.get('DEFAULT_TZ') || 'Europe/Paris'
  const tz = tzOffset(tzName)
  const { hr, sleep, sleepNights, source } = extract(body)
  const out = { source, hr_points: hr.length, nights: 0, sessions: [] as string[], days: 0, weights: 0, periods: 0, workouts: 0 }
  const AUTO = 'Santé (auto)', isAuto = (d: any) => !!(d && String(d.source || '').startsWith('Santé'))
  const today = new Date(Date.now() + tz * 6e4).toISOString().slice(0, 10)

  // ---- Mesures du jour (FC repos, VFC, VO2max, pas, énergie, respiration) → journal « vitals » ; poids → journal « weight »
  const M = extractMetrics(body), V = vitalsByDay(M, tz), vdays = Object.keys(V)
  if (vdays.length) {
    const { data: ex } = await db.from('journal').select('id,day,kind,data').eq('user_id', uid).in('kind', ['vitals', 'weight']).in('day', vdays)
    for (const d of vdays) {
      const { weight, fat, ...vit } = V[d]
      if (Object.keys(vit).length) {
        const e = (ex || []).find(x => x.day === d && x.kind === 'vitals')
        if (e) await db.from('journal').update({ data: { ...e.data, ...vit, source: AUTO } }).eq('id', e.id)
        else await db.from('journal').insert({ user_id: uid, kind: 'vitals', day: d, data: { ...vit, source: AUTO } })
        out.days++
      }
      if (weight && weight > 25 && weight < 300) {
        const e = (ex || []).find(x => x.day === d && x.kind === 'weight')
        if (e && !isAuto(e.data)) continue                       // une pesée saisie à la main garde la priorité
        const data = { kg: weight, fat: fat ?? (e && e.data.fat) ?? null, source: AUTO }
        if (e) await db.from('journal').update({ data }).eq('id', e.id); else await db.from('journal').insert({ user_id: uid, kind: 'weight', day: d, data })
        out.weights++
      }
    }
    const lastW = vdays.filter(d => V[d].weight).sort().pop()
    if (lastW && lastW >= new Date(Date.now() - 3 * 864e5).toISOString().slice(0, 10)) await db.from('profiles').update({ weight_kg: V[lastW].weight }).eq('id', uid)
  }

  // ---- Règles → journal « cycle » (une entrée par cycle, fin ajoutée quand les règles sont terminées)
  const P = periods(M, tz)
  if (P.length) {
    const { data: cy } = await db.from('journal').select('id,day,data').eq('user_id', uid).eq('kind', 'cycle')
    const near = (a: string, b: string) => Math.abs(Date.parse(a) - Date.parse(b)) <= 4 * 864e5
    for (const p of P) {
      const finished = p.end < new Date(Date.parse(today) - 864e5).toISOString().slice(0, 10)
      const e = (cy || []).find(x => near(x.day, p.start) || (x.data && x.data.end && p.start >= x.day && p.start <= x.data.end))
      if (e) {
        if (isAuto(e.data) || !e.data.end) { const data = { ...e.data, ...(finished ? { end: p.end > (e.data.end || '') ? p.end : e.data.end } : {}), ...(isAuto(e.data) ? { source: AUTO } : {}) }; await db.from('journal').update({ data, ...(isAuto(e.data) && p.start < e.day ? { day: p.start } : {}) }).eq('id', e.id) }
      } else await db.from('journal').insert({ user_id: uid, kind: 'cycle', day: p.start, data: { ...(finished ? { end: p.end } : {}), source: AUTO } })
      out.periods++
    }
  }

  // ---- Entraînements de la montre → activités (si aucune séance chronométrée dans l'app ne les couvre)
  const WK = extractWorkouts(body)
  if (WK.length) {
    const from = new Date(Math.min(...WK.map(w => w.a)) - 864e5).toISOString().slice(0, 10), to = new Date(Math.max(...WK.map(w => w.b)) + 864e5).toISOString().slice(0, 10)
    const { data: ss } = await db.from('sessions').select('id,data,session_date').or(`athletes->>A.eq.${uid},athletes->>B.eq.${uid}`).gte('session_date', from).lte('session_date', to)
    for (const w of WK) {
      const ext = 'hk-' + w.a + '-' + w.name.slice(0, 20)
      const ex = activityOf(w.name), dur = Math.round((w.b - w.a) / 1000), date = new Date(w.a + tz * 6e4).toISOString().slice(0, 10)
      const covered = (ss || []).some(s => { const d = s.data || {}; if (d.extId === ext) return true
        if (d.quick && !d.auto && s.session_date === date && d.steps && d.steps[0] && d.steps[0].ex === ex) return true   // déjà saisie à la main
        const st = d.startedAt; if (!st || d.quick) return false
        const cps = [...(d.cp || []), ...((d.steps || []).map((x: any) => x.e))].filter((v: any) => v != null); const en = st + (cps.length ? Math.max(...cps) : 36e5)
        return st < w.b + 30 * 6e4 && en > w.a - 30 * 6e4 })
      if (covered) continue
      const step = { g: 0, set: 1, of: 1, ex, name: ex === 'other' ? w.name : '', rest: 0, w: 'A', target: {}, note: '', s: 0, e: dur * 1000, done: { time: dur, meters: w.km ? Math.round(w.km * 1000) : null, rpe: null } }
      await db.from('sessions').insert({ owner: uid, team_id: null, kind: 'entrainement', session_date: date, name: w.name, athletes: { A: uid, B: null }, names: { A: null, B: null },
        data: { format: 'custom', quick: true, auto: true, extId: ext, title: w.name, startedAt: 0, steps: [step], blocks: [{ ex, name: step.name, sets: 1, rest: 0, w: 'A', target: {}, note: '' }], note: 'Importé de l’app Santé', ...(w.hr ? { avgHR: Math.round(w.hr) } : {}), ...(w.kcal ? { kcal: Math.round(w.kcal) } : {}), startMs: w.a } })
      out.workouts++
    }
  }

  // ---- Sommeil : une entrée par nuit ; une saisie manuelle n'est jamais écrasée
  const N = [...nights(sleep, tz), ...nightsFromAggregates(sleepNights, tz)]
  if (N.length) {
    const days = N.map(n => n.day)
    const { data: ex } = await db.from('journal').select('id,day,data').eq('user_id', uid).eq('kind', 'sleep').in('day', days)
    for (const n of N) {
      const e = (ex || []).find(x => x.day === n.day), data = { ...n.data, source: 'Santé (auto)' }
      if (e && !(e.data && String(e.data.source || '').startsWith('Santé'))) continue
      if (e) await db.from('journal').update({ data }).eq('id', e.id)
      else await db.from('journal').insert({ user_id: uid, kind: 'sleep', day: n.day, data })
      out.nights++
    }
  }

  // ---- Fréquence cardiaque : stockage par jour puis rattachement aux séances couvertes
  if (hr.length) {
    const groups = byDay(hr), days = Object.keys(groups)
    const { data: old } = await db.from('hr_samples').select('day,t,bpm').eq('user_id', uid).in('day', days)
    const merged: { day: string; t: number[]; bpm: number[] }[] = []
    for (const d of days) {
      const m = mergeDay((old || []).find(o => o.day === d) || null, groups[d])
      await db.from('hr_samples').upsert({ user_id: uid, day: d, t: m.t, bpm: m.bpm, source, updated_at: new Date().toISOString() })
      merged.push({ day: d, ...m })
    }
    const minT = Math.min(...hr.map(x => x[0])), maxT = Math.max(...hr.map(x => x[0]))
    // Séances où l'utilisateur est athlète et qui ont démarré dans la plage reçue (± 4 h)
    const { data: ss } = await db.from('sessions').select('id,data,athletes').or(`athletes->>A.eq.${uid},athletes->>B.eq.${uid}`).gte('session_date', new Date(minT - 864e5).toISOString().slice(0, 10)).lte('session_date', new Date(maxT + 864e5).toISOString().slice(0, 10))
    for (const s of ss || []) {
      const st = s.data && (s.data.startedAt || s.data.startMs); if (!st || st < minT - 4 * 36e5 || st > maxT) continue
      const cps = [...(s.data.cp || []), ...((s.data.steps || []).map((x: any) => x.e))].filter((v: number | null) => v != null)   // séance Hyrox ou spécialisée
      const end = st + (cps.length ? Math.max(...cps) : 3 * 36e5)
      const { data: cur } = await db.from('hr_series').select('source').eq('session_id', s.id).eq('user_id', uid).maybeSingle()
      if (cur && !String(cur.source || '').startsWith('Santé (auto)')) continue   // un import manuel garde la priorité
      // Toutes les journées utiles (y compris déjà stockées)
      const need = [new Date(st).toISOString().slice(0, 10), new Date(end).toISOString().slice(0, 10)]
      const { data: dd } = await db.from('hr_samples').select('day,t,bpm').eq('user_id', uid).in('day', [...new Set(need)])
      const ser = sessionSeries(dd || merged, st, end)
      if (ser.t.length < 10) continue
      await db.from('hr_series').upsert({ session_id: s.id, user_id: uid, t: ser.t, bpm: ser.bpm, source: 'Santé (auto) · ' + source, offset_s: 0, updated_at: new Date().toISOString() })
      out.sessions.push(s.id)
    }
  }

  await db.from('health_tokens').update({ last_used: new Date().toISOString(), last_summary: [`${out.hr_points} mesures FC`, `${out.nights} nuit(s)`, out.days && `${out.days} jour(s) de mesures`, out.weights && `${out.weights} pesée(s)`, out.periods && 'cycle', out.workouts && `${out.workouts} entraînement(s)`, `${out.sessions.length} séance(s) avec cardio`].filter(Boolean).join(' · ') }).eq('id', tok.id)
  return json({ ok: true, ...out })
})
