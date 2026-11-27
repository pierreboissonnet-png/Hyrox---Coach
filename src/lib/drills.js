// Fiches atelier : ce qui limite sur chaque station Hyrox (et la course), des exercices vraiment ciblés, un test pour mesurer.
// Repères généraux de préparation : à adapter à vos sensations (douleur = on arrête et on demande un avis).
import { STD_LOADS, SELF_STATES } from './gaps.js'
import { isCustom, isPlanned, doneOf } from './custom.js'

const B = (ex, sets, target, o = {}) => ({ ex, name: o.name || '', sets, rest: o.rest ?? 90, w: o.w || 'A', target, note: o.note || '', ...(o.tempo ? { tempo: o.tempo } : {}), ...(o.setTargets ? { setTargets: o.setTargets } : {}) })
const G = (fmt, items, o = {}) => ({ type: 'group', fmt, rounds: o.rounds ?? 3, minutes: o.minutes ?? 10, work: o.work ?? 40, rest: o.rest ?? 90, restItem: o.restItem ?? 0, target: o.target || {}, items, w: 'A' })
const I = (ex, target, note = '', name = '') => ({ ex, name, target, note })

/** Charge de course (kg) selon le sexe (et Pro) ; farmers = par main */
export const raceLoad = (st, sex, pro) => { const L = STD_LOADS[st]; return L ? L[(pro ? 'P' : '') + (sex === 'F' ? 'F' : 'M')] : null }
const rd = (v, s = 2.5) => Math.round(v / s) * s

/**
 * Pour chaque station : les facteurs limitants (signes pour les reconnaître) et, pour chacun, une séance ciblée de 15–25 min.
 * blocks(c) reçoit le contexte { L: charge de course, e1rm: { squat, deadlift, bench, ohp… }, sex }.
 */
