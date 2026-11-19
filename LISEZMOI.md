# Hyrox Coach — mise en ligne (Supabase + Netlify)

Application web (PWA) de préparation Hyrox en solo et en duo.

Fonctionnalités :

- comptes et profil ;
- courses avec compte à rebours ;
- duos avec code d'invitation, plan et stratégie de relais ;
- chrono de séance en direct ;
- cardio, statistiques et comparaison de séances ;
- temps prédits, y compris avec un nouveau partenaire ;
- programme d'entraînement, nutrition, compléments et santé privée (sommeil, poids, prises de sang, cycle, forme) ;
- coach IA (Claude) et signalement de bugs.

Sans configuration, l'application s'ouvre en **mode démo** (données fictives gardées dans le navigateur).

## Contenu

| Dossier / fichier | Rôle |
|---|---|
| `src/` | l'application (React) ; `src/lib/` = calculs (pointage, analyses, prédictions, programme, nutrition, santé, import) |
| `supabase/schema.sql` | base de données et règles d'accès, à exécuter une fois |
| `supabase/functions/coach` | analyse de chaque séance par Claude |
| `supabase/functions/triage` | premier diagnostic d'un signalement de bug par Claude |
| `supabase/functions/health-sync` | réception automatique des données de l'app Santé (sommeil, fréquence cardiaque) envoyées par l'iPhone |
| `supabase/functions/coach-api` | 2e temps du coach : Claude lit les demandes d'analyse approfondie et y répond |
| `outils/coach.mjs` | traitement des demandes d'analyse depuis un terminal ou par Claude |
| `supabase/functions/bugs-api` | accès de service aux signalements (pour que Claude les lise et mette à jour leur suivi) |
| `outils/bugs.mjs` | lecture et suivi des signalements depuis un terminal |
| `tests/` | tests des calculs (`npm test`) |
| `netlify.toml` | configuration Netlify |

## 1. Créer la base Supabase (10 min)

1. Sur supabase.com, cliquez sur **New project**.
   - Choisissez la région **West EU (Paris)** ou **Central EU (Frankfurt)**, car les données de santé doivent rester en Europe.
   - Notez le mot de passe de la base.
2. Ouvrez **SQL Editor › New query**, collez tout le contenu de `supabase/schema.sql`, puis cliquez sur **Run**.
3. Dans **Authentication › Sign In / Providers › Email**, laissez **Confirm email** activé.
4. Les identifiants à reprendre pour Netlify se trouvent dans **Project Settings › API** :
   - **Project URL** ;
   - la clé **anon public**.

## 2. Mettre en ligne sur Netlify (10 min)

> **Pièges fréquents**
> - `VITE_SUPABASE_URL` doit être l'adresse seule (`https://xxxx.supabase.co`), sans `/rest/v1/` à la fin.
> - Après tout ajout ou toute modification de variable, relancez **Deploys › Trigger deploy › Clear cache and deploy site**.
> - Si les variables manquent, l'application affiche un écran de diagnostic qui indique laquelle est absente.

La méthode la plus simple passe par GitHub, ce qui évite d'installer quoi que ce soit sur le Mac.

1. Créez un dépôt **privé** sur GitHub, puis déposez-y le contenu du dossier, sauf `node_modules` et `dist` (glisser-déposer depuis « Add file › Upload files »).
2. Sur Netlify, choisissez **Add new site › Import an existing project › GitHub**, puis sélectionnez le dépôt.
   - Les réglages de build sont lus dans `netlify.toml` : commande `npm run build`, dossier `dist`.
3. Dans **Site configuration › Environment variables**, ajoutez :
   - `VITE_SUPABASE_URL` = la Project URL ;
   - `VITE_SUPABASE_ANON_KEY` = la clé anon public.
4. Cliquez sur **Deploys › Trigger deploy**.
5. De retour dans Supabase, ouvrez **Authentication › URL Configuration** :
   - **Site URL** = l'adresse Netlify, par exemple `https://hyrox-coach.netlify.app` ;
   - **Redirect URLs** : ajoutez cette même adresse suivie de `/**`.
6. Ouvrez l'adresse du site, créez votre compte et confirmez l'e-mail reçu.

