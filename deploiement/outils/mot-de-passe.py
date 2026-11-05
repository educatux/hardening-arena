#!/usr/bin/env python3
"""Mot de passe lisible, facile à dicter ou projeter : 3 mots + 2 chiffres (ex. « pomme-sable-lune-42 »).

  mot-de-passe.py           → mot de passe de séance (3 mots, ~31 bits : 256³ x 100)
  mot-de-passe.py --fort    → mot de passe formateur (6 mots, ~55 bits)

Tirage par « secrets » (CSPRNG). Entropie volontairement modeste pour la séance : il est
renouvelé à chaque séance, haché en bcrypt, et Caddy limite le débit par IP — une attaque
en ligne n'a ni le temps ni le débit pour l'épuiser.
"""
import secrets
import sys

MOTS = """
abri acier agent algue ambre ancre anneau arbre arche argile atlas aube avion azur
badge balle bambou banane barque bateau baton bille biscuit blason bleu bois bonnet bouee
boule bourse brise brume bulle cabane cactus cadre caillou camion canal canard canne
capuche carafe carte castor cerise chaise chalet chat chene cheval chou cible cigale
citron clef cloche clou coffre col colline comete compas coq corde corail cotte coussin
crabe craie crayon creme cube cuivre cygne dauphin delta dense dessert diamant digue
disque dragon dune eclair ecorce ecran ecume encre epice epine escale etoile falaise
fanal farine fenetre fer ferme feuille figue filet flamme fleche fleur flute foret fosse
fourmi fraise frene fusee galet gant gazon gilet girafe givre glace gland globe gomme
gourde grain granit grappe grenier grive guepe harpe herbe hibou hiver horloge ile iris
jardin jasmin jonc jungle kayak kiwi lac lame lampe lapin laurier lavande legume lettre
lierre lime lin lion livre loupe loutre lune lynx mangue manteau marbre marche mare
melon menthe miel moulin mouette mousse mouton mur myrtille nacre navire neige nid noix
nuage oasis ocean olive ombre onde orage orange orchidee ortie otarie ours paille palme
panda panier papier parc perle phare piano pierre pin pinceau pluie plume poire pomme
pont port poulpe prairie prune puits quai radis rame rameau raisin recif renard requin
riviere roche roseau ruche sable sapin satin saule sel serre silex soleil source sucre
tapis terre tigre tilleul toile tomate torrent tortue tour trefle tresor tulipe vague
vallee vent verger village violon voile volcan zebre bocal muguet
""".split()
assert len(set(MOTS)) == len(MOTS) >= 256, "liste de mots trop courte ou en double"
MOTS = MOTS[:256]

n = 6 if "--fort" in sys.argv[1:] else 3
print("-".join(secrets.choice(MOTS) for _ in range(n)) + f"-{secrets.randbelow(100):02d}")