export const DRILLS = {
  wb: { label: 'Wall Balls', unit: '100 reps', factors: [
    { id: 'amplitude', label: 'Amplitude', signs: 'Squat trop haut (no-rep), cible manquée, chevilles ou hanches raides.', cues: ['Hanches sous le parallèle à chaque rep', 'Talons au sol, genoux dans l’axe des pieds', 'Balle tenue haute, coudes sous la balle'],
      blocks: c => [B('mobility', 1, { time: 300 }, { rest: 0, note: 'genou au mur (cheville) 2 × 10/jambe, 90/90 hanches 2 × 8, squat tenu en bas 3 × 30 s' }),
        B('goblet', 4, { reps: 8, load: rd(c.L * 2.5, 2) }, { rest: 75, tempo: '3-2-1', note: '3 s de descente, 2 s de pause en bas' }),
        B('wb', 3, { reps: 10, load: c.L }, { rest: 60, note: 'squat jusqu’à toucher une box basse sous le parallèle, sans s’asseoir' }),
        B('wallsit', 2, { time: 45 }, { rest: 45, note: 'cuisses parallèles, dos plaqué' })] },
    { id: 'force', label: 'Force du lancer', signs: 'Bras et épaules qui brûlent avant les jambes, balle qui monte mal en fin de série.', cues: ['La balle part des jambes : extension de hanche explosive', 'Bras = guidage, pas moteur', 'Lancer dans le même mouvement que la remontée'],
      blocks: c => [B('pushpress', 4, { reps: 5, load: c.e1rm.ohp ? rd(c.e1rm.ohp * 0.95) : c.sex === 'F' ? 25 : 40 }, { rest: 120, note: 'lourd, impulsion des jambes, verrouillage bras tendus' }),
        B('thruster', 3, { reps: 10, load: c.sex === 'F' ? 15 : 25 }, { rest: 90, note: 'haltères ou barre, sans pause en bas' }),
        B('mbthrow', 4, { reps: 6, load: c.L + 2 }, { rest: 60, note: 'lancers explosifs vers le haut contre le mur, balle plus lourde que la course' }),
        B('lateral', 2, { reps: 15, load: c.sex === 'F' ? 4 : 6 }, { rest: 45 })] },
    { id: 'endurance', label: 'Tenir la grosse série', signs: 'Vous cassez tôt (séries de 10 ou moins), longues pauses, série 2 bien plus lente.', cues: ['Fixer le découpage AVANT (ex. 25-25-20-15-15)', 'Pause courte (3 respirations) balle au sol ou tenue', 'Ne jamais aller à l’échec : casser 2 reps avant'],
      blocks: c => [G('emom', [I('wb', { reps: c.sex === 'F' ? 12 : 15, load: c.L }, '+1 rep par minute chaque semaine')], { minutes: 10 }),
        B('wb', 4, { reps: 25, load: c.L }, { rest: 30, setTargets: [{ reps: 25 }, { reps: 20 }, { reps: 15 }, { reps: 10 }], note: 'échelle descendante sans casser, 30 s entre les séries' })] },
    { id: 'rythme', label: 'Rythme et respiration', signs: 'Pauses en haut, essoufflement rapide, cadence irrégulière.', cues: ['Expirer au lancer, inspirer à la réception', 'Réception = début de la descente, pas d’arrêt', 'Cadence repère : une rep toutes les 3 s'],
      blocks: c => [G('interval', [I('wb', { load: c.L }, 'cadence imposée : 1 rep toutes les 3 s (métronome)')], { rounds: 4, work: 120, rest: 60 }),
        B('wb', 2, { reps: 30, load: c.L }, { rest: 120, note: 'même cadence, sans pause en haut' })] },
  ], test: c => ({ title: 'Test Wall Balls : 100 reps', blocks: [B('wb', 1, { reps: 100, load: c.L }, { rest: 0, note: 'chrono : notez aussi vos séries' })], metric: 'time' }) },

  pull: { label: 'Sled Pull', unit: '50 m', factors: [
    { id: 'technique', label: 'Technique de tirage', signs: 'Tirage bras seuls, buste qui se relève, corde qui s’accumule devant.', cues: ['Position basse, pieds ancrés, poids vers l’arrière', 'Main sur main longues, en tirant avec le dos et les jambes', 'Corde rangée à côté, jamais sous les pieds'],
      blocks: c => [B('pull', 6, { meters: 12.5, load: rd(c.L * 0.7) }, { rest: 60, note: 'léger, chaque traction longue et rythmée, compter ses prises' }),
        B('bentrow', 3, { reps: 10, load: c.e1rm.bentrow ? rd(c.e1rm.bentrow * 0.65) : c.sex === 'F' ? 25 : 45 }, { rest: 75, note: 'buste penché à 45°, comme au tirage' }),
        B('hollow', 3, { time: 30 }, { rest: 30 })] },
    { id: 'force', label: 'Force de tirage', signs: 'Le sled n’avance plus quand la fatigue arrive, prises courtes, ressenti 9–10.', cues: ['Le tirage part des hanches qui reculent', 'Gainage : le dos ne s’arrondit pas', 'Prises de corde serrées, pouce dessus'],
      blocks: c => [B('pull', 5, { meters: 12.5, load: rd(c.L * 1.25) }, { rest: 120, note: 'plus lourd que la course, 12,5 m solides' }),
        B('deadlift', 4, { reps: 5, load: c.e1rm.deadlift ? rd(c.e1rm.deadlift * 0.8) : c.sex === 'F' ? 50 : 90 }, { rest: 150 }),
        B('dbrow', 3, { reps: 10, load: c.sex === 'F' ? 14 : 24 }, { rest: 60, note: 'par bras' }),
        B('hang', 3, { time: 30 }, { rest: 45, note: 'prise : suspension barre ou serviette' })] },
    { id: 'endurance', label: 'Tenir les 50 m', signs: 'Bon départ puis effondrement, gros écart entre série 1 et série 2.', cues: ['Rythme constant dès le départ (pas de sprint)', 'En duo : relais courts (5–15 m) plutôt qu’un seul long', 'Pause debout de 5–10 s plutôt que de s’arrêter assis'],
      blocks: c => [G('interval', [I('pull', { meters: 12.5, load: c.L }, 'à la charge de course, rythme constant')], { rounds: 6, work: 45, rest: 45 }),
        B('farm', 3, { time: 45, load: c.F }, { rest: 45, note: 'tenue statique lourde : la prise lâche en premier au pull' })] },
  ], test: c => ({ title: 'Test Sled Pull : 50 m', blocks: [B('pull', 1, { meters: 50, load: c.L }, { rest: 0, note: 'chrono, charge de course' })], metric: 'time' }) },

  push: { label: 'Sled Push', unit: '50 m', factors: [
    { id: 'technique', label: 'Position et poussée', signs: 'Buste trop droit, petits pas, sled qui s’arrête entre deux poussées.', cues: ['Bras tendus ou coudes bas, buste à 45°', 'Pas courts et rapides sur l’avant du pied', 'Ne jamais laisser le sled s’arrêter'],
      blocks: c => [B('push', 6, { meters: 12.5, load: rd(c.L * 0.7) }, { rest: 60, note: 'léger, position basse, cadence de pas rapide' }),
        B('calf', 3, { reps: 15, load: c.sex === 'F' ? 20 : 40 }, { rest: 45 })] },
    { id: 'force', label: 'Force des jambes', signs: 'Démarrage très dur, vous poussez « contre un mur ».', cues: ['Démarrage = le plus coûteux : ne pas s’arrêter', 'Pousser le sol vers l’arrière', 'Gainage fort, hanches basses'],
      blocks: c => [B('push', 5, { meters: 10, load: rd(c.L * 1.3) }, { rest: 120, note: 'lourd, démarrages arrêtés' }),
        B('squat', 4, { reps: 5, load: c.e1rm.squat ? rd(c.e1rm.squat * 0.8) : c.sex === 'F' ? 45 : 80 }, { rest: 150 }),
        B('lunges', 3, { reps: 10, load: c.sex === 'F' ? 10 : 20 }, { rest: 75, note: 'fentes marchées, par jambe' })] },
    { id: 'endurance', label: 'Pousser fatigué', signs: 'Les 25 derniers mètres s’écroulent, surtout en 2e moitié de course.', cues: ['Rythme régulier dès le départ', 'En duo : relais de 10 m, le plus fort ouvre et ferme', 'Respirer à chaque pas'],
      blocks: c => [G('circuit', [I('push', { meters: 12.5, load: c.L }), I('run', { meters: 200 }, 'récupération active en courant')], { rounds: 4, rest: 60 })] },
  ], test: c => ({ title: 'Test Sled Push : 50 m', blocks: [B('push', 1, { meters: 50, load: c.L }, { rest: 0, note: 'chrono, charge de course' })], metric: 'time' }) },

  ski: { label: 'SkiErg', unit: '1000 m', factors: [
    { id: 'technique', label: 'Technique', signs: 'Tirage bras seuls, peu de flexion de hanche, allure /500 m qui varie beaucoup.', cues: ['Hanches en arrière, buste qui « tombe » sur la poignée', 'Bras presque tendus, la force vient du tronc', 'Retour lent, poussée rapide (1:2)'],
      blocks: c => [G('interval', [I('ski', {}, 'technique : charnière de hanche, cadence 35–40/min')], { rounds: 6, work: 40, rest: 20 }),
        B('latpull', 3, { reps: 12, load: c.sex === 'F' ? 30 : 50 }, { rest: 60, note: 'bras tendus (pull-over), pour les dorsaux' })] },
    { id: 'puissance', label: 'Puissance', signs: 'Allure correcte mais impossible d’accélérer.', cues: ['Chaque coup = gainage + chute du buste', 'Intervalles courts à fond', 'Garder la même amplitude en accélérant'],
      blocks: c => [G('interval', [I('ski', {}, 'à fond')], { rounds: 8, work: 20, rest: 40 }),
        B('kbswing', 3, { reps: 15, load: c.sex === 'F' ? 16 : 24 }, { rest: 60 })] },
    { id: 'endurance', label: 'Tenir l’allure', signs: 'Départ trop rapide puis grosse baisse, ou série 2 beaucoup plus lente.', cues: ['Allure cible /500 m dès le départ', 'Respirer à chaque coup', 'En duo : relais de 20–30 s'],
      blocks: c => [B('ski', 4, { meters: 500 }, { rest: 90, note: 'à l’allure cible de course, régulier' })] },
  ], test: c => ({ title: 'Test SkiErg : 1000 m', blocks: [B('ski', 1, { meters: 1000 }, { rest: 0, note: 'chrono, notez l’allure /500 m' })], metric: 'time' }) },

  row: { label: 'Rameur', unit: '1000 m', factors: [
    { id: 'technique', label: 'Technique', signs: 'Cadence très haute pour peu de vitesse, bras qui tirent avant les jambes.', cues: ['Jambes – tronc – bras, puis l’inverse au retour', 'Cadence 26–30/min, poussée forte', 'Résistance 5–7, pas au max'],
      blocks: c => [G('interval', [I('row', {}, 'cadence 24 puis 26 puis 28 : la vitesse doit monter avec la poussée')], { rounds: 6, work: 60, rest: 30 }),
        B('rdl', 3, { reps: 10, load: c.e1rm.deadlift ? rd(c.e1rm.deadlift * 0.5) : c.sex === 'F' ? 30 : 50 }, { rest: 75 })] },
    { id: 'puissance', label: 'Puissance de poussée', signs: 'Allure qui plafonne.', cues: ['Poussée explosive des jambes', 'Retour contrôlé', 'Garder la cadence, monter la force'],
      blocks: c => [G('interval', [I('row', {}, 'à fond, cadence 30–32')], { rounds: 8, work: 20, rest: 40 }),
        B('boxjump', 3, { reps: 8 }, { rest: 60 })] },
    { id: 'endurance', label: 'Tenir l’allure', signs: 'Allure qui chute après 500 m, Farmers derrière très durs.', cues: ['Allure cible dès le départ', 'Respiration calée sur la cadence', 'Garder de quoi porter les Farmers ensuite'],
      blocks: c => [B('row', 3, { meters: 500 }, { rest: 90, note: 'allure cible de course' }), B('farm', 2, { meters: 50, load: c.F }, { rest: 60, note: 'enchaîné, comme en course' })] },
  ], test: c => ({ title: 'Test Rameur : 1000 m', blocks: [B('row', 1, { meters: 1000 }, { rest: 0, note: 'chrono, notez l’allure /500 m' })], metric: 'time' }) },

  farm: { label: 'Farmers Carry', unit: '200 m', factors: [
    { id: 'prise', label: 'Prise (grip)', signs: 'Vous posez les charges parce que les mains lâchent.', cues: ['Serrer fort dès le départ', 'Épaules basses, bras tendus', 'Magnésie si autorisée'],
      blocks: c => [B('farm', 4, { time: 40, load: rd(c.F * 1.3, 2) }, { rest: 60, note: 'tenue statique lourde' }),
        B('hang', 3, { time: 40 }, { rest: 45 }), B('deadlift', 3, { reps: 6, load: c.e1rm.deadlift ? rd(c.e1rm.deadlift * 0.75) : c.sex === 'F' ? 50 : 90 }, { rest: 120, note: 'double pronation (sans sangles)' })] },
    { id: 'vitesse', label: 'Marcher vite', signs: 'Pas lents et lourds, la distance n’avance pas.', cues: ['Pas courts et rapides, presque courir', 'Regard loin devant', 'Gainage : pas de balancement'],
      blocks: c => [B('farm', 6, { meters: 50, load: c.F }, { rest: 45, note: 'le plus vite possible sans courir' }), B('rope', 3, { time: 45 }, { rest: 30 })] },
    { id: 'endurance', label: 'Porter fatigué', signs: 'Les Farmers derrière le rameur sont très durs.', cues: ['Enchaîner sans pause en sortie de rameur', 'Respirer : la prise lâche si on bloque', 'En duo : le plus fort porte le plus'],
      blocks: c => [G('circuit', [I('row', { meters: 250 }), I('farm', { meters: 100, load: c.F })], { rounds: 3, rest: 90 })] },
  ], test: c => ({ title: 'Test Farmers : 200 m', blocks: [B('farm', 1, { meters: 200, load: c.F }, { rest: 0, note: 'chrono, charge de course, nombre de pauses' })], metric: 'time' }) },

  lunge: { label: 'Fentes sandbag', unit: '100 m', factors: [
    { id: 'force', label: 'Force des jambes', signs: 'Les cuisses brûlent tôt, genou qui ne descend plus.', cues: ['Genou arrière qui frôle le sol', 'Buste droit, sandbag haut sur les épaules', 'Pousser sur le talon avant'],
      blocks: c => [B('bulgarian', 4, { reps: 8, load: c.sex === 'F' ? 10 : 16 }, { rest: 90, note: 'par jambe' }),
        B('stepup', 3, { reps: 10, load: c.sex === 'F' ? 10 : 16 }, { rest: 75, note: 'par jambe' }), B('wallsit', 2, { time: 60 }, { rest: 60 })] },
    { id: 'endurance', label: 'Tenir les 100 m', signs: 'Allure qui chute de moitié, série 2 bien plus lente.', cues: ['Rythme régulier, sans pause au sol', 'Respirer à chaque pas', 'En duo : relais de 10 m sous fatigue'],
      blocks: c => [B('lunge', 4, { meters: 25, load: c.L }, { rest: 60, note: 'charge de course, régulier' }), B('jumplunge', 3, { reps: 12 }, { rest: 45 })] },
    { id: 'technique', label: 'Pas et équilibre', signs: 'No-reps (genou trop haut), déséquilibres, sandbag qui glisse.', cues: ['Longueur de pas constante (≈ 1 m)', 'Genou arrière au sol à chaque pas', 'Sandbag calé derrière la nuque'],
      blocks: c => [B('lunge', 4, { meters: 20, load: rd(c.L * 0.5, 1) }, { rest: 45, note: 'léger, chaque genou touche' }), B('sideplank', 2, { time: 30 }, { rest: 30 })] },
  ], test: c => ({ title: 'Test Fentes : 100 m', blocks: [B('lunge', 1, { meters: 100, load: c.L }, { rest: 0, note: 'chrono, charge de course' })], metric: 'time' }) },

  burp: { label: 'Burpees Broad Jump', unit: '80 m', factors: [
    { id: 'rythme', label: 'Rythme', signs: 'Pauses au sol ou debout, cadence qui chute.', cues: ['Descendre en « tombant » contrôlé, pas de pompe stricte', 'Sauter dès qu’on est debout', 'Respirer au saut'],
      blocks: c => [G('emom', [I('burp', { meters: 10 }, '10 m par minute, toujours au même rythme')], { minutes: 10 }), B('burpee', 3, { reps: 10 }, { rest: 45, note: 'sans pause en haut' })] },
    { id: 'puissance', label: 'Longueur du saut', signs: 'Beaucoup de burpees pour avancer (sauts courts).', cues: ['Bras qui lancent vers l’avant', 'Réception pieds parallèles, jambes fléchies', 'Viser 1,5–2 m par saut'],
      blocks: c => [B('broadjump', 5, { reps: 5 }, { rest: 60, note: 'max de distance, réception stable' }), B('kbswing', 3, { reps: 15, load: c.sex === 'F' ? 16 : 24 }, { rest: 60 })] },
    { id: 'endurance', label: 'Tenir les 80 m', signs: 'Gros ralentissement sur la 2e moitié.', cues: ['Rythme régulier dès le départ', 'En duo : relais de 10 m', 'Ne pas s’arrêter debout'],
      blocks: c => [B('burp', 4, { meters: 20 }, { rest: 60, note: 'régulier' }), B('mountain', 3, { time: 30 }, { rest: 30 })] },
  ], test: c => ({ title: 'Test Burpees Broad Jump : 80 m', blocks: [B('burp', 1, { meters: 80 }, { rest: 0, note: 'chrono' })], metric: 'time' }) },

  run: { label: 'Course', unit: '8 × 1 km', factors: [
    { id: 'endurance', label: 'Endurance (tenir 8 km)', signs: 'Allure qui chute au fil des km, cardio très haut dès le 3e km.', cues: ['Zone 2 : vous pouvez parler', 'Volume régulier plutôt que des séances héroïques', 'Augmenter de 10 % par semaine max'],
      blocks: c => [B('run', 1, { time: 2700 }, { rest: 0, note: 'footing zone 2 de 40–50 min, aisance respiratoire' })] },
    { id: 'vitesse', label: 'Vitesse', signs: 'Allure plafonnée même frais.', cues: ['Intervalles au seuil : dur mais tenable', 'Récupération courte trottinée', 'Même allure sur toutes les répétitions'],
      blocks: c => [B('run', 5, { meters: 1000, time: c.pace ? Math.round(c.pace * 0.93) : 300 }, { rest: 90, note: 'au seuil, régulier' })] },
    { id: 'compromis', label: 'Courir après les ateliers', signs: 'Les 200 premiers mètres après un atelier sont très lents, jambes lourdes.', cues: ['Repartir doucement 100 m puis caler l’allure', 'Respirer avant de relancer', 'S’habituer aux jambes lourdes'],
      blocks: c => [G('circuit', [I('run', { meters: 1000 }, 'allure de course'), I('wb', { reps: 25, load: c.Lwb }), I('run', { meters: 500 }), I('lunge', { meters: 25, load: c.Llunge })], { rounds: 3, rest: 90 })] },
  ], test: c => ({ title: 'Test course : 1 km', blocks: [B('run', 1, { meters: 1000 }, { rest: 0, note: 'à fond après 10 min d’échauffement' })], metric: 'time' }) },
}
export const DRILL_ORDER = ['ski', 'push', 'pull', 'burp', 'row', 'farm', 'lunge', 'wb', 'run']

