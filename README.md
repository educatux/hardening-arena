# Hardening Arena

**Des quiz de cybersécurité pour durcir ses réflexes de défenseur.** On joue en salle sur son
téléphone ou son PC, on révise au vidéoprojecteur, ou on s'entraîne seul, à son rythme. Après chaque
question : la bonne réponse **et le point de cours** qui va avec.

Né en formation chez BlueTeam Academy, auto-hébergeable, sans compte, sans traceur. Licence MIT.

## Pourquoi ce nom

- **Hardening**, le durcissement : retirer d'un système tout ce qui ne sert pas, le configurer au
  plus strict, le tenir à jour. Les premiers quiz ont servi au diagnostic d'ouverture d'une formation
  « Hardening », dont l'épreuve finale consiste à durcir un serveur piégé.
- **Arena**, l'arène : on s'y mesure en équipe, en direct, avec un podium. L'erreur y est permise,
  parce qu'elle est suivie aussitôt de l'explication.

Une connaissance se durcit comme un système : par la répétition.

## Trois façons de jouer

| Mode | Dossier | Pour qui | Réseau |
|---|---|---|---|
| **En salle, sur téléphone ou PC** : code de partie, points selon la rapidité, classement ; mode **positionnement** avec bilan individuel par module et export CSV | `quiz-buzz/` (Node.js + WebSocket, seule dépendance `ws`) | un formateur et sa salle | serveur |
| **Au vidéoprojecteur** : sans téléphone, les équipes répondent à l'oral | `quiz-app/index.html` | un formateur | aucun (fonctionne hors ligne) |
| **Seul, pour s'entraîner** : correction et point de cours après chaque réponse, bilan par thème, « Refaire mes erreurs » | `quiz-app/entrainement.html` | chacun | aucun |

## Démarrer en local

```bash
cd quiz-buzz
docker compose up -d --build        # ou, sans Docker (Node ≥ 20) : npm ci && npm start
docker compose logs quiz-buzz       # affiche l'adresse de l'écran animateur, avec sa clé
```

Écran animateur sur `http://localhost:8080/`, joueurs sur `http://<IP-de-la-machine>:8080/play`.
Détails : [`quiz-buzz/README.md`](quiz-buzz/README.md).

Le mode vidéoprojecteur et l'entraînement s'ouvrent sans serveur : `quiz-app/index.html` et
`quiz-app/entrainement.html` (garder `quiz-app/` et `commun/` côte à côte).

## Mettre en ligne

`deploiement/` fournit une installation durcie derrière **Caddy** (HTTPS automatique, Basic auth à
deux niveaux, CSP stricte, limitation de débit, journaux aux IP tronquées, mesure d'audience
GoAccess sans traceur), pilotée depuis le poste du formateur par SSH :

```bash
cp deploiement/serveur.local.example deploiement/serveur.local   # votre serveur
deploiement/initialiser.sh --site quiz.exemple.org                # une fois
deploiement/preparer-seance.sh --quiz exemple                     # avant chaque séance
```

Tout est expliqué dans [`deploiement/README.md`](deploiement/README.md). Avant une mise en ligne
publique, complétez `accueil/mentions-legales.html` (champs « À COMPLÉTER »).

## Écrire ses quiz

Une source JSON par quiz dans `questions/` (voir `questions/exemple.json`) :

```json
{
  "titre": "Mon quiz",
  "graine": 1,
  "questions": [
    {
      "theme": "Mots de passe",
      "module": "M1",
      "question": "≤ 120 caractères",
      "bonne": "la bonne réponse, ≤ 75 caractères",
      "pieges": ["trois", "mauvaises", "réponses"],
      "temps": 30,
      "revision": "le point de cours affiché à la révélation"
    }
  ]
}
```

`python3 questions/build.py` valide les sources (longueurs, temps, répartition de la bonne réponse,
mélangée de façon reproductible selon `graine`) et génère `quiz-app/quizzes.js`,
`quiz-buzz/quizzes/<id>.json` et, avec `openpyxl`, un fichier d'import tableur. `module` est
facultatif (bilan par module du mode positionnement).

**Libre service** : seuls les quiz listés dans `questions/publics.txt` sont servis publiquement
sous `/arena/`, **bonnes réponses comprises**. N'y ajoutez un quiz qu'après l'avoir joué en séance ;
les quiz `*-positionnement` y sont refusés.

Quiz fournis : `exemple` (réflexes de base), `dns-1` et `dns-2` (DNS, DNSSEC, messagerie, SSH).

## Sécurité

Pensé pour être exposé sur Internet : les bonnes réponses ne quittent le serveur qu'à la révélation,
clé animateur et jetons comparés à temps constant, tentatives de code de partie limitées (par IP,
par /64 en IPv6 et globalement), plafond de connexions par IP, aucun `innerHTML`, conteneurs en
lecture seule sans capacités. Le code a fait l'objet de deux revues de sécurité avant publication.

Pour signaler une vulnérabilité : voir [`SECURITY.md`](SECURITY.md).

## Tests

```bash
cd quiz-buzz && npm ci && npm test
python3 questions/build.py --check
```

## Licence

MIT — voir [`LICENSE`](LICENSE). Logo et habillage « BlueTeam Academy » dans `commun/` : marque de
l'auteur, à remplacer par les vôtres pour une instance qui n'est pas la sienne.
