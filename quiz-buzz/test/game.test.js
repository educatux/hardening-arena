'use strict';
// Test de bout en bout : serveur sur un port aléatoire + partie courte en WebSocket.
// Lancement : npm test (node:test, aucune dépendance supplémentaire).
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const WebSocket = require('ws');
const { start, cleanName } = require('../server.js');

// Deux quiz de test dans un dossier temporaire (QUIZZES_DIR) : la partie « alpha » est jouée,
// « beta » sert à vérifier que le choix de l'animateur est bien respecté.
const mkq = (theme, n) => Array.from({ length: n }, (_, i) => ({
  theme, q: `${theme} question ${i + 1}`, answers: ['A', 'B', 'C', 'D'], correct: (i + 1) % 4, time: 20, point: `point ${theme} ${i + 1}`,
}));
const FIXTURES = {
  alpha: { id: 'alpha', title: 'Quiz Alpha', questions: mkq('Alpha', 3) },
  beta: { id: 'beta', title: 'Quiz Beta', questions: mkq('Beta', 2) },
  // Positionnement : 4 questions, 2 modules (M1, M2)
  pos: { id: 'pos', title: 'Quiz Pos', questions: mkq('Pos', 4).map((q, i) => ({ ...q, module: i < 2 ? 'M1' : 'M2' })) },
};
const QUESTIONS = FIXTURES.alpha.questions;
const DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'ha-quizzes-'));
for (const [id, quiz] of Object.entries(FIXTURES)) fs.writeFileSync(path.join(DIR, `${id}.json`), JSON.stringify(quiz));
const KEY = 'cle-de-test';
let srv, base, wsUrl;

/** Client WebSocket qui mémorise tous les messages reçus. */
function client(headers) {
  const ws = new WebSocket(wsUrl, { headers });
  ws.msgs = [];
  ws.waiters = [];
  ws.on('message', (d) => {
    const m = JSON.parse(d);
    ws.msgs.push(m);
    ws.waiters = ws.waiters.filter((w) => (w.pred(m) ? (w.resolve(m), false) : true));
  });
  ws.sendJ = (o) => ws.send(JSON.stringify(o));
  ws.wait = (t, ms = 3000) => new Promise((resolve, reject) => {
    const pred = (m) => m.t === t;
    const timer = setTimeout(() => reject(new Error(`timeout en attendant « ${t} »`)), ms);
    ws.waiters.push({ pred, resolve: (m) => { clearTimeout(timer); resolve(m); } });
  });
  ws.opened = new Promise((r, j) => { ws.once('open', r); ws.once('error', j); });
  return ws;
}
const pause = (ms) => new Promise((r) => setTimeout(r, ms));

before(async () => {
  srv = await start({ port: 0, bind: '127.0.0.1', hostKey: KEY, quiet: true, quizzesDir: DIR });
  base = `http://127.0.0.1:${srv.port}`;
  wsUrl = `ws://127.0.0.1:${srv.port}`;
});
after(async () => { await srv.close(); fs.rmSync(DIR, { recursive: true, force: true }); });

test('statique : liste blanche + en-têtes de sécurité', async () => {
  const r = await fetch(base + '/');
  assert.equal(r.status, 200);
  assert.match(r.headers.get('content-security-policy'), /frame-ancestors 'none'/);
  assert.match(r.headers.get('content-security-policy'), /script-src 'self'/);
  assert.equal(r.headers.get('x-content-type-options'), 'nosniff');
  assert.match(await r.text(), /BlueTeam/);
  const anim = await fetch(base + '/animateur');            // adresse derrière Caddy (accueil public sur /)
  assert.equal(anim.status, 200);
  assert.match(await anim.text(), /host\.js/);
  // Faux « upgrade » relayé par Caddy (marqueur X-Arena-Ws) : aucune page servie.
  assert.equal((await fetch(base + '/host.html', { headers: { 'X-Arena-Ws': '1' } })).status, 404);
  const css = await fetch(base + '/commun/bta-quiz.css');
  assert.equal(css.status, 200);
  assert.match(css.headers.get('content-type'), /text\/css/);
  for (const p of ['/server.js', '/../server.js', '/%2e%2e/server.js', '/questions.json', '/quizzes/alpha.json', '/alpha.json', '/package.json'])
    assert.equal((await fetch(base + p)).status, 404, p);
  assert.equal((await fetch(base + '/', { method: 'POST' })).status, 405);
  assert.equal((await fetch(base + '/healthz')).status, 200);
});

