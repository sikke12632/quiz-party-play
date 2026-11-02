/* kid-ui.js — 아이 화면 (디벗 1280×664)
 * 입장 번호 → 출석 번호 → 나는 ○○○ → (라운드) 문제 → 상자 / 정답 풀이 → 발표 → … → 끝
 * 3D는 상자 장면 하나뿐(가볍게). 내 인형은 한 번만 그려 그림으로 쓴다.
 */
(function () {
  'use strict';
  const QP = window.QP,
    JK = window.JK;
  const $app = document.getElementById('app');
  const P = new URLSearchParams(location.search);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const fmt = (n) => (n || 0).toLocaleString('ko-KR');
  let C = null; // KidClient
  let key = ''; // 지금 그린 화면
  let codeBuf = '';
  let shortBuf = '';
  let portrait = { av: -1, url: '' };
  let chest = null; // 상자 3D (한 번만 만든다)
  let chestCv = null;

  function myPortrait() {
    const av = C && C.seat ? C.seat.av : -1;
    if (av < 0) return '';
    if (portrait.av !== av) portrait = { av, url: JK.dollPortrait(av, 160) };
    return portrait.url;
  }
  const KIND_TXT = {
    gain: (o) => ['금 주머니!', '+' + o.amt],
    double: (o) => ['금 두 배!', '+' + o.amt],
    none: () => ['꽝!', '다음엔 꼭!'],
    shield: () => ['방패!', '누가 뺏으러 오면 한 번 막아 줘요'],
    stealRand: (o) => ['랜덤 뺏기!', (who(o.target) ? who(o.target).nick : '친구') + '에게서 가져와요'],
    swapRand: (o) => ['랜덤 바꾸기!', (who(o.target) ? who(o.target).nick : '친구') + '와 금을 바꿔요'],
    stealPick: () => ['지정 뺏기!', ''],
    swapPick: () => ['지정 바꾸기!', ''],
  };
  const who = (sid) => C.who(sid);

  /* ================= 그리기 ================= */
  function topbar() {
    const s = C.seat || {};
    const ph = C.phase;
    const t = Math.ceil(C.timeLeft());
    const total = ph === 'question' ? qTime() : ph === 'chest' ? C.game.cfg.tChest : ph === 'reveal' ? C.game.cfg.tReveal : 0;
    const label = { question: '문제', chest: '상자', reveal: '발표' }[ph];
    const hurry = ph === 'chest' && C.myOpen() && C.myOpen().targets && C.sent.tg !== C.round;
    return (
      '<div class="topbar"><div class="me"><img src="' + myPortrait() + '" alt=""><span><small>나는</small> <b>' + esc(s.nick) + '</b></span></div>' +
      '<div class="gold"><span class="coin"></span><span id="goldN">' + fmt(s.gold) + '</span></div>' +
      (s.rank ? '<div class="rank">지금 <b>' + s.rank + '</b>등</div>' : '') +
      '<div class="spacer"></div>' +
      (C.round ? '<div class="rd">' + C.round + '라운드</div>' : '') +
      (label ? '<div class="timer' + (hurry ? ' hurry' : '') + '"><span>' + label + '</span> <b id="tN">' + t + '</b>초 <span class="bar"><i id="tB" style="width:' + Math.round((100 * C.timeLeft()) / (total || 1)) + '%"></i></span></div>' : '') +
      '</div>'
    );
  }
  function qTime() {
    const q = C.seat && C.seat.q;
    return Math.max(C.game.cfg.tQ, (q && q.time) || 0);
  }
  function keypad(id, extra) {
    const k = ['1', '2', '3', '4', '5', '6', '7', '8', '9', extra || '', '0', '⌫'];
    return '<div class="keys" id="' + id + '">' + k.map((x) => (x ? '<button data-k="' + x + '">' + x + '</button>' : '<span></span>')).join('') + '</div>';
  }

  function viewKey() {
    if (!C) return 'boot';
    const sc = C.screen;
    if (sc !== 'seat') return sc + '|' + (C.err || '') + '|' + (sc === 'busy' ? C.num : '');
    const ph = C.phase,
      r = C.round;
    if (ph === 'lobby') return 'lobby|' + (C.seat && C.seat.nick);
    if (ph === 'question') return 'q|' + r + '|' + (C.myQ() ? C.myQ().id : 'none') + '|' + (C.sent.a === r ? 'sent' : '');
    if (ph === 'chest') {
      const res = C.myRes(),
        o = C.myOpen();
      return 'c|' + r + '|' + (res ? (res.ok ? 'ok' : 'no') : 'x') + '|' + (C.sent.c === r ? C.sent.ci : '') + '|' + (o ? o.kind : '') + '|' + (C.sent.tg === r ? C.sent.tgSid : '');
    }
    if (ph === 'reveal') return 'rv|' + r + '|' + (C.myRev() ? 1 : 0);
    if (ph === 'end') return 'end|' + (C.seat && C.seat.fin ? 1 : 0);
    return ph;
  }

  function render() {
    const k = viewKey();
    if (k === key) return tickOnly();
    const prevKey = key;
    key = k;
    const showChest = k.startsWith('c|') && k.split('|')[2] === 'ok' && !(C.myOpen() && C.myOpen().targets && C.sent.tg !== C.round);
    let h = '';
    if (!C) h = '<div class="center"><p>여는 중…</p></div>';
    else if (C.screen === 'code') h = scCode();
    else if (C.screen === 'num') h = scNum();
    else if (C.screen === 'joining') h = '<div class="center"><div class="spin"></div><p>들어가는 중…</p></div>';
    else if (C.screen === 'busy') h = '<div class="center card"><h2>' + C.num + '번은 이미 들어와 있어요</h2><p>내 번호가 맞으면 선생님께 말해 주세요.<br>선생님이 넘겨주면 바로 들어가요.</p><div class="row"><button class="ghost" data-act="renum">다른 번호 고르기</button></div></div>';
    else if (C.screen === 'otherTab') h = '<div class="center card"><h2>다른 탭에서 하고 있어요</h2><p>이 탭에서 계속하려면 눌러요.</p><div class="row"><button class="go" data-act="claim">여기서 할래요</button></div></div>';
    else if (C.screen === 'otherDevice') h = '<div class="center card"><h2>다른 기기에서 이어서 하고 있어요</h2><p>이 기기는 쉬어도 돼요.</p></div>';
    else if (C.screen === 'gone') h = '<div class="center card"><h2>판이 없어졌어요</h2><div class="row"><button class="go" data-act="restart">처음으로</button></div></div>';
    else h = topbar() + scGame();
    $app.innerHTML = h;
    // 상자 3D: 캔버스는 한 번 만들어 붙였다 뗐다 한다
    if (showChest) {
      if (!chestCv) {
        chestCv = document.createElement('canvas');
        chestCv.id = 'chestcv';
      }
      $app.prepend(chestCv);
      if (!chest) chest = JK.ChestScene.init(chestCv);
      chest.setActive(true);
      const r = C.round;
      if (!prevKey.startsWith('c|' + r + '|')) {
        chest.reset();
        chest.opened = 0;
      }
      const o = C.myOpen();
      if (o && C.sent.c === r && !chest.opened) {
        chest.opened = r;
        chest.open(C.sent.ci, o.kind === 'gain' || o.kind === 'double' ? 'gold' : o.kind === 'none' ? 'none' : 'light');
      } else if (C.sent.c === r && !chest.opened) chest.choose(C.sent.ci);
    } else if (chest) chest.setActive(false);
    tickOnly();
  }
  function tickOnly() {
    if (!C || C.screen !== 'seat') return;
    const tN = document.getElementById('tN'),
      tB = document.getElementById('tB');
    const left = C.timeLeft();
    if (tN) tN.textContent = Math.ceil(left);
    if (tB) {
      const ph = C.phase;
      const total = ph === 'question' ? qTime() : ph === 'chest' ? C.game.cfg.tChest : C.game.cfg.tReveal;
      tB.style.width = Math.round((100 * left) / total) + '%';
    }
    const g = document.getElementById('goldN');
    if (g && C.seat) g.textContent = fmt(C.seat.gold);
    // 선생님 화면이 멈췄는지: 마감이 6초 넘게 지났는데 그대로
    const stuck = C.game && ['question', 'chest', 'reveal'].includes(C.phase) && C.game.endsAt && C.net.now() - C.game.endsAt > QP.ms(6);
    document.getElementById('net').hidden = !stuck;
  }

  function scCode() {
    const d = codeBuf.padEnd(4, ' ').split('');
    return (
      '<div class="center card join"><h1 class="t">우리반 퀴즈 파티</h1><h2>입장 번호</h2><div class="code">' +
      d.map((c) => '<i>' + (c.trim() ? c : '') + '</i>').join('') +
      '</div>' + keypad('kp') + '<p class="err">' + esc(C.err) + '</p><button class="go" data-act="code"' + (codeBuf.length === 4 ? '' : ' disabled') + '>들어가기</button></div>'
    );
  }
  function scNum() {
    const sel = C.pickNum;
    return (
      '<div class="center card nums"><h2>내 출석 번호를 눌러요</h2><p class="sub">번호는 선생님만 봐요. 친구들에게는 별명이 보여요.</p><div class="numgrid">' +
      QP.NUMS.map((n) => '<button data-num="' + n + '"' + (sel === n ? ' class="on"' : '') + '>' + n + '</button>').join('') +
      '</div><p class="err">' + esc(C.err) + '</p>' +
      (sel ? '<button class="go" data-act="join">' + sel + '번이 맞아요</button>' : '<button class="go" disabled>번호를 골라요</button>') +
      '</div>'
    );
  }

  function scGame() {
    const ph = C.phase,
      r = C.round,
      s = C.seat || {};
    if (ph === 'lobby')
      return '<div class="center hello"><img class="bigdoll" src="' + myPortrait() + '" alt=""><h2>나는 <b>' + esc(s.nick) + '</b></h2><p>TV에서 내 인형을 찾아봐요!<br>선생님이 시작하면 문제가 나와요.</p></div>';
    if (ph === 'question') {
      const q = C.myQ();
      if (!q) return '<div class="center card"><h2>다음 라운드부터 해요</h2><p>조금만 기다려요.</p></div>';
      const sent = C.sent.a === r;
      let ans = '';
      if (q.type === 'choice') ans = '<div class="answers n' + q.ch.length + '">' + q.ch.map((c, i) => '<button data-ans="' + esc(c) + '" data-k="' + (i + 1) + '"' + (sent && C.sent.v === c ? ' class="picked"' : '') + '>' + esc(c) + '</button>').join('') + '</div>';
      else if (q.type === 'ox') ans = '<div class="answers ox"><button data-ans="O" class="o' + (sent && C.sent.v === 'O' ? ' picked' : '') + '">O</button><button data-ans="X" class="x' + (sent && C.sent.v === 'X' ? ' picked' : '') + '">X</button></div>';
      else ans = '<div class="shortbox"><div class="shortv" id="sv">' + (esc(shortBuf) || '&nbsp;') + '</div>' + keypad('sk', q.type === 'short' ? '.' : '') + '<button class="go" data-act="short">내기</button></div>';
      return (
        '<div class="qcard' + (q.type === 'short' ? ' left' : '') + '"><div class="tag">' + (q.test ? '<span class="test">시험용</span>' : '') + '<span>' + r + '라운드</span></div>' +
        (q.img ? '<img class="qimg" src="' + esc(q.img) + '" alt="">' : '') + '<div class="q">' + esc(q.q) + '</div></div>' +
        ans + (sent ? '<div class="sentnote">냈어요! 친구들을 기다려요</div>' : '')
      );
    }
    if (ph === 'chest') {
      const res = C.myRes();
      if (!res) return '<div class="center card"><h2>다음 라운드부터 해요</h2></div>';
      if (!res.ok)
        return (
          '<div class="wrongcard"><div class="no-badge">' + (res.my === null ? '시간이 다 됐어요' : '아쉬워요') + '</div>' +
          (res.my !== null ? '<div class="q2">내 답: ' + esc(res.my) + '</div>' : '') +
          '<div class="ans">정답은 <b>' + esc(res.ans) + '</b></div>' + (res.exp ? '<div class="exp">' + esc(res.exp) + '</div>' : '') +
          '</div><p class="waitnote">친구들이 상자를 고르고 있어요. 다음 문제에서 맞혀 봐요!</p>'
        );
      const g = res.gain || {};
      const bonus = '<div class="bonus"><span>맞힘 <b>+' + g.base + '</b></span>' + (g.fast ? '<span class="fast">빨리 맞힘 <b>+' + g.fast + '</b></span>' : '') + (g.streak ? '<span class="fire">' + res.streak + '연속 <b>+' + g.streak + '</b></span>' : '') + '</div>';
      const o = C.myOpen();
      if (!o) return '<div class="banner"><div class="ok-badge">맞았어요!</div><h2>상자 하나를 골라요</h2>' + bonus + '</div><div class="chesthit"><button data-chest="0"></button><button data-chest="1"></button><button data-chest="2"></button></div>' + (C.sent.c === r ? '<p class="waitnote">여는 중…</p>' : '');
      if (o.targets && C.sent.tg !== r) return o.kind === 'stealPick' ? scSteal(o) : scSwap(o);
      const [a, b] = (KIND_TXT[o.kind] || KIND_TXT.none)(o);
      let sub = b;
      if (o.targets && C.sent.tg === r) sub = (who(C.sent.tgSid) ? who(C.sent.tgSid).nick : '친구') + (o.kind === 'stealPick' ? '에게서 가져와요' : '와 금을 바꿔요');
      const big = o.kind === 'gain' || o.kind === 'double';
      return '<div class="reward' + (big ? '' : ' small') + '">' + (big ? '<div class="amt">' + esc(b) + '</div><div class="what">' + esc(a) + '</div>' : '<div class="what">' + esc(a) + '</div><div class="sub">' + esc(sub) + '</div>') + (o.targets || o.target ? '<p class="later">결과는 발표 때 알려 줘요</p>' : '') + '</div>';
    }
    if (ph === 'reveal' || ph === 'end') {
      const v = ph === 'end' ? s.fin : C.myRev();
      if (!v) return '<div class="center"><div class="spin"></div></div>';
      if (ph === 'end') {
        return (
          '<div class="center endcard"><img class="bigdoll" src="' + myPortrait() + '" alt=""><h1 class="t">' + v.rank + '등!</h1><p class="sum"><span class="coin"></span> ' + fmt(v.gold) + ' · 맞힌 문제 ' + v.nOk + '개</p><p>' + (v.rank <= 3 ? '와, 시상대에 올랐어요! TV를 봐요.' : '수고했어요! TV에서 시상대를 봐요.') + '</p></div>'
        );
      }
      const mv = (C.game.board || []).find((b) => b.sid === s.sid);
      const arrow = mv && mv.mv > 0 ? '<span class="up">▲' + mv.mv + '</span>' : mv && mv.mv < 0 ? '<span class="dn">▼' + -mv.mv + '</span>' : '';
      const notes = (v.notes || []).map(noteText).filter(Boolean);
      return (
        '<div class="center revcard"><p class="lbl">이번 라운드</p><div class="delta ' + (v.delta >= 0 ? 'plus' : 'minus') + '">' + (v.delta >= 0 ? '+' : '') + fmt(v.delta) + '</div>' +
        '<div class="rk">' + v.rank + '등 <small>/ ' + v.n + '명</small> ' + arrow + '</div>' +
        (notes.length ? '<ul class="notes">' + notes.map((n) => '<li>' + n + '</li>').join('') + '</ul>' : '') +
        '<p class="tvnote">TV에서 순위를 봐요!</p></div>'
      );
    }
    return '';
  }
  function noteText(n) {
    const w = '<b>' + esc(n.who) + '</b>';
    if (n.k === 'stole') return w + '에게서 금 ' + n.amt + '개를 가져왔어요' + (n.auto ? ' (시간이 다 돼서 아무나)' : '');
    if (n.k === 'robbed') return w + '가 내 금 ' + n.amt + '개를 가져갔어요';
    if (n.k === 'swapped') return w + '와 금을 바꿨어요 (' + fmt(n.from) + ' → ' + fmt(n.to) + ')';
    if (n.k === 'swappedBy') return w + '가 나와 금을 바꿨어요 (' + fmt(n.from) + ' → ' + fmt(n.to) + ')';
    if (n.k === 'blocked') return w + '의 방패에 막혔어요';
    if (n.k === 'shielded') return '방패로 ' + w + '를 막았어요!';
    return '';
  }
  function scSteal(o) {
    const board = C.game.board || [];
    const mine = C.seat.sid;
    return (
      '<div class="pickhead"><span class="kind">지정 뺏기!</span> 누구 금을 가져올까요? <small>안 고르면 아무나 뽑혀요</small></div><div class="picks">' +
      board
        .map((b, i) => (b.sid === mine ? '' : '<button data-tg="' + b.sid + '"' + (o.targets.includes(b.sid) ? '' : ' disabled') + '><span class="n">' + (i + 1) + '</span><span class="nm">' + esc(b.nick) + '</span><span class="g"><i class="coin"></i>' + fmt(b.gold) + '</span></button>'))
        .join('') +
      '</div>'
    );
  }
  function scSwap(o) {
    const board = C.game.board || [];
    const me = board.findIndex((b) => b.sid === C.seat.sid);
    const my = board[me] ? board[me].gold : C.seat.gold;
    return (
      '<div class="pickhead"><span class="kind swap">지정 바꾸기!</span> 누구와 금을 통째로 바꿀까요? <small>내 위아래 3등 안 친구만 돼요</small></div><div class="swaps">' +
      board
        .map((b, i) => {
          if (b.sid === C.seat.sid) return '<button class="mine" disabled><span class="n">' + (i + 1) + '등</span><span class="nm">나 (' + esc(b.nick) + ')</span><span class="g"><i class="coin"></i>' + fmt(b.gold) + '</span></button>';
          if (!o.targets.includes(b.sid)) return '';
          const d = b.gold - my;
          return '<button data-tg="' + b.sid + '"><span class="n">' + (i + 1) + '등</span><img src="' + JK.dollPortrait(b.av, 64) + '"><span class="nm">' + esc(b.nick) + '</span><span class="g"><i class="coin"></i>' + fmt(b.gold) + '</span><span class="diff ' + (d >= 0 ? 'up' : 'dn') + '">' + (d >= 0 ? '+' : '') + fmt(d) + '</span></button>';
        })
        .join('') +
      '</div>'
    );
  }

  /* ================= 누르기 ================= */
  $app.addEventListener('click', (e) => {
    const b = e.target.closest('button,[data-chest]');
    if (!b || b.disabled || !C) return;
    const d = b.dataset;
    if (d.k !== undefined && b.closest('#kp')) {
      if (d.k === '⌫') codeBuf = codeBuf.slice(0, -1);
      else if (codeBuf.length < 4) codeBuf += d.k;
      key = '';
      return render();
    }
    if (d.k !== undefined && b.closest('#sk')) {
      if (d.k === '⌫') shortBuf = shortBuf.slice(0, -1);
      else if (shortBuf.length < 8) shortBuf += d.k;
      document.getElementById('sv').innerHTML = esc(shortBuf) || '&nbsp;';
      return;
    }
    if (d.act === 'code') return C.enter(codeBuf);
    if (d.num) {
      C.pickNum = +d.num;
      key = '';
      return render();
    }
    if (d.act === 'join') return C.join(C.pickNum);
    if (d.act === 'renum') {
      C.screen = 'num';
      key = '';
      return render();
    }
    if (d.act === 'claim') return C.claimTab();
    if (d.act === 'restart') return location.reload();
    if (d.ans !== undefined) {
      if (C.answer(d.ans)) C.sent.v = d.ans;
      return;
    }
    if (d.act === 'short') {
      if (shortBuf && C.answer(shortBuf)) {
        C.sent.v = shortBuf;
        shortBuf = '';
      }
      return;
    }
    if (d.chest !== undefined) return C.pickChest(+d.chest);
    if (d.tg) return C.pickTarget(d.tg);
  });
  // 실제 키보드(숫자)도 받는다
  addEventListener('keydown', (e) => {
    if (!C) return;
    if (C.screen === 'code' && /^[0-9]$/.test(e.key) && codeBuf.length < 4) {
      codeBuf += e.key;
      key = '';
      render();
    } else if (C.screen === 'code' && e.key === 'Backspace') {
      codeBuf = codeBuf.slice(0, -1);
      key = '';
      render();
    } else if (C.screen === 'code' && e.key === 'Enter' && codeBuf.length === 4) C.enter(codeBuf);
  });

  /* ================= 시작 ================= */
  (async function boot() {
    render();
    let net;
    try {
      net = await QP.connect('kid');
      await net.signIn('kid');
    } catch (e) {
      $app.innerHTML = '<div class="center card"><h2>서버에 붙지 못했어요</h2><p>인터넷을 확인하고 새로 고침 해요.</p></div>';
      return;
    }
    const bc = 'BroadcastChannel' in window ? new BroadcastChannel('qp-tab') : null;
    C = new QP.KidClient(net, { store: QP.kv(QP.isMock ? 'qp-kid-mock' + (P.get('as') || '') : 'qp-kid', !!QP.preview), bc, onUpdate: render });
    window.QPKID = C;
    if (!(await C.resume())) {
      const code = P.get('c');
      if (code && /^\d{4}$/.test(code)) {
        codeBuf = code;
        await C.enter(code);
      }
    }
    // 미리 보기: 선생님 화면이 만든 판의 입장 번호를 저절로 넣는다
    if (QP.preview && QP.mockStore && !C.gid)
      (async () => {
        while (C.screen === 'code') {
          const g = QP.mockStore.list('qp_games').filter((d) => d.data && d.data.phase === 'lobby').sort((a, b) => b.data.at - a.data.at)[0];
          if (g) {
            codeBuf = g.data.code;
            await C.enter(g.data.code);
            break;
          }
          await QP.sleep(1000);
        }
      })();
    render();
    setInterval(tickOnly, 250);
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && C.gid) {
        key = '';
        render();
      }
    });
  })();
})();
