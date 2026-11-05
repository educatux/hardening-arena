#!/usr/bin/env bash
# Clôt une séance : le mot de passe de séance cesse de fonctionner (les joueurs reçoivent
# 401), et les bilans CSV exportés par le formateur sont archivés hors du dépôt.
#
#   deploiement/fin-seance.sh [--csv-dir ~/Downloads] [--archives ~/Documents/BlueTeamAcademy/bilans]
#                             [--serveur user@hote] [--dossier /opt/academy]
#
# Les CSV du mode positionnement sont des données d'apprenants : ils sont DÉPLACÉS (pas
# copiés) dans <archives>/<AAAA-MM-JJ>/, droits 600, jamais dans le dépôt.
. "$(dirname "$0")/outils/commun.sh"

CSV_DIR="$HOME/Downloads"
ARCHIVES="${QUIZ_ARCHIVES:-$HOME/Documents/BlueTeamAcademy/bilans}"
while [ $# -gt 0 ]; do
  case "$1" in
    --csv-dir) CSV_DIR="$2"; shift 2 ;;
    --archives) ARCHIVES="$2"; shift 2 ;;
    --serveur) QUIZ_SERVEUR="$2"; shift 2 ;;
    --dossier) QUIZ_DOSSIER="$2"; shift 2 ;;
    -h|--help) sed -n '2,9p' "$0"; exit 0 ;;
    *) echec "option inconnue : $1" ;;
  esac
done
exiger_serveur

info "Invalidation du mot de passe de séance"
openssl rand -hex 32 | env_set_hache SEANCE_HASH   # aléa jeté : plus personne n'entre
recharger_caddy
code=$(code_http /play)
if [ "$code" = 401 ]; then ok "/play répond 401 : séance fermée"
elif [ "$code" = 000 ]; then alerte "HTTPS indisponible, contrôle sauté (le mot de passe est bien invalidé)"
else alerte "/play répond $code (attendu 401)"
fi

info "Archivage des bilans CSV ($CSV_DIR)"
shopt -s nullglob
csv=("$CSV_DIR"/positionnement-*.csv)
if [ ${#csv[@]} -eq 0 ]; then
  ok "aucun CSV à archiver"
else
  dest="$ARCHIVES/$(date +%F)"
  mkdir -p "$dest"; chmod 700 "$ARCHIVES" "$dest"
  for f in "${csv[@]}"; do mv -n "$f" "$dest/"; chmod 600 "$dest/$(basename "$f")"; done
  ok "${#csv[@]} CSV déplacé(s) dans $dest"
fi
