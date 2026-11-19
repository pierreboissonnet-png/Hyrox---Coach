// Activité saisie rapidement (hors plan) : une séance personnalisée d'une seule étape déjà réalisée.
import { EX } from './custom.js'

/** Construit une séance « activité » (séance personnalisée d'une seule étape déjà réalisée) */
export function quickSession({ uid, name, ex, date, minutes, km, rpe, avgHR, note }) {
  const dur = Math.round(minutes * 60)
  const step = { g: 0, set: 1, of: 1, ex, name: ex === 'other' ? name : '', rest: 0, w: 'A', target: {}, note: '', s: 0, e: dur * 1000, done: { time: dur, meters: km ? Math.round(km * 1000) : null, rpe } }
  return { owner: uid, team_id: null, kind: 'entrainement', session_date: date, name: name || EX[ex].label, athletes: { A: uid, B: null }, names: { A: null, B: null }, timekeeper: null, plan: null,
    data: { format: 'custom', quick: true, title: name || EX[ex].label, startedAt: 0, steps: [step], blocks: [{ ex, name: step.name, sets: 1, rest: 0, w: 'A', target: {}, note: '' }], note: note || '', ...(avgHR ? { avgHR } : {}) } }
}

