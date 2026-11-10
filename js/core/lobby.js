/* lobby.js — 모이는 곳(대기실) 놀이: 도트 광장 + 말풍선 + 도깨비 꼬리잡기 (작업/결정-대기실.md)
 * 화면 코드 없음: 선생님 화면(심판)·아이 화면·node 봇이 같이 쓴다. 모든 모드의 모이는 곳에서 같다.
 *
 * 아이 → 자리 문서 b{r:-1, x:칸×4, y:칸×7, d:말풍선(번호×1 + 보낸 차례×10), k:0, h:0}  (보스 슈팅 칸 그대로 → 서버 규칙 안 바꿈)
 *   움직였을 때만, 0.7초마다.
 * 선생님 화면 → 판 문서 lb{ on, end(놀이 끝 시각), p:{sid:[x10,y10]}, k:{sid:[동물, 옷]}, it:[술래 sid], fz:{sid:1}, sh:{sid:1}, e:{sid:[말풍선, 차례]}, st:{sid:초}, msg:[글, 때], n:잡은 횟수 }
 *   바뀌었을 때만, 0.7초마다.
 * 꼬리잡기(바꾸기): 술래 = 도깨비 뿔. 8명마다 1명. 잡히면 술래가 바뀜, 새 술래 2초 얼음, 들어온 친구 3초 보호막.
 *   술래가 5초 동안 1칸 넘게 안 움직이면 다른 친구에게 저절로 넘어감(2026-11-10 담임).
 */
