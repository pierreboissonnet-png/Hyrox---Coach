// Fonction « coach-api » : 2e temps de l'analyse. Claude (par exemple dans Cowork, inclus dans votre abonnement)
// lit les demandes d'analyse approfondie et dépose sa réponse, qui s'affiche dans l'onglet Coach de la séance.
// Même clé que les signalements : secret BUG_API_KEY, en-tête « x-bug-key » ; accès coupable depuis l'app.
//
//   GET  /coach-api?status=open            demandes à traiter (avec le résumé de séance)
//   GET  /coach-api?no=7                   une demande
//   POST /coach-api {"no":7, "status":"doing"}                       prise en charge
//   POST /coach-api {"no":7, "analysis":"## En bref …"}               réponse (statut « done »)
import { createClient } from 'npm:@supabase/supabase-js@2'

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-bug-key', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS' }
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
async function sha(s: string) { return new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))) }
function same(a: Uint8Array, b: Uint8Array) { let d = a.length ^ b.length; for (let i = 0; i < a.length; i++) d |= a[i] ^ b[i]; return d === 0 }
const fails = new Map<string, number>()

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  const want = Deno.env.get('BUG_API_KEY') || ''
  if (want.length < 32) return json({ error: 'Introuvable.' }, 404)
  const hour = new Date().toISOString().slice(0, 13)
  if ((fails.get(hour) || 0) >= 30) return json({ error: "Trop d'essais : réessayez plus tard." }, 429)
  if (!same(await sha(req.headers.get('x-bug-key') || ''), await sha(want))) { fails.set(hour, (fails.get(hour) || 0) + 1); return json({ error: 'Clé refusée.' }, 401) }
  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const { data: cfgRow } = await db.from('app_config').select('value').eq('key', 'bugapi').maybeSingle()
  const cfg = (cfgRow && cfgRow.value) || {}
  if (cfg.off) return json({ error: 'Accès coupé par un administrateur.' }, 403)
  await db.from('app_config').upsert({ key: 'bugapi', value: { ...cfg, last: new Date().toISOString(), n: (cfg.n || 0) + 1 } })

  const COLS = 'id,no,session_id,user_id,pseudo,question,payload,status,created_at,updated_at'
  const url = new URL(req.url)
  try {
    if (req.method === 'GET' && !url.searchParams.get('no')) {
      let q = db.from('coach_requests').select(COLS).order('no', { ascending: true }).limit(100)
      const st = url.searchParams.get('status') || 'open'
      if (st === 'open') q = q.in('status', ['new', 'doing']); else if (st !== 'all') q = q.eq('status', st)
      const { data, error } = await q; if (error) throw error
      return json({ requests: data || [] })
    }
    const body = req.method === 'POST' ? await req.json() : {}
    const no = Number(url.searchParams.get('no') || body.no) || 0
    const { data: r } = await db.from('coach_requests').select(COLS).eq('no', no).maybeSingle()
    if (!r) return json({ error: 'Demande introuvable.' }, 404)
    if (req.method === 'GET') {
      // Historique utile : analyses précédentes de la même séance (dont la 1re analyse de l'app)
      const { data: prev } = await db.from('coach_feedback').select('content,model,created_at').eq('session_id', r.session_id).order('created_at')
      return json({ request: r, previous: prev || [] })
    }
    if (body.analysis) {
      const content = String(body.analysis).slice(0, 12000)
      const { error } = await db.from('coach_feedback').insert({ session_id: r.session_id, user_id: r.user_id, scope: 'session', content, model: String(body.model || 'Claude (analyse approfondie)').slice(0, 60), request_id: r.id })
      if (error) throw error
      await db.from('coach_requests').update({ status: 'done', updated_at: new Date().toISOString() }).eq('id', r.id)
      return json({ ok: true, no, status: 'done' })
    }
    if (['new', 'doing', 'done', 'cancelled'].includes(body.status)) {
      await db.from('coach_requests').update({ status: body.status, updated_at: new Date().toISOString() }).eq('id', r.id)
      return json({ ok: true, no, status: body.status })
    }
    return json({ error: 'Rien à faire : « analysis » ou « status » attendu.' }, 400)
  } catch (e) {
    return json({ error: String((e as Error).message || e) }, 500)
  }
})
