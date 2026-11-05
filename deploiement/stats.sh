#!/usr/bin/env bash
# Mesure d'audience (GoAccess) sur le journal d'accès de Caddy, IP déjà masquées à l'écriture.
#
#   deploiement/stats.sh                       # génère le rapport maintenant -> https://<site>/stats/
#   deploiement/stats.sh --installer-minuterie # pose un timer systemd sur le serveur (chaque nuit, 03:30)
#   deploiement/stats.sh --retirer-minuterie   # le désactive
#
# Le rapport est un fichier HTML statique (volume stats-html), servi par Caddy sous /stats/ avec le
# compte formateur. Aucun script de mesure dans les pages : seule source, le journal du serveur.
. "$(dirname "$0")/outils/commun.sh"

MODE="maintenant"
while [ $# -gt 0 ]; do
  case "$1" in
    --installer-minuterie) MODE="installer"; shift ;;
    --retirer-minuterie) MODE="retirer"; shift ;;
    --serveur) QUIZ_SERVEUR="$2"; shift 2 ;;
    --dossier) QUIZ_DOSSIER="$2"; shift 2 ;;
    -h|--help) sed -n '2,9p' "$0"; exit 0 ;;
    *) echec "option inconnue : $1" ;;
  esac
done
exiger_serveur
UNITE=hardening-arena-stats

case "$MODE" in
  maintenant)
    info "Génération du rapport d'audience"
    compose "--profile stats run --rm -T goaccess" || echec "GoAccess a échoué — voir la sortie ci-dessus"
    ok "rapport à jour : https://$(env_get SITE_ADDRESS)/stats/ (compte formateur)"
    ;;
  installer)
    info "Timer systemd « $UNITE » sur $QUIZ_SERVEUR (chaque nuit à 03:30)"
    distant "sudo tee /etc/systemd/system/$UNITE.service >/dev/null" <<UNIT || echec "écriture du service impossible"
[Unit]
Description=Hardening Arena : rapport d'audience GoAccess
After=docker.service
Requires=docker.service

[Service]
Type=oneshot
WorkingDirectory=$(rdepl)
ExecStart=/usr/bin/docker compose --profile stats run --rm -T goaccess
UNIT
    distant "sudo tee /etc/systemd/system/$UNITE.timer >/dev/null" <<UNIT || echec "écriture du timer impossible"
[Unit]
Description=Hardening Arena : rapport d'audience chaque nuit

[Timer]
OnCalendar=*-*-* 03:30:00
Persistent=true

[Install]
WantedBy=timers.target
UNIT
    distant0 "sudo systemctl daemon-reload && sudo systemctl enable --now $UNITE.timer" || echec "activation du timer impossible"
    ok "$(distant0 "systemctl list-timers $UNITE.timer --no-pager | sed -n 2p")"
    ;;
  retirer)
    distant0 "sudo systemctl disable --now $UNITE.timer" || echec "désactivation impossible"
    ok "timer désactivé (fichiers d'unité laissés dans /etc/systemd/system/, à supprimer à la main si besoin)"
    ;;
esac
