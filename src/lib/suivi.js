// Suivi de l'entraînement : volume, km, assiduité vs plan, séances sautées, lacunes travaillées, progression par exercice, forme.
import { STATIONS, STATION, SEGS } from './hyrox.js'
import { normData, split, runKm } from './session.js'
import { isCustom, isPlanned, isQuick, doneOf, exLabel, EX } from './custom.js'
import { sessionMinutes, sessionRPE } from './load.js'
import { addDays, mondayOf } from './plan.js'
import { wellNorm } from './program.js'

const avg = a => { const x = a.filter(v => v != null && !Number.isNaN(v)); return x.length ? x.reduce((p, q) => p + q, 0) / x.length : null }
const isStretch = s => !!(s.data && s.data.stretch)

/** Kilomètres courus dans une séance (course des séances perso et activités, segments de course des Hyrox) */
export function runKmOf(s) {
  if (isCustom(s)) return (s.data.steps || []).filter(x => x.ex === 'run').reduce((a, x) => a + ((doneOf(x).meters || 0) / 1000), 0)
  const d = normData(s.data); let km = 0
  SEGS.forEach((g, i) => { if (g.type === 'run' && split(d, i) != null) km += runKm(d, g.id) })
  return km
}
/** Exercices réellement travaillés dans une séance (ids) */
export function exercisesOf(s) {
  if (isCustom(s)) return [...new Set((s.data.steps || []).filter(x => x.e != null || (x.done && Object.values(x.done).some(v => v != null))).map(x => x.ex))]
  const d = normData(s.data); return STATIONS.filter(x => { const i = SEGS.findIndex(g => g.id === x.id); return split(d, i) != null }).map(x => x.id).concat(SEGS.some((g, i) => g.type === 'run' && split(d, i) != null) ? ['run'] : [])
}

/** Semaines (lundi) de from à to inclus */
export function weeksBetween(from, to) { const L = []; for (let w = mondayOf(from); w <= to; w = addDays(w, 7)) L.push(w); return L }

/**
 * Tableau de bord par semaine.
 * sessions : séances de l'athlète ; plan : plan du programme (ou null) ; doneOn(date) : jour du plan validé
 */
export function weekly({ sessions, plan, doneOn, wellbeing = [], vitals = [], sleep = [], from, today, uid }) {
  const real = sessions.filter(s => !isPlanned(s))
  const planDays = plan ? plan.weeks.flatMap(w => w.days).filter(d => d.key !== 'repos') : []
  return weeksBetween(from, today).map(ws => {
    const we = addDays(ws, 6), inW = x => x >= ws && x <= we
    const S = real.filter(s => inW(s.session_date))
    const train = S.filter(s => !isStretch(s))
    const P = planDays.filter(d => inW(d.date) && (!plan.created || d.date >= plan.created))
    const past = P.filter(d => d.date < today || (d.date === today && doneOn(d.date)))
    const wb = wellbeing.filter(e => inW(e.day)).map(wellNorm)
    return {
      ws, label: ws.slice(8, 10) + '/' + ws.slice(5, 7),
      min: Math.round(train.reduce((a, s) => a + sessionMinutes(s), 0)),
      planMin: Math.round(P.reduce((a, d) => a + (d.min || 0), 0)),
      load: Math.round(train.reduce((a, s) => a + sessionMinutes(s) * (sessionRPE(s, uid) || 7), 0)),
      km: Math.round(train.reduce((a, s) => a + runKmOf(s), 0) * 10) / 10,
      n: train.length, stretch: S.filter(isStretch).length,
      planned: P.length, due: past.length, done: past.filter(d => doneOn(d.date)).length,
      fatigue: avg(wb.map(w => w.fatigue)), sleepQ: avg(wb.map(w => w.sleep)),
      sleepH: avg(sleep.filter(e => inW(e.day)).map(e => e.data && e.data.asleep ? e.data.asleep / 60 : null)),
      rhr: avg(vitals.filter(e => inW(e.day)).map(e => e.data && e.data.rhr)), hrv: avg(vitals.filter(e => inW(e.day)).map(e => e.data && e.data.hrv)),
    }
  })
}