Sur iPhone, ouvrez le site dans Safari puis choisissez **Partager › Sur l'écran d'accueil** : l'application s'ouvre alors en plein écran.

## 3. Vous déclarer administrateur

Le rôle d'administrateur donne accès à tous les signalements de bugs. Dans **SQL Editor**, exécutez :

```sql
insert into public.app_admins (user_id) select id from auth.users where email = 'votre@email';
```

## 4. Coach : gratuit par défaut, Claude en option

**Par défaut, le coach est gratuit et intégré.** À la fin de chaque séance, l'application rédige elle-même l'analyse, sans service payant et sans envoyer de données. Elle reprend la même structure que le coach Claude :

- En bref ;
- Ce qui a marché ;
- À travailler, avec des écarts chiffrés et classés par temps à gagner ;
- Prochaine séance ;
- répartition des relais en duo ;
- cardio ;
- pour les séances spécialisées, les prochaines cibles.

Il n'y a **rien à configurer**, ni clé, ni fonction serveur.

**Pour un avis plus fin, toujours sans payer l'API** : le bouton « **Copier pour Claude** » (onglet Coach) copie la séance sous forme de texte, prête à coller dans votre app Claude habituelle (claude.ai ou Claude Cowork). C'est inclus dans votre abonnement Claude, sans clé API.

**Analyse en 2 temps (gratuite)** :

1. **1er temps, tout de suite** : le coach intégré rédige l'analyse dans l'application.
2. **2e temps, à la demande** : le bouton « Demander l'analyse approfondie » (onglet Coach) crée une **demande numérotée**, comme un signalement de bug.
   - L'utilisateur peut poser une question.
   - Il choisit d'inclure ou non son cardio et donne son accord explicite à la transmission.
   - Claude étoffe ensuite l'analyse en s'appuyant sur les données, sur la 1re analyse et sur la question.
   - La réponse s'affiche dans l'onglet Coach avec la mention « 2e temps · analyse approfondie ».

**Traiter les demandes**, sans API payante :

- **À la main (administrateur)** :
  1. Ouvrez Moi › Analyses approfondies › « Copier pour Claude ».
  2. Collez le texte dans votre app Claude (claude.ai ou Cowork).
  3. Collez la réponse dans la fiche de la demande, puis cliquez sur « Déposer l'analyse ».
- **Par Claude directement (Cowork)** :
  1. Déployez la fonction `coach-api` (sans vérification JWT), avec le même secret `BUG_API_KEY` que pour les signalements.
  2. Claude lit les demandes en attente, y répond et les passe en « traitée ». Script : `outils/coach.mjs`.
  3. Une tâche planifiée dans Cowork peut le faire automatiquement chaque jour.
  4. L'accès se coupe depuis Moi › Signalements, comme pour les bugs.

**Option payante** : le coach Claude automatique dans l'application. L'API Anthropic est facturée à l'usage, environ un centime par analyse. Pour l'activer, ajoutez dans Netlify la variable `VITE_COACH_MODE=claude`, redéployez, puis suivez les étapes ci-dessous. Le diagnostic automatique des bugs par Claude n'existe que dans ce mode. Sans lui, les signalements fonctionnent normalement et s'exportent pour Claude.

### Activer le coach Claude (option payante)

1. Créez une clé API sur console.anthropic.com (**API Keys**) et ajoutez quelques euros de crédit. Une analyse coûte environ 1 centime.
2. Dans Supabase, ouvrez **Edge Functions › Secrets** et ajoutez :
   - `ANTHROPIC_API_KEY` = votre clé ;
   - `ANTHROPIC_MODEL` (facultatif) = le modèle Claude à utiliser. Par défaut, c'est `claude-sonnet-4-5`.
3. Créez les fonctions dans **Edge Functions › Deploy a new function › Via Editor**. Pour chacune, utilisez **exactement** le nom indiqué, collez le contenu du fichier correspondant, puis cliquez sur **Deploy** :
   - fonction `coach` : fichier `supabase/functions/coach/index.ts` ;
   - fonction `triage` : fichier `supabase/functions/triage/index.ts` ;
   - fonction `bugs-api` : fichier `supabase/functions/bugs-api/index.ts`. **Pour celle-ci uniquement**, désactivez **Verify JWT** dans ses réglages, car elle a sa propre clé.

   Si vous avez la ligne de commande Supabase, vous pouvez faire la même chose avec `supabase functions deploy coach triage` puis `supabase functions deploy bugs-api --no-verify-jwt`.
