/* kid.js — 아이 기기 쪽 연결 (화면 코드 없음: kid-ui.js 와 node 봇이 같이 쓴다)
 * 입장 번호 → 출석 번호 → 선생님 화면이 자리를 주면 앉는다. 새로 고침해도 같은 자리로 돌아온다.
 * 숨쉬기 신호, 탭 주인, 다른 기기 감지 (작업/결정-시간과-접속.md 2절)
 *
 * screen: 'code' 'num' 'joining' 'busy' 'seat'(판 진행은 game.phase 로) 'otherTab' 'otherDevice' 'gone'
 */
(function (root) {
  'use strict';
  const QP = root.QP;
  const G = 'qp_games/';

  class KidClient {
    constructor(net, opts) {
      opts = opts || {};
      this.net = net;
      this.tab = opts.tab || QP.id(6);
      this.onUpdate = opts.onUpdate || (() => {});
      this.store = opts.store || null; // {get(), set(v)}: 새로 고침 뒤 이어 하기
      this.bc = opts.bc || null; // BroadcastChannel (같은 브라우저 탭끼리)
      this.screen = 'code';
      this.game = null;
      this.seat = null;
      this.unsubs = [];
      this.lastWrite = 0;
      this.seen = 0;
      this.sent = {}; // 이번 라운드에 보낸 것 {a, c, tg}
      this.err = '';
      if (this.bc)
        this.bc.onmessage = (e) => {
          const m = e.data || {};
          if (m.t === 'tab' && m.gid === this.gid && m.num === this.num && m.tab !== this.tab && this.screen === 'seat') this.become('otherTab');
        };
    }
    emit() {
      this.onUpdate(this);
    }
    become(s) {
      this.screen = s;
      if (s === 'otherTab' || s === 'otherDevice' || s === 'gone') this.stopBeat();
      this.emit();
    }
    timeLeft() {
      return this.game && this.game.endsAt ? Math.max(0, this.game.endsAt - this.net.now()) / QP.ms(1) : 0;
    }

    /* ---------- 입장 ---------- */
    async enter(code) {
      this.err = '';
      const list = await this.net.find('qp_games', 'code', String(code));
      const g = list.filter((d) => d.data.phase !== 'end').sort((a, b) => (b.data.at || 0) - (a.data.at || 0))[0];
      if (!g) {
        this.err = '그 번호의 판이 없어요. 번호를 다시 봐요.';
        this.emit();
        return false;
      }
      this.gid = g.id;
      this.code = String(code);
      this.watchGame();
      this.become('num');
      return true;
    }
    watchGame() {
      this.unsubs.push(
        this.net.onDoc(G + this.gid, (g) => {
          const prev = this.game;
          this.game = g;
          if (!g) return this.become('gone');
          if (prev && prev.round !== g.round) this.sent = {};
          this.emit();
        })
      );
    }
    async join(num) {
      this.num = num;
      this.req = QP.id(6);
      this.err = '';
      this.become('joining');
      if (!this.joinSub)
        this.joinSub = this.net.onDoc(G + this.gid + '/joins/' + this.net.uid, (d) => {
          if (!d || d.rat !== this.req) return;
          if (d.res === 'ok') this.seated(this.num);
          else if (d.res === 'have') this.seated(d.num);
          else if (d.res === 'busy') this.become('busy');
          else {
            this.err = '그 번호로는 들어갈 수 없어요.';
            this.become('num');
          }
        });
      // 선생님 답(res, rat)은 건드리지 않고 내 칸만 (서버 규칙)
      await this.net.update(G + this.gid + '/joins/' + this.net.uid, { num, tab: this.tab, at: this.req });
    }
    seated(num) {
      this.num = num;
      // 진짜 서버: 기기 시계를 서버 시각에 맞춘다(들어가기 요청 문서에 서버 시각을 한 번 써 보고 되읽기)
      if (this.net.calibrate && !this.calibrated) {
        this.calibrated = true;
        this.net.calibrate(G + this.gid + '/joins/' + this.net.uid);
      }
      if (this.store) this.store.set({ gid: this.gid, code: this.code, num });
      if (this.seatSub) this.seatSub();
      this.seatSub = this.net.onDoc(
        G + this.gid + '/players/' + num,
        (d) => {
          if (!d || d.uid !== this.net.uid) return this.become('otherDevice');
          this.seat = d;
          if (this.screen !== 'seat' && this.screen !== 'otherTab') {
            this.screen = 'seat';
            this.claimTab();
            this.startBeat();
          } else if (this.screen === 'seat') {
            // 내 탭 번호가 한 번 보인 뒤에 다른 탭 번호로 바뀌면 = 다른 탭이 주인이 됨
            if (d.tab === this.tab) this.tabSeen = true;
            else if (this.tabSeen) this.become('otherTab');
          }
          this.emit();
        },
        () => this.become('otherDevice') // 자리가 다른 기기로 넘어가면 읽을 수 없게 된다
      );
    }
    // 이 탭이 주인 (가장 나중에 연 탭)
    claimTab() {
      this.tabSeen = false;
      if (this.screen === 'otherTab') {
        this.screen = 'seat';
        this.startBeat();
      }
      this.write({ tab: this.tab });
      if (this.bc) this.bc.postMessage({ t: 'tab', gid: this.gid, num: this.num, tab: this.tab });
      this.emit();
    }
    // 새로 고침 뒤: 저장해 둔 판·번호로 바로 다시 앉기
    async resume() {
      const s = this.store && this.store.get();
      if (!s || !s.gid) return false;
      const g = await this.net.get(G + s.gid).catch(() => null);
      if (!g || g.phase === 'end') {
        this.store.set(null);
        return false;
      }
      this.gid = s.gid;
      this.code = s.code;
      this.watchGame();
      await this.join(s.num);
      return true;
    }
    leave() {
      if (this.store) this.store.set(null);
      this.stop();
    }

    /* ---------- 쓰기 ---------- */
    write(data) {
      if (this.screen === 'otherTab' || this.screen === 'otherDevice') return Promise.resolve();
      this.lastWrite = this.net.now();
      return this.net.update(G + this.gid + '/players/' + this.num, data).catch(async (e) => {
        if (!e || e.code !== 'permission-denied') return;
        // 내 자리를 아직 읽을 수 있으면 내 자리다(쓴 값이 규칙에 안 맞았던 것) → 다시 누를 수 있게
        try {
          const me = await this.net.get(G + this.gid + '/players/' + this.num);
          if (me && me.uid === this.net.uid) {
            if (data.a && this.sent.a === data.a.r) this.sent.a = 0;
            if (data.c && this.sent.c === data.c.r) this.sent.c = 0;
            if (data.tg && this.sent.tg === data.tg.r) this.sent.tg = 0;
            console.warn('서버가 받지 않은 값', data);
            return this.emit();
          }
        } catch (e2) {}
        this.become('otherDevice');
      });
    }
    startBeat() {
      this.stopBeat();
      this.beat = setInterval(() => {
        if (this.net.now() - this.lastWrite >= QP.ms(QP.HEARTBEAT)) this.write({ seen: ++this.seen });
      }, QP.ms(QP.HEARTBEAT / 4));
    }
    stopBeat() {
      clearInterval(this.beat);
    }
    stop() {
      this.stopBeat();
      this.unsubs.forEach((u) => u());
      if (this.joinSub) this.joinSub();
      if (this.seatSub) this.seatSub();
      this.unsubs = [];
      this.joinSub = this.seatSub = null;
    }

    /* ---------- 지금 무엇을 할 차례인가 (화면이 쓴다) ---------- */
    get round() {
      return this.game ? this.game.round : 0;
    }
    get phase() {
      return this.game ? this.game.phase : 'lobby';
    }
    myQ() {
      const s = this.seat;
      return s && s.q && s.q.r === this.round && this.phase === 'question' ? s.q : null;
    }
    myRes() {
      const s = this.seat;
      return s && s.res && s.res.r === this.round ? s.res : null;
    }
    myOpen() {
      const s = this.seat;
      return s && s.open && s.open.r === this.round ? s.open : null;
    }
    myRev() {
      const s = this.seat;
      return s && s.rev && s.rev.r === this.round ? s.rev : null;
    }
    answer(v) {
      const q = this.myQ();
      if (!q || this.sent.a === this.round) return false;
      this.sent.a = this.round;
      this.write({ a: { r: this.round, v: QP.ansToSend(v) } }); // 긴 보기는 앞 12글자만(서버 규칙)
      this.emit();
      return true;
    }
    pickChest(i) {
      const res = this.myRes();
      if (this.phase !== 'chest' || !res || !res.ok || this.sent.c === this.round) return false;
      this.sent.c = this.round;
      this.sent.ci = i;
      this.write({ c: { r: this.round, i } });
      this.emit();
      return true;
    }
    pickTarget(sid) {
      const o = this.myOpen();
      if (this.phase !== 'chest' || !o || !o.targets || !o.targets.includes(sid) || this.sent.tg === this.round) return false;
      this.sent.tg = this.round;
      this.sent.tgSid = sid;
      this.write({ tg: { r: this.round, sid } });
      this.emit();
      return true;
    }
    // 판 문서의 순위표에서 sid → {nick, av, gold, rank}
    who(sid) {
      const b = (this.game && this.game.board) || [];
      const i = b.findIndex((x) => x.sid === sid);
      return i < 0 ? null : Object.assign({ rank: i + 1 }, b[i]);
    }
  }
  QP.KidClient = KidClient;
})(typeof window !== 'undefined' ? window : globalThis);
