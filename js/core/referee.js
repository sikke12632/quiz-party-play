/* referee.js — 심판(선생님 화면). 자리 주인을 정하고, 라운드 시계를 쥐고, 채점·상자·금 계산을 한다.
 * 화면 코드 없음: 선생님 화면(teacher-ui.js)과 node 봇 시험(tools/bots.mjs)이 같이 쓴다.
 *
 * 서버 모양 (작업/결정-시간과-접속.md 2-7)
 *   qp_games/{gid}                 판 문서(선생님만 씀, 모두 읽음. 출석 번호 없음)
 *       code, owner, refTab, phase('lobby'|'question'|'chest'|'reveal'|'end'), round, endsAt, cfg, board[], ev, test
 *   qp_games/{gid}/joins/{uid}     "○번 자리에 앉고 싶어요" (아이: num, tab, at) → 선생님 답 (res, rat)
 *   qp_games/{gid}/players/{num}   자리. 선생님: uid sid nick av gold rank q res open rev fin
 *                                  아이(자리 주인만): a(답) c(상자) tg(대상) seen(숨쉬기) tab(탭 주인)
 *   qp_games/{gid}/private/state   선생님만: 자리·금·문제 순서·문제별 정답률 (선생님 화면이 다시 열리면 여기서 이어 간다)
 */
