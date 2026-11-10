/* paint-art.js — 「색칠 대작전」 그림 (QP.PaintArt). 아이 화면·TV가 같이 쓴다. pixel-art.js 뒤에.
 * 한지 바닥 + 나무 서안·궤짝 + 연못, 두껍게 바른 물감 칸, 한국 붓을 쥔 도트 아이, 먹물 항아리 「철퍼덕!」.
 * 칸 크기 C=18px 그림판(64×36칸 = 1152×648)을 화면 크기에 맞춰 키운다. 칠한 칸은 바뀐 칸만 다시 그린다.
 */
(function () {
  'use strict';
  const QP = window.QP,
    PX = window.PX;
  const PT = QP.PT;
  const C = 18;
  const hash = (x, y, k) => {
    let h = (x * 374761393 + y * 668265263 + k * 2147483647) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  };

  // 바닥(한지·서안·연못) — 맵마다 한 번
  const floors = {};
  function floor(M) {
    if (floors[M.key]) return floors[M.key];
    const cv = document.createElement('canvas');
    cv.width = M.W * C;
    cv.height = M.H * C;
    const f = cv.getContext('2d');
    f.fillStyle = '#eee2c6';
    f.fillRect(0, 0, cv.width, cv.height);
    for (let n = 0; n < 1100; n++) {
      const x = Math.floor(hash(n, 1, 3) * cv.width),
        y = Math.floor(hash(n, 2, 5) * cv.height),
        L = 2 + Math.floor(hash(n, 3, 7) * 7);
      f.fillStyle = hash(n, 4, 9) < 0.5 ? '#e7dabb' : '#f4ead3';
      if (hash(n, 5, 1) < 0.5) f.fillRect(x, y, L, 1);
      else f.fillRect(x, y, 1, L);
    }
    for (let n = 0; n < 160; n++) {
      f.fillStyle = '#ddcca8';
      f.fillRect(Math.floor(hash(n, 6, 2) * cv.width), Math.floor(hash(n, 7, 4) * cv.height), 2, 2);
    }
    const W = M.W;
    for (let y = 0; y < M.H; y++)
      for (let x = 0; x < W; x++) {
        if (!M.wall[y * W + x]) continue;
        const X = x * C,
          Y = y * C;
        if (M.pond && M.pond[y * W + x]) {
          const edge = !M.wall[(y - 1) * W + x] || !M.wall[(y + 1) * W + x] || !M.wall[y * W + x - 1] || !M.wall[y * W + x + 1];
          if (edge) {
            f.fillStyle = '#8a8a80';
            f.fillRect(X, Y, C, C);
            f.fillStyle = '#a8a89c';
            f.fillRect(X + 2, Y + 2, C - 6, C - 8);
            continue;
          }
          f.fillStyle = '#4f8fb0';
          f.fillRect(X, Y, C, C);
          f.fillStyle = '#6fb0cc';
          if (hash(x, y, 1) < 0.4) f.fillRect(X + 3, Y + 6, 8, 2);
          if (hash(x, y, 2) < 0.1) {
            f.fillStyle = '#5f9a55';
            f.fillRect(X + 3, Y + 3, 12, 10);
            f.fillStyle = '#f2a6ad';
            f.fillRect(X + 7, Y + 5, 4, 4);
          }
        } else {
          f.fillStyle = '#7a5232';
          f.fillRect(X, Y, C, C);
          f.fillStyle = '#946640';
          f.fillRect(X, Y, C, 5);
          f.fillStyle = '#5e3c22';
          f.fillRect(X, Y + 9 + Math.floor(hash(x, y, 3) * 4), C, 1);
          f.fillStyle = '#3e2715';
          f.fillRect(X, Y + C - 3, C, 3);
        }
      }
    floors[M.key] = cv;
    return cv;
  }

  /* 칠한 칸 그림판: layer(M, cols) → { cv, sync(board) 바뀐 칸만, wet 반짝임 } */
  function layer(M, cols) {
    const cv = document.createElement('canvas');
    cv.width = M.W * C;
    cv.height = M.H * C;
    const g = cv.getContext('2d');
    const fl = floor(M);
    g.drawImage(fl, 0, 0);
    const shown = new Int8Array(M.W * M.H).fill(-1);
    const W = M.W;
    function cell(p, x, y) {
      const i = y * W + x;
      const t = p[i];
      const X = x * C,
        Y = y * C;
      g.drawImage(fl, X, Y, C, C, X, Y, C, C);
      if (t < 0 || !cols[t]) return;
      const T = cols[t];
      const same = (a, b) => M.free(a, b) && p[b * W + a] === t;
      const u = same(x, y - 1),
        d = same(x, y + 1),
        l = same(x - 1, y),
        rr = same(x + 1, y);
      const tl = !u && !l ? 4 : 0,
        tr = !u && !rr ? 4 : 0,
        bl = !d && !l ? 4 : 0,
        br = !d && !rr ? 4 : 0;
      g.fillStyle = T.col;
      g.fillRect(X + tl, Y, C - tl - tr, 4);
      g.fillRect(X, Y + 4, C, C - 8);
      g.fillRect(X + bl, Y + C - 4, C - bl - br, 4);
      if (tl) g.fillRect(X + 2, Y + 2, 2, 2);
      if (tr) g.fillRect(X + C - 4, Y + 2, 2, 2);
      if (bl) g.fillRect(X + 2, Y + C - 4, 2, 2);
      if (br) g.fillRect(X + C - 4, Y + C - 4, 2, 2);
      g.fillStyle = T.hi;
      if (!u) g.fillRect(X + (tl ? 4 : 0), Y + 2, C - (tl ? 4 : 0) - (tr ? 4 : 0), 2);
      g.globalAlpha = 0.22;
      g.fillRect(X, Y + 9, C, 1);
      g.fillRect(X, Y + 14, C, 1);
      g.globalAlpha = 1;
      g.fillStyle = T.dk;
      if (!d) g.fillRect(X + (bl ? 4 : 0), Y + C - 3, C - (bl ? 4 : 0) - (br ? 4 : 0), 3);
    }
    const wet = new Map(); // 칸 → 막 칠한 때(ms)
    return {
      cv,
      // p = 칸마다 팀(-1 = 안 칠함). 바뀐 칸과 그 옆 칸(모서리 모양)만 다시 그린다
      sync(p, now) {
        const dirty = new Set();
        for (let i = 0; i < p.length; i++) {
          if (p[i] === shown[i]) continue;
          if (p[i] >= 0) wet.set(i, now || 0);
          shown[i] = p[i];
          const x = i % W,
            y = (i / W) | 0;
          dirty.add(i);
          if (x > 0) dirty.add(i - 1);
          if (x < W - 1) dirty.add(i + 1);
          if (y > 0) dirty.add(i - W);
          if (y < M.H - 1) dirty.add(i + W);
        }
        for (const i of dirty) if (M.free(i % W, (i / W) | 0)) cell(p, i % W, (i / W) | 0);
        return dirty.size;
      },
      // 막 칠한 칸 반짝임(그림판 위에 덧그림)
      drawWet(dst, now) {
        dst.fillStyle = '#fff';
        for (const [i, t0] of wet) {
          const a = 1 - (now - t0) / 400;
          if (a <= 0) {
            wet.delete(i);
            continue;
          }
          dst.globalAlpha = a * 0.5;
          dst.fillRect((i % W) * C + 4, ((i / W) | 0) * C + 4, 6, 2);
        }
        dst.globalAlpha = 1;
      },
    };
  }

  // 한국 붓(대나무 자루 + 팀 물감 붓털) — 아이 그림과 같은 도트 크기
  const BRUSH_ROWS = ['h.......', 'hh......', '.hh.....', '..hh....', '...bw...', '...wtt..', '....ttt.', '....tTT.', '.....TT.'];
  const brushes = new Map();
  const brushOf = (T) => {
    if (!brushes.has(T.col)) brushes.set(T.col, PX.make(BRUSH_ROWS, { h: '#d8b46a', b: '#8a6a34', w: '#f4ecda', t: T.col, T: T.dk }, '#3a2a20'));
    return brushes.get(T.col);
  };
  // 아이 한 명: k = {x, y, f(걸음), dir, an(동물), cl, col(팀 물감), me, full(항아리 준비), nick}
  function kid(g, k, now) {
    const fr = PX.kid(k.an, k.cl || 0)[Math.floor(k.f) % 4],
      s = 2;
    const X = Math.round(k.x * C),
      Y = Math.round(k.y * C);
    g.fillStyle = 'rgba(40,25,10,.25)';
    g.fillRect(X - 10, Y + 7, 20, 4);
    if (k.me) {
      // 내 인형: 발밑에 노란 고리(숨 쉬듯 커졌다 작아짐) — 같은 팀 친구와 헷갈리지 않게 (2026-11-10 담임)
      const pr = 1 + 0.12 * Math.sin(now / 160);
      g.lineWidth = 6;
      g.strokeStyle = '#1a120b';
      g.beginPath();
      g.ellipse(X, Y + 8, 24 * pr, 11 * pr, 0, 0, 6.283);
      g.stroke();
      g.lineWidth = 4;
      g.strokeStyle = '#ffe36a';
      g.stroke();
    }
    g.save();
    g.translate(X, Y - fr.height * s + 10);
    if (k.dir < 0) g.scale(-1, 1);
    g.imageSmoothingEnabled = false;
    g.drawImage(fr, (-fr.width * s) / 2, 0, fr.width * s, fr.height * s);
    const up = Math.floor(k.f) % 2,
      B = brushOf(k.col);
    g.drawImage(B, (-fr.width / 2 + 11 - up) * s, (11 - up) * s, B.width * s, B.height * s);
    g.fillStyle = '#3a2a20';
    g.fillRect((-fr.width / 2 + 11) * s, 12 * s, 3 * s, 3 * s);
    g.fillStyle = '#f1d5ad';
    g.fillRect((-fr.width / 2 + 12) * s, 13 * s, s, s);
    g.restore();
    const top = Y - fr.height * s + 10;
    if (k.full) {
      g.fillStyle = k.col.hi;
      g.fillRect(X - 4, top - 10 - (Math.floor(now / 200) % 2) * 3, 8, 8);
      g.fillStyle = '#1a120b';
      g.fillRect(X - 4, top - 10 - (Math.floor(now / 200) % 2) * 3, 8, 2);
    }
    if (k.me) {
      // 머리 위 통통 튀는 화살표 + 「나」(항아리 표시보다 위에)
      const by = top - 16 - Math.abs(Math.sin(now / 220)) * 6;
      g.fillStyle = '#ffe36a';
      g.strokeStyle = '#1a120b';
      g.lineWidth = 3;
      g.beginPath();
      g.moveTo(X - 11, by - 11);
      g.lineTo(X + 11, by - 11);
      g.lineTo(X, by);
      g.closePath();
      g.stroke();
      g.fill();
      g.font = '28px QPTitle';
      g.textAlign = 'center';
      g.lineWidth = 5;
      g.strokeText('나', X, by - 15);
      g.fillText('나', X, by - 15);
    }
  }
  // 먹물 항아리 「철퍼덕!」: b = {x, y, t0(ms)}, col
  function splat(g, b, col, now) {
    const a = (now - b.t0) / 1000;
    if (a < 0 || a > 0.8) return false;
    const R = Math.min(1, a / 0.3) * PT.BR * C;
    g.globalAlpha = Math.max(0, 1 - a / 0.8);
    g.fillStyle = col.hi;
    for (let n = 0; n < 14; n++) {
      const an = (n / 14) * 6.283 + b.x,
        q = R * (0.85 + 0.35 * hash(n, Math.floor(b.x * 7), 3));
      g.fillRect(Math.round(b.x * C + Math.cos(an) * q) - 5, Math.round(b.y * C + Math.sin(an) * q) - 5, 10, 10);
    }
    g.globalAlpha = 1;
    if (a < 0.6) {
      g.font = '32px QPTitle';
      g.textAlign = 'center';
      g.fillStyle = col.hi;
      g.strokeStyle = '#1a120b';
      g.lineWidth = 6;
      const yy = b.y * C - 34 - a * 50;
      g.strokeText('철퍼덕!', b.x * C, yy);
      g.fillText('철퍼덕!', b.x * C, yy);
    }
    return true;
  }
  QP.PaintArt = { C, floor, layer, kid, splat, brushOf };
})();
