/* Hardening Arena par BlueTeam Academy — utilitaires d'affichage communs
   (quiz-app et quiz-buzz). Tout texte venant des données ou des joueurs passe
   par textContent : jamais d'innerHTML avec du contenu variable. */
(function () {
  "use strict";
  var NS = "http://www.w3.org/2000/svg";
  // Formes des tuiles de réponse (brand/tokens : a1 triangle, a2 losange, a3 cercle, a4 carré).
  var SHAPES = [
    ["polygon", { points: "12,2.5 22.5,21 1.5,21" }],
    ["polygon", { points: "12,1.5 22.5,12 12,22.5 1.5,12" }],
    ["circle", { cx: "12", cy: "12", r: "10" }],
    ["rect", { x: "2.5", y: "2.5", width: "19", height: "19", rx: "2" }]
  ];
  var LABELS = ["Violet (triangle)", "Orange (losange)", "Bleu (cercle)", "Sarcelle (carré)"];

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined && text !== null) e.textContent = String(text);
    return e;
  }

  function shape(i) {
    var s = document.createElementNS(NS, "svg");
    s.setAttribute("viewBox", "0 0 24 24");
    s.setAttribute("class", "shape");
    s.setAttribute("aria-hidden", "true");
    var d = SHAPES[i % 4], p = document.createElementNS(NS, d[0]);
    Object.keys(d[1]).forEach(function (k) { p.setAttribute(k, d[1][k]); });
    s.appendChild(p);
    return s;
  }

  // Tuile de réponse : <tag class="cls aN"><svg/><span>texte</span></tag>
  function tile(tag, cls, i, text) {
    var t = el(tag, cls + " a" + i);
    t.setAttribute("aria-label", LABELS[i % 4] + " : " + text);
    t.appendChild(shape(i));
    t.appendChild(el("span", "", text));
    return t;
  }

  function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }

  // Classement : [{name, score}] -> lignes .lbrow (+ podium optionnel pour les 3 premiers)
  function leaderboard(container, rows, opts) {
    opts = opts || {};
    clear(container);
    var list = rows.slice(0, opts.max || rows.length);
    if (opts.podium && list.length) {
      var pod = el("div", "podium"), order = [1, 0, 2];
      order.forEach(function (k) {
        var r = list[k]; if (!r) return;
        var st = el("div", "step s" + (k + 1));
        st.appendChild(el("div", "nm", r.name));
        st.appendChild(el("div", "pts", r.score + " " + (opts.unit || "pts")));
        st.appendChild(el("div", "block", k + 1));
        pod.appendChild(st);
      });
      container.appendChild(pod);
    }
    list.forEach(function (r, i) {
      var row = el("div", "lbrow" + (i < 3 ? " p" + (i + 1) : ""));
      row.appendChild(el("span", "pos", i + 1));
      row.appendChild(el("span", "nm", r.name));
      row.appendChild(el("span", "pts", r.score + (opts.unit ? " " + opts.unit : "")));
      container.appendChild(row);
    });
  }

  // Minuteur visuel (le vrai minuteur du mode buzz est côté serveur).
  function Timer(node) { this.node = node; this.iv = null; this.left = 0; }
  Timer.prototype.start = function (sec) {
    var self = this; this.stop(); this.left = sec; this.paint();
    this.iv = setInterval(function () { self.left = Math.max(0, self.left - 1); self.paint(); if (!self.left) self.stop(); }, 1000);
  };
  Timer.prototype.stop = function () { if (this.iv) { clearInterval(this.iv); this.iv = null; } };
  Timer.prototype.paint = function () { this.node.textContent = this.left; this.node.classList.toggle("low", this.left <= 5); };

  // Bloc « bonne réponse + point à réviser » (+ module du T0 si la question en a un)
  function reveal(node, answer, point, module) {
    clear(node);
    node.appendChild(el("span", "ok", "Bonne réponse : "));
    node.appendChild(document.createTextNode(answer));
    if (point) node.appendChild(el("span", "rev", point));
    if (module) node.appendChild(el("span", "mod", "Module " + module + " : à reprendre si vous vous êtes trompé"));
    node.classList.remove("hide");
  }

  window.BTA = { el: el, shape: shape, tile: tile, clear: clear, leaderboard: leaderboard, Timer: Timer, reveal: reveal };
})();
