/* qp.js — 퀴즈 파티 공통: 이름 공간·난수·시간·번호 (브라우저와 node 봇이 같이 쓴다. 화면 코드 없음) */
(function (root) {
  'use strict';
  const QP = (root.QP = root.QP || {});

  // 출석 번호: 실제 반은 1~15, 51~63. 서버 규칙(okNum)은 1~18, 51~66까지 받는다.
  QP.NUMS = [...Array(15)].map((_, i) => i + 1).concat([...Array(13)].map((_, i) => i + 51));
  QP.okNum = (n) => Number.isInteger(n) && ((n >= 1 && n <= 18) || (n >= 51 && n <= 66));
  // 아이가 자기 자리 문서에 쓸 수 있는 칸 (서버 규칙과 같아야 한다)
  // a 답, c 상자, tg 지목·뺏기 대상, mg 돋보기 대상(도깨비 찾기), v 찬성/반대(도깨비 찾기), seen 숨쉬기, tab 탭 주인
  QP.KID_KEYS = ['a', 'c', 'tg', 'mg', 'v', 'seen', 'tab'];

  // 도깨비 찾기 인형: 동물 7 × 색 4 = 28가지(작업/결정-마피아.md 2절). 별명 = 「파란 곰」. 아바타 번호 1000 + 동물*4 + 색
  QP.MAFIA_ANIMALS = [['곰', 0], ['토끼', 1], ['고양이', 2], ['여우', 3], ['개구리', 4], ['판다', 6], ['펭귄', 8]]; // [이름, dolls.js ANIMALS 번호]
  QP.MAFIA_COLORS = [['빨간', '#d9573f'], ['파란', '#3f7fa8'], ['노란', '#e0a93a'], ['초록', '#5f9a55']];
  QP.mafiaAvatar = (k) => 1000 + k; // k = 동물*4 + 색 (0~27)
  QP.mafiaNick = (av) => {
    const k = av - 1000;
    return QP.MAFIA_COLORS[k % 4][0] + ' ' + QP.MAFIA_ANIMALS[Math.floor(k / 4)][0];
  };

  // 시간: 봇 시험은 QP.timeScale 을 줄여 빨리 돌린다(모든 타이머가 이것을 곱한다)
  QP.timeScale = 1;
  QP.ms = (sec) => sec * 1000 * QP.timeScale;
  QP.sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  // 연결 상태 시간(초): 숨쉬기 신호 간격, "끊김"으로 보는 조용한 시간
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
  // 조사: 받침이 있으면 a, 없으면 b — QP.josa('여우', '이', '가') → '가'
  // 아이 답은 서버 규칙상 12글자까지(firestore.rules okKid 의 a.v). 긴 보기는 앞 12글자만 보내고 심판이 맞춰 본다(questions.js QP.expandAns)
  // 소문 묶기: [{r,sid,g}] → [{sid,g,n,r(가장 최근)}] 최근 것부터
  QP.groupRumors = function (list) {
    const by = new Map();
    for (const x of list || []) {
      const k = x.sid + (x.g ? 'Y' : 'N');
      const o = by.get(k) || { sid: x.sid, g: x.g, n: 0, r: 0, i: 0 };
      o.n++;
      o.r = x.r;
      o.i = by.size + o.n;
      by.set(k, o);
    }
    return [...by.values()].sort((a, b) => b.r - a.r || b.i - a.i);
  };
  // 도깨비 찾기 투표 막대: 찬성이 절반을 넘어야 공개(가운데 선 = 절반)
  QP.voteBar = function (yes, no, n) {
    n = Math.max(1, n);
    const need = Math.floor(n / 2) + 1;
    return '<div class="vbar"><i class="y" style="width:' + (100 * yes) / n + '%"></i><i class="no" style="width:' + (100 * no) / n + '%"></i><span class="half"></span><em class="hl">절반</em></div>' +
      '<p class="vbarlab">찬성 <b>' + yes + '</b> · 반대 ' + no + (n - yes - no > 0 ? ' · 안 냄 ' + (n - yes - no) : '') + ' <small>(공개되려면 찬성 ' + need + '표)</small></p>';
  };
  QP.ANS_MAX = 12;
  // 12글자가 넘는 보기는 '#' + 짧은 지문(해시)으로 보낸다. 앞부분이 같은 보기(예 「7/10 × 4/10 = 28/100」·「… = 28/10」)도 가린다
  QP.ansHash = function (t) {
    let h = 0x811c9dc5;
    const s = String(t).trim();
    for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193);
    return '#' + (h >>> 0).toString(36);
  };
  QP.ansToSend = (v) => (String(v).length <= QP.ANS_MAX ? String(v) : QP.ansHash(v));
  QP.josa = (w, a, b) => {
    const c = String(w || '').charCodeAt(String(w || '').length - 1);
    return c >= 0xac00 && c <= 0xd7a3 && (c - 0xac00) % 28 ? a : b;
  };
})(typeof window !== 'undefined' ? window : globalThis);
