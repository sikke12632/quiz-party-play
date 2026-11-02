/* rig.js — 움직이는 인형: 팔(소매+손)과 얼굴(눈·눈썹·입)을 따로 떼어 춤과 표정을 짓는다.
 * TV(단상·시상대)에서만 쓴다. 가만히 서 있는 인형(모이는 곳)은 dolls.js의 한 덩어리 인형을 그대로 쓴다.
 *
 *   const r = JK.makeRig(아바타번호);  scene.add(r);
 *   r.userData.pose('cheer');   // 팔: rest cheer wave clap spin sway droop wow
 *   r.userData.face('happy');   // 얼굴: normal joy happy wow sad sleepy
 *   r.userData.update(시간, dt) // 매 장면마다
 */
(function () {
  'use strict';
  const JK = window.JK;
  const T = THREE;
  const col = JK.col;
  const K = JK.kit2;
  const WOOD = JK.WOOD,
    WOOD2 = col('#dcb487');
  const HY = 1.0,
    HR = 0.2; // 머리 가운데 높이, 반지름
  const zOn = (x, y) => Math.sqrt(Math.max(0, HR * HR - x * x - (y - HY) * (y - HY))) + 0.004;

  /* ---------- 몸(팔·눈·입 없이) ---------- */
  const bodyCache = new Map();
  function bodyGeo(avatarIdx) {
    if (bodyCache.has(avatarIdx)) return bodyCache.get(avatarIdx);
    const { animal, cloth } = JK.avatarOf(avatarIdx);
    const c = col(cloth),
      seg = 18;
    const b = new JK.Builder();
    b.lathe(
      [
        [0.33, 0, c.clone().multiplyScalar(0.82)],
        [0.36, 0.06, c],
        [0.33, 0.36, c],
        [0.26, 0.62, c],
        [0.28, 0.7, c],
        [0.2, 0.78, c],
        [0.11, 0.82, WOOD2],
        [0.0, 0.83, WOOD2],
      ],
      seg
    );
    b.ball(0, HY, 0, HR, 3, WOOD);
    const cheek = col('#e9928a');
    b.ball(-0.11, 0.955, 0.155, 0.032, 1, cheek, 0.6);
    b.ball(0.11, 0.955, 0.155, 0.032, 1, cheek, 0.6);
    b.cyl(0, 0.735, 0, 0.215, 0.14, 0.06, seg, col('#fbf7ee'));
    // 어깨 동그랗게 (팔이 붙는 자리)
    for (const sx of [-1, 1]) b.ball(sx * 0.24, 0.69, 0, 0.085, 1, c);
    animal.build(b, col(animal.hood));
    const g = b.build();
    bodyCache.set(avatarIdx, g);
    return g;
  }
  /* ---------- 팔: 어깨에서 아래(-y)로 뻗은 소매 + 손 ---------- */
  const armCache = new Map();
  function armGeo(cloth) {
    if (armCache.has(cloth)) return armCache.get(cloth);
    const c = col(cloth);
    const b = new JK.Builder();
    b.cyl(0, -0.36, 0, 0.115, 0.08, 0.36, 10, c, { bottom: true });
    b.cyl(0, -0.37, 0, 0.1, 0.1, 0.012, 10, c.clone().multiplyScalar(0.8));
    b.ball(0, -0.42, 0, 0.062, 1, WOOD, 1.05);
    const g = b.build();
    armCache.set(cloth, g);
    return g;
  }

  /* ---------- 얼굴 조각 (모든 인형이 같이 쓴다) ---------- */
  const INK = col('#2a1d16'),
    LIP = col('#9a4a3a'),
    MOUTH = col('#6e2a26'),
    TONGUE = col('#e6858a'),
    WHITE = col('#ffffff');
  function arc(b, cx, cy, R, rr, a0, a1, seg, color) {
    let prev = null;
    for (let i = 0; i <= seg; i++) {
      const a = a0 + ((a1 - a0) * i) / seg;
      const x = cx + Math.cos(a) * R,
        y = cy + Math.sin(a) * R;
      const p = [x, y, zOn(x, y)];
      if (prev) b.cylAB(prev, p, rr, rr, 5, color);
      prev = p;
    }
  }
  let FACE = null;
  function faceGeos() {
    if (FACE) return FACE;
    const mk = (fn) => {
      const b = new JK.Builder();
      fn(b);
      return b.build();
    };
    const EX = 0.065,
      EY = 1.01;
    FACE = {
      // 눈
      dot: mk((b) => {
        for (const sx of [-1, 1]) b.ball(sx * EX, EY, zOn(sx * EX, EY) - 0.006, 0.021, 1, INK, 1.3);
      }),
      wide: mk((b) => {
        for (const sx of [-1, 1]) {
          b.ball(sx * EX, EY + 0.005, zOn(sx * EX, EY) - 0.008, 0.03, 1, INK, 1.15);
          b.ball(sx * EX + 0.01, EY + 0.017, zOn(sx * EX, EY) + 0.016, 0.009, 0, WHITE);
        }
      }),
      happyEye: mk((b) => {
        for (const sx of [-1, 1]) arc(b, sx * EX, EY - 0.012, 0.024, 0.0075, 0.15, Math.PI - 0.15, 6, INK);
      }),
      sleepyEye: mk((b) => {
        for (const sx of [-1, 1]) arc(b, sx * EX, EY + 0.02, 0.024, 0.0065, Math.PI + 0.4, Math.PI * 2 - 0.4, 5, INK);
      }),
      sadBrow: mk((b) => {
        for (const sx of [-1, 1]) {
          const x0 = sx * 0.03,
            x1 = sx * 0.095;
          b.cylAB([x0, 1.065, zOn(x0, 1.065)], [x1, 1.045, zOn(x1, 1.045)], 0.007, 0.007, 5, INK);
        }
      }),
      // 입
      smile: mk((b) => arc(b, 0, 0.958, 0.03, 0.0065, Math.PI + 0.55, Math.PI * 2 - 0.55, 6, LIP)),
      open: mk((b) => {
        // 아래로 둥근 D 모양 + 혀
        const cy = 0.952,
          R = 0.04,
          n = 10;
        for (let i = 0; i < n; i++) {
          const a0 = Math.PI + (Math.PI * i) / n,
            a1 = Math.PI + (Math.PI * (i + 1)) / n;
          const p = (a, r) => {
            const x = Math.cos(a) * r,
              y = cy + Math.sin(a) * r;
            return [x, y, zOn(x, y) + 0.002];
          };
          b.tri([0, cy, zOn(0, cy) + 0.002], p(a0, R), p(a1, R), MOUTH);
        }
        b.ball(0, cy - 0.026, zOn(0, cy - 0.026) - 0.002, 0.016, 1, TONGUE, 0.6);
      }),
      oh: mk((b) => {
        b.push().t(0, 0.945, zOn(0, 0.945) - 0.004).s(1, 1.25, 0.5);
        b.ball(0, 0, 0, 0.02, 1, MOUTH);
        b.pop();
      }),
      frown: mk((b) => arc(b, 0, 0.928, 0.026, 0.0065, 0.6, Math.PI - 0.6, 6, LIP)),
    };
    return FACE;
  }
  const FACES = {
    normal: ['dot', 'smile'],
    joy: ['happyEye', 'smile'],
    happy: ['happyEye', 'open'],
    wow: ['wide', 'oh'],
    sad: ['dot', 'frown', 'sadBrow'],
    sleepy: ['sleepyEye', 'smile'],
    shout: ['wide', 'open'],
  };

  /* ---------- 팔 자세: 오른팔 방향(어깨에서 손 쪽). 왼팔은 x를 뒤집는다 ---------- */
  const V = (x, y, z) => new T.Vector3(x, y, z).normalize();
  const POSE = {
    rest: (t) => [V(-0.45, -0.52, 0.75), V(-0.45, -0.52, 0.75)],
    cheer: (t) => {
      const k = Math.abs(Math.sin(t * 5));
      return [V(0.35, 0.6 + k * 0.5, 0.15 - k * 0.1), V(0.35, 0.6 + Math.abs(Math.sin(t * 5 + 1.2)) * 0.5, 0.15)];
    },
    wave: (t) => [V(0.55 + Math.sin(t * 7) * 0.45, 1, 0.25), V(-0.45, -0.52, 0.75)],
    clap: (t) => {
      const k = (Math.sin(t * 9) + 1) / 2;
      const d = V(0.35 - k * 0.6, -0.05, 1);
      return [d, d.clone()];
    },
    spin: (t) => [V(1, 0.15 + Math.sin(t * 6) * 0.25, 0), V(1, 0.15 - Math.sin(t * 6) * 0.25, 0)],
    sway: (t) => {
      const s = Math.sin(t * 2.8);
      return [V(0.25 + s * 0.5, 1, 0.1), V(0.25 - s * 0.5, 1, 0.1)];
    },
    droop: (t) => [V(0.1, -1, 0.08), V(0.1, -1, 0.08)],
    wow: (t) => [V(0.8, 0.75, 0.3), V(0.8, 0.75, 0.3)],
  };
  const DOWN = new T.Vector3(0, -1, 0);

  JK.makeRig = function (avatarIdx) {
    const { cloth } = JK.avatarOf(avatarIdx);
    const g = new T.Group();
    g.add(K.mesh(bodyGeo(avatarIdx), JK.MAT));
    const arms = [-1, 1].map((sx) => {
      const p = new T.Group();
      p.position.set(sx * 0.25, 0.71, 0.0);
      p.add(K.mesh(armGeo(cloth), JK.MAT));
      g.add(p);
      return { p, sx, q: new T.Quaternion() };
    });
    const F = faceGeos();
    const parts = {};
    for (const k of Object.keys(F)) {
      const m = K.mesh(F[k], K.MATD, false, false);
      m.visible = false;
      g.add(m);
      parts[k] = m;
    }
    let pose = 'rest',
      face = 'normal',
      blink = 2 + Math.random() * 3;
    const _q = new T.Quaternion();
    const setFace = (f) => {
      face = FACES[f] ? f : 'normal';
      for (const k in parts) parts[k].visible = FACES[face].includes(k);
    };
    setFace('normal');
    g.userData.pose = (p) => (pose = POSE[p] ? p : 'rest');
    g.userData.face = setFace;
    g.userData.update = (t, dt) => {
      const dirs = POSE[pose](t);
      arms.forEach((a, i) => {
        // 오른팔(sx=1)은 dirs[0], 왼팔은 dirs[1]의 x를 뒤집어
        const d = (a.sx > 0 ? dirs[0] : dirs[1]).clone();
        if (a.sx < 0) d.x = -d.x;
        _q.setFromUnitVectors(DOWN, d);
        a.p.quaternion.slerp(_q, Math.min(1, dt * 14));
      });
      // 눈 깜빡임 (점 눈일 때)
      blink -= dt;
      const eye = parts.dot.visible ? parts.dot : parts.wide.visible ? parts.wide : null;
      if (eye) {
        const closing = blink < 0.12 && blink > 0;
        eye.scale.y = closing ? 0.15 : 1;
        eye.position.y = closing ? 1.01 * 0.85 : 0; // 눈 높이는 그대로 두고 납작하게
      }
      if (blink < 0) blink = 2 + Math.random() * 3;
    };
    g.userData.update(0, 1);
    return g;
  };
  JK.RIG_POSES = Object.keys(POSE);
  JK.RIG_FACES = Object.keys(FACES);
})();
