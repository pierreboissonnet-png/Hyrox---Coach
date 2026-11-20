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

/**
 * Bloc commun « rechercher → boucle → deux listes », réutilisé pour chaque type de données.
 * start : n° de la première sous-étape ; type : nom du type dans Santé ; period : période à choisir ; dates/values : noms des variables
 */
function Collect({ start, type, period, dates, values, extra }) {
  return <>
    <Box n={start}>Touchez <b>Ajouter une action</b> (ou la barre de recherche en bas), cherchez <A>Rechercher des échantillons de santé</A> et ajoutez-la. Touchez le mot bleu après « Type » et choisissez <b>{type}</b>.</Box>
    <Box n={start + 1}>Dans cette action, touchez <b>Ajouter un filtre</b> : <b>Date de début</b> › <b>est dans les dernier(e)s</b> › <b>{period}</b>. Laissez <b>Limite</b> désactivée.</Box>
    <Box n={start + 2}>Ajoutez <A>Répéter avec chaque</A>. Deux lignes apparaissent : « Répéter avec chaque élément dans <i>Échantillons de santé</i> » et, plus bas, <b>« Fin de la répétition »</b>. Tout ce qui suit se place <b>entre ces deux lignes</b>.</Box>
    <Box n={start + 3}>Ajoutez <A>Ajouter à la variable</A>. <b>Si elle s’ajoute tout en bas</b>, sous « Fin de la répétition », maintenez-la appuyée et faites-la glisser juste au-dessus de « Fin de la répétition ».
      <div style={{ marginTop: 4 }}>Touchez le champ <b>Valeur</b> › <b>Sélectionner une variable</b> › touchez <b>Élément de répétition</b>. Touchez ensuite la bulle bleue « Élément de répétition » qui vient d’apparaître et choisissez <b>Date de début</b> dans la liste. Touchez <b>Variable</b> et tapez <C t={dates} />.</div></Box>
    <Box n={start + 4}>Ajoutez une deuxième <A>Ajouter à la variable</A> (toujours dans la boucle) : même manipulation, mais choisissez <b>Valeur</b> au lieu de Date de début ; nom de la variable <C t={values} />.{extra}</Box>
  </>
}

