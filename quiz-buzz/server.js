'use strict';
/*
 * Hardening Arena par BlueTeam Academy — serveur de quiz « buzz » multi-téléphones.
 * Licence MIT. Seule dépendance : `ws`.
 *
 * Pensé pour un Wi-Fi de salle de classe (réseau partagé, public curieux) :
 *  - les BONNES RÉPONSES (et le point de révision) ne quittent le serveur qu'à la révélation,
 *    y compris vers l'écran animateur ;
 *  - créer/piloter une partie exige la clé animateur (HOST_KEY), puis un jeton par partie ;
 *  - entrées validées et bornées, messages WebSocket limités en taille et en débit,
 *    tentatives de code de partie limitées par IP, nombre de joueurs/parties plafonné ;
 *  - fichiers statiques servis depuis une liste blanche, avec en-têtes de sécurité (CSP...).
 *
 * Deux modes, choisis par l'animateur à la création : « classique » (équipes, 500 à 1000 points
 * selon la rapidité, classement) et « positionnement » (individuel, 1 point par bonne réponse,
 * pas de bonus de vitesse, bilan par module réservé à l'animateur + export CSV ; chaque joueur
 * ne voit que son propre résultat).
 *
 * Variables d'environnement : PORT (8080), BIND (0.0.0.0), HOST_KEY (générée si absente),
 * MAX_PLAYERS (60), MAX_GAMES (10), TRUST_PROXY (1 = lire X-Forwarded-For),
 * QUIZZES_DIR (./quizzes : un fichier <id>.json par quiz, généré par ../questions/build.py).
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { WebSocketServer } = require('ws');

const PUBLIC = path.join(__dirname, 'public');
const COMMUN = process.env.COMMUN_DIR || path.join(__dirname, '..', 'commun');

const LIMITS = {
  nameMax: 28,              // longueur max d'un nom d'équipe (caractères)
  maxPayload: 1024,         // octets par message WebSocket
  msgPerWindow: 30,         // messages max par connexion...
  msgWindowMs: 5000,        // ...sur cette fenêtre
  joinFailPerMin: 20,       // codes de partie erronés max par IP (IPv6 : par /64) et par minute
  joinFailGlobalPerMin: 300,// ...et tous clients confondus : contre la rotation d'adresses IPv6
  maxConnections: 400,
  hostGraceMs: 60000,       // l'animateur peut recharger sa page sans perdre la partie
};

// ---- Fichiers statiques (liste blanche, chargés en mémoire au démarrage) -------------
const STATIC_FILES = {
  '/host.html': [PUBLIC, 'host.html'],
  '/host.js': [PUBLIC, 'host.js'],
  '/play.html': [PUBLIC, 'play.html'],
  '/play.js': [PUBLIC, 'play.js'],
  '/commun/bta-quiz.css': [COMMUN, 'bta-quiz.css'],
  '/commun/bta-quiz.js': [COMMUN, 'bta-quiz.js'],
  '/commun/bta-logo.svg': [COMMUN, 'bta-logo.svg'],
};
// '/animateur' : adresse de l'écran animateur derrière Caddy, où '/' est la page d'accueil publique.
const ALIASES = { '/': '/host.html', '/animateur': '/host.html', '/play': '/play.html', '/play/': '/play.html', '/favicon.ico': '/commun/bta-logo.svg' };
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml' };

function loadStatic() {
  const out = new Map();
  for (const [url, [dir, name]] of Object.entries(STATIC_FILES)) {
    const file = path.join(dir, name);
    out.set(url, { body: fs.readFileSync(file), type: MIME[path.extname(name)] });
  }
  return out;
}

function securityHeaders(req) {
  // connect-src explicite : certains navigateurs n'incluent pas ws:/wss: dans 'self'.
  const host = /^[A-Za-z0-9.\-:[\]]{1,255}$/.test(req.headers.host || '') ? req.headers.host : null;
  const connect = host ? `'self' ws://${host} wss://${host}` : "'self'";
  return {
    'Content-Security-Policy': `default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self'; ` +
      `connect-src ${connect}; base-uri 'none'; form-action 'none'; frame-ancestors 'none'`,
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'no-referrer',
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Cross-Origin-Resource-Policy': 'same-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
    'Cache-Control': 'no-cache',
  };
}

// ---- Utilitaires -----------------------------------------------------------------------
const token = (bytes = 16) => crypto.randomBytes(bytes).toString('hex');
function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const ha = crypto.createHash('sha256').update(a).digest();
  const hb = crypto.createHash('sha256').update(b).digest();
  return crypto.timingSafeEqual(ha, hb);
}
/** Nom d'équipe : NFC, sans caractères de contrôle/invisibles (bidi, zero-width...), espaces réduits. */
function cleanName(v) {
  if (typeof v !== 'string') return '';
  const s = v.normalize('NFC').replace(/\p{C}/gu, '').replace(/\s+/g, ' ').trim();
  return Array.from(s).slice(0, LIMITS.nameMax).join('').trim();
}
const isPin = (v) => typeof v === 'string' && /^\d{6}$/.test(v);

