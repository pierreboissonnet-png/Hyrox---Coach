// Ressenti (RPE) face à l'effort estimé d'après le cœur : la séance a-t-elle été vécue plus dure que ce que montre la FC ?
// Pour savoir si c'est un coup de mou ponctuel ou une tendance de fond (fatigue qui s'accumule, phase du cycle…),
// on compare l'écart du jour à l'écart habituel de l'athlète sur le même type de séance.
import { isCustom, rpeOf, STRENGTH, EX, customSummary } from './custom.js'
import { series, hrStat } from './hr.js'
import { normData } from './session.js'
import { phaseOn, PHASE_LABEL } from './health.js'

const r1 = v => Math.round(v * 10) / 10
const median = a => { const b = [...a].sort((x, y) => x - y), n = b.length; return n ? (n % 2 ? b[(n - 1) / 2] : (b[n / 2 - 1] + b[n / 2]) / 2) : null }
const mean = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : null
const dayDiff = (a, b) => Math.round((Date.parse(a + 'T12:00:00Z') - Date.parse(b + 'T12:00:00Z')) / 864e5)

/** Type de séance : le cœur ne réagit pas pareil en renfo qu'en cardio, on compare donc à type égal */
export function kindOf(s) {
  if (!isCustom(s)) return 'hyrox'
  const st = (s.data.steps || []).filter(x => x.done || x.e != null)
  const f = st.filter(x => STRENGTH.includes((EX[x.ex] || {}).cat)).length
  return st.length && f / st.length >= 0.5 ? 'force' : 'cardio'
}
export const KIND_LABEL = { hyrox: 'Hyrox', force: 'renfo', cardio: 'cardio et ateliers' }
export const hrMaxOf = p => (p && +p.hr_max) || (p && p.birth_year ? Math.round(208 - 0.7 * (new Date().getFullYear() - p.birth_year)) : 190)
/** Effort estimé (échelle 1–10) d'après la FC moyenne en % de la réserve cardiaque (Karvonen) */
export function estFromHR(avg, max, rest = 60) {
  if (!(avg > 0) || !(max > rest)) return null
  const r = Math.max(0, Math.min(1, (avg - rest) / (max - rest)))
  return r1(Math.max(1, Math.min(10, 10 * Math.pow(r, 1.4))))
}
/** Ressenti d'un athlète (slot) sur une séance : moyenne de ses notes */
export function feltOf(s, slot) {
  if (!isCustom(s)) return rpeOf(s.data, slot)
  const v = (s.data.steps || []).map(x => rpeOf(x.done, slot)).filter(x => x != null)
  return v.length ? r1(mean(v)) : null
}
const durSec = s => isCustom(s) ? customSummary(s).total : Math.max(0, ...normData(s.data).cp.filter(v => v != null)) / 1000
/** Point « ressenti / estimé » d'une séance pour un athlète. row : sa série cardio (ou null) */
export function effortPoint(s, uid, row, profile, rest) {
  const slot = s.athletes && s.athletes.A === uid ? 'A' : s.athletes && s.athletes.B === uid ? 'B' : null
  if (!slot) return null
  const felt = feltOf(s, slot)
  let avg = null
  const S = row ? series(row) : null
  if (S) { const h = hrStat(S, 0, durSec(s) || 3600); if (h) avg = h.avg }
  if (avg == null && s.data && s.data.avgHR && (!s.athletes.B || slot === 'A')) avg = +s.data.avgHR   // FC saisie à la main (séance perso)
  const est = estFromHR(avg, hrMaxOf(profile), rest)
  return { id: s.id, date: s.session_date, name: s.name, kind: kindOf(s), felt, est, avg: avg && Math.round(avg), gap: felt != null && est != null ? r1(felt - est) : null }
}
export function effortHistory(sessions, uid, rows, profile, rest) {
  return sessions.map(s => effortPoint(s, uid, (rows || []).find(r => r.session_id === s.id && r.user_id === uid), profile, rest))
    .filter(p => p && p.gap != null).sort((a, b) => a.date.localeCompare(b.date))
}

/**
 * Lecture du ressenti d'une séance.
 * ctx : { history (points des autres séances), cycle (entrées du journal, femmes), well (forme du jour, normalisée), sleepH }
 */