4. Dans l'application, activez **Moi › Réglages › Coach IA**. Chaque membre donne son propre accord.

À la fin d'une séance, l'application envoie à Claude :

- les temps ;
- les relais ;
- la fréquence cardiaque, si l'athlète a donné son accord.

Les conseils s'affichent dans l'onglet **Coach** de la séance. Le bouton « Conseil du coach sur cet atelier », dans **Stats**, analyse un atelier précis. Le journal santé (poids, prises de sang, cycle) n'est **jamais** envoyé. Chaque utilisateur est limité à 20 analyses par jour.

## 5. Signalements de bugs : suivi avec Claude

Le système fonctionne comme celui de l'application Quiz CI BSPP :

- **Envoi** : chaque écran a un bouton 🐞 en haut à droite.
  - Au clic, l'application prend une capture de l'écran, puis ouvre le formulaire.
  - Elle joint automatiquement le contexte : écran, version, appareil, réseau, dernières erreurs JavaScript et 15 dernières actions.
  - Chaque signalement reçoit un numéro (« Signalement n°12 »). La limite est de 30 signalements par jour et par personne.
- **Premier diagnostic** : la fonction `triage` fait analyser le signalement par Claude (résumé, cause probable, piste de correction).
- **Suivi** : ouvrez **Moi › Signalements**.
  - Filtres À traiter / Nouveaux / En cours / Résolus / Tous, et recherche.
  - Fiche détaillée : capture, contexte, statut, note de suivi.
  - Export CSV ou JSON avec captures.
  - Bouton pour **couper ou rétablir l'accès API de Claude**.
- **Accès de Claude** :
  1. Dans **Edge Functions › Secrets**, ajoutez `BUG_API_KEY`, une longue chaîne aléatoire d'au moins 32 caractères. Ne la publiez jamais et ne l'envoyez pas sur GitHub.
  2. Claude peut alors lister les signalements (sans adresse e-mail), lire les captures, puis mettre à jour le statut et la note.

Utilisation depuis un terminal, avec Node 18 ou plus récent :

```bash
export HYROX_URL=https://xxxx.supabase.co BUG_API_KEY=...
node outils/bugs.mjs            # à traiter
node outils/bugs.mjs 12         # détail + capture bug-12.jpg
node outils/bugs.mjs 12 done "Corrigé dans la version 1.0.1"
```

Pour une correction avec Claude (Cowork) :

1. Donnez-lui l'adresse Supabase et la clé, ou l'export JSON de l'écran **Signalements**, ainsi que le dossier du code.
2. Claude lit les signalements, corrige le code, met à jour la note de suivi, puis vous redéployez en renvoyant les fichiers sur GitHub.

## 6. Lancer un entraînement et confier le pointage

**S'entraîner** : dans Séances, choisissez d'abord **Solo** ou **Duo**. En duo, choisissez aussi votre duo.

**Qui enregistre les temps ?** Trois possibilités :

- **vous-même** ou votre partenaire de duo ;
- **une personne connue**, c'est-à-dire un membre de l'un de vos duos, actuel ou ancien ;
- **quelqu'un d'autre** : donnez-lui le **code de pointage** affiché en haut de l'écran Chrono (bouton « Envoyer le code »). Il ouvre l'application avec son propre compte, puis **Séances › Pointer un athlète**, et saisit le code.

**Ce que peut faire la personne qui pointe :**

- utiliser le Chrono et voir les Temps ;
- corriger les temps et la note.

Elle ne voit ni le cardio, ni les statistiques, ni le coach, ni les données de santé. La base de données l'empêche aussi de changer l'équipe ou les athlètes de la séance.

**Pendant la séance** : les athlètes voient les temps arriver en direct et peuvent pointer en même temps. Le pointage se change à tout moment depuis la ligne « Pointage » de l'écran Chrono.

Si votre base a été créée avec une version précédente du script, exécutez de nouveau `supabase/schema.sql` : il ajoute les nouvelles colonnes sans rien effacer.

## 7. Suivi du sommeil

