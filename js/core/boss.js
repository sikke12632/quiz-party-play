/* boss.js — 「보스 슈팅」 규칙과 셈 (작업/결정-보스슈팅.md). 화면 코드 없음: 선생님 화면·아이 화면·node 봇이 같이 쓴다.
 *
 * 판 흐름은 보물 지키기와 같다: 문제 per개(아이마다 따로) → 미니게임(defend) tDefend초 → 결과(dres) → … M번 → 끝.
 * 미니게임: 팀마다 자기 하늘에서 같은 보스(체력 ∞, 절대 안 죽음)에게 데미지를 넣는다. 데미지 많은 팀이 이긴다.
 *   하늘 = 200×200칸. 보스는 위, 비행기는 아래(y 70~192)에서 상하좌우로 움직이고 탄은 저절로 쏜다.
 *   보스 탄막은 씨앗으로 정해져 모든 기기가 똑같이 셈한다(조준탄만 그 기기의 내 비행기를 노린다).
 *   맞았는지·넣은 데미지는 아이 기기가 직접 센다(서버 위치는 1초 3번이라 선생님 화면이 판정하면 억울한 격추가 생김).
 *   아이 → 자리 문서 b{r:미니게임 번호, x, y, d:내 데미지, k:격추 0/1, h:맞은 횟수}. 선생님 화면은 팀별로 더해 live 로 내보낸다.
 *   두 버전(판 설정 kind): 공격력 강화(atk) = 맞힌 수만큼 무기 단계, 목숨 1 / 방어력 강화(def) = 무기 모두 같음(3단계), 맞힌 수만큼 목숨.
 *     목숨이 남으면 맞아도 BO.INV초 깜빡이며 버티고, 목숨이 다 떨어지면 격추.
 *   팀 점수 = 팀 데미지 ÷ 팀 인원 × 평균 인원(인원이 달라도 공평).
 *   격추되면 그 미니게임은 구경, 다음 미니게임에 부활.
 */
