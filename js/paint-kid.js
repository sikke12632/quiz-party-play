/* paint-kid.js — 아이 디벗의 「색칠 대작전」 (작업/결정-색칠.md)
 *   const v = QP.PaintView.mount(부모요소, KidClient);  v.unmount();   — 미니게임(defend) 화면
 *   QP.PaintScreens.html(C, { tIcon, tname })                            — 모이는 곳·정답·결과·끝 화면 HTML (null = 보물 지키기 화면 그대로)
 *   QP.PaintScreens.chip(C, nOk)                                         — 위쪽 띠의 「걸음」 칩
 * 내 인형은 누르는 즉시 움직이고 내 붓 자국도 바로 그린다. 서버엔 위치·항아리 누른 수만 b{r, x, y, d, k:0, h:0} 로 1초 3번.
 * 칠한 칸·게이지·다른 친구 위치는 선생님 화면(심판)이 정한 것(live)을 따른다.
 */
(function () {
  'use strict';
  const QP = window.QP,
    PX = window.PX;
  const PT = QP.PT;
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const SEND_S = 0.34;
  const CSS = `
.ptdef { position: fixed; inset: 0; display: flex; flex-direction: column; align-items: flex-start; gap: 8px; padding: 10px 0 10px 12px; box-sizing: border-box; background: #2b2018; color: #fff; user-select: none; -webkit-user-select: none; touch-action: none; z-index: 1; }
.ptdef .pt-card { background: #fbf4e4; color: #2a211b; border: 3px solid #120c1c; border-radius: 6px; box-shadow: 4px 4px 0 rgba(0,0,0,.4); }
.ptdef .pt-top { display: flex; align-items: center; gap: 10px; width: var(--pw); }
.ptdef .pt-team { display: flex; align-items: center; gap: 8px; padding: 2px 12px 2px 2px; font-size: 15px; }
.ptdef .pt-team img { width: 40px; height: 40px; image-rendering: pixelated; border-radius: 4px; }
.ptdef .pt-team b { font-family: 'QPTitle', serif; font-weight: normal; font-size: 20px; }
.ptdef .pt-sw { display: flex; flex-direction: column; align-items: center; font-size: 12px; margin-left: 4px; }
.ptdef .pt-sw i { width: 34px; height: 24px; border: 3px solid #120c1c; border-radius: 4px; }
.ptdef .pt-big .w i.sw { display: inline-block; width: 1.1em; height: .8em; border: 3px solid #1a120b; border-radius: 4px; vertical-align: -2px; margin-right: 6px; }
.ptdef .pt-spd { padding: 4px 12px; font-size: 15px; } .ptdef .pt-spd b { font-family: 'QPTitle', serif; font-weight: normal; font-size: 24px; color: #d9573f; }
.ptdef .pt-bars { flex: 1; display: flex; height: 30px; border: 3px solid #120c1c; border-radius: 6px; overflow: hidden; background: #8b8794; position: relative; }
.ptdef .pt-bars i { display: flex; align-items: center; justify-content: center; font-style: normal; font-family: 'QPTitle', serif; font-size: 16px; color: #fff; text-shadow: 2px 2px 0 rgba(0,0,0,.5); transition: width .4s; white-space: nowrap; overflow: hidden; }
.ptdef .pt-bars.hide i { filter: blur(6px); }
.ptdef .pt-bars .q { position: absolute; inset: 0; display: none; align-items: center; justify-content: center; font-family: 'QPTitle', serif; font-size: 17px; text-shadow: 2px 2px 0 #000; }
.ptdef .pt-bars.hide .q { display: flex; }
.ptdef .pt-time { padding: 2px 14px; font-family: 'QPTitle', serif; font-size: 28px; min-width: 46px; text-align: center; }
.ptdef .pt-time.hurry { background: #ffd0c8; }
.ptdef .pt-stage { position: relative; width: var(--pw); }
.ptdef .pt-stage canvas { display: block; width: 100%; image-rendering: pixelated; border: 5px solid #5a3b22; outline: 3px solid #1a120b; border-radius: 6px; box-sizing: border-box; }
.ptdef .pt-bot { display: flex; align-items: center; gap: 12px; width: var(--pw); }
.ptdef .pt-gauge { flex: 1; height: 34px; border: 3px solid #120c1c; border-radius: 6px; background: #3a3348; position: relative; overflow: hidden; }
.ptdef .pt-gauge i { position: absolute; inset: 0 auto 0 0; transition: width .2s; }
.ptdef .pt-gauge.warn { animation: ptshake .15s 3; border-color: #c0392b; }
@keyframes ptshake { 50% { transform: translateX(6px); } }
.ptdef .pt-gauge span { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; font-size: 16px; text-shadow: 1px 1px 0 #000; }
.ptdef .pt-bomb { font-family: 'QPTitle', serif; font-size: 24px; padding: 8px 20px; border: 3px solid #120c1c; border-radius: 10px; background: #6b6478; color: #bbb; box-shadow: 3px 3px 0 rgba(0,0,0,.4); cursor: pointer; touch-action: manipulation; white-space: nowrap; }
.ptdef .pt-bomb.on { background: #ffe36a; color: #2a211b; animation: ptbeat .4s infinite alternate; }
@keyframes ptbeat { to { transform: scale(1.08); } }
.ptdef .tpad { position: fixed; right: 14px; bottom: 12px; }
.ptdef .pt-big { position: fixed; left: 0; right: 0; top: 36%; text-align: center; pointer-events: none; z-index: 5; }
.ptdef .pt-big .w { display: inline-block; font-family: 'QPTitle', serif; font-size: 84px; color: #fff; -webkit-text-stroke: 3px #1a120b; text-shadow: 6px 6px 0 #1a120b; }
.ptdef .pt-big .w small { display: block; font-size: 26px; -webkit-text-stroke: 0; text-shadow: 2px 2px 0 #1a120b; }
.ptres .ptface { font-size: 64px; line-height: 1.1; }
.ptres .ptbig { font-family: 'QPTitle', serif; font-size: 50px; color: #d9573f; }
.ptres .ptpc { display: flex; justify-content: center; gap: 10px; flex-wrap: wrap; margin: 10px 0 4px; }
.ptres .ptpc span { display: inline-flex; align-items: center; gap: 6px; padding: 4px 12px; border-radius: 6px; color: #fff; font-family: 'QPTitle', serif; font-size: 22px; border: 2px solid #120c1c; }
.ptres .ptpc span.me { outline: 3px solid #ffe36a; }
`;
  function css() {
    if (document.getElementById('pt-css')) return;
    const s = document.createElement('style');
    s.id = 'pt-css';
    s.textContent = CSS;
    document.head.appendChild(s);
  }
  const teamA = (C, t) => ((C.game.tt && C.game.tt.teams[t]) || {}).a || 0;
  const animal = (C, t) => QP.TEAM_ANIMALS[teamA(C, t)][0];
  const colOf = (C, t) => QP.ptColor(teamA(C, t));
  const nTeams = (C) => ((C.game.tt && C.game.tt.teams) || []).length || 2;

  function mount(parent, C) {
    css();
    const A = QP.PaintArt;
    const root = document.createElement('div');
    root.className = 'ptdef';
    root.innerHTML =
      '<div class="pt-top"><div class="pt-card pt-team"><img alt=""><div><b></b><br><small></small></div><div class="pt-sw"><i></i>우리 색</div></div><div class="pt-card pt-spd">걸음 <b>1.0</b>배</div>' +
      '<div class="pt-bars"></div><div class="pt-card pt-time">25</div></div>' +
      '<div class="pt-stage"><canvas></canvas></div>' +
      '<div class="pt-bot"><div class="pt-gauge"><i></i><span></span></div><button class="pt-bomb" tabindex="-1">🏺 먹물 항아리<small style="display:block;font-size:13px;font-family:QPBody,sans-serif">스페이스바</small></button></div>' +
      '<div class="tpad"><button tabindex="-1" data-d="u">▲</button><button tabindex="-1" data-d="l">◀</button><button tabindex="-1" data-d="r">▶</button><button tabindex="-1" data-d="d">▼</button></div>' +
      '<div class="pt-big"></div>';
    parent.appendChild(root);
    const $ = (s) => root.querySelector(s);
    const cv = $('.pt-stage canvas'),
      g = cv.getContext('2d');
    function fit() {
      // 맵(16:9)은 왼쪽에, 화살표 단추는 오른쪽 빈자리에(겹치지 않게). 위·아래 칸 높이 약 130px
      const w = Math.min(innerWidth - 262, ((innerHeight - 136) * 16) / 9);
      root.style.setProperty('--pw', Math.floor(w) + 'px');
    }
    fit();
    addEventListener('resize', fit);

    /* ---------- 누르기 ---------- */
    const keys = {};
    const KEY = { ArrowUp: 'u', ArrowDown: 'd', ArrowLeft: 'l', ArrowRight: 'r', w: 'u', s: 'd', a: 'l', d: 'r', W: 'u', S: 'd', A: 'l', D: 'r' };
    const kd = (e) => {
      if (KEY[e.key]) {
        keys[KEY[e.key]] = 1;
        e.preventDefault();
      } else if (e.key === ' ' || e.code === 'Space' || e.key === 'Spacebar') {
        // 스페이스바 = 먹물 항아리 (2026-11-09 담임). 눌린 단추가 대신 받지 않게 먼저 가로챈다
        e.preventDefault();
        e.stopPropagation();
        if (document.activeElement && document.activeElement !== document.body) document.activeElement.blur();
        if (!e.repeat) bomb();
      }
    };
    const ku = (e) => {
      if (KEY[e.key]) keys[KEY[e.key]] = 0;
    };
    addEventListener('keydown', kd, true);
    addEventListener('keyup', ku);
    const pad = $('.tpad');
    const held = new Map();
    const setPad = () => {
      const v = [...held.values()];
      for (const k of ['u', 'd', 'l', 'r']) keys['p' + k] = v.includes(k) ? 1 : 0;
      pad.querySelectorAll('button').forEach((b) => b.classList.toggle('on', v.includes(b.dataset.d)));
    };
    pad.addEventListener('pointerdown', (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      e.preventDefault();
      held.set(e.pointerId, b.dataset.d);
      try {
        b.setPointerCapture(e.pointerId);
      } catch (x) {}
      setPad();
    });
    pad.addEventListener('pointermove', (e) => {
      if (!held.has(e.pointerId)) return;
      const el = document.elementFromPoint(e.clientX, e.clientY);
      const b = el && el.closest && el.closest('.tpad button');
      if (b && held.get(e.pointerId) !== b.dataset.d) {
        held.set(e.pointerId, b.dataset.d);
        setPad();
      }
    });
    const up = (e) => {
      held.delete(e.pointerId);
      setPad();
    };
    pad.addEventListener('pointerup', up);
    pad.addEventListener('pointercancel', up);
    pad.addEventListener('contextmenu', (e) => e.preventDefault());
    // 맵을 누르면 그쪽으로 걷기(손가락을 대고 있는 동안)
    let aim = null;
    const aimAt = (e) => {
      const r = cv.getBoundingClientRect();
      aim = [((e.clientX - r.left) / r.width) * PT.W, ((e.clientY - r.top) / r.height) * PT.H];
    };
    cv.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      try {
        cv.setPointerCapture(e.pointerId);
      } catch (x) {}
      aimAt(e);
    });
    cv.addEventListener('pointermove', (e) => {
      if (aim) aimAt(e);
    });
    const aimOff = () => (aim = null);
    cv.addEventListener('pointerup', aimOff);
    cv.addEventListener('pointercancel', aimOff);
    $('.pt-bomb').addEventListener('pointerdown', (e) => {
      e.preventDefault();
      bomb();
    });

    /* ---------- 상태 ---------- */
    let mg = -1,
      M = null,
      board = null,
      lay = null,
      cols = [],
      me = [0, 0],
      dir = 1,
      step = 0,
      sp = PT.BASE,
      bombs = 0,
      lastSend = -9,
      lastM = '',
      trail = [], // 내 붓 자국(서버가 아직 모르는 것): [x0, y0, x1, y1, 때 ms, 항아리면 1]
      shown = {}, // 친구 sid → {x, y, f, dir}
      seenBm = 0,
      splats = [],
      sentFinal = false,
      boomAt = -9999,
      notYet = -9999,
      lastFrame = performance.now();
    function setup(L) {
      mg = L.mg;
      M = QP.ptMap(L.map);
      const n = nTeams(C);
      cols = [...Array(n).keys()].map((t) => colOf(C, t));
      board = new QP.PaintBoard(M, n);
      lay = A.layer(M, cols);
      cv.width = lay.cv.width;
      cv.height = lay.cv.height;
      g.imageSmoothingEnabled = false;
      const p = (L.pos && L.pos[C.seat.sid]) || [40, 40];
      me = [p[0] / 10, p[1] / 10];
      sp = (L.sp && L.sp[C.seat.sid]) || PT.BASE;
      bombs = 0;
      lastSend = -9;
      lastM = '';
      trail = [];
      shown = {};
      seenBm = (L.bm || []).length;
      splats = [];
      sentFinal = false;
      const t = C.seat.team;
      $('.pt-team img').src = PX.icon(animal(C, t), C.seat.cl || 0, 40);
      $('.pt-team b').textContent = QP.teamName(teamA(C, t));
      $('.pt-team small').textContent = '나 = ' + (C.seat.nick || '') + ' · ' + QP.PT_MAPNAME[L.map];
      $('.pt-spd b').textContent = (sp / PT.BASE).toFixed(1);
      $('.pt-gauge i').style.background = cols[t].col;
      $('.pt-sw i').style.background = cols[t].col;
      $('.pt-bars').innerHTML = cols.map((T, i) => '<i style="background:' + T.col + '" data-t="' + i + '"></i>').join('') + '<div class="q">마지막 3초! 어느 팀이 더 칠했을까?</div>';
    }
    const gNow = (L) => (C.net.now() - L.t0) / QP.ms(1);
    function send(L) {
      const [bx, by] = QP.ptEnc(me[0], me[1]);
      C.write({ b: { r: L.mg, x: bx, y: by, d: bombs, k: 0, h: 0 } });
    }
    function bomb() {
      const L = C.game && C.game.live;
      if (!L || L.kind !== 'paint' || L.mg !== mg || !board) return;
      const gg = gNow(L);
      if (gg < 0 || gg > L.dur) return;
      const gv = (L.g && L.g[C.seat.sid]) || 0;
      // 아직 덜 찼거나, 방금 터뜨려서 선생님 화면이 게이지를 0으로 돌리기 전이면
      if (gv < 100 || performance.now() - boomAt < 1200) {
        notYet = performance.now();
        return;
      }
      boomAt = performance.now();
      bombs++;
      trail.push([me[0], me[1], me[0], me[1], performance.now(), 1]);
      splats.push({ x: me[0], y: me[1], t0: performance.now(), t: C.seat.team });
      send(L);
      lastSend = gg;
    }
    // 서버 칸 + 아직 서버가 모르는 내 붓 자국
    function rebuild(L, now) {
      if (L.m !== lastM) {
        lastM = L.m;
        board.decode(L.m);
        trail = trail.filter((s) => now - s[4] < 1500);
        const t = C.seat.team;
        for (const s of trail) {
          if (s[5]) for (let r = 1; r <= PT.BR; r++) board.dab(s[0], s[1], r, t);
          else board.stroke(s[0], s[1], s[2], s[3], t);
        }
      }
    }

    let raf = 0,
      gone = false,
      bigSig = '';
    function frame(now) {
      if (gone) return;
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.1, (now - lastFrame) / 1000);
      lastFrame = now;
      const L = C.game && C.game.live;
      if (!L || L.kind !== 'paint' || !C.seat || C.phase !== 'defend') return;
      if (L.mg !== mg) setup(L);
      const gg = gNow(L);
      const play = gg >= 0 && gg < L.dur;
      rebuild(L, now);
      // 걷기
      if (play) {
        let dx = (keys.r || keys.pr ? 1 : 0) - (keys.l || keys.pl ? 1 : 0),
          dy = (keys.d || keys.pd ? 1 : 0) - (keys.u || keys.pu ? 1 : 0);
        if (!dx && !dy && aim) {
          dx = aim[0] - me[0];
          dy = aim[1] - me[1];
          if (Math.hypot(dx, dy) < 0.4) dx = dy = 0;
        }
        if (dx || dy) {
          const [nx, ny] = QP.ptMove(M, me[0], me[1], dx, dy, sp * dt);
          if (nx !== me[0] || ny !== me[1]) {
            board.stroke(me[0], me[1], nx, ny, C.seat.team);
            trail.push([me[0], me[1], nx, ny, now, 0]);
            if (Math.abs(nx - me[0]) > 0.001) dir = nx > me[0] ? 1 : -1;
            step += dt * sp * 2.2;
            me = [nx, ny];
          }
        }
        if (gg - lastSend >= SEND_S) {
          lastSend = gg;
          send(L);
        }
      } else if (gg >= L.dur && !sentFinal) {
        sentFinal = true;
        send(L);
      }
      // 친구 위치(부드럽게 따라감)
      const ro = C.game.roster || [];
      for (const m of ro) {
        if (m.sid === C.seat.sid) continue;
        const p = L.pos && L.pos[m.sid];
        if (!p) continue;
        const s = shown[m.sid] || (shown[m.sid] = { x: p[0] / 10, y: p[1] / 10, f: 0, dir: 1 });
        QP.ptFollow(s, p[0] / 10, p[1] / 10, dt);
      }
      // 다른 친구 먹물 항아리
      const bm = L.bm || [];
      for (; seenBm < bm.length; seenBm++) {
        const b = bm[seenBm];
        const mine = splats.some((s) => s.t === b[2] && Math.hypot(s.x - b[0] / 10, s.y - b[1] / 10) < 1.5 && now - s.t0 < 1500);
        if (!mine) splats.push({ x: b[0] / 10, y: b[1] / 10, t0: now, t: b[2] });
      }
      draw(L, now, ro);
      hud(L, gg);
    }
    function draw(L, now, ro) {
      lay.sync(board.p, now);
      g.setTransform(1, 0, 0, 1, 0, 0);
      const shake = splats.some((s) => now - s.t0 < 300);
      if (shake) g.setTransform(1, 0, 0, 1, (Math.random() - 0.5) * 6, (Math.random() - 0.5) * 6);
      g.drawImage(lay.cv, 0, 0);
      lay.drawWet(g, now);
      splats = splats.filter((s) => A.splat(g, s, cols[s.t] || cols[0], now));
      const list = [];
      for (const m of ro) {
        if (m.team === undefined || !cols[m.team]) continue;
        const mine = m.sid === C.seat.sid;
        const s = mine ? { x: me[0], y: me[1], f: step, dir } : shown[m.sid];
        if (!s) continue;
        list.push({ x: s.x, y: s.y, f: s.f, dir: s.dir, an: animal(C, m.team), cl: m.cl || 0, col: cols[m.team], me: mine, full: ((L.g && L.g[m.sid]) || 0) >= 100 });
      }
      list.sort((a, b) => a.me - b.me || a.y - b.y); // 내 인형은 늘 맨 위에
      for (const k of list) A.kid(g, k, now);
      g.setTransform(1, 0, 0, 1, 0, 0);
    }
    function hud(L, gg) {
      const left = Math.max(0, L.dur - Math.max(0, gg));
      const tm = $('.pt-time');
      tm.textContent = Math.ceil(Math.min(L.dur, left));
      tm.classList.toggle('hurry', left <= 5 && gg >= 0);
      const pc = board.pct();
      const hide = gg < L.dur && left <= PT.HIDE;
      const bars = $('.pt-bars');
      bars.classList.toggle('hide', hide);
      bars.querySelectorAll('i').forEach((e) => {
        const t = +e.dataset.t;
        e.style.width = pc[t] + '%';
        e.textContent = pc[t] > 8 ? Math.round(pc[t]) + '%' : '';
      });
      const gv = (L.g && L.g[C.seat.sid]) || 0;
      $('.pt-gauge i').style.width = gv + '%';
      const full = gv >= 100 && gg >= 0 && gg < L.dur;
      const warn = performance.now() - notYet < 900;
      $('.pt-gauge span').textContent = full ? '먹물 항아리 준비! 스페이스바를 눌러요' : warn ? '아직 덜 찼어요! ' + gv + '% · 더 칠해요' : '먹물 항아리 ' + gv + '% · 칠할수록 차요';
      $('.pt-gauge').classList.toggle('warn', warn && !full);
      $('.pt-bomb').classList.toggle('on', full);
      let big = '';
      if (gg < 0) big = '<span class="w">' + Math.ceil(-gg) + '<small>노란 고리가 <b>나</b>예요! <i class="sw" style="background:' + cols[C.seat.team].col + '"></i>우리 팀 색으로 칠해요</small></span>';
      else if (gg < 0.6) big = '<span class="w">시작!</span>';
      else if (gg >= L.dur) big = '<span class="w">끝!<small>TV에서 결과를 봐요</small></span>';
      if (big !== bigSig) $('.pt-big').innerHTML = bigSig = big;
    }
    raf = requestAnimationFrame(frame);
    return {
      root,
      unmount() {
        gone = true;
        cancelAnimationFrame(raf);
        removeEventListener('keydown', kd, true);
        removeEventListener('keyup', ku);
        removeEventListener('resize', fit);
        root.remove();
      },
    };
  }
  QP.PaintView = { mount };

  /* ---------- 모이는 곳·정답·결과·끝 (kid-ui.js scTreasure 가 C.paint 일 때 부른다) ---------- */
  function html(C, h) {
    css();
    const ph = C.phase,
      s = C.seat || {},
      c = C.game.cfg;
    if (ph === 'lobby') {
      const mates = (C.game.roster || []).filter((x) => x.team === s.team);
      return (
        '<div class="center hello thello"><img class="bigdoll pxi" src="' + h.tIcon(144) + '" alt=""><h2>나는 <b>' + esc(s.nick) + '</b></h2>' +
        '<p class="tline">우리 팀은 <b>' + h.tname + '</b> · ' + mates.length + '명</p>' +
        '<div class="tmates">' + mates.map((m) => '<span' + (m.sid === s.sid ? ' class="me"' : '') + '><img class="pxi" src="' + h.tIcon(40, m.cl) + '" alt="">' + esc(m.sid === s.sid ? '나' : m.nick) + '</span>').join('') + '</div>' +
        '<p>문제 ' + c.per + '개를 풀 때마다 <b>색칠 대작전</b>을 해요.<br>붓을 들고 돌아다니며 우리 팀 색으로 칠해요. 많이 맞힐수록 빨리 걸어요!</p></div>'
      );
    }
    if (ph === 'question') return null;
    if (ph === 'reveal') {
      const res = C.myRes();
      if (!res) return null;
      return (
        '<div class="center tres ' + (res.ok ? 'ok' : 'no') + '">' + (res.ok ? '<div class="ok-badge">맞았어요!</div>' : '<div class="no-badge">' + (res.my === null ? '시간이 다 됐어요' : '아쉬워요') + '</div>') +
        (!res.ok ? (res.my !== null ? '<div class="my">내 답: ' + esc(res.my) + '</div>' : '') + '<div class="ans' + (String(res.ans).length > 6 ? ' long' : '') + '">정답은 <b>' + esc(res.ans) + '</b></div>' + (res.exp ? '<div class="exp">' + esc(res.exp) + '</div>' : '') : '') +
        '<div class="tpow"><span>걸음</span><b>' + (QP.ptSpeed(res.blk) / PT.BASE).toFixed(1) + '배</b></div>' +
        '<p class="tnext">' + (res.left === 0 ? '이제 <b>색칠 대작전</b>! 디벗을 봐요' : '색칠까지 <b>' + res.left + '</b>문제') + '</p></div>'
      );
    }
    if (ph === 'dres') {
      const d = s.dres;
      if (!d) return '<div class="center"><div class="spin"></div></div>';
      const n = d.pc.length;
      return (
        '<div class="center tres dres ptres"><div class="ptface">' + (d.win ? '🎉' : '🖌️') + '</div>' +
        '<div class="ptbig">' + (d.rk ? '우리 팀 ' + d.rk + '등! <span style="color:#2a211b">+' + (d.pt || 0) + '점</span>' : d.win ? '우리 팀 승리!' : '아쉬워요!') + '</div>' +
        '<div class="ptpc">' + [...Array(n).keys()].map((t) => '<span class="' + (t === s.team ? 'me' : '') + '" style="background:' + colOf(C, t).col + '">' + esc(QP.TEAM_ANIMALS[teamA(C, t)][0]) + ' ' + d.pc[t] + '%</span>').join('') + '</div>' +
        '<p class="sub">내가 칠한 칸 <b>' + d.my + '</b> · ' + (d.pts ? '우리 팀 점수 <b>' + d.pts[s.team] + '</b>점' : '이긴 판 ' + d.wins[s.team] + '번') + '</p><p class="tvnote">TV를 봐요!</p></div>'
      );
    }
    if (ph === 'end') {
      const v = s.fin;
      if (!v) return '<div class="center"><div class="spin"></div></div>';
      return (
        '<div class="center endcard"><img class="bigdoll pxi" src="' + h.tIcon(144) + '" alt=""><h1 class="t">' + h.tname + ' ' + (v.rank || '-') + '등</h1>' +
        '<p class="sum">우리 팀 점수 ' + (v.tot || 0) + '점 · 내가 칠한 칸 ' + (v.my || 0) + ' · 내가 맞힌 문제 ' + v.nOk + '개</p><p>' + (v.rank === 1 ? '와, 우리 팀이 1등이에요!' : '수고했어요! TV를 봐요.') + '</p></div>'
      );
    }
    return null;
  }
  function chip(C, nOk) {
    return '<div class="wlv">걸음 <b>' + (QP.ptSpeed(nOk) / PT.BASE).toFixed(1) + '</b>배</div>';
  }
  QP.PaintScreens = { html, chip };
})();
