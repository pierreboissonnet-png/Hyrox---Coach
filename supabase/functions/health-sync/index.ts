// Fonction « health-sync » : reçoit automatiquement les données de l'app Santé (iPhone)
// envoyées par le Raccourci « Hyrox Santé » ou par l'application Health Auto Export.
//  · sommeil  → journal privé (une entrée par nuit, sans écraser une saisie manuelle)
//  · FC       → mesures brutes privées, puis rattachement automatique aux séances de l'utilisateur
// Authentification : jeton personnel créé dans l'app (Moi › Réglages › Synchronisation Santé),
// envoyé dans l'en-tête « x-sync-token » (ou « Authorization: Bearer … » pour Health Auto Export).
// À déployer SANS vérification JWT (le jeton personnel remplace la session).
import { createClient } from 'npm:@supabase/supabase-js@2'
import { extract, nights, nightsFromAggregates, byDay, mergeDay, sessionSeries } from './logic.ts'

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
  const out = { source, hr_points: hr.length, nights: 0, sessions: [] as string[] }

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
      const st = s.data && s.data.startedAt; if (!st || st < minT - 4 * 36e5 || st > maxT) continue
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

  await db.from('health_tokens').update({ last_used: new Date().toISOString(), last_summary: `${out.hr_points} mesures FC · ${out.nights} nuit(s) · ${out.sessions.length} séance(s)` }).eq('id', tok.id)
  return json({ ok: true, ...out })
})