test('nettoyage des noms d\'équipe', () => {
  assert.equal(cleanName('  Les\u0000  Durcis‮seurs​ '), 'Les Durcisseurs');
  assert.equal(cleanName('x'.repeat(100)).length, 28);
  assert.equal(cleanName('​​'), '');
  assert.equal(cleanName(42), '');
});

test('partie complète : join, start, answer, reveal, score, fin', async () => {
  // Origine étrangère refusée (cross-site WebSocket hijacking)
  const evil = client({ Origin: 'http://evil.example' });
  await assert.rejects(evil.opened);

  // Animateur : sans clé -> refus ; avec clé -> partie créée + jeton
  const host = client();
  await host.opened;
  host.sendJ({ t: 'host_create', key: 'mauvaise' });
  assert.equal((await host.wait('error')).code, 'key');
  host.sendJ({ t: 'host_create', key: KEY, quiz: 'alpha' });
  const created = await host.wait('created');
  assert.equal(created.quiz, 'alpha');
  assert.equal(created.title, 'Quiz Alpha');
  assert.equal(created.total, QUESTIONS.length);
  assert.match(created.pin, /^\d{6}$/);
  assert.ok(created.token && created.token.length >= 32);

  // Joueurs
  const p1 = client(); const p2 = client();
  await Promise.all([p1.opened, p2.opened]);
  p1.sendJ({ t: 'join', pin: '000000', name: 'X' });
  assert.match((await p1.wait('error')).msg, /inconnu/);
  p1.sendJ({ t: 'join', pin: created.pin, name: '<img src=x onerror=alert(1)>' });
  assert.equal((await p1.wait('joined')).name, '<img src=x onerror=alert(1)>'); // stocké tel quel, affiché via textContent
  p2.sendJ({ t: 'join', pin: created.pin, name: '<IMG SRC=X ONERROR=ALERT(1)>' });
  assert.match((await p2.wait('error')).msg, /déjà pris/);
  p2.sendJ({ t: 'join', pin: created.pin, name: 'Root Canal' });
  await p2.wait('joined');

  // Un joueur ne peut pas piloter la partie, même avec un jeton deviné
  p1.sendJ({ t: 'start', token: 'devine' });
  p1.sendJ({ t: 'start', token: created.token }); // jeton correct mais socket joueur
  host.sendJ({ t: 'start' });                      // socket animateur mais sans jeton
  await pause(200);
  assert.ok(!host.msgs.some((m) => m.t === 'host_question'), 'aucune commande non authentifiée ne doit passer');

  host.sendJ({ t: 'start', token: created.token });
  const hq = await host.wait('host_question');
  const q1 = await p1.wait('question');
  await p2.wait('question');
  // La bonne réponse ne quitte pas le serveur avant la révélation (ni vers l'animateur)
  for (const m of [hq, q1]) { assert.equal(m.correct, undefined); assert.equal(m.point, undefined); }
  assert.deepEqual(q1.answers, QUESTIONS[0].answers);

  // Réponses invalides ignorées, puis vraies réponses
  const good = QUESTIONS[0].correct;
  const bad = (good + 1) % QUESTIONS[0].answers.length;
  p1.sendJ({ t: 'answer', choice: 99 });
  p1.sendJ({ t: 'answer', choice: '0' });
  p1.sendJ({ t: 'answer', choice: good });
  assert.equal((await p1.wait('answer_ack')).choice, good);
  p1.sendJ({ t: 'answer', choice: bad }); // 2e réponse ignorée
  p2.sendJ({ t: 'answer', choice: bad });

  // Tout le monde a répondu -> révélation automatique
  const rev = await host.wait('host_reveal');
  assert.equal(rev.correct, good);
  assert.equal(rev.point, QUESTIONS[0].point);
  const r1 = await p1.wait('result'); const r2 = await p2.wait('result');
  assert.equal(r1.yourCorrect, true);
  assert.ok(r1.score >= 500 && r1.score <= 1000, `score ${r1.score}`);
  assert.equal(r1.rank, 1);
  assert.equal(r2.yourCorrect, false);
  assert.equal(r2.score, 0);
  assert.equal(r2.rank, 2);
  assert.equal(rev.leaderboard[0].name, '<img src=x onerror=alert(1)>');
  assert.equal(rev.leaderboard[0].pid, undefined, 'les identifiants internes ne sortent pas');

  // Question suivante puis fin anticipée
  host.sendJ({ t: 'next', token: created.token });
  assert.equal((await p1.wait('question')).idx, 1);
  host.sendJ({ t: 'end', token: created.token });
  const end = await host.wait('host_end');
  assert.deepEqual(end.leaderboard.map((e) => e.name), ['<img src=x onerror=alert(1)>', 'Root Canal']);
  const e2 = await p2.wait('end');
  assert.equal(e2.rank, 2);

  // Rejoindre une partie commencée : refusé
  const late = client(); await late.opened;
  late.sendJ({ t: 'join', pin: created.pin, name: 'En retard' });
  assert.match((await late.wait('error')).msg, /commencé/);

  for (const c of [host, p1, p2, late]) c.close();
});