(function (root) {
  'use strict';
  const QP = root.QP;

  const LB = (QP.LB = {
    W: 48,
    H: 27,
    SPEED: 4.2, // 걸음(초당 칸) — 모두 같음
    IT_SPEED: 4.8, // 술래는 조금 빠르게(따라잡을 수 있게)
    REACH: 1.7, // 잡는 거리(칸) — 위치가 0.7초마다 오는 만큼 넉넉히
    FREEZE: 2, // 새 술래 얼음
    SHIELD: 3, // 들어오자마자·잡고 넘겨준 뒤 보호막
    IDLE: 5, // 술래가 이만큼 안 움직이면 넘어감
    PER: 8, // 이만큼마다 술래 한 명
    EMO_S: 2.2,
    SEND_S: 0.7, // 아이 위치 보내기 간격(움직였을 때만)
    PUSH_S: 0.7, // 선생님 화면 내보내기 간격(바뀌었을 때만)
    MIN: 2, // 대기 놀이 시간(분) 기본값 — 서버 무료 한도(하루 쓰기 2만) 때문에 끝이 있다. 26명 2분 ≈ 쓰기 4천
  });
  QP.LB_EMOS = ['👋', '❤️', '😆', '👍'];
  QP.lbEnc = (x, y) => [Math.max(0, Math.min(200, Math.round(x * 4))), Math.max(0, Math.min(200, Math.round(y * 7)))];
  QP.lbDec = (bx, by) => [bx / 4, by / 7];
  QP.lbClamp = (x, y) => [Math.max(0.6, Math.min(LB.W - 0.6, x)), Math.max(1.6, Math.min(LB.H - 0.4, y))];
  QP.lbMove = function (x, y, dx, dy, dist) {
    const L = Math.hypot(dx, dy);
    if (L < 1e-6) return [x, y];
    const s = Math.min(L, dist);
    return QP.lbClamp(x + (dx / L) * s, y + (dy / L) * s);
  };
  // 처음 자리: 자리 번호로 광장 둘레에 흩어 놓기(모든 기기가 같게)
  QP.lbSpawn = function (num) {
    const a = ((num * 137.5) % 360) * (Math.PI / 180);
    const r = 0.55 + ((num * 7) % 10) / 30;
    return QP.lbClamp(LB.W / 2 + Math.cos(a) * r * 20, LB.H / 2 + 1 + Math.sin(a) * r * 10);
  };
  // 3D 인형 동물 순서(dolls.js ANIMALS) — 별명의 동물과 도트 인형을 같게
  QP.DOLL_NAMES = ['곰', '토끼', '고양이', '여우', '개구리', '병아리', '판다', '호랑이', '펭귄', '양', '사슴', '돼지', '공룡', '코알라'];
  // 도트 인형 모양: [동물 이름, 옷 색]
  QP.lbLookOf = function (ref, s) {
    const TA = QP.TEAM_ANIMALS;
    if (s.team !== undefined && ref.S && ref.S.t && ref.S.t.order) return [TA[ref.S.t.order[s.team] || 0][0], s.cl || 0];
    if (s.an !== undefined && TA[s.an]) return [TA[s.an][0], s.cl || 0];
    const av = s.av || 0;
    if (av >= 1000 && QP.MAFIA_ANIMALS) {
      const k = av - 1000; // 도깨비 찾기: 동물*4 + 색
      return [(QP.MAFIA_ANIMALS[Math.floor(k / 4)] || ['곰'])[0], k % 4];
    }
    return [QP.DOLL_NAMES[av % 14] || '곰', Math.floor(av / 14) % 8];
  };
  // 친구 인형 부드럽게 따라가기(새 위치까지 같은 빠르기로)
  QP.lbFollow = function (s, tx, ty, dt) {
    if (s.tx !== tx || s.ty !== ty) {
      s.tx = tx;
      s.ty = ty;
      const d = Math.hypot(tx - s.x, ty - s.y);
      if (d > 8) {
        s.x = tx;
        s.y = ty;
        s.v = 0;
      } else s.v = Math.max(d / (LB.PUSH_S + 0.1), LB.SPEED * 0.6);
    }
    const dx = s.tx - s.x,
      dy = s.ty - s.y,
      d = Math.hypot(dx, dy);
    if (d < 1e-4) return;
    const st = Math.min(d, (s.v || 0) * dt);
    if (Math.abs(dx) > 0.01) s.dir = dx > 0 ? 1 : -1;
    s.x += (dx / d) * st;
    s.y += (dy / d) * st;
    s.f = (s.f || 0) + st * 2.2;
  };
  QP.lbTagCount = (n) => Math.max(1, Math.round(n / LB.PER));
  const josa = (w, a, b) => {
    const c = String(w).charCodeAt(String(w).length - 1);
    return w + (c >= 0xac00 && c <= 0xd7a3 && (c - 0xac00) % 28 ? a : b);
  };

  /* ---------- 심판(선생님 화면) 쪽 꼬리잡기 ---------- */
  class LobbyTag {
    constructor(rnd) {
      this.r = rnd || Math.random;
      this.k = {}; // sid → {x, y, it, fz, sh, still, ax, ay, e, en, nick, look, last}
      this.n = 0;
      this.msg = null;
    }
    // 자리 목록으로 아이 더하기·빼기
    sync(seats, t, lookOf) {
      const seen = {};
      for (const s of seats) {
        seen[s.sid] = 1;
        let k = this.k[s.sid];
        if (!k) {
          const [x, y] = QP.lbSpawn(s.num);
          k = this.k[s.sid] = { x, y, it: false, fz: 0, sh: t + LB.SHIELD, still: 0, ax: x, ay: y, e: -1, en: 0 };
        }
        k.nick = s.nick;
        k.look = lookOf(s);
      }
      for (const sid of Object.keys(this.k)) if (!seen[sid]) delete this.k[sid];
    }
    // 아이가 보낸 위치·말풍선
    input(sid, b, t) {
      const k = this.k[sid];
      if (!k || !b) return;
      if (typeof b.x === 'number' && typeof b.y === 'number') {
        let [x, y] = QP.lbDec(b.x, b.y);
        if (k.fz > t) (x = k.x), (y = k.y); // 얼음이면 못 움직임
        k.x = x;
        k.y = y;
        k.last = t;
      }
      if (typeof b.d === 'number' && b.d > 0) {
        const seq = Math.floor(b.d / 10),
          e = b.d % 10;
        if (seq > k.en && e < QP.LB_EMOS.length) {
          k.en = seq;
          k.e = e;
          k.et = t;
        }
      }
    }
    list() {
      return Object.entries(this.k).map(([sid, k]) => Object.assign({ sid }, k));
    }
    // dt 초 지남: 술래 수 맞추기, 잡기, 오래 쉰 술래 넘기기
    step(t, dt) {
      const all = Object.keys(this.k);
      if (!all.length) return;
      const its = all.filter((sid) => this.k[sid].it);
      const want = QP.lbTagCount(all.length);
      if (its.length < want) {
        const free = all.filter((sid) => !this.k[sid].it && this.k[sid].sh <= t);
        for (let i = 0; i < want - its.length && free.length; i++) this.makeIt(free.splice(Math.floor(this.r() * free.length), 1)[0], t);
      } else if (its.length > want) for (const sid of its.slice(want)) this.k[sid].it = false; // 친구가 나가면 술래도 줄임
      // 잡기
      for (const a of all) {
        const A = this.k[a];
        if (!A.it || A.fz > t) continue;
        for (const b of all) {
          const B = this.k[b];
          if (B.it || B.sh > t || Math.hypot(A.x - B.x, A.y - B.y) > LB.REACH) continue;
          A.it = false;
          A.sh = t + 1.5; // 넘겨준 술래가 바로 되잡히지 않게
          this.makeIt(b, t);
          this.n++;
          this.msg = [josa(B.nick || '친구', '이', '가') + ' 잡혔어요! 이제 도깨비!', t, 'tag', b];
          break;
        }
      }
      // 오래 쉰 술래
      for (const a of all) {
        const A = this.k[a];
        if (!A.it) continue;
        if (Math.hypot(A.x - A.ax, A.y - A.ay) > 1) {
          A.ax = A.x;
          A.ay = A.y;
          A.still = 0;
        } else if (A.fz <= t) A.still += dt;
        if (A.still < LB.IDLE) continue;
        const cand = all.filter((sid) => !this.k[sid].it && this.k[sid].sh <= t);
        if (!cand.length) continue;
        const b = cand[Math.floor(this.r() * cand.length)];
        A.it = false;
        this.makeIt(b, t);
        this.msg = ['도깨비 ' + josa(A.nick || '친구', '이', '가') + ' 쉬어서 ' + (this.k[b].nick || '친구') + '에게 넘어갔어요!', t, 'pass', b];
      }
    }
    makeIt(sid, t) {
      const k = this.k[sid];
      k.it = true;
      k.fz = t + LB.FREEZE;
      k.still = 0;
      k.ax = k.x;
      k.ay = k.y;
    }
    // 판 문서에 내보낼 것
    snap(t) {
      const out = { p: {}, k: {}, it: [], fz: {}, sh: {}, e: {}, st: {}, n: this.n };
      for (const [sid, k] of Object.entries(this.k)) {
        out.p[sid] = [Math.round(k.x * 10), Math.round(k.y * 10)];
        out.k[sid] = k.look || [0, 0];
        if (k.it) out.it.push(sid);
        if (k.fz > t) out.fz[sid] = 1;
        if (k.sh > t && !k.it) out.sh[sid] = 1;
        if (k.e >= 0 && t - k.et < LB.EMO_S) out.e[sid] = [k.e, k.en];
        if (k.it && k.still >= 2.5) out.st[sid] = Math.ceil(LB.IDLE - k.still);
      }
      if (this.msg && t - this.msg[1] < 3) out.msg = [this.msg[0], this.msg[2], this.msg[3]];
      return out;
    }
  }
  QP.LobbyTag = LobbyTag;

  // 심판에 붙이기: 모이는 곳일 때만 돈다. ref = Referee(모든 모드). 판 설정 cfg.lobby(분, 0이면 끔)
  QP.lbAttach = function (ref) {
    if (ref.viewOnly || ref.lbT) return;
    const mins = ref.S.cfg.lobby === undefined ? LB.MIN : +ref.S.cfg.lobby || 0;
    if (!mins || ref.S.phase !== 'lobby') return;
    const tag = (ref.lbTag = new LobbyTag(Math.random));
    const t0 = ref.net.now();
    const end = (ref.S.lbEnd = ref.S.lbEnd || t0 + QP.ms(mins * 60));
    let last = ref.net.now(),
      lastPush = 0,
      sig = '';
    const sec = () => ref.net.now() / QP.ms(1); // 게임 초
    ref.lbT = setInterval(() => {
      const S = ref.S;
      if (S.phase !== 'lobby' || ref.viewOnly) return QP.lbDetach(ref);
      const now = ref.net.now();
      const on = now < end;
      const dt = Math.min(1, (now - last) / QP.ms(1));
      last = now;
      tag.sync(ref.seatList(), sec(), (s) => QP.lbLookOf(ref, s));
      if (on) tag.step(sec(), dt);
      if (now - lastPush < QP.ms(LB.PUSH_S)) return;
      const lb = Object.assign({ on: on ? 1 : 0, end }, tag.snap(sec()));
      const s2 = JSON.stringify(lb);
      if (s2 === sig) return;
      sig = s2;
      lastPush = now;
      ref.lb = lb;
      ref.net.update(ref.path(), { lb });
      if (!on) QP.lbDetach(ref, true);
    }, QP.ms(0.25));
  };
  QP.lbDetach = function (ref, keep) {
    clearInterval(ref.lbT);
    ref.lbT = null;
    if (!keep) ref.lbTag = null;
  };
  // 심판이 자리 문서를 받을 때(모이는 곳)
  QP.lbSeat = function (ref, num, d) {
    if (!ref.lbTag || ref.S.phase !== 'lobby' || !d || !d.b || d.b.r !== -1) return;
    const s = ref.S.seats[num];
    if (!s || d.uid !== s.uid) return;
    ref.lbTag.input(s.sid, d.b, ref.net.now() / QP.ms(1));
  };

  /* ---------- 봇(가짜 친구): 술래면 쫓고, 아니면 도망·이리저리, 가끔 말풍선 ---------- */
  QP.lbBotPlay = function (c) {
    const lb = c.game && c.game.lb;
    if (!lb || !lb.on || c.phase !== 'lobby' || !c.seat) return;
    const me = c.seat.sid;
    const t = c.net.now() / QP.ms(1);
    let B = c._lb;
    if (!B) {
      const p = (lb.p && lb.p[me]) || [240, 140];
      B = c._lb = { x: p[0] / 10, y: p[1] / 10, last: t, sent: 0, tx: 0, ty: 0, re: 0, en: 0, lazy: Math.random() < 0.2 };
    }
    if (t - B.last < LB.SEND_S) return;
    const dt = Math.min(1, t - B.last);
    B.last = t;
    const it = (lb.it || []).includes(me);
    if (lb.fz && lb.fz[me]) return;
    let dx = 0,
      dy = 0;
    const pos = (sid) => (lb.p[sid] ? [lb.p[sid][0] / 10, lb.p[sid][1] / 10] : null);
    if (it) {
      if (B.lazy) return; // 게으른 술래(시험: 5초 뒤 넘어가야 함)
      let best = null,
        bd = 1e9;
      for (const sid of Object.keys(lb.p)) {
        if (sid === me || (lb.it || []).includes(sid) || (lb.sh && lb.sh[sid])) continue;
        const q = pos(sid),
          d = Math.hypot(q[0] - B.x, q[1] - B.y);
        if (d < bd) (bd = d), (best = q);
      }
      if (best) (dx = best[0] - B.x), (dy = best[1] - B.y);
    } else {
      B.re -= dt;
      if (B.re <= 0 || Math.hypot(B.tx - B.x, B.ty - B.y) < 0.8) {
        B.tx = 2 + Math.random() * (LB.W - 4);
        B.ty = 3 + Math.random() * (LB.H - 5);
        B.re = 1 + Math.random() * 2;
      }
      dx = B.tx - B.x;
      dy = B.ty - B.y;
      for (const sid of lb.it || []) {
        const q = pos(sid);
        if (!q) continue;
        const d = Math.hypot(q[0] - B.x, q[1] - B.y);
        if (d < 6) (dx += ((B.x - q[0]) / Math.max(0.1, d)) * 6), (dy += ((B.y - q[1]) / Math.max(0.1, d)) * 6);
      }
    }
    [B.x, B.y] = QP.lbMove(B.x, B.y, dx, dy, (it ? LB.IT_SPEED : LB.SPEED) * dt);
    if (Math.random() < 0.06) B.en++, (B.e = Math.floor(Math.random() * 4));
    const [bx, by] = QP.lbEnc(B.x, B.y);
    c.write({ b: { r: -1, x: bx, y: by, d: B.en ? B.en * 10 + (B.e || 0) : 0, k: 0, h: 0 } });
  };
})(typeof window !== 'undefined' ? window : globalThis);
