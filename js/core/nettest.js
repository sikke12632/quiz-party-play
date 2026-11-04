/* nettest.js — 실시간 시험방 (작업/결정-실시간-이벤트.md 4절)
 * 학교 와이파이·디벗에서 Firestore 만으로 실시간 움직임이 쓸 만한지 숫자로 잰다. 판정·점수 없음.
 *   선생님 화면(방장): 방 열기 → 4자리 코드 → 「시작」 1분 → 기기별 표 + 한 줄 판정 → 기록 지우기
 *   아이 디벗: 코드·번호 → 방향 버튼으로 내 동그라미(뒤 30초는 3D 인형)를 움직인다
 * 짜임(결정 문서 3절 권장):
 *   아이는 내 인형을 바로 움직이고 내 위치를 1초에 SEND_HZ 번 자기 칸(kids/{uid})에 쓴다.
 *   방장은 모두의 위치를 모아 방 문서 하나(pos)로 1초에 BCAST_HZ 번 내보낸다. 아이는 그 문서 하나만 듣고 친구를 이어 그린다.
 * 잴 것(기기마다): 왕복 지연(내가 보낸 위치가 방장을 거쳐 돌아오기까지), 끊김(1초 넘게 소식 없음), 화면 수(FPS, 2D·3D), 쓰기·읽기 수.
 * 서버 모양: qp_nettest/{room} {code, owner, phase:'open'|'run'|'end', at, dur, startAt, endsAt, pos:{uid:[x,y,seq]}, bt, bn}
 *            qp_nettest/{room}/kids/{uid} {n, x, y, seq, at, ua, stats}
 * 이 파일은 브라우저와 node(시험 프로그램) 모두에서 돈다. 그리기는 nettest-ui.js.
 */
