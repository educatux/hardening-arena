# Contribuer

Merci de votre intérêt ! Le projet est écrit et documenté en français.

## Avant de proposer une modification

1. Ouvrez une issue qui décrit le besoin ou le défaut (pas pour une faille : voir `SECURITY.md`).
2. Gardez le principe du projet : **aucune dépendance** ajoutée sans raison forte (le serveur n'en a
   qu'une, `ws`), aucun traceur, aucun `innerHTML` avec une donnée variable, tout texte affiché via
   `textContent`.
3. Faites passer les tests :

   ```bash
   cd quiz-buzz && npm ci && npm test
   python3 questions/build.py --check
   ```

## Proposer un quiz

Une source JSON dans `questions/` (format dans le `README.md`), validée par
`python3 questions/build.py --check`. Chaque question porte un **point de cours** (`revision`) : c'est
lui qui fait apprendre. Pas de contenu sous droits d'auteur d'un tiers.

## Style

- Code commenté là où le *pourquoi* n'est pas évident ; commentaires et messages en français.
- Un commit = un changement cohérent, message qui dit ce qui change et pourquoi.