(function (root) {
  'use strict';
  const QP = root.QP;
  const G = 'qp_games/';

  class Referee {
    constructor(net, gid, opts) {
      opts = opts || {};
      this.net = net;
      this.gid = gid;
      this.tab = opts.tab || QP.id(6);
      this.onUpdate = opts.onUpdate || (() => {});
      this.log = opts.log || (() => {});
      this.alerts = []; // {num, uid, at}: 살아 있는 자리에 다른 기기가 들어오려 함
      this.unsubs = [];
      this.timer = null;
      this.viewOnly = false;
    }
    path(sub) {
      return G + this.gid + (sub ? '/' + sub : '');
    }

    /* ================= 판 만들기 / 이어 하기 ================= */
    static async create(net, { cfg, packs, seed, tab, onUpdate, log, label, step }) {
      step = step || (() => {});
      step('옛 판 찾기');
      const all = await net.find('qp_games', 'owner', net.uid);
      let code;
      for (let k = 0; k < 50; k++) {
        code = String(1000 + Math.floor(Math.random() * 9000));
        const same = await net.find('qp_games', 'code', code);
        if (!same.some((d) => d.data.phase !== 'end')) break;
      }
      // 이 선생님의 끝나지 않은 옛 판은 닫는다
      step('옛 판 닫기');
      for (const d of all) if (d.data.phase !== 'end') await net.update(G + d.id, { phase: 'end', closed: true });
      const gid = QP.id(10);
      const ref = new Referee(net, gid, { tab, onUpdate, log });
      cfg = Object.assign({}, QP.DEFAULT_CFG, cfg || {});
      seed = seed || Math.floor(Math.random() * 1e9);
      const qs = QP.flatten(packs);
      ref.S = {
        code,
        cfg,
        seed,
        qs,
        test: packs.some((p) => p.test),
        packTitles: packs.map((p) => p.title),
        range: label || '', // 고른 출제 범위 한 줄(TV·결과표에 적는다)
        phase: 'lobby',
        round: 0,
        seats: {},
        qstats: {},
        usedAv: [],
        usedAdj: [],
        startedAt: 0,
        endsAt: 0,
        createdAt: net.now(),
      };
      ref.r = QP.rng(seed);
      step('서버에 판 쓰기');
      await net.set(G + gid, { code, owner: net.uid, refTab: ref.tab, phase: 'lobby', round: 0, endsAt: 0, cfg: ref.pubCfg(), board: [], ev: null, test: ref.S.test, packs: ref.S.packTitles, range: ref.S.range, at: net.now() });
      step('판 저장하기');
      await ref.save();
      step('연결하기');
      ref.listen();
      return ref;
    }
    static async resume(net, gid, opts) {
      const ref = new Referee(net, gid, opts);
      const st = await net.get(ref.path('private/state'));
      if (!st) throw new Error('판을 찾을 수 없어요');
      ref.S = st;
      ref.r = QP.rng(st.seed + st.round * 7919 + 1);
      for (const s of Object.values(ref.S.seats)) s.last = 0; // 다시 소식이 올 때까지 끊긴 것으로 본다
      await net.update(ref.path(), { refTab: ref.tab });
      ref.listen();
      // 하던 단계부터 다시
      const ph = ref.S.phase;
      if (ph === 'question') ref.startQuestion(true);
      else if (ph === 'chest') ref.startChest(true);
      else if (ph === 'reveal') ref.nextOrEnd();
      ref.emit();
      return ref;
    }
    pubCfg() {
      const c = this.S.cfg;
      return { minutes: c.minutes, tQ: c.tQ, tChest: c.tChest, tReveal: c.tReveal, base: c.base, fastOn: c.fastOn, fast: c.fast, streakOn: c.streakOn, streak: c.streak };
    }
    async save() {
      const S = Object.assign({}, this.S);
      await this.net.set(this.path('private/state'), JSON.parse(JSON.stringify(S, (k, v) => (k === 'last' ? undefined : v))));
    }
    listen() {
      const n = this.net;
      this.unsubs.push(n.onCol(this.path('joins'), (list) => list.forEach((d) => this.onJoin(d.id, d.data))));
      this.unsubs.push(n.onCol(this.path('players'), (list) => list.forEach((d) => this.onSeat(+d.id, d.data))));
      // 선생님 탭은 하나만 심판이 된다(가장 나중에 연 탭)
      this.unsubs.push(
        n.onDoc(this.path(), (g) => {
          if (g && g.refTab && g.refTab !== this.tab && !this.viewOnly) {
            this.viewOnly = true;
            this.stop();
            this.log('다른 탭이 심판을 맡았어요');
            this.emit();
          }
        })
      );
      this.tick = setInterval(() => this.onTick(), 500);
    }
    stop() {
      this.unsubs.forEach((u) => u());
      this.unsubs = [];
      clearInterval(this.tick);
      clearTimeout(this.timer);
    }
    emit() {
      this.onUpdate(this);
    }
    alive(s) {
      return s && s.uid && this.net.now() - (s.last || 0) < QP.ms(QP.STALE);
    }
    seatList() {
      return Object.values(this.S.seats);
    }
    bySid(sid) {
      return this.seatList().find((s) => s.sid === sid);
    }

    /* ================= 자리 (작업/결정-시간과-접속.md 2-2) ================= */
    newIdentity() {
      const S = this.S;
      let av = 0;
      while (S.usedAv.includes(av)) av++;
      const freeAdj = [...Array(30).keys()].filter((k) => !S.usedAdj.includes(k));
      const adj = freeAdj.length ? this.r.pick(freeAdj) : this.r.int(30);
      // 아바타 번호도 섞는다(들어온 순서대로 곰·토끼·…가 되지 않게)
      const freeAv = [...Array(56).keys()].filter((k) => !S.usedAv.includes(k));
      av = freeAv.length > 28 ? this.r.pick(freeAv.slice(0, 28)) : freeAv[0];
      S.usedAv.push(av);
      S.usedAdj.push(adj);
      return { av, adj, nick: root.JK && root.JK.nickname ? root.JK.nickname(av, adj) : QP.nickname(av, adj) };
    }
    seatDoc(s) {
      return { uid: s.uid, sid: s.sid, nick: s.nick, av: s.av, gold: s.gold, rank: s.rank || 0 };
    }
    async onJoin(uid, d) {
      if (this.viewOnly || !d || d.rat === d.at || this.busyJoin === uid + d.at) return;
      this.busyJoin = uid + d.at;
      const S = this.S,
        num = d.num,
        now = this.net.now();
      const reply = (res) => this.net.update(this.path('joins/' + uid), { res, rat: d.at });
      if (!QP.okNum(num)) return reply('bad');
      // 이 기기가 이미 다른 자리에 있으면: 모이는 곳에서는 옮겨 주고, 판 중에는 원래 자리로
      const mine = this.seatList().find((s) => s.uid === uid && s.num !== num);
      if (mine) {
        if (S.phase === 'lobby') this.freeSeat(mine.num);
        else return this.net.update(this.path('joins/' + uid), { res: 'have', rat: d.at, num: mine.num });
      }
      let s = S.seats[num];
      if (!s) {
        const id = this.newIdentity();
        s = S.seats[num] = { num, uid, sid: QP.id(6), nick: id.nick, av: id.av, adj: id.adj, gold: 0, streak: 0, nAns: 0, nOk: 0, deck: [], last: now, joinedRound: S.round + 1, shield: 0, prevRank: 0, hist: [] };
        this.log(num + '번 들어옴: ' + s.nick);
      } else if (s.uid === uid) {
        s.last = now; // 새로 고침·다시 열기: 그대로 이어서
      } else if (!this.alive(s)) {
        this.log(num + '번 다른 기기로 넘겨받음');
        s.uid = uid; // 끊긴 기기 → 새 기기가 넘겨받는다(금·별명 그대로)
        s.last = now;
      } else {
        if (!this.alerts.some((a) => a.num === num && a.uid === uid)) this.alerts.push({ num, uid, at: now });
        this.emit();
        return reply('busy');
      }
      this.alerts = this.alerts.filter((a) => !(a.num === num && a.uid === uid));
      const doc = this.seatDoc(s);
      // 판 중에 들어왔고 다음 라운드 문제가 이미 나갔으면 이 아이 것도 만든다
      if (S.phase === 'reveal' && S.nextQ) Object.assign(doc, this.serveNext(s));
      await this.net.update(this.path('players/' + num), doc);
      await reply('ok');
      this.saveSoon();
      this.emit();
    }
    // 선생님: 살아 있는 자리를 새 기기에 넘겨주기 / 알림 무시 / 자리 비우기
    async handOver(num, uid) {
      const s = this.S.seats[num];
      if (!s) return;
      s.uid = uid;
      s.last = this.net.now();
      this.alerts = this.alerts.filter((a) => a.num !== num);
      await this.net.update(this.path('players/' + num), this.seatDoc(s));
      const j = await this.net.get(this.path('joins/' + uid));
      if (j) await this.net.update(this.path('joins/' + uid), { res: 'ok', rat: j.at });
      this.emit();
    }
    dismissAlert(num, uid) {
      this.alerts = this.alerts.filter((a) => !(a.num === num && a.uid === uid));
      this.emit();
    }
    async freeSeat(num) {
      const s = this.S.seats[num];
      if (!s) return;
      delete this.S.seats[num];
      this.S.usedAv = this.S.usedAv.filter((a) => a !== s.av);
      this.S.usedAdj = this.S.usedAdj.filter((a) => a !== s.adj);
      await this.net.del(this.path('players/' + num));
      this.emit();
    }
    saveSoon() {
      clearTimeout(this.saveT);
      this.saveT = setTimeout(() => this.save(), 1500);
    }

    /* ================= 아이가 쓴 것 받기 ================= */
    onSeat(num, d) {
      if (this.viewOnly || !d) return;
      const S = this.S,
        s = S.seats[num];
      if (!s || d.uid !== s.uid) return;
      const sig = JSON.stringify([d.a, d.c, d.tg, d.seen, d.tab]);
      if (sig !== s.sig) {
        s.sig = sig;
        s.last = this.net.now();
      }
      const r = S.round;
      if (S.phase === 'question' && d.a && d.a.r === r && s.cur && s.cur.r === r && !s.ans) {
        s.ans = { v: d.a.v, secs: (this.net.now() - S.phaseAt) / QP.ms(1) };
        this.checkAllAnswered();
      }
      if (S.phase === 'chest' && s.ok === r) {
        // 선생님 화면이 다시 열렸을 때: 이미 연 상자는 자리 문서에서 되살린다
        if (!s.open && d.open && d.open.r === r) this.restoreOpen(s, d.open);
        if (!s.open && d.c && d.c.r === r) this.openChest(s);
        if (s.open && s.open.need && !s.open.target && d.tg && d.tg.r === r && s.open.targets.includes(d.tg.sid)) {
          s.open.target = d.tg.sid;
          s.open.at = this.net.now();
          this.checkChestDone();
        }
      }
      this.emit();
    }
    onTick() {
      if (this.viewOnly) return;
      const S = this.S;
      if (S.phase === 'question') this.checkAllAnswered();
      if (S.phase === 'chest') this.checkChestDone();
      this.emit();
    }

    /* ================= 판 진행 ================= */
    async start() {
      const S = this.S;
      if (S.phase !== 'lobby' || !this.seatList().length) return false;
      S.startedAt = this.net.now();
      S.round = 0;
      this.prepareNext();
      const ops = this.seatList().map((s) => ({ path: this.path('players/' + s.num), data: this.serveNext(s), merge: true }));
      await this.net.batch(ops);
      this.startQuestion();
      return true;
    }
    // 다음 라운드 문제를 아이마다 정한다
    prepareNext() {
      const S = this.S;
      const ids = S.qs.map((q) => q.id);
      S.nextQ = {};
      for (const s of this.seatList()) {
        if (!s.deck || !s.deck.length) s.deck = QP.Deck.make(ids, this.r);
        S.nextQ[s.num] = QP.Deck.next(s.deck, ids, this.r);
      }
    }
    serveNext(s) {
      const S = this.S;
      if (!S.nextQ[s.num]) {
        const ids = S.qs.map((q) => q.id);
        if (!s.deck || !s.deck.length) s.deck = QP.Deck.make(ids, this.r);
        S.nextQ[s.num] = QP.Deck.next(s.deck, ids, this.r);
      }
      const q = S.qs.find((x) => x.id === S.nextQ[s.num]);
      s.cur = { qid: q.id, r: S.round + 1 };
      return { q: Object.assign({ r: S.round + 1 }, QP.serveQ(q, this.r)) };
    }
    qmap(id) {
      return this.S.qs.find((x) => x.id === id);
    }
    async startQuestion(resumed) {
      const S = this.S;
      if (!resumed) S.round++;
      S.phase = 'question';
      S.phaseAt = this.net.now();
      let dur = S.cfg.tQ;
      for (const s of this.seatList()) {
        if (!resumed) {
          s.ans = null;
          s.ok = 0;
          s.open = null;
          s.notes = [];
          s.goldAtStart = s.gold;
        }
        if (s.cur && s.cur.r === S.round) dur = Math.max(dur, (this.qmap(s.cur.qid).time || 0));
      }
      S.endsAt = S.phaseAt + QP.ms(dur);
      this.log(S.round + '라운드 문제');
      await this.net.update(this.path(), { phase: 'question', round: S.round, endsAt: S.endsAt, ev: null });
      clearTimeout(this.timer);
      this.timer = setTimeout(() => this.endQuestion(), S.endsAt - this.net.now() + QP.ms(1)); // 1초 여유
      this.save();
      this.emit();
    }
    checkAllAnswered() {
      const S = this.S;
      if (S.phase !== 'question' || this.ending) return;
      const act = this.seatList().filter((s) => s.cur && s.cur.r === S.round && this.alive(s));
      if (act.length && act.every((s) => s.ans)) this.endQuestion();
      else if (!act.length && this.net.now() > S.phaseAt + QP.ms(3)) this.endQuestion(); // 모두 끊김
    }
    async endQuestion() {
      const S = this.S;
      if (S.phase !== 'question' || this.ending) return;
      this.ending = true;
      clearTimeout(this.timer);
      const ops = [];
      for (const s of this.seatList()) {
        if (!s.cur || s.cur.r !== S.round) continue;
        const q = this.qmap(s.cur.qid);
        const ok = !!s.ans && QP.isRight(q, s.ans.v);
        const st = (S.qstats[q.id] = S.qstats[q.id] || { n: 0, ok: 0 });
        st.n++;
        if (s.ans) s.nAns++;
        s.hist.push([q.id, ok ? 1 : s.ans ? 0 : -1]);
        let gain = null;
        if (ok) {
          st.ok++;
          s.nOk++;
          s.streak++;
          gain = QP.answerBonus(S.cfg, s.ans.secs, s.streak, S.round);
          s.gold += gain.base + gain.fast + gain.streak;
          s.ok = S.round;
        } else {
          s.streak = 0;
          QP.Deck.retry(s.deck, q.id);
        }
        const res = { r: S.round, ok, my: s.ans ? s.ans.v : null, ans: QP.answerText(q), exp: q.explain || '', gain, streak: s.streak, gold: s.gold };
        ops.push({ path: this.path('players/' + s.num), data: { res, gold: s.gold }, merge: true });
      }
      S.board = this.makeBoard();
      await this.net.batch(ops);
      this.ending = false;
      if (this.seatList().some((s) => s.ok === S.round)) this.startChest();
      else this.reveal();
    }
    makeBoard() {
      const list = QP.rankSeats(this.seatList());
      const golds = list.map((s) => s.gold);
      return list.map((s) => ({ sid: s.sid, nick: s.nick, av: s.av, gold: s.gold, rank: QP.rankOfGold(s.gold, golds) }));
    }
    async startChest(resumed) {
      const S = this.S;
      S.phase = 'chest';
      S.phaseAt = this.net.now();
      S.endsAt = S.phaseAt + QP.ms(S.cfg.tChest);
      if (resumed) for (const s of this.seatList()) s.open = null;
      await this.net.update(this.path(), { phase: 'chest', round: S.round, endsAt: S.endsAt, board: S.board });
      clearTimeout(this.timer);
      this.timer = setTimeout(() => this.endChest(), S.endsAt - this.net.now() + QP.ms(0.8));
      this.save();
      this.emit();
    }
    openChest(s, auto) {
      const S = this.S,
        r = this.r;
      const kind = QP.drawKind(r);
      const o = { r: S.round, kind, at: this.net.now() };
      if (kind === 'gain') o.amt = QP.gainAmount(r, S.round, S.cfg);
      else if (kind === 'double') o.amt = QP.doubleAmount(s.gold);
      else if (kind === 'stealPick' || kind === 'swapPick') {
        o.targets = kind === 'stealPick' ? QP.stealTargets(S.board, s.sid) : QP.swapTargets(S.board, s.sid);
        o.need = o.targets.length > 0;
        if (!o.need) o.kind = 'none';
      } else if (kind === 'stealRand' || kind === 'swapRand') {
        const t = kind === 'stealRand' ? QP.stealTargets(S.board, s.sid) : QP.swapTargets(S.board, s.sid);
        if (t.length) o.target = r.pick(t);
        else o.kind = 'none';
      }
      if (o.amt) s.gold += o.amt;
      if (o.kind === 'shield') s.shield = 1;
      o.auto = !!auto;
      s.open = o;
      const pub = { r: o.r, kind: o.kind, amt: o.amt || 0, gold: s.gold };
      if (o.targets) pub.targets = o.targets;
      if (o.target) pub.target = o.target;
      this.net.update(this.path('players/' + s.num), { open: pub, gold: s.gold });
      this.checkChestDone();
    }
    restoreOpen(s, pub) {
      const o = Object.assign({}, pub, { at: this.net.now() });
      if (o.kind === 'gain' || o.kind === 'double') s.gold = pub.gold;
      if (o.kind === 'shield') s.shield = 1;
      if (o.targets) o.need = true;
      s.open = o;
    }
    checkChestDone() {
      const S = this.S;
      if (S.phase !== 'chest' || this.ending) return;
      const act = this.seatList().filter((s) => s.ok === S.round && this.alive(s));
      if (act.every((s) => s.open && (!s.open.need || s.open.target))) this.endChest();
    }
    async endChest() {
      const S = this.S;
      if (S.phase !== 'chest' || this.ending) return;
      this.ending = true;
      clearTimeout(this.timer);
      const players = this.seatList().filter((s) => s.ok === S.round);
      for (const s of players) {
        if (!s.open) this.openChest(s, true); // 안 고르면 무작위 상자
        if (s.open.need && !s.open.target) {
          s.open.target = this.r.pick(s.open.targets); // 대상을 못 고르면 무작위
          s.open.autoTarget = true;
        }
      }
      // 뺏기·바꾸기는 고른 차례대로
      const acts = players.filter((s) => s.open.target).sort((a, b) => a.open.at - b.open.at);
      for (const s of acts) {
        const v = this.bySid(s.open.target);
        if (!v) continue;
        const kind = s.open.kind;
        const steal = kind === 'stealPick' || kind === 'stealRand';
        if (v.shield > 0) {
          v.shield = 0;
          s.notes.push({ k: 'blocked', who: v.nick });
          v.notes.push({ k: 'shielded', who: s.nick });
          continue;
        }
        if (steal) {
          const amt = QP.stealAmount(v.gold);
          v.gold -= amt;
          s.gold += amt;
          s.notes.push({ k: 'stole', who: v.nick, amt, auto: !!s.open.autoTarget });
          v.notes.push({ k: 'robbed', who: s.nick, amt });
        } else {
          const a = s.gold,
            b = v.gold;
          s.gold = b;
          v.gold = a;
          s.notes.push({ k: 'swapped', who: v.nick, from: a, to: b, auto: !!s.open.autoTarget });
          v.notes.push({ k: 'swappedBy', who: s.nick, from: b, to: a });
        }
      }
      this.ending = false;
      this.reveal();
    }
    // 결과 발표: 순위·바뀜·알림. 판이 안 끝났으면 다음 라운드 문제도 같이 보낸다
    async reveal() {
      const S = this.S;
      const ranked = QP.rankSeats(this.seatList());
      const golds = ranked.map((s) => s.gold);
      // 단상 = 금이 0보다 많은 아이 중 앞의 5명
      const prevTop = (S.prevBoard || []).slice(0, QP.PODIUM);
      const prevLead = prevTop[0];
      const top = ranked.filter((s) => s.gold > 0).slice(0, QP.PODIUM).map((s) => s.sid);
      const board = ranked.map((s) => {
        const was = s.prevRank || 0;
        const rank = QP.rankOfGold(s.gold, golds);
        let mv = 0;
        if (was && rank && was !== rank) mv = was - rank;
        const isNew = top.includes(s.sid) && !prevTop.includes(s.sid) && S.round > 1;
        s.rank = rank;
        return { sid: s.sid, nick: s.nick, av: s.av, gold: s.gold, rank, mv, nw: isNew ? 1 : 0 };
      });
      const ev = { lead: top[0] && top[0] !== prevLead && S.round > 0 ? top[0] : null, out: prevTop.filter((sid) => !top.includes(sid)) };
      for (const s of ranked) s.prevRank = s.rank;
      S.prevBoard = top;
      S.board = board;
      const over = this.net.now() - S.startedAt >= QP.ms(S.cfg.minutes * 60);
      if (!over) this.prepareNext();
      const ops = [];
      for (const s of ranked) {
        const rev = { r: S.round, gold: s.gold, rank: s.rank, delta: s.gold - (s.goldAtStart || 0), notes: s.notes || [], n: ranked.length };
        const data = { rev, gold: s.gold, rank: s.rank };
        if (over) data.fin = { rank: s.rank, gold: s.gold, nOk: s.nOk, nAns: s.nAns, n: ranked.length };
        else Object.assign(data, this.serveNext(s));
        ops.push({ path: this.path('players/' + s.num), data, merge: true });
      }
      await this.net.batch(ops);
      if (over) return this.finish(board, ev);
      S.phase = 'reveal';
      S.phaseAt = this.net.now();
      S.endsAt = S.phaseAt + QP.ms(S.cfg.tReveal);
      await this.net.update(this.path(), { phase: 'reveal', round: S.round, endsAt: S.endsAt, board, ev });
      this.log(S.round + '라운드 발표: 1등 ' + (board[0] && board[0].nick));
      clearTimeout(this.timer);
      this.timer = setTimeout(() => this.startQuestion(), S.endsAt - this.net.now());
      this.save();
      this.emit();
    }
    nextOrEnd() {
      const S = this.S;
      if (this.net.now() - S.startedAt >= QP.ms(S.cfg.minutes * 60)) this.finish(S.board, null);
      else this.startQuestion();
    }
    async finish(board, ev) {
      const S = this.S;
      S.phase = 'end';
      S.endsAt = 0;
      S.endedAt = this.net.now();
      clearTimeout(this.timer);
      await this.net.update(this.path(), { phase: 'end', round: S.round, endsAt: 0, board, ev });
      this.log('판 끝');
      await this.save();
      this.emit();
    }
    // 선생님이 일찍 끝내기
    async endNow() {
      if (this.S.phase === 'lobby' || this.S.phase === 'end') return this.finish(this.makeBoard(), null);
      this.S.cfg.minutes = 0; // 이번 라운드 발표 뒤 끝
    }

    /* ================= 선생님 결과표 ================= */
    results() {
      const S = this.S;
      const qs = S.qs.filter((q) => S.qstats[q.id]).map((q) => ({ id: q.id, pack: q.pack, q: q.q, ans: QP.answerText(q), n: S.qstats[q.id].n, ok: S.qstats[q.id].ok, rate: S.qstats[q.id].ok / S.qstats[q.id].n }));
      qs.sort((a, b) => a.rate - b.rate);
      const kids = this.seatList()
        .sort((a, b) => a.num - b.num)
        .map((s) => ({ num: s.num, nick: s.nick, rank: s.rank || '', gold: s.gold, served: s.hist.length, nAns: s.nAns, nOk: s.nOk, wrong: s.hist.filter((h) => h[1] !== 1).map((h) => h[0]) }));
      return { qs, kids, rounds: S.round, packs: S.packTitles, range: S.range };
    }
    resultsCSV() {
      const R = this.results();
      const esc = (v) => '"' + String(v).replace(/"/g, '""') + '"';
      const lines = [esc('출제 범위: ' + (R.range || R.packs.join(', '))), '', '번호,별명,등수,금,나온 문제,낸 답,맞힌 수,정답률'];
      for (const k of R.kids) lines.push([k.num, esc(k.nick), k.rank, k.gold, k.served, k.nAns, k.nOk, k.served ? Math.round((k.nOk / k.served) * 100) + '%' : ''].join(','));
      lines.push('', '문제,정답,나온 수,맞힌 수,정답률,묶음');
      for (const q of R.qs) lines.push([esc(q.q), esc(q.ans), q.n, q.ok, Math.round(q.rate * 100) + '%', esc(q.pack)].join(','));
      return '﻿' + lines.join('\n');
    }
  }
  QP.Referee = Referee;
  // node 봇처럼 dolls.js 가 없을 때의 별명
  QP.nickname = (av, adj) => 'nick' + av + '-' + adj;
})(typeof window !== 'undefined' ? window : globalThis);