(function (root) {
  'use strict';
  const QP = root.QP;

  QP.BOSS_CFG = {
    mode: 'boss',
    teams: 4,
    per: 5,
    M: 3,
    tQ: 20,
    tReveal: 4,
    tIntro: 3,
    tDefend: 25,
    tResult: 8,
    kind: 'atk', // 'atk' 공격력 강화: 맞힌 수 → 무기 1~5단계, 목숨 1 · 'def' 방어력 강화: 무기는 모두 같고 맞힌 수 → 목숨(0개도 1)
    minutes: 99, // (황금 찾기용 칸)
  };
  QP.BOSS_NAMES = ['먹구름 대왕', '먹물 문어 선장', '태엽 부엉이', '눈보라 눈사람 왕', '꼬마 불꽃 용'];

  const BO = (QP.BO = {
    W: 200,
    H: 200,
    X0: 8,
    X1: 192,
    Y0: 70,
    Y1: 192,
    SPEED: 85, // 비행기 빠르기(칸/초)
    FIRE: 0.17, // 쏘는 간격
    SHOT_V: 240,
    HIT_R: 4, // 맞는 거리(비행기 가운데 작은 점)
    // 무기 단계: [각도(도, 위=0), 옆으로 비킴, 굵은 탄(데미지 2)]
    WEAPON: [
      null,
      { name: '한 줄', s: [[0, 0, 0]] },
      { name: '두 줄', s: [[0, -3, 0], [0, 3, 0]] },
      { name: '세 갈래', s: [[-12, 0, 0], [0, 0, 0], [12, 0, 0]] },
      { name: '세 갈래 + 굵은 탄', s: [[-12, -2, 0], [0, 0, 1], [12, 2, 0]] },
      { name: '다섯 갈래 + 굵은 탄', s: [[-26, -3, 0], [-12, -2, 0], [0, 0, 1], [12, 2, 0], [26, 3, 0]] },
    ],
  });
  QP.boLevel = (nOk) => Math.max(1, Math.min(5, nOk | 0));
  BO.DEF_LV = 3; // 방어력 강화 때 모두가 받는 무기 단계
  BO.INV = 1.6; // 목숨이 줄면 깜빡이며 안 맞는 시간(초)
  // 이번 미니게임 [무기 단계, 목숨]: kind 와 직전 묶음 맞힌 수로
  QP.boKit = (kind, nOk) => (kind === 'def' ? [BO.DEF_LV, Math.max(1, Math.min(9, nOk | 0))] : [QP.boLevel(nOk), 1]);
  // 처음 자리: 아래쪽에 고르게
  QP.boHome = (k, n) => [Math.round(BO.X0 + 14 + ((k + 0.5) / Math.max(1, n)) * (BO.X1 - BO.X0 - 28)), 172 - (k % 2) * 12];
  QP.boClamp = (x, y) => [Math.max(BO.X0, Math.min(BO.X1, x)), Math.max(BO.Y0, Math.min(BO.Y1, y))];
  // 보스 자리(t초, 3·2·1 동안은 음수)
  QP.boBoss = (t) => ({ x: 100 + Math.sin(t * 0.55) * 38, y: 32 + Math.sin(t * 1.3) * 2 });
  QP.boHitBoss = (x, y, b) => ((x - b.x) / 27) ** 2 + ((y - b.y - 2) / 15) ** 2 < 1;
  // 데미지 상한(초당) — 심판이 이상한 값을 거른다. 5단계 = 6 / 0.17초 ≈ 35
  QP.boMaxDps = 40;
  // 봇·시뮬레이션용 어림 데미지(초당): 단계별 한 번 쏠 때 데미지 × 맞히는 비율
  QP.boBotDps = (lv) => ([0, 1, 2, 3, 4, 6][lv] / BO.FIRE) * 0.8;

  /* ---------- 보스 탄막 ----------
   * 4가지가 4초씩 돈다: 0 부채꼴 · 1 빙글빙글 · 2 조준탄(내 비행기) · 3 비 내리기.
   * 미니게임 번호 mg 가 클수록 빽빽(간격이 짧아짐). 같은 seed·mg 면 어느 기기든 같은 탄(조준탄 방향만 다름).
   */
  class BossBullets {
    constructor(seed, mg) {
      this.r = QP.rng(seed >>> 0);
      this.k = 1 + 0.15 * (mg | 0); // 빽빽함
      this.list = [];
      this.t = 0;
      this.pat = -1;
      this.ft = 0;
      this.spin = 0;
      this.open = 0; // 보스가 입을 벌린 남은 시간(화면용)
    }
    // dur 이 지나면 새 탄을 안 쏜다. aim = [x, y] (조준탄이 노릴 곳)
    step(dt, dur, aim) {
      this.t += dt;
      const t = this.t,
        b = QP.boBoss(t);
      this.open = Math.max(0, this.open - dt);
      for (const x of this.list) {
        x.x += x.vx * dt;
        x.y += x.vy * dt;
      }
      this.list = this.list.filter((x) => x.y < 210 && x.y > -10 && x.x > -10 && x.x < 210);
      if (t < 0 || t >= dur) return;
      const p = Math.floor(t / 4) % 4,
        local = t % 4;
      if (p !== this.pat) {
        this.pat = p;
        this.ft = 0.3;
      }
      if (local > 3.3) return;
      this.ft -= dt;
      const r = this.r,
        k = this.k,
        mx = b.x,
        my = b.y + 10;
      while (this.ft <= 0) {
        if (p === 0) {
          this.ft += 0.6 / k;
          this.open = 0.2;
          const n = 9,
            sh = (Math.floor(t / 0.6) % 2) * 0.06;
          for (let i = 0; i < n; i++) {
            const a = Math.PI / 2 + (i / (n - 1) - 0.5) * 1.9 + sh;
            this.list.push({ x: mx, y: my, vx: Math.cos(a) * 50, vy: Math.sin(a) * 50, k: 'fan' });
          }
        } else if (p === 1) {
          this.ft += 0.085 / k;
          this.spin += 0.43;
          for (const a of [this.spin, this.spin + Math.PI]) this.list.push({ x: mx + Math.cos(a) * 14, y: my + Math.sin(a) * 8, vx: Math.cos(a) * 44, vy: Math.sin(a) * 44, k: 'spin' });
        } else if (p === 2) {
          this.ft += 0.45 / k;
          this.open = 0.2;
          r(); // 씨앗 소비를 기기와 상관없이 같게
          const a0 = Math.atan2((aim ? aim[1] : 170) - my, (aim ? aim[0] : 100) - mx);
          for (const da of [-0.2, 0, 0.2]) this.list.push({ x: mx, y: my, vx: Math.cos(a0 + da) * 72, vy: Math.sin(a0 + da) * 72, k: 'aim' });
        } else {
          this.ft += 0.055 / k;
          const x = b.x + (r() - 0.5) * 60,
            vx = (r() - 0.5) * 14,
            vy = 58 + r() * 22;
          this.list.push({ x, y: b.y + 14, vx, vy, k: 'rain' });
        }
      }
    }
    // (x, y) 비행기가 맞았나
    hits(x, y) {
      for (const b of this.list) if (Math.hypot(b.x - x, b.y - (y - 1)) < BO.HIT_R) return b;
      return null;
    }
  }
  QP.BossBullets = BossBullets;

  // 내 비행기가 쏜 탄 (화면·셈 공용): 단계 lv 로 한 번 쏘기
  QP.boFire = function (out, x, y, lv, who) {
    for (const [a, off, big] of BO.WEAPON[Math.max(1, Math.min(5, lv))].s) {
      const r = (a * Math.PI) / 180;
      out.push({ x: x + off, y: y - 7, vx: Math.sin(r) * BO.SHOT_V, vy: -Math.cos(r) * BO.SHOT_V, d: big ? 2 : 1, big, who });
    }
  };
  // 가짜 아이(봇)용: 미니게임 동안 돌아다니며 어림 데미지를 쌓고 b 를 쓴다. 가끔 격추. (bot-runner.js · 시험)
  //   c = KidClient. 미니게임마다 한 번만 돈다. pDown = 격추될 확률
  QP.boBotFly = function (c, pDown) {
    const L = c.game && c.game.live;
    if (c.phase !== 'defend' || !L || !c.seat || L.boss === undefined || c._boFly === L.mg) return;
    c._boFly = L.mg;
    const lv = (L.lv && L.lv[c.seat.sid]) || 1,
      hp = (L.hp && L.hp[c.seat.sid]) || 1;
    const mates = (c.game.roster || []).filter((x) => x.team === c.seat.team);
    let p = QP.boHome(Math.max(0, mates.findIndex((x) => x.sid === c.seat.sid)), mates.length),
      tx = p[0],
      ty = p[1],
      d = 0,
      k = 0,
      last = -1,
      done = false;
    // 맞는 때들: 한 번 맞을 확률마다 하나씩(목숨이 많으면 끝까지 살아남기 쉬움)
    const hitAt = [];
    for (let i = 0; i < 4; i++) if (Math.random() < (pDown === undefined ? 0.4 : pDown)) hitAt.push(3 + Math.random() * (L.dur - 4));
    hitAt.sort((a, b) => a - b);
    let h = 0;
    const tm = setInterval(() => {
      const t = (c.net.now() - L.t0) / QP.ms(1);
      if (c.phase !== 'defend' || !c.game.live || c.game.live.mg !== L.mg) return clearInterval(tm);
      if (t < 0) return;
      if (t < L.dur && !k) {
        if (Math.random() < 0.08) (tx = 20 + Math.random() * 160), (ty = 130 + Math.random() * 55);
        p = QP.boClamp(p[0] + Math.sign(tx - p[0]) * Math.min(Math.abs(tx - p[0]), 8), p[1] + Math.sign(ty - p[1]) * Math.min(Math.abs(ty - p[1]), 8));
        d += QP.boBotDps(lv) * 0.1;
        let hit = false;
        while (h < hitAt.length && t >= hitAt[h]) (h++), (hit = true);
        if (h >= hp) k = 1;
        if (hit) last = -9; // 맞으면 바로 보낸다
      }
      const fin = t >= L.dur && !done;
      if (fin || (t < L.dur && t - last >= 0.34 && !(k && last >= 0 && last > hitAt[hp - 1]))) {
        if (fin) done = true;
        last = t;
        c.write({ b: { r: L.mg, x: Math.round(p[0]), y: Math.round(p[1]), d: Math.round(d), k, h: Math.min(h, hp) } });
      }
      if (done) clearInterval(tm);
    }, QP.ms(0.1));
  };
  // 팀 점수: 인원으로 맞춤
  QP.boScore = (raw, n, avgN) => Math.round((raw / Math.max(1, n)) * Math.max(1, avgN));
})(typeof window !== 'undefined' ? window : globalThis);
