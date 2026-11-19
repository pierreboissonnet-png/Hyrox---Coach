// Analyses : statistiques par séance, par athlète (toutes équipes confondues) et conseils.
import { SEGS, STATIONS, STATION, normPlan, fmt, fd } from './hyrox.js'
import { normData, split, stStats, relDur, relAmt, totOf, unitOf, runKm, isPartial, totals, runTotals } from './session.js'
import { series, hrStat, zonesOf, zoneOf, hrAt } from './hr.js'
import { phaseOn, phaseEffects, phaseWeight } from './health.js'
import { isCustom, stationEquivalents } from './custom.js'

export const slotOf = (s, uid) => s.athletes && s.athletes.A === uid ? 'A' : s.athletes && s.athletes.B === uid ? 'B' : null
export const isComplete = d => d.cp.every(v => v != null)

/** Résumé d'une séance par rapport au plan de l'équipe */
export function summary(s, planRaw) {
  if (isCustom(s)) s = { ...s, data: {} }   // séance spécialisée : pas de segments Hyrox
  const d = normData(s.data), plan = normPlan(planRaw)
  const all = totals(d, plan), run = totals(d, plan, 'run'), rox = totals(d, plan, 'rox'), st = totals(d, plan, 'st')
  const rt = runTotals(d)
  const stations = STATIONS.map(x => {
    const i = SEGS.findIndex(g => g.id === x.id), t = split(d, i), o = plan.obj[x.id]
    return { id: x.id, label: x.label, t, o, d: t == null ? null : t - o, ...stStats(d, i) }
  })
  let trans = 0; stations.forEach(x => { if (x.trans != null) trans += x.trans })
  return { d, plan, all, run, rox, st, pace: rt.pace, stations, trans, complete: isComplete(d) }
}

/**
 * Capacités d'un athlète tirées de toutes ses séances visibles (y compris avec d'anciens partenaires).
 * st[id] = temps estimé pour réaliser 100 % de l'atelier en relais ; pace = s/km ; rox = s par Rox.
 */
export function athleteStats(uid, sessions, plansByTeam, { last = 8, weight = null } = {}) {
  const mine = sessions.filter(s => slotOf(s, uid)).sort((a, b) => (b.session_date || '').localeCompare(a.session_date || '')).slice(0, last)
  const acc = {}; STATIONS.forEach(x => { acc[x.id] = { dur: 0, frac: 0, n: 0 } })
  let pSum = 0, pKm = 0, roxSum = 0, roxN = 0
  mine.forEach(s => {
    const w = slotOf(s, uid), d = normData(s.data), plan = normPlan(s.plan || plansByTeam[s.team_id])
    const k = weight ? weight(s) : 1   // pondération (ex. phase du cycle)
    if (isCustom(s)) {   // séance spécialisée : équivalents « atelier complet », comptés à 70 % (effort frais)
      stationEquivalents(s, uid).forEach(q => {
        if (q.st) { acc[q.st].dur += k * q.w * q.full * q.frac; acc[q.st].frac += k * q.w * q.frac; acc[q.st].n++ }
        else if (q.run) { pSum += k * q.w * q.pace * q.km; pKm += k * q.w * q.km }
      })
      return
    }
    SEGS.forEach((g, i) => {
      if (g.type === 'run') { const v = split(d, i); if (v != null && !isPartial(d, g.id, w)) { pSum += k * v; pKm += k * runKm(d, g.id) } return }
      if (g.type === 'rox') { const v = split(d, i); if (v != null && v < 180) { roxSum += k * v; roxN += k } return }
      const id = g.id, u = unitOf(d, plan, id), tot = totOf(d, plan, id, u)
      const rel = d.relays[id] || []
      if (!rel.length) { const v = split(d, i); if (v != null && !(s.athletes && s.athletes.B)) { acc[id].dur += k * v; acc[id].frac += k; acc[id].n++ } return }
      if (u === 's' || !tot) { // relais en temps : on prend le travail total de l'atelier pour les deux
        const x = stStats(d, i); if (x.trans != null) { acc[id].dur += k * (x.work.A + x.work.B); acc[id].frac += k; acc[id].n++ } return
      }
      rel.forEach((r, k) => {
        if (r.w !== w) return
        const dur = relDur(r), amt = relAmt(d, plan, id, k, r)
        if (dur == null || !amt || amt.b <= amt.a) return
        acc[id].dur += k * dur; acc[id].frac += k * (amt.b - amt.a) / tot; acc[id].n++
      })
    })
  })
  const st = {}; STATIONS.forEach(x => { const a = acc[x.id]; st[x.id] = a.frac > 0.15 ? a.dur / a.frac : null })
  return { st, n: Object.fromEntries(STATIONS.map(x => [x.id, acc[x.id].n])), pace: pKm ? pSum / pKm : null, rox: roxN ? roxSum / roxN : null, sessions: mine.length }
}

/** Fréquence cardiaque moyenne par segment, et répartition en zones */
export function hrBySegment(s, row, profile) {
  const d = normData(s.data), S = series(row); if (!S) return null
  const zones = zonesOf(profile)
  const segs = SEGS.map((g, i) => { const a = i === 0 ? 0 : d.cp[i - 1], e = d.cp[i]; return (a == null || e == null) ? null : hrStat(S, a / 1000, e / 1000) })
  const end = Math.max(...d.cp.filter(v => v != null), 0) / 1000
  const z = [0, 0, 0, 0, 0]; let n = 0
  for (let t = 0; t <= end; t++) { const v = hrAt(S, t); if (v != null) { z[zoneOf(zones, v) - 1]++; n++ } }
  return { segs, zones: z.map(x => n ? x / n : 0), all: hrStat(S, 0, end), n }
}

