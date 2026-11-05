#!/usr/bin/env bash
# Mise en place UNIQUE du serveur (puis preparer-seance.sh avant chaque séance).
#
#   deploiement/initialiser.sh --site quiz.exemple.org [--serveur user@hote] [--dossier /opt/academy]
#   deploiement/initialiser.sh --nouveau-formateur      # renouvelle le seul mot de passe formateur
#   deploiement/initialiser.sh --nouvelle-cle           # renouvelle la seule clé animateur (HOST_KEY)
#
# Crée <dossier>/diagnostic/deploiement/.env sur le serveur (600, root) avec :
#   SITE_ADDRESS, CLASSE_USER, HOST_KEY (aléatoire), FORMATEUR_HASH (bcrypt d'un mot de
#   passe fort généré), SEANCE_HASH (bcrypt d'un aléa jeté : aucun joueur n'entre tant
#   que preparer-seance.sh n'a pas tourné).
# Le mot de passe formateur et la clé animateur sont affichés UNE fois : à ranger aussitôt
# dans le coffre de mots de passe. Ils ne sont écrits nulle part en clair.
. "$(dirname "$0")/outils/commun.sh"

SITE="" ; MODE="complet"
while [ $# -gt 0 ]; do
  case "$1" in
    --site) SITE="$2"; shift 2 ;;
    --serveur) QUIZ_SERVEUR="$2"; shift 2 ;;
    --dossier) QUIZ_DOSSIER="$2"; shift 2 ;;
    --nouveau-formateur) MODE="formateur"; shift ;;
    --nouvelle-cle) MODE="cle"; shift ;;
    -h|--help) sed -n '2,13p' "$0"; exit 0 ;;
    *) echec "option inconnue : $1" ;;
  esac
done
exiger_serveur

info "Contrôle du serveur $QUIZ_SERVEUR"
ssh -o BatchMode=yes "$QUIZ_SERVEUR" true </dev/null || echec "SSH impossible vers $QUIZ_SERVEUR"
ssh -o BatchMode=yes "$QUIZ_SERVEUR" "sudo docker compose version" </dev/null >/dev/null \
  || echec "Docker Compose v2 (« docker compose ») absent sur le serveur"
ssh -o BatchMode=yes "$QUIZ_SERVEUR" "command -v rsync python3 curl" </dev/null >/dev/null \
  || echec "rsync, python3 et curl sont requis sur le serveur"
ok "SSH, Docker Compose v2, rsync, python3, curl"

info "Copie de deploiement/ vers $QUIZ_DOSSIER/diagnostic/"
ssh -o BatchMode=yes "$QUIZ_SERVEUR" "sudo mkdir -p '$QUIZ_DOSSIER/diagnostic'" </dev/null
rsync -az --rsync-path="sudo rsync" --exclude .env --exclude serveur.local \
  "$DEPL" "$QUIZ_SERVEUR:$QUIZ_DOSSIER/diagnostic/"

secret_formateur() {
  local mdp; mdp="$(python3 "$DEPL/outils/mot-de-passe.py" --fort)"
  printf '%s\n' "$mdp" | env_set_hache FORMATEUR_HASH
  printf '\n  Compte formateur   : formateur\n  Mot de passe       : %s\n' "$mdp"
}
secret_cle() {
  local cle; cle="$(openssl rand -hex 16)"
  printf '%s\n' "$cle" | env_set HOST_KEY
  printf '  Clé animateur      : %s\n' "$cle"
}

case "$MODE" in
  complet)
    [ -n "$SITE" ] || echec "--site requis (ex. --site quiz.blueteam-academy.org)"
    if distant0 "sudo test -f .env"; then
      echec ".env existe déjà sur le serveur : --nouveau-formateur / --nouvelle-cle pour renouveler un secret"
    fi
    distant0 "sudo install -m 600 -o root -g root /dev/null .env"
    printf '%s\n' "$SITE" | env_set SITE_ADDRESS
    printf 'classe\n' | env_set CLASSE_USER
    openssl rand -hex 32 | env_set_hache SEANCE_HASH   # aléa jeté : séance fermée
    info "Secrets — À RANGER MAINTENANT dans le coffre (affichés une seule fois)"
    secret_formateur; secret_cle
    printf '\n'
    ok ".env créé ($(rdepl)/.env, 600 root). Étape suivante : deploiement/preparer-seance.sh"
    ;;
  formateur)
    info "Nouveau mot de passe formateur — à ranger dans le coffre"
    secret_formateur; printf '\n'
    recharger_caddy; ok "Caddy rechargé : l'ancien mot de passe formateur est refusé"
    ;;
  cle)
    info "Nouvelle clé animateur — à ranger dans le coffre"
    secret_cle; printf '\n'
    compose "up -d --no-deps quiz-buzz" >/dev/null; attendre_sante
    ok "Service relancé : les parties en cours sont fermées, l'ancienne clé est refusée"
    ;;
esac
