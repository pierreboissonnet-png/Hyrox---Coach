// Tutoriel pas à pas : créer les raccourcis iPhone qui envoient les données de Santé à l'app.
import React, { useState } from 'react'
import { Icon, useToast } from '../ui.jsx'

/** Petite étiquette copiable (nom exact d'une action, d'une clé, d'une valeur) */
function C({ t, label }) {
  const toast = useToast()
  return <button onClick={async () => { try { await navigator.clipboard.writeText(t); toast('Copié : ' + t) } catch { toast('Copie impossible') } }} title="Copier"
    style={{ border: 0, borderRadius: 7, padding: '1px 7px', margin: '0 1px', background: 'var(--accent-soft)', color: 'var(--ink)', font: 'inherit', fontWeight: 650, cursor: 'pointer' }}>{label || t}</button>
}
const A = ({ children }) => <b style={{ color: 'var(--accent)' }}>« {children} »</b>   // nom d'une action Raccourcis
const Box = ({ n, children }) => <div style={{ display: 'flex', gap: 10, padding: '7px 0', borderTop: '.5px solid var(--sep)' }}><span style={{ flexShrink: 0, width: 24, height: 24, borderRadius: 12, background: 'var(--accent)', color: '#fff', fontSize: 13, fontWeight: 700, display: 'grid', placeItems: 'center' }}>{n}</span><div style={{ flex: 1 }}>{children}</div></div>
const Tip = ({ children }) => <div className="note small" style={{ margin: '8px 0 0' }}>{children}</div>

/** Recherche d'un type de données (sans boucle : c'est la boucle qui rendait l'envoi très lent) */
function Search({ n, type, period }) {
  return <Box n={n}>Ajoutez <A>Rechercher des échantillons de santé</A> (barre de recherche en bas de l’écran). Touchez le mot bleu après « Type » et choisissez <b>{type}</b>. Touchez <b>Ajouter un filtre</b> : <b>Date de début</b> › <b>est dans les dernier(e)s</b> › <b>{period}</b>. Laissez <b>Limite</b> désactivée.</Box>
}
/** Champ JSON relié directement à une propriété des échantillons trouvés */
const Field = ({ k, prop, src }) => <div style={{ margin: '3px 0' }}>• clé <C t={k} /> : valeur › <b>Sélectionner une variable</b> › touchez la sortie <b>{src || 'Échantillons de santé'}</b>, puis touchez la bulle bleue insérée et choisissez <b>{prop}</b>.</div>

