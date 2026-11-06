/* referee-flip.js — 「도깨비 뒤집기」 심판 (작업/결정-뒤집기.md). 셈은 flip.js.
 * 자리·접속·이어 하기·문제 나눠 주기는 황금 찾기 심판(referee.js)을 그대로 쓴다.
 *   문제(아이마다 따로) → 정답 보기 → … per문제마다 → 뒤집기(pick) → 라운드 결과(fres) → … R라운드 → 끝(최종 결과)
 *
 * 판 문서 roster: [{sid, nick, a, cl}]  (명단 번호 = 이 순서. 아이는 tg.sid 에 이 번호를 36진 한 글자씩)
 * 판 문서 fl:     { per, R, r(끝난 라운드 수), code, ends, hint:{k, sids}|null, last:{flipped, g, h}|null }  — 종족·악마는 끝날 때까지 없음
 * 판 문서 fend:   끝날 때 { g, h, maj, winside, devilIn, rows:[{sid, o, now, devil, win}] }
 * 자리 문서(그 아이만): an, cl, role{o: 처음 종족, d: 악마?}, res{r, ok, my, ans, exp, left, blk}, fz{r: code, d: 지금 이대로면 뒤집힘(0/1)},
 *                      fres{r, now, flipped}, fin{o, now, win, devil}
 * 아이가 쓰는 칸: a{r,v} 답, tg{r: code, sid: 명단 번호 글자들}
 */
