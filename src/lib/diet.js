// Alimentation déclarée : familles d'aliments → apports estimés → écarts aux besoins → recommandations.
// Valeurs moyennes par portion (ordres de grandeur, tables Ciqual) : estimation, pas une pesée.
import { targets, age } from './nutrition.js'

export const DIETS = [
  ['omnivore', 'Omnivore'], ['flexitarien', 'Flexitarien'], ['pescetarien', 'Pescétarien'],
  ['vegetarien', 'Végétarien'], ['vegetalien', 'Végétalien'],
]
// per : 'j' = portions par jour, 's' = portions par semaine
// n : kcal, p protéines g, c glucides g, f lipides g, fib fibres g, fe fer mg, ca calcium mg, o3 EPA+DHA mg, b12 µg, mg magnésium mg, vd vitamine D µg
export const FOODS = [
  { id: 'feculents', label: 'Féculents, céréales', portion: '150 g cuits (pâtes, riz…) ou 60 g de pain', per: 'j', n: { kcal: 200, p: 6, c: 40, f: 1.5, fib: 3, fe: 1, ca: 15, mg: 40 } },
  { id: 'complets', label: 'dont céréales complètes', portion: 'part des féculents en version complète', per: 'j', sub: 'feculents', n: { fib: 3, fe: 0.8, mg: 45 } },
  { id: 'legumes', label: 'Légumes', portion: '200 g (une assiette, crus ou cuits)', per: 'j', n: { kcal: 50, p: 2.5, c: 8, f: 0.5, fib: 5, fe: 1.2, ca: 60, mg: 30 } },
  { id: 'fruits', label: 'Fruits', portion: '1 fruit ou 150 g', per: 'j', n: { kcal: 80, p: 1, c: 18, f: 0.3, fib: 3, fe: 0.3, ca: 20, mg: 15 } },
  { id: 'legumineuses', label: 'Légumineuses', portion: '150 g cuites (lentilles, pois chiches…)', per: 's', n: { kcal: 170, p: 11, c: 25, f: 1, fib: 9, fe: 3.5, ca: 50, mg: 55 } },
  { id: 'viande', label: 'Viande rouge', portion: '120 g', per: 's', n: { kcal: 220, p: 30, c: 0, f: 11, fe: 3, ca: 10, b12: 2.5, mg: 25 } },
  { id: 'volaille', label: 'Volaille', portion: '120 g', per: 's', n: { kcal: 190, p: 32, c: 0, f: 6, fe: 1, ca: 15, b12: 0.5, mg: 30 } },
  { id: 'charcuterie', label: 'Charcuterie', portion: '50 g', per: 's', n: { kcal: 160, p: 9, c: 1, f: 13, fe: 0.6, ca: 10, b12: 0.4, mg: 8 } },
  { id: 'poisson_gras', label: 'Poisson gras', portion: '120 g (saumon, sardine, maquereau)', per: 's', n: { kcal: 230, p: 24, c: 0, f: 14, fe: 1, ca: 30, o3: 2000, b12: 6, mg: 35, vd: 9 } },
  { id: 'poisson', label: 'Poisson maigre, fruits de mer', portion: '120 g', per: 's', n: { kcal: 120, p: 24, c: 0, f: 2, fe: 0.8, ca: 30, o3: 250, b12: 2, mg: 35, vd: 2 } },
  { id: 'oeufs', label: 'Œufs', portion: '1 œuf', per: 's', n: { kcal: 75, p: 6.5, c: 0.3, f: 5, fe: 0.9, ca: 28, b12: 0.6, mg: 6, vd: 1 } },
  { id: 'laitiers', label: 'Lait, yaourt, skyr', portion: '1 yaourt ou 150 ml de lait', per: 'j', n: { kcal: 90, p: 6, c: 8, f: 3, ca: 180, b12: 0.5, mg: 17 } },
  { id: 'fromage', label: 'Fromage', portion: '30 g', per: 'j', n: { kcal: 110, p: 7, c: 0, f: 9, ca: 220, b12: 0.4, mg: 8 } },
  { id: 'soja', label: 'Tofu, tempeh, boisson soja enrichie', portion: '100 g de tofu ou 200 ml', per: 'j', n: { kcal: 120, p: 12, c: 3, f: 7, fib: 1, fe: 2, ca: 200, mg: 50, b12: 0.8, vd: 1.5 } },
  { id: 'oleagineux', label: 'Oléagineux, graines', portion: '30 g (une poignée)', per: 'j', n: { kcal: 180, p: 6, c: 4, f: 16, fib: 3, fe: 1, ca: 60, mg: 75 } },
  { id: 'mg_ajoutees', label: 'Matières grasses ajoutées', portion: '1 cuillère à soupe (huile, beurre)', per: 'j', n: { kcal: 90, f: 10 } },
  { id: 'sucres', label: 'Produits sucrés, biscuits, viennoiseries', portion: '1 portion (40 g)', per: 'j', n: { kcal: 180, p: 2, c: 25, f: 8, fe: 0.4, ca: 15, mg: 8 } },
  { id: 'boissons_sucrees', label: 'Boissons sucrées, jus', portion: '250 ml', per: 'j', n: { kcal: 105, c: 26 } },
  { id: 'alcool', label: 'Alcool', portion: '1 verre', per: 's', n: { kcal: 110, c: 3 } },
  { id: 'plats_prepares', label: 'Plats préparés, fast-food', portion: '1 repas', per: 's', n: { kcal: 650, p: 25, c: 70, f: 28, fib: 4, fe: 2.5, ca: 150, b12: 1, mg: 50 } },
]
export const SUPPS = [
  { id: 'whey', label: 'Protéines en poudre', unit: 'doses de 25 g / jour', n: { kcal: 100, p: 20, c: 2, f: 1.5, ca: 120, mg: 20 } },
  { id: 'creatine', label: 'Créatine', unit: 'prise quotidienne', n: {} },
  { id: 'cafeine', label: 'Caféine (hors café)', unit: 'prise avant séance', n: {} },
  { id: 'omega3', label: 'Oméga-3 (huile de poisson ou d’algue)', unit: 'gélules / jour (≈ 300 mg EPA+DHA)', n: { o3: 300 } },
  { id: 'vitd', label: 'Vitamine D', unit: 'prise quotidienne (≈ 25 µg)', n: { vd: 25 } },
  { id: 'fer', label: 'Fer', unit: 'prise quotidienne (≈ 14 mg)', n: { fe: 14 } },
  { id: 'b12', label: 'Vitamine B12', unit: 'prise quotidienne (≈ 25 µg)', n: { b12: 25 } },
  { id: 'magnesium', label: 'Magnésium', unit: 'prise quotidienne (≈ 300 mg)', n: { mg: 300 } },
  { id: 'multi', label: 'Multivitamines', unit: 'prise quotidienne', n: { fe: 7, b12: 2.5, vd: 5, mg: 50, ca: 100 } },
  { id: 'gels', label: 'Gels, boissons d’effort', unit: 'par jour d’entraînement', n: { kcal: 100, c: 25 } },
]
export const NUTRIENTS = [
  ['kcal', 'Énergie', 'kcal'], ['p', 'Protéines', 'g'], ['c', 'Glucides', 'g'], ['f', 'Lipides', 'g'], ['fib', 'Fibres', 'g'],
  ['fe', 'Fer', 'mg'], ['ca', 'Calcium', 'mg'], ['mg', 'Magnésium', 'mg'], ['o3', 'Oméga-3 EPA+DHA', 'mg'], ['b12', 'Vitamine B12', 'µg'], ['vd', 'Vitamine D', 'µg'],
]

