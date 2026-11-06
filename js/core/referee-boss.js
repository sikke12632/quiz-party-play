/* referee-boss.js — 「보스 슈팅」 심판 (작업/결정-보스슈팅.md). 셈은 boss.js.
 * 문제·정답 보기·팀 나누기·결과·끝은 보물 지키기 심판(referee-treasure.js)을 그대로 쓰고, 미니게임만 바꾼다.
 *   문제(아이마다 따로) → 정답 보기 → … per문제마다 → 보스 슈팅(defend) → 결과(dres) → … M번 → 끝
 *
 * 판 문서 tt·roster: 보물 지키기와 같음(tt.teams[].tot = 팀 점수 합)
 * 판 문서 live: 미니게임 중 { mg, seed, t0, dur, boss:보스 번호, kind, avg:평균 인원, lv:{sid:단계}, hp:{sid:목숨}, hit:{sid:맞은 횟수}, pos:{sid:[x,y]}, d:{sid:데미지}, dn:{sid:1}, dmg:{팀:데미지 합} }
 * cfg.kind: 'pick' 아이마다 모이는 곳에서 고름(자리 st, live.st{sid:'a'|'d'}) / 'atk' 모두 공격형(맞힌 수 → 무기 단계, 목숨 1) / 'def' 모두 수비형(무기 모두 같음, 맞힌 수 → 목숨)
 * 자리 문서(그 아이만): team, cl, res{…, blk, left}, dres{mg, d:팀 점수, raw, my, down, rank, n, boss}, fin{rank, tot, my, nOk, nAns, n}
 * 아이가 쓰는 칸: a{r,v} 답, b{r:미니게임 번호, x, y, d:내 데미지, k:격추 0/1, h:맞은 횟수(없어도 됨)}
 */
