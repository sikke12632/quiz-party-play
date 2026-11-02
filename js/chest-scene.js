/* chest-scene.js — 아이 화면의 작은 3D: 상자 셋 고르기와 여는 장면
 * 디벗 28대가 동시에 돌리므로 가볍게: 그림자 지도 없음(바닥 동그란 그림자), 상자 셋 + 금화 몇 닢,
 * 움직일 것이 없으면 그리지 않는다.
 */
(function () {
  'use strict';
  const JK = window.JK;
  const T = THREE;
  const col = JK.col;
  const K = JK.kit2;
  const TAU = Math.PI * 2;
  const PAINT = ['#c4553f', '#2f8f8a', '#7f58b0'];

  function blobShadow() {
    const cv = document.createElement('canvas');
    cv.width = cv.height = 64;
    const g = cv.getContext('2d');
    const gr = g.createRadialGradient(32, 32, 2, 32, 32, 32);
    gr.addColorStop(0, 'rgba(70,45,20,.45)');
    gr.addColorStop(1, 'rgba(70,45,20,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, 64, 64);
    const tex = new T.CanvasTexture(cv);
    const m = new T.Mesh(new T.PlaneGeometry(1.5, 1.1), new T.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }));
    m.rotation.x = -Math.PI / 2;
    return m;
  }
  // 열린 상자 뒤 빛줄기
  function rays() {
    const b = new JK.Builder();
    const n = 12;
    for (let i = 0; i < n; i++) {
      const a0 = (i / n) * TAU,
        a1 = a0 + (TAU / n) * 0.45;
      b.tri([0, 0, 0], [Math.cos(a0) * 1.9, Math.sin(a0) * 1.9, 0], [Math.cos(a1) * 1.9, Math.sin(a1) * 1.9, 0], [col('#ffe9a0'), col('#fff6d8'), col('#fff6d8')]);
    }
    const m = new T.Mesh(b.build(), new T.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.55, depthWrite: false }));
    m.visible = false;
    return m;
  }

  const S = (JK.ChestScene = {});
  S.init = function (canvas) {
    const renderer = new T.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.outputColorSpace = T.SRGBColorSpace;
    renderer.setPixelRatio(1);
    const scene = new T.Scene();
    const camera = new T.PerspectiveCamera(30, 1, 0.1, 50);
    scene.add(new T.HemisphereLight(0xfff4e0, 0xd8c0a0, 1.25));
    const sun = new T.DirectionalLight(0xfff1d8, 2.0);
    sun.position.set(3, 6, 5);
    scene.add(sun);

    // 둥근 나무 받침 셋
    const chests = PAINT.map((p, i) => {
      const g = new T.Group();
      const x = (i - 1) * 2.15;
      g.position.set(x, 0, 0);
      const base = new JK.Builder();
      base.cyl(0, -0.12, 0, 0.78, 0.8, 0.12, 24, col('#c99a62'), { top: col('#e2bb82') });
      base.cyl(0, -0.16, 0, 0.82, 0.82, 0.04, 24, col('#a87a48'));
      g.add(K.mesh(base.build(), JK.MAT, false, false));
      const sh = blobShadow();
      sh.position.y = 0.005;
      g.add(sh);
      const c = JK.chestGroup(p);
      c.rotation.y = -x * 0.08;
      c.scale.setScalar(1.35);
      g.add(c);
      g.userData = { c, ph: i * 1.9, open: 0, target: 0 };
      scene.add(g);
      return g;
    });
    const ray = rays();
    scene.add(ray);
    const coinGeo = JK.coin();
    const coins = [];
    for (let i = 0; i < 14; i++) {
      const m = new T.Mesh(coinGeo, JK.GOLD_MAT);
      m.visible = false;
      scene.add(m);
      coins.push({ m, v: new T.Vector3(), w: new T.Vector3(), t: 0 });
    }

    function resize() {
      const w = canvas.clientWidth,
        h = canvas.clientHeight;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.position.set(0, 2.9, 7.6);
      camera.lookAt(0, 0.15, 0);
      camera.updateProjectionMatrix();
    }
    window.addEventListener('resize', resize);
    resize();

    let now = 0,
      last = performance.now(),
      picked = -1;
    // 새 라운드: 상자를 모두 닫는다
    S.reset = function () {
      picked = -1;
      ray.visible = false;
      coins.forEach((c) => (c.m.visible = false));
      chests.forEach((g) => {
        g.userData.target = 0;
        g.userData.open = 0;
      });
    };
    // 고른 상자를 살짝 들썩 (열리기 전, 선생님 화면 답을 기다리는 동안)
    S.choose = function (i) {
      picked = i;
    };
    // 화면 x 위치(0~1)마다 상자 번호 — 누르기 판정
    S.hit = function (fx) {
      return fx < 0.37 ? 0 : fx > 0.63 ? 2 : 1;
    };
    // 화면에 안 보일 때는 그리지 않는다(디벗 아끼기)
    let active = true;
    S.setActive = function (on) {
      if (on && !active) {
        active = true;
        last = performance.now();
        resize();
        requestAnimationFrame(step);
      }
      active = on;
    };
    S.open = function (i, what, instant) {
      picked = i;
      const g = chests[i].userData;
      g.target = 1;
      if (instant) {
        g.open = 1;
        now = 1.2;
      }
      ray.position.set(chests[i].position.x, 1.0, -0.9);
      ray.visible = what !== 'none';
      coins.forEach((c, k) => {
        c.m.visible = what === 'gold';
        c.t = instant ? 0.55 : 0;
        const u = (k / coins.length) * TAU;
        c.v.set(Math.cos(u) * 1.1, 4.2 + (k % 3) * 0.6, Math.sin(u) * 0.6 + 0.8);
        c.w.set(Math.random() * 8, Math.random() * 8, 0);
        c.m.position.set(chests[i].position.x, 0.5, 0);
      });
    };
    function step(t) {
      const dt = Math.min(0.05, (t - last) / 1000);
      last = t;
      now += dt;
      chests.forEach((g, i) => {
        const u = g.userData;
        u.open += (u.target - u.open) * Math.min(1, dt * 7);
        u.c.userData.setOpen(u.open);
        const idle = picked < 0 ? Math.max(0, Math.sin(now * 2.4 + u.ph)) * 0.06 : picked === i && u.target === 0 ? Math.abs(Math.sin(now * 14)) * 0.05 : 0;
        u.c.position.y = idle;
        const s = picked === i ? 1.12 : picked >= 0 ? 0.9 : 1;
        g.scale.setScalar(s);
      });
      if (ray.visible) {
        ray.rotation.z = now * 0.4;
        ray.lookAt(camera.position);
        ray.rotateZ(now * 0.4);
      }
      for (const c of coins) {
        if (!c.m.visible) continue;
        c.t += dt;
        const x0 = chests[picked].position.x;
        c.m.position.set(x0 + c.v.x * c.t, 0.5 + c.v.y * c.t - 4.9 * c.t * c.t, c.v.z * c.t);
        c.m.rotation.set(c.w.x * c.t, c.w.y * c.t, 0);
        if (c.m.position.y < 0) c.m.position.y = 0;
      }
      renderer.render(scene, camera);
      if (active) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
    S.tris = () => renderer.info.render.triangles;
    return S;
  };
})();
