// Recherche : retrouver un menu ou une fonction de l'app par mots-clés (accents et majuscules ignorés).
import React, { useEffect, useRef, useState } from 'react'
import { useApp } from '../App.jsx'
import { Page, List, Row, Empty } from '../ui.jsx'
import { frDate } from '../lib/hyrox.js'

const E = (icon, color, title, sub, href, kw, sex) => ({ icon, color, title, sub, href, kw, sex })
export const ENTRIES = [
  E('home', '#0a84ff', 'Accueil', 'Compte à rebours, séance du jour, progression', '#/', 'accueil home tableau de bord jour j compte a rebours aujourd hui'),
  E('flag', '#ff375f', 'Courses', 'Mes Hyrox à venir et passés', '#/courses', 'course courses hyrox competition date objectif resultat inscription ajouter une course'),
  E('team', '#ff9f0a', 'Équipes', 'Mes duos, invitations, courbe du duo', '#/equipe', 'equipe duo coequipier partenaire inviter invitation binome'),
  E('timer', '#0a84ff', 'Mes séances', 'Historique, séances prévues, activités', '#/seances', 'seances historique entrainements liste activites strava'),
  E('play', '#30d158', 'Nouvelle séance Hyrox (chrono)', 'Chronométrer une simulation, en solo ou en duo', '#/seance/nouvelle', 'chrono chronometre simulation nouvelle seance lancer demarrer relais stopwatch'),
  E('copy', '#30d158', 'Saisir une séance déjà faite', 'Entrer les temps après coup', '#/seance/nouvelle?apres=1', 'saisir temps apres coup deja fait manuel ajouter seance passee'),
  E('bolt', '#bf5af2', 'Séance spécifique', 'Créer une séance perso (force, course, ergos…)', '#/seance/specifique', 'seance specifique perso personnalisee creer force course ergo wod musculation'),
  E('bolt', '#bf5af2', 'Bibliothèque de séances', 'Séances types et mes modèles', '#/seance/specifique?lib=1', 'bibliotheque modeles templates seances types planifier'),
  E('compare', '#5e5ce6', 'Comparer des séances', 'Deux séances côte à côte', '#/comparer', 'comparer comparaison deux seances cote a cote'),
  E('chart', '#30d158', 'Suivi de l’entraînement', 'Volume, km, séances faites ou sautées, progression, forme', '#/moi/suivi', 'suivi courbe volume km kilometres seances sautees assiduite progression exercice charge forme'),
  E('cal', '#5e5ce6', 'Programme jusqu’à la course', 'Plan semaine par semaine', '#/moi/programme', 'programme plan entrainement semaine calendrier adapter rythme'),
  E('chart', '#ff375f', 'Mon niveau', 'Bilan : temps de course, ateliers, force', '#/moi/niveau', 'niveau bilan test temps ateliers force record partager duo courbe progression'),
  E('spark', '#5e5ce6', 'Analyse globale par Claude', 'Toute la préparation passée au crible', '#/moi/analyse', 'analyse globale claude ia coach avis question'),
  E('spark', '#5e5ce6', 'Analyses approfondies', 'Demandes à Claude et réponses', '#/moi/analyses', 'analyses approfondies demandes reponses claude coach ia'),
  E('leaf', '#64d2ff', 'Étirements et mobilité', 'Routines minutées, banque par zone', '#/moi/etirements', 'etirements stretching mobilite souplesse routine recuperation yoga'),
  E('spark', '#30d158', 'Forme du jour', 'Fatigue, sommeil, courbatures, moral', '#/moi/sante?t=forme', 'forme du jour fatigue courbatures moral humeur stress ressenti'),
  E('heart', '#ff9f0a', 'Douleurs', 'Mouvements à éviter, programme adapté', '#/moi/sante?t=douleurs', 'douleur douleurs blessure mal genou dos epaule'),
  E('moon', '#ff375f', 'Sommeil', 'Nuits, siestes, saisie manuelle', '#/moi/sante?t=sommeil', 'sommeil nuit nuits dormir sieste repos'),
  E('scale', '#ff9f0a', 'Poids', 'Courbe de poids', '#/moi/sante?t=poids', 'poids balance kg masse pesee'),
  E('drop', '#ff375f', 'Prises de sang', 'Fer, ferritine, vitamine D…', '#/moi/sante?t=sang', 'prise de sang analyse biologie fer ferritine vitamine marqueurs'),
  E('drop', '#ff375f', 'Cycle menstruel', 'Suivi du cycle', '#/moi/sante?t=cycle', 'cycle regles menstruel', 'F'),
  E('leaf', '#30d158', 'Coach nutrition', 'Alimentation, besoins du jour, jour de course', '#/moi/nutrition', 'nutrition alimentation manger repas proteines glucides calories besoins jour de course petit dejeuner'),
  E('pill', '#ff9f0a', 'Compléments', 'Ce qui est prouvé, doses, précautions', '#/moi/complements', 'complements supplements creatine cafeine whey magnesium'),
  E('heart', '#ff375f', 'Synchronisation Santé (iPhone)', 'Sommeil et cardio envoyés automatiquement', '#/moi/sync', 'synchronisation sync sante iphone apple health raccourci jeton token montre fc'),
  E('user', '#8e8e93', 'Profil et zones cardio', 'Âge, poids, FC max, zones', '#/moi/profil', 'profil zones cardio fc max frequence cardiaque age poids taille sexe'),
  E('gear', '#8e8e93', 'Réglages', 'Apparence, accords, coach IA, export', '#/moi/reglages', 'reglages parametres theme sombre clair apparence accords export donnees json deconnexion'),
  E('upload', '#0a84ff', 'Importer Chrono Hyrox Duo', 'Sauvegarde de l’artefact ou de l’app iPhone', '#/moi/import', 'importer import sauvegarde fichier'),
  E('bug', '#ff453a', 'Signalements', 'Signaler un problème, suivre les corrections', '#/moi/bugs', 'signalement bug probleme erreur suggestion idee'),
]

