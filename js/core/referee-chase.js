/* referee-chase.js — 「엄마 피해 도망가기」 심판 (작업/결정-괴물도망.md). 셈은 chase.js.
 * 자리·접속·이어 하기·문제 나눠 주기는 황금 찾기 심판(referee.js)을 그대로 쓴다.
 *   문제(아이마다 따로) → 정답 보기 → … per문제마다 → 미니게임(chase) → 결과(cres) → … M번 → 끝.  반 하트가 0이면 그 자리에서 끝.
 *
 * 판 문서 roster: [{sid, nick, a, cl}]   a = TEAM_ANIMALS 번호(도트 동물), cl = 옷 색
 * 판 문서 cc:     { per, M, mg(끝난 미니게임 수), hearts, max }
 * 판 문서 ch:     미니게임 중 { mg, seed, t0, runners:[sid], stamp:[숙제 도장 받은 sid], res:{갈림길:{p:{sid:길}, c:[잡힌 sid], s:[도장으로 봐준 sid]}}, hearts }
 * 판 문서 cres:   미니게임 결과 { mg, caught, hearts, alive, n }
 * 자리 문서(그 아이만): an(동물), cl, res{r, ok, my, ans, exp, left}, fin{hearts, stars, over, nOk, nAns}
 * 아이가 쓰는 칸: a{r,v} 답, p{r: chCode(미니게임, 갈림길), x: 고른 길, y: 0}
 */
