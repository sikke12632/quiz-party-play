/* paint.js — 여덟 번째 모드 「색칠 대작전」 규칙과 셈 (작업/결정-색칠.md). 화면 코드 없음: 선생님 화면·아이 화면·node 봇이 같이 쓴다.
 *
 * 판 흐름은 보물 지키기와 같다: 문제 per개(아이마다 따로) → 색칠(defend) 25초 → 결과(dres) → … M번 → 끝.
 * 미니게임: 한지 마당을 돌아다니며 붓으로 우리 팀 색을 칠한다. 남의 색 위에 덧칠할 수 있다(방해는 없음).
 *   걸음 = 직전 per문제 맞힌 수(0~5) → 기본 걸음의 1배~2배(0개도 움직임).
 *   칠한 칸이 PT.GMAX칸 모이면 「먹물 항아리」 → 누르면 내 둘레 반지름 PT.BR칸을 한 번에 칠함.
 *   판마다 칠한 넓이 % 순위로 점수(1등 10 · 2등 8 · 3등 6 · 4등 4, 같은 %면 같은 점수). 최종 = 점수 합 → 같으면 판 % 합. (2026-11-10 담임: 이긴 판 수 대신 합산 점수)
 *   맵: 판마다 바뀜(1판 빈 광장, 2판 상자 광장, 3판 연못 길 …).
 * 서버로 오가는 것: 아이 → b{r:미니게임, x:칸×3, y:칸×5, d:먹물 항아리 누른 수, k:0, h:0} (보스 슈팅 칸 그대로 → 서버 규칙 안 바꿈)
 *   선생님 화면(심판) → live.m(칠한 칸 글자 한 줄), pos, g(게이지 %), pc(팀 %), bm(항아리 터진 곳)
 */
