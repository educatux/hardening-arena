# Hardening Arena — mode « buzz » multi-téléphones

Le mode quiz en direct, auto-hébergé, par BlueTeam Academy : chaque équipe rejoint avec un **code de partie** depuis son téléphone, répond, et le **score se calcule tout seul** (classement en direct, podium). Serveur Node.js + WebSocket, seule dépendance `ws`, aucune donnée envoyée sur Internet. Licence MIT.

## Démarrer

**Docker** (depuis ce dossier ; le build embarque aussi `../commun`) :
```bash
docker compose up -d --build
docker compose logs quiz-buzz      # affiche l'URL animateur avec sa clé
```
Par défaut le port n'est publié que sur `127.0.0.1` : pour que les téléphones de la salle se connectent, remplacez dans `docker-compose.yml` par l'IP de la machine sur le Wi-Fi (`"192.168.x.y:8080:8080"`) ou placez un reverse proxy devant.

**Sans Docker** (Node ≥ 20) :
```bash
npm ci
npm start                          # port 8080 ; PORT=... pour changer
```

## Clé animateur
Créer et piloter une partie exige une **clé animateur** : sinon n'importe quel joueur pourrait lancer sa propre partie et voir les réponses. Fixez-la avec `HOST_KEY` (variable d'environnement ou fichier `.env` à côté de `docker-compose.yml`) ; sans elle, une clé est générée à chaque démarrage et affichée dans les journaux :
```
[ready] Animateur  : http://localhost:8080/#cle=3f9a1c0e7b2d
```
Ouvrez cette URL au vidéoprojecteur : la clé est retirée de la barre d'adresse dès le chargement. Sans clé dans l'URL, la page la demande.

## Comment on joue
1. Écran **animateur** (`/`) au vidéoprojecteur → **choisissez le quiz** (liste des quiz du serveur) et le **mode** (classique par défaut, ou positionnement : voir plus bas), **Créer la partie** → un **code à 6 chiffres** s'affiche.
2. Les équipes vont sur `http://IP:8080/play` (ou `/play?pin=123456`, code pré-rempli — pratique en QR code) et saisissent un **nom d'équipe**.
3. Les noms apparaissent → **Démarrer**. Une équipe qui n'a rien à faire là (code recopié depuis une autre salle, nom déplacé) : **×** à côté de son nom l'exclut avant le départ ; elle ne revient qu'en retapant le code.
4. Chaque question : 4 tuiles (violet ▲, orange ◆, bleu ●, sarcelle ■), minuteur côté serveur. Bonne réponse = **500 à 1000 points** selon la rapidité. Révélation automatique quand tout le monde a répondu ou à la fin du temps, sinon **Révéler** (<kbd>Espace</kbd> / <kbd>Entrée</kbd> / <kbd>→</kbd>) : bonne réponse + **point à réviser** + classement. Puis **Suivant**.
5. Fin : **podium** à l'écran, rang de chaque équipe sur son téléphone. **Terminer la partie** permet d'arrêter avant la dernière question.

Si l'animateur recharge sa page, il retrouve sa partie (60 s de délai) ; au-delà, la partie est fermée.

Si un joueur perd la connexion (téléphone en veille, Wi-Fi qui saute), son téléphone se reconnecte tout seul et le remet à sa place, avec son score et la question en cours ; s'il a fermé l'onglet, il lui suffit de rouvrir `/play` sur le même navigateur. La reprise repose sur un jeton secret remis à l'arrivée (gardé dans le navigateur) : personne d'autre ne peut prendre sa place. Un **nouveau** joueur, lui, ne peut plus entrer une fois la partie commencée.