test('reprise animateur après rechargement (jeton)', async () => {
  const h1 = client(); await h1.opened;
  h1.sendJ({ t: 'host_create', key: KEY, quiz: 'beta' });
  const c = await h1.wait('created');
  h1.close();
  await pause(100);
  const h2 = client(); await h2.opened;
  h2.sendJ({ t: 'host_resume', key: KEY, pin: c.pin, token: 'faux' });
  assert.equal((await h2.wait('error')).code, 'resume');
  h2.sendJ({ t: 'host_resume', key: KEY, pin: c.pin, token: c.token });
  const again = await h2.wait('created');
  assert.equal(again.pin, c.pin);
  assert.equal(again.quiz, 'beta', 'la reprise garde le quiz choisi');
  h2.close();
});

test('reprise joueur après coupure (jeton) : positionnement, score et question en cours', async () => {
  const PQ = FIXTURES.pos.questions;
  const host = client(); await host.opened;
  host.sendJ({ t: 'host_create', key: KEY, quiz: 'pos', mode: 'positionnement' });
  const c = await host.wait('created');
  const a = client(); const b = client();
  await Promise.all([a.opened, b.opened]);
  a.sendJ({ t: 'join', pin: c.pin, name: 'Alice' });
  const ja = await a.wait('joined');
  assert.ok(ja.rejoin && ja.rejoin.length >= 32, 'jeton de reprise remis à l\'arrivée');
  b.sendJ({ t: 'join', pin: c.pin, name: 'Bob' });
  await b.wait('joined');

  // Q1 : Alice répond juste, Bob aussi ; révélation automatique
  const [qa1, qb1] = [a.wait('question'), b.wait('question')];
  host.sendJ({ t: 'start', token: c.token });
  await Promise.all([qa1, qb1]);
  const [ra1, rb1] = [a.wait('result'), b.wait('result')];
  a.sendJ({ t: 'answer', choice: PQ[0].correct });
  b.sendJ({ t: 'answer', choice: PQ[0].correct });
  await Promise.all([ra1, rb1]);

  // Alice perd la connexion ; la partie continue sans elle (Q2)
  a.close();
  await pause(100);
  const qb2 = b.wait('question');
  host.sendJ({ t: 'next', token: c.token });
  await qb2;

  // Nouvel arrivant refusé une fois la partie commencée
  const late = client(); await late.opened;
  late.sendJ({ t: 'join', pin: c.pin, name: 'Zoé' });
  assert.match((await late.wait('error')).msg, /déjà commencé/);
  late.close();

  // Jeton faux : refusé ; bon jeton : Alice retrouve sa place sur Q2, avec son score
  const a2 = client(); await a2.opened;
  a2.sendJ({ t: 'rejoin', pin: c.pin, rejoin: 'faux' });
  assert.equal((await a2.wait('error')).code, 'rejoin');
  const [j2, q2, n2] = [a2.wait('joined'), a2.wait('question'), host.wait('answered')];
  a2.sendJ({ t: 'rejoin', pin: c.pin, rejoin: ja.rejoin });
  assert.equal((await j2).name, 'Alice');
  const q = await q2;
  assert.equal(q.idx, 1, 'reprise sur la question en cours');
  assert.ok(q.remaining > 0 && !('correct' in q), 'temps restant, sans la réponse');
  assert.equal((await n2).total, 2, 'Alice compte de nouveau parmi les joueurs');

  const [ra2, rb2] = [a2.wait('result'), b.wait('result')];
  a2.sendJ({ t: 'answer', choice: PQ[1].correct });
  b.sendJ({ t: 'answer', choice: (PQ[1].correct + 1) % 4 });
  assert.equal((await ra2).score, 2, 'score de Q1 conservé + Q2');
  await rb2;

  const [ea, he] = [a2.wait('end'), host.wait('host_end')];
  host.sendJ({ t: 'end', token: c.token });
  assert.equal((await ea).score, 2);
  const alice = (await he).report.players.find((p) => p.name === 'Alice');
  assert.equal(alice.gone, false, 'plus marquée déconnectée après la reprise');
  a2.close(); b.close(); host.close();
});

