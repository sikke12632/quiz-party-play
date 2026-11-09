/* referee-treasure.js — 「보물 지키기」 심판 (작업/결정-보물지키기.md). 셈은 treasure.js.
 * 자리·접속·이어 하기·문제 나눠 주기는 황금 찾기 심판(referee.js)을 그대로 쓴다.
 *   문제(아이마다 따로) → 정답 보기 → … per문제마다 → 보물 지키기(defend) → 결과(dres) → … M번 → 끝
 *
 * 판 문서 tt:     { per, M, mg(끝난 미니게임 수), teams:[{t, n, blk, tot, k}] }  blk = 이번 묶음 맞힌 수 합
 * 판 문서 roster: [{sid, nick, team, cl}]  팀 안 순서 = 팀 번호 k (물리친 기록의 k)
 * 판 문서 live:   미니게임 중 { mg, seed, t0, dur, hearts, n:{팀:적 수}, lv:{sid:단계}, pos:{sid:[x10,y10]}, kills:{팀:[[적,k,때]]}, hits:{팀:[[적,때]]}, hurts:{팀:[[적,k,때]] 큰 유령이 쓰러지지 않고 맞음}, spd·big:빠르기·큰 유령 비율, h:{팀:하트} }
 * 자리 문서(그 아이만): team, cl, res{r, ok, my, ans, exp, blk, left}, dres{mg, h, rank, k}, fin{rank, tot, nOk, n}
 * 아이가 쓰는 칸: a{r,v} 답, p{r:미니게임 번호, x, y}(×10 정수) 내 위치
 */
