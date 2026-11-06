/* referee-tug.js — 「줄다리기」 심판 (작업/결정-줄다리기.md). 셈은 tug.js.
 * 문제·정답 보기·팀 나누기·결과·끝은 보물 지키기 심판(referee-treasure.js)을 그대로 쓰고, 미니게임만 바꾼다. 팀은 늘 2개.
 *
 * 판 문서 live: 미니게임 중 { mg, kind:'tug', t0, dur, pw:{sid:힘}, d:{sid:점수}, n:{팀:인원}, end:끝선에 닿은 때(초)|null, win:이긴 팀|-1 }
 * 자리 문서(그 아이만): dres{mg, win:1 이김|0 짐|-1 비김, my, avg:[0팀,1팀], pos, early, wins:[0팀,1팀]}, fin{rank, tot:이긴 횟수, my, nOk, nAns, n}
 * 아이가 쓰는 칸: a{r,v} 답, b{r:미니게임 번호, x:0, y:0, d:내 점수, k:0, h:0} (보스 슈팅 칸 그대로 → 규칙 안 바꿈)
 */
(function (root) {
  'use strict';
  const QP = root.QP;
  const LIVE_MS = 333;

  class TugReferee extends QP.TreasureReferee {
    defaultCfg() {
      return QP.TUG_CFG;
    }
    pubCfg() {
      const c = this.S.cfg;
      return { mode: 'tug', per: c.per, M: c.M, teams: 2, tQ: c.tQ, tReveal: c.tReveal, tIntro: c.tIntro, tDefend: c.tDefend, tResult: c.tResult };
    }
    afterCreate() {
      this.S.cfg.teams = 2;
      super.afterCreate();
      this.S.t.wins = [0, 0];
      this.S.t.avg = [0, 0]; // 미니게임마다 한 명당 평균 점수 합(같은 승수일 때)
      this.S.t.my = {};
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
      const L = this.live;
      if (S.phase === 'defend' && L && d.b && d.b.r === S.t.mg && typeof d.b.d === 'number') {
        // 점수: 줄지 않고(새로 고침해도), 지금까지 지난 박자로 낼 수 있는 만큼까지만
        const g = (this.net.now() - L.t0) / QP.ms(1);
        const cap = QP.tgCap(this.beats, Math.min(g, L.dur), s.tgp || 1);
        s.tgs = Math.max(s.tgs || 0, Math.min(cap, Math.max(0, d.b.d | 0)));
      }
      this.emit();
    }

    /* ---------- 줄다리기 ---------- */
    async startDefend() {
      const S = this.S,
        c = S.cfg,
        T = S.t;
      const mg = T.mg;
      S.phase = 'defend';
      S.phaseAt = this.net.now();
      const t0 = S.phaseAt + QP.ms(c.tIntro);
      S.endsAt = t0 + QP.ms(c.tDefend);
      this.beats = QP.tgBeats(c.tDefend);
      const live = { mg, kind: 'tug', t0, dur: c.tDefend, pw: {}, d: {}, n: {}, end: null, win: -1 };
      for (let t = 0; t < 2; t++) {
        const kids = this.teamSeats(t);
        live.n[t] = kids.length;
        for (const s of kids) {
          s.tgp = QP.tgPower(s.blk);
          s.tgs = 0;
          live.pw[s.sid] = s.tgp;
          live.d[s.sid] = 0;
        }
      }
      this.live = live;
      this.log('줄다리기 ' + (mg + 1) + '번째');
      await this.net.update(this.path(), { phase: 'defend', round: S.round, endsAt: S.endsAt, live, tt: this.pubT(), roster: this.roster() });
      clearInterval(this.liveT);
      let lastSig = '';
      this.liveT = setInterval(() => {
        if (S.phase !== 'defend') return clearInterval(this.liveT);
        const sig = this.fillLive();
        // 끝선에 닿으면 바로 그 팀 승리 → 2초 뒤 결과
        const g = (this.net.now() - t0) / QP.ms(1);
        if (live.end === null && g >= 0 && g < c.tDefend) {
          const st = this.liveTeams();
          if (Math.abs(st.pos) >= 1) {
            live.end = Math.round(g * 100) / 100;
            live.win = st.pos > 0 ? 0 : 1;
            this.net.update(this.path(), { live });
            this.log('줄다리기 끝선: ' + QP.teamName(T.order[live.win]));
            this.after(this.net.now() + QP.ms(2.2), () => this.endDefend());
            return;
          }
        }
        if (sig !== lastSig) {
          lastSig = sig;
          this.net.update(this.path(), { live });
        }
      }, QP.ms(LIVE_MS / 1000));
      this.after(S.endsAt + QP.ms(0.6), () => this.endDefend());
      this.save();
      this.emit();
    }
    fillLive() {
      const L = this.live;
      for (let t = 0; t < 2; t++) for (const s of this.teamSeats(t)) L.d[s.sid] = s.tgs || 0;
      return JSON.stringify(L.d);
    }
    // 팀별 한 명당 평균과 줄 위치
    liveTeams() {
      const avg = [0, 1].map((t) => {
        const kids = this.teamSeats(t);
        return kids.length ? kids.reduce((n, s) => n + (s.tgs || 0), 0) / kids.length : 0;
      });
      return { avg, pos: QP.tgPos(avg[0], avg[1]), n: [0, 1].map((t) => this.teamSeats(t).length) };
    }
    async endDefend() {
      const S = this.S,
        T = S.t,
        c = S.cfg;
      if (S.phase !== 'defend' || this.ending) return;
      this.ending = true;
      clearInterval(this.liveT);
      clearTimeout(this.timer);
      if (this.live) {
        this.fillLive();
        this.net.update(this.path(), { live: this.live });
      }
      const st = this.liveTeams();
      const early = !!(this.live && this.live.end !== null);
      const win = early ? this.live.win : st.pos > 0 ? 0 : st.pos < 0 ? 1 : -1;
      if (win >= 0) T.wins[win]++;
      for (let t = 0; t < 2; t++) {
        T.avg[t] += st.avg[t];
        T.tot[t] = T.wins[t]; // 순위 = 이긴 횟수
        T.kills[t] = Math.round(T.avg[t]); // 같으면 한 명당 평균 합
      }
      const res = [0, 1].map((t) => ({ t, avg: Math.round(st.avg[t]), n: st.n[t], win: win === t ? 1 : win < 0 ? -1 : 0 }));
      T.log.push(res);
      T.mg++;
      const ops = [];
      for (const s of this.seatList()) {
        T.my[s.sid] = (T.my[s.sid] || 0) + (s.tgs || 0);
        ops.push({ path: this.path('players/' + s.num), data: { dres: { mg: T.mg, win: win < 0 ? -1 : win === s.team ? 1 : 0, my: s.tgs || 0, pw: s.tgp || 1, avg: st.avg.map(Math.round), pos: Math.round(st.pos * 100) / 100, early: early ? 1 : 0, wins: T.wins.slice(), n: 2 } }, merge: true });
        s.blk = 0;
      }
      const over = T.mg >= c.M || S.endAfter;
      if (!over) {
        this.prepareNext();
        for (const s of this.seatList()) ops.push({ path: this.path('players/' + s.num), data: this.serveNext(s), merge: true });
      }
      await this.net.batch(ops);
      this.ending = false;
      S.phase = 'dres';
      S.phaseAt = this.net.now();
      S.endsAt = S.phaseAt + QP.ms(c.tResult);
      await this.net.update(this.path(), { phase: 'dres', round: S.round, endsAt: S.endsAt, tt: this.pubT(), dres: res });
      this.log('줄다리기 결과: ' + (win < 0 ? '비김' : QP.teamName(T.order[win]) + ' 승') + ' (' + res.map((x) => x.avg).join(' : ') + ')');
      this.after(S.endsAt, () => (over ? this.finish() : this.startQuestion()));
      this.save();
      this.emit();
    }
    async finish() {
      await super.finish();
      const T = this.S.t;
      await this.net.batch(this.seatList().map((s) => ({ path: this.path('players/' + s.num), data: { fin: Object.assign({}, this.finOf(s), { my: T.my[s.sid] || 0 }) }, merge: true })));
    }
    finOf(s) {
      const x = this.teamBoard().find((y) => y.t === s.team) || {};
      return { rank: x.rank || 0, tot: x.tot || 0, k: x.k || 0, nOk: s.nOk, nAns: s.nAns, n: 2, wins: this.S.t.wins.slice() };
    }
    results() {
      const R = super.results();
      const T = this.S.t;
      R.kids.forEach((k) => {
        const s = this.S.seats[k.num];
        k.tug = s ? T.my[s.sid] || 0 : 0;
      });
      return R;
    }
    resumePhase() {
      if (this.S.phase === 'defend') this.beats = QP.tgBeats(this.S.cfg.tDefend);
      super.resumePhase();
    }
  }
  QP.TugReferee = TugReferee;
})(typeof window !== 'undefined' ? window : globalThis);
