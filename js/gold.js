/* gold.js — 보물 상자·금화·금 더미 (황금 찾기 모드)
 * 금은 반짝여야 하므로 빛을 되비치는 재질(JK.GOLD_MAT)을 따로 쓴다.
 */
(function () {
  'use strict';
  const JK = window.JK;
  const T = THREE;
  const col = JK.col;
  const K = JK.kit2;

  JK.GOLD_MAT = new T.MeshPhongMaterial({ vertexColors: true, flatShading: true, shininess: 60, specular: new T.Color('#fff2c0'), emissive: new T.Color('#3a2400') });

  const GOLD = col('#f2c14e'),
    GOLD_HI = col('#ffe08a'),
    GOLD_DK = col('#c8902a');

  // 보물 상자: { body, lid } — lid는 경첩(뒤 위 모서리)이 원점, rotation.x 를 음수로 하면 열린다
  JK.chest = function (paint) {
    const W = 0.8,
      D = 0.56,
      H = 0.42,
      R = D / 2;
    const wood = col(paint || '#b8743f'),
      woodDk = wood.clone().multiplyScalar(0.72),
      band = GOLD_DK,
      inside = col('#4a2c1a');
    const b = new JK.Builder();
    b.ao(0, H, 0.75);
    b.box(0, H / 2, 0, W, H, D, wood, { top: inside });
    // 널빤지 줄
    for (const y of [0.14, 0.28]) b.box(0, y, D / 2 + 0.003, W - 0.02, 0.012, 0.01, woodDk);
    // 금 띠·모서리
    for (const sx of [-1, 1]) {
      b.box(sx * 0.27, H / 2, 0, 0.07, H + 0.01, D + 0.02, band, { top: band });
      b.box(sx * (W / 2), H / 2, 0, 0.03, H + 0.02, D + 0.03, GOLD, { top: GOLD });
    }
    b.box(0, 0.015, 0, W + 0.04, 0.03, D + 0.04, woodDk);
    // 자물쇠 판
    b.box(0, H - 0.05, D / 2 + 0.02, 0.13, 0.15, 0.03, GOLD, { top: GOLD });
    b.box(0, H - 0.07, D / 2 + 0.037, 0.03, 0.05, 0.01, col('#3a2414'));
    b.ao(0, 0, 1);
    // 안의 금 (뚜껑이 열리면 보인다)
    b.ball(0, H - 0.03, 0, 0.27, 1, GOLD_HI, 0.45);
    const rng = JK.rng(9);
    for (let i = 0; i < 7; i++) {
      const x = (rng() - 0.5) * 0.5,
        z = (rng() - 0.5) * 0.3;
      b.push().t(x, H + 0.06 - Math.abs(x) * 0.12, z).rx((rng() - 0.5) * 0.9).rz((rng() - 0.5) * 0.9);
      b.cyl(0, 0, 0, 0.07, 0.07, 0.02, 8, GOLD_DK, { top: GOLD });
      b.pop();
    }
    b.ball(0.08, H + 0.1, 0.02, 0.045, 0, col('#e2475a'), 1.3);
    b.ball(-0.12, H + 0.08, -0.04, 0.04, 0, col('#3fa7e0'), 1.3);
    const body = b.build();

    const L = new JK.Builder();
    const SEG = 9;
    const arc = (t, r) => [R - Math.cos(t) * r, Math.sin(t) * r * 0.78]; // [z, y] (경첩 기준, z는 앞으로)
    const lidQuad = (x0, x1, r, c) => {
      for (let i = 0; i < SEG; i++) {
        const t0 = (i / SEG) * Math.PI,
          t1 = ((i + 1) / SEG) * Math.PI;
        const a = arc(t0, r),
          bb = arc(t1, r);
        L.quad([x1, a[1], a[0]], [x1, bb[1], bb[0]], [x0, bb[1], bb[0]], [x0, a[1], a[0]], c);
      }
    };
    lidQuad(-W / 2, W / 2, R + 0.005, wood);
    for (const sx of [-1, 1]) {
      // 옆 마구리
      for (let i = 0; i < SEG; i++) {
        const t0 = (i / SEG) * Math.PI,
          t1 = ((i + 1) / SEG) * Math.PI;
        const a = arc(t0, R + 0.005),
          bb = arc(t1, R + 0.005);
        const x = sx * (W / 2);
        if (sx > 0) L.tri([x, 0, R], [x, a[1], a[0]], [x, bb[1], bb[0]], wood);
        else L.tri([x, 0, R], [x, bb[1], bb[0]], [x, a[1], a[0]], wood);
      }
      lidQuad(sx * 0.27 - 0.035, sx * 0.27 + 0.035, R + 0.02, band);
      lidQuad(sx * (W / 2) - 0.015 * sx - 0.015, sx * (W / 2) - 0.015 * sx + 0.015, R + 0.025, GOLD);
    }
    // 뚜껑 밑면(안쪽)
    L.quad([-W / 2, 0.001, 0], [W / 2, 0.001, 0], [W / 2, 0.001, D], [-W / 2, 0.001, D], wood.clone().multiplyScalar(0.55));
    // 뚜껑 앞 걸쇠
    L.box(0, 0.04, D + 0.02, 0.1, 0.09, 0.03, GOLD, { top: GOLD });
    const lid = L.build();
    return { body, lid, H, D };
  };
  // 상자를 장면에 놓는다. 돌려주는 group.userData.open(0~1)
  JK.chestGroup = function (paint) {
    const c = JK.chest(paint);
    const g = new T.Group();
    g.add(K.mesh(c.body, JK.MAT));
    const hinge = new T.Group();
    hinge.position.set(0, c.H, -c.D / 2);
    const lid = K.mesh(c.lid, K.MATD);
    hinge.add(lid);
    g.add(hinge);
    g.userData.setOpen = (t) => (hinge.rotation.x = -t * 1.9);
    g.userData.hinge = hinge;
    return g;
  };

  // 금화 한 닢 (y축이 두께)
  JK.coin = function () {
    const b = new JK.Builder();
    b.cyl(0, 0, 0, 0.1, 0.1, 0.028, 12, GOLD_DK, { top: GOLD, bottom: true });
    b.cyl(0, 0.028, 0, 0.065, 0.065, 0.006, 12, GOLD_HI, { top: GOLD_HI });
    return b.build();
  };

  // 금 더미: 둥근 무더기 + 위에 흩어진 금화 + 보석
  JK.goldPile = function (seed, size) {
    const rng = JK.rng(seed || 1);
    const s = size || 1;
    const b = new JK.Builder();
    b.ao(0, 0.6 * s, 0.7);
    b.ball(0, 0, 0, 1.0 * s, 2, (a) => (rng() < 0.5 ? GOLD : GOLD_HI), 0.42);
    b.ball(0.45 * s, 0, 0.25 * s, 0.6 * s, 1, GOLD, 0.45);
    b.ball(-0.5 * s, 0, 0.1 * s, 0.55 * s, 1, GOLD_HI, 0.4);
    b.ao(0, 0, 1);
    for (let i = 0; i < 46; i++) {
      const u = rng() * Math.PI * 2,
        r = Math.sqrt(rng()) * 1.05 * s;
      const x = Math.cos(u) * r,
        z = Math.sin(u) * r;
      const y = Math.max(0, 0.42 * s * Math.sqrt(Math.max(0, 1 - (r / (1.02 * s)) ** 2))) + 0.01;
      b.push().t(x, y, z).rx((rng() - 0.5) * 1.2).rz((rng() - 0.5) * 1.2);
      b.cyl(0, 0, 0, 0.1, 0.1, 0.028, 10, GOLD_DK, { top: rng() < 0.5 ? GOLD : GOLD_HI, bottom: true });
      b.pop();
    }
    const GEMS = ['#e2475a', '#3fa7e0', '#5fd08a', '#b06ae0'];
    for (let i = 0; i < 7; i++) {
      const u = rng() * Math.PI * 2,
        r = rng() * 0.8 * s;
      const x = Math.cos(u) * r,
        z = Math.sin(u) * r;
      const y = 0.4 * s * Math.sqrt(Math.max(0, 1 - (r / (1.02 * s)) ** 2)) + 0.03;
      b.ball(x, y, z, 0.07 + rng() * 0.04, 0, col(GEMS[i % 4]), 1.3);
    }
    return b.build();
  };
})();
