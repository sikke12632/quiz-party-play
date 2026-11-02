/* props.js — 시대와 무관한 소품: 나무·덤불·구름·떠 있는 바위·새, 목각 인형의 몸
 * 시대팩은 모자·옷·소품만 얹는다(eras/시대/models.js). 모든 인형은 같은 얼굴·같은 몸이다.
 */
(function () {
  'use strict';
  const JK = window.JK;
  const T = THREE;
  const col = JK.col;

  /* ================= 나무 (인스턴싱, 잎은 인스턴스 색으로) ================= */
  JK.pineTree = function () {
    const b = new JK.Builder();
    const trunk = col('#8b5a3c'),
      leaf = col('#ffffff');
    b.ao(0, 0.5, 0.7);
    b.push().rz(0.12);
    b.cyl(0, 0, 0, 0.05, 0.035, 0.45, 5, trunk);
    b.pop();
    b.kind(3);
    b.ball(0.05, 0.45, 0, 0.26, 0, leaf, 0.42);
    b.ball(-0.12, 0.62, 0.04, 0.2, 0, leaf, 0.45);
    b.ball(0.08, 0.76, -0.02, 0.14, 0, leaf, 0.5);
    b.kind(0);
    return b.build();
  };
  JK.roundTree = function () {
    const b = new JK.Builder();
    const trunk = col('#8f6243'),
      leaf = col('#ffffff');
    b.ao(0, 0.4, 0.7);
    b.cyl(0, 0, 0, 0.045, 0.035, 0.3, 5, trunk);
    b.kind(3);
    b.ball(0, 0.46, 0, 0.24, 1, leaf, 0.9);
    b.kind(0);
    return b.build();
  };
  JK.bush = function () {
    const b = new JK.Builder();
    const leaf = col('#ffffff');
    b.ao(0, 0.2, 0.72);
    b.kind(3);
    b.ball(0, 0.07, 0, 0.11, 0, leaf, 0.75);
    b.ball(0.1, 0.05, 0.03, 0.08, 0, leaf, 0.75);
    b.ball(-0.08, 0.05, -0.04, 0.075, 0, leaf, 0.75);
    b.kind(0);
    return b.build();
  };
  // 구름 한 덩이: 둥근 공 몇 개를 겹친 부드러운 덩어리(매끈한 법선, 바닥은 납작)
  JK.cloudPuff = function () {
    const balls = [
      [0, 0, 0, 1],
      [0.95, -0.12, 0.15, 0.72],
      [-0.9, -0.15, -0.1, 0.7],
      [0.1, 0.12, -0.6, 0.68],
    ];
    const P = [],
      N = [];
    for (const [x, y, z, r] of balls) {
      const g = new T.IcosahedronGeometry(r, 1);
      const p = g.attributes.position;
      for (let i = 0; i < p.count; i++) {
        let px = p.getX(i),
          py = p.getY(i),
          pz = p.getZ(i);
        const l = Math.hypot(px, py, pz) || 1;
        let nx = px / l,
          ny = py / l,
          nz = pz / l;
        py += y;
        if (py < -0.25) {
          py = -0.25 + (py + 0.25) * 0.25;
          ny = ny * 0.4 - 0.6;
        }
        P.push(px + x, py, pz + z);
        N.push(nx, ny, nz);
      }
      g.dispose();
    }
    const geo = new T.BufferGeometry();
    geo.setAttribute('position', new T.Float32BufferAttribute(P, 3));
    geo.setAttribute('normal', new T.Float32BufferAttribute(N, 3));
    geo.computeBoundingSphere();
    return geo;
  };
  JK.islet = function () {
    const b = new JK.Builder();
    const g = col('#86b86b'),
      d = col('#9a7350'),
      d2 = col('#7b5a40');
    b.cyl(0, 0, 0, 0.5, 0.52, 0.08, 7, g, { top: g });
    b.cyl(0, -0.55, 0, 0.0, 0.5, 0.55, 7, [d, d2].length ? d : d2);
    b.ball(0.1, 0.12, 0.05, 0.14, 0, col('#5f9a5a'), 0.9);
    return b.build();
  };
  JK.bird = function () {
    const b = new JK.Builder();
    const c = col('#33343a');
    // 날개 끝이 y+ 쪽. y 크기를 흔들면 날갯짓이 된다
    b.tri([0, 0, 0.06], [-0.32, 0.12, -0.04], [0, 0, -0.06], c);
    b.tri([0, 0, -0.06], [-0.32, 0.12, -0.04], [0, 0, 0.06], c);
    b.tri([0, 0, -0.06], [0.32, 0.12, -0.04], [0, 0, 0.06], c);
    b.tri([0, 0, 0.06], [0.32, 0.12, -0.04], [0, 0, -0.06], c);
    b.box(0, 0, 0, 0.05, 0.04, 0.18, c);
    return b.build();
  };

  /* ================= 목각 인형 ================= */
  const WOOD = col('#e9c9a0');
  const WOOD2 = col('#dcb487');
  // 걷는 인형(작은 것): 몸은 옷 색으로 물드는 부분(종류 3)
  JK.walkerDoll = function () {
    const b = new JK.Builder();
    const cloth = col('#ffffff');
    const seg = 7;
    b.lathe(
      [
        [0.27, 0, cloth, 3],
        [0.3, 0.05, cloth, 3],
        [0.27, 0.32, cloth, 3],
        [0.22, 0.6, cloth, 3],
        [0.24, 0.68, cloth, 3],
        [0.18, 0.76, WOOD2, 0],
        [0.1, 0.8, WOOD2, 0],
        [0.0, 0.8, WOOD2, 0],
      ],
      seg
    );
    b.ball(0, 0.97, 0, 0.19, 1, WOOD);
    return b.build();
  };
  // 걷는 인형 모자: gat(갓) paeraengi(패랭이) topknot(상투) bun(쪽머리)
  // 초상화용 인형 몸: 몸통·얼굴·동정·소매·모은 손. 시대팩이 이 위에 모자·소품을 얹는다.
  JK.WOOD = WOOD;
  JK.dollBase = function (b, cloth, seg) {
    seg = seg || 20;
    const clothDark = cloth.clone().multiplyScalar(0.82);
    b.lathe(
      [
        [0.33, 0, clothDark],
        [0.36, 0.06, cloth],
        [0.33, 0.36, cloth],
        [0.26, 0.62, cloth],
        [0.28, 0.7, cloth],
        [0.2, 0.78, cloth],
        [0.11, 0.82, WOOD2],
        [0.0, 0.83, WOOD2],
      ],
      seg
    );
    // 머리와 얼굴 (모두 같은 얼굴)
    b.ball(0, 1.0, 0, 0.2, 3, WOOD);
    const eye = col('#2a1d16'),
      cheek = col('#e9928a');
    b.ball(-0.065, 1.01, 0.185, 0.02, 1, eye, 1.25);
    b.ball(0.065, 1.01, 0.185, 0.02, 1, eye, 1.25);
    b.ball(-0.11, 0.955, 0.155, 0.032, 1, cheek, 0.6);
    b.ball(0.11, 0.955, 0.155, 0.032, 1, cheek, 0.6);
    b.box(0, 0.935, 0.195, 0.04, 0.008, 0.01, col('#9a4a3a'));
    // 동정(흰 깃)
    b.cyl(0, 0.735, 0, 0.215, 0.14, 0.06, seg, col('#fbf7ee'));
    // 소매: 어깨에서 내려와 배 앞에서 모은 두 손
    for (const sx of [1, -1]) {
      b.cylAB([sx * 0.25, 0.7, 0.0], [sx * 0.2, 0.5, 0.2], 0.085, 0.1, 12, cloth);
      b.cylAB([sx * 0.2, 0.5, 0.2], [sx * 0.05, 0.47, 0.33], 0.1, 0.12, 12, cloth);
    }
    b.ball(0, 0.47, 0.37, 0.07, 1, WOOD, 0.75);
    return b;
  };
})();
