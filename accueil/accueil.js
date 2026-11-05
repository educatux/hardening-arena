/* Hardening Arena — page d'accueil : thème clair / sombre et liste des quiz en libre service
   (registre public servi sous /arena/quizzes.js). Script externe : CSP sans 'unsafe-inline'. */
(function () {
  "use strict";
  var $ = function (s) { return document.querySelector(s); };

  try { var saved = localStorage.getItem("ha-theme"); if (saved) document.documentElement.setAttribute("data-theme", saved); } catch (e) {}
  var tb = $("#themeBtn");
  if (tb) tb.onclick = function () {
    var cur = document.documentElement.getAttribute("data-theme");
    var nxt = cur === "dark" ? "light" : cur === "light" ? "dark" : (matchMedia("(prefers-color-scheme: dark)").matches ? "light" : "dark");
    document.documentElement.setAttribute("data-theme", nxt);
    try { localStorage.setItem("ha-theme", nxt); } catch (e) {}
  };

  var ul = $("#quizList");
  if (!ul || !window.BTA) return;
  var B = window.BTA, quiz = Array.isArray(window.QUIZZES) ? window.QUIZZES : [];
  if (!quiz.length) { $("#quizNone").classList.remove("hide"); return; }
  quiz.forEach(function (qz) {
    var li = B.el("li");
    var a = B.el("a", "", qz.title.replace(/^Hardening Arena\s*[—-]\s*/, ""));
    a.href = "/arena/entrainement.html?quiz=" + encodeURIComponent(qz.id);
    li.appendChild(a);
    li.appendChild(B.el("span", "n", (qz.questions || []).length + " questions"));
    ul.appendChild(li);
  });
})();
