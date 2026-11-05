/* Généré par questions/build.py : ne pas éditer. */
window.QUIZZES = [
 {
  "id": "exemple",
  "title": "Hardening Arena — Exemple : les réflexes de base",
  "questions": [
   {
    "theme": "Mots de passe",
    "q": "Quel est le meilleur moyen de protéger un compte important ?",
    "answers": [
     "Le nom de son chat suivi de 123",
     "Un mot de passe unique et long, plus une double authentification",
     "Un mot de passe changé chaque semaine",
     "Le même mot de passe partout, mais très complexe"
    ],
    "correct": 1,
    "time": 30,
    "point": "Unique : une fuite sur un site ne compromet pas les autres. Long : une phrase de passe résiste mieux qu'un mot court et compliqué. La double authentification arrête l'attaquant qui a volé le mot de passe."
   },
   {
    "theme": "Hameçonnage",
    "q": "Un mail de « votre banque » demande de cliquer pour « débloquer votre compte ». Le bon réflexe ?",
    "answers": [
     "Ne pas cliquer, et passer par l'application ou le site tapé à la main",
     "Cliquer si le logo de la banque est bien là",
     "Cliquer, mais ne pas saisir le mot de passe",
     "Répondre au mail pour vérifier"
    ],
    "correct": 0,
    "time": 30,
    "point": "Le logo et l'adresse d'expédition se falsifient. L'urgence (« débloquer », « sous 24 h ») est la signature de l'hameçonnage. On ne suit jamais un lien reçu : on va soi-même sur le site connu."
   },
   {
    "theme": "Mises à jour",
    "q": "Pourquoi installer les mises à jour de sécurité rapidement ?",
    "answers": [
     "Elles accélèrent l'ordinateur",
     "Elles suppriment les virus déjà présents",
     "Elles sont obligatoires par la loi",
     "Elles corrigent des failles déjà connues des attaquants"
    ],
    "correct": 3,
    "time": 20,
    "point": "Une fois le correctif publié, la faille est documentée : les attaquants l'exploitent sur les machines qui ne l'ont pas installé. Retarder une mise à jour, c'est laisser une porte connue ouverte."
   },
   {
    "theme": "Chiffrement",
    "q": "Le cadenas affiché devant l'adresse d'un site (HTTPS) garantit que...",
    "answers": [
     "Le site a été vérifié par l'État",
     "La connexion est chiffrée avec le site dont l'adresse est affichée",
     "Le site est honnête et sans danger",
     "Aucun virus ne peut venir de ce site"
    ],
    "correct": 1,
    "time": 30,
    "point": "HTTPS protège le trajet (personne ne lit ni ne modifie en route) et prouve qu'on parle bien au domaine affiché. Un site d'hameçonnage peut avoir un cadenas : vérifiez l'adresse, pas seulement le cadenas."
   },
   {
    "theme": "Sauvegardes",
    "q": "Face à un rançongiciel, quelle sauvegarde sauve vraiment les données ?",
    "answers": [
     "Une copie hors ligne ou hors d'atteinte, testée régulièrement",
     "La corbeille de l'ordinateur",
     "Une copie dans un autre dossier du même ordinateur",
     "Une copie sur un second disque toujours branché"
    ],
    "correct": 0,
    "time": 30,
    "point": "Un rançongiciel chiffre tout ce qu'il atteint, disques branchés et partages réseau compris. Règle 3-2-1 : 3 copies, 2 supports, 1 hors site ou hors ligne. Et une sauvegarde jamais restaurée n'est qu'un espoir."
   },
   {
    "theme": "Moindre privilège",
    "q": "Pourquoi ne pas utiliser un compte administrateur au quotidien ?",
    "answers": [
     "Il est interdit d'en créer un",
     "Un programme piégé aurait alors tous les droits sur la machine",
     "Le compte administrateur est plus lent",
     "L'administrateur ne peut pas naviguer sur Internet"
    ],
    "correct": 1,
    "time": 20,
    "point": "Ce qu'on lance hérite de nos droits. Avec un compte simple, un logiciel malveillant reste limité ; on n'élève ses droits (sudo, UAC) que pour l'action qui le demande, puis on revient au compte simple."
   }
  ]
 },
 {
  "id": "dns-1",
  "title": "Hardening Arena — DNS (1/2) : les bases, les attaques, DNSSEC",
  "questions": [
   {
    "theme": "Rôle du DNS",
    "q": "Le rôle du DNS, c'est surtout de...",
    "answers": [
     "Traduire un nom en données utiles (adresse IP, serveur mail…)",
     "Attribuer les adresses IP aux machines",
     "Chiffrer les connexions web",
     "Router les paquets entre réseaux"
    ],
    "correct": 0,
    "time": 30,
    "point": "Le DNS est l'annuaire d'Internet : un nom donne une adresse, un serveur de messagerie, une clé, une règle. Attribuer les IP, c'est DHCP ; acheminer les paquets, c'est le routage.",
    "module": "D1"
   },
   {
    "theme": "Acteurs",
    "q": "Un résolveur récursif (celui de la box, du FAI, ou 1.1.1.1)...",
    "answers": [
     "Chiffre toutes les requêtes DNS",
     "Cherche la réponse pour le client, de serveur en serveur",
     "Vend les noms de domaine",
     "Détient la zone d'un domaine"
    ],
    "correct": 1,
    "time": 30,
    "point": "Deux métiers : le résolveur (il pose les questions et garde les réponses en cache) et le serveur faisant autorité (il détient la zone et répond pour elle).",
    "module": "D1"
   },
   {
    "theme": "Acteurs",
    "q": "Le serveur faisant autorité pour exemple.fr...",
    "answers": [
     "Détient et publie la zone exemple.fr",
     "Sert uniquement aux adresses IPv6",
     "Résout tous les noms d'Internet pour ses clients",
     "Est forcément chez le FAI du visiteur"
    ],
    "correct": 0,
    "time": 30,
    "point": "La zone, c'est la liste des enregistrements du domaine. Elle est publiée par ses serveurs faisant autorité, ceux listés dans les enregistrements NS.",
    "module": "D1"
   },
   {
    "theme": "Résolution",
    "q": "Pour trouver www.exemple.fr sans cache, le résolveur interroge dans l'ordre...",
    "answers": [
     "exemple.fr, puis .fr, puis la racine",
     "La racine, puis les serveurs de .fr, puis ceux d'exemple.fr",
     "Uniquement le serveur de son FAI",
     "Google, qui connaît tous les noms"
    ],
    "correct": 1,
    "time": 30,
    "point": "Le DNS est un arbre : la racine (le point final, « . ») délègue .fr, .fr délègue exemple.fr. Chaque niveau répond « demandez plutôt à ces serveurs-là ».",
    "module": "D1"
   },
   {
    "theme": "Enregistrements",
    "q": "L'enregistrement AAAA contient...",
    "answers": [
     "Une adresse IPv4",
     "Un serveur de messagerie",
     "Un alias vers un autre nom",
     "Une adresse IPv6"
    ],
    "correct": 3,
    "time": 30,
    "point": "A = IPv4 (4 octets), AAAA = IPv6 (16 octets, quatre fois plus : d'où les quatre A). Un nom peut avoir les deux.",
    "module": "D1"
   },
   {
    "theme": "Enregistrements",
    "q": "Un enregistrement CNAME, c'est...",
    "answers": [
     "Le nom du propriétaire du domaine",
     "Un alias : ce nom pointe vers un autre nom",
     "Une adresse IP de secours",
     "Un enregistrement de messagerie"
    ],
    "correct": 1,
    "time": 30,
    "point": "CNAME : « www.exemple.fr est en fait monsite.hebergeur.net ». Interdit à la racine de la zone et seul sur son nom. Un CNAME oublié vers un service supprimé est un danger (module D2).",
    "module": "D1"
   },
   {
    "theme": "Enregistrements",
    "q": "L'enregistrement MX d'un domaine indique...",
    "answers": [
     "Son serveur web principal",
     "La taille maximale des mails",
     "Les serveurs qui reçoivent son courrier",
     "Son serveur DNS maître"
    ],
    "correct": 2,
    "time": 30,
    "point": "MX = Mail eXchanger, avec une priorité : le plus petit nombre est essayé en premier. Pas de MX : le courrier va à l'adresse du domaine lui-même (ou nulle part, cf. Null MX).",
    "module": "D1"
   },
   {
    "theme": "Enregistrements",
    "q": "Les enregistrements NS d'une zone indiquent...",
    "answers": [
     "Les noms des administrateurs",
     "Les sous-domaines interdits",
     "Les serveurs faisant autorité pour cette zone",
     "Les serveurs de noms des visiteurs"
    ],
    "correct": 2,
    "time": 30,
    "point": "NS = Name Server. Qui contrôle les NS d'un domaine contrôle tout le domaine : site, mail, certificats. C'est ce que vise un détournement (module D2).",
    "module": "D1"
   },
   {
    "theme": "Enregistrements",
    "q": "Aujourd'hui, les enregistrements TXT servent surtout à...",
    "answers": [
     "Stocker des commentaires sans effet",
     "Afficher un message aux visiteurs",
     "Publier des règles et des preuves (SPF, DMARC, vérifications)",
     "Remplacer les enregistrements A"
    ],
    "correct": 2,
    "time": 30,
    "point": "Le TXT est devenu le couteau suisse : politique anti-usurpation du mail (SPF, DMARC, DKIM), preuves de propriété pour Google, Microsoft, Let's Encrypt (défi dns-01).",
    "module": "D1"
   },
   {
    "theme": "Enregistrements",
    "q": "Un enregistrement PTR sert à...",
    "answers": [
     "Pointer vers la page d'accueil",
     "Stocker un mot de passe",
     "Protéger le domaine contre le vol",
     "Retrouver le nom à partir d'une adresse IP (DNS inverse)"
    ],
    "correct": 3,
    "time": 30,
    "point": "DNS inverse, sous in-addr.arpa (IPv4) et ip6.arpa (IPv6). Utile aux journaux et au mail : beaucoup de serveurs refusent un expéditeur sans PTR cohérent.",
    "module": "D1"
   },
   {
    "theme": "Cache",
    "q": "Le TTL d'un enregistrement fixe...",
    "answers": [
     "Sa priorité par rapport aux autres",
     "Le nombre de serveurs qui le publient",
     "Sa date d'expiration définitive",
     "Combien de temps les résolveurs peuvent le garder en cache"
    ],
    "correct": 3,
    "time": 30,
    "point": "TTL en secondes. Long : moins de requêtes, mais une erreur (ou un empoisonnement) dure longtemps. On baisse le TTL quelques jours avant une migration.",
    "module": "D1"
   },
   {
    "theme": "Outils",
    "q": "Quelle commande affiche les serveurs de messagerie d'exemple.fr ?",
    "answers": [
     "curl exemple.fr:25",
     "ping exemple.fr",
     "dig A mail",
     "dig MX exemple.fr"
    ],
    "correct": 3,
    "time": 30,
    "point": "dig <TYPE> <nom> ; +short pour la réponse seule ; @1.1.1.1 pour choisir le résolveur ; +trace pour suivre la résolution depuis la racine. nslookup existe aussi, en moins précis.",
    "module": "D1"
   },
   {
    "theme": "Transport",
    "q": "Le DNS classique circule surtout en...",
    "answers": [
     "UDP, port 53 (TCP pour les grosses réponses)",
     "UDP, port 22",
     "TCP, port 25",
     "TCP, port 443 uniquement"
    ],
    "correct": 0,
    "time": 30,
    "point": "UDP : rapide, sans connexion… et donc facile à usurper (module D2). TCP 53 pour les réponses trop grosses et les transferts de zone. Versions chiffrées : DoT (853), DoH (443).",
    "module": "D1"
   },
   {
    "theme": "Zone",
    "q": "Le SOA d'une zone contient notamment...",
    "answers": [
     "La liste des utilisateurs",
     "Le numéro de série de la zone et ses délais de mise à jour",
     "Le certificat TLS du site",
     "Les adresses IP de tous les postes"
    ],
    "correct": 1,
    "time": 30,
    "point": "SOA = Start Of Authority. Le numéro de série doit augmenter à chaque modification : sinon les serveurs secondaires ne se mettent pas à jour (erreur classique).",
    "module": "D1"
   },
   {
    "theme": "Poste",
    "q": "Le fichier /etc/hosts d'un poste Linux...",
    "answers": [
     "Est réécrit par le DNS à chaque démarrage",
     "Est consulté avant le DNS sur la plupart des systèmes",
     "Ne sert qu'aux adresses IPv6",
     "N'est plus jamais lu"
    ],
    "correct": 1,
    "time": 30,
    "point": "Ordre fixé par /etc/nsswitch.conf (« hosts: files dns »). Vous l'avez utilisé au TP. Un malware qui le modifie redirige des noms sans toucher au DNS : à surveiller.",
    "module": "D1"
   },
   {
    "theme": "Reconnaissance",
    "q": "Un serveur autorise le transfert de zone (AXFR) à tout le monde. L'attaquant obtient...",
    "answers": [
     "La liste complète des noms de la zone, internes compris",
     "Le mot de passe de l'administrateur",
     "Le contrôle du domaine",
     "Rien d'utile"
    ],
    "correct": 0,
    "time": 30,
    "point": "AXFR sert à copier la zone vers les serveurs secondaires. Ouvert à tous, il livre la carte du réseau (vpn, intranet, test…). À limiter aux secondaires (et signer avec TSIG).",
    "module": "D2"
   },
   {
    "theme": "Empoisonnement",
    "q": "L'empoisonnement de cache DNS, c'est...",
    "answers": [
     "Faire mémoriser une fausse réponse à un résolveur",
     "Voler un nom de domaine chez le registrar",
     "Saturer un serveur DNS de requêtes",
     "Lire les requêtes DNS des voisins"
    ],
    "correct": 0,
    "time": 30,
    "point": "Une fausse adresse en cache : tous les clients du résolveur partent chez l'attaquant, pendant toute la durée du TTL. En HTTPS, le navigateur alerte (pas de certificat valide pour ce nom) : c'est le TLS qui rattrape le DNS.",
    "module": "D2"
   },
   {
    "theme": "Empoisonnement",
    "q": "Pourquoi une réponse DNS classique est-elle facile à falsifier ?",
    "answers": [
     "Elle est chiffrée avec une clé faible",
     "Les serveurs DNS ne vérifient pas les mots de passe",
     "Elle passe toujours par le Wi-Fi",
     "Rien ne l'authentifie : seuls un identifiant et un port la protègent"
    ],
    "correct": 3,
    "time": 30,
    "point": "Un résolveur accepte la première réponse qui correspond à sa question (identifiant de 16 bits, port, nom). Un attaquant qui devine assez vite gagne. La vraie parade : DNSSEC (module D3).",
    "module": "D2"
   },
   {
    "theme": "Empoisonnement",
    "q": "La faille Kaminsky (2008) a été corrigée en urgence par...",
    "answers": [
     "Le tirage aléatoire du port source des requêtes",
     "L'obligation de DNSSEC",
     "L'abandon d'UDP",
     "Le chiffrement du DNS"
    ],
    "correct": 0,
    "time": 30,
    "point": "Dan Kaminsky a montré qu'on pouvait empoisonner un résolveur en quelques secondes. Correctif coordonné de tous les éditeurs (juillet 2008) : port source aléatoire. Une rustine : DNSSEC est la solution de fond.",
    "module": "D2"
   },
   {
    "theme": "Détournement",
    "q": "Un attaquant entre dans votre compte chez le registrar (bureau d'enregistrement). Il peut...",
    "answers": [
     "Changer les serveurs NS et prendre tout le domaine",
     "Seulement modifier le site web",
     "Seulement lire vos factures",
     "Rien : le DNS est protégé par le serveur"
    ],
    "correct": 0,
    "time": 30,
    "point": "Avec les NS, il contrôle le site, le mail, et peut obtenir de vrais certificats. Parades : double authentification, verrou du registre (registry lock), surveillance des changements.",
    "module": "D2"
   },
   {
    "theme": "Prise de sous-domaine",
    "q": "shop.exemple.fr est un CNAME vers un service cloud supprimé. Le risque ?",
    "answers": [
     "Le DNS devient plus lent",
     "Aucun : le nom ne répond plus",
     "Quelqu'un recrée ce service et prend le contrôle de shop.exemple.fr",
     "Le domaine expire plus vite"
    ],
    "correct": 2,
    "time": 30,
    "point": "« Subdomain takeover » : le CNAME pendant pointe vers un nom que n'importe qui peut réclamer chez l'hébergeur. Règle : on supprime l'enregistrement DNS AVANT ou AVEC la ressource.",
    "module": "D2"
   },
   {
    "theme": "Exfiltration",
    "q": "Pourquoi un malware exfiltre-t-il parfois des données par des requêtes DNS ?",
    "answers": [
     "Le DNS sort presque toujours, même d'un réseau filtré",
     "Le DNS va plus vite que HTTPS",
     "Les antivirus ne lisent que le DNS",
     "Le DNS est chiffré par défaut"
    ],
    "correct": 0,
    "time": 30,
    "point": "Tunnel DNS : données encodées dans des sous-domaines (aGVsbG8.attaquant.com). Indices : noms longs et aléatoires, volume anormal vers un domaine. Parade : résolveur interne obligatoire et journalisé.",
    "module": "D2"
   },
   {
    "theme": "Amplification",
    "q": "Un résolveur ouvert à tout Internet peut servir à attaquer un tiers par...",
    "answers": [
     "Vol des mots de passe de la victime",
     "Amplification : petite requête usurpée, grosse réponse vers la victime",
     "Chiffrement des fichiers de la victime",
     "Empoisonnement du DNS de la victime"
    ],
    "correct": 1,
    "time": 30,
    "point": "L'attaquant envoie des requêtes avec l'adresse de la victime comme source ; les réponses, bien plus grosses, inondent la victime (déni de service). Un résolveur ne répond qu'à ses clients.",
    "module": "D2"
   },
   {
    "theme": "Défense",
    "q": "Bloquer le port 53 sortant, sauf pour le résolveur de l'entreprise, permet...",
    "answers": [
     "De supprimer le besoin de DNS",
     "D'accélérer la navigation",
     "De chiffrer le DNS",
     "D'obliger les postes à passer par un DNS surveillé"
    ],
    "correct": 3,
    "time": 30,
    "point": "Un seul chemin de sortie pour le DNS : on journalise, on filtre (domaines malveillants), on repère les tunnels. Attention à DoH (port 443), qui contourne cette règle (module D3).",
    "module": "D2"
   },
   {
    "theme": "DNSSEC",
    "q": "DNSSEC apporte aux réponses DNS...",
    "answers": [
     "Le chiffrement",
     "Une résolution plus rapide",
     "L'anonymat",
     "L'authenticité et l'intégrité (elles sont signées)"
    ],
    "correct": 3,
    "time": 30,
    "point": "DNSSEC signe les enregistrements : le résolveur vérifie qu'ils viennent bien du propriétaire de la zone et n'ont pas été modifiés. Il ne cache rien : tout reste lisible.",
    "module": "D3"
   },
   {
    "theme": "DNSSEC",
    "q": "Avec DNSSEC, un ensemble d'enregistrements est accompagné de...",
    "answers": [
     "Un RRSIG : sa signature",
     "Un SOA",
     "Un NSEC",
     "Un DS"
    ],
    "correct": 0,
    "time": 30,
    "point": "RRSIG = signature d'un ensemble (tous les A d'un nom, par exemple), avec une date de début et de fin. Une signature expirée = réponse refusée : il faut re-signer régulièrement.",
    "module": "D3"
   },
   {
    "theme": "DNSSEC",
    "q": "L'enregistrement DNSKEY publie...",
    "answers": [
     "Le certificat TLS du site",
     "Le mot de passe du registrar",
     "La clé privée de la zone",
     "Les clés publiques de la zone"
    ],
    "correct": 3,
    "time": 30,
    "point": "Comme au TP PKI : on publie la clé publique, la clé privée reste chez le propriétaire (idéalement hors du serveur public). Le résolveur vérifie les RRSIG avec ces DNSKEY.",
    "module": "D3"
   },
   {
    "theme": "Chaîne",
    "q": "Le DS, publié dans la zone parente (.fr), sert à...",
    "answers": [
     "Désactiver DNSSEC",
     "Lister les sous-domaines",
     "Signer les e-mails",
     "Relier la zone à sa parente : c'est l'empreinte de sa clé"
    ],
    "correct": 3,
    "time": 30,
    "point": "Chaîne de confiance : la racine garantit .fr (DS de .fr), .fr garantit exemple.fr (DS d'exemple.fr). Exactement l'idée racine → intermédiaire → feuille du TP PKI.",
    "module": "D3"
   },
   {
    "theme": "Chaîne",
    "q": "Pour DNSSEC, l'ancre de confiance des résolveurs est...",
    "answers": [
     "Le serveur DNS du FAI",
     "Une AC publique comme Let's Encrypt",
     "La clé de la zone racine",
     "Le certificat du site visité"
    ],
    "correct": 2,
    "time": 30,
    "point": "Le résolveur connaît d'avance UNE clé : celle de la racine (comme la racine dans le magasin du navigateur). Elle a été changée pour la première fois en octobre 2018.",
    "module": "D3"
   },
   {
    "theme": "Clés",
    "q": "Pourquoi une zone DNSSEC a-t-elle souvent deux clés, KSK et ZSK ?",
    "answers": [
     "Par sécurité, on signe tout deux fois",
     "Une pour le web, une pour le mail",
     "Une pour IPv4, une pour IPv6",
     "La KSK signe les clés et change rarement ; la ZSK signe les données"
    ],
    "correct": 3,
    "time": 30,
    "point": "La KSK est liée au DS de la parente : la changer demande une action chez le registrar. La ZSK change souvent sans toucher à la parente. Même logique que racine hors ligne / intermédiaire.",
    "module": "D3"
   },
   {
    "theme": "Non-existence",
    "q": "Les enregistrements NSEC ou NSEC3 servent à...",
    "answers": [
     "Accélérer les réponses",
     "Prouver, de façon signée, qu'un nom n'existe pas",
     "Chiffrer la zone",
     "Bloquer les attaques par amplification"
    ],
    "correct": 1,
    "time": 30,
    "point": "Sans eux, un attaquant pourrait faire croire qu'un nom n'existe pas. Effet secondaire de NSEC : on peut énumérer toute la zone (« zone walking ») ; NSEC3 hache les noms pour compliquer.",
    "module": "D3"
   },
   {
    "theme": "Validation",
    "q": "Dans une réponse de dig, le drapeau « ad » signifie...",
    "answers": [
     "La réponse est chiffrée",
     "Le résolveur a validé la signature DNSSEC",
     "La réponse vient du serveur faisant autorité",
     "Le domaine contient de la publicité"
    ],
    "correct": 1,
    "time": 30,
    "point": "ad = Authenticated Data. Ne pas confondre avec aa = Authoritative Answer (le serveur fait autorité). Essayez : dig +dnssec <nom> @1.1.1.1 et regardez la ligne « flags ».",
    "module": "D3"
   },
   {
    "theme": "Validation",
    "q": "Un résolveur validant reçoit une signature DNSSEC invalide. Il répond...",
    "answers": [
     "SERVFAIL : le nom devient introuvable",
     "Une adresse de secours",
     "La réponse, avec un avertissement",
     "NXDOMAIN : le nom n'existe pas"
    ],
    "correct": 0,
    "time": 30,
    "point": "DNSSEC échoue fermé : mieux vaut pas de réponse qu'une fausse. Revers : une erreur de signature (clé changée, signatures expirées) coupe tout le domaine. D'où des pannes célèbres.",
    "module": "D3"
   },
   {
    "theme": "Confidentialité",
    "q": "Avec DNSSEC seul, qui peut lire vos requêtes DNS ?",
    "answers": [
     "Tout le réseau sur le chemin : elles circulent en clair",
     "Personne, elles sont signées",
     "Seulement le registrar",
     "Seulement le serveur faisant autorité"
    ],
    "correct": 0,
    "time": 30,
    "point": "Signer n'est pas chiffrer (même idée qu'au quiz PKI). Le Wi-Fi public, le FAI, un proxy voient les noms demandés. Pour les cacher : DoT ou DoH.",
    "module": "D3"
   },
   {
    "theme": "Chiffrement",
    "q": "DNS over TLS (DoT) utilise le port...",
    "answers": [
     "443",
     "8443",
     "853",
     "53"
    ],
    "correct": 2,
    "time": 30,
    "point": "DoT = DNS dans un tunnel TLS, sur un port dédié : facile à repérer et à autoriser (ou bloquer) en entreprise. Utilisé par Android (« DNS privé »).",
    "module": "D3"
   },
   {
    "theme": "Chiffrement",
    "q": "DNS over HTTPS (DoH) est difficile à contrôler en entreprise parce qu'il...",
    "answers": [
     "Utilise un port aléatoire",
     "Ne fonctionne qu'en IPv6",
     "Se fond dans le trafic HTTPS, sur le port 443",
     "N'est jamais chiffré"
    ],
    "correct": 2,
    "time": 30,
    "point": "Un navigateur en DoH contourne le résolveur de l'entreprise (et sa surveillance). Parades : politique des navigateurs (GPO), domaine « canari » use-application-dns.net pour Firefox, filtrage des résolveurs DoH connus.",
    "module": "D3"
   },
   {
    "theme": "Synthèse",
    "q": "DNSSEC d'un côté, DoT/DoH de l'autre, sont...",
    "answers": [
     "Remplacés par HTTPS",
     "Complémentaires : l'un authentifie les données, l'autre protège le trajet",
     "Incompatibles entre eux",
     "Deux noms pour la même chose"
    ],
    "correct": 1,
    "time": 30,
    "point": "DoH protège le trajet poste → résolveur. DNSSEC prouve que la réponse vient du propriétaire de la zone, quel que soit le trajet. Il faut les deux.",
    "module": "D3"
   },
   {
    "theme": "Adoption",
    "q": "Pourquoi DNSSEC reste-t-il peu déployé ?",
    "answers": [
     "Il divise la vitesse d'Internet par deux",
     "Une erreur de clé ou de signature coupe tout le domaine",
     "Il est payant",
     "Il est interdit en France"
    ],
    "correct": 1,
    "time": 30,
    "point": "La peur de la panne (signatures à renouveler, rotation des clés, DS chez le registrar) freine. Aujourd'hui, beaucoup d'hébergeurs DNS signent en un clic. Vous le vérifierez en audit.",
    "module": "D3"
   }
  ]
 },
 {
  "id": "dns-2",
  "title": "Hardening Arena — DNS (2/2) : certificats, messagerie, SSH",
  "questions": [
   {
    "theme": "CAA",
    "q": "L'enregistrement CAA d'un domaine indique...",
    "answers": [
     "Quelles autorités de certification ont le droit d'émettre pour lui",
     "La date d'expiration du domaine",
     "Le serveur qui chiffre le DNS",
     "Le certificat actuel du site"
    ],
    "correct": 0,
    "time": 30,
    "point": "exemple.fr CAA 0 issue \"letsencrypt.org\" : seule Let's Encrypt peut émettre. Une AC publique doit consulter la CAA avant d'émettre (obligatoire depuis septembre 2017).",
    "module": "D4"
   },
   {
    "theme": "CAA",
    "q": "Un domaine n'a aucun enregistrement CAA. Alors...",
    "answers": [
     "Le navigateur refuse ses certificats",
     "Seule l'AC du registrar peut émettre",
     "N'importe quelle AC publique peut émettre pour lui",
     "Aucune AC ne peut émettre pour lui"
    ],
    "correct": 2,
    "time": 30,
    "point": "Pas de CAA = pas de restriction : des dizaines d'AC peuvent émettre. Deux lignes suffisent à réduire ce risque ; c'est gratuit et sans effet sur le site.",
    "module": "D4"
   },
   {
    "theme": "CAA",
    "q": "Qui vérifie l'enregistrement CAA ?",
    "answers": [
     "Le navigateur, à chaque visite",
     "Le serveur web, au démarrage",
     "Le résolveur DNS de l'utilisateur",
     "L'autorité de certification, au moment d'émettre"
    ],
    "correct": 3,
    "time": 30,
    "point": "La CAA protège en amont : une AC honnête refuse d'émettre. Elle ne protège pas contre une AC malhonnête ou piratée : pour la voir, il faut surveiller la Certificate Transparency.",
    "module": "D4"
   },
   {
    "theme": "CAA",
    "q": "La propriété « iodef » d'un enregistrement CAA sert à...",
    "answers": [
     "Autoriser les certificats wildcard",
     "Être prévenu quand une AC refuse une demande",
     "Révoquer les anciens certificats",
     "Chiffrer la demande de certificat"
    ],
    "correct": 1,
    "time": 30,
    "point": "CAA 0 iodef \"mailto:securite@exemple.fr\" : une adresse où l'AC peut signaler une tentative refusée. issuewild contrôle séparément les certificats *.exemple.fr.",
    "module": "D4"
   },
   {
    "theme": "Transparence",
    "q": "Pour savoir si un certificat a été émis pour votre domaine à votre insu, on consulte...",
    "answers": [
     "Les journaux de Certificate Transparency (par exemple crt.sh)",
     "Le fichier /etc/hosts",
     "L'enregistrement CAA",
     "Les journaux du résolveur DNS"
    ],
    "correct": 0,
    "time": 30,
    "point": "Toute AC publique enregistre ses certificats dans des journaux publics. crt.sh permet de chercher par domaine ; des services alertent à chaque nouvelle émission. CAA empêche, CT révèle.",
    "module": "D4"
   },
   {
    "theme": "DANE",
    "q": "Un enregistrement TLSA (DANE) publie dans le DNS...",
    "answers": [
     "La liste des AC interdites",
     "Le certificat ou la clé qu'un service TLS doit présenter",
     "Le mot de passe du serveur",
     "Le port du serveur web"
    ],
    "correct": 1,
    "time": 30,
    "point": "_443._tcp.www.exemple.fr TLSA 3 1 1 <empreinte> : « mon serveur présente cette clé ». N'a de valeur qu'avec DNSSEC. Peu utilisé par les navigateurs, mais réel entre serveurs de messagerie.",
    "module": "D4"
   },
   {
    "theme": "SPF",
    "q": "L'enregistrement SPF d'un domaine liste...",
    "answers": [
     "Les adresses e-mail des employés",
     "Les serveurs qui reçoivent son courrier",
     "Les serveurs autorisés à envoyer du courrier pour ce domaine",
     "Les domaines bloqués par l'antispam"
    ],
    "correct": 2,
    "time": 30,
    "point": "TXT \"v=spf1 ip4:192.0.2.25 include:_spf.hebergeur.net -all\". Recevoir, c'est le MX ; envoyer, c'est SPF. Le serveur destinataire compare l'IP de l'expéditeur à cette liste.",
    "module": "D5"
   },
   {
    "theme": "SPF",
    "q": "À la fin d'un SPF, « -all » signifie...",
    "answers": [
     "Le SPF est désactivé",
     "Accepter mais marquer comme suspect",
     "Tout autre serveur doit être rejeté",
     "Tous les serveurs sont autorisés"
    ],
    "correct": 2,
    "time": 30,
    "point": "-all = échec (rejet) ; ~all = échec « doux » (accepter, marquer) ; ?all = neutre ; +all = tout le monde autorisé (une erreur grave). Limite à connaître : 10 recherches DNS au maximum.",
    "module": "D5"
   },
   {
    "theme": "SPF",
    "q": "Pourquoi SPF seul ne suffit-il pas contre l'usurpation ?",
    "answers": [
     "Il ne contrôle pas l'adresse « De : » que voit le destinataire",
     "Il ne fonctionne qu'en IPv6",
     "Il est chiffré",
     "Il ralentit l'envoi des mails"
    ],
    "correct": 0,
    "time": 30,
    "point": "SPF vérifie l'expéditeur technique (l'enveloppe, « MAIL FROM »), pas le « De : » affiché. Un escroc peut passer SPF avec son propre domaine et afficher le vôtre. C'est DMARC qui fait le lien.",
    "module": "D5"
   },
   {
    "theme": "DKIM",
    "q": "DKIM permet de...",
    "answers": [
     "Bloquer les pièces jointes",
     "Chiffrer le message pour le destinataire",
     "Lister les serveurs d'envoi",
     "Signer le message ; la clé publique est publiée dans le DNS"
    ],
    "correct": 3,
    "time": 30,
    "point": "Le serveur d'envoi signe en-têtes et corps ; la clé publique est en TXT sous <sélecteur>._domainkey.exemple.fr. Message modifié = signature invalide. Même principe que la signature du quiz PKI.",
    "module": "D5"
   },
   {
    "theme": "DMARC",
    "q": "DMARC ajoute à SPF et DKIM...",
    "answers": [
     "Une liste noire mondiale",
     "Le chiffrement des mails",
     "La signature des pièces jointes",
     "L'alignement avec le « De : » et une politique en cas d'échec"
    ],
    "correct": 3,
    "time": 30,
    "point": "_dmarc.exemple.fr TXT \"v=DMARC1; p=reject; rua=mailto:dmarc@exemple.fr\". DMARC exige que SPF ou DKIM valide le domaine du « De : », et dit au destinataire quoi faire sinon.",
    "module": "D5"
   },
   {
    "theme": "DMARC",
    "q": "Une politique DMARC « p=none » signifie...",
    "answers": [
     "Rejeter tous les mails du domaine",
     "DMARC est mal configuré et ignoré",
     "Observer seulement : les mails usurpés sont livrés",
     "Les mails sont chiffrés"
    ],
    "correct": 2,
    "time": 30,
    "point": "none = observer (et recevoir les rapports rua) ; quarantine = indésirables ; reject = refus. On commence par none pour voir qui envoie, puis on durcit. Rester à none pour toujours ne protège personne.",
    "module": "D5"
   },
   {
    "theme": "DMARC",
    "q": "Les rapports DMARC « rua » servent à...",
    "answers": [
     "Recevoir une copie de tous les mails",
     "Payer le service DMARC",
     "Savoir qui envoie du courrier en votre nom, légitime ou non",
     "Débloquer les mails en quarantaine"
    ],
    "correct": 2,
    "time": 30,
    "point": "Chaque jour, les grands destinataires envoient des statistiques : quelles IP ont utilisé votre domaine, et le résultat SPF/DKIM. Indispensable avant de passer à p=reject, et pour détecter une usurpation.",
    "module": "D5"
   },
   {
    "theme": "MTA-STS",
    "q": "MTA-STS protège le courrier entre serveurs contre...",
    "answers": [
     "Le spam",
     "Le retour forcé au texte clair (STARTTLS supprimé en chemin)",
     "Les pièces jointes malveillantes",
     "Les fautes de frappe dans les adresses"
    ],
    "correct": 1,
    "time": 30,
    "point": "Entre serveurs, le chiffrement (STARTTLS) est opportuniste : un attaquant peut le retirer. MTA-STS publie « chez moi, TLS obligatoire, avec un certificat valide » (TXT _mta-sts + fichier en HTTPS).",
    "module": "D5"
   },
   {
    "theme": "TLS-RPT",
    "q": "L'enregistrement _smtp._tls (TLS-RPT) sert à...",
    "answers": [
     "Signer les mails",
     "Recevoir des rapports sur les échecs de chiffrement vers vos serveurs",
     "Remplacer MTA-STS",
     "Activer TLS sur le serveur web"
    ],
    "correct": 1,
    "time": 30,
    "point": "Compagnon de MTA-STS et de DANE : les autres serveurs vous signalent les connexions qui n'ont pas pu être chiffrées. Une attaque de rétrogradation devient visible.",
    "module": "D5"
   },
   {
    "theme": "Null MX",
    "q": "Un domaine n'envoie et ne reçoit jamais de mail. On publie...",
    "answers": [
     "Seulement un MX vers le serveur web",
     "Un SPF « +all »",
     "Rien : sans MX, il est protégé",
     "Un MX nul, un SPF « -all » et un DMARC « p=reject »"
    ],
    "correct": 3,
    "time": 30,
    "point": "MX 0 . (RFC 7505) : « je ne reçois rien ». v=spf1 -all : « personne n'envoie pour moi ». p=reject : « refusez tout ce qui prétend venir de moi ». Les domaines inactifs sont des cibles faciles d'usurpation.",
    "module": "D5"
   },
   {
    "theme": "SSHFP",
    "q": "L'enregistrement SSHFP publie...",
    "answers": [
     "L'empreinte des clés d'hôte d'un serveur SSH",
     "Le port SSH du serveur",
     "La liste des utilisateurs SSH",
     "La clé privée de l'administrateur"
    ],
    "correct": 0,
    "time": 30,
    "point": "ssh-keygen -r <nom> génère les SSHFP. Avec ssh -o VerifyHostKeyDNS=yes, le client vérifie la clé du serveur dans le DNS au lieu de demander « Are you sure you want to continue connecting ? ».",
    "module": "D6"
   },
   {
    "theme": "SSHFP",
    "q": "Pour que le client SSH fasse confiance à un SSHFP sans rien demander, il faut...",
    "answers": [
     "Que la zone soit signée DNSSEC et la réponse validée",
     "Que le port 22 soit fermé",
     "Que le serveur utilise RSA",
     "Que l'utilisateur soit root"
    ],
    "correct": 0,
    "time": 30,
    "point": "Sans DNSSEC, un attaquant qui ment au DNS mentirait aussi sur l'empreinte. Avec une réponse validée (ad), le premier contact SSH (TOFU) devient vérifiable. Toujours la même chaîne de confiance.",
    "module": "D6"
   },
   {
    "theme": "HTTPS RR",
    "q": "Le nouvel enregistrement HTTPS (type 65) permet notamment de...",
    "answers": [
     "Remplacer le certificat TLS",
     "Stocker le contenu de la page",
     "Annoncer HTTP/3 et les clés du chiffrement du nom du site (ECH)",
     "Bloquer HTTP"
    ],
    "correct": 2,
    "time": 30,
    "point": "RFC 9460 (2023) : le navigateur apprend dès la résolution les protocoles (h3) et les clés ECH, qui chiffrent le nom du site dans la poignée TLS. Moins de fuite, moins d'allers-retours.",
    "module": "D6"
   },
   {
    "theme": "Adoption",
    "q": "CAA, DMARC « reject », MTA-STS, DNSSEC : pourquoi si peu de domaines les ont ?",
    "answers": [
     "Ils ralentissent fortement le DNS",
     "Ils sont payants",
     "Ils sont interdits en Europe",
     "Peu connus, et la peur de casser le site ou le mail"
    ],
    "correct": 3,
    "time": 30,
    "point": "Tous gratuits et normalisés. Les freins : méconnaissance, peur de bloquer un envoi légitime, personne n'en est responsable. Votre audit vient de le mesurer : c'est un levier simple pour un administrateur.",
    "module": "D6"
   }
  ]
 }
];
