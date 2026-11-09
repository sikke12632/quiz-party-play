/* treasure.js — 「보물 지키기」 규칙과 셈 (작업/결정-보물지키기.md). 화면 코드 없음: 선생님 화면·아이 화면·node 봇이 같이 쓴다.
 *
 * 판 흐름: 문제 per개(아이마다 따로) → 보물 지키기 tDefend초 → … M번 → 끝.
 * 미니게임: 팀마다 한 섬, 가운데 보물(하트 hearts개). 적은 섬 가장자리에서 보물로 곧장 온다.
 *   적이 나오는 때·곳·빠르기 = 씨앗으로 정해진 「적 목록」(모든 팀이 같은 목록 → 공평). 모든 기기가 같은 식으로 적 위치를 셈한다.
 *   서버로 오가는 것: 아이 → 내 위치, 선생님 화면 → 모두의 위치·물리친 적·하트. 판정(물리침·하트)은 선생님 화면만.
 *   무기 단계 = 직전 per문제에서 맞힌 수(0개여도 1단계, 최대 5). 공격은 저절로: cool초마다 가까운 적 lv마리에게 별 사탕을 던진다.
 */
(function (root) {
  'use strict';
  const QP = root.QP;

  QP.TREASURE_CFG = {
    mode: 'treasure',
    teams: 4, // 팀 수(들어올 때 인원이 적은 팀에 무작위로)
    per: 5, // 미니게임 사이 문제 수
    M: 3, // 미니게임 수 (문제 = per × M)
    tQ: 20,
    tReveal: 4, // 문제 뒤 정답 보기
    tIntro: 3, // 미니게임 시작 전 3·2·1
    tDefend: 25,
    tResult: 8, // 미니게임 결과
    hearts: 10,
    foes: 20, // 아이 한 명당 적 수 — node tools/sim-treasure.mjs
    foesMore: 0, // 미니게임마다 적 수가 이만큼씩 늘어남(비율)
    faster: 0.1, // 미니게임마다 적이 이만큼씩 빨라짐(2026-11-06 담임: 단계가 올라갈수록 빨라지게)
    big: 0.1, // 첫 미니게임의 큰 유령 비율(2026-11-09 담임: "가만히만 잇어도 다 지켜진다 … 한번에 안 죽는 적")
    bigMore: 0.03, // 미니게임마다 큰 유령 비율이 이만큼씩 늘어남
    minutes: 99, // (황금 찾기용 칸)
  };
  // 팀 동물: [이름, dolls.js ANIMALS 번호]
  QP.TEAM_ANIMALS = [['호랑이', 7], ['토끼', 1], ['펭귄', 8], ['여우', 3], ['판다', 6], ['곰', 0]];
  QP.teamName = (t) => QP.TEAM_ANIMALS[t % QP.TEAM_ANIMALS.length][0] + ' 팀';

  // 섬 크기(세계 좌표: x 왼→오, y 위→아래, 보물은 0,0)
  const TR = (QP.TR = {
    WX: 11.6, // 걸을 수 있는 타원
    WY: 7.2,
    SX: 12.9, // 적이 나오는 타원
    SY: 8.5,
    CHEST: 1.15, // 보물에 닿는 거리
    SPEED: 4.2, // 아이 걸음(초당)
    FLY: 0.22, // 별이 날아가는 시간(화면용)
    BIG_HP: 3, // 큰 유령이 쓰러지기까지 맞는 횟수
    BIG_DMG: 2, // 큰 유령이 보물에 닿으면 잃는 하트
    range: (lv) => 2.0 + lv * 0.2, // 2026-11-09: 2.9~4.1 → 2.2~3.0칸(보물 옆에 서 있기만 해서는 사방을 못 막게)
    // 단계별 [던지기 간격(초), 한 번에 물리치는 적] — 초당 0.67 · 0.9 · 1.18 · 1.48 · 1.76마리
    WEAPON: [null, [1.5, 1], [1.1, 1], [1.7, 2], [1.35, 2], [1.7, 3]],
  });
  QP.trLevel = (nOk) => Math.max(1, Math.min(5, nOk | 0));
  // 미니게임 처음 자리: 보물 둘레에 고르게
  QP.trHome = (k, n) => {
    const a = (k / Math.max(1, n)) * Math.PI * 2 - Math.PI / 2;
    return [Math.cos(a) * 2.6, Math.sin(a) * 1.8];
  };
  // 걸을 수 있는 곳 안으로
  QP.trClamp = function (x, y) {
    const e = (x / TR.WX) ** 2 + (y / TR.WY) ** 2;
    if (e > 1) {
      const k = 1 / Math.sqrt(e);
      x *= k;
      y *= k;
    }
    return [x, y];
  };

  /* ---------- 적 목록 ---------- */
  // 종류 0 도깨비불(빠름), 1 꼬마 유령(느림), 2 큰 유령(느리지만 TR.BIG_HP번 맞아야 쓰러지고, 보물에 닿으면 하트 TR.BIG_DMG개)
  // spd: 빠르기 배율, big: 큰 유령 비율(뒤 미니게임일수록 커짐). 모든 기기가 같은 값을 써야 한다(판 문서 live.spd·live.big)
  QP.trSchedule = function (seed, dur, n, spd, big) {
    spd = spd || 1;
    big = big || 0;
    const r = QP.rng(seed);
    n = n || 64;
    const out = [];
    const end = dur - 3.5; // 끝나기 직전엔 새로 안 나온다
    const W = 5; // 몰려오는 물결 수
    for (let i = 0; i < n; i++) {
      // 물결마다 한꺼번에, 뒤 물결일수록 많이
      const u = Math.pow((i + 0.5) / n, 0.8);
      const w = Math.min(W - 1, Math.floor(u * W));
      const t = 0.3 + (w / W) * end + r() * (end / W) * 0.7;
      const rk = r();
      const k = rk < big ? 2 : rk < big + (1 - big) * 0.55 ? 0 : 1;
      const a = r() * Math.PI * 2;
      const sp = (k === 0 ? 1.35 + r() * 0.35 : k === 1 ? 0.95 + r() * 0.25 : 0.8 + r() * 0.15) * spd;
      const sx = Math.cos(a) * TR.SX,
        sy = Math.sin(a) * TR.SY;
      const L = Math.hypot(sx, sy);
      out.push({ i, t: Math.round(t * 100) / 100, a, k, hp: k === 2 ? TR.BIG_HP : 1, sp, sx, sy, L, arr: t + (L - TR.CHEST) / sp });
    }
    out.sort((a, b) => a.t - b.t);
    out.forEach((e, j) => (e.i = j));
    return out;
  };
  // t초에 적 위치 (아직 안 나왔으면 null). arrived = 보물에 닿음
  QP.trPos = function (e, t) {
    if (t < e.t) return null;
    const d = Math.min((t - e.t) * e.sp, e.L - TR.CHEST);
    const k = 1 - d / e.L;
    return { x: e.sx * k, y: e.sy * k, arrived: t >= e.arr };
  };

  /* ---------- 판정 (선생님 화면이 팀마다 하나씩 돌린다) ---------- */
  class TrSim {
    // kids: [{sid, lv}] (순서 = 아이 번호 k)
    constructor(sched, kids, hearts) {
      this.E = sched;
      this.kids = kids;
      this.h = hearts;
      this.h0 = hearts;
      this.dead = {}; // 적 번호 → 물리친 때
      this.hit = {}; // 적 번호 → 보물에 닿은 때
      this.kills = []; // [적 번호, 아이 번호 k, 때(1/100초)]
      this.hits = []; // [적 번호, 때]
      this.hp = {}; // 적 번호 → 맞은 횟수(큰 유령)
      this.hurts = []; // 쓰러지지 않고 맞은 것 [적 번호, 아이 번호 k, 때(1/100초)]
      this.cool = kids.map((_, k) => 0.4 + k * 0.17);
      this.t = 0;
    }
    // pos: k → [x, y] (모르면 보물 옆)
    // 화면이 뒤로 가 타이머가 느려져도 같은 결과가 나오게 0.1초씩 나눠 셈한다
    step(t, pos) {
      while (this.t + 0.1 < t) this.step1(this.t + 0.1, pos);
      this.step1(t, pos);
    }
    step1(t, pos) {
      const dt = t - this.t;
      if (dt <= 0) return;
      this.t = t;
      // 보물에 닿은 적
      for (const e of this.E) {
        if (e.arr > t || this.dead[e.i] !== undefined || this.hit[e.i] !== undefined) continue;
        this.hit[e.i] = e.arr;
        this.hits.push([e.i, Math.round(e.arr * 100)]);
        this.h = Math.max(0, this.h - (e.k === 2 ? TR.BIG_DMG : 1));
      }
      // 던지기
      this.kids.forEach((kd, k) => {
        this.cool[k] -= dt;
        if (this.cool[k] > 0) return;
        const p = pos[k] || [0.8, 0.8];
        const R = TR.range(kd.lv);
        const near = [];
        for (const e of this.E) {
          if (e.t > t || this.dead[e.i] !== undefined || this.hit[e.i] !== undefined) continue;
          const q = QP.trPos(e, t);
          const d = Math.hypot(q.x - p[0], q.y - p[1]);
          if (d <= R) near.push([d, e]);
        }
        if (!near.length) {
          this.cool[k] = 0.15; // 적이 오면 곧 던진다
          return;
        }
        near.sort((a, b) => a[0] - b[0]);
        const [cool, many] = TR.WEAPON[Math.max(1, Math.min(5, kd.lv))];
        for (const [, e] of near.slice(0, many)) {
          const n = (this.hp[e.i] || 0) + 1;
          this.hp[e.i] = n;
          if (n < (e.hp || 1)) {
            this.hurts.push([e.i, k, Math.round(t * 100)]);
            continue;
          }
          this.dead[e.i] = t;
          this.kills.push([e.i, k, Math.round(t * 100)]);
        }
        this.cool[k] = cool;
      });
    }
  }
  QP.TrSim = TrSim;

  // 봇·시뮬레이션용 아이 걸음: 보물 가까이에서 가장 가까운 적 쪽으로
  QP.trBotMove = function (p, E, t, dt, dead, home) {
    let best = null,
      bd = 1e9;
    for (const e of E) {
      if (e.t > t || dead[e.i] !== undefined || e.arr <= t) continue;
      const q = QP.trPos(e, t);
      const d = Math.hypot(q.x - p[0], q.y - p[1]) + Math.hypot(q.x, q.y) * 0.6; // 보물에 가까운 적 먼저
      if (d < bd) (bd = d), (best = q);
    }
    let tx = best ? best.x * 0.7 : home[0],
      ty = best ? best.y * 0.7 : home[1];
    const d = Math.hypot(tx - p[0], ty - p[1]);
    if (d > 0.3) {
      const s = Math.min(d, TR.SPEED * 0.8 * dt);
      p = [p[0] + ((tx - p[0]) / d) * s, p[1] + ((ty - p[1]) / d) * s];
    }
    return QP.trClamp(p[0], p[1]);
  };
})(typeof window !== 'undefined' ? window : globalThis);