**Où** : Moi › Santé › Sommeil, ou la ligne « Sommeil » de l'accueil.

**Saisie** : chaque nuit, on note l'heure du coucher et du lever. On peut ajouter, si on le souhaite, le temps éveillé, les réveils, la sieste et la qualité ressentie.

**Import** : l'export de l'app Santé de l'iPhone (export.zip) reprend les 120 dernières nuits :

- durée, phases (sommeil profond, paradoxal) et heures de coucher et de lever ;
- l'iPhone et la montre enregistrent souvent la même nuit : les doublons ne sont comptés qu'une fois.

**Ce que l'app calcule** :

- moyenne sur 7 et 30 nuits ;
- dette par rapport à votre objectif (7 h 30 à 9 h) ;
- régularité de l'heure de coucher ;
- nuits de moins de 7 h.

Des conseils accompagnent ces chiffres, avec des repères spécifiques la semaine de la course.

**Programme** : sous 7 h de moyenne, le programme le signale. Sous 6 h, il passe en semaine allégée.

**Confidentialité** : le sommeil fait partie du journal santé privé, il n'est jamais envoyé au coach IA.

## 8. Synchronisation automatique avec l'app Santé (iPhone)

Une application web ne peut pas lire l'app Santé : Apple réserve cet accès aux applications installées. C'est donc l'iPhone qui **envoie** les données, sans intervention :

- **Chaque matin** : les nuits (durée, phases, coucher, lever). Elles alimentent l'onglet Sommeil. Une saisie manuelle n'est jamais écrasée.
- **À la fin de chaque entraînement Apple Watch** : la fréquence cardiaque.
  - Elle est stockée dans votre espace privé.
  - Elle est **rattachée automatiquement** à la séance chronométrée dans l'app, si vous en êtes l'athlète.
  - L'onglet Cardio affiche alors le **détail par exercice** : courbe zoomée avec les relais, moyenne, max et min, FC à l'entrée et à la sortie, zones, et pour chaque relais la FC à l'effort, la FC au repos et la récupération à 30 s.
  - Un fichier importé à la main garde la priorité.

### Mise en place

