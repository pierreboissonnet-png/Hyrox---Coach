// Données de base Hyrox : segments, plan par défaut, formats. Logique pure, sans dépendance.

export const STATIONS = [
  { id: 'ski', label: 'SkiErg', sub: '1000 m', u: 'm', tot: 1000 },
  { id: 'push', label: 'Sled Push', sub: '50 m', u: 'm', tot: 50 },
  { id: 'pull', label: 'Sled Pull', sub: '50 m', u: 'm', tot: 50 },
  { id: 'burp', label: 'Burpees Broad Jump', sub: '80 m', u: 'm', tot: 80 },
  { id: 'row', label: 'Rameur', sub: '1000 m', u: 'm', tot: 1000 },
  { id: 'farm', label: 'Farmers Carry', sub: '200 m', u: 'm', tot: 200 },
  { id: 'lunge', label: 'Fentes sandbag', sub: '100 m', u: 'm', tot: 100 },
  { id: 'wb', label: 'Wall Balls', sub: '100 reps', u: ' reps', tot: 100 },
]
export const STATION = Object.fromEntries(STATIONS.map(s => [s.id, s]))

// Ordre : course k, Rox entrée k, atelier k, Rox sortie k (pas de Rox après les Wall Balls) → 31 segments
export const SEGS = []
STATIONS.forEach((st, k) => {
  SEGS.push({ id: 'r' + (k + 1), type: 'run', label: 'Course ' + (k + 1), short: 'C' + (k + 1), k })
  SEGS.push({ id: 'ri' + (k + 1), type: 'rox', dir: 'in', label: 'Rox → ' + st.label, short: '', k })
  SEGS.push({ id: st.id, type: 'st', label: st.label, sub: st.sub, short: st.label.split(' ')[0], k })
  if (k < 7) SEGS.push({ id: 'ro' + (k + 1), type: 'rox', dir: 'out', label: 'Rox → Course ' + (k + 2), short: '', k })
})
export const N = SEGS.length
export const NB = { run: 8, rox: 15, st: 8 }

// Objectifs (secondes) par défaut, à ajuster dans le plan de l'équipe
export function defaultObjectives(runSec = 330) {
  const o = { ski: 240, push: 180, pull: 240, burp: 270, row: 210, farm: 90, lunge: 240, wb: 270 }
  for (let k = 1; k <= 8; k++) { o['r' + k] = runSec; o['ri' + k] = 30; if (k < 8) o['ro' + k] = 20 }
  return o
}

const T = rows => rows.map(([a, b, w, n]) => ({ a, b, w, n: n || '' }))
// Stratégie de relais par défaut (slots A et B = les deux membres du duo)
export function defaultStrategy() {
  return {
    ski: { u: 's', tot: 240, trans: 4, t: T([[0,30,'A','1:50/500'],[30,60,'B','1:45/500'],[60,90,'A','1:50/500'],[90,120,'B','1:45/500'],[120,150,'A','1:50/500'],[150,180,'B','1:45/500'],[180,210,'A','1:50/500'],[210,240,'B','1:45/500']]) },
    push: { u: 'm', tot: 50, trans: 2, t: T([[0,6,'A','80%'],[6,12,'B','80%'],[12,18,'A','80%'],[18,25,'B','80%'],[25,31,'A','80%'],[31,37,'B','80%'],[37,43,'A','80%'],[43,50,'B','80%']]) },
    pull: { u: 'm', tot: 50, trans: 2, t: T([[0,12,'A'],[12,25,'B'],[25,37,'A'],[37,50,'B']]) },
    burp: { u: 'm', tot: 80, trans: 1, t: T([[0,10,'A','5 sauts'],[10,20,'B','4 sauts'],[20,30,'A'],[30,40,'B'],[40,50,'A'],[50,60,'B'],[60,70,'A'],[70,80,'B']]) },
    row: { u: 'm', tot: 1000, trans: 6, t: T([[0,250,'B'],[250,500,'A'],[500,750,'B'],[750,1000,'A']]) },
    farm: { u: 'm', tot: 200, trans: 3, t: T([[0,100,'A'],[100,200,'B']]) },
    lunge: { u: 'm', tot: 100, trans: 1, t: T([[0,25,'A'],[25,50,'B'],[50,75,'A'],[75,100,'B']]) },
    wb: { u: ' reps', tot: 100, trans: 2, t: T([[0,10,'A'],[10,20,'B'],[20,30,'A'],[30,40,'B'],[40,50,'A'],[50,60,'B'],[60,70,'A'],[70,80,'B'],[80,90,'A'],[90,100,'B']]) },
  }
}

