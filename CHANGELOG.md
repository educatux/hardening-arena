# Journal des versions

Format : [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/), versions [SemVer](https://semver.org/lang/fr/).

## [1.0.0] — 2026-11

Première publication.

### Ajouté
- **Quiz en salle** (`quiz-buzz/`) : code de partie, réponses sur téléphone ou PC, points selon la
  rapidité, classement et podium ; mode **positionnement** (bilan individuel par module, seuils
  réglables, export CSV) ; reprise automatique d'un joueur après une coupure ; exclusion d'un joueur
  depuis la salle d'attente ; compte à rebours sur l'écran des joueurs.
- **Mode vidéoprojecteur** et **entraînement en solo** (`quiz-app/`), sans serveur ni réseau.
- **Page d'accueil** et modèle de mentions légales (`accueil/`).
- **Déploiement durci** (`deploiement/`) : Caddy, Basic auth à deux niveaux, libre service limité aux
  quiz de `questions/publics.txt`, CSP stricte, limitation de débit, journaux aux IP tronquées,
  mesure d'audience GoAccess sans traceur.
- Quiz fournis : `exemple`, `dns-1`, `dns-2`.

### Sécurité
- Deux revues de sécurité avant publication (Claude, puis Kimi K3 en second avis) ; tous les
  constats corrigés ou documentés.
