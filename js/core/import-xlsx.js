/* import-xlsx.js — 엑셀(우리 양식·카훗 가져오기 양식) → 문제 묶음
 * 선생님 화면(teacher-ui.js, 엑셀은 lib/xlsx.mini.min.js 로 읽음)과 node 도구(tools/excel-to-questions.mjs)가 같이 쓴다.
 * 화면 코드 없음. 엑셀 칸 읽기는 바깥에서 하고, 여기는 [시트 이름, 줄들(칸 값 배열)]만 받는다.
 *   칸 값: 글자 / 숫자 / Date(날짜로 바뀐 칸) / true·false / null
 * 규칙: 작업/결정-문제넣기-구현.md (예전 tools/excel-to-questions.py 를 옮김)
 *   우리 양식: 시트 하나 = 묶음 하나, 첫 줄 「유형 | 문제 | 정답 | 오답1 | 오답2 | 오답3 | 풀이 | 시간(초)」
 *     「읽어 주세요」「묶음 목록」 시트는 묶음이 아니다(「묶음 목록」의 과목·학년·출처는 읽는다). 「예시」 시트는 opts.examples 일 때만(시험용 표시)
 *   카훗 가져오기 양식: 제목 줄(Question… / Answer 1~4… / Correct answer(s)…)을 찾아서 읽는다. 시간 칸은 버린다.
 * 돌려줌: { packs: [{ sheet, pack, errors[], warns[] }], notes[] } — 오류가 있는 묶음은 넣지 않는다.
 */
