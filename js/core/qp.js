/* qp.js — 퀴즈 파티 공통: 이름 공간·난수·시간·번호 (브라우저와 node 봇이 같이 쓴다. 화면 코드 없음) */
(function (root) {
  'use strict';
  const QP = (root.QP = root.QP || {});

  // 출석 번호: 실제 반은 1~15, 51~63. 서버 규칙(okNum)은 1~18, 51~66까지 받는다.
  QP.NUMS = [...Array(15)].map((_, i) => i + 1).concat([...Array(13)].map((_, i) => i + 51));
  QP.okNum = (n) => Number.isInteger(n) && ((n >= 1 && n <= 18) || (n >= 51 && n <= 66));
  // 아이가 자기 자리 문서에 쓸 수 있는 칸 (서버 규칙과 같아야 한다)
  QP.KID_KEYS = ['a', 'c', 'tg', 'seen', 'tab'];

  // 시간: 봇 시험은 QP.timeScale 을 줄여 빨리 돌린다(모든 타이머가 이것을 곱한다)
  QP.timeScale = 1;
  QP.ms = (sec) => sec * 1000 * QP.timeScale;
  QP.sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  // 연결 상태 시간(초): 숨쉬기 신호 간격, "끊김"으로 보는 조용한 시간
  // 아이 답은 서버 규칙상 12글자까지(firestore.rules okKid 의 a.v). 긴 보기는 앞 12글자만 보내고 심판이 맞춰 본다(questions.js QP.expandAns)
  QP.ANS_MAX = 12;
  QP.ansToSend = (v) => String(v).slice(0, QP.ANS_MAX);
  QP.HEARTBEAT = 10;
  QP.STALE = 25;

  // 재현되는 난수
  QP.rng = function (seed) {
    let s = (seed >>> 0) || 1;
    const r = () => {
      s += 0x6d2b79f5;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    r.int = (n) => Math.floor(r() * n);
    r.pick = (a) => a[Math.floor(r() * a.length)];
    r.shuffle = (a) => {
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(r() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
      }
      return a;
    };
    return r;
  };
  QP.id = (n) => {
    const A = 'abcdefghijkmnpqrstuvwxyz23456789';
    let s = '';
    for (let i = 0; i < (n || 8); i++) s += A[Math.floor(Math.random() * A.length)];
    return s;
  };
  QP.clone = (o) => JSON.parse(JSON.stringify(o));
})(typeof window !== 'undefined' ? window : globalThis);
