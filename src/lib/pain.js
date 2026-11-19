// Douleurs déclarées : l'app ne pose aucun diagnostic. Elle signale les mouvements qui sollicitent la zone,
// propose des alternatives et rappelle quand consulter. Repères généraux, pas un avis médical.
import { EX, defaultTarget } from './custom.js'

export const ZONES = [
  ['cervicales', 'Nuque / cervicales'], ['epaule', 'Épaule'], ['coude', 'Coude'], ['poignet', 'Poignet / main'],
  ['dos', 'Bas du dos'], ['hanche', 'Hanche / fessier'], ['ischio', 'Arrière de cuisse'], ['quadri', 'Avant de cuisse'],
  ['genou', 'Genou'], ['mollet', 'Mollet / tendon d’Achille'], ['cheville', 'Cheville / pied'],
]
export const ZONE = Object.fromEntries(ZONES)
export const WHEN = [['effort', 'Pendant l’effort'], ['apres', 'Après l’effort'], ['repos', 'Au repos'], ['nuit', 'La nuit / au réveil']]

// Conseils par zone : à éviter tant que ça fait mal, à adapter, généralement bien toléré si indolore
export const ADVICE = {
  cervicales: { avoid: ['Charges sur la nuque (squat barre haute)', 'Tirages lourds avec haussement d’épaules'], adapt: ['Goblet squat ou presse à la place du squat barre', 'Regard neutre au rameur et au SkiErg'], ok: ['Vélo, marche, course facile', 'Gainage sur les avant-bras'] },
  epaule: { avoid: ['Mouvements au-dessus de la tête (développé militaire, wall balls, thruster)', 'Dips, tractions et kipping', 'Pompes et burpees si l’appui fait mal'], adapt: ['Wall balls : cible plus basse ou ballon plus léger', 'SkiErg à amplitude réduite, ou rameur', 'Développé haltères prise neutre, amplitude sans douleur'], ok: ['Course, vélo, presse à cuisses', 'Gainage sur les avant-bras si indolore'] },
  coude: { avoid: ['Tractions, sled pull lourd', 'Curl et extensions triceps lourds', 'Escalade'], adapt: ['Prises neutres ou plus larges', 'Sled pull plus léger, bras moins fléchis'], ok: ['Course, vélo, rameur doux', 'Travail des jambes'] },
  poignet: { avoid: ['Burpees et pompes à plat', 'Front squat, épaulé', 'Farmers carry lourd'], adapt: ['Pompes sur poignées ou poings fermés', 'Burpees sur une box', 'Sangles pour le farmers carry'], ok: ['Course, vélo', 'Squat goblet tenu contre la poitrine si indolore'] },
  dos: { avoid: ['Soulevé de terre et rowing barre lourds', 'Kettlebell swing, sled pull lourd', 'Flexions répétées chargées'], adapt: ['Hip thrust ou presse à la place du soulevé de terre', 'Tirage poitrine appuyée', 'Rameur à intensité douce, dos neutre'], ok: ['Marche, vélo, course facile si indolore', 'Dead bug, gainage, Pallof press'] },
  hanche: { avoid: ['Fentes profondes et fentes sautées', 'Squats très profonds chargés'], adapt: ['Amplitude réduite sans douleur', 'Presse à cuisses, step-up bas'], ok: ['Vélo, rameur doux', 'Haut du corps, gainage'] },
  ischio: { avoid: ['Sprints, accélérations', 'Soulevé de terre jambes tendues, leg curl lourd'], adapt: ['Course facile seulement, sans accélération', 'Hip thrust léger'], ok: ['Vélo facile, natation', 'Haut du corps'] },
  quadri: { avoid: ['Sprints, sauts', 'Leg extension lourde'], adapt: ['Sled push plus léger', 'Squat à amplitude réduite'], ok: ['Vélo facile, natation', 'Haut du corps, gainage'] },
  genou: { avoid: ['Sauts (box jumps, burpees broad jump, fentes sautées)', 'Fentes profondes et squats chargés profonds', 'Descentes en course'], adapt: ['Vélo ou elliptique à la place de la course', 'Hip thrust, leg curl, presse à amplitude réduite', 'Wall balls vers une cible plus basse, squat partiel'], ok: ['Natation (sans brasse si douloureux), haut du corps', 'Rameur doux si indolore'] },
  mollet: { avoid: ['Sprints, côtes, corde à sauter', 'Sauts et pliométrie'], adapt: ['Vélo, natation, rameur', 'Course seulement si la douleur reste ≤ 3/10 et n’augmente pas le lendemain'], ok: ['Haut du corps, gainage', 'Travail des hanches'] },
  cheville: { avoid: ['Sauts, corde à sauter', 'Course sur terrain irrégulier'], adapt: ['Vélo, rameur, natation', 'Exercices assis ou allongés'], ok: ['Haut du corps, gainage', 'Hip thrust, leg curl'] },
}
// Remplaçants par exercice (le premier qui ne sollicite aucune zone douloureuse est retenu)
const ALT = {
  run: ['bike', 'elliptical', 'row', 'swim', 'airbike'], burp: ['row', 'bike', 'ski'], burpee: ['airbike', 'row', 'bike'], boxjump: ['stepup', 'legpress', 'hipthrust'], jumplunge: ['hipthrust', 'legcurl'],
  lunge: ['legpress', 'hipthrust', 'stepup'], lunges: ['legpress', 'hipthrust', 'stepup'], bulgarian: ['legpress', 'hipthrust', 'legcurl'], squat: ['legpress', 'hipthrust', 'legcurl', 'goblet'], frontsquat: ['legpress', 'goblet', 'hipthrust'], goblet: ['legpress', 'hipthrust'],
  wb: ['ski', 'row', 'airbike', 'bike'], thruster: ['legpress', 'hipthrust'], push: ['bike', 'airbike', 'row'], pull: ['seatedrow', 'row', 'bike'], farm: ['seatedrow', 'bike'], ski: ['row', 'bike', 'airbike'], row: ['bike', 'airbike', 'ski'],
  deadlift: ['hipthrust', 'legcurl', 'legpress'], rdl: ['hipthrust', 'legcurl'], kbswing: ['hipthrust', 'airbike'], bentrow: ['seatedrow', 'latpull', 'invrow'], dbrow: ['seatedrow', 'latpull'],
  bench: ['chestpress', 'dbpress', 'pushup'], ohp: ['dbpress', 'lateral', 'chestpress'], dbpress: ['chestpress', 'pushup'], pullup: ['latpull', 'invrow', 'seatedrow'], dips: ['chestpress', 'pushup'], pushup: ['chestpress', 'dbpress'],
  rope: ['bike', 'airbike', 'row'], stairs: ['bike', 'row'], bike: ['row', 'swim', 'ski'], airbike: ['row', 'ski', 'swim'], mountain: ['deadbug', 'hollow'], plank: ['deadbug', 'pallof'], sideplank: ['pallof', 'deadbug'],
  abwheel: ['deadbug', 'pallof'], legraise: ['deadbug', 'pallof'], russian: ['pallof', 'deadbug'], t2b: ['deadbug', 'hollow'], curl: ['seatedrow'], triceps: ['chestpress'], lateral: ['seatedrow'], clean: ['hipthrust', 'kbswing'], sbclean: ['hipthrust', 'farm'],
}
export const isActive = p => p && p.data && p.data.status !== 'resolved'
export const activeZones = pains => [...new Set((pains || []).filter(isActive).map(p => p.data.zone))]
export const maxLevel = (pains, zone) => Math.max(0, ...(pains || []).filter(p => isActive(p) && (!zone || p.data.zone === zone)).map(p => +p.data.level || 0))
/** L'exercice sollicite-t-il une zone douloureuse ? Renvoie la liste des zones concernées */
export const hits = (ex, zones) => ((EX[ex] || {}).z || []).filter(z => zones.includes(z))
export function altFor(ex, zones) { return (ALT[ex] || []).find(a => EX[a] && !hits(a, zones).length) || null }