export function ShortcutGuide({ url, token }) {
  const [step, setStep] = useState(0)
  const send = (n, fields) => <>
    <Box n={n}>Ajoutez <A>Obtenir le contenu de l’URL</A> <b>tout en bas</b>. Touchez le mot bleu <b>URL</b> et collez l’adresse : <C t={url} label="copier l’adresse" />.</Box>
    <Box n={n + 1}>Touchez la petite flèche <b>⌄</b> (ou <b>Afficher plus</b>) de cette action : <b>Méthode</b> › <b>POST</b>, <b>Corps de la requête</b> › <b>JSON</b>.</Box>
    <Box n={n + 2}>Touchez <b>Ajouter un nouveau champ</b> › <b>Texte</b> : clé <C t="token" />, valeur : votre jeton {token ? <C t={token} label="copier mon jeton" /> : <span className="muted">(créez-le en haut de cette page, depuis l’iPhone)</span>}.</Box>
    <Box n={n + 3}>Ajoutez ensuite ces champs <b>Texte</b> :{fields}</Box>
  </>
  const S = [
    { t: 'Avant de commencer', c: <>
      <p style={{ marginTop: 0 }}>Vous allez créer jusqu’à 3 raccourcis dans l’app <b>Raccourcis</b> (préinstallée sur l’iPhone), puis les lancer automatiquement. Comptez 10 minutes pour le premier, 5 pour les suivants.</p>
      <Box n="1"><b>Ouvrez cette page sur l’iPhone</b> (Safari › {location.host} › Moi › Réglages › Synchro Santé) : les boutons bleus <C t="token" label="comme celui-ci" /> copient le texte exact, à coller ensuite dans Raccourcis. Créez votre <b>jeton</b> en haut de la page depuis l’iPhone (un jeton créé ailleurs n’est plus affiché).</Box>
      <Box n="2">Ouvrez l’app <b>Raccourcis</b> › onglet <b>Raccourcis</b> › bouton <b>+</b> en haut à droite. Touchez le titre en haut pour le renommer.</Box>
      <Box n="3"><b>Réglage indispensable</b> : app <b>Réglages</b> de l’iPhone › <b>Raccourcis</b> › <b>Avancé</b> › activez <b>Autoriser le partage de grandes quantités de données</b>. Sans lui, l’iPhone bloque l’envoi (« cette action tente de partager … éléments Santé, ce qui n’est pas autorisé »).</Box>
      <Box n="4">Ordre conseillé : <b>Hyrox Sommeil</b> (le plus utile), puis <b>Hyrox Mesures</b> (FC au repos, poids…), puis <b>Hyrox FC</b> (cardio des séances).</Box>
      <Tip>Au premier lancement, l’iPhone demande l’accès à Santé : touchez <b>Autoriser</b> pour chaque type de données. Rien n’est envoyé ailleurs que dans votre espace privé de l’app.</Tip>
    </> },
    { t: 'Raccourci « Hyrox Sommeil »', c: <>
      <p style={{ marginTop: 0 }}>Deux actions seulement : une recherche, puis l’envoi.</p>
      <Box n="1">Nouveau raccourci, nommez-le <C t="Hyrox Sommeil" />.</Box>
      <Search n={2} type="Analyse du sommeil" period="1 jour" />
      {send(3, <><Field k="starts" prop="Date de début" /><Field k="ends" prop="Date de fin" /><Field k="values" prop="Valeur" /></>)}
      <Tip>Votre raccourci doit se lire : <b>Rechercher des échantillons de santé</b> › <b>Obtenir le contenu de l’URL</b> (champs token, starts, ends, values). <b>Vous aviez fait la version avec « Répéter avec chaque » ?</b> Elle marche aussi, mais elle est lente : supprimez la boucle et ses « Ajouter à la variable », puis reliez les champs comme ci-dessus.</Tip>
    </> },
    { t: 'Tester puis automatiser', c: <>
      <Box n="1">Dans le raccourci, touchez ▶ en bas à droite. Autorisez l’accès à Santé si l’iPhone le demande.</Box>
      <Box n="2">Le résultat s’affiche en bas : vous devez lire <b>"ok": true</b> et <b>nights</b> ≥ 1. Ici, la ligne de votre jeton indique « dernier envoi » (rechargez la page).</Box>
      <Box n="3">Automatisation : app Raccourcis › onglet <b>Automatisation</b> › <b>+</b> › <b>Heure de la journée</b> › <b>9:00</b>, Quotidien › choisissez <b>Exécuter immédiatement</b> › Suivant › choisissez <b>Hyrox Sommeil</b>.</Box>
      <Tip><b>Erreur 401</b> : jeton mal collé (pas d’espace avant ou après). <b>Erreur 403</b> : activez « Données de santé » dans Moi › Réglages. <b>Erreur 404 / introuvable</b> : la fonction « health-sync » n’est pas encore créée dans Supabase. <b>nights : 0</b> : pas de nuit enregistrée dans Santé ces dernières 24 h (montre ou mode Sommeil).</Tip>
    </> },
    { t: 'Raccourci « Hyrox Mesures »', c: <>
      <p style={{ marginTop: 0 }}>FC au repos, variabilité cardiaque, poids, pas… Le plus rapide : <b>dupliquer Hyrox Sommeil</b>, puis ajouter une recherche par mesure.</p>
      <Box n="1">Maintenez appuyé <b>Hyrox Sommeil</b> › <b>Dupliquer</b>. Ouvrez la copie, touchez son titre › <b>Renommer</b> › <C t="Hyrox Mesures" />.</Box>
      <Box n="2">Dans la recherche, remplacez <b>Analyse du sommeil</b> par <b>Fréquence cardiaque au repos</b> (tapez « repos ») et la période par <b>2 jours</b>.</Box>
      <Box n="3">Dans <A>Obtenir le contenu de l’URL</A>, gardez <b>token</b> et supprimez les champs <b>starts</b>, <b>ends</b>, <b>values</b> (glissez vers la gauche). Ajoutez :<Field k="rhr_dates" prop="Date de début" /><Field k="rhr_values" prop="Valeur" /></Box>
      <Box n="4">Testez avec ▶ : la réponse doit contenir <b>"days": 1</b> ou plus.</Box>
      <Box n="5"><b>Pour chaque mesure en plus</b> (tableau ci-dessous) : ajoutez une nouvelle <A>Rechercher des échantillons de santé</A> et faites-la glisser <b>au-dessus</b> de « Obtenir le contenu de l’URL ». Choisissez son type et sa période.</Box>
      <Box n="6">Dans « Obtenir le contenu de l’URL », ajoutez ses deux champs. Pour la valeur, dans <b>Sélectionner une variable</b>, touchez <b>la sortie de cette nouvelle recherche</b> (pas celle de la FC au repos), puis Date de début ou Valeur.</Box>
      <div className="small" style={{ margin: '6px 0 4px', display: 'grid', gridTemplateColumns: 'auto auto auto', gap: '4px 10px', alignItems: 'center' }}>
        <b className="muted">Type dans Raccourcis</b><b className="muted">Période</b><b className="muted">Clés des champs</b>
        {[['Variabilité de la fréquence cardiaque', '2 jours', 'hrv'], ['Poids', '2 jours', 'weight'], ['Nombre de pas', '2 jours', 'steps'], ['Énergie active', '2 jours', 'kcal'], ['Masse grasse (tapez « graisse » ou « masse »)', '7 jours', 'fat'], ['Règles (tapez « règl » ou « menstru »)', '7 jours', 'flow']].map(([ty, pe, k]) => <React.Fragment key={k}><span>{ty}</span><span>{pe}</span><span><C t={k + '_dates'} /> <C t={k + '_values'} /></span></React.Fragment>)}
      </div>
      <Box n="7">Testez avec ▶ après chaque mesure ajoutée. Puis ouvrez l’automatisation de <b>9:00</b> (onglet Automatisation) et ajoutez <A>Exécuter le raccourci</A> › <b>Hyrox Mesures</b>, sous Hyrox Sommeil.</Box>
      <Tip>La liste des types de Raccourcis est plus courte que celle de Santé (pas de VO₂ max) : si un type n’apparaît pas, passez-le. Réponse <b>"days": 0</b> : la montre ou la balance n’a rien enregistré sur la période. <b>"weights"</b> = pesées reçues, <b>"periods"</b> = cycle.</Tip>
    </> },
    { t: 'Raccourci « Hyrox FC »', c: <>
      <p style={{ marginTop: 0 }}>Il envoie la fréquence cardiaque de l’Apple Watch : l’app la rattache à la séance chronométrée et affiche le détail par atelier.</p>
      <Box n="1">Dupliquez <b>Hyrox Sommeil</b> et renommez la copie <C t="Hyrox FC" />.</Box>
      <Box n="2">Dans la recherche, choisissez le type <b>Fréquence cardiaque</b>, période <b>1 jour</b>.</Box>
      <Box n="3">Dans « Obtenir le contenu de l’URL », gardez <b>token</b>, supprimez starts, ends et values, puis ajoutez :<Field k="dates" prop="Date de début" /><Field k="values" prop="Valeur" /></Box>
      <Box n="4">Testez avec ▶ : <b>"hr_points"</b> doit être supérieur à 0. Message « … éléments Santé, ce qui n’est pas autorisé » : activez Réglages › Raccourcis › Avancé › <b>Autoriser le partage de grandes quantités de données</b>. Sans boucle, l’envoi prend quelques secondes même avec des milliers de mesures.</Box>
      <Box n="5">Automatisation : onglet <b>Automatisation</b> › <b>+</b> › <b>Apple Watch</b> (ou « Entraînement ») › <b>Se termine</b> › <b>Exécuter immédiatement</b> › Hyrox FC.</Box>
      <Tip>Si l’automatisation « Entraînement » n’apparaît pas, ajoutez Hyrox FC à l’automatisation de 9:00 : le cardio arrivera le lendemain matin.</Tip>
    </> },
    { t: 'C’est terminé', c: <>
      <p style={{ marginTop: 0 }}>Chaque matin, vos nuits et vos mesures arrivent seules ; après chaque séance chronométrée, le cardio s’y rattache.</p>
      <Box n="✓">Vérifiez de temps en temps la ligne « dernier envoi » de votre jeton, ici.</Box>
      <Box n="✓">L’onglet Santé › Sommeil vous prévient si aucune nuit n’arrive depuis 2 jours.</Box>
      <Box n="✓">Les entraînements de la montre (course, vélo…) ne passent pas par Raccourcis : ajoutez-les avec « Activité faite », ou utilisez Health Auto Export.</Box>
    </> },
  ]
  const cur = S[step]
  return <div className="glass card small" style={{ lineHeight: 1.5 }}>
    <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>{S.map((_, i) => <button key={i} onClick={() => setStep(i)} aria-label={'Étape ' + (i + 1)} style={{ flex: 1, height: 5, border: 0, borderRadius: 3, padding: 0, background: i <= step ? 'var(--accent)' : 'var(--fill)', cursor: 'pointer' }} />)}</div>
    <div className="tiny muted">Étape {step + 1} sur {S.length}</div>
    <h3 style={{ margin: '2px 0 8px' }}>{cur.t}</h3>
    {cur.c}
    <div className="row-gap" style={{ marginTop: 12 }}>
      <button className="btn glass small" disabled={step === 0} onClick={() => setStep(step - 1)}><Icon name="back" size={14} />Précédent</button>
      <span className="spacer" />
      {step < S.length - 1 && <button className="btn small" onClick={() => setStep(step + 1)}>Suivant<Icon name="chev" size={14} /></button>}
    </div>
  </div>
}