(function (root) {
  'use strict';
  const QP = root.QP;

  class ChaseReferee extends QP.Referee {
    defaultCfg() {
      return QP.CHASE_CFG;
    }
    pubCfg() {
      const c = this.S.cfg;
      const o = {};
      for (const k of ['per', 'M', 'NJ', 'hearts', 'times', 'open', 'tQ', 'tReveal', 'tIntro', 'tRun', 'tWait', 'tShow', 'tResult', 'stampN', 'tLast', 'tWarn', 'events']) o[k] = c[k];
      o.mode = 'chase';
      return o;
    }
    afterCreate() {
      this.S.c = { mg: 0, hearts: this.S.cfg.hearts, log: [] };
    }
    extraDoc() {
      return { cc: this.pubC(), roster: [] };
    }
    pubC() {
      const c = this.S.cfg;
      return { per: c.per, M: c.M, mg: this.S.c.mg, hearts: this.S.c.hearts, max: c.hearts };
    }
    // 도트 동물 6 × 옷 색 8 중 안 쓴 것을 무작위로. 3D 모이는 곳 인형도 같은 동물
    newIdentity() {
      const S = this.S;
      const used = new Set(this.seatList().map((s) => s.an * 10 + s.cl));
      const free = [];
      for (let a = 0; a < QP.TEAM_ANIMALS.length; a++) for (let cl = 0; cl < 8; cl++) if (!used.has(a * 10 + cl)) free.push([a, cl]);
      const [a, cl] = free.length ? this.r.pick(free) : [this.r.int(6), this.r.int(8)];
      const [aname, aidx] = QP.TEAM_ANIMALS[a];
      const av = aidx + 14 * (cl % 4);
      const freeAdj = [...Array(30).keys()].filter((k) => !S.usedAdj.includes(k));
      const adj = freeAdj.length ? this.r.pick(freeAdj) : this.r.int(30);
      S.usedAv.push(av);
      S.usedAdj.push(adj);
      const ADJ = root.JK && root.JK.ADJ;
      this.pending = { an: a, cl };
      return { av, adj, nick: (ADJ ? ADJ[adj % ADJ.length] : 'adj' + adj) + ' ' + aname };
    }
    seatDoc(s) {
      if (s.an === undefined && this.pending) Object.assign(s, this.pending);
      this.pending = null;
      return Object.assign(super.seatDoc(s), { an: s.an, cl: s.cl }); // an(동물) — a 는 아이 답 칸이라 쓰면 안 된다
    }
    roster() {
      return this.seatList()
        .sort((x, y) => x.num - y.num)
        .map((s) => ({ sid: s.sid, nick: s.nick, a: s.an, cl: s.cl }));
    }
    pushRoster() {
      const ro = this.roster();
      const sig = JSON.stringify(ro);
      if (sig === this.rosterSig) return;
      this.rosterSig = sig;
      this.net.update(this.path(), { roster: ro });
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
      // 갈림길 고르기: 처음 받은 것만(한 번만 누른다)
      if (S.phase === 'chase' && d.p && typeof d.p.r === 'number' && d.p.r >= 1000) {
        s.pk = s.pk || {};
        if (s.pk[d.p.r] === undefined && d.p.x >= 0 && d.p.x <= 3) s.pk[d.p.r] = d.p.x;
      }
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
      const left = per - (((S.round - 1) % per) + 1);
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
          s.cblk = (s.cblk || 0) + 1; // 이번 묶음 맞힌 수(숙제 도장)
        } else QP.Deck.retry(s.deck, q.id);
        ops.push({ path: this.path('players/' + s.num), data: { res: { r: S.round, ok, my: s.ans ? QP.expandAns(q, s.ans.v) : null, ans: QP.answerText(q), exp: q.explain || '', left, blk: s.cblk || 0 } }, merge: true });
      }
      await this.net.batch(ops);
      this.ending = false;
      this.reveal();
    }
    async reveal() {
      const S = this.S,
        c = S.cfg;
      if (S.round < c.per * c.M && S.round % c.per !== 0) {
        this.prepareNext();
        await this.net.batch(this.seatList().map((s) => ({ path: this.path('players/' + s.num), data: this.serveNext(s), merge: true })));
      }
      S.phase = 'reveal';
      S.phaseAt = this.net.now();
      S.endsAt = S.phaseAt + QP.ms(c.tReveal);
      await this.net.update(this.path(), { phase: 'reveal', round: S.round, endsAt: S.endsAt, cc: this.pubC() });
      this.after(S.endsAt, () => this.afterReveal());
      this.save();
      this.emit();
    }
    afterReveal() {
      const S = this.S;
      if (S.round % S.cfg.per === 0) this.startChase();
      else if (S.endAfter) this.finish();
      else this.startQuestion();
    }

    /* ================= 미니게임 ================= */
    async startChase() {
      const S = this.S,
        c = S.cfg,
        C = S.c;
      const mg = C.mg;
      S.phase = 'chase';
      S.phaseAt = this.net.now();
      const t0 = S.phaseAt + QP.ms(c.tIntro);
      const times = QP.chTimes(c, mg);
      S.endsAt = t0 + QP.ms(times[times.length - 1].end);
      // 지금 접속해 있는 아이만 달린다(끊긴 아이 때문에 하트가 깎이지 않게)
      const runners = this.seatList()
        .filter((s) => this.alive(s))
        .sort((a, b) => a.num - b.num);
      for (const s of this.seatList()) s.pk = {};
      // 숙제 도장: 직전 묶음에서 stampN 개 넘게 맞힌 아이(이 미니게임에서 한 번 봐줌). 묶음 맞힌 수는 여기서 새로
      const stamp = runners.filter((s) => (s.cblk || 0) >= QP.chStampN(c)).map((s) => s.sid);
      for (const s of this.seatList()) s.cblk = 0;
      const seed = (S.seed + mg * 7919 + 31) >>> 0;
      this.gates = QP.chGates(seed, c, mg);
      this.run = { mg, t0, times, alive: new Set(runners.map((s) => s.sid)), caught: 0, stamp: new Set(stamp), saved: 0 };
      this.ch = { mg, seed, t0, runners: runners.map((s) => s.sid), stamp, res: {}, hearts: C.hearts };
      this.log('엄마 피해 도망가기 ' + (mg + 1) + '번째 (' + runners.length + '명)');
      await this.net.update(this.path(), { phase: 'chase', round: S.round, endsAt: S.endsAt, ch: this.ch, cc: this.pubC(), roster: this.roster() });
      clearTimeout(this.timer);
      this.jT = [];
      times.forEach((tm, j) => this.jT.push(setTimeout(() => this.judge(j), Math.max(0, t0 + QP.ms(tm.show - 0.15) - this.net.now()))));
      this.timer = setTimeout(() => this.endChase(), Math.max(0, S.endsAt + QP.ms(0.2) - this.net.now()));
      this.save();
      this.emit();
    }
    judge(j) {
      const S = this.S,
        C = S.c,
        R = this.run;
      if (S.phase !== 'chase' || !R || this.ch.res[j] || C.hearts <= 0) return;
      const g = this.gates[j],
        code = QP.chCode(R.mg, j);
      const p = {},
        caught = [],
        saved = [];
      for (const sid of R.alive) {
        const s = this.bySid(sid);
        const l = s && s.pk ? s.pk[code] : undefined;
        if (l !== undefined) p[sid] = l;
        if (l === undefined || !g.open.includes(l)) {
          // 숙제 도장이 있으면 엄마가 한 번 봐준다(탈락 안 함, 하트 안 깎임)
          if (R.stamp.has(sid)) {
            R.stamp.delete(sid);
            saved.push(sid);
          } else caught.push(sid);
        }
      }
      R.saved += saved.length;
      for (const sid of caught) R.alive.delete(sid);
      R.caught += caught.length;
      C.hearts = Math.max(0, C.hearts - caught.length);
      this.ch.res[j] = { p, c: caught, s: saved };
      this.ch.hearts = C.hearts;
      this.net.update(this.path(), { ch: this.ch, cc: this.pubC() });
      // 하트가 다 떨어지면 이 갈림길 공개가 끝난 뒤 미니게임을 끝낸다
      if (C.hearts <= 0 || R.alive.size === 0) {
        this.jT.forEach(clearTimeout);
        clearTimeout(this.timer);
        const end = R.t0 + QP.ms(R.times[j].end + 0.2);
        S.endsAt = end;
        this.net.update(this.path(), { endsAt: end });
        this.timer = setTimeout(() => this.endChase(), Math.max(0, end - this.net.now()));
      }
      this.emit();
    }
    async endChase() {
      const S = this.S,
        C = S.c,
        c = S.cfg,
        R = this.run;
      if (S.phase !== 'chase' || this.ending) return;
      this.ending = true;
      (this.jT || []).forEach(clearTimeout);
      // 아직 판정 안 된 갈림길(이어 하기 등)은 그냥 넘어간다
      const res = { mg: C.mg + 1, caught: R ? R.caught : 0, saved: R ? R.saved : 0, hearts: C.hearts, alive: R ? R.alive.size : 0, n: this.ch ? this.ch.runners.length : 0 };
      C.log.push(res);
      C.mg++;
      const over = C.hearts <= 0 || C.mg >= c.M || S.endAfter;
      if (!over) {
        this.prepareNext();
        await this.net.batch(this.seatList().map((s) => ({ path: this.path('players/' + s.num), data: this.serveNext(s), merge: true })));
      }
      this.ending = false;
      this.run = null;
      S.phase = 'cres';
      S.phaseAt = this.net.now();
      S.endsAt = S.phaseAt + QP.ms(c.tResult);
      await this.net.update(this.path(), { phase: 'cres', round: S.round, endsAt: S.endsAt, cres: res, cc: this.pubC() });
      this.log('미니게임 결과: 잡힘 ' + res.caught + ', 남은 하트 ' + C.hearts);
      this.after(S.endsAt, () => (over ? this.finish() : this.startQuestion()));
      this.save();
      this.emit();
    }

    /* ================= 끝 ================= */
    async finish() {
      const S = this.S,
        C = S.c,
        c = S.cfg;
      (this.jT || []).forEach(clearTimeout);
      clearTimeout(this.timer);
      const over = C.hearts <= 0;
      const stars = QP.chStars(C.hearts, c.hearts);
      await this.net.batch(this.seatList().map((s) => ({ path: this.path('players/' + s.num), data: { fin: { hearts: C.hearts, max: c.hearts, stars, over, nOk: s.nOk, nAns: s.nAns, mg: C.mg } }, merge: true })));
      S.phase = 'end';
      S.endsAt = 0;
      S.endedAt = this.net.now();
      await this.net.update(this.path(), { phase: 'end', round: S.round, endsAt: 0, cc: this.pubC(), cend: { hearts: C.hearts, max: c.hearts, stars, over, log: C.log } });
      this.log('판 끝: 하트 ' + C.hearts + (over ? ' (게임 오버)' : ' 별 ' + stars));
      await this.save();
      this.emit();
    }
    nextOrEnd() {
      this.afterReveal();
    }
    async endNow() {
      if (this.S.phase === 'lobby' || this.S.phase === 'end') return this.finish();
      this.S.endAfter = true;
      this.S.cfg.M = Math.min(this.S.cfg.M, this.S.c.mg + 1);
      this.save();
      this.emit();
    }
    resumePhase() {
      const ph = this.S.phase;
      if (ph === 'question') this.startQuestion(true);
      else if (ph === 'reveal') this.afterReveal();
      else if (ph === 'chase') this.startChase(); // 새로 고침: 이번 미니게임을 처음부터 다시
      else if (ph === 'cres') this.after(this.S.endsAt, () => (this.S.c.hearts <= 0 || this.S.c.mg >= this.S.cfg.M ? this.finish() : this.startQuestion()));
    }
    stop() {
      (this.jT || []).forEach(clearTimeout);
      super.stop();
    }
  }
  QP.ChaseReferee = ChaseReferee;
})(typeof window !== 'undefined' ? window : globalThis);
