# Politique de sécurité

## Signaler une vulnérabilité

Merci de **ne pas ouvrir d'issue publique** pour une faille.

Utilisez le signalement privé de GitHub : onglet **Security** du dépôt, puis
**Report a vulnerability**.

Indiquez si possible : la version (ou le commit), le scénario d'exploitation, l'impact et, si vous
l'avez, une piste de correction. Réponse visée sous 7 jours ; correction et mention dans le
`CHANGELOG.md` dès que possible, avec votre accord pour être crédité.

## Périmètre

- le serveur `quiz-buzz/`, les pages de `quiz-app/`, `accueil/` et `commun/` ;
- la configuration de déploiement `deploiement/` (Caddyfile, compose, scripts).

Hors périmètre : les instances hébergées par des tiers, les attaques par déni de service
volumétrique, l'ingénierie sociale.

## Versions suivies

Seule la dernière version publiée reçoit des correctifs de sécurité.