test('reprise joueur après coupure : mode classique, score conservé', async () => {
  const host = client(); await host.opened;
  host.sendJ({ t: 'host_create', key: KEY, quiz: 'alpha' });
  const c = await host.wait('created');
  const p = client(); await p.opened;
  p.sendJ({ t: 'join', pin: c.pin, name: 'Équipe X' });
  const j = await p.wait('joined');
  const q1 = p.wait('question');
  host.sendJ({ t: 'start', token: c.token });
  await q1;
  const r1 = p.wait('result');
  p.sendJ({ t: 'answer', choice: QUESTIONS[0].correct });
  const score = (await r1).score;
  assert.ok(score >= 500);
  p.close();
  await pause(100);
  host.sendJ({ t: 'next', token: c.token });
  await pause(100);
  const p2 = client(); await p2.opened;
  const [q2, e2] = [p2.wait('question'), p2.wait('end')];
  p2.sendJ({ t: 'rejoin', pin: c.pin, rejoin: j.rejoin });
  assert.equal((await q2).idx, 1);
  host.sendJ({ t: 'end', token: c.token });
  assert.equal((await e2).score, score, 'score retrouvé après la reprise');
  p2.close(); host.close();
});

test('exclusion en salle d\'attente : animateur seul, jeton de reprise annulé, retour par le code', async () => {
  const host = client(); await host.opened;
  host.sendJ({ t: 'host_create', key: KEY, quiz: 'beta' });
  const c = await host.wait('created');
  const intrus = client(); await intrus.opened;
  const lst = host.wait('players');
  intrus.sendJ({ t: 'join', pin: c.pin, name: 'Intrus' });
  const j = await intrus.wait('joined');
  const pid = (await lst).players.find((p) => p.name === 'Intrus').pid;
  assert.ok(pid, 'l\'animateur reçoit l\'identifiant du joueur');

  // Un joueur (ou un mauvais jeton) ne peut pas exclure
  const autre = client(); await autre.opened;
  autre.sendJ({ t: 'join', pin: c.pin, name: 'Autre' });
  await autre.wait('joined');
  autre.sendJ({ t: 'kick', pid, token: c.token });
  host.sendJ({ t: 'kick', pid, token: 'faux' });
  await pause(100);
  assert.ok(srv.games.get(c.pin).players.has(pid), 'toujours là');

  // L'animateur exclut : message, fermeture 4001, liste mise à jour
  const [k, closed, lst2] = [intrus.wait('kicked'), new Promise((r) => intrus.once('close', (code) => r(code))), host.wait('players')];
  host.sendJ({ t: 'kick', pid, token: c.token });
  assert.match((await k).msg, /Exclu/);
  assert.equal(await closed, 4001);
  assert.deepEqual((await lst2).players.map((p) => p.name), ['Autre']);

  // Le jeton de reprise ne marche plus ; retaper le code, oui
  const back = client(); await back.opened;
  back.sendJ({ t: 'rejoin', pin: c.pin, rejoin: j.rejoin });
  assert.equal((await back.wait('error')).code, 'rejoin');
  back.sendJ({ t: 'join', pin: c.pin, name: 'Intrus' });
  await back.wait('joined');

  // Partie commencée : plus d'exclusion possible
  const q = back.wait('question');
  host.sendJ({ t: 'start', token: c.token });
  await q;
  const pid2 = [...srv.games.get(c.pin).players.values()].find((p) => p.name === 'Intrus').pid;
  host.sendJ({ t: 'kick', pid: pid2, token: c.token });
  await pause(100);
  assert.ok(srv.games.get(c.pin).players.has(pid2), 'pas d\'exclusion en cours de partie');
  back.close(); autre.close(); host.close();
});

