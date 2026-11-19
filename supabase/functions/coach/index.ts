// Fonction « coach » : analyse une séance par Claude et enregistre les conseils.
// Appelée automatiquement par l'application à la fin d'une séance (et à la demande).
// Le résumé chiffré est calculé par l'application ; ici on vérifie l'accès (RLS) et l'accord IA.
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

const SYSTEM = `Tu es un coach Hyrox expérimenté (format duo et solo). Tu analyses les temps d'une séance
(courses, Rox, ateliers, relais entre partenaires, fréquence cardiaque si fournie) et tu rédiges en français :
1. « En bref » : 2 phrases sur la séance.
2. « Ce qui a marché » : 2 à 3 puces chiffrées.
3. « À travailler » : 3 puces chiffrées, priorisées par le temps qu'elles peuvent faire gagner.
4. « Prochaine séance » : un exercice précis (contenu, durée, intensité / zone cardio).
5. Pour un duo : une remarque sur la répartition des relais.
Sois concret, bref (moins de 250 mots), utilise les temps fournis, n'invente aucune donnée.
Pas de diagnostic médical ; si une donnée de santé paraît anormale, conseille d'en parler à un médecin.`

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const { user, service, me } = await clients(req)
    if (!me) return json({ error: 'Non connecté' }, 401)
    const { session_id, scope = 'session', station = null, summary } = await req.json()
    if (!session_id || !summary) return json({ error: 'session_id et summary requis' }, 400)

    // Lecture avec les droits de l'utilisateur : échoue s'il ne voit pas la séance
    const { data: s } = await user.from('sessions').select('id, name, team_id').eq('id', session_id).maybeSingle()
    if (!s) return json({ error: 'Séance introuvable ou non autorisée' }, 404)
    const { data: prof } = await user.from('profiles').select('consent_ai').eq('id', me.id).single()
    if (!prof?.consent_ai) return json({ error: "Activez l'analyse IA dans Moi › Réglages" }, 403)

    // Limite simple : 20 analyses par jour et par utilisateur
    const since = new Date(Date.now() - 864e5).toISOString()
    const { count } = await service.from('coach_feedback').select('id', { count: 'exact', head: true }).eq('user_id', me.id).gte('created_at', since)
    if ((count ?? 0) >= 20) return json({ error: "Limite de 20 analyses par jour atteinte" }, 429)

    const prompt = (scope === 'station' ? `Concentre-toi sur l'atelier ${station}.\n\n` : '') +
      'Données de la séance (JSON) :\n' + JSON.stringify(summary)
    const { text, model } = await askClaude(SYSTEM, prompt)
    const { data: row, error } = await service.from('coach_feedback')
      .insert({ session_id, user_id: me.id, scope, station, content: text, model }).select().single()
    if (error) throw error
    return json(row)
  } catch (e) {
    return json({ error: String((e as Error).message || e) }, 500)
  }
})
