/* paint-tv.js — 선생님 화면(TV)의 「색칠 대작전」 (작업/결정-색칠.md)
 *   QP.PaintTV.draw(부모, ref, {onResults, onNew}) — 심판 소식마다 부른다 / QP.PaintTV.hide()
 * 미니게임 중: 위 제목·남은 시간, 팀 % 막대(마지막 3초는 가림), 가운데 큰 맵에 모든 아이와 칠한 칸. 끝나면 「○○ 팀 승리!」.
 * 그 밖(문제·결과·끝): 보물 지키기 TV 틀(.trtv)에 팀 줄.
 */
(function () {
  'use strict';
  const QP = window.QP;
  const PT = QP.PT;
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const CSS = `
.pttv { position: fixed; inset: 0; z-index: 2; background: #2b2018; color: #fff; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; overflow: hidden; }
.pttv .pt-head { width: var(--tw); display: flex; align-items: center; justify-content: space-between; }
.pttv .pt-head h1 { margin: 0; font-family: 'QPTitle', serif; font-weight: normal; font-size: 40px; text-shadow: 3px 3px 0 #000; }
.pttv .pt-head h1 small { font-size: 22px; opacity: .85; }
.pttv .pt-time { font-family: 'QPTitle', serif; font-size: 40px; background: #fff7e6; color: #2a211b; border: 3px solid #120c1c; border-radius: 6px; padding: 0 18px; box-shadow: 4px 4px 0 rgba(0,0,0,.4); }
.pttv .pt-time.hurry { background: #ffd0c8; animation: ptbeat .5s infinite alternate; }
@keyframes ptbeat { to { transform: scale(1.08); } }
.pttv .pt-bars { width: var(--tw); display: flex; height: 40px; border: 3px solid #120c1c; border-radius: 6px; overflow: hidden; background: #8b8794; position: relative; box-shadow: 4px 4px 0 rgba(0,0,0,.4); }
.pttv .pt-bars i { display: flex; align-items: center; justify-content: center; font-style: normal; font-family: 'QPTitle', serif; font-size: 24px; color: #fff; text-shadow: 2px 2px 0 rgba(0,0,0,.5); transition: width .4s; white-space: nowrap; overflow: hidden; }
.pttv .pt-bars.hide i { filter: blur(8px); }
.pttv .pt-bars .q { position: absolute; inset: 0; display: none; align-items: center; justify-content: center; font-family: 'QPTitle', serif; font-size: 26px; text-shadow: 2px 2px 0 #000; }
.pttv .pt-bars.hide .q { display: flex; }
.pttv .pt-stage { position: relative; width: var(--tw); }
.pttv .pt-stage canvas { display: block; width: 100%; image-rendering: pixelated; border: 6px solid #5a3b22; outline: 3px solid #1a120b; border-radius: 6px; box-sizing: border-box; box-shadow: 6px 6px 0 rgba(0,0,0,.45); }
.pttv .pt-over { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; background: rgba(20,12,30,.5); pointer-events: none; }
.pttv .pt-over[hidden] { display: none; }
.pttv .pt-over h2 { margin: 0; font-family: 'QPTitle', serif; font-weight: normal; font-size: 90px; -webkit-text-stroke: 3px #000; text-shadow: 6px 6px 0 #000; animation: ptpop .5s ease-out both; }
.pttv .pt-over p { margin: 6px 0 0; font-size: 30px; text-shadow: 2px 2px 0 #000; }
.pttv .pt-over .n { font-family: 'QPTitle', serif; font-size: 150px; -webkit-text-stroke: 3px #000; text-shadow: 8px 8px 0 #000; }
@keyframes ptpop { from { transform: scale(.3); opacity: 0; } }
.ptrows .row .ptwins { font-family: 'QPTitle', serif; font-size: 34px; color: #2a211b; min-width: 120px; text-align: right; } .ptrows .row .ptwins small { font-family: 'QPBody', sans-serif; font-size: 16px; color: #5a4636; display: block; }
.ptrows .row .ptpc { flex: 1; font-size: 20px; color: #5a4636; text-align: center; } .ptrows .row .ptpc b { font-family: 'QPTitle', serif; font-weight: normal; font-size: 34px; }
.ptrows .row .ptsw { display: inline-block; width: 22px; height: 22px; border: 2px solid #120c1c; border-radius: 4px; vertical-align: -4px; margin-right: 6px; }
`;
  function css() {
    if (document.getElementById('pttv-css')) return;
    const s = document.createElement('style');
    s.id = 'pttv-css';
    s.textContent = CSS;
    document.head.appendChild(s);
  }
  let root = null,
    mode = '',
    raf = 0,
    timer = 0,
    sig = '',
    cb = {};
  const an = (ref, t) => QP.TEAM_ANIMALS[ref.S.t.order[t]][0];
  const colOf = (ref, t) => QP.ptColor(ref.S.t.order[t]);
  function hide() {
    clearInterval(timer);
    cancelAnimationFrame(raf);
    raf = 0;
    if (root) root.remove();
    root = null;
    mode = '';
  }

  /* ---------- 미니게임: 큰 맵 ---------- */
  function buildGame(parent, ref) {
    const A = QP.PaintArt;
    parent.innerHTML = '';
    root = document.createElement('div');
    root.className = 'pttv';
    root.innerHTML = '<div class="pt-head"><h1>색칠 대작전 <small></small></h1><div class="pt-time">25</div></div><div class="pt-bars"></div><div class="pt-stage"><canvas></canvas><div class="pt-over" hidden></div></div>';
    parent.appendChild(root);
    mode = 'game';
    const $ = (s) => root.querySelector(s);
    const cv = $('canvas'),
      g = cv.getContext('2d');
    const fit = () => root.style.setProperty('--tw', Math.floor(Math.min(innerWidth * 0.94, ((innerHeight - 150) * 16) / 9)) + 'px');
    fit();
    let mg = -1,
      M = null,
      board = null,
      lay = null,
      cols = [],
      lastM = '',
      shown = {},
      seenBm = 0,
      splats = [],
      overSig = '',
      last = performance.now();
    function setup(L) {
      mg = L.mg;
      M = QP.ptMap(L.map);
      const n = ref.nTeams();
      cols = [...Array(n).keys()].map((t) => colOf(ref, t));
      board = new QP.PaintBoard(M, n);
      lay = A.layer(M, cols);
      cv.width = lay.cv.width;
      cv.height = lay.cv.height;
      lastM = '';
      shown = {};
      seenBm = 0;
      splats = [];
      overSig = '';
      $('.pt-head small').textContent = (L.mg + 1) + '판 · ' + QP.PT_MAPNAME[L.map] + ' · ' + n + '팀';
      $('.pt-bars').innerHTML = cols.map((T, t) => '<i style="background:' + T.col + '" data-t="' + t + '"></i>').join('') + '<div class="q">마지막 3초! 어느 팀이 더 칠했을까?</div>';
    }
    function frame(now) {
      if (mode !== 'game') return;
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      const L = ref.live;
      if (!L || L.kind !== 'paint' || ref.S.phase !== 'defend') return;
      if (L.mg !== mg) setup(L);
      // 심판이 들고 있는 판을 바로 본다(서버를 거치지 않음)
      const p = ref.board ? ref.board.p : null;
      if (p) lay.sync(p, now);
      else if (L.m !== lastM) {
        lastM = L.m;
        board.decode(L.m);
        lay.sync(board.p, now);
      }
      const gg = (ref.net.now() - L.t0) / QP.ms(1);
      const rows = ref.roster();
      for (const m of rows) {
        const q = L.pos && L.pos[m.sid];
        if (!q) continue;
        const s = shown[m.sid] || (shown[m.sid] = { x: q[0] / 10, y: q[1] / 10, f: 0, dir: 1 });
        const k = Math.min(1, dt * 7);
        const nx = s.x + (q[0] / 10 - s.x) * k,
          ny = s.y + (q[1] / 10 - s.y) * k;
        if (Math.abs(nx - s.x) > 0.005) s.dir = nx > s.x ? 1 : -1;
        s.f += Math.hypot(nx - s.x, ny - s.y) * 2.2;
        s.x = nx;
        s.y = ny;
      }
      const bm = L.bm || [];
      for (; seenBm < bm.length; seenBm++) splats.push({ x: bm[seenBm][0] / 10, y: bm[seenBm][1] / 10, t0: now, t: bm[seenBm][2] });
      const shake = splats.some((s) => now - s.t0 < 300);
      g.setTransform(1, 0, 0, 1, shake ? (Math.random() - 0.5) * 8 : 0, shake ? (Math.random() - 0.5) * 8 : 0);
      g.drawImage(lay.cv, 0, 0);
      lay.drawWet(g, now);
      splats = splats.filter((s) => A.splat(g, s, cols[s.t] || cols[0], now));
      const list = rows
        .filter((m) => shown[m.sid] && cols[m.team])
        .map((m) => ({ x: shown[m.sid].x, y: shown[m.sid].y, f: shown[m.sid].f, dir: shown[m.sid].dir, an: an(ref, m.team), cl: m.cl || 0, col: cols[m.team], full: ((L.g && L.g[m.sid]) || 0) >= 100 }));
      list.sort((a, b) => a.y - b.y);
      for (const k of list) A.kid(g, k, now);
      g.setTransform(1, 0, 0, 1, 0, 0);
      // 위 칸
      const left = Math.max(0, L.dur - Math.max(0, gg));
      const tm = $('.pt-time');
      tm.textContent = Math.ceil(Math.min(L.dur, left));
      tm.classList.toggle('hurry', gg >= 0 && left <= 5 && left > 0);
      const pc = ref.board ? ref.board.pct() : board.pct();
      const over = gg >= L.dur;
      const bars = $('.pt-bars');
      bars.classList.toggle('hide', !over && left <= PT.HIDE);
      bars.querySelectorAll('i').forEach((e) => {
        const t = +e.dataset.t;
        e.style.width = pc[t] + '%';
        e.textContent = pc[t] > 7 ? an(ref, t) + ' ' + Math.round(pc[t]) + '%' : '';
      });
      let o = '';
      if (gg < 0) o = '<div class="n">' + Math.ceil(-gg) + '</div><p>우리 팀 색으로 칠해요! 많이 칠한 팀이 이겨요</p>';
      else if (over) {
        const w = QP.ptWinners(pc);
        o = '<h2 style="color:#fff;padding:0 34px;border:5px solid #000;border-radius:16px;background:' + (w.length === 1 ? cols[w[0]].col : '#6b6478') + '">' + (w.length === 1 ? esc(QP.teamName(ref.S.t.order[w[0]])) + ' 승리!' : w.length ? '공동 승리!' : '끝!') + '</h2><p>' + cols.map((T, t) => esc(an(ref, t)) + ' ' + pc[t].toFixed(1) + '%').join(' · ') + '</p>';
      }
      if (o !== overSig) {
        overSig = o;
        const ov = $('.pt-over');
        ov.innerHTML = o;
        ov.hidden = !o;
      }
    }
    raf = requestAnimationFrame(frame);
    addEventListener('resize', fit);
  }

  /* ---------- 문제·결과·끝: 팀 줄 ---------- */
  function drawRows(parent, ref) {
    const S = ref.S,
      c = S.cfg,
      ph = S.phase,
      T = S.t;
    if (!root || mode !== 'rows' || !parent.contains(root)) {
      parent.innerHTML = '';
      root = document.createElement('div');
      root.className = 'trtv ptrows';
      parent.appendChild(root);
      mode = 'rows';
      sig = '';
    }
    const now = ref.net.now();
    const left = Math.max(0, Math.ceil((S.endsAt - now) / QP.ms(1)));
    const total = c.per * c.M;
    let head = '',
      sub = '';
    const lastR = T.log[T.log.length - 1] || [];
    if (ph === 'question' || ph === 'reveal') {
      const k = c.per - (((S.round - 1) % c.per) + 1);
      const got = ref.seatList().filter((s) => s.cur && s.cur.r === S.round);
      head = '<h1>' + S.round + ' / ' + total + '번째 문제</h1>';
      sub = (ph === 'question' ? '문제 푸는 중 <b>' + left + '</b>초 · 답한 친구 ' + got.filter((s) => s.ans).length + ' / ' + got.length : '정답 보는 중') + ' · ' + (k ? '색칠까지 <b>' + k + '</b>문제 (' + QP.PT_MAPNAME[QP.ptMapKey(T.mg)] + ')' : '이제 <b>색칠 대작전!</b>');
    } else if (ph === 'dres') {
      const w = lastR.filter((x) => x.win);
      head = '<h1>' + (w.length === 1 ? esc(QP.teamName(T.order[w[0].t])) + ' 승리!' : w.length ? '공동 승리!' : '비겼어요!') + '</h1>';
      sub = T.mg >= c.M ? '곧 최종 결과!' : '다음 문제까지 <b>' + left + '</b>초';
    } else if (ph === 'end') {
      head = '<h1>최종 결과</h1>';
      sub = '이긴 판 수 → 같으면 칠한 % 합';
    }
    const order = ph === 'end' ? ref.teamBoard().map((x) => x.t) : T.order.map((_, t) => t).sort((a, b) => T.wins[b] - T.wins[a] || T.pcs[b] - T.pcs[a]);
    const body = order
      .map((t, i) => {
        const seats = ref.teamSeats(t),
          blk = seats.reduce((x, s) => x + (s.blk || 0), 0),
          lr = lastR.find((x) => x.t === t),
          col = colOf(ref, t);
        let mid = '';
        if (ph === 'question' || ph === 'reveal') {
          const max = Math.max(1, seats.length * c.per);
          mid = '<div class="trpow"><span>모은 걸음</span><span class="bar"><i style="width:' + Math.round((100 * blk) / max) + '%"></i></span><em>맞힌 문제 ' + blk + '</em></div>';
        } else if (ph === 'dres' && lr) mid = '<div class="ptpc">이번 판 <b style="color:' + col.col + '">' + lr.pc + '%</b></div>';
        else mid = '<div class="ptpc">칠한 % 합 <b style="color:' + col.col + '">' + Math.round(T.pcs[t]) + '</b></div>';
        return '<div class="row' + (i === 0 && T.wins[t] > 0 ? ' first' : '') + '"><div class="rk">' + (i + 1) + '</div><img class="ic" src="' + window.PX.icon(an(ref, t), 0, 64) + '" alt=""><div class="nm"><span class="ptsw" style="background:' + col.col + '"></span>' + esc(QP.teamName(T.order[t])) + '<small>' + seats.length + '명</small></div>' + mid + '<div class="ptwins">' + T.wins[t] + '승<small>' + c.M + '판 중</small></div></div>';
      })
      .join('');
    const foot = ph === 'end' ? '<div class="endbtns"><button class="go" data-tr="res">결과표 보기</button><button class="ghost" data-tr="new">새 판</button></div>' : '<div class="foot">문제를 많이 맞힐수록 색칠 때 빨리 걸어요 · 칠한 넓이가 가장 큰 팀이 그 판 승리</div>';
    const h = '<div class="head">' + head + '<p>' + sub + '</p></div><div class="rows n' + T.order.length + '">' + body + '</div>' + foot;
    if (h !== sig) {
      sig = h;
      root.innerHTML = h;
      root.querySelectorAll('[data-tr]').forEach((b) => (b.onclick = () => (b.dataset.tr === 'res' ? cb.onResults && cb.onResults() : cb.onNew && cb.onNew())));
    }
  }

  function draw(parent, ref, opts) {
    css();
    cb = opts || cb;
    clearInterval(timer);
    const ph = ref.S.phase;
    if (ph === 'defend') {
      if (mode !== 'game' || !root || !parent.contains(root)) {
        hide();
        buildGame(parent, ref);
      }
      return;
    }
    if (mode === 'game') hide();
    drawRows(parent, ref);
    if (ph !== 'end') timer = setInterval(() => drawRows(parent, ref), 250);
  }
  QP.PaintTV = { draw, hide };
})();