const QUIZ_ID = /^[a-z0-9][a-z0-9-]{0,40}$/;
const isQuizId = (v) => typeof v === 'string' && QUIZ_ID.test(v);
const MODULE_ID = /^[A-Za-z0-9][A-Za-z0-9-]{0,11}$/;
const MODES = ['classique', 'positionnement'];
const DEFAULTS = { seuil: 60, seuilModule: 50 };   // % : réussite globale ; module « à revoir » si < seuilModule
/** Pourcentage entier 1..100 ; undefined -> valeur par défaut ; sinon null (refusé). */
function pct(v, def) {
  if (v === undefined) return def;
  return Number.isInteger(v) && v >= 1 && v <= 100 ? v : null;
}

function loadQuestions(file) {
  const quiz = JSON.parse(fs.readFileSync(file, 'utf8'));
  const qs = quiz.questions || [];
  if (!qs.length) throw new Error(`${path.basename(file)} : aucune question`);
  qs.forEach((q, i) => {
    if (!Array.isArray(q.answers) || q.answers.length < 2 || !Number.isInteger(q.correct) ||
        q.correct < 0 || q.correct >= q.answers.length ||
        (q.module !== undefined && !(typeof q.module === 'string' && MODULE_ID.test(q.module))))
      throw new Error(`${path.basename(file)} : question ${i + 1} invalide`);
  });
  return { title: quiz.title || 'Quiz', questions: qs };
}

/** Tous les quiz du dossier : Map(id -> {id, title, questions}), id = nom du fichier sans .json. */
function loadQuizzes(dir) {
  const out = new Map();
  for (const name of fs.readdirSync(dir).filter(n => n.endsWith('.json')).sort()) {
    const id = name.slice(0, -5);
    if (!isQuizId(id)) throw new Error(`${name} : nom de quiz invalide (minuscules, chiffres, tirets)`);
    out.set(id, { id, ...loadQuestions(path.join(dir, name)) });
  }
  if (!out.size) throw new Error(`aucun quiz (*.json) dans ${dir}`);
  return out;
}