/** Apports moyens par jour à partir des quantités déclarées */
export function intakes(diet) {
  const q = (diet && diet.q) || {}, s = (diet && diet.s) || {}, tot = {}
  NUTRIENTS.forEach(([k]) => { tot[k] = 0 })
  FOODS.forEach(f => { const n = +q[f.id] || 0; if (!n) return; const perDay = f.per === 's' ? n / 7 : n; Object.entries(f.n).forEach(([k, v]) => { tot[k] += v * perDay }) })
  SUPPS.forEach(x => { const n = +s[x.id] || 0; if (!n) return; Object.entries(x.n).forEach(([k, v]) => { tot[k] += v * n }) })
  return tot
}
/** Besoins de référence (ANSES / sportifs) ; énergie et macros selon le type de journée */
export function needs(p, dayId = 'entrainement') {
  const t = targets(p, dayId), F = p && p.sex === 'F'
  return { kcal: t.kcal, p: t.prot, c: t.carbs, f: t.fat, fib: 30, fe: F ? 16 : 11, ca: 950, mg: F ? 360 : 420, o3: 500, b12: 4, vd: 15 }
}
export function gaps(diet, p, dayId) {
  const I = intakes(diet), N = needs(p, dayId)
  return NUTRIENTS.map(([k, label, unit]) => ({ k, label, unit, have: I[k], need: N[k], ratio: N[k] ? I[k] / N[k] : 1 }))
}
const isVeg = d => ['vegetarien', 'vegetalien'].includes(d), isVegan = d => d === 'vegetalien', noMeat = d => ['vegetarien', 'vegetalien', 'pescetarien'].includes(d)