/** Contexte des charges : course (selon sexe), 1RM estimés, allure */
export function drillCtx(st, { profile = {}, e1rm = {}, pace = null, pro = false } = {}) {
  const sex = profile.sex
  return { sex, e1rm: e1rm || {}, pace, L: raceLoad(st, sex, pro) || (st === 'wb' ? (sex === 'F' ? 4 : 6) : 0), F: raceLoad('farm', sex, pro), Lwb: raceLoad('wb', sex, pro), Llunge: raceLoad('lunge', sex, pro) }
}

/**
 * Facteurs limitants classés pour une station, d'après « Mon niveau » (ressenti), l'écart aux repères et la fatigue observée.
 * o : { self (bilan « Mon niveau »), gap (lacune calculée : {ratio, why}), drop (fraction perdue série 2 / 2e moitié), rpe (ressenti moyen sur l'atelier) }
 */
export function diagnose(st, o = {}) {
  const D = DRILLS[st]; if (!D) return []
  const score = {}, why = {}
  const add = (f, v, w) => { if (!D.factors.some(x => x.id === f)) return; score[f] = (score[f] || 0) + v; (why[f] = why[f] || []).push(w) }
  const S = o.self || {}
  const map = st === 'run' ? { endurance: 'endurance', vitesse: 'vitesse', compromis: 'compromis' }
    : { technique: ['technique', 'amplitude', 'rythme'], charge: ['force', 'prise', 'puissance'], vitesse: ['puissance', 'vitesse', 'rythme'], physique: ['endurance'], inconnu: ['technique', 'amplitude', 'rythme'] }
  const u = [0, 0.6, 1, 1.5][S.urgency || 2]
  if (S.state && S.state !== 'maitrise') { const m = map[S.state]; const lab = ((SELF_STATES[st === 'run' ? 'run' : 'station'] || []).find(x => x[0] === S.state) || [0, S.state])[1]; (Array.isArray(m) ? m : [m]).forEach((f, i) => add(f, u * (i ? 0.6 : 1), 'votre bilan « Mon niveau » : ' + lab.toLowerCase())) }
  if (o.drop != null && o.drop >= 0.08) add('endurance', o.drop >= 0.2 ? 1.6 : 1, `vous perdez ${Math.round(o.drop * 100)} % sous fatigue`)
  if (o.rpe != null && o.rpe >= 8.5) add('endurance', 0.6, `ressenti ${String(Math.round(o.rpe * 10) / 10).replace('.', ',')}/10 sur cet atelier`)
  if (o.gap && o.gap.score >= 0.06) { const f = st === 'run' ? 'vitesse' : (D.factors.find(x => ['force', 'puissance', 'prise'].includes(x.id)) || D.factors[0]).id; add(f, Math.min(1.2, o.gap.score * 3), 'vos temps : ' + o.gap.why) }
  if (S.state === 'charge' && S.cur && S.target && S.target > S.cur) add('force', 0.5, `charge ${S.cur} → ${S.target} kg visée`)
  const L = D.factors.map(f => ({ ...f, score: score[f.id] || 0, why: why[f.id] || [] })).sort((a, b) => b.score - a.score)
  return L
}
/** Priorité d'une station (0–3+) pour classer les fiches */
export const priority = L => L.length ? L[0].score : 0

