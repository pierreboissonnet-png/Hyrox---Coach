// Fonction « bugs-api » : accès de service aux signalements, pour que Claude les lise et mette à jour leur suivi.
// Clé : secret BUG_API_KEY (32 caractères minimum), envoyée dans l'en-tête « x-bug-key ».
// Aucune adresse e-mail n'est renvoyée. Un administrateur peut couper l'accès depuis l'app (Moi › Signalements).
//
//   GET  /bugs-api?status=open|new|doing|done|wontfix&since=<n°>   liste
//   GET  /bugs-api?no=12&img=1                                       un signalement (+ capture)
//   POST /bugs-api  {"no":12, "status":"doing", "note":"Corrigé en 1.0.1"}
import { createClient } from 'npm:@supabase/supabase-js@2'

// ---- outils communs (copiés dans chaque fonction pour pouvoir la coller telle quelle dans le tableau de bord) ----
export const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

/** Client « au nom de l'utilisateur » (les règles RLS s'appliquent) + client de service (écriture des résultats). */
export async function clients(req: Request) {
  const url = Deno.env.get('SUPABASE_URL')!
  const user = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
  })
  const service = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const { data } = await user.auth.getUser()
  return { user, service, me: data.user }
}

/** Appelle Claude (API Messages). Clé et modèle dans les secrets de la fonction. */
export async function askClaude(system: string, prompt: string, maxTokens = 1200): Promise<{ text: string; model: string }> {
  const key = Deno.env.get('ANTHROPIC_API_KEY')
  if (!key) throw new Error("Secret ANTHROPIC_API_KEY manquant : voir le tutoriel, étape « Coach IA ».")
  const model = Deno.env.get('ANTHROPIC_MODEL') || 'claude-sonnet-4-5'
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({ model, max_tokens: maxTokens, system, messages: [{ role: 'user', content: prompt }] }),
  })
  if (!r.ok) throw new Error(`API Claude : ${r.status} ${await r.text()}`)
  const j = await r.json()
  return { text: (j.content || []).filter((c: { type: string }) => c.type === 'text').map((c: { text: string }) => c.text).join('\n').trim(), model: j.model || model }
}
// ----

async function sha(s: string) { return new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))) }
function same(a: Uint8Array, b: Uint8Array) { let d = a.length ^ b.length; for (let i = 0; i < a.length; i++) d |= a[i] ^ b[i]; return d === 0 }
const fails = new Map<string, number>()

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: { ...cors, 'Access-Control-Allow-Headers': cors['Access-Control-Allow-Headers'] + ', x-bug-key', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS' } })
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

  const COLS = 'id,no,pseudo,text,ctx,has_img,status,note,analysis,updated_by,created_at,updated_at'
  const url = new URL(req.url)
  try {
    if (req.method === 'GET' && !url.searchParams.get('no') && !url.searchParams.get('id')) {
      let q = db.from('bug_reports').select(COLS).order('no', { ascending: false }).limit(500)
      const st = url.searchParams.get('status') || '', since = Number(url.searchParams.get('since')) || 0
      if (st === 'open') q = q.in('status', ['new', 'doing']); else if (st) q = q.eq('status', st)
      if (since) q = q.gt('no', since)
      const { data, error } = await q; if (error) throw error
      return json({ bugs: data || [] })
    }
    const body = req.method === 'POST' ? await req.json() : {}
    const no = Number(url.searchParams.get('no') || body.no) || 0, id = url.searchParams.get('id') || body.id || ''
    const find = () => { const q = db.from('bug_reports').select(COLS + ',img'); return (id ? q.eq('id', id) : q.eq('no', no)).maybeSingle() }
    const { data: b } = await find()
    if (!b) return json({ error: 'Signalement introuvable.' }, 404)
    if (req.method === 'GET') { const { img, ...rest } = b as Record<string, unknown>; return json({ bug: rest, img: url.searchParams.get('img') === '1' ? img : null }) }
    const patch: Record<string, unknown> = { updated_by: 'Claude (API)', updated_at: new Date().toISOString() }
    if (['new', 'doing', 'done', 'wontfix'].includes(body.status)) patch.status = body.status
    if ('note' in body) patch.note = String(body.note ?? '').replace(/[\u0000-\u0008\u000b-\u001f]/g, '').trim().slice(0, 1000)
    const { data: u, error } = await db.from('bug_reports').update(patch).eq('id', (b as { id: string }).id).select(COLS).single()
    if (error) throw error
    return json({ bug: u })
  } catch (e) {
    return json({ error: String((e as Error).message || e) }, 500)
  }
})
