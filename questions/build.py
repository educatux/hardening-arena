#!/usr/bin/env python3
"""Génère les supports de quiz à partir des sources questions/*.json.

    python3 questions/build.py                         # valide + génère tous les quiz
    python3 questions/build.py --source t1-j3.json     # un seul quiz (xlsx + quiz-buzz)
    python3 questions/build.py --check                 # valide seulement (n'écrit rien)

Une source = un quiz ; son identifiant est le nom du fichier sans extension
(manche1, t1-j1...). Sorties :
  quiz-app/quizzes.js                  registre de TOUS les quiz (appli autonome, file://)
  quiz-app/quizzes-publics.js          registre des seuls quiz de questions/publics.txt : celui que
                                       sert /arena/ en libre service (réponses lisibles par tous)
  quiz-buzz/quizzes/<id>.json          un fichier par quiz (serveur multi-téléphones)
  kahoot/kahoot-import-<id>.xlsx       import tableur Kahoot (nécessite openpyxl)

Dans la source, la bonne réponse est le champ "bonne" ; l'ordre d'affichage est
mélangé de façon reproductible (graine "graine" du fichier) : même source = mêmes
fichiers. La répartition de la bonne réponse par position est affichée ; au-delà de
MAX_POSITION occurrences sur une même position, la validation échoue (changez la
graine). Champ facultatif "module" par question (ex. "L3") : repris dans quiz-app et
quiz-buzz (bilan par module du mode positionnement), ignoré par l'export Kahoot.
Python 3 standard ; openpyxl seulement pour le .xlsx (facultatif).
"""
import argparse
import json
import random
import re
import sys
from collections import Counter
from pathlib import Path

ICI = Path(__file__).resolve().parent
DIAG = ICI.parent
OUT_JS = DIAG / "quiz-app" / "quizzes.js"
OUT_JS_PUBLIC = DIAG / "quiz-app" / "quizzes-publics.js"
# Quiz en libre service : un identifiant par ligne, « # » = commentaire. Rien n'est public
# tant qu'il n'y est pas : y ajouter un quiz seulement APRÈS l'avoir joué en séance.
PUBLICS = ICI / "publics.txt"
OUT_BUZZ = DIAG / "quiz-buzz" / "quizzes"
OUT_KAHOOT = DIAG / "kahoot"

# Limites de l'import tableur Kahoot (type Quiz).
MAX_Q, MAX_R = 120, 75
TEMPS_KAHOOT = {5, 10, 20, 30, 60, 90, 120, 240}
ID_OK = re.compile(r"^[a-z0-9][a-z0-9-]{0,40}$")
# Champ facultatif « module » (ex. L3, C5) : rattache la question à un module du T0 ;
# le mode positionnement de quiz-buzz compte les bonnes réponses par module.
MODULE_OK = re.compile(r"^[A-Za-z0-9][A-Za-z0-9-]{0,11}$")


def max_position(n):
    """Plafond d'occurrences de la bonne réponse sur une même position (9 pour 15 questions)."""
    return max(2, round(n * 0.6))


def sources(choix):
    if choix:
        p = Path(choix)
        if not p.is_absolute() and not p.exists():
            p = ICI / p
        if not p.exists():
            sys.exit(f"source introuvable : {choix}")
        return [p.resolve()]
    return sorted(ICI.glob("*.json"))


def charger(path):
    with path.open(encoding="utf-8") as f:
        return json.load(f)


