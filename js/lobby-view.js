/* lobby-view.js — 모이는 곳 도트 광장 화면 (작업/결정-대기실.md). 규칙·셈은 core/lobby.js. pixel-art.js 뒤에.
 *   아이: const v = QP.LobbyView.mount(부모, KidClient);  v.unmount();
 *   TV:   const v = QP.LobbyTV.mount(부모, ref);  v.unmount();   (선생님 화면 모이는 곳, 3D 섬 대신)
 * 내 인형은 누르는 즉시 움직이고 0.7초마다 위치를 보낸다. 친구·술래·말풍선은 선생님 화면(심판)이 정한 것(lb)을 따른다.
 */
(function () {
  'use strict';
  const QP = window.QP,
    PX = window.PX;
  const LB = QP.LB;
  const C = 20,
    S = 3; // 칸 크기, 인형 크기
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const hash = (x, y, k) => {
    let h = (x * 374761393 + y * 668265263 + k * 2147483647) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  };
  const CSS = `
.lbv { position: fixed; inset: 0; display: flex; flex-direction: column; align-items: flex-start; gap: 8px; padding: 10px 0 10px 12px; box-sizing: border-box; background: #2b2018; color: #fff; user-select: none; -webkit-user-select: none; touch-action: none; z-index: 1; }
.lbv .lb-top { display: flex; align-items: center; gap: 10px; width: var(--lw); flex-wrap: nowrap; }
.lbv .lb-me { display: flex; align-items: center; gap: 8px; background: #fbf4e4; color: #2a211b; border: 3px solid #120c1c; border-radius: 6px; padding: 2px 12px 2px 2px; font-size: 15px; white-space: nowrap; }
.lbv .lb-me img { width: 40px; height: 40px; image-rendering: pixelated; border-radius: 4px; }
.lbv .lb-me b { font-family: 'QPTitle', serif; font-weight: normal; font-size: 19px; }
.lbv .lb-role { font-family: 'QPTitle', serif; font-size: 22px; padding: 2px 14px; border-radius: 8px; border: 3px solid #120c1c; background: #8fd0a0; color: #1a2a1a; white-space: nowrap; }
.lbv .lb-role.it { background: #ff6a55; color: #fff; animation: lbbeat .5s infinite alternate; }
.lbv .lb-role.off { background: #d8d0c0; }
@keyframes lbbeat { to { transform: scale(1.06); } }
.lbv .lb-sp { flex: 1; }
.lbv .lb-emo { display: flex; gap: 6px; }
.lbv .lb-emo button { width: 56px; height: 50px; font-size: 26px; border: 3px solid #120c1c; border-radius: 10px; background: #fbf4e4; box-shadow: 3px 3px 0 rgba(0,0,0,.4); cursor: pointer; padding: 0; touch-action: manipulation; }
.lbv .lb-emo button:active { transform: translate(2px, 2px); box-shadow: none; }
.lbv .lb-how { font-family: 'QPTitle', serif; font-size: 17px; padding: 6px 12px; border: 3px solid #120c1c; border-radius: 10px; background: #ffe36a; color: #2a211b; cursor: pointer; white-space: nowrap; }
.lbv .lb-stage { position: relative; width: var(--lw); }
.lbv .lb-stage canvas { display: block; width: 100%; image-rendering: pixelated; border: 5px solid #5a3b22; outline: 3px solid #1a120b; border-radius: 6px; box-sizing: border-box; }
.lbv .lb-note { position: absolute; left: 50%; top: 10px; transform: translateX(-50%); background: #fff3c4; color: #5a2a1a; border: 3px solid #c0392b; border-radius: 10px; padding: 3px 16px; font-size: 18px; white-space: nowrap; pointer-events: none; }
.lbv .lb-note[hidden] { display: none; }
.lbv .lb-foot { width: var(--lw); font-size: 16px; color: #e8dcc8; }
.lbv .lb-foot b { color: #ff8a7a; }
.lbv .tpad { position: fixed; right: 14px; bottom: 12px; }
.lbtv { position: fixed; left: 28px; right: 350px; top: 128px; bottom: 86px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; pointer-events: none; }
.lbtv canvas { display: block; image-rendering: pixelated; border: 6px solid #5a3b22; outline: 3px solid #1a120b; border-radius: 8px; box-shadow: 6px 6px 0 rgba(0,0,0,.35); }
.lbtv .lb-note { background: #fff3c4; color: #5a2a1a; border: 3px solid #c0392b; border-radius: 10px; padding: 2px 16px; font-size: 22px; white-space: nowrap; min-height: 30px; }
.lbtv .lb-note.calm { background: rgba(255,255,255,.75); border-color: transparent; color: #4a3828; }
.lbtv .lb-note b { color: #d9573f; }
body.plaza #cv, body.plaza #labels, body.plaza #kidlist { visibility: hidden; }
body.plaza.tv { background: #2b2018; }
body.plaza .tv-title h1 { color: #fff7e6; text-shadow: 3px 3px 0 #000; }
`;
  function css() {
    if (document.getElementById('lb-css')) return;
    const s = document.createElement('style');
    s.id = 'lb-css';
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  /* ---------- 그림 ---------- */
  let bgCv = null;
  function bg() {
    if (bgCv) return bgCv;
    const W = LB.W,
      H = LB.H;
    bgCv = document.createElement('canvas');
    bgCv.width = W * C;
    bgCv.height = H * C;
    const f = bgCv.getContext('2d');
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const X = x * C,
          Y = y * C;
        const dx = (x + 0.5 - W / 2) / 15,
          dy = (y + 0.5 - H / 2) / 8.5;
        if (dx * dx + dy * dy < 1) {
          f.fillStyle = (x + y) % 2 ? '#d9cdb4' : '#e4d9c2';
          f.fillRect(X, Y, C, C);
          f.fillStyle = '#c9bb9e';
          f.fillRect(X, Y + C - 2, C, 2);
          f.fillRect(X + C - 2, Y, 2, C);
        } else {
          f.fillStyle = hash(x, y, 1) < 0.5 ? '#8cc461' : '#86bd5b';
          f.fillRect(X, Y, C, C);
          if (hash(x, y, 2) < 0.25) {
            f.fillStyle = '#6fa84a';
            f.fillRect(X + 4, Y + 10, 2, 4);
            f.fillRect(X + 8, Y + 8, 2, 6);
          }
          if (hash(x, y, 3) < 0.04) {
            f.fillStyle = hash(x, y, 4) < 0.5 ? '#ffd23e' : '#f2a6ad';
            f.fillRect(X + 8, Y + 8, 4, 4);
            f.fillStyle = '#fff';
            f.fillRect(X + 9, Y + 9, 2, 2);
          }
        }
      }
    f.fillStyle = '#8b5a3c';
    f.fillRect((W / 2) * C - 2, (H / 2 - 3) * C, 4, 3 * C);
    f.fillStyle = '#d9573f';
    f.fillRect((W / 2) * C + 2, (H / 2 - 3) * C, 2 * C, C);
    f.fillStyle = '#ffe36a';
    f.fillRect((W / 2) * C + 8, (H / 2 - 3) * C + 6, 8, 8);
    for (let i = 0; i < 18; i++) {
      const t = PX.tree[i % 2];
      f.drawImage(t, Math.round((i + 0.5) * ((W * C) / 18) - t.width), -6, t.width * 2, t.height * 2);
    }
    return bgCv;
  }
  function horns(g, X, top) {
    for (const sx of [-1, 1]) {
      const bx = X + sx * 11;
      g.fillStyle = '#1a120b';
      g.fillRect(bx - 6, top - 6, 12, 12);
      g.fillRect(bx - 4 + sx * 2, top - 14, 8, 10);
      g.fillRect(bx - 2 + sx * 4, top - 20, 6, 8);
      g.fillStyle = '#ff4a2e';
      g.fillRect(bx - 4, top - 4, 8, 9);
      g.fillRect(bx - 2 + sx * 2, top - 12, 4, 9);
      g.fillRect(bx + sx * 4, top - 18, 2, 7);
      g.fillStyle = '#ffd0c0';
      g.fillRect(bx - 3, top - 3, 2, 4);
    }
  }
  // k = {x, y, f, dir, a(동물 번호), cl, it, fz, sh, emo(글자), st(넘어가기까지 초), me}
  function drawKid(g, k, now) {
    const an = typeof k.a === 'string' ? k.a : (QP.TEAM_ANIMALS[k.a] || QP.TEAM_ANIMALS[0])[0];
    const fr = PX.kid(an, k.cl || 0)[Math.floor(k.f || 0) % 4];
    const X = Math.round(k.x * C),
      Y = Math.round(k.y * C);
    const top = Y - fr.height * S + 10;
    g.fillStyle = 'rgba(30,50,20,.28)';
    g.fillRect(X - 15, Y + 6, 30, 6);
    if (k.it) {
      g.lineWidth = 4;
      g.strokeStyle = '#ff4a2e';
      g.setLineDash([6, 4]);
      g.lineDashOffset = -now / 40;
      g.beginPath();
      g.ellipse(X, Y + 9, 26, 11, 0, 0, 6.283);
      g.stroke();
      g.setLineDash([]);
    }
    if (k.me) {
      g.lineWidth = 6;
      g.strokeStyle = '#1a120b';
      g.beginPath();
      g.ellipse(X, Y + 9, 28, 12, 0, 0, 6.283);
      g.stroke();
      g.lineWidth = 4;
      g.strokeStyle = '#ffe36a';
      g.stroke();
    }
    if (k.sh) {
      g.globalAlpha = 0.35;
      g.fillStyle = '#7fd8ff';
      g.beginPath();
      g.ellipse(X, Y - 20, 28, 34, 0, 0, 6.283);
      g.fill();
      g.globalAlpha = 1;
    }
    if (k.fz && Math.floor(now / 120) % 2) g.globalAlpha = 0.45;
    g.save();
    g.translate(X, top);
    if ((k.dir || 1) < 0) g.scale(-1, 1);
    g.imageSmoothingEnabled = false;
    g.drawImage(fr, (-fr.width * S) / 2, 0, fr.width * S, fr.height * S);
    g.restore();
    g.globalAlpha = 1;
    if (k.it) horns(g, X, top);
    if (k.it && k.st) {
      g.font = '15px QPBody';
      g.textAlign = 'center';
      g.fillStyle = '#fff';
      g.strokeStyle = '#000';
      g.lineWidth = 3;
      const s = k.st + '초 뒤 넘어가요';
      g.strokeText(s, X, Y + 28);
      g.fillText(s, X, Y + 28);
    }
    if (k.emo) {
      const by = top - (k.it ? 22 : 8) - 36;
      g.fillStyle = '#fff';
      g.strokeStyle = '#1a120b';
      g.lineWidth = 3;
      g.beginPath();
      if (g.roundRect) g.roundRect(X - 24, by, 48, 38, 9);
      else g.rect(X - 24, by, 48, 38);
      g.fill();
      g.stroke();
      g.beginPath();
      g.moveTo(X - 6, by + 37);
      g.lineTo(X, by + 45);
      g.lineTo(X + 6, by + 37);
      g.fill();
      g.font = '27px sans-serif';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillStyle = '#000';
      g.fillText(k.emo, X, by + 20);
      g.textBaseline = 'alphabetic';
    }
    if (k.me) {
      g.font = '22px QPTitle';
      g.textAlign = 'center';
      g.lineWidth = 4;
      g.strokeStyle = '#000';
      g.fillStyle = '#ffe36a';
      const ny = top - (k.it ? 22 : 6) - (k.emo ? 48 : 0);
      g.strokeText('나', X, ny);
      g.fillText('나', X, ny);
    }
  }
  // 그림판 하나에 광장 + 아이들 그리기. list = drawKid 의 k 들
  function drawAll(g, list, now) {
    g.drawImage(bg(), 0, 0);
    list.sort((a, b) => a.y - b.y || (a.me ? 1 : 0) - (b.me ? 1 : 0));
    for (const k of list) drawKid(g, k, now);
  }
  QP.LobbyArt = { C, bg, drawKid, drawAll };

  // lb(판 문서) → 친구 그리기 목록. shown = sid → 따라가는 자리
  function friends(lb, shown, dt, skip) {
    const out = [];
    const its = lb.it || [];
    for (const [sid, p] of Object.entries(lb.p || {})) {
      if (sid === skip) continue;
      const s = shown[sid] || (shown[sid] = { x: p[0] / 10, y: p[1] / 10, f: 0, dir: 1 });
      QP.lbFollow(s, p[0] / 10, p[1] / 10, dt);
      const look = (lb.k && lb.k[sid]) || [0, 0];
      const e = lb.e && lb.e[sid];
      out.push({ x: s.x, y: s.y, f: s.f, dir: s.dir, a: look[0], cl: look[1], it: its.includes(sid), fz: !!(lb.fz && lb.fz[sid]), sh: !!(lb.sh && lb.sh[sid]), emo: e ? QP.LB_EMOS[e[0]] : '', st: (lb.st && lb.st[sid]) || 0 });
    }
    return out;
  }

  /* ---------- 아이 디벗 ---------- */
  function mount(parent, Cl) {
    css();
    const root = document.createElement('div');
    root.className = 'lbv';
    const team = Cl.seat && Cl.seat.team !== undefined && Cl.game.tt ? QP.teamName(((Cl.game.tt.teams || [])[Cl.seat.team] || {}).a || 0) : '';
    root.innerHTML =
      '<div class="lb-top"><div class="lb-me"><img alt=""><div><b></b><br><small></small></div></div><div class="lb-role"></div><div class="lb-sp"></div>' +
      '<div class="lb-emo">' + QP.LB_EMOS.map((e, j) => '<button tabindex="-1" data-j="' + j + '">' + e + '</button>').join('') + '</div>' +
      (QP.Howto && QP.Howto.has(Cl.game.mode) ? '<button class="lb-how" tabindex="-1">📖 놀이 방법</button>' : '') + '</div>' +
      '<div class="lb-stage"><canvas></canvas><div class="lb-note" hidden></div></div>' +
      '<div class="lb-foot">선생님이 시작할 때까지 놀아요 · <b>뿔 달린 도깨비</b>를 피해요! 잡히면 내가 도깨비 · 화살표로 걷고, 위 단추로 인사해요</div>' +
      '<div class="tpad"><button tabindex="-1" data-d="u">▲</button><button tabindex="-1" data-d="l">◀</button><button tabindex="-1" data-d="r">▶</button><button tabindex="-1" data-d="d">▼</button></div>';
    parent.appendChild(root);
    const $ = (s) => root.querySelector(s);
    const cv = $('canvas'),
      g = cv.getContext('2d');
    cv.width = LB.W * C;
    cv.height = LB.H * C;
    const fit = () => root.style.setProperty('--lw', Math.floor(Math.min(innerWidth - 262, ((innerHeight - 120) * 16) / 9)) + 'px');
    fit();
    addEventListener('resize', fit);
    $('.lb-me small').textContent = team ? '우리 팀: ' + team : '모이는 곳';
    $('.lb-me b').textContent = (Cl.seat && Cl.seat.nick) || '';
    const how = $('.lb-how');
    if (how) how.onclick = () => QP.Howto.open(Cl.game.mode);

    // 누르기
    const keys = {};
    const KEY = { ArrowUp: 'u', ArrowDown: 'd', ArrowLeft: 'l', ArrowRight: 'r', w: 'u', s: 'd', a: 'l', d: 'r', W: 'u', S: 'd', A: 'l', D: 'r' };
    const kd = (e) => {
      if (document.getElementById('hw-back')) return; // 놀이 설명이 열려 있으면 그쪽이 받는다
      if (KEY[e.key]) {
        keys[KEY[e.key]] = 1;
        e.preventDefault();
      } else if (/^[1-4]$/.test(e.key)) emote(+e.key - 1);
    };
    const ku = (e) => {
      if (KEY[e.key]) keys[KEY[e.key]] = 0;
    };
    addEventListener('keydown', kd);
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
    // 맵을 누르면 그쪽으로
    let aim = null;
    const aimAt = (e) => {
      const r = cv.getBoundingClientRect();
      aim = [((e.clientX - r.left) / r.width) * LB.W, ((e.clientY - r.top) / r.height) * LB.H];
    };
    cv.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      try {
        cv.setPointerCapture(e.pointerId);
      } catch (x) {}
      aimAt(e);
    });
    cv.addEventListener('pointermove', (e) => aim && aimAt(e));
    const aimOff = () => (aim = null);
    cv.addEventListener('pointerup', aimOff);
    cv.addEventListener('pointercancel', aimOff);

    // 상태
    const me = Cl.seat.sid;
    let pos = null,
      dir = 1,
      step = 0,
      seq = 0,
      emoIdx = 0,
      emoAt = -9,
      lastSend = -9,
      sentKey = '',
      shown = {},
      last = performance.now(),
      noteSig = '',
      iconSig = '';
    function emote(j) {
      const lb = Cl.game && Cl.game.lb;
      if (!lb || !lb.on) return;
      seq++;
      emoIdx = j;
      emoAt = performance.now();
      send(true);
    }
    root.querySelectorAll('.lb-emo button').forEach((b) =>
      b.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        emote(+b.dataset.j);
      })
    );
    function send(force) {
      if (!pos) return;
      const [bx, by] = QP.lbEnc(pos[0], pos[1]);
      const d = seq ? seq * 10 + emoIdx : 0;
      const k = bx + ',' + by + ',' + d;
      if (k === sentKey) return;
      const t = performance.now() / 1000;
      if (!force && t - lastSend < LB.SEND_S) return;
      sentKey = k;
      lastSend = t;
      Cl.write({ b: { r: -1, x: bx, y: by, d, k: 0, h: 0 } });
    }
    let raf = 0,
      gone = false;
    function frame(now) {
      if (gone) return;
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      const lb = Cl.game && Cl.game.lb;
      if (!lb || Cl.phase !== 'lobby') return;
      if (!pos) {
        const p = lb.p && lb.p[me];
        pos = p ? [p[0] / 10, p[1] / 10] : QP.lbSpawn(Cl.seat.num || 1);
      }
      const lk = (lb.k && lb.k[me]) || ['곰', 0];
      if (lk.join() !== iconSig) {
        iconSig = lk.join();
        $('.lb-me img').src = PX.icon(typeof lk[0] === 'string' ? lk[0] : QP.TEAM_ANIMALS[lk[0]][0], lk[1], 40);
      }
      const it = (lb.it || []).includes(me),
        frozen = !!(lb.fz && lb.fz[me]);
      if (lb.on && !frozen) {
        let dx = (keys.r || keys.pr ? 1 : 0) - (keys.l || keys.pl ? 1 : 0),
          dy = (keys.d || keys.pd ? 1 : 0) - (keys.u || keys.pu ? 1 : 0);
        if (!dx && !dy && aim) {
          dx = aim[0] - pos[0];
          dy = aim[1] - pos[1];
          if (Math.hypot(dx, dy) < 0.4) dx = dy = 0;
        }
        if (dx || dy) {
          const np = QP.lbMove(pos[0], pos[1], dx, dy, (it ? LB.IT_SPEED : LB.SPEED) * dt);
          if (Math.abs(np[0] - pos[0]) > 0.001) dir = np[0] > pos[0] ? 1 : -1;
          step += Math.hypot(np[0] - pos[0], np[1] - pos[1]) * 2.2;
          pos = np;
        }
        send(false);
      } else if (frozen && lb.p && lb.p[me]) pos = [lb.p[me][0] / 10, lb.p[me][1] / 10]; // 잡힌 자리에 멈춤
      const list = friends(lb, shown, dt, me);
      const look = (lb.k && lb.k[me]) || [0, 0];
      const myE = performance.now() - emoAt < LB.EMO_S * 1000 ? QP.LB_EMOS[emoIdx] : '';
      list.push({ x: pos[0], y: pos[1], f: step, dir, a: look[0], cl: look[1], it, fz: frozen, sh: !!(lb.sh && lb.sh[me]), emo: myE, st: 0, me: true });
      drawAll(g, list, now);
      const role = $('.lb-role');
      const rt = !lb.on ? '놀이 끝! 선생님을 기다려요' : it ? (frozen ? '도깨비! 곧 출발' : '내가 도깨비! 친구를 잡아요') : lb.sh && lb.sh[me] ? '보호막!' : '도망가요!';
      if (role.textContent !== rt) {
        role.textContent = rt;
        role.className = 'lb-role' + (!lb.on ? ' off' : it ? ' it' : '');
      }
      const msg = lb.msg && lb.msg[2] === me ? (lb.msg[1] === 'tag' ? '앗, 잡혔어요! 이제 내가 도깨비!' : '도깨비가 나에게 넘어왔어요!') : lb.msg ? lb.msg[0] : '';
      if (msg !== noteSig) {
        noteSig = msg;
        const n = $('.lb-note');
        n.textContent = msg;
        n.hidden = !msg;
      }
    }
    raf = requestAnimationFrame(frame);
    return {
      root,
      unmount() {
        gone = true;
        cancelAnimationFrame(raf);
        removeEventListener('keydown', kd);
        removeEventListener('keyup', ku);
        removeEventListener('resize', fit);
        root.remove();
      },
    };
  }
  QP.LobbyView = { mount };

  /* ---------- 선생님 화면(TV) 모이는 곳 ---------- */
  function mountTV(parent, ref) {
    css();
    const root = document.createElement('div');
    root.className = 'lbtv';
    root.innerHTML = '<canvas></canvas><div class="lb-note calm"></div>';
    parent.appendChild(root);
    document.body.classList.add('plaza');
    const cv = root.querySelector('canvas'),
      g = cv.getContext('2d');
    cv.width = LB.W * C;
    cv.height = LB.H * C;
    const fit = () => {
      const r = root.getBoundingClientRect();
      const s = Math.min(r.width / cv.width, (r.height - 44) / cv.height);
      cv.style.width = Math.floor(cv.width * s) + 'px';
      cv.style.height = Math.floor(cv.height * s) + 'px';
    };
    fit();
    addEventListener('resize', fit);
    const shown = {};
    let last = performance.now(),
      raf = 0,
      gone = false,
      sig = '';
    function frame(now) {
      if (gone) return;
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      const lb = ref.lb;
      if (!lb) {
        g.drawImage(bg(), 0, 0);
        return;
      }
      // 심판이 들고 있는 최신 위치를 바로 쓴다(판 문서를 기다리지 않음)
      const live = ref.lbTag ? Object.assign({}, lb, ref.lbTag.snap(ref.net.now() / QP.ms(1))) : lb;
      drawAll(g, friends(live, shown, dt, null), now);
      const n = Object.keys(live.p || {}).length;
      const note = !lb.on ? '놀이 시간 끝! 선생님이 곧 시작해요' : live.msg ? esc(live.msg[0]) : n ? '<b>뿔 달린 도깨비</b>에게 잡히면 내가 도깨비! · 도깨비가 5초 쉬면 다른 친구에게 넘어가요' : '디벗으로 들어오면 여기에 내 인형이 나와요';
      if (note !== sig) {
        sig = note;
        const el = root.querySelector('.lb-note');
        el.innerHTML = note;
        el.classList.toggle('calm', !live.msg || !lb.on);
      }
    }
    raf = requestAnimationFrame(frame);
    return {
      unmount() {
        gone = true;
        cancelAnimationFrame(raf);
        removeEventListener('resize', fit);
        document.body.classList.remove('plaza');
        root.remove();
      },
    };
  }
  QP.LobbyTV = { mount: mountTV };
})();
