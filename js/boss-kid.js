/* boss-kid.js — 아이 디벗의 「보스 슈팅」 (도트, 작업/결정-보스슈팅.md)
 *   const v = QP.BossView.mount(부모요소, KidClient);  v.unmount();     — 미니게임(defend) 화면
 *   QP.BossScreens.html(C, { tIcon, tname, scGame, esc })                — 모이는 곳·정답·결과·끝 화면 HTML (보물 지키기 자리에 끼움)
 *
 * 가운데 정사각 하늘(200×200 도트) + 왼쪽 칸(팀·데미지·우리 팀 비행기·무기) + 오른쪽 칸(시간·보스·방향 단추).
 * 보스 탄막은 판 문서의 씨앗으로 이 기기가 셈하고(boss.js), 맞았는지·내 데미지도 이 기기가 센다.
 * 서버에는 b{r, x, y, d, k} 를 1초 3번까지(격추·끝날 때는 바로).
 */
(function () {
  'use strict';
  const QP = window.QP;
  const BO = QP.BO;
  const md = (a, n) => ((Math.floor(a) % n) + n) % n;
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const SEND_MS = 0.34;

  const CSS = `
.bsdef { position: fixed; inset: 0; display: flex; justify-content: center; background: repeating-linear-gradient(0deg, #24406a 0 4px, #27456f 4px 8px); overflow: hidden; touch-action: none; user-select: none; z-index: 1; }
.bsdef .b-side { width: 240px; flex: none; padding: 12px 10px; box-sizing: border-box; display: flex; flex-direction: column; gap: 10px; }
.bsdef .b-card { background: #fbf4e4; border: 3px solid #3a3060; border-radius: 4px; box-shadow: 4px 4px 0 rgba(10,20,40,.45); padding: 7px 11px; color: #2a211b; }
.bsdef .b-t { font-size: 15px; color: #5a4636; }
.bsdef .b-team { display: flex; align-items: center; gap: 10px; padding: 5px; }
.bsdef .b-team img { width: 44px; height: 44px; image-rendering: pixelated; border: 2px solid #3a3060; }
.bsdef .b-team b { font-family: 'QPTitle', serif; font-weight: normal; font-size: 23px; display: block; }
.bsdef .b-team small { color: #5a4636; font-size: 14px; }
.bsdef .b-tdmg { display: block; font-family: 'QPTitle', serif; font-size: 44px; line-height: 1.05; color: #d9573f; }
.bsdef .b-t2 { font-size: 15px; color: #5a4636; } .bsdef .b-t2 b { font-family: 'QPTitle', serif; font-weight: normal; font-size: 22px; color: #2a211b; }
.bsdef .b-alive { display: flex; flex-direction: column; gap: 1px; margin-top: 3px; }
.bsdef .b-alive div { display: flex; align-items: center; gap: 6px; font-size: 14px; height: 24px; white-space: nowrap; overflow: hidden; }
.bsdef .b-alive img { width: 26px; height: 24px; image-rendering: pixelated; flex: none; }
.bsdef .b-alive .b-me { font-family: 'QPTitle', serif; color: #d9573f; font-size: 17px; }
.bsdef .b-alive .b-down { color: #9a8f86; } .bsdef .b-alive .b-down i { font-style: normal; margin-left: auto; color: #c0392b; font-family: 'QPTitle', serif; }
.bsdef .b-weap .b-l1 { font-size: 17px; } .bsdef .b-weap .b-l1 b { font-family: 'QPTitle', serif; font-weight: normal; font-size: 28px; color: #d9573f; }
.bsdef .b-pips { display: flex; gap: 5px; margin: 2px 0 4px; } .bsdef .b-pips i { width: 22px; height: 16px; background: rgba(90,70,54,.15); border-radius: 2px; }
.bsdef .b-pips i.b-on { background: linear-gradient(#fff6c8, #f2c14e 50%, #b8862a); box-shadow: 0 0 6px rgba(242,193,78,.8); }
.bsdef .b-pips svg { width: 24px; height: 22px; }
.bsdef .b-alive em.b-atk { color: #b8862a; }
.bsdef .b-alive em { font-style: normal; margin-left: auto; color: #e8504a; font-family: 'QPTitle', serif; }
.bsdef .b-weap .b-l2 { font-size: 14px; color: #5a4636; }
.bsdef .b-wprev { width: 100%; height: 76px; image-rendering: pixelated; border: 2px solid #3a3060; margin: 3px 0 1px; box-sizing: border-box; display: block; }
.bsdef .b-field { position: relative; flex: none; align-self: center; }
.bsdef .b-field canvas { position: absolute; inset: 0; width: 100%; height: 100%; image-rendering: pixelated; image-rendering: crisp-edges; }
.bsdef .b-labs { position: absolute; inset: 0; pointer-events: none; }
.bsdef .b-lab { position: absolute; transform: translate(-50%, -100%); white-space: nowrap; font-family: 'QPTitle', serif; font-size: 17px; background: #d9573f; color: #fff; padding: 0 10px; border: 2px solid #7a1e18; border-radius: 3px; }
.bsdef .b-lab.b-down { background: none; border: none; font-size: 24px; -webkit-text-stroke: 1.5px #7a1e18; text-shadow: 3px 3px 0 #7a1e18; }
.bsdef .b-pop { position: absolute; transform: translate(-50%, -100%); font-family: 'QPTitle', serif; font-size: 28px; color: #ffe36a; -webkit-text-stroke: 1.5px #6a3a00; text-shadow: 2px 2px 0 #6a3a00; white-space: nowrap; }
.bsdef .b-bhp { position: absolute; left: 0; right: 0; top: 8px; display: flex; justify-content: center; align-items: center; gap: 8px; font-family: 'QPTitle', serif; font-size: 17px; color: #fff; text-shadow: 2px 2px 0 #3a3060; pointer-events: none; }
.bsdef .b-bhp i { font-style: normal; font-family: 'QPBody', sans-serif; font-size: 15px; background: rgba(42,33,80,.55); padding: 1px 10px; border-radius: 3px; }
.bsdef .b-big { position: absolute; left: 0; right: 0; top: 36%; text-align: center; pointer-events: none; }
.bsdef .b-big .b-w { display: inline-block; font-family: 'QPTitle', serif; font-size: 92px; color: #fff; -webkit-text-stroke: 3px #3a3060; text-shadow: 6px 6px 0 #3a3060; }
.bsdef .b-big .b-w small { display: block; font-size: 22px; -webkit-text-stroke: 0; text-shadow: 2px 2px 0 #3a3060; }
.bsdef .b-big .b-card { display: inline-block; padding: 12px 28px; text-align: center; }
.bsdef .b-big .b-card b { font-family: 'QPTitle', serif; font-weight: normal; font-size: 42px; color: #d9573f; display: block; }
.bsdef .b-big .b-card span { font-size: 19px; color: #5a4636; }
.bsdef .b-banner { position: absolute; left: 50%; bottom: 10px; transform: translateX(-50%); white-space: nowrap; font-size: 18px; padding: 5px 16px; }
.bsdef .b-banner b { font-family: 'QPTitle', serif; font-weight: normal; color: #d9573f; }
.bsdef.b-watch .b-field canvas { filter: saturate(.55) brightness(.92); }
.bsdef .b-time { text-align: center; } .bsdef .b-time b { font-family: 'QPTitle', serif; font-weight: normal; font-size: 44px; line-height: 1.05; display: block; }
.bsdef .b-time .b-bar { display: block; height: 11px; background: rgba(90,70,54,.15); border: 2px solid #3a3060; margin-top: 3px; } .bsdef .b-time .b-bar i { display: block; height: 100%; background: #2f8f8a; }
.bsdef .b-boss { text-align: center; } .bsdef .b-boss img { width: 150px; image-rendering: pixelated; display: block; margin: 2px auto; }
.bsdef .b-boss b { font-family: 'QPTitle', serif; font-weight: normal; font-size: 21px; display: block; } .bsdef .b-boss small { color: #5a4636; font-size: 13px; }
.bsdef .b-pad { position: relative; width: 210px; height: 210px; margin: auto auto 0; flex: none; }
.bsdef .b-pad button { position: absolute; width: 70px; height: 70px; border: 3px solid #3a3060; border-radius: 6px; background: #fbf4e4; color: #5a4636; font-size: 28px; box-shadow: 4px 4px 0 rgba(10,20,40,.45); padding: 0; touch-action: none; }
.bsdef .b-pad [data-d=u] { left: 70px; top: 0; } .bsdef .b-pad [data-d=d] { left: 70px; bottom: 0; } .bsdef .b-pad [data-d=l] { left: 0; top: 70px; } .bsdef .b-pad [data-d=r] { right: 0; top: 70px; }
.bsdef .b-pad button.b-on { background: #ffe9a0; transform: translate(3px, 3px); box-shadow: 1px 1px 0 rgba(10,20,40,.45); }
.bsdef .b-hint { text-align: center; color: #dfe9f5; font-size: 14px; }
@media (max-width: 1000px) { .bsdef .b-side { width: 190px; } .bsdef .b-pad { transform: scale(.85); transform-origin: 50% 100%; } }
.bsres .bsboss { height: 120px; image-rendering: pixelated; }
.bsres .bsd { font-family: 'QPTitle', serif; font-size: 54px; color: #d9573f; line-height: 1.1; }
.bspickq { font-family: 'QPTitle', serif; font-size: 24px; margin: 14px 0 6px; }
.bspick { display: flex; gap: 14px; justify-content: center; }
.bspb { width: 230px; padding: 12px 14px; border: 3px solid #c9b38a; border-radius: 14px; background: #fffaf0; color: #5a4636; display: flex; flex-direction: column; align-items: center; gap: 2px; box-shadow: 0 4px 0 #c9b38a; cursor: pointer; font: inherit; }
.bspb .ic { font-size: 34px; line-height: 1.1; }
.bspb > b { font-family: 'QPTitle', serif; font-weight: normal; font-size: 28px; color: #2a211b; }
.bspb small { font-size: 14px; }
.bspb small b { color: #d9573f; }
.bspb.on.atk { border-color: #d9573f; background: #ffe8e0; box-shadow: 0 4px 0 #a33a28; }
.bspb.on.def { border-color: #3f7fa8; background: #e4f1fa; box-shadow: 0 4px 0 #2a5a7c; }
.bspb.on > b::after { content: ' ✓'; }
.bspicknote { font-size: 14px; color: #8a7666; margin-top: 8px; }
.bshp svg { width: 26px; height: 24px; vertical-align: middle; }
.bsres .bsd small { font-size: 22px; color: #5a4636; }
`;
  function css() {
    if (document.getElementById('bs-css')) return;
    const s = document.createElement('style');
    s.id = 'bs-css';
    s.textContent = CSS;
    document.head.appendChild(s);
  }
  const animalOf = (C) => QP.TEAM_ANIMALS[((C.game.tt && C.game.tt.teams[C.seat.team]) || {}).a || 0][0];
  const teamNameOf = (C) => QP.teamName(((C.game.tt && C.game.tt.teams[C.seat.team]) || {}).a || 0);

  function mount(parent, C) {
    css();
    const A = window.BA.init();
    const root = document.createElement('div');
    root.className = 'bsdef';
    root.innerHTML =
      '<div class="b-side">' +
      '<div class="b-card b-team"><img alt=""><div><b></b><small></small></div></div>' +
      '<div class="b-card"><div class="b-t">우리 팀 데미지</div><b class="b-tdmg">0</b><div class="b-t2">내가 넣은 데미지 <b class="b-mdmg">0</b></div></div>' +
      '<div class="b-card"><div class="b-t">우리 팀 비행기</div><div class="b-alive"></div></div>' +
      '<div class="b-card b-weap"><div class="b-l1">내 무기 <b></b>단계</div><div class="b-pips"></div><canvas class="b-wprev" width="60" height="28"></canvas><div class="b-l2 b-wn"></div><div class="b-l2 b-ww"></div></div>' +
      '</div>' +
      '<div class="b-field"><canvas width="200" height="200"></canvas><div class="b-labs"></div><div class="b-bhp"><span class="b-bn"></span><i>체력 ∞ · 끄떡없어요</i></div><div class="b-big"></div><div class="b-banner b-card" hidden></div></div>' +
      '<div class="b-side">' +
      '<div class="b-card b-time"><span class="b-t">남은 시간</span><b class="b-tl">0</b><span class="b-bar"><i></i></span></div>' +
      '<div class="b-card b-boss"><img alt=""><b class="b-bn"></b><small class="b-bt"></small></div>' +
      '<div class="b-pad"><button data-d="u">▲</button><button data-d="l">◀</button><button data-d="r">▶</button><button data-d="d">▼</button></div>' +
      '<div class="b-hint">비행기는 저절로 쏴요<br>방향만 움직여요</div>' +
      '</div>';
    parent.appendChild(root);
    const $ = (s) => root.querySelector(s);
    const field = $('.b-field'),
      cv = $('.b-field canvas'),
      g = cv.getContext('2d'),
      labs = $('.b-labs');
    g.imageSmoothingEnabled = false;
    let F = 600;
    function layout() {
      const r = root.getBoundingClientRect();
      const side = r.width < 1000 ? 190 : 240;
      F = Math.max(200, Math.floor(Math.min(r.height, r.width - side * 2)));
      field.style.width = field.style.height = F + 'px';
    }
    layout();
    addEventListener('resize', layout);
    const put = (el, x, y) => {
      el.style.left = (x * F) / 200 + 'px';
      el.style.top = (y * F) / 200 + 'px';
    };
    const spr = (c, x, y) => g.drawImage(c, Math.round(x - c.width / 2), Math.round(y - c.height / 2));

    /* ---------- 누르기 (보물 지키기와 같은 방식: 손가락을 옆 단추로 밀면 방향이 바뀜) ---------- */
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
    const pad = $('.b-pad');
    const held = new Map();
    const setPad = () => {
      for (const k of ['u', 'd', 'l', 'r']) keys['p' + k] = [...held.values()].includes(k) ? 1 : 0;
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
      const b = el && el.closest && el.closest('.b-pad button');
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
      B = null, // 보스 그림·탄
      sky = null,
      clouds = null,
      bul = null, // QP.BossBullets
      simT = 0,
      mates = [],
      me = [100, 172],
      lv = 1,
      kind = 'atk',
      hp = 1, // 목숨(방어력 강화)
      hits = 0, // 맞은 횟수
      inv = 0, // 깜빡이며 안 맞는 남은 시간
      hitPop = 0, // 「-1 ♥」 글자 남은 시간
      alive = true,
      myD = 0,
      shots = [],
      mateShots = [],
      mateCd = {},
      shown = {},
      boomed = {},
      booms = [],
      sparks = [],
      pops = [],
      popAcc = 0,
      popAt = [100, 40],
      popT = 0,
      hurt = 0,
      cd = 0,
      downAt = -1,
      lastSend = -9,
      sentFinal = false,
      sentDown = false,
      aliveSig = '';
    const lab = document.createElement('div');
    lab.className = 'b-lab';
    lab.textContent = '나';
    labs.appendChild(lab);
    const downLabs = new Map();
    const popEl = [0, 1, 2, 3].map(() => {
      const d = document.createElement('div');
      d.className = 'b-pop';
      labs.appendChild(d);
      return d;
    });
    let rnd = QP.rng(7);

    function setup(L) {
      mg = L.mg;
      const team = C.seat.team;
      mates = (C.game.roster || []).filter((x) => x.team === team);
      const myK = Math.max(0, mates.findIndex((x) => x.sid === C.seat.sid));
      B = A.BOSSES[L.boss | 0] || A.BOSSES[0];
      sky = A.sky(200, 200, B.sky);
      rnd = QP.rng((L.seed ^ 0x5bd1) >>> 0);
      clouds = A.clouds(200, 400, rnd);
      bul = new QP.BossBullets(L.seed, L.mg);
      simT = 0;
      me = QP.boHome(myK, mates.length);
      lv = L.lv[C.seat.sid] || 1;
      kind = L.st && L.st[C.seat.sid] ? (L.st[C.seat.sid] === 'd' ? 'def' : 'atk') : L.kind === 'def' ? 'def' : 'atk';
      hp = (L.hp && L.hp[C.seat.sid]) || 1;
      hits = Math.min(hp, (L.hit && L.hit[C.seat.sid]) || 0); // 새로 고침했으면 이어서
      inv = 0;
      hitPop = 0;
      alive = !(L.dn && L.dn[C.seat.sid]) && hits < hp;
      myD = (L.d && L.d[C.seat.sid]) || 0; // 새로 고침했으면 이어서
      shots = [];
      mateShots = [];
      mateCd = {};
      shown = {};
      boomed = {};
      booms = [];
      sparks = [];
      pops = [];
      popAcc = 0;
      cd = 0;
      downAt = alive ? -1 : 0;
      lastSend = -9;
      sentFinal = false;
      sentDown = !alive;
      aliveSig = '';
      mates.forEach((m, k) => (shown[m.sid] = (L.pos && L.pos[m.sid] ? L.pos[m.sid] : QP.boHome(k, mates.length)).slice()));
      root.classList.toggle('b-watch', !alive);
      const an = animalOf(C);
      $('.b-team img').src = window.PX.icon(an, C.seat.cl || 0, 48);
      $('.b-team b').textContent = teamNameOf(C);
      $('.b-team small').textContent = mates.length + '명 · ' + (L.mg + 1) + '번째 보스';
      root.querySelectorAll('.b-bn').forEach((el) => (el.textContent = B.name));
      $('.b-bt').textContent = B.tag;
      $('.b-boss img').src = A.bossIcon(L.boss | 0, 2.5);
      const nOk = Math.min(9, (C.seat.res && C.seat.res.blk) || 0),
        per = (C.game.cfg && C.game.cfg.per) || 5;
      if (kind === 'def') {
        $('.b-weap .b-l1').innerHTML = '내 목숨 <b>' + hp + '</b>개';
        drawLives();
        $('.b-wn').textContent = '무기: 모두 똑같이 ' + BO.WEAPON[lv].name;
        $('.b-ww').textContent = '방금 ' + per + '문제 중 ' + nOk + '개 맞힘 → 목숨 ' + hp + '개';
      } else {
        $('.b-weap .b-l1').innerHTML = '내 무기 <b>' + lv + '</b>단계';
        $('.b-weap .b-pips').innerHTML = [1, 2, 3, 4, 5].map((i) => '<i class="' + (i <= lv ? 'b-on' : '') + '"></i>').join('');
        $('.b-wn').textContent = '모양: ' + BO.WEAPON[lv].name + ' · 목숨 ' + hp + '개';
        $('.b-ww').textContent = '방금 ' + per + '문제 중 ' + nOk + '개 맞힘';
      }
      // 무기 모양 미리 보기
      const w = $('.b-wprev').getContext('2d');
      w.imageSmoothingEnabled = false;
      w.drawImage(sky, 0, 120, 60, 28, 0, 0, 60, 28);
      for (const [a, off, big] of BO.WEAPON[lv].s) {
        const r = (a * Math.PI) / 180;
        for (const d of [6, 13]) {
          const s = big ? A.bigShot : A.shot;
          w.drawImage(s, Math.round(30 + off + Math.sin(r) * d - s.width / 2), Math.round(20 - Math.cos(r) * d - s.height / 2));
        }
      }
      const pl = A.plane(an, C.seat.cl || 0)[0];
      w.drawImage(pl, 30 - Math.floor(pl.width / 2), 28 - pl.height + 5);
      for (const el of downLabs.values()) el.remove();
      downLabs.clear();
    }

    function send(L, k) {
      C.write({ b: { r: L.mg, x: Math.round(me[0]), y: Math.round(me[1]), d: Math.round(myD), k: k ? 1 : 0, h: Math.min(hp, hits) } });
    }
    // 방어력 강화: 목숨 하트(남은 것만 빨강)
    let livesSig = '';
    function drawLives() {
      const sig = hp + '|' + hits;
      if (sig === livesSig) return;
      livesSig = sig;
      $('.b-weap .b-pips').innerHTML = Array.from({ length: hp }, (_, i) => window.PX.heart(i < hp - hits, i === hp - hits && inv > 0 ? 'lost' : '')).join('');
      $('.b-weap .b-l1 b').textContent = Math.max(0, hp - hits);
    }
    let needSend = false;

    // 1/60초 한 걸음
    function step(L, dt, catchUp) {
      simT += dt;
      const t = simT,
        dur = L.dur;
      bul.step(dt, dur, alive ? me : null);
      hurt = Math.max(0, hurt - dt);
      if (catchUp) return;
      const play = t >= 0 && t < dur;
      const boss = QP.boBoss(t);
      // 내 비행기
      if (alive && play) {
        const ix = (keys.r || keys.pr ? 1 : 0) - (keys.l || keys.pl ? 1 : 0),
          iy = (keys.d || keys.pd ? 1 : 0) - (keys.u || keys.pu ? 1 : 0);
        const il = Math.hypot(ix, iy) || 1;
        me = QP.boClamp(me[0] + (ix / il) * BO.SPEED * dt, me[1] + (iy / il) * BO.SPEED * dt);
        cd -= dt;
        while (cd <= 0) {
          cd += BO.FIRE;
          QP.boFire(shots, me[0], me[1], lv, 'me');
        }
        inv = Math.max(0, inv - dt);
        hitPop = Math.max(0, hitPop - dt);
        const hb = inv > 0 ? null : bul.hits(me[0], me[1]);
        if (hb) {
          hits++;
          needSend = true;
          bul.list.splice(bul.list.indexOf(hb), 1);
          if (hits >= hp) {
            alive = false;
            downAt = t;
            booms.push({ x: me[0], y: me[1], t: 0, me: 1 });
            root.classList.add('b-watch');
          } else {
            // 목숨이 남았다: 깜빡이며 잠깐 안 맞는다
            inv = BO.INV;
            hitPop = 1;
            sparks.push({ x: me[0], y: me[1], t: 0 });
          }
        }
      }
      // 친구 탄(보이기만)
      if (play)
        mates.forEach((m) => {
          if (m.sid === C.seat.sid || (L.dn && L.dn[m.sid])) return;
          mateCd[m.sid] = (mateCd[m.sid] === undefined ? rnd() * BO.FIRE : mateCd[m.sid]) - dt;
          if (mateCd[m.sid] <= 0) {
            mateCd[m.sid] += BO.FIRE;
            const p = shown[m.sid];
            if (p) QP.boFire(mateShots, p[0], p[1], L.lv[m.sid] || 1, m.sid);
          }
        });
      for (const arr of [shots, mateShots]) {
        for (let i = arr.length - 1; i >= 0; i--) {
          const s = arr[i];
          s.x += s.vx * dt;
          s.y += s.vy * dt;
          if (QP.boHitBoss(s.x, s.y, boss)) {
            hurt = 0.1;
            if (arr === shots && play) {
              myD += s.d;
              popAcc += s.d;
              popAt = [s.x, s.y];
            }
            if (rnd() < 0.3) sparks.push({ x: s.x + (rnd() - 0.5) * 6, y: s.y, t: 0 });
            arr.splice(i, 1);
          } else if (s.y < -8 || s.x < -8 || s.x > 208) arr.splice(i, 1);
        }
      }
      popT -= dt;
      if (popT <= 0) {
        popT += 0.5;
        if (popAcc) {
          pops.push({ v: popAcc, x: popAt[0] + (rnd() - 0.5) * 10, y: popAt[1], t: 0 });
          popAcc = 0;
        }
      }
      for (const q of pops) q.t += dt;
      while (pops.length && pops[0].t > 0.9) pops.shift();
      for (const s of sparks) s.t += dt;
      while (sparks.length && sparks[0].t > 0.6) sparks.shift();
      for (const b of booms) b.t += dt;
    }

    let raf = 0,
      gone = false;
    function frame() {
      if (gone) return;
      raf = requestAnimationFrame(frame);
      const L = C.game && C.game.live;
      if (!L || !C.seat || C.phase !== 'defend' || L.boss === undefined) return;
      if (L.mg !== mg) setup(L);
      const t = (C.net.now() - L.t0) / QP.ms(1);
      // 셈: 0초부터 지금까지 1/60초씩 (많이 밀렸으면 탄만 따라잡음)
      if (t > 0) {
        const gap = t - simT;
        let n = 0;
        while (simT + 1 / 60 <= t && n < 4000) {
          step(L, 1 / 60, gap > 0.3 && t - simT > 0.3);
          n++;
        }
      }
      const play = t >= 0 && t < L.dur;
      // 서버로 보내기
      if (!alive && !sentDown) {
        sentDown = true;
        needSend = false;
        send(L, 1);
        lastSend = t;
      } else if (needSend && alive) {
        needSend = false;
        send(L, 0);
        lastSend = t;
      } else if (t >= L.dur && !sentFinal) {
        sentFinal = true;
        send(L, !alive);
      } else if (play && alive && t - lastSend >= SEND_MS) {
        lastSend = t;
        send(L, 0);
      }
      // 친구 위치: 받은 곳으로 부드럽게
      for (const m of mates) {
        if (m.sid === C.seat.sid) continue;
        const p = L.pos && L.pos[m.sid];
        const s = shown[m.sid];
        if (!p || !s) continue;
        const k = 0.15;
        s[0] += (p[0] - s[0]) * k;
        s[1] += (p[1] - s[1]) * k;
        if (L.dn && L.dn[m.sid] && !boomed[m.sid]) {
          boomed[m.sid] = 1;
          booms.push({ x: s[0], y: s[1], t: 0, sid: m.sid });
        }
      }
      draw(L, t);
    }

    function draw(L, t) {
      const tt = Math.max(0, t);
      g.drawImage(sky, 0, 0);
      const off = (tt * 14) % 400;
      g.drawImage(clouds, 0, off - 400);
      g.drawImage(clouds, 0, off);
      const boss = QP.boBoss(tt);
      const bf = hurt > 0 && md(tt * 16, 3) === 0 ? B.spr.hurt : bul.open > 0 ? B.spr.open : B.spr.idle;
      spr(bf, boss.x + (hurt > 0 ? md(tt * 40, 2) - 0.5 : 0), boss.y);
      g.globalAlpha = 0.45;
      for (const s of mateShots) spr(s.big ? A.bigShot : A.shot, s.x, s.y);
      g.globalAlpha = 1;
      for (const s of shots) spr(s.big ? A.bigShot : A.shot, s.x, s.y);
      const an = animalOf(C);
      mates.forEach((m, k) => {
        const mine = m.sid === C.seat.sid;
        const isDown = mine ? !alive : L.dn && L.dn[m.sid];
        const p = mine ? me : shown[m.sid];
        if (!p || isDown) return;
        if (mine && inv > 0 && md(tt * 10, 2)) return; // 깜빡깜빡
        const fr = A.plane(an, m.cl || 0);
        spr(fr[md(tt * 12 + k, 2)], p[0], p[1] + md(tt * 5 + k, 2) * 0.5);
        if (mine) {
          g.fillStyle = 'rgba(255,255,255,.9)';
          g.fillRect(Math.round(p[0]) - 1, Math.round(p[1]) - 1, 2, 2);
        }
      });
      // 떨어지는 비행기(격추)
      for (const b of booms) {
        if (b.t < 0.6) spr(A.boom[Math.min(3, Math.floor(b.t / 0.15))], b.x, b.y);
        const m = b.me ? mates.find((x) => x.sid === C.seat.sid) : mates.find((x) => x.sid === b.sid);
        if (!m || b.t > 1.6) continue;
        const dir = b.x < 100 ? -1 : 1,
          fy = b.y + b.t * (25 + b.t * 20),
          fx = b.x + dir * b.t * 18;
        g.save();
        g.globalAlpha = Math.max(0, 1 - b.t / 1.6);
        g.translate(Math.round(fx), Math.round(fy));
        g.rotate(b.t * 7 * dir);
        const s = A.plane(an, m.cl || 0)[0];
        g.drawImage(s, -Math.floor(s.width / 2), -Math.floor(s.height / 2));
        g.restore();
        g.globalAlpha = 1;
        // 「격추!」 글자
        const key = b.me ? 'me' : b.sid;
        let el = downLabs.get(key);
        if (!el) {
          el = document.createElement('div');
          el.className = 'b-lab b-down';
          el.textContent = '격추!';
          labs.appendChild(el);
          downLabs.set(key, el);
        }
        el.style.display = b.t < 1.6 ? '' : 'none';
        put(el, fx, fy - 10 - b.t * 6);
      }
      for (const b of bul.list) spr(B.bul[b.k], b.x, b.y);
      for (const s of sparks) spr(window.PX.pop[Math.min(2, Math.floor(s.t / 0.2))], s.x, s.y);

      // 글자
      lab.style.display = alive ? '' : 'none';
      if (alive) put(lab, me[0], me[1] - 8);
      const lt = kind === 'def' || hp > 1 ? (hitPop > 0 ? '나 -1♥' : '나 ♥' + (hp - hits)) : '나';
      if (lab.textContent !== lt) lab.textContent = lt;
      if (kind === 'def') drawLives();
      popEl.forEach((el, j) => {
        const q = pops[pops.length - 1 - j];
        if (!q) return (el.style.display = 'none');
        el.style.display = '';
        el.textContent = '+' + q.v;
        put(el, q.x, q.y - 4 - q.t * 22);
        el.style.opacity = Math.min(1, 2.2 - q.t * 2.4);
      });
      const left = Math.max(0, Math.min(L.dur, L.dur - t));
      $('.b-tl').textContent = Math.ceil(left);
      $('.b-time .b-bar i').style.width = (100 * left) / L.dur + '%';
      const teamD = mates.reduce((x, m) => x + (m.sid === C.seat.sid ? Math.round(myD) : (L.d && L.d[m.sid]) || 0), 0);
      $('.b-tdmg').textContent = teamD.toLocaleString();
      $('.b-mdmg').textContent = Math.round(myD).toLocaleString();
      const sig = mates.map((m) => (m.sid === C.seat.sid ? alive : !(L.dn && L.dn[m.sid])) ? 1 : 0).join('');
      const sig2 = sig + '|' + hits + '|' + JSON.stringify(L.hit || {});
      if (sig2 !== aliveSig) {
        aliveSig = sig2;
        $('.b-alive').innerHTML = mates
          .map((m, k) => {
            const on = sig[k] === '1',
              mine = m.sid === C.seat.sid;
            // 수비형은 남은 목숨 ♥, 공격형은 무기 단계 ⚔
            const mDef = mine ? kind === 'def' : L.st && L.st[m.sid] ? L.st[m.sid] === 'd' : kind === 'def';
            const tag = mDef ? '♥' + (mine ? hp - hits : ((L.hp && L.hp[m.sid]) || 1) - ((L.hit && L.hit[m.sid]) || 0)) : '⚔' + ((L.lv && L.lv[m.sid]) || 1);
            return '<div class="' + (mine ? 'b-me ' : '') + (on ? '' : 'b-down') + '"><img src="' + A.planeIcon(an, m.cl || 0, !on, 2) + '" alt="">' + esc(mine ? '나' : m.nick) + (on ? '<em class="' + (mDef ? '' : 'b-atk') + '">' + tag + '</em>' : '<i>격추</i>') + '</div>';
          })
          .join('');
      }
      let big = '';
      if (t < 0) big = '<span class="b-w">' + Math.ceil(-t) + '<small>' + esc(B.name) + ' 등장! 탄막을 피해요</small></span>';
      else if (t < 0.5) big = '<span class="b-w">출발!</span>';
      else if (t >= L.dur) big = '<div class="b-card"><b>끝!</b><span>우리 팀 데미지 ' + teamD.toLocaleString() + ' · 내 데미지 ' + Math.round(myD).toLocaleString() + '<br>TV에서 순위를 봐요</span></div>';
      else if (!alive && t - downAt < 2.6) big = '<div class="b-card"><b>격추됐어요!</b><span>우리 팀을 응원해요 · 다음 미니게임에 다시 나와요</span></div>';
      const bigEl = $('.b-big');
      if (bigEl.innerHTML !== big) bigEl.innerHTML = big;
      const watching = !alive && t < L.dur && t - downAt >= 2.6;
      const ban = $('.b-banner');
      ban.hidden = !watching;
      if (watching) {
        const h = '<b>구경 중</b> · 우리 팀 비행기 ' + sig.split('').filter((x) => x === '1').length + '대가 싸우고 있어요! · 다음 미니게임에 다시 나와요';
        if (ban.innerHTML !== h) ban.innerHTML = h;
      }
      const dir = alive && t >= 0 && t < L.dur ? { u: keys.u || keys.pu, d: keys.d || keys.pd, l: keys.l || keys.pl, r: keys.r || keys.pr } : {};
      pad.querySelectorAll('button').forEach((b) => b.classList.toggle('b-on', !!dir[b.dataset.d]));
    }
    raf = requestAnimationFrame(frame);
    return {
      root,
      unmount() {
        gone = true;
        cancelAnimationFrame(raf);
        removeEventListener('keydown', kd);
        removeEventListener('keyup', ku);
        removeEventListener('resize', layout);
        root.remove();
      },
    };
  }
  QP.BossView = { mount };

  /* ---------- 모이는 곳·정답·결과·끝 (kid-ui.js scTreasure 가 C.boss 일 때 부른다). null = 보물 지키기 화면 그대로 ---------- */
  function html(C, h) {
    css();
    const ph = C.phase,
      s = C.seat || {},
      c = C.game.cfg;
    const tname = h.tname;
    const def = QP.boStyleOf(C) === 'def';
    lastC = C;
    if (ph === 'lobby') {
      const mates = (C.game.roster || []).filter((x) => x.team === s.team);
      const pick = c.kind !== 'atk' && c.kind !== 'def';
      return (
        '<div class="center hello thello"><img class="bigdoll pxi" src="' + h.tIcon(144) + '" alt=""><h2>나는 <b>' + esc(s.nick) + '</b></h2>' +
        '<p class="tline">우리 팀은 <b>' + tname + '</b> · ' + mates.length + '명</p>' +
        '<div class="tmates">' + mates.map((m) => '<span' + (m.sid === s.sid ? ' class="me"' : '') + '><img class="pxi" src="' + h.tIcon(40, m.cl) + '" alt="">' + esc(m.sid === s.sid ? '나' : m.nick) + '</span>').join('') + '</div>' +
        '<p>문제 ' + c.per + '개를 풀 때마다 <b>보스 슈팅</b>을 해요. 탄막은 피해요!</p>' +
        (pick
          ? '<p class="bspickq">이번 판에서 나는?</p><div class="bspick">' + pickBtn('atk', def) + pickBtn('def', def) + '</div><p class="bspicknote">시작하기 전까지 바꿀 수 있어요</p>'
          : '<p>' + (def ? '이번 판은 모두 <b>수비형</b>: 무기는 모두 같고, 많이 맞힐수록 <b>목숨</b>이 늘어요!' : '이번 판은 모두 <b>공격형</b>: 많이 맞힐수록 무기가 세져요!') + '</p>') +
        '</div>'
      );
    }
    if (ph === 'question') return null;
    if (ph === 'reveal') {
      const res = C.myRes();
      if (!res) return null;
      const lv = QP.boLevel(res.blk);
      const go = res.left === 0;
      const [, hpN] = QP.boKit('def', res.blk);
      return (
        '<div class="center tres ' + (res.ok ? 'ok' : 'no') + '">' + (res.ok ? '<div class="ok-badge">맞았어요!</div>' : '<div class="no-badge">' + (res.my === null ? '시간이 다 됐어요' : '아쉬워요') + '</div>') +
        (!res.ok ? (res.my !== null ? '<div class="my">내 답: ' + esc(res.my) + '</div>' : '') + '<div class="ans' + (String(res.ans).length > 6 ? ' long' : '') + '">정답은 <b>' + esc(res.ans) + '</b></div>' + (res.exp ? '<div class="exp">' + esc(res.exp) + '</div>' : '') : '') +
        (def ? '<div class="tpow"><span>목숨</span><b>' + hpN + '개</b><span class="pips bshp">' + Array.from({ length: hpN }, () => window.PX.heart(true)).join('') + '</span></div>' : '<div class="tpow"><span>무기</span><b>' + lv + '단계</b><span class="pips">' + [1, 2, 3, 4, 5].map((i) => '<i class="' + (i <= lv ? 'on' : '') + '"></i>').join('') + '</span></div>') +
        '<p class="tnext">' + (go ? '이제 <b>보스 슈팅</b>! 디벗을 봐요' : '보스 슈팅까지 <b>' + res.left + '</b>문제') + '</p></div>'
      );
    }
    if (ph === 'dres') {
      const d = s.dres;
      if (!d) return '<div class="center"><div class="spin"></div></div>';
      const A = window.BA.init();
      const b = A.BOSSES[d.boss | 0] || A.BOSSES[0];
      return (
        '<div class="center tres dres bsres"><img class="bsboss" src="' + A.bossIcon(d.boss | 0, 3, 'hurt') + '" alt=""><p class="lbl">' + tname + ' → ' + esc(b.name) + '</p>' +
        '<div class="bsd">' + d.d.toLocaleString() + '<small> 점</small></div>' +
        '<div class="rk">이번에 <b>' + d.rank + '</b>등 / ' + d.n + '팀</div>' +
        '<p class="sub">내가 넣은 데미지 <b>' + (d.my || 0).toLocaleString() + '</b>' + (d.down ? ' · 격추됐지만 다음에 다시 나와요' : d.kind === 'def' ? ' · 목숨 ' + (d.hp - d.hit) + '개 남기고 살아남았어요!' : ' · 끝까지 살아남았어요!') + '</p><p class="tvnote">TV에서 팀 순위를 봐요!</p></div>'
      );
    }
    if (ph === 'end') {
      const v = s.fin;
      if (!v) return '<div class="center"><div class="spin"></div></div>';
      return (
        '<div class="center endcard"><img class="bigdoll pxi" src="' + h.tIcon(144) + '" alt=""><h1 class="t">' + tname + ' ' + v.rank + '등!</h1>' +
        '<p class="sum">팀 점수 ' + (v.tot || 0).toLocaleString() + ' · 내 데미지 ' + (v.my || 0).toLocaleString() + ' · 내가 맞힌 문제 ' + v.nOk + '개</p><p>' + (v.rank === 1 ? '와, 우리 팀이 1등이에요!' : '수고했어요! TV를 봐요.') + '</p></div>'
      );
    }
    return null;
  }
  // 위쪽 띠(kid-ui.js trTop)의 「무기 n단계」 자리: 방어력 강화면 「목숨 n개」
  function chip(C, nOk) {
    css();
    if (QP.boStyleOf(C) === 'def') {
      const n = QP.boKit('def', nOk)[1];
      return '<div class="wlv">목숨 <b>' + n + '</b>개 <span class="pips bshp">' + Array.from({ length: Math.min(n, 5) }, () => window.PX.heart(true)).join('') + '</span></div>';
    }
    const lv = QP.boLevel(nOk);
    return '<div class="wlv">무기 <b>' + lv + '</b>단계 <span class="pips">' + [1, 2, 3, 4, 5].map((i) => '<i class="' + (i <= lv ? 'on' : '') + '"></i>').join('') + '</span></div>';
  }
  // 모이는 곳 고르기 단추 (누르면 바로 화면을 바꾸고 서버에 보냄 — kid-ui 는 이 화면을 다시 그리지 않을 수 있다)
  let lastC = null;
  function pickBtn(st, def) {
    const on = (st === 'def') === def;
    return (
      '<button class="bspb ' + st + (on ? ' on' : '') + '" data-bs-pick="' + st + '"><span class="ic">' + (st === 'def' ? '🛡️' : '⚔️') + '</span><b>' + (st === 'def' ? '수비형' : '공격형') + '</b>' +
      '<small>' + (st === 'def' ? '무기는 보통, 맞힌 만큼 <b>목숨</b>이 늘어요' : '맞힌 만큼 <b>무기</b>가 세져요 (목숨 2)') + '</small></button>'
    );
  }
  document.addEventListener('click', (e) => {
    const b = e.target.closest && e.target.closest('[data-bs-pick]');
    if (!b || !lastC) return;
    if (!QP.boPick(lastC, b.dataset.bsPick)) return;
    document.querySelectorAll('[data-bs-pick]').forEach((x) => x.classList.toggle('on', x === b));
  });
  QP.BossScreens = { html, chip };
})();
