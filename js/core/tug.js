/* tug.js — 「줄다리기」 규칙과 셈 (작업/결정-줄다리기.md). 화면 코드 없음: 선생님 화면·아이 화면·node 봇이 같이 쓴다.
 *
 * 판 흐름은 보물 지키기·보스 슈팅과 같다: 문제 per개 → 미니게임(defend) 25초 → 결과(dres) → … M번 → 끝.
 * 두 팀. 미니게임: 「여·엉·차!」 박자에 맞춰 「차!」에 누른다(리듬 게임). 판정은 아이 기기가 직접(서버 시계에 맞춰져 있어 박자 시각이 같다).
 *   한 번 맞히면 완벽 2점 · 좋아 1점, × 내 힘(직전 묶음 정답 수, 0개도 1). 여·엉(작은 동그라미)이나 박자 사이에 누르면 「헛손질」 → 바로 다음 차 무효.
 *   아이 → 자리 문서 b{r:미니게임 번호, x:0, y:0, d:내 점수, k:0, h:0} (보스 슈팅 칸을 그대로 씀 → 서버 규칙을 바꾸지 않는다), 1초 3번까지.
 *   줄 위치 = 두 팀 한 명당 평균의 차이 ÷ 두 팀 평균(최소 TG.FLOOR) × TG.K — 힘이 작은 판이든 큰 판이든 「몇 % 더 잘했나」로 움직인다.
 *   ±1(끝선)에 닿으면 바로 그 팀 승리, 아니면 25초 뒤 더 당긴 쪽.
 *   최종: 미니게임에서 이긴 횟수 → 같으면 한 명당 평균 점수 합.
 */
