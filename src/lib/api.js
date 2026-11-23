// Accès aux données : Supabase en production, ou mode démo (données locales dans le navigateur).
import { createClient } from '@supabase/supabase-js'
import { demoApi } from './demo.js'

// Tolère une adresse copiée avec /rest/v1/ ou des espaces
const URL_ = String(import.meta.env.VITE_SUPABASE_URL || '').trim().replace(/\/(rest|auth)\/v1\/?$/, '').replace(/\/+$/, ''), KEY = String(import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim()
export const configured = !!(URL_ && KEY)
// Coach : « local » (gratuit, par défaut) ou « claude » (API Anthropic payante, fonction serveur « coach »)
export const COACH_MODE = import.meta.env.VITE_COACH_MODE === 'claude' ? 'claude' : 'local'
export const isDemo = () => { try { return localStorage.getItem('hx-mode') === 'demo' } catch { return false } }
export const setDemo = on => { try { on ? localStorage.setItem('hx-mode', 'demo') : localStorage.removeItem('hx-mode') } catch {} location.hash = '#/'; location.reload() }

const sb = configured ? createClient(URL_, KEY, { auth: { persistSession: true, autoRefreshToken: true } }) : null
const ok = ({ data, error }) => { if (error) throw new Error(error.message); return data }

const supaApi = {
  demo: false,
  auth: {
    async user() { const { data } = await sb.auth.getSession(); return data.session ? data.session.user : null },
    onChange(cb) { const { data } = sb.auth.onAuthStateChange((_e, s) => cb(s ? s.user : null)); return () => data.subscription.unsubscribe() },
    async signUp(email, password, name) { const r = await sb.auth.signUp({ email, password, options: { data: { display_name: name }, emailRedirectTo: location.origin } }); if (r.error) throw new Error(r.error.message); return r.data },
    async signIn(email, password) { const r = await sb.auth.signInWithPassword({ email, password }); if (r.error) throw new Error(r.error.message === 'Invalid login credentials' ? 'E-mail ou mot de passe incorrect' : r.error.message); return r.data.user },
    async reset(email) { const r = await sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin + '/#/nouveau-mot-de-passe' }); if (r.error) throw new Error(r.error.message) },
    async setPassword(pw) { const r = await sb.auth.updateUser({ password: pw }); if (r.error) throw new Error(r.error.message) },
    async signOut() { await sb.auth.signOut() },
  },
  profiles: {
    get: async id => ok(await sb.from('profiles').select('*').eq('id', id).maybeSingle()),
    create: async (id, name) => ok(await sb.from('profiles').upsert({ id, display_name: name || '' }, { onConflict: 'id', ignoreDuplicates: true }).select().single()),
    many: async ids => ids.length ? ok(await sb.from('profiles').select('*').in('id', ids)) : [],
    update: async (id, patch) => ok(await sb.from('profiles').update(patch).eq('id', id).select().single()),
  },
  teams: {
    async list() {
      const teams = ok(await sb.from('teams').select('*, team_members(user_id, joined_at, left_at)').order('created_at'))
      const ids = [...new Set(teams.flatMap(t => t.team_members.map(m => m.user_id)))]
      const profs = ids.length ? ok(await sb.from('profiles').select('*').in('id', ids)) : []
      return teams.map(t => ({ ...t, members: t.team_members.map(m => ({ ...m, profile: profs.find(p => p.id === m.user_id) || { id: m.user_id, display_name: '?' } })) }))
    },
    create: async (name, division, category) => ok(await sb.rpc('create_team', { p_name: name, p_division: division, p_category: category })),
    join: async code => ok(await sb.rpc('join_team', { p_code: code })),
    leave: async id => ok(await sb.rpc('leave_team', { p_team: id })),
    update: async (id, patch) => ok(await sb.from('teams').update(patch).eq('id', id).select().single()),
  },
  races: {
    list: async () => ok(await sb.from('races').select('*').order('race_date')),
    async save(r) { const { id, ...rest } = r; return id ? ok(await sb.from('races').update(rest).eq('id', id).select().single()) : ok(await sb.from('races').insert(rest).select().single()) },
    remove: async id => ok(await sb.from('races').delete().eq('id', id)),
  },
  sessions: {
    list: async () => ok(await sb.from('sessions').select('*').order('session_date', { ascending: false }).order('created_at', { ascending: false })),
    get: async id => ok(await sb.from('sessions').select('*').eq('id', id).maybeSingle()),
    async save(s) { const { id, ...rest } = s; rest.updated_at = new Date().toISOString(); return id ? ok(await sb.from('sessions').update(rest).eq('id', id).select().single()) : ok(await sb.from('sessions').insert(rest).select().single()) },
    remove: async id => ok(await sb.from('sessions').delete().eq('id', id)),
    claim: async code => ok(await sb.rpc('claim_timekeeper', { p_code: code })),
    setKeeper: async (id, uid) => ok(await sb.from('sessions').update({ timekeeper: uid }).eq('id', id).select().single()),
    subscribe(id, cb) {
      const ch = sb.channel('s-' + id).on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'sessions', filter: 'id=eq.' + id }, p => cb(p.new)).subscribe()
      return () => sb.removeChannel(ch)
    },
  },
  hr: {
    list: async sid => ok(await sb.from('hr_series').select('*').eq('session_id', sid)),
    listMany: async ids => ids.length ? ok(await sb.from('hr_series').select('session_id,user_id,t,bpm,offset_s').in('session_id', ids)) : [],
    save: async row => ok(await sb.from('hr_series').upsert({ ...row, updated_at: new Date().toISOString() }).select().single()),
    remove: async (sid, uid) => ok(await sb.from('hr_series').delete().eq('session_id', sid).eq('user_id', uid)),
  },
  journal: {
    list: async kind => ok(await (kind ? sb.from('journal').select('*').eq('kind', kind) : sb.from('journal').select('*')).order('day', { ascending: false }).order('created_at', { ascending: false })),
    add: async e => ok(await sb.from('journal').insert(e).select().single()),
    update: async (id, patch) => ok(await sb.from('journal').update(patch).eq('id', id).select().single()),
    remove: async id => ok(await sb.from('journal').delete().eq('id', id)),
  },
  // Bilan « Mon niveau » partagé avec le duo (table shared_levels ; [] si le script SQL n'a pas encore été exécuté)
  levels: {
    shared: async ids => { if (!ids.length) return []; const r = await sb.from('shared_levels').select('*').in('user_id', ids); return r.error ? [] : r.data },
    share: async (uid, data) => ok(await sb.from('shared_levels').upsert({ user_id: uid, data, updated_at: new Date().toISOString() }, { onConflict: 'user_id' })),
    unshare: async uid => ok(await sb.from('shared_levels').delete().eq('user_id', uid)),
  },
  health: {
    endpoint: () => URL_ + '/functions/v1/health-sync',
    tokens: async () => ok(await sb.from('health_tokens').select('id,label,created_at,last_used,last_summary').order('created_at', { ascending: false })),
    addToken: async (hash, label) => ok(await sb.from('health_tokens').insert({ token_hash: hash, label }).select('id').single()),
    removeToken: async id => ok(await sb.from('health_tokens').delete().eq('id', id)),
    samples: async (uid, days) => ok(await sb.from('hr_samples').select('day,t,bpm,source').eq('user_id', uid).in('day', days)),
  },
  coach: {
    request: async r => ok(await sb.from('coach_requests').insert(r).select('id,no').single()),
    requests: async sid => ok(await sb.from('coach_requests').select('id,no,status,question,created_at').eq('session_id', sid).order('no')),
    // Analyse globale : demandes sans séance, réponses « global » (déposées par Claude directement en base)
    globalRequests: async uid => ok(await sb.from('coach_requests').select('id,no,status,question,created_at').is('session_id', null).eq('user_id', uid).order('no', { ascending: false })),
    globalAnswers: async uid => ok(await sb.from('coach_feedback').select('id,content,model,created_at,request_id').eq('scope', 'global').eq('user_id', uid).order('created_at', { ascending: false })),
    allRequests: async () => ok(await sb.from('coach_requests').select('*').order('no', { ascending: false }).limit(200)),
    setRequest: async (id, patch) => ok(await sb.from('coach_requests').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id)),
    answer: async (req, content) => { ok(await sb.from('coach_feedback').insert({ session_id: req.session_id, user_id: req.user_id, scope: req.session_id ? 'session' : 'global', content, model: 'Claude (analyse approfondie)', request_id: req.id })); return ok(await sb.from('coach_requests').update({ status: 'done', updated_at: new Date().toISOString() }).eq('id', req.id)) },
    save: async row => ok(await sb.from('coach_feedback').insert({ ...row, user_id: (await sb.auth.getUser()).data.user.id }).select().single()),
    list: async sid => ok(await sb.from('coach_feedback').select('*').eq('session_id', sid).order('created_at', { ascending: false })),
    async ask(body) { const { data, error } = await sb.functions.invoke('coach', { body }); if (error) { let m = error.message; try { m = (await error.context.json()).error || m } catch {} throw new Error(m) } return data },
  },
  bugs: {
    // Liste sans les captures (chargées à l'ouverture d'un signalement)
    list: async () => { const r = await sb.from('bug_reports').select('id,no,user_id,pseudo,text,ctx,has_img,status,note,analysis,updated_by,created_at,updated_at,bug_comments(count)').order('no', { ascending: false })
      if (r.error && /bug_comments/.test(r.error.message)) return ok(await sb.from('bug_reports').select('id,no,user_id,pseudo,text,ctx,has_img,status,note,analysis,updated_by,created_at,updated_at').order('no', { ascending: false }))   // table pas encore créée
      return ok(r).map(b => ({ ...b, n_comments: (b.bug_comments && b.bug_comments[0] && b.bug_comments[0].count) || 0 })) },
    comments: async id => ok(await sb.from('bug_comments').select('*').eq('bug_id', id).order('created_at')),
    comment: async (id, text, pseudo, fromAdmin, img) => ok(await sb.from('bug_comments').insert({ bug_id: id, text, pseudo, from_admin: !!fromAdmin, img: img || null }).select().single()),
    get: async id => ok(await sb.from('bug_reports').select('*').eq('id', id).single()),
    add: async b => ok(await sb.from('bug_reports').insert(b).select('id,no').single()),
    update: async (id, patch, by) => ok(await sb.from('bug_reports').update({ ...patch, updated_by: by || '', updated_at: new Date().toISOString() }).eq('id', id).select('id,no,user_id,pseudo,text,ctx,has_img,status,note,analysis,updated_by,created_at,updated_at').single()),
    remove: async id => ok(await sb.from('bug_reports').delete().eq('id', id)),
    async triage(id) { if (COACH_MODE !== 'claude') return { analysis: '' }; const { data, error } = await sb.functions.invoke('triage', { body: { id } }); if (error) throw new Error(error.message); return data },
    isAdmin: async uid => !!ok(await sb.from('app_admins').select('user_id').eq('user_id', uid).maybeSingle()),
    apiConfig: async () => { const r = ok(await sb.from('app_config').select('value').eq('key', 'bugapi').maybeSingle()); return r ? r.value : null },
    setApiOff: async off => { const cur = (await supaApi.bugs.apiConfig()) || {}; return ok(await sb.from('app_config').upsert({ key: 'bugapi', value: { ...cur, off } })) },

  },
}

export const api = (!configured || isDemo()) ? demoApi : supaApi
