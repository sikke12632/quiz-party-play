/* boss-tv.js — 선생님 화면(TV)의 「보스 슈팅」 (도트). TV에는 팀별 데미지 막대와 살아 있는 비행기(작업/결정-보스슈팅.md).
 *   QP.BossTV.draw(부모, ref, {onResults, onNew})  — 심판 소식마다 부른다(같으면 다시 안 그림)
 *   QP.BossTV.hide()
 * 보물 지키기 TV(treasure-tv.js)와 같은 틀(.trtv)을 쓰고, 보스·막대만 더한다.
 */
(function () {
  'use strict';
  const QP = window.QP;
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const CSS = `
.bstv { background: #6dbcea; }
.bstv .bshead { display: flex; align-items: center; justify-content: center; gap: 22px; }
.bstv .bshead img { height: 128px; image-rendering: pixelated; }
.bstv .head { text-shadow: 3px 3px 0 #3a3060; }
.bstv .row .bsbar { flex: 1; height: 42px; background: rgba(58,48,96,.12); border: 3px solid #3a3060; border-radius: 3px; position: relative; overflow: hidden; margin: 0 14px; }
.bstv .row .bsbar i { position: absolute; left: 0; top: 0; bottom: 0; background: repeating-linear-gradient(90deg, #ff8fb8 0 12px, #f06a9a 12px 24px); }
.bstv .row .bsbar span { position: absolute; right: 10px; top: 50%; transform: translateY(-50%); font-family: 'QPTitle', serif; font-size: 28px; color: #2a211b; text-shadow: 0 0 4px #fff, 0 0 8px #fff; }
.bstv .row .bsalive { width: 220px; flex: none; display: flex; flex-wrap: wrap; gap: 2px 4px; justify-content: flex-end; }
.bstv .row .bsalive img { width: 30px; height: 28px; image-rendering: pixelated; }
.bstv .row .bsalive small { width: 100%; text-align: right; font-size: 15px; color: #5a4636; }
.bstv .foot { color: #fff; text-shadow: 2px 2px 0 #3a3060; }
`;
  let root = null,
    sig = '',
    timer = null,
    cb = {},
    skyBg = {};
  function css() {
    if (document.getElementById('bstv-css')) return;
    const s = document.createElement('style');
    s.id = 'bstv-css';
    s.textContent = CSS;
    document.head.appendChild(s);
  }
  const grad = (b) => (b ? 'linear-gradient(' + b.join(',') + ')' : 'linear-gradient(#5fb2e6,#aae2f8)');

  function rowsOf(ref) {
    const S = ref.S,
      T = S.t,
      ph = S.phase;
    const live = ph === 'defend' && ref.live ? ref.liveTeams() : null;
    const last = T.log[T.log.length - 1] || [];
    const teams = T.order.map((a, t) => {
      const seats = ref.teamSeats(t);
      const lv = live && live.find((x) => x.t === t);
      const l = last.find((x) => x.t === t);
      return { t, a, name: QP.teamName(a), n: seats.length, blk: seats.reduce((x, s) => x + (s.blk || 0), 0), d: lv ? lv.d : 0, alive: lv ? lv.alive : seats.length, lives: lv ? lv.lives : 0, hp: lv ? lv.hp : 0, tot: T.tot[t], last: l };
    });
    if (ph === 'defend') teams.sort((x, y) => y.d - x.d);
    else if (ph === 'dres') teams.sort((x, y) => (y.last ? y.last.d : 0) - (x.last ? x.last.d : 0));
    else teams.sort((x, y) => y.tot - x.tot);
    return teams;
  }

  function draw(parent, ref, opts) {
    css();
    const A = window.BA.init();
    cb = opts || cb;
    const S = ref.S,
      c = S.cfg,
      ph = S.phase,
      T = S.t;
    if (!root || !parent.contains(root)) {
      parent.innerHTML = '';
      root = document.createElement('div');
      root.className = 'trtv bstv';
      parent.appendChild(root);
      sig = '';
    }
    clearInterval(timer);
    timer = setInterval(() => draw(parent, ref), 250);
    const now = ref.net.now();
    const left = Math.max(0, Math.ceil((S.endsAt - now) / QP.ms(1)));
    const rows = rowsOf(ref);
    const total = c.per * c.M;
    const def = c.kind === 'def',
      pick = c.kind !== 'atk' && c.kind !== 'def';
    const kindTxt = pick ? '공격형 ⚔ · 수비형 🛡 섞여서' : def ? '모두 수비형: 맞힌 만큼 목숨' : '모두 공격형: 맞힌 만큼 센 무기';
    // 지금(또는 다음) 보스
    const bi = ph === 'defend' && ref.live ? ref.live.boss : T.bosses[Math.min(T.mg, T.bosses.length - 1) % T.bosses.length];
    const shownBoss = ph === 'dres' ? T.bosses[(T.mg - 1) % T.bosses.length] : bi;
    const B = A.BOSSES[shownBoss | 0] || A.BOSSES[0];
    root.style.background = ph === 'defend' || ph === 'dres' ? grad(B.sky) : '';
    let head = '',
      sub = '',
      img = '';
    if (ph === 'question' || ph === 'reveal') {
      const k = c.per - (((S.round - 1) % c.per) + 1);
      const got = ref.seatList().filter((s) => s.cur && s.cur.r === S.round);
      head = '<h1>' + S.round + ' / ' + total + '번째 문제</h1>';
      sub = (ph === 'question' ? '문제 푸는 중 <b>' + left + '</b>초 · 답한 친구 ' + got.filter((s) => s.ans).length + ' / ' + got.length : '정답 보는 중') + ' · ' + (k ? '보스 슈팅까지 <b>' + k + '</b>문제' : '이제 <b>보스 슈팅!</b>');
    } else if (ph === 'defend') {
      const L = ref.live;
      const t0 = L ? L.t0 : now;
      img = A.bossIcon(shownBoss | 0, 3);
      head = '<h1>' + esc(B.name) + ' <small>' + (T.mg + 1) + ' / ' + c.M + '</small></h1>';
      sub = now < t0 ? '<span class="cd">' + Math.ceil((t0 - now) / QP.ms(1)) + '</span> 디벗을 봐요! 화살표로 움직여요' : '남은 시간 <b>' + left + '</b>초 · 탄막을 피하며 데미지를 넣어요! · ' + kindTxt;
    } else if (ph === 'dres') {
      img = A.bossIcon(shownBoss | 0, 3, 'hurt');
      head = '<h1>보스 슈팅 ' + T.mg + '번째 결과</h1>';
      sub = T.mg >= c.M ? '곧 최종 순위!' : '다음 문제까지 <b>' + left + '</b>초';
    } else if (ph === 'end') {
      head = '<h1>최종 순위</h1>';
      sub = '보스 슈팅 점수를 모두 더했어요';
    } else head = '<h1>보스 슈팅</h1>';
    const maxD = Math.max(1, ...rows.map((r) => (ph === 'defend' ? r.d : ph === 'dres' ? (r.last ? r.last.d : 0) : r.tot)));
    const an = (r) => QP.TEAM_ANIMALS[r.a][0];
    const body = rows
      .map((r, i) => {
        const rk = i + 1;
        let mid = '',
          right = '';
        if (ph === 'question' || ph === 'reveal' || ph === 'lobby') {
          const max = Math.max(1, r.n * c.per);
          mid = '<div class="trpow"><span>' + (pick ? '맞힌 문제' : def ? '목숨' : '무기 힘') + '</span><span class="bar"><i style="width:' + Math.round((100 * r.blk) / max) + '%"></i></span><em>맞힌 문제 ' + r.blk + '</em></div>';
          right = '<div class="kill">점수 합<b>' + r.tot.toLocaleString() + '</b></div>';
        } else if (ph === 'defend') {
          mid = '<div class="bsbar"><i style="width:' + Math.round((100 * r.d) / maxD) + '%"></i><span>' + r.d.toLocaleString() + '</span></div>';
          right = '<div class="bsalive">' + Array.from({ length: r.n }, (_, j) => '<img src="' + A.planeIcon(an(r), j, j >= r.alive, 2) + '" alt="">').join('') + '<small>' + (def || pick ? '비행기 ' + r.alive + '/' + r.n + ' · 목숨 ♥' + r.lives : '살아 있는 비행기 ' + r.alive + '/' + r.n) + '</small></div>';
        } else if (ph === 'dres') {
          const d = r.last ? r.last.d : 0;
          mid = '<div class="bsbar"><i style="width:' + Math.round((100 * d) / maxD) + '%"></i><span>' + d.toLocaleString() + '</span></div>';
          right = '<div class="kill">점수 합<b>' + r.tot.toLocaleString() + '</b></div>';
        } else {
          mid = '<div class="bsbar"><i style="width:' + Math.round((100 * r.tot) / maxD) + '%"></i><span>' + r.tot.toLocaleString() + '</span></div>';
        }
        return '<div class="row' + (rk === 1 ? ' first' : '') + '"><div class="rk">' + rk + '</div><img class="ic" src="' + window.PX.icon(an(r), 0, 64) + '" alt=""><div class="nm">' + esc(r.name) + '<small>' + r.n + '명</small></div>' + mid + right + '</div>';
      })
      .join('');
    const foot =
      ph === 'end'
        ? '<div class="endbtns"><button class="go" data-tr="res">결과표 보기</button><button class="ghost" data-tr="new">새 판</button></div>'
        : '<div class="foot">' + (ph === 'defend' || ph === 'dres' ? '데미지를 많이 넣은 팀이 이겨요 · 인원이 달라도 공평하게 맞춰요 · 격추된 친구는 다음에 다시 나와요' : pick ? '문제를 많이 맞힐수록 공격형은 무기가 세지고, 수비형은 목숨이 늘어요' : def ? '문제를 많이 맞힐수록 보스 슈팅 때 목숨이 늘어요 (무기는 모두 같아요)' : '문제를 많이 맞힐수록 보스 슈팅 때 무기가 세져요') + '</div>';
    const h = '<div class="bshead">' + (img ? '<img src="' + img + '" alt="">' : '') + '<div class="head">' + head + '<p>' + sub + '</p></div></div><div class="rows n' + rows.length + '">' + body + '</div>' + foot;
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
  QP.BossTV = { draw, hide };
})();