/** Séance ciblée : échauffement + blocs des facteurs choisis */
export function drillSession(st, factorIds, ctx) {
  const D = DRILLS[st], F = D.factors.filter(f => factorIds.includes(f.id))
  const warm = B(st === 'run' ? 'run' : 'mobility', 1, st === 'run' ? { time: 600 } : { time: 480 }, { rest: 60, note: st === 'run' ? 'échauffement progressif + 3 accélérations' : 'échauffement : 5 min de cardio léger + mobilité de la zone sollicitée' })
  return { title: D.label + ' · ' + F.map(f => f.label.toLowerCase()).join(' + '), blocks: [warm, ...F.flatMap(f => f.blocks(ctx))], drill: { st, factors: factorIds } }
}

/** Résultats des tests (et des ateliers complets faits en séance perso) : [{date, t, test}] pour la courbe */
export function drillResults(sessions, uid, st) {
  const D = DRILLS[st]; if (!D) return []
  const full = { ski: 1000, push: 50, pull: 50, burp: 80, row: 1000, farm: 200, lunge: 100, wb: 100, run: 1000 }[st]
  const out = []
  sessions.filter(s => isCustom(s) && !isPlanned(s) && s.athletes && (s.athletes.A === uid || s.athletes.B === uid)).forEach(s => {
    const slot = s.athletes.A === uid ? 'A' : 'B'
    ;(s.data.steps || []).forEach(x => {
      if (x.ex !== st || (x.w !== slot && x.w !== 'AB')) return
      const d = doneOf(x), q = st === 'wb' ? d.reps : d.meters
      if (d.time > 0 && q >= full * 0.98) out.push({ date: s.session_date, t: d.time, test: !!(s.data.drillTest === st), duo: x.w === 'AB', id: s.id })
    })
  })
  return out.sort((a, b) => a.date.localeCompare(b.date))
}