test('choix du quiz : liste sans réponses, quiz inconnu refusé, bon quiz joué', async () => {
  const h = client(); await h.opened;
  h.sendJ({ t: 'host_quizzes', key: 'mauvaise' });
  assert.equal((await h.wait('error')).code, 'key');
  h.sendJ({ t: 'host_quizzes', key: KEY });
  const list = (await h.wait('quizzes')).quizzes;
  assert.deepEqual(list, [{ id: 'alpha', title: 'Quiz Alpha', total: 3 }, { id: 'beta', title: 'Quiz Beta', total: 2 },
    { id: 'pos', title: 'Quiz Pos', total: 4 }]);
  assert.ok(!JSON.stringify(list).includes('correct'), 'la liste ne contient ni questions ni réponses');

  // Quiz absent (plusieurs quiz sur le serveur), inconnu ou mal formé : refusé, aucune partie créée
  const avant = srv.games.size;
  for (const quiz of [undefined, 'gamma', '../alpha', '__proto__', 42]) {
    h.sendJ({ t: 'host_create', key: KEY, quiz });
    const e = await h.wait('error');
    assert.equal(e.code, 'quiz', String(quiz));
  }
  assert.equal(srv.games.size, avant);

  h.sendJ({ t: 'host_create', key: KEY, quiz: 'beta' });
  const c = await h.wait('created');
  assert.equal(c.total, 2);
  const p = client(); await p.opened;
  p.sendJ({ t: 'join', pin: c.pin, name: 'Beta Team' });
  await p.wait('joined');
  h.sendJ({ t: 'start', token: c.token });
  const q = await p.wait('question');
  assert.equal(q.theme, 'Beta');
  assert.equal(q.total, 2);
  assert.equal(q.correct, undefined);
  p.sendJ({ t: 'answer', choice: FIXTURES.beta.questions[0].correct });
  const rev = await h.wait('host_reveal');
  assert.equal(rev.point, 'point Beta 1');
  for (const x of [h, p]) x.close();
});

test('un seul quiz sur le serveur : quiz facultatif à la création', async () => {
  const solo = fs.mkdtempSync(path.join(os.tmpdir(), 'ha-solo-'));
  fs.writeFileSync(path.join(solo, 'alpha.json'), JSON.stringify(FIXTURES.alpha));
  const s2 = await start({ port: 0, bind: '127.0.0.1', hostKey: KEY, quiet: true, quizzesDir: solo });
  const ws = new WebSocket(`ws://127.0.0.1:${s2.port}`);
  await new Promise((r) => ws.once('open', r));
  const got = new Promise((r) => ws.once('message', (d) => r(JSON.parse(d))));
  ws.send(JSON.stringify({ t: 'host_create', key: KEY }));
  assert.equal((await got).quiz, 'alpha');
  ws.close();
  await s2.close();
  fs.rmSync(solo, { recursive: true, force: true });
});

