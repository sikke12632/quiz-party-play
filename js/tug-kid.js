/* tug-kid.js — 아이 디벗의 「줄다리기」 (작업/결정-줄다리기.md)
 *   const v = QP.TugView.mount(부모요소, KidClient);  v.unmount();   — 미니게임(defend) 화면
 *   QP.TugScreens.html(C, { tIcon, tname })                            — 모이는 곳·정답·결과·끝 화면 HTML (null = 보물 지키기 화면 그대로)
 *   QP.TugScreens.chip(C, nOk)                                         — 위쪽 띠의 「내 힘」 칩
 * 박자 판정은 이 기기가 직접(QP.TugJudge). 서버엔 내 점수만 b{r, x:0, y:0, d, k:0, h:0} 로 1초 3번까지. 소리 기본 켬(🔊 로 끔, 이 기기에 기억).
 * 내 팀은 늘 왼쪽에 그린다(줄이 왼쪽으로 가면 우리 팀이 이기는 중).
 */
(function () {
  'use strict';
  const QP = window.QP,
    PX = window.PX;
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const SEND_S = 0.34;
  const CSS = `
.tgdef { position: fixed; inset: 0; display: flex; flex-direction: column; background: linear-gradient(#8fd0e8, #bfe8f5 55%, #8cc461 55%); user-select: none; touch-action: manipulation; z-index: 1; }
.tgdef .tg-card { background: #fbf4e4; border: 3px solid #3a2a20; border-radius: 4px; box-shadow: 4px 4px 0 rgba(40,25,10,.35); color: #2a211b; }
.tgdef .tg-top { display: flex; align-items: center; gap: 12px; padding: 10px 14px; }
.tgdef .tg-team { display: flex; align-items: center; gap: 8px; padding: 4px 14px 4px 4px; font-size: 16px; }
.tgdef .tg-team img { width: 44px; height: 44px; image-rendering: pixelated; border: 2px solid #3a2a20; }
.tgdef .tg-team b { font-family: 'QPTitle', serif; font-weight: normal; font-size: 22px; }
.tgdef .tg-pow { padding: 6px 14px; font-size: 16px; } .tgdef .tg-pow b { font-family: 'QPTitle', serif; font-weight: normal; font-size: 26px; color: #d9573f; }
.tgdef .tg-pow small { color: #5a4636; }
.tgdef .tg-sp { flex: 1; }
.tgdef .tg-time { padding: 6px 16px; font-size: 16px; } .tgdef .tg-time b { font-family: 'QPTitle', serif; font-weight: normal; font-size: 28px; }
.tgdef .tg-mute { width: 52px; height: 52px; font-size: 26px; padding: 0; cursor: pointer; }
.tgdef .tg-mini { margin: 2px auto 0; width: min(900px, 92vw); }
.tgdef .tg-mini canvas, .tgdef .tg-lane canvas { width: 100%; display: block; image-rendering: pixelated; image-rendering: crisp-edges; }
.tgdef .tg-lane { margin: 8px auto 0; width: min(1100px, 96vw); position: relative; }
.tgdef .tg-call { position: absolute; left: 58%; top: 50%; transform: translate(-50%, -50%); font-family: 'QPTitle', serif; font-size: 64px; color: #fff; -webkit-text-stroke: 2px #3a2a20; text-shadow: 4px 4px 0 #3a2a20; white-space: nowrap; pointer-events: none; }
.tgdef .tg-judge { position: absolute; left: 1%; top: 102%; font-family: 'QPTitle', serif; font-size: 38px; white-space: nowrap; pointer-events: none; text-shadow: 3px 3px 0 #fff, -2px -2px 0 #fff; }
.tgdef .tg-judge.perfect { color: #e0a000; } .tgdef .tg-judge.good { color: #2f8f5a; } .tgdef .tg-judge.lost, .tgdef .tg-judge.late { color: #8a7a6a; } .tgdef .tg-judge.miss { color: #c0392b; }
.tgdef .tg-score { position: absolute; right: 2%; top: -56px; text-align: right; font-size: 16px; color: #5a4636; }
.tgdef .tg-score b { font-family: 'QPTitle', serif; font-weight: normal; font-size: 34px; color: #2a211b; display: block; line-height: 1; }
.tgdef .tg-combo { font-family: 'QPTitle', serif; color: #d9573f; font-size: 20px; }
.tgdef .tg-tap { flex: 1; margin: 16px auto 18px; width: min(900px, 92vw); min-height: 140px; border: 4px solid #3a2a20; border-radius: 18px; background: linear-gradient(#ff8a6a, #d9573f); color: #fff; font-family: 'QPTitle', serif; font-size: 72px; box-shadow: 0 10px 0 #8f3022; cursor: pointer; touch-action: none; text-shadow: 4px 4px 0 #8f3022; }
.tgdef .tg-tap.on { transform: translateY(8px); box-shadow: 0 2px 0 #8f3022; filter: brightness(1.1); }
.tgdef .tg-tap small { display: block; font-family: 'QPBody', sans-serif; font-size: 18px; text-shadow: none; opacity: .9; }
.tgdef .tg-big { position: fixed; left: 0; right: 0; top: 34%; text-align: center; pointer-events: none; z-index: 5; }
.tgdef .tg-big .w { display: inline-block; font-family: 'QPTitle', serif; font-size: 92px; color: #fff; -webkit-text-stroke: 3px #3a2a20; text-shadow: 6px 6px 0 #3a2a20; }
.tgdef .tg-big .w small { display: block; font-size: 26px; -webkit-text-stroke: 0; text-shadow: 2px 2px 0 #3a2a20; }
.tgdef .tg-big .w.spurt { color: #ffe36a; }
@media (max-height: 760px) { .tgdef .tg-tap { min-height: 110px; font-size: 60px; margin: 10px auto 12px; } .tgdef .tg-call { font-size: 54px; } }
.tgres .tgface { font-size: 64px; line-height: 1.1; }
.tgres .tgbig { font-family: 'QPTitle', serif; font-size: 52px; color: #d9573f; }
.tgres .tgvs { font-size: 20px; color: #5a4636; margin-top: 6px; } .tgres .tgvs b { font-family: 'QPTitle', serif; font-weight: normal; font-size: 30px; color: #2a211b; }
`;
  function css() {
    if (document.getElementById('tg-css')) return;
    const s = document.createElement('style');
    s.id = 'tg-css';
    s.textContent = CSS;
    document.head.appendChild(s);
  }
  const ls = {
    get: (k) => {
      try {
        return localStorage.getItem(k);
      } catch (e) {
        return null;
      }
    },
    set: (k, v) => {
      try {
        localStorage.setItem(k, v);
      } catch (e) {}
    },
  };
  const teamA = (C, t) => ((C.game.tt && C.game.tt.teams[t]) || {}).a || 0;
  const animal = (C, t) => QP.TEAM_ANIMALS[teamA(C, t)][0];

  function mount(parent, C) {
    css();
    const A = QP.TugArt;
    A.muted = ls.get('qp-tug-mute') === '1';
    const root = document.createElement('div');
    root.className = 'tgdef';
    root.innerHTML =
      '<div class="tg-top"><div class="tg-card tg-team"><img alt=""><div><b></b> <small></small></div></div>' +
      '<div class="tg-card tg-pow">내 힘 <b>1</b> <small></small></div><div class="tg-sp"></div>' +
      '<div class="tg-card tg-time">남은 시간 <b>25</b>초</div><button class="tg-card tg-mute" title="소리 켜기/끄기"></button></div>' +
      '<div class="tg-mini"><canvas width="240" height="40"></canvas></div>' +
      '<div class="tg-lane"><canvas width="320" height="64"></canvas><div class="tg-call"></div><div class="tg-judge"></div><div class="tg-score">내 점수<b>0</b><span class="tg-combo"></span></div></div>' +
      '<button class="tg-tap">차!<small>「차!」에 맞춰 눌러요 · 스페이스바도 돼요 · 막 누르면 헛손질</small></button>' +
      '<div class="tg-big"></div>';
    parent.appendChild(root);
    const $ = (s) => root.querySelector(s);
    const mini = $('.tg-mini canvas').getContext('2d'),
      lane = $('.tg-lane canvas').getContext('2d');
    mini.imageSmoothingEnabled = lane.imageSmoothingEnabled = false;
    const muteBtn = $('.tg-mute');
    const setMute = () => (muteBtn.textContent = A.muted ? '🔇' : '🔊');
    setMute();
    muteBtn.onclick = () => {
      A.muted = !A.muted;
      ls.set('qp-tug-mute', A.muted ? '1' : '0');
      setMute();
      if (!A.muted) A.audio();
    };

    let mg = -1,
      B = [],
      J = null,
      team = 0,
      lastSend = -9,
      sentFinal = false,
      sentScore = -1,
      judgeTxt = '',
      judgeCls = '',
      judgeAt = -9,
      fx = 0,
      lastFrame = performance.now(),
      sound = { i: 0 },
      shownPos = 0;
    function setup(L) {
      mg = L.mg;
      B = QP.tgBeats(L.dur);
      team = C.seat.team;
      const pow = (L.pw && L.pw[C.seat.sid]) || 1;
      J = new QP.TugJudge(B, pow);
      J.score = (L.d && L.d[C.seat.sid]) || 0; // 새로 고침했으면 이어서
      sound = { i: 0 };
      lastSend = -9;
      sentFinal = false;
      sentScore = -1;
      shownPos = 0;
      judgeTxt = '';
      const an = animal(C, team);
      $('.tg-team img').src = PX.icon(an, C.seat.cl || 0, 48);
      $('.tg-team b').textContent = QP.teamName(teamA(C, team));
      $('.tg-team small').textContent = '· 나 = ' + (C.seat.nick || '');
      $('.tg-pow b').textContent = pow;
      $('.tg-pow small').textContent = '(방금 ' + ((C.game.cfg && C.game.cfg.per) || 5) + '문제 중 ' + Math.min(9, (C.seat.res && C.seat.res.blk) || 0) + '개 맞힘)';
    }
    const gNow = (L) => (C.net.now() - L.t0) / QP.ms(1);
    function show(kind, g) {
      judgeTxt = { perfect: '완벽!', good: '좋아!', lost: '무효', miss: '헛손질! 다음 차 무효', late: '놓침' }[kind] || '';
      judgeCls = kind;
      judgeAt = g;
    }
    function press(e) {
      if (e) e.preventDefault();
      const L = C.game && C.game.live;
      $('.tg-tap').classList.add('on');
      setTimeout(() => $('.tg-tap').classList.remove('on'), 90);
      if (!L || !J || L.mg !== mg || L.end !== null) return;
      A.audio(); // 첫 누름에 소리 깨우기
      const g = gNow(L);
      if (g < -0.2 || g > L.dur + 0.2) return;
      const r = J.tap(g);
      if (r.kind === 'dup') return;
      show(r.kind, g);
      if (r.kind === 'perfect' || r.kind === 'good') {
        fx = 0.1;
        A.SND.hit(r.kind === 'perfect');
      } else if (r.kind === 'miss') A.SND.miss();
    }
    const tapBtn = $('.tg-tap');
    tapBtn.addEventListener('pointerdown', press);
    tapBtn.addEventListener('contextmenu', (e) => e.preventDefault());
    const kd = (e) => {
      if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) press(e);
    };
    addEventListener('keydown', kd);

    function send(L, g) {
      if (J.score === sentScore && g < L.dur) return;
      sentScore = J.score;
      C.write({ b: { r: L.mg, x: 0, y: 0, d: J.score, k: 0, h: 0 } });
    }
    function teamAvgs(L) {
      const ro = C.game.roster || [];
      return [0, 1].map((t) => {
        const ks = ro.filter((x) => x.team === t);
        if (!ks.length) return 0;
        return ks.reduce((n, x) => n + (x.sid === C.seat.sid ? J.score : (L.d && L.d[x.sid]) || 0), 0) / ks.length;
      });
    }

    let raf = 0,
      gone = false;
    function frame(now) {
      if (gone) return;
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.1, (now - lastFrame) / 1000);
      lastFrame = now;
      const L = C.game && C.game.live;
      if (!L || L.kind !== 'tug' || !C.seat || C.phase !== 'defend') return;
      if (L.mg !== mg) setup(L);
      const g = gNow(L);
      const over = L.end !== null || g >= L.dur;
      if (!over) {
        for (const i of J.tick(g)) if (i >= 0) show('late', g);
        if (!A.muted) A.schedule(B, g, sound);
      }
      // 보내기
      if (!sentFinal && (g >= L.dur || L.end !== null)) {
        sentFinal = true;
        send(L, L.dur);
      } else if (!over && g >= 0 && g - lastSend >= SEND_S) {
        lastSend = g;
        send(L, g);
      }
      fx = Math.max(0, fx - dt);
      // 줄 위치(내 팀이 왼쪽)
      const av = teamAvgs(L);
      const pos = QP.tgPos(av[0], av[1]) * (team === 0 ? 1 : -1);
      shownPos += (pos - shownPos) * Math.min(1, dt * 4);
      drawMini(L, g);
      A.drawLane(lane, B, g, J, fx);
      hud(L, g, over, pos);
    }
    function drawMini(L, g) {
      const W = 240;
      mini.fillStyle = '#8cc461';
      mini.fillRect(0, 0, W, 40);
      mini.fillStyle = '#79b052';
      for (let x = 0; x < W; x += 6) mini.fillRect(x, 30 + (x % 12 ? 0 : 2), 2, 2);
      mini.fillStyle = '#fff';
      mini.fillRect(40, 4, 2, 34);
      mini.fillRect(W - 42, 4, 2, 34);
      mini.fillRect(W / 2, 6, 1, 30);
      const off = Math.round(-shownPos * 78);
      const ro = C.game.roster || [];
      // 내 팀(왼쪽)은 나를 가운데 쪽 맨 앞에
      const mine = A.listOf(ro, team, animal(C, team), C.seat.sid).sort((a, b) => b.me - a.me).slice(0, 6);
      const theirs = A.listOf(ro, 1 - team, animal(C, 1 - team), '').slice(0, 6);
      const ra = A.drawTeam(mini, { cx: W / 2 + off, ground: 34, side: 0, list: mine, B, g, gap: 12, mark: true });
      const rb = A.drawTeam(mini, { cx: W / 2 + off, ground: 34, side: 1, list: theirs, B, g, gap: 12 });
      A.drawRope(mini, 0, W, ra.ropeY, [ra, rb], W / 2 + off);
    }
    let bigSig = '';
    function hud(L, g, over, pos) {
      $('.tg-time b').textContent = Math.ceil(Math.max(0, Math.min(L.dur, L.dur - Math.max(0, g))));
      $('.tg-score b').textContent = J.score;
      $('.tg-combo').textContent = J.combo >= 3 ? J.combo + ' 연속!' : '';
      const c = over ? { txt: '', s: 1 } : A.callOf(B, g);
      const call = $('.tg-call');
      if (call.textContent !== c.txt) call.textContent = c.txt;
      call.style.transform = 'translate(-50%, -50%) scale(' + c.s + ')';
      const j = $('.tg-judge'),
        a = g - judgeAt;
      j.textContent = a < 0.6 ? judgeTxt : '';
      j.className = 'tg-judge ' + judgeCls;
      j.style.transform = 'translateY(' + -Math.max(0, a) * 30 + 'px)';
      let big = '';
      if (g < 0) big = '<span class="w">' + Math.ceil(-g) + '<small>줄다리기! 「차!」에 맞춰 눌러요</small></span>';
      else if (g < 0.6) big = '<span class="w">시작!</span>';
      else if (over) {
        const win = L.end !== null ? L.win : pos === 0 ? -1 : pos > 0 ? team : 1 - team;
        big = '<span class="w">' + (win < 0 ? '비겼어요!' : win === team ? '우리 팀 승리!' : '아쉬워요!') + '<small>' + (L.end !== null ? '끝선까지 끌어왔어요!' : '내 점수 ' + J.score + '점 · TV를 봐요') + '</small></span>';
      } else if (g > 19 && g < 19.9) big = '<span class="w spurt">막판 스퍼트!</span>';
      if (big !== bigSig) $('.tg-big').innerHTML = bigSig = big;
    }
    raf = requestAnimationFrame(frame);
    return {
      root,
      unmount() {
        gone = true;
        cancelAnimationFrame(raf);
        removeEventListener('keydown', kd);
        root.remove();
      },
    };
  }
  QP.TugView = { mount };

  /* ---------- 모이는 곳·정답·결과·끝 (kid-ui.js scTreasure 가 C.tug 일 때 부른다) ---------- */
  function html(C, h) {
    css();
    const ph = C.phase,
      s = C.seat || {},
      c = C.game.cfg;
    if (ph === 'lobby') {
      const mates = (C.game.roster || []).filter((x) => x.team === s.team);
      return (
        '<div class="center hello thello"><img class="bigdoll pxi" src="' + h.tIcon(144) + '" alt=""><h2>나는 <b>' + esc(s.nick) + '</b></h2>' +
        '<p class="tline">우리 팀은 <b>' + h.tname + '</b> · ' + mates.length + '명</p>' +
        '<div class="tmates">' + mates.map((m) => '<span' + (m.sid === s.sid ? ' class="me"' : '') + '><img class="pxi" src="' + h.tIcon(40, m.cl) + '" alt="">' + esc(m.sid === s.sid ? '나' : m.nick) + '</span>').join('') + '</div>' +
        '<p>문제 ' + c.per + '개를 풀 때마다 <b>줄다리기</b>를 해요.<br>「여·엉·<b>차!</b>」 — 차!에 맞춰 눌러요. 많이 맞힐수록 내 힘이 세져요!</p></div>'
      );
    }
    if (ph === 'question') return null;
    if (ph === 'reveal') {
      const res = C.myRes();
      if (!res) return null;
      const pw = QP.tgPower(res.blk);
      return (
        '<div class="center tres ' + (res.ok ? 'ok' : 'no') + '">' + (res.ok ? '<div class="ok-badge">맞았어요!</div>' : '<div class="no-badge">' + (res.my === null ? '시간이 다 됐어요' : '아쉬워요') + '</div>') +
        (!res.ok ? (res.my !== null ? '<div class="my">내 답: ' + esc(res.my) + '</div>' : '') + '<div class="ans' + (String(res.ans).length > 6 ? ' long' : '') + '">정답은 <b>' + esc(res.ans) + '</b></div>' + (res.exp ? '<div class="exp">' + esc(res.exp) + '</div>' : '') : '') +
        '<div class="tpow"><span>내 힘</span><b>' + pw + '</b></div>' +
        '<p class="tnext">' + (res.left === 0 ? '이제 <b>줄다리기</b>! 디벗을 봐요' : '줄다리기까지 <b>' + res.left + '</b>문제') + '</p></div>'
      );
    }
    if (ph === 'dres') {
      const d = s.dres;
      if (!d) return '<div class="center"><div class="spin"></div></div>';
      const me = s.team,
        my = d.avg[me],
        their = d.avg[1 - me];
      return (
        '<div class="center tres dres tgres"><div class="tgface">' + (d.win === 1 ? '🎉' : d.win === 0 ? '💪' : '🤝') + '</div>' +
        '<div class="tgbig">' + (d.win === 1 ? '우리 팀 승리!' : d.win === 0 ? '아쉬워요!' : '비겼어요!') + '</div>' +
        '<div class="tgvs">한 명당 점수 <b>' + my + '</b> : ' + their + (d.early ? ' · 끝선까지!' : '') + '</div>' +
        '<p class="sub">내 점수 <b>' + d.my + '</b> (내 힘 ' + d.pw + ') · 이긴 횟수 ' + d.wins[me] + ' : ' + d.wins[1 - me] + '</p><p class="tvnote">TV를 봐요!</p></div>'
      );
    }
    if (ph === 'end') {
      const v = s.fin;
      if (!v) return '<div class="center"><div class="spin"></div></div>';
      return (
        '<div class="center endcard"><img class="bigdoll pxi" src="' + h.tIcon(144) + '" alt=""><h1 class="t">' + h.tname + ' ' + (v.rank === 1 ? '승리!' : '2등') + '</h1>' +
        '<p class="sum">이긴 횟수 ' + (v.tot || 0) + '번 · 내 점수 합 ' + (v.my || 0) + ' · 내가 맞힌 문제 ' + v.nOk + '개</p><p>' + (v.rank === 1 ? '와, 우리 팀이 이겼어요!' : '수고했어요! TV를 봐요.') + '</p></div>'
      );
    }
    return null;
  }
  // 위쪽 띠(kid-ui.js trTop)의 「무기 n단계」 자리
  function chip(C, nOk) {
    return '<div class="wlv">내 힘 <b>' + QP.tgPower(nOk) + '</b></div>';
  }
  QP.TugScreens = { html, chip };
})();
