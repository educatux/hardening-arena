#!/usr/bin/env bash
# Pré-héberge les quiz avant une séance, en une commande depuis le poste du formateur.
#
#   deploiement/preparer-seance.sh [--quiz t1-j1]... [--serveur user@hote] [--dossier /opt/academy]
#
# 1. régénère les quiz (questions/build.py --check, puis build) ;
# 2. synchronise quiz-buzz/, quiz-app/, commun/, accueil/ et deploiement/ sur le serveur (rsync/SSH) ;
#    /arena/ étant public, le serveur ne reçoit JAMAIS le registre complet quiz-app/quizzes.js :
#    il y est remplacé par quizzes-publics.js (quiz de questions/publics.txt seulement) ;
# 3. reconstruit et relance les conteneurs, attend que /healthz réponde (état « healthy ») ;
# 4. --quiz : vérifie que chaque quiz demandé est présent (local ET dans le conteneur) ;
# 5. change le mot de passe de SÉANCE (3 mots + 2 chiffres), recharge Caddy, vérifie
#    401 sans identifiants / 200 avec ;
# 6. affiche l'URL joueur, l'identifiant, le mot de passe et un QR code (URL seule).
#
# Le mot de passe n'est écrit nulle part en clair : il est haché (bcrypt) sur le serveur via
# stdin et seulement affiché ici. Le précédent cesse de fonctionner immédiatement.
. "$(dirname "$0")/outils/commun.sh"

QUIZ=()
while [ $# -gt 0 ]; do
  case "$1" in
    --quiz) [[ "${2:-}" =~ ^[a-z0-9][a-z0-9-]{0,40}$ ]] || echec "identifiant de quiz invalide : « ${2:-} »"
            QUIZ+=("$2"); shift 2 ;;
    --serveur) QUIZ_SERVEUR="$2"; shift 2 ;;
    --dossier) QUIZ_DOSSIER="$2"; shift 2 ;;
    -h|--help) sed -n '2,15p' "$0"; exit 0 ;;
    *) echec "option inconnue : $1" ;;
  esac
done
exiger_serveur
cd "$DIAG"
distant0 "sudo test -f .env" || echec "pas de .env sur le serveur : lancer d'abord deploiement/initialiser.sh"

info "1/6 Régénération des quiz"
python3 questions/build.py --check >/dev/null || echec "questions/build.py --check : sources invalides"
python3 questions/build.py >/dev/null
ok "$(ls quiz-buzz/quizzes/*.json | wc -l | tr -d ' ') quiz générés"
for q in "${QUIZ[@]+"${QUIZ[@]}"}"; do
  [ -f "quiz-buzz/quizzes/$q.json" ] || echec "quiz « $q » absent de quiz-buzz/quizzes/ (sources : questions/$q.json ?)"
done

info "2/6 Synchronisation vers $QUIZ_SERVEUR:$QUIZ_DOSSIER/diagnostic/"
rsync -az --delete --rsync-path="sudo rsync" \
  --exclude node_modules --exclude test --exclude .env --exclude serveur.local --exclude .DS_Store \
  --exclude .claude --exclude '*~' --exclude '*.bak' --exclude '*.orig' --exclude '*.swp' \
  --exclude /quiz-app/quizzes.js \
  quiz-buzz quiz-app commun accueil deploiement "$QUIZ_SERVEUR:$QUIZ_DOSSIER/diagnostic/"
distant0 "sudo cp ../quiz-app/quizzes-publics.js ../quiz-app/quizzes.js" || echec "copie du registre public impossible"
# Découpe au PREMIER « = » seulement : le haché base64 finit par « = » (un read avec IFS='='
# le retirait, et le navigateur refusait alors le script de /arena/).
python3 "$DEPL/outils/hash-arena.py" quiz-app/index.html | while IFS= read -r ligne; do
  cle="${ligne%%=*}"; val="${ligne#*=}"
  [ -n "$val" ] && printf '%s\n' "$val" | env_set "$cle"
done
ok "fichiers à jour, hachés CSP de /arena/ recalculés, $(grep -c '^ *"id": ' quiz-app/quizzes-publics.js) quiz en libre service (questions/publics.txt)"

info "3/6 Reconstruction et relance des conteneurs"
# Valider le Caddyfile AVANT de relancer : en cas d'erreur, l'ancien Caddy (config en mémoire) continue.
compose "build caddy" >/dev/null 2>&1 || echec "construction de l'image Caddy impossible"
compose "run --rm --no-deps -T caddy caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile" >/dev/null 2>&1 \
  || echec "Caddyfile invalide — détail : ssh $QUIZ_SERVEUR \"cd $(rdepl) && sudo docker compose run --rm --no-deps caddy caddy validate --config /etc/caddy/Caddyfile\""
ok "Caddyfile valide"
compose "up -d --build --remove-orphans" >/dev/null 2>&1 || echec "docker compose up a échoué — voir : docker compose logs"
attendre_sante
ok "quiz-buzz « healthy » (/healthz)"

if [ ${#QUIZ[@]} -gt 0 ]; then
  info "4/6 Présence des quiz demandés dans le conteneur"
  for q in "${QUIZ[@]}"; do
    compose "exec -T quiz-buzz test -f /srv/quiz-buzz/quizzes/$q.json" || echec "quiz « $q » absent du conteneur"
    ok "$q"
  done
else
  info "4/6 (pas de --quiz : contrôle de présence sauté)"
fi

info "5/6 Nouveau mot de passe de séance"
MDP="$(python3 "$DEPL/outils/mot-de-passe.py")"
printf '%s\n' "$MDP" | env_set_hache SEANCE_HASH
recharger_caddy
CLASSE="$(env_get CLASSE_USER)"; SITE="$(env_get SITE_ADDRESS)"
sans=$(code_http /play)
avec=$(printf '%s:%s\n' "$CLASSE" "$MDP" | code_http /play auth)
if [ "$sans" = 401 ] && [ "$avec" = 200 ]; then ok "/play : 401 sans identifiants, 200 avec"
elif [ "$sans" = 000 ]; then alerte "HTTPS pas encore disponible (certificat Let's Encrypt en attente ? DNS ?) — contrôle 401/200 sauté"
else echec "/play : $sans sans identifiants, $avec avec (attendu 401 / 200)"
fi
if [ "$sans" != 000 ]; then
  acc=$(code_http /); anim=$(code_http /animateur); arena=$(code_http /arena/entrainement.html)
  if [ "$acc" = 200 ] && [ "$arena" = 200 ] && [ "$anim" = 401 ]; then ok "accueil et /arena/ publics (200), /animateur protégé (401)"
  else echec "accueil $acc, /arena/ $arena, /animateur $anim (attendu 200 / 200 / 401)"
  fi
fi

info "6/6 À projeter / dicter"
URL="https://$SITE/play"
printf '\n  Joueurs      : %s\n  Identifiant  : %s\n  Mot de passe : %s\n  Animateur    : https://%s/animateur  (compte formateur + clé animateur)\n  Accueil      : https://%s/  (public : entraînement et quiz publiés)\n\n' \
  "$URL" "$CLASSE" "$MDP" "$SITE" "$SITE"
afficher_qr "$URL"
unset MDP
printf '\n'
ok "séance prête — à la fin : deploiement/fin-seance.sh"