## Mode positionnement
À la création de la partie, l'animateur choisit le **mode** : **Classique** (par défaut, ci-dessus) ou **Positionnement**, pensé pour un quiz d'ouverture de formation dont chaque question est rattachée à un module (champ `module` de la source, par exemple `L1`…`L6`).
- **Joueurs individuels** (chacun son prénom), **1 point par bonne réponse**, **aucun bonus de vitesse**, compte des bonnes réponses **par module**.
- Pas de classement projeté : à la révélation, l'écran affiche seulement le nombre de bonnes réponses et le module de la question. Un joueur ne voit que **son** résultat (par question, puis à la fin : score, %, détail par module, modules conseillés).
- **Seuils** réglables à la création et sur l'écran de fin : **réussite** à 60 % (par défaut) ; module **à revoir** sous 50 % de bonnes réponses dans ce module.
- **Écran de fin (animateur)** : tableau apprenant / score sur N / % / modules à revoir, résumé de classe (« 12 / 18 à 60 % ou plus : majorité atteinte »), modules les plus ratés. Changer un seuil recalcule le tableau.
- **Export CSV** (bouton « Exporter le bilan ») : séparateur `;`, UTF-8 avec BOM (Excel en français), une ligne par apprenant : `apprenant;score;sur;pourcentage;reussi_60;modules_a_revoir_50;deconnecte;L1_bonnes;L1_total;…`. C'est une donnée d'apprenants : gardez-la hors du dépôt.
- Un apprenant qui perd la connexion en cours de partie reste dans le bilan (marqué « déconnecté ») avec les réponses déjà données ; il ne bloque pas la révélation automatique.

## Sécurité (Wi-Fi de salle de classe)
- Les **bonnes réponses et points de révision ne quittent le serveur qu'à la révélation**, y compris vers l'écran animateur. La liste des quiz envoyée à l'animateur (après la clé) ne contient que identifiant, titre et nombre de questions ; un quiz se désigne par son identifiant (`[a-z0-9-]`), jamais par un chemin.
- Commandes animateur authentifiées : clé animateur pour créer/reprendre une partie, puis **jeton de partie** exigé à chaque commande (y compris l'export CSV), depuis la seule connexion animateur.
- Mode positionnement : le bilan nominatif et le CSV ne partent que vers l'animateur ; chaque joueur ne reçoit que son propre résultat. Le CSV neutralise les noms commençant par `=`, `+`, `-` ou `@` (injection de formule dans le tableur) ; il est produit côté serveur et téléchargé par le navigateur (Blob), sans script inline.
- Entrées validées : code = 6 chiffres, nom nettoyé (caractères invisibles/de contrôle retirés, 28 caractères max, unique), réponse = index entier valide, mode parmi `classique`/`positionnement`, seuils = entiers de 1 à 100. Noms affichés uniquement via `textContent` (pas d'injection HTML).
- Limites : messages WebSocket ≤ 1 Kio, 30 messages / 5 s par connexion, 20 codes erronés / min par IP, 60 équipes par partie (`MAX_PLAYERS`), 10 parties (`MAX_GAMES`), 400 connexions ; vérification de l'en-tête `Origin` ; connexions mortes purgées.
- HTTP : seuls les fichiers de l'application sont servis (liste blanche), avec CSP stricte (aucun script inline), `frame-ancestors 'none'`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`.
- Conteneur : `npm ci`, utilisateur `node`, système de fichiers en lecture seule, `cap_drop: ALL`, `no-new-privileges`, healthcheck sur `/healthz`.

Derrière un reverse proxy, mettez `TRUST_PROXY=1` (limite par IP réelle) et proxifiez le WebSocket ; en HTTPS, le client passe automatiquement en `wss` :
```nginx
location / {
    proxy_pass http://127.0.0.1:8080;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
}
```

## Fichiers
- `server.js` — serveur (statique + WebSocket + logique de jeu et scoring).
- `public/host.html|js` — écran animateur ; `public/play.html|js` — écran joueur ; habillage dans `../commun/`.
- `quizzes/<id>.json` — un fichier par quiz, **générés** par `../questions/build.py` (voir « Modifier les questions » dans [`../README.md`](../README.md)). Tous sont chargés et validés au démarrage (un fichier invalide empêche de démarrer). Autre dossier : variable `QUIZZES_DIR` (en Docker, montez-le en lecture seule, voir `docker-compose.yml`).
- `test/game.test.js` — test de bout en bout : `npm test` (démarre le serveur sur un port aléatoire et joue des parties courtes : mode classique, mode positionnement avec bilan par module et CSV, limites).

## Limites assumées
- Pas de reconnexion d'un joueur en pleine partie (s'il perd le réseau, il ne peut pas revenir avant la partie suivante) : gardez des parties courtes.
- Dimensionné pour une classe, pas pour un service public.