(function (root) {
  'use strict';
  const QP = root.QP;
  const LIVE_MS = 333; // 위치 내보내기 간격 (1초 3번)

  class TreasureReferee extends QP.Referee {
    defaultCfg() {
      return QP.TREASURE_CFG;
    }
    pubCfg() {
      const c = this.S.cfg;
      return { mode: 'treasure', per: c.per, M: c.M, teams: c.teams, tQ: c.tQ, tReveal: c.tReveal, tIntro: c.tIntro, tDefend: c.tDefend, tResult: c.tResult, hearts: c.hearts };
    }
    afterCreate() {
      const n = Math.max(2, Math.min(QP.TEAM_ANIMALS.length, this.S.cfg.teams | 0));
      // 팀 동물 순서도 판마다 섞는다
      const order = this.r.shuffle([...Array(QP.TEAM_ANIMALS.length).keys()]).slice(0, n);
      this.S.t = { order, mg: 0, tot: order.map(() => 0), kills: order.map(() => 0), log: [] };
    }
    extraDoc() {
      return { tt: this.pubT(), roster: [] };
    }
    nTeams() {
      return this.S.t.order.length;
    }
    animalOf(team) {
      return QP.TEAM_ANIMALS[this.S.t.order[team]];
    }
    teamSeats(team) {
      return this.seatList()
        .filter((s) => s.team === team)
        .sort((a, b) => a.cl - b.cl || a.num - b.num);
    }
    // 들어올 때 인원이 적은 팀에 무작위로. 같은 팀은 같은 동물 모자, 옷 색(cl)만 다르다
    newIdentity() {
      const S = this.S,
        T = this.nTeams();
      const cnt = [...Array(T)].map((_, t) => this.seatList().filter((s) => s.team === t).length);
      const min = Math.min(...cnt);
      const team = this.r.pick([...Array(T).keys()].filter((t) => cnt[t] === min));
      const usedCl = this.seatList().filter((s) => s.team === team).map((s) => s.cl);
      let cl = 0;
      while (usedCl.includes(cl)) cl++;
      const [aname, aidx] = this.animalOf(team);
      const av = aidx + 14 * cl; // 3D 인형(모이는 곳 TV)도 같은 동물
      const freeAdj = [...Array(30).keys()].filter((k) => !S.usedAdj.includes(k));
      const adj = freeAdj.length ? this.r.pick(freeAdj) : this.r.int(30);
      S.usedAv.push(av);
      S.usedAdj.push(adj);
      const ADJ = root.JK && root.JK.ADJ;
      this.pendingTeam = { team, cl };
      return { av, adj, nick: (ADJ ? ADJ[adj % ADJ.length] : 'adj' + adj) + ' ' + aname };
    }
    seatDoc(s) {
      if (s.team === undefined && this.pendingTeam) Object.assign(s, this.pendingTeam);
      this.pendingTeam = null;
      if (!s.blk) s.blk = 0;
      return Object.assign(super.seatDoc(s), { team: s.team, cl: s.cl });
    }
    roster() {
      const out = [];
      for (let t = 0; t < this.nTeams(); t++) for (const s of this.teamSeats(t)) out.push({ sid: s.sid, nick: s.nick, team: t, cl: s.cl });
      return out;
    }
    pubT() {
      const t = this.S.t,
        c = this.S.cfg;
      return {
        per: c.per,
        M: c.M,
        mg: t.mg,
        teams: t.order.map((a, i) => {
          const ss = this.seatList().filter((s) => s.team === i);
          return { t: i, a, n: ss.length, blk: ss.reduce((x, s) => x + (s.blk || 0), 0), tot: t.tot[i], k: t.kills[i] };
        }),
      };
    }
    pushRoster() {
      const ro = this.roster();
      const sig = JSON.stringify(ro) + JSON.stringify(this.pubT());
      if (sig === this.rosterSig) return;
      this.rosterSig = sig;
      this.net.update(this.path(), { roster: ro, tt: this.pubT() });
    }
    async onJoin(uid, d) {
      await super.onJoin(uid, d);
      this.pushRoster();
    }
    async freeSeat(num) {
      await super.freeSeat(num);
      this.pushRoster();
    }

    /* ================= 아이가 쓴 것 ================= */
    onSeat(num, d) {
      if (this.viewOnly || !d) return;
      const S = this.S,
        s = S.seats[num];
      if (!s || d.uid !== s.uid) return;
      const sig = JSON.stringify([d.a, d.p, d.seen, d.tab]);
      if (sig !== s.sig) {
        s.sig = sig;
        s.last = this.net.now();
      }
      const r = S.round;
      if (S.phase === 'question' && d.a && d.a.r === r && s.cur && s.cur.r === r && !s.ans) {
        s.ans = { v: d.a.v, secs: (this.net.now() - S.phaseAt) / QP.ms(1) };
        this.checkAllAnswered();
      }
      if (S.phase === 'defend' && d.p && d.p.r === S.t.mg && typeof d.p.x === 'number') s.pos = QP.trClamp(d.p.x / 10, d.p.y / 10);
      this.emit();
    }
    onTick() {
      if (this.viewOnly) return;
      if (this.S.phase === 'question') this.checkAllAnswered();
      this.emit();
    }
    after(t, fn) {
      clearTimeout(this.timer);
      this.timer = setTimeout(fn, Math.max(0, t - this.net.now()));
    }

    /* ================= 문제 ================= */
    async start() {
      if (this.S.phase !== 'lobby' || !this.seatList().length) return false;
      this.S.t.mg = 0;
      for (const s of this.seatList()) s.blk = 0;
      const ok = await super.start();
      this.pushRoster();
      return ok;
    }
    async endQuestion() {
      const S = this.S,
        per = S.cfg.per;
      if (S.phase !== 'question' || this.ending) return;
      this.ending = true;
      clearTimeout(this.timer);
      const left = per - (((S.round - 1) % per) + 1); // 보물 지키기까지 남은 문제
      const ops = [];
      for (const s of this.seatList()) {
        if (!s.cur || s.cur.r !== S.round) continue;
        const q = this.qmap(s.cur.qid);
        const ok = !!s.ans && QP.isRight(q, s.ans.v);
        const st = (S.qstats[q.id] = S.qstats[q.id] || { n: 0, ok: 0 });
        st.n++;
        if (s.ans) s.nAns++;
        s.hist.push([q.id, ok ? 1 : s.ans ? 0 : -1]);
        if (ok) {
          st.ok++;
          s.nOk++;
          s.blk = (s.blk || 0) + 1;
        } else QP.Deck.retry(s.deck, q.id);
        const res = { r: S.round, ok, my: s.ans ? QP.expandAns(q, s.ans.v) : null, ans: QP.answerText(q), exp: q.explain || '', blk: s.blk, left };
        ops.push({ path: this.path('players/' + s.num), data: { res }, merge: true });
      }
      await this.net.batch(ops);
      this.ending = false;
      this.reveal();
    }
    async reveal() {
      const S = this.S,
        c = S.cfg;
      const more = S.round < c.per * c.M;
      if (more && S.round % c.per !== 0) {
        this.prepareNext();
        await this.net.batch(this.seatList().map((s) => ({ path: this.path('players/' + s.num), data: this.serveNext(s), merge: true })));
      }
      S.phase = 'reveal';
      S.phaseAt = this.net.now();
      S.endsAt = S.phaseAt + QP.ms(c.tReveal);
      await this.net.update(this.path(), { phase: 'reveal', round: S.round, endsAt: S.endsAt, tt: this.pubT() });
      this.after(S.endsAt, () => this.afterReveal());
      this.save();
      this.emit();
    }
    afterReveal() {
      const S = this.S;
      if (S.endAfter && S.round % S.cfg.per !== 0) return this.finish();
      if (S.round % S.cfg.per === 0) this.startDefend();
      else this.startQuestion();
    }

    /* ================= 보물 지키기 ================= */
    teamFoes(t, mg) {
      const c = this.S.cfg;
      return Math.round(c.foes * Math.max(1, this.teamSeats(t).length) * (1 + (c.foesMore === undefined ? 0.1 : c.foesMore) * mg));
    }
    async startDefend() {
      const S = this.S,
        c = S.cfg,
        T = S.t;
      const mg = T.mg;
      S.phase = 'defend';
      S.phaseAt = this.net.now();
      const t0 = S.phaseAt + QP.ms(c.tIntro);
      S.endsAt = t0 + QP.ms(c.tDefend);
      const seed = (S.seed + mg * 7919 + 17) >>> 0;
      const spd = Math.round((1 + (c.faster === undefined ? 0.15 : c.faster) * mg) * 100) / 100;
      const big = Math.round(((c.big || 0) + (c.bigMore || 0) * mg) * 100) / 100;
      const live = { mg, seed, t0, spd, big, dur: c.tDefend, hearts: c.hearts, n: {}, lv: {}, pos: {}, kills: {}, hits: {}, hurts: {}, h: {} };
      this.sims = [];
      for (let t = 0; t < this.nTeams(); t++) {
        const kids = this.teamSeats(t);
        const n = this.teamFoes(t, mg);
        live.n[t] = n;
        live.kills[t] = [];
        live.hits[t] = [];
        live.hurts[t] = [];
        live.h[t] = c.hearts;
        const E = QP.trSchedule(seed, c.tDefend, n, spd, big);
        this.sims[t] = { kids, sim: new QP.TrSim(E, kids.map((s) => ({ sid: s.sid, lv: QP.trLevel(s.blk) })), c.hearts) };
        kids.forEach((s, k) => {
          s.lv = QP.trLevel(s.blk);
          live.lv[s.sid] = s.lv;
          s.pos = QP.trHome(k, kids.length);
          live.pos[s.sid] = s.pos.map((v) => Math.round(v * 10));
        });
      }
      this.live = live;
      this.log('보물 지키기 ' + (mg + 1) + '번째');
      await this.net.update(this.path(), { phase: 'defend', round: S.round, endsAt: S.endsAt, live, tt: this.pubT(), roster: this.roster() });
      clearInterval(this.liveT);
      let lastPush = 0;
      this.liveT = setInterval(() => {
        if (S.phase !== 'defend') return clearInterval(this.liveT);
        const now = this.net.now();
        const tt = (now - t0) / QP.ms(1);
        if (tt < 0) return;
        for (let t = 0; t < this.sims.length; t++) {
          const { kids, sim } = this.sims[t];
          sim.step(Math.min(tt, c.tDefend), kids.map((s) => s.pos));
        }
        if (now - lastPush >= QP.ms(LIVE_MS / 1000) || tt >= c.tDefend) {
          lastPush = now;
          this.pushLive();
        }
      }, QP.ms(0.1));
      this.after(S.endsAt + QP.ms(0.4), () => this.endDefend());
      this.save();
      this.emit();
    }
    pushLive() {
      const L = this.live;
      for (let t = 0; t < this.sims.length; t++) {
        const { kids, sim } = this.sims[t];
        L.kills[t] = sim.kills;
        L.hits[t] = sim.hits;
        if (L.hurts) L.hurts[t] = sim.hurts;
        L.h[t] = sim.h;
        for (const s of kids) L.pos[s.sid] = s.pos.map((v) => Math.round(v * 10));
      }
      this.net.update(this.path(), { live: L });
    }
    async endDefend() {
      const S = this.S,
        T = S.t,
        c = S.cfg;
      if (S.phase !== 'defend' || this.ending) return;
      this.ending = true;
      clearInterval(this.liveT);
      if (!this.sims) this.sims = [];
      const res = [];
      for (let t = 0; t < this.nTeams(); t++) {
        const x = this.sims[t];
        if (x) x.sim.step(c.tDefend, x.kids.map((s) => s.pos));
        const h = x ? x.sim.h : c.hearts,
          k = x ? x.sim.kills.length : 0;
        T.tot[t] += h;
        T.kills[t] += k;
        res.push({ t, h, k });
      }
      if (this.live) this.pushLive();
      // 이번 미니게임 순위: 남은 하트 → 물리친 적
      const order = res.slice().sort((a, b) => b.h - a.h || b.k - a.k);
      order.forEach((x, i) => (x.rank = i > 0 && order[i - 1].h === x.h && order[i - 1].k === x.k ? order[i - 1].rank : i + 1));
      T.log.push(res);
      T.mg++;
      const ops = [];
      for (const s of this.seatList()) {
        const x = res.find((y) => y.t === s.team) || { h: 0, k: 0, rank: 0 };
        ops.push({ path: this.path('players/' + s.num), data: { dres: { mg: T.mg, h: x.h, k: x.k, rank: x.rank, n: res.length } }, merge: true });
        s.blk = 0;
      }
      const over = T.mg >= c.M || S.endAfter;
      if (!over) {
        this.prepareNext();
        for (const s of this.seatList()) ops.push({ path: this.path('players/' + s.num), data: this.serveNext(s), merge: true });
      }
      await this.net.batch(ops);
      this.ending = false;
      this.sims = null;
      S.phase = 'dres';
      S.phaseAt = this.net.now();
      S.endsAt = S.phaseAt + QP.ms(c.tResult);
      await this.net.update(this.path(), { phase: 'dres', round: S.round, endsAt: S.endsAt, tt: this.pubT(), dres: res });
      this.log('보물 지키기 결과: ' + res.map((x) => QP.teamName(T.order[x.t]) + ' ♥' + x.h).join(', '));
      this.after(S.endsAt, () => (over ? this.finish() : this.startQuestion()));
      this.save();
      this.emit();
    }

    /* ================= 끝 ================= */
    teamBoard() {
      const T = this.S.t;
      const b = T.order.map((a, t) => ({ t, a, tot: T.tot[t], k: T.kills[t], n: this.teamSeats(t).length }));
      b.sort((x, y) => y.tot - x.tot || y.k - x.k);
      b.forEach((x, i) => (x.rank = i > 0 && b[i - 1].tot === x.tot && b[i - 1].k === x.k ? b[i - 1].rank : i + 1));
      return b;
    }
    async finish() {
      const S = this.S;
      clearInterval(this.liveT);
      clearTimeout(this.timer);
      const tb = this.teamBoard();
      const ops = this.seatList().map((s) => {
        const x = tb.find((y) => y.t === s.team) || {};
        return { path: this.path('players/' + s.num), data: { fin: { rank: x.rank || 0, tot: x.tot || 0, k: x.k || 0, nOk: s.nOk, nAns: s.nAns, n: tb.length } }, merge: true };
      });
      await this.net.batch(ops);
      S.phase = 'end';
      S.endsAt = 0;
      S.endedAt = this.net.now();
      await this.net.update(this.path(), { phase: 'end', round: S.round, endsAt: 0, tt: this.pubT(), tboard: tb });
      this.log('판 끝');
      await this.save();
      this.emit();
    }
    nextOrEnd() {
      this.afterReveal();
    }
    // 선생님이 일찍 끝내기: 지금 묶음의 보물 지키기까지 하고 끝(모이는 곳이면 바로)
    async endNow() {
      if (this.S.phase === 'lobby' || this.S.phase === 'end') return this.finish();
      this.S.endAfter = true;
      this.S.cfg.M = Math.min(this.S.cfg.M, this.S.t.mg + 1);
      this.save();
      this.emit();
    }
    resumePhase() {
      const ph = this.S.phase;
      if (ph === 'question') this.startQuestion(true);
      else if (ph === 'reveal') this.afterReveal();
      else if (ph === 'defend') this.startDefend(); // 새로 고침: 이번 미니게임을 처음부터 다시
      else if (ph === 'dres') this.after(this.S.endsAt, () => (this.S.t.mg >= this.S.cfg.M ? this.finish() : this.startQuestion()));
    }
    stop() {
      clearInterval(this.liveT);
      super.stop();
    }
    results() {
      const R = super.results();
      const T = this.S.t;
      R.teams = this.teamBoard().map((x) => Object.assign({ name: QP.teamName(x.a) }, x));
      R.kids.forEach((k) => {
        const s = this.S.seats[k.num];
        k.team = s ? QP.teamName(T.order[s.team]) : '';
      });
      return R;
    }
  }
  QP.TreasureReferee = TreasureReferee;
})(typeof window !== 'undefined' ? window : globalThis);
