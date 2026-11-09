/* howto.js — 게임마다 「놀이 설명」 카드 (작업/결정-설명페이지.md)
 *   QP.Howto.open(mode, { big }) — 화면 위에 카드를 띄운다. big = 전자칠판(TV)용 큰 글씨.
 *   QP.Howto.has(mode) — 그 모드 설명이 있는지.
 * 카드 = 실제 게임 화면 그림(img/howto/) + 굵은 제목 한 줄 + 설명 1~2줄 + 그림 위 동그라미 표시(marks: x·y·r 은 그림 너비 기준 %).
 * 처음 보는 어른(다른 선생님)이 읽고 바로 아이들에게 설명할 수 있는 말로 쓴다.
 */
(function () {
  'use strict';
  const QP = (window.QP = window.QP || {});

  const HOWTO = {
    tug: {
      name: '줄다리기',
      sub: '두 팀 대결 · 리듬 게임',
      cards: [
        {
          img: 'img/howto/tug-1.jpg',
          t: '문제를 맞혀서 힘을 키워라!',
          d: '문제를 맞히는 만큼 줄다리기 힘이 세져요.',
          marks: [{ x: 28.9, y: 9.7, r: 3.5, label: '내 힘' }],
        },
        {
          img: 'img/howto/tug-2.jpg',
          t: '박자에 맞춰 「차!」를 눌러라!',
          d: '공이 동그라미에 들어올 때 눌러요. 막 누르면 헛손질!',
          marks: [{ x: 16, y: 52, r: 8, label: '공이 여기 올 때' }, { x: 50, y: 84, r: 9, label: '눌러요!' }],
        },
        {
          img: 'img/howto/tug-3.jpg',
          t: '줄을 우리 쪽으로 끌어와라!',
          d: '점수가 높은 팀 쪽으로 줄이 끌려가요. 인원이 달라도 공평해요.',
          marks: [{ x: 16, y: 11, r: 5, label: '한 명당 점수' }, { x: 44, y: 87, r: 5, label: '가운데 리본' }],
        },
        {
          img: 'img/howto/tug-4.jpg',
          t: '많이 이긴 팀이 우승!',
          d: '줄다리기 3판 중 많이 이긴 팀이 1등이에요.',
          marks: [{ x: 91.5, y: 49, r: 6, label: '이긴 횟수' }],
        },
      ],
    },
    gold: {
      name: '황금 찾기',
      sub: '개인전 · 시간 동안 금 모으기',
      cards: [
        {
          img: 'img/rules/gold-1-question.jpg',
          t: '문제를 맞혀서 금을 모아라!',
          d: '빨리, 연달아 맞히면 금을 더 받아요.',
          marks: [],
        },
        {
          img: 'img/rules/gold-2-open.jpg',
          t: '상자를 열어라!',
          d: '맞히면 상자 하나를 골라요. 금, 금 두 배, 방패, 꽝이 나와요.',
          marks: [],
        },
        {
          img: 'img/rules/gold-2-steal.jpg',
          t: '친구 금을 뺏어라!',
          d: '「뺏기」「바꾸기」가 나오면 친구를 골라요. 방패가 있으면 막아요.',
          marks: [],
        },
        {
          img: 'img/rules/gold-3-podium.jpg',
          t: '금이 제일 많으면 1등!',
          d: '시간이 끝났을 때 금이 가장 많은 친구가 1등이에요.',
          marks: [],
        },
      ],
    },
    mafia: {
      name: '도깨비 찾기',
      sub: '반 전체 추리 게임 · 숨은 도깨비 3명',
      cards: [
        {
          img: 'img/howto/mafia-1.jpg',
          t: '숨은 도깨비 3명을 찾아라!',
          d: '내 역할은 나만 봐요. 도깨비끼리도 서로 몰라요.',
          marks: [],
        },
        {
          img: 'img/howto/mafia-2.jpg',
          t: '문제를 맞혀서 단서를 얻어라!',
          d: '맞히면 돋보기로 친구를 살펴보거나 TV 힌트가 나와요.',
          marks: [],
        },
        {
          img: 'img/howto/mafia-3.jpg',
          t: '지목하고 투표하라!',
          d: '지목권을 받으면 의심 가는 친구를 눌러요. 찬성이 절반을 넘으면 공개!',
          marks: [{ x: 40.7, y: 66, r: 8, label: '찬성' }, { x: 59, y: 66, r: 8, label: '반대' }],
        },
        {
          img: 'img/howto/mafia-4.jpg',
          t: '도깨비를 다 잡으면 마을 승리!',
          d: '착한 친구를 3번 잘못 지목하면 도깨비 승리예요.',
          marks: [],
        },
      ],
    },
    treasure: {
      name: '보물 지키기',
      sub: '팀 대결 · 문제 → 미니게임',
      cards: [
        {
          img: 'img/howto/treasure-1.jpg',
          t: '문제를 맞혀서 무기를 키워라!',
          d: '문제를 맞히는 만큼 무기가 세져요.',
          marks: [],
        },
        {
          img: 'img/howto/treasure-2.jpg',
          t: '돌아다니며 적을 막아라!',
          d: '화살표로 움직이면 별 사탕은 저절로 던져요.',
          marks: [{ x: 89.8, y: 80.9, r: 9, label: '눌러서 움직여요' }, { x: 16.8, y: 92, r: 6, label: '내 무기 단계' }],
        },
        {
          img: 'img/howto/treasure-3.jpg',
          t: '보물 하트를 지켜라!',
          d: '적이 보물에 닿으면 우리 팀 하트가 줄어요.',
          marks: [],
        },
        {
          img: 'img/howto/treasure-4.jpg',
          t: '하트를 많이 지킨 팀이 우승!',
          d: '3번의 미니게임에서 남은 하트를 더해요.',
          marks: [],
        },
      ],
    },
    boss: {
      name: '보스 슈팅',
      sub: '팀 대결 · 비행기 슈팅',
      cards: [
        {
          img: 'img/howto/boss-1.jpg',
          t: '공격형? 수비형? 골라라!',
          d: '공격형은 무기가 세지고, 수비형은 목숨이 늘어요.',
          marks: [{ x: 40.4, y: 82.5, r: 8, label: '공격형' }, { x: 59.4, y: 82.5, r: 8, label: '수비형' }],
        },
        {
          img: 'img/howto/boss-2.jpg',
          t: '탄막을 피하며 날아라!',
          d: '방향만 움직이면 비행기는 저절로 쏴요.',
          marks: [{ x: 85.3, y: 74.8, r: 9, label: '눌러서 움직여요' }],
        },
        {
          img: 'img/howto/boss-3.jpg',
          t: '보스에게 데미지를 넣어라!',
          d: '보스는 쓰러지지 않아요. 데미지를 많이 넣는 팀이 이겨요.',
          marks: [],
        },
        {
          img: 'img/howto/boss-4.jpg',
          t: '데미지가 가장 큰 팀이 우승!',
          d: '3번의 슈팅 데미지를 모두 더해요.',
          marks: [],
        },
      ],
    },
    chase: {
      name: '엄마 피해 도망가기',
      sub: '반 전체가 한 팀 · 협동',
      cards: [
        {
          img: 'img/howto/chase-1.jpg',
          t: '반 전체가 함께 도망쳐라!',
          d: '우리 반 하트를 모두 함께 써요.',
          marks: [],
        },
        {
          img: 'img/howto/chase-2.jpg',
          t: '뚫린 길 모양을 재빨리 눌러라!',
          d: '맵에서 뚫린 길의 모양을 찾아 단추를 한 번 눌러요.',
          marks: [{ x: 59.5, y: 35, r: 7, label: '뚫린 길 모양' }, { x: 24, y: 81, r: 8, label: '같은 모양 누르기' }],
        },
        {
          img: 'img/howto/chase-3.jpg',
          t: '막힌 길이면 엄마한테 잡힌다!',
          d: '잡히면 하트가 줄어요. 문제를 4개 이상 맞히면 「숙제 도장」으로 한 번 봐줘요.',
          marks: [],
        },
        {
          img: 'img/howto/chase-4.jpg',
          t: '하트가 남으면 우리 반 성공!',
          d: '하트가 0이 되면 게임 오버예요.',
          marks: [],
        },
      ],
    },
    flip: {
      name: '도깨비 뒤집기',
      sub: '눈치 게임 · 비밀 종족과 숨은 악마',
      cards: [
        {
          img: 'img/howto/flip-1.jpg',
          t: '내 정체를 몰래 확인하라!',
          d: '반은 도깨비, 반은 인간. 한 명은 몰래 악마예요.',
          marks: [{ x: 28.3, y: 38.4, r: 4, label: '꾹 누르기' }],
        },
        {
          img: 'img/howto/flip-2.jpg',
          t: '친구를 눌러 뒤집어라!',
          d: '맞힌 수만큼 표를 줘요. 홀수 표를 받으면 뒤집혀요.',
          marks: [],
        },
        {
          img: 'img/howto/flip-3.jpg',
          t: 'TV를 보며 눈치를 살펴라!',
          d: '어느 쪽이 많은지, 악마가 어디 숨었는지 힌트가 나와요.',
          marks: [],
        },
        {
          img: 'img/howto/flip-4.jpg',
          t: '많은 쪽이 승리! 단, 악마가 있으면 반대!',
          d: '다수에 악마가 숨어 있으면 소수가 이겨요.',
          marks: [],
        },
      ],
    },
  };
  QP.HOWTO = HOWTO;

  const CSS = `
.hw-back { position: fixed; inset: 0; z-index: 9000; background: rgba(30,22,16,.72); display: flex; align-items: center; justify-content: center; font-family: 'QPBody', 'Malgun Gothic', sans-serif; }
.hw-card { position: relative; width: min(94vw, 1100px); max-height: 96vh; background: #fbf4e4; border: 4px solid #3a2a20; border-radius: 14px; box-shadow: 8px 8px 0 rgba(0,0,0,.35); display: flex; flex-direction: column; overflow: hidden; }
.hw-head { display: flex; align-items: baseline; gap: 10px; padding: 10px 18px 6px; border-bottom: 3px solid #e6d6b4; }
.hw-head h2 { margin: 0; font-family: 'QPTitle', serif; font-weight: normal; font-size: 26px; color: #2a211b; }
.hw-head small { color: #7a6450; font-size: 15px; }
.hw-head .n { margin-left: auto; color: #7a6450; font-size: 16px; }
.hw-x { border: 0; background: none; font-size: 28px; line-height: 1; cursor: pointer; color: #5a4636; padding: 0 0 0 10px; }
.hw-body { display: flex; flex-direction: column; align-items: center; padding: 12px 18px 6px; gap: 10px; min-height: 0; }
.hw-pic { position: relative; max-width: 100%; border: 3px solid #3a2a20; border-radius: 8px; overflow: hidden; background: #000; }
.hw-pic img { display: block; max-width: 100%; max-height: 54vh; }
.hw-mk { position: absolute; transform: translate(-50%, -50%); border: 5px solid #ff4d3a; border-radius: 50%; box-shadow: 0 0 0 3px #fff, 0 0 12px rgba(255,77,58,.8); animation: hw-pulse 1s ease-in-out infinite alternate; pointer-events: none; }
.hw-mk b { position: absolute; left: 50%; top: 100%; transform: translate(-50%, 6px); white-space: nowrap; background: #ff4d3a; color: #fff; font-family: 'QPTitle', serif; font-weight: normal; font-size: 18px; padding: 1px 10px; border-radius: 6px; box-shadow: 2px 2px 0 rgba(0,0,0,.3); }
.hw-mk.up b { top: auto; bottom: 100%; transform: translate(-50%, -6px); }
@keyframes hw-pulse { from { transform: translate(-50%, -50%) scale(1); } to { transform: translate(-50%, -50%) scale(1.08); } }
.hw-t { margin: 0; font-family: 'QPTitle', serif; font-weight: normal; font-size: 36px; color: #2a211b; text-align: center; }
.hw-t i { font-style: normal; display: inline-block; background: #d9573f; color: #fff; border-radius: 50%; width: 1.3em; height: 1.3em; line-height: 1.3em; font-size: .8em; margin-right: 8px; vertical-align: .1em; }
.hw-d { margin: 0; font-size: 22px; line-height: 1.55; color: #3a2a20; text-align: center; max-width: 900px; word-break: keep-all; }
.hw-foot { display: flex; align-items: center; justify-content: center; gap: 16px; padding: 8px 18px 14px; }
.hw-foot button { font-family: 'QPTitle', serif; font-size: 22px; padding: 6px 22px; border-radius: 10px; border: 3px solid #3a2a20; background: #fff7e6; color: #2a211b; cursor: pointer; box-shadow: 3px 3px 0 rgba(0,0,0,.25); }
.hw-foot button.go { background: #d9573f; color: #fff; }
.hw-foot button:disabled { opacity: .35; cursor: default; }
.hw-dots { display: flex; gap: 8px; }
.hw-dots i { width: 12px; height: 12px; border-radius: 50%; background: #d8c8a8; }
.hw-dots i.on { background: #d9573f; }
/* 전자칠판: 글자 크게 */
.hw-back.big .hw-card { width: min(96vw, 1500px); }
.hw-back.big .hw-head h2 { font-size: 34px; } .hw-back.big .hw-head small, .hw-back.big .hw-head .n { font-size: 20px; }
.hw-back.big .hw-pic img { max-height: 58vh; }
.hw-back.big .hw-t { font-size: 56px; } .hw-back.big .hw-d { font-size: 32px; max-width: 1300px; }
.hw-back.big .hw-mk b { font-size: 24px; }
.hw-back.big .hw-foot button { font-size: 28px; padding: 8px 30px; }
/* 디벗(좁은 화면) */
@media (max-width: 700px) { .hw-t { font-size: 22px; } .hw-d { font-size: 15px; } .hw-pic img { max-height: 42vh; } .hw-mk b { font-size: 13px; } .hw-foot button { font-size: 18px; padding: 4px 14px; } }
`;
  let styled = false;
  function style() {
    if (styled) return;
    styled = true;
    const s = document.createElement('style');
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  function open(mode, opts) {
    const H = HOWTO[mode];
    if (!H) return null;
    style();
    opts = opts || {};
    close();
    const back = document.createElement('div');
    back.className = 'hw-back' + (opts.big ? ' big' : '');
    back.id = 'hw-back';
    let i = opts.at || 0;
    const draw = () => {
      const c = H.cards[i];
      back.innerHTML =
        '<div class="hw-card"><div class="hw-head"><h2>' + H.name + ' 놀이 방법</h2><small>' + H.sub + '</small><span class="n">' + (i + 1) + ' / ' + H.cards.length + '</span><button class="hw-x" data-hw="x" aria-label="닫기">✕</button></div>' +
        '<div class="hw-body"><div class="hw-pic"><img src="' + c.img + '" alt="">' +
        (c.marks || []).map((m) => '<div class="hw-mk' + (m.y > 70 ? ' up' : '') + '" style="left:' + m.x + '%;top:' + m.y + '%;width:' + m.r * 2 + '%;aspect-ratio:1"><b>' + m.label + '</b></div>').join('') +
        '</div><h3 class="hw-t"><i>' + (i + 1) + '</i>' + c.t + '</h3><p class="hw-d">' + c.d + '</p></div>' +
        '<div class="hw-foot"><button data-hw="p"' + (i ? '' : ' disabled') + '>◀ 이전</button><div class="hw-dots">' + H.cards.map((_, k) => '<i class="' + (k === i ? 'on' : '') + '"></i>').join('') + '</div>' +
        (i < H.cards.length - 1 ? '<button class="go" data-hw="n">다음 ▶</button>' : '<button class="go" data-hw="x">' + (opts.doneLabel || '다 봤어요') + '</button>') + '</div></div>';
    };
    back.addEventListener('click', (e) => {
      const b = e.target.closest('[data-hw]');
      if (e.target === back) return close();
      if (!b) return;
      if (b.dataset.hw === 'x') close();
      else if (b.dataset.hw === 'p' && i > 0) { i--; draw(); }
      else if (b.dataset.hw === 'n' && i < H.cards.length - 1) { i++; draw(); }
    });
    key = (e) => {
      if (e.key === 'ArrowRight' && i < H.cards.length - 1) { i++; draw(); }
      else if (e.key === 'ArrowLeft' && i > 0) { i--; draw(); }
      else if (e.key === 'Escape') close();
    };
    addEventListener('keydown', key);
    draw();
    document.body.appendChild(back);
    onClose = opts.onClose || null;
    return back;
  }
  let key = null, onClose = null;
  function close() {
    const b = document.getElementById('hw-back');
    if (b) b.remove();
    if (key) removeEventListener('keydown', key);
    key = null;
    if (onClose) { const f = onClose; onClose = null; f(); }
  }
  QP.Howto = { open, close, has: (m) => !!HOWTO[m] };
})();