test('dossier de quiz invalide : démarrage refusé', async () => {
  const bad = fs.mkdtempSync(path.join(os.tmpdir(), 'ha-bad-'));
  await assert.rejects(start({ port: 0, bind: '127.0.0.1', hostKey: KEY, quiet: true, quizzesDir: bad }), /aucun quiz/);
  fs.writeFileSync(path.join(bad, 'Mauvais Nom.json'), JSON.stringify(FIXTURES.alpha));
  await assert.rejects(start({ port: 0, bind: '127.0.0.1', hostKey: KEY, quiet: true, quizzesDir: bad }), /nom de quiz invalide/);
  fs.rmSync(bad, { recursive: true, force: true });
});

test('mode positionnement : 1 point sans bonus, bilan par module, CSV via le canal animateur', async () => {
  const PQ = FIXTURES.pos.questions;
  const host = client(); await host.opened;
  // Mode ou seuils invalides : refusés, aucune partie créée
  const avant = srv.games.size;
  for (const extra of [{ mode: 'turbo' }, { mode: 'positionnement', seuil: 0 }, { mode: 'positionnement', seuil: 101 },
    { mode: 'positionnement', seuilModule: '50' }, { mode: 'positionnement', seuil: 59.5 }]) {
    host.sendJ({ t: 'host_create', key: KEY, quiz: 'pos', ...extra });
    assert.equal((await host.wait('error')).code, 'mode', JSON.stringify(extra));
  }
  assert.equal(srv.games.size, avant);
  host.sendJ({ t: 'host_create', key: KEY, quiz: 'pos', mode: 'positionnement', seuil: 60, seuilModule: 50 });
  const c = await host.wait('created');
  assert.equal(c.mode, 'positionnement');
  assert.equal(c.seuil, 60);
  assert.equal(c.seuilModule, 50);

  const [a, b, z] = [client(), client(), client()];
  await Promise.all([a.opened, b.opened, z.opened]);
  a.sendJ({ t: 'join', pin: c.pin, name: 'Alice' });
  assert.equal((await a.wait('joined')).mode, 'positionnement');
  b.sendJ({ t: 'join', pin: c.pin, name: 'Bob' });
  await b.wait('joined');
  z.sendJ({ t: 'join', pin: c.pin, name: '=1+1' });        // nom piégé pour le tableur
  await z.wait('joined');

  const bad = (i) => (PQ[i].correct + 1) % 4;
  /** Envoie la commande animateur, attend la question i chez tous, fait répondre, attend la révélation. */
  async function play(cmd, i, choices, joueurs = choices.map(([p]) => p)) {
    const waits = [host.wait('host_question'), ...joueurs.map((p) => p.wait('question'))];
    host.sendJ({ t: cmd, token: c.token });
    const [hq] = await Promise.all(waits);
    assert.equal(hq.idx, i);
    assert.equal(hq.module, PQ[i].module);
    assert.equal(hq.correct, undefined);
    if (!choices.length) return null;
    const rev = host.wait('host_reveal');
    for (const [p, ch] of choices) p.sendJ({ t: 'answer', choice: ch });
    return rev;
  }

  // Q1 (M1) : Alice bonne (après une pause : pas de bonus de vitesse), Bob faux, « =1+1 » bonne
  const r1p = host.wait('host_reveal');
  await play('start', 0, [], [a, b, z]);
  const results = [a.wait('result'), z.wait('result')];
  b.sendJ({ t: 'answer', choice: bad(0) });
  z.sendJ({ t: 'answer', choice: PQ[0].correct });
  await pause(300);
  a.sendJ({ t: 'answer', choice: PQ[0].correct });
  const rev1 = await r1p;
  assert.equal(rev1.leaderboard, undefined, 'pas de classement projeté');
  assert.equal(rev1.correctCount, 2);
  assert.equal(rev1.module, 'M1');
  const [ra, rz] = await Promise.all(results);
  assert.equal(ra.gained, 1, 'une bonne réponse = 1 point, quelle que soit la vitesse');
  assert.equal(ra.score, 1);
  assert.equal(ra.rank, undefined, 'le joueur ne voit pas son rang');
  assert.equal(rz.gained, 1);

  // « =1+1 » quitte la partie : il reste dans le bilan, et ne bloque plus la révélation automatique
  z.close(); await pause(100);
  await play('next', 1, [[a, PQ[1].correct], [b, PQ[1].correct]]);   // Q2 (M1) : 2 bonnes
  await play('next', 2, [[a, bad(2)], [b, PQ[2].correct]]);          // Q3 (M2)
  await play('next', 3, [[a, bad(3)], [b, PQ[3].correct]]);          // Q4 (M2)

  // CSV : refusé depuis un joueur ou sans jeton
  a.sendJ({ t: 'csv', token: c.token });
  host.sendJ({ t: 'csv' });
  await pause(200);
  assert.ok(!host.msgs.some((m) => m.t === 'host_csv') && !a.msgs.some((m) => m.t === 'host_csv'));

  const ends = [host.wait('host_end'), a.wait('end')];
  host.sendJ({ t: 'next', token: c.token });                      // après la dernière question : fin
  const [end, ea] = await Promise.all(ends);
  assert.equal(end.mode, 'positionnement');
  assert.equal(end.leaderboard, undefined);
  const R = end.report;
  assert.equal(R.total, 4);
  assert.deepEqual(R.modules, ['M1', 'M2']);
  assert.deepEqual(R.totals, { M1: 2, M2: 2 });
  assert.deepEqual(R.players.map((p) => p.name), ['=1+1', 'Alice', 'Bob']);
  const [pz, pa, pb] = R.players;
  assert.deepEqual([pa.score, pa.pct, pa.reussi, pa.aRevoir], [2, 50, false, ['M2']]);
  assert.deepEqual(pa.modules, [{ module: 'M1', ok: 2, total: 2 }, { module: 'M2', ok: 0, total: 2 }]);
  assert.deepEqual([pb.score, pb.pct, pb.reussi, pb.aRevoir], [3, 75, true, []]);   // M1 1/2 = 50 % : pas « à revoir »
  assert.deepEqual([pz.score, pz.gone, pz.aRevoir], [1, true, ['M2']]);
  assert.equal(R.reussis, 1);
  assert.ok(!JSON.stringify(end).includes('"correct"'), 'aucune bonne réponse dans le bilan');

  // Chaque joueur ne reçoit que son propre résultat
  assert.deepEqual([ea.score, ea.total, ea.pct, ea.aRevoir], [2, 4, 50, ['M2']]);
  assert.equal(ea.leaderboard, undefined);
  assert.ok(!JSON.stringify(ea).includes('Bob'), 'pas de données des autres joueurs');

  // CSV (seuils par défaut de la partie, puis seuil de réussite abaissé à 40 %)
  host.sendJ({ t: 'csv', token: c.token });
  const out = await host.wait('host_csv');
  assert.match(out.filename, /^positionnement-pos-\d{4}-\d{2}-\d{2}\.csv$/);
  const lines = out.csv.trimEnd().split('\r\n');
  assert.deepEqual(lines, [
    'apprenant;score;sur;pourcentage;reussi_60;modules_a_revoir_50;deconnecte;M1_bonnes;M1_total;M2_bonnes;M2_total',
    `"'=1+1";1;4;25;non;M2;oui;1;2;0;2`,
    'Alice;2;4;50;non;M2;non;2;2;0;2',
    'Bob;3;4;75;oui;;non;1;2;2;2',
  ]);
  host.sendJ({ t: 'csv', token: c.token, seuil: 40, seuilModule: 60 });
  const out2 = (await host.wait('host_csv')).csv.split('\r\n');
  assert.equal(out2[0].split(';')[4], 'reussi_40');
  assert.equal(out2[2], 'Alice;2;4;50;oui;M2;non;2;2;0;2');
  assert.equal(out2[3], 'Bob;3;4;75;oui;M1;non;1;2;2;2');           // M1 50 % < 60 %
  host.sendJ({ t: 'csv', token: c.token, seuil: 'x' });
  assert.equal((await host.wait('error')).code, 'csv');

  // Reprise animateur après la fin : le bilan est renvoyé
  host.close(); await pause(100);
  const h2 = client(); await h2.opened;
  h2.sendJ({ t: 'host_resume', key: KEY, pin: c.pin, token: c.token });
  assert.equal((await h2.wait('host_end')).report.players.length, 3);
  for (const x of [h2, a, b]) x.close();
});