def valider(doc, ident):
    errs = []
    if not ID_OK.match(ident):
        errs.append(f"nom de fichier « {ident} » : minuscules, chiffres et tirets seulement")
    if not isinstance(doc.get("titre"), str) or not doc["titre"].strip():
        errs.append("champ « titre » manquant")
    qs = doc.get("questions") or []
    if not qs:
        errs.append("aucune question")
    for n, q in enumerate(qs, 1):
        ou = f"Q{n}"
        manque = [c for c in ("theme", "question", "bonne", "pieges", "temps", "revision") if c not in q]
        if manque:
            errs.extend(f"{ou} : champ « {c} » manquant" for c in manque)
            continue
        reps = [q["bonne"], *q["pieges"]]
        if not 2 <= len(reps) <= 4:
            errs.append(f"{ou} : 2 à 4 réponses attendues (bonne + 1 à 3 pièges), {len(reps)} trouvées")
        if len(q["question"]) > MAX_Q:
            errs.append(f"{ou} : question trop longue pour Kahoot ({len(q['question'])} > {MAX_Q})")
        for r in reps:
            if not isinstance(r, str) or not r.strip():
                errs.append(f"{ou} : réponse vide")
            elif len(r) > MAX_R:
                errs.append(f"{ou} : réponse trop longue pour Kahoot ({len(r)} > {MAX_R}) : {r}")
        if len(set(reps)) != len(reps):
            errs.append(f"{ou} : réponses en double")
        if "module" in q and not (isinstance(q["module"], str) and MODULE_OK.match(q["module"])):
            errs.append(f"{ou} : module « {q['module']} » invalide (lettres, chiffres, tirets ; 12 caractères max)")
        if q["temps"] not in TEMPS_KAHOOT:
            errs.append(f"{ou} : temps {q['temps']} s non accepté par Kahoot {sorted(TEMPS_KAHOOT)}")
    return errs


def melanger(doc, ident):
    """Bonne réponse en 1re position dans la source -> ordre mélangé, index recalculé."""
    rng = random.Random(doc.get("graine", 1852))
    out = []
    for q in doc["questions"]:
        paires = list(enumerate([q["bonne"], *q["pieges"]]))
        rng.shuffle(paires)
        item = {
            "theme": q["theme"],
            "q": q["question"],
            "answers": [r for _, r in paires],
            "correct": next(i for i, (orig, _) in enumerate(paires) if orig == 0),
            "time": q["temps"],
            "point": q["revision"],
        }
        if "module" in q:          # repris par quiz-app et quiz-buzz, ignoré par l'export Kahoot
            item["module"] = q["module"]
        out.append(item)
    return {"id": ident, "title": doc["titre"], "questions": out}


def repartition(quiz):
    return dict(sorted(Counter(q["correct"] + 1 for q in quiz["questions"]).items()))


def ecrire_xlsx(quiz, dest):
    try:
        import openpyxl
        from openpyxl.styles import Alignment, Font, PatternFill
    except ImportError:
        print(f"  !! openpyxl absent : {dest.name} NON régénéré.\n"
              "     Installez-le (pip install openpyxl) ou lancez : uv run --with openpyxl python3 questions/build.py")
        return False
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Kahoot"
    # Lignes 1-8 ignorées par Kahoot : aide-mémoire. Questions à partir de la ligne 9.
    ws["B1"] = f"{quiz['title']} - BlueTeam Academy"
    ws["B1"].font = Font(bold=True, size=12)
    ws["B2"] = "Format d'import tableur Kahoot. Ne pas modifier la structure des colonnes."
    ws["B3"] = "Colonne B = Question (<=120). C-F = reponses (<=75). G = temps (sec). H = bonne(s) reponse(s)."
    ws["B5"] = "Les questions commencent ligne 9. Fichier genere par questions/build.py : ne pas editer a la main."
    for r in (1, 2, 3, 5):
        ws[f"B{r}"].alignment = Alignment(wrap_text=False)
    heads = ["", "Question - max 120 characters", "Answer 1 - max 75 characters", "Answer 2 - max 75 characters",
             "Answer 3 - max 75 characters", "Answer 4 - max 75 characters", "Time limit (sec)", "Correct answer(s)"]
    fill = PatternFill("solid", fgColor="FFF2CC")
    for i, h in enumerate(heads, start=1):
        c = ws.cell(row=8, column=i, value=h)
        c.font = Font(bold=True)
        c.fill = fill
    for row, q in enumerate(quiz["questions"], start=9):
        ws.cell(row=row, column=2, value=q["q"])
        for i, rep in enumerate(q["answers"]):
            ws.cell(row=row, column=3 + i, value=rep)
        ws.cell(row=row, column=7, value=q["time"])
        ws.cell(row=row, column=8, value=str(q["correct"] + 1))
    for col, w in {"A": 3, "B": 62, "C": 30, "D": 30, "E": 30, "F": 30, "G": 14, "H": 16}.items():
        ws.column_dimensions[col].width = w
    dest.parent.mkdir(exist_ok=True)
    wb.save(dest)
    return True


