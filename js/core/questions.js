/* questions.js — 문제 묶음 읽기·검사·아이별 문제 순서·계산 문제 자동 생성
 *
 * 묶음 파일(questions/*.json):
 *   { id, title, subject, grade, source, test?(시험용이면 true),
 *     questions: [
 *       { type:'choice', q, answer, wrong:[오답 1~3개], explain?, time?, img? },
 *       { type:'ox', q, answer:'O'|'X', explain?, time?, img? },
 *       { type:'short', q, answer:['정답', '같은 답 다른 표기'…], explain?, time?, img? }   // 숫자 답만(아이는 숫자판으로 낸다)
 *     ] }
 * time: 이 문제만 20초보다 길게 줄 때(초). img: 그림 파일 경로(questions/img/…).
 */
(function (root) {
  'use strict';
  const QP = root.QP;

  const LIM = { q: 90, choice: 24, explain: 70 };
  // 묶음 검사: { errors:[], warns:[] } — tools/check-questions.mjs 와 선생님 화면이 같이 쓴다
  QP.checkPack = function (p) {
    const errors = [],
      warns = [];
    const E = (i, m) => errors.push((i === null ? '' : i + 1 + '번: ') + m);
    const W = (i, m) => warns.push((i === null ? '' : i + 1 + '번: ') + m);
    if (!p || typeof p !== 'object') return { errors: ['JSON 모양이 아니에요'], warns };
    if (!p.id || !/^[a-z0-9-]+$/.test(p.id)) E(null, 'id 는 영어 소문자·숫자·- 만 (예: sci-5-2-weather)');
    if (!p.title) E(null, 'title(묶음 이름)이 없어요');
    if (!p.subject) W(null, 'subject(과목)가 없어요');
    if (!p.source && !p.test) W(null, 'source(출처: 지도서 몇 쪽)가 없어요');
    if (!Array.isArray(p.questions) || !p.questions.length) {
      E(null, 'questions 가 비었어요');
      return { errors, warns };
    }
    const seen = new Set();
    p.questions.forEach((x, i) => {
      if (!x || typeof x !== 'object') return E(i, '문제 모양이 아니에요');
      const t = x.type || 'choice';
      if (!['choice', 'ox', 'short'].includes(t)) E(i, 'type 은 choice / ox / short');
      if (!x.q || typeof x.q !== 'string') E(i, 'q(문제 글)가 없어요');
      else {
        if (x.q.length > LIM.q) W(i, '문제 글이 길어요(' + x.q.length + '자, ' + LIM.q + '자 넘음). time 을 늘리거나 줄여 주세요');
        if (seen.has(x.q)) W(i, '같은 문제 글이 또 있어요');
        seen.add(x.q);
      }
      if (x.explain && x.explain.length > LIM.explain) W(i, '풀이가 길어요(' + x.explain.length + '자)');
      if (!x.explain) W(i, 'explain(틀렸을 때 한 줄 풀이)이 없어요');
      if (x.time !== undefined && !(x.time >= 10 && x.time <= 90)) E(i, 'time 은 10~90초');
      if (t === 'choice') {
        if (typeof x.answer !== 'string' || !x.answer.trim()) E(i, 'answer(정답)가 없어요');
        if (!Array.isArray(x.wrong) || x.wrong.length < 1 || x.wrong.length > 3) E(i, 'wrong(오답)은 1~3개');
        else {
          const all = [x.answer, ...x.wrong].map((s) => String(s).trim());
          if (new Set(all).size !== all.length) E(i, '보기가 겹쳐요(정답이 오답에 있거나 같은 오답 두 번)');
          else if (new Set(all.map((s) => QP.ansHash(s))).size !== all.length) E(i, '보기 지문이 겹쳐요(보기 글을 조금 바꿔 주세요)');
          all.forEach((s) => s.length > LIM.choice && W(i, '보기 "' + s.slice(0, 10) + '…"가 길어요(' + s.length + '자)'));
          if (x.wrong.some((s) => !String(s).trim())) E(i, '빈 오답이 있어요');
        }
      } else if (t === 'ox') {
        if (x.answer !== 'O' && x.answer !== 'X') E(i, 'ox 문제의 answer 는 "O" 또는 "X"(영어 대문자)');
      } else if (t === 'short') {
        const a = Array.isArray(x.answer) ? x.answer : [x.answer];
        if (!a.length || a.some((s) => typeof s !== 'string' || !s.trim())) E(i, 'short 문제의 answer 는 ["정답", …]');
        else if (a.some((s) => !/^-?[0-9]+([./][0-9]+)?$/.test(s.trim()))) E(i, 'short 문제는 숫자 답만 돼요(아이는 숫자판으로 써요). 글 답은 choice 로');
      }
    });
    return { errors, warns };
  };

  /* ---------- 계산 문제 자동 생성 (교과서 없이 맞는 것만. 단원 이름은 로컬 세션이 붙인다) ---------- */
  const near = (r, ans, n, spread) => {
    const out = new Set();
    let guard = 0;
    while (out.size < n && guard++ < 200) {
      const d = r.pick([1, 2, spread || 10, -1, -2, -(spread || 10), 3, -3]);
      const v = ans + d;
      if (v > 0 && v !== ans) out.add(v);
    }
    return [...out].map(String);
  };
  QP.GEN = {
    mul: { title: '곱셈구구', make: (r) => { const a = 2 + r.int(8), b = 2 + r.int(8); return { q: a + ' × ' + b + ' = ?', answer: String(a * b), wrong: near(r, a * b, 3, a), explain: a + '를 ' + b + '번 더하면 ' + a * b + '예요.' }; } },
    mul2: { title: '두 자리 수 × 한 자리 수', make: (r) => { const a = 11 + r.int(89), b = 2 + r.int(8); return { q: a + ' × ' + b + ' = ?', answer: String(a * b), wrong: near(r, a * b, 3, 10), explain: a + ' × ' + b + ' = ' + a * b }; } },
    div: { title: '나눗셈', make: (r) => { const a = 2 + r.int(8), b = 2 + r.int(8); return { q: a * b + ' ÷ ' + a + ' = ?', answer: String(b), wrong: near(r, b, 3, 2), explain: a + ' × ' + b + ' = ' + a * b + ' 이니까 ' + b + '예요.' }; } },
    add: { title: '세 자리 수 덧셈', make: (r) => { const a = 100 + r.int(800), b = 100 + r.int(99); return { q: a + ' + ' + b + ' = ?', answer: String(a + b), wrong: near(r, a + b, 3, 10), explain: a + ' + ' + b + ' = ' + (a + b) }; } },
    sub: { title: '세 자리 수 뺄셈', make: (r) => { const a = 300 + r.int(600), b = 100 + r.int(199); return { q: a + ' − ' + b + ' = ?', answer: String(a - b), wrong: near(r, a - b, 3, 10), explain: a + ' − ' + b + ' = ' + (a - b) }; } },
    dec: {
      title: '소수 한 자리 덧셈',
      make: (r) => {
        const a = 1 + r.int(89), b = 1 + r.int(89), s = a + b;
        const f = (v) => (v / 10).toFixed(1);
        const w = new Set([f(s + 1), f(s - 1), f(s + 10), String(a + b)].filter((x) => x !== f(s) && parseFloat(x) > 0));
        return { q: f(a) + ' + ' + f(b) + ' = ?', answer: f(s), wrong: [...w].slice(0, 3), explain: '0.1이 ' + a + '개, ' + b + '개 → ' + s + '개라서 ' + f(s) + '예요.' };
      },
    },
    frac: {
      title: '분모가 같은 분수의 덧셈',
      make: (r) => {
        const d = 5 + r.int(8), a = 1 + r.int(d - 2), b = 1 + r.int(d - 1 - a);
        const w = [b + a + '/' + (d + d), Math.max(1, a + b - 1) + '/' + d, a + b + 1 + '/' + d].filter((x) => x !== a + b + '/' + d);
        return { q: a + '/' + d + ' + ' + b + '/' + d + ' = ?', answer: a + b + '/' + d, wrong: [...new Set(w)].slice(0, 3), explain: '분모는 그대로, 분자끼리 더해요: ' + a + ' + ' + b + ' = ' + (a + b) };
      },
    },
  };
  // 자동 생성 묶음 하나 (판을 만들 때 seed 로 40문제를 뽑아 보통 묶음처럼 쓴다)
  QP.genPack = function (kind, seed, n) {
    const g = QP.GEN[kind],
      r = QP.rng(seed);
    const qs = [],
      seen = new Set();
    let guard = 0;
    while (qs.length < (n || 40) && guard++ < 500) {
      const x = g.make(r);
      if (seen.has(x.q)) continue;
      seen.add(x.q);
      qs.push(Object.assign({ type: 'choice' }, x));
    }
    return { id: 'gen-' + kind, title: g.title + ' (자동)', subject: '계산', gen: true, questions: qs };
  };

  /* ---------- 판에서 쓰는 문제 목록 ---------- */
  // packs → [{id:'묶음#번호', pack, type, q, answer, wrong, explain, time, img}]
  QP.flatten = function (packs) {
    const out = [];
    for (const p of packs)
      p.questions.forEach((x, i) => out.push(Object.assign({ type: 'choice' }, x, { id: p.id + '#' + i, pack: p.id, test: !!p.test })));
    return out;
  };
  // 아이에게 보낼 모양(정답 없음). 보기는 아이마다 섞는다.
  QP.serveQ = function (x, r) {
    const out = { id: x.id, type: x.type, q: x.q };
    if (x.img) out.img = x.img;
    if (x.time) out.time = x.time;
    if (x.test) out.test = true;
    if (x.type === 'choice') out.ch = r.shuffle([x.answer, ...x.wrong].map(String));
    return out;
  };
  // 아이 답은 서버 규칙상 12글자까지만 쓸 수 있다(firestore.rules okKid 의 a.v). 긴 보기는 앞 12글자만 보내고 여기서 맞춰 본다.
  // (QP.ANS_MAX·QP.ansToSend 는 아이 화면도 쓰므로 qp.js 에 있다)
  const head = (t) => String(t).trim().slice(0, QP.ANS_MAX).trim();
  // 받은 답(앞 12글자일 수 있음) → 보기 원래 글
  QP.expandAns = function (x, v) {
    if (v === undefined || v === null || x.type !== 'choice') return v;
    const s = String(v).trim();
    const all = [x.answer, ...(x.wrong || [])].map((t) => String(t).trim());
    // 그대로 → 지문(#…) → 예전 방식(앞 12글자, 배포 7 화면)
    return all.find((t) => t === s) || (s[0] === '#' && all.find((t) => QP.ansHash(t) === s)) || all.find((t) => t.length > QP.ANS_MAX && head(t) === s) || s;
  };
  QP.isRight = function (x, v) {
    if (v === undefined || v === null) return false;
    const s = String(v).trim();
    if (x.type === 'short') return (Array.isArray(x.answer) ? x.answer : [x.answer]).some((a) => a.trim() === s);
    if (x.type === 'choice') return String(QP.expandAns(x, s)).trim() === String(x.answer).trim();
    return String(x.answer).trim() === s;
  };
  QP.answerText = (x) => (Array.isArray(x.answer) ? x.answer[0] : String(x.answer));

  // 아이마다 다른 순서. 틀린 문제는 3문제 뒤에 다시 나온다. 다 쓰면 다시 섞는다.
  QP.Deck = {
    make(ids, r) {
      return r.shuffle(ids.slice());
    },
    next(deck, ids, r) {
      if (!deck.length) deck.push(...r.shuffle(ids.slice()));
      return deck.shift();
    },
    retry(deck, id) {
      deck.splice(Math.min(3, deck.length), 0, id);
    },
  };
})(typeof window !== 'undefined' ? window : globalThis);