export const norm = s => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[’']/g, ' ')
/** Résultats classés : titre qui commence par le mot > titre qui contient > mots-clés */
export function search(q, entries = ENTRIES) {
  const words = norm(q).split(/\s+/).filter(Boolean); if (!words.length) return []
  return entries.map(e => {
    const t = norm(e.title), all = t + ' ' + norm(e.sub) + ' ' + norm(e.kw)
    if (!words.every(w => all.includes(w))) return null
    const score = words.reduce((a, w) => a + (t.startsWith(w) ? 3 : t.includes(w) ? 2 : 1), 0)
    return { e, score }
  }).filter(Boolean).sort((a, b) => b.score - a.score).map(x => x.e)
}

export default function SearchPage() {
  const { races = [], teams = [], profile } = useApp()
  const [q, setQ] = useState(() => { try { return sessionStorage.getItem('hx-search') || '' } catch { return '' } })
  const ref = useRef()
  useEffect(() => { ref.current && ref.current.focus() }, [])
  useEffect(() => { try { sessionStorage.setItem('hx-search', q) } catch {} }, [q])
  const dyn = [
    ...races.map(r => E('flag', '#ff375f', r.name, 'Course · ' + frDate(r.race_date) + (r.city ? ' · ' + r.city : ''), '#/course/' + r.id, 'course ' + (r.city || ''))),
    ...teams.map(t => E('team', '#ff9f0a', t.name, 'Équipe', '#/equipe/' + t.id, 'equipe duo')),
  ]
  const base = ENTRIES.filter(e => !e.sex || e.sex === profile.sex)
  const res = search(q, [...base, ...dyn]).slice(0, 30)
  return <Page title="Rechercher" back="#/">
    <div className="search-box glass"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4 4" /></svg>
      <input ref={ref} type="search" value={q} onChange={e => setQ(e.target.value)} placeholder="Menu ou fonction : sommeil, chrono, plan…" aria-label="Rechercher un menu ou une fonction" enterKeyHint="search"
        onKeyDown={e => { if (e.key === 'Enter' && res[0]) location.hash = res[0].href }} />
      {q && <button className="search-clear" onClick={() => { setQ(''); ref.current.focus() }} aria-label="Effacer">×</button>}
    </div>
    {q.trim() ? (res.length ? <List>{res.map(e => <Row key={e.href + e.title} icon={e.icon} color={e.color} title={e.title} sub={e.sub} href={e.href} />)}</List>
      : <div className="glass card"><Empty icon="spark">Aucun résultat pour « {q} ».<br />Essayez un autre mot : poids, relais, étirements…</Empty></div>)
      : <><p className="foot" style={{ marginTop: 4 }}>Suggestions</p><List>{['Suivi de l’entraînement', 'Forme du jour', 'Nouvelle séance Hyrox (chrono)', 'Programme jusqu’à la course', 'Sommeil'].map(t => base.find(e => e.title === t)).filter(Boolean).map(e => <Row key={e.href} icon={e.icon} color={e.color} title={e.title} sub={e.sub} href={e.href} />)}</List></>}
  </Page>
}