export function ShortcutGuide({ url, token }) {
  const [step, setStep] = useState(0)
  const send = (n, fields) => <>
    <Box n={n}>Ajoutez <A>Obtenir le contenu de l’URL</A>. Elle doit être <b>tout en bas, sous « Fin de la répétition »</b> (faites-la glisser si besoin). Touchez le mot bleu <b>URL</b> et collez l’adresse : <C t={url} label="copier l’adresse" />.</Box>
    <Box n={n + 1}>Touchez la petite flèche <b>⌄</b> (ou <b>Afficher plus</b>) à droite de l’action. Réglez <b>Méthode</b> sur <b>POST</b> et <b>Corps de la requête</b> sur <b>JSON</b>.</Box>
    <Box n={n + 2}>Touchez <b>Ajouter un nouveau champ</b> › <b>Texte</b>. Clé : <C t="token" />, valeur : votre jeton {token ? <C t={token} label="copier mon jeton" /> : <span className="muted">(créez-le en haut de cette page, depuis l’iPhone)</span>}.</Box>
    <Box n={n + 3}>Puis un champ <b>Texte</b> par variable, avec <b>exactement le même nom</b> que la variable : {fields.map((f, i) => <React.Fragment key={f}>{i ? ', ' : ''}<C t={f} /></React.Fragment>)}. Pour la valeur, touchez-la puis, dans la barre au-dessus du clavier, choisissez la variable du même nom.</Box>
  </>
  const S = [
    { t: 'Avant de commencer', c: <>
      <p style={{ marginTop: 0 }}>Vous allez créer jusqu’à 3 raccourcis dans l’app <b>Raccourcis</b> (préinstallée sur l’iPhone), puis les lancer automatiquement. Comptez 10 minutes pour le premier, 5 pour les suivants.</p>
      <Box n="1"><b>Ouvrez cette page sur l’iPhone</b> (Safari › {location.host} › Moi › Réglages › Synchro Santé) : les boutons bleus <C t="token" label="comme celui-ci" /> copient le texte exact, à coller ensuite dans Raccourcis. Créez votre <b>jeton</b> en haut de la page depuis l’iPhone (un jeton créé ailleurs n’est plus affiché).</Box>
      <Box n="2">Ouvrez l’app <b>Raccourcis</b> › onglet <b>Raccourcis</b> › bouton <b>+</b> en haut à droite. Touchez le titre en haut pour le renommer.</Box>
      <Box n="3">Ordre conseillé : <b>Hyrox Sommeil</b> (le plus utile), puis <b>Hyrox Mesures</b> (FC au repos, poids…), puis <b>Hyrox FC</b> (cardio des séances).</Box>
      <Tip>Au premier lancement, l’iPhone demande l’accès à Santé : touchez <b>Autoriser</b> pour chaque type de données. Rien n’est envoyé ailleurs que dans votre espace privé de l’app.</Tip>
    </> },
    { t: 'Raccourci « Hyrox Sommeil »', c: <>
      <Box n="1">Nouveau raccourci, nommez-le <C t="Hyrox Sommeil" />.</Box>
      <Collect start={2} type="Analyse du sommeil" period="1 jour" dates="starts" values="values" extra={<div style={{ marginTop: 4 }}>Puis une troisième <A>Ajouter à la variable</A> dans la boucle : <b>Élément de répétition</b> › <b>Date de fin</b>, variable <C t="ends" />.</div>} />
      {send(7, ['starts', 'ends', 'values'])}
      <Tip>Pour insérer une variable dans un champ : touchez le champ, puis la barre au-dessus du clavier (<b>Variables</b>) et choisissez son nom. Vérification : votre raccourci doit se lire, de haut en bas : Rechercher… › Répéter avec chaque › Ajouter à la variable (×3) › Fin de la répétition › Obtenir le contenu de l’URL.</Tip>
    </> },
    { t: 'Tester puis automatiser', c: <>
      <Box n="1">Dans le raccourci, touchez ▶ en bas à droite. Autorisez l’accès à Santé si l’iPhone le demande.</Box>
      <Box n="2">Le résultat s’affiche en bas : vous devez lire <b>"ok": true</b> et <b>nights</b> ≥ 1. Ici, la ligne de votre jeton indique « dernier envoi » (rechargez la page).</Box>
      <Box n="3">Automatisation : app Raccourcis › onglet <b>Automatisation</b> › <b>+</b> › <b>Heure de la journée</b> › <b>9:00</b>, Quotidien › choisissez <b>Exécuter immédiatement</b> › Suivant › choisissez <b>Hyrox Sommeil</b>.</Box>
      <Tip><b>Erreur 401</b> : jeton mal collé (pas d’espace avant ou après). <b>Erreur 403</b> : activez « Données de santé » dans Moi › Réglages. <b>Erreur 404 / introuvable</b> : la fonction « health-sync » n’est pas encore créée dans Supabase. <b>nights : 0</b> : pas de nuit enregistrée dans Santé ces dernières 24 h (montre ou mode Sommeil).</Tip>
    </> },
    { t: 'Hyrox Mesures (1/3) : partir de Hyrox Sommeil', c: <>
      <p style={{ marginTop: 0 }}>Ce raccourci envoie la FC au repos, la variabilité cardiaque, le poids, les pas… Le plus rapide : <b>dupliquer Hyrox Sommeil</b> puis l’adapter. On commence par une seule mesure, la <b>FC au repos</b>.</p>
      <Box n="1">Dans l’onglet <b>Raccourcis</b>, maintenez appuyé <b>Hyrox Sommeil</b> › <b>Dupliquer</b>. Ouvrez la copie (« Hyrox Sommeil 1 »), touchez son titre en haut › <b>Renommer</b> › <C t="Hyrox Mesures" />.</Box>
      <Box n="2">Dans <A>Rechercher des échantillons de santé</A> : touchez <b>Analyse du sommeil</b> et choisissez <b>Fréquence cardiaque au repos</b> (tapez « repos » pour la trouver). Dans le filtre Date de début, remplacez <b>1 jour</b> par <b>2 jours</b>.</Box>
      <Box n="3">Dans la boucle, <b>supprimez</b> la troisième <A>Ajouter à la variable</A> (celle de la variable <b>ends</b>, avec Date de fin) : glissez-la vers la gauche › <b>Supprimer</b>.</Box>
      <Box n="4">Renommez les deux variables restantes : touchez <b>starts</b> et remplacez par <C t="rhr_dates" /> ; touchez <b>values</b> et remplacez par <C t="rhr_values" />. La Date de début et la Valeur ne changent pas.</Box>
      <Box n="5">Tout en bas, dans <A>Obtenir le contenu de l’URL</A>, gardez l’adresse, POST, JSON et le champ <b>token</b>. <b>Supprimez</b> les champs <b>starts</b>, <b>ends</b> et <b>values</b> (glissez vers la gauche).</Box>
      <Box n="6">Ajoutez deux champs <b>Texte</b> : clé <C t="rhr_dates" /> = variable rhr_dates, clé <C t="rhr_values" /> = variable rhr_values.</Box>
      <Box n="7">Testez avec ▶ (autorisez l’accès si demandé). La réponse doit contenir <b>"days": 1</b> ou plus. Si c’est 0 : la montre n’a pas encore mesuré de FC au repos ces 2 derniers jours.</Box>
      <Tip>Vérification : de haut en bas, Rechercher (FC au repos) › Répéter avec chaque › Ajouter à la variable rhr_dates › Ajouter à la variable rhr_values › Fin de la répétition › Obtenir le contenu de l’URL (token, rhr_dates, rhr_values).</Tip>
    </> },
    { t: 'Hyrox Mesures (2/3) : ajouter les autres mesures', c: <>
      <p style={{ marginTop: 0 }}>Pour chaque mesure en plus, on recopie le bloc de la FC au repos et on change trois choses : le <b>type</b>, la <b>période</b> et les <b>noms de variables</b>. Ajoutez-en autant que vous voulez, une à la fois.</p>
      <div className="small" style={{ margin: '4px 0 8px', display: 'grid', gridTemplateColumns: 'auto auto auto', gap: '4px 10px', alignItems: 'center' }}>
        <b className="muted">Type dans Santé</b><b className="muted">Période</b><b className="muted">Variables</b>
        {[['Variabilité de la fréquence cardiaque', '2 jours', 'hrv'], ['Poids', '2 jours', 'weight'], ['Nombre de pas', '2 jours', 'steps'], ['Énergie active', '2 jours', 'kcal'], ['VO₂ max — écrit avec un petit « ₂ » : tapez « VO » ou « forme » (Forme cardio). Facultatif', '30 jours', 'vo2'], ['Masse grasse (%)', '7 jours', 'fat'], ['Règles (écoulement menstruel)', '7 jours', 'flow']].map(([ty, pe, k]) => <React.Fragment key={k}><span>{ty}</span><span>{pe}</span><span><C t={k + '_dates'} /> <C t={k + '_values'} /></span></React.Fragment>)}
      </div>
      <Box n="1"><b>Copier le bloc</b> : maintenez appuyée l’action <A>Rechercher des échantillons de santé</A> › <b>Sélectionner</b>, puis touchez aussi « Répéter avec chaque », les deux « Ajouter à la variable » et « Fin de la répétition ». Touchez l’icône <b>Dupliquer</b> (deux carrés) en bas. <span className="muted">Si « Sélectionner » n’existe pas sur votre iPhone : maintenez chaque action › Dupliquer, une par une.</span></Box>
      <Box n="2">La copie apparaît sous le premier bloc. Si elle est en dessous de « Obtenir le contenu de l’URL », faites glisser « Obtenir le contenu de l’URL » <b>tout en bas</b>.</Box>
      <Box n="3">Dans la copie : changez le <b>Type</b> (par ex. Variabilité de la fréquence cardiaque) et la <b>période</b> du filtre selon le tableau.</Box>
      <Box n="4">Vérifiez que la copie de <b>« Répéter avec chaque élément dans… »</b> pointe vers <b>la recherche juste au-dessus</b> : touchez le mot bleu « Échantillons de santé » › Sélectionner une variable › choisissez la sortie de la nouvelle recherche (la plus basse).</Box>
      <Box n="5">Dans les deux « Ajouter à la variable » de la copie : <b>retouchez la bulle « Élément de répétition »</b> › Effacer, puis Sélectionner une variable › Élément de répétition › <b>Date de début</b> (et <b>Valeur</b> pour la deuxième). Ainsi elles lisent bien la nouvelle boucle. Renommez les variables selon le tableau (ex. <C t="hrv_dates" /> et <C t="hrv_values" />).</Box>
      <Box n="6">Dans <A>Obtenir le contenu de l’URL</A>, ajoutez les deux champs <b>Texte</b> correspondants (ex. <C t="hrv_dates" /> et <C t="hrv_values" />), chacun avec la variable du même nom.</Box>
      <Tip>Une erreur fréquente : oublier l’étape 4 ou 5. La nouvelle mesure renverrait alors les valeurs de la FC au repos. En cas de doute, testez avec ▶ après chaque mesure ajoutée : la réponse indique les jours et pesées reçus.</Tip>
    </> },
    { t: 'Hyrox Mesures (3/3) : tester et automatiser', c: <>
      <Box n="1">Touchez ▶. Autorisez l’accès à chaque nouveau type de données. Dans la réponse : <b>"days"</b> = jours de mesures reçus, <b>"weights"</b> = pesées, <b>"periods"</b> = cycle.</Box>
      <Box n="2">Ouvrez l’onglet <b>Automatisation</b>, touchez l’automatisation de <b>9:00</b> (créée pour Hyrox Sommeil). Ajoutez l’action <A>Exécuter le raccourci</A> et choisissez <b>Hyrox Mesures</b>, sous Hyrox Sommeil. <span className="muted">Ou créez une seconde automatisation Heure de la journée, 9:05, Exécuter immédiatement.</span></Box>
      <Box n="3">Dans l’app : Santé › Forme affiche « Mesures de la montre » (FC au repos, variabilité…) dès le premier envoi.</Box>
      <Tip><b>"days": 0</b> pour une mesure : vérifiez le Type, la période, et que la montre ou la balance a bien enregistré cette donnée dans Santé. <b>Valeurs bizarres</b> : une variable de la copie lit encore la première boucle (refaites l’étape 5 de la page précédente).</Tip>
    </> },
    { t: 'Raccourci « Hyrox FC »', c: <>
      <p style={{ marginTop: 0 }}>Il envoie la fréquence cardiaque de l’Apple Watch après chaque entraînement : l’app la rattache à la séance chronométrée et affiche le détail par atelier.</p>
      <Box n="1">Nouveau raccourci <C t="Hyrox FC" />.</Box>
      <Collect start={2} type="Fréquence cardiaque" period="4 heures" dates="dates" values="values" />
      {send(7, ['dates', 'values'])}
      <Box n="11">Automatisation : onglet <b>Automatisation</b> › <b>+</b> › <b>Apple Watch</b> (ou « Entraînement ») › <b>Se termine</b> › <b>Exécuter immédiatement</b> › Hyrox FC.</Box>
      <Tip>Si l’automatisation « Entraînement » n’apparaît pas, ajoutez simplement Hyrox FC à l’automatisation de 9:00 avec une période de <b>24 heures</b> : le cardio arrivera le lendemain matin.</Tip>
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
