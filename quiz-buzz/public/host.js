/* Hardening Arena — écran animateur (vidéoprojecteur). */
(function () {
  "use strict";
  var B = window.BTA, $ = function (s) { return document.querySelector(s); };
  var proto = location.protocol === "https:" ? "wss" : "ws";
  var timer = new B.Timer($("#timer"));
  var ws = null, lastQ = null, revealed = false, retries = 0;
  var mode = "classique", bilan = null;   // bilan = rapport de fin du mode positionnement

  // Stockage de session (onglet) : clé animateur + partie en cours (pour survivre à un rechargement).
  function sget(k) { try { return sessionStorage.getItem(k); } catch (e) { return null; } }
  function sset(k, v) { try { if (v === null) sessionStorage.removeItem(k); else sessionStorage.setItem(k, v); } catch (e) {} }

  // La clé arrive par l'URL (#cle=...) puis disparaît de la barre d'adresse (écran projeté).
  var h = location.hash.match(/(?:^#|&)cle=([^&]+)/);
  if (h) { sset("ha-key", decodeURIComponent(h[1])); history.replaceState(null, "", location.pathname); }

  function show(id) { ["keyCard", "pickCard", "lobby", "game", "end", "posEnd"].forEach(function (s) { $("#" + s).classList.toggle("hide", s !== id); }); }
  function send(o) { if (ws && ws.readyState === 1) { var g = sget("ha-game"); if (g) o.token = JSON.parse(g).token; ws.send(JSON.stringify(o)); } }

  function askKey(msg) { sset("ha-key", null); $("#keyErr").textContent = msg || ""; show("keyCard"); $("#keyInput").focus(); }

  function connect() {
    var key = sget("ha-key");
    if (!key) return askKey();
    var sock = ws = new WebSocket(proto + "://" + location.host);
    sock.onopen = function () {
      retries = 0; $("#connErr").textContent = "";
      var g = sget("ha-game");
      if (g) { g = JSON.parse(g); sock.send(JSON.stringify({ t: "host_resume", key: key, pin: g.pin, token: g.token })); }
      else sock.send(JSON.stringify({ t: "host_quizzes", key: key }));
    };
    sock.onclose = function () {
      if (sock.intentional || sock !== ws) return;
      $("#connErr").textContent = "Connexion au serveur perdue… nouvelle tentative.";
      if (retries++ < 30) setTimeout(connect, 2000);
      else $("#connErr").textContent = "Connexion au serveur perdue. Rechargez la page.";
    };
    sock.onmessage = function (ev) {
      var m; try { m = JSON.parse(ev.data); } catch (e) { return; }
      if (m.t === "error") {
        if (m.code === "key") { sock.intentional = true; sock.close(); return askKey(m.msg); }
        if (m.code === "resume") { sset("ha-game", null); return sock.send(JSON.stringify({ t: "host_quizzes", key: key })); }
        if (m.code === "quiz") { $("#connErr").textContent = m.msg; return onQuizzes(m.quizzes || []); }
        if (m.code === "mode") { $("#connErr").textContent = m.msg; return show("pickCard"); }
        $("#connErr").textContent = m.msg;
      }
      else if (m.t === "quizzes") onQuizzes(m.quizzes || []);
      else if (m.t === "created") onCreated(m);
      else if (m.t === "players") onPlayers(m.players);
      else if (m.t === "host_question") onQuestion(m);
      else if (m.t === "answered") $("#answered").textContent = "Réponses reçues : " + m.count + " / " + m.total;
      else if (m.t === "host_reveal") onReveal(m);
      else if (m.t === "host_end") { if (m.mode === "positionnement") onPosEnd(m.report); else onEnd(m.leaderboard); }
      else if (m.t === "host_csv") download(m.filename, m.csv);
    };
  }

  function onQuizzes(list) {
    var sel = $("#quizSel"), last = sget("ha-quiz"); B.clear(sel);
    list.forEach(function (q) {
      var o = B.el("option", "", q.title + " (" + q.total + " questions)"); o.value = q.id;
      if (q.id === last) o.selected = true;
      sel.appendChild(o);
    });
    $("#pickInfo").textContent = list.length ? list.length + " quiz disponible(s) sur ce serveur." : "Aucun quiz sur le serveur.";
    $("#pickBtn").disabled = !list.length;
    show("pickCard"); sel.focus();
  }
  function onCreated(m) {
    sset("ha-game", JSON.stringify({ pin: m.pin, token: m.token }));
    if (m.quiz) sset("ha-quiz", m.quiz);
    mode = m.mode === "positionnement" ? "positionnement" : "classique";
    $("#lobbyTitle").textContent = m.title + " · " + m.total + " questions" + (mode === "positionnement" ? " · positionnement" : "");
    $("#joinWho").textContent = mode === "positionnement" ? "les apprenants" : "les équipes";
    $("#lobbyPos").classList.toggle("hide", mode !== "positionnement");
    if (m.seuil) $("#endSeuil").value = m.seuil;
    if (m.seuilModule) $("#endSeuilMod").value = m.seuilModule;
    $("#pin").textContent = m.pin;
    $("#joinUrl").textContent = location.host + "/play";
    show("lobby");
  }
  function onPlayers(list) {
    var el = $("#teams"); B.clear(el);
    list.forEach(function (p) {
      var chip = B.el("span", "chip", p.name);
      // Exclure (salle d'attente) : le joueur devra retaper le code pour revenir.
      var x = B.el("button", "", "×");
      x.type = "button"; x.title = "Exclure"; x.setAttribute("aria-label", "Exclure " + p.name);
      x.onclick = function () { x.disabled = true; send({ t: "kick", pid: p.pid }); };
      chip.appendChild(x);
      el.appendChild(chip);
    });
    var who = mode === "positionnement" ? "apprenant(s) connecté(s)" : "équipe(s) connectée(s)";
    $("#waiting").textContent = list.length ? list.length + " " + who : "En attente…";
    $("#startBtn").disabled = list.length === 0;
  }
  function onQuestion(m) {
    lastQ = m; revealed = false; show("game");
    $("#theme").textContent = m.theme;
    $("#qnum").textContent = (m.idx + 1) + " / " + m.total;
    $("#qtext").textContent = m.q;
    var a = $("#answers"); B.clear(a);
    m.answers.forEach(function (txt, i) { a.appendChild(B.tile("div", "ans", i, txt)); });
    $("#reveal").classList.add("hide");
    $("#answered").textContent = ""; B.clear($("#lb"));
    $("#revealBtn").disabled = false; $("#nextBtn").disabled = true;
    $("#bar").style.width = (m.idx / m.total * 100) + "%";
    timer.start(m.remaining !== undefined ? m.remaining : (m.time || 20));
  }
  function onReveal(m) {
    if (!lastQ || revealed) return; revealed = true; timer.stop();
    var nodes = $("#answers").children;
    for (var i = 0; i < nodes.length; i++) nodes[i].classList.add(i === m.correct ? "good" : "dim");
    B.reveal($("#reveal"), lastQ.answers[m.correct], m.point, m.module);
    $("#answered").textContent = "Réponses reçues : " + m.answeredCount + " / " + m.total +
      (m.correctCount !== undefined ? " · bonnes réponses : " + m.correctCount : "");
    if (m.leaderboard) B.leaderboard($("#lb"), m.leaderboard, { max: 5 });
    $("#revealBtn").disabled = true; $("#nextBtn").disabled = false;
    $("#bar").style.width = ((lastQ.idx + 1) / lastQ.total * 100) + "%";
  }
  function onEnd(lb) {
    timer.stop(); show("end");
    B.leaderboard($("#finalLb"), lb || [], { podium: true, unit: "pts" });
  }

  // ---- Bilan du mode positionnement (recalculé ici quand l'animateur change les seuils) ----
  function seuilDe(input, def) {
    var v = Number(input.value);
    return Number.isInteger(v) && v >= 1 && v <= 100 ? v : def;
  }
  function onPosEnd(r) {
    timer.stop(); bilan = r; show("posEnd");
    $("#posTitle").textContent = r.title + " · " + r.total + " question(s) posée(s)";
    $("#endSeuil").value = r.seuil; $("#endSeuilMod").value = r.seuilModule;
    renderBilan();
  }
  function renderBilan() {
    if (!bilan) return;
    var seuil = seuilDe($("#endSeuil"), bilan.seuil), seuilMod = seuilDe($("#endSeuilMod"), bilan.seuilModule);
    var tb = $("#posRows"), reussis = 0, rates = {};
    B.clear(tb);
    bilan.players.forEach(function (p) {
      var ok = p.total > 0 && 100 * p.score >= seuil * p.total;
      if (ok) reussis++;
      var aRevoir = p.modules.filter(function (m) { return 100 * m.ok < seuilMod * m.total; })
        .map(function (m) { rates[m.module] = (rates[m.module] || 0) + 1; return m.module; });
      var tr = B.el("tr", ok ? "ok" : "ko");
      tr.appendChild(B.el("td", p.gone ? "gone" : "", p.name + (p.gone ? " (déconnecté)" : "")));
      tr.appendChild(B.el("td", "num", p.score + " / " + p.total));
      tr.appendChild(B.el("td", "num pc", p.pct + " %"));
      var detail = p.modules.map(function (m) { return m.module + " " + m.ok + "/" + m.total; }).join(" · ");
      var td = B.el("td", "", aRevoir.length ? aRevoir.join(", ") : "aucun");
      td.title = detail;
      tr.appendChild(td);
      tb.appendChild(tr);
    });
    var n = bilan.players.length, majorite = n > 0 && reussis * 2 > n;
    var sum = $("#posSummary");
    sum.textContent = reussis + " / " + n + " à " + seuil + " % ou plus : " +
      (majorite ? "majorité atteinte → T1 normal (T0 conseillé aux autres)." : "majorité non atteinte → donner les modules T0 conseillés.");
    sum.className = "summary " + (majorite ? "ok" : "ko");
    var top = Object.keys(rates).sort(function (a, b) { return rates[b] - rates[a]; })
      .map(function (k) { return k + " (" + rates[k] + ")"; });
    $("#posModules").textContent = top.length ? "Modules à revoir, par nombre d'apprenants : " + top.join(", ") + "." : "Aucun module à revoir.";
  }
  function download(name, text) {
    var safe = /^[A-Za-z0-9._-]{1,100}$/.test(name || "") ? name : "positionnement.csv";
    // BOM : Excel lit l'UTF-8 (accents des prénoms) ; séparateur « ; » (Excel en français).
    var url = URL.createObjectURL(new Blob(["\ufeff" + text], { type: "text/csv;charset=utf-8" }));
    var a = B.el("a"); a.href = url; a.download = safe; a.className = "hide";
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
  }
  $("#endSeuil").addEventListener("input", renderBilan);
  $("#endSeuilMod").addEventListener("input", renderBilan);
  $("#csvBtn").onclick = function () {
    if (!bilan) return;
    send({ t: "csv", seuil: seuilDe($("#endSeuil"), bilan.seuil), seuilModule: seuilDe($("#endSeuilMod"), bilan.seuilModule) });
  };
  $("#modeSel").onchange = function () { $("#posSettings").classList.toggle("hide", this.value !== "positionnement"); };

  $("#keyBtn").onclick = function () {
    var v = $("#keyInput").value.trim(); if (!v) return;
    sset("ha-key", v); $("#keyInput").value = ""; connect();
  };
  $("#pickBtn").onclick = function () {
    var id = $("#quizSel").value, key = sget("ha-key");
    if (!id || !key || !ws || ws.readyState !== 1) return;
    $("#connErr").textContent = "";
    var o = { t: "host_create", key: key, quiz: id };
    if ($("#modeSel").value === "positionnement") {
      o.mode = "positionnement";
      o.seuil = seuilDe($("#seuilIn"), 60); o.seuilModule = seuilDe($("#seuilModIn"), 50);
    }
    ws.send(JSON.stringify(o));
  };
  $("#keyInput").addEventListener("keydown", function (e) { if (e.key === "Enter") $("#keyBtn").click(); });
  $("#startBtn").onclick = function () { send({ t: "start" }); };
  $("#revealBtn").onclick = function () { send({ t: "reveal" }); };
  $("#nextBtn").onclick = function () { send({ t: "next" }); };
  $("#endBtn").onclick = function () { if (confirm("Terminer la partie maintenant et afficher le classement ?")) send({ t: "end" }); };
  $("#newBtn").onclick = $("#newBtn2").onclick = function () {
    if (bilan && !confirm("Nouvelle partie : le bilan affiché sera perdu. Avez-vous exporté le CSV ?")) return;
    bilan = null; sset("ha-game", null); if (ws) { ws.intentional = true; ws.close(); } connect();
  };
  document.addEventListener("keydown", function (e) {
    if ($("#game").classList.contains("hide")) return;
    if (e.key === " " || e.key === "ArrowRight" || e.key === "Enter") {
      e.preventDefault(); send({ t: revealed ? "next" : "reveal" });
    }
  });

  connect();
})();
