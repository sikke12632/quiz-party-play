/* flip-view.js — 「도깨비 뒤집기」 아이 화면의 뒤집기(눈치게임) + 도트 그림(TV도 씀). 작업/결정-뒤집기.md
 *   QP.FlipView.mount(부모, KidClient) → { unmount() }
 *   QP.flArt() → { GOB, HUM, DEV } 그림 주소
 */
(function () {
  'use strict';
  const QP = window.QP,
    PX = window.PX;
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  let ART = null;
  QP.flArt = function () {
    if (ART) return ART;
    ART = {
      GOB: PX.make(['.....yy.....', '.....yy.....', '...gggggg...', '..gggggggg..', '.gwkggggwkg.', '.gwkggggwkg.', '.gggggggggg.', '.ggmmmmmmgg.', '.ggmwmmwmgg.', '..gggggggg..', '...gggggg...'], { y: '#ffd23e', g: '#5fbf55', w: '#fff', k: '#1a1410', m: '#7a1e18' }, '#1f4a1a').toDataURL(),
      HUM: PX.make(['...hhhhhh...', '..hhhhhhhh..', '.hhhhhhhhhh.', '.hssssssssh.', '.ssksssskss.', '.ssssssssss.', '.spssssssps.', '.sssmmmmsss.', '..ssssssss..', '...ssssss...'], { h: '#5a3a1e', s: '#f1d5ad', k: '#1a1410', p: '#f09a90', m: '#a0503a' }, '#3a2a20').toDataURL(),
      DEV: PX.make(['.k........k.', '.kk......kk.', '..rrrrrrrr..', '.rrrrrrrrrr.', '.ryyrrrryyr.', '.rrrrrrrrrr.', '.rrkrrrrkrr.', '.rrrkkkkrrr.', '..rrrrrrrr..', '...rrrrrr...'], { k: '#2a0a0a', r: '#d93a2f', y: '#ffd23e' }, '#3a0a0a').toDataURL(),
    };
    return ART;
  };
  const icon = (r) => PX.icon(QP.TEAM_ANIMALS[r.a || 0][0], r.cl || 0, 48);

  // 「내 정체 확인」 단추 HTML(꾹 누르는 동안만). 모두 같은 모양 — 아래 한 줄도 같은 자리·같은 검은 글자
  QP.flWho = function (role, holding, now) {
    const A = QP.flArt();
    if (!holding || !role) return '<div class="fwho idle" data-hold="1"><div class="q">?</div><div><div class="t2">내 정체 확인</div><div class="t1">꾹 누르고 있는 동안만 보여요 · 옆 친구 조심!</div></div></div>';
    const o = role.o;
    return (
      '<div class="fwho" data-hold="1"><img class="pxi" src="' + (o === 'g' ? A.GOB : A.HUM) + '"><div><div class="t2">누가 뭐래도 난 <b class="' + o + '">' + QP.FL_SP[o] + '!</b></div>' +
      '<div class="dv">' + (role.d ? '쉿! 사실 넌 악마야!' : '힘! 끝까지 버텨 봐!') + (now ? ' · 지금은 ' + (now === o ? '처음 그대로예요' : '처음과 반대예요') : '') + '</div></div></div>'
    );
  };

  function mount(parent, C) {
    const root = document.createElement('div');
    root.className = 'fview';
    parent.appendChild(root);
    let hold = false,
      list = [],
      code = 0,
      lastTop = '',
      lastLeft = '',
      built = '';
    const down = (e) => {
      if (e.target.closest('[data-hold]')) {
        hold = true;
        lastTop = '';
        draw();
      }
    };
    const up = () => {
      if (hold) {
        hold = false;
        lastTop = '';
        draw();
      }
    };
    root.addEventListener('pointerdown', down);
    for (const ev of ['pointerup', 'pointercancel']) addEventListener(ev, up);
    addEventListener('blur', up);
    root.addEventListener('contextmenu', (e) => e.preventDefault());
    root.addEventListener('click', (e) => {
      if (e.target.closest('[data-reset]')) {
        list = [];
        C.pickFlip(code, list);
        return draw();
      }
      const b = e.target.closest('[data-i]');
      if (!b) return;
      const i = +b.dataset.i;
      const n = allow();
      // 누를 때마다 한 표씩 더함(중복 투표). 표를 다 쓰면 그 친구를 한 번 더 눌러 0으로
      if (list.length < n) list.push(i);
      else if (list.includes(i)) list = list.filter((x) => x !== i);
      else return flash();
      C.pickFlip(code, list);
      draw();
    });
    const allow = () => (C.seat && C.seat.res ? C.seat.res.pick || 0 : 0);
    function flash() {
      const l = root.querySelector('.fleft');
      if (l) {
        l.classList.remove('shake');
        void l.offsetWidth;
        l.classList.add('shake');
      }
    }
    function draw() {
      const G = C.game,
        F = G && G.fl;
      if (!F || !C.seat) return;
      if (F.code !== code) {
        code = F.code;
        list = C.sent.fl && C.sent.fl.code === code ? C.sent.fl.list.slice() : [];
        built = '';
      }
      const ro = G.roster || [];
      const me = ro.findIndex((x) => x.sid === C.seat.sid);
      const fz = C.seat.fz && C.seat.fz.r === code ? C.seat.fz.d : 0;
      const left = Math.max(0, Math.ceil((F.ends - C.net.now()) / QP.ms(1)));
      const now = C.seat.fres ? C.seat.fres.now : C.seat.role && C.seat.role.o;
      const top = QP.flWho(C.seat.role, hold, now) + '<div class="fstate ' + (fz ? 'danger' : 'safe') + '">' + (fz ? '⚠ 지금 이대로면 너는 뒤집혀!' : '✓ 지금은 안전해') + '</div>' + '<div class="ftimer' + (left <= 5 ? ' hurry' : '') + '"><b>' + left + '</b><small>초 남음</small></div>';
      if (top !== lastTop) {
        lastTop = top;
        root.querySelector('.ftop').innerHTML = top;
      }
      const n = allow();
      const lh = n ? '남은 표 <b>' + (n - list.length) + ' / ' + n + '</b><span class="pips">' + Array.from({ length: n }, (_, i) => '<i class="' + (i < n - list.length ? 'on' : '') + '"></i>').join('') + '</span><button class="freset" data-reset="1">전체 초기화</button><span class="fhelp">한 친구에게 여러 표도 돼요 · 표를 다 쓴 뒤 그 친구를 다시 누르면 0표 · 마감 전까지 얼마든지 바꿔요</span>' : '이번엔 맞힌 문제가 없어서 표가 없어요 · 다음 라운드엔 꼭 맞혀 봐요!';
      if (lh !== lastLeft) {
        lastLeft = lh;
        root.querySelector('.fleft').innerHTML = lh;
      }
      // 명단: 나 먼저, 그다음 친구들. 악마 후보는 「악마 후보」
      const cand = (F.hint && F.hint.sids) || [];
      const sig = code + '|' + ro.length + '|' + cand.join();
      if (sig !== built) {
        built = sig;
        const idx = [me].concat(ro.map((_, i) => i).filter((i) => i !== me)).filter((i) => i >= 0);
        root.querySelector('.fgrid').innerHTML = idx.map((i) => '<button class="ff' + (i === me ? ' mine' : '') + (cand.includes(ro[i].sid) ? ' cand-on' : '') + '" data-i="' + i + '"><img class="pxi" src="' + icon(ro[i]) + '"><span>' + esc(i === me ? '나 · ' + ro[i].nick : ro[i].nick) + '</span>' + (cand.includes(ro[i].sid) ? '<i class="cand">악마 후보</i>' : '') + '</button>').join('');
      }
      root.querySelectorAll('.ff').forEach((b) => {
        const c = list.filter((x) => x === +b.dataset.i).length;
        b.classList.toggle('on', c > 0);
        b.dataset.n = c > 1 ? '×' + c : c ? '' : '';
      });
    }
    root.innerHTML = '<div class="ftop"></div><div class="fleft"></div><div class="fgrid"></div>';
    draw();
    const tm = setInterval(draw, 150);
    return {
      root,
      unmount() {
        clearInterval(tm);
        removeEventListener('pointerup', up);
        removeEventListener('pointercancel', up);
        removeEventListener('blur', up);
        root.remove();
      },
    };
  }
  QP.FlipView = { mount };
})();
