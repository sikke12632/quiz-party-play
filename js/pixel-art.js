/* pixel-art.js — 「보물 지키기」 도트 그림 (전역 PX). 글자 지도로 그리고 테두리를 저절로 두른다.
 * 그림은 처음 한 번만 만들어 두고(작은 캔버스), 게임 중에는 바꿔 끼우기만 한다.
 */
(function () {
  'use strict';
  const PX = (window.PX = {});

  function make(rows, pal, outline) {
    const h = rows.length,
      w = Math.max(...rows.map((r) => r.length)),
      o = outline ? 1 : 0;
    const c = document.createElement('canvas');
    c.width = w + o * 2;
    c.height = h + o * 2;
    const g = c.getContext('2d');
    const on = (x, y) => y >= 0 && y < h && x >= 0 && x < rows[y].length && rows[y][x] !== '.';
    if (outline) {
      g.fillStyle = outline;
      for (let y = -1; y <= h; y++)
        for (let x = -1; x <= w; x++) if (!on(x, y) && (on(x + 1, y) || on(x - 1, y) || on(x, y + 1) || on(x, y - 1))) g.fillRect(x + o, y + o, 1, 1);
    }
    for (let y = 0; y < h; y++)
      for (let x = 0; x < rows[y].length; x++) {
        const k = rows[y][x];
        if (k === '.') continue;
        g.fillStyle = pal[k] || '#f0f';
        g.fillRect(x + o, y + o, 1, 1);
      }
    return c;
  }
  PX.make = make;

  /* ---------- 아이 (팀 동물 모자 + 옷 색) ---------- */
  // 귀 4줄(동물마다) + 얼굴 6줄(같음). k = 무늬(호랑이 줄무늬·판다 귀), w = 귀 안, m = 입(펭귄은 부리)
  const EARS = {
    호랑이: ['............', '............', '.oo......oo.', 'owwookkoowwo'],
    토끼: ['..oo....oo..', '..ow....wo..', '..ow....wo..', '.oooooooooo.'],
    펭귄: ['............', '............', '...oooooo...', '.oooooooooo.'],
    여우: ['............', '.o........o.', '.oo......oo.', 'owwoooooowwo'],
    판다: ['............', '............', '.kk......kk.', 'kkkoooooookk'],
    곰: ['............', '............', '.oo......oo.', 'owwoooooowwo'],
  };
  const FACE = ['oooooooooooo', 'ookossssokoo', 'oossssssssoo', 'oossessessoo', 'ospssmmsspso', '.oossssssoo.'];
  const HOOD = {
    호랑이: { o: '#e8922e', k: '#3a2a20', w: '#fff3e0', m: '#a0503a' },
    토끼: { o: '#f6f1ea', k: '#f6f1ea', w: '#f2a6ad', m: '#a0503a' },
    펭귄: { o: '#3a4660', k: '#3a4660', w: '#3a4660', m: '#f0a020' },
    여우: { o: '#d8743a', k: '#d8743a', w: '#fff3e0', m: '#a0503a' },
    판다: { o: '#f4f4f0', k: '#2a2a2a', w: '#2a2a2a', m: '#a0503a' },
    곰: { o: '#a8754d', k: '#a8754d', w: '#e7c39a', m: '#a0503a' },
  };
  const CLOTH = [['#d9573f', '#a33a28'], ['#3f7fa8', '#2a5a7c'], ['#5f9a55', '#3f7039'], ['#8a63b8', '#614289'], ['#e07a9a', '#b0546f'], ['#e0a93a', '#a8791e'], ['#2f8f8a', '#1f625e'], ['#6b6f7a', '#4a4d55']];
  PX.CLOTH = CLOTH;
  const pad = (r) => (r + '.').slice(0, 13);
  // 몸 프레임: 걷기 4장 + 던지기 준비 + 던짐 (13칸 폭)
  const BODY = {
    w0: ['..cccccccc..', '.cccccccccc.', 'sccccccccccs', '.cccccccccc.', '.dddddddddd.', '..dd....dd..'],
    w1: ['..cccccccc..', '.cccccccccc.', 'scccccccccc.', '.ccccccccccs', '.dddddddddd.', '...dd..dd...'],
    w2: ['..cccccccc..', '.cccccccccc.', 'sccccccccccs', '.cccccccccc.', '.dddddddddd.', '...dd..dd...'],
    w3: ['..cccccccc..', '.cccccccccc.', '.ccccccccccs', 'scccccccccc.', '.dddddddddd.', '..dd....dd..'],
    wind: ['..cccccccccc', '.cccccccccc.', 'scccccccccc.', '.cccccccccc.', '.dddddddddd.', '..dd....dd..'],
    thr: ['..cccccccc..', '.ccccccccccc', 'scccccccccc.', '.cccccccccc.', '.dddddddddd.', '..dd....dd..'],
  };
  const cache = new Map();
  function pal(animal, cl) {
    const c = CLOTH[cl % CLOTH.length];
    return Object.assign({ s: '#f1d5ad', e: '#2a1a10', p: '#f09a90', c: c[0], d: c[1] }, HOOD[animal] || HOOD['곰']);
  }
  // 프레임 [걷기0, 걷기1, 걷기2, 걷기3, 던지기 준비, 던짐]
  PX.kid = function (animal, cl) {
    const key = animal + cl;
    if (cache.has(key)) return cache.get(key);
    const head = EARS[animal] || EARS['곰'];
    const fr = ['w0', 'w1', 'w2', 'w3', 'wind', 'thr'].map((b) => {
      const rows = head.concat(FACE).concat(BODY[b]).map(pad);
      if (b === 'wind') rows[9] = pad('.oossssssoo.s'); // 손을 머리 뒤로
      return make(rows, pal(animal, cl), '#3a2a20');
    });
    cache.set(key, fr);
    return fr;
  };
  // 얼굴 아이콘(아이 화면 위쪽·TV)
  const icons = new Map();
  PX.icon = function (animal, cl, size) {
    size = size || 48;
    const key = animal + cl + '|' + size;
    if (icons.has(key)) return icons.get(key);
    const head = make((EARS[animal] || EARS['곰']).concat(FACE), pal(animal, cl || 0), '#3a2a20');
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const g = c.getContext('2d');
    g.imageSmoothingEnabled = false;
    g.fillStyle = '#f6d79a';
    g.fillRect(0, 0, size, size);
    const k = Math.floor(size / 14);
    g.drawImage(head, Math.round((size - head.width * k) / 2), Math.round((size - head.height * k) / 2) + k, head.width * k, head.height * k);
    const url = c.toDataURL();
    icons.set(key, url);
    return url;
  };

  /* ---------- 적 ---------- */
  const GH = ['...wwww...', '.wwwwwwww.', 'wwwwwwwwww', 'wweewweeww', 'wweewweeww', 'wpwwwwwwpw', 'wwwwmmwwww', 'wwwwwwwwgw', 'wwwwwwwggw'];
  const ghPal = { w: '#f7f5ff', g: '#d8d4f0', e: '#2a2440', p: '#f4a9b8', m: '#2a2440' };
  PX.ghost = ['w.ww..ww.w', '.ww.ww.ww.'].map((r) => make(GH.concat([r]), ghPal, '#5a5480'));
  const FI = ['..bbbbbb..', '.bbbccbbb.', '.bbccccbb.', 'bbccccccbb', 'bccecceccb', 'bccecceccb', 'bcccmmcccb', '.bccccccb.', '..bbbbbb..'];
  const fiPal = { b: '#3f9be8', c: '#bfeaff', e: '#1d2a44', m: '#1d2a44' };
  PX.fire = [['....bb....', '...bbbb...'], ['.....b....', '..bbbb....']].map((top) => make(top.concat(FI), fiPal, '#1f4f8a'));

  /* ---------- 보물·나무·별·펑 ---------- */
  const CH = ['...yyyyyyyyyyyy...', '..rrrrrrrrrrrrrr..', '.rrgrrrrrrrrrrgrr.', 'rrrgrrrrrrrrrrgrrr', 'gggggggggggggggggg', 'rrrgrrrryyrrrrgrrr', 'rrrgrrrryyrrrrgrrr', 'rrrgrrrrrrrrrrgrrr', 'rrrgrrrrrrrrrrgrrr', 'dddgddddddddddgddd'];
  const chPal = { r: '#c4553f', g: '#e0a93a', y: '#ffd23e', d: '#7a3426', W: '#ffffff' };
  PX.chest = ['....y.yyy.y.y.....', '...W.yyy.y.yW.....'].map((r) => make([r].concat(CH), chPal, '#3a2a20'));
  // 맞아서 빨갛게 번쩍
  PX.chestHit = make(['....y.yyy.y.y.....'].concat(CH), { r: '#ff8a7a', g: '#ffd08a', y: '#fff0a0', d: '#c4553f' }, '#7a1e18');
  const TR = ['.....llll.....', '...llLLllll...', '..lLLllllllll.', '.lLLlllllllll.', '.lllllllllllll', 'llllllllllllnl', 'lllllllllllnnl', 'llllllllllnnnl', '.llllllllnnnn.', '..nlllllnnnn..', '...nnnnnnnn...', '......tt......', '......tt......', '.....tttt.....'];
  PX.tree = [make(TR, { l: '#5fa34a', L: '#8cd06a', n: '#3f7a38', t: '#8b5a3c' }, '#2d4a22'), make(TR, { l: '#78b552', L: '#a6dc7c', n: '#4f8a40', t: '#8b5a3c' }, '#2d4a22')];
  const ST = ['...y...', '..yYy..', 'yyyYyyy', '.yyyyy.', '..yyy..', '.yy.yy.', '.y...y.'];
  PX.star = [make(ST, { y: '#ffd23e', Y: '#fff3a0' }, '#9a6a00'), make(ST, { y: '#ffe36a', Y: '#ffffff' }, '#9a6a00')];
  PX.pop = [3, 5, 6].map((r, f) => {
    const c = document.createElement('canvas');
    c.width = c.height = 13;
    const g = c.getContext('2d');
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      g.fillStyle = f === 2 ? '#fff3a0' : '#ffd23e';
      g.fillRect(6 + Math.round(Math.cos(a) * r), 6 + Math.round(Math.sin(a) * r), f === 0 ? 2 : 1, f === 0 ? 2 : 1);
    }
    if (f === 0) {
      g.fillStyle = '#ffffff';
      g.fillRect(5, 5, 3, 3);
    }
    return c;
  });
  PX.arrow = make(['rrrrr', '.rrr.', '..r..'], { r: '#e8504a' }, '#7a1e18');

  // 하트(도트) SVG
  const PH = ['.xx.xx.', 'xxxxxxx', 'xxxxxxx', '.xxxxx.', '..xxx..', '...x...'];
  PX.heart = (on, cls) =>
    '<svg viewBox="-1 -1 9 8" class="pxh ' + (cls || '') + '" shape-rendering="crispEdges">' +
    PH.map((r, y) => [...r].map((c, x) => (c === 'x' ? '<rect x="' + x + '" y="' + y + '" width="1" height="1" fill="' + (on ? (y === 1 && x === 1 ? '#ffb0a8' : '#e8504a') : 'rgba(90,70,54,.22)') + '"/>' : '')).join('')).join('') +
    '</svg>';

  /* ---------- 바닥: 물 + 섬 (한 번만 그린다) ---------- */
  PX.ground = function (W, H, CX, CY, RX, RY, U, SY, seed) {
    let s = seed || 7;
    const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    const c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    const g = c.getContext('2d');
    const img = g.createImageData(W, H),
      d = img.data;
    const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
    const C = { water: hex('#5fb7c9'), wave: hex('#9fe0ec'), sand: hex('#ecd8a2'), cliff: hex('#c9ac6e'), cliff2: hex('#a88a50'), grass: hex('#8cc461'), gd: hex('#79b052'), gl: hex('#a2d676'), edge: hex('#6f9c48'), path: hex('#e6cf93'), f1: hex('#ffffff'), f2: hex('#ffe36a'), f3: hex('#f7a8c0') };
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const e = (dy, k) => ((x - CX) / (RX * k)) ** 2 + ((y - CY - dy) / (RY * k)) ** 2;
        let col = C.water;
        const r = rnd();
        if ((x + Math.floor(y / 7) * 5) % 23 < 3 && y % 7 === 0) col = C.wave;
        if (e(-6, 1.03) < 1) col = y > CY ? (r < 0.15 ? C.cliff2 : C.cliff) : C.sand;
        if (e(0, 1.03) < 1) col = C.sand;
        if (e(-3, 0.965) < 1) col = C.edge;
        if (e(0, 0.965) < 1) {
          col = r < 0.07 ? C.gd : r < 0.11 ? C.gl : C.grass;
          if (r > 0.996) col = C.f1;
          else if (r > 0.993) col = C.f2;
          else if (r > 0.99) col = C.f3;
          if (((x - CX) / (2.3 * U)) ** 2 + ((y - CY) / (1.8 * U * SY)) ** 2 < 1) col = r < 0.1 ? C.sand : C.path;
        }
        const i = (y * W + x) * 4;
        d[i] = col[0];
        d[i + 1] = col[1];
        d[i + 2] = col[2];
        d[i + 3] = 255;
      }
    g.putImageData(img, 0, 0);
    g.fillStyle = '#5f9a44';
    for (let i = 0; i < 90; i++) {
      const x = Math.round(CX + (rnd() - 0.5) * RX * 1.6),
        y = Math.round(CY + (rnd() - 0.5) * RY * 1.6);
      if (((x - CX) / RX) ** 2 + ((y - CY) / RY) ** 2 > 0.8) continue;
      g.fillRect(x, y - 2, 1, 2);
      g.fillRect(x + 2, y - 3, 1, 3);
      g.fillRect(x + 4, y - 2, 1, 2);
    }
    return c;
  };
})();
