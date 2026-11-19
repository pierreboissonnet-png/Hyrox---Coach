// Repères nutritionnels et compléments pour sportifs d'endurance-force. Informations générales, pas un avis médical.

export const age = p => p && p.birth_year ? new Date().getFullYear() - p.birth_year : 35

export const DAY_TYPES = [
  { id: 'repos', label: 'Repos', act: 1.4, carbs: 3, prot: 1.6 },
  { id: 'entrainement', label: 'Entraînement', act: 1.65, carbs: 5, prot: 1.8 },
  { id: 'intense', label: 'Séance intense', act: 1.85, carbs: 6.5, prot: 2.0 },
  { id: 'veille', label: 'Veille de course', act: 1.5, carbs: 7, prot: 1.6 },
]

/** Besoins estimés pour une journée (Mifflin-St Jeor × activité) */
export function targets(p, dayId = 'entrainement') {
  const w = +p?.weight_kg || 70, h = +p?.height_cm || (p?.sex === 'F' ? 165 : 178), a = age(p)
  const t = DAY_TYPES.find(x => x.id === dayId) || DAY_TYPES[1]
  const bmr = 10 * w + 6.25 * h - 5 * a + (p?.sex === 'F' ? -161 : p?.sex === 'M' ? 5 : -78)
  const kcal = Math.round(bmr * t.act / 10) * 10
  const prot = Math.round(w * t.prot), carbs = Math.round(w * t.carbs)
  const fat = Math.max(Math.round(w * 0.8), Math.round((kcal - prot * 4 - carbs * 4) / 9))
  return { kcal, prot, carbs, fat, water: Math.round(w * 0.035 * 10) / 10, bmr: Math.round(bmr), day: t }
}

export const MEALS = [
  { when: 'Petit-déjeuner', what: 'Flocons d’avoine ou pain complet, œufs ou skyr, fruit, boisson chaude' },
  { when: 'Déjeuner', what: 'Féculents (riz, pâtes, pommes de terre), protéine maigre, légumes, huile d’olive' },
  { when: 'Collation avant séance (1–2 h)', what: 'Banane + yaourt, ou tartine miel ; boire 400–500 ml' },
  { when: 'Après séance (dans l’heure)', what: '20–40 g de protéines + glucides : lait chocolaté, skyr + fruit, sandwich poulet' },
  { when: 'Dîner', what: 'Protéine, légumes, féculents selon la séance du lendemain' },
]

/** Compléments : niveau de preuve et précautions (sources : consensus AIS / ISSN) */
export const SUPPLEMENTS = [
  { id: 'creatine', name: 'Créatine monohydrate', dose: p => '3 à 5 g par jour, tous les jours', level: 'Fort', why: 'Force, puissance et répétition d’efforts intenses (sled, wall balls).', care: 'Prise de poids d’eau de 1 à 2 kg possible. Avis médical en cas de maladie rénale.' },
  { id: 'cafeine', name: 'Caféine', dose: p => `${Math.round((+p?.weight_kg || 70) * 3)} mg environ, 45 à 60 min avant (3 mg/kg)`, level: 'Fort', why: 'Diminue la perception de l’effort, améliore l’endurance.', care: 'Tester à l’entraînement. Éviter après 16 h (sommeil). Déconseillée en cas de troubles cardiaques ou de grossesse.' },
  { id: 'beta', name: 'Bêta-alanine', dose: p => '3,2 à 6,4 g par jour en 2 à 4 prises, sur 4 semaines minimum', level: 'Modéré', why: 'Efforts de 1 à 10 min (ateliers enchaînés).', care: 'Picotements cutanés sans gravité ; fractionner les prises.' },
  { id: 'bicar', name: 'Bicarbonate de sodium', dose: p => `${Math.round((+p?.weight_kg || 70) * 0.3)} g environ (0,3 g/kg), 2 à 3 h avant`, level: 'Modéré', why: 'Tampon de l’acidité lors d’efforts très intenses.', care: 'Troubles digestifs fréquents : à tester longtemps avant, jamais le jour J pour la première fois.' },
  { id: 'whey', name: 'Protéines en poudre (whey ou végétales)', dose: p => '20 à 40 g après la séance si l’alimentation ne suffit pas', level: 'Pratique', why: 'Atteindre l’apport de protéines du jour.', care: 'Un aliment pratique, pas une obligation.' },
  { id: 'elec', name: 'Électrolytes (sodium)', dose: p => '300 à 600 mg de sodium par heure d’effort, par temps chaud ou forte sudation', level: 'Pratique', why: 'Limiter la déshydratation et les crampes liées aux pertes de sel.', care: 'Hypertension : en parler à votre médecin.' },
  { id: 'vitd', name: 'Vitamine D', dose: p => 'Seulement si un dosage montre un taux bas, selon prescription', level: 'Si carence', why: 'Os, muscles, immunité ; carence fréquente en hiver.', care: 'Ne pas surdoser : faire un dosage (onglet Santé).' },
  { id: 'fer', name: 'Fer', dose: p => 'Uniquement si la ferritine est basse, sur prescription', level: 'Si carence', why: 'Transport de l’oxygène ; carence plus fréquente chez les femmes sportives.', care: 'Un excès de fer est toxique : jamais sans dosage ni avis médical.' },
  { id: 'omega', name: 'Oméga-3', dose: p => '1 à 2 g d’EPA + DHA par jour, si peu de poisson gras', level: 'Modéré', why: 'Récupération, santé cardiovasculaire.', care: 'Anticoagulants : avis médical.' },
]

export const ANTI_DOPING = 'Choisissez des produits certifiés « norme AFNOR NF V94-001 » (ou équivalent) : un complément non contrôlé peut contenir des substances interdites.'

/** Plan du jour de course, selon l'heure de départ */
export function raceDay(p, startHHMM = '10:00') {
  const w = +p?.weight_kg || 70
  const [h, m] = startHHMM.split(':').map(Number)
  const at = d => { const t = h * 60 + m + d; return String(Math.floor(((t % 1440) + 1440) % 1440 / 60)).padStart(2, '0') + ':' + String(((t % 60) + 60) % 60).padStart(2, '0') }
  return [
    { time: at(-210), what: `Repas : ${Math.round(w * 2)} g de glucides (≈ 2 g/kg), peu de fibres et de graisses, + 500 ml d’eau` },
    { time: at(-90), what: 'Collation légère si faim (banane, compote), boire par petites gorgées' },
    { time: at(-60), what: `Caféine si habitué(e) : ≈ ${Math.round(w * 3)} mg` },
    { time: at(-30), what: 'Échauffement : 10 min footing + gammes + 2 passages courts sur ateliers' },
    { time: at(-10), what: '1 gel ou une gorgée de boisson sucrée' },
    { time: at(40), what: 'Pendant la course (si plus de 60 min) : un gel ou 30 g de glucides vers la mi-course, eau aux ravitaillements' },
    { time: at(120), what: 'Après : protéines + glucides + sel dans l’heure, puis repas complet' },
  ]
}