/**
 * Recommandations : {type:'ajouter'|'remplacer'|'complément'|'ok', text, why}
 */
export function recommend(diet, p, dayId = 'entrainement') {
  const type = (diet && diet.type) || 'omnivore', q = (diet && diet.q) || {}, s = (diet && diet.s) || {}
  const G = Object.fromEntries(gaps(diet, p, dayId).map(g => [g.k, g]))
  const out = [], w = +p?.weight_kg || 70
  const add = (t, text, why) => out.push({ type: t, text, why })
  // ---- remplacements (qualité) en premier
  if ((+q.boissons_sucrees || 0) >= 1) add('remplacer', `Boissons sucrées (${q.boissons_sucrees}/j) → eau, eau pétillante avec citron, ou boisson d’effort uniquement pendant les séances longues`, `${Math.round(q.boissons_sucrees * 26)} g de sucres rapides par jour sans intérêt pour la récupération.`)
  if ((+q.sucres || 0) >= 2) add('remplacer', `Produits sucrés (${q.sucres}/j) → fruit + poignée d’oléagineux, ou skyr + miel après la séance`, 'Même plaisir, plus de protéines, de fibres et de magnésium.')
  if ((+q.charcuterie || 0) >= 3) add('remplacer', `Charcuterie (${q.charcuterie}/sem) → volaille, œufs ou poisson`, 'Moins de sel et de graisses saturées, plus de protéines.')
  if ((+q.plats_prepares || 0) >= 3) add('remplacer', `Plats préparés (${q.plats_prepares}/sem) → « batch cooking » : féculent + protéine + légumes préparés pour 3 jours`, 'Mieux maîtriser les glucides avant les séances et le sel.')
  if ((+q.alcool || 0) >= 5) add('remplacer', `Alcool (${q.alcool} verres/sem) → limiter, surtout les veilles de séances intenses et après la course`, 'L’alcool dégrade le sommeil et la récupération musculaire.')
  if ((+q.feculents || 0) >= 2 && (+q.complets || 0) < 1) add('remplacer', 'Une partie des féculents → version complète (pain complet, riz complet, flocons d’avoine)', 'Plus de fibres, de fer et de magnésium ; gardez les versions raffinées la veille et le jour de course.')
  // ---- ajouts selon les manques
  if (G.p.ratio < 0.9) {
    const miss = Math.round(G.p.need - G.p.have)
    add('ajouter', `Protéines : ≈ ${miss} g/jour de plus (objectif ${G.p.need} g, soit ${(G.p.need / w).toFixed(1).replace('.', ',')} g/kg)`, isVegan(type) ? 'Tofu ou tempeh (12 g / 100 g), légumineuses (11 g / portion), boisson soja, seitan ; répartissez sur 4 repas.' : isVeg(type) ? 'Skyr ou fromage blanc (10 g / 100 g), œufs, tofu, légumineuses ; 20 à 30 g par repas.' : 'Skyr, œufs, volaille, poisson ; 20 à 40 g dans l’heure après la séance.')
  }
  if (G.c.ratio < 0.85) add('ajouter', `Glucides : ≈ ${Math.round(G.c.need - G.c.have)} g/jour de plus les jours d’entraînement`, 'Une portion de féculents en plus au repas qui précède la séance, et un fruit ou une banane avant l’effort.')
  if (G.kcal.ratio < 0.85) add('ajouter', `Énergie : environ ${Math.round(G.kcal.need - G.kcal.have)} kcal/jour sous vos besoins estimés`, 'Un déficit prolongé expose à la fatigue, aux blessures et, chez les femmes, aux troubles du cycle (déficit énergétique relatif). Ajoutez des collations.')
  if (G.kcal.ratio > 1.2) add('remplacer', `Énergie : environ ${Math.round(G.kcal.have - G.kcal.need)} kcal/jour au-dessus des besoins estimés`, 'Si l’objectif est de perdre du poids : réduisez d’abord produits sucrés, boissons sucrées et matières grasses ajoutées.')
  if (G.fib.ratio < 0.8) add('ajouter', `Fibres : ${Math.round(G.fib.have)} g/j pour 30 g conseillés`, 'Légumes à chaque repas, légumineuses 2 à 3 fois par semaine, fruits entiers plutôt qu’en jus (à réduire la veille de course).')
  if (G.fe.ratio < 0.9) add('ajouter', `Fer : ≈ ${G.fe.have.toFixed(1).replace('.', ',')} mg/j pour ${G.fe.need} mg conseillés`, noMeat(type) ? 'Légumineuses, tofu, graines de courge, céréales complètes, avec une source de vitamine C au même repas (agrumes, poivron) ; thé et café à distance des repas. Faites doser la ferritine.' : 'Viande rouge 1 à 2 fois par semaine, boudin noir, légumineuses ; vitamine C au repas, thé et café à distance. Faites doser la ferritine.')
  if (G.ca.ratio < 0.8) add('ajouter', `Calcium : ≈ ${Math.round(G.ca.have)} mg/j pour 950 mg`, isVegan(type) ? 'Boisson soja enrichie en calcium, tofu au calcium, eaux minérales calciques (Hépar, Contrex, Courmayeur), amandes.' : '2 à 3 produits laitiers par jour, ou eaux minérales calciques.')
  if (G.o3.ratio < 0.6) add('ajouter', `Oméga-3 EPA+DHA : ≈ ${Math.round(G.o3.have)} mg/j pour 500 mg`, noMeat(type) && type !== 'pescetarien' ? 'Pas de poisson : une huile d’algue (EPA+DHA) est la seule source directe ; ajoutez aussi noix, colza, lin (ALA).' : 'Poisson gras 2 fois par semaine (saumon, sardine, maquereau), ou huile de poisson si vous n’en mangez pas.')
  if (G.mg.ratio < 0.8) add('ajouter', `Magnésium : ≈ ${Math.round(G.mg.have)} mg/j pour ${G.mg.need} mg`, 'Oléagineux, céréales complètes, légumineuses, chocolat noir, eaux riches en magnésium (Hépar, Badoit).')
  // ---- compléments
  if (isVegan(type) && !(+s.b12)) add('complément', 'Vitamine B12 : indispensable en alimentation végétalienne', 'Aucun aliment végétal n’en apporte : 25 à 100 µg par jour ou 1 000 µg deux fois par semaine.')
  else if (G.b12.ratio < 0.7 && !(+s.b12)) add('complément', 'Vitamine B12 : apports probablement faibles', 'Œufs, produits laitiers, poisson ; sinon complément. Dosage possible lors de la prochaine prise de sang.')
  if (G.vd.ratio < 0.5 && !(+s.vitd)) add('complément', 'Vitamine D : apports alimentaires faibles (normal : elle vient surtout du soleil)', 'D’octobre à mars, faites doser la vitamine D (onglet Santé) ; un complément se discute avec votre médecin si le taux est bas.')
  if (!(+s.creatine)) add('complément', 'Créatine monohydrate 3 à 5 g/jour (optionnel)', 'Le complément le mieux documenté pour les efforts répétés intenses (sleds, wall balls). Choisissez un produit certifié NF V94-001.')
  if (+s.fer && G.fe.ratio > 1.5) add('complément', 'Fer en complément alors que l’alimentation semble suffire', 'Un excès de fer est toxique : ne le poursuivez que si une prise de sang montre une ferritine basse.')
  if (p && p.sex === 'F' && G.fe.ratio < 1 && !(+s.fer)) add('complément', 'Règles abondantes ou fatigue : faites doser la ferritine', 'Les pertes de fer menstruelles augmentent les besoins ; un complément ne se prend que sur dosage.')
  if (!out.some(x => x.type !== 'complément')) add('ok', 'Votre alimentation déclarée couvre les principaux besoins', 'Gardez l’essentiel : féculents avant les séances, protéines réparties, légumes et fruits chaque jour.')
  return out
}

