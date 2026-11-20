// Fonction « health-sync » : reçoit automatiquement les données de l'app Santé (iPhone)
// envoyées par le Raccourci « Hyrox Santé » ou par l'application Health Auto Export.
//  · sommeil  → journal privé (une entrée par nuit, sans écraser une saisie manuelle)
//  · FC       → mesures brutes privées, puis rattachement automatique aux séances de l'utilisateur
// Authentification : jeton personnel créé dans l'app (Moi › Réglages › Synchronisation Santé),
// envoyé dans l'en-tête « x-sync-token » (ou « Authorization: Bearer … » pour Health Auto Export).
// À déployer SANS vérification JWT (le jeton personnel remplace la session).
import { createClient } from 'npm:@supabase/supabase-js@2'
import { setLocalTz, extract, nights, nightsFromAggregates, byDay, mergeDay, sessionSeries, extractMetrics, vitalsByDay, periods, extractWorkouts, activityOf } from './logic.ts'

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
  let body: any
  try { body = await req.json() } catch { return json({ error: 'JSON invalide' }, 400) }
  // Jeton : en-tête x-sync-token, « Authorization: Bearer … » ou champ « token » du JSON (plus simple dans Raccourcis)
  const raw = String(req.headers.get('x-sync-token') || (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '') || (body && body.token) || '').trim()
  if (!raw || raw.length < 20) return json({ error: 'Jeton manquant' }, 401)
  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const { data: tok } = await db.from('health_tokens').select('id,user_id').eq('token_hash', await sha(raw)).maybeSingle()
  if (!tok) return json({ error: 'Jeton inconnu ou révoqué' }, 401)
  const uid = tok.user_id
  const { data: prof } = await db.from('profiles').select('consent_health').eq('id', uid).single()
  if (!prof || !prof.consent_health) return json({ error: "Activez « Données de santé » dans l'app" }, 403)

  const tzName = (body && body.timezone) || Deno.env.get('DEFAULT_TZ') || 'Europe/Paris'
  const tz = tzOffset(tzName)
  setLocalTz(tz)
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
