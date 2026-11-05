/* referee-mafia.js — 「도깨비 찾기」 심판 2판 (작업/담임피드백.md 2026-11-03 「도깨비 찾기 2판」, 수치는 작업/시뮬레이션-마피아2.md 안 나)
 * 자리·접속·이어 하기는 황금 찾기 심판(referee.js)을 그대로 쓰고, 라운드만 다르다.
 *   문제(모두 같은 문제) → 결과(정답 공개·돋보기 나눠 줌·지목권 뽑기 → 돋보기 쓰기·지목) → 투표(맞힌 사람만) → 공개 → … 12문제
 * 2판 규칙: 도깨비끼리 서로 모른다. 탈락 없음. 걸린 도깨비는 착한 시민이 된다(caught = 착해진 도깨비).
 *   맞힌 마을 사람은 mag 확률로 진짜 돋보기, 맞힌 도깨비는 fake 확률로 가짜 돋보기(늘 "도깨비래").
 *   돋보기 결과는 판 문서 rumors 에 소문으로 바로 뜬다(누가 썼는지는 안 넣음).
 * 판 문서(모두 읽음)에는 도깨비가 누구인지 넣지 않는다(끝날 때만). 역할은 각자 자리 문서에만.
 *
 * 판 문서 mp: { gauge, H, hints:[[sid…]], caught:[sid](착해진 도깨비), good:[sid](풀려난 시민), wrong, limit, Q, nOk, magUsed,
 *               rumors:[{r, sid, g}], nom:{by,target}|null, cand, nomBy, rollEnd,
 *               last:{target, pass, goblin, yes, no, n}|null, log:[{r,by,target,pass,goblin}], winner, goblins(끝날 때) }
 * 판 문서 dolls: [{sid, nick, av}] 모든 인형(아이 화면의 판)
 * 판 문서 q: 이번 문제(정답 없이), 결과 때부터 ans·exp
 * 자리 문서(그 아이만): role{g, was?}, res{r, ok, my}, magR{r}(돋보기 받음, 진짜·가짜 표시 없음), magRes{r, sid, g}, nomR{r, at}, voteR{r}, fin
 * 아이가 쓰는 칸: a{r,v} 답, tg{r,sid} 지목(sid '' = 넘기기), mg{r,sid} 돋보기, v{r,y:'Y'|'N'} 투표
 */
