// Séances types prêtes à l'emploi (modifiables avant de lancer). Repères généraux de préparation.
const B = (ex, sets, target, o = {}) => ({ ex, name: '', sets, rest: o.rest ?? 90, w: 'A', target, note: o.note || '', ...(o.setTargets ? { setTargets: o.setTargets } : {}), ...(o.tempo ? { tempo: o.tempo } : {}) })
const I = (ex, target, note = '') => ({ ex, name: '', target, note })
const G = (fmt, items, o = {}) => ({ type: 'group', fmt, rounds: o.rounds ?? 4, minutes: o.minutes ?? 10, work: o.work ?? 40, rest: o.rest ?? 90, restItem: o.restItem ?? 0, target: o.target || {}, items, w: 'A' })

export const LIB_CATS = [['renfo', 'Renforcement'], ['hyrox', 'Hyrox'], ['cardio', 'Cardio et course'], ['core', 'Gainage'], ['mob', 'Mobilité']]
export const LIBRARY = [
  { id: 'test-niveau', cat: 'hyrox', name: 'Test de niveau', desc: 'Chaque effort à fond, récupération complète : vos temps de référence pour le plan. ≈ 75 min. Faites les ateliers sans sled si vous n’en avez pas.',
    blocks: [B('run', 1, { meters: 1000 }, { rest: 240, note: 'à fond, après 10 min d’échauffement' }), B('ski', 1, { meters: 1000 }, { rest: 240, note: 'à fond' }), B('row', 1, { meters: 1000 }, { rest: 240, note: 'à fond' }),
      B('farm', 1, { meters: 200 }, { rest: 180, note: 'poids de votre catégorie' }), B('lunge', 1, { meters: 100 }, { rest: 180, note: 'poids de votre catégorie' }), B('burp', 1, { meters: 80 }, { rest: 180 }), B('wb', 1, { reps: 100 }, { rest: 0, note: 'poids de votre catégorie' })] },
  { id: 'renfo-bas', cat: 'renfo', name: 'Renfo bas du corps', desc: 'Squat, soulevé de terre jambes tendues, fentes bulgares, mollets. ≈ 55 min.',
    blocks: [B('squat', 4, { reps: 6, load: 60, rir: 2 }, { rest: 150, tempo: '3-1-1' }), B('rdl', 3, { reps: 8, load: 50, rir: 2 }, { rest: 120 }), B('bulgarian', 3, { reps: 8, load: 12 }, { rest: 90, note: 'par jambe' }),
      G('superset', [I('calf', { reps: 15, load: 20 }), I('sideplank', { time: 30 }, 'par côté')], { rounds: 3, rest: 60 })] },
  { id: 'renfo-haut', cat: 'renfo', name: 'Renfo haut du corps', desc: 'Développé, tirages, épaules, bras en supersets. ≈ 50 min.',
    blocks: [B('bench', 4, { reps: 8, load: 50 }, { rest: 120, setTargets: [{ reps: 10, load: 45 }, { reps: 8, load: 50 }, { reps: 6, load: 55 }, { reps: 6, load: 55 }] }),
      G('superset', [I('pullup', { reps: 6 }), I('dbpress', { reps: 10, load: 16 })], { rounds: 3, rest: 90 }),
      G('superset', [I('seatedrow', { reps: 12, load: 40 }), I('lateral', { reps: 12, load: 6 })], { rounds: 3, rest: 60 }),
      G('superset', [I('curl', { reps: 12, load: 10 }), I('triceps', { reps: 12, load: 10 })], { rounds: 2, rest: 60 })] },
  { id: 'renfo-complet', cat: 'renfo', name: 'Renfo complet (salle)', desc: 'Corps entier, charges modérées, pour les semaines chargées. ≈ 45 min.',
    blocks: [B('goblet', 3, { reps: 10, load: 20 }, { rest: 90 }), B('dbrow', 3, { reps: 10, load: 20 }, { rest: 60, note: 'par bras' }), B('hipthrust', 3, { reps: 10, load: 60 }, { rest: 90 }),
      B('pushup', 3, { reps: 15 }, { rest: 60 }), G('circuit', [I('kbswing', { reps: 15, load: 16 }), I('deadbug', { reps: 12 }), I('farm', { meters: 50, load: 24 })], { rounds: 3, rest: 90 })] },
  { id: 'renfo-maison', cat: 'renfo', name: 'Renfo sans matériel', desc: 'À la maison ou en déplacement. ≈ 30 min.',
    blocks: [G('circuit', [I('airsquat', { reps: 20 }), I('pushup', { reps: 12 }), I('jumplunge', { reps: 10 }, 'par jambe'), I('plank', { time: 45 }), I('burpee', { reps: 10 })], { rounds: 4, rest: 90 }),
      G('tabata', [I('mountain', { reps: 20 })], { rounds: 8, work: 20, rest: 10 })] },
  { id: 'hyrox-force', cat: 'hyrox', name: 'Force spécifique Hyrox', desc: 'Sled, fentes, wall balls lourds : la force qui tient sous fatigue. ≈ 60 min.',
    blocks: [B('push', 6, { meters: 12.5, load: 150 }, { rest: 90, note: 'lourd, petits pas rapides' }), B('pull', 5, { meters: 12.5, load: 100 }, { rest: 90 }),
      B('lunge', 4, { meters: 20, load: 20 }, { rest: 90 }), B('wb', 5, { reps: 20, load: 6 }, { rest: 60 })] },
  { id: 'hyrox-emom', cat: 'hyrox', name: 'EMOM ateliers 20 min', desc: 'Chaque minute : SkiErg, Wall Balls, Rameur, Burpees. ≈ 30 min avec l’échauffement.',
    blocks: [G('emom', [I('ski', { cal: 12 }), I('wb', { reps: 15, load: 6 }), I('row', { cal: 12 }), I('burpee', { reps: 10 })], { minutes: 20 })] },
  { id: 'hyrox-compromis', cat: 'hyrox', name: 'Compromised running', desc: '4 tours : 1 km allure course puis un atelier. ≈ 50 min.',
    blocks: [G('circuit', [I('run', { meters: 1000, time: 300 }), I('ski', { meters: 500 }), I('run', { meters: 1000, time: 300 }), I('wb', { reps: 30, load: 6 })], { rounds: 2, rest: 120 })] },
  { id: 'hyrox-amrap', cat: 'hyrox', name: 'AMRAP 20 min Hyrox', desc: 'Un maximum de tours : rameur, fentes, wall balls, burpees broad jump.',
    blocks: [G('amrap', [I('row', { meters: 250 }), I('lunge', { meters: 10, load: 20 }), I('wb', { reps: 15, load: 6 }), I('burp', { meters: 10 })], { minutes: 20, target: { rounds: 5 } })] },
  { id: 'cardio-400', cat: 'cardio', name: 'Fractionné 10 × 400 m', desc: 'VMA courte, récupération 1 min. ≈ 45 min.',
    blocks: [B('run', 1, { meters: 2000 }, { rest: 120, note: 'échauffement facile' }), B('run', 10, { meters: 400, time: 90 }, { rest: 60 }), B('run', 1, { meters: 1500 }, { rest: 0, note: 'retour au calme' })] },
  { id: 'cardio-seuil', cat: 'cardio', name: 'Seuil 3 × 2 km', desc: 'Allure course Hyrox, récupération 2 min. ≈ 45 min.',
    blocks: [B('run', 1, { time: 900 }, { rest: 60, note: 'échauffement' }), B('run', 3, { meters: 2000, time: 600 }, { rest: 120, note: 'allure course' })] },
  { id: 'cardio-z2', cat: 'cardio', name: 'Endurance zone 2', desc: '45 à 60 min faciles en course, vélo ou rameur.',
    blocks: [B('run', 1, { time: 2700 }, { rest: 0, note: 'on peut parler en phrases complètes' })] },
  { id: 'cardio-ergs', cat: 'cardio', name: 'Intervalles ergomètres', desc: '30 s fort / 30 s facile en alternant SkiErg, rameur, air bike.',
    blocks: [G('interval', [I('ski', { cal: 8 }), I('row', { cal: 8 }), I('airbike', { cal: 10 })], { rounds: 18, work: 30, rest: 30 })] },
  { id: 'core-15', cat: 'core', name: 'Gainage 15 min', desc: 'Tronc solide pour le sled et les wall balls.',
    blocks: [G('circuit', [I('plank', { time: 45 }), I('deadbug', { reps: 12 }), I('sideplank', { time: 30 }, 'par côté'), I('hollow', { time: 30 }), I('pallof', { reps: 10, load: 10 }, 'par côté')], { rounds: 3, rest: 60 })] },
  { id: 'mob-20', cat: 'mob', name: 'Mobilité 20 min', desc: 'Hanches, chevilles, dos et épaules. Voir aussi la banque d’étirements.',
    blocks: [B('foam', 1, { time: 300 }, { rest: 0 }), B('mobility', 1, { time: 900 }, { rest: 0, note: 'routine « Hanches et dos » de la banque d’étirements' })] },
]
export const LIB = Object.fromEntries(LIBRARY.map(t => [t.id, t]))