(function (root) {
  'use strict';
  const QP = root.QP;

  QP.TUG_CFG = {
    mode: 'tug',
    teams: 2,
    per: 5,
    M: 3,
    tQ: 20,
    tReveal: 4,
    tIntro: 3,
    tDefend: 25,
    tResult: 7,
    minutes: 99,
  };
  const TG = (QP.TG = {
    K: 1.6, // 한 팀이 평균보다 약 60% 더 당기면 끝선
    FLOOR: 30, // 시작 직후 점수가 작을 때 줄이 크게 흔들리지 않게
    LAG: 0.03, // 크롬북 터치가 조금 늦게 들어오는 만큼 판정 가운데를 늦춤
    PTS: { perfect: 2, good: 1 },
  });
  QP.tgPower = (nOk) => Math.max(1, Math.min(9, nOk | 0));
  // 박자(초): 1.2초부터, 처음 0.8초마다 → 10초부터 0.6초 → 19초부터 0.4초(막판 스퍼트)
  QP.tgBeats = function (dur) {
    const B = [];
    let t = 1.2;
    while (t < dur - 0.2) {
      B.push(Math.round(t * 1000) / 1000);
      t += t < 10 ? 0.8 : t < 19 ? 0.6 : 0.4;
    }
    return B;
  };
  QP.tgGap = (B, i) => B[i] - (i ? B[i - 1] : B[i] - 0.8);
  // 판정 창: 작은 동그라미(박자 간격의 1/3 앞)보다 좁게
  QP.tgWin = function (B, i) {
    const good = Math.min(0.15, QP.tgGap(B, i) / 3 - 0.02);
    return { good, perfect: Math.min(0.08, good * 0.6) };
  };
  QP.tgSpurt = (b) => b >= 19;

  /* 한 사람의 판정기 (아이 화면이 쓴다). tap(g) → {kind:'perfect'|'good'|'lost'|'dup'|'miss', i, pts}
   * tick(g) → 지나간 박자 중 안 누른 것 = 놓침 목록 */
  class TugJudge {
    constructor(beats, power) {
      this.B = beats;
      this.pow = power;
      this.judged = beats.map(() => null); // 점수(0 = 놓침·무효)
      this.lost = beats.map(() => false); // 헛손질로 무효
      this.score = 0;
      this.combo = 0;
      this.best = 0;
      this.n = { perfect: 0, good: 0, miss: 0, wild: 0 };
    }
    tap(g) {
      const B = this.B;
      let best = -1,
        bd = 9;
      for (let i = 0; i < B.length; i++) {
        const d = Math.abs(g - TG.LAG - B[i]);
        if (d < bd) (bd = d), (best = i);
      }
      const w = best >= 0 ? QP.tgWin(B, best) : null;
      if (w && bd <= w.good) {
        if (this.lost[best]) return { kind: 'lost', i: best, pts: 0 };
        if (this.judged[best] !== null) return { kind: 'dup', i: best, pts: 0 };
        const kind = bd <= w.perfect ? 'perfect' : 'good';
        const pts = TG.PTS[kind] * this.pow;
        this.judged[best] = pts;
        this.score += pts;
        this.combo++;
        this.best = Math.max(this.best, this.combo);
        this.n[kind]++;
        return { kind, i: best, pts };
      }
      // 헛손질: 바로 다음 차 무효
      const nx = B.findIndex((b, i) => b + TG.LAG > g && this.judged[i] === null);
      if (nx >= 0) {
        this.judged[nx] = 0;
        this.lost[nx] = true;
      }
      this.combo = 0;
      this.n.wild++;
      return { kind: 'miss', i: nx, pts: 0 };
    }
    tick(g) {
      const out = [];
      for (let i = 0; i < this.B.length; i++) {
        if (this.judged[i] !== null) continue;
        if (g - TG.LAG > this.B[i] + QP.tgWin(this.B, i).good) {
          this.judged[i] = 0;
          this.combo = 0;
          this.n.miss++;
          out.push(i);
        }
      }
      return out;
    }
  }
  QP.TugJudge = TugJudge;

  // 줄 위치(-1 ~ 1, + 는 0번 팀 쪽)
  QP.tgPos = (avg0, avg1) => Math.max(-1, Math.min(1, ((avg0 - avg1) / Math.max(TG.FLOOR, (avg0 + avg1) / 2)) * TG.K));
  // 점수 상한: g초까지 지난 박자 × 완벽 × 힘 (심판이 이상한 값을 거른다)
  QP.tgCap = (B, g, pow) => B.filter((b) => b <= g + 0.5).length * TG.PTS.perfect * pow;

  // 가짜 아이(봇): 미니게임 동안 박자마다 맞힐 확률 acc 로 점수를 쌓아 b 를 쓴다. c = KidClient
  QP.tgBotPlay = function (c, acc) {
    const L = c.game && c.game.live;
    if (c.phase !== 'defend' || !L || !c.seat || L.kind !== 'tug' || c._tgPlay === L.mg) return;
    c._tgPlay = L.mg;
    acc = acc === undefined ? 0.5 + Math.random() * 0.45 : acc;
    const B = QP.tgBeats(L.dur),
      pow = (L.pw && L.pw[c.seat.sid]) || 1;
    let score = 0,
      bi = 0,
      last = -1,
      done = false;
    const tm = setInterval(() => {
      const L2 = c.game && c.game.live;
      if (c.phase !== 'defend' || !L2 || L2.mg !== L.mg) return clearInterval(tm);
      const g = (c.net.now() - L.t0) / QP.ms(1);
      while (bi < B.length && B[bi] <= g) {
        const r = Math.random();
        score += (r < acc * 0.55 ? 2 : r < acc ? 1 : 0) * pow;
        bi++;
      }
      const fin = g >= L.dur && !done;
      if (fin || (g >= 0 && g < L.dur && g - last >= 0.34)) {
        if (fin) done = true;
        last = g;
        c.write({ b: { r: L.mg, x: 0, y: 0, d: score, k: 0, h: 0 } });
      }
      if (done) clearInterval(tm);
    }, QP.ms(0.1));
  };
})(typeof window !== 'undefined' ? window : globalThis);
