# Hardening Arena — appli de quiz autonome

Quiz piloté au vidéoprojecteur, par BlueTeam Academy : **sans compte, sans serveur, sans connexion Internet**. Les équipes répondent à l'oral ou sur ardoise, l'animateur attribue les points.

- `index.html` — l'appli.
- `entrainement.html` + `entrainement.js` — **entraînement en solo** : on répond, la correction et le point de cours s'affichent aussitôt ; bilan par module ou par thème, liste des erreurs à refaire, meilleur score gardé dans le navigateur. Réponses remélangées à chaque passage.
- `quizzes.js` — tous les quiz de `../questions/`, **généré** par `../questions/build.py` (voir le README à la racine) ; `quizzes-publics.js` — les seuls quiz de `questions/publics.txt`, servis en libre service.
- `../commun/` — habillage partagé (CSS, formes des tuiles, logo) : **obligatoire**, à garder à côté de `quiz-app/`.

## Utilisation
Ouvrez `index.html` dans un navigateur (double-clic). Tout fonctionne hors-ligne ; les polices Inter / Space Grotesk / JetBrains Mono sont utilisées si elles sont installées, sinon les polices système.

Pour le servir depuis un serveur web (nginx, Apache…), publiez **les deux dossiers** `quiz-app/` et `commun/` côte à côte, par exemple :
```bash
cd hardening/diagnostic
python3 -m http.server 8000      # puis http://localhost:8000/quiz-app/
```

## Déroulé
1. Choisissez le quiz dans la liste (titre lu dans la source ; le dernier choix est mémorisé dans le navigateur).
2. Ajoutez les équipes (ou « Jouer sans équipes » pour la seule correction), puis **Démarrer**.
3. Pour chaque question : le minuteur tourne, les équipes répondent.
4. **Révéler la réponse** : la bonne tuile est entourée, le **point à réviser** s'affiche → moment de révision.
5. Attribuez les points (**+1 / +2 / −1**), puis **Question suivante**.
6. À la fin : podium et classement. Notez les thèmes faibles : ce sont les points à reprendre.

Quiz à modules (champ `module` des questions, par exemple `L1`…`L6`) : le module de chaque question s'affiche à la révélation. L'appli ne compte pas de score individuel : pour un **positionnement** (bilan par apprenant, modules à revoir, export CSV), utilisez `quiz-buzz` en mode positionnement.

Raccourcis : <kbd>Espace</kbd>, <kbd>Entrée</kbd> ou <kbd>→</kbd> = révéler, puis question suivante. Bouton « Thème clair / sombre » en haut à droite (mémorisé dans le navigateur).
