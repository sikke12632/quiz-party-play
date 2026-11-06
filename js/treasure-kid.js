/* treasure-kid.js — 아이 디벗의 「보물 지키기」 미니게임 화면 (도트, 작업/결정-보물지키기.md)
 * 320칸 그림판을 화면 크기로 키워 그린다. 내 인형은 누르는 즉시 움직이고, 위치는 1초 3번 서버로.
 * 적 위치는 판 문서의 씨앗으로 이 기기가 직접 셈하고(treasure.js), 물리침·하트는 선생님 화면이 정한 것을 따른다.
 *
 *   const v = QP.TreasureView.mount(부모요소, KidClient);  v.unmount();
 */
(function () {
  'use strict';
  const QP = window.QP,
    PX = window.PX;
  const TR = QP.TR;
  const W = 320,
    U = 12.3,
    SY = 0.75;
  const md = (a, n) => ((Math.floor(a) % n) + n) % n; // 음수 시간(3·2·1)에도 0 이상
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

  function mount(parent, C) {
    const root = document.createElement('div');
    root.className = 'tdef';
    root.innerHTML =
      '<canvas class="tcv"></canvas><div class="tlabs"></div>' +
      '<div class="ttop"><div class="tteam"><img alt=""><b></b><small></small></div><div class="thearts"><span>보물</span><i></i></div><div class="ttime"><span>남은 시간</span><b>0</b>초<span class="bar"><i></i></span></div></div>' +
      '<div class="tweap"><div class="l1">내 무기 <b></b> <span class="pips"></span></div><div class="l2"></div></div>' +
      '<div class="tpad"><button data-d="u">▲</button><button data-d="l">◀</button><button data-d="r">▶</button><button data-d="d">▼</button></div>' +
      '<div class="tintro" hidden><div class="n"></div><p>보물을 지켜요! 화살표로 움직이면 별 사탕은 저절로 던져요</p></div>';
    parent.appendChild(root);
    const cv = root.querySelector('.tcv'),
      g = cv.getContext('2d');
    const labs = root.querySelector('.tlabs');
    let H = 200,
      CX = W / 2,
      CY = 108,
      bg = null;
    const sx = (x) => Math.round(CX + x * U),
      sy = (y) => Math.round(CY + y * U * SY);
    function resize() {
      const r = root.getBoundingClientRect();
      const asp = Math.max(1.3, Math.min(2.2, r.width / Math.max(1, r.height)));
      const nh = Math.round(W / asp);
      if (nh !== H || !bg) {
        H = nh;
        cv.width = W;
        cv.height = H;
        CX = W / 2;
        CY = Math.round(H / 2 + 6);
        bg = PX.ground(W, H, CX, CY, 13.3 * U, 8.6 * U * SY, U, SY, 11);
        g.imageSmoothingEnabled = false;
      }
    }
    resize();
    addEventListener('resize', resize);
    const trees = [];
    {
      let s = 5;
      const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
      for (let i = 0; i < 30; i++) {
        const a = (i / 30) * Math.PI * 2 + rnd() * 0.15,
          k = 0.95 + rnd() * 0.06;
        trees.push({ x: Math.cos(a) * 13.3 * k, y: Math.sin(a) * 8.6 * k, v: i % 2 });
      }
    }

    /* ---------- 누르기 ---------- */
    const keys = { u: 0, d: 0, l: 0, r: 0 };
    const KEY = { ArrowUp: 'u', ArrowDown: 'd', ArrowLeft: 'l', ArrowRight: 'r', w: 'u', s: 'd', a: 'l', d: 'r', W: 'u', S: 'd', A: 'l', D: 'r' };
    const kd = (e) => {
      if (KEY[e.key]) {
        keys[KEY[e.key]] = 1;
        e.preventDefault();
      }
    };
    const ku = (e) => {
      if (KEY[e.key]) keys[KEY[e.key]] = 0;
    };
    addEventListener('keydown', kd);
    addEventListener('keyup', ku);
    const pad = root.querySelector('.tpad');
    const held = new Map(); // 손가락 → 방향
    const setPad = () => {
      for (const k of ['u', 'd', 'l', 'r']) keys['p' + k] = [...held.values()].includes(k) ? 1 : 0;
      pad.querySelectorAll('button').forEach((b) => b.classList.toggle('on', [...held.values()].includes(b.dataset.d)));
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
    // 손가락을 옆 단추로 밀면 방향이 바뀐다
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

    /* ---------- 상태 ---------- */
    let mg = -1,
      E = [],
      mates = [],
      myK = -1,
      me = [0, 0],
      vel = [0, 0],
      face = {},
      shown = {},
      hearts = 10,
      hurtAt = -9,
      seenHits = 0,
      labSig = '';
    const labEls = new Map();
    function setup(L) {
      mg = L.mg;
      const team = C.seat.team;
      mates = (C.game.roster || []).filter((x) => x.team === team);
      myK = mates.findIndex((x) => x.sid === C.seat.sid);
      E = QP.trSchedule(L.seed, L.dur, L.n[team]);
      me = QP.trHome(Math.max(0, myK), mates.length);
      vel = [0, 0];
      shown = {};
      mates.forEach((m) => (shown[m.sid] = QP.trHome(mates.indexOf(m), mates.length).slice()));
      hearts = L.h[team];
      seenHits = 0;
      hurtAt = -9;
      const [aname] = QP.TEAM_ANIMALS[(C.game.tt.teams[team] || {}).a || 0];
      root.querySelector('.tteam img').src = PX.icon(aname, C.seat.cl || 0, 48);
      root.querySelector('.tteam b').textContent = QP.teamName((C.game.tt.teams[team] || {}).a || 0);
      root.querySelector('.tteam small').textContent = mates.length + '명';
      const lv = L.lv[C.seat.sid] || 1;
      const [cool, many] = TR.WEAPON[lv];
      root.querySelector('.tweap b').textContent = lv + '단계';
      root.querySelector('.tweap .pips').innerHTML = [1, 2, 3, 4, 5].map((i) => '<i class="' + (i <= lv ? 'on' : '') + '"></i>').join('');
      root.querySelector('.tweap .l2').textContent = '별 사탕을 저절로 던져요 · ' + cool + '초마다 ' + many + '마리 · 방금 5문제 중 ' + Math.min(5, (C.seat.res && C.seat.res.blk) || 0) + '개 맞힘';
      labs.innerHTML = '';
      labEls.clear();
      for (const m of mates) {
        const d = document.createElement('div');
        d.className = 'tlab' + (m.sid === C.seat.sid ? ' me' : '');
        d.textContent = m.sid === C.seat.sid ? '나' : m.nick;
        labs.appendChild(d);
        labEls.set(m.sid, d);
      }
    }
    const put = (el, x, y) => {
      const r = cv.getBoundingClientRect();
      el.style.left = (x * r.width) / W + 'px';
      el.style.top = (y * r.height) / H + 'px';
    };
    function spr(c, x, y, flip, lift) {
      g.save();
      g.translate(sx(x), sy(y) - (lift || 0));
      if (flip) g.scale(-1, 1);
      g.drawImage(c, -Math.floor(c.width / 2), -c.height);
      g.restore();
    }
    function shadow(x, y, w) {
      g.fillStyle = 'rgba(30,60,20,.3)';
      g.fillRect(sx(x) - w, sy(y) - 1, w * 2, 2);
      g.fillRect(sx(x) - w + 2, sy(y) - 2, w * 2 - 4, 4);
    }

    let raf = 0,
      last = performance.now(),
      gone = false;
    function frame(now) {
      if (gone) return;
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const L = C.game && C.game.live;
      if (!L || !C.seat || C.phase !== 'defend') return;
      if (L.mg !== mg) setup(L);
      const team = C.seat.team;
      const t = (C.net.now() - L.t0) / QP.ms(1);
      const play = t >= 0 && t < L.dur;
      // 내 인형: 누르는 대로 (살짝 미끄러짐)
      const ix = (keys.r || keys.pr ? 1 : 0) - (keys.l || keys.pl ? 1 : 0),
        iy = (keys.d || keys.pd ? 1 : 0) - (keys.u || keys.pu ? 1 : 0);
      const il = Math.hypot(ix, iy) || 1;
      const tv = play ? [(ix / il) * TR.SPEED, (iy / il) * TR.SPEED] : [0, 0];
      const a = Math.min(1, dt * 12);
      vel = [vel[0] + (tv[0] - vel[0]) * a, vel[1] + (tv[1] - vel[1]) * a];
      me = QP.trClamp(me[0] + vel[0] * dt, me[1] + vel[1] * dt);
      if (Math.abs(vel[0]) > 0.3) face[C.seat.sid] = vel[0] > 0 ? 1 : -1;
      if (play) C.sendPos(me[0], me[1]);
      // 친구 인형: 받은 위치로 부드럽게
      for (const m of mates) {
        if (m.sid === C.seat.sid) {
          shown[m.sid] = me;
          continue;
        }
        const p = L.pos[m.sid];
        if (!p) continue;
        const s = shown[m.sid] || [p[0] / 10, p[1] / 10];
        const k = Math.min(1, dt * 6);
        const nx = s[0] + (p[0] / 10 - s[0]) * k;
        if (Math.abs(nx - s[0]) > 0.01) face[m.sid] = nx > s[0] ? 1 : -1;
        shown[m.sid] = [nx, s[1] + (p[1] / 10 - s[1]) * k];
      }
      // 물리친 적·닿은 적
      const kills = (L.kills && L.kills[team]) || [],
        hits = (L.hits && L.hits[team]) || [];
      const dead = {};
      const atk = {}; // 아이 번호 → 마지막 던진 때
      for (const [i, k, tk] of kills) {
        dead[i] = { k, t: tk / 100 };
        if (!atk[k] || atk[k] < tk / 100) atk[k] = tk / 100;
      }
      const hitSet = {};
      for (const [i] of hits) hitSet[i] = 1;
      if (L.h[team] < hearts) hurtAt = t;
      hearts = L.h[team];

      // 그리기
      g.drawImage(bg, 0, 0);
      const list = trees.map((d) => ({ y: d.y, f: () => spr(PX.tree[d.v], d.x, d.y) }));
      const hurt = t - hurtAt < 0.5;
      list.push({ y: 0, f: () => (shadow(0, 0, 11), spr(hurt && md(t * 12, 2) ? PX.chestHit : PX.chest[md(t * 3, 2)], 0, 0, false, hurt ? md(t * 20, 2) : 0)) });
      const f2 = md(t * 4, 2);
      const shots = [],
        pops = [];
      for (const e of E) {
        const dd = dead[e.i];
        const tEnd = dd ? dd.t + TR.FLY : e.arr;
        if (t < e.t || t > tEnd + 0.05) {
          if (dd && t > tEnd && t < tEnd + 0.6) pops.push({ p: QP.trPos(e, dd.t), a: t - tEnd });
          continue;
        }
        if (!dd && hitSet[e.i] && t >= e.arr) continue;
        const p = QP.trPos(e, dd ? Math.min(t, dd.t) : t);
        if (dd && t >= dd.t) shots.push({ from: shown[(mates[dd.k] || {}).sid] || [0, 0], to: p, u: (t - dd.t) / TR.FLY });
        const fl = e.sx > 0 ? -1 : 1;
        list.push({
          y: p.y,
          f: () => {
            shadow(p.x, p.y, 4);
            spr(e.k === 0 ? PX.fire[md(t * 6 + e.i, 2)] : PX.ghost[f2], p.x, p.y, fl < 0, 3 + Math.round(Math.sin(t * 3 + e.i) * 1.5));
          },
        });
      }
      mates.forEach((m, k) => {
        const p = shown[m.sid];
        if (!p) return;
        const fr = PX.kid(QP.TEAM_ANIMALS[(C.game.tt.teams[team] || {}).a || 0][0], m.cl || 0);
        const since = atk[k] !== undefined ? t - atk[k] : 9;
        const moving = m.sid === C.seat.sid ? Math.hypot(vel[0], vel[1]) > 0.4 : true;
        const f = since >= -0.05 && since < 0.12 ? 4 : since >= 0.12 && since < 0.32 ? 5 : moving ? md(t * 8 + k, 4) : 0;
        list.push({
          y: p[1],
          f: () => {
            shadow(p[0], p[1], 5);
            spr(fr[f], p[0], p[1], (face[m.sid] || 1) < 0, f < 4 && moving ? f % 2 : 0);
            if (m.sid === C.seat.sid) spr(PX.arrow, p[0], p[1] - 1.95 - (f2 ? 0.1 : 0));
          },
        });
        const el = labEls.get(m.sid);
        if (el) put(el, sx(p[0]), sy(p[1]) - (m.sid === C.seat.sid ? 25 : 18));
      });
      list.sort((a, b) => a.y - b.y);
      for (const o of list) o.f();
      for (const s of shots) {
        const u = Math.min(1, s.u);
        const x = s.from[0] + (s.to.x - s.from[0]) * u,
          y = s.from[1] + (s.to.y - s.from[1]) * u;
        g.drawImage(PX.star[md(t * 8, 2)], sx(x) - 3, sy(y) - 11 - Math.round(Math.sin(u * Math.PI) * 4));
      }
      for (const p of pops) g.drawImage(PX.pop[Math.min(2, Math.floor(p.a / 0.2))], sx(p.p.x) - 6, sy(p.p.y) - 14);

      // 글자판
      const hs = PX.heart;
      const hh = Array.from({ length: L.hearts }, (_, i) => hs(i < hearts, hurt && i === hearts ? 'lost' : '')).join('');
      const hEl = root.querySelector('.thearts i');
      if (hEl.dataset.k !== hearts + '|' + hurt) {
        hEl.dataset.k = hearts + '|' + hurt;
        hEl.innerHTML = hh;
      }
      const left = Math.max(0, Math.min(L.dur, L.dur - t));
      root.querySelector('.ttime b').textContent = Math.ceil(left);
      root.querySelector('.ttime .bar i').style.width = (100 * left) / L.dur + '%';
      const intro = root.querySelector('.tintro');
      intro.hidden = t >= 0;
      if (t < 0) intro.querySelector('.n').textContent = Math.ceil(-t);
    }
    raf = requestAnimationFrame(frame);
    return {
      root,
      unmount() {
        gone = true;
        cancelAnimationFrame(raf);
        removeEventListener('keydown', kd);
        removeEventListener('keyup', ku);
        removeEventListener('resize', resize);
        root.remove();
      },
    };
  }
  QP.TreasureView = { mount };
})();
