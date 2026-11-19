// Fonction « triage » : premier diagnostic d'un signalement de bug par Claude.
// Appelée par l'application juste après l'envoi d'un signalement.
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

const SYSTEM = `Tu es le développeur de l'application web « Hyrox Coach » (Vite + React + Supabase, hébergée sur Netlify).
Écrans : Accueil, Courses, Équipe (plan, relais, prédictions), Séances (chrono, temps, cardio, stats, comparer), Moi (programme, nutrition, santé, réglages).
À partir d'un signalement d'utilisateur, rédige en français, en moins de 200 mots :
- « Résumé » : le problème en une phrase ;
- « Reproduction » : étapes probables ;
- « Cause probable » : hypothèses classées, en t'appuyant sur les erreurs JavaScript fournies ;
- « Gravité » : bloquant / gênant / mineur, avec une phrase de justification ;
- « Piste de correction » : fichier ou module probable et changement proposé.
N'invente pas de faits : signale ce qu'il faudrait demander à l'utilisateur si l'information manque.`

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const { service, me } = await clients(req)
    if (!me) return json({ error: 'Non connecté' }, 401)
    const { id } = await req.json()
    const { data: bug } = await service.from('bug_reports').select('*').eq('id', id).maybeSingle()
    if (!bug || bug.user_id !== me.id) return json({ error: 'Signalement introuvable' }, 404)
    const { img, user_id, ...rest } = bug
    const { text } = await askClaude(SYSTEM, 'Signalement (JSON) :\n' + JSON.stringify({ ...rest, capture_jointe: !!img }), 900)
    await service.from('bug_reports').update({ analysis: text }).eq('id', id)
    return json({ analysis: text })
  } catch (e) {
    return json({ error: String((e as Error).message || e) }, 500)
  }
})