(function (root) {
  'use strict';
  const QP = root.QP;
  const HEAD = ['유형', '문제', '정답', '오답1', '오답2', '오답3', '풀이', '시간(초)'];
  const SKIP = ['읽어 주세요', '묶음 목록'];
  const KIND = { 객관식: 'choice', ox: 'ox', 'o/x': 'ox', 'o x': 'ox', 단답: 'short', 주관식: 'short' };
  const SUBJECTS = ['국어', '수학', '사회', '과학', '영어', '도덕', '음악', '미술', '체육', '실과'];
  const PLAIN_SHEET = /^(sheet|시트)\s*\d*$/i;
  const LONG_OPT = 24;
  const DATE = '\u0000날짜';

  // 칸 값 → 글자 (날짜로 바뀐 칸은 표시)
  function cell(v) {
    if (v === null || v === undefined) return '';
    if (v instanceof Date) return DATE;
    if (typeof v === 'number') return Number.isInteger(v) ? String(v) : String(+v.toPrecision(10));
    if (typeof v === 'boolean') return v ? 'O' : 'X';
    return String(v).replace(/\s+/g, ' ').trim();
  }
  // 짧은 해시(묶음 id)
  function hash(s) {
    let h1 = 0x811c9dc5,
      h2 = 0x12345;
    for (let i = 0; i < s.length; i++) {
      const c = s.charCodeAt(i);
      h1 = Math.imul(h1 ^ c, 0x01000193) >>> 0;
      h2 = Math.imul(h2 ^ c, 0x5bd1e995) >>> 0;
    }
    return (h1.toString(36) + h2.toString(36)).slice(0, 10);
  }
  QP.packIdFor = (title) => 'my-' + hash(title);
  const normOX = (s) => s.toUpperCase().replace(/[○ＯO0]/g, 'O').replace(/[×ＸX✕]/g, 'X');
  const isNum = (s) => /^-?[0-9]+([./][0-9]+)?$/.test(s);

  function fileTitle(name) {
    let t = String(name || '').replace(/\.[^.]+$/, '');
    t = t.replace(/[_\s]*(카훗|kahoot)[_\s]*/gi, ' ').replace(/_\d+$/, '');
    return t.replace(/[_\s]+/g, ' ').trim();
  }
  function readIndex(rows) {
    const info = {};
    for (const row of rows.slice(1)) {
      const name = cell(row[0]);
      if (!name) continue;
      const g = cell(row[2]);
      info[name] = { subject: cell(row[1]), grade: /^\d+$/.test(g) ? +g : null, source: cell(row[3]) };
    }
    return info;
  }
  function kahootHead(rows) {
    for (let i = 0; i < Math.min(12, rows.length); i++) {
      const h = (rows[i] || []).map((v) => cell(v).toLowerCase());
      const q = h.findIndex((x) => x.startsWith('question'));
      const ok = h.findIndex((x) => x.startsWith('correct answer'));
      if (q < 0 || ok < 0) continue;
      const answers = [];
      h.forEach((x, c) => /^answer \d/.test(x) && answers.push(c));
      return { row: i, q, ok, answers };
    }
    return null;
  }

  function readKahoot(rows, k, at, errors, warns) {
    const out = [],
      seen = {};
    for (let r = k.row + 1; r < rows.length; r++) {
      const row = rows[r] || [];
      const get = (c) => (c >= 0 && c < row.length ? cell(row[c]) : '');
      const q = get(k.q);
      if (!q) continue;
      const line = at(r + 1);
      const opts = k.answers.map(get);
      if (q === DATE || opts.includes(DATE)) {
        errors.push(line + "보기가 날짜로 바뀌었어요. 앞에 ' 를 붙여 '1/2 처럼 써 주세요.");
        continue;
      }
      const picks = (get(k.ok).match(/\d+/g) || []).map(Number);
      if (!picks.length) {
        errors.push(line + '정답 번호(Correct answer) 칸이 비어 있어요.');
        continue;
      }
      if (picks.length > 1) {
        warns.push(line + '정답이 여러 개인 문제는 이 게임에서 쓸 수 없어서 건너뛰었어요.');
        continue;
      }
      const ai = picks[0] - 1;
      if (ai < 0 || ai >= opts.length || !opts[ai]) {
        errors.push(line + '정답 번호 ' + picks[0] + '번 보기가 비어 있어요.');
        continue;
      }
      const ans = opts[ai];
      const wrong = opts.filter((o, i) => o && i !== ai);
      if (!wrong.length) {
        errors.push(line + '보기가 하나뿐이에요.');
        continue;
      }
      if (seen[q]) warns.push(line + seen[q] + '번 줄과 같은 문제예요.');
      seen[q] = r + 1;
      const set = new Set([ans, ...wrong].map(normOX));
      let item;
      if (wrong.length === 1 && set.size === 2 && set.has('O') && set.has('X')) item = { type: 'ox', q, answer: normOX(ans) };
      else {
        if (wrong.includes(ans)) {
          errors.push(line + '정답 「' + ans + '」이(가) 다른 보기에도 있어요.');
          continue;
        }
        if (new Set(wrong).size !== wrong.length) {
          errors.push(line + '같은 보기가 두 번 있어요.');
          continue;
        }
        if (wrong.length === 1) warns.push(line + '보기가 2개뿐이에요.');
        for (const o of [ans, ...wrong]) if (o.length > LONG_OPT) warns.push(line + '보기 「' + o.slice(0, 12) + '…」가 ' + o.length + '자로 길어요. 단추에 안 들어갈 수 있어요.');
        item = { type: 'choice', q, answer: ans, wrong };
      }
      out.push(item);
    }
    return out;
  }

  function readOurs(rows, at, errors, warns) {
    const head = (rows[0] || []).map(cell);
    const col = {};
    for (const h of HEAD) {
      const i = head.indexOf(h);
      if (i < 0) {
        errors.push(at(1) + '첫 줄에 「' + h + '」 칸이 없어요. 양식의 노란 제목 줄을 그대로 두세요.');
        return [];
      }
      col[h] = i;
    }
    const out = [],
      seen = {};
    for (let r = 1; r < rows.length; r++) {
      const row = rows[r] || [];
      const v = {};
      for (const h of HEAD) v[h] = col[h] < row.length ? cell(row[col[h]]) : '';
      if (!HEAD.some((h) => v[h])) continue;
      const line = at(r + 1);
      const dated = HEAD.filter((h) => v[h] === DATE);
      if (dated.length) {
        errors.push(line + '「' + dated.join('·') + "」 칸이 날짜로 바뀌었어요. 앞에 ' 를 붙여 '1/2 처럼 써 주세요.");
        continue;
      }
      const kind = v['유형'] ? KIND[v['유형'].toLowerCase()] : 'choice'; // 담임: 객관식만 낸다 → 유형을 비우면 객관식
      if (!kind) {
        errors.push(line + '유형 「' + v['유형'] + '」을(를) 모르겠어요. 비워 두면 객관식이에요(OX·단답도 돼요).');
        continue;
      }
      const q = v['문제'];
      if (!q) {
        errors.push(line + '문제 칸이 비어 있어요.');
        continue;
      }
      if (seen[q]) warns.push(line + seen[q] + '번 줄과 같은 문제예요.');
      seen[q] = r + 1;
      const ans = v['정답'];
      const wrong = [v['오답1'], v['오답2'], v['오답3']].filter(Boolean);
      if (!ans) {
        errors.push(line + '정답 칸이 비어 있어요.');
        continue;
      }
      const item = { type: kind, q };
      if (kind === 'choice') {
        if (!wrong.length) {
          errors.push(line + '객관식은 오답이 1개 이상 있어야 해요(3개 권해요).');
          continue;
        }
        if (wrong.includes(ans)) {
          errors.push(line + '정답 「' + ans + '」이(가) 오답 칸에도 있어요.');
          continue;
        }
        if (new Set(wrong).size !== wrong.length) {
          errors.push(line + '같은 오답이 두 번 있어요.');
          continue;
        }
        if (wrong.length < 3) warns.push(line + '오답이 ' + wrong.length + '개라 보기가 ' + (wrong.length + 1) + '개만 나와요.');
        for (const o of [ans, ...wrong]) if (o.length > LONG_OPT) warns.push(line + '보기 「' + o.slice(0, 12) + '…」가 ' + o.length + '자로 길어요. 단추에 안 들어갈 수 있어요.');
        item.answer = ans;
        item.wrong = wrong;
      } else if (kind === 'ox') {
        const a = normOX(ans);
        if (a !== 'O' && a !== 'X') {
          errors.push(line + 'OX 문제의 정답은 O 또는 X로 써 주세요(지금: 「' + ans + '」).');
          continue;
        }
        if (wrong.length) warns.push(line + 'OX 문제는 오답 칸을 쓰지 않아요. 무시했어요.');
        item.answer = a;
      } else {
        const answers = ans.split('/').map((s) => s.trim()).filter(Boolean);
        // 분수 답(3/4)은 / 로 나누지 않는다: 숫자/숫자 하나면 분수로 본다
        const list = /^-?\d+\/\d+$/.test(ans.trim()) ? [ans.trim()] : answers;
        if (!list.length) {
          errors.push(line + '단답 정답이 비어 있어요.');
          continue;
        }
        if (list.some((s) => !isNum(s))) {
          errors.push(line + '단답은 숫자 답만 돼요(아이는 숫자판으로 써요). 글로 답하는 문제는 객관식으로 바꿔 주세요.');
          continue;
        }
        if (wrong.length) warns.push(line + '단답 문제는 오답 칸을 쓰지 않아요. 무시했어요.');
        item.answer = list;
      }
      if (v['풀이']) item.explain = v['풀이'];
      if (v['시간(초)']) {
        const t = v['시간(초)'];
        if (!/^\d+$/.test(t) || +t < 10 || +t > 90) {
          errors.push(line + '시간은 10~90 사이 숫자로 써 주세요(지금: 「' + t + '」). 비우면 선생님 화면에서 정한 시간이에요.');
          continue;
        }
        item.time = +t;
      }
      out.push(item);
    }
    return out;
  }

  // book: [{ name, rows }], fileName: 파일 이름, opts.examples: 「예시」 시트도(시험용)
  QP.importWorkbook = function (book, fileName, opts) {
    opts = opts || {};
    const res = { packs: [], notes: [] };
    const names = book.map((s) => s.name.trim());
    // 카훗 결과 보고서(게임 기록)는 모양이 다르다
    if (names.some((n) => /^(overview|final scores|raw report data|kahoot! summary)$/i.test(n))) {
      res.notes.push('「' + fileName + '」은(는) 카훗 결과 보고서 같아요. 카훗 결과 보고서는 아직 못 읽어요. 카훗 「가져오기 양식」 엑셀이나 우리 양식을 써 주세요.');
      return res;
    }
    const idxSheet = book.find((s) => s.name.trim() === '묶음 목록');
    const info = idxSheet ? readIndex(idxSheet.rows) : {};
    for (const s of book) {
      const sheet = s.name.trim();
      if (SKIP.includes(sheet)) continue;
      const example = sheet.startsWith('예시');
      if (example && !opts.examples) continue;
      let title = sheet;
      if (PLAIN_SHEET.test(sheet)) title = fileTitle(fileName) + (book.length === 1 ? '' : ' ' + sheet);
      const errors = [],
        warns = [];
      const at = (r) => '「' + title + '」 ' + r + '번 줄: ';
      const rows = s.rows || [];
      if (!rows.some((r) => r && r.some((c) => cell(c)))) {
        if (!/^새 묶음/.test(sheet)) res.notes.push('「' + title + '」 시트는 비어 있어서 건너뛰었어요.');
        continue;
      }
      const k = kahootHead(rows);
      const qs = k ? readKahoot(rows, k, at, errors, warns) : readOurs(rows, at, errors, warns);
      if (!qs.length && !errors.length) {
        if (!/^새 묶음/.test(sheet)) res.notes.push('「' + title + '」에 문제가 하나도 없어서 건너뛰었어요.');
        continue;
      }
      const meta = info[sheet] || {};
      const pack = {
        id: QP.packIdFor(title),
        title,
        subject: meta.subject || SUBJECTS.find((x) => title.startsWith(x)) || (example ? '시험용' : '기타'),
        grade: meta.grade || 5,
        source: meta.source || '엑셀 ' + fileName,
        questions: qs,
      };
      if (example) pack.test = true;
      // 게임의 묶음 검사도 한 번 더(문제 글 길이 등)
      const chk = QP.checkPack(pack);
      for (const e of chk.errors) if (!errors.includes(e)) errors.push('「' + title + '」 ' + e.replace(/^(\d+)번: /, '$1번째 문제: '));
      for (const w of chk.warns) if (!/explain|source|보기 "/.test(w)) warns.push('「' + title + '」 ' + w.replace(/^(\d+)번: /, '$1번째 문제: '));
      if (res.packs.some((p) => p.pack.title === title)) {
        errors.push('「' + title + '」 같은 이름의 묶음이 이 파일에 또 있어요. 시트 이름을 바꿔 주세요.');
      }
      res.packs.push({ sheet, pack, errors, warns, kahoot: !!k });
    }
    if (!res.packs.length && !res.notes.length) {
      const ours = book.some((s) => (s.rows[0] || []).map(cell).includes('유형'));
      res.notes.push(ours ? '「' + fileName + '」에 채워진 묶음이 없어요. 「새 묶음」 시트(또는 복사한 시트)에 문제를 채워 주세요.' : '「' + fileName + '」에서 넣을 문제를 찾지 못했어요. 우리 양식이나 카훗 가져오기 양식인지 봐 주세요.');
    }
    return res;
  };
  // SheetJS 통 → book 모양
  QP.bookFromSheetJS = function (XLSX, wb) {
    return wb.SheetNames.map((name) => ({ name, rows: XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, raw: true, defval: null, blankrows: true }) }));
  };
})(typeof window !== 'undefined' ? window : globalThis);