export function defaultPlan() {
  return { obj: defaultObjectives(), runKm: 1.0, strat: defaultStrategy() }
}
export function normPlan(p) {
  const d = defaultPlan()
  p = p || {}
  return { obj: { ...d.obj, ...(p.obj || {}) }, runKm: +p.runKm || d.runKm, strat: { ...d.strat, ...(p.strat || {}) } }
}

// Tranches consécutives du même athlète fusionnées en un relais
export function planRelays(plan, id) {
  const st = plan.strat[id]; if (!st) return []
  const out = []
  ;[...st.t].sort((x, y) => x.a - y.a).forEach(({ a, b, w, n }) => {
    const last = out[out.length - 1]
    if (last && last.w === w) { last.b = b; if (n && !last.notes.includes(n)) last.notes.push(n) }
    else out.push({ a, b, w, notes: n ? [n] : [] })
  })
  out.forEach(r => { r.frac = (r.b - r.a) / (st.tot || 1); r.label = fmtU(r.a, st.u) + '–' + fmtU(r.b, st.u) })
  return out
}
export const changeObjective = (plan, id) => Math.max(0, planRelays(plan, id).length - 1) * ((plan.strat[id] || {}).trans || 0)
export const workObjective = (plan, id) => (plan.strat[id] || {}).u === 's' ? (plan.strat[id].tot || 0) : Math.max(0, (plan.obj[id] || 0) - changeObjective(plan, id))
export function relayObjective(plan, id, k, w) {
  const p = planRelays(plan, id)[k]
  return p && p.w === w ? workObjective(plan, id) * p.frac : null
}

// ---------- formats ----------
export function fmt(sec, tenths) {
  if (sec == null || !isFinite(sec)) return '—'
  const neg = sec < 0; sec = Math.abs(sec)
  sec = tenths ? Math.floor(sec * 10) / 10 : Math.round(sec)
  const h = Math.floor(sec / 3600), m = Math.floor(sec % 3600 / 60), s = sec - h * 3600 - m * 60
  const ss = tenths ? s.toFixed(1).padStart(4, '0') : String(Math.round(s)).padStart(2, '0')
  return (neg ? '−' : '') + (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + ss
}
export function parseT(str) {
  str = String(str ?? '').trim().replace(',', '.')
  if (!str) return null
  const parts = str.split(':')
  if (parts.length > 3 || parts.some(p => p === '' || isNaN(+p))) return NaN
  return parts.reduce((a, p) => a * 60 + (+p), 0)
}
export const fd = d => d == null ? '—' : (d > 0.5 ? '+' : d < -0.5 ? '−' : '±') + fmt(Math.abs(d))
export const fp = (d, o) => (d == null || !o) ? '—' : (d > 0 ? '+' : d < 0 ? '−' : '') + Math.abs(d / o * 100).toLocaleString('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + ' %'
export const tone = d => d == null ? '' : d > 2 ? 'bad' : d < -2 ? 'good' : 'even'
export const fmtU = (v, u) => u === 's' ? fmt(v) : v + (u === 'm' ? 'm' : u)
export const kmStr = v => String(Math.round(v * 100) / 100).replace('.', ',') + ' km'
export const todayISO = () => { const d = new Date(); return new Date(d - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10) }
export const frDate = iso => iso ? iso.split('-').reverse().join('/') : '—'
export const daysUntil = iso => Math.ceil((new Date(iso + 'T00:00:00') - new Date(new Date().toDateString())) / 864e5)