test('mode classique explicite : export CSV refusé', async () => {
  const h = client(); await h.opened;
  h.sendJ({ t: 'host_create', key: KEY, quiz: 'beta', mode: 'classique' });
  const c = await h.wait('created');
  assert.equal(c.mode, 'classique');
  h.sendJ({ t: 'csv', token: c.token });
  assert.equal((await h.wait('error')).code, 'csv');
  h.close();
});

test('partie terminée : effacée de la mémoire après le délai, même onglet animateur ouvert', async () => {
  const s3 = await start({ port: 0, bind: '127.0.0.1', hostKey: KEY, quiet: true, quizzesDir: DIR, endedGameMs: 150 });
  const url = `ws://127.0.0.1:${s3.port}`;
  const ouvrir = () => { const w = new WebSocket(url); w.msgs = [];
    w.on('message', (d) => w.msgs.push(JSON.parse(d)));
    return new Promise((r) => w.once('open', () => r(w))); };
  const attendre = async (w, t) => { for (let i = 0; i < 40; i++) { const m = w.msgs.find((x) => x.t === t); if (m) return m; await pause(25); } throw new Error(t); };
  const h = await ouvrir();
  h.send(JSON.stringify({ t: 'host_create', key: KEY, quiz: 'beta', mode: 'classique' }));
  const c = await attendre(h, 'created');
  h.send(JSON.stringify({ t: 'end', token: c.token }));
  await attendre(h, 'host_end');
  await pause(300);
  assert.match((await attendre(h, 'error')).msg, /fermée/);   // l'animateur est prévenu
  const h2 = await ouvrir();
  h2.send(JSON.stringify({ t: 'host_resume', key: KEY, pin: c.pin, token: c.token }));
  assert.equal((await attendre(h2, 'error')).code, 'resume');  // plus rien en mémoire
  h.close(); h2.close();
  await s3.close();
});

