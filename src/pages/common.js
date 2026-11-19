// Aides partagées entre les écrans.
import { todayISO } from '../lib/hyrox.js'

export const plansOf = teams => Object.fromEntries(teams.map(t => [t.id, t.plan || {}]))
export const activeTeams = (teams, uid) => teams.filter(t => t.members.some(m => m.user_id === uid && !m.left_at))
export const partnerOf = (team, uid) => team && team.members.find(m => m.user_id !== uid)
export function nameOf(uid, teams, me) {
  if (me && uid === me.id) return me.display_name || 'Moi'
  for (const t of teams) { const m = t.members.find(x => x.user_id === uid); if (m) return m.profile.display_name || '?' }
  return 'Partenaire'
}
export function profileOf(uid, teams, me) {
  if (me && uid === me.id) return me
  for (const t of teams) { const m = t.members.find(x => x.user_id === uid); if (m) return m.profile }
  return null
}
export const upcoming = races => races.filter(r => r.race_date >= todayISO()).sort((a, b) => a.race_date.localeCompare(b.race_date))
/** Course qui pilote le programme : le prochain objectif principal (A), sinon la prochaine course */
export const mainRace = races => { const U = upcoming(races); return U.find(r => r.priority === 'A') || U[0] }
export const PRIORITY = { A: 'Objectif principal', B: 'Course importante', C: 'Préparation' }
export const teamName = (teams, id) => (teams.find(t => t.id === id) || {}).name
export const RACE_TYPE = r => `${r.format === 'duo' ? 'Duo' : 'Solo'} · ${r.division === 'pro' ? 'Pro' : 'Open'}${r.category ? ' · ' + r.category : ''}`
export const KIND = { entrainement: 'Entraînement', simulation: 'Simulation', course: 'Course' }

/** Personnes connues (membres actuels ou anciens de mes duos), pour confier le pointage */
export function knownUsers(teams, uid) {
  const m = new Map()
  teams.forEach(t => t.members.forEach(x => { if (x.user_id !== uid && x.profile) m.set(x.user_id, x.profile) }))
  return [...m.values()].sort((a, b) => (a.display_name || '').localeCompare(b.display_name || ''))
}
export const isAthlete = (s, uid) => !!(s.athletes && (s.athletes.A === uid || s.athletes.B === uid))
export const isKeeperOnly = (s, uid, teams) => s.timekeeper === uid && !isAthlete(s, uid) && s.owner !== uid && !(s.team_id && teams.some(t => t.id === s.team_id && t.members.some(m => m.user_id === uid && !m.left_at)))
export const athleteNames = s => [s.names && s.names.A, s.names && s.names.B].filter(Boolean).join(' & ')