(function (root) {
  'use strict';
  const QP = root.QP;

  class FlipReferee extends QP.Referee {
    defaultCfg() {
      return QP.FLIP_CFG;
    }
    pubCfg() {
      const c = this.S.cfg;
      const o = { mode: 'flip' };
      for (const k of ['per', 'R', 'maxPick', 'tChoose', 'tWait', 'tQ', 'tReveal', 'tResult', 'tSnap', 'tHide', 'hints']) o[k] = c[k];
      return o;
    }
    afterCreate() {
      this.S.f = { r: 0, hint: null, last: null, devil: null, cand: [], log: [] };
    }
    extraDoc() {
      return { fl: this.pubF(), roster: [] };
    }
    pubF() {
      const c = this.S.cfg,
        F = this.S.f;
      return { per: c.per, R: c.R, r: F.r, code: F.code || 0, ends: F.ends || 0, hint: F.hint, last: F.last };
    }
    // 도트 동물 6 × 옷 색 8 (엄마 피해 도망가기와 같은 방식)
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
      return Object.assign(super.seatDoc(s), { an: s.an, cl: s.cl });
    }
    rosterSeats() {
      return this.seatList().sort((x, y) => x.num - y.num);
    }
    roster() {
      return this.rosterSeats().map((s) => ({ sid: s.sid, nick: s.nick, a: s.an, cl: s.cl }));
    }
    pushRoster() {
      // 판이 시작되면 명단 순서(= 고르는 번호)는 시작 때 순서(F.order) 그대로
      const ro = this.S.phase === 'lobby' || !this.S.f.order ? this.roster() : this.orderRoster();
      const sig = JSON.stringify(ro);
      if (sig === this.rosterSig) return;
      this.rosterSig = sig;
      this.net.update(this.path(), { roster: ro });
    }
    async onJoin(uid, d) {
      await super.onJoin(uid, d);
      // 판 중에 새로 온 아이: 종족만 무작위(악마 아님). 명단에는 끝에 붙인다
      const s = this.seatList().find((x) => x.uid === uid);
      if (s && this.S.phase !== 'lobby' && !s.o) {
        s.o = this.r() < 0.5 ? 'g' : 'h';
        s.sp = s.o;
        this.S.f.order.push(s.sid);
        this.net.update(this.path('players/' + s.num), { role: { o: s.o, d: false } });
        this.net.update(this.path(), { roster: this.orderRoster() });
      }
      this.pushRoster();
    }
    async freeSeat(num) {
      await super.freeSeat(num);
      this.pushRoster();
    }
    orderRoster() {
      return this.S.f.order.map((sid) => this.bySid(sid)).filter(Boolean).map((s) => ({ sid: s.sid, nick: s.nick, a: s.an, cl: s.cl }));
    }

    /* ================= 아이가 쓴 것 ================= */
    onSeat(num, d) {
      if (this.viewOnly || !d) return;
      const S = this.S,
        s = S.seats[num];
      if (!s || d.uid !== s.uid) return;
      const sig = JSON.stringify([d.a, d.tg, d.seen, d.tab]);
      if (sig !== s.sig) {
        s.sig = sig;
        s.last = this.net.now();
      }
      const r = S.round;
      if (S.phase === 'question' && d.a && d.a.r === r && s.cur && s.cur.r === r && !s.ans) {
        s.ans = { v: d.a.v, secs: (this.net.now() - S.phaseAt) / QP.ms(1) };
        this.checkAllAnswered();
      }
      // 뒤집기: 마감(+기다림)까지 몇 번이든 바뀜. 맞힌 수만큼(최대 maxPick)만 센다
      const F = S.f;
      if (S.phase === 'pick' && d.tg && d.tg.r === F.code && this.net.now() <= F.ends + QP.ms(S.cfg.tWait)) {
        const n = this.allow(s);
        const list = QP.flParse(d.tg.sid).filter((i) => i < F.order.length).slice(0, n);
        if (JSON.stringify(list) !== JSON.stringify(F.picks[s.sid] || [])) {
          F.picks[s.sid] = list;
          this.danger();
        }
      }
      this.emit();
    }
    allow(s) {
      return Math.min(this.S.cfg.maxPick, s.cblk || 0);
    }
    // 「지금 이대로면 뒤집혀!」: 홀짝이 바뀐 아이에게만 알린다(0.3초 묶음)
    danger() {
      clearTimeout(this.dT);
      this.dT = setTimeout(() => {
        const F = this.S.f;
        if (this.S.phase !== 'pick') return;
        const cnt = QP.flCount(F.picks);
        const ops = [];
        F.order.forEach((sid, i) => {
          const s = this.bySid(sid);
          if (!s) return;
          const dz = (cnt[i] || 0) % 2;
          if (s.dz !== dz) {
            s.dz = dz;
            ops.push({ path: this.path('players/' + s.num), data: { fz: { r: F.code, d: dz } }, merge: true });
          }
        });
        if (ops.length) this.net.batch(ops);
      }, QP.ms(0.3));
    }
    // 지금 고른 대로라면(TV 현황용): 도깨비 수·인간 수·악마 무리
    predict() {
      const F = this.S.f;
      const cnt = QP.flCount(F.picks || {});
      let g = 0,
        h = 0,
        ds = '';
      F.order.forEach((sid, i) => {
        const s = this.bySid(sid);
        if (!s) return;
        const now = (cnt[i] || 0) % 2 ? QP.flFlip(s.sp) : s.sp;
        now === 'g' ? g++ : h++;
        if (sid === F.devil) ds = now;
      });
      return { g, h, lv: QP.flLevel(g, h), ds, chosen: Object.values(F.picks || {}).filter((l) => l.length).length };
    }
    onTick() {
      if (this.viewOnly) return;
      const S = this.S;
      if (S.phase === 'question') this.checkAllAnswered();
      // TV 현황: tSnap 초마다 묶어서(선생님 화면이 그린다)
      if (S.phase === 'pick' && this.net.now() - (S.f.snapAt || 0) >= QP.ms(S.cfg.tSnap)) {
        S.f.snapAt = this.net.now();
        S.f.snap = this.predict();
      }
      this.emit();
    }
    after(t, fn) {
      clearTimeout(this.timer);
      this.timer = setTimeout(fn, Math.max(0, t - this.net.now()));
    }

    /* ================= 시작: 종족 반반·악마 1명 ================= */
    async start() {
      const S = this.S;
      if (S.phase !== 'lobby' || this.seatList().length < 2) return false;
      const seats = this.r.shuffle(this.rosterSeats().slice());
      seats.forEach((s, i) => (s.o = s.sp = i % 2 ? 'h' : 'g'));
      const F = S.f;
      F.order = this.rosterSeats().map((s) => s.sid);
      F.devil = this.r.pick(seats).sid;
      // 힌트 후보: 악마 + 다른 친구(5명 → 그중 3명 → 악마)
      const others = this.r.shuffle(F.order.filter((x) => x !== F.devil));
      const c5 = this.r.shuffle([F.devil].concat(others.slice(0, 4)));
      const c3 = this.r.shuffle([F.devil].concat(c5.filter((x) => x !== F.devil).slice(0, 2)));
      F.cand = { 5: c5, 3: c3, 1: [F.devil] };
      this.fixedRoster = true;
      await this.net.batch(this.seatList().map((s) => ({ path: this.path('players/' + s.num), data: { role: { o: s.o, d: s.sid === F.devil } }, merge: true })));
      await this.net.update(this.path(), { roster: this.orderRoster() });
      const ok = await super.start();
      return ok;
    }

    /* ================= 문제 ================= */
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
          s.cblk = (s.cblk || 0) + 1;
        } else QP.Deck.retry(s.deck, q.id);
        ops.push({ path: this.path('players/' + s.num), data: { res: { r: S.round, ok, my: s.ans ? QP.expandAns(q, s.ans.v) : null, ans: QP.answerText(q), exp: q.explain || '', left, blk: s.cblk || 0, pick: Math.min(S.cfg.maxPick, s.cblk || 0) } }, merge: true });
      }
      await this.net.batch(ops);
      this.ending = false;
      this.reveal();
    }
    async reveal() {
      const S = this.S,
        c = S.cfg;
      if (S.round < c.per * c.R && S.round % c.per !== 0) {
        this.prepareNext();
        await this.net.batch(this.seatList().map((s) => ({ path: this.path('players/' + s.num), data: this.serveNext(s), merge: true })));
      }
      S.phase = 'reveal';
      S.phaseAt = this.net.now();
      S.endsAt = S.phaseAt + QP.ms(c.tReveal);
      await this.net.update(this.path(), { phase: 'reveal', round: S.round, endsAt: S.endsAt, fl: this.pubF() });
      this.after(S.endsAt, () => this.afterReveal());
      this.save();
      this.emit();
    }
    afterReveal() {
      const S = this.S;
      if (S.round % S.cfg.per === 0) this.startPick();
      else if (S.endAfter) this.finish();
      else this.startQuestion();
    }
    // 반 전체 정답 비율 → 힌트(판 전체 최대 = 처음 인원 × 문제 수)
    checkHint() {
      const S = this.S,
        F = S.f,
        c = S.cfg;
      const max = Math.max(1, F.order.length * c.per * c.R);
      const got = this.seatList().reduce((n, s) => n + (s.nOk || 0), 0);
      let k = null;
      for (const [p, n] of c.hints) if (got / max >= p) k = n;
      if (k && (!F.hint || k < F.hint.k)) F.hint = { k, sids: F.cand[k] || [F.devil] };
      F.got = got;
      F.max = max;
    }

    /* ================= 뒤집기 ================= */
    async startPick() {
      const S = this.S,
        c = S.cfg,
        F = S.f;
      this.checkHint();
      S.phase = 'pick';
      S.phaseAt = this.net.now();
      F.code = QP.flCode(F.r);
      F.ends = S.phaseAt + QP.ms(c.tChoose);
      S.endsAt = F.ends;
      F.picks = {};
      F.snapAt = S.phaseAt;
      for (const s of this.seatList()) s.dz = 0;
      F.snap = this.predict();
      await this.net.batch(this.seatList().map((s) => ({ path: this.path('players/' + s.num), data: { fz: { r: F.code, d: 0 } }, merge: true })));
      await this.net.update(this.path(), { phase: 'pick', round: S.round, endsAt: S.endsAt, fl: Object.assign(this.pubF(), { got: F.got, max: F.max }) });
      this.log('뒤집기 ' + (F.r + 1) + '라운드');
      this.after(F.ends + QP.ms(c.tWait), () => this.endPick());
      this.save();
      this.emit();
    }
    async endPick() {
      const S = this.S,
        c = S.cfg,
        F = S.f;
      if (S.phase !== 'pick' || this.ending) return;
      this.ending = true;
      clearTimeout(this.dT);
      const cnt = QP.flCount(F.picks);
      let flipped = 0;
      const ops = [];
      F.order.forEach((sid, i) => {
        const s = this.bySid(sid);
        if (!s) return;
        const f = (cnt[i] || 0) % 2 === 1;
        if (f) {
          s.sp = QP.flFlip(s.sp);
          flipped++;
        }
        ops.push({ path: this.path('players/' + s.num), data: { fres: { r: F.code, now: s.sp, flipped: f } }, merge: true });
      });
      const pr = this.predictNow();
      F.last = { flipped, g: pr.g, h: pr.h };
      F.log.push({ r: F.r + 1, flipped, g: pr.g, h: pr.h, ds: pr.ds });
      F.r++;
      for (const s of this.seatList()) s.cblk = 0;
      const over = F.r >= c.R || S.endAfter;
      if (!over) {
        this.prepareNext();
        for (const s of this.seatList()) ops.push({ path: this.path('players/' + s.num), data: this.serveNext(s), merge: true });
      }
      await this.net.batch(ops);
      this.ending = false;
      S.phase = 'fres';
      S.phaseAt = this.net.now();
      S.endsAt = S.phaseAt + QP.ms(c.tResult);
      await this.net.update(this.path(), { phase: 'fres', round: S.round, endsAt: S.endsAt, fl: this.pubF() });
      this.log('뒤집기 결과: ' + flipped + '명 · 도깨비 ' + pr.g + ' : ' + pr.h + ' 인간');
      this.after(S.endsAt, () => (over ? this.finish() : this.startQuestion()));
      this.save();
      this.emit();
    }
    predictNow() {
      const F = this.S.f;
      let g = 0,
        h = 0,
        ds = '';
      for (const sid of F.order) {
        const s = this.bySid(sid);
        if (!s) continue;
        s.sp === 'g' ? g++ : h++;
        if (sid === F.devil) ds = s.sp;
      }
      return { g, h, ds };
    }

    /* ================= 끝 ================= */
    async finish() {
      const S = this.S,
        F = S.f;
      clearTimeout(this.timer);
      clearTimeout(this.dT);
      const rows = (F.order || []).map((sid) => this.bySid(sid)).filter(Boolean).map((s) => ({ sid: s.sid, o: s.o, now: s.sp, devil: s.sid === F.devil }));
      const J = QP.flJudge(rows);
      await this.net.batch(
        J.rows.map((x) => {
          const s = this.bySid(x.sid);
          return { path: this.path('players/' + s.num), data: { fin: { o: x.o, now: x.now, win: x.win, devil: x.devil, nOk: s.nOk, nAns: s.nAns } }, merge: true };
        })
      );
      S.phase = 'end';
      S.endsAt = 0;
      S.endedAt = this.net.now();
      F.end = J;
      await this.net.update(this.path(), { phase: 'end', round: S.round, endsAt: 0, fl: this.pubF(), fend: J });
      this.log('판 끝: 도깨비 ' + J.g + ' : ' + J.h + ' 인간, 이긴 무리 ' + (J.winside || '없음'));
      await this.save();
      this.emit();
    }
    nextOrEnd() {
      this.afterReveal();
    }
    async endNow() {
      if (this.S.phase === 'lobby' || this.S.phase === 'end') return this.finish();
      this.S.endAfter = true;
      this.S.cfg.R = Math.min(this.S.cfg.R, this.S.f.r + 1);
      this.save();
      this.emit();
    }
    resumePhase() {
      const ph = this.S.phase;
      if (ph === 'question') this.startQuestion(true);
      else if (ph === 'reveal') this.afterReveal();
      else if (ph === 'pick') this.after(this.S.f.ends + QP.ms(this.S.cfg.tWait), () => this.endPick());
      else if (ph === 'fres') this.after(this.S.endsAt, () => (this.S.f.r >= this.S.cfg.R ? this.finish() : this.startQuestion()));
    }
    stop() {
      clearTimeout(this.dT);
      super.stop();
    }
    results() {
      const R = super.results();
      const F = this.S.f;
      R.kids.forEach((k) => {
        const s = this.S.seats[k.num];
        if (s) k.flip = (QP.FL_SP[s.o] || '') + '→' + (QP.FL_SP[s.sp] || '') + (s.sid === F.devil ? ' (악마)' : '');
      });
      return R;
    }
  }
  QP.FlipReferee = FlipReferee;
})(typeof window !== 'undefined' ? window : globalThis);