// En dernier : bloque les « join » depuis 127.0.0.1 pendant une minute.
test('limites : connexions simultanées par adresse IP', async () => {
  const s2 = await start({ port: 0, bind: '127.0.0.1', hostKey: KEY, quiet: true, quizzesDir: DIR, maxConnPerIp: 2 });
  const url = `ws://127.0.0.1:${s2.port}`;
  const ouvrir = () => new Promise((resolve) => {
    const w = new WebSocket(url);
    w.once('open', () => resolve({ w, ok: true }));
    w.once('unexpected-response', (req, res) => resolve({ w, ok: false, code: res.statusCode }));
    w.once('error', () => {});
  });
  const a = await ouvrir(), b = await ouvrir(), c = await ouvrir();
  assert.ok(a.ok && b.ok);
  assert.equal(c.ok, false);
  assert.equal(c.code, 429);
  a.w.close();
  await new Promise((r) => setTimeout(r, 100));
  const d = await ouvrir();               // une place libérée : on peut revenir
  assert.ok(d.ok);
  b.w.close(); d.w.close();
  await s2.close();
});

test('limites : taille des messages et tentatives de code', async () => {
  const big = client(); await big.opened;
  const closed = new Promise((r) => big.once('close', (code) => r(code)));
  big.send('x'.repeat(5000));
  assert.equal(await closed, 1009); // message trop gros

  const brute = client(); await brute.opened;
  let last;
  for (let i = 0; i < 22; i++) {
    brute.sendJ({ t: 'join', pin: String(100000 + i), name: 'bf' });
    last = await brute.wait('error');
  }
  assert.match(last.msg, /Trop de tentatives/);
  brute.close();
});
