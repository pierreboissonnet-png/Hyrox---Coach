// Mode démo : même interface que l'API Supabase, données fictives gardées dans ce navigateur.
import seed from './demo-seed.json'

const KEY = 'hx-demo-db', ME = 'demo-me', P2 = 'demo-partner'
const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36)
const iso = d => new Date(d - new Date().getTimezoneOffset() * 6e4).toISOString().slice(0, 10)
const addDays = n => iso(new Date(Date.now() + n * 864e5))

function initial() {
  const team = { id: 'demo-team', name: 'Duo démo', division: 'open', category: 'mixte', invite_code: 'DEMO42', created_by: ME, created_at: new Date().toISOString(),
    plan: { strat: seed.strat } }
  const scaleHR = (h, k) => ({ t: h.t.map(x => Math.round(x * k)), bpm: h.bpm })
  return {
    profiles: [
      { id: ME, display_name: 'Vous (démo)', sex: 'M', birth_year: 1986, weight_kg: 80, height_cm: 180, hr_max: 190, hr_zones: [95, 131, 144, 157, 170], consent_health: true, consent_ai: true },
      { id: 'demo-sam', display_name: 'Sam (démo)', sex: 'M', birth_year: 1982, weight_kg: 85, height_cm: 182, hr_max: 185, hr_zones: [0, 0, 0, 0, 0], consent_health: false, consent_ai: false },
      { id: P2, display_name: 'Alex (démo)', sex: 'F', birth_year: 1990, weight_kg: 62, height_cm: 168, hr_max: 196, hr_zones: [95, 114, 135, 154, 173], consent_health: false, consent_ai: false },
    ],
    teams: [team, { id: 'demo-old', name: 'Ancien duo (démo)', division: 'open', category: 'homme', invite_code: 'OLD123', plan: {}, created_by: ME, created_at: '2025-01-10T10:00:00Z' }],
    team_members: [{ team_id: 'demo-old', user_id: ME, joined_at: '2025-01-10T10:00:00Z', left_at: '2026-03-01T10:00:00Z' }, { team_id: 'demo-old', user_id: 'demo-sam', joined_at: '2025-01-11T10:00:00Z', left_at: null },{ team_id: team.id, user_id: ME, joined_at: team.created_at, left_at: null }, { team_id: team.id, user_id: P2, joined_at: team.created_at, left_at: null }],
    races: [
      { id: 'r1', user_id: ME, team_id: team.id, name: 'Hyrox démo', city: 'Paris', race_date: addDays(27), format: 'duo', division: 'open', category: 'mixte', goal_seconds: 5100, result_seconds: null, notes: '' },
      { id: 'r2', user_id: ME, team_id: null, name: 'Hyrox solo démo', city: 'Lyon', race_date: addDays(110), format: 'solo', division: 'open', category: 'homme', goal_seconds: 5700, result_seconds: null, notes: '' },
    ],
    sessions: [
      { id: 's1', owner: ME, team_id: team.id, keeper_code: 'SIM001', timekeeper: null, names: { A: 'Vous (démo)', B: 'Alex (démo)' }, name: 'Simulation (démo)', session_date: addDays(-16), kind: 'simulation', athletes: { A: ME, B: P2 }, data: seed.s1, created_at: new Date(Date.now() - 16 * 864e5).toISOString() },
      { id: 's3', owner: ME, team_id: null, name: 'Force + SkiErg (démo)', session_date: addDays(-1), kind: 'entrainement', athletes: { A: ME, B: null }, names: { A: 'Vous (démo)' }, keeper_code: 'SPE003', timekeeper: null, plan: null, data: demoCustom(), created_at: new Date(Date.now() - 864e5).toISOString() },
      { id: 's2', owner: ME, team_id: team.id, keeper_code: 'ENT002', timekeeper: null, names: { A: 'Vous (démo)', B: 'Alex (démo)' }, name: 'Entraînement (démo)', session_date: addDays(-2), kind: 'entrainement', athletes: { A: ME, B: P2 }, data: seed.s2, created_at: new Date(Date.now() - 2 * 864e5).toISOString() },
    ],
    hr_series: [
      { session_id: 's3', user_id: ME, t: seed.hr.A.t.filter(x => x <= 3300), bpm: seed.hr.A.bpm.slice(0, seed.hr.A.t.filter(x => x <= 3300).length), source: 'Exemple fictif', offset_s: 0 },
      { session_id: 's2', user_id: ME, ...seed.hr.A, source: 'Exemple fictif', offset_s: 0 },
      { session_id: 's2', user_id: P2, ...seed.hr.B, source: 'Exemple fictif', offset_s: 0 },
      { session_id: 's1', user_id: ME, ...scaleHR(seed.hr.A, 1.04), source: 'Exemple fictif', offset_s: 0 },
    ],
    journal: [
      { id: 'tpl1', user_id: ME, kind: 'workout', day: addDays(-3), data: { name: 'Force + SkiErg', blocks: demoCustom().blocks } },
      ...[82.4, 82.0, 81.7, 81.9, 81.2, 80.8, 80.5].map((w, i) => ({ id: uid(), user_id: ME, kind: 'weight', day: addDays(-6 * (6 - i) * 2), data: { kg: w, fat: 17 - i * 0.3 } })),
      { id: uid(), user_id: ME, kind: 'blood', day: addDays(-40), data: { ferritine: 85, hb: 15.1, vitd: 24, crp: 1.2, ck: 260 } },
      ...[[412, '23:40', 4], [365, '00:35', 2], [448, '23:10', 4], [391, '23:55', 3], [470, '22:50', 5], [330, '01:10', 2], [425, '23:20', 3], [455, '23:05', 4], [402, '23:45', 3], [380, '00:20', 3]].map(([m, bed, q], i) => ({ id: uid(), user_id: ME, kind: 'sleep', day: addDays(-i), data: { asleep: m, bed, wake: (() => { const [h, mm] = bed.split(':').map(Number); const t = (h * 60 + mm + m + 15) % 1440; return String(Math.floor(t / 60)).padStart(2, '0') + ':' + String(t % 60).padStart(2, '0') })(), quality: q } })),
      { id: uid(), user_id: ME, kind: 'wellbeing', day: addDays(-1), data: { fatigue: 3, sleep: 4, soreness: 2, mood: 4 } },
    ],
    coach_feedback: [],
    bug_reports: [],
  }
}
// Séance spécialisée fictive (déjà réalisée)
function demoCustom() {
  const B = [
    { ex: 'run', name: '', sets: 1, rest: 60, w: 'A', target: { meters: 1000, time: 270 }, note: 'allure course' },
    { ex: 'ski', name: '', sets: 3, rest: 60, w: 'A', target: { meters: 250, time: 55 }, note: '' },
    { ex: 'squat', name: '', sets: 4, rest: 120, w: 'A', target: { reps: 6, load: 80 }, note: 'tempo 3-1-1' },
    { ex: 'wb', name: '', sets: 2, rest: 90, w: 'A', target: { reps: 30, load: 6 }, note: 'sans pause' },
    { ex: 'bench', name: '', sets: 3, rest: 120, w: 'A', target: { reps: 8, load: 60 }, note: '' },
    { ex: 'plank', name: '', sets: 1, rest: 0, w: 'A', target: { time: 60 }, note: '' },
  ]
  const done = { run: [{ meters: 1000, time: 262, rpe: 7 }], ski: [{ meters: 250, time: 53, rpe: 8 }, { meters: 250, time: 56, rpe: 8 }, { meters: 250, time: 58, rpe: 9 }],
    squat: [{ reps: 6, load: 80, rpe: 7 }, { reps: 6, load: 80, rpe: 8 }, { reps: 6, load: 80, rpe: 8 }, { reps: 6, load: 80, rpe: 9 }], wb: [{ reps: 30, load: 6, rpe: 8 }, { reps: 26, load: 6, rpe: 9 }],
    bench: [{ reps: 8, load: 60, rpe: 7 }, { reps: 8, load: 60, rpe: 8 }, { reps: 7, load: 60, rpe: 9 }], plank: [{ time: 65, rpe: 6 }] }
  const steps = []; let t = 20000
  B.forEach((b, g) => { for (let k = 0; k < b.sets; k++) { const dn = done[b.ex][k], dur = dn.time || ({ squat: 35, bench: 30, wb: 75 }[b.ex] || 40); const st = { g, set: k + 1, of: b.sets, ex: b.ex, name: '', rest: b.rest, w: 'A', target: { ...b.target }, note: b.note, s: t, e: t + dur * 1000, done: { ...dn, time: undefined } }; delete st.done.time; steps.push(st); t += dur * 1000 + b.rest * 1000 } })
  return { format: 'custom', title: 'Force + SkiErg', startedAt: Date.now() - 864e5, steps, blocks: B, note: '' }
}
function load() { try { const d = JSON.parse(localStorage.getItem(KEY)); if (d && d.profiles) return d } catch {} const d = initial(); save(d); return d }
function save(d) { try { localStorage.setItem(KEY, JSON.stringify(d)) } catch {} }
let db = null
const D = () => db || (db = load())
const commit = () => save(D())
const wait = v => new Promise(r => setTimeout(() => r(JSON.parse(JSON.stringify(v ?? null))), 30))
let authCb = null, user = null
try { user = localStorage.getItem('hx-demo-auth') ? { id: ME, email: 'demo@exemple.fr' } : null } catch {}

