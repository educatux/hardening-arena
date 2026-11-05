# Déploiement des quiz sur un serveur exposé à Internet

Hardening Arena (`quiz-buzz/`, mode buzz multi-téléphones) et sa version statique
(`quiz-app/`, sous `/arena/`) derrière **Caddy** : HTTPS Let's Encrypt automatique,
**authentification HTTP Basic (401)** à deux niveaux, mot de passe de **séance** renouvelé
avant chaque séance.

| Qui | URL | Identifiants |
|---|---|---|
| Tout le monde | `https://<site>/` | aucun : page d'accueil publique (présentation, mentions légales) |
| Formateur (vidéoprojecteur) | `https://<site>/animateur` | `formateur` + mot de passe formateur, puis clé animateur dans la page |
| Joueurs (téléphones) | `https://<site>/play` | `classe` + mot de passe de séance, puis code de partie à 6 chiffres |
| Version statique (entraînement seul, mode équipes) | `https://<site>/arena/` | aucun : **libre service**, seulement les quiz de `questions/publics.txt` |
| Formateur (audience) | `https://<site>/stats/` | `formateur` : rapport GoAccess (voir « Mesure d'audience ») |

Un quiz de `questions/publics.txt` est public **réponses comprises** : ne l'y ajouter qu'après
l'avoir joué en séance, jamais un quiz de positionnement. Le serveur ne reçoit jamais le registre
complet `quiz-app/quizzes.js` (remplacé par `quizzes-publics.js` au déploiement).

## Fichiers

| Fichier | Rôle |
|---|---|
| `compose.yaml` | Service Node (repris de `../quiz-buzz/docker-compose.yml`) + Caddy + GoAccess (profil `stats`, à la demande) |
| `stats.sh` | Rapport d'audience maintenant, ou timer systemd nocturne sur le serveur |
| `caddy/Dockerfile` | Caddy + module `caddy-ratelimit`, images épinglées par digest |
| `caddy/conf/Caddyfile` | Routage, Basic auth, CSP de `/arena/` — **aucun secret**, des `{$VAR}` |
| `initialiser.sh` | Mise en place unique du serveur, renouvellement des secrets du formateur |
| `preparer-seance.sh` | Avant chaque séance : build des quiz, synchro, relance, mot de passe de séance, QR code |
| `fin-seance.sh` | Après la séance : mot de passe invalidé (401), CSV archivés hors du dépôt |
| `outils/` | Fonctions communes, génération de mots de passe, écriture du `.env`, hachés CSP |

## Architecture et sécurité

```
Internet ──443/80──▶ Caddy ──réseau Docker « internal »──▶ quiz-buzz:8080 (Node)
                     │ TLS, Basic auth, limitation de débit, /arena/ en statique
```

- **Le service Node n'est publié sur aucun port.** C'est plus strict que le
  `127.0.0.1:8080` de `quiz-buzz/docker-compose.yml`. Il partage avec Caddy seul un
  réseau Docker `internal` : 8080 n'est joignable ni depuis Internet ni depuis le réseau
  local, et le conteneur ne peut lui-même rien joindre à l'extérieur. Le reste de sa
  définition est repris tel quel (`extends`) : lecture seule, `cap_drop: ALL`,
  `no-new-privileges`, limites mémoire et processus, healthcheck.
- La sécurité de `server.js` est conservée sans modification :
  - clé animateur `HOST_KEY` et jeton par partie ;
  - réponses envoyées seulement à la révélation ;
  - limites de taille et de débit ;
  - contrôle d'`Origin` ;
  - CSP sans script inline, fichiers sur liste blanche.

  `TRUST_PROXY=1` est activé : la limite par IP voit l'adresse réelle du client. Caddy
  réécrit `X-Forwarded-For`, un client ne peut donc pas l'usurper.
- **Mots de passe stockés hachés** (bcrypt, `caddy hash-password`) dans `.env` sur le
  serveur (600, root). Les clairs ne sont écrits nulle part :
  - ils passent par **stdin** (jamais en argument : rien dans `ps` ni dans l'historique) ;
  - ils sont affichés une seule fois au formateur.
- **Limitation des tentatives** : 600 requêtes/min par IP, au-delà 429. Une salle entière
  derrière la même IP d'école passe (≈ 10 requêtes par téléphone au chargement, doublées
  par l'aller-retour 401). Une attaque en ligne est plafonnée, et chaque essai coûte un
  calcul bcrypt.

  fail2ban n'a pas été retenu : sur un conteneur LXC non privilégié, il ne peut pas
  poser de règle de pare-feu.
- **`/healthz`** n'est jamais servi à l'extérieur (403). La supervision se fait sur
  l'hôte, via le HEALTHCHECK de l'image :
  ```bash
  sudo docker compose ps quiz-buzz --format '{{.Health}}'   # healthy
  ```
- **En-têtes** :
  - **HSTS** sur tout le site ;
  - sur les pages Node : la CSP du serveur Node, plus `nosniff`, `Referrer-Policy` et
    `frame-ancestors 'none'` ;
  - sur `/arena/` : une CSP posée par Caddy. Le `<script>` inline et l'unique attribut
    `style` de `quiz-app/index.html` y sont autorisés **par leur hash sha256** (recalculé
    par `preparer-seance.sh`), pas par `'unsafe-inline'`.

### Pourquoi le WebSocket n'est pas derrière la Basic auth

L'authentification s'applique au **chargement des pages et des ressources**. La poignée de
main WebSocket en est **exemptée**, pour deux raisons :

1. **Un seul point d'entrée.** L'animateur et les joueurs ouvrent tous deux leur WebSocket
   sur `/` (`new WebSocket(proto + "://" + location.host)` dans `host.js` et `play.js`).
   Une Basic auth par chemin ne peut pas distinguer les deux rôles. Mettre `/` dans le
   realm animateur bloquerait tous les joueurs.
2. **Navigateurs.** Safari (iOS) n'envoie pas de manière fiable les identifiants Basic
   déjà saisis lors de la poignée de main WebSocket. Le jeu serait inutilisable sur
   iPhone.

Le WebSocket n'est **pas** derrière la Basic auth : le mot de passe de séance protège la page
`/play`, pas la partie. Les vraies barrières sont :
- la **clé animateur** et le jeton de partie, pour créer ou piloter une partie (comparaison
  à temps constant, tentatives de clé comptées comme les erreurs de code) ;
- le **code de partie** à 6 chiffres : 20 erreurs/min par IP (IPv6 : par /64) **et** 300/min
  tous clients confondus, contre la rotation d'adresses ;
- au plus 80 connexions simultanées par IP (une classe derrière un NAT d'école) et 400 en tout ;
- le **contrôle de l'en-tête `Origin`**, qui n'empêche qu'un **navigateur** d'ouvrir le
  WebSocket depuis un autre site (un client hors navigateur l'omet) ;
- la **limitation de débit** de Caddy, et le marqueur `X-Arena-Ws` : Node refuse toute requête
  HTTP ordinaire qui le porte (un faux « upgrade » ne sert donc aucune page protégée).

Un client hors navigateur qui contournerait la page n'obtient rien de plus qu'un joueur :
il lui faut encore le code de partie.

### Derrière un reverse proxy existant (`MODE_EXPOSITION=amont`)

Si les ports 80/443 de l'adresse publique arrivent déjà sur un autre reverse proxy (un
autre service est exposé sur la même IP), ce dernier devient la porte d'entrée :
```
Internet ──443──▶ proxy existant (TLS public Let's Encrypt) ──HTTPS interne──▶ Caddy du quiz ──▶ Node
```
- Dans le `.env` du quiz :
  ```
  MODE_EXPOSITION='amont'
  AMONT_IP='<IP du proxy existant>'
  ```
  Le Caddy du quiz présente alors un certificat de **son AC interne** et **coupe toute
  connexion qui ne vient pas de `AMONT_IP`**. Il fait confiance au `X-Forwarded-For` de
  l'amont (`trusted_proxies`) : la limite de débit et `TRUST_PROXY` voient l'IP réelle du
  client.
- Sur le proxy existant (exemple Caddy), le certificat racine de l'AC interne du quiz est
  **épinglé**. On le récupère avec :
  ```bash
  sudo docker compose exec caddy cat /data/caddy/pki/authorities/local/root.crt
  ```
  Puis on le convertit en DER base64 (`openssl x509 -outform DER | base64`) :
  ```
  quiz.exemple.org {
      reverse_proxy https://<IP du serveur du quiz> {
          header_up Host {host}          # indispensable : sinon Host = IP de l'amont
          transport http {
              tls_server_name quiz.exemple.org
              tls_trust_pool inline {
                  trust_der <racine AC interne, DER base64>
              }
          }
      }
  }
  ```
  `header_up Host {host}` est **indispensable**. Pour un amont HTTPS, Caddy remplace sinon
  `Host` par l'adresse de l'amont. Le Caddy du quiz ne reconnaît alors plus son site et
  répond 200 avec un corps vide. Le contrôle d'`Origin` du WebSocket échoue lui aussi.
- Le proxy existant doit réécrire `X-Forwarded-For` avec l'IP du client, et ne pas
  relayer celui du client : c'est le comportement par défaut de Caddy.
- Les scripts de séance s'adaptent : leur auto-contrôle 401/200 passe par l'amont.

## Installation pas à pas (une seule fois)

Prérequis sur le **serveur** :
- Debian/Ubuntu, accès SSH par clé, utilisateur non root avec `sudo` ;
- Docker et **Docker Compose v2** (`docker compose`, pas `docker-compose` v1) ;
- `rsync`, `python3`, `curl` ;
- ports **80 et 443** ouverts vers le serveur. Le 80 sert à la redirection HTTPS et au
  challenge Let's Encrypt.

Prérequis sur le **poste du formateur** : `bash`, `python3`, `rsync`, `ssh`, `openssl`,
et `qrencode` (facultatif, pour le QR code).

1. **DNS** : enregistrement A (ou CNAME) de `<site>` vers l'IP publique du serveur, sans
   AAAA si le serveur n'a pas d'IPv6. Caddy obtient le certificat tout seul dès que le
   nom pointe sur le serveur et que le port 80 est joignable.
2. **Cible SSH** : copier `serveur.local.example` en `serveur.local` (non commité), et y
   renseigner `QUIZ_SERVEUR` (un alias `~/.ssh/config` est conseillé) et `QUIZ_DOSSIER`.
3. **Initialiser**, depuis `hardening/diagnostic/` :
   ```bash
   deploiement/initialiser.sh --site quiz.blueteam-academy.org
   ```
   Le script crée le `.env` sur le serveur (600, root), puis affiche **une seule fois** le
   mot de passe formateur et la clé animateur. **Les ranger aussitôt dans le coffre de mots
   de passe.**
4. **Première mise en ligne** :
   ```bash
   deploiement/preparer-seance.sh
   ```

Renouveler un secret du formateur, par exemple après une fuite :
```bash
deploiement/initialiser.sh --nouveau-formateur   # mot de passe formateur
deploiement/initialiser.sh --nouvelle-cle        # clé animateur (relance le service : parties fermées)
```

## Procédure de séance

**Avant** (quelques minutes, depuis un réseau qui joint le serveur en SSH) :
```bash
cd hardening/diagnostic
deploiement/preparer-seance.sh --quiz t1-j1            # --quiz répétable : vérifie la présence
```
Le script :
1. régénère et vérifie les quiz (`questions/build.py --check`, puis build) ;
2. synchronise le serveur ;
3. reconstruit et relance les conteneurs, et attend `/healthz` ;
4. tire un **nouveau mot de passe de séance**, vérifie 401 sans identifiants et 200 avec ;
5. affiche l'URL joueur, `classe` et le mot de passe, avec un **QR code** de l'URL à
   projeter. Le QR code ne contient **jamais** les identifiants : ils se dictent ou se
   projettent à part.

Le mot de passe de la séance précédente cesse de fonctionner immédiatement.

**Pendant** : ouvrir `https://<site>/animateur` au vidéoprojecteur, avec le compte `formateur`. La
page demande ensuite la clé animateur. On peut aussi ouvrir `https://<site>/animateur#cle=<clé>` :
la clé est retirée de la barre d'adresse au chargement.

**Après** :
```bash
deploiement/fin-seance.sh                # --csv-dir pour un autre dossier de téléchargement
```
- Les joueurs reçoivent 401.
- Les bilans `positionnement-*.csv` sont **déplacés** de `~/Downloads` vers
  `~/Documents/BlueTeamAcademy/bilans/<date>/` (droits 600). Ce sont des données
  d'apprenants : jamais dans le dépôt.

## Exploitation

### Mesure d'audience (GoAccess, sans traceur)

Caddy écrit son journal d'accès dans le volume `caddy-logs`, **IP masquées dès l'écriture**
(/24 en IPv4, /48 en IPv6), sans `Authorization`, `Cookie` ni `X-Forwarded-For`, rotation
13 mois au plus. GoAccess (image épinglée par digest, sans réseau, lecture seule) en tire un
rapport HTML statique servi sous `/stats/` (compte formateur ; CSP `'unsafe-inline'` sur cette
seule route, le rapport étant autonome). Aucun script de mesure dans les pages publiques.

```bash
deploiement/stats.sh                        # rapport maintenant
deploiement/stats.sh --installer-minuterie  # chaque nuit à 03:30 (timer systemd sur le serveur)
```

- **Journaux** :
  ```bash
  sudo docker compose logs -f caddy       # accès, 401, ACME
  sudo docker compose logs quiz-buzz      # parties
  ```
  Rotation : 10 Mo x 5 fichiers par service.
- **Sauvegarde** : le seul état côté serveur est le `.env` et le volume `caddy-data`
  (certificats, réobtenus automatiquement s'il est perdu). Tout le reste se redéploie
  depuis le dépôt avec `preparer-seance.sh`.
- **Mises à jour** :
  - *Quiz et application* : `preparer-seance.sh` (build de l'image : `npm ci`, image
    `node:22-alpine`, version majeure épinglée).
  - *Caddy et module* : relever les nouveaux digests et le commit dans
    `caddy/Dockerfile`, puis `preparer-seance.sh`.
  - *Image Node* : `sudo docker compose build --pull quiz-buzz`, ou suppression de
    l'image locale, puis `preparer-seance.sh`.

## Dépannage

| Symptôme | Piste |
|---|---|
| `preparer-seance.sh` : « HTTPS pas encore disponible » | Pas de certificat : vérifier `dig +short <site>`, le port 80 ouvert, puis `docker compose logs caddy \| grep -i acme` |
| 401 en boucle sur `/play` | Mauvais mot de passe de séance, ou séance close par `fin-seance.sh` : relancer `preparer-seance.sh` |
| 429 | Limite de débit atteinte (600/min/IP) : attendre une minute ; si une salle entière la touche, relever `events` dans le Caddyfile |
| La page s'affiche mais « connexion perdue » | WebSocket bloqué : un proxy de l'école coupe peut-être les WebSocket ; tester en 4G |
| `/arena/` sans mise en forme ou sans script | Hachés CSP périmés : relancer `preparer-seance.sh` (il les recalcule depuis `quiz-app/index.html`) |
| `unhealthy` | `docker compose logs quiz-buzz` : un quiz JSON invalide empêche le démarrage (régénérer avec `build.py`) |
