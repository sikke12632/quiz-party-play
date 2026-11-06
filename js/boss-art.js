/* boss-art.js — 「보스 슈팅」 도트 그림 (전역 BA). 보스 5마리(그림 3장씩·탄 4종·하늘 색), 비행기, 우리 탄, 터짐, 하늘.
 * 작업/시안/보스슈팅 의 시안 그림을 옮긴 것. 글자 지도 → 도트는 pixel-art.js 의 PX.make.
 * 그림은 처음 BA.init() 때 한 번 만든다(선생님 화면이 이 파일만 읽어도 무겁지 않게).
 */
(function () {
  'use strict';
  const BA = (window.BA = {});
  let done = false;
  BA.init = function () {
    if (done) return BA;
    done = true;
    build(BA, window.PX);
    return BA;
  };
  function build(A, P) {
  /* 보스 「먹구름 대왕」: 구름 덩어리 + 왕관 + 화난 얼굴. 모드 idle / open(쏠 때) / hurt(아야) */
  function bossRows(mode) {
    const W = 64, H = 42;
    const g = Array.from({ length: H }, () => Array(W).fill('.'));
    const set = (x, y, ch) => { if (x >= 0 && x < W && y >= 0 && y < H) g[y][x] = ch; };
    const C = [[14, 25, 11], [25, 18, 13], [39, 17, 13], [51, 25, 11], [32, 29, 12], [20, 31, 9], [45, 31, 9]];
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      let inside = false, top = false;
      for (const [cx, cy, r] of C) {
        const d = (x - cx) ** 2 + (y - cy) ** 2;
        if (d <= r * r) { inside = true; if (y - cy < -r * 0.55) top = true; }
      }
      if (!inside) continue;
      set(x, y, y >= 34 ? 'D' : top ? 'L' : 'b');
    }
    // 아래쪽 물결 그늘
    for (let x = 0; x < W; x++) for (let y = 30; y < 34; y++) if (g[y][x] === 'b' && (x + y) % 9 === 0) set(x, y, 'D');
    // 왕관
    ['y...y...y', 'yy.yyy.yy', 'yyyyyyyyy', 'yyyyryyyy', 'yyyyyyyyy'].forEach((r, j) => [...r].forEach((ch, i) => ch !== '.' && set(28 + i, 1 + j, ch)));
    // 눈
    const eye = (cx, cy, look) => {
      if (mode === 'hurt') { // > <
        const s = cx < 32 ? 1 : -1;
        for (let k = -2; k <= 2; k++) set(cx - s * (2 - Math.abs(k)), cy + k, 'e');
        return;
      }
      for (let y = -2; y <= 2; y++) for (let x = -3; x <= 3; x++) if (!(Math.abs(x) === 3 && Math.abs(y) === 2)) set(cx + x, cy + y, 'W');
      for (let y = 0; y <= 1; y++) for (let x = 0; x <= 1; x++) set(cx + look + x, cy + y, 'e');
    };
    eye(25, 22, -1); eye(39, 22, 0);
    // 눈썹(화남)
    [[20, 16], [21, 16], [22, 17], [23, 17], [24, 17], [25, 18], [26, 18], [27, 18], [28, 19]].forEach(([x, y]) => { set(x, y, 'e'); set(x, y + 1, 'e'); set(64 - x, y, 'e'); set(64 - x, y + 1, 'e'); });
    // 볼
    [[19, 26], [20, 26], [21, 26], [43, 26], [44, 26], [45, 26]].forEach(([x, y]) => set(x, y, 'p'));
    // 입
    if (mode === 'open') {
      for (let y = 26; y <= 32; y++) for (let x = 27; x <= 37; x++) if (!((y === 26 || y === 32) && (x === 27 || x === 37))) set(x, y, 'e');
      [28, 30, 32, 34, 36].forEach((x) => set(x, 27, 'W'));
      for (let y = 30; y <= 31; y++) for (let x = 29; x <= 35; x++) set(x, y, 'r');
    } else if (mode === 'hurt') {
      for (let x = 27; x <= 37; x++) set(x, 29 + ((x % 2) ? 0 : 1), 'e');
    } else {
      for (let x = 29; x <= 35; x++) set(x, 28, 'e');
      set(28, 29, 'e'); set(27, 30, 'e'); set(36, 29, 'e'); set(37, 30, 'e');
    }
    return g.map((r) => r.join(''));
  }
  const bossPal = { b: '#9a93c9', L: '#c8c2ea', D: '#736aa6', y: '#ffd23e', r: '#e8504a', W: '#ffffff', e: '#2a2440', p: '#f4a9b8' };
  A.boss = { idle: P.make(bossRows('idle'), bossPal, '#3a3060'), open: P.make(bossRows('open'), bossPal, '#3a3060'), hurt: P.make(bossRows('hurt'), bossPal, '#3a3060') };

  /* 보스 탄: 밝은 색 + 하얀 속 + 진한 테두리(하늘에서 잘 보이게) */
  const ORB = ['.aaa.', 'aWWaa', 'aWaaa', 'aaaaa', '.aaa.'];
  const DROP = ['..a..', '.aWa.', 'aWaaa', 'aaaaa', '.aaa.'];
  A.orb = {
    pink: P.make(ORB, { a: '#ff4fa0', W: '#ffffff' }, '#3a1030'),
    purple: P.make(ORB, { a: '#9a5cff', W: '#ffffff' }, '#24104a'),
    orange: P.make(ORB, { a: '#ff7a1a', W: '#fff3a0' }, '#4a1a00'),
    drop: P.make(DROP, { a: '#2f6fe0', W: '#dff0ff' }, '#0c2050'),
  };
  /* 우리 탄 */
  A.shot = P.make(['W', 'y', 'y'], { y: '#ffe36a', W: '#ffffff' }, '#9a6a00');
  A.bigShot = P.make(['.W.', 'yWy', 'yyy', '.y.'], { y: '#ffb03a', W: '#fff6c8' }, '#8a4a00');

  /* 터짐(격추) 4장 */
  A.boom = [3, 5, 7, 8].map((r, f) => {
    const n = 19, c = document.createElement('canvas'); c.width = c.height = n;
    const g = c.getContext('2d');
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const d = Math.hypot(x - 9, y - 9);
      if (f < 2 ? d <= r : d <= r && d >= r - 2 - ((x * 7 + y * 3) % 2)) {
        g.fillStyle = d < r - 3 ? '#fff6c8' : d < r - 1.5 ? '#ffd23e' : f > 1 ? '#a8a0b8' : '#ff7a1a';
        g.fillRect(x, y, 1, 1);
      }
    }
    return c;
  });
  A.smoke = P.make(['.gg.', 'gggg', 'gggg', '.gg.'], { g: '#d8d4e4' }, null);

  /* 하늘(그라데이션 + 점무늬 경계) */
  A.sky = function (W, H, bands) {
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const g = c.getContext('2d');
    const BANDS = bands || ['#5fb2e6', '#6dbcea', '#7cc6ee', '#8bd0f2', '#9ad9f5', '#aae2f8'];
    const bh = H / BANDS.length;
    for (let y = 0; y < H; y++) {
      const b = Math.min(BANDS.length - 1, Math.floor(y / bh)), f = (y % bh) / bh;
      for (let x = 0; x < W; x++) {
        const next = f > 0.75 && b < BANDS.length - 1 && (x + y) % 2 === 0;
        g.fillStyle = next ? BANDS[b + 1] : BANDS[b];
        g.fillRect(x, y, 1, 1);
      }
    }
    return c;
  };
  /* 흘러가는 구름(겹쳐 그리는 띠) */
  A.clouds = function (W, H, rnd) {
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const g = c.getContext('2d');
    for (let i = 0; i < 9; i++) {
      const cx = Math.floor(rnd() * W), cy = Math.floor((i + rnd() * 0.6) * (H / 9)), w = 14 + Math.floor(rnd() * 16);
      const bumps = [[0, 0, w * 0.45], [-w * 0.45, 2, w * 0.3], [w * 0.45, 2, w * 0.32], [w * 0.15, -3, w * 0.33]];
      for (let y = -12; y < 12; y++) for (let x = -w; x < w; x++) {
        let on = false, top = false;
        for (const [bx, by, r] of bumps) { const d = (x - bx) ** 2 + (y - by) ** 2; if (d < r * r) { on = true; if (y - by < -r * 0.4) top = true; } }
        if (!on || y > 4) continue;
        g.fillStyle = top ? 'rgba(255,255,255,.95)' : y > 2 ? 'rgba(214,236,250,.9)' : 'rgba(240,248,255,.9)';
        g.fillRect(((cx + x) % W + W) % W, cy + y, 1, 1);
      }
    }
    return c;
  };
  /* 비행기(위를 봄) — 조종석에 팀 동물 모자 쓴 아이, 비행기 색 = 옷 색(PX.CLOTH) */
  const HOOD = { 호랑이: ['#e8922e', '#3a2a20'], 토끼: ['#f6f1ea', '#f2a6ad'], 펭귄: ['#3a4660', '#3a4660'], 여우: ['#d8743a', '#fff3e0'], 판다: ['#f4f4f0', '#2a2a2a'], 곰: ['#a8754d', '#a8754d'] };
  const PLANE = ['......t......', '.....tct.....', '....cokoc....', '....cesec....', '..ddcccccdd..', 'ddddcccccdddd', 'dddcccccccddd', '.....ccc.....', '....dcccd....', '...dd.c.dd...'];
  const FLAME = [['.....fyf.....', '......f......'], ['......y......', '.....f.f.....']];
  const planes = new Map();
  // [불꽃 1, 불꽃 2] 두 장. gray = 격추(회색)
  A.plane = function (animal, cl, gray) {
    const key = animal + '|' + cl + '|' + (gray ? 1 : 0);
    if (planes.has(key)) return planes.get(key);
    const h = HOOD[animal] || HOOD['곰'], c = P.CLOTH[(cl | 0) % P.CLOTH.length];
    const pal = { t: '#f5f0e6', c: c[0], d: c[1], o: h[0], k: h[1], e: '#2a1a10', s: '#f1d5ad', f: '#ff8a2a', y: '#ffe36a' };
    if (gray) for (const k in pal) pal[k] = '#9a9aa8';
    const fr = FLAME.map((fl) => P.make(PLANE.concat(fl), pal, '#2a2030'));
    planes.set(key, fr);
    return fr;
  };
  const urls = new Map();
  A.url = function (key, img, k) { // 그림 → 키운 dataURL (한 번만)
    if (urls.has(key)) return urls.get(key);
    const c = document.createElement('canvas'); c.width = img.width * k; c.height = img.height * k;
    const g = c.getContext('2d'); g.imageSmoothingEnabled = false; g.drawImage(img, 0, 0, c.width, c.height);
    const u = c.toDataURL(); urls.set(key, u); return u;
  };
  A.planeIcon = (animal, cl, gray, k) => A.url('p' + animal + cl + (gray ? 1 : 0) + k, A.plane(animal, cl, gray)[0], k || 2);
  A.bossIcon = (i, k, mode) => A.url('b' + i + (mode || 'idle') + k, A.BOSSES[i].spr[mode || 'idle'], k);
  /* ---------- 글자 지도 그리기 도구 ---------- */
  function Grid(W, H) {
    const g = Array.from({ length: H }, () => Array(W).fill('.'));
    const o = {
      W, H,
      set(x, y, c) { x = Math.round(x); y = Math.round(y); if (x >= 0 && x < W && y >= 0 && y < H) g[y][x] = c; },
      get(x, y) { return x >= 0 && x < W && y >= 0 && y < H ? g[y][x] : '.'; },
      ell(cx, cy, rx, ry, c) { for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1) o.set(x, y, typeof c === 'function' ? c(x, y) : c); },
      shade(cx, cy, rx, ry, L, b, D) { o.ell(cx, cy, rx, ry, (x, y) => ((y - cy) < -ry * 0.5 ? L : (y - cy) > ry * 0.55 ? D : b)); },
      rect(x0, y0, w, h, c) { for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) o.set(x, y, c); },
      line(x0, y0, x1, y1, c, th) { const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) * 2 || 1; for (let i = 0; i <= n; i++) { const x = x0 + ((x1 - x0) * i) / n, y = y0 + ((y1 - y0) * i) / n; o.set(x, y, c); if (th) o.set(x, y + 1, c); } },
      tri(ax, ay, bx, by, cx, cy, c) { // 채운 세모
        const minx = Math.min(ax, bx, cx), maxx = Math.max(ax, bx, cx), miny = Math.min(ay, by, cy), maxy = Math.max(ay, by, cy);
        const s = (px, py, x1, y1, x2, y2) => (px - x2) * (y1 - y2) - (x1 - x2) * (py - y2);
        for (let y = miny; y <= maxy; y++) for (let x = minx; x <= maxx; x++) {
          const d1 = s(x, y, ax, ay, bx, by), d2 = s(x, y, bx, by, cx, cy), d3 = s(x, y, cx, cy, ax, ay);
          if (!((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0))) o.set(x, y, c);
        }
      },
      stamp(rows, x0, y0) { rows.forEach((r, j) => [...r].forEach((ch, i) => ch !== '.' && o.set(x0 + i, y0 + j, ch))); },
      rows() { return g.map((r) => r.join('')); },
    };
    return o;
  }
  /* 얼굴: 눈(흰 눈 또는 숯 눈)·화난 눈썹·입. mode idle/open/hurt */
  function face(G, mode, f) {
    const { lx, rx, ey, mx, my, mw } = f;
    for (const [cx, s] of [[lx, 1], [rx, -1]]) {
      if (mode === 'hurt') { for (let k = -2; k <= 2; k++) { G.set(cx - s * (2 - Math.abs(k)), ey + k, 'e'); G.set(cx - s * (2 - Math.abs(k)) + s, ey + k, 'e'); } continue; }
      if (f.coal) G.rect(cx - 1, ey - 1, 3, 3, 'e');
      else {
        for (let y = -2; y <= 2; y++) for (let x = -3; x <= 3; x++) if (!(Math.abs(x) === 3 && Math.abs(y) === 2)) G.set(cx + x, ey + y, 'W');
        G.rect(cx - (s > 0 ? 1 : 0), ey, 2, 2, 'e');
      }
      if (f.brow !== false) G.line(cx - s * 5, ey - 6, cx + s * 3, ey - 3, 'e', true);
    }
    const h = Math.floor(mw / 2);
    if (mode === 'open') {
      G.rect(mx - h - 1, my - 2, mw + 2, 6, 'e');
      for (let x = mx - h; x <= mx + h; x += 2) G.set(x, my - 1, 'W');
      G.rect(mx - h + 1, my + 2, mw - 2, 1, f.fire ? 'y' : 'r');
      if (f.fire) G.rect(mx - h + 2, my + 1, mw - 4, 1, 'f');
    } else if (mode === 'hurt') {
      for (let x = mx - h - 1; x <= mx + h + 1; x++) G.set(x, my + (x % 2 ? 0 : 1), 'e');
    } else {
      G.rect(mx - h, my, mw, 1, 'e');
      G.set(mx - h - 1, my + 1, 'e'); G.set(mx + h + 1, my + 1, 'e');
    }
    if (f.cheek) for (const cx of [lx - 5, rx + 5]) G.rect(cx - 1, ey + 4, 3, 1, 'p');
  }

  /* ---------- 탄 모양 ---------- */
  const SHAPE = {
    orb: ['.aaa.', 'aWWaa', 'aWaaa', 'aaaaa', '.aaa.'],
    drop: ['..a..', '.aWa.', 'aWaaa', 'aaaaa', '.aaa.'],
    snow: ['a.a.a', '.aaa.', 'aaWaa', '.aaa.', 'a.a.a'],
    gear: ['.a.a.', 'aaaaa', '.aWa.', 'aaaaa', '.a.a.'],
    fire: ['..a..', '.aa..', '.aaa.', 'aaWaa', '.aaa.'],
    star: ['..a..', '.aWa.', 'aaaaa', '.aaa.', '.a.a.'],
  };
  const bul = (shape, a, line, W) => P.make(SHAPE[shape], { a, W: W || '#ffffff' }, line);

  /* ---------- 1. 먹구름 대왕 (art.js 의 그림) ---------- */
  const B = [];
  B.push({
    name: '먹구름 대왕', tag: '왕관 쓴 심술 먹구름', spr: A.boss,
    bul: { fan: A.orb.pink, spin: A.orb.purple, aim: A.orb.orange, rain: A.orb.drop },
    patName: ['분홍 부채꼴', '보라 빙글빙글', '주황 조준탄', '빗방울'],
    sky: null,
  });

  /* ---------- 2. 먹물 문어 선장 ---------- */
  function octo(mode) {
    const G = Grid(64, 46);
    [8, 15, 22, 28, 36, 42, 49, 56].forEach((x0, i) => {
      for (let t = 0; t < 16; t++) {
        const x = x0 + Math.sin(t * 0.45 + i * 1.3) * 2.2, y = 26 + t, w = t < 10 ? 3 : 2;
        for (let k = 0; k < w; k++) G.set(x + k - 1, y, t > 13 ? 'D' : 'b');
        if (t % 3 === 1 && t < 13) G.set(x + (i < 4 ? 1 : -1), y, 'S');
      }
    });
    G.shade(32, 18, 22, 16, 'L', 'b', 'D');
    [[20, 6], [26, 4], [41, 5], [45, 9], [16, 12]].forEach(([x, y]) => { G.set(x, y, 'S'); G.set(x + 1, y, 'S'); });
    G.rect(10, 9, 44, 2, 'k'); // 고글 끈
    for (const cx of [24, 40]) { G.ell(cx, 9, 5, 4, 'k'); G.ell(cx, 9, 3.6, 2.8, 'g'); G.set(cx - 2, 8, 'W'); G.set(cx - 1, 8, 'W'); }
    face(G, mode, { lx: 24, rx: 40, ey: 20, mx: 32, my: 27, mw: 5, cheek: true });
    return G.rows();
  }
  const octoPal = { b: '#e86a8a', L: '#ffa0b8', D: '#b84868', S: '#ffd0dc', k: '#4a2a20', g: '#9fe0ec', W: '#ffffff', e: '#2a1a30', p: '#ff5a8a', r: '#e8504a' };
  B.push({
    name: '먹물 문어 선장', tag: '고글 쓴 문어, 먹물을 뿜어요',
    spr: { idle: P.make(octo('idle'), octoPal, '#5a1a38'), open: P.make(octo('open'), octoPal, '#5a1a38'), hurt: P.make(octo('hurt'), octoPal, '#5a1a38') },
    bul: { fan: bul('orb', '#5a3aa0', '#140a30'), spin: bul('orb', '#ff4fa0', '#3a1030'), aim: bul('star', '#ffb020', '#4a2a00', '#fff6c8'), rain: bul('drop', '#3a2a70', '#0a0620', '#c8b8ff') },
    patName: ['먹물 부채꼴', '분홍 빙글빙글', '불가사리 조준탄', '먹물 비'],
    sky: ['#4fc0c8', '#5ec8cc', '#70d2d2', '#86dcd8', '#9ee6de', '#b6f0e6'],
  });

  /* ---------- 3. 태엽 부엉이 ---------- */
  function owl(mode) {
    const G = Grid(64, 46);
    G.ell(10, 29, 6, 12, 'D'); G.ell(54, 29, 6, 12, 'D'); // 날개
    for (const x of [10, 54]) for (const y of [22, 29, 36]) G.set(x, y, 'y');
    G.tri(13, 14, 17, 1, 25, 10, 'D'); G.tri(51, 14, 47, 1, 39, 10, 'D'); // 귀깃
    G.shade(32, 25, 21, 19, 'L', 'b', 'D');
    G.ell(32, 34, 12, 9, 'P'); // 배 판
    G.line(22, 31, 42, 31, 'R'); G.line(22, 37, 42, 37, 'R');
    for (const [x, y] of [[23, 33], [41, 33], [26, 40], [38, 40], [32, 42]]) G.set(x, y, 'k');
    G.line(32, 0, 32, 6, 'k'); G.ell(32, 1, 1.6, 1.6, 'r'); // 안테나
    for (const cx of [23, 41]) {
      G.ell(cx, 19, 7, 7, 'R');
      if (mode === 'hurt') { G.ell(cx, 19, 5, 5, 'y'); for (let k = -3; k <= 3; k++) { G.set(cx + k, 19 + k, 'e'); G.set(cx + k, 19 - k, 'e'); } }
      else { G.ell(cx, 19, 5, 5, 'y'); G.ell(cx + (cx < 32 ? 1 : -1), 20, 2.4, 2.4, 'e'); G.set(cx - 2, 16, 'W'); G.set(cx - 1, 16, 'W'); }
    }
    G.line(14, 10, 28, 13, 'k', true); G.line(50, 10, 36, 13, 'k', true); // 쇠 눈썹
    if (mode === 'open') { G.tri(28, 25, 36, 25, 32, 28, 'o'); G.rect(29, 28, 7, 2, 'e'); G.tri(29, 30, 35, 30, 32, 33, 'o'); }
    else { G.tri(28, 25, 36, 25, 32, 31, 'o'); G.line(32, 27, 32, 30, 'O'); }
    return G.rows();
  }
  const owlPal = { b: '#8aa0c0', L: '#b8cce0', D: '#62789a', P: '#d8e2ee', R: '#4a5a72', k: '#2a3248', y: '#ffd23e', r: '#ff4a4a', e: '#1a1a2a', W: '#ffffff', o: '#ff9a3a', O: '#c86a1a' };
  B.push({
    name: '태엽 부엉이', tag: '안테나 달린 로봇 부엉이',
    spr: { idle: P.make(owl('idle'), owlPal, '#1e2638'), open: P.make(owl('open'), owlPal, '#1e2638'), hurt: P.make(owl('hurt'), owlPal, '#1e2638') },
    bul: { fan: bul('gear', '#ff9a1a', '#4a2200'), spin: bul('gear', '#2fc0a8', '#0a3a32'), aim: bul('orb', '#ff3a3a', '#4a0a0a'), rain: bul('gear', '#ffd23e', '#5a4000', '#fff6c8') },
    patName: ['톱니 부채꼴', '초록 톱니 빙글', '빨간 레이저 알', '나사 비'],
    sky: ['#7a7ad8', '#8686de', '#9494e4', '#a4a2ea', '#b4b2ee', '#c6c4f4'],
  });

  /* ---------- 4. 눈보라 눈사람 왕 ---------- */
  function snow(mode) {
    const G = Grid(64, 46);
    G.line(19, 31, 4, 22, 't', true); G.line(9, 25, 6, 18, 't'); G.line(45, 31, 60, 22, 't', true); G.line(55, 25, 58, 18, 't'); // 나뭇가지 팔
    G.shade(32, 33, 15, 12, 'L', 'b', 'D');
    G.shade(32, 16, 12, 11, 'L', 'b', 'D');
    G.stamp(['i...i...i...i', 'ii.iIi.iIi.ii', 'iiiiiiiiiiiii', 'iIiiiiIiiiiIi'], 26, 1); // 얼음 왕관
    G.rect(21, 25, 23, 3, 'r'); for (let x = 22; x < 44; x += 3) G.set(x, 26, 'R'); G.rect(38, 28, 3, 6, 'r'); G.set(39, 31, 'R'); // 목도리
    face(G, mode, { lx: 27, rx: 37, ey: 14, mx: 32, my: 21, mw: 5, coal: true });
    if (mode !== 'hurt') { G.rect(32, 17, 3, 1, 'o'); G.rect(35, 18, 2, 1, 'o'); } // 당근 코
    for (const y of [31, 35, 39]) G.rect(31, y, 2, 2, 'e');
    return G.rows();
  }
  const snowPal = { b: '#eef4ff', L: '#ffffff', D: '#c4d4ea', i: '#7fc8ff', I: '#e0f4ff', r: '#e8504a', R: '#ffffff', t: '#7a4a2a', o: '#ff8a2a', e: '#26283a', W: '#ffffff' };
  B.push({
    name: '눈보라 눈사람 왕', tag: '얼음 왕관, 눈송이를 뿌려요',
    spr: { idle: P.make(snow('idle'), snowPal, '#3a4a6a'), open: P.make(snow('open'), snowPal, '#3a4a6a'), hurt: P.make(snow('hurt'), snowPal, '#3a4a6a') },
    bul: { fan: bul('snow', '#3fa8ff', '#0a2a5a'), spin: bul('orb', '#7a6aff', '#1a1050'), aim: bul('orb', '#ff4a5a', '#4a0a14'), rain: bul('snow', '#2f80e0', '#08204a', '#dff0ff') },
    patName: ['눈송이 부채꼴', '보라 얼음 빙글', '빨간 눈뭉치', '함박눈'],
    sky: ['#8fb0d8', '#9cbade', '#aac4e4', '#b8cfea', '#c6daf0', '#d6e6f6'],
  });

  /* ---------- 5. 꼬마 불꽃 용 ---------- */
  function dragon(mode) {
    const G = Grid(64, 46);
    G.tri(14, 14, 0, 4, 6, 34, 'w'); G.tri(50, 14, 64, 4, 58, 34, 'w'); // 날개
    G.line(13, 15, 2, 6, 'D'); G.line(13, 15, 4, 22, 'D'); G.line(13, 15, 6, 31, 'D');
    G.line(51, 15, 62, 6, 'D'); G.line(51, 15, 60, 22, 'D'); G.line(51, 15, 58, 31, 'D');
    G.tri(20, 9, 17, 0, 25, 7, 'h'); G.tri(44, 9, 47, 0, 39, 7, 'h'); // 뿔
    G.shade(32, 21, 18, 16, 'L', 'b', 'D');
    G.stamp(['.h.', 'hhh'], 31, 3); G.stamp(['.h.', 'hhh'], 27, 5); G.stamp(['.h.', 'hhh'], 35, 5);
    G.ell(32, 31, 11, 7, 'P'); // 주둥이
    G.rect(28, 28, 2, 1, 'e'); G.rect(35, 28, 2, 1, 'e'); // 콧구멍
    G.ell(20, 41, 4, 3, 'b'); G.ell(44, 41, 4, 3, 'b'); // 발
    for (const x of [18, 20, 22, 42, 44, 46]) G.set(x, 43, 'h');
    face(G, mode, { lx: 25, rx: 39, ey: 18, mx: 32, my: 33, mw: 7, fire: true, cheek: true });
    return G.rows();
  }
  const dragonPal = { b: '#ff7a4a', L: '#ffa070', D: '#c8483a', P: '#ffd88a', w: '#e05a4a', h: '#fff0c8', e: '#2a1010', W: '#ffffff', p: '#ff4a6a', r: '#e8504a', y: '#ffe36a', f: '#ff8a2a' };
  B.push({
    name: '꼬마 불꽃 용', tag: '날개 달린 아기 용, 불을 뿜어요',
    spr: { idle: P.make(dragon('idle'), dragonPal, '#4a1208'), open: P.make(dragon('open'), dragonPal, '#4a1208'), hurt: P.make(dragon('hurt'), dragonPal, '#4a1208') },
    bul: { fan: bul('fire', '#ff6a1a', '#3a0a00', '#ffe36a'), spin: bul('fire', '#ffc02a', '#4a2a00', '#ffffff'), aim: bul('orb', '#e8203a', '#3a0008', '#ffb0a0'), rain: bul('drop', '#ff8a2a', '#3a1000', '#ffe36a') },
    patName: ['불꽃 부채꼴', '노란 불 빙글', '빨간 불덩이', '불똥 비'],
    sky: ['#6a5ab8', '#7c62bc', '#9a6ac0', '#c078be', '#e08ab8', '#f4a6b4'],
  });

  A.BOSSES = B;
  A.bossIconOf = function (i, k, mode) {
    const s = B[i].spr[mode || 'idle'], c = document.createElement('canvas');
    c.width = s.width * k; c.height = s.height * k;
    const g = c.getContext('2d'); g.imageSmoothingEnabled = false; g.drawImage(s, 0, 0, c.width, c.height);
    return c.toDataURL();
  };
  A.bulIcon = function (img, k) {
    const c = document.createElement('canvas'); c.width = img.width * k; c.height = img.height * k;
    const g = c.getContext('2d'); g.imageSmoothingEnabled = false; g.drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL();
  };
  }
})();
