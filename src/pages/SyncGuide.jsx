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
function Collect({ start, type, period, dates, values, extra, limit }) {
  return <>
    <Box n={start}>Touchez <b>Ajouter une action</b>, cherchez <A>Rechercher des échantillons de santé</A> et ajoutez-la. Touchez « Type » et choisissez <b>{type}</b>.</Box>
    <Box n={start + 1}>Touchez <b>Ajouter un filtre</b> : <b>Date de début</b> › <b>est dans les dernier(e)s</b> › <b>{period}</b>. Réglez <b>Trier par</b> : Date de début, et laissez <b>Limite</b> désactivée{limit ? '' : ''}.</Box>
    <Box n={start + 2}>Ajoutez <A>Répéter avec chaque</A> (elle se place sous la recherche et reçoit ses résultats).</Box>
    <Box n={start + 3}>Dans la boucle, ajoutez <A>Formater la date</A> : touchez la date et choisissez la variable <b>Élément de répétition</b> puis, dans le menu qui s’ouvre, <b>Date de début</b>. Format de date : <b>ISO 8601</b>, activez <b>Inclure l’heure</b>.</Box>
    <Box n={start + 4}>Toujours dans la boucle, ajoutez <A>Ajouter à la variable</A> : la valeur est <b>Date formatée</b>, nom de la variable <C t={dates} />.</Box>
    <Box n={start + 5}>Ajoutez encore <A>Ajouter à la variable</A> : touchez la valeur, choisissez <b>Élément de répétition</b> puis <b>Valeur</b> ; nom de la variable <C t={values} />.{extra}</Box>
  </>
}

