/* chase-view.js — 「엄마 피해 도망가기」 화면 (도트). 아이 화면(위 맵 · 아래 단추)과 TV(맵만)를 같이 그린다.
 *   const v = QP.ChaseView.mount(부모, { tv, game: () => 판문서, now: () => 서버시각, me: 내 sid|null, pick(code, lane), picked(code) });  v.unmount()
 * 시간표는 판 문서 ch.t0 와 cfg 로 이 기기가 셈하고(chase.js), 누가 잡혔는지는 선생님 화면이 ch.res 에 쓴 것을 따른다.
 */
(function () {
  'use strict';
  const QP = window.QP,
    PX = window.PX;
  const md = (a, n) => ((Math.floor(a) % n) + n) % n;
  const fill = (rows, ch) => rows.map((r) => r.replace(/x/g, ch));

  /* ---------- 그림(한 번만) ---------- */
  let ART = null;
  function art() {
    if (ART) return ART;
    const SYM = [
      { name: '하트', c: '#e8504a', d: '#9c2f25', rows: ['.xx.xx.', 'xxxxxxx', 'xxxxxxx', '.xxxxx.', '..xxx..', '...x...'] },
      { name: '별', c: '#ffd23e', d: '#a8791e', rows: ['...x...', '..xxx..', 'xxxxxxx', '.xxxxx.', '..xxx..', '.xx.xx.', '.x...x.'] },
      { name: '세모', c: '#3f9be8', d: '#1f4f8a', rows: ['...x...', '..xxx..', '..xxx..', '.xxxxx.', '.xxxxx.', 'xxxxxxx', 'xxxxxxx'] },
      { name: '동그라미', c: '#5fbf55', d: '#2f6d2a', rows: ['..xxx..', '.xxxxx.', 'xxxxxxx', 'xxxxxxx', 'xxxxxxx', '.xxxxx.', '..xxx..'] },
    ];
    SYM.forEach((s) => {
      s.img = PX.make(fill(s.rows, 'a'), { a: s.c }, s.d);
      s.url = s.img.toDataURL();
      const c = document.createElement('canvas');
      c.width = c.height = 15;
      const g = c.getContext('2d');
      g.fillStyle = '#5a3a1e';
      g.fillRect(0, 0, 15, 15);
      g.fillStyle = '#fbf3df';
      g.fillRect(1, 1, 13, 13);
      g.drawImage(s.img, Math.floor((15 - s.img.width) / 2), Math.floor((15 - s.img.height) / 2));
      s.sign = c;
    });
    const ROCK = PX.make(['....gggggg....', '..gggGGGgggg..', '.ggGGGGggggggg.', 'gggGGgggggggdg', 'ggggggggggggdd', 'gggggggggggddd', 'ggggggggggdddd', '.gggggggddddd.', '..dddddddddd..'], { g: '#9a96a4', G: '#c4c0cc', d: '#6a6676' }, '#3a3644');
    const XS = PX.make(['xx...xx', '.xx.xx.', '..xxx..', '.xx.xx.', 'xx...xx'], { x: '#e8504a' }, '#7a1e18');
    const FLAG = PX.make(['pff...', 'pffff.', 'pfff..', 'p.....', 'p.....', 'p.....', 'p.....'], { p: '#6a4a2a', f: '#ffd23e' }, '#4a2a1a');
    const HEART = PX.make(fill(SYM[0].rows, 'a'), { a: '#e8504a' }, '#7a1e18').toDataURL();
    const TOP = ['......hhh.......', '.....hhhhh......', '....hhhhhhhh....', '...hhhhhhhhhh...', '...hhssssssshh..', '...hssBsssBssh..', '...hssesssessh..', '...hspssssspsh..'];
    const BODY = [
      ['....ssmmmmss....', '.....ssssss.....', '......ssss......', '...bbbbbbbbbb...', '..bbbaaaaaabbb..', '.sbbbaaaaaabbbs.', '.s.bbaaaaaabb.s.', '....baaaaaab....', '....kaaaaaak....', '...kkaaaaaakk...', '...kkkkkkkkkk...', '..kkkkkkkkkkkk..', '.....ll..ll.....', '.....ll..ll.....', '....ooo..ooo....'],
      ['....ssmmmmss....', '.....ssssss.....', '......ssss......', '...bbbbbbbbbb...', '..bbbaaaaaabbb..', '.sbbbaaaaaabbbs.', '.s.bbaaaaaabb.s.', '....baaaaaab....', '....kaaaaaak....', '...kkaaaaaakk...', '...kkkkkkkkkk...', '..kkkkkkkkkkkk..', '....ll....ll....', '....ll....ll....', '...ooo....ooo...'],
      ['....ssmmmmss..s.', '.....ssssss...s.', '......ssss...b..', '...bbbbbbbbbbb..', '..bbbaaaaaabbb..', '.sbbbaaaaaabbb..', '.s.bbaaaaaabb...', '....baaaaaab....', '....kaaaaaak....', '...kkaaaaaakk...', '...kkkkkkkkkk...', '..kkkkkkkkkkkk..', '.....ll..ll.....', '.....ll..ll.....', '....ooo..ooo....'],
    ];
    const BLOUSE = ['#e07a9a', '#5f9ad0', '#e0a93a', '#8fbf5a', '#b08ad8', '#e8806a'];
    const moms = [];
    const mom = (i) => {
      if (!moms[i]) {
        const pal = { h: ['#4a2c1e', '#2a1a14', '#7a4a2a'][i % 3], s: '#f1d5ad', B: '#3a2010', e: '#2a1a10', p: '#f09a90', m: '#8a2a20', b: BLOUSE[i % BLOUSE.length], a: '#fbf3df', k: '#3f5f9a', l: '#f1d5ad', o: '#5a3a2a' };
        moms[i] = BODY.map((b) => PX.make(TOP.concat(b), pal, '#3a2a20'));
      }
      return moms[i];
    };
    // 숙제 도장(빨간 동그라미 + ✓)
    const STAMP = PX.make(['..rrrrr..', '.rwwwwwr.', 'rwwwwwwkr', 'rwwwwwkwr', 'rwkwwkwwr', 'rwwkkwwwr', 'rwwwkwwwr', '.rwwwwwr.', '..rrrrr..'], { r: '#d93a2f', w: '#fff6e8', k: '#d93a2f' }, '#7a1e18');
    ART = { SYM, ROCK, XS, FLAG, HEART, mom, STAMP, STAMPURL: STAMP.toDataURL() };
    return ART;
  }
  const hash = (s) => {
    let h = 7;
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    return h;
  };

  function mount(parent, o) {
    const A = art();
    const TV = !!o.tv;
    const root = document.createElement('div');
    root.className = 'chv' + (TV ? ' tv' : '');
    root.innerHTML =
      '<div class="cmap"><canvas></canvas><div class="clabs"></div>' +
      '<div class="chud"><div class="cbox chearts"><img alt="" src="' + A.HEART + '"><small>우리 반</small><b class="hn"></b><small class="hx"></small><span class="hm"></span></div>' +
      '<div class="cbox cstep">갈림길 <b class="sn"></b> / <span class="sx"></span></div>' +
      (TV ? '' : '<div class="cbox cstamp" hidden><img alt="" src="' + A.STAMPURL + '"><span>숙제 도장</span></div>') +
      '<div class="cbox ctimer"><span>고르기</span><b class="tn"></b>초<span class="bar"><i></i></span></div></div>' +
      '<div class="cintro" hidden><div class="n"></div><p>엄마가 쫓아와요! 맵을 보고 <b>뚫린 길</b>을 골라요</p></div>' +
      (TV ? '<div class="cbox cfoot"></div>' : '') +
      '</div>' +
      (TV ? '' : '<div class="cpad"><div class="tip">맵에서 <b>뚫린 길</b>의 모양을 눌러요! · 한 번만</div><div class="btns"></div><div class="res" hidden></div></div>');
    parent.appendChild(root);
    const $ = (s) => root.querySelector(s);
    const cv = $('canvas'),
      g = cv.getContext('2d');
    const mapEl = $('.cmap'),
      pad = $('.cpad'),
      labs = $('.clabs');
    const W = 320;
    let H = 100,
      LT = 30,
      LH = 16;
    function layout() {
      const r = root.getBoundingClientRect();
      const mh = TV ? r.height : Math.round(r.height * 0.56);
      mapEl.style.height = mh + 'px';
      if (pad) pad.style.height = r.height - mh + 'px';
      H = Math.max(60, Math.round((W * mh) / Math.max(1, r.width)));
      cv.width = W;
      cv.height = H;
      g.imageSmoothingEnabled = false;
      LT = Math.round(H * (TV ? 0.27 : 0.33));
      LH = Math.floor((H - LT - 4) / 4);
    }
    layout();
    addEventListener('resize', layout);
    const GX = 200,
      RXX = GX + 34;
    const laneY = (l) => LT + l * LH + LH / 2;

    /* ---------- 글자 ---------- */
    const els = new Map();
    function el(key, cls, text) {
      let e = els.get(key);
      if (!e) {
        e = document.createElement('div');
        e.className = cls;
        labs.appendChild(e);
        els.set(key, e);
      }
      if (text !== undefined && e.textContent !== text) e.textContent = text;
      e.hidden = false;
      e.used = true;
      return e;
    }
    function put(e, x, y) {
      const r = cv.getBoundingClientRect();
      e.style.left = (x * r.width) / W + 'px';
      e.style.top = (y * r.height) / H + 'px';
    }

    /* ---------- 단추 ---------- */
    let padKey = '';
    function drawPad(gate, code, myPick, out, res) {
      if (!pad) return;
      const key = code + '|' + myPick + '|' + out + '|' + res;
      if (key === padKey) return;
      padKey = key;
      const btns = $('.btns');
      btns.innerHTML = gate ? gate.order.map((l) => '<button data-l="' + l + '" class="' + (myPick === l ? 'pick' : '') + '"><img src="' + A.SYM[gate.sym[l]].url + '" alt="' + A.SYM[gate.sym[l]].name + '"></button>').join('') : '';
      pad.classList.toggle('done', myPick !== undefined);
      const rv = $('.res');
      rv.hidden = !res;
      rv.className = 'res ' + (res === 'ok' ? 'ok' : 'no');
      rv.innerHTML = res === 'saved' ? '<b>휴, 살았다!</b><p>숙제 도장을 보여 줬더니 엄마가 "어머, 다 했구나~ 놀다 와!"</p>' : res === 'ok' ? '<b>통과!</b><p>다음 갈림길도 맵을 잘 봐요</p>' : res === 'bump' ? '<b>쿵!</b><p>' + (myPick === undefined ? '시간 안에 못 골랐어요' : '막힌 길이었어요') + '… 엄마가 와요!</p>' : res === 'out' ? '<b>엄마한테 잡혔어요</b><p>다음 미니게임에서 다시 도망가요 · 친구들을 응원해요!</p>' : res === 'wait' ? '<b>두근두근…</b><p>어느 길이 뚫렸을까요?</p>' : res === 'end' ? '<b>도착!</b><p>엄마를 따돌렸어요! TV를 봐요</p>' : '';
    }
    if (pad)
      pad.addEventListener('pointerdown', (e) => {
        const b = e.target.closest('button');
        if (!b || !cur || cur.ph !== 'choose' || cur.out) return;
        if (o.picked(cur.code) !== undefined) return;
        o.pick(cur.code, +b.dataset.l);
        padKey = '';
      });

    /* ---------- 아이들 ---------- */
    const kids = new Map(); // sid → {x,y,...}
    let cur = null,
      lastKey = '',
      scroll = 0,
      forkX = 380,
      heartsShown = null,
      minus = 0,
      minusAt = -9;
    function kidOf(r, i) {
      let k = kids.get(r.sid);
      if (!k) {
        const an = QP.TEAM_ANIMALS[r.a || 0][0];
        k = { sid: r.sid, me: r.sid === o.me, fr: PX.kid(an, r.cl || 0), mom: A.mom(i % 6), x: 30 + (hash(r.sid) % 120), y: 0, tx: 0, ty: 0, ph: (hash(r.sid) % 60) / 10, scold: QP.CH_SCOLD[i % QP.CH_SCOLD.length] };
        k.y = LT + 6 + (hash(r.sid + 'y') % Math.max(1, LH * 4 - 8));
        kids.set(r.sid, k);
      }
      return k;
    }

    let raf = 0,
      last = performance.now(),
      T = 0,
      gone = false;
    function frame(now) {
      if (gone) return;
      raf = requestAnimationFrame(frame);
      const dt = Math.max(0, Math.min(0.05, (now - last) / 1000));
      last = now;
      T += dt;
      const G = o.game();
      if (!G || !G.ch || !G.cfg) return;
      const cfg = G.cfg,
        ch = G.ch;
      const times = QP.chTimes(cfg, ch.mg);
      const gates = ch._gates && ch._seed === ch.seed ? ch._gates : ((ch._seed = ch.seed), (ch._gates = QP.chGates(ch.seed, cfg)));
      const t = (o.now() - ch.t0) / QP.ms(1);
      // 지금 갈림길과 단계
      let j = times.findIndex((x) => t < x.end);
      if (j < 0) j = times.length - 1;
      const tm = times[j],
        gate = gates[j],
        res = ch.res && ch.res[j];
      let ph = t < 0 ? 'intro' : t < tm.ch0 ? 'run' : t < tm.ch1 ? 'choose' : t < tm.show || !res ? 'wait' : t < tm.end ? 'show' : 'done';
      const pt = ph === 'run' ? t - tm.run : ph === 'choose' ? t - tm.ch0 : ph === 'show' ? t - tm.show : 0;
      const code = QP.chCode(ch.mg, j);
      // 이 갈림길 전에 잡힌 친구는 빠진다
      const outBefore = new Set();
      for (let i = 0; i < j; i++) for (const sid of (ch.res && ch.res[i] && ch.res[i].c) || []) outBefore.add(sid);
      const roster = (G.roster || []).filter((r) => ch.runners.includes(r.sid));
      const alive = roster.filter((r) => !outBefore.has(r.sid));
      const meOut = o.me && (outBefore.has(o.me) || !ch.runners.includes(o.me));
      const key = ch.mg + '|' + j;
      if (key !== lastKey) {
        lastKey = key;
        forkX = 380;
        // 문 앞에 모이기
        alive.forEach((r, n) => {
          const k = kidOf(r, roster.indexOf(r));
          const col = n % 7,
            row = Math.floor(n / 7);
          k.tx = 80 + col * 15 + (row % 2) * 7;
          k.ty = LT + 8 + row * ((LH * 4 - 10) / 4) + (col % 2) * 3;
          if (k.x > 260 || k.x < -10) (k.x = 20 + (hash(r.sid) % 50)), (k.y = LT + 6 + (hash(r.sid + j) % Math.max(1, LH * 4 - 8)));
          k.showInit = false;
        });
      }
      if (ph === 'run' || ph === 'intro') {
        forkX += (GX - forkX) * Math.min(1, dt * 3.2);
        scroll += dt * 50;
      } else forkX = GX;
      // 공개: 아이마다 갈 길과 결과
      if (ph === 'show' || ph === 'done') {
        for (const r of alive) {
          const k = kidOf(r, roster.indexOf(r));
          if (!k.showInit) {
            k.showInit = true;
            k.saved = !!(res.s && res.s.includes(r.sid)); // 숙제 도장으로 봐줌
            k.ok = !res.c.includes(r.sid) && !k.saved;
            k.lane = res.p[r.sid] !== undefined ? res.p[r.sid] : hash(r.sid + j) % 4;
            k.ty = laneY(k.lane) + 3 + ((hash(r.sid) % 5) - 2);
            k.tx = k.ok ? 360 : RXX - 8;
            k.delay = (hash(r.sid + 'd') % 25) / 100;
          }
        }
        if (heartsShown !== ch.hearts && pt > 2.3) {
          if (heartsShown !== null && ch.hearts < heartsShown) (minus = heartsShown - ch.hearts), (minusAt = T);
          heartsShown = ch.hearts;
        }
      } else if (heartsShown === null || ph === 'run' || ph === 'intro') heartsShown = ch.hearts;
      cur = { ph, code, out: meOut, j };

      // 움직이기
      for (const r of alive) {
        const k = kidOf(r, roster.indexOf(r));
        if (ph === 'show' || ph === 'done') {
          const u = (ph === 'done' ? 9 : pt) - k.delay;
          if (u < 0) continue;
          if (k.ok) {
            k.y += (k.ty - k.y) * Math.min(1, dt * 6);
            k.x += (u < 0.5 ? 70 : 85) * dt;
          } else if (u < 0.7) {
            k.y += (k.ty - k.y) * Math.min(1, dt * 6);
            k.x += (k.tx - k.x) * Math.min(1, dt * 5);
            k.hx = k.x;
            k.hy = k.y;
          } else if (u < 1.05) {
            const v = (u - 0.7) / 0.35;
            if (k.hx === undefined) (k.hx = k.tx), (k.hy = k.ty);
            k.x = k.hx - v * 14;
            k.y = k.hy - Math.sin(v * Math.PI) * 6;
          } else if (u < 3.6 || k.saved) {
            if (k.hx === undefined) (k.hx = k.tx), (k.hy = k.ty);
            k.x = k.hx - 14;
            k.y = k.hy;
          } else {
            const v = Math.min(1, (u - 3.6) / 1.2);
            k.x = k.hx - 14 - v * (k.hx + 10);
            k.y = k.hy;
          }
          continue;
        }
        k.hx = undefined;
        k.x += (k.tx - k.x) * Math.min(1, dt * 4);
        k.y += (k.ty - k.y) * Math.min(1, dt * 4);
      }

      /* ---------- 그리기 ---------- */
      g.fillStyle = '#4f8a3e';
      g.fillRect(0, 0, W, H);
      for (let i = 0; i < 160; i++) {
        g.fillStyle = i % 3 ? '#5f9a48' : '#3f7a34';
        g.fillRect(md(i * 37 - scroll, W + 10) - 5, (i * 53) % H, 2, 1);
      }
      for (let x = -14; x < W + 14; x += 14) {
        const xx = md(x - scroll * 0.4, W + 28) - 14;
        g.fillStyle = '#2e5a2c';
        g.fillRect(xx, LT - 16, 12, 12);
        g.fillStyle = '#3f7a3a';
        g.fillRect(xx + 2, LT - 20, 8, 6);
      }
      const fx = Math.round(forkX);
      g.fillStyle = '#d4b07a';
      g.fillRect(0, LT, fx, LH * 4);
      g.fillStyle = 'rgba(120,80,40,.25)';
      for (let i = 0; i < 70; i++) g.fillRect(md(i * 29 - scroll, Math.max(1, fx)), LT + 2 + ((i * 17) % (LH * 4 - 4)), 2, 1);
      for (let l = 0; l < 4; l++) {
        const y = LT + l * LH + 2,
          h = LH - 4;
        if (gate.open.includes(l)) {
          g.fillStyle = '#e8c98e';
          g.fillRect(fx, y, W - fx, h);
          g.fillStyle = '#f7e2b2';
          g.fillRect(fx, y, W - fx, 1);
          for (let ax = fx + 22; ax < W - 16; ax += 26) {
            g.fillStyle = md(T * 4 - ax / 26, 3) === 0 ? '#ffffff' : 'rgba(255,255,255,.55)';
            const cy = y + Math.floor(h / 2);
            g.fillRect(ax, cy - 2, 2, 1);
            g.fillRect(ax + 2, cy - 1, 2, 1);
            g.fillRect(ax + 4, cy, 2, 1);
            g.fillRect(ax + 2, cy + 1, 2, 1);
            g.fillRect(ax, cy + 2, 2, 1);
          }
          g.drawImage(A.FLAG, W - 14, y + h - A.FLAG.height);
        } else {
          g.fillStyle = '#c9a46a';
          g.fillRect(fx, y, RXX - fx + 6, h);
          g.drawImage(A.ROCK, RXX - 2, y + h - A.ROCK.height + 1);
          g.drawImage(A.XS, RXX + 3, y - 3);
        }
        g.drawImage(A.SYM[gate.sym[l]].sign, fx - 17, y + Math.floor((h - 15) / 2));
        // 내가 고른 길(내 화면에서만, 공개 전)
        if (!TV && (ph === 'choose' || ph === 'wait') && o.picked(code) === l) {
          g.strokeStyle = '#ffd23e';
          g.strokeRect(fx - 17.5, y + Math.floor((h - 15) / 2) - 0.5, 16, 16);
        }
      }
      for (const e of els.values()) e.used = false;
      const list = [];
      let caughtN = 0,
        savedN = 0,
        passN = 0,
        bubLane = {};
      for (const r of alive) {
        const k = kidOf(r, roster.indexOf(r));
        const showing = ph === 'show' || ph === 'done';
        const u = showing ? (ph === 'done' ? 9 : pt) - k.delay : -1;
        const caught = showing && !k.ok && u >= 0.7;
        if (showing) k.ok ? passN++ : k.saved ? savedN++ : caughtN++;
        if (showing && !k.ok && !k.saved && u > 4.8) continue; // 퇴장
        if (showing && k.ok && k.x > W + 10) continue;
        let f = md(T * (ph === 'choose' ? 6 : 10) + k.ph, 4);
        if (caught) f = u < 1.05 ? 4 : 0;
        const bow = caught && u > 2.3 && u < (k.saved ? 3.0 : 3.6) ? md(T * 6, 2) : 0;
        list.push({
          y: k.y,
          f: () => {
            g.save();
            g.translate(Math.round(k.x), Math.round(k.y));
            if (caught) g.scale(-1, 1);
            const img = k.fr[f];
            g.drawImage(img, -Math.floor(img.width / 2), -img.height + bow);
            g.restore();
            if (caught && u < 2.5)
              for (let s = 0; s < 3; s++) {
                const a = T * 6 + (s * Math.PI * 2) / 3;
                g.fillStyle = '#ffe36a';
                g.fillRect(Math.round(k.x + Math.cos(a) * 6), Math.round(k.y - k.fr[0].height - 2 + Math.sin(a) * 2), 2, 2);
              }
            if (k.saved && u > 3.0 && u < 4.6) g.drawImage(A.STAMP, Math.round(k.x) - 4, Math.round(k.y) - k.fr[0].height - 12 - (u < 3.2 ? 3 : 0)); // 도장 짠!
            if (caught && u > 2.3 && u < (k.saved ? 3.0 : 3.6)) {
              g.fillStyle = '#7ac8f0';
              g.fillRect(Math.round(k.x) + 5, Math.round(k.y) - k.fr[0].height + 3, 2, 3);
            }
            if (k.me) g.drawImage(PX.arrow, Math.round(k.x) - 3, Math.round(k.y) - k.fr[0].height - 6);
          },
        });
        if (caught && u >= 1.5) {
          let mx,
            frm = md(T * 8, 2),
            flip = false;
          if (u < 2.3) mx = -16 + ((u - 1.5) / 0.8) * (k.hx - 24 + 16);
          else if (u < 3.6 || (k.saved && u < 3.9)) (mx = k.hx - 24), (frm = !k.saved || u < 3.0 ? (md(T * 5, 2) ? 2 : 0) : 0);
          else if (k.saved) (mx = k.hx - 24 - (u - 3.9) * 70), (flip = true); // 엄마 혼자 돌아감
          else (mx = k.x - 10), (flip = true);
          list.push({
            y: k.y + 0.1,
            f: () => {
              g.save();
              g.translate(Math.round(mx), Math.round(k.y));
              if (flip) g.scale(-1, 1);
              g.drawImage(k.mom[frm], -8, -k.mom[0].height);
              g.restore();
            },
          });
          if (k.saved && u > 2.3 && u < 3.9) put(el('b' + k.sid, 'cbub' + (u > 3.0 ? ' ok' : ''), u > 3.0 ? '어머, 다 했구나~ 놀다 와!' : '숙제했어?!'), mx, k.y - k.mom[0].height - 2);
          else if (!k.saved && u > 2.3 && u < 3.6 && !bubLane[k.lane]) {
            bubLane[k.lane] = 1;
            put(el('b' + k.sid, 'cbub', k.scold), mx, k.y - k.mom[0].height - 2);
          }
        }
        if (caught && u < 1.3 && caughtN <= 5) put(el('k' + k.sid, 'ckung', '쿵!'), k.hx + 4, k.hy - k.fr[0].height - 2);
        if (k.me && !TV) put(el('me', 'clab', '나'), k.x, k.y - k.fr[0].height - 7);
      }
      list.sort((a, b) => a.y - b.y);
      for (const x of list) x.f();
      for (const e of els.values()) if (!e.used) e.hidden = true;

      // 글자판
      $('.hn').textContent = heartsShown;
      $('.hx').textContent = '/ ' + ((G.cc && G.cc.max) || cfg.hearts);
      $('.hm').textContent = T - minusAt < 2 && minus ? '-' + minus : '';
      $('.sn').textContent = j + 1;
      $('.sx').textContent = times.length;
      const T0 = tm.ch1 - tm.ch0;
      const left = ph === 'choose' ? Math.max(0, tm.ch1 - t) : ph === 'run' || ph === 'intro' ? T0 : 0;
      $('.tn').textContent = Math.ceil(left);
      $('.ctimer .bar i').style.width = (100 * left) / T0 + '%';
      $('.ctimer').classList.toggle('hurry', ph === 'choose' && left < 1.2);
      const intro = $('.cintro');
      intro.hidden = ph !== 'intro';
      if (ph === 'intro') intro.querySelector('.n').textContent = Math.ceil(-t);
      if (TV) {
        const f = $('.cfoot');
        const h = (ph === 'show' || ph === 'done') && pt > 0.7 ? '이번 갈림길 · <b class="ok">통과 ' + passN + '</b> · <b class="no">잡힘 ' + caughtN + '</b>' + (savedN ? ' · <b class="st">도장으로 살아남 ' + savedN + '</b>' : '') : ph === 'choose' ? '디벗을 보고 뚫린 길을 골라요! · 달리는 친구 <b>' + alive.length + '</b>명' : ph === 'wait' ? '두근두근… 결과 공개!' : '달려라! 엄마가 쫓아와요 · <b>' + alive.length + '</b>명';
        if (f.innerHTML !== h) f.innerHTML = h;
      } else {
        const mine = o.picked(code);
        const meK = o.me && kids.get(o.me);
        let rs = '';
        if (meOut) rs = 'out';
        else if (ph === 'wait') rs = mine === undefined ? 'bump' : 'wait';
        else if (ph === 'show' || ph === 'done') rs = meK && meK.showInit ? (meK.ok ? 'ok' : meK.saved ? (pt - meK.delay > 3.0 ? 'saved' : 'bump') : pt - meK.delay > 2.3 ? 'out' : 'bump') : '';
        // 아직 안 쓴 숙제 도장
        let used = false;
        for (let i = 0; i <= j; i++) if (ch.res && ch.res[i] && ch.res[i].s && ch.res[i].s.includes(o.me) && (i < j || ph === 'show' || ph === 'done')) used = true;
        const sb = $('.cstamp');
        if (sb) sb.hidden = !(ch.stamp && ch.stamp.includes(o.me)) || used || meOut;
        if (rs === 'bump' && ph === 'wait') rs = 'wait';
        drawPad(gate, code, mine, meOut, rs);
      }
    }
    raf = requestAnimationFrame(frame);
    return {
      root,
      unmount() {
        gone = true;
        cancelAnimationFrame(raf);
        removeEventListener('resize', layout);
        root.remove();
      },
    };
  }
  QP.ChaseView = { mount };
})();
