/* tug-tv.js — 선생님 화면(TV)의 「줄다리기」 (작업/결정-줄다리기.md)
 *   QP.TugTV.draw(부모, ref, {onResults, onNew}) — 심판 소식마다 부른다 / QP.TugTV.hide()
 * 미니게임 중: 위쪽 박자표(아이 디벗과 같은 박자), 가운데 큰 외침(여·엉·차!), 아래 마당에서 두 팀이 줄을 당김(2배 크기·두 줄).
 * 그 밖(문제·결과·끝): 보물 지키기 TV 틀(.trtv)에 두 팀 줄.
 * 소리: 선생님 화면(전자칠판)에서 「여엉~(작게) 차!(크게)」 목소리 + 쿵 (🔊 단추로 끔, 이 컴퓨터에 기억). 아이 디벗은 딴딴딴 소리.
 */
(function () {
  'use strict';
  const QP = window.QP;
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const CSS = `
.tgtv { position: fixed; inset: 0; background: #8fd0e8; z-index: 2; overflow: hidden; }
.tgtv > canvas { position: absolute; inset: 0; width: 100%; height: 100%; image-rendering: pixelated; image-rendering: crisp-edges; }
.tgtv .tg-card { background: #fbf4e4; border: 3px solid #3a2a20; border-radius: 4px; box-shadow: 4px 4px 0 rgba(40,25,10,.35); }
.tgtv .tg-hud { position: absolute; left: 0; right: 0; top: 14px; display: flex; justify-content: space-between; align-items: flex-start; padding: 0 26px; pointer-events: none; }
.tgtv .tg-tm { padding: 8px 18px; display: flex; align-items: center; gap: 12px; min-width: 250px; }
.tgtv .tg-tm img { width: 56px; height: 56px; image-rendering: pixelated; border: 3px solid #3a2a20; }
.tgtv .tg-tm b { font-family: 'QPTitle', serif; font-weight: normal; font-size: 30px; display: block; color: #d9573f; }
.tgtv .tg-tm.r b { color: #3f7fa8; }
.tgtv .tg-tm span { font-size: 18px; color: #5a4636; } .tgtv .tg-tm span i { font-style: normal; font-family: 'QPTitle', serif; font-size: 26px; color: #2a211b; }
.tgtv .tg-mid { text-align: center; color: #fff; text-shadow: 3px 3px 0 #3a2a20; }
.tgtv .tg-mid h1 { margin: 0; font-family: 'QPTitle', serif; font-weight: normal; font-size: 44px; } .tgtv .tg-mid h1 small { font-size: 26px; }
.tgtv .tg-mid p { margin: 0; font-size: 22px; } .tgtv .tg-mid p b { font-family: 'QPTitle', serif; font-weight: normal; font-size: 30px; color: #ffe36a; }
.tgtv .tg-lane { position: absolute; left: 50%; top: 118px; transform: translateX(-50%); width: 62%; border: 3px solid #3a2a20; box-shadow: 4px 4px 0 rgba(40,25,10,.35); }
.tgtv .tg-lane canvas { width: 100%; display: block; image-rendering: pixelated; }
.tgtv .tg-call { position: absolute; left: 0; right: 0; top: 37%; text-align: center; font-family: 'QPTitle', serif; font-size: 110px; color: #fff; -webkit-text-stroke: 3px #3a2a20; text-shadow: 7px 7px 0 #3a2a20; pointer-events: none; }
.tgtv .tg-big { position: absolute; left: 0; right: 0; top: 34%; text-align: center; pointer-events: none; }
.tgtv .tg-big .w { display: inline-block; font-family: 'QPTitle', serif; font-size: 100px; color: #fff; -webkit-text-stroke: 3px #3a2a20; text-shadow: 6px 6px 0 #3a2a20; }
.tgtv .tg-big .w small { display: block; font-size: 28px; -webkit-text-stroke: 0; text-shadow: 2px 2px 0 #3a2a20; }
.tgtv .tg-big .w.spurt { color: #ffe36a; }
.tgtv .tg-mute { position: absolute; right: 26px; bottom: 54px; width: 64px; height: 64px; font-size: 32px; padding: 0; cursor: pointer; z-index: 3; }
.tgtv .tg-shift { position: absolute; right: 100px; bottom: 58px; display: flex; align-items: center; gap: 6px; padding: 4px 8px; font-size: 15px; color: #5a4636; z-index: 3; }
.tgtv .tg-shift button { width: 40px; height: 40px; font-size: 20px; border: 2px solid #3a2a20; border-radius: 6px; background: #fff; cursor: pointer; }
.tgtv .tg-foot { position: absolute; left: 0; right: 0; bottom: 12px; text-align: center; color: #fff; font-size: 20px; text-shadow: 2px 2px 0 #3a2a20; }
.tgrows .row .tgwins { font-family: 'QPTitle', serif; font-size: 34px; color: #2a211b; min-width: 120px; text-align: right; } .tgrows .row .tgwins small { font-family: 'QPBody', sans-serif; font-size: 16px; color: #5a4636; display: block; }
.tgrows .row .tgavg { flex: 1; font-size: 20px; color: #5a4636; text-align: center; } .tgrows .row .tgavg b { font-family: 'QPTitle', serif; font-weight: normal; font-size: 34px; color: #d9573f; }
`;
  function css() {
    if (document.getElementById('tgtv-css')) return;
    const s = document.createElement('style');
    s.id = 'tgtv-css';
    s.textContent = CSS;
    document.head.appendChild(s);
  }
  let root = null,
    mode = '',
    sig = '',
    timer = null,
    raf = 0,
    cb = {},
    shownPos = 0;
  const an = (ref, t) => QP.TEAM_ANIMALS[ref.S.t.order[t]][0];

  function hide() {
    clearInterval(timer);
    cancelAnimationFrame(raf);
    raf = 0;
    if (root) root.remove();
    root = null;
    mode = '';
  }

  /* ---------- 미니게임: 마당 ---------- */
  function buildGame(parent, ref) {
    parent.innerHTML = '';
    root = document.createElement('div');
    root.className = 'tgtv';
    root.innerHTML =
      '<canvas width="320" height="180"></canvas>' +
      '<div class="tg-hud"><div class="tg-card tg-tm l"><img alt=""><div><b></b><span></span></div></div>' +
      '<div class="tg-mid"><h1></h1><p></p></div>' +
      '<div class="tg-card tg-tm r"><img alt=""><div><b></b><span></span></div></div></div>' +
      '<div class="tg-lane"><canvas width="320" height="64"></canvas></div><div class="tg-call"></div><div class="tg-big"></div>' +
      '<button class="tg-card tg-mute" title="소리 켜기/끄기"></button>' +
      '<div class="tg-card tg-shift"><button data-sh="-1" title="소리가 화면보다 늦게 들리면">◀</button><span></span><button data-sh="1" title="소리가 화면보다 빨리 들리면">▶</button></div>' +
      '<div class="tg-foot">「차!」에 맞춰 디벗을 누를수록 세게 당겨요 · 정답을 많이 맞힌 친구일수록 힘이 세요 · 인원이 달라도 공평하게(한 명당 평균)</div>';
    parent.appendChild(root);
    mode = 'game';
    shownPos = 0;
    const $ = (s) => root.querySelector(s);
    const fc = $('canvas').getContext('2d'),
      lc = $('.tg-lane canvas').getContext('2d');
    fc.imageSmoothingEnabled = lc.imageSmoothingEnabled = false;
    const A = QP.TugArt;
    let last = performance.now(),
      bigSig = '',
      sound = { i: 0 },
      soundMg = -1;
    // 소리: 기본 켬, 이 컴퓨터에 기억
    let muted = false;
    try {
      muted = localStorage.getItem('qp-tug-tv-mute') === '1';
    } catch (e) {}
    const mb = $('.tg-mute');
    const setMute = () => (mb.textContent = muted ? '🔇' : '🔊');
    setMute();
    mb.onclick = () => {
      muted = !muted;
      try {
        localStorage.setItem('qp-tug-tv-mute', muted ? '1' : '0');
      } catch (e) {}
      setMute();
      if (!muted) A.loadVoice();
    };
    if (!muted) A.loadVoice();
    // 소리 박자 맞추기(이 컴퓨터에 기억): ◀ = 소리를 일찍, ▶ = 소리를 늦게. 0.03초씩
    try {
      A.soundShift = +localStorage.getItem('qp-tug-tv-shift') || 0;
    } catch (e) {}
    const shTxt = () => ($('.tg-shift span').textContent = '소리 박자 ' + (A.soundShift > 0 ? '일찍 ' : A.soundShift < 0 ? '늦게 ' : '') + (A.soundShift ? Math.abs(Math.round(A.soundShift * 100)) / 100 + '초' : '그대로'));
    shTxt();
    root.querySelectorAll('[data-sh]').forEach(
      (b) =>
        (b.onclick = () => {
          A.soundShift = Math.round(((A.soundShift || 0) + (b.dataset.sh === '-1' ? 0.03 : -0.03)) * 100) / 100;
          try {
            localStorage.setItem('qp-tug-tv-shift', String(A.soundShift));
          } catch (e) {}
          shTxt();
        })
    );
    function frame(now) {
      if (!root || mode !== 'game') return;
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      const L = ref.live,
        S = ref.S;
      if (!L || L.kind !== 'tug') return;
      const B = ref.beats || QP.tgBeats(L.dur);
      const g = (ref.net.now() - L.t0) / QP.ms(1);
      const st = ref.liveTeams();
      const over = L.end !== null || g >= L.dur;
      if (L.mg !== soundMg) (soundMg = L.mg), (sound = { i: 0 });
      if (!muted && !over) {
        A.muted = false;
        A.schedule(B, g, sound, { voice: true });
      }
      shownPos += (st.pos - shownPos) * Math.min(1, dt * 4);
      // 마당
      fc.drawImage(A.field(), 0, 0);
      fc.fillStyle = 'rgba(60,80,30,.25)';
      fc.fillRect(0, 155, 320, 3);
      const off = Math.round(-shownPos * 88);
      const list = (t) => ref.teamSeats(t).map((s) => ({ an: an(ref, t), cl: s.cl || 0 }));
      const ra = A.drawTeam(fc, { cx: 160 + off, ground: 156, side: 0, list: list(0).slice(0, 13), B, g, px: 2, gap: 8, zig: 6 });
      const rb = A.drawTeam(fc, { cx: 160 + off, ground: 156, side: 1, list: list(1).slice(0, 13), B, g, px: 2, gap: 8, zig: 6 });
      A.drawRope(fc, 0, 320, ra.ropeY, [ra, rb], 160 + off);
      A.drawLane(lc, B, g, null, 0);
      // 글자
      for (const [k, t] of [['.l', 0], ['.r', 1]]) {
        $(k + ' img').src = window.PX.icon(an(ref, t), 0, 64);
        $(k + ' b').textContent = QP.teamName(S.t.order[t]);
        $(k + ' span').innerHTML = st.n[t] + '명 · 한 명당 <i>' + Math.round(st.avg[t]) + '</i>점';
      }
      $('.tg-mid h1').innerHTML = '줄다리기 <small>' + (S.t.mg + 1) + ' / ' + S.cfg.M + '</small>';
      $('.tg-mid p').innerHTML = '남은 시간 <b>' + Math.ceil(Math.max(0, Math.min(L.dur, L.dur - Math.max(0, g)))) + '</b>초 · 이긴 횟수 ' + S.t.wins[0] + ' : ' + S.t.wins[1];
      const c = over ? { txt: '', s: 1 } : A.callOf(B, g);
      const call = $('.tg-call');
      if (call.textContent !== c.txt) call.textContent = c.txt;
      call.style.transform = 'scale(' + c.s + ')';
      let big = '';
      if (g < 0) big = '<span class="w">' + Math.ceil(-g) + '<small>줄다리기! 「차!」에 맞춰 디벗을 눌러요</small></span>';
      else if (g < 0.6) big = '<span class="w">시작!</span>';
      else if (over) {
        const win = L.end !== null ? L.win : st.pos > 0 ? 0 : st.pos < 0 ? 1 : -1;
        big = '<span class="w">' + (win < 0 ? '비겼어요!' : esc(QP.teamName(S.t.order[win])) + ' 승리!') + '<small>' + (L.end !== null ? '끝선까지 끌어왔어요!' : '더 많이 당겼어요!') + '</small></span>';
      } else if (g > 19 && g < 19.9) big = '<span class="w spurt">막판 스퍼트!</span>';
      if (big !== bigSig) $('.tg-big').innerHTML = bigSig = big;
    }
    raf = requestAnimationFrame(frame);
  }

  /* ---------- 문제·결과·끝 ---------- */
  function drawRows(parent, ref) {
    const S = ref.S,
      c = S.cfg,
      ph = S.phase,
      T = S.t;
    if (!root || mode !== 'rows' || !parent.contains(root)) {
      parent.innerHTML = '';
      root = document.createElement('div');
      root.className = 'trtv tgrows';
      parent.appendChild(root);
      mode = 'rows';
      sig = '';
    }
    const now = ref.net.now();
    const left = Math.max(0, Math.ceil((S.endsAt - now) / QP.ms(1)));
    const total = c.per * c.M;
    let head = '',
      sub = '';
    const last = T.log[T.log.length - 1] || [];
    if (ph === 'question' || ph === 'reveal') {
      const k = c.per - (((S.round - 1) % c.per) + 1);
      const got = ref.seatList().filter((s) => s.cur && s.cur.r === S.round);
      head = '<h1>' + S.round + ' / ' + total + '번째 문제</h1>';
      sub = (ph === 'question' ? '문제 푸는 중 <b>' + left + '</b>초 · 답한 친구 ' + got.filter((s) => s.ans).length + ' / ' + got.length : '정답 보는 중') + ' · ' + (k ? '줄다리기까지 <b>' + k + '</b>문제' : '이제 <b>줄다리기!</b>');
    } else if (ph === 'dres') {
      const w = last.find((x) => x.win === 1);
      head = '<h1>' + (w ? esc(QP.teamName(T.order[w.t])) + ' 승리!' : '비겼어요!') + '</h1>';
      sub = T.mg >= c.M ? '곧 최종 결과!' : '다음 문제까지 <b>' + left + '</b>초';
    } else if (ph === 'end') {
      head = '<h1>최종 결과</h1>';
      sub = '이긴 횟수 → 같으면 한 명당 점수 합';
    }
    const order = ph === 'end' ? ref.teamBoard().map((x) => x.t) : [0, 1].sort((a, b) => T.wins[b] - T.wins[a] || T.avg[b] - T.avg[a]);
    const body = order
      .map((t, i) => {
        const seats = ref.teamSeats(t),
          blk = seats.reduce((x, s) => x + (s.blk || 0), 0),
          lr = last.find((x) => x.t === t);
        let mid = '';
        if (ph === 'question' || ph === 'reveal') {
          const max = Math.max(1, seats.length * c.per);
          mid = '<div class="trpow"><span>모은 힘</span><span class="bar"><i style="width:' + Math.round((100 * blk) / max) + '%"></i></span><em>맞힌 문제 ' + blk + '</em></div>';
        } else if (ph === 'dres' && lr) mid = '<div class="tgavg">이번 한 명당 <b>' + lr.avg + '</b>점</div>';
        else mid = '<div class="tgavg">한 명당 점수 합 <b>' + Math.round(T.avg[t]) + '</b></div>';
        return '<div class="row' + (i === 0 && T.wins[t] > 0 ? ' first' : '') + '"><div class="rk">' + (i + 1) + '</div><img class="ic" src="' + window.PX.icon(an(ref, t), 0, 64) + '" alt=""><div class="nm">' + esc(QP.teamName(T.order[t])) + '<small>' + seats.length + '명</small></div>' + mid + '<div class="tgwins">' + T.wins[t] + '승<small>' + c.M + '번 중</small></div></div>';
      })
      .join('');
    const foot = ph === 'end' ? '<div class="endbtns"><button class="go" data-tr="res">결과표 보기</button><button class="ghost" data-tr="new">새 판</button></div>' : '<div class="foot">문제를 많이 맞힐수록 줄다리기 때 내 힘이 세져요 · 「차!」에 맞춰 눌러요</div>';
    const h = '<div class="head">' + head + '<p>' + sub + '</p></div><div class="rows n2">' + body + '</div>' + foot;
    if (h !== sig) {
      sig = h;
      root.innerHTML = h;
      root.querySelectorAll('[data-tr]').forEach((b) => (b.onclick = () => (b.dataset.tr === 'res' ? cb.onResults && cb.onResults() : cb.onNew && cb.onNew())));
    }
  }

  function draw(parent, ref, opts) {
    css();
    cb = opts || cb;
    clearInterval(timer);
    const ph = ref.S.phase;
    if (ph === 'defend') {
      if (mode !== 'game' || !root || !parent.contains(root)) {
        hide();
        buildGame(parent, ref);
      }
      return;
    }
    if (mode === 'game') hide();
    drawRows(parent, ref);
    if (ph !== 'end') timer = setInterval(() => drawRows(parent, ref), 250);
  }
  QP.TugTV = { draw, hide };
})();
