/* Hardening Arena — entraînement en solo : on répond, la correction et le point de cours
   s'affichent aussitôt ; bilan par thème (ou module) et reprise des seules erreurs.
   Script externe (pas d'inline) : compatible avec la CSP stricte de /arena/. */
(function () {
  "use strict";
  var $ = function (s) { return document.querySelector(s); };
  var QUIZZES = Array.isArray(window.QUIZZES) ? window.QUIZZES : [];
  if (!window.BTA) { $("#loadErr").classList.remove("hide"); return; }
  if (!QUIZZES.length) {   // registre vide (aucun quiz en libre service pour l'instant) : pas une panne
    $("#emptyInfo").classList.remove("hide"); $("#startBtn").disabled = true; $("#quizSel").disabled = true;
  }
  var B = window.BTA;
  var BEST_KEY = "ha-entrainement", LAST_KEY = "ha-quiz";

  var quiz = null;          // quiz choisi
  var serie = [];           // questions de la série en cours (réponses remélangées)
  var idx = 0, answered = false, ok = 0;
  var results = [];         // {q, choix, juste}
  var complete = false;     // série = le quiz entier (seule celle-ci compte pour le meilleur score)

  // thème clair / sombre (mémorisé localement, même clé que index.html)
  try { var saved = localStorage.getItem("ha-theme"); if (saved) document.documentElement.setAttribute("data-theme", saved); } catch (e) {}
  $("#themeBtn").onclick = function () {
    var cur = document.documentElement.getAttribute("data-theme");
    var nxt = cur === "dark" ? "light" : cur === "light" ? "dark" : (matchMedia("(prefers-color-scheme: dark)").matches ? "light" : "dark");
    document.documentElement.setAttribute("data-theme", nxt);
    try { localStorage.setItem("ha-theme", nxt); } catch (e) {}
  };

  function show(id) { ["home", "quiz", "end"].forEach(function (s) { $("#" + s).classList.toggle("hide", s !== id); }); }
  function melange(a) { a = a.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  function pct(n, d) { return d ? Math.round(n * 100 / d) : 0; }

  // Meilleurs scores : { <id du quiz>: { ok, total, date } } — confort local, jamais indispensable.
  function lireBest() { try { return JSON.parse(localStorage.getItem(BEST_KEY)) || {}; } catch (e) { return {}; } }
  function ecrireBest(o) { try { localStorage.setItem(BEST_KEY, JSON.stringify(o)); } catch (e) {} }
  function texteBest(qz) {
    var b = lireBest()[qz.id];
    return b ? "Votre meilleur score sur ce quiz complet : " + b.ok + " / " + b.total + " (" + pct(b.ok, b.total) + " %), le " + b.date + "." : "";
  }

  // ----- Accueil -----
  var sel = $("#quizSel");
  QUIZZES.forEach(function (qz, i) { var o = B.el("option", "", qz.title + " (" + (qz.questions || []).length + " q.)"); o.value = String(i); sel.appendChild(o); });
  function choisir(i) {
    quiz = QUIZZES[i] || null;
    $("#bestInfo").textContent = quiz ? texteBest(quiz) : "";
    try { if (quiz && quiz.id) localStorage.setItem(LAST_KEY, quiz.id); } catch (e) {}
  }
  // Quiz demandé par l'adresse (entrainement.html?quiz=dns-1, liens de la page d'accueil), sinon le dernier joué.
  var start = 0, voulu = new URLSearchParams(location.search).get("quiz");
  try { if (!voulu) voulu = localStorage.getItem(LAST_KEY); } catch (e) {}
  QUIZZES.forEach(function (qz, i) { if (qz.id === voulu) start = i; });
  if (QUIZZES.length) { sel.value = String(start); choisir(start); }
  sel.onchange = function () { choisir(Number(sel.value)); };

  // Une question jouée = mêmes données, réponses dans un ordre neuf (on ne retient pas une position).
  function preparer(q) {
    var ordre = melange([0, 1, 2, 3].slice(0, q.answers.length));
    return { src: q, answers: ordre.map(function (k) { return q.answers[k]; }), correct: ordre.indexOf(q.correct) };
  }

  function lancer(questions, entier) {
    if (!questions.length) return;
    complete = entier;
    serie = questions.map(preparer);
    idx = 0; ok = 0; results = [];
    show("quiz"); afficher();
  }
  $("#startBtn").onclick = function () {
    if (!quiz) return;
    var qs = quiz.questions || [], n = Number($("#countSel").value);
    if ($("#shuffleChk").checked || n) qs = melange(qs);
    if (n && n < qs.length) qs = qs.slice(0, n);
    lancer(qs, qs.length === (quiz.questions || []).length);
  };

  // ----- Question -----
  function afficher() {
    var q = serie[idx]; answered = false;
    $("#themeBadge").textContent = q.src.module ? q.src.module + " · " + q.src.theme : q.src.theme;
    $("#qnum").textContent = (idx + 1) + " / " + serie.length;
    $("#scoreBadge").textContent = ok + " ✔";
    $("#qtext").textContent = q.src.q;
    var a = $("#answers"); B.clear(a);
    q.answers.forEach(function (txt, i) {
      var b = B.tile("button", "ans", i, txt);
      b.onclick = function () { repondre(i); };
      a.appendChild(b);
    });
    var r = $("#reveal"); r.classList.add("hide"); r.classList.remove("miss");
    $("#nextBtn").disabled = true;
    $("#bar").style.width = (idx / serie.length * 100) + "%";
  }

  function repondre(i) {
    if (answered) return; answered = true;
    var q = serie[idx], juste = i === q.correct, nodes = $("#answers").children;
    if (juste) ok++;
    results.push({ q: q.src, choix: q.answers[i], juste: juste });
    for (var k = 0; k < nodes.length; k++) {
      nodes[k].disabled = true;
      nodes[k].classList.add(k === q.correct ? "good" : k === i ? "bad" : "dim");
    }
    var r = $("#reveal");
    B.reveal(r, q.answers[q.correct], q.src.point);
    r.classList.toggle("miss", !juste);
    r.insertBefore(B.el("span", "verdict", juste ? "Bonne réponse ! " : "Raté. "), r.firstChild);
    $("#scoreBadge").textContent = ok + " ✔";
    $("#bar").style.width = ((idx + 1) / serie.length * 100) + "%";
    var n = $("#nextBtn"); n.disabled = false; n.textContent = idx < serie.length - 1 ? "Question suivante →" : "Voir mon bilan →";
    n.focus();
  }

  function suivante() {
    if (!answered) return;
    if (idx < serie.length - 1) { idx++; afficher(); } else bilan();
  }
  $("#nextBtn").onclick = suivante;
  $("#stopBtn").onclick = function () { complete = false; bilan(); };

  document.addEventListener("keydown", function (e) {
    if ($("#quiz").classList.contains("hide")) return;
    var k = "1234".indexOf(e.key);
    if (k >= 0 && !answered && k < serie[idx].answers.length) { e.preventDefault(); repondre(k); }
    else if (answered && (e.key === "Enter" || e.key === " " || e.key === "ArrowRight")) { e.preventDefault(); suivante(); }
  });

  // ----- Bilan -----
  function bilan() {
    show("end");
    var total = results.length, p = pct(ok, total);
    $("#endIcon").textContent = p >= 80 ? "🏆" : p >= 50 ? "👍" : "📚";
    $("#endScore").textContent = total ? ok + " / " + total + " bonnes réponses (" + p + " %)" : "Aucune réponse";

    var best = lireBest(), b = quiz && best[quiz.id], record = "";
    if (complete && quiz && quiz.id && (!b || ok * b.total > b.ok * total)) {
      best[quiz.id] = { ok: ok, total: total, date: new Date().toISOString().slice(0, 10) };
      ecrireBest(best); record = "Nouveau meilleur score sur ce quiz !";
    }
    $("#endBest").textContent = record || (complete ? texteBest(quiz) : "Série partielle : elle ne compte pas pour le meilleur score.");

    // Par module s'il y en a, sinon par thème ; sous 70 % = à revoir.
    var parModule = results.some(function (r) { return r.q.module; }), groupes = {}, ordre = [];
    results.forEach(function (r) {
      var g = parModule ? (r.q.module || "—") : r.q.theme;
      if (!groupes[g]) { groupes[g] = { ok: 0, n: 0 }; ordre.push(g); }
      groupes[g].n++; if (r.juste) groupes[g].ok++;
    });
    $("#groupTitle").textContent = parModule ? "Par module" : "Par thème";
    if (parModule) ordre.sort();          // R0, R1, R2… plutôt que l'ordre du tirage
    var ul = $("#endThemes"); B.clear(ul);
    ordre.forEach(function (g) {
      var x = groupes[g], ko = pct(x.ok, x.n) < 70;
      ul.appendChild(B.el("li", ko ? "ko" : "", g + " : " + x.ok + " / " + x.n + (ko ? "  → à revoir" : "")));
    });

    var erreurs = results.filter(function (r) { return !r.juste; }), list = $("#errList"); B.clear(list);
    $("#errTitle").textContent = erreurs.length ? "Vos erreurs (" + erreurs.length + ")" : "Aucune erreur : bravo !";
    erreurs.forEach(function (r) {
      var d = B.el("div", "reveal miss errcard");
      d.appendChild(B.el("span", "eq", r.q.q));
      d.appendChild(B.el("span", "mine", "Votre réponse : " + r.choix));
      d.appendChild(B.el("span", "ok", "Bonne réponse : " + r.q.answers[r.q.correct]));
      if (r.q.point) d.appendChild(B.el("span", "rev", r.q.point));
      list.appendChild(d);
    });
    var re = $("#retryErr");
    re.classList.toggle("hide", !erreurs.length);
    re.textContent = "Refaire mes erreurs (" + erreurs.length + ")";
    re.onclick = function () { lancer(erreurs.map(function (r) { return r.q; }), false); };
  }
  $("#again").onclick = function () { $("#startBtn").click(); };
  $("#other").onclick = function () { if (quiz) $("#bestInfo").textContent = texteBest(quiz); show("home"); };
})();
