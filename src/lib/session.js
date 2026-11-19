// Logique de séance : pointage, splits, relais. Fonctions pures sur l'objet `data` d'une séance.
import { SEGS, N, STATION, planRelays, workObjective } from './hyrox.js'

export function emptyData(runKm = 1) {
  const relays = {}; SEGS.forEach(g => { if (g.type === 'st') relays[g.id] = [] })
  return { startedAt: null, cp: Array(N).fill(null), relays, runs: {}, units: {}, runKm, note: '' }
}
export function normData(d) {
  const e = emptyData(d && d.runKm)
  d = d || {}
  const cp = Array.from({ length: N }, (_, i) => (d.cp && d.cp[i] != null) ? d.cp[i] : null)
  const relays = { ...e.relays }; Object.keys(relays).forEach(k => { relays[k] = ((d.relays || {})[k] || []).map(r => ({ ...r })) })
  return { ...e, ...d, cp, relays, runs: { ...(d.runs || {}) }, units: { ...(d.units || {}) } }
}

export const nextIdx = d => d.cp.findIndex(v => v == null)
export const segStart = (d, i) => i === 0 ? 0 : d.cp[i - 1]
export function split(d, i) { const a = segStart(d, i), e = d.cp[i]; return (e == null || a == null) ? null : (e - a) / 1000 }
export const relDur = r => (r.s == null || r.e == null) ? null : (r.e - r.s) / 1000
export function endMs(d) {
  let m = 0
  d.cp.forEach(v => { if (v != null) m = Math.max(m, v) })
  Object.values(d.relays || {}).forEach(rs => rs.forEach(r => { if (r.e != null) m = Math.max(m, r.e); if (r.s != null) m = Math.max(m, r.s) }))
  return m
}
export function objCum(plan, i) { let t = 0; for (let k = 0; k <= i; k++) t += plan.obj[SEGS[k].id] || 0; return t }

// Distances de course (km) : par course, et par athlète si l'un n'a pas tout couru
export const runKm = (d, id) => (d.runs && d.runs[id] && +d.runs[id].km) || d.runKm || 1
export const athKm = (d, id, w) => (d.runs && d.runs[id] && d.runs[id][w] != null && d.runs[id][w] !== '') ? +d.runs[id][w] : runKm(d, id)
export const isPartial = (d, id, w) => athKm(d, id, w) < runKm(d, id) * 0.8
export function runTotals(d) {
  let t = 0, km = 0, n = 0
  SEGS.forEach((g, i) => { if (g.type !== 'run') return; const v = split(d, i); if (v != null) { t += v; km += runKm(d, g.id); n++ } })
  return { t, km, n, pace: km ? t / km : null }
}
export function totals(d, plan, type) {
  let t = 0, o = 0, n = 0
  SEGS.forEach((g, i) => { if (type && g.type !== type) return; const v = split(d, i); if (v != null) { t += v; o += plan.obj[g.id] || 0; n++ } })
  return { t, o, n, d: n ? t - o : null }
}

export function stStats(d, i) {
  const g = SEGS[i], rel = d.relays[g.id] || [], total = split(d, i)
  const work = { A: 0, B: 0 }, n = { A: 0, B: 0 }
  let open = false
  rel.forEach(r => { const x = relDur(r); if (x == null) open = true; else { work[r.w] = (work[r.w] || 0) + x; n[r.w] = (n[r.w] || 0) + 1 } })
  const trans = (total != null && !open && rel.length) ? total - work.A - work.B : null
  let tIn = null, tSw = 0, tOut = null
  const a = segStart(d, i), e = d.cp[i]
  if (rel.length && a != null && rel[0].s != null) tIn = (rel[0].s - a) / 1000
  for (let k = 1; k < rel.length; k++) if (rel[k].s != null && rel[k - 1].e != null) tSw += (rel[k].s - rel[k - 1].e) / 1000
  const last = rel[rel.length - 1]
  if (last && last.e != null && e != null) tOut = (e - last.e) / 1000
  return { total, work, n, trans, tIn, tSw, tOut, rel }
}

// Unité de comptage du « réalisé » d'un atelier (propre à la séance si changée)
export const unitOf = (d, plan, id) => (d.units && d.units[id]) || (plan.strat[id] || {}).u || STATION[id].u
export function totOf(d, plan, id, u) {
  const st = plan.strat[id] || {}
  if (u === st.u) return st.tot
  if (u === 's') return workObjective(plan, id)
  const nat = STATION[id]; return nat && nat.u === u ? nat.tot : null
}
export function relAmt(d, plan, id, k, r) {
  if (r && r.a != null && r.b != null) return { a: r.a, b: r.b, own: true }
  if (unitOf(d, plan, id) !== (plan.strat[id] || {}).u) return null
  const p = planRelays(plan, id)[k]
  return (p && (!r || p.w === r.w)) ? { a: p.a, b: p.b, own: false } : null
}
export function relObj(d, plan, id, k, r) {
  if (r && r.a != null && r.b != null) { const tot = totOf(d, plan, id, unitOf(d, plan, id)); return tot ? workObjective(plan, id) * (r.b - r.a) / tot : null }
  const p = planRelays(plan, id)[k]
  return p && r && p.w === r.w ? workObjective(plan, id) * p.frac : null
}

// ---------- pointage (renvoie une nouvelle copie de data) ----------
const clone = d => JSON.parse(JSON.stringify(d))
function planned(plan, id, k, w) { const p = planRelays(plan, id)[k]; return p && p.w === w ? { a: p.a, b: p.b } : { a: null, b: null } }

export const actions = {
  start(d, now) { d = clone(d); d.startedAt = now; return d },
  endSegment(d, t) { d = clone(d); const i = nextIdx(d); if (i >= 0) d.cp[i] = t; return d },
  roxStart(d, t, w, plan) {
    d = clone(d); const i = nextIdx(d); if (i < 0 || SEGS[i].type !== 'rox') return d
    d.cp[i] = t; const id = SEGS[i + 1].id
    d.relays[id].push({ w, s: t, e: null, ...planned(plan, id, d.relays[id].length, w) }); return d
  },
  startRelay(d, t, w, plan) {
    d = clone(d); const id = SEGS[nextIdx(d)].id
    d.relays[id].push({ w, s: t, e: null, ...planned(plan, id, d.relays[id].length, w) }); return d
  },
  swapRelay(d, t, w, plan) {
    d = clone(d); const id = SEGS[nextIdx(d)].id, rs = d.relays[id], l = rs[rs.length - 1]
    if (l && l.e == null) l.e = t
    rs.push({ w, s: t, e: null, ...planned(plan, id, rs.length, w) }); return d
  },
  stopRelay(d, t) { d = clone(d); const id = SEGS[nextIdx(d)].id, rs = d.relays[id], l = rs[rs.length - 1]; if (l && l.e == null) l.e = t; return d },
  exitStation(d, t) { d = clone(d); const i = nextIdx(d), id = SEGS[i].id, rs = d.relays[id], l = rs[rs.length - 1]; if (l && l.e == null) l.e = t; d.cp[i] = t; return d },
  reset(d) { const e = emptyData(d.runKm); return { ...e, runs: d.runs, units: d.units, note: d.note } },
}
