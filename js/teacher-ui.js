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
      JK.TV.init(document.getElementById('cv'), document.getElementById('labels'));
      tvReady = true;
    }
    return JK.TV;
  }
  const portrait = (av) => portraits[av] || (portraits[av] = JK.dollPortrait(av, 48));
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
  async function scSetup() {
    screen = 'setup';
    const idx = await loadIndex();
    const pf = Object.assign({ packs: [idx.packs[0] && idx.packs[0].id], gen: [], minutes: 10, tQ: 20, tChest: 10, tReveal: 7, fastOn: true, streakOn: true }, prefs.get() || {});
    const subj = {};
    for (const p of idx.packs) (subj[p.subject || '기타'] = subj[p.subject || '기타'] || []).push(p);
    $ui.innerHTML =
      '<div class="setup"><h1 class="t">우리반 퀴즈 파티</h1>' +
      '<section><h3>문제 묶음 <small>여러 개 골라 섞을 수 있어요</small></h3>' +
      Object.keys(subj)
        .map((k) => '<div class="grp"><b>' + esc(k) + '</b>' + subj[k].map((p) => '<label><input type="checkbox" name="pk" value="' + esc(p.id) + '"' + (pf.packs.includes(p.id) ? ' checked' : '') + '> ' + esc(p.title) + (p.test ? ' <i class="tst">시험용</i>' : '') + '</label>').join('') + '</div>')
        .join('') +
      '<div class="grp"><b>계산(자동으로 만듦)</b>' + (idx.gen || []).map((g) => '<label><input type="checkbox" name="gn" value="' + g + '"' + (pf.gen.includes(g) ? ' checked' : '') + '> ' + esc(QP.GEN[g].title) + '</label>').join('') + '</div></section>' +
      '<section><h3>놀이</h3><div class="seg"><label class="on"><input type="radio" name="mode" checked> 황금 찾기</label><label class="off">우리반 섬 짓기 <i>곧</i></label></div></section>' +
      '<section><h3>한 판 길이</h3><div class="seg">' + [5, 10, 15].map((m) => '<label' + (pf.minutes === m ? ' class="on"' : '') + '><input type="radio" name="min" value="' + m + '"' + (pf.minutes === m ? ' checked' : '') + '> ' + m + '분</label>').join('') + '</div></section>' +
      '<section class="adv"><h3>시간 <small>해 보고 길거나 짧으면 바꿔요</small></h3>' +
      [['tQ', '문제', 10, 60], ['tChest', '상자', 5, 20], ['tReveal', '발표', 3, 15]].map(([k, n, a, b]) => '<label class="num">' + n + ' <input type="number" name="' + k + '" min="' + a + '" max="' + b + '" value="' + pf[k] + '">초</label>').join('') +
      '<label class="chk"><input type="checkbox" name="fastOn"' + (pf.fastOn ? ' checked' : '') + '> 빨리 맞힘 보너스</label><label class="chk"><input type="checkbox" name="streakOn"' + (pf.streakOn ? ' checked' : '') + '> 연속 정답 보너스</label></section>' +
      '<p class="err" id="err"></p><button class="start inline" id="make">판 만들기</button>' +
      (QP.isMock ? '<p class="mocknote">가짜 서버(시험용): 이 브라우저의 다른 탭에서만 들어올 수 있어요</p>' : '<p class="mocknote">' + esc(net.email || '') + '</p>') +
      '</div>';
    $ui.querySelectorAll('.seg label').forEach((l) =>
      l.addEventListener('click', () => {
        if (l.classList.contains('off')) return;
        l.parentNode.querySelectorAll('label').forEach((x) => x.classList.remove('on'));
        l.classList.add('on');
      })
    );
    document.getElementById('make').onclick = makeGame;
  }
  async function makeGame() {
    const f = (n) => [...$ui.querySelectorAll('input[name="' + n + '"]')];
    const packIds = f('pk').filter((x) => x.checked).map((x) => x.value);
    const gens = f('gn').filter((x) => x.checked).map((x) => x.value);
    const num = (n, d) => Math.max(+f(n)[0].min, Math.min(+f(n)[0].max, +f(n)[0].value || d));
    const pf = {
      packs: packIds,
      gen: gens,
      minutes: +(f('min').find((x) => x.checked) || { value: 10 }).value,
      tQ: num('tQ', 20),
      tChest: num('tChest', 10),
      tReveal: num('tReveal', 7),
      fastOn: f('fastOn')[0].checked,
      streakOn: f('streakOn')[0].checked,
    };
    const err = document.getElementById('err');
    if (!packIds.length && !gens.length) return (err.textContent = '문제 묶음을 하나 이상 골라요');
    prefs.set(pf);
    err.textContent = '문제를 읽는 중…';
    const packs = [];
    for (const id of packIds) {
      const e = INDEX.packs.find((p) => p.id === id);
      const p = await fetch('questions/' + e.file, { cache: 'no-cache' }).then((r) => r.json());
      const chk = QP.checkPack(p);
      if (chk.errors.length) return (err.textContent = p.title + ': ' + chk.errors[0]);
      packs.push(p);
    }
    for (const g of gens) packs.push(QP.genPack(g, Math.floor(Math.random() * 1e9), 40));
    err.textContent = '판을 만드는 중…';
    try {
      ref = await QP.Referee.create(net, { cfg: pf, packs, onUpdate: onRef, log: (m) => console.log('[심판]', m) });
    } catch (e) {
      console.error(e);
      return (err.textContent = '판을 못 만들었어요: ' + (e.code === 'permission-denied' ? '선생님 계정이 아니에요' : e.message));
    }
    saved.set({ gid: ref.gid });
    window.QPREF = ref;
    if (net.calibrate) net.calibrate('qp_games/' + ref.gid + '/private/clock');
    onRef(ref);
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
        ref.S.packTitles.map((t) => '<span class="chip' + (/시험용/.test(t) ? ' test' : '') + '">' + esc(t) + '</span>').join('') + '</div></div>' +
        '<div class="joinbox"><div class="lab">입장 번호</div><div class="code">' + ref.S.code.split('').map((c) => '<i>' + c + '</i>').join('') + '</div><div class="qr">' + qr.createImgTag(4, 0) + '</div><div class="url">디벗으로 <b>QR</b>을 찍거나<br>주소창에 <b>' + esc(url) + '</b></div></div>' +
        '<div class="count">들어온 친구 <b id="n">0</b> 명</div><button class="start" id="go">시작!</button>';
      document.getElementById('go').onclick = async () => {
        if (!(await ref.start())) toast('아직 아무도 안 들어왔어요');
      };
    }
    T.syncKids(kidsOf());
    document.getElementById('n').textContent = Object.keys(ref.S.seats).length;
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
      T.setTop(board.map((b) => ({ sid: b.sid, avatar: b.av, nick: b.nick, gold: b.gold })));
      drawRanks(board);
      const nk = document.getElementById('nk');
      const lead = S.phase === 'reveal' && board[0] && S.round > 1 && (S.prevLead || '') !== board[0].sid;
      if (lead) {
        nk.textContent = '새 1등! ' + board[0].nick;
        nk.hidden = false;
        setTimeout(() => (nk.hidden = true), QP.ms(S.cfg.tReveal));
      }
      if (S.phase === 'reveal' && board[0]) S.prevLead = board[0].sid;
    }
    tools();
    tick();
  }
  function drawRanks(board) {
    const ol = document.getElementById('rl');
    if (!ol) return;
    ol.style.setProperty('--n', Math.max(board.length, 10));
    ol.innerHTML = board
      .map((b, i) => {
        const mv = b.nw ? '<span class="mv new">NEW</span>' : b.mv > 0 ? '<span class="mv up">▲' + b.mv + '</span>' : b.mv < 0 ? '<span class="mv dn">▼' + -b.mv + '</span>' : '<span class="mv"></span>';
        return '<li class="' + (i === 0 ? 'k1' : i < 5 ? 'top' : '') + (b.mv ? ' moved' : '') + '"><span class="n">' + (i + 1) + '</span><img src="' + portrait(b.av) + '"><span class="nm">' + esc(b.nick) + '</span><span class="g">' + fmt(b.gold) + '</span>' + mv + '</li>';
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
    T.setTop(board.map((b) => ({ sid: b.sid, avatar: b.av, nick: b.nick, gold: b.gold })));
    $ui.innerHTML =
      '<div class="newking big">끝! 1등 ' + esc(board[0] ? board[0].nick : '') + '</div><div class="ranks"><h3>최종 순위</h3><ol id="rl"></ol></div>' +
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
      '<div class="results"><h2>결과표 <small>' + R.rounds + '라운드 · ' + esc(R.packs.join(', ')) + '</small><button class="mini" data-csv="1">내려받기(엑셀)</button><button class="mini" data-close="1">닫기</button></h2><div class="rcols">' +
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
