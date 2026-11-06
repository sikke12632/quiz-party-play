/* treasure-tv.js — 선생님 화면(TV)의 「보물 지키기」 (도트). TV에는 팀별 하트만(작업/결정-보물지키기.md).
 *   QP.TreasureTV.draw(부모, ref, {onResults, onNew})  — 심판 소식마다 부른다(같으면 다시 안 그림)
 */
(function () {
  'use strict';
  const QP = window.QP,
    PX = window.PX;
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  let root = null,
    sig = '',
    timer = null,
    cb = {};

  function rowsOf(ref) {
    const S = ref.S,
      T = S.t,
      c = S.cfg,
      ph = S.phase;
    const teams = T.order.map((a, t) => {
      const seats = ref.teamSeats(t);
      const live = ref.sims && ref.sims[t] ? ref.sims[t].sim : null;
      return {
        t,
        a,
        name: QP.teamName(a),
        n: seats.length,
        blk: seats.reduce((x, s) => x + (s.blk || 0), 0),
        h: live ? live.h : c.hearts,
        k: live ? live.kills.length : 0,
        tot: T.tot[t],
        kt: T.kills[t],
        last: (T.log[T.log.length - 1] || []).find((x) => x.t === t),
      };
    });
    if (ph === 'defend') teams.sort((x, y) => y.h - x.h || y.k - x.k);
    else if (ph === 'dres') teams.sort((x, y) => (y.last ? y.last.h : 0) - (x.last ? x.last.h : 0) || (y.last ? y.last.k : 0) - (x.last ? x.last.k : 0));
    else teams.sort((x, y) => y.tot - x.tot || y.kt - x.kt);
    return teams;
  }
  const hearts = (n, max, lostAt) => Array.from({ length: max }, (_, i) => PX.heart(i < n, i === lostAt ? 'lost' : '')).join('');

  function draw(parent, ref, opts) {
    cb = opts || cb;
    const S = ref.S,
      c = S.cfg,
      ph = S.phase,
      T = S.t;
    if (!root || !parent.contains(root)) {
      parent.innerHTML = '';
      root = document.createElement('div');
      root.className = 'trtv';
      parent.appendChild(root);
      sig = '';
    }
    clearInterval(timer);
    timer = setInterval(() => draw(parent, ref), 250); // 시간·하트가 계속 바뀐다
    const now = ref.net.now();
    const left = Math.max(0, Math.ceil((S.endsAt - now) / QP.ms(1)));
    const rows = rowsOf(ref);
    const total = c.per * c.M;
    let head = '',
      sub = '';
    if (ph === 'question' || ph === 'reveal') {
      const k = c.per - (((S.round - 1) % c.per) + 1);
      const got = ref.seatList().filter((s) => s.cur && s.cur.r === S.round);
      head = '<h1>' + S.round + ' / ' + total + '번째 문제</h1>';
      sub = (ph === 'question' ? '문제 푸는 중 <b>' + left + '</b>초 · 답한 친구 ' + got.filter((s) => s.ans).length + ' / ' + got.length : '정답 보는 중') + ' · ' + (k ? '보물 지키기까지 <b>' + k + '</b>문제' : '이제 <b>보물 지키기!</b>');
    } else if (ph === 'defend') {
      const L = ref.live;
      const t0 = L ? L.t0 : now;
      head = '<h1>보물 지키기 <small>' + (T.mg + 1) + ' / ' + c.M + '</small></h1>';
      sub = now < t0 ? '<span class="cd">' + Math.ceil((t0 - now) / QP.ms(1)) + '</span> 디벗을 봐요! 화살표로 움직여요' : '남은 시간 <b>' + left + '</b>초 · 디벗을 보고 보물을 지켜요!';
    } else if (ph === 'dres') {
      head = '<h1>보물 지키기 ' + T.mg + '번째 결과</h1>';
      sub = T.mg >= c.M ? '곧 최종 순위!' : '다음 문제까지 <b>' + left + '</b>초';
    } else if (ph === 'end') {
      head = '<h1>최종 순위</h1>';
      sub = '지킨 하트를 모두 더했어요 · 같으면 물리친 적이 많은 팀';
    }
    const body = rows
      .map((r, i) => {
        const rk = i + 1;
        let mid = '',
          right = '';
        if (ph === 'question' || ph === 'reveal' || ph === 'lobby') {
          const max = Math.max(1, r.n * c.per);
          mid = '<div class="trpow"><span>무기 힘</span><span class="bar"><i style="width:' + Math.round((100 * r.blk) / max) + '%"></i></span><em>맞힌 문제 ' + r.blk + '</em></div>';
          right = '<div class="kill">지킨 하트<b>' + r.tot + '</b></div>';
        } else if (ph === 'defend') {
          mid = '<div class="tvh">' + hearts(r.h, c.hearts) + '</div>';
          right = '<div class="kill">물리친 적<b>' + r.k + '</b></div>';
        } else if (ph === 'dres') {
          const h = r.last ? r.last.h : 0;
          mid = '<div class="tvh">' + hearts(h, c.hearts) + '</div>';
          right = '<div class="kill">지킨 하트 합<b>' + r.tot + '</b></div>';
        } else {
          mid = '<div class="tot">' + PX.heart(true) + '<b>' + r.tot + '</b><small>물리친 적 ' + r.kt + '</small></div>';
          right = '';
        }
        return '<div class="row' + (rk === 1 ? ' first' : '') + '"><div class="rk">' + rk + '</div><img class="ic" src="' + PX.icon(QP.TEAM_ANIMALS[r.a][0], 0, 64) + '" alt=""><div class="nm">' + esc(r.name) + '<small>' + r.n + '명</small></div>' + mid + right + '</div>';
      })
      .join('');
    const foot = ph === 'end' ? '<div class="endbtns"><button class="go" data-tr="res">결과표 보기</button><button class="ghost" data-tr="new">새 판</button></div>' : '<div class="foot">' + (ph === 'defend' ? '하트가 많이 남은 팀이 이겨요 · 같으면 적을 많이 물리친 팀' : '문제를 많이 맞힐수록 보물 지키기 때 무기가 세져요') + '</div>';
    const h = '<div class="head">' + head + '<p>' + sub + '</p></div><div class="rows n' + rows.length + '">' + body + '</div>' + foot;
    if (h !== sig) {
      sig = h;
      root.innerHTML = h;
      root.querySelectorAll('[data-tr]').forEach((b) => (b.onclick = () => (b.dataset.tr === 'res' ? cb.onResults && cb.onResults() : cb.onNew && cb.onNew())));
    }
    if (ph === 'end') clearInterval(timer);
  }
  function hide() {
    clearInterval(timer);
    if (root) root.remove();
    root = null;
  }
  QP.TreasureTV = { draw, hide };
})();
