/* referee-paint.js — 「색칠 대작전」 심판 (작업/결정-색칠.md). 셈은 paint.js.
 * 문제·정답 보기·팀 나누기·끝은 보물 지키기 심판(referee-treasure.js)을 그대로 쓰고, 미니게임만 바꾼다. 팀 2~4개.
 *
 * 판 문서 live: 미니게임 중 { mg, kind:'paint', map, t0, dur, sp:{sid:걸음}, lv:{sid:맞힌 수}, pos:{sid:[x10,y10]}, g:{sid:게이지 0~100}, m:칠한 칸 글자, pc:[팀 %], bm:[[x10,y10,팀,때100]] }
 * 판 문서 dres: [{t, pc, win:1|0}]
 * 자리 문서(그 아이만): dres{mg, win, pc:[팀 %], my:내가 칠한 칸, wins:[팀 승]}, fin{rank, tot:이긴 판, k, nOk, nAns, n, wins, my}
 * 아이가 쓰는 칸: a{r,v} 답, b{r:미니게임, x:칸×3, y:칸×5, d:먹물 항아리 누른 수, k:0, h:0} (보스 슈팅 칸 그대로 → 규칙 안 바꿈)
 */
(function (root) {
  'use strict';
  const QP = root.QP;
  const LIVE_MS = 333;

  class PaintReferee extends QP.TreasureReferee {
    defaultCfg() {
      return QP.PAINT_CFG;
    }
    pubCfg() {
      const c = this.S.cfg;
      return { mode: 'paint', per: c.per, M: c.M, teams: c.teams, tQ: c.tQ, tReveal: c.tReveal, tIntro: c.tIntro, tDefend: c.tDefend, tResult: c.tResult };
    }
    afterCreate() {
      const n = Math.max(2, Math.min(4, this.S.cfg.teams | 0));
      this.S.cfg.teams = n;
      // 팀 = 물감 색(여우 빨강·토끼 파랑·호랑이 노랑·판다 먹) 중 n개, 순서는 판마다 섞음
      const order = this.r.shuffle(QP.PAINT_ANIMALS.slice()).slice(0, n);
      this.S.t = { order, mg: 0, tot: order.map(() => 0), kills: order.map(() => 0), log: [], wins: order.map(() => 0), pcs: order.map(() => 0), my: {} };
    }

    /* ---------- 아이가 쓴 것 ---------- */
    onSeat(num, d) {
      if (this.viewOnly || !d) return;
      const S = this.S,
        s = S.seats[num];
      if (!s || d.uid !== s.uid) return;
      const sig = JSON.stringify([d.a, d.b, d.seen, d.tab]);
      if (sig !== s.sig) {
        s.sig = sig;
        s.last = this.net.now();
      }
      const r = S.round;
      if (S.phase === 'question' && d.a && d.a.r === r && s.cur && s.cur.r === r && !s.ans) {
        s.ans = { v: d.a.v, secs: (this.net.now() - S.phaseAt) / QP.ms(1) };
        this.checkAllAnswered();
      }
      if (S.phase === 'defend' && this.board && d.b && d.b.r === S.t.mg && typeof d.b.x === 'number') {
        s.ptTo = QP.ptDec(d.b.x, d.b.y);
        if (typeof d.b.d === 'number' && d.b.d > (s.ptReq || 0)) s.ptReq = d.b.d; // 먹물 항아리 누름
      }
      this.emit();
    }

    /* ---------- 색칠 ---------- */
    async startDefend() {
      const S = this.S,
        c = S.cfg,
        T = S.t;
      const mg = T.mg;
      S.phase = 'defend';
      S.phaseAt = this.net.now();
      const t0 = S.phaseAt + QP.ms(c.tIntro);
      S.endsAt = t0 + QP.ms(c.tDefend);
      const map = QP.ptMapKey(mg);
      const M = QP.ptMap(map);
      this.board = new QP.PaintBoard(M, this.nTeams());
      this.t0 = t0;
      const live = { mg, kind: 'paint', map, t0, dur: c.tDefend, sp: {}, lv: {}, pos: {}, g: {}, m: this.board.encode(), pc: T.order.map(() => 0), bm: [] };
      for (let t = 0; t < this.nTeams(); t++) {
        const kids = this.teamSeats(t);
        kids.forEach((s, k) => {
          s.ptPos = QP.ptHome(t, k, kids.length);
          s.ptTo = null;
          s.ptAt = 0; // 마지막으로 옮긴 때(게임 초)
          s.ptG = 0; // 게이지(칸)
          s.ptMy = 0; // 이번 판 내가 칠한 칸
          s.ptReq = 0;
          s.ptUsed = 0;
          live.sp[s.sid] = Math.round(QP.ptSpeed(s.blk) * 100) / 100;
          live.lv[s.sid] = QP.ptLevel(s.blk);
          live.pos[s.sid] = s.ptPos.map((v) => Math.round(v * 10));
          live.g[s.sid] = 0;
        });
      }
      this.live = live;
      this.log('색칠 ' + (mg + 1) + '번째 · ' + QP.PT_MAPNAME[map]);
      await this.net.update(this.path(), { phase: 'defend', round: S.round, endsAt: S.endsAt, live, tt: this.pubT(), roster: this.roster() });
      clearInterval(this.liveT);
      this.liveT = setInterval(() => {
        if (S.phase !== 'defend') return clearInterval(this.liveT);
        const g = (this.net.now() - t0) / QP.ms(1);
        if (g >= 0 && g <= c.tDefend + 0.3) this.paintStep(Math.min(g, c.tDefend));
        this.pushLive();
      }, QP.ms(LIVE_MS / 1000));
      this.after(S.endsAt + QP.ms(0.6), () => this.endDefend());
      this.save();
      this.emit();
    }
    // 아이가 보낸 위치까지 걸어간 길을 칠한다(너무 멀리 뛰면 걸을 수 있는 만큼만)
    paintStep(g) {
      const L = this.live,
        M = this.board.M,
        PT = QP.PT;
      for (let t = 0; t < this.nTeams(); t++)
        for (const s of this.teamSeats(t)) {
          if (!s.ptPos) continue;
          const dt = Math.max(0, g - (s.ptAt || 0));
          s.ptAt = g;
          if (s.ptTo) {
            let [tx, ty] = s.ptTo;
            const [x0, y0] = s.ptPos;
            const far = Math.hypot(tx - x0, ty - y0),
              can = (L.sp[s.sid] || PT.BASE) * Math.max(dt, LIVE_MS / 1000) * 1.6 + 0.6;
            if (far > can) {
              tx = x0 + ((tx - x0) / far) * can;
              ty = y0 + ((ty - y0) / far) * can;
            }
            if (!M.free(Math.floor(tx), Math.floor(ty))) [tx, ty] = QP.ptMove(M, x0, y0, tx - x0, ty - y0, Math.hypot(tx - x0, ty - y0));
            const got = this.board.stroke(x0, y0, tx, ty, t);
            s.ptMy += got;
            s.ptG = Math.min(PT.GMAX, s.ptG + got);
            s.ptPos = [tx, ty];
            s.ptTo = null;
          }
          // 먹물 항아리: 게이지가 차 있고 새로 눌렀으면
          if (s.ptReq > s.ptUsed) {
            s.ptUsed = s.ptReq;
            if (s.ptG >= PT.GMAX) {
              s.ptG = 0;
              const [bx, by] = s.ptPos;
              let got = 0;
              for (let r = 1; r <= PT.BR; r++) got += this.board.dab(bx, by, r, t);
              s.ptMy += got;
              L.bm.push([Math.round(bx * 10), Math.round(by * 10), t, Math.round(g * 100)]);
              if (L.bm.length > 30) L.bm.shift();
            }
          }
          L.pos[s.sid] = s.ptPos.map((v) => Math.round(v * 10));
          L.g[s.sid] = Math.round((100 * s.ptG) / PT.GMAX);
        }
    }
    pushLive() {
      const L = this.live;
      if (!L || !this.board) return;
      L.m = this.board.encode();
      L.pc = this.board.pct().map((v) => Math.round(v * 10) / 10);
      const sig = L.m + JSON.stringify(L.pos) + JSON.stringify(L.g) + L.bm.length;
      if (sig === this.liveSig) return;
      this.liveSig = sig;
      this.net.update(this.path(), { live: L });
    }
    async endDefend() {
      const S = this.S,
        T = S.t,
        c = S.cfg;
      if (S.phase !== 'defend' || this.ending) return;
      this.ending = true;
      clearInterval(this.liveT);
      clearTimeout(this.timer);
      if (this.board) {
        this.paintStep(c.tDefend);
        this.liveSig = '';
        this.pushLive();
      }
      const pc = this.board ? this.board.pct() : T.order.map(() => 0);
      const wins = QP.ptWinners(pc);
      for (const t of wins) T.wins[t]++;
      for (let t = 0; t < this.nTeams(); t++) {
        T.pcs[t] += pc[t];
        T.tot[t] = T.wins[t]; // 순위 = 이긴 판 수
        T.kills[t] = Math.round(T.pcs[t] * 10); // 같으면 판 % 합(×10)
      }
      const res = T.order.map((a, t) => ({ t, pc: Math.round(pc[t] * 10) / 10, win: wins.includes(t) ? 1 : 0 }));
      T.log.push(res);
      T.mg++;
      const ops = [];
      for (const s of this.seatList()) {
        T.my[s.sid] = (T.my[s.sid] || 0) + (s.ptMy || 0);
        ops.push({ path: this.path('players/' + s.num), data: { dres: { mg: T.mg, win: wins.includes(s.team) ? 1 : 0, pc: res.map((x) => x.pc), my: s.ptMy || 0, wins: T.wins.slice(), map: this.live ? this.live.map : 'a' } }, merge: true });
        s.blk = 0;
      }
      const over = T.mg >= c.M || S.endAfter;
      if (!over) {
        this.prepareNext();
        for (const s of this.seatList()) ops.push({ path: this.path('players/' + s.num), data: this.serveNext(s), merge: true });
      }
      await this.net.batch(ops);
      this.ending = false;
      this.board = null;
      S.phase = 'dres';
      S.phaseAt = this.net.now();
      S.endsAt = S.phaseAt + QP.ms(c.tResult);
      await this.net.update(this.path(), { phase: 'dres', round: S.round, endsAt: S.endsAt, tt: this.pubT(), dres: res });
      this.log('색칠 결과: ' + res.map((x) => QP.teamName(T.order[x.t]) + ' ' + x.pc + '%' + (x.win ? '(승)' : '')).join(', '));
      this.after(S.endsAt, () => (over ? this.finish() : this.startQuestion()));
      this.save();
      this.emit();
    }
    async finish() {
      await super.finish();
      const T = this.S.t;
      const tb = this.teamBoard();
      await this.net.batch(
        this.seatList().map((s) => {
          const x = tb.find((y) => y.t === s.team) || {};
          return { path: this.path('players/' + s.num), data: { fin: { rank: x.rank || 0, tot: x.tot || 0, k: x.k || 0, nOk: s.nOk, nAns: s.nAns, n: tb.length, wins: T.wins.slice(), my: T.my[s.sid] || 0 } }, merge: true };
        })
      );
    }
    results() {
      const R = super.results();
      const T = this.S.t;
      R.kids.forEach((k) => {
        const s = this.S.seats[k.num];
        k.paint = s ? T.my[s.sid] || 0 : 0;
      });
      return R;
    }
    stop() {
      clearInterval(this.liveT);
      super.stop();
    }
  }
  QP.PaintReferee = PaintReferee;
})(typeof window !== 'undefined' ? window : globalThis);
