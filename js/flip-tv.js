/* flip-tv.js — 선생님 화면(TV)의 「도깨비 뒤집기」 (작업/결정-뒤집기.md)
 *   QP.FlipTV.draw(부모, ref, {onResults, onNew}) — 심판 소식마다 부른다(같으면 다시 안 그림)
 * TV에는 비밀이 새지 않게: 고르는 동안은 「고른 친구 수」·세 단계 현황·악마가 어느 무리인지(5초 묶음, 마감 5초 전부터 가림)만.
 */
(function () {
  'use strict';
  const QP = window.QP,
    PX = window.PX;
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  let root = null,
    discEl = null,
    sig = '',
    timer = null,
    cb = {};
  const icon = (s) => PX.icon(QP.TEAM_ANIMALS[s.an || 0][0], s.cl || 0, 80);
  const LEVELS = [['g', '도깨비 우세'], ['m', '비슷비슷'], ['h', '인간 우세']];

  function gauge(ref) {
    const F = ref.S.f,
      c = ref.S.cfg;
    const max = Math.max(1, (F.order || ref.seatList()).length * c.per * c.R);
    const got = ref.seatList().reduce((n, s) => n + (s.nOk || 0), 0);
    const pct = Math.min(100, Math.round((100 * got) / max));
    return (
      '<div class="flbox flgauge"><div class="row"><span>반 전체 정답</span><div class="bar"><i style="width:' + pct + '%"></i>' +
      c.hints.map(([p, n]) => '<u style="left:' + p * 100 + '%"></u><em style="left:' + p * 100 + '%">' + Math.round(p * 100) + '% · ' + (n === 1 ? '공개!' : n + '명') + '</em>').join('') +
      '</div><b>' + got + ' / ' + max + '</b></div></div>'
    );
  }
  function hintCard(ref) {
    const F = ref.S.f;
    if (!F.hint) return '<p class="flnohint">반 전체 정답이 ' + Math.round(ref.S.cfg.hints[0][0] * 100) + '%를 넘으면 악마 힌트가 나와요</p>';
    const A = QP.flArt();
    const who = F.hint.sids.map((sid) => ref.bySid(sid)).filter(Boolean);
    return (
      '<div class="flhint"><div class="ttl"><img class="pxi" src="' + A.DEV + '"> ' + (F.hint.k === 1 ? '악마의 정체가 드러났어요!' : '악마는 이 ' + F.hint.k + '명 중에 있어요!') + '</div><div class="who">' +
      who.map((s, n) => '<div style="animation-delay:' + n * 0.12 + 's"><img class="pxi" src="' + icon(s) + '">' + esc(s.nick) + '</div>').join('') + '</div></div>'
    );
  }

  function draw(parent, ref, opts) {
    cb = opts || cb;
    const S = ref.S,
      c = S.cfg,
      F = S.f,
      ph = S.phase;
    const A = QP.flArt();
    if (!root || !parent.contains(root)) {
      parent.innerHTML = '';
      root = document.createElement('div');
      root.className = 'fltv';
      parent.appendChild(root);
      sig = '';
    }
    clearInterval(timer);
    timer = setInterval(() => draw(parent, ref), 200);
    const now = ref.net.now();
    const left = Math.max(0, Math.ceil((S.endsAt - now) / QP.ms(1)));
    const total = c.per * c.R;
    let h = '<div class="flth"><h1>도깨비 뒤집기 <small>' + (ph === 'end' ? '최종 결과' : Math.min(F.r + 1, c.R) + ' / ' + c.R + ' 라운드') + '</small></h1>';
    if (ph === 'question' || ph === 'reveal') {
      const k = c.per - (((S.round - 1) % c.per) + 1);
      const got = ref.seatList().filter((s) => s.cur && s.cur.r === S.round);
      h += '<p>' + S.round + ' / ' + total + '번째 문제 · ' + (ph === 'question' ? '답한 친구 ' + got.filter((s) => s.ans).length + ' / ' + got.length + ' · <b>' + left + '</b>초' : '정답 보는 중') + ' · ' + (k ? '뒤집기까지 <b>' + k + '</b>문제' : '이제 <b>뒤집기!</b>') + '</p></div>' + gauge(ref) + hintCard(ref);
    } else if (ph === 'pick') {
      const tl = Math.max(0, Math.ceil((F.ends - now) / QP.ms(1)));
      const hide = tl <= c.tHide;
      const sn = F.snap || {};
      const chosen = ref.predict().chosen;
      h += '<p>디벗에서 뒤집을 친구를 골라요 · <b>마감 전까지는 얼마든지 바꿀 수 있어요</b></p></div>' +
        '<div class="flmid"><div class="flbox flcd' + (tl <= 5 ? ' hurry' : '') + '"><h3>마감까지</h3><b>' + tl + '</b><p>고른 친구 <b>' + chosen + '</b> / ' + F.order.length + '</p></div>' +
        '<div class="flbox flmeter"><h3>지금 우리 반은?</h3><div class="mbar' + (hide ? ' hide' : '') + '">' + LEVELS.map(([k, n]) => '<span class="' + k + (k === sn.lv ? ' cur' : '') + '">' + n + '</span>').join('') + '</div>' +
        '<div class="dside' + (hide ? ' hide' : '') + '"><img class="pxi" src="' + A.DEV + '"><span>' + (hide ? '악마는 어디에…? 마감 직전!' : '악마가 지금 <b>' + (QP.FL_SP[sn.ds] || '?') + '</b>인 척하고 있어요!') + '</span></div>' +
        '<small>' + c.tSnap + '초마다 바뀌어요 · 마감 ' + c.tHide + '초 전부터는 비밀!</small></div></div>' + gauge(ref);
    } else if (ph === 'fres') {
      const L = F.last || { flipped: 0, g: 0, h: 0 };
      const u = (now - S.phaseAt) / QP.ms(1);
      h += '<p>뒤집힌 친구 <b>' + L.flipped + '</b>명</p></div>' +
        '<div class="fldiscs-slot"></div>' +
        (u > 2.5 ? '<div class="flbox flratio"><img class="pxi" src="' + A.GOB + '">도깨비 <b>' + L.g + '</b> : <b>' + L.h + '</b> 인간<img class="pxi" src="' + A.HUM + '"></div>' : '') +
        (u > 4.5 && F.hint ? hintCard(ref) : '');
    } else if (ph === 'end') {
      const J = F.end;
      const u = (now - (S.endedAt || now)) / QP.ms(1);
      const dv = J.rows.find((x) => x.devil);
      const ds = dv ? ref.bySid(dv.sid) : null;
      if (u < 3) h += '<p>' + c.R + '라운드가 모두 끝났어요!</p></div><div class="flbox flratio big"><img class="pxi" src="' + A.GOB + '">도깨비 <b>' + J.g + '</b> : <b>' + J.h + '</b> 인간<img class="pxi" src="' + A.HUM + '"><p>' + (J.maj ? QP.FL_SP[J.maj] + ' 무리가 더 많아요!' : '앗, 똑같아요! 동점이에요') + '</p></div>';
      else if (u < 6.5) h += '<p>그런데… <b>악마</b>는 어디에 있었을까요?</p></div><div class="fldev' + (u > 4.3 ? ' on' : '') + '">' + (u > 4.3 && ds ? '<img class="pxi" src="' + icon(ds) + '"><div><b>악마는 ' + esc(ds.nick) + '!</b><p>' + QP.FL_SP[dv.now] + ' 무리에 숨어 있었어요</p></div><img class="pxi" src="' + A.DEV + '">' : '<span>?</span>') + '</div>';
      else {
        const msg = !J.maj ? '동점이라 이번 판은 <b>무승부</b>예요' : J.devilIn === J.maj ? '악마가 숨어 있던 ' + QP.FL_SP[J.maj] + ' 무리는 <b>아쉽게 패배!</b>' : '악마를 소수 쪽으로 쫓아냈어요! <b>' + QP.FL_SP[J.maj] + ' 무리 승리!</b>';
        h += '<p>' + msg + '</p></div>' +
          (J.winside ? '<div class="flwin">🎉 ' + QP.FL_SP[J.winside] + ' 무리 승리! 🎉' + (J.devilIn === J.maj ? ' <small>(악마도 몰래 승리)</small>' : '') + '</div>' : '<div class="flwin">무승부!</div>') +
          (u > 9 ? '<p class="flloyal">★ 처음 종족을 끝까지 지킨 친구 <b>' + J.rows.filter((x) => x.loyal && !x.devil).length + '</b>명!</p>' : '') +
          (u > 9 ? '<div class="flgrid">' + J.rows.map((x, i) => { const s = ref.bySid(x.sid) || {}; return '<div class="fc' + (x.win ? ' w' : '') + (x.devil ? ' d' : '') + '" style="animation-delay:' + (i * 0.04).toFixed(2) + 's"><img class="pxi" src="' + icon(s) + '"><span>' + esc(s.nick) + '</span><em><img class="pxi" src="' + (x.o === 'g' ? A.GOB : A.HUM) + '">→<img class="pxi" src="' + (x.now === 'g' ? A.GOB : A.HUM) + '"></em>' + (x.devil ? '<i class="tag">악마</i>' : x.win ? '<i class="tag">승리</i>' : '') + (x.loyal && !x.devil ? '<i class="star">★ 끝까지</i>' : '') + '</div>'; }).join('') + '</div>' : '') +
          (u > 6.5 && J.winside ? confetti() : '') +
          (u > 9 ? '<div class="endbtns"><button class="go" data-fl="res">결과표 보기</button><button class="ghost" data-fl="new">새 판</button></div>' : '');
      }
      if (u > 12) clearInterval(timer);
    }
    if (h !== sig) {
      sig = h;
      root.innerHTML = h;
      // 동전 뒤집기는 라운드마다 한 번만 돌게(글자가 바뀌어도 그대로 둔다)
      const slot = root.querySelector('.fldiscs-slot');
      if (slot) {
        if (!discEl || discEl.dataset.code !== String(F.code)) {
          const L = F.last || { flipped: 0 };
          discEl = document.createElement('div');
          discEl.className = 'fldiscs';
          discEl.dataset.code = F.code;
          discEl.innerHTML = Array.from({ length: F.order.length }, (_, i) => '<div class="disc' + (i < L.flipped ? ' spin' : '') + '" style="animation-delay:' + (i * 0.08).toFixed(2) + 's"></div>').join('');
        }
        slot.replaceWith(discEl);
      }
      root.querySelectorAll('[data-fl]').forEach((b) => (b.onclick = () => (b.dataset.fl === 'res' ? cb.onResults && cb.onResults() : cb.onNew && cb.onNew())));
    }
  }
  // 꽃가루(같은 모양이면 다시 안 그려지게 고정된 무늬)
  let CONF = '';
  function confetti() {
    if (!CONF) {
      const cs = ['#ffd23e', '#e8504a', '#5fbf55', '#3f9be8', '#b06ad8', '#fff'];
      CONF = '<div class="flconf">' + Array.from({ length: 60 }, (_, i) => '<i style="left:' + ((i * 37) % 100) + '%;background:' + cs[i % cs.length] + ';animation-delay:' + ((i * 0.17) % 3).toFixed(2) + 's;animation-duration:' + (2.6 + (i % 5) * 0.4).toFixed(1) + 's"></i>').join('') + '</div>';
    }
    return CONF;
  }
  function hide() {
    clearInterval(timer);
    if (root) root.remove();
    root = null;
  }
  QP.FlipTV = { draw, hide };
})();
