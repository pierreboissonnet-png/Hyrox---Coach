// Banque d'étirements et de mobilité : positions décrites simplement, durée, zones, routines prêtes.
// Règle générale : étirer sans douleur, respirer lentement, pas d'à-coups.
import { EX, isGroup } from './custom.js'

const S = (id, name, zones, sec, how, o = {}) => ({ id, name, zones, sec, how, ...o })
export const STRETCHES = [
  S('mollet-mur', 'Mollet au mur', ['mollet', 'cheville'], 40, 'Mains au mur, une jambe tendue en arrière, talon au sol. Avancez le bassin jusqu’à sentir l’étirement dans le mollet.', { side: true }),
  S('soleaire', 'Mollet genou fléchi (soléaire)', ['mollet', 'cheville'], 40, 'Même position qu’au mur, mais genou arrière légèrement fléchi, talon toujours au sol. L’étirement descend vers le tendon d’Achille.', { side: true }),
  S('cheville-genou-mur', 'Cheville genou au mur', ['cheville'], 45, 'Pied à une main du mur, poussez le genou vers le mur sans décoller le talon. Petits allers-retours lents.', { side: true, dyn: true }),
  S('quadri-debout', 'Quadriceps debout', ['quadri', 'genou'], 40, 'Debout, attrapez la cheville derrière vous, genoux serrés, bassin légèrement basculé vers l’avant. Tenez-vous au mur si besoin.', { side: true }),
  S('psoas-fente', 'Fléchisseurs de hanche en fente', ['hanche', 'quadri', 'dos'], 45, 'Genou arrière au sol (sur un coussin), serrez le fessier et avancez doucement le bassin. Bras du côté arrière tendu vers le haut.', { side: true }),
  S('ischio-allonge', 'Ischios allongé', ['ischio'], 45, 'Sur le dos, une jambe tendue vers le plafond tenue par une sangle ou une serviette, l’autre au sol. Gardez le bas du dos au sol.', { side: true }),
  S('ischio-debout', 'Ischios jambe sur support', ['ischio'], 40, 'Talon posé sur une marche, jambe tendue, dos droit. Penchez le buste vers l’avant en partant des hanches.', { side: true }),
  S('pigeon', 'Fessier en pigeon', ['hanche'], 60, 'Jambe avant pliée devant vous, jambe arrière allongée. Descendez le buste vers le sol. Version facile : sur le dos, cheville sur le genou opposé.', { side: true }),
  S('figure4', 'Fessier sur le dos (figure 4)', ['hanche', 'dos'], 45, 'Sur le dos, cheville droite sur le genou gauche, tirez la cuisse gauche vers vous. Doux pour le bas du dos.', { side: true }),
  S('adducteurs', 'Adducteurs en papillon', ['hanche'], 45, 'Assis, plantes de pieds collées, dos droit. Laissez les genoux descendre sans forcer, coudes posés dessus.'),
  S('90-90', 'Rotation de hanches 90/90', ['hanche'], 60, 'Assis, les deux genoux pliés à 90°, basculez lentement les genoux d’un côté puis de l’autre en gardant le buste droit.', { dyn: true }),
  S('enfant', 'Posture de l’enfant', ['dos', 'epaule'], 60, 'À genoux, fesses vers les talons, bras allongés devant. Respirez dans le dos, laissez-le s’arrondir.'),
  S('chat-vache', 'Chat-vache', ['dos', 'cervicales'], 45, 'À quatre pattes, arrondissez le dos en expirant puis creusez-le en inspirant, lentement, vertèbre par vertèbre.', { dyn: true }),
  S('rotation-thoracique', 'Rotation thoracique au sol', ['dos', 'epaule'], 45, 'Allongé sur le côté, genoux pliés à 90°, ouvrez le bras du dessus vers l’arrière en suivant la main des yeux. Genoux collés.', { side: true, dyn: true }),
  S('genoux-poitrine', 'Genoux à la poitrine', ['dos'], 40, 'Sur le dos, ramenez les deux genoux vers la poitrine et bercez-vous doucement de gauche à droite.'),
  S('epaule-croise', 'Épaule bras croisé', ['epaule'], 30, 'Bras tendu devant vous, ramenez-le contre la poitrine avec l’autre main, épaule basse.', { side: true }),
  S('triceps', 'Triceps derrière la tête', ['epaule', 'coude'], 30, 'Main dans le dos entre les omoplates, l’autre main pousse doucement le coude vers le bas.', { side: true }),
  S('pectoraux-porte', 'Pectoraux dans l’encadrement', ['epaule'], 40, 'Avant-bras contre l’encadrement d’une porte, coude à hauteur d’épaule, avancez doucement le buste.', { side: true }),
  S('grand-dorsal', 'Grand dorsal à la barre ou au mur', ['epaule', 'dos'], 40, 'Mains sur un support à hauteur de hanches, reculez en poussant les fesses en arrière, bras tendus, tête entre les bras.'),
  S('avant-bras', 'Avant-bras et poignets', ['poignet', 'coude'], 30, 'Bras tendu, paume vers le haut puis vers le bas, l’autre main tire doucement les doigts vers vous.', { side: true }),
  S('nuque', 'Nuque latérale', ['cervicales'], 30, 'Assis droit, inclinez l’oreille vers l’épaule, l’épaule opposée reste basse. Sans tirer sur la tête.', { side: true }),
  S('quadrupedie-poignets', 'Mobilité des poignets', ['poignet'], 45, 'À quatre pattes, mains à plat, faites de petits cercles avec le corps au-dessus des poignets, puis doigts tournés vers les genoux.', { dyn: true }),
  S('fente-rotation', 'Fente avec rotation', ['hanche', 'dos'], 45, 'Grande fente avant, main opposée au sol, ouvrez l’autre bras vers le plafond. Alternez lentement.', { dyn: true }),
  S('squat-profond', 'Squat profond tenu', ['hanche', 'cheville'], 45, 'Descendez en squat le plus bas possible sans douleur, talons au sol (cales si besoin), coudes qui écartent les genoux.'),
  S('rouleau-mollets', 'Rouleau : mollets', ['mollet'], 60, 'Mollet sur le rouleau, roulez lentement de la cheville au genou. Pause de quelques secondes sur les zones tendues.', { side: true, roll: true }),
  S('rouleau-quadri', 'Rouleau : cuisses', ['quadri'], 60, 'Face au sol, cuisses sur le rouleau, roulez de la hanche au-dessus du genou.', { roll: true }),
  S('rouleau-dos', 'Rouleau : haut du dos', ['dos', 'epaule'], 60, 'Rouleau sous les omoplates, mains derrière la tête, roulez doucement. Évitez le bas du dos.', { roll: true }),
  S('rouleau-fessiers', 'Rouleau : fessiers', ['hanche'], 60, 'Assis sur le rouleau, cheville sur le genou opposé, penchez-vous côté jambe croisée.', { side: true, roll: true }),
]
export const STRETCH = Object.fromEntries(STRETCHES.map(s => [s.id, s]))
export const ROUTINES = [
  { id: 'apres-course', name: 'Après la course', desc: 'Mollets, cuisses, hanches.', items: ['mollet-mur', 'soleaire', 'quadri-debout', 'ischio-debout', 'psoas-fente', 'figure4'] },
  { id: 'apres-hyrox', name: 'Après un Hyrox ou une simulation', desc: 'Tout le corps, en douceur.', items: ['mollet-mur', 'quadri-debout', 'psoas-fente', 'pigeon', 'ischio-allonge', 'enfant', 'pectoraux-porte', 'avant-bras'] },
  { id: 'bas-corps', name: 'Bas du corps (après renfo)', desc: 'Quadriceps, fessiers, ischios, adducteurs.', items: ['quadri-debout', 'psoas-fente', 'pigeon', 'ischio-allonge', 'adducteurs', 'squat-profond'] },
  { id: 'haut-corps', name: 'Haut du corps', desc: 'Épaules, pectoraux, dos, avant-bras.', items: ['pectoraux-porte', 'grand-dorsal', 'epaule-croise', 'triceps', 'avant-bras', 'rotation-thoracique'] },
  { id: 'hanches-dos', name: 'Hanches et dos', desc: 'Pour les journées assises ou un dos raide.', items: ['chat-vache', 'enfant', 'figure4', '90-90', 'genoux-poitrine', 'rotation-thoracique', 'psoas-fente'] },
  { id: 'reveil', name: 'Réveil mobilité', desc: 'Mouvements lents pour démarrer la journée.', items: ['chat-vache', 'fente-rotation', '90-90', 'cheville-genou-mur', 'quadrupedie-poignets'] },
  { id: 'chevilles-mollets', name: 'Mollets et chevilles', desc: 'Après sauts, corde, course en côte.', items: ['rouleau-mollets', 'mollet-mur', 'soleaire', 'cheville-genou-mur'] },
  { id: 'rouleau', name: 'Rouleau de massage', desc: 'Relâchement global.', items: ['rouleau-mollets', 'rouleau-quadri', 'rouleau-fessiers', 'rouleau-dos'] },
  // Séances longues pour les jours sans renfo : tout le corps, de la mobilité douce aux maintiens longs
  { id: 'long-10', long: true, name: 'Express tout le corps', desc: 'Les essentiels quand on a peu de temps.', items: ['chat-vache', 'mollet-mur', 'quadri-debout', 'psoas-fente', 'figure4', 'enfant', 'pectoraux-porte'] },
  { id: 'long-20', long: true, name: 'Séance complète', desc: 'Mobilité puis étirements de la tête aux pieds.', items: ['chat-vache', '90-90', 'mollet-mur', 'soleaire', 'quadri-debout', 'psoas-fente', 'ischio-allonge', 'pigeon', 'adducteurs', 'enfant', 'rotation-thoracique', 'pectoraux-porte', 'grand-dorsal', 'nuque'] },
  { id: 'long-30', long: true, mult: 1.3, name: 'Séance longue', desc: 'Maintiens plus longs, idéale un jour de repos.', items: ['chat-vache', 'fente-rotation', '90-90', 'rouleau-mollets', 'mollet-mur', 'soleaire', 'quadri-debout', 'psoas-fente', 'ischio-allonge', 'pigeon', 'adducteurs', 'squat-profond', 'enfant', 'rotation-thoracique', 'pectoraux-porte', 'grand-dorsal', 'triceps', 'avant-bras'] },
  { id: 'long-45', long: true, mult: 1.2, name: 'Grande séance récupération', desc: 'Rouleau, mobilité et maintiens longs : la séance « spa » de la semaine.', items: ['rouleau-mollets', 'rouleau-quadri', 'rouleau-fessiers', 'rouleau-dos', 'chat-vache', 'fente-rotation', '90-90', 'cheville-genou-mur', 'mollet-mur', 'soleaire', 'quadri-debout', 'psoas-fente', 'ischio-allonge', 'ischio-debout', 'pigeon', 'figure4', 'adducteurs', 'squat-profond', 'enfant', 'genoux-poitrine', 'rotation-thoracique', 'pectoraux-porte', 'grand-dorsal', 'epaule-croise', 'triceps', 'avant-bras', 'nuque'] },
]
export const ROUTINE = Object.fromEntries(ROUTINES.map(r => [r.id, r]))
const held = (s, mult = 1) => Math.round(s.sec * mult / 5) * 5   // maintien allongé dans les séances longues
/** Durée totale d'une routine (s), côtés compris ; mult = maintiens allongés */
export const routineSec = (items, mult = 1) => items.reduce((a, id) => a + (STRETCH[id] ? (held(STRETCH[id], mult) + 5) * (STRETCH[id].side ? 2 : 1) : 0), 0)
/** Étapes jouées par le lecteur (une par côté) */
export const playSteps = (items, mult = 1) => items.flatMap(id => { const s0 = STRETCH[id]; if (!s0) return []; const s = { ...s0, sec: held(s0, mult) }; return s.side ? [{ ...s, sideLabel: 'côté gauche' }, { ...s, sideLabel: 'côté droit' }] : [{ ...s }] })

