/* rules.js — 황금 찾기 규칙과 수치 (작업/결정-황금찾기.md, 작업/시뮬레이션-황금찾기.md H안)
 * 수치는 모두 여기 한 곳에 둔다. 선생님 화면 옵션이 CFG 를 덮어쓴다.
 */
(function (root) {
  'use strict';
  const QP = root.QP;

  QP.DEFAULT_CFG = {
    mode: 'gold',
    minutes: 10, // 5·10·15
    tQ: 20, // 문제 최대 초
    tChest: 10, // 상자 초
    tReveal: 7, // 결과 발표 초
    base: 20, // 맞히면 기본 금
    fastOn: true,
    fast: [[5, 15], [10, 10]], // [초 안, 금]
    streakOn: true,
    streak: [[5, 20], [3, 10]], // [연속, 금] 큰 것부터
    grow: 0.05, // 금 얻기 양이 라운드마다 커지는 비율
  };
  // 도깨비 찾기 2판(작업/담임피드백.md 2026-11-03, 작업/시뮬레이션-마피아2.md 안 나)
  QP.MAFIA_CFG = {
    mode: 'mafia',
    Q: 12, // 한 판 문제 수
    G: 3, // 도깨비 수(서로 모른다)
    H: 70, // 반 전체 정답이 이만큼 모이면 힌트
    groups: [8, 5, 3], // 힌트 무리 크기(차례로)
    mag: 0.08, // 맞힌 마을 사람이 진짜 돋보기를 받을 확률
    fake: 0.25, // 맞힌 도깨비가 가짜 돋보기(늘 "도깨비래")를 받을 확률
    limit: 3, // 착한 친구를 이만큼 잘못 지목하면 도깨비 승
    tRoll: 4, // 지목권 뽑기(빛이 후보를 딴딴딴…딴!) — 이때부터 돋보기를 쓴다
    tQ: 20,
    tResult: 8, // 지목 고르는 시간(빛이 멈춘 뒤). 지목권이 없으면 돋보기·정답 보는 시간
    tVote: 10,
    tShow: 6,
    minutes: 99, // (황금 찾기용 칸. 도깨비 찾기는 문제 수로 끝난다)
  };

  // 상자 안 (합 1)
  QP.CHEST_P = { gain: 0.5, double: 0.1, none: 0.12, shield: 0.06, stealPick: 0.07, stealRand: 0.07, swapPick: 0.04, swapRand: 0.04 };
  QP.GAIN = [10, 20, 30, 40, 50];
  QP.DOUBLE = [20, 300]; // 두 배: 가진 금만큼 더하되 최소 20, 최대 300
  QP.STEAL = 0.2; // 뺏기: 상대 금의 20% (가진 만큼만)
  QP.SWAP_NEAR = 3; // 바꾸기: 위아래 3등 안
  QP.KIND_NAME = {
    gain: '금 주머니',
    double: '금 두 배',
    none: '꽝',
    shield: '방패',
    stealPick: '지정 뺏기',
    stealRand: '랜덤 뺏기',
    swapPick: '지정 바꾸기',
    swapRand: '랜덤 바꾸기',
  };

  QP.drawKind = function (r) {
    let x = r();
    for (const k in QP.CHEST_P) {
      x -= QP.CHEST_P[k];
      if (x < 0) return k;
    }
    return 'none';
  };
  QP.gainAmount = (r, round, cfg) => Math.round(r.pick(QP.GAIN) * (1 + cfg.grow * (round - 1)));
  QP.doubleAmount = (gold) => Math.min(QP.DOUBLE[1], Math.max(QP.DOUBLE[0], gold));
  QP.stealAmount = (victimGold) => Math.min(victimGold, Math.round(victimGold * QP.STEAL));

  // 맞혔을 때 바로 받는 금 (상자와 따로)
  QP.answerBonus = function (cfg, secs, streak, round) {
    const out = { base: Math.round(cfg.base * (1 + cfg.grow * (round - 1))), fast: 0, streak: 0 };
    if (cfg.fastOn) for (const [s, v] of cfg.fast) if (secs <= s) { out.fast = v; break; }
    if (cfg.streakOn) for (const [n, v] of cfg.streak) if (streak >= n) { out.streak = v; break; }
    return out;
  };

  // board: 상자 시간 시작 때 순위 [{sid, gold}] (1등부터)
  QP.stealTargets = (board, mySid) => board.filter((b) => b.sid !== mySid && b.gold > 0).map((b) => b.sid);
  QP.swapTargets = function (board, mySid) {
    const i = board.findIndex((b) => b.sid === mySid);
    return board.filter((b, k) => b.sid !== mySid && Math.abs(k - i) <= QP.SWAP_NEAR).map((b) => b.sid);
  };

  // 순위 매기기: 금 많은 순, 같으면 먼저 그 금에 닿은 순서 대신 별명 순(흔들리지 않게)
  QP.rankSeats = (seats) => seats.slice().sort((a, b) => b.gold - a.gold || (a.nick < b.nick ? -1 : 1));
  // 등수: 금이 같으면 같은 등수(공동), 금이 0이면 등수 없음(0) — 아무도 답을 안 낸 처음에 0점끼리 등수가 붙지 않게
  QP.rankOfGold = (gold, all) => (gold > 0 ? 1 + all.filter((g) => g > gold).length : 0);
  QP.PODIUM = 5;
})(typeof window !== 'undefined' ? window : globalThis);