(function (root) {
  'use strict';
  const QP = root.QP;

  QP.PAINT_CFG = {
    mode: 'paint',
    teams: 4, // 2~4팀(선생님이 고름)
    per: 5,
    M: 3,
    tQ: 20,
    tReveal: 4,
    tIntro: 3,
    tDefend: 25,
    tResult: 8,
    minutes: 99,
  };
  const PT = (QP.PT = {
    W: 64,
    H: 36,
    BASE: 2.4, // 기본 걸음(초당 칸)
    BRUSH: 1.0, // 붓 반지름(칸)
    GMAX: 80, // 먹물 항아리까지 칠할 칸 수(시안 110 → 판마다 한두 번은 쓰게)
    BR: 4, // 먹물 항아리 반지름(칸)
    HIDE: 3, // 마지막 몇 초는 TV에서 % 가림
  });
  // 팀 = 물감 색 = 동물 모자 색 (오방색: 적=여우, 청=토끼, 황=호랑이, 흑=판다). TEAM_ANIMALS 번호로
  QP.PAINT_ANIMALS = [3, 1, 0, 4];
  const COL = {
    여우: { col: '#d0402b', hi: '#ef7d62', dk: '#8a2212' },
    토끼: { col: '#2d63b0', hi: '#6c9fe2', dk: '#163a72' },
    호랑이: { col: '#e2a51a', hi: '#f8d56e', dk: '#9c6c08' },
    판다: { col: '#2e2c36', hi: '#666372', dk: '#0e0d12' },
  };
  QP.ptColor = (a) => COL[QP.TEAM_ANIMALS[a][0]] || COL.여우;
  QP.ptSpeed = (nOk) => PT.BASE * (1 + Math.max(0, Math.min(5, nOk | 0)) / 5);
  QP.ptLevel = (nOk) => Math.max(0, Math.min(5, nOk | 0));

  /* ---------- 맵: 0 바닥, 1 벽(서안·궤짝·연못) ---------- */
  const MAPS = ['a', 'b', 'c'];
  QP.PT_MAPNAME = { a: '빈 광장', b: '상자 광장', c: '연못 길' };
  QP.ptMapKey = (mg) => MAPS[mg % MAPS.length];
  const mapCache = {};
  QP.ptMap = function (key) {
    if (mapCache[key]) return mapCache[key];
    const { W, H } = PT;
    const wall = new Uint8Array(W * H);
    const setW = (x, y) => {
      if (x >= 0 && y >= 0 && x < W && y < H) wall[y * W + x] = 1;
    };
    // 위아래·좌우 똑같이(어느 팀 자리에서 시작해도 공평)
    const box = (x, y, w, h) => {
      for (let j = 0; j < h; j++)
        for (let i = 0; i < w; i++) {
          setW(x + i, y + j);
          setW(W - 1 - x - i, y + j);
          setW(x + i, H - 1 - y - j);
          setW(W - 1 - x - i, H - 1 - y - j);
        }
    };
    let pond = null;
    if (key === 'b') {
      box(12, 7, 4, 4);
      box(23, 4, 3, 3);
      box(28, 11, 4, 3);
      box(18, 15, 3, 3);
      box(8, 16, 3, 2);
      box(31, 1, 1, 4);
      box(5, 4, 2, 2);
    } else if (key === 'c') {
      const cx = W / 2 - 0.5,
        cy = H / 2 - 0.5;
      pond = new Uint8Array(W * H);
      for (let y = 0; y < H; y++)
        for (let x = 0; x < W; x++)
          if ((x - cx) ** 2 / 36 + (y - cy) ** 2 / 16 < 1) {
            setW(x, y);
            pond[y * W + x] = 1;
          }
      box(13, 7, 12, 1);
      box(13, 7, 1, 5);
      box(21, 0, 1, 4);
      box(5, 12, 4, 1);
    }
    let nFree = 0;
    for (let i = 0; i < wall.length; i++) if (!wall[i]) nFree++;
    const m = { key, W, H, wall, pond, nFree, free: (x, y) => x >= 0 && y >= 0 && x < W && y < H && !wall[y * W + x] };
    mapCache[key] = m;
    return m;
  };
  // 팀 시작 자리(네 귀퉁이) 둘레에 고르게
  const SPAWN = [
    [4, 4],
    [PT.W - 5, PT.H - 5],
    [PT.W - 5, 4],
    [4, PT.H - 5],
  ];
  // M(맵)을 주면 벽 속 자리는 가까운 빈 칸 가운데로 옮긴다
  // (상자 광장에서 팀마다 1~2명이 상자 속에서 시작해 한 판 내내 못 움직였다 — 2026-11-10 교실)
  QP.ptHome = function (team, k, n, M) {
    const s = SPAWN[team % 4];
    const a = (k / Math.max(1, n)) * Math.PI * 2;
    const r = n > 1 ? 1.6 : 0;
    const x = s[0] + 0.5 + Math.cos(a) * r,
      y = s[1] + 0.5 + Math.sin(a) * r * 0.8;
    if (!M || M.free(Math.floor(x), Math.floor(y))) return [x, y];
    let best = null;
    for (let cy = 0; cy < PT.H; cy++)
      for (let cx = 0; cx < PT.W; cx++) {
        if (!M.free(cx, cy)) continue;
        const d = (cx + 0.5 - x) ** 2 + (cy + 0.5 - y) ** 2;
        if (!best || d < best[2]) best = [cx + 0.5, cy + 0.5, d];
      }
    return best ? [best[0], best[1]] : [x, y];
  };
  // 벽에 막히며 걷기(가로·세로 따로)
  QP.ptMove = function (M, x, y, dx, dy, dist) {
    const L = Math.hypot(dx, dy);
    if (L < 1e-6 || dist <= 0) return [x, y];
    // 한 번에 0.4칸씩 나눠 걸어 벽을 뚫지 않게. 어쩌다 벽 속에 있으면 벽 속은 걸어 나올 수 있게(갇히지 않게)
    const ok = (cx, cy) => M.free(cx, cy) || !M.free(Math.floor(x), Math.floor(y));
    let left = dist;
    while (left > 1e-6) {
      const s = Math.min(0.4, left);
      left -= s;
      const nx = x + (dx / L) * s,
        ny = y + (dy / L) * s;
      if (ok(Math.floor(nx), Math.floor(y)) && nx > 0.3 && nx < PT.W - 0.3) x = nx;
      if (ok(Math.floor(x), Math.floor(ny)) && ny > 0.3 && ny < PT.H - 0.3) y = ny;
    }
    return [x, y];
  };
  // 친구 인형을 부드럽게 따라가기: 새 위치가 오면 FOLLOW_S 초 동안 같은 빠르기로 걸어간다.
  // (예전엔 새 위치 쪽으로 확 다가갔다 멈추기를 1초 3번 해서 뚝뚝 끊겨 보였다 — 2026-11-10 담임)
  // s = {x, y, f(걸음), dir} 를 고친다. 처음이면 그 자리에 둔다.
  const FOLLOW_S = 0.45;
  QP.ptFollow = function (s, tx, ty, dt) {
    if (s.tx !== tx || s.ty !== ty) {
      s.tx = tx;
      s.ty = ty;
      const d = Math.hypot(tx - s.x, ty - s.y);
      if (d > 6) {
        s.x = tx; // 너무 멀면(새로 고침 등) 바로 옮김
        s.y = ty;
        s.v = 0;
      } else s.v = d / FOLLOW_S;
    }
    const dx = s.tx - s.x,
      dy = s.ty - s.y,
      d = Math.hypot(dx, dy);
    if (d < 1e-4) return;
    const st = Math.min(d, (s.v || 0) * dt);
    if (Math.abs(dx) > 0.01) s.dir = dx > 0 ? 1 : -1;
    s.x += (dx / d) * st;
    s.y += (dy / d) * st;
    s.f += st * 2.2;
  };
  // 서버로 보낼 정수(규칙: 0~200)
  QP.ptEnc = (x, y) => [Math.max(0, Math.min(200, Math.round(x * 3))), Math.max(0, Math.min(200, Math.round(y * 5)))];
  QP.ptDec = (bx, by) => [bx / 3, by / 5];

  /* ---------- 칠한 칸 ---------- */
  class PaintBoard {
    constructor(M, nT) {
      this.M = M;
      this.nT = nT;
      this.p = new Int8Array(M.W * M.H).fill(-1);
      this.cnt = new Array(nT).fill(0);
    }
    // (cx, cy) 둘레 반지름 r 칸을 팀 t 색으로. 새로 칠한 칸 수(남의 색 덮은 것 포함)를 돌려준다. onCell(i) = 칠한 칸마다
    dab(cx, cy, r, t, onCell) {
      const M = this.M;
      let got = 0;
      const R = Math.ceil(r);
      const fx = Math.floor(cx),
        fy = Math.floor(cy);
      for (let y = fy - R; y <= fy + R; y++)
        for (let x = fx - R; x <= fx + R; x++) {
          if (!M.free(x, y) || (x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2 > r * r) continue;
          const i = y * M.W + x;
          if (this.p[i] === t) continue;
          if (this.p[i] >= 0) this.cnt[this.p[i]]--;
          this.p[i] = t;
          this.cnt[t]++;
          got++;
          if (onCell) onCell(i);
        }
      return got;
    }
    // 걸어간 길을 따라 붓질(붓끝은 발 앞 조금 아래)
    stroke(x0, y0, x1, y1, t, onCell) {
      const L = Math.hypot(x1 - x0, y1 - y0);
      const n = Math.max(1, Math.ceil(L / 0.35));
      let got = 0;
      for (let k = 0; k <= n; k++) {
        const u = k / n;
        got += this.dab(x0 + (x1 - x0) * u, y0 + (y1 - y0) * u + 0.3, PT.BRUSH, t, onCell);
      }
      return got;
    }
    pct() {
      return this.cnt.map((c) => (100 * c) / this.M.nFree);
    }
    // 서버로: 칸마다 한 글자('.' 안 칠함, '0'~'3' 팀)
    encode() {
      let s = '';
      for (let i = 0; i < this.p.length; i++) s += this.p[i] < 0 ? '.' : String(this.p[i]);
      return s;
    }
    decode(str) {
      if (!str || str.length !== this.p.length) return;
      this.cnt.fill(0);
      for (let i = 0; i < str.length; i++) {
        const c = str.charCodeAt(i) - 48;
        this.p[i] = c >= 0 && c < 10 ? c : -1;
        if (c >= 0 && c < this.nT) this.cnt[c]++;
      }
    }
  }
  QP.PaintBoard = PaintBoard;

  // 판 결과: 가장 높은 %인 팀(들)이 1승
  // 판 점수: 칠한 % 순위대로 (같은 %면 같은 등수·같은 점수, 하나도 못 칠하면 0점)
  QP.PT_POINTS = [10, 8, 6, 4];
  QP.ptRanks = function (pc) {
    return pc.map((v) => 1 + pc.filter((w) => w > v + 1e-9).length);
  };
  QP.ptRoundPts = function (pc) {
    const rk = QP.ptRanks(pc);
    return pc.map((v, t) => (v > 0 ? QP.PT_POINTS[rk[t] - 1] || 2 : 0));
  };
  QP.ptWinners = function (pc) {
    const best = Math.max(...pc);
    if (best <= 0) return [];
    return pc.map((v, t) => (Math.abs(v - best) < 1e-9 ? t : -1)).filter((t) => t >= 0);
  };

  /* ---------- 봇(가짜 친구): 가까운 곳 중 우리 색이 아닌 칸으로 걷고, 게이지가 차면 항아리 ---------- */
  QP.ptBotPlay = function (c) {
    const L = c.game && c.game.live;
    if (!L || L.kind !== 'paint' || c.phase !== 'defend' || !c.seat) return;
    const now = c.net.now();
    const g = (now - L.t0) / QP.ms(1);
    if (g < 0 || g > L.dur) return;
    const M = QP.ptMap(L.map);
    const team = c.seat.team;
    let B = c._pt;
    if (!B || B.mg !== L.mg) {
      const p0 = (L.pos && L.pos[c.seat.sid]) || [40, 40];
      B = c._pt = { mg: L.mg, x: p0[0] / 10, y: p0[1] / 10, tx: 0, ty: 0, re: 0, last: g, bombs: 0, board: new PaintBoard(M, 4), r: Math.random };
    }
    B.board.decode(L.m);
    if (g - B.last < 0.34) return; // 1초 3번까지
    const dt = Math.min(0.5, Math.max(0, g - B.last));
    B.last = g;
    B.re -= dt;
    if (B.re <= 0 || Math.hypot(B.tx - B.x, B.ty - B.y) < 0.6) {
      let best = null,
        bs = -1e9;
      for (let n = 0; n < 24; n++) {
        const x = Math.floor(B.r() * M.W),
          y = Math.floor(B.r() * M.H);
        if (!M.free(x, y)) continue;
        const own = B.board.p[y * M.W + x];
        const s = (own === team ? -30 : own >= 0 ? 6 : 10) - Math.hypot(x - B.x, y - B.y) * 0.6 + B.r() * 8;
        if (s > bs) (bs = s), (best = [x + 0.5, y + 0.5]);
      }
      if (best) (B.tx = best[0]), (B.ty = best[1]);
      B.re = 1.2 + B.r() * 1.5;
    }
    const sp = (L.sp && L.sp[c.seat.sid]) || PT.BASE;
    const [nx, ny] = QP.ptMove(M, B.x, B.y, B.tx - B.x, B.ty - B.y, sp * dt);
    if (Math.hypot(nx - B.x, ny - B.y) < sp * dt * 0.3) B.re = 0;
    B.x = nx;
    B.y = ny;
    if (((L.g && L.g[c.seat.sid]) || 0) >= 100 && B.r() < 0.5) B.bombs++;
    const [bx, by] = QP.ptEnc(B.x, B.y);
    c.write({ b: { r: L.mg, x: bx, y: by, d: B.bombs, k: 0, h: 0 } });
  };
})(typeof window !== 'undefined' ? window : globalThis);