export const demoApi = {
  demo: true,
  reset() { db = initial(); commit() },
  auth: {
    user: async () => user,
    onChange(cb) { authCb = cb; return () => { authCb = null } },
    async signUp() { return this.signIn() },
    async signIn() { user = { id: ME, email: 'demo@exemple.fr' }; try { localStorage.setItem('hx-demo-auth', '1') } catch {} authCb && authCb(user); return user },
    async reset() {}, async setPassword() {},
    async signOut() { user = null; try { localStorage.removeItem('hx-demo-auth') } catch {} authCb && authCb(null) },
  },
  profiles: {
    get: id => wait(D().profiles.find(p => p.id === id)),
    create: id => wait(D().profiles.find(p => p.id === id)),
    many: ids => wait(D().profiles.filter(p => ids.includes(p.id))),
    update(id, patch) { const p = D().profiles.find(x => x.id === id); Object.assign(p, patch); commit(); return wait(p) },
  },
  teams: {
    list() {
      const d = D()
      const mine = d.teams.filter(t => d.team_members.some(m => m.team_id === t.id && m.user_id === ME))
      return wait(mine.map(t => ({ ...t, members: d.team_members.filter(m => m.team_id === t.id).map(m => ({ ...m, profile: d.profiles.find(p => p.id === m.user_id) })) })))
    },
    create(name, division, category) {
      const t = { id: uid(), name, division, category, invite_code: Math.random().toString(36).slice(2, 8).toUpperCase(), plan: {}, created_by: ME, created_at: new Date().toISOString() }
      D().teams.push(t); D().team_members.push({ team_id: t.id, user_id: ME, joined_at: t.created_at, left_at: null }); commit(); return wait(t.id)
    },
    async join(code) {
      const t = D().teams.find(x => x.invite_code === code.trim().toUpperCase())
      if (!t) throw new Error('Code inconnu')
      const m = D().team_members.find(x => x.team_id === t.id && x.user_id === ME)
      if (m) { m.left_at = null; commit(); return t.id }
      throw new Error('Ce duo a déjà ses deux membres : créez une nouvelle équipe avec votre nouveau partenaire')
    },
    leave(id) { const m = D().team_members.find(x => x.team_id === id && x.user_id === ME); if (m) m.left_at = new Date().toISOString(); commit(); return wait(null) },
    update(id, patch) { const t = D().teams.find(x => x.id === id); Object.assign(t, patch); commit(); return wait(t) },
  },
  races: {
    list: () => wait([...D().races].sort((a, b) => a.race_date.localeCompare(b.race_date))),
    save(r) { const d = D(); if (r.id) { Object.assign(d.races.find(x => x.id === r.id), r) } else { r = { ...r, id: uid() }; d.races.push(r) } commit(); return wait(r) },
    remove(id) { D().races = D().races.filter(x => x.id !== id); commit(); return wait(null) },
  },
  sessions: {
    list: () => wait([...D().sessions].sort((a, b) => b.session_date.localeCompare(a.session_date) || (b.created_at || '').localeCompare(a.created_at || ''))),
    get: id => wait(D().sessions.find(s => s.id === id)),
    save(s) { const d = D(); let row; if (s.id) { row = d.sessions.find(x => x.id === s.id); Object.assign(row, s) } else { row = { timekeeper: null, ...s, id: uid(), keeper_code: Math.random().toString(36).slice(2, 8).toUpperCase(), created_at: new Date().toISOString() }; d.sessions.push(row) } row.updated_at = new Date().toISOString(); commit(); return wait(row) },
    async claim(code) { const s = D().sessions.find(x => x.keeper_code === String(code).trim().toUpperCase()); if (!s) throw new Error('Code de pointage inconnu'); s.timekeeper = ME; commit(); return s.id },
    setKeeper(id, u) { const s = D().sessions.find(x => x.id === id); s.timekeeper = u; commit(); return wait(s) },
    remove(id) { const d = D(); d.sessions = d.sessions.filter(x => x.id !== id); d.hr_series = d.hr_series.filter(x => x.session_id !== id); commit(); return wait(null) },
    subscribe() { return () => {} },
  },
  hr: {
    list: sid => wait(D().hr_series.filter(h => h.session_id === sid)),
    listMany: ids => wait(D().hr_series.filter(h => ids.includes(h.session_id))),
    save(row) { const d = D(); d.hr_series = d.hr_series.filter(h => !(h.session_id === row.session_id && h.user_id === row.user_id)); d.hr_series.push(row); commit(); return wait(row) },
    remove(sid, u) { const d = D(); d.hr_series = d.hr_series.filter(h => !(h.session_id === sid && h.user_id === u)); commit(); return wait(null) },
  },
  journal: {
    list: kind => wait(D().journal.filter(j => !kind || j.kind === kind).sort((a, b) => b.day.localeCompare(a.day))),
    add(e) { const r = { id: uid(), user_id: ME, created_at: new Date().toISOString(), ...e }; D().journal.push(r); commit(); return wait(r) },
    update(id, patch) { const r = D().journal.find(j => j.id === id); Object.assign(r, patch); commit(); return wait(r) },
    remove(id) { D().journal = D().journal.filter(j => j.id !== id); commit(); return wait(null) },
  },
  health: {
    endpoint: () => location.origin + '/functions/v1/health-sync (démo : non disponible)',
    tokens: () => wait(D().health_tokens || []),
    addToken(hash, label) { const d = D(); d.health_tokens = d.health_tokens || []; const r = { id: uid(), label, created_at: new Date().toISOString(), last_used: null, last_summary: '' }; d.health_tokens.unshift(r); commit(); return wait(r) },
    removeToken(id) { D().health_tokens = (D().health_tokens || []).filter(t => t.id !== id); commit(); return wait(null) },
    samples: () => wait([]),
  },
  coach: {
    list: sid => wait(D().coach_feedback.filter(c => c.session_id === sid).reverse()),
    request(r) { const d = D(); d.coach_requests = d.coach_requests || []; const x = { id: uid(), no: d.coach_requests.length + 1, user_id: ME, status: 'new', created_at: new Date().toISOString(), ...r }; d.coach_requests.push(x); commit(); return wait({ id: x.id, no: x.no }) },
    requests: sid => wait((D().coach_requests || []).filter(r => r.session_id === sid)),
    allRequests: () => wait([...(D().coach_requests || [])].reverse()),
    setRequest(id, patch) { Object.assign((D().coach_requests || []).find(r => r.id === id), patch); commit(); return wait(null) },
    answer(req, content) { D().coach_feedback.push({ id: uid(), session_id: req.session_id, user_id: req.user_id, scope: 'session', content, model: 'Claude (analyse approfondie)', request_id: req.id, created_at: new Date().toISOString() }); Object.assign(D().coach_requests.find(r => r.id === req.id), { status: 'done' }); commit(); return wait(null) },
    save(row) { const r = { id: uid(), user_id: ME, created_at: new Date().toISOString(), scope: 'session', ...row }; D().coach_feedback.push(r); commit(); return wait(r) },
    async ask({ session_id, summary }) {
      // En démo, pas d'appel à Claude : réponse construite à partir des conseils automatiques
      const lines = (summary.insights || []).map(i => '• ' + i.text)
      const r = { id: uid(), session_id, user_id: ME, scope: 'session', content: '**Mode démo** : en production, ce texte est rédigé par Claude à partir des temps de la séance.\n\n' + (lines.join('\n') || 'Séance enregistrée.'), model: 'démo', created_at: new Date().toISOString() }
      D().coach_feedback.push(r); commit(); return wait(r)
    },
  },
  bugs: {
    list: () => wait([...D().bug_reports].reverse().map(({ img, ...b }) => b)),
    get: id => wait(D().bug_reports.find(b => b.id === id)),
    add(b) { const d = D(); const r = { id: uid(), no: d.bug_reports.length + 1, user_id: ME, status: 'new', note: '', analysis: '', updated_by: '', created_at: new Date().toISOString(), ...b, has_img: !!b.img }; d.bug_reports.push(r); commit(); return wait({ id: r.id, no: r.no }) },
    update(id, patch, by) { const r = D().bug_reports.find(x => x.id === id); Object.assign(r, patch, { updated_by: by || '', updated_at: new Date().toISOString() }); commit(); const { img, ...rest } = r; return wait(rest) },
    remove(id) { D().bug_reports = D().bug_reports.filter(x => x.id !== id); commit(); return wait(null) },
    async triage() { return { analysis: '' } },
    isAdmin: async () => true,
    apiConfig: async () => ({ off: false, n: 0, last: null }),
    setApiOff: async () => null,

  },
}