/** Conseils lisibles tirés d'une séance (et de la précédente si fournie) */
export function insights(sum, prev) {
  const out = []
  if (!sum || !sum.all.n) return out
  const late = sum.stations.filter(x => x.d != null && x.d > 8).sort((a, b) => b.d - a.d)
  const fast = sum.stations.filter(x => x.d != null && x.d < -8).sort((a, b) => a.d - b.d)
  if (late.length) out.push({ tone: 'bad', text: `Ateliers à travailler : ${late.slice(0, 3).map(x => `${x.label} (${fd(x.d)})`).join(', ')}.` })
  if (fast.length) out.push({ tone: 'good', text: `Points forts : ${fast.slice(0, 3).map(x => `${x.label} (${fd(x.d)})`).join(', ')}.` })
  if (sum.trans > 0) {
    const n = sum.stations.reduce((a, x) => a + Math.max(0, x.rel.length - 1), 0)
    if (n) out.push({ tone: sum.trans / n > 4 ? 'bad' : 'even', text: `Changements de relais : ${fmt(sum.trans)} au total, soit ${(sum.trans / n).toFixed(1).replace('.', ',')} s par passage.` })
  }
  // dérive de l'allure de course : 4 premières vs 4 dernières
  const runs = SEGS.map((g, i) => g.type === 'run' ? split(sum.d, i) / runKm(sum.d, g.id) : null).filter(v => v != null && isFinite(v))
  if (runs.length >= 6) {
    const h = Math.floor(runs.length / 2), a = runs.slice(0, h).reduce((x, y) => x + y, 0) / h, b = runs.slice(h).reduce((x, y) => x + y, 0) / (runs.length - h)
    if (b - a > 15) out.push({ tone: 'bad', text: `L'allure de course chute de ${fmt(b - a)}/km en seconde moitié : travaillez le « compromised running » (course juste après un atelier).` })
    else out.push({ tone: 'good', text: `Allure de course régulière (${fmt(a)} puis ${fmt(b)}/km).` })
  }
  if (sum.rox.n && sum.rox.d > 20) out.push({ tone: 'bad', text: `Les Rox coûtent ${fd(sum.rox.d)} par rapport à l'objectif : anticipez les entrées/sorties d'atelier.` })
  if (prev && prev.all.n === sum.all.n && sum.complete && prev.complete) {
    const g = sum.all.t - prev.all.t
    out.push({ tone: g < 0 ? 'good' : 'bad', text: `Par rapport à la séance précédente comparable : ${fd(g)}.` })
  }
  return out
}

export function stationLabel(id) { return (STATION[id] || {}).label || id }

/**
 * Détail cardio d'un segment (atelier ou course) : par athlète et, pour un atelier en duo, par relais.
 * rows : {A: ligne hr_series, B: …} ; profiles : {A, B} pour les zones.
 */
export function segmentDetail(s, rows, profiles, i) {
  const d = normData(s.data), g = SEGS[i]
  const a = i === 0 ? 0 : d.cp[i - 1], e = d.cp[i]
  if (a == null || e == null) return null
  const A = a / 1000, E = e / 1000
  const out = { seg: g, a: A, e: E, dur: E - A, ath: {}, relays: [] }
  const S = {}
  Object.entries(rows).forEach(([w, r]) => { S[w] = series(r) })
  Object.entries(S).forEach(([w, ser]) => {
    if (!ser) return
    const st = hrStat(ser, A, E); if (!st) return
    const zones = zonesOf(profiles[w]), z = [0, 0, 0, 0, 0]; let n = 0
    for (let t = A; t <= E; t++) { const v = hrAt(ser, t); if (v != null) { z[zoneOf(zones, v) - 1]++; n++ } }
    const startHR = hrAt(ser, A), endHR = hrAt(ser, E)
    out.ath[w] = { ...st, zones: z.map(x => n ? x / n : 0), startHR, endHR }
  })
  if (g.type === 'st') (d.relays[g.id] || []).forEach((r, k) => {
    if (r.s == null || r.e == null) return
    const rs = r.s / 1000, re = r.e / 1000, other = r.w === 'A' ? 'B' : 'A'
    const work = S[r.w] ? hrStat(S[r.w], rs, re) : null
    const rest = S[other] ? hrStat(S[other], rs, re) : null
    // Récupération : baisse de FC de l'athlète dans les 30 s qui suivent la fin de son relais
    const h0 = S[r.w] ? hrAt(S[r.w], re) : null, h30 = S[r.w] ? hrAt(S[r.w], Math.min(re + 30, E)) : null
    out.relays.push({ k, w: r.w, dur: re - rs, work, rest, recovery: h0 != null && h30 != null && re + 20 <= E ? h0 - h30 : null })
  })
  return out
}

/**
 * Performances selon la phase du cycle (athlète femme) : pour chaque séance où elle est athlète,
 * écart relatif à l'objectif sur les segments pointés, et phase à la date de la séance.
 */
export function cyclePerformance(uid, sessions, plansByTeam, cycleEntries) {
  const points = []
  sessions.filter(s => slotOf(s, uid)).forEach(s => {
    const ph = phaseOn(cycleEntries, s.session_date); if (!ph) return
    const sum = summary(s, s.plan || plansByTeam[s.team_id])
    if (sum.all.n < 8 || !sum.all.o) return
    points.push({ id: s.id, phase: ph.phase, day: ph.day, rel: (sum.all.t - sum.all.o) / sum.all.o, t: sum.all.t, name: s.name, date: s.session_date })
  })
  const effects = phaseEffects(points)
  return { points, effects, weight: s => { const ph = phaseOn(cycleEntries, s.session_date); return ph ? phaseWeight(ph.phase, effects) : 1 } }
}
