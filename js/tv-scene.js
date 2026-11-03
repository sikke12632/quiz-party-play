/* tv-scene.js — 선생님 화면(TV)의 3D: 하늘에 떠 있는 섬, 금 더미, 들어온 아이 인형들
 * TV(선생님 컴퓨터)에서만 돈다. 아이 화면은 이 파일을 불러오지 않는다.
 */
(function () {
  'use strict';
  const JK = window.JK;
  const T = THREE;
  const col = JK.col;
  const K = JK.kit2;
  const TAU = Math.PI * 2;
  const ISLE_R = 7.2;
  const DS = 1.3; // 인형 크기

  function groundH(x, z) {
    const r = Math.hypot(x, z);
    let h = (JK.fbm(x * 0.25 + 3, z * 0.25 + 1) - 0.5) * 0.35;
    h *= JK.smooth(4.6, 6.2, r); // 가운데(인형 자리)는 평평
    h -= JK.smooth(ISLE_R - 0.8, ISLE_R, r) * 0.3;
    return h;
  }
  function groundCol(x, z) {
    const n = JK.fbm(x * 0.35, z * 0.35);
    const c = col('#8cc06a').lerp(col('#a8cf78'), JK.smooth(0.45, 0.7, n)).lerp(col('#76ad59'), JK.smooth(0.5, 0.25, n));
    // 인형이 서는 마당: 흙길 빛
    const yard = 1 - JK.smooth(0.0, 0.6, Math.max(Math.abs(x) - 5.0, 0) + Math.max(Math.abs(z - 1.1) - 3.1, 0));
    c.lerp(col('#e8d3a2'), yard * 0.85);
    return c;
  }
  function buildIsland(root) {
    const b = new JK.Builder();
    const NR = 20,
      NS = 84;
    const ringR = (k) => ISLE_R * Math.pow(k / NR, 0.85);
    const pt = (k, i) => {
      const u = (i / NS) * TAU,
        r = ringR(k);
      const x = Math.cos(u) * r,
        z = Math.sin(u) * r;
      return [x, groundH(x, z), z];
    };
    for (let k = 0; k < NR; k++)
      for (let i = 0; i < NS; i++) {
        const a = pt(k, i),
          c = pt(k, i + 1),
          d = pt(k + 1, i + 1),
          e = pt(k + 1, i);
        const cc = groundCol((a[0] + d[0]) / 2, (a[2] + d[2]) / 2);
        if (k === 0) b.tri([0, groundH(0, 0), 0], e, d, cc);
        else b.quad(a, e, d, c, cc);
      }
    const LAY = [
      [1.0, -0.3, '#86b864'],
      [0.97, -0.7, '#c08a5a'],
      [0.86, -1.5, '#a87449'],
      [0.66, -2.5, '#93633f'],
      [0.42, -3.5, '#7f5637'],
      [0.18, -4.4, '#6e4c33'],
      [0.0, -4.9, '#6e4c33'],
    ];
    const rr = (j, i) => {
      const u = (i / NS) * TAU;
      const w = j === 0 ? 1 : 0.88 + 0.24 * JK.noise2(Math.cos(u) * 3 + j * 1.7, Math.sin(u) * 3);
      return [Math.cos(u) * ISLE_R * LAY[j][0] * w, LAY[j][1] + (j ? (JK.noise2(i * 0.4, j) - 0.5) * 0.4 : 0), Math.sin(u) * ISLE_R * LAY[j][0] * w];
    };
    for (let j = 0; j < LAY.length - 1; j++)
      for (let i = 0; i < NS; i++) {
        const c = col(LAY[j][2]).lerp(col(LAY[j + 1][2]), 0.3).multiplyScalar(0.9 + 0.15 * JK.noise2(i * 0.7, j * 3));
        b.quad(rr(j, i), rr(j, i + 1), rr(j + 1, i + 1), rr(j + 1, i), c);
      }
    for (let i = 0; i < NS; i++) b.quad(pt(NR, i), pt(NR, i + 1), rr(0, i + 1), rr(0, i), col('#7fae5b'));
    // 마당 둘레 작은 꽃
    const rng = JK.rng(11);
    const FL = ['#f4f0e6', '#f5c94e', '#ef8fa6', '#b9a2e8'];
    for (let i = 0; i < 70; i++) {
      const u = rng() * TAU,
        r = 5.0 + rng() * 1.6;
      const x = Math.cos(u) * r,
        z = Math.sin(u) * r;
      b.ball(x, groundH(x, z) + 0.04, z, 0.045, 0, col(FL[i % 4]), 0.7);
    }
    root.add(K.mesh(b.build(), K.MATD, false, true));

    // 나무: 섬 뒤쪽 둘레
    const trees = [];
    const pine = JK.pineTree(),
      round = JK.roundTree(),
      bush = JK.bush();
    const leafCols = ['#5f9a5a', '#78b060', '#4f8a55', '#8cbf62'];
    for (let i = 0; i < 26; i++) {
      const u = Math.PI * 1.05 + (i / 25) * Math.PI * 0.9 + (rng() - 0.5) * 0.08;
      const r = 6.0 + rng() * 0.9;
      const x = Math.cos(u) * r,
        z = Math.sin(u) * r;
      trees.push([i % 3 === 0 ? round : pine, x, z, 1.6 + rng() * 0.9, leafCols[i % 4]]);
    }
    for (let i = 0; i < 12; i++) {
      const u = rng() * TAU;
      const r = 5.4 + rng() * 1.4;
      const x = Math.cos(u) * r,
        z = Math.sin(u) * r;
      if (z > 2.5 && Math.abs(x) < 3) continue;
      trees.push([bush, x, z, 1.6 + rng(), leafCols[(i + 1) % 4]]);
    }
    for (const geo of [pine, round, bush]) {
      const list = trees.filter((t) => t[0] === geo);
      const im = new T.InstancedMesh(geo, JK.MAT, list.length);
      const mm = new T.Matrix4(),
        q = new T.Quaternion();
      list.forEach((t, i) => {
        q.setFromAxisAngle(new T.Vector3(0, 1, 0), rng() * TAU);
        mm.compose(new T.Vector3(t[1], groundH(t[1], t[2]) - 0.02, t[2]), q, new T.Vector3(t[3], t[3], t[3]));
        im.setMatrixAt(i, mm);
        im.setColorAt(i, col(t[4]));
      });
      im.castShadow = true;
      im.receiveShadow = true;
      root.add(im);
    }
  }

  function buildClouds(scene) {
    const geo = JK.cloudPuff();
    const mat = new T.MeshLambertMaterial({ color: '#ffffff', emissive: col('#f4e6d6'), emissiveIntensity: 0.55 });
    const rng = JK.rng(5);
    const list = [];
    for (let i = 0; i < 20; i++) {
      const u = rng() * TAU,
        r = 14 + rng() * 14;
      const m = new T.Mesh(geo, mat);
      m.position.set(Math.cos(u) * r, -6 + rng() * 5, Math.sin(u) * r);
      m.scale.set(2 + rng() * 2.5, 1.2 + rng() * 1.2, 2 + rng() * 2);
      m.rotation.y = rng() * TAU;
      m.userData.sp = 0.02 + rng() * 0.03;
      scene.add(m);
      list.push(m);
    }
    const isl = JK.islet();
    for (const [x, y, z, s] of [
      [-15, 2, -8, 1.7],
      [14, 4, -11, 1.3],
      [17, -1, 2, 1.0],
      [-14, -2.5, 6, 0.9],
    ]) {
      const m = new T.Mesh(isl, JK.MAT);
      m.position.set(x, y, z);
      m.scale.setScalar(s * 2);
      scene.add(m);
    }
    return list;
  }

  // 인형 자리: 4줄 × 7자리, 살짝 둥글게. 먼저 들어온 아이부터 가운데 앞쪽에 선다.
  function gridPos(i) {
    const ROW = 7;
    const row = Math.floor(i / ROW),
      k = i % ROW;
    const x = (k - (ROW - 1) / 2) * 1.42 + (row % 2 ? 0.32 : -0.32);
    const z = -1.3 + row * 1.6 + x * x * 0.025;
    return new T.Vector3(x, 0, z);
  }
  const SLOTS = [...Array(28).keys()].map(gridPos).sort((a, b) => Math.hypot(a.x, (a.z - 1.4) * 1.3) - Math.hypot(b.x, (b.z - 1.4) * 1.3));
  const slotPos = (i) => (i < SLOTS.length ? SLOTS[i].clone() : gridPos(i));

  const S = (JK.TV = {});
  S.init = function (canvas, labelLayer) {
    let renderer;
    try {
      renderer = new T.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: true });
    } catch (e) {
      // 타임머신과 같은 설정으로 한 번 더(가장자리 다듬기 끔)
      console.warn('3D 다시 켜 보기', e);
      S.retry = String((e && e.message) || e);
      renderer = new T.WebGLRenderer({ canvas, antialias: false, preserveDrawingBuffer: true });
    }
    renderer.outputColorSpace = T.SRGBColorSpace;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = T.PCFSoftShadowMap;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    const scene = new T.Scene();
    scene.fog = new T.Fog(0xf3e3d3, 45, 120);
    const camera = new T.PerspectiveCamera(30, 1, 0.1, 600);
    const sunDir = new T.Vector3(0.45, 0.8, 0.5).normalize();
    scene.add(new T.HemisphereLight(0xd4e6ff, 0xe8dcbc, 1.1));
    const sun = new T.DirectionalLight(0xfff1d8, 2.4);
    sun.position.copy(sunDir).multiplyScalar(30);
    sun.castShadow = true;
    Object.assign(sun.shadow.camera, { left: -9, right: 9, top: 9, bottom: -9, near: 1, far: 70 });
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.bias = -0.0006;
    sun.shadow.normalBias = 0.02;
    scene.add(sun);
    K.sky(scene, sunDir);
    const clouds = buildClouds(scene);
    const world = new T.Group();
    scene.add(world);
    buildIsland(world);

    // 섬 뒤 가운데: 금 더미와 상자 셋
    const pile = K.mesh(JK.goldPile(3, 1.25), JK.GOLD_MAT);
    pile.position.set(0, -0.05, -3.7);
    world.add(pile);
    const chests = [];
    for (const [x, z, ry, paint, open] of [
      [-2.6, -3.4, 0.35, '#c4553f', 0.55],
      [2.7, -3.3, -0.4, '#3f7fa8', 0.0],
      [1.5, -2.5, -0.15, '#7f58b0', 0.3],
    ]) {
      const c = JK.chestGroup(paint);
      c.position.set(x, groundH(x, z), z);
      c.rotation.y = ry;
      c.scale.setScalar(1.25);
      c.userData.setOpen(open);
      c.traverse((o) => o.isMesh && (o.castShadow = o.receiveShadow = true));
      world.add(c);
      chests.push(c);
    }
    // 흩어진 금화
    const coinGeo = JK.coin();
    const rng = JK.rng(21);
    const coins = new T.InstancedMesh(coinGeo, JK.GOLD_MAT, 24);
    const mm = new T.Matrix4(),
      q = new T.Quaternion(),
      e = new T.Euler();
    for (let i = 0; i < 24; i++) {
      const u = rng() * TAU,
        r = 1.4 + rng() * 1.6;
      const x = Math.cos(u) * r * 1.4,
        z = -3.3 + Math.sin(u) * r * 0.5;
      e.set((rng() - 0.5) * 0.6, rng() * TAU, (rng() - 0.5) * 0.6);
      q.setFromEuler(e);
      mm.compose(new T.Vector3(x, 0.01, z), q, new T.Vector3(1.2, 1.2, 1.2));
      coins.setMatrixAt(i, mm);
    }
    coins.castShadow = true;
    world.add(coins);
    // 떠다니며 반짝이는 금화 (분위기)
    const floaters = [];
    for (let i = 0; i < 10; i++) {
      const m = K.mesh(coinGeo, JK.GOLD_MAT, false, false);
      m.position.set((rng() - 0.5) * 6, 1.5 + rng() * 2, -3.2 + (rng() - 0.5) * 1.5);
      m.rotation.x = Math.PI / 2;
      m.userData = { ph: rng() * TAU, y: m.position.y, sp: 0.6 + rng() * 0.6 };
      m.scale.setScalar(1.4);
      world.add(m);
      floaters.push(m);
    }

    const labels = [];
    const dolls = [];
    S.addKid = function (kid, instant) {
      const i = dolls.length;
      const m = K.mesh(JK.makeAnimalDoll(kid.avatar, 16));
      const p = slotPos(i);
      m.position.copy(p);
      m.rotation.y = -p.x * 0.05;
      m.userData = { base: p.clone(), t0: instant ? -10 : now, ph: i * 1.7 };
      m.scale.setScalar(DS);
      world.add(m);
      const el = document.createElement('div');
      el.className = 'plate' + (kid.me ? ' me' : '');
      el.textContent = kid.nick;
      labelLayer.appendChild(el);
      labels.push({ el, obj: m, dy: 1.4, view: 'lobby' });
      m.userData.sid = kid.sid;
      m.userData.el = el;
      dolls.push(m);
      return m;
    };
    // 들어온 아이 목록 맞추기: 새 아이는 하늘에서 떨어지고, 나간 아이는 빠진다
    S.syncKids = function (kids) {
      const want = new Set(kids.map((k) => k.sid));
      for (const m of dolls.slice()) {
        if (want.has(m.userData.sid)) continue;
        world.remove(m);
        m.userData.el.remove();
        dolls.splice(dolls.indexOf(m), 1);
        labels.splice(labels.findIndex((L) => L.obj === m), 1);
      }
      dolls.forEach((m, i) => {
        const p = slotPos(i);
        m.userData.base.copy(p);
        m.position.x = p.x;
        m.position.z = p.z;
      });
      const have = new Set(dolls.map((m) => m.userData.sid));
      for (const k of kids) if (!have.has(k.sid)) S.addKid(k);
    };

    const pod = JK.Podium ? JK.Podium.build(scene, labelLayer, labels) : null;
    S.view = 'lobby';
    K.view = 'lobby';
    scene.add(sun.target);
    S.setView = function (v) {
      S.view = K.view = v;
      const c = v === 'game' ? JK.Podium.STAGE : new T.Vector3();
      sun.target.position.copy(c);
      sun.position.copy(sunDir).multiplyScalar(30).add(c);
      resize();
    };
    S.setTop = (kids) => pod && pod.setTop(kids);
    let W = 1,
      H = 1;
    function resize() {
      W = canvas.clientWidth;
      H = canvas.clientHeight;
      renderer.setSize(W, H, false);
      camera.aspect = W / H;
      // 섬이 화면에 꽉 차도록 (화면 비율에 따라 거리를 맞춘다)
      const dist = camera.aspect > 1.5 ? 18 : 18 * (1.6 / camera.aspect) * 0.8;
      // 오른쪽에 입장 번호 칸이 있으므로 섬을 조금 왼쪽에 둔다
      const sx = S.shiftX === undefined ? 1.9 : S.shiftX;
      if (S.view === 'game' && pod) {
        // 단상: 오른쪽에 순위 줄이 있으므로 왼쪽으로 비켜 선다
        const P = JK.Podium.STAGE;
        const d = camera.aspect > 1.5 ? 17 : 17 * (1.6 / camera.aspect) * 0.85;
        camera.position.set(P.x + 2.6, P.y + d * 0.28 + 1.2, P.z + d);
        camera.lookAt(P.x + 2.6, P.y + 1.0, P.z);
      } else {
        camera.position.set(sx, dist * 0.6, dist * 0.8 + 0.6);
        camera.lookAt(sx, -0.1, 0.5);
      }
      camera.updateProjectionMatrix();
    }
    window.addEventListener('resize', resize);
    resize();
    S.camOffset = new T.Vector3();

    let now = 0,
      last = performance.now();
    const watch = K.speedWatch(() => {
      renderer.shadowMap.enabled = false;
      renderer.setPixelRatio(1);
      scene.traverse((o) => o.material && [].concat(o.material).forEach((mt) => (mt.needsUpdate = true)));
      resize();
    });
    function step(t) {
      if (S.manual) return; // 영상 찍기: S.frame(dt)로 한 장씩
      const dt = Math.min(0.05, (t - last) / 1000);
      last = t;
      tick(dt);
      requestAnimationFrame(step);
    }
    S.frame = (dt) => tick(dt);
    function tick(dt) {
      now += dt;
      JK.U.uTime.value = now;
      watch(dt);
      for (const m of dolls) {
        const u = m.userData;
        const a = now - u.t0;
        if (a < 0.9) {
          // 하늘에서 톡 떨어져 통 튀기
          const k = Math.min(1, a / 0.55);
          const y = a < 0.55 ? (1 - k * k) * 6 : Math.abs(Math.sin((a - 0.55) * 9)) * 0.35 * (1 - (a - 0.55) / 0.35);
          m.position.y = u.base.y + Math.max(0, y);
          const sq = a < 0.55 ? 1 : 1 - 0.12 * Math.sin(((a - 0.55) / 0.35) * Math.PI);
          m.scale.set(DS / Math.sqrt(sq), DS * sq, DS / Math.sqrt(sq));
        } else {
          m.position.y = u.base.y + Math.max(0, Math.sin(now * 2.2 + u.ph)) * 0.04;
          m.rotation.z = Math.sin(now * 1.3 + u.ph) * 0.03;
          m.scale.setScalar(DS);
        }
      }
      for (const f of floaters) {
        const u = f.userData;
        f.position.y = u.y + Math.sin(now * u.sp + u.ph) * 0.25;
        f.rotation.z = now * u.sp * 2 + u.ph;
      }
      for (const c of clouds) c.rotation.y += c.userData.sp * dt * 0.2;
      world.rotation.y = Math.sin(now * 0.12) * 0.05;
      if (pod && S.view === 'game') pod.update(now);
      renderer.render(scene, camera);
      K.placeLabels(labels, camera, W, H);
    }
    requestAnimationFrame(step);
    Object.assign(S, { renderer, scene, camera, world, chests, dolls, labels, resize });
    S.tris = () => renderer.info.render.triangles;
  };
})();