/** Routine conseillée après une séance (d'après les exercices réalisés) */
export function suggestRoutine(s) {
  const d = (s && s.data) || {}
  if (d.format !== 'custom') return ROUTINE['apres-hyrox']
  const ex = (d.blocks || []).flatMap(b => isGroup(b) ? b.items.map(i => i.ex) : [b.ex])
  const cats = ex.map(id => (EX[id] || {}).cat), z = new Set(ex.flatMap(id => (EX[id] || {}).z || []))
  if (ex.some(id => EX[id] && EX[id].st) && ex.includes('run')) return ROUTINE['apres-hyrox']
  if (ex.every(id => id === 'run' || id === 'walk' || id === 'hike')) return ROUTINE['apres-course']
  const lower = ['genou', 'hanche', 'ischio', 'mollet', 'cheville'].filter(x => z.has(x)).length, upper = ['epaule', 'coude', 'poignet'].filter(x => z.has(x)).length
  if (cats.includes('mob')) return null
  return lower >= upper ? ROUTINE['bas-corps'] : ROUTINE['haut-corps']
}
/** Étirements doux pour une zone (ex. douleur), à faire seulement s'ils n'augmentent pas la douleur */
export const forZone = zone => STRETCHES.filter(s => s.zones.includes(zone) && !s.roll).slice(0, 3)