export function ShortcutGuide({ url, token }) {
  const [step, setStep] = useState(0)
  const header = <>En-têtes : touchez <b>Ajouter un nouvel en-tête</b>, clé <C t="x-sync-token" />, valeur : votre jeton.</>
  const send = (n, keys) => <>
    <Box n={n}>Ajoutez <A>Obtenir le contenu de l’URL</A> (en dehors des boucles, tout en bas). Collez l’adresse <C t={url} label="adresse d’envoi" />. Touchez la flèche ▸ pour afficher les options : Méthode <b>POST</b>.</Box>
    <Box n={n + 1}>{header} {token ? <C t={token} label="copier mon jeton" /> : <span className="muted">(créez-le en haut de cette page)</span>}</Box>
    <Box n={n + 2}>Corps de la requête : <b>JSON</b>. {keys}</Box>
  </>
  const S = [
    { t: 'Avant de commencer', c: <>
      <p style={{ marginTop: 0 }}>Vous allez créer jusqu’à 3 raccourcis dans l’app <b>Raccourcis</b> (préinstallée sur l’iPhone), puis les lancer automatiquement. Comptez 10 minutes pour le premier, 5 pour les suivants.</p>
      <Box n="1">Créez votre <b>jeton</b> en haut de cette page et gardez cette page ouverte : les boutons bleus <C t="x-sync-token" label="comme celui-ci" /> copient le texte exact à coller.</Box>
      <Box n="2">Ouvrez l’app <b>Raccourcis</b> › onglet <b>Raccourcis</b> › bouton <b>+</b> en haut à droite. Touchez le titre en haut pour le renommer.</Box>
      <Box n="3">Ordre conseillé : <b>Hyrox Sommeil</b> (le plus utile), puis <b>Hyrox Mesures</b> (FC au repos, poids…), puis <b>Hyrox FC</b> (cardio des séances).</Box>
      <Tip>Au premier lancement, l’iPhone demande l’accès à Santé : touchez <b>Autoriser</b> pour chaque type de données. Rien n’est envoyé ailleurs que dans votre espace privé de l’app.</Tip>
    </> },
    { t: 'Raccourci « Hyrox Sommeil »', c: <>
      <Box n="1">Nouveau raccourci, nommez-le <C t="Hyrox Sommeil" />.</Box>
      <Collect start={2} type="Analyse du sommeil" period="1 jour" dates="starts" values="values" extra={<> Puis ajoutez une 3e <A>Ajouter à la variable</A> avec une seconde <A>Formater la date</A> sur <b>Date de fin</b> (ISO 8601 avec l’heure) → variable <C t="ends" />.</>} />
      {send(8, <>Ajoutez un champ de type <b>Dictionnaire</b>, clé <C t="sleep" />. Dans ce dictionnaire, ajoutez trois champs de type <b>Texte</b> : <C t="starts" /> = variable starts, <C t="ends" /> = variable ends, <C t="values" /> = variable values.</>)}
      <Tip>Pour insérer une variable dans un champ : touchez le champ, puis la barre au-dessus du clavier (<b>Variables</b>) et choisissez son nom.</Tip>
    </> },
    { t: 'Tester puis automatiser', c: <>
      <Box n="1">Dans le raccourci, touchez ▶ en bas à droite. Autorisez l’accès à Santé si l’iPhone le demande.</Box>
      <Box n="2">Le résultat s’affiche en bas : vous devez lire <b>"ok": true</b> et <b>nights</b> ≥ 1. Ici, la ligne de votre jeton indique « dernier envoi » (rechargez la page).</Box>
      <Box n="3">Automatisation : app Raccourcis › onglet <b>Automatisation</b> › <b>+</b> › <b>Heure de la journée</b> › <b>9:00</b>, Quotidien › choisissez <b>Exécuter immédiatement</b> › Suivant › choisissez <b>Hyrox Sommeil</b>.</Box>
      <Tip><b>Erreur 401</b> : jeton mal collé (pas d’espace avant ou après). <b>Erreur 403</b> : activez « Données de santé » dans Moi › Réglages. <b>Erreur 404 / introuvable</b> : la fonction « health-sync » n’est pas encore créée dans Supabase. <b>nights : 0</b> : pas de nuit enregistrée dans Santé ces dernières 24 h (montre ou mode Sommeil).</Tip>
    </> },
    { t: 'Raccourci « Hyrox Mesures »', c: <>
      <p style={{ marginTop: 0 }}>FC au repos, variabilité cardiaque, poids, pas… Vous pouvez n’en mettre que certaines : commencez par les deux premières.</p>
      <Box n="1">Nouveau raccourci <C t="Hyrox Mesures" />. Pour <b>chaque</b> mesure ci-dessous, répétez le bloc « rechercher → boucle » de l’étape Sommeil (sans la Date de fin), avec la période <b>2 jours</b> et des noms de variables différents :</Box>
      <div className="small" style={{ margin: '4px 0 6px 34px', lineHeight: 1.9 }}>
        <div><b>Fréquence cardiaque au repos</b> → <C t="rhr_dates" /> et <C t="rhr_values" /></div>
        <div><b>Variabilité de la fréquence cardiaque</b> → <C t="hrv_dates" /> et <C t="hrv_values" /></div>
        <div><b>Poids</b> → <C t="weight_dates" /> et <C t="weight_values" /></div>
        <div><b>Nombre de pas</b> → <C t="steps_dates" /> et <C t="steps_values" /></div>
        <div><b>Énergie active</b> → <C t="kcal_dates" /> et <C t="kcal_values" /></div>
        <div><b>VO2 max</b> (période 30 jours) → <C t="vo2_dates" /> et <C t="vo2_values" /></div>
        <div><b>Règles</b> (ou Écoulement menstruel, période 7 jours) → <C t="flow_dates" /> et <C t="flow_values" /></div>
      </div>
      {send(2, <>Pour chaque mesure, un champ <b>Dictionnaire</b> dont la clé est <C t="rhr" />, <C t="hrv" />, <C t="weight" />, <C t="steps" />, <C t="kcal" />, <C t="vo2" /> ou <C t="flow" />, contenant deux champs <b>Texte</b> : <C t="dates" /> = variable …_dates et <C t="values" /> = variable …_values.</>)}
      <Box n="5">Testez avec ▶ (réponse <b>"days"</b> ≥ 1), puis ajoutez ce raccourci à l’automatisation de 9:00 : ouvrez-la et ajoutez l’action <A>Exécuter le raccourci</A> › Hyrox Mesures, sous Hyrox Sommeil.</Box>
      <Tip>Les noms des types peuvent légèrement varier selon la version d’iOS : tapez le début du nom dans la liste (« repos », « variabilité », « pas »…).</Tip>
    </> },
    { t: 'Raccourci « Hyrox FC »', c: <>
      <p style={{ marginTop: 0 }}>Il envoie la fréquence cardiaque de l’Apple Watch après chaque entraînement : l’app la rattache à la séance chronométrée et affiche le détail par atelier.</p>
      <Box n="1">Nouveau raccourci <C t="Hyrox FC" />.</Box>
      <Collect start={2} type="Fréquence cardiaque" period="4 heures" dates="dates" values="values" />
      {send(8, <>Un champ <b>Dictionnaire</b>, clé <C t="heart_rate" />, contenant deux champs <b>Texte</b> : <C t="dates" /> = variable dates et <C t="values" /> = variable values.</>)}
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
