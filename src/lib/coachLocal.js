// Coach « local » (gratuit) : rédige l'analyse d'une séance sans service d'IA payant,
// à partir des mêmes données que le coach Claude (objectifs, réalisé, relais, cardio).
import { SEGS, STATIONS, fmt, fd } from './hyrox.js'
import { DRILLS } from './program.js'
import { split, runKm, hasB } from './session.js'
import { summary, insights } from './analyze.js'
import { isCustom, customSummary, progression, exLabel, fmtTarget, doneOf, achievement } from './custom.js'

const pct = a => Math.round(a * 100) + ' %'

/** Texte (markdown simple) pour une séance Hyrox */
function hyroxText(s, plan, who, hrBy) {
  const sum = summary(s, plan), out = []
  if (!sum.all.n) return 'Pas encore de temps pointés pour cette séance.'
  const duo = hasB(s)
  const st = sum.stations.filter(x => x.d != null)
  const late = [...st].sort((a, b) => b.d - a.d).filter(x => x.d > 5), fast = [...st].sort((a, b) => a.d - b.d).filter(x => x.d < -3)
  out.push('## En bref')
  out.push(`${sum.complete ? 'Séance complète' : `${sum.all.n} segments pointés sur 31`} en **${fmt(sum.all.t)}**, soit ${fd(sum.all.d)} par rapport à l’objectif (${fmt(sum.all.o)}). Courses ${fmt(sum.run.t)} (${sum.pace ? fmt(sum.pace) + '/km' : '—'}), ateliers ${fmt(sum.st.t)} (${fd(sum.st.d)}), Rox ${fmt(sum.rox.t)} (${fd(sum.rox.d)}).`)
  out.push('## Ce qui a marché')
  if (fast.length) fast.slice(0, 3).forEach(x => out.push(`- ${x.label} : ${fmt(x.t)}, ${fd(x.d)} sur l’objectif`))
  else out.push(`- ${sum.st.d != null && sum.st.d <= 0 ? 'Ateliers dans l’objectif' : 'Séance menée jusqu’au bout : c’est la base de la progression'}`)
  if (sum.rox.n && sum.rox.d < 0) out.push(`- Transitions efficaces : Rox ${fd(sum.rox.d)}`)
  out.push('## À travailler')
  const pri = []
  late.slice(0, 2).forEach(x => pri.push({ gain: x.d, text: `${x.label} : ${fd(x.d)} (${fmt(x.t)} pour ${fmt(x.o)})` }))
  const runs = SEGS.map((g, i) => g.type === 'run' && split(sum.d, i) != null ? split(sum.d, i) / runKm(sum.d, g.id) : null).filter(v => v != null)
  if (runs.length >= 6) { const h = Math.floor(runs.length / 2), a = runs.slice(0, h).reduce((p, q) => p + q, 0) / h, b = runs.slice(h).reduce((p, q) => p + q, 0) / (runs.length - h); if (b - a > 10) pri.push({ gain: (b - a) * 4, text: `Allure qui chute de ${fmt(b - a)}/km en seconde moitié : endurance spécifique (« compromised running »)` }) }
  if (sum.rox.n && sum.rox.d > 15) pri.push({ gain: sum.rox.d, text: `Rox : ${fd(sum.rox.d)} au total, anticipez entrées et sorties d’atelier` })
  if (duo && sum.trans > 0) { const n = sum.stations.reduce((a, x) => a + Math.max(0, x.rel.length - 1), 0); if (n && sum.trans / n > 3.5) pri.push({ gain: sum.trans - n * 2.5, text: `Changements de relais : ${(sum.trans / n).toFixed(1).replace('.', ',')} s par passage (visez 2 à 3 s)` }) }
  pri.sort((a, b) => b.gain - a.gain).slice(0, 3).forEach(p => out.push('- ' + p.text))
  if (!pri.length) out.push('- Rien de marquant : maintenez la régularité et augmentez progressivement l’intensité.')
  out.push('## Prochaine séance')
  const w = late[0]
  out.push(w ? `${DRILLS[w.id]} ; enchaînez chaque série avec 500 m de course à allure course (zone 4).` : 'Séance au seuil : 5 × 1 km à allure course, récupération 1 min 30, puis 3 ateliers techniques.')
  if (duo) {
    out.push('## Répartition des relais')
    const unbalanced = sum.stations.filter(x => x.rel.length && (x.work.A + x.work.B) > 30).map(x => ({ x, r: x.work.A / (x.work.A + x.work.B) })).filter(o => Math.abs(o.r - 0.5) > 0.12)
    if (unbalanced.length) unbalanced.slice(0, 3).forEach(o => out.push(`- ${o.x.label} : ${who('A')} ${pct(o.r)} du travail, ${who('B')} ${pct(1 - o.r)}${o.r > 0.5 ? ` (${who('A')} porte davantage)` : ` (${who('B')} porte davantage)`}`))
    else out.push('- Travail bien réparti entre les deux partenaires.')
  }
  if (hrBy && Object.keys(hrBy).length) {
    out.push('## Cardio')
    Object.entries(hrBy).forEach(([w, h]) => { if (h && h.all) out.push(`- ${who(w)} : moyenne ${Math.round(h.all.avg)} bpm, max ${h.all.max} ; ${Math.round(h.zones[4] * 100)} % du temps en zone 5${h.zones[4] > 0.25 ? ' : beaucoup, ajoutez du volume en zone 2' : ''}`) })
  }
  return out.join('\n')
}

