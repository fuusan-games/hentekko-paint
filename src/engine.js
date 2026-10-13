/* へんてこペイント：ルールエンジン（ホスト側が唯一の正）。DOMに依存しないのでテストからも直接呼べます。 */
(function (root) {
'use strict';
var LV = ['弱い', '普通', '強い', 'アストラウルトラ😎'];
var CHARS = [['ふーさん', '🐻'], ['ミミ', '🐰'], ['ロボミ', '🤖'], ['ニャコ', '😺'], ['ポチ太', '🐶'], ['コンタ', '🦊']];

/* ---------- お題の読み込み ---------- */
function expand(spec) {             // 絵の書式 → [{s:[...strokes], ess:n}]
  var parts = spec.split('/'), out = [], ess = 0;
  parts.forEach(function (p, pi) {
    p.split(';').forEach(function (cmd) {
      cmd = cmd.trim(); if (!cmd) return;
      var k = cmd[0], a = cmd.slice(1).trim().split(/\s+/).map(Number);
      if (k === 'L') out.push(['L', a[0], a[1], a[2], a[3]]);
      else if (k === 'C') out.push(['C', a[0], a[1], a[2]]);
      else if (k === 'R') { var x = a[0], y = a[1], w = a[2], h = a[3];
        out.push(['L', x, y, x + w, y], ['L', x + w, y, x + w, y + h], ['L', x + w, y + h, x, y + h], ['L', x, y + h, x, y]); }
      else if (k === 'P' || k === 'Q') { for (var i = 0; i + 3 < a.length; i += 2) out.push(['L', a[i], a[i + 1], a[i + 2], a[i + 3]]);
        if (k === 'Q') out.push(['L', a[a.length - 2], a[a.length - 1], a[0], a[1]]); }
      else if (k === 'H') { var hx = a[0], hy = a[1], s = a[2] || 1;
        out.push(['C', hx, hy, 5 * s], ['L', hx, hy + 5 * s, hx, hy + 20 * s], ['L', hx - 8 * s, hy + 11 * s, hx + 8 * s, hy + 11 * s],
          ['L', hx, hy + 20 * s, hx - 7 * s, hy + 32 * s], ['L', hx, hy + 20 * s, hx + 7 * s, hy + 32 * s]); }
    });
    if (pi === 0) ess = out.length;
  });
  return { s: out, ess: ess };
}
var kata2hira = function (s) { return s.replace(/[\u30a1-\u30f6]/g, function (m) { return String.fromCharCode(m.charCodeAt(0) - 0x60); }); };
function norm(s) {
  s = String(s || '').normalize('NFKC').toLowerCase().replace(/[\s　、。．.！!？?〜~「」『』()（）]/g, '');
  s = kata2hira(s).replace(/(さん|ちゃん|くん)$/, '');
  return s;
}
function loadWords(cards) {
  return cards.map(function (line, i) {
    var c = line.indexOf(':'), head = line.slice(0, c), hard = head.indexOf('!') >= 0;
    head = head.replace('!', '');
    var disp = head.split('=')[0], read = head.split('=')[1] || '';
    var keys = [disp, read].concat(disp.split('・')).filter(Boolean).map(norm);
    var d = expand(line.slice(c + 1));
    return { id: i, w: disp, read: read, keys: keys, hard: hard, draw: d.s, ess: d.ess, feat: feat(d.s) };
  });
}
function isCorrect(word, guess) {
  var g = norm(guess); if (!g) return false;
  return word.keys.some(function (k) { return k === g || (k.length >= 2 && g.length - k.length <= 2 && g.length > k.length && (g.indexOf(k) === 0 || g.slice(-k.length) === k)); });
}

/* ---------- 乱数（テスト用にシード可） ---------- */
var seed = Date.now() % 2147483647;
function rnd() { seed = (seed * 48271) % 2147483647; return (seed - 1) / 2147483646; }
function setSeed(s) { seed = (s % 2147483646) + 1; }
function pick(a) { return a[Math.floor(rnd() * a.length)]; }
function shuffle(a) { a = a.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(rnd() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t; } return a; }

/* ---------- 絵の特徴量（CPU回答者が「見る」ための簡単な手がかり） ---------- */
function feat(st) {
  var nL = 0, nC = 0, cr = 0, minx = 100, miny = 100, maxx = 0, maxy = 0, hor = 0, ver = 0;
  st.forEach(function (s) {
    if (s[0] === 'C') { nC++; cr += s[3]; minx = Math.min(minx, s[1] - s[3]); maxx = Math.max(maxx, s[1] + s[3]); miny = Math.min(miny, s[2] - s[3]); maxy = Math.max(maxy, s[2] + s[3]); }
    else { nL++; minx = Math.min(minx, s[1], s[3]); maxx = Math.max(maxx, s[1], s[3]); miny = Math.min(miny, s[2], s[4]); maxy = Math.max(maxy, s[2], s[4]);
      var dx = Math.abs(s[3] - s[1]), dy = Math.abs(s[4] - s[2]); if (dy < dx * .3) hor++; else if (dx < dy * .3) ver++; }
  });
  var w = Math.max(1, maxx - minx), h = Math.max(1, maxy - miny);
  return { nL: nL, nC: nC, cr: nC ? cr / nC : 0, asp: w / h, hor: nL ? hor / nL : 0, ver: nL ? ver / nL : 0 };
}
function sim(a, b) {
  return Math.exp(-(Math.abs(a.nL - b.nL) / 4 + Math.abs(a.nC - b.nC) / 1.5 + Math.abs(a.cr - b.cr) / 12 + Math.abs(Math.log(a.asp / b.asp)) / .6 + Math.abs(a.hor - b.hor) * 1.5 + Math.abs(a.ver - b.ver) * 1.5));
}

/* ---------- CPUの絵 ----------
 * 手描きライブラリ（topics.js）の要点ストロークを使う。強いほど要点だけ・ブレなし＝画数が少なく早く公開される。
 * 弱いほど全部描いた上に手ブレと「へんてこ」な余計な線がつく。 */
function cpuDraw(word, lv) {
  var base = (lv >= 2 ? word.draw.slice(0, word.ess) : word.draw.slice()), jit = [3.5, 2, 1, 0][lv];
  var out = base.map(function (s) {
    var j = function (v) { return Math.round((v + (rnd() * 2 - 1) * jit) * 10) / 10; };
    return s[0] === 'C' ? ['C', j(s[1]), j(s[2]), Math.max(2, j(s[3]))] : ['L', j(s[1]), j(s[2]), j(s[3]), j(s[4])];
  });
  if (lv === 0 && rnd() < .6) out.push(rnd() < .5 ? ['C', 10 + rnd() * 80, 10 + rnd() * 80, 3 + rnd() * 5] : ['L', rnd() * 100, rnd() * 100, rnd() * 100, rnd() * 100]);
  if (lv === 3 && out.length > 3 && word.ess > 3) out = out;   // アストラは要点のみ（ライブラリの時点で最小構成）
  return out;
}

/* ---------- CPUの回答 ----------
 * 正直に書くと：CPUは絵を「理解」していません。お題を知った上で、レベル・お題の隠し難易度・
 * 公開済み枚数・絵の特徴量（線と円の数・形の比率）と手描きライブラリとの近さから「当たる確率」を決め、
 * 外れるときは特徴の似た別のお題を答えます。人の絵が本物の絵に近いほど（特徴量で）当たりやすくなります。 */
var BASE = [.22, .42, .6, .78];
function cpuGuess(G, W, lv) {
  var target = W[G.target], k = G.revealed, p = 0, tries = [];
  for (var i = 0; i < k; i++) {
    var pi = G.order[i], st = G.drawings[pi] || [], f = feat(st), dlv = G.players[pi].cpu;
    var clar;
    if (dlv != null) clar = [.7, .9, 1.0, 1.12][dlv];
    else { // 人の絵：ライブラリの全お題と比べて、正解のお題が何位くらいに似ているか
      var st0 = sim(f, target.feat), below = 0;
      W.forEach(function (w) { if (sim(f, w.feat) < st0) below++; });
      clar = .45 + .75 * (below / W.length);
    }
    if (!st.length) clar = 0;
    tries.push(clar);
  }
  var last = tries[tries.length - 1] || 0, best = Math.max.apply(null, tries.concat([0]));
  p = BASE[lv] * (last * .6 + best * .4) * (target.hard ? .62 : 1) * (1 + .22 * (k - 1));
  p = Math.min(.96, p);
  if (rnd() < p) return target.w;
  // 外れ：最新の絵に特徴が似たお題から（弱いほどランダム）
  var lastSt = G.drawings[G.order[k - 1]] || [], f2 = feat(lastSt), used = G.guesses.map(function (g) { return norm(g.text); });
  var cands = W.filter(function (w) { return w.id !== target.id && used.indexOf(norm(w.w)) < 0; })
    .map(function (w) { return { w: w, s: sim(f2, w.feat) + rnd() * [1, .4, .15, .05][lv] }; })
    .sort(function (a, b) { return b.s - a.s; });
  if (lv === 0 && rnd() < .15) return 'うーん…わからない';
  return (cands[Math.floor(rnd() * Math.min(4, cands.length))] || { w: { w: 'わからない' } }).w.w;
}

/* ---------- ゲーム進行 ---------- */
function newGame(players, W) {
  var deck = shuffle(W.map(function (w) { return w.id; }));
  var cards = []; for (var i = 0; i + 6 <= deck.length; i += 6) cards.push(deck.slice(i, i + 6));
  return { v: 1, players: players.map(function (p) { return { name: p.name, emoji: p.emoji || '🙂', cpu: p.cpu == null ? null : p.cpu, seat: p.seat || null, score: 0 }; }),
    round: 0, ans: 0, phase: 'roll', cards: cards, card: null, die: 0, rollId: 0, target: null,
    drawings: [], order: [], revealed: 0, guesses: [], result: null, log: [] };
}
function startRound(G) {
  G.ans = G.round; G.phase = 'roll'; G.card = G.cards[G.round % G.cards.length]; G.die = 0; G.target = null;
  G.drawings = G.players.map(function () { return null; }); G.order = []; G.revealed = 0; G.guesses = []; G.result = null;
}
function revealOrder(G) {
  var n = G.players.length, ids = [];
  for (var i = 0; i < n; i++) if (i !== G.ans && G.drawings[i] && G.drawings[i].length) ids.push(i);
  return ids.sort(function (a, b) {
    var d = G.drawings[a].length - G.drawings[b].length; if (d) return d;
    return ((a - G.ans + n) % n) - ((b - G.ans + n) % n);   // 同画数は回答者から時計回り（左隣）に近い人が先
  });
}
function award(G, k, pi) {   // k = 何枚目で正解したか（1始まり）
  G.players[pi].score += 2;
  G.players[G.ans].score += (k === 1 ? 3 : k <= 3 ? 2 : 1);
  G.result = { ok: true, k: k, drawer: pi };
  G.phase = 'roundEnd';
}
function act(G, W, a, from) {     // from: 操作した席（ローカルは null = 誰でも）
  var n = G.players.length, isAns = (from == null || from === G.ans);
  switch (a.t) {
    case 'roll':
      if (G.phase !== 'roll' || !isAns) return false;
      G.die = a.die || (1 + Math.floor(rnd() * 6)); G.rollId++; G.target = G.card[G.die - 1]; G.phase = 'draw';
      for (var i = 0; i < n; i++) if (i !== G.ans && G.players[i].cpu != null) G.drawings[i] = cpuDraw(W[G.target], G.players[i].cpu);
      checkDrawDone(G); return true;
    case 'submit':
      if (G.phase !== 'draw') return false;
      var pi = a.p; if (from != null && from !== pi) return false;
      if (pi === G.ans || G.drawings[pi]) return false;
      G.drawings[pi] = sanitizeStrokes(a.strokes); checkDrawDone(G); return true;
    case 'skipWaiting':   // ホスト：切断した人を待たない
      if (G.phase !== 'draw') return false;
      for (var j = 0; j < n; j++) if (j !== G.ans && !G.drawings[j]) G.drawings[j] = [];
      checkDrawDone(G); return true;
    case 'guess':
      if (G.phase !== 'reveal' || !isAns) return false;
      var txt = String(a.text || '').slice(0, 30), k = G.revealed, ok = !!a.text && isCorrect(W[G.target], txt);
      G.guesses.push({ text: txt || '（パス）', ok: ok, k: k, p: G.order[k - 1] });
      if (ok) award(G, k, G.order[k - 1]);
      else if (k < G.order.length) G.revealed++;
      else { G.result = { ok: false }; G.phase = 'roundEnd'; }
      return true;
    case 'override':      // 描いた人の判定：「今の答えは正解でいいよ」（表記ゆれ・同義語対策）
      if (from === G.ans) return false;
      var last = G.guesses[G.guesses.length - 1];
      if (!last || last.ok || last.text === '（パス）' || !(G.phase === 'reveal' || (G.phase === 'roundEnd' && G.result && !G.result.ok))) return false;
      last.ok = true; last.overridden = true; G.revealed = last.k; award(G, last.k, last.p); return true;
    case 'next':
      if (G.phase !== 'roundEnd') return false;
      G.round++;
      if (G.round >= n) G.phase = 'end'; else startRound(G);
      return true;
  }
  return false;
}
function checkDrawDone(G) {
  for (var i = 0; i < G.players.length; i++) if (i !== G.ans && !G.drawings[i]) return;
  G.order = revealOrder(G);
  if (!G.order.length) { G.result = { ok: false, empty: true }; G.phase = 'roundEnd'; return; }
  G.phase = 'reveal'; G.revealed = 1;
}
function sanitizeStrokes(s) {
  if (!Array.isArray(s)) return [];
  return s.slice(0, 200).filter(function (x) { return Array.isArray(x) && (x[0] === 'L' && x.length === 5 || x[0] === 'C' && x.length === 4); })
    .map(function (x) { return [x[0]].concat(x.slice(1).map(function (v) { v = +v; return isFinite(v) ? Math.max(-10, Math.min(110, Math.round(v * 10) / 10)) : 0; })); });
}
function ranking(G) {
  var top = Math.max.apply(null, G.players.map(function (p) { return p.score; }));
  return G.players.map(function (p, i) { return { i: i, p: p, win: p.score === top }; }).sort(function (a, b) { return b.p.score - a.p.score; });
}
// オンライン送信用：その席に見せてよい情報だけ
function viewFor(G, seat) {
  var V = JSON.parse(JSON.stringify(G)); delete V.cards;
  var secret = (seat === G.ans) && G.phase !== 'roundEnd' && G.phase !== 'end';
  if (secret) { V.card = null; V.target = null; }
  V.drawCounts = G.drawings.map(function (d) { return d ? d.length : -1; });
  V.drawings = G.drawings.map(function (d, i) {
    if (!d) return null;
    if (G.phase === 'roundEnd' || G.phase === 'end' || i === seat) return d;
    if (G.phase === 'reveal' && G.order.indexOf(i) > -1 && G.order.indexOf(i) < G.revealed) return d;
    return null;
  });
  return V;
}
var E = { LV: LV, CHARS: CHARS, expand: expand, norm: norm, loadWords: loadWords, isCorrect: isCorrect, setSeed: setSeed, rnd: rnd, shuffle: shuffle,
  feat: feat, sim: sim, cpuDraw: cpuDraw, cpuGuess: cpuGuess, newGame: newGame, startRound: startRound, act: act, revealOrder: revealOrder, ranking: ranking, viewFor: viewFor };
root.HPE = E; if (typeof module !== 'undefined') module.exports = E;
})(typeof window !== 'undefined' ? window : globalThis);