(function (root) {
  'use strict';
  const QP = root.QP;
  const LIVE_MS = 333; // 내보내기 간격 (1초 3번)

  class BossReferee extends QP.TreasureReferee {
    defaultCfg() {
      return QP.BOSS_CFG;
    }
    pubCfg() {
      const c = this.S.cfg;
      return { mode: 'boss', kind: ['atk', 'def'].includes(c.kind) ? c.kind : 'pick', per: c.per, M: c.M, teams: c.teams, tQ: c.tQ, tReveal: c.tReveal, tIntro: c.tIntro, tDefend: c.tDefend, tResult: c.tResult };
    }
    afterCreate() {
      super.afterCreate();
      // 미니게임마다 나올 보스: 5마리를 섞어 차례로(M 이 5보다 크면 다시 섞어 이어 붙임)
      const list = [];
      while (list.length < Math.max(1, this.S.cfg.M | 0)) list.push(...this.r.shuffle([...QP.BOSS_NAMES.keys()]));
      this.S.t.bosses = list.slice(0, Math.max(1, this.S.cfg.M | 0));
      this.S.t.my = {}; // sid → 판 전체 내 데미지
    }
    // 이 아이의 형: 'atk' 공격형 | 'def' 수비형
    styleOf(s) {
      const k = this.S.cfg.kind;
      if (k === 'atk' || k === 'def') return k;
      return s.style === 'def' ? 'def' : 'atk';
    }
    styleCount() {
      const ss = this.seatList();
      const d = ss.filter((s) => this.styleOf(s) === 'def').length;
      return { atk: ss.length - d, def: d };
    }
    avgN() {
      return this.seatList().length / Math.max(1, this.nTeams());
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
      // 모이는 곳에서 고른 공격형·수비형 (b.r = -1). 시작하면 고정
      if (S.phase === 'lobby' && d.b && d.b.r === -1 && S.cfg.kind !== 'atk' && S.cfg.kind !== 'def') {
        const st = d.b.k ? 'def' : 'atk';
        if (s.style !== st) {
          s.style = st;
          this.net.update(this.path('players/' + num), { st });
          this.saveSoon();
        }
      }
      const L = this.live;
      if (S.phase === 'defend' && L && d.b && d.b.r === S.t.mg && typeof d.b.x === 'number') {
        s.bpos = QP.boClamp(d.b.x, d.b.y);
        // 데미지: 줄지 않고(새로 고침해도), 지난 시간으로 낼 수 있는 만큼까지만
        const el = Math.max(0, (this.net.now() - L.t0) / QP.ms(1));
        const cap = Math.round(Math.min(el, L.dur + 1) * QP.boMaxDps + 30);
        s.bdmg = Math.max(s.bdmg || 0, Math.min(cap, Math.max(0, d.b.d | 0)));
        if (typeof d.b.h === 'number') s.bhit = Math.max(s.bhit || 0, Math.min(s.bhp || 1, d.b.h | 0));
        if (d.b.k) s.bdown = 1;
      }
      this.emit();
    }

    /* ---------- 보스 슈팅 ---------- */
    async startDefend() {
      const S = this.S,
        c = S.cfg,
        T = S.t;
      const mg = T.mg;
      S.phase = 'defend';
      S.phaseAt = this.net.now();
      const t0 = S.phaseAt + QP.ms(c.tIntro);
      S.endsAt = t0 + QP.ms(c.tDefend);
      const seed = (S.seed + mg * 7919 + 29) >>> 0;
      const boss = T.bosses[mg % T.bosses.length];
      const kind = ['atk', 'def'].includes(c.kind) ? c.kind : 'pick';
      const live = { mg, seed, t0, dur: c.tDefend, boss, kind, st: {}, avg: Math.round(this.avgN() * 100) / 100, lv: {}, hp: {}, hit: {}, pos: {}, d: {}, dn: {}, dmg: {} };
      for (let t = 0; t < this.nTeams(); t++) {
        const kids = this.teamSeats(t);
        live.dmg[t] = 0;
        kids.forEach((s, k) => {
          [s.lv, s.bhp] = QP.boKit(this.styleOf(s), s.blk);
          live.st[s.sid] = this.styleOf(s) === 'def' ? 'd' : 'a';
          s.bpos = QP.boHome(k, kids.length);
          s.bdmg = 0;
          s.bdown = 0;
          s.bhit = 0;
          live.lv[s.sid] = s.lv;
          live.hp[s.sid] = s.bhp;
          live.hit[s.sid] = 0;
          live.pos[s.sid] = s.bpos.slice();
          live.d[s.sid] = 0;
        });
      }
      this.live = live;
      this.log('보스 슈팅 ' + (mg + 1) + '번째: ' + QP.BOSS_NAMES[boss]);
      await this.net.update(this.path(), { phase: 'defend', round: S.round, endsAt: S.endsAt, live, tt: this.pubT(), roster: this.roster() });
      clearInterval(this.liveT);
      let lastSig = '';
      this.liveT = setInterval(() => {
        if (S.phase !== 'defend') return clearInterval(this.liveT);
        const sig = this.fillLive();
        if (sig !== lastSig) {
          lastSig = sig;
          this.net.update(this.path(), { live: this.live });
        }
      }, QP.ms(LIVE_MS / 1000));
      this.after(S.endsAt + QP.ms(0.6), () => this.endDefend());
      this.save();
      this.emit();
    }
    // 자리들의 위치·데미지·격추를 live 에 모은다. 바뀌었는지 볼 서명을 돌려준다
    fillLive() {
      const L = this.live;
      for (let t = 0; t < this.nTeams(); t++) {
        let sum = 0;
        for (const s of this.teamSeats(t)) {
          if (!s.bpos) continue;
          L.pos[s.sid] = [Math.round(s.bpos[0]), Math.round(s.bpos[1])];
          L.d[s.sid] = s.bdmg || 0;
          if (L.hit) L.hit[s.sid] = s.bhit || 0;
          if (s.bdown) L.dn[s.sid] = 1;
          sum += s.bdmg || 0;
        }
        L.dmg[t] = sum;
      }
      return JSON.stringify([L.pos, L.d, L.dn, L.hit]);
    }
    // 화면(TV)용: 팀별 지금 점수
    liveTeams() {
      const L = this.live,
        avg = L ? L.avg : this.avgN();
      return this.S.t.order.map((a, t) => {
        const kids = this.teamSeats(t);
        const raw = kids.reduce((x, s) => x + (s.bdmg || 0), 0);
        return { t, a, n: kids.length, raw, d: QP.boScore(raw, kids.length, avg), alive: kids.filter((s) => !s.bdown).length, lives: kids.reduce((x, s) => x + (s.bdown ? 0 : Math.max(0, (s.bhp || 1) - (s.bhit || 0))), 0), hp: kids.reduce((x, s) => x + (s.bhp || 1), 0) };
      });
    }
    async endDefend() {
      const S = this.S,
        T = S.t,
        c = S.cfg;
      if (S.phase !== 'defend' || this.ending) return;
      this.ending = true;
      clearInterval(this.liveT);
      if (this.live) {
        this.fillLive();
        this.net.update(this.path(), { live: this.live });
      }
      const boss = this.live ? this.live.boss : T.bosses[T.mg % T.bosses.length];
      const res = this.liveTeams().map((x) => ({ t: x.t, d: x.d, raw: x.raw, n: x.n, dn: x.n - x.alive }));
      for (const x of res) T.tot[x.t] += x.d;
      const order = res.slice().sort((a, b) => b.d - a.d);
      order.forEach((x, i) => (x.rank = i > 0 && order[i - 1].d === x.d ? order[i - 1].rank : i + 1));
      T.log.push(res);
      T.mg++;
      const ops = [];
      for (const s of this.seatList()) {
        const x = res.find((y) => y.t === s.team) || { d: 0, raw: 0, rank: 0 };
        T.my[s.sid] = (T.my[s.sid] || 0) + (s.bdmg || 0);
        ops.push({ path: this.path('players/' + s.num), data: { dres: { mg: T.mg, d: x.d, raw: x.raw, my: s.bdmg || 0, down: s.bdown ? 1 : 0, hp: s.bhp || 1, hit: s.bhit || 0, rank: x.rank, n: res.length, boss, kind: this.styleOf(s) } }, merge: true });
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
      this.log('보스 슈팅 결과: ' + res.map((x) => QP.teamName(T.order[x.t]) + ' ' + x.d).join(', '));
      this.after(S.endsAt, () => (over ? this.finish() : this.startQuestion()));
      this.save();
      this.emit();
    }
    async finish() {
      await super.finish();
      // 내 데미지 합을 끝 결과에 더한다
      const T = this.S.t;
      await this.net.batch(this.seatList().map((s) => ({ path: this.path('players/' + s.num), data: { fin: Object.assign({}, this.finOf(s), { my: T.my[s.sid] || 0 }) }, merge: true })));
    }
    finOf(s) {
      const x = this.teamBoard().find((y) => y.t === s.team) || {};
      return { rank: x.rank || 0, tot: x.tot || 0, k: 0, nOk: s.nOk, nAns: s.nAns, n: this.nTeams() };
    }
    results() {
      const R = super.results();
      const T = this.S.t;
      R.kids.forEach((k) => {
        const s = this.S.seats[k.num];
        k.dmg = s ? T.my[s.sid] || 0 : 0;
      });
      return R;
    }
  }
  QP.BossReferee = BossReferee;
})(typeof window !== 'undefined' ? window : globalThis);
