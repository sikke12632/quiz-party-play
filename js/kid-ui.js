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
  function phaseTotal() {
    const c = C.game.cfg,
      ph = C.phase;
    return ph === 'question' ? qTime() : { dres: c.tResult, cres: c.tResult, fres: c.tResult, chest: c.tChest, reveal: c.tReveal, result: c.tResult + (C.mafia && mp().rollEnd ? c.tRoll || 0 : 0), vote: c.tVote, show: c.tShow }[ph] || 1;
  }
  function qTime() {
    const q = C.mafia ? C.game.q : C.seat && C.seat.q;
    return Math.max(C.game.cfg.tQ, (q && q.time) || 0);
  }
  function keypad(id, extra) {
    const k = ['1', '2', '3', '4', '5', '6', '7', '8', '9', extra || '', '0', '⌫'];
    return '<div class="keys" id="' + id + '">' + k.map((x) => (x ? '<button data-k="' + x + '">' + x + '</button>' : '<span></span>')).join('') + '</div>';
  }

  function viewKey() {
    if (!C) return 'boot';
    if (C.screen === 'seat' && C.game && C.game.closed) return 'closed';
    const sc = C.screen;
    if (sc !== 'seat') return sc + '|' + (C.err || '') + '|' + (sc === 'busy' ? C.num : '');
    if (C.mafia) return 'M|' + mafiaKey();
    if (C.treasure) return 'T|' + trKey();
    if (C.chase) return 'C|' + chKey();
    if (C.flip) return 'F|' + flKey();
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

  /* ================= 도깨비 찾기 (작업/결정-마피아.md) =================
   * 도깨비와 마을 사람 화면은 누르는 횟수·때·모양이 똑같다(옆에서 봐도 구별되면 안 된다).
   * 역할은 「내 역할」을 눌렀을 때만 4초 보인다(같은 모양·같은 색). 내 추리판은 이 기기에만 저장(서버에 안 씀).
   */
  let lastHTML = '';
  let mBoard = false,
    mRole = false,
    mRoleSeen = false,
    mWasSeen = false,
    roleT = null;
  const pcache = {};
  const dp = (av) => pcache[av] || (pcache[av] = JK.dollPortrait(av, 72));
  const marks = () => QP.kv('qp-marks-' + C.gid).get() || {};
  const mp = () => (C.game && C.game.mp) || { hints: [], caught: [], good: [], log: [] };
  const nickOf = (sid) => {
    const d = (C.game.dolls || []).find((x) => x.sid === sid);
    return d ? d.nick : '?';
  };
  // 돋보기·지목 인형을 고르는 중인가(그동안은 소문이 와도 화면을 다시 그리지 않는다)
  function picking() {
    const r = C.round,
      S = C.sent;
    return C.phase === 'result' && ((C.mine('magR') && S.mg !== r) || (C.mine('nomR') && S.tg !== r && C.rollLeft() <= 0));
  }
  // 힌트·소문 띠(아이 화면 아래): 마지막 힌트 + 최근 소문
  function cluesHTML() {
    const p = mp();
    const last = p.hints[p.hints.length - 1];
    const R = QP.groupRumors(p.rumors).slice(0, 10);
    if (!last && !R.length) return '';
    return (
      '<div class="clues">' +
      (last ? '<div class="ch hint1"><b>힌트 ' + p.hints.length + '</b> 이 중에 도깨비가 있어요 ' + last.map((sid) => '<span>' + esc(nickOf(sid)) + '</span>').join('') + '</div>' : '') +
      (R.length ? '<div class="ch rum"><b>수근수근</b>' + R.map((x) => '<span class="' + (x.g ? 'y' : 'n') + '">' + esc(nickOf(x.sid)) + QP.josa(nickOf(x.sid), '은', '는') + ' ' + (x.g ? '도깨비래' : '아니래') + (x.n > 1 ? ' ×' + x.n : '') + '</span>').join('') + '</div>' : '') +
      '</div>'
    );
  }
  function mafiaKey() {
    const r = C.round,
      ph = C.phase,
      S = C.sent;
    const k = (x) => (C.mine(x) ? 1 : 0);
    const res = C.myRes();
    const p = mp();
    return [ph, r, res ? (res.ok ? 'ok' : 'no') : '', S.a === r ? 'a' : '', k('magR'), S.mg === r ? 'mg' : '', ph === 'result' && !mBoard && picking() ? '' : (p.rumors || []).length, k('magRes'), k('nomR'), C.rollLeft() > 0 ? 'roll' : '', S.tg === r ? 'tg' : '', k('voteR'), S.v === r ? 'v' + S.vy : '', p.caught.length, p.good.length, p.wrong || 0, p.hints.length, mBoard, mRole, (C.game.dolls || []).length, C.seat && C.seat.fin ? 'f' : '', C.seat && C.seat.role ? 'R' + (C.seat.role.g ? 'g' : '') + (C.seat.role.was ? 'w' : '') : ''].join('|');
  }
  function mTopbar() {
    const s = C.seat || {};
    const p0 = mp();
    const ph = C.phase;
    const t = Math.ceil(C.timeLeft());
    const label = { question: '문제', result: '결과', vote: '투표', show: '공개' }[ph];
    const started = ph !== 'lobby';
    return (
      '<div class="topbar"><div class="me"><img src="' + myPortrait() + '" alt=""><span><small>나는</small> <b>' + esc(s.nick) + '</b></span></div>' +
      (started && s.role ? '<button class="mbtn" data-act="role">내 역할</button>' : '') +
      (started ? '<button class="mbtn" data-act="board">내 추리판</button>' : '') +
      (started && p0.limit ? '<span class="lamps" title="마을 등불">' + Array.from({ length: p0.limit }, (_, k) => '<i class="lp ' + (k < p0.limit - (p0.wrong || 0) ? 'on' : 'off') + '"></i>').join('') + '</span>' : '') +
      '<div class="spacer"></div>' +
      (C.round ? '<div class="rd">' + C.round + ' / ' + (C.game.cfg.Q || 12) + '번째</div>' : '') +
      (label ? '<div class="timer"><span>' + label + '</span> <b id="tN">' + t + '</b>초 <span class="bar"><i id="tB" style="width:' + Math.round((100 * C.timeLeft()) / phaseTotal()) + '%"></i></span></div>' : '') +
      '</div>'
    );
  }
  // 역할 카드: 도깨비·마을 사람 모두 같은 모양·같은 색·같은 줄 수
  function roleHTML() {
    const r = C.seat && C.seat.role;
    if (!r) return '';
    // 2판: 도깨비끼리 서로 모른다. 걸린 도깨비는 착한 시민(was)
    const G = (C.game.cfg && C.game.cfg.G) || 3;
    const line1 = r.g ? '도깨비' : r.was ? '착한 시민' : '마을 사람';
    const line2 = r.g ? '다른 도깨비가 누군지는 몰라요' : r.was ? '이제 마을 편! 남은 도깨비를 찾아요' : '숨은 도깨비 ' + G + '명을 찾아요';
    const line3 = r.g ? '가짜 돋보기로 누명을 · 걸리면 착해져요' : '문제를 맞혀 돋보기와 힌트를 모아요';
    return '<div class="rolecard" data-act="role"><p class="lb">내 역할 (나만 봐요)</p><h2>' + line1 + '</h2><p>' + esc(line2) + '</p><p class="sm">' + line3 + '</p><p class="sm">누르면 닫혀요</p></div>';
  }
  function grid(pick, attr, opts) {
    opts = opts || {};
    const p = mp();
    const m = marks();
    const latest = p.hints[p.hints.length - 1] || [];
    return (
      '<div class="dgrid' + (opts.small ? ' small' : '') + '">' +
      (C.game.dolls || [])
        .map((d) => {
          const me = d.sid === C.seat.sid,
            caught = p.caught.includes(d.sid),
            good = p.good.includes(d.sid);
          const nh = p.hints.filter((h) => h.includes(d.sid)).length;
          const rum = (p.rumors || []).filter((x) => x.sid === d.sid);
          const rNo = rum.some((x) => !x.g),
            rYes = rum.filter((x) => x.g).length;
          const dis = pick && (me || caught || good);
          const cls = (caught ? ' caught' : '') + (good ? ' good' : '') + (me ? ' me' : '') + (m[d.sid] ? ' x' : '') + (latest.includes(d.sid) ? ' hint' : '');
          return (
            '<button class="dc' + cls + '"' + (dis ? ' disabled' : ' data-' + attr + '="' + d.sid + '"') + '><img src="' + dp(d.av) + '" alt=""><span>' + esc(d.nick) + '</span>' +
            (caught ? '<i class="st ok">착해짐</i>' : good ? '<i class="st ok">시민</i>' : me ? '<i class="st me">나</i>' : rNo ? '<i class="st ok">아니래</i>' : rYes ? '<i class="st">도깨비래' + (rYes > 1 ? ' ×' + rYes : '') + '</i>' : nh ? '<i class="st hn">힌트 ' + nh + '</i>' : '') +
            '</button>'
          );
        })
        .join('') +
      '</div>'
    );
  }
  function boardHTML() {
    return '<div class="mboard"><div class="mbh"><b>내 추리판</b> <small>눌러서 ✕ 표시 · 이 기기에만 저장돼요 · 노란 테두리 = 마지막 힌트</small><button class="mbtn" data-act="board">닫기</button></div>' + grid(false, 'mark') + hintList() + rumorList() + '</div>';
  }
  // 수근수근 소문(돋보기 결과). "아니래"는 늘 참, "도깨비래"는 가짜일 수도
  function hintList() {
    const H = mp().hints || [];
    if (!H.length) return '';
    return '<div class="rumors hl"><b>힌트</b>' + H.map((h, i) => '<span class="h">' + (i + 1) + ': ' + h.map((sid) => esc(nickOf(sid))).join(', ') + '</span>').reverse().join('') + '</div>';
  }
  function rumorList() {
    const R = QP.groupRumors(mp().rumors);
    if (!R.length) return '';
    return '<div class="rumors"><b>수근수근</b>' + R.map((x) => '<span class="' + (x.g ? 'y' : 'n') + '">' + esc(nickOf(x.sid)) + QP.josa(nickOf(x.sid), '은', '는') + ' ' + (x.g ? '도깨비래' : '아니래') + (x.n > 1 ? ' ×' + x.n : '') + '</span>').join('') + '</div>';
  }
  function scMafia() {
    const ph = C.phase,
      r = C.round,
      s = C.seat || {},
      p = mp(),
      S = C.sent;
    if (ph === 'lobby')
      return '<div class="center hello"><img class="bigdoll" src="' + myPortrait() + '" alt=""><h2>나는 <b>' + esc(s.nick) + '</b></h2><p>도깨비 찾기! 시작하면 「내 역할」이 나와요.<br>말로 하는 건 괜찮아요. <b>화면은 보여 주지 않아요.</b></p></div>';
    if (ph === 'question') return scGame(); // 문제 화면은 황금 찾기와 같다(모두 같은 문제)
    if (ph === 'result') {
      const res = C.myRes();
      const q = C.game.q || {};
      if (!res) return '<div class="center card"><h2>다음 문제부터 해요</h2></div>';
      if (!res.ok)
        return (
          '<div class="wrongcard"><div class="no-badge">' + (res.my === null ? '시간이 다 됐어요' : '아쉬워요') + '</div><div class="q2">' + esc(q.q) + '</div>' +
          (res.my !== null ? '<div class="my">내 답: ' + esc(res.my) + '</div>' : '') +
          '<div class="ans' + (String(q.ans || '').length > 6 ? ' long' : '') + '">정답은 <b>' + esc(q.ans) + '</b></div>' + (q.exp ? '<div class="exp">' + esc(q.exp) + '</div>' : '') +
          '</div><p class="waitnote">이번 투표는 맞힌 친구만 해요. 다음 문제에서 맞혀 봐요!</p>'
        );
      // 돋보기(진짜·가짜 똑같이 보임): 고르면 결과가 TV 소문으로 뜬다
      const hasMag = C.mine('magR');
      if (hasMag && S.mg !== r) return '<div class="pickhead"><span class="kind mag">돋보기!</span> 누구를 볼까요? <small>도깨비면 TV 수근수근에 떠요 · 누가 봤는지는 안 나와요</small></div>' + grid(true, 'mg', { small: true });
      const mr = C.mine('magRes');
      let top = hasMag
        ? mr
          ? '<div class="magres' + (mr.g ? ' g' : '') + '"><small>' + (mr.g ? 'TV 수근수근에 떴어요' : '나만 봐요') + '</small><img src="' + dp((C.game.dolls.find((d) => d.sid === mr.sid) || {}).av) + '"><b>' + esc(nickOf(mr.sid)) + '</b>' + QP.josa(nickOf(mr.sid), '은', '는') + ' ' + (mr.g ? '<em>도깨비래요!</em>' : '도깨비가 <em>아니에요</em>') + '</div>'
          : '<div class="center"><div class="spin"></div></div>'
        : '<div class="emptybox">맞았어요! <small>TV 소문을 봐요</small></div>';
      if (C.rollLeft() > 0) top += '<p class="rollnote">두근두근… 누가 지목권을 받을까요? <b>TV를 봐요!</b></p>';
      else if (C.mine('nomR') && S.tg !== r) return '<div class="pickhead"><span class="kind">지목권!</span> 도깨비 같은 친구를 골라요 <button class="mbtn" data-nom="">넘기기</button></div>' + grid(true, 'nom', { small: true });
      if (C.mine('nomR') && S.tg === r) top += '<p class="waitnote2">' + (S.tgSid ? '「' + esc(nickOf(S.tgSid)) + '」' + QP.josa(nickOf(S.tgSid), '을', '를') + ' 지목했어요. 곧 투표해요.' : '지목을 넘겼어요.') + '</p>';
      return '<div class="center mres">' + top + '</div>';
    }
    if (ph === 'vote') {
      const nom = p.nom;
      if (!nom) return '<div class="center"><div class="spin"></div></div>';
      const tgt = C.game.dolls.find((d) => d.sid === nom.target) || {},
        by = C.game.dolls.find((d) => d.sid === nom.by) || {};
      const head = '<div class="nomcard"><div class="who"><img src="' + dp(by.av) + '"><span>' + esc(by.nick) + '</span></div><div class="arrow">지목 →</div><div class="who t"><img src="' + dp(tgt.av) + '"><span>' + esc(tgt.nick) + '</span></div></div>';
      if (nom.target === s.sid) return '<div class="center mvote">' + head + '<h2>내가 지목됐어요!</h2><p>맞힌 친구들이 투표해요. 말로 나를 지켜요!</p></div>';
      if (!C.mine('voteR')) return '<div class="center mvote">' + head + '<p>이번 문제를 맞힌 친구들이 투표해요.</p></div>';
      if (S.v === r) return '<div class="center mvote">' + head + '<h2>' + (S.vy === 'Y' ? '찬성' : '반대') + '했어요</h2><p>결과를 기다려요.</p></div>';
      return '<div class="center mvote">' + head + '<h2>' + esc(tgt.nick) + QP.josa(tgt.nick, '은', '는') + ' 도깨비일까요?</h2><div class="vbtns"><button class="go yes" data-act="yes">도깨비 같아요<small>찬성</small></button><button class="go no" data-act="no">아닌 것 같아요<small>반대</small></button></div></div>';
    }
    if (ph === 'show') {
      const l = p.last;
      if (!l) return '<div class="center card"><h2>이번엔 지목이 없었어요</h2></div>';
      const tgt = C.game.dolls.find((d) => d.sid === l.target) || {};
      const msg = !l.pass ? '찬성이 절반을 못 넘어서 그대로 넘어가요' : l.goblin ? '도깨비였어요! 이제 착한 시민이 됐어요' : '착한 ' + tgt.nick + QP.josa(tgt.nick, '이었어요', '였어요') + '! 풀려났어요';
      const lampNote = l.pass && !l.goblin ? '<p class="lampnote">마을 등불이 하나 꺼졌어요 (남은 등불 ' + Math.max(0, (p.limit || 3) - (p.wrong || 0)) + '개)</p>' : '';
      return '<div class="center mshow' + (l.pass ? (l.goblin ? ' caught' : ' good') : ' pass0') + '"><img class="bigdoll" src="' + dp(tgt.av) + '"><h1 class="t">' + esc(msg) + '</h1>' + lampNote + QP.voteBar(l.yes, l.no, l.n) + '</div>';
    }
    if (ph === 'end') {
      const f = s.fin || {};
      const win = p.winner || f.winner;
      // 걸려서 착해진 도깨비는 마을 편이 된다
      const meWin = (win === 'village') !== (!!f.g && !f.caught);
      return '<div class="center endcard"><img class="bigdoll" src="' + myPortrait() + '" alt=""><h1 class="t">' + (win === 'village' ? '마을 승!' : '도깨비 승!') + '</h1><p class="sum">나는 ' + (f.g ? (f.caught ? '도깨비였다가 착해졌어요' : '도깨비였어요') : '마을 사람이었어요') + ' · ' + (meWin ? '우리 편이 이겼어요!' : '아쉬워요!') + '</p><p>도깨비: ' + (p.goblins || []).map(nickOf).map(esc).join(', ') + '</p><p>맞힌 문제 ' + (f.nOk || 0) + '개 · TV를 봐요!</p></div>';
    }
    return '';
  }

  function render() {
    // 도깨비 찾기: 판이 시작되면 역할 카드를 처음 한 번 5초 보여 준다(모두 같은 때·같은 모양)
    // 걸려서 착한 시민이 되면 역할 카드를 한 번 더 보여 준다
    const wasNow = !!(C && C.seat && C.seat.role && C.seat.role.was);
    if (wasNow && !mWasSeen) (mWasSeen = true), (mRoleSeen = false);
    if (C && C.mafia && C.screen === 'seat' && C.phase !== 'lobby' && C.seat && C.seat.role && !mRoleSeen) {
      mRoleSeen = true;
      mRole = true;
      clearTimeout(roleT);
      roleT = setTimeout(() => ((mRole = false), (key = ''), render()), 5000);
    }
    // 도깨비 찾기: 등불이 꺼질수록 화면 배경이 어두워진다
    const dk = C && C.mafia && C.game && C.game.mp ? String(Math.min(3, C.game.mp.wrong || 0)) : '';
    if (document.body.dataset.dark !== dk) document.body.dataset.dark = dk;
    const k = viewKey();
    // 보물 지키기 미니게임: 도트 화면을 붙여 둔다(다시 그리지 않는다)
    const inDef = C && C.treasure && C.screen === 'seat' && C.phase === 'defend';
    if (inDef && !tview) {
      $app.innerHTML = lastHTML = '';
      tview = (C.tug ? QP.TugView : C.boss ? QP.BossView : QP.TreasureView).mount($app, C);
    } else if (!inDef && tview) {
      tview.unmount();
      tview = null;
      key = '';
    }
    if (inDef) return (key = k);
    // 엄마 피해 도망가기 미니게임: 위 맵·아래 단추 화면을 붙여 둔다
    const inCh = C && C.chase && C.screen === 'seat' && C.phase === 'chase';
    if (inCh && !cview) {
      $app.innerHTML = lastHTML = '';
      cview = QP.ChaseView.mount($app, { game: () => C.game, now: () => C.net.now(), me: C.seat.sid, pick: (code, l) => C.pickLane(code, l), picked: (code) => (C.sent.pk ? C.sent.pk[code] : undefined) });
    } else if (!inCh && cview) {
      cview.unmount();
      cview = null;
      key = '';
    }
    if (inCh) return (key = k);
    // 도깨비 뒤집기: 뒤집기(눈치게임) 화면을 붙여 둔다
    const inFl = C && C.flip && C.screen === 'seat' && C.phase === 'pick';
    if (inFl && !fview) {
      $app.innerHTML = lastHTML = '';
      fview = QP.FlipView.mount($app, C);
    } else if (!inFl && fview) {
      fview.unmount();
      fview = null;
      key = '';
    }
    if (inFl) return (key = k);
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
    else if (C.screen === 'seat' && C.game && C.game.closed) h = '<div class="center card"><h2>선생님이 판을 닫았어요</h2><p>새 입장 번호로 다시 들어와요.</p><div class="row"><button class="go" data-act="restart">처음으로</button></div></div>';
    else if (C.screen === 'gone') h = '<div class="center card"><h2>판이 없어졌어요</h2><div class="row"><button class="go" data-act="restart">처음으로</button></div></div>';
    else if (C.treasure) h = trTop() + scTreasure();
    else if (C.chase) h = chTop() + scChase();
    else if (C.flip) h = flTop() + scFlip();
    else if (C.mafia) h = mTopbar() + ((b) => b + (!mBoard && !/dgrid/.test(b) && ['result', 'vote', 'show'].includes(C.phase) ? cluesHTML() : ''))(scMafia()) + (mBoard ? boardHTML() : '') + (mRole ? roleHTML() : '');
    else h = topbar() + scGame();
    // 판이 시작되면 열어 둔 놀이 방법 카드는 닫는다
    if (C && C.phase !== 'lobby' && QP.Howto && document.getElementById('hw-back')) QP.Howto.close();
    // 모이는 곳: 「놀이 방법」 카드 단추(작업/결정-설명페이지.md)
    if (C && C.screen === 'seat' && C.phase === 'lobby' && C.game && !C.game.closed && QP.Howto && QP.Howto.has(C.game.mode)) h += '<button class="howbtn" data-act="howto">📖 놀이 방법</button>';
    // 내용이 같으면 다시 그리지 않는다(다시 그리는 순간 누른 손가락이 사라지지 않게)
    if (h !== lastHTML || !$app.firstChild) $app.innerHTML = lastHTML = h;
    // 상자 3D: 캔버스는 한 번 만들어 붙였다 뗐다 한다
    if (showChest) {
      if (!chestCv) {
        chestCv = document.createElement('canvas');
        chestCv.id = 'chestcv';
      }
      $app.prepend(chestCv);
      if (!chest) {
        try {
          if (!JK.has3D()) throw new Error('WebGL 없음');
          chest = JK.ChestScene.init(chestCv);
        } catch (e) {
          // 3D가 막힌 기기: 상자는 그림 단추로(누르는 곳은 같다)
          document.body.classList.add('no3d');
          chest = { setActive() {}, reset() {}, choose() {}, open() {} };
        }
      }
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
      const total = phaseTotal();
      tB.style.width = Math.round((100 * left) / total) + '%';
    }
    const g = document.getElementById('goldN');
    if (g && C.seat) g.textContent = fmt(C.seat.gold);
    // 선생님 화면이 멈췄는지: 마감이 6초 넘게 지났는데 그대로
    const stuck = C.game && ['question', 'chest', 'reveal', 'result', 'vote', 'show', 'defend', 'dres', 'chase', 'cres', 'pick', 'fres'].includes(C.phase) && C.game.endsAt && C.net.now() - C.game.endsAt > QP.ms(6);
    document.getElementById('net').hidden = !stuck;
    if (C.mafia && C.phase === 'result' && viewKey() !== key) render(); // 지목권 뽑기가 끝나면 화면을 바꾼다
  }

  /* ================= 보물 지키기 (작업/결정-보물지키기.md) ================= */
  let tview = null;
  const tAnimal = () => {
    const tm = C.game.tt && C.game.tt.teams[C.seat.team];
    return tm ? tm.a : 0;
  };
  const tIcon = (size, cl, team) => {
    const tm = C.game.tt && C.game.tt.teams[team === undefined ? C.seat.team : team];
    return PX.icon(QP.TEAM_ANIMALS[tm ? tm.a : 0][0], cl === undefined ? C.seat.cl || 0 : cl, size);
  };
  // 이번 묶음에서 맞힌 수(= 다음 보물 지키기 무기 단계)
  function tBlk() {
    const s = C.seat,
      tt = C.game.tt || {};
    const start = (tt.mg || 0) * (tt.per || 5) + 1;
    return s && s.res && s.res.r >= start ? s.res.blk : 0;
  }
  function trKey() {
    const ph = C.phase,
      r = C.round,
      s = C.seat || {};
    if (ph === 'lobby') return 'lobby|' + s.nick + '|' + s.team + '|' + (C.game.roster || []).filter((x) => x.team === s.team).map((x) => x.sid).join();
    if (ph === 'question') return 'q|' + r + '|' + (C.myQ() ? C.myQ().id : 'none') + '|' + (C.sent.a === r ? 'sent' : '');
    if (ph === 'reveal') return 'rv|' + r + '|' + (C.myRes() ? 1 : 0);
    if (ph === 'defend') return 'def|' + (C.game.live ? C.game.live.mg : '');
    if (ph === 'dres') return 'dres|' + (s.dres ? s.dres.mg : '');
    if (ph === 'end') return 'end|' + (s.fin ? 1 : 0);
    return ph;
  }
  function trTop() {
    const s = C.seat || {},
      ph = C.phase,
      c = C.game.cfg;
    if (s.team === undefined) return '';
    const lv = QP.trLevel(tBlk());
    const total = c.per * c.M;
    const label = { question: '문제', reveal: '정답', dres: '결과' }[ph];
    const t = Math.ceil(C.timeLeft());
    return (
      '<div class="topbar tr"><div class="me"><img class="pxi" src="' + tIcon(48) + '" alt=""><span><small>나는</small> <b>' + esc(s.nick) + '</b></span></div>' +
      '<div class="tchip">' + esc(QP.teamName(tAnimal())) + '</div>' +
      (ph !== 'lobby' && ph !== 'end' ? C.tug ? QP.TugScreens.chip(C, tBlk()) : C.boss ? QP.BossScreens.chip(C, tBlk()) : '<div class="wlv">무기 <b>' + lv + '</b>단계 <span class="pips">' + [1, 2, 3, 4, 5].map((i) => '<i class="' + (i <= lv ? 'on' : '') + '"></i>').join('') + '</span></div>' : '') +
      '<div class="spacer"></div>' +
      (C.round ? '<div class="rd">' + Math.min(C.round, total) + ' / ' + total + '문제</div>' : '') +
      (label ? '<div class="timer"><span>' + label + '</span> <b id="tN">' + t + '</b>초 <span class="bar"><i id="tB" style="width:' + Math.round((100 * C.timeLeft()) / (phaseTotal() || 1)) + '%"></i></span></div>' : '') +
      '</div>'
    );
  }
  function scTreasure() {
    const ph = C.phase,
      s = C.seat || {},
      c = C.game.cfg;
    if (s.team === undefined) return '<div class="center"><div class="spin"></div></div>';
    const tname = esc(QP.teamName(tAnimal()));
    // 보스 슈팅: 모이는 곳·정답·결과·끝 화면은 boss-kid.js (문제 화면은 null → 아래 그대로)
    if (C.tug) {
      const th = QP.TugScreens.html(C, { tIcon, tname });
      if (th !== null) return th;
    }
    if (C.boss) {
      const bh = QP.BossScreens.html(C, { tIcon, tname });
      if (bh !== null) return bh;
    }
    if (ph === 'lobby') {
      const mates = (C.game.roster || []).filter((x) => x.team === s.team);
      return (
        '<div class="center hello thello"><img class="bigdoll pxi" src="' + tIcon(144) + '" alt=""><h2>나는 <b>' + esc(s.nick) + '</b></h2>' +
        '<p class="tline">우리 팀은 <b>' + tname + '</b> · ' + mates.length + '명</p>' +
        '<div class="tmates">' + mates.map((m) => '<span' + (m.sid === s.sid ? ' class="me"' : '') + '><img class="pxi" src="' + tIcon(40, m.cl) + '" alt="">' + esc(m.sid === s.sid ? '나' : m.nick) + '</span>').join('') + '</div>' +
        '<p>문제 ' + c.per + '개를 풀 때마다 <b>보물 지키기</b>를 해요.<br>많이 맞힐수록 무기가 세져요!</p></div>'
      );
    }
    if (ph === 'question') return scGame();
    if (ph === 'reveal') {
      const res = C.myRes();
      if (!res) return '<div class="center card"><h2>다음 문제부터 해요</h2><p>조금만 기다려요.</p></div>';
      const lv = QP.trLevel(res.blk);
      const go = res.left === 0;
      return (
        '<div class="center tres ' + (res.ok ? 'ok' : 'no') + '">' + (res.ok ? '<div class="ok-badge">맞았어요!</div>' : '<div class="no-badge">' + (res.my === null ? '시간이 다 됐어요' : '아쉬워요') + '</div>') +
        (!res.ok ? (res.my !== null ? '<div class="my">내 답: ' + esc(res.my) + '</div>' : '') + '<div class="ans' + (String(res.ans).length > 6 ? ' long' : '') + '">정답은 <b>' + esc(res.ans) + '</b></div>' + (res.exp ? '<div class="exp">' + esc(res.exp) + '</div>' : '') : '') +
        '<div class="tpow"><span>무기</span><b>' + lv + '단계</b><span class="pips">' + [1, 2, 3, 4, 5].map((i) => '<i class="' + (i <= lv ? 'on' : '') + '"></i>').join('') + '</span></div>' +
        '<p class="tnext">' + (go ? '이제 <b>보물 지키기</b>! TV도 봐요' : '보물 지키기까지 <b>' + res.left + '</b>문제') + '</p></div>'
      );
    }
    if (ph === 'dres') {
      const d = s.dres;
      if (!d) return '<div class="center"><div class="spin"></div></div>';
      return (
        '<div class="center tres dres"><p class="lbl">' + tname + ' 보물</p><div class="thrt">' + Array.from({ length: c.hearts }, (_, i) => PX.heart(i < d.h)).join('') + '</div>' +
        '<div class="rk">' + (d.h > 0 ? '하트 <b>' + d.h + '</b>개를 지켰어요!' : '보물을 다 뺏겼어요…') + '</div>' +
        '<p class="sub">이번에 <b>' + d.rank + '</b>등 / ' + d.n + '팀 · 물리친 적 ' + d.k + '마리</p><p class="tvnote">TV에서 팀 순위를 봐요!</p></div>'
      );
    }
    if (ph === 'end') {
      const v = s.fin;
      if (!v) return '<div class="center"><div class="spin"></div></div>';
      return (
        '<div class="center endcard"><img class="bigdoll pxi" src="' + tIcon(144) + '" alt=""><h1 class="t">' + tname + ' ' + v.rank + '등!</h1>' +
        '<p class="sum">지킨 하트 ' + v.tot + '개 · 물리친 적 ' + v.k + '마리 · 내가 맞힌 문제 ' + v.nOk + '개</p><p>' + (v.rank === 1 ? '와, 우리 팀이 1등이에요!' : '수고했어요! TV를 봐요.') + '</p></div>'
      );
    }
    return '';
  }

  /* ================= 엄마 피해 도망가기 (작업/결정-괴물도망.md) ================= */
  let cview = null;
  const cIcon = (size) => PX.icon(QP.TEAM_ANIMALS[(C.seat && C.seat.an) || 0][0], (C.seat && C.seat.cl) || 0, size);
  function chKey() {
    const ph = C.phase,
      r = C.round,
      s = C.seat || {};
    if (ph === 'lobby') return 'lobby|' + s.nick + '|' + (C.game.roster || []).length;
    if (ph === 'question') return 'q|' + r + '|' + (C.myQ() ? C.myQ().id : 'none') + '|' + (C.sent.a === r ? 'sent' : '');
    if (ph === 'reveal') return 'rv|' + r + '|' + (C.myRes() ? 1 : 0);
    if (ph === 'chase') return 'ch|' + (C.game.ch ? C.game.ch.mg : '');
    if (ph === 'cres') return 'cres|' + (C.game.cres ? C.game.cres.mg : '');
    if (ph === 'end') return 'end|' + (s.fin ? 1 : 0);
    return ph;
  }
  function chTop() {
    const s = C.seat || {},
      ph = C.phase,
      c = C.game.cfg,
      cc = C.game.cc || {};
    if (s.an === undefined) return '';
    const total = c.per * c.M;
    const label = { question: '문제', reveal: '정답', cres: '결과' }[ph];
    return (
      '<div class="topbar tr"><div class="me"><img class="pxi" src="' + cIcon(48) + '" alt=""><span><small>나는</small> <b>' + esc(s.nick) + '</b></span></div>' +
      '<div class="tchip">우리 반 ' + PX.heart(true) + ' <b>' + (cc.hearts === undefined ? c.hearts : cc.hearts) + '</b></div>' +
      '<div class="spacer"></div>' +
      (C.round ? '<div class="rd">' + Math.min(C.round, total) + ' / ' + total + '문제</div>' : '') +
      (label ? '<div class="timer"><span>' + label + '</span> <b id="tN">' + Math.ceil(C.timeLeft()) + '</b>초 <span class="bar"><i id="tB" style="width:' + Math.round((100 * C.timeLeft()) / (phaseTotal() || 1)) + '%"></i></span></div>' : '') +
      '</div>'
    );
  }
  function scChase() {
    const ph = C.phase,
      s = C.seat || {},
      c = C.game.cfg,
      cc = C.game.cc || {};
    if (s.an === undefined) return '<div class="center"><div class="spin"></div></div>';
    if (ph === 'lobby')
      return (
        '<div class="center hello thello"><img class="bigdoll pxi" src="' + cIcon(144) + '" alt=""><h2>나는 <b>' + esc(s.nick) + '</b></h2>' +
        '<p class="tline"><b>우리 반 전체가 한 팀</b>이에요 · 지금 ' + (C.game.roster || []).length + '명</p>' +
        '<p>문제 ' + c.per + '개를 풀 때마다 <b>엄마 피해 도망가기</b>를 해요.<br>맵을 보고 뚫린 길의 모양을 재빨리 눌러요! 우리 반 하트 ' + c.hearts + '개를 지켜요.<br>문제를 ' + QP.chStampN(c) + '개 넘게 맞히면 <b>숙제 도장</b>! 엄마한테 잡혀도 한 번 봐줘요.</p></div>'
      );
    if (ph === 'question') return scGame();
    if (ph === 'reveal') {
      const res = C.myRes();
      if (!res) return '<div class="center card"><h2>다음 문제부터 해요</h2><p>조금만 기다려요.</p></div>';
      return (
        '<div class="center tres ' + (res.ok ? 'ok' : 'no') + '">' + (res.ok ? '<div class="ok-badge">맞았어요!</div>' : '<div class="no-badge">' + (res.my === null ? '시간이 다 됐어요' : '아쉬워요') + '</div>') +
        (!res.ok ? (res.my !== null ? '<div class="my">내 답: ' + esc(res.my) + '</div>' : '') + '<div class="ans' + (String(res.ans).length > 6 ? ' long' : '') + '">정답은 <b>' + esc(res.ans) + '</b></div>' + (res.exp ? '<div class="exp">' + esc(res.exp) + '</div>' : '') : '') +
        // 숙제 도장: 이번 묶음에서 stampN 개 맞히면 엄마가 한 번 봐준다
        (((n) => '<div class="tpow cst"><span>숙제 도장</span>' + (res.blk >= n ? '<b>받았어요!</b>' : '<b>' + (res.blk || 0) + ' / ' + n + '</b><small>개 맞히면</small>') + '</div>')(QP.chStampN(c))) +
        '<p class="tnext">' + (res.left === 0 ? '이제 <b>엄마 피해 도망가기</b>! 디벗을 꼭 봐요' : '엄마 피해 도망가기까지 <b>' + res.left + '</b>문제') + '</p></div>'
      );
    }
    if (ph === 'cres') {
      const d = C.game.cres;
      if (!d) return '<div class="center"><div class="spin"></div></div>';
      const over = d.hearts <= 0;
      return (
        '<div class="center tres dres"><p class="lbl">엄마 피해 도망가기 ' + d.mg + '번째</p>' +
        '<div class="rk">' + (over ? '우리 반 하트가 다 떨어졌어요…' : '우리 반 하트 <b>' + d.hearts + '</b>개 남았어요') + '</div>' +
        '<p class="sub">끝까지 도망간 친구 <b>' + d.alive + '</b>명 / ' + d.n + '명 · 엄마한테 잡힌 친구 ' + d.caught + '명' + (d.saved ? ' · 숙제 도장으로 살아남 ' + d.saved + '명' : '') + '</p>' +
        '<p class="tvnote">' + (over ? '곧 끝나요. TV를 봐요' : d.mg >= c.M ? '곧 최종 결과!' : '다음 문제에서 또 만나요. 다음엔 모두 다시 달려요!') + '</p></div>'
      );
    }
    if (ph === 'end') {
      const v = s.fin;
      if (!v) return '<div class="center"><div class="spin"></div></div>';
      return (
        '<div class="center endcard"><img class="bigdoll pxi" src="' + cIcon(144) + '" alt=""><h1 class="t">' + (v.over ? '게임 오버!' : '우리 반 성공!') + '</h1>' +
        (v.over ? '' : '<p class="stars">' + [1, 2, 3].map((i) => '<span class="' + (i <= v.stars ? 'on' : '') + '">★</span>').join('') + '</p>') +
        '<p class="sum">남은 하트 ' + v.hearts + ' / ' + v.max + ' · 내가 맞힌 문제 ' + v.nOk + '개</p><p>' + (v.over ? '엄마한테 너무 많이 잡혔어요. 다음 판에 다시 도망가요!' : '모두 엄마를 따돌렸어요! TV를 봐요.') + '</p></div>'
      );
    }
    return '';
  }

  /* ================= 도깨비 뒤집기 (작업/결정-뒤집기.md) ================= */
  let fview = null,
    fHold = false;
  const fIcon = (size) => PX.icon(QP.TEAM_ANIMALS[(C.seat && C.seat.an) || 0][0], (C.seat && C.seat.cl) || 0, size);
  // 「내 정체 확인」 꾹 누르기(뒤집기 화면 밖에서도)
  addEventListener('pointerdown', (e) => {
    if (C && C.flip && e.target.closest && e.target.closest('#app [data-hold]') && !fview) (fHold = true), (key = ''), render();
  });
  for (const ev of ['pointerup', 'pointercancel', 'blur']) addEventListener(ev, () => { if (fHold) (fHold = false), (key = ''), render(); });
  function flKey() {
    const ph = C.phase,
      r = C.round,
      s = C.seat || {};
    const h = fHold ? 'H' : '';
    if (ph === 'lobby') return 'lobby|' + s.nick + h;
    if (ph === 'question') return 'q|' + r + '|' + (C.myQ() ? C.myQ().id : 'none') + '|' + (C.sent.a === r ? 'sent' : '');
    if (ph === 'reveal') return 'rv|' + r + '|' + (C.myRes() ? 1 : 0) + '|' + ((C.game.fl && C.game.fl.hint && C.game.fl.hint.k) || 0) + h;
    if (ph === 'pick') return 'pk|' + (C.game.fl ? C.game.fl.code : '');
    if (ph === 'fres') return 'fr|' + (s.fres ? s.fres.r + String(s.fres.flipped) : '') + h;
    if (ph === 'end') return 'end|' + (s.fin ? 1 : 0) + h;
    return ph + h;
  }
  function flTop() {
    const s = C.seat || {},
      ph = C.phase,
      c = C.game.cfg;
    if (s.an === undefined) return '';
    const total = c.per * c.R;
    const label = { question: '문제', reveal: '정답', fres: '결과' }[ph];
    return (
      '<div class="topbar tr"><div class="me"><img class="pxi" src="' + fIcon(48) + '" alt=""><span><small>나는</small> <b>' + esc(s.nick) + '</b></span></div>' +
      '<div class="tchip">도깨비 뒤집기</div><div class="spacer"></div>' +
      (C.round ? '<div class="rd">' + Math.min(C.round, total) + ' / ' + total + '문제</div>' : '') +
      (label ? '<div class="timer"><span>' + label + '</span> <b id="tN">' + Math.ceil(C.timeLeft()) + '</b>초 <span class="bar"><i id="tB" style="width:' + Math.round((100 * C.timeLeft()) / (phaseTotal() || 1)) + '%"></i></span></div>' : '') +
      '</div>'
    );
  }
  function confettiKid() {
    const cs = ['#ffd23e', '#e8504a', '#5fbf55', '#3f9be8', '#b06ad8'];
    return '<div class="flconf">' + Array.from({ length: 40 }, (_, i) => '<i style="left:' + ((i * 41) % 100) + '%;background:' + cs[i % cs.length] + ';animation-delay:' + ((i * 0.19) % 3).toFixed(2) + 's"></i>').join('') + '</div>';
  }
  function scFlip() {
    const ph = C.phase,
      s = C.seat || {},
      c = C.game.cfg,
      F = C.game.fl || {};
    if (s.an === undefined) return '<div class="center"><div class="spin"></div></div>';
    const who = s.role ? '<div class="fwhobox">' + QP.flWho(s.role, fHold, s.fres ? s.fres.now : s.role.o) + '</div>' : '';
    const hint = F.hint ? '<div class="fhint"><img class="pxi" src="' + QP.flArt().DEV + '"> 악마는 이 <b>' + F.hint.k + '</b>명 중에 있어요! (친구 고를 때 「악마 후보」로 보여요)</div>' : '';
    if (ph === 'lobby')
      return (
        '<div class="center hello thello"><img class="bigdoll pxi" src="' + fIcon(144) + '" alt=""><h2>나는 <b>' + esc(s.nick) + '</b></h2>' +
        '<p class="tline">시작하면 반은 <b>도깨비</b>, 반은 <b>인간</b>이 돼요. 그중 한 명은 몰래 <b>악마</b>!</p>' +
        '<p>문제 ' + c.per + '개마다 친구를 뒤집어요. 맞힌 문제 수만큼 표를 받아요(최대 ' + c.maxPick + '표).<br>끝날 때 <b>다수 무리</b>에 있으면 이겨요. 그런데 다수 무리에 <b>악마</b>가 있으면 소수 무리가 이겨요!<br>처음 종족을 끝까지 지키면 <b>★ 끝까지</b> 칭찬도 받아요.</p></div>'
      );
    if (ph === 'question') return scGame();
    if (ph === 'reveal') {
      const res = C.myRes();
      if (!res) return '<div class="center card"><h2>다음 문제부터 해요</h2><p>조금만 기다려요.</p></div>';
      return (
        '<div class="center tres ' + (res.ok ? 'ok' : 'no') + '">' + who + (res.ok ? '<div class="ok-badge">맞았어요!</div>' : '<div class="no-badge">' + (res.my === null ? '시간이 다 됐어요' : '아쉬워요') + '</div>') +
        (!res.ok ? (res.my !== null ? '<div class="my">내 답: ' + esc(res.my) + '</div>' : '') + '<div class="ans' + (String(res.ans).length > 6 ? ' long' : '') + '">정답은 <b>' + esc(res.ans) + '</b></div>' : '') +
        '<div class="tpow"><span>이번 뒤집기 표</span><b>' + Math.min(c.maxPick, res.blk || 0) + '장</b></div>' +
        '<p class="tnext">' + (res.left === 0 ? '이제 <b>뒤집기!</b> 디벗을 꼭 봐요' : '뒤집기까지 <b>' + res.left + '</b>문제') + '</p>' + hint + '</div>'
      );
    }
    if (ph === 'fres') {
      const d = s.fres;
      if (!d) return '<div class="center"><div class="spin"></div></div>';
      // 종족 이름은 안 보인다(옆에서 보면 들키니까). 바뀌었는지만
      return (
        '<div class="center tres dres">' + who + '<div class="rk">' + (d.flipped ? '앗, <b>뒤집혔어요!</b> 지금은 처음' + (d.now === s.role.o ? ' 그대로예요' : '과 반대 종족이에요') : '휴, 이번엔 <b>그대로</b>예요!') + '</div>' +
        '<p class="sub">「내 정체 확인」을 꾹 누르면 지금 상태가 보여요 · TV에서 반 전체 결과를 봐요</p>' + hint + '</div>'
      );
    }
    if (ph === 'end') {
      const v = s.fin;
      if (!v) return '<div class="center"><div class="spin"></div></div>';
      const A = QP.flArt();
      const why = v.devil ? (v.win ? '끝까지 다수 무리에 숨어 있었어요!' : '소수 쪽으로 쫓겨났어요…') : v.win ? '우리 ' + QP.FL_SP[v.now] + ' 무리가 이겼어요!' : '우리 ' + QP.FL_SP[v.now] + ' 무리가 아쉽게 졌어요.';
      const loyal = !v.devil && v.o === v.now ? '<p class="loyal">★ 처음 종족(' + QP.FL_SP[v.o] + ')을 끝까지 지켰어요!</p>' : '';
      return (
        '<div class="center endcard' + (v.win ? ' flwinme' : ' fllose') + '">' + (v.win ? confettiKid() : '') + '<img class="bigdoll pxi" src="' + (v.devil ? A.DEV : v.now === 'g' ? A.GOB : A.HUM) + '" alt=""><h1 class="t">' + (v.devil ? (v.win ? '악마 승리!' : '악마 패배…') : v.win ? '이겼다!' : '아쉬워요!') + '</h1>' +
        '<p class="sum">처음 ' + QP.FL_SP[v.o] + ' → 끝 ' + QP.FL_SP[v.now] + (v.devil ? ' · 사실 너는 악마였어요' : '') + '</p>' + loyal + '<p>' + why + ' TV에서 모두의 결과를 봐요.</p></div>'
      );
    }
    return '';
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
          (s.q && s.q.r === r ? '<div class="q2">' + esc(s.q.q) + '</div>' : '') +
          (res.my !== null ? '<div class="my">내 답: ' + esc(res.my) + '</div>' : '') +
          '<div class="ans' + (String(res.ans).length > 6 ? ' long' : '') + '">정답은 <b>' + esc(res.ans) + '</b></div>' + (res.exp ? '<div class="exp">' + esc(res.exp) + '</div>' : '') +
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
          '<div class="center endcard"><img class="bigdoll" src="' + myPortrait() + '" alt=""><h1 class="t">' + (v.rank ? v.rank + '등!' : '끝!') + '</h1><p class="sum"><span class="coin"></span> ' + fmt(v.gold) + ' · 맞힌 문제 ' + v.nOk + '개</p><p>' + (v.rank && v.rank <= 3 ? '와, 시상대에 올랐어요! TV를 봐요.' : v.rank ? '수고했어요! TV에서 시상대를 봐요.' : '다음 판에는 금을 모아 봐요!') + '</p></div>'
        );
      }
      const mv = (C.game.board || []).find((b) => b.sid === s.sid);
      const arrow = mv && mv.mv > 0 ? '<span class="up">▲' + mv.mv + '</span>' : mv && mv.mv < 0 ? '<span class="dn">▼' + -mv.mv + '</span>' : '';
      const notes = (v.notes || []).map(noteText).filter(Boolean);
      return (
        '<div class="center revcard"><p class="lbl">이번 라운드</p><div class="delta ' + (v.delta >= 0 ? 'plus' : 'minus') + '">' + (v.delta >= 0 ? '+' : '') + fmt(v.delta) + '</div>' +
        (v.rank ? '<div class="rk">' + v.rank + '등 <small>/ ' + v.n + '명</small> ' + arrow + '</div>' : '<div class="rk none">아직 등수가 없어요 <small>금을 모으면 등수가 생겨요</small></div>') +
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
    if (d.act === 'howto') return QP.Howto && QP.Howto.open(C.game.mode);
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
    // 도깨비 찾기
    if (d.act === 'box') return C.openBox();
    if (d.mg) return C.magnify(d.mg);
    if (d.nom !== undefined) return C.nominate(d.nom);
    if (d.act === 'yes' || d.act === 'no') return C.vote(d.act === 'yes');
    if (d.act === 'board') {
      mBoard = !mBoard;
      key = '';
      return render();
    }
    if (d.act === 'role') {
      mRole = !mRole;
      mRoleSeen = true;
      key = '';
      clearTimeout(roleT);
      if (mRole) roleT = setTimeout(() => ((mRole = false), (key = ''), render()), 4000);
      return render();
    }
    if (d.mark) {
      const m = marks();
      m[d.mark] = !m[d.mark];
      QP.kv('qp-marks-' + C.gid).set(m);
      key = '';
      return render();
    }
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
    // 문제 답도 키보드로(2026-11-06 담임): 숫자 답은 숫자·점·지우기·Enter, 보기는 1~4, OX 는 O·X
    else if (C.screen === 'seat' && C.myQ()) {
      const sv = document.getElementById('sv');
      if (sv && document.getElementById('sk')) {
        const dot = !!document.querySelector('#sk [data-k="."]');
        if (/^[0-9]$/.test(e.key) || (e.key === '.' && dot)) {
          if (shortBuf.length < 8) shortBuf += e.key;
        } else if (e.key === 'Backspace') shortBuf = shortBuf.slice(0, -1);
        else if (e.key === 'Enter') {
          if (shortBuf && C.answer(shortBuf)) {
            C.sent.v = shortBuf;
            shortBuf = '';
          }
        } else return;
        e.preventDefault();
        const el = document.getElementById('sv');
        if (el) el.innerHTML = esc(shortBuf) || '&nbsp;';
        return;
      }
      const q = C.myQ();
      let v = null;
      if (q.type === 'ox' && /^[oOxXㅐㅌ]$/.test(e.key)) v = /[oOㅐ]/.test(e.key) ? 'O' : 'X';
      if (q.type === 'choice' && /^[1-9]$/.test(e.key) && q.ch[+e.key - 1] !== undefined) v = q.ch[+e.key - 1];
      if (v !== null && C.answer(v)) C.sent.v = v;
    }
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