/** Signaux qui doivent amener à consulter (médecin, kiné) plutôt qu'à adapter seul */
export function redFlags(p) {
  const d = (p && p.data) || {}, out = [], days = d.since ? Math.round((Date.now() - new Date(d.since)) / 864e5) : 0
  if ((+d.level || 0) >= 7) out.push('Douleur forte (≥ 7/10) : arrêtez les exercices qui la déclenchent et consultez.')
  if ((d.when || []).includes('nuit')) out.push('Douleur la nuit ou au réveil : à faire examiner par un professionnel de santé.')
  if (d.swelling) out.push('Gonflement, chaleur ou rougeur : consultez rapidement.')
  if (d.numb) out.push('Fourmillements, engourdissement ou perte de force : consultez sans attendre.')
  if (d.trauma) out.push('Douleur apparue après une chute, un choc ou un craquement : consultez avant de reprendre.')
  if (days >= 14) out.push(`Douleur présente depuis ${days} jours : un avis médical ou kiné est recommandé.`)
  return out
}
/** Règle simple de reprise : la douleur pendant l'effort doit rester ≤ 3/10 et ne pas augmenter le lendemain */
export const PAIN_RULE = 'Repère courant : une gêne qui reste ≤ 3/10 pendant l’effort et ne s’aggrave pas le lendemain est en général compatible avec l’entraînement adapté. Au-delà, on arrête l’exercice concerné.'

/**
 * Adapte des blocs de séance aux douleurs : remplace les exercices qui sollicitent une zone douloureuse.
 * Renvoie {blocks, swaps: [{from, to, zone}]}
 */
export function adaptBlocks(blocks, zones) {
  const swaps = []
  const fix = (b, inGroup) => {
    const h = hits(b.ex, zones); if (!h.length) return b
    const a = altFor(b.ex, zones); swaps.push({ from: b.ex, to: a, zone: h[0] }); if (!a) return b
    const t = b.target || {}, same = Object.keys(t).filter(k => t[k] != null && k !== 'rir').every(k => EX[a].m.includes(k))
    return { ...b, ex: a, target: same ? t : defaultTarget(a, inGroup), setTargets: same ? b.setTargets : undefined, note: [b.note, 'remplace ' + EX[b.ex].label.toLowerCase() + ' (douleur)'].filter(Boolean).join(' · ') }
  }
  const out = (blocks || []).map(b => b && b.type === 'group' ? { ...b, items: b.items.map(i => fix(i, true)) } : fix(b, false))
  return { blocks: out, swaps }
}