/**
 * Où trouver chaque apport, du plus recommandé au plus anecdotique, avec des aliments courants :
 * le but est d'ajuster ce qu'on mange déjà, pas de changer de régime.
 */
export const SOURCES = {
  kcal: { tip: 'Ajoutez une collation plutôt que de grossir les repas.', L: ['Fruit + poignée d’amandes ≈ 250 kcal', 'Bol de flocons d’avoine au lait ≈ 350 kcal', 'Tartine de pain complet + beurre de cacahuète ≈ 250 kcal', 'Yaourt + granola ≈ 250 kcal'] },
  p: { tip: 'Visez une source à chaque repas, et une après la séance.', L: ['Skyr, fromage blanc : 10 g / 100 g', 'Œufs : 13 g pour 2', 'Poulet, dinde : 25 g / 100 g', 'Thon, sardines en boîte : 25 g / 100 g', 'Lentilles, pois chiches : 9 g / 100 g cuits', 'Tofu : 12 g / 100 g', 'Emmental : 8 g / 30 g'] },
  c: { tip: 'À augmenter surtout la veille et le jour des séances dures.', L: ['Pâtes, riz, semoule : 30 g / 100 g cuits', 'Pain : 50 g / 100 g', 'Flocons d’avoine : 60 g / 100 g', 'Pommes de terre : 17 g / 100 g', 'Banane : 23 g', 'Fruits secs (dattes, abricots) : 60 g / 100 g'] },
  f: { tip: 'Privilégiez les bonnes graisses, sans les supprimer.', L: ['Huile de colza ou d’olive : 10 g par cuillère à soupe', 'Noix, amandes : 15 g par poignée (30 g)', 'Avocat : 15 g / 100 g', 'Poissons gras (saumon, maquereau)', 'Beurre de cacahuète : 8 g par cuillère'] },
  fib: { tip: 'Un légume ou un fruit à chaque repas suffit souvent.', L: ['Légumes à chaque repas', 'Fruits avec la peau (pomme, poire)', 'Pain complet ou aux céréales', 'Flocons d’avoine', 'Lentilles, haricots : 8 g / 100 g cuits', 'Pruneaux, figues sèches'] },
  fe: { tip: 'Associez une vitamine C (agrume, kiwi, poivron) au repas ; thé et café plutôt à distance.', L: ['Viande rouge : 2,5 mg / 100 g (le mieux absorbé)', 'Boudin noir, moules', 'Lentilles : 3 mg / 100 g cuites', 'Tofu, pois chiches', 'Chocolat noir 70 % : 3 mg / 30 g', 'Céréales du petit-déjeuner enrichies'] },
  ca: { tip: 'Deux ou trois produits laitiers par jour, ou une eau riche en calcium.', L: ['Yaourt : 150 mg', 'Emmental, comté : 300 mg / 30 g', 'Eaux minérales calciques : ≈ 500 mg / L', 'Sardines avec arêtes', 'Amandes, tofu au calcium', 'Choux, brocolis'] },
  mg: { tip: 'Utile pour les crampes et la récupération.', L: ['Chocolat noir 70 % : 60 mg / 30 g', 'Amandes, noix de cajou : 80 mg / poignée', 'Eaux riches en magnésium', 'Banane : 35 mg', 'Pain complet, flocons d’avoine', 'Légumineuses, épinards'] },
  o3: { tip: 'Une à deux portions de poisson gras par semaine couvrent l’essentiel.', L: ['Sardines, maquereau, hareng', 'Saumon, truite', 'Huile de colza ou de noix (forme végétale, moins efficace)', 'Noix'] },
  b12: { tip: 'Uniquement d’origine animale : complément indispensable si végétalien.', L: ['Viande, poisson, fruits de mer', 'Œufs', 'Laitages, fromage', 'Aliments enrichis (boissons végétales, levure maltée)'] },
  vd: { tip: 'Peu d’aliments en contiennent : le soleil compte ; en hiver un complément est souvent conseillé.', L: ['Poissons gras (saumon, sardines, maquereau)', 'Jaune d’œuf', 'Champignons exposés aux UV', '15–20 min de soleil bras découverts (printemps-été)'] },
}