(function (root) {
  'use strict';
  const QP = root.QP;
  const NT = (QP.NT = {});
  NT.COL = 'qp_nettest';
  NT.SEND_HZ = 4; // 아이가 내 위치를 보내는 횟수(1초에)
  NT.BCAST_HZ = 4; // 방장이 모두의 위치를 내보내는 횟수(1초에)
  NT.DUR = 60; // 시험 시간(초). 앞 절반 2D, 뒤 절반 3D
  NT.W = 100; // 마당 크기(가로·세로)
  NT.H = 60;
  NT.TH = { avg: 600, max: 1500, fps: 30, gaps: 2 }; // 판정 기준(결정 문서 4절 시작값)
  const clock = () => (typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now());
  NT.clock = clock;
  const r2 = (v) => Math.round(v * 100) / 100;
  const avg = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0);
  const pct = (a, p) => {
    if (!a.length) return 0;
    const b = a.slice().sort((x, y) => x - y);
    return b[Math.min(b.length - 1, Math.floor(p * b.length))];
  };

  /* ================= 방장(선생님 화면) ================= */
  class Host {
    constructor(net, opts) {
      opts = opts || {};
      this.net = net;
      this.onUpdate = opts.onUpdate || (() => {});
      this.dur = opts.dur || NT.DUR;
      this.kids = {}; // uid → 자리 문서
      this.unsub = [];
      this.w = 0; // 방장이 쓴 수
      this.r = 0; // 방장이 받은 문서 수(읽기 어림)
      this.phase = 'none';
    }
    path(sub) {
      return NT.COL + '/' + this.id + (sub ? '/' + sub : '');
    }
    async open() {
      const net = this.net;
      let code;
      for (let k = 0; k < 30; k++) {
        code = String(1000 + Math.floor(Math.random() * 9000));
        const same = await net.find(NT.COL, 'code', code);
        if (!same.some((d) => d.data.phase !== 'end')) break;
      }
      this.id = QP.id(8);
      this.code = code;
      this.phase = 'open';
      await net.set(this.path(), { code, owner: net.uid, phase: 'open', at: net.now(), dur: this.dur, pos: {}, bt: 0, bn: 0 });
      this.w++;
      this.unsub.push(
        net.onCol(this.path('kids'), (list) => {
          for (const d of list) {
            const old = this.kids[d.id];
            if (!old || old.seq !== d.data.seq || JSON.stringify(old.stats) !== JSON.stringify(d.data.stats)) this.r++;
            this.kids[d.id] = d.data;
          }
          this.onUpdate(this);
        })
      );
      this.onUpdate(this);
      return code;
    }
    async start() {
      if (this.phase !== 'open') return;
      const net = this.net;
      this.phase = 'run';
      this.startAt = net.now();
      this.endsAt = this.startAt + this.dur * 1000;
      await net.update(this.path(), { phase: 'run', startAt: this.startAt, endsAt: this.endsAt });
      this.w++;
      this.bn = 0;
      this.timer = setInterval(() => this.bcast(), 1000 / NT.BCAST_HZ);
      this.endT = setTimeout(() => this.end(), this.dur * 1000 + 300);
      this.onUpdate(this);
    }
    // 모두의 위치를 문서 하나로
    bcast() {
      const pos = {};
      for (const [uid, k] of Object.entries(this.kids)) if (typeof k.x === 'number') pos[uid] = [r2(k.x), r2(k.y), k.seq || 0];
      this.bn++;
      this.w++;
      this.net.update(this.path(), { pos, bt: this.net.now(), bn: this.bn }).catch(() => {});
    }
    async end() {
      if (this.phase !== 'run') return;
      clearInterval(this.timer);
      clearTimeout(this.endT);
      this.phase = 'end';
      await this.net.update(this.path(), { phase: 'end' }).catch(() => {});
      this.w++;
      this.onUpdate(this);
      // 아이들이 마지막 결과를 보낼 시간을 준다
      setTimeout(() => this.onUpdate(this), 4000);
    }
    // 기기별 표 + 한 줄 판정
    // noFps: 화면 없는 시험(node)이면 FPS 는 판정에서 뺀다
    results(noFps) {
      const rows = Object.entries(this.kids)
        .map(([uid, k]) => Object.assign({ uid, n: k.n || '?', ua: k.ua || '' }, k.stats || {}))
        .sort((a, b) => (parseInt(a.n) || 999) - (parseInt(b.n) || 999));
      const got = rows.filter((x) => x.rn);
      const T = NT.TH;
      for (const x of rows) {
        x.ok = !!x.rn && x.avg <= T.avg && x.max <= T.max && (noFps || (x.fps2 || 0) >= T.fps) && (x.gaps || 0) <= T.gaps;
      }
      const kidW = got.reduce((s, x) => s + (x.w || 0), 0),
        kidR = got.reduce((s, x) => s + (x.r || 0), 0);
      const sum = {
        n: rows.length,
        got: got.length,
        avg: Math.round(avg(got.map((x) => x.avg))),
        max: got.length ? Math.max(...got.map((x) => x.max)) : 0,
        fps2: got.length ? Math.min(...got.map((x) => x.fps2 || 0)) : 0,
        fps3: got.filter((x) => x.fps3 > 0).length ? Math.min(...got.filter((x) => x.fps3 > 0).map((x) => x.fps3)) : 0,
        gaps: got.reduce((s, x) => s + (x.gaps || 0), 0),
        okN: rows.filter((x) => x.ok).length,
        writes: kidW + this.w,
        reads: kidR + this.r,
      };
      const good = got.length && sum.avg <= T.avg && sum.max <= T.max && (noFps || sum.fps2 >= T.fps) && got.every((x) => (x.gaps || 0) <= T.gaps);
      const close = got.length && sum.avg <= T.avg * 1.5 && sum.max <= T.max * 2;
      sum.verdict = !got.length ? '아직 결과가 없어요' : (good ? '✅ 쓸 만해요' : close ? '⚠️ 아슬아슬해요' : '❌ 어려워요') + `: 평균 ${(sum.avg / 1000).toFixed(2)}초, 가장 느림 ${(sum.max / 1000).toFixed(1)}초${noFps ? '' : ', 디벗 FPS ' + sum.fps2 + (sum.fps3 ? '(3D ' + sum.fps3 + ')' : '')}, 끊김 ${sum.gaps}번`;
      // 무료 한도(하루 쓰기 2만·읽기 5만)로 이 시험(1분)을 하루 몇 번
      sum.perDay = Math.floor(Math.min(20000 / Math.max(1, sum.writes), 50000 / Math.max(1, sum.reads)));
      return { rows, sum };
    }
    // 시험 기록 지우기(아이 자리 + 방)
    async cleanup() {
      this.stop();
      const ops = Object.keys(this.kids).map((uid) => ({ path: this.path('kids/' + uid), del: true }));
      ops.push({ path: this.path(), del: true });
      await this.net.batch(ops);
    }
    stop() {
      clearInterval(this.timer);
      clearTimeout(this.endT);
      this.unsub.forEach((u) => u && u());
      this.unsub = [];
    }
  }

  /* ================= 아이 디벗 ================= */
  // 흐느적 움직임: 관성·미끄러짐·살짝 비틀거림(결정 문서 2절 「느낌」)
  const ACC = 120,
    FRICT = 3.2,
    VMAX = 26;
  class Kid {
    constructor(net, opts) {
      opts = opts || {};
      this.net = net;
      this.bot = !!opts.bot;
      this.onUpdate = opts.onUpdate || (() => {});
      this.x = 10 + Math.random() * (NT.W - 20);
      this.y = 10 + Math.random() * (NT.H - 20);
      this.vx = 0;
      this.vy = 0;
      this.input = { x: 0, y: 0 };
      this.seq = 0;
      this.sent = new Map(); // seq → 보낸 때
      this.rtts = [];
      this.gaps = 0;
      this.maxGap = 0;
      this.w = 0;
      this.r = 0;
      this.fps = { 2: [], 3: [] };
      this.view = {}; // 친구 그리기용 uid → {fx,fy,tx,ty,t0}
      this.room = null;
      this.ua = opts.ua || '';
    }
    path(sub) {
      return NT.COL + '/' + this.rid + (sub ? '/' + sub : '');
    }
    async join(code, n) {
      const rooms = (await this.net.find(NT.COL, 'code', String(code))).filter((d) => d.data.phase !== 'end');
      if (!rooms.length) throw new Error('없는 방이에요');
      this.rid = rooms.sort((a, b) => b.data.at - a.data.at)[0].id;
      this.n = String(n);
      await this.net.set(this.path('kids/' + this.net.uid), { n: this.n, x: r2(this.x), y: r2(this.y), seq: 0, at: this.net.now(), ua: String(this.ua).slice(0, 80) });
      this.w++;
      this.unsub = this.net.onDoc(this.path(), (d) => this.onRoom(d));
      this.loop = setInterval(() => this.sendTick(), 1000 / NT.SEND_HZ);
      this.statT = setInterval(() => this.report(), 5000);
      return this.rid;
    }
    onRoom(d) {
      if (!d) return;
      this.r++;
      const t = clock();
      const wasRun = this.room && this.room.phase === 'run';
      if (d.phase === 'run' && wasRun && this.lastRoomAt) {
        const gap = t - this.lastRoomAt;
        if (gap > 1000) this.gaps++;
        this.maxGap = Math.max(this.maxGap, gap);
      }
      this.lastRoomAt = t;
      if (d.phase === 'run' && !this.runAt) this.runAt = t;
      if (d.phase === 'end' && this.room && this.room.phase !== 'end') {
        this.endAt = t;
        setTimeout(() => this.report(), 300 + Math.random() * 1500);
      }
      this.room = d;
      // 내 위치가 돌아옴 → 왕복 지연
      const me = d.pos && d.pos[this.net.uid];
      if (me && this.sent.has(me[2])) {
        this.rtts.push(t - this.sent.get(me[2]));
        for (const k of this.sent.keys()) if (k <= me[2]) this.sent.delete(k);
      }
      // 친구들: 지금 그려진 자리에서 새 자리로 이어 그린다(보간)
      for (const [uid, p] of Object.entries(d.pos || {})) {
        if (uid === this.net.uid) continue;
        const v = this.view[uid];
        const cur = v ? this.friendAt(uid, t) : [p[0], p[1]];
        this.view[uid] = { fx: cur[0], fy: cur[1], tx: p[0], ty: p[1], t0: t };
      }
      this.onUpdate(this);
    }
    friendAt(uid, t) {
      const v = this.view[uid];
      if (!v) return null;
      const k = Math.min(1, (t - v.t0) / (1000 / NT.BCAST_HZ));
      return [v.fx + (v.tx - v.fx) * k, v.fy + (v.ty - v.fy) * k];
    }
    get running() {
      return this.room && this.room.phase === 'run';
    }
    // 매 장면: 내 인형은 바로 움직인다
    step(dt) {
      if (this.bot) {
        this.botT = (this.botT || 0) - dt;
        if (this.botT <= 0) {
          this.botT = 0.4 + Math.random() * 1.2;
          const a = Math.random() * Math.PI * 2;
          this.input = Math.random() < 0.15 ? { x: 0, y: 0 } : { x: Math.cos(a), y: Math.sin(a) };
        }
      }
      if (!this.running) return;
      const wob = Math.sin(clock() / 170) * 0.25; // 비틀
      this.vx += (this.input.x + this.input.y * wob * 0.3) * ACC * dt;
      this.vy += (this.input.y - this.input.x * wob * 0.3) * ACC * dt;
      const f = Math.exp(-FRICT * dt);
      this.vx *= f;
      this.vy *= f;
      const sp = Math.hypot(this.vx, this.vy);
      if (sp > VMAX) (this.vx *= VMAX / sp), (this.vy *= VMAX / sp);
      this.x += this.vx * dt;
      this.y += this.vy * dt;
      if (this.x < 2 || this.x > NT.W - 2) (this.vx *= -0.4), (this.x = Math.max(2, Math.min(NT.W - 2, this.x)));
      if (this.y < 2 || this.y > NT.H - 2) (this.vy *= -0.4), (this.y = Math.max(2, Math.min(NT.H - 2, this.y)));
    }
    sendTick() {
      if (!this.running) return;
      this.seq++;
      this.sent.set(this.seq, clock());
      this.w++;
      this.net.update(this.path('kids/' + this.net.uid), { x: r2(this.x), y: r2(this.y), seq: this.seq }).catch(() => {});
    }
    // 화면 수: UI 가 1초마다 알려 준다(mode 2 | 3)
    addFps(mode, v) {
      if (this.running) this.fps[mode].push(v);
    }
    stats() {
      const f2 = this.fps[2].slice(1),
        f3 = this.fps[3].slice(1);
      return {
        rn: this.rtts.length,
        avg: Math.round(avg(this.rtts)),
        p95: Math.round(pct(this.rtts, 0.95)),
        max: Math.round(this.rtts.length ? Math.max(...this.rtts) : 0),
        gaps: this.gaps,
        maxGap: Math.round(this.maxGap),
        fps2: Math.round(avg(f2)),
        fps3: this.fps3Fail ? -1 : Math.round(avg(f3)),
        w: this.w,
        r: this.r,
      };
    }
    report() {
      if (!this.rid || !this.rtts.length) return;
      this.w++;
      this.net.update(this.path('kids/' + this.net.uid), { stats: this.stats() }).catch(() => {});
    }
    stop() {
      clearInterval(this.loop);
      clearInterval(this.statT);
      if (this.unsub) this.unsub();
    }
  }
  NT.Host = Host;
  NT.Kid = Kid;
})(typeof window !== 'undefined' ? window : globalThis);