export function readEffort(p, ctx = {}) {
  if (!p || p.felt == null) return null
  if (p.est == null) return { p, level: 'nohr', title: 'Ressenti ' + p.felt + '/10', text: 'Importez le cardio (ou saisissez la FC moyenne) pour comparer votre ressenti à l’effort réel.' }
  const H = (ctx.history || []).filter(x => x.id !== p.id && x.date <= p.date && dayDiff(p.date, x.date) <= 70)
  const same = H.filter(x => x.kind === p.kind), base = same.length >= 3 ? same : H.length >= 3 ? H : null
  const usual = base ? median(base.map(x => x.gap)) : 0
  const dev = r1(p.gap - usual)
  // Tendance : les 3 dernières semaines (séances avant celle-ci) par rapport à l'habitude
  const rec = H.filter(x => dayDiff(p.date, x.date) <= 21 && dayDiff(p.date, x.date) > 0)
  const older = base ? base.filter(x => dayDiff(p.date, x.date) > 21) : []
  const ref = older.length >= 2 ? median(older.map(x => x.gap)) : usual
  const recDev = rec.length >= 2 ? r1(mean(rec.map(x => x.gap)) - ref) : null
  const why = []
  // Cycle menstruel : la même phase a-t-elle déjà donné des séances plus dures à vivre ?
  let phase = null, phaseDev = null
  if (ctx.cycle && ctx.cycle.length) {
    const ph = phaseOn(ctx.cycle, p.date)
    if (ph) {
      phase = ph.phase
      const inPh = H.filter(x => { const q = phaseOn(ctx.cycle, x.date); return q && q.phase === phase })
      if (inPh.length >= 2) phaseDev = r1(median(inPh.map(x => x.gap)) - usual)
      why.push(`J${ph.day} du cycle, phase ${PHASE_LABEL[phase].toLowerCase()}${phaseDev != null ? ` : sur vos ${inPh.length} séances précédentes dans cette phase, ressenti ${phaseDev > 0 ? '+' : ''}${String(phaseDev).replace('.', ',')} par rapport à d’habitude` : phase === 'menstruelle' ? ' (règles : fatigue, douleurs et fer plus bas rendent souvent l’effort plus dur à vivre)' : ['premenstruelle', 'luteale'].includes(phase) ? ' (température plus élevée et sommeil plus léger : l’effort est souvent perçu plus dur)' : ''}`)
    }
  }
  const w = ctx.well
  if (w && w.fatigue != null && w.fatigue >= 3.5) why.push('fatigue notée ' + w.fatigue + '/5 ce jour-là')
  if (w && w.sleep != null && w.sleep <= 1.5) why.push('mauvaise nuit déclarée')
  if (ctx.sleepH != null && ctx.sleepH < 6.5) why.push('nuit de ' + Math.floor(ctx.sleepH) + ' h ' + String(Math.round((ctx.sleepH % 1) * 60)).padStart(2, '0'))
  const f = v => (v > 0 ? '+' : '') + String(v).replace('.', ',')
  let level, title, text
  if (!base) { level = 'start'; title = dev >= 1.5 ? 'Plus dur que ce que montre le cœur' : dev <= -1.5 ? 'Plus facile que ce que montre le cœur' : 'Ressenti cohérent avec le cœur'; text = `Encore peu de séances pour connaître votre ressenti habituel (3 avec cardio et ressenti suffisent) : la comparaison s’affinera.` }
  else if (dev >= 1.5 && recDev != null && recDev >= 1) { level = 'trend'; title = 'Tendance de fond, pas qu’un coup de mou'; text = `Depuis 3 semaines, vos séances vous paraissent plus dures que d’habitude pour le même effort cardiaque (${f(recDev)} en moyenne). Fatigue qui s’accumule : allégez quelques jours (récup, sommeil, alimentation) avant de remonter la charge.` }
  else if (dev >= 1.5 && phaseDev != null && phaseDev >= 1) { level = 'cycle'; title = 'Lié à la phase du cycle'; text = `Séance vécue plus dure que d’habitude (${f(dev)}), comme vos séances précédentes dans cette même phase (${f(phaseDev)}) : c’est votre schéma, pas une fatigue de fond. Dans cette phase, privilégiez la technique, l’hydratation et des objectifs un peu plus souples.` }
  else if (dev >= 1.5) { level = 'dip'; title = 'Coup de mou sur cette séance'; text = `Séance vécue plus dure que d’habitude pour ce que montre le cœur (${f(dev)}), mais vos semaines précédentes sont dans la norme : rien d’inquiétant si la prochaine séance se passe bien.` }
  else if (dev <= -1.5) { level = 'easy'; title = 'Plus facile que d’habitude'; text = `Pour le même effort cardiaque, vous l’avez ressentie plus facile (${f(dev)}) : bonne forme, les objectifs peuvent monter.` }
  else { level = 'ok'; title = 'Ressenti dans votre norme'; text = recDev != null && recDev >= 1 ? `Cette séance est dans la norme, mais les 3 dernières semaines tirent un peu vers le haut (${f(recDev)}) : à surveiller.` : 'Ce que vous avez ressenti correspond à ce que montre votre cœur, comme d’habitude.' }
  return { p, level, title, text, why, dev, usual: r1(usual), recDev, phase, phaseDev, n: base ? base.length : H.length }
}
