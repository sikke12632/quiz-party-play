/* chase.js — 「엄마 피해 도망가기」 규칙과 셈 (작업/결정-괴물도망.md). 화면 코드 없음: 선생님 화면·아이 화면·node 봇이 같이 쓴다.
 *
 * 반 전체가 한 팀. 반 하트(처음 30)는 판 내내 이어지고, 0이 되면 게임 오버(남은 문제·미니게임 없음).
 * 문제 per개 → 미니게임(갈림길 NJ번) → … M번 → 끝.
 * 갈림길 한 번: 달리기(tRun) → 고르기(times[j]초, 한 번만) → 공개 준비(tWait) → 공개(tShow: 쿵·엄마·꾸중·퇴장)
 *   잘못 고르거나 안 고른 아이는 잡힌다(반 하트 -1). 잡힌 아이는 그 미니게임에서 빠지고 다음 미니게임에서 다시 달린다.
 * 아이가 보내는 것: 자리 문서 p{r: 1000 + 미니게임×10 + 갈림길, x: 고른 길(0~3), y: 0}  (보물 지키기의 위치 칸을 그대로 쓴다 → 규칙 게시 불필요)
 */
(function (root) {
  'use strict';
  const QP = root.QP;

  QP.CHASE_CFG = {
    mode: 'chase',
    per: 5,
    M: 3,
    NJ: 6,
    hearts: 30,
    times: [3, 3, 3, 3, 3, 3], // 갈림길마다 고르는 시간(2026-11-06 담임: 5초면 너무 쉽고 3초가 적당)
    tLast: 2, // 마지막 미니게임은 갈림길마다 2초
    tWarn: 1.2, // 전광판(안개·낙석 주의) 보는 시간 — 깜짝 장치가 있는 미니게임만
    open: [2, 2, 2, 1, 1, 1], // 뚫린 길 수
    tQ: 20,
    tReveal: 4,
    tIntro: 3, // 미니게임 시작 전 3·2·1
    tRun: 1.2,
    tWait: 1.0, // 고르기 끝 → 공개(늦게 온 답을 기다림. 교실 측정 왕복 0.23~0.4초)
    tShow: 5.1,
    tResult: 7,
    stampN: 4, // 숙제 도장: 직전 묶음에서 이만큼 맞히면 그 미니게임에서 한 번 봐줌(2026-11-06 담임 「C만 하자」)
    minutes: 99,
  };
  QP.CH_SCOLD = ['숙제 했어?!', '학원 가야지!', '방 치웠어?!', '밥 먹어야지!', '양치했어?!', '게임 그만!'];
  QP.chCode = (mg, j) => 1000 + mg * 10 + j;
  // 숙제 도장 기준: stampN 개(문제 묶음이 짧으면 「하나 빼고 다」)
  QP.chStampN = (cfg) => Math.min(cfg.stampN || 4, Math.max(1, (cfg.per || 5) - 1));

  // 갈림길 깜짝 장치(2026-11-06 담임: 안개·낙석, 고르기 전에 전광판으로 「○○ 주의!」)
  //   1번째 미니게임: 없음 · 2번째: 안개(갈림길 절반쯤) · 3번째부터: 낙석(절반쯤) + 안개
  //   안개 = 고르기 시작 뒤 fogT 초 동안 갈래 길이 안 보임. 낙석 = 뚫려 보이던 길 fall 에 fallAt 초에 바위가 떨어짐(그 길은 막힌 길)
  QP.chEvLevel = (cfg, mg) => (cfg.events === false || mg === undefined ? 0 : Math.min(2, mg));
  QP.chChoose = (cfg, mg, j) => (mg !== undefined && cfg.tLast && mg >= (cfg.M || 3) - 1 ? cfg.tLast : cfg.times[j] || cfg.times[cfg.times.length - 1]);
  // 미니게임 하나의 갈림길들(모든 기기가 같은 씨앗으로 같은 것을 만든다)
  QP.chGates = function (seed, cfg, mg) {
    const r = QP.rng(seed);
    const out = [];
    for (let j = 0; j < cfg.NJ; j++) {
      const open = [];
      const lanes = r.shuffle([0, 1, 2, 3]);
      for (let k = 0; k < (cfg.open[j] || 1); k++) open.push(lanes[k]);
      out.push({ open: open.sort(), sym: r.shuffle([0, 1, 2, 3]), order: r.shuffle([0, 1, 2, 3]), shut: lanes.slice(open.length) });
    }
    // 깜짝 장치는 따로 씨앗(길 모양은 예전과 같게)
    const lv = QP.chEvLevel(cfg, mg);
    if (lv > 0) {
      const e = QP.rng((seed ^ 0x5bd1e995) >>> 0);
      out.forEach((g, j) => {
        const T = QP.chChoose(cfg, mg, j);
        const x = e();
        if (lv >= 2 && x < 0.5) g.ev = 'fall';
        else if (x < (lv >= 2 ? 0.75 : 0.55)) g.ev = 'fog';
        if (g.ev === 'fall') {
          g.fall = g.shut[Math.floor(e() * g.shut.length)]; // 처음엔 뚫려 보이는 길
          g.fallAt = Math.round(T * (0.45 + e() * 0.25) * 100) / 100;
        }
        if (g.ev === 'fog') g.fogT = Math.round(T * 0.35 * 100) / 100;
      });
      if (!out.some((g) => g.ev)) (out[1].ev = 'fog'), (out[1].fogT = Math.round(QP.chChoose(cfg, mg, 1) * 0.35 * 100) / 100);
    }
    return out;
  };
  // 갈림길 시간표(초, 미니게임 시작 t0 기준): [{run, ch0, ch1, show, end}]. mg = 미니게임 번호(마지막 미니게임은 tLast초)
  QP.chTimes = function (cfg, mg) {
    const last = mg !== undefined && cfg.tLast && mg >= (cfg.M || 3) - 1;
    const out = [];
    let t = 0;
    for (let j = 0; j < cfg.NJ; j++) {
      const T = last ? cfg.tLast : cfg.times[j] || cfg.times[cfg.times.length - 1];
      const run = cfg.tRun + (QP.chEvLevel(cfg, mg) > 0 ? cfg.tWarn || 1.2 : 0); // 깜짝 장치가 있는 미니게임: 전광판 보는 시간
      const x = { run: t, ch0: t + run, ch1: t + run + T };
      x.show = x.ch1 + cfg.tWait;
      x.end = x.show + cfg.tShow;
      out.push(x);
      t = x.end;
    }
    return out;
  };
  QP.chDur = (cfg) => QP.chTimes(cfg).slice(-1)[0].end;
  // 끝났을 때 별: 남은 하트 비율로 1~3개(0이면 게임 오버)
  QP.chStars = (h, max) => (h <= 0 ? 0 : h >= (max * 2) / 3 ? 3 : h >= max / 3 ? 2 : 1);
})(typeof window !== 'undefined' ? window : globalThis);
