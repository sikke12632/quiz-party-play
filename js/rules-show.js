/* rules-show.js — 선생님 화면(TV·전자칠판)에서 게임 규칙을 그림과 함께 3장으로 설명한다.
 *   QP.showRules('gold')   // 대기실 「규칙 설명」 단추
 * 넘기기: 화면 오른쪽/왼쪽 누르기, ◀ ▶ 단추, 키보드 ← → / 스페이스, 닫기: ✕ 또는 Esc
 * 숫자는 rules.js(QP.DEFAULT_CFG·QP.GAIN·QP.STEAL·QP.SWAP_NEAR)에서 읽는다.
 */
(function (root) {
  'use strict';
  const QP = root.QP;

  function goldSlides(cfg) {
    const c = Object.assign({}, QP.DEFAULT_CFG, cfg || {});
    const fast = c.fastOn ? c.fast.slice().sort((a, b) => a[0] - b[0]) : [];
    const streak = c.streakOn ? c.streak.slice().sort((a, b) => a[0] - b[0]) : [];
    const G = QP.GAIN;
    return [
      {
        title: '① 문제를 맞히면 <em>금</em>!',
        items: [
          ['📱', '디벗에 문제가 나오면 <b>답을 눌러요</b>.'],
          ['🪙', '맞히면 <b>금 ' + c.base + '개</b>! <small>뒤로 갈수록 조금씩 많아져요</small>'],
          fast.length ? ['⚡', '<b>빨리</b> 맞히면 더! ' + fast.map(([s, v]) => '<span class="tag">' + s + '초 안 +' + v + '</span>').join(' ')] : null,
          streak.length ? ['🔥', '<b>계속</b> 맞히면 더! ' + streak.map(([n, v]) => '<span class="tag">' + n + '번 연속 +' + v + '</span>').join(' ')] : null,
          ['😢', '틀리면 금이 없어요. 다음 문제에서 다시!'],
        ],
        imgs: [['img/rules/gold-1-question.jpg', '디벗: 문제'], ['img/rules/gold-1-bonus.jpg', '맞히면: 받은 금이 보여요']],
      },
      {
        title: '② <em>상자</em> 하나를 골라요',
        sub: '맞힌 친구만 상자 3개 중 하나를 열어요',
        grid: [
          ['💰', '금 주머니', '금 ' + G[0] + '~' + G[G.length - 1] + '개 <small>가장 자주 나와요</small>'],
          ['✨', '금 두 배', '내 금만큼 더!'],
          ['🛡️', '방패', '뺏기·바꾸기를 한 번 막아요'],
          ['😝', '꽝', '아무것도 없어요'],
          ['🤏', '뺏기', '친구 금의 <b>' + Math.round(QP.STEAL * 100) + '%</b>를 가져와요 <small>내가 고르기 / 아무나</small>'],
          ['🔄', '바꾸기', '<b>위아래 ' + QP.SWAP_NEAR + '등 안</b> 친구와 금을 통째로 바꿔요 <small>내가 고르기 / 아무나</small>'],
        ],
        imgs: [['img/rules/gold-2-open.jpg', '상자를 열면'], ['img/rules/gold-2-steal.jpg', '뺏기: 누구 금을 가져올까?']],
      },
      {
        title: '③ <em>순위</em>와 단상',
        items: [
          ['📺', 'TV에서 우리 반 순위를 봐요. <b>1~5등은 단상</b>에 올라가요.'],
          ['🤝', '금이 같으면 <b>같은 등수</b>. 금이 0이면 아직 등수가 없어요.'],
          ['🏆', '시간(' + c.minutes + '분)이 끝나면 <b>금이 가장 많은 친구가 1등</b>!'],
          ['🙅', '약속: <b>친구 디벗 보지 않기</b> · 뺏기고 바뀌어도 웃으며 다시 도전!'],
        ],
        imgs: [['img/rules/gold-3-podium.jpg', 'TV: 단상과 우리 반 순위']],
        wide: true,
      },
    ];
  }

  const esc = (s) => String(s);
  function slideHTML(s, i, n) {
    const body = s.grid
      ? '<div class="rgrid">' + s.grid.map((g) => '<div><span class="ic">' + g[0] + '</span><b>' + g[1] + '</b><p>' + g[2] + '</p></div>').join('') + '</div>'
      : '<ul class="ritems">' + s.items.filter(Boolean).map((it) => '<li><span class="ic">' + it[0] + '</span><span>' + it[1] + '</span></li>').join('') + '</ul>';
    const imgs = '<div class="rimgs' + (s.imgs.length === 1 ? ' one' : '') + '">' + s.imgs.map((im) => '<figure><img src="' + im[0] + '" alt=""><figcaption>' + im[1] + '</figcaption></figure>').join('') + '</div>';
    return (
      '<section class="rslide' + (s.wide ? ' wide' : '') + '" data-i="' + i + '"><h2>' + s.title + '</h2>' + (s.sub ? '<p class="rsub">' + esc(s.sub) + '</p>' : '') +
      '<div class="rbody"><div class="rtext">' + body + '</div>' + imgs + '</div><div class="rpage">' + (i + 1) + ' / ' + n + '</div></section>'
    );
  }

  QP.showRules = function (mode, cfg) {
    const slides = goldSlides(cfg); // 도깨비 찾기는 나중에 더한다
    let k = 0;
    const box = document.createElement('div');
    box.id = 'rules';
    box.innerHTML =
      '<div class="rhead"><span class="rname">황금 찾기 규칙</span><span class="rdots">' + slides.map((_, i) => '<i data-go="' + i + '"></i>').join('') + '</span><button class="rclose" data-x="1" aria-label="닫기">✕</button></div>' +
      slides.map((s, i) => slideHTML(s, i, slides.length)).join('') +
      '<button class="rnav rprev" data-d="-1" aria-label="앞">◀</button><button class="rnav rnext" data-d="1" aria-label="다음">▶</button>';
    document.body.appendChild(box);
    const show = () => {
      box.querySelectorAll('.rslide').forEach((el, i) => el.classList.toggle('on', i === k));
      box.querySelectorAll('.rdots i').forEach((el, i) => el.classList.toggle('on', i === k));
      box.querySelector('.rprev').hidden = k === 0;
      box.querySelector('.rnext').textContent = k === slides.length - 1 ? '끝' : '▶';
    };
    const close = () => {
      box.remove();
      document.removeEventListener('keydown', key);
    };
    const go = (d) => {
      if (k + d >= slides.length) return close();
      k = Math.max(0, k + d);
      show();
    };
    const key = (e) => {
      if (e.key === 'Escape') close();
      else if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'PageDown') (e.preventDefault(), go(1));
      else if (e.key === 'ArrowLeft' || e.key === 'PageUp') (e.preventDefault(), go(-1));
    };
    document.addEventListener('keydown', key);
    box.addEventListener('click', (e) => {
      const b = e.target.closest('[data-x],[data-d],[data-go]');
      if (b && b.dataset.x) return close();
      if (b && b.dataset.d) return go(+b.dataset.d);
      if (b && b.dataset.go !== undefined) return ((k = +b.dataset.go), show());
      // 화면 빈 곳: 오른쪽 2/3 누르면 다음, 왼쪽 1/3 누르면 앞
      if (!e.target.closest('figure')) go(e.clientX > window.innerWidth / 3 ? 1 : -1);
    });
    show();
  };
})(window);
