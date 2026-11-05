# shellcheck shell=bash
# Fonctions partagées par initialiser.sh, preparer-seance.sh et fin-seance.sh.
# Lancées depuis le POSTE DU FORMATEUR ; tout ce qui touche au serveur passe par SSH.
#
# Cible : variables QUIZ_SERVEUR (ex. « formateur@quiz-serveur », alias ~/.ssh/config
# conseillé) et QUIZ_DOSSIER (défaut /opt/academy), lues dans l'environnement ou dans
# deploiement/serveur.local (non commité). Options --serveur / --dossier prioritaires.

set -euo pipefail
set +x   # jamais de trace : des mots de passe transitent par les tubes

DIAG="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"   # hardening/diagnostic
DEPL="$DIAG/deploiement"
[ -f "$DEPL/serveur.local" ] && . "$DEPL/serveur.local"
QUIZ_SERVEUR="${QUIZ_SERVEUR:-}"
QUIZ_DOSSIER="${QUIZ_DOSSIER:-/opt/academy}"

info()  { printf '\033[1;34m==>\033[0m %s\n' "$*"; }
ok()    { printf '\033[1;32m ✓\033[0m %s\n' "$*"; }
alerte(){ printf '\033[1;33m ⚠\033[0m %s\n' "$*" >&2; }
echec() { printf '\033[1;31m ✗ %s\033[0m\n' "$*" >&2; exit 1; }

exiger_serveur() {
  [ -n "$QUIZ_SERVEUR" ] || echec "serveur inconnu : --serveur user@hote, ou QUIZ_SERVEUR dans deploiement/serveur.local"
  # Interpolés dans des commandes distantes exécutées en root : caractères sûrs seulement.
  [[ "$QUIZ_SERVEUR" =~ ^[A-Za-z0-9._@-]+$ ]] || echec "nom de serveur invalide : « $QUIZ_SERVEUR »"
  [[ "$QUIZ_DOSSIER" =~ ^/[A-Za-z0-9._/-]+$ ]] || echec "dossier invalide : « $QUIZ_DOSSIER » (chemin absolu, sans espace ni guillemet)"
}

# Répertoire distant du déploiement et du .env
rdepl() { printf '%s/diagnostic/deploiement' "$QUIZ_DOSSIER"; }

# Commande distante (dans le dossier deploiement/) ; stdin transmis tel quel.
# ⚠ ssh lit stdin : toute commande qui n'attend rien sur stdin passe par distant0
# (stdin = /dev/null), sinon elle avalerait un mot de passe destiné à la suivante.
distant()  { ssh -o BatchMode=yes -o LogLevel=ERROR "$QUIZ_SERVEUR" "cd '$(rdepl)' && $*"; }
distant0() { distant "$@" </dev/null; }

# docker compose distant (sudo : le .env est en 600 root)
compose() { distant0 "sudo docker compose $*"; }

# Écrit une variable du .env distant ; la VALEUR arrive sur stdin, jamais en argument.
env_set() { distant "sudo python3 outils/env-set.py .env $1"; }
env_get() { distant0 "sudo python3 outils/env-set.py .env --get $1"; }

# Hache (bcrypt) le mot de passe lu sur stdin et l'écrit dans la variable $1 du .env,
# sans que le clair ni le haché n'apparaissent en argument ou dans un journal.
# Image Caddy de base épinglée (la même que dans caddy/Dockerfile), sans réseau :
# indépendant du .env, donc utilisable avant que celui-ci soit complet.
CADDY_IMG="caddy:2-alpine@sha256:d8542f48d34a9cf4e4c11a478865229840e87e4c96ea3f439101f31a5d35f75f"
env_set_hache() {
  distant "sudo docker run --rm -i --network none $CADDY_IMG caddy hash-password \
    | sudo python3 outils/env-set.py .env $1"
}

# Recrée Caddy pour qu'il relise son environnement (.env) ; ~2 s de coupure.
recharger_caddy() {
  compose "up -d --no-deps --force-recreate caddy" >/dev/null 2>&1 || echec "recréation de Caddy impossible"
  for _ in $(seq 1 20); do
    if compose "ps caddy --format '{{.State}}'" 2>/dev/null | grep -q running; then return 0; fi
    sleep 1
  done
  echec "Caddy ne redémarre pas — voir : docker compose logs caddy"
}

# Attend que le service Node soit « healthy » (HEALTHCHECK de l'image sur /healthz).
attendre_sante() {
  for _ in $(seq 1 45); do
    case "$(compose "ps quiz-buzz --format '{{.Health}}'" 2>/dev/null)" in
      healthy) return 0 ;;
      unhealthy) echec "service quiz-buzz « unhealthy » — voir : docker compose logs quiz-buzz" ;;
    esac
    sleep 2
  done
  echec "service quiz-buzz pas « healthy » après 90 s"
}

# Code HTTP de https://SITE$1 vu DEPUIS LE SERVEUR, indépendamment du DNS public :
# --resolve vers 127.0.0.1 (exposition directe) ou vers le reverse proxy amont (mode
# « amont » : ce serveur refuse toute connexion qui ne vient pas de l'amont). Avec $2 = « auth », identifiants « user:motdepasse » lus sur stdin
# (curl -K -), jamais en argument. Renvoie 000 si TLS impossible (pas encore de certificat).
code_http() {
  local chemin="$1" site cible; site="$(env_get SITE_ADDRESS)"
  cible=127.0.0.1
  if [ "$(env_get MODE_EXPOSITION 2>/dev/null)" = amont ]; then cible="$(env_get AMONT_IP)"; cible="${cible%%/*}"; fi
  if [ "${2:-}" != auth ]; then
    distant0 "curl -s -o /dev/null -w '%{http_code}' --max-time 10 --resolve '$site:443:$cible' 'https://$site$chemin'" || true
  else
    distant "sed 's/^/user = \"/; s/\$/\"/' | curl -s -o /dev/null -w '%{http_code}' --max-time 10 -K - --resolve '$site:443:$cible' 'https://$site$chemin'" || true
  fi
}

# QR code ASCII de l'URL $1 (jamais d'identifiants dedans).
afficher_qr() {
  if command -v qrencode >/dev/null 2>&1; then qrencode -t ansiutf8 -m 2 "$1"
  elif command -v nix >/dev/null 2>&1; then nix run nixpkgs#qrencode -- -t ansiutf8 -m 2 "$1" 2>/dev/null || alerte "qrencode indisponible"
  else alerte "installer qrencode pour afficher le QR code (brew install qrencode / apt install qrencode)"
  fi
}