/** Texte pour une séance spécialisée */
function customText(s, who, hrSteps) {
  const sum = customSummary(s), out = []
  if (!sum.done) return 'Pas encore d’exercice réalisé pour cette séance.'
  const st = sum.steps.map((x, i) => ({ x, i, a: achievement(x), d: doneOf(x) })).filter(o => o.a != null)
  out.push('## En bref')
  out.push(`${sum.done}/${sum.n} étapes réalisées en ${fmt(sum.total)} (travail ${fmt(sum.work)}). Objectifs atteints en moyenne à **${sum.achievement != null ? pct(sum.achievement) : '—'}**.`)
  out.push('## Ce qui a marché')
  const ok = st.filter(o => o.a >= 1).sort((a, b) => b.a - a.a)
  if (ok.length) ok.slice(0, 3).forEach(o => out.push(`- ${exLabel(o.x)}${o.x.of > 1 ? ' (série ' + o.x.set + ')' : ''} : ${fmtTarget(o.d)} pour ${fmtTarget(o.x.target)} (${pct(o.a)})`))
  else out.push('- Séance terminée : la régularité compte plus que la performance d’un jour.')
  out.push('## À travailler')
  const ko = st.filter(o => o.a < 0.95).sort((a, b) => a.a - b.a)
  if (ko.length) ko.slice(0, 3).forEach(o => out.push(`- ${exLabel(o.x)}${o.x.of > 1 ? ' (série ' + o.x.set + ')' : ''} : ${pct(o.a)} de l’objectif (${fmtTarget(o.d)} pour ${fmtTarget(o.x.target)})`))
  else out.push('- Tous les objectifs sont atteints : il est temps de les relever.')
  // baisse au fil des séries
  const groups = {}; st.forEach(o => (groups[o.x.g] = groups[o.x.g] || []).push(o))
  Object.values(groups).filter(L => L.length >= 3).forEach(L => { if (L[L.length - 1].a < L[0].a - 0.08) out.push(`- ${exLabel(L[0].x)} : baisse de ${pct(L[0].a - L[L.length - 1].a)} entre la première et la dernière série, allongez un peu la récupération ou réduisez la cible`) })
  out.push('## Prochaine séance')
  progression(s, hrSteps || {}).slice(0, 5).forEach(p => out.push(`- ${p.label} : ${fmtTarget(p.next)} (${p.why})`))
  return out.join('\n')
}

/** Analyse complète (texte) */
export function localCoach(s, plan, who, { hrBy, hrSteps, scope, station } = {}) {
  if (isCustom(s)) return customText(s, who, hrSteps)
  if (scope === 'station' && station) {
    const sum = summary(s, plan), x = sum.stations.find(o => o.label === station)
    if (!x || x.t == null) return 'Atelier non pointé.'
    const id = STATIONS.find(o => o.label === station).id
    return [`## ${station}`, `${fmt(x.t)} pour un objectif de ${fmt(x.o)} (${fd(x.d)}).`, x.rel.length > 1 ? `${x.rel.length} relais, ${x.trans != null ? fmt(x.trans) + ' de changements' : ''}.` : '', '## Exercice conseillé', DRILLS[id]].filter(Boolean).join('\n')
  }
  return hyroxText(s, plan, who, hrBy)
}