// ---- Serveur ---------------------------------------------------------------------------
async function start(opts = {}) {
  const cfg = {
    port: opts.port ?? Number(process.env.PORT || 8080),
    bind: opts.bind ?? (process.env.BIND || '0.0.0.0'),
    hostKey: opts.hostKey ?? (process.env.HOST_KEY || ''),
    maxPlayers: opts.maxPlayers ?? Number(process.env.MAX_PLAYERS || 60),
    maxGames: opts.maxGames ?? Number(process.env.MAX_GAMES || 10),
    // Connexions WebSocket simultanées par adresse IP : une classe entière peut sortir par la même
    // IP (NAT de l'école), mais une seule machine ne doit pas pouvoir occuper tout le serveur.
    maxConnPerIp: opts.maxConnPerIp ?? Number(process.env.MAX_CONN_PER_IP || 80),
    // Partie terminée : effacée de la mémoire (pseudonymes, scores, bilan) après ce délai, même si
    // l'onglet de l'animateur reste ouvert. Le bilan CSV s'exporte avant.
    endedGameMs: opts.endedGameMs ?? Number(process.env.ENDED_GAME_MS || 10 * 60 * 1000),
    trustProxy: opts.trustProxy ?? process.env.TRUST_PROXY === '1',
    quiet: !!opts.quiet,
  };
  const generatedKey = !cfg.hostKey;
  if (generatedKey) cfg.hostKey = token(6);
  const log = cfg.quiet ? () => {} : (...a) => console.log(...a);

  const QUIZZES = loadQuizzes(opts.quizzesDir || process.env.QUIZZES_DIR || path.join(__dirname, 'quizzes'));
  // Liste publique (sans questions ni réponses) pour le sélecteur de l'animateur.
  const quizList = [...QUIZZES.values()].map(({ id, title, questions }) => ({ id, title, total: questions.length }));
  const files = loadStatic();

  // ---- HTTP ----
  const server = http.createServer((req, res) => {
    const headers = securityHeaders(req);
    // Marqueur posé par Caddy sur les seules requêtes qu'il croit être des WebSocket (hors Basic
    // auth) : une requête HTTP ordinaire qui le porte a contourné le filtre, on ne sert rien.
    if (req.headers['x-arena-ws']) {
      res.writeHead(404, { ...headers, 'Content-Type': 'text/plain' });
      return res.end('404');
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(405, { ...headers, Allow: 'GET, HEAD', 'Content-Type': 'text/plain' });
      return res.end('405');
    }
    let p = (req.url || '/').split('?')[0];
    if (p === '/healthz') {
      res.writeHead(200, { ...headers, 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ ok: true, games: games.size }));
    }
    p = ALIASES[p] || p;
    const f = files.get(p);
    if (!f) { res.writeHead(404, { ...headers, 'Content-Type': 'text/plain' }); return res.end('404'); }
    res.writeHead(200, { ...headers, 'Content-Type': f.type, 'Content-Length': f.body.length });
    res.end(req.method === 'HEAD' ? undefined : f.body);
  });

  // ---- État des parties ----
  /* pin -> { pin, token, quiz, mode, seuil, seuilModule, hostWs, hostTimer, players: Map(pid -> joueur),
   *          state, qIndex, qStart, asked, timer }
   * Un joueur qui se déconnecte en cours de partie est gardé (gone: true) : il figure dans le bilan
   * et peut revenir avec son jeton de reprise ; absent, il ne compte plus dans « tout le monde a répondu ». */
  const games = new Map();
  const joinFails = new Map(); // ip (IPv6 : préfixe /64) -> [timestamps]
  const globalFails = { join: [], cle: [] }; // tous clients, par usage : [timestamps]

  function newPin() {
    let pin;
    do { pin = String(crypto.randomInt(100000, 1000000)); } while (games.has(pin));
    return pin;
  }
  function send(ws, obj) { try { if (ws && ws.readyState === 1) ws.send(JSON.stringify(obj)); } catch (e) { /* ignoré */ } }
  const players = (g) => [...g.players.values()].filter(p => !p.gone);
  const isPos = (g) => g.mode === 'positionnement';
  function leaderboard(g) {
    return players(g).map(p => ({ pid: p.pid, name: p.name, score: p.score })).sort((a, b) => b.score - a.score);
  }

  // ---- Mode positionnement : bilan par module (animateur seulement) ----
  const moduleOf = (q) => q.module || q.theme || '?';
  /** Modules (ordre d'apparition) et nombre de questions POSÉES par module. */
  function moduleTotals(g) {
    const totals = {};
    g.quiz.questions.forEach((q, i) => { if (i < g.asked) totals[moduleOf(q)] = (totals[moduleOf(q)] || 0) + 1; });
    return totals;
  }
  function playerReport(g, p, totals, seuil, seuilModule) {
    const total = g.asked;
    const modules = Object.keys(totals).map(m => ({ module: m, ok: p.mods[m] || 0, total: totals[m] }));
    return {
      name: p.name, score: p.score, total,
      pct: total ? Math.round(100 * p.score / total) : 0,
      modules,
      aRevoir: modules.filter(m => 100 * m.ok < seuilModule * m.total).map(m => m.module),
      reussi: total > 0 && 100 * p.score >= seuil * total,
      gone: !!p.gone,
    };
  }
  function report(g, seuil = g.seuil, seuilModule = g.seuilModule) {
    const totals = moduleTotals(g);
    const rows = [...g.players.values()].map(p => playerReport(g, p, totals, seuil, seuilModule))
      .sort((a, b) => a.name.localeCompare(b.name, 'fr'));
    return { quiz: g.quiz.id, title: g.quiz.title, total: g.asked, modules: Object.keys(totals), totals,
      seuil, seuilModule, players: rows, reussis: rows.filter(r => r.reussi).length };
  }
  /** Cellule CSV : guillemets doublés ; préfixe ' si la cellule commence par = + - @ (injection de formule). */
  function csvCell(v) {
    let s = String(v);
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
    return /[;"\r\n]/.test(s) || s !== String(v) ? `"${s.replace(/"/g, '""')}"` : s;
  }
  function csv(g, seuil, seuilModule) {
    const r = report(g, seuil, seuilModule);
    const head = ['apprenant', 'score', 'sur', 'pourcentage', `reussi_${seuil}`, `modules_a_revoir_${seuilModule}`, 'deconnecte'];
    for (const m of r.modules) head.push(`${m}_bonnes`, `${m}_total`);
    const lines = [head.map(csvCell).join(';')];
    for (const p of r.players) {
      const row = [p.name, p.score, p.total, p.pct, p.reussi ? 'oui' : 'non', p.aRevoir.join(' '), p.gone ? 'oui' : 'non'];
      for (const m of p.modules) row.push(m.ok, m.total);
      lines.push(row.map(csvCell).join(';'));
    }
    return lines.join('\r\n') + '\r\n';
  }
  const publicLb = (lb) => lb.map(({ name, score }) => ({ name, score }));
  // pid : seulement vers l'animateur, pour la commande « kick » (exclure en salle d'attente).
  function pushPlayersToHost(g) { send(g.hostWs, { t: 'players', players: players(g).map(p => ({ pid: p.pid, name: p.name })) }); }

  function questionFor(g) {
    // Version SANS bonne réponse ni point de révision : envoyée à l'animateur comme aux joueurs.
    const q = g.quiz.questions[g.qIndex];
    const out = { idx: g.qIndex, total: g.quiz.questions.length, theme: q.theme, q: q.q, answers: q.answers, time: q.time || 20 };
    if (q.module) out.module = q.module;
    return out;
  }

  function startQuestion(g) {
    const q = g.quiz.questions[g.qIndex];
    if (!q) return endGame(g);
    g.state = 'question';
    g.qStart = Date.now();
    g.asked = Math.max(g.asked, g.qIndex + 1);
    for (const p of g.players.values()) { p.answered = false; p.lastCorrect = false; p.lastGain = 0; }
    const pub = questionFor(g);
    send(g.hostWs, { t: 'host_question', ...pub });
    for (const p of g.players.values()) send(p.ws, { t: 'question', ...pub });
    clearTimeout(g.timer);
    g.timer = setTimeout(() => revealQuestion(g), (q.time || 20) * 1000 + 400);
  }

  function hostReveal(g) {
    const q = g.quiz.questions[g.qIndex];
    const act = players(g);
    const m = { t: 'host_reveal', idx: g.qIndex, correct: q.correct, point: q.point,
      answeredCount: act.filter(p => p.answered).length, total: act.length };
    if (q.module) m.module = q.module;
    // Positionnement : pas de classement projeté, seulement le nombre de bonnes réponses.
    if (isPos(g)) m.correctCount = act.filter(p => p.lastCorrect).length;
    else m.leaderboard = publicLb(leaderboard(g));
    return m;
  }

  /** Résultat de la question courante pour UN joueur (révélation, ou reprise après coupure). */
  function resultFor(g, p, lb) {
    const q = g.quiz.questions[g.qIndex];
    if (isPos(g)) return { t: 'result', mode: g.mode, correct: q.correct, yourCorrect: p.lastCorrect, gained: p.lastGain,
      score: p.score, asked: g.asked };
    return { t: 'result', correct: q.correct, yourCorrect: p.lastCorrect, gained: p.lastGain,
      score: p.score, rank: lb.findIndex(e => e.pid === p.pid) + 1, of: g.players.size };
  }

  function revealQuestion(g) {
    if (g.state !== 'question') return;
    clearTimeout(g.timer);
    g.state = 'revealed';
    const lb = leaderboard(g);
    send(g.hostWs, hostReveal(g));
    for (const p of players(g)) send(p.ws, resultFor(g, p, lb));
  }

  function hostEnd(g) {
    return isPos(g) ? { t: 'host_end', mode: g.mode, report: report(g) } : { t: 'host_end', leaderboard: publicLb(leaderboard(g)) };
  }

  /** Fin de partie pour UN joueur : en positionnement, il ne reçoit QUE son propre résultat. */
  function endFor(g, p, lb) {
    if (isPos(g)) {
      const r = playerReport(g, p, moduleTotals(g), g.seuil, g.seuilModule);
      return { t: 'end', mode: g.mode, score: r.score, total: r.total, pct: r.pct, modules: r.modules, aRevoir: r.aRevoir };
    }
    return { t: 'end', score: p.score, rank: lb.findIndex(e => e.pid === p.pid) + 1, of: g.players.size,
      leaderboard: publicLb(lb.slice(0, 5)) };
  }

  function endGame(g) {
    clearTimeout(g.timer);
    g.state = 'ended';
    clearTimeout(g.endTimer);
    g.endTimer = setTimeout(() => closeGame(g, 'Partie terminée : elle est maintenant fermée.'), cfg.endedGameMs);
    g.endTimer.unref();
    send(g.hostWs, hostEnd(g));
    const lb = leaderboard(g);
    for (const p of players(g)) send(p.ws, endFor(g, p, lb));
  }

  /** Renvoie l'état courant à un joueur qui revient après une coupure (jeton de reprise). */
  function resyncPlayer(g, p) {
    send(p.ws, { t: 'joined', name: p.name, pin: g.pin, mode: g.mode, rejoin: p.rejoin });
    if (g.state === 'lobby') return;
    const q = g.quiz.questions[g.qIndex];
    if (g.state === 'question' || g.state === 'revealed') {
      const remaining = g.state === 'question'
        ? Math.max(0, Math.ceil(((q.time || 20) * 1000 - (Date.now() - g.qStart)) / 1000)) : 0;
      send(p.ws, { t: 'question', ...questionFor(g), remaining });
      if (p.answered) send(p.ws, { t: 'answer_ack', choice: p.choice });
      if (g.state === 'revealed') send(p.ws, resultFor(g, p, leaderboard(g)));
    } else if (g.state === 'ended') send(p.ws, endFor(g, p, leaderboard(g)));
  }

  function closeGame(g, msg) {
    clearTimeout(g.timer); clearTimeout(g.hostTimer); clearTimeout(g.endTimer);
    if (g.hostWs) { send(g.hostWs, { t: 'error', msg }); g.hostWs.pin = null; g.hostWs.role = null; }
    for (const p of players(g)) { send(p.ws, { t: 'error', msg }); p.ws.pin = null; p.ws.role = null; p.ws.pid = null; }
    games.delete(g.pin);
  }

  /** Renvoie l'état courant à un animateur qui se reconnecte. */
  function created(g) {
    return { t: 'created', pin: g.pin, token: g.token, quiz: g.quiz.id, total: g.quiz.questions.length, title: g.quiz.title,
      mode: g.mode, seuil: g.seuil, seuilModule: g.seuilModule };
  }
  function resyncHost(g) {
    const QUESTIONS = g.quiz.questions;
    send(g.hostWs, created(g));
    pushPlayersToHost(g);
    if (g.state === 'question') send(g.hostWs, { t: 'host_question', ...questionFor(g),
      remaining: Math.max(0, Math.ceil(((QUESTIONS[g.qIndex].time || 20) * 1000 - (Date.now() - g.qStart)) / 1000)) });
    else if (g.state === 'revealed') {
      send(g.hostWs, { t: 'host_question', ...questionFor(g), remaining: 0 });
      send(g.hostWs, hostReveal(g));
    } else if (g.state === 'ended') send(g.hostWs, hostEnd(g));
  }

  /** Adresse du client, ramenée à son préfixe /64 en IPv6 (une machine dispose de tout un /64 :
   *  limiter par adresse complète serait contournable). Derrière Caddy : X-Real-IP, posé par
   *  Caddy lui-même ({client_ip}), plutôt que X-Forwarded-For que le client peut préremplir. */
  // Adresses d'un proxy de confiance possible : boucle locale et réseaux privés (le réseau Docker
  // interne partagé avec Caddy). Un en-tête d'adresse venant d'ailleurs est ignoré.
  const isPrivate = (a) => /^(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|::1$|f[cd][0-9a-f]{2}:)/i.test(a.replace(/^::ffff:/i, ''));
  function clientIp(req) {
    let ip = req.socket.remoteAddress || '?';
    if (cfg.trustProxy && isPrivate(ip)) {
      if (req.headers['x-real-ip']) ip = String(req.headers['x-real-ip']).trim();
      else if (req.headers['x-forwarded-for']) ip = String(req.headers['x-forwarded-for']).split(',').pop().trim();
    }
    ip = ip.replace(/^::ffff:/i, '');
    if (ip.includes(':')) {
      const full = ip.includes('::')
        ? (() => { const [a, b] = ip.split('::'); const A = a ? a.split(':') : [], Bp = b ? b.split(':') : [];
            return [...A, ...Array(8 - A.length - Bp.length).fill('0'), ...Bp]; })()
        : ip.split(':');
      ip = full.slice(0, 4).map(h => h.toLowerCase().replace(/^0+(?=.)/, '')).join(':') + '::/64';
    }
    return ip;
  }
  // kind : 'join' (code de partie, reprise) ou 'cle' (clé animateur) — plafonds globaux séparés,
  // pour qu'une rafale d'essais de code n'empêche pas l'animateur de créer sa partie.
  function tooManyFails(ip, kind = 'join') {
    const now = Date.now();
    globalFails[kind] = globalFails[kind].filter(t => now - t < 60000);
    if (globalFails[kind].length >= LIMITS.joinFailGlobalPerMin) return true;
    const arr = (joinFails.get(ip) || []).filter(t => now - t < 60000);
    joinFails.set(ip, arr);
    return arr.length >= LIMITS.joinFailPerMin;
  }
  function recordFail(ip, kind = 'join') {
    (joinFails.get(ip) || joinFails.set(ip, []).get(ip)).push(Date.now());
    globalFails[kind].push(Date.now());
  }

  // ---- WebSocket ----
  const wss = new WebSocketServer({
    server,
    maxPayload: LIMITS.maxPayload,
    perMessageDeflate: false,
    verifyClient: ({ req }, cb) => {
      if (wss.clients.size >= LIMITS.maxConnections) return cb(false, 503, 'Serveur plein');
      const ip = clientIp(req);
      let n = 0;
      for (const c of wss.clients) if (c.ip === ip) n++;
      if (n >= cfg.maxConnPerIp) return cb(false, 429, 'Trop de connexions depuis cette adresse');
      // Anti cross-site WebSocket hijacking : l'Origin (si présente) doit correspondre à l'hôte.
      const origin = req.headers.origin;
      if (origin) {
        let ok = false;
        try { ok = new URL(origin).host === req.headers.host; } catch (e) { ok = false; }
        if (!ok) return cb(false, 403, 'Origine refusée');
      }
      cb(true);
    },
  });

  wss.on('connection', (ws, req) => {
    ws.role = null; ws.pin = null; ws.pid = null; ws.alive = true;
    ws.ip = clientIp(req);
    let winStart = Date.now(), winCount = 0;
    ws.on('pong', () => { ws.alive = true; });
    // Indispensable : sans écouteur, un message trop gros ou mal formé ferait planter le processus.
    ws.on('error', () => { ws.terminate(); });

    ws.on('message', (raw, isBinary) => {
      const now = Date.now();
      if (now - winStart > LIMITS.msgWindowMs) { winStart = now; winCount = 0; }
      if (++winCount > LIMITS.msgPerWindow) return ws.close(1008, 'Trop de messages');
      if (isBinary) return;
      let m; try { m = JSON.parse(raw.toString('utf8')); } catch (e) { return; }
      if (!m || typeof m !== 'object' || typeof m.t !== 'string') return;

      // ----- ANIMATEUR : créer ou reprendre une partie (clé animateur exigée) -----
      if (m.t === 'host_create' || m.t === 'host_resume' || m.t === 'host_quizzes') {
        if (ws.role) return;
        if (tooManyFails(ws.ip, 'cle')) return send(ws, { t: 'error', code: 'key', msg: 'Trop de tentatives. Patientez une minute.' });
        if (!safeEqual(m.key, cfg.hostKey)) { recordFail(ws.ip, 'cle'); return send(ws, { t: 'error', code: 'key', msg: 'Clé animateur invalide.' }); }
        if (m.t === 'host_quizzes') return send(ws, { t: 'quizzes', quizzes: quizList });
        if (m.t === 'host_resume') {
          const g = isPin(m.pin) ? games.get(m.pin) : null;
          if (!g || !safeEqual(m.token, g.token)) return send(ws, { t: 'error', code: 'resume', msg: 'Partie introuvable.' });
          if (g.hostWs && g.hostWs !== ws) { g.hostWs.role = null; g.hostWs.close(4000, 'Remplacé'); }
          clearTimeout(g.hostTimer);
          g.hostWs = ws; ws.role = 'host'; ws.pin = g.pin;
          return resyncHost(g);
        }
        // Quiz choisi par l'animateur ; facultatif seulement s'il n'y en a qu'un sur le serveur.
        const quiz = isQuizId(m.quiz) ? QUIZZES.get(m.quiz) : (m.quiz === undefined && QUIZZES.size === 1 ? [...QUIZZES.values()][0] : null);
        if (!quiz) return send(ws, { t: 'error', code: 'quiz', msg: 'Quiz inconnu.', quizzes: quizList });
        // Mode (classique par défaut) et seuils du positionnement (% entiers, 1 à 100).
        const mode = m.mode === undefined ? 'classique' : (MODES.includes(m.mode) ? m.mode : null);
        const seuil = pct(m.seuil, DEFAULTS.seuil), seuilModule = pct(m.seuilModule, DEFAULTS.seuilModule);
        if (!mode || seuil === null || seuilModule === null)
          return send(ws, { t: 'error', code: 'mode', msg: 'Mode ou seuil invalide (seuils : entiers de 1 à 100).' });
        if (games.size >= cfg.maxGames) return send(ws, { t: 'error', msg: 'Trop de parties en cours sur ce serveur.' });
        const g = { pin: newPin(), token: token(), quiz, mode, seuil, seuilModule, hostWs: ws, hostTimer: null, players: new Map(),
          state: 'lobby', qIndex: 0, qStart: 0, asked: 0, timer: null };
        games.set(g.pin, g);
        ws.role = 'host'; ws.pin = g.pin;
        log(`[partie] ${g.pin} créée (${quiz.id}, ${mode})`);
        return send(ws, created(g));
      }

      // ----- JOUEUR rejoint -----
      if (m.t === 'join') {
        if (ws.role) return;
        if (tooManyFails(ws.ip)) return send(ws, { t: 'error', msg: 'Trop de tentatives. Patientez une minute.' });
        const pin = typeof m.pin === 'string' ? m.pin.trim() : '';
        const g = isPin(pin) ? games.get(pin) : null;
        if (!g) { recordFail(ws.ip); return send(ws, { t: 'error', msg: 'Code de partie inconnu.' }); }
        // Tout refus compte comme un échec : sonder l'état d'une partie (commencée, pleine) n'est pas gratuit.
        const refus = (msg) => { recordFail(ws.ip); return send(ws, { t: 'error', msg }); };
        if (g.state !== 'lobby') return refus('La partie a déjà commencé.');
        if (g.players.size >= cfg.maxPlayers) return refus('La partie est complète.');
        const name = cleanName(m.name);
        if (!name) return refus('Nom requis.');
        if (players(g).some(p => p.name.toLocaleLowerCase('fr') === name.toLocaleLowerCase('fr')))
          return refus('Ce nom est déjà pris.');
        const pid = token(8);
        // rejoin : jeton secret du joueur, pour revenir à sa place après une coupure (veille, Wi-Fi).
        const p = { pid, name, ws, rejoin: token(), score: 0, mods: {}, answered: false, choice: null,
          lastCorrect: false, lastGain: 0, gone: false };
        g.players.set(pid, p);
        ws.role = 'player'; ws.pin = g.pin; ws.pid = pid;
        send(ws, { t: 'joined', name, pin: g.pin, mode: g.mode, rejoin: p.rejoin });
        return pushPlayersToHost(g);
      }

      // ----- JOUEUR revient après une coupure (jeton de reprise reçu à l'arrivée) -----
      if (m.t === 'rejoin') {
        if (ws.role) return;
        if (tooManyFails(ws.ip)) return send(ws, { t: 'error', msg: 'Trop de tentatives. Patientez une minute.' });
        const g = isPin(m.pin) ? games.get(m.pin) : null;
        const p = g && typeof m.rejoin === 'string' ? [...g.players.values()].find(x => safeEqual(m.rejoin, x.rejoin)) : null;
        if (!p) {
          recordFail(ws.ip);
          return send(ws, { t: 'error', code: 'rejoin', msg: 'Impossible de reprendre : rejoignez avec un nouveau nom.' });
        }
        // Ancienne connexion encore ouverte (téléphone revenu de veille) : on la remplace sans la compter partie.
        if (p.ws && p.ws !== ws) { p.ws.role = null; p.ws.pid = null; p.ws.close(4000, 'Remplacé'); }
        p.ws = ws; p.gone = false;
        ws.role = 'player'; ws.pin = g.pin; ws.pid = p.pid;
        log(`[partie] ${g.pin} : reprise d'un joueur`);
        resyncPlayer(g, p);
        pushPlayersToHost(g);
        if (g.state === 'question') {
          const act = players(g);
          send(g.hostWs, { t: 'answered', count: act.filter(x => x.answered).length, total: act.length });
        }
        return;
      }

      const g = ws.pin ? games.get(ws.pin) : null;
      if (!g) return;

      // ----- commandes ANIMATEUR : socket animateur ET jeton de la partie -----
      if (['start', 'reveal', 'next', 'end', 'csv', 'kick'].includes(m.t)) {
        if (ws.role !== 'host' || g.hostWs !== ws || !safeEqual(m.token, g.token)) return;
        if (m.t === 'kick') {
          // Exclure un joueur, en salle d'attente seulement : il disparaît (jeton de reprise compris)
          // et ne peut revenir qu'en retapant le code de la partie.
          const p = g.state === 'lobby' && typeof m.pid === 'string' ? g.players.get(m.pid) : null;
          if (!p) return;
          g.players.delete(p.pid);
          if (p.ws) {
            send(p.ws, { t: 'kicked', msg: "Exclu par l'animateur." });
            p.ws.role = null; p.ws.pin = null; p.ws.pid = null;
            p.ws.close(4001, 'Exclu');
          }
          log(`[partie] ${g.pin} : joueur exclu`);
          return pushPlayersToHost(g);
        }
        if (m.t === 'csv') {
          // Export du bilan (positionnement) : seuils facultatifs, validés comme à la création.
          if (!isPos(g)) return send(ws, { t: 'error', code: 'csv', msg: 'Export CSV : mode positionnement seulement.' });
          const seuil = pct(m.seuil, g.seuil), seuilModule = pct(m.seuilModule, g.seuilModule);
          if (seuil === null || seuilModule === null) return send(ws, { t: 'error', code: 'csv', msg: 'Seuil invalide.' });
          const date = new Date().toISOString().slice(0, 10);
          return send(ws, { t: 'host_csv', filename: `positionnement-${g.quiz.id}-${date}.csv`, csv: csv(g, seuil, seuilModule) });
        }
        if (m.t === 'start') { if (g.state === 'lobby' && g.players.size > 0) { g.qIndex = 0; startQuestion(g); } }
        else if (m.t === 'reveal') revealQuestion(g);
        else if (m.t === 'next') {
          if (g.state !== 'revealed') return;
          if (g.qIndex < g.quiz.questions.length - 1) { g.qIndex++; startQuestion(g); } else endGame(g);
        } else if (m.t === 'end') endGame(g);
        return;
      }

      // ----- réponse JOUEUR -----
      if (m.t === 'answer' && ws.role === 'player') {
        if (g.state !== 'question') return;
        const p = g.players.get(ws.pid);
        if (!p || p.answered) return;
        const q = g.quiz.questions[g.qIndex];
        const choice = m.choice;
        if (!Number.isInteger(choice) || choice < 0 || choice >= q.answers.length) return;
        p.answered = true; p.choice = choice;
        const limit = (q.time || 20) * 1000;
        const dt = Math.min(Date.now() - g.qStart, limit);
        p.lastCorrect = choice === q.correct;
        if (isPos(g)) {
          // Positionnement : 1 point par bonne réponse, sans bonus de vitesse ; compte par module.
          p.lastGain = p.lastCorrect ? 1 : 0;
          if (p.lastCorrect) p.mods[moduleOf(q)] = (p.mods[moduleOf(q)] || 0) + 1;
        } else {
          // Score des quiz en direct : bonne réponse = 500 à 1000 points selon la rapidité.
          p.lastGain = p.lastCorrect ? Math.round(500 + 500 * (1 - dt / limit)) : 0;
        }
        p.score += p.lastGain;
        send(ws, { t: 'answer_ack', choice });
        const act = players(g);
        const count = act.filter(x => x.answered).length;
        send(g.hostWs, { t: 'answered', count, total: act.length });
        if (count === act.length) { clearTimeout(g.timer); g.timer = setTimeout(() => revealQuestion(g), 600); }
      }
    });

    ws.on('close', () => {
      const g = ws.pin ? games.get(ws.pin) : null;
      if (!g) return;
      if (ws.role === 'host' && g.hostWs === ws) {
        // L'animateur a fermé/rechargé : on lui laisse un délai pour reprendre la partie.
        g.hostWs = null;
        g.hostTimer = setTimeout(() => closeGame(g, "La partie a été fermée par l'animateur."), LIMITS.hostGraceMs);
        g.hostTimer.unref(); // n'empêche pas l'arrêt du processus (tests, SIGTERM)
      } else if (ws.role === 'player' && ws.pid) {
        const p = g.players.get(ws.pid);
        // Partie commencée : on garde le joueur (score, réponses, bilan) ; il peut revenir avec son jeton.
        if (p && g.state !== 'lobby') { p.gone = true; p.ws = null; } else g.players.delete(ws.pid);
        pushPlayersToHost(g);
        if (g.state === 'question' && players(g).length && players(g).every(x => x.answered)) {
          clearTimeout(g.timer); g.timer = setTimeout(() => revealQuestion(g), 600);
        }
      }
    });
  });

  // Connexions mortes (téléphone en veille, Wi-Fi perdu) + purge du compteur d'échecs.
  const heartbeat = setInterval(() => {
    for (const ws of wss.clients) {
      if (!ws.alive) { ws.terminate(); continue; }
      ws.alive = false; try { ws.ping(); } catch (e) { /* ignoré */ }
    }
    const now = Date.now();
    for (const [ip, arr] of joinFails) if (!arr.some(t => now - t < 60000)) joinFails.delete(ip);
  }, 30000);
  heartbeat.unref();

  return new Promise((resolve) => {
    server.listen(cfg.port, cfg.bind, () => {
      const port = server.address().port;
      log(`[init] ${QUIZZES.size} quiz chargé(s) : ${quizList.map(q => `${q.id} (${q.total})`).join(', ')}`);
      log(`[ready] Hardening Arena (buzz) par BlueTeam Academy — port ${port}`);
      log(`[ready] Joueurs    : http://<IP-du-serveur>:${port}/play`);
      log(`[ready] Animateur  : http://localhost:${port}/#cle=${generatedKey ? cfg.hostKey : '<HOST_KEY>'}`);
      if (generatedKey) log('[ready] (clé générée à chaque démarrage ; fixez HOST_KEY pour la garder)');
      resolve({
        port, server, wss, games,
        close: () => new Promise((r) => {
          clearInterval(heartbeat);
          for (const g of games.values()) { clearTimeout(g.timer); clearTimeout(g.hostTimer); }
          for (const c of wss.clients) c.terminate();
          wss.close(); server.close(() => r());
        }),
      });
    });
  });
}

module.exports = { start, cleanName };

if (require.main === module) {
  start().catch((e) => { console.error('Démarrage impossible :', e.message); process.exit(1); });
  for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => process.exit(0));
}