(function (root) {
  'use strict';
  const QP = root.QP;

  class MafiaReferee extends QP.Referee {
    defaultCfg() {
      return QP.MAFIA_CFG;
    }
    pubCfg() {
      const c = this.S.cfg;
      return { mode: 'mafia', Q: c.Q, G: c.G, H: c.H, limit: c.limit, tQ: c.tQ, tResult: c.tResult, tVote: c.tVote, tShow: c.tShow, tRoll: c.tRoll, v: 2 };
    }
    afterCreate() {
      this.S.m = { gauge: 0, hintN: 0, hints: [], caught: [], good: [], wrong: 0, usedNom: [], goblins: [], log: [], deck: [], ok: [], nominator: null, nom: null, last: null, magUsed: 0, rumors: [], winner: null };
    }
    extraDoc() {
      return { mp: this.pub(), dolls: [] };
    }
    // 인형 = 동물 7 × 색 4 중 아직 안 쓴 것, 별명 = 「파란 곰」
    newIdentity() {
      const S = this.S;
      const free = [...Array(28).keys()].map(QP.mafiaAvatar).filter((a) => !S.usedAv.includes(a));
      const av = free.length ? this.r.pick(free) : QP.mafiaAvatar(this.r.int(28));
      S.usedAv.push(av);
      return { av, adj: 0, nick: QP.mafiaNick(av) };
    }
    dolls() {
      return this.seatList()
        .sort((a, b) => a.av - b.av)
        .map((s) => ({ sid: s.sid, nick: s.nick, av: s.av }));
    }
    async onJoin(uid, d) {
      await super.onJoin(uid, d);
      // 모든 인형 목록(아이 화면의 판·TV)
      const sig = this.dolls().map((x) => x.sid).join();
      if (sig !== this.dollSig) {
        this.dollSig = sig;
        this.net.update(this.path(), { dolls: this.dolls() });
      }
    }
    async freeSeat(num) {
      await super.freeSeat(num);
      this.net.update(this.path(), { dolls: this.dolls() });
    }
    pub() {
      const m = this.S.m,
        c = this.S.cfg;
      return { gauge: m.gauge, H: c.H, hints: m.hints, caught: m.caught, good: m.good, wrong: m.wrong, limit: c.limit, Q: c.Q, nOk: m.ok.length, magUsed: m.magUsed, rumors: m.rumors || [], nom: m.nom, cand: m.cand || [], nomBy: m.nominator || null, rollEnd: m.rollEnd || 0, last: m.last, log: m.log, winner: this.S.phase === 'end' ? m.winner : null, goblins: this.S.phase === 'end' ? m.goblins : [] }; // 도깨비·승패는 끝날 때만
    }
    // 지금 도깨비인가(걸려서 착해지면 아니다)
    isGob(s) {
      return this.S.m.goblins.includes(s.sid) && !this.S.m.caught.includes(s.sid);
    }
    // 처음에 도깨비였나
    wasGob(s) {
      return this.S.m.goblins.includes(s.sid);
    }
    isCaught(s) {
      return this.S.m.caught.includes(s.sid);
    }

    /* ================= 시작: 도깨비 몰래 정하기 ================= */
    async start() {
      const S = this.S;
      if (S.phase !== 'lobby' || this.seatList().length < 3) return false;
      const seats = this.seatList();
      const G = Math.max(1, Math.min(S.cfg.G, Math.floor(seats.length / 3)));
      const gob = this.r.shuffle(seats.slice()).slice(0, G);
      S.m.goblins = gob.map((s) => s.sid);
      for (const s of seats) s.roleSent = true; // 시작 때 있던 아이는 아래에서 역할을 받는다(늦게 온 아이만 lateRole)
      S.m.deck = QP.Deck.make(S.qs.map((q) => q.id), this.r);
      S.startedAt = this.net.now();
      S.round = 0;
      const ops = seats.map((s) => ({
        path: this.path('players/' + s.num),
        data: { role: { g: S.m.goblins.includes(s.sid) } }, // 2판: 도깨비끼리 서로 모른다
        merge: true,
      }));
      ops.push({ path: this.path(), data: { dolls: this.dolls() }, merge: true });
      await this.net.batch(ops);
      this.startQuestion();
      return true;
    }
    // 판 중에 새로 들어온 아이: 마을 사람
    async lateRole(s) {
      if (this.S.phase !== 'lobby' && !s.roleSent) {
        s.roleSent = true;
        await this.net.update(this.path('players/' + s.num), { role: { g: false } });
      }
    }

    /* ================= 문제 (모두 같은 문제) ================= */
    async startQuestion(resumed) {
      const S = this.S,
        m = S.m;
      if (!resumed) {
        S.round++;
        const ids = S.qs.map((q) => q.id);
        m.cur = { qid: QP.Deck.next(m.deck, ids, this.r), r: S.round };
        m.ok = [];
        m.nominator = null;
        m.cand = [];
        m.rollEnd = 0;
        m.nom = null;
        m.last = null;
        m.magUsed = 0;
        for (const s of this.seatList()) {
          s.ans = null;
          s.ok = 0;
          s.magR = null;
          s.mag = null;
          s.vote = null;
          s.cur = { qid: m.cur.qid, r: S.round };
        }
      }
      const q = this.qmap(m.cur.qid);
      S.phase = 'question';
      S.phaseAt = this.net.now();
      S.endsAt = S.phaseAt + QP.ms(Math.max(S.cfg.tQ, q.time || 0));
      for (const s of this.seatList()) this.lateRole(s);
      await this.net.update(this.path(), { phase: 'question', round: S.round, endsAt: S.endsAt, q: Object.assign({ r: S.round }, QP.serveQ(q, this.r)), mp: this.pub() });
      this.after(S.endsAt + QP.ms(1), () => this.endQuestion());
      this.save();
      this.emit();
    }
    after(t, fn) {
      clearTimeout(this.timer);
      this.timer = setTimeout(fn, Math.max(0, t - this.net.now()));
    }
    onSeat(num, d) {
      if (this.viewOnly || !d) return;
      const S = this.S,
        m = S.m,
        s = S.seats[num];
      if (!s || d.uid !== s.uid) return;
      const sig = JSON.stringify([d.a, d.c, d.tg, d.mg, d.v, d.seen, d.tab]);
      if (sig !== s.sig) {
        s.sig = sig;
        s.last = this.net.now();
      }
      const r = S.round;
      if (S.phase === 'question' && d.a && d.a.r === r && !s.ans) {
        s.ans = { v: d.a.v, t: this.net.now() };
        this.checkAllAnswered();
      }
      if (S.phase === 'result' && s.ok === r) {
        // 돋보기(진짜·가짜): 결과는 TV 소문으로 바로. 가짜는 늘 "도깨비래"
        if (s.magR && !s.mag && d.mg && d.mg.r === r && this.dollOk(d.mg.sid, s)) {
          const t = this.bySid(d.mg.sid);
          s.mag = { r, sid: t.sid, g: s.magR.fake ? true : this.isGob(t) };
          this.net.update(this.path('players/' + num), { magRes: s.mag });
          // TV 소문판에는 "도깨비래"만 올린다(2026-11-05 담임: 너무 많이 뜬다). "아니래"는 쓴 아이 화면에만
          if (s.mag.g) {
            m.rumors.push({ r, sid: t.sid, g: true });
            this.net.update(this.path(), { mp: this.pub() });
          }
          this.save();
        }
        if (m.nominator === s.sid && !m.nom && d.tg && d.tg.r === r) {
          m.nomDone = true;
          if (d.tg.sid && this.dollOk(d.tg.sid, s)) m.nom = { by: s.sid, target: d.tg.sid };
        }
        this.checkResultDone();
      }
      if (S.phase === 'vote' && m.nom && m.voters.includes(s.sid) && !s.vote && d.v && d.v.r === r && (d.v.y === 'Y' || d.v.y === 'N')) {
        s.vote = d.v.y;
        this.checkVoteDone();
      }
      this.emit();
    }
    // 지목·돋보기로 고를 수 있는 인형: 나 아님, 잡힌 도깨비·공개된 착한 친구 아님
    dollOk(sid, me) {
      const m = this.S.m;
      return sid !== me.sid && !!this.bySid(sid) && !m.caught.includes(sid) && !m.good.includes(sid);
    }
    onTick() {
      if (this.viewOnly) return;
      const ph = this.S.phase;
      if (ph === 'question') this.checkAllAnswered();
      if (ph === 'result') this.checkResultDone();
      if (ph === 'vote') this.checkVoteDone();
      this.emit();
    }
    checkAllAnswered() {
      const S = this.S;
      if (S.phase !== 'question' || this.ending) return;
      const act = this.seatList().filter((s) => s.cur && s.cur.r === S.round && this.alive(s));
      if (act.length && act.every((s) => s.ans)) this.endQuestion();
    }
    async endQuestion() {
      const S = this.S,
        m = S.m;
      if (S.phase !== 'question' || this.ending) return;
      this.ending = true;
      clearTimeout(this.timer);
      const q = this.qmap(m.cur.qid);
      const st = (S.qstats[q.id] = S.qstats[q.id] || { n: 0, ok: 0 });
      const ops = [];
      const okList = [];
      const mine = {};
      for (const s of this.seatList()) {
        if (!s.cur || s.cur.r !== S.round) continue;
        const ok = !!s.ans && QP.isRight(q, s.ans.v);
        st.n++;
        if (s.ans) s.nAns++;
        s.hist.push([q.id, ok ? 1 : s.ans ? 0 : -1]);
        if (ok) {
          st.ok++;
          s.nOk++;
          s.ok = S.round;
          okList.push(s);
        }
        // 한 아이에게 쓰는 것은 한 번에(결과·돋보기·지목권을 같은 쓰기에 모은다)
        mine[s.num] = { res: { r: S.round, ok, my: s.ans ? QP.expandAns(q, s.ans.v) : null } };
        ops.push({ path: this.path('players/' + s.num), data: mine[s.num], merge: true });
      }
      // 빠른 순서(서버가 답을 받은 시각)
      okList.sort((a, b) => a.ans.t - b.ans.t);
      m.ok = okList.map((s) => s.sid);
      // 힌트 게이지: 모두의 정답(도깨비 것도)
      m.gauge += okList.length;
      while (m.gauge >= S.cfg.H) {
        m.gauge -= S.cfg.H;
        this.makeHint();
      }
      // 돋보기: 맞힌 마을 사람(착해진 도깨비도)은 mag, 맞힌 도깨비는 fake 확률. 아이 화면은 똑같이 「돋보기!」
      m.magUsed = 0;
      for (const s of okList) {
        const fake = this.isGob(s);
        if (this.r() >= (fake ? S.cfg.fake || 0 : S.cfg.mag)) continue;
        s.magR = { r: S.round, fake };
        m.magUsed++;
        mine[s.num].magR = { r: S.round };
      }
      // 지목권: 맞힌 사람 중 아직 지목하지 않은 사람을 빠른 순서로 5명 → 그중 1명(탈락 없음: 착해진 도깨비도)
      const cand = okList.filter((s) => !m.usedNom.includes(s.sid)).slice(0, 5);
      m.nominator = cand.length ? this.r.pick(cand).sid : null;
      m.cand = cand.map((s) => s.sid); // TV: 후보 5명 위로 빛이 딴딴딴…딴!
      m.nomDone = !m.nominator;
      S.phaseAt = this.net.now();
      // 지목권 뽑기 동안은 아무도 지목할 수 없다(뽑힌 아이 화면도 빛이 멈춘 뒤에 열린다)
      m.rollEnd = m.nominator ? S.phaseAt + QP.ms(S.cfg.tRoll || 0) : 0;
      if (m.nominator) {
        m.usedNom.push(m.nominator);
        const s = this.bySid(m.nominator);
        mine[s.num].nomR = { r: S.round, at: m.rollEnd };
      }
      await this.net.batch(ops);
      S.phase = 'result';
      S.endsAt = S.phaseAt + QP.ms(S.cfg.tResult + (m.nominator ? S.cfg.tRoll || 0 : 0));
      await this.net.update(this.path(), { phase: 'result', round: S.round, endsAt: S.endsAt, q: Object.assign({ r: S.round }, QP.serveQ(q, this.r), { ans: QP.answerText(q), exp: q.explain || '' }), mp: this.pub() });
      this.ending = false;
      this.after(S.endsAt + QP.ms(0.5), () => this.endResult());
      this.save();
      this.emit();
    }
    // 힌트: 아직 안 잡힌 도깨비가 꼭 하나 이상 든 무리(늘 참). 갈수록 좁게, 앞 힌트와 겹치게
    makeHint() {
      const S = this.S,
        m = S.m,
        r = this.r;
      const k = S.cfg.groups[Math.min(m.hintN, S.cfg.groups.length - 1)];
      m.hintN++;
      const left = m.goblins.filter((g) => !m.caught.includes(g));
      if (!left.length) return;
      const prev = m.hints.length ? m.hints[m.hints.length - 1] : [];
      const inPrev = left.filter((g) => prev.includes(g));
      const g0 = r.pick(inPrev.length ? inPrev : left);
      const grp = [g0];
      const pool = this.seatList()
        .map((s) => s.sid)
        .filter((x) => x !== g0 && !m.caught.includes(x) && !m.good.includes(x));
      const fromPrev = r.shuffle(pool.filter((x) => prev.includes(x)));
      const others = r.shuffle(pool.filter((x) => !prev.includes(x)));
      for (let c = 0; c < Math.floor((k - 1) / 2) && fromPrev.length; c++) grp.push(fromPrev.pop());
      while (grp.length < k && (others.length || fromPrev.length)) grp.push((others.length ? others : fromPrev).pop());
      m.hints.push(r.shuffle(grp));
    }
    checkResultDone() {
      const S = this.S,
        m = S.m;
      if (S.phase !== 'result' || this.ending) return;
      const okAlive = m.ok.map((sid) => this.bySid(sid)).filter((s) => s && this.alive(s));
      const boxes = okAlive.every((s) => !s.magR || s.mag); // 돋보기를 받은 아이가 다 썼는지
      if (m.rollEnd && this.net.now() < m.rollEnd + QP.ms(1.5)) return; // 뽑힌 아이가 기뻐하는 모습까지 보여 준다
      if (boxes && m.nomDone) this.endResult();
    }
    async endResult() {
      const S = this.S,
        m = S.m;
      if (S.phase !== 'result' || this.ending) return;
      clearTimeout(this.timer);
      if (!m.nom) return this.nextOrEnd(); // 지목이 없으면 다음 문제
      this.ending = true;
      // 투표권: 이번 문제를 맞힌 사람(지목된 사람 빼고). 탈락 없음
      m.voters = m.ok.filter((sid) => sid !== m.nom.target);
      const ops = m.voters.map((sid) => ({ path: this.path('players/' + this.bySid(sid).num), data: { voteR: { r: S.round } }, merge: true }));
      await this.net.batch(ops);
      S.phase = 'vote';
      S.phaseAt = this.net.now();
      S.endsAt = S.phaseAt + QP.ms(S.cfg.tVote);
      await this.net.update(this.path(), { phase: 'vote', round: S.round, endsAt: S.endsAt, mp: this.pub() });
      this.ending = false;
      this.after(S.endsAt + QP.ms(0.5), () => this.endVote());
      this.save();
      this.emit();
    }
    checkVoteDone() {
      const S = this.S,
        m = S.m;
      if (S.phase !== 'vote' || this.ending) return;
      const act = m.voters.map((sid) => this.bySid(sid)).filter((s) => s && this.alive(s));
      if (act.every((s) => s.vote)) this.endVote();
    }
    async endVote() {
      const S = this.S,
        m = S.m;
      if (S.phase !== 'vote' || this.ending) return;
      this.ending = true;
      clearTimeout(this.timer);
      const vs = m.voters.map((sid) => this.bySid(sid)).filter(Boolean);
      const yes = vs.filter((s) => s.vote === 'Y').length,
        no = vs.filter((s) => s.vote === 'N').length,
        n = vs.length;
      const pass = yes * 2 > n; // 찬성이 투표권 있는 사람의 절반을 넘으면
      const t = m.nom.target;
      const goblin = pass ? m.goblins.includes(t) : null;
      if (pass) {
        if (goblin) {
          m.caught.push(t); // 걸린 도깨비는 착한 시민이 된다
          const cs = this.bySid(t);
          if (cs) this.net.update(this.path('players/' + cs.num), { role: { g: false, was: true } });
        } else {
          m.good.push(t);
          m.wrong++;
        }
      }
      m.last = { target: t, by: m.nom.by, pass, goblin, yes, no, n };
      m.log.push({ r: S.round, by: m.nom.by, target: t, pass, goblin, yes, n });
      if (m.caught.length === m.goblins.length) m.winner = 'village';
      else if (m.wrong >= S.cfg.limit) m.winner = 'goblin';
      S.phase = 'show';
      S.phaseAt = this.net.now();
      S.endsAt = S.phaseAt + QP.ms(S.cfg.tShow);
      await this.net.update(this.path(), { phase: 'show', round: S.round, endsAt: S.endsAt, mp: this.pub() });
      this.ending = false;
      this.log(S.round + '번 투표: ' + (pass ? (goblin ? '도깨비 잡음' : '착한 친구') : '부결'));
      this.after(S.endsAt, () => this.nextOrEnd());
      this.save();
      this.emit();
    }
    nextOrEnd() {
      const S = this.S,
        m = S.m;
      if (m.winner || S.round >= S.cfg.Q || S.endEarly) {
        if (!m.winner) m.winner = m.caught.length === m.goblins.length ? 'village' : 'goblin';
        return this.finish();
      }
      this.startQuestion();
    }
    async finish() {
      const S = this.S,
        m = S.m;
      S.phase = 'end';
      S.endsAt = 0;
      S.endedAt = this.net.now();
      clearTimeout(this.timer);
      const ops = this.seatList().map((s) => ({ path: this.path('players/' + s.num), data: { fin: { g: this.wasGob(s), caught: this.isCaught(s), winner: m.winner, nOk: s.nOk, nAns: s.nAns, n: S.round } }, merge: true }));
      await this.net.batch(ops);
      await this.net.update(this.path(), { phase: 'end', round: S.round, endsAt: 0, mp: this.pub() });
      this.log('판 끝: ' + (m.winner === 'village' ? '마을 승' : '도깨비 승'));
      await this.save();
      this.emit();
    }
    async endNow() {
      const S = this.S;
      if (S.phase === 'lobby' || S.phase === 'end') return this.finish();
      S.endEarly = true; // 이번 문제 공개 뒤 끝
      this.save();
      this.emit();
    }
    resumePhase() {
      const ph = this.S.phase;
      if (ph === 'question') this.startQuestion(true);
      else if (ph === 'result') {
        this.S.endsAt = this.net.now() + QP.ms(this.S.cfg.tResult);
        this.after(this.S.endsAt, () => this.endResult());
      } else if (ph === 'vote') {
        this.S.endsAt = this.net.now() + QP.ms(this.S.cfg.tVote);
        this.after(this.S.endsAt, () => this.endVote());
      } else if (ph === 'show') this.nextOrEnd();
    }
    results() {
      const R = super.results();
      const m = this.S.m;
      R.mafia = { winner: m.winner, goblins: m.goblins.map((sid) => this.bySid(sid)).filter(Boolean).map((s) => s.num + '번 ' + s.nick + (m.caught.includes(s.sid) ? '(착해짐)' : '(숨음)')), log: m.log };
      for (const k of R.kids) k.rank = '';
      return R;
    }
  }
  QP.MafiaReferee = MafiaReferee;
})(typeof window !== 'undefined' ? window : globalThis);
