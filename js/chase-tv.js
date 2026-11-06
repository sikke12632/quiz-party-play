/* chase-tv.js — 선생님 화면(TV)의 「엄마 피해 도망가기」. 미니게임 중에는 chase-view.js(TV 모양), 그 밖에는 우리 반 하트판.
 *   QP.ChaseTV.draw(부모, ref, {onResults, onNew})  — 심판 소식마다 부른다
 */
(function () {
  'use strict';
  const QP = window.QP,
    PX = window.PX;
  let root = null,
    view = null,
    sig = '',
    timer = null,
    cb = {};
  const game = (ref) => ({ roster: ref.roster(), ch: ref.ch, cfg: ref.S.cfg, cc: ref.pubC() });

  function draw(parent, ref, opts) {
    cb = opts || cb;
    const S = ref.S,
      c = S.cfg,
      C = S.c,
      ph = S.phase;
    if (!root || !parent.contains(root)) {
      parent.innerHTML = '';
      root = document.createElement('div');
      root.className = 'chtv';
      parent.appendChild(root);
      sig = '';
      view = null;
    }
    clearInterval(timer);
    if (ph === 'chase') {
      if (!view) {
        root.innerHTML = '';
        sig = '';
        const g = game(ref);
        view = QP.ChaseView.mount(root, { tv: true, game: () => ((g.ch = ref.ch), (g.cc = ref.pubC()), g), now: () => ref.net.now(), me: null, pick() {}, picked() {} });
      }
      return;
    }
    if (view) {
      view.unmount();
      view = null;
    }
    timer = setInterval(() => draw(parent, ref), 250);
    const now = ref.net.now();
    const left = Math.max(0, Math.ceil((S.endsAt - now) / QP.ms(1)));
    const total = c.per * c.M;
    const hearts = '<div class="bigh">' + PX.heart(C.hearts > 0) + '<b>' + C.hearts + '</b><small>/ ' + c.hearts + '</small></div>';
    let head = '',
      sub = '',
      body = '';
    if (ph === 'question' || ph === 'reveal') {
      const k = c.per - (((S.round - 1) % c.per) + 1);
      const got = ref.seatList().filter((s) => s.cur && s.cur.r === S.round);
      head = '<h1>' + S.round + ' / ' + total + '번째 문제</h1>';
      sub = (ph === 'question' ? '문제 푸는 중 <b>' + left + '</b>초 · 답한 친구 ' + got.filter((s) => s.ans).length + ' / ' + got.length : '정답 보는 중') + ' · ' + (k ? '엄마 피해 도망가기까지 <b>' + k + '</b>문제' : '이제 <b>엄마 피해 도망가기!</b> 디벗을 봐요');
      body = '<p class="lbl">우리 반 하트</p>' + hearts + '<p class="hint">반 전체가 한 팀! 엄마한테 잡힌 친구 한 명마다 하트가 하나 줄어요</p>';
    } else if (ph === 'cres') {
      const d = C.log[C.log.length - 1] || {};
      head = '<h1>엄마 피해 도망가기 ' + d.mg + '번째 결과</h1>';
      sub = C.hearts <= 0 ? '하트가 다 떨어졌어요…' : C.mg >= c.M ? '곧 최종 결과!' : '다음 문제까지 <b>' + left + '</b>초';
      body = '<p class="lbl">우리 반 하트</p>' + hearts + '<p class="hint">끝까지 도망간 친구 <b>' + d.alive + '</b>명 / ' + d.n + '명 · 엄마한테 잡힌 친구 ' + d.caught + '명</p>';
    } else if (ph === 'end') {
      const over = C.hearts <= 0,
        st = QP.chStars(C.hearts, c.hearts);
      head = '<h1>' + (over ? '게임 오버!' : '우리 반 성공!') + '</h1>';
      sub = over ? '엄마한테 너무 많이 잡혔어요. 다음 판에 다시 도망가요!' : '모두 엄마를 따돌렸어요!';
      body = (over ? '' : '<p class="stars">' + [1, 2, 3].map((i) => '<span class="' + (i <= st ? 'on' : '') + '">★</span>').join('') + '</p>') + '<p class="lbl">남은 하트</p>' + hearts + '<p class="hint">' + C.log.map((x) => x.mg + '번째: 잡힘 ' + x.caught + '명').join(' · ') + '</p>';
    }
    const foot = ph === 'end' ? '<div class="endbtns"><button class="go" data-ch="res">결과표 보기</button><button class="ghost" data-ch="new">새 판</button></div>' : '';
    const h = '<div class="head">' + head + '<p>' + sub + '</p></div><div class="mid">' + body + '</div>' + foot;
    if (h !== sig) {
      sig = h;
      root.innerHTML = h;
      root.querySelectorAll('[data-ch]').forEach((b) => (b.onclick = () => (b.dataset.ch === 'res' ? cb.onResults && cb.onResults() : cb.onNew && cb.onNew())));
    }
    if (ph === 'end') clearInterval(timer);
  }
  function hide() {
    clearInterval(timer);
    if (view) view.unmount();
    view = null;
    if (root) root.remove();
    root = null;
  }
  QP.ChaseTV = { draw, hide };
})();
