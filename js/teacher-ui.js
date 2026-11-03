/* teacher-ui.js — 선생님 화면 (전자칠판 TV에 띄운다)
 * 준비(문제 묶음·길이·시간) → 모이는 곳(입장 번호·QR·인형) → 게임(단상 5명·오른쪽 순위) → 끝(시상대) → 결과표
 * 이 화면이 심판이다: 판 내내 켜 둔다. 새로 고침하면 하던 판을 이어 간다.
 */
(function () {
  'use strict';
  const QP = window.QP,
    JK = window.JK;
  const $ui = document.getElementById('ui'),
    $tools = document.getElementById('tools'),
    $toast = document.getElementById('toast');
  const P = new URLSearchParams(location.search);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const fmt = (n) => (n || 0).toLocaleString('ko-KR');
  const saved = QP.kv(QP.isMock ? 'qp-teacher-mock' : 'qp-teacher');
  const prefs = QP.kv('qp-teacher-prefs');
  let net, ref, INDEX, tvReady = false;
  let screen = 'boot';
  let showAtt = false,
    showRes = false;
  let lastPhase = '',
    lastRound = -1,
    lastBoardSig = '';
  let portraits = {};

  function tv() {
    if (!tvReady) {
      tvReady = true;
      try {
        if (!JK.has3D()) throw new Error('WebGL 없음');
        JK.TV.init(document.getElementById('cv'), document.getElementById('labels'));
      } catch (e) {
        // 학교 PC처럼 3D가 막힌 컴퓨터: 그림 없이 진행한다(3D 부르는 곳은 모두 아무것도 안 함)
        console.warn('3D 없이 해요', e);
        showErr('3D를 못 켰어요(그림 없이 해요). 이 화면을 사진으로 보내 주세요', String((e && e.message) || e) + ' / ' + glInfo());
        document.body.classList.add('no3d');
        JK.TV = new Proxy({}, { get: () => () => {} });
        setTimeout(() => toast('이 컴퓨터는 3D 그림이 막혀 있어서 그림 없이 해요'), 500);
      }
    }
    return JK.TV;
  }
  const portrait = (av) => portraits[av] || (portraits[av] = JK.dollPortrait(av, 48));
  // 이 컴퓨터의 3D 사정(진단용): webgl2/webgl 되는지, 그래픽 장치 이름
  function glInfo() {
    const out = [];
    for (const k of ['webgl2', 'webgl']) {
      try {
        const g = document.createElement('canvas').getContext(k);
        if (!g) {
          out.push(k + ' 안 됨');
          continue;
        }
        const d = g.getExtension('WEBGL_debug_renderer_info');
        out.push(k + ' 됨' + (d ? ' (' + g.getParameter(d.UNMASKED_RENDERER_WEBGL) + ')' : ''));
        const lose = g.getExtension('WEBGL_lose_context');
        if (lose) lose.loseContext();
      } catch (e) {
        out.push(k + ' 오류 ' + e.message);
      }
    }
    return out.join(', ');
  }
  // 오류를 화면에 보여 준다(선생님이 사진으로 보내 줄 수 있게)
  function showErr(what, e) {
    let box = document.getElementById('errbox');
    if (!box) {
      box = document.createElement('div');
      box.id = 'errbox';
      document.body.appendChild(box);
    }
    box.textContent = what + ': ' + ((e && (e.message || e.reason || e)) || '') + ' · ' + navigator.userAgent.replace(/^Mozilla\/5\.0 /, '').slice(0, 120);
  }
  window.addEventListener('error', (ev) => showErr('오류', ev.error || ev.message));
  window.addEventListener('unhandledrejection', (ev) => showErr('오류', ev.reason));
  function toast(msg) {
    $toast.textContent = msg;
    $toast.className = 'show';
    clearTimeout(toast.t);
    toast.t = setTimeout(() => ($toast.className = ''), 3500);
  }

  /* ================= 준비 ================= */
  async function loadIndex() {
    if (INDEX) return INDEX;
    INDEX = await fetch('questions/index.json', { cache: 'no-cache' }).then((r) => r.json());
    return INDEX;
  }
  /* ===== 출제 범위 고르기 (작업/결정-문제넣기-구현.md 「추가 요청」) =====
   * 과목 → 단원 → 주제 → 차시 순서로 보이고, 「단원 전체」「주제 전체」로 한꺼번에 고른다.
   * 범위 칸(unit·topic·lessons·tb)이 없는 묶음은 과목 아래 「그 밖의 묶음」. 시험용·계산 자동은 따로.
   * 아래 막대에 고른 범위와 문제 수 합계가 늘 보인다. 「객관식만 내기」는 고를 수 있게 두되 기본은 끔(담임: OX·숫자 답도 괜찮다).
   */
  const SUBJ_ORDER = ['국어', '수학', '사회', '과학', '영어', '도덕', '음악', '미술', '체육', '실과', '기타', '시험용', '계산'];
  const CIRC = '➊➋➌➍➎➏➐➑➒➓';
  let ITEMS = [],
    SEL = new Set(),
    ONLY = true,
    MINE_OK = null;
  const staticCache = {};
  const loadStatic = async (e) => staticCache[e.id] || (staticCache[e.id] = await fetch('questions/' + e.file, { cache: 'no-cache' }).then((r) => r.json()));
  const nChoice = (qs) => qs.filter((q) => (q.type || 'choice') === 'choice').length;
  const cnt = (it) => (ONLY ? it.nChoice : it.count);
  async function buildItems() {
    const idx = await loadIndex();
    const out = [];
    const st = await Promise.all(idx.packs.map((e) => loadStatic(e).catch(() => null)));
    idx.packs.forEach((e, i) => {
      const p = st[i];
      if (!p) return;
      out.push(Object.assign({ key: 'pk:' + e.id, src: 'static', id: e.id, file: e.file, title: e.title, subject: e.test || p.test ? '시험용' : e.subject || p.subject || '기타', count: p.questions.length, nChoice: nChoice(p.questions), test: !!(e.test || p.test), order: i }, pick(Object.assign({}, p, e))));
    });
    const MP = myPacks();
    const mine = await MP.list();
    MINE_OK = MP.serverOk;
    mine.forEach((m, i) => out.push(Object.assign({ key: 'mk:' + m.id, src: 'mine', id: m.id, title: m.title, subject: m.test ? '시험용' : m.subject || '기타', count: m.count, nChoice: m.nChoice === undefined ? m.count : m.nChoice, test: m.test, where: m.where, order: 1000 + i }, pick(m))));
    (idx.gen || []).forEach((g, i) => out.push({ key: 'gn:' + g, src: 'gen', id: g, title: QP.GEN[g].title, subject: '계산', count: 40, nChoice: 40, order: 2000 + i }));
    return out;
  }
  function pick(p) {
    const o = {};
    for (const k of ['unit', 'unitTitle', 'topic', 'topicTitle', 'lessons', 'name', 'tb']) if (p[k] !== undefined && p[k] !== null && p[k] !== '') o[k] = p[k];
    return o;
  }
  const subjRank = (x) => (SUBJ_ORDER.indexOf(x) < 0 ? 50 : SUBJ_ORDER.indexOf(x));
  const tLabel = (n) => (n >= 1 && n <= 10 ? CIRC[n - 1] : n + '.');
  // 차시 "1~3", "4", "5~6" → 합쳐서 "1~6"(이어지면), 아니면 "1~3, 8"
  function lessonSpan(list) {
    const nums = new Set();
    for (const l of list) {
      const m = String(l).match(/(\d+)\s*(?:~\s*(\d+))?/);
      if (!m) continue;
      for (let k = +m[1]; k <= +(m[2] || m[1]); k++) nums.add(k);
    }
    const a = [...nums].sort((x, y) => x - y);
    const seg = [];
    for (const n of a) {
      const last = seg[seg.length - 1];
      if (last && n === last[1] + 1) last[1] = n;
      else seg.push([n, n]);
    }
    return seg.map(([x, y]) => (x === y ? x : x + '~' + y)).join(', ');
  }
  // 고른 범위 한 줄: "사회 2단원 ➊ 1~7차시, ➋ 10차시 · 곱셈구구"
  function rangeLabel(items) {
    const parts = [];
    const bySub = {};
    for (const it of items) (bySub[it.subject] = bySub[it.subject] || []).push(it);
    for (const sub of Object.keys(bySub).sort((x, y) => subjRank(x) - subjRank(y))) {
      const its = bySub[sub];
      const scoped = its.filter((i) => i.unit);
      const units = [...new Set(scoped.map((i) => i.unit))].sort((x, y) => x - y);
      const uParts = units.map((u) => {
        const all = ITEMS.filter((i) => i.subject === sub && i.unit === u);
        const mine = scoped.filter((i) => i.unit === u);
        if (all.length > 1 && mine.length === all.length) return u + '단원 전체';
        const topics = [...new Set(mine.map((i) => i.topic || 0))].sort((x, y) => x - y);
        return u + '단원 ' + topics.map((t) => (t ? tLabel(t) + ' ' : '') + lessonSpan(mine.filter((i) => (i.topic || 0) === t).map((i) => i.lessons || '')) + '차시').join(', ');
      });
      const rest = its.filter((i) => !i.unit).map((i) => i.title);
      const txt = uParts.concat(rest.length > 3 ? [rest.slice(0, 3).join(', ') + ' 외 ' + (rest.length - 3) + '개'] : rest).join(', ');
      parts.push(sub === '시험용' || sub === '계산' || sub === '기타' ? txt : sub + ' ' + txt);
    }
    return parts.join(' · ');
  }
  function row(it) {
    const on = SEL.has(it.key);
    const label =
      '<label class="prow"><input type="checkbox" data-key="' + esc(it.key) + '"' + (on ? ' checked' : '') + '><span class="pn' + (it.src === 'mine' ? ' mt' : '') + '">' + esc(it.unit && it.name ? it.name : it.title) + '</span>' +
      (it.tb ? '<span class="tb">교과서 ' + esc(it.tb) + '쪽</span>' : '') +
      '<span class="pc">' + cnt(it) + '문제</span>' +
      (it.src === 'mine' ? '<i class="mine">내가 넣음</i>' : '') +
      (it.where === 'local' ? '<i class="loc" title="서버에 아직 못 올렸어요">이 컴퓨터만</i>' : '') +
      '</label>';
    if (it.src !== 'mine') return '<div class="prw">' + label + '</div>';
    return '<div class="prw mk" data-id="' + esc(it.id) + '">' + label + '<button class="mini" data-mren="' + esc(it.id) + '">이름</button><button class="mini" data-mdel="' + esc(it.id) + '">지우기</button></div>';
  }
  const gsum = (its) => '<span class="gc">' + its.reduce((a, i) => a + cnt(i), 0) + '문제</span>';
  // 시험용·계산 자동: 평소엔 안 쓴다(담임) → 맨 아래 「그 밖에」에 작게 접어 두고, 저절로 고르지 않는다
  const EXTRA = ['시험용', '계산'];
  const isExtra = (it) => EXTRA.includes(it.subject);
  function treeHTML() {
    const all = [...new Set(ITEMS.map((i) => i.subject))].sort((x, y) => subjRank(x) - subjRank(y));
    const main = subjHTML(all.filter((x) => !EXTRA.includes(x)));
    const ex = all.filter((x) => EXTRA.includes(x));
    const exOn = ITEMS.some((i) => isExtra(i) && SEL.has(i.key));
    return (
      (main || '<p class="none">아직 교과 문제 묶음이 없어요. 「문제 넣기 (엑셀)」로 넣어 보세요.</p>') +
      (ex.length ? '<details class="extra"' + (exOn ? ' open' : '') + '><summary>그 밖에: 시험용·계산 문제 <small>(평소엔 안 써요)</small></summary>' + subjHTML(ex) + '</details>' : '')
    );
  }
  function subjHTML(subs) {
    return subs
      .map((sub) => {
        const its = ITEMS.filter((i) => i.subject === sub).sort((a, b) => a.order - b.order);
        const scoped = its.filter((i) => i.unit);
        const other = its.filter((i) => !i.unit);
        let h = '<div class="subj"><h4><label class="tri"><input type="checkbox" data-grp="s|' + esc(sub) + '"> ' + esc(sub === '계산' ? '계산 (자동으로 만듦)' : sub) + '</label>' + gsum(its) + '</h4>';
        for (const u of [...new Set(scoped.map((i) => i.unit))].sort((x, y) => x - y)) {
          const ui = scoped.filter((i) => i.unit === u);
          h += '<details class="unit" open><summary><label class="tri"><input type="checkbox" data-grp="u|' + esc(sub) + '|' + u + '"> <b>' + u + '단원</b> ' + esc(ui[0].unitTitle || '') + '</label><span class="all">단원 전체</span>' + gsum(ui) + '</summary>';
          for (const t of [...new Set(ui.map((i) => i.topic || 0))].sort((x, y) => x - y)) {
            const ti = ui.filter((i) => (i.topic || 0) === t);
            if (t) h += '<div class="topic"><div class="th"><label class="tri"><input type="checkbox" data-grp="t|' + esc(sub) + '|' + u + '|' + t + '"> ' + tLabel(t) + ' ' + esc(ti[0].topicTitle || '') + '</label><span class="all">주제 전체</span>' + gsum(ti) + '</div>';
            h += ti.map(row).join('');
            if (t) h += '</div>';
          }
          h += '</details>';
        }
        if (other.length) h += (scoped.length ? '<div class="other"><div class="th">그 밖의 묶음</div>' : '<div class="other plain">') + other.map(row).join('') + '</div>';
        return h + '</div>';
      })
      .join('');
  }
  function grpItems(g) {
    const [k, sub, u, t] = g.split('|');
    return ITEMS.filter((i) => i.subject === sub && (k === 's' || (i.unit === +u && (k === 'u' || (i.topic || 0) === +t))));
  }
  function syncSel() {
    $ui.querySelectorAll('input[data-key]').forEach((x) => (x.checked = SEL.has(x.dataset.key)));
    $ui.querySelectorAll('input[data-grp]').forEach((x) => {
      const its = grpItems(x.dataset.grp);
      const n = its.filter((i) => SEL.has(i.key)).length;
      x.checked = n > 0 && n === its.length;
      x.indeterminate = n > 0 && n < its.length;
    });
    const items = ITEMS.filter((i) => SEL.has(i.key));
    const n = items.reduce((a, i) => a + cnt(i), 0);
    const rng = document.getElementById('rng');
    if (!rng) return;
    rng.textContent = items.length ? rangeLabel(items) : '아직 안 골랐어요';
    document.getElementById('nq').textContent = n;
    document.getElementById('few').textContent = items.length && n < 20 ? '문제가 적어서 같은 문제가 자주 나와요' : '';
    const pf = prefs.get() || {};
    pf.sel = [...SEL];
    pf.only = ONLY;
    prefs.set(pf);
  }
  async function scSetup() {
    screen = 'setup';
    const pf = Object.assign({ minutes: 10, tQ: 20, tChest: 10, tReveal: 7, fastOn: true, streakOn: true }, prefs.get() || {});
    ITEMS = await buildItems();
    ONLY = pf.only === true; // 담임: OX·숫자 답도 괜찮다(서술형만 아니면) → 기본은 모두 낸다
    // 예전에 고른 것(packs·mine·gen) → 새 모양(sel)
    const sel = pf.sel || [].concat((pf.packs || []).map((x) => 'pk:' + x), (pf.mine || []).map((x) => 'mk:' + x), (pf.gen || []).map((x) => 'gn:' + x));
    // 시험용·계산은 기억해 두지 않는다(필요한 날만 펼쳐서 고른다)
    SEL = new Set(sel.filter((k) => ITEMS.some((i) => i.key === k && !isExtra(i))));
    $ui.innerHTML =
      '<div class="setup"><h1 class="t">우리반 퀴즈 파티</h1>' +
      '<section class="scope"><h3>출제 범위 <small>단원 → 주제 → 차시. 「단원 전체」「주제 전체」로 한꺼번에 골라요</small></h3>' +
      '<div class="scopetools"><label class="chk big"><input type="checkbox" id="onlyc"' + (ONLY ? ' checked' : '') + '> 객관식만 내기 <small>(OX·숫자 답 빼기)</small></label>' +
      '<span class="imbtns"><button class="mini on" id="imp">문제 넣기 (엑셀)</button><a class="mini" href="questions/template.xlsx" download="퀴즈파티-문제-양식.xlsx">양식 내려받기</a></span></div>' +
      (MINE_OK === false && !QP.isMock ? '<p class="loc">서버에 아직 저장할 수 없어서 넣은 문제는 이 컴퓨터에만 있어요.</p>' : '') +
      '<div class="tree">' + treeHTML() + '</div></section>' +
      '<section><h3>놀이</h3><div class="seg"><label class="on"><input type="radio" name="mode" checked> 황금 찾기</label><label class="off">우리반 섬 짓기 <i>곧</i></label></div></section>' +
      '<section><h3>한 판 길이</h3><div class="seg">' + [5, 10, 15].map((m) => '<label' + (pf.minutes === m ? ' class="on"' : '') + '><input type="radio" name="min" value="' + m + '"' + (pf.minutes === m ? ' checked' : '') + '> ' + m + '분</label>').join('') + '</div></section>' +
      '<section class="adv"><h3>시간 <small>해 보고 길거나 짧으면 바꿔요</small></h3>' +
      [['tQ', '문제', 10, 60], ['tChest', '상자', 5, 20], ['tReveal', '발표', 3, 15]].map(([k, n, a, b]) => '<label class="num">' + n + ' <input type="number" name="' + k + '" min="' + a + '" max="' + b + '" value="' + pf[k] + '">초</label>').join('') +
      '<label class="chk"><input type="checkbox" name="fastOn"' + (pf.fastOn ? ' checked' : '') + '> 빨리 맞힘 보너스</label><label class="chk"><input type="checkbox" name="streakOn"' + (pf.streakOn ? ' checked' : '') + '> 연속 정답 보너스</label></section>' +
      (QP.isMock ? '<p class="mocknote">가짜 서버(시험용): 이 브라우저의 다른 탭에서만 들어올 수 있어요</p>' : '<p class="mocknote">' + esc(net.email || '') + '</p>') +
      '<div class="selbar"><div class="sum"><span class="lb">고른 범위</span> <b id="rng"></b> <span class="sep">·</span> <b id="nq"></b>문제 <span class="few" id="few"></span><p class="err" id="err"></p></div><button class="start inline" id="make">판 만들기</button></div>' +
      '</div>';
    $ui.querySelectorAll('.seg label').forEach((l) =>
      l.addEventListener('click', () => {
        if (l.classList.contains('off')) return;
        l.parentNode.querySelectorAll('label').forEach((x) => x.classList.remove('on'));
        l.classList.add('on');
      })
    );
    const tree = $ui.querySelector('.tree');
    tree.addEventListener('change', (e) => {
      const x = e.target;
      if (x.dataset.key) x.checked ? SEL.add(x.dataset.key) : SEL.delete(x.dataset.key);
      else if (x.dataset.grp) for (const it of grpItems(x.dataset.grp)) x.checked ? SEL.add(it.key) : SEL.delete(it.key);
      syncSel();
    });
    // 「단원 전체」「주제 전체」 글자를 눌러도 켜고 끈다
    tree.addEventListener('click', (e) => {
      const a = e.target.closest('.all');
      if (!a) return;
      e.preventDefault();
      const cb = a.parentNode.querySelector('input[data-grp]');
      cb.checked = !(cb.checked && !cb.indeterminate);
      cb.dispatchEvent(new Event('change', { bubbles: true }));
    });
    document.getElementById('onlyc').onchange = (e) => {
      ONLY = e.target.checked;
      tree.innerHTML = treeHTML();
      syncSel();
    };
    syncSel();
    document.getElementById('make').onclick = makeGame;
    document.getElementById('imp').onclick = openImport;
  }
  let MPK = null;
  const myPacks = () => MPK || (MPK = new QP.MyPacks(net, QP.kv(QP.isMock ? 'qp-mypacks-mock' : 'qp-mypacks')));
  // 내가 넣은 문제: 이름 바꾸기·지우기 (확인 창 대신 단추가 바뀐다)
  $ui.addEventListener('click', async (e) => {
    const b = e.target.closest('button');
    if (!b || screen !== 'setup') return;
    const d = b.dataset;
    if (d.mren) {
      const span = b.closest('.mk');
      const t = span.querySelector('.mt');
      if (b.classList.contains('save')) {
        const v = span.querySelector('input.ren').value.trim();
        if (v) await myPacks().rename(d.mren, v);
        return scSetup();
      }
      t.outerHTML = '<input class="ren" value="' + esc(t.textContent) + '" maxlength="40">';
      b.textContent = '저장';
      b.classList.add('save');
      span.querySelector('input.ren').focus();
    } else if (d.mdel) {
      if (!b.classList.contains('warn')) {
        b.textContent = '정말 지울까요?';
        b.classList.add('warn');
        setTimeout(() => b.isConnected && ((b.textContent = '지우기'), b.classList.remove('warn')), 4000);
        return;
      }
      await myPacks().remove(d.mdel);
      scSetup();
    }
  });

  /* ================= 문제 넣기 (엑셀) ================= */
  let XLSXP = null;
  function loadXLSX() {
    return (XLSXP =
      XLSXP ||
      new Promise((res, rej) => {
        if (window.XLSX) return res(window.XLSX);
        const sc = document.createElement('script');
        sc.src = 'lib/xlsx.mini.min.js?v=4';
        sc.onload = () => res(window.XLSX);
        sc.onerror = () => rej(new Error('엑셀 읽기 도구를 못 불러왔어요'));
        document.head.appendChild(sc);
      }));
  }
  let impRes = [];
  function openImport() {
    const ov = document.createElement('div');
    ov.className = 'imp';
    ov.id = 'impov';
    ov.innerHTML =
      '<div class="impbox"><h2>문제 넣기 <small>엑셀 파일을 고르면 검사해서 보여 줘요</small><button class="mini" data-x="close">닫기</button></h2>' +
      '<div class="improw"><label class="go fake">엑셀 파일 고르기<input type="file" id="impf" accept=".xlsx,.xlsm,.xls" multiple hidden></label>' +
      '<label class="chk"><input type="checkbox" id="impx"> 「예시」 시트도 넣기(시험용)</label>' +
      '<a class="mini" href="questions/template.xlsx" download="퀴즈파티-문제-양식.xlsx">양식 내려받기</a></div>' +
      '<p class="imphelp">우리 양식(시트 하나 = 묶음 하나)과 카훗 「가져오기 양식」 엑셀을 읽어요. 여러 파일을 한 번에 골라도 돼요.</p>' +
      '<div id="impout"></div></div>';
    document.body.appendChild(ov);
    ov.querySelector('#impf').onchange = (e) => readFiles([...e.target.files]);
    ov.querySelector('#impx').onchange = () => impFiles && readFiles(impFiles);
    ov.addEventListener('click', onImpClick);
  }
  let impFiles = null;
  async function readFiles(files) {
    impFiles = files;
    const out = document.getElementById('impout');
    out.innerHTML = '<p>읽는 중…</p>';
    let X;
    try {
      X = await loadXLSX();
    } catch (e) {
      out.innerHTML = '<p class="err">' + esc(e.message) + '</p>';
      return;
    }
    const examples = document.getElementById('impx').checked;
    const have = new Set((await myPacks().list()).map((p) => p.id));
    impRes = [];
    const notes = [];
    for (const f of files) {
      try {
        const wb = X.read(await f.arrayBuffer(), { type: 'array', cellDates: true });
        const r = QP.importWorkbook(QP.bookFromSheetJS(X, wb), f.name, { examples });
        notes.push(...r.notes);
        impRes.push(...r.packs);
      } catch (e) {
        notes.push('「' + f.name + '」을(를) 엑셀로 읽지 못했어요. 엑셀(.xlsx) 파일인지 봐 주세요.');
      }
    }
    const ok = impRes.filter((p) => !p.errors.length);
    out.innerHTML =
      notes.map((n) => '<p class="note">' + esc(n) + '</p>').join('') +
      impRes
        .map((p, i) => {
          const qs = p.pack.questions;
          const pv = qs
            .slice(0, 3)
            .map((q) => '<li><b>' + esc(q.q) + '</b><span>정답 ' + esc(Array.isArray(q.answer) ? q.answer.join(', ') : q.answer) + (q.wrong ? ' · 오답 ' + esc(q.wrong.join(', ')) : '') + (q.type === 'ox' ? ' · OX' : q.type === 'short' ? ' · 숫자 답' : '') + '</span></li>')
            .join('');
          return (
            '<div class="ipk ' + (p.errors.length ? 'bad' : 'good') + '"><h3>' + (p.errors.length ? '✗ ' : '✓ ') + esc(p.pack.title) + ' <small>' + esc(p.pack.subject) + ' · ' + qs.length + '문제' + (p.kahoot ? ' · 카훗' : '') + (p.pack.test ? ' · 시험용' : '') + (p.warns.length ? ' · 알림 ' + p.warns.length : '') + '</small></h3>' +
            (have.has(p.pack.id) && !p.errors.length ? '<p class="note">같은 이름의 묶음이 이미 있어요. 넣으면 새것으로 바뀌어요.</p>' : '') +
            (p.errors.length ? '<p class="note">오류를 고친 뒤 다시 골라 주세요. 이 묶음은 넣지 않아요.</p><ul class="errs">' + p.errors.map((e) => '<li>' + esc(e) + '</li>').join('') + '</ul>' : '') +
            (p.warns.length ? '<details><summary>알림 ' + p.warns.length + '개 (넣을 수는 있어요)</summary><ul class="warns">' + p.warns.map((e) => '<li>' + esc(e) + '</li>').join('') + '</ul></details>' : '') +
            (qs.length && !p.errors.length ? '<ul class="pv">' + pv + (qs.length > 3 ? '<li class="more">… ' + (qs.length - 3) + '문제 더</li>' : '') + '</ul>' : '') +
            '</div>'
          );
        })
        .join('') +
      (ok.length ? '<div class="impgo"><button class="go" data-x="save">넣기 (' + ok.length + '묶음, ' + ok.reduce((a, p) => a + p.pack.questions.length, 0) + '문제)</button></div>' : '');
  }
  async function onImpClick(e) {
    const b = e.target.closest('[data-x]');
    if (!b) return;
    if (b.dataset.x === 'close') {
      document.getElementById('impov').remove();
      impRes = [];
      impFiles = null;
      return scSetup();
    }
    if (b.dataset.x === 'save') {
      b.disabled = true;
      const ok = impRes.filter((p) => !p.errors.length);
      let server = true;
      for (const p of ok) server = (await myPacks().save(p.pack)) && server;
      // 넣은 묶음은 바로 골라 둔다
      const pf = prefs.get() || {};
      pf.mine = [...new Set([...(pf.mine || []), ...ok.map((p) => p.pack.id)])];
      prefs.set(pf);
      document.getElementById('impout').innerHTML = '<p class="done">' + ok.length + '묶음을 넣었어요. ' + (server || QP.isMock ? '「판 만들기」 목록의 「내가 넣은 문제」에서 골라요.' : '서버에 아직 저장할 수 없어서 이 컴퓨터에만 넣었어요. 이 컴퓨터에서는 바로 쓸 수 있어요.') + '</p><div class="impgo"><button class="go" data-x="close">닫고 판 만들러 가기</button></div>';
    }
  }
  async function makeGame() {
    const f = (n) => [...$ui.querySelectorAll('input[name="' + n + '"]')];
    const num = (n, d) => Math.max(+f(n)[0].min, Math.min(+f(n)[0].max, +f(n)[0].value || d));
    const items = ITEMS.filter((i) => SEL.has(i.key));
    const pf = Object.assign(prefs.get() || {}, {
      sel: [...SEL],
      only: ONLY,
      minutes: +(f('min').find((x) => x.checked) || { value: 10 }).value,
      tQ: num('tQ', 20),
      tChest: num('tChest', 10),
      tReveal: num('tReveal', 7),
      fastOn: f('fastOn')[0].checked,
      streakOn: f('streakOn')[0].checked,
    });
    const err = document.getElementById('err');
    if (!items.length) return (err.textContent = '출제 범위를 하나 이상 골라요');
    prefs.set(pf);
    err.textContent = '문제를 읽는 중…';
    let packs = [];
    for (const it of items) {
      let p;
      if (it.src === 'static') {
        p = await loadStatic({ id: it.id, file: it.file });
        const chk = QP.checkPack(p);
        if (chk.errors.length) return (err.textContent = p.title + ': ' + chk.errors[0]);
      } else if (it.src === 'mine') {
        p = await myPacks().get(it.id);
        if (!p) return (err.textContent = '넣은 묶음 「' + it.title + '」을 찾지 못했어요. 목록을 다시 열어 주세요.');
      } else p = QP.genPack(it.id, Math.floor(Math.random() * 1e9), 40);
      packs.push(p);
    }
    // 객관식만: OX·숫자 답 문제는 뺀다
    if (ONLY) packs = packs.map((p) => Object.assign({}, p, { questions: p.questions.filter((q) => (q.type || 'choice') === 'choice') })).filter((p) => p.questions.length);
    if (!packs.length) return (err.textContent = '고른 범위에 객관식 문제가 없어요. 「객관식만 내기」를 끄거나 범위를 바꿔요.');
    err.textContent = '판을 만드는 중…';
    // 한 단계가 오래 걸리면 어디서 기다리는지 보여 준다(학교 PC에서 멈춤, 2026-11-03)
    let stepName = '시작',
      stepAt = Date.now();
    const watch = setInterval(() => {
      if (Date.now() - stepAt > 12000) err.textContent = '판을 만드는 중… (' + stepName + ' — 서버 답을 ' + Math.round((Date.now() - stepAt) / 1000) + '초째 기다려요. 인터넷 연결을 확인해 주세요)';
    }, 1000);
    try {
      ref = await QP.Referee.create(net, { cfg: pf, packs, label: rangeLabel(items), onUpdate: onRef, log: (m) => console.log('[심판]', m), step: (s) => {
          stepName = s;
          stepAt = Date.now();
          err.textContent = '판을 만드는 중… (' + s + ')';
        } });
    } catch (e) {
      console.error(e);
      clearInterval(watch);
      return (err.textContent = '판을 못 만들었어요 (' + stepName + '): ' + (e.code === 'permission-denied' ? '선생님 계정이 아니에요' : e.message));
    }
    saved.set({ gid: ref.gid });
    window.QPREF = ref;
    if (net.calibrate) net.calibrate('qp_games/' + ref.gid + '/private/clock');
    clearInterval(watch);
    stepName = '화면 그리기';
    err.textContent = '판을 만드는 중… (화면 그리기)';
    try {
      onRef(ref);
    } catch (e) {
      console.error(e);
      showErr('화면을 그리다 멈췄어요', e);
    }
  }

  /* ================= 심판 소식 → 화면 ================= */
  function onRef(r) {
    const S = r.S;
    if (r.viewOnly) {
      $ui.innerHTML = '<div class="center card"><h2>다른 탭에서 판을 진행하고 있어요</h2><p>이 탭은 닫아도 돼요.</p></div>';
      return;
    }
    const ph = S.phase;
    if (ph === 'lobby') return scLobby();
    if (ph === 'end') return scEnd();
    return scGame();
  }
  function kidsOf() {
    return Object.values(ref.S.seats).sort((a, b) => a.num - b.num).map((s) => ({ sid: s.sid, avatar: s.av, nick: s.nick }));
  }
  function joinURL() {
    const base = location.href.replace(/teacher\.html.*$/, '').replace(/[?#].*$/, '');
    const page = (QP.preview && QP.preview.kid) || 'index.html';
    return base + page + '?c=' + ref.S.code + (QP.isMock && !QP.preview ? '&mock' : '');
  }
  function scLobby() {
    const T = tv();
    if (screen !== 'lobby') {
      screen = 'lobby';
      T.setView('lobby');
      const qr = qrcode(0, 'M');
      qr.addData(joinURL());
      qr.make();
      const url = joinURL().replace(/^https?:\/\//, '').replace(/[a-z]+\.html\?c=\d+.*$/, '');
      $ui.innerHTML =
        '<div class="tv-title"><h1>우리반 퀴즈 파티</h1><div class="chips"><span class="chip mode">황금 찾기</span><span class="chip">' + ref.S.cfg.minutes + '분</span>' +
        (ref.S.range ? '<span class="chip' + (ref.S.test ? ' test' : '') + '">' + esc(ref.S.range) + '</span>' : ref.S.packTitles.map((t) => '<span class="chip' + (/시험용/.test(t) ? ' test' : '') + '">' + esc(t) + '</span>').join('')) + '</div></div>' +
        '<div class="joinbox"><div class="lab">입장 번호</div><div class="code">' + ref.S.code.split('').map((c) => '<i>' + c + '</i>').join('') + '</div><div class="qr">' + qr.createImgTag(4, 0) + '</div><div class="url">디벗으로 <b>QR</b>을 찍거나<br>주소창에 <b>' + esc(url) + '</b></div></div>' +
        '<div class="count">들어온 친구 <b id="n">0</b> 명</div><button class="start" id="go">시작!</button>';
      document.getElementById('go').onclick = async () => {
        if (!(await ref.start())) toast('아직 아무도 안 들어왔어요');
      };
    }
    T.syncKids(kidsOf());
    document.getElementById('n').textContent = Object.keys(ref.S.seats).length;
    if (document.body.classList.contains('no3d')) {
      // 3D 섬 대신 들어온 친구 이름표
      let kl = document.getElementById('kidlist');
      if (!kl) {
        kl = document.createElement('div');
        kl.id = 'kidlist';
        $ui.appendChild(kl);
      }
      const h = kidsOf().map((k) => '<span><img src="' + portrait(k.avatar) + '" alt="">' + esc(k.nick) + '</span>').join('');
      if (kl.innerHTML !== h) kl.innerHTML = h;
    }
    tools();
  }
  function scGame() {
    const T = tv();
    const S = ref.S;
    if (screen !== 'game') {
      screen = 'game';
      T.setView('game');
      $ui.innerHTML = '<div class="roundbar"><span class="rd" id="rd"></span><span class="ph"><span id="phn"></span> <b id="pht"></b>초 <span class="bar"><i id="phb"></i></span></span><span class="left" id="left"></span><span class="left" id="ansn"></span></div><div class="newking" id="nk" hidden></div><div class="ranks"><h3>우리반 순위</h3><ol id="rl"></ol></div>';
      lastBoardSig = '';
    }
    // 순위·단상은 발표 때(또는 처음) 바뀐다
    const board = S.board && S.board.length ? S.board : ref.makeBoard();
    const sig = S.round + '|' + S.phase + '|' + board.map((b) => b.sid + b.gold).join();
    if ((S.phase === 'reveal' || !lastBoardSig) && sig !== lastBoardSig) {
      lastBoardSig = sig;
      T.setTop(podiumKids(board));
      drawRanks(board);
      const nk = document.getElementById('nk');
      const lead = S.phase === 'reveal' && board[0] && board[0].gold > 0 && S.round > 1 && (S.prevLead || '') !== board[0].sid;
      if (lead) {
        nk.textContent = '새 1등! ' + board[0].nick;
        nk.hidden = false;
        setTimeout(() => (nk.hidden = true), QP.ms(S.cfg.tReveal));
      }
      if (S.phase === 'reveal' && board[0] && board[0].gold > 0) S.prevLead = board[0].sid;
    }
    tools();
    tick();
  }
  // 단상: 금이 0보다 많은 아이 중 앞의 5명(같은 금이면 같은 등수)
  const podiumKids = (board) => board.filter((b) => b.gold > 0).slice(0, QP.PODIUM).map((b) => ({ sid: b.sid, avatar: b.av, nick: b.nick, gold: b.gold, rank: b.rank }));
  const rankOf = (b, board) => (b.rank !== undefined ? b.rank : QP.rankOfGold(b.gold, board.map((x) => x.gold)));
  function drawRanks(board) {
    const ol = document.getElementById('rl');
    if (!ol) return;
    ol.style.setProperty('--n', Math.max(board.length, 10));
    ol.innerHTML = board
      .map((b, i) => {
        const mv = b.nw ? '<span class="mv new">NEW</span>' : b.mv > 0 ? '<span class="mv up">▲' + b.mv + '</span>' : b.mv < 0 ? '<span class="mv dn">▼' + -b.mv + '</span>' : '<span class="mv"></span>';
        const rk = rankOf(b, board);
        return '<li class="' + (rk === 1 ? 'k1' : rk && i < QP.PODIUM ? 'top' : '') + (rk ? '' : ' zero') + (b.mv ? ' moved' : '') + '"><span class="n">' + (rk || '–') + '</span><img src="' + portrait(b.av) + '"><span class="nm">' + esc(b.nick) + '</span><span class="g">' + fmt(b.gold) + '</span>' + mv + '</li>';
      })
      .join('');
  }
  function tick() {
    if (!ref || screen !== 'game') return;
    const S = ref.S;
    const left = Math.max(0, S.endsAt - net.now()) / QP.ms(1);
    const total = S.phase === 'question' ? S.cfg.tQ : S.phase === 'chest' ? S.cfg.tChest : S.cfg.tReveal;
    const g = (id) => document.getElementById(id);
    if (!g('rd')) return;
    g('rd').textContent = S.round + '라운드';
    g('phn').textContent = { question: '문제 푸는 중', chest: '상자 고르는 중', reveal: '결과 발표' }[S.phase] || '';
    g('pht').textContent = Math.ceil(left);
    g('phb').style.width = Math.min(100, (100 * left) / total) + '%';
    const rest = Math.max(0, S.startedAt + QP.ms(S.cfg.minutes * 60) - net.now()) / QP.ms(1);
    g('left').textContent = rest > 0 ? '판 끝까지 ' + Math.floor(rest / 60) + ':' + String(Math.floor(rest % 60)).padStart(2, '0') : '마지막 라운드';
    const seats = Object.values(S.seats);
    if (S.phase === 'question') {
      const got = seats.filter((s) => s.cur && s.cur.r === S.round);
      g('ansn').textContent = '답한 친구 ' + got.filter((s) => s.ans).length + ' / ' + got.length;
      g('ansn').hidden = false;
    } else g('ansn').hidden = true;
  }
  function scEnd() {
    const T = tv();
    if (screen === 'end') return tools();
    screen = 'end';
    T.setView('game');
    const board = ref.S.board || ref.makeBoard();
    T.setTop(podiumKids(board));
    const firsts = board.filter((b) => rankOf(b, board) === 1);
    $ui.innerHTML =
      '<div class="newking big">' + (firsts.length ? '끝! ' + (firsts.length > 1 ? '공동 1등 ' : '1등 ') + esc(firsts.map((b) => b.nick).join(', ')) : '끝!') + '</div><div class="ranks"><h3>최종 순위</h3><ol id="rl"></ol></div>' +
      '<div class="endbtns"><button class="go" id="res">결과표 보기</button><button class="ghost" id="new">새 판</button></div>';
    drawRanks(board.map((b) => Object.assign({}, b, { mv: 0, nw: 0 })));
    document.getElementById('res').onclick = () => {
      showRes = true;
      drawResults();
    };
    document.getElementById('new').onclick = () => {
      saved.set(null);
      ref.stop();
      ref = null;
      showRes = false;
      $tools.innerHTML = '';
      scSetup();
    };
    tools();
  }

  /* ================= 선생님 도구: 출석판·알림·판 끝내기 ================= */
  function tools() {
    if (!ref) return;
    const S = ref.S;
    let h = '<div class="tbtns"><button class="mini" data-t="att">출석판' + (ref.alerts.length ? ' <i class="dot"></i>' : '') + '</button>' + (S.phase !== 'lobby' && S.phase !== 'end' ? '<button class="mini" data-t="end">판 끝내기</button>' : '') + '</div>';
    for (const a of ref.alerts) h += '<div class="alert">' + a.num + '번 자리에 다른 기기가 들어오려 해요 <button class="mini" data-hand="' + a.num + '" data-uid="' + a.uid + '">넘겨주기</button><button class="mini" data-dis="' + a.num + '" data-uid="' + a.uid + '">무시</button></div>';
    if (showAtt) {
      h += '<div class="att"><h3>출석판 <small>TV에 번호가 보여요. 다 보면 닫아요</small><button class="mini" data-t="att">닫기</button></h3><div class="attgrid">';
      for (const n of QP.NUMS) {
        const s = S.seats[n];
        const st = !s ? 'empty' : ref.alive(s) ? 'on' : 'off';
        h += '<button class="' + st + '" data-seat="' + n + '"><b>' + n + '</b><span>' + (s ? esc(s.nick) : '') + '</span></button>';
      }
      h += '</div><p class="leg"><i class="on"></i>접속 중 <i class="off"></i>끊김 <i class="empty"></i>안 들어옴 · 번호를 누르면 자리를 비워요</p></div>';
    }
    if ($tools.innerHTML !== h) $tools.innerHTML = h;
    if (showRes) drawResults();
  }
  $tools.addEventListener('click', async (e) => {
    const b = e.target.closest('button');
    if (!b || !ref) return;
    const d = b.dataset;
    if (d.t === 'att') {
      showAtt = !showAtt;
      tools();
    } else if (d.t === 'end') {
      if (confirm('이번 라운드 발표 뒤에 판을 끝낼까요?')) {
        await ref.endNow();
        toast('이번 라운드 발표 뒤에 끝나요');
      }
    } else if (d.hand) ref.handOver(+d.hand, d.uid);
    else if (d.dis) ref.dismissAlert(+d.dis, d.uid);
    else if (d.seat) {
      const s = ref.S.seats[d.seat];
      if (s && confirm(d.seat + '번(' + s.nick + ') 자리를 비울까요? 금이 사라져요.')) ref.freeSeat(+d.seat);
    } else if (d.close) {
      showRes = false;
      tools();
    } else if (d.csv) {
      const blob = new Blob([ref.resultsCSV()], { type: 'text/csv' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      const dt = new Date();
      a.download = '퀴즈파티-결과-' + dt.getFullYear() + String(dt.getMonth() + 1).padStart(2, '0') + String(dt.getDate()).padStart(2, '0') + '.csv';
      a.click();
    }
  });
  function drawResults() {
    const R = ref.results();
    const pct = (x) => Math.round(x * 100) + '%';
    let h =
      '<div class="results"><h2>결과표 <small>' + esc(R.range || R.packs.join(', ')) + ' · ' + R.rounds + '라운드</small><button class="mini" data-csv="1">내려받기(엑셀)</button><button class="mini" data-close="1">닫기</button></h2><div class="rcols">' +
      '<div><h3>문제별 정답률 <small>낮은 것부터</small></h3><table><tr><th>문제</th><th>정답</th><th>맞힘</th><th></th></tr>' +
      R.qs.map((q) => '<tr><td>' + esc(q.q) + '</td><td>' + esc(q.ans) + '</td><td>' + q.ok + '/' + q.n + '</td><td class="bar"><i style="width:' + pct(q.rate) + '" class="' + (q.rate < 0.5 ? 'low' : '') + '"></i><span>' + pct(q.rate) + '</span></td></tr>').join('') +
      '</table></div><div><h3>아이별</h3><table><tr><th>번호</th><th>별명</th><th>등수</th><th>푼 문제</th><th>맞힘</th><th>정답률</th></tr>' +
      R.kids.map((k) => '<tr><td>' + k.num + '</td><td>' + esc(k.nick) + '</td><td>' + (k.rank || '') + '</td><td>' + k.served + '</td><td>' + k.nOk + '</td><td>' + (k.served ? pct(k.nOk / k.served) : '') + '</td></tr>').join('') +
      '</table></div></div></div>';
    const old = $tools.querySelector('.results');
    if (old) old.outerHTML = h;
    else $tools.insertAdjacentHTML('beforeend', h);
  }

  /* ================= 시작 ================= */
  (async function boot() {
    $ui.innerHTML = '<div class="center card"><p>여는 중…</p></div>';
    try {
      net = await QP.connect('teacher');
    } catch (e) {
      $ui.innerHTML = '<div class="center card"><h2>서버에 붙지 못했어요</h2><p>' + esc(e.message) + '</p></div>';
      return;
    }
    if (!QP.isMock && !net.email) {
      // 진짜 서버: 구글 로그인 (팝업은 단추를 눌러야 열린다)
      await new Promise((res) => {
        $ui.innerHTML = '<div class="center card"><h2>우리반 퀴즈 파티</h2><p>선생님 구글 계정으로 들어가요.</p><div class="row"><button class="go" id="lg">구글로 로그인</button></div><p class="err" id="lerr"></p></div>';
        document.getElementById('lg').onclick = async () => {
          try {
            await net.signIn('teacher');
            res();
          } catch (e) {
            document.getElementById('lerr').textContent = '로그인하지 못했어요: ' + e.message;
          }
        };
      });
    } else await net.signIn('teacher');
    const sv = saved.get();
    if (sv && sv.gid) {
      try {
        const g = await net.get('qp_games/' + sv.gid);
        if (g && g.phase !== 'end') {
          ref = await QP.Referee.resume(net, sv.gid, { onUpdate: onRef, log: (m) => console.log('[심판]', m) });
          window.QPREF = ref;
          if (net.calibrate) net.calibrate('qp_games/' + sv.gid + '/private/clock');
          toast('하던 판을 이어서 해요');
          onRef(ref);
          setInterval(tick, 250);
          return;
        }
      } catch (e) {
        console.warn(e);
      }
      saved.set(null);
    }
    await scSetup();
    setInterval(tick, 250);
  })();
})();
