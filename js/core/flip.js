/* flip.js — 「도깨비 뒤집기」 규칙과 셈 (작업/결정-뒤집기.md). 화면 코드 없음: 선생님 화면·아이 화면·node 봇이 같이 쓴다.
 *
 * 처음 종족은 무작위 반반(비밀), 반에서 1명은 악마(비밀). 문제 per개 → 뒤집기(tChoose초 눈치게임) → 결과 → … R라운드 → 최종 결과.
 * 뒤집기: 맞힌 수만큼(최대 maxPick) 친구를 고름(나도 고를 수 있음). 한 번 골라질 때마다 종족이 바뀜(홀수 번 = 뒤집힘).
 * 이기는 무리: 악마가 없는 다수 무리, 다수에 악마가 있으면 소수 무리 → 끝날 때 그 무리에 있는 아이 모두 승리(2026-11-06 담임). 처음 종족을 끝까지 지킨 아이는 「끝까지」 칭찬. 악마는 다수 쪽에 끼어 있으면 승리. 동점이면 아무도 못 이김.
 * 악마 힌트: 반 전체 정답이 판 전체 최대 정답의 60% → 「악마는 이 5명 중」, 70% → 3명, 80% → 1명(공개).
 * 아이가 보내는 것: 자리 문서 tg{r: flCode(라운드), sid: 고른 친구들의 명단 번호(36진 한 글자씩)} — 있던 칸이라 규칙 게시 불필요
 */
(function (root) {
  'use strict';
  const QP = root.QP;

  QP.FLIP_CFG = {
    mode: 'flip',
    per: 5,
    R: 4, // 라운드 수
    maxPick: 3, // 한 라운드에 고를 수 있는 친구 수(맞힌 수만큼, 이것까지)
    tChoose: 15,
    tWait: 1.0, // 마감 뒤 늦게 온 선택 기다림
    tQ: 20,
    tReveal: 4,
    tResult: 9, // 라운드 결과
    tSnap: 5, // TV 현황 묶음 간격
    tHide: 5, // 마감 이만큼 전부터 TV 현황 가림
    hints: [[0.6, 5], [0.7, 3], [0.8, 1]], // [정답 비율, 후보 수]
    minutes: 99,
  };
  QP.FL_SP = { g: '도깨비', h: '인간' };
  QP.flCode = (r) => 2000 + r;
  QP.flChar = (i) => i.toString(36);
  // 같은 친구를 여러 번 고를 수 있다(중복 투표, 2026-11-06 담임) — 글자 하나 = 한 표
  QP.flParse = (s) => String(s || '').split('').map((c) => parseInt(c, 36)).filter((n) => n >= 0);
  QP.flFlip = (sp) => (sp === 'g' ? 'h' : 'g');
  // 고른 수만큼 셈: picks = {고른 아이 sid: [대상 명단 번호…]} → 명단 번호 → 골라진 횟수
  QP.flCount = function (picks) {
    const n = {};
    for (const list of Object.values(picks)) for (const i of list) n[i] = (n[i] || 0) + 1;
    return n;
  };
  // TV 현황 세 단계
  QP.flLevel = (g, h) => (g - h >= 3 ? 'g' : h - g >= 3 ? 'h' : 'm');
  // 최종 판정: rows = [{sid, o, now, devil}] → {g, h, maj, winside, rows(win 붙임)}
  QP.flJudge = function (rows) {
    const g = rows.filter((x) => x.now === 'g').length,
      h = rows.length - g;
    const maj = g > h ? 'g' : h > g ? 'h' : '';
    const dv = rows.find((x) => x.devil);
    const devilIn = dv ? dv.now : '';
    const winside = !maj ? '' : devilIn === maj ? QP.flFlip(maj) : maj;
    // 끝날 때 이긴 무리에 있으면 승리(뒤집혀 넘어온 친구도). loyal = 처음 종족을 끝까지 지킴(칭찬)
    const out = rows.map((x) => Object.assign({}, x, { win: x.devil ? !!maj && devilIn === maj : !!winside && x.now === winside, loyal: x.o === x.now }));
    return { g, h, maj, winside, devilIn, rows: out };
  };
})(typeof window !== 'undefined' ? window : globalThis);
