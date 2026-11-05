/* Hardening Arena — écran joueur (téléphone). */
(function () {
  "use strict";
  var B = window.BTA, $ = function (s) { return document.querySelector(s); };
  var proto = location.protocol === "https:" ? "wss" : "ws";
  var ws, myScore = 0, answered = false, finished = false;
  var timer = new B.Timer($("#qTimer"));   // même décompte que l'écran animateur
  // Reprise après coupure : jeton reçu à l'arrivée, gardé dans le navigateur (veille, rechargement).
  var KEY = "bta-rejoin", rj = null, retries = 0, MAX_RETRIES = 10;
  function loadRj() { try { var o = JSON.parse(localStorage.getItem(KEY)); return o && o.pin && o.rejoin ? o : null; } catch (e) { return null; } }
  function saveRj(o) { rj = o; try { localStorage.setItem(KEY, JSON.stringify(o)); } catch (e) {} }
  function clearRj() { rj = null; try { localStorage.removeItem(KEY); } catch (e) {} }

  // Code pré-rempli via /play?pin=123456
  var p = new URLSearchParams(location.search).get("pin");
  if (p) { $("#pin").value = p.replace(/\D/g, "").slice(0, 6); $("#name").focus(); }
  $("#pin").addEventListener("input", function () { this.value = this.value.replace(/\D/g, "").slice(0, 6); });

  function show(id) { ["joinCard", "lobby", "q", "res", "end"].forEach(function (s) { $("#" + s).classList.toggle("hide", s !== id); }); }
  function send(o) { try { ws.send(JSON.stringify(o)); } catch (e) {} }

  function join() { send({ t: "join", pin: $("#pin").value.trim(), name: $("#name").value.trim() }); }
  function connect() {
    var sock = ws = new WebSocket(proto + "://" + location.host);
    ws.onopen = function () { if (rj) send({ t: "rejoin", pin: rj.pin, rejoin: rj.rejoin }); else join(); };
    ws.onclose = function (ev) {
      if (finished || sock !== ws) return;
      timer.stop();
      if (ev && ev.code === 4001) return kicked("Exclu par l'animateur.");
      show("joinCard");
      if (rj && retries < MAX_RETRIES) {
        // Partie en cours : on revient tout seul à sa place (1 s, 2 s, 4 s… plafonné à 10 s).
        $("#joinErr").textContent = "Connexion perdue : reconnexion en cours…";
        $("#joinBtn").disabled = true;
        setTimeout(connect, Math.min(1000 * Math.pow(2, retries++), 10000));
        return;
      }
      $("#joinErr").textContent = rj ? "Connexion perdue. Rechargez la page pour revenir à votre place."
        : "Connexion perdue. Rejoignez à nouveau.";
      $("#joinBtn").disabled = !!rj;
    };
    ws.onmessage = function (ev) {
      var m; try { m = JSON.parse(ev.data); } catch (e) { return; }
      if (m.t === "kicked") { ws = null; kicked(m.msg); }
      else if (m.t === "error") {
        if (m.code === "rejoin") clearRj();   // jeton périmé (partie terminée, serveur relancé) : formulaire normal
        $("#joinErr").textContent = m.msg; $("#joinBtn").disabled = false; show("joinCard");
      }
      else if (m.t === "joined") {
        if (m.rejoin) saveRj({ pin: m.pin, rejoin: m.rejoin });
        retries = 0;
        $("#lobbyName").textContent = m.name;
        $("#lobbyPos").classList.toggle("hide", m.mode !== "positionnement");
        show("lobby");
      }
      else if (m.t === "question") renderQ(m);
      else if (m.t === "answer_ack") { answered = true; lockOpts(m.choice); }
      else if (m.t === "result") renderResult(m);
      else if (m.t === "end") renderEnd(m);
    };
  }

  // Exclu par l'animateur : pas de reconnexion automatique, le code est à retaper.
  function kicked(msg) {
    clearRj(); retries = 0; timer.stop();
    $("#pin").value = "";
    $("#joinErr").textContent = msg + " Pour revenir, retapez le code de la partie.";
    $("#joinBtn").disabled = false; show("joinCard");
  }

  function renderQ(m) {
    answered = false; show("q");
    $("#qTheme").textContent = m.module ? m.module + " · " + m.theme : m.theme; $("#qScore").textContent = myScore + " pt";
    $("#qText").textContent = m.q;
    timer.start(m.remaining !== undefined ? m.remaining : (m.time || 20));   // remaining : reprise en cours de question
    $("#waitAns").classList.add("hide");
    var g = $("#opts"); B.clear(g); g.classList.remove("hide");
    m.answers.forEach(function (txt, i) {
      var b = B.tile("button", "opt", i, txt);
      b.onclick = function () { if (answered) return; send({ t: "answer", choice: i }); answered = true; lockOpts(i); };
      g.appendChild(b);
    });
  }
  function lockOpts(choice) {
    var btns = $("#opts").children;
    for (var i = 0; i < btns.length; i++) { btns[i].disabled = true; btns[i].classList.toggle("off", i !== choice); }
    $("#waitAns").classList.remove("hide");
  }
  function renderResult(m) {
    myScore = m.score; timer.stop(); show("res");
    $("#resIcon").textContent = m.yourCorrect ? "✅" : "❌";
    $("#resText").textContent = m.yourCorrect ? "Bonne réponse !" : "Raté…";
    if (m.mode === "positionnement") {
      // Pas de classement : seulement son propre score.
      $("#resPts").textContent = "Bonnes réponses : " + m.score + " / " + m.asked;
      $("#resRank").textContent = "";
      return;
    }
    $("#resPts").textContent = (m.gained > 0 ? "+" + m.gained + " points" : "0 point") + " · Total : " + m.score;
    $("#resRank").textContent = "Position : " + m.rank + " / " + m.of;
  }
  function renderEnd(m) {
    finished = true; clearRj(); timer.stop(); show("end");
    if (m.mode === "positionnement") {
      $("#endRank").textContent = "Votre résultat : " + m.score + " / " + m.total + " (" + m.pct + " %)";
      $("#endScore").textContent = "Détail par module (bonnes réponses) :";
      var ul = $("#endModules"); B.clear(ul); ul.classList.remove("hide");
      var aRevoir = m.aRevoir || [];
      (m.modules || []).forEach(function (x) {
        var ko = aRevoir.indexOf(x.module) >= 0;
        ul.appendChild(B.el("li", ko ? "ko" : "", x.module + " : " + x.ok + " / " + x.total + (ko ? "  → à faire" : "")));
      });
      var adv = $("#endAdvice"); adv.classList.remove("hide");
      adv.textContent = aRevoir.length ? "Modules du T0 conseillés : " + aRevoir.join(", ") + ". Le formateur vous dira comment les suivre."
        : "Aucun module à reprendre. Bravo !";
      return;
    }
    $("#endRank").textContent = "Classé " + m.rank + " / " + m.of;
    $("#endScore").textContent = "Score final : " + m.score + " points";
  }

  $("#joinBtn").onclick = function () {
    $("#joinErr").textContent = "";
    if (!/^\d{6}$/.test($("#pin").value.trim())) { $("#joinErr").textContent = "Le code de partie fait 6 chiffres."; return; }
    if (!$("#name").value.trim()) { $("#joinErr").textContent = "Nom requis."; return; }
    $("#joinBtn").disabled = true;
    clearRj(); retries = 0;                                  // arrivée volontaire = nouveau joueur
    if (ws && ws.readyState === 1) join(); else connect();   // après une erreur, la connexion reste ouverte
  };
  $("#name").addEventListener("keydown", function (e) { if (e.key === "Enter") $("#joinBtn").click(); });

  // Page rechargée en cours de partie : reprendre sa place (sauf si l'URL vise une autre partie).
  rj = loadRj();
  if (rj && (!p || p === rj.pin)) { $("#pin").value = rj.pin; $("#joinErr").textContent = "Reprise de votre partie…"; $("#joinBtn").disabled = true; connect(); }
  else if (rj) clearRj();
})();