1. **Base de données** : relancez `supabase/schema.sql`. Il crée les tables `health_tokens` et `hr_samples`.
2. **Fonction serveur** : dans Edge Functions, créez la fonction `health-sync`.
   - Elle comporte **deux fichiers** : `index.ts` et `logic.ts` (bouton « Add file » dans l'éditeur).
   - Désactivez **Verify JWT** : un jeton personnel remplace la session.
   - Avec la ligne de commande, la commande équivalente est `supabase functions deploy health-sync --no-verify-jwt`.
   - Facultatif : si votre fuseau horaire n'est pas l'heure de Paris, ajoutez le secret `DEFAULT_TZ` (par défaut `Europe/Paris`).
3. **Jeton personnel** : dans l'app, ouvrez **Moi › Réglages › Synchronisation Santé**.
   - Créez un jeton, copiez-le (il n'est affiché qu'une fois), puis vérifiez avec **Tester la connexion**.
   - Le jeton se révoque depuis le même écran.
4. **Côté iPhone**, deux possibilités, détaillées pas à pas dans cet écran :
   - **Raccourcis** (gratuit). Créez deux raccourcis :
     - « Hyrox FC » : il recherche les échantillons de fréquence cardiaque des 4 dernières heures et les envoie en POST.
     - « Hyrox Sommeil » : il recherche les échantillons d'analyse du sommeil des 24 dernières heures et les envoie de la même façon.
     - Ajoutez ensuite deux automatisations : « Apple Watch – Entraînement se termine » et « Heure de la journée 9:00 », en mode **Exécuter immédiatement**.
   - **Health Auto Export – JSON+CSV** (abonnement Premium) : créez une automatisation REST API vers l'adresse affichée, avec l'en-tête `x-sync-token`, et cochez Heart Rate et Sleep Analysis. C'est plus simple et plus fiable pour de gros volumes.

Chaque membre du duo fait cette mise en place sur son propre iPhone. Chacun ne voit le cardio de l'autre que sur les séances communes.

## 9. Cycle menstruel : entraînements adaptés et résultats pondérés

**Où** : Moi › Santé › Cycle. Cet onglet, les adaptations du programme et la pondération n’apparaissent **que si « Femme » est sélectionné dans le profil** (et les données de santé acceptées). Si le sexe du profil change, les données déjà saisies sont conservées mais masquées et ne sont plus utilisées.

**Déclarer les règles** : on indique la date de début et la date de fin des règles. La fin peut être ajoutée plus tard avec le bouton « Mes règles se terminent aujourd'hui ».

**Phases calculées** à partir des durées réelles de vos cycles et de vos règles :

| Phase | Période |
|---|---|
| Menstruelle | pendant les règles |
| Folliculaire | après les règles |
| Ovulatoire | durée du cycle − 14 jours, ± 1 jour |
| Lutéale | entre l'ovulation et les 5 derniers jours |
| Prémenstruelle | les 5 derniers jours |

Un calendrier coloré montre les 4 prochaines semaines.

**Programme adapté jour par jour** : chaque jour porte une pastille avec sa phase.

| Phase | Adaptation du programme |
|---|---|
| Règles, J1–J2 ou avec symptômes | Les séances intenses passent en endurance facile, avec la possibilité de garder la séance prévue si vous vous sentez bien. |
| Folliculaire | Fenêtre favorable : charges plus lourdes, et l'endurance facile peut devenir une séance au seuil. |
| Ovulatoire | Échauffement soigné et prudence sur les sauts. |
| Lutéale | Hydratation et glucides en plus. |
| Prémenstruelle | Les séances intenses sont remplacées et le volume de force est réduit. |

**Résultats pondérés** : chaque séance est rattachée à sa phase.

- L'écran Cycle compare vos écarts à l'objectif selon la phase.
- L'effet estimé de chaque phase part de valeurs prudentes issues des études : les effets sont en moyenne faibles et varient beaucoup d'une femme à l'autre. Il s'ajuste ensuite à vos propres séances.
- Dans les stats d'une séance, un « temps ajusté au cycle » s'affiche. Il n'est visible que par vous.
- Dans les prédictions de temps du duo, les séances en phase défavorable comptent moins.

**Limites** : sous contraception hormonale, les phases calculées ne reflètent pas le cycle naturel. Tout cela reste une estimation, pas un diagnostic.

## 10. Coach alimentation : régime déclaré et recommandations

**Où** : Moi › Coach nutrition › Mon alimentation.

**Déclarer son alimentation** :

- Choisissez le régime : omnivore, flexitarien, pescétarien, végétarien ou végétalien.
- Indiquez vos portions habituelles pour 20 familles d'aliments, par jour ou par semaine selon la famille.
- Ajoutez les compléments que vous prenez.

**Apports estimés par jour**, comparés à vos besoins selon le type de journée (repos, entraînement, séance intense, veille de course) : énergie, protéines, glucides, lipides, fibres, fer, calcium, magnésium, oméga-3, vitamine B12 et vitamine D. Les valeurs sont des moyennes par portion : c'est un ordre de grandeur.

**Recommandations**, adaptées au régime déclaré :

- **Remplacer** : boissons sucrées, produits sucrés, charcuterie, plats préparés, alcool, féculents raffinés.
- **Ajouter** : protéines, glucides, fibres, fer, calcium, oméga-3, magnésium, avec des sources compatibles avec le régime (par exemple de l'huile d'algue pour les végétaliens).
- **Compléments** : B12 indispensable pour un régime végétalien, vitamine D et fer uniquement après dosage, créatine en option.

Ces conseils sont des repères généraux. Pour un suivi personnalisé, voyez un(e) diététicien(ne) du sport.

## 11. Séances spécialisées (exercices au choix)

**Où** : Séances › **Spécialisée**. L'écran Nouvelle séance propose aussi un lien direct.

**Composer la séance** avec n'importe quel exercice :

| Catégorie | Exercices |
|---|---|
| Ateliers Hyrox | SkiErg, Sled Push, Sled Pull, Burpees Broad Jump, Rameur, Farmers Carry, Fentes, Wall Balls |
| Course | Course |
| Cardio | Vélo / air bike, corde à sauter |
| Musculation | Squat, développé couché, soulevé de terre, développé militaire, rowing, front squat, hip thrust, fentes haltères, kettlebell swing, thruster |
| Poids du corps | Tractions, pompes, burpees, box jumps, gainage |
| Libre | Exercice nommé à la main |

**Objectifs** : pour chaque exercice, renseignez ceux qui vous servent : temps, distance (m), répétitions, charge (kg). Ajoutez le nombre de séries, la récupération et une consigne. En duo, indiquez qui le fait (A, B ou les deux).

**Modèles** : une séance s'enregistre comme modèle pour être rechargée plus tard.

**Faire la séance**, de deux façons :

- **Chrono** : un bouton Démarrer / Terminé par étape, le compte à rebours de récupération, puis la saisie du réalisé (distance, répétitions, charge) et de l'effort ressenti de 1 à 10. Le pointage peut être confié à une autre personne, comme pour une séance Hyrox.
- **Saisir après coup** : pour une séance faite sans le téléphone.

**Données de santé** : le cardio arrive par la synchro Santé, le bouton « Depuis Santé » ou l'import d'un fichier, exactement comme pour une séance Hyrox.

**Analyse** :

- pourcentage de l'objectif atteint par étape ;
- allure (/km, /500 m) ou cadence (répétitions par minute) ;
- FC moyenne et maximale par étape, zones ;
- dépense en kcal, calculée d'après la FC (formule de Keytel), ou estimée sans cardio ;
- **objectifs proposés pour la prochaine fois** : +5 % de charge, −3 % de temps, +10 % de répétitions… selon le réalisé, l'effort ressenti et la FC ;
- **1RM estimé** pour la force (formule d'Epley).

**Ce que ces séances alimentent** :

- **Temps prédits** : les ateliers et la course réalisés sont convertis en temps « atelier complet ». Ils comptent à 70 %, car ils sont faits à frais, hors enchaînement.
- **Programme** :
  - ateliers manqués ajoutés aux points faibles ;
  - charges de force calculées sur vos 1RM estimés ;
  - charge d'entraînement des 7 derniers jours comparée à celle des 4 dernières semaines, avec une semaine allégée au-delà de 1,5 fois la moyenne ;
  - liste de vos prochaines cibles, avec un bouton pour créer directement la séance correspondante.
- **Nutrition** : la dépense des séances du jour choisit automatiquement le type de journée et ajuste l'énergie (métabolisme de base × 1,35 + séances).
- **Coach IA** : analyse automatique à la fin de la séance, à partir des objectifs, du réalisé et de la FC par exercice.

## 12. Reprendre les données de « Chrono Hyrox Duo »

1. Créez d'abord le duo, par exemple « Pierre & Laurent », dans l'onglet Équipe.
2. Ouvrez **Moi › Importer**, puis choisissez la sauvegarde `.json` de l'artefact ou l'export de l'application iPhone.

- Indiquez qui vous êtes dans le fichier (P ou L) et le duo de destination.
- Les séances, le cardio, la stratégie de relais et vos zones cardio sont repris.
- Si votre partenaire n'a pas encore de compte, indiquez son prénom.
  - Ses temps et son cardio sont gardés dans les séances.
  - Ils lui sont **attribués automatiquement** quand il rejoint le duo avec le code d'invitation.
- Un nouvel import ne crée pas de doublon.

## Données et confidentialité

- **Règles d'accès** : elles sont appliquées par la base de données elle-même (RLS).
  - Le journal santé n'est visible que par son propriétaire, ce qui exclut le partenaire et l'administrateur.
  - Les séances, le cardio et le plan d'un duo sont visibles par ses deux membres.
- **Changement de partenaire** : il faut créer un **nouveau duo**.
  - Le nouveau partenaire ne voit jamais les séances de l'ancien.
  - Vos anciennes séances restent dans vos statistiques et servent à estimer les temps du nouveau duo : temps de l'ancien partenaire pondérés par le sexe, l'âge et le poids, plus un réglage manuel.
- **Accords** : chacun doit donner son accord explicite pour les données de santé et pour le coach IA. L'un comme l'autre se retire dans les réglages.
- **Conseils** : la nutrition, les compléments et les repères sanguins sont des informations générales, pas un avis médical.

## Développement local (facultatif)

Nécessite Node 18 ou plus récent :

```bash
npm install
cp .env.example .env    # renseignez les deux variables, ou laissez vide pour le mode démo
npm run dev
npm test
```
