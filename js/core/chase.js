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
    times: [4, 3.6, 3.2, 3, 2.7, 2.5], // 갈림길마다 고르는 시간
    open: [2, 2, 2, 1, 1, 1], // 뚫린 길 수
    tQ: 20,
    tReveal: 4,
    tIntro: 3, // 미니게임 시작 전 3·2·1
    tRun: 1.2,
    tWait: 0.6, // 고르기 끝 → 공개(늦게 온 답을 기다림)
    tShow: 5.1,
    tResult: 7,
    minutes: 99,
  };
  QP.CH_SCOLD = ['숙제 했어?!', '학원 가야지!', '방 치웠어?!', '밥 먹어야지!', '양치했어?!', '게임 그만!'];
  QP.chCode = (mg, j) => 1000 + mg * 10 + j;

  // 미니게임 하나의 갈림길들(모든 기기가 같은 씨앗으로 같은 것을 만든다)
  QP.chGates = function (seed, cfg) {
    const r = QP.rng(seed);
    const out = [];
    for (let j = 0; j < cfg.NJ; j++) {
      const open = [];
      const lanes = r.shuffle([0, 1, 2, 3]);
      for (let k = 0; k < (cfg.open[j] || 1); k++) open.push(lanes[k]);
      out.push({ open: open.sort(), sym: r.shuffle([0, 1, 2, 3]), order: r.shuffle([0, 1, 2, 3]) });
    }
    return out;
  };
  // 갈림길 시간표(초, 미니게임 시작 t0 기준): [{run, ch0, ch1, show, end}]
  QP.chTimes = function (cfg) {
    const out = [];
    let t = 0;
    for (let j = 0; j < cfg.NJ; j++) {
      const T = cfg.times[j] || cfg.times[cfg.times.length - 1];
      const x = { run: t, ch0: t + cfg.tRun, ch1: t + cfg.tRun + T };
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