def publics():
    if not PUBLICS.exists():
        return []
    ids = []
    for ligne in PUBLICS.read_text(encoding="utf-8").splitlines():
        ligne = ligne.split("#", 1)[0].strip()
        if ligne:
            ids.append(ligne)
    return ids


def ecrire_registre(dest, registre):
    dest.write_text(
        "/* Généré par questions/build.py : ne pas éditer. */\nwindow.QUIZZES = "
        + json.dumps(registre, ensure_ascii=False, indent=1) + ";\n", encoding="utf-8")


def preparer(path):
    """Charge, valide et mélange une source. Renvoie (quiz, erreurs)."""
    ident = path.stem
    doc = charger(path)
    errs = valider(doc, ident)
    if errs:
        return None, errs
    quiz = melanger(doc, ident)
    rep = repartition(quiz)
    plafond = max_position(len(quiz["questions"]))
    if max(rep.values()) > plafond:
        errs.append(f"bonne réponse trop souvent à la même position {rep} (max {plafond}) : changez « graine »")
    return quiz, errs


def main():
    ap = argparse.ArgumentParser(description="Génère les supports de quiz (quiz-app, quiz-buzz, Kahoot).")
    ap.add_argument("--source", help="une seule source (ex. t1-j1.json) ; défaut : questions/*.json")
    ap.add_argument("--check", action="store_true", help="valide seulement, n'écrit rien")
    args = ap.parse_args()

    choisies = sources(args.source)
    if not choisies:
        print("Aucune source questions/*.json")
        return 1
    # Le registre de quiz-app contient toujours TOUS les quiz : on prépare donc tout,
    # mais on ne détaille et n'exporte que les sources choisies.
    toutes = sorted(ICI.glob("*.json"))
    if args.source and choisies[0] not in toutes:
        toutes.append(choisies[0])
    quiz_par_source, echec = {}, False
    for path in toutes:
        quiz, errs = preparer(path)
        if path in choisies or errs:
            if errs:
                echec = True
                print(f"ERREUR dans {path.name} :")
                for e in errs:
                    print("  -", e)
            else:
                n = len(quiz["questions"])
                print(f"OK  {path.name:<34} {n:>2} questions, bonne réponse par position {repartition(quiz)}"
                      f"  « {quiz['title']} »")
        quiz_par_source[path] = quiz
    par_id = {q["id"]: q for q in quiz_par_source.values() if q}
    inconnus = [i for i in publics() if i not in par_id]
    if inconnus:
        echec = True
        print(f"ERREUR dans {PUBLICS.name} : quiz inconnu(s) {', '.join(inconnus)}")
    positionnement = [i for i in publics() if i.endswith("-positionnement")]
    if positionnement:   # publié, il ne mesurerait plus rien : refus, pas seulement un commentaire
        echec = True
        print(f"ERREUR dans {PUBLICS.name} : quiz de positionnement interdit(s) en libre service : {', '.join(positionnement)}")
    if echec:
        return 1
    if args.check:
        return 0

    registre = [quiz_par_source[p] for p in toutes]
    ecrire_registre(OUT_JS, registre)
    print("  ->", OUT_JS.relative_to(DIAG), f"({len(registre)} quiz)")
    libres = [par_id[i] for i in publics()]
    ecrire_registre(OUT_JS_PUBLIC, libres)
    print("  ->", OUT_JS_PUBLIC.relative_to(DIAG), f"({len(libres)} quiz en libre service : {PUBLICS.name})")
    OUT_BUZZ.mkdir(exist_ok=True)
    for path in choisies:
        quiz = quiz_par_source[path]
        dest = OUT_BUZZ / f"{quiz['id']}.json"
        dest.write_text(json.dumps(quiz, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print("  ->", dest.relative_to(DIAG))
        xlsx = OUT_KAHOOT / f"kahoot-import-{quiz['id']}.xlsx"
        if ecrire_xlsx(quiz, xlsx):
            print("  ->", xlsx.relative_to(DIAG))
    return 0


if __name__ == "__main__":
    sys.exit(main())