/** Séances du plan passées et non validées */
export function skipped({ plan, doneOn, from, today }) {
  if (!plan) return []
  return plan.weeks.flatMap(w => w.days).filter(d => d.key !== 'repos' && d.date >= from && d.date < today && (!plan.created || d.date >= plan.created) && !doneOn(d.date))
}

/** Lacunes : combien de fois chaque point faible était prévu dans le plan et combien de fois il a été travaillé */
export function gapWork({ gaps, plan, sessions, from, today }) {
  const real = sessions.filter(s => !isPlanned(s) && s.session_date >= from && s.session_date <= today)
  const days = plan ? plan.weeks.flatMap(w => w.days).filter(d => d.date >= from && d.date <= today && d.key !== 'repos') : []
  const exInDay = d => new Set([...(d.focus || []), ...((d.blocks || []).flatMap(b => b.type === 'group' ? (b.items || []).map(i => i.ex) : [b.ex]))])
  return (gaps || []).filter(g => g.kind !== 'test').slice(0, 5).map(g => {
    const ids = g.st ? [g.st] : g.kind === 'run' || g.kind === 'engine' ? ['run'] : g.kind === 'force' ? Object.keys(EX).filter(k => ['force', 'halt', 'machine'].includes(EX[k].cat)) : []
    const planned = days.filter(d => ids.some(id => exInDay(d).has(id)) || (g.kind === 'engine' && ['z2', 'seuil'].includes(d.key))).length
    const done = real.filter(s => { const E = exercisesOf(s); return ids.some(id => E.includes(id)) }).length
    return { id: g.id, label: g.label, why: g.why, planned, done }
  })
}

/** Exercices disponibles pour la courbe de progression (ateliers + exercices des séances perso) */
export function progressExercises(sessions) {
  const c = {}
  sessions.filter(s => !isPlanned(s) && !isStretch(s)).forEach(s => exercisesOf(s).forEach(id => { c[id] = (c[id] || 0) + 1 }))
  return Object.entries(c).filter(([, n]) => n >= 1).sort((a, b) => b[1] - a[1]).map(([id]) => id)
}
/**
 * Points de progression pour un exercice : [{date, v, label}] et l'unité.
 * Charge (kg, plus haut = mieux) si l'exercice a des charges ; sinon allure (course /km, ergos /500 m) ; sinon temps de l'atelier Hyrox.
 */
export function progressPoints(sessions, ex) {
  const S = sessions.filter(s => !isPlanned(s) && !isStretch(s)).sort((a, b) => a.session_date.localeCompare(b.session_date))
  const loads = [], paces = [], times = []
  const per = ex === 'run' ? 1000 : ['ski', 'row', 'bike'].includes(ex) ? 500 : null
  S.forEach(s => {
    if (isCustom(s)) {
      const st = (s.data.steps || []).filter(x => x.ex === ex).map(doneOf)
      const L = st.map(d => d.load).filter(v => v > 0); if (L.length) loads.push([s.session_date, Math.max(...L)])
      if (per) { const P = st.filter(d => d.meters > 0 && d.time > 0).map(d => d.time / (d.meters / per)); if (P.length) paces.push([s.session_date, Math.min(...P)]) }
    } else {
      const d = normData(s.data)
      if (ex === 'run') { const P = SEGS.map((g, i) => g.type === 'run' && split(d, i) != null ? split(d, i) / runKm(d, g.id) : null).filter(Boolean); if (P.length) paces.push([s.session_date, avg(P)]) }
      else if (STATION[ex]) { const v = split(d, SEGS.findIndex(g => g.id === ex)); if (v != null) times.push([s.session_date, v]) }
    }
  })
  if (loads.length >= 2 || (loads.length && !paces.length && !times.length)) return { unit: 'kg', better: 'up', pts: loads }
  if (paces.length) return { unit: per === 1000 ? '/km' : '/500 m', better: 'down', pts: paces, time: true }
  if (times.length) return { unit: 'temps de l’atelier', better: 'down', pts: times, time: true }
  return { unit: '', pts: [] }
}
export { exLabel }
