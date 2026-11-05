#!/usr/bin/env python3
"""Lit ou modifie UNE variable du fichier .env du déploiement, côté serveur.

  env-set.py <fichier.env> <CLE>          valeur lue sur stdin (jamais en argument :
                                          rien dans « ps », l'historique ou les journaux)
  env-set.py <fichier.env> --get <CLE>    affiche la valeur (variables NON secrètes seulement)

Écriture atomique (fichier temporaire + rename), droits 600 conservés. Les valeurs sont
écrites entre guillemets simples : docker compose n'y interprète pas les « $ » (hachés
bcrypt « $2a$14$... »).
"""
import os
import re
import sys
import tempfile

SECRETS = {"HOST_KEY", "FORMATEUR_HASH", "SEANCE_HASH"}


def lire(path):
    with open(path, encoding="utf-8") as f:
        return f.read().splitlines()


def valeur(lignes, cle):
    for ligne in lignes:
        m = re.match(rf"^{re.escape(cle)}=(.*)$", ligne)
        if m:
            v = m.group(1).strip()
            if len(v) >= 2 and v[0] == v[-1] and v[0] in "'\"":
                v = v[1:-1]
            return v
    return None


def main():
    if len(sys.argv) == 4 and sys.argv[2] == "--get":
        cle = sys.argv[3]
        if cle in SECRETS:
            sys.exit(f"refus : {cle} est un secret")
        v = valeur(lire(sys.argv[1]), cle)
        if v is None:
            sys.exit(1)
        print(v)
        return
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    path, cle = sys.argv[1], sys.argv[2]
    if not re.fullmatch(r"[A-Z][A-Z0-9_]*", cle):
        sys.exit("clé invalide")
    v = sys.stdin.readline().rstrip("\n")
    if not v or "'" in v or "\n" in v:
        sys.exit("valeur vide ou contenant une apostrophe : refusée")
    lignes = lire(path) if os.path.exists(path) else []
    nouvelle = f"{cle}='{v}'"
    sortie, trouve = [], False
    for ligne in lignes:
        if re.match(rf"^{re.escape(cle)}=", ligne):
            sortie.append(nouvelle)
            trouve = True
        else:
            sortie.append(ligne)
    if not trouve:
        sortie.append(nouvelle)
    d = os.path.dirname(os.path.abspath(path))
    fd, tmp = tempfile.mkstemp(dir=d, prefix=".env.")
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            f.write("\n".join(sortie) + "\n")
        os.chmod(tmp, 0o600)
        os.replace(tmp, path)
    except BaseException:
        os.unlink(tmp)
        raise


if __name__ == "__main__":
    main()
