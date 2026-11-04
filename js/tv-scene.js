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
    const hemi = new T.HemisphereLight(0xd4e6ff, 0xe8dcbc, 1.1);
    scene.add(hemi);
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
      m.userData = { base: p.clone(), at: p.clone(), t0: instant ? -10 : now, ph: i * 1.7, av: kid.avatar };
      m.scale.setScalar(DS);
      world.add(m);
      const el = document.createElement('div');
      el.className = 'plate' + (kid.me ? ' me' : '');
      el.textContent = kid.nick;
      labelLayer.appendChild(el);
      labels.push({ el, obj: m, dy: 1.4, view: 'lobby' });
      m.userData.L = labels[labels.length - 1];
      m.userData.sid = kid.sid;
      m.userData.el = el;
      dolls.push(m);
      return m;
    };
    // 도깨비 찾기: 인형마다 표시(states: {sid: 'caught good hint target by'})
    //   caught = 잡힌 도깨비(뿔), good = 공개된 착한 친구(금빛 고리), hint = 마지막 힌트 무리, target = 지목됨(폴짝), by = 지목한 친구
    const hornGeo = (() => {
      const b = new JK.Builder();
      for (const sx of [-1, 1]) {
        b.push().t(sx * 0.11, 1.18, 0.02).rz(-sx * 0.35);
        b.cyl(0, 0, 0, 0.05, 0, 0.18, 6, col('#c4302a'));
        b.pop();
      }
      return b.build();
    })();
    const haloGeo = new T.TorusGeometry(0.17, 0.025, 6, 20);
    const haloMat = new T.MeshBasicMaterial({ color: '#ffd25a' });
    S.markDolls = function (states) {
      for (const m of dolls) {
        const st = states[m.userData.sid] || '';
        m.userData.el.className = 'plate' + (st ? ' ' + st : '');
        m.userData.mark = st;
        // 2판: 걸린 도깨비는 착한 시민이 된다 → 뿔은 공개 연출 때만(actTick), 착해진 도깨비·풀려난 시민 모두 금빛 고리
        const want = { horn: false, halo: /good|caught/.test(st) };
        if (want.horn && !m.userData.horn) {
          m.userData.horn = K.mesh(hornGeo, JK.MAT);
          m.add(m.userData.horn);
        } else if (!want.horn && m.userData.horn) {
          m.remove(m.userData.horn);
          m.userData.horn = null;
        }
        if (want.halo && !m.userData.halo) {
          const h = new T.Mesh(haloGeo, haloMat);
          h.rotation.x = Math.PI / 2;
          h.position.y = 1.42;
          m.userData.halo = h;
          m.add(h);
        } else if (!want.halo && m.userData.halo) {
          m.remove(m.userData.halo);
          m.userData.halo = null;
        }
      }
    };

    /* ---------- 도깨비 찾기 연출 (담임 2026-11-03) ----------
     * 지목권 뽑기: 빠른 정답 후보(최대 5명)가 앞으로 나와 서고, 위에서 내리쬐는 빛이 한 명씩 딴딴딴…딴! 멈춘 아이는 신나서 폴짝.
     * 투표: 지목당한 아이를 가운데 앞으로 불러 카메라가 다가간다(손 모으고 달달, 땀 한 방울). 지목한 아이는 옆에서 가리킨다.
     * 공개: 도깨비면 장난감 망치가 「콩!」 → 뿔이 뿅, 착한 친구면 금빛 고리가 내려온다, 공개 안 되면 「휴~」.
     */
    const FRONT_Z = 5.0;
    const CENTER = new T.Vector3(0, 0, FRONT_Z + 0.2);
    const BYPOS = new T.Vector3(-1.4, 0, FRONT_Z - 0.5);
    const EMPTY = (() => {
      const g = new T.BufferGeometry();
      for (const k of ['position', 'normal', 'color']) g.setAttribute(k, new T.BufferAttribute(new Float32Array(9), 3));
      return g;
    })();
    const stage = { key: '', camSpec: null, dim: 0, dimGoal: 0, spotSid: null, roll: null, actors: new Set(), pops: [] };
    const bySid = (sid) => dolls.find((m) => m.userData.sid === sid);
    function rigOn(m) {
      const u = m.userData;
      if (!u.rig) {
        u.geo0 = m.geometry;
        m.geometry = EMPTY;
        u.rig = JK.makeRig(u.av);
        m.add(u.rig);
      }
      return u.rig;
    }
    function rigOff(m) {
      const u = m.userData;
      if (u.rig) {
        m.remove(u.rig);
        u.rig = null;
        m.geometry = u.geo0;
      }
      for (const k of ['sweat', 'hammer', 'stars', 'ring', 'bhorn']) if (u[k]) (u[k].parent && u[k].parent.remove(u[k]), (u[k] = null));
      u.act = null;
      stage.actors.delete(m);
    }
    function setAct(m, kind, pose, face) {
      const u = m.userData;
      const R = rigOn(m);
      R.userData.pose(pose || 'rest');
      R.userData.face(face || 'normal');
      u.act = { kind, t0: now, fired: {} };
      stage.actors.add(m);
      return u.act;
    }
    function moveTo(m, to, dur, done) {
      const u = m.userData;
      const d = u.at.distanceTo(to);
      if (d < 0.01 || dur === 0) {
        u.at.copy(to);
        u.mv = null;
        return done && done();
      }
      u.mv = { a: u.at.clone(), b: to.clone(), t0: now, dur: dur || Math.min(1.4, 0.35 + d * 0.16), n: Math.max(1, Math.round(d / 1.1)), done };
    }
    function sendHome(m) {
      const u = m.userData;
      if (!u.act || u.act.kind === 'home') return;
      setAct(m, 'home', 'rest', 'normal');
      if (u.ring) (m.remove(u.ring), (u.ring = null));
      moveTo(m, u.base, undefined, () => rigOff(m));
    }
    function clearStage(instant) {
      for (const m of [...stage.actors]) {
        if (instant) {
          m.userData.at.copy(m.userData.base);
          m.userData.mv = null;
          rigOff(m);
        } else if (m.userData.act && m.userData.act.kind !== 'home') sendHome(m);
      }
      stage.roll = null;
      stage.spotSid = null;
      stage.camSpec = null;
      stage.dimGoal = 0;
    }
    // 글자 톡 튀기(딴, 딴!, 콩!, 도깨비!, 착한 친구!, 휴~)
    function pop(m, text, cls, life, dy, dx) {
      const el = document.createElement('div');
      el.className = 'pop3d ' + (cls || '');
      el.textContent = text;
      if (dx) el.style.marginLeft = dx + 'px';
      labelLayer.appendChild(el);
      const L = { el, obj: m, dy: dy || 1.55, center: true, view: 'lobby', until: now + (life || 0.9) };
      labels.push(L);
      stage.pops.push(L);
    }
    function popTick() {
      for (const L of stage.pops.slice())
        if (now >= L.until || !L.obj.parent) {
          L.el.remove();
          labels.splice(labels.indexOf(L), 1);
          stage.pops.splice(stage.pops.indexOf(L), 1);
        }
    }
    // 위에서 내리쬐는 빛: 원뿔(아래로 갈수록 밝게) + 바닥 동그라미 + 진짜 빛 하나
    const spot = new T.Group();
    {
      const h = 7;
      const cg = new T.CylinderGeometry(0.18, 1.05, h, 28, 6, true);
      const pos = cg.getAttribute('position');
      const cc = new Float32Array(pos.count * 3);
      for (let i = 0; i < pos.count; i++) {
        const k = 1 - (pos.getY(i) + h / 2) / h; // 바닥 1 → 위 0
        const v = 0.02 + 0.3 * k * k;
        cc[i * 3] = v;
        cc[i * 3 + 1] = v * 0.93;
        cc[i * 3 + 2] = v * 0.7;
      }
      cg.setAttribute('color', new T.BufferAttribute(cc, 3));
      const cone = new T.Mesh(cg, new T.MeshBasicMaterial({ vertexColors: true, transparent: true, blending: T.AdditiveBlending, depthWrite: false, side: T.BackSide, fog: false })); // 뒤쪽 면만: 인형을 덮지 않는다
      cone.position.y = h / 2;
      cone.renderOrder = 5;
      spot.add(cone);
      const disc = new T.Mesh(new T.CircleGeometry(1.05, 36), new T.MeshBasicMaterial({ color: '#5c4f2a', transparent: true, blending: T.AdditiveBlending, depthWrite: false, fog: false }));
      disc.rotation.x = -Math.PI / 2;
      disc.position.y = 0.03;
      spot.add(disc);
      const pl = new T.PointLight(0xfff0c8, 0, 0, 1.6);
      pl.position.set(0, 3.2, 0.9);
      spot.add(pl);
      spot.userData = { cone, disc, pl, k: 0 };
      spot.visible = false;
      world.add(spot);
    }
    // 장난감 망치(손잡이 끝이 회전축)
    const hammerGeo = (() => {
      const b = new JK.Builder();
      b.cyl(0, 0, 0, 0.035, 0.035, 1.05, 8, col('#d9b27a'));
      b.push().t(0, 1.12, 0).rz(Math.PI / 2);
      b.cyl(0, -0.27, 0, 0.17, 0.17, 0.54, 16, col('#e2475a'));
      b.cyl(0, -0.3, 0, 0.18, 0.18, 0.05, 16, col('#f5d66a'));
      b.cyl(0, 0.25, 0, 0.18, 0.18, 0.05, 16, col('#f5d66a'));
      b.pop();
      return b.build();
    })();
    const sweatGeo = (() => {
      const b = new JK.Builder();
      b.push().t(0, 0, 0).s(1, 1.4, 0.8);
      b.ball(0, 0, 0, 0.045, 1, col('#7cc6ff'), 1.4);
      b.pop();
      return b.build();
    })();
    const starMat = new T.MeshBasicMaterial({ color: '#ffd84a' });
    const ringGeo = new T.RingGeometry(0.46, 0.56, 32);
    const ringMat = new T.MeshBasicMaterial({ color: '#ffd23f', transparent: true, opacity: 0.9, depthWrite: false });
    const starGeo = new T.OctahedronGeometry(0.06, 0);

    function startRoll(cand, by, since) {
      const L = cand.length;
      const t0 = now - since;
      const list = cand.map(bySid).filter(Boolean);
      // 지금 앞에 나와 있는 아이 중 후보가 아니면 들여보낸다
      for (const m of [...stage.actors]) if (!list.includes(m)) sendHome(m);
      list.forEach((m, i) => {
        setAct(m, 'cand', 'rest', 'normal');
        if (!m.userData.ring) {
          // 후보 표시: 발밑 금빛 고리
          const ring = new T.Mesh(ringGeo, ringMat);
          ring.rotation.x = -Math.PI / 2;
          ring.position.y = 0.03;
          m.add(ring);
          m.userData.ring = ring;
        }
        moveTo(m, new T.Vector3((i - (list.length - 1) / 2) * 1.45, 0, FRONT_Z), since > 1.5 ? 0 : 0.7);
      });
      // 딴딴딴딴딴…딴! (점점 느려지다가 뽑힌 아이에서 멈춘다)
      const n = L > 1 ? 12 : 1;
      const ci = Math.max(0, cand.indexOf(by));
      const start = (((ci - (n - 1)) % L) + L) % L;
      const steps = [];
      let t = 0.65;
      for (let i = 0; i < n; i++) {
        steps.push({ t, sid: cand[(start + i) % L] });
        t += 0.11 + 0.62 * Math.pow(i / Math.max(1, n - 1), 3);
      }
      stage.roll = { t0, steps, land: steps[n - 1].t, by, list, lit: -1, landed: false, home: false };
      stage.camSpec = { c: new T.Vector3(0, 0, FRONT_Z), w: Math.max(4.6, list.length * 1.45 + 1.4), lift: 2.6, ly: 0.85 };
      stage.dimGoal = 1;
    }
    function rollTick() {
      const R = stage.roll;
      if (!R) return;
      const t = now - R.t0;
      let i = -1;
      for (let k = 0; k < R.steps.length; k++) if (t >= R.steps[k].t) i = k;
      if (i !== R.lit && i >= 0) {
        const prev = R.lit >= 0 ? bySid(R.steps[R.lit].sid) : null;
        if (prev && prev.userData.rig && !R.landed) prev.userData.rig.userData.face('normal');
        R.lit = i;
        const m = bySid(R.steps[i].sid);
        stage.spotSid = R.steps[i].sid;
        if (m && m.userData.rig) m.userData.rig.userData.face('wow');
        const last = i === R.steps.length - 1;
        if (m && t - R.steps[i].t < 0.4) pop(m, last ? '딴!' : '딴', last ? 'tbig' : 'ttan', last ? 1.3 : 0.4, 1.7);
      }
      if (!R.landed && t >= R.land) {
        R.landed = true;
        for (const m of R.list) {
          if (m.userData.sid === R.by) setAct(m, 'chosen', 'cheer', 'happy');
          else setAct(m, 'loser', 'droop', 'sad');
        }
      }
      if (R.landed && !R.home && t >= R.land + 1.4) {
        R.home = true;
        for (const m of R.list) if (m.userData.sid !== R.by) sendHome(m);
        const c = bySid(R.by);
        if (c) moveTo(c, new T.Vector3(0, 0, FRONT_Z));
        stage.camSpec = { c: new T.Vector3(0, 0, FRONT_Z), w: 4.6, lift: 2.0, ly: 0.9 };
      }
    }
    function startVote(nom, since) {
      stage.roll = null;
      const tg = bySid(nom.target),
        by = bySid(nom.by);
      for (const m of [...stage.actors]) if (m !== tg && m !== by) sendHome(m);
      const fast = since > 1.5 ? 0 : undefined;
      for (const m of [tg, by]) if (m && m.userData.ring) (m.remove(m.userData.ring), (m.userData.ring = null));
      if (by) {
        setAct(by, 'by', 'point', 'wow');
        moveTo(by, BYPOS, fast);
      }
      if (tg) {
        setAct(tg, 'target', 'nervous', 'scared');
        moveTo(tg, CENTER, fast);
        const sw = new T.Mesh(sweatGeo, K.MATD || JK.MAT);
        sw.position.set(0.2, 1.12, 0.12);
        tg.add(sw);
        tg.userData.sweat = sw;
      }
      stage.spotSid = nom.target;
      stage.camSpec = { c: CENTER.clone(), w: 4.8, lift: 1.55, ly: 1.15 };
      stage.dimGoal = 1;
    }
    function startShow(last, since) {
      stage.roll = null;
      const tg = bySid(last.target);
      for (const m of [...stage.actors]) if (m !== tg) sendHome(m);
      if (!tg) return;
      const kind = last.pass ? (last.goblin ? 'caught' : 'good') : 'safe';
      const a = setAct(tg, kind, kind === 'caught' ? 'nervous' : 'nervous', 'scared');
      a.t0 = now - since;
      moveTo(tg, CENTER, since > 1 ? 0 : undefined);
      if (tg.userData.sweat) (tg.remove(tg.userData.sweat), (tg.userData.sweat = null));
      if (kind === 'caught') {
        const hm = new T.Group();
        const mesh = K.mesh(hammerGeo, JK.MAT);
        hm.add(mesh);
        hm.position.set(1.18, 1.38, 0.08);
        hm.scale.setScalar(0);
        tg.add(hm);
        tg.userData.hammer = hm;
      }
      stage.spotSid = last.target;
      stage.camSpec = { c: CENTER.clone(), w: 4.3, lift: 1.45, ly: 1.15 };
      stage.dimGoal = 1;
    }
    // TV(teacher-ui)가 심판 소식마다 부른다
    S.mafiaStage = function (st) {
      if (S.view !== 'lobby') return;
      const key = st.phase + '|' + st.round;
      if (key === stage.key) return;
      stage.key = key;
      const since = Math.max(0, st.since || 0);
      if (st.phase === 'result' && st.cand && st.cand.length && st.by) startRoll(st.cand, st.by, since);
      else if (st.phase === 'vote' && st.nom) startVote(st.nom, since);
      else if (st.phase === 'show' && st.last) startShow(st.last, since);
      else clearStage(false);
    };
    // 돋보기 소문: 그 인형 위에 말풍선
    S.rumorPop = function (sid, g) {
      const m = bySid(sid);
      if (m) pop(m, g ? '도깨비래…' : '아니래!', 'rum ' + (g ? 'y' : 'n'), 3, 1.7);
    };
    S.stageReset = () => {
      stage.key = '';
      clearStage(true);
      stage.dim = 0;
    };
    const ease = (k) => k * k * (3 - 2 * k);
    // 앞에 나온 인형 움직이기(매 장면)
    function actTick(m, u, dt) {
      const a = u.act,
        R = u.rig;
      const t = now - a.t0;
      let y = 0,
        rz = 0,
        ry = 0,
        dx = 0,
        sy = 1;
      if (a.kind === 'cand') y = Math.max(0, Math.sin(now * 3 + u.ph)) * 0.03;
      else if (a.kind === 'chosen') {
        y = Math.abs(Math.sin(t * 7)) * 0.42;
        ry = Math.sin(t * 2.6) * 0.35;
      } else if (a.kind === 'loser') rz = Math.sin(t * 2) * 0.04;
      else if (a.kind === 'by') ry = 0.5;
      else if (a.kind === 'target') {
        dx = Math.sin(now * 43) * 0.018;
        rz = Math.sin(now * 37) * 0.025;
        if (u.sweat) {
          const k = (now * 0.8) % 1;
          u.sweat.position.y = 1.14 - k * 0.12;
          u.sweat.scale.setScalar(k < 0.85 ? 1 : (1 - k) / 0.15);
        }
      } else if (a.kind === 'caught') {
        // 0.25 망치 등장 → 0.85까지 들어 올림 → 1.0 콩! → 뿔 뿅 → 별 빙글
        const H = u.hammer;
        if (t < 1.0) {
          dx = Math.sin(now * 43) * 0.018;
          rz = Math.sin(now * 37) * 0.025;
        }
        if (H) {
          const sc = t < 0.25 ? 0 : t < 0.45 ? ease((t - 0.25) / 0.2) : t < 1.5 ? 1 : Math.max(0, 1 - (t - 1.5) / 0.3);
          H.scale.setScalar(sc);
          let ang;
          if (t < 0.85) ang = -0.05 - 0.35 * ease(Math.min(1, Math.max(0, (t - 0.3) / 0.5)));
          else if (t < 1.0) ang = -0.4 + (Math.PI / 2 + 0.4) * ((t - 0.85) / 0.15) ** 2;
          else if (t < 1.25) ang = Math.PI / 2 - Math.sin(((t - 1.0) / 0.25) * Math.PI) * 0.25;
          else ang = Math.PI / 2 - Math.min(1, (t - 1.25) / 0.3) * 1.2;
          H.rotation.z = ang;
        }
        if (t >= 1.0 && !a.fired.kong) {
          a.fired.kong = true;
          pop(m, '콩!', 'kong', 1.3, 1.45, 120);
          if (R) (R.userData.face('wow'), R.userData.pose('wow'));
          const st = new T.Group();
          for (let i = 0; i < 5; i++) {
            const s = new T.Mesh(starGeo, starMat);
            s.position.set(Math.cos((i / 5) * TAU) * 0.27, 0, Math.sin((i / 5) * TAU) * 0.27);
            st.add(s);
          }
          st.position.y = 1.3;
          m.add(st);
          u.stars = st;
        }
        if (t >= 1.55 && !a.fired.gob) {
          a.fired.gob = true;
          pop(m, '도깨비!', 'gob', 1.0, 0.95, 190);
          if (R) R.userData.face('shout');
        }
        if (t >= 1.0) {
          const k = Math.min(1, (t - 1.0) / 0.4);
          sy = 1 - 0.3 * Math.sin(k * Math.PI) * (1 - k * 0.3);
          rz = t > 1.4 ? Math.min(1, (t - 1.4) / 0.5) * 0.12 : 0;
        }
        // 뿔: 콩! 하면 뿅 → 잠깐 뒤 날아가 사라지고 착한 시민이 된다(금빛 고리가 내려옴)
        if (t >= 1.05 && !u.bhorn && t < 2.6) {
          u.bhorn = K.mesh(hornGeo, JK.MAT);
          m.add(u.bhorn);
        }
        if (u.bhorn) {
          if (t < 2.2) u.bhorn.scale.setScalar(Math.min(1.25, 1.25 * ease(Math.min(1, (t - 1.05) / 0.2))) - Math.max(0, Math.min(0.25, (t - 1.25) * 1.2)));
          else {
            const k = Math.min(1, (t - 2.2) / 0.45);
            u.bhorn.position.set(k * 0.5, k * 1.4, 0);
            u.bhorn.rotation.z = -k * 3;
            u.bhorn.scale.setScalar(Math.max(0.001, 1 - k));
            if (k >= 1) (m.remove(u.bhorn), (u.bhorn = null));
          }
        }
        if (u.halo) {
          u.halo.visible = t >= 2.5;
          u.halo.position.y = 1.42 + (1 - ease(Math.min(1, Math.max(0, (t - 2.5) / 0.6)))) * 1.4;
        }
        if (t >= 2.6 && !a.fired.nice) {
          a.fired.nice = true;
          pop(m, '착해졌다!', 'good', 2.6, 0.95, 200);
          if (R) (R.userData.face('happy'), R.userData.pose('cheer'));
        }
        if (t >= 2.6) y = Math.abs(Math.sin((t - 2.6) * 6)) * 0.3;
        if (u.stars) {
          u.stars.rotation.y = now * 5;
          u.stars.visible = t < 2.5;
        }
      } else if (a.kind === 'good') {
        if (t < 1.0) {
          dx = Math.sin(now * 43) * 0.018;
          rz = Math.sin(now * 37) * 0.025;
        }
        if (u.halo) u.halo.position.y = 1.42 + (1 - ease(Math.min(1, Math.max(0, (t - 0.2) / 0.8)))) * 1.6;
        if (t >= 1.0 && !a.fired.g) {
          a.fired.g = true;
          if (R) (R.userData.face('happy'), R.userData.pose('cheer'));
          pop(m, '착한 친구!', 'good', 3.2, 0.95, 200);
        }
        if (t >= 1.0) y = Math.abs(Math.sin((t - 1) * 6)) * 0.3;
      } else if (a.kind === 'safe') {
        if (t < 0.6) {
          dx = Math.sin(now * 43) * 0.018;
          rz = Math.sin(now * 37) * 0.025;
        }
        if (t >= 0.6 && !a.fired.s) {
          a.fired.s = true;
          if (R) (R.userData.face('joy'), R.userData.pose('rest'));
          pop(m, '휴~', 'phew', 2.5, 1.35, 110);
        }
      }
      if (R) R.userData.update(now, dt);
      return { y, rz, ry, dx, sy };
    }
    function stageTick(dt) {
      rollTick();
      popTick();
      const k = 1 - Math.exp(-dt * 3);
      stage.dim += (stage.dimGoal - stage.dim) * k;
      hemi.intensity = 1.1 * (1 - 0.45 * stage.dim);
      sun.intensity = 2.4 * (1 - 0.6 * stage.dim);
      // 연출 중에는 앞에 나온 인형 이름표만
      for (const m of dolls) if (m.userData.L) m.userData.L.hide = stage.dimGoal > 0 && !m.userData.act;
      const target = stage.spotSid && bySid(stage.spotSid);
      const sd = spot.userData;
      sd.k += ((target ? 1 : 0) - sd.k) * Math.min(1, dt * 8);
      spot.visible = sd.k > 0.02;
      if (target) {
        // 딴딴딴 할 때는 바로 옮겨 가고, 걸어갈 때는 따라간다
        const jump = stage.roll && !stage.roll.landed;
        if (jump || !spot.userData.on) spot.position.set(target.position.x, 0, target.position.z);
        else spot.position.lerp(new T.Vector3(target.position.x, 0, target.position.z), Math.min(1, dt * 10));
        spot.userData.on = true;
      } else spot.userData.on = false;
      spot.position.y = groundH(spot.position.x, spot.position.z);
      sd.cone.material.opacity = sd.k;
      sd.cone.scale.set(1, 1, 1);
      sd.disc.material.opacity = sd.k;
      sd.pl.intensity = sd.k * 6;
    }
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
        if (!m.userData.act && !m.userData.mv) m.userData.at.copy(p);
      });
      const have = new Set(dolls.map((m) => m.userData.sid));
      for (const k of kids) if (!have.has(k.sid)) S.addKid(k);
    };

    const pod = JK.Podium ? JK.Podium.build(scene, labelLayer, labels) : null;
    S.view = 'lobby';
    K.view = 'lobby';
    scene.add(sun.target);
    S.setView = function (v) {
      if (v !== S.view) S.stageReset();
      S.view = K.view = v;
      const c = v === 'game' ? JK.Podium.STAGE : new T.Vector3();
      sun.target.position.copy(c);
      sun.position.copy(sunDir).multiplyScalar(30).add(c);
      resize();
    };
    S.setTop = (kids) => pod && pod.setTop(kids);
    S.resetTop = () => pod && pod.reset();
    let W = 1,
      H = 1;
    // 카메라: 평소 자리(camHome)와 연출 자리(stage.camSpec) 사이를 부드럽게 오간다
    const camHome = { pos: new T.Vector3(), look: new T.Vector3() };
    const camPos = new T.Vector3(),
      camLook = new T.Vector3(),
      camLook0 = new T.Vector3();
    // 주인공 c가 오른쪽 칸(mpanel)을 뺀 왼쪽 빈자리 가운데에 오도록. w = 화면에 들어올 너비
    function shot(sp) {
      const tanH = Math.tan((camera.fov * Math.PI) / 360);
      const free = Math.max(0.45, 1 - (S.panelPx || 380) / Math.max(1, W));
      const dist = Math.max(4, sp.w / (2 * free * tanH * camera.aspect));
      const half = dist * tanH * camera.aspect;
      const lx = sp.c.x + (1 - free) * half;
      return { pos: new T.Vector3(lx, sp.c.y + sp.lift, sp.c.z + dist), look: new T.Vector3(lx, sp.c.y + sp.ly, sp.c.z) };
    }
    function camTick(dt) {
      if (S.view !== 'lobby') return;
      const goal = stage.camSpec ? shot(stage.camSpec) : camHome;
      const k = 1 - Math.exp(-dt * 2.4);
      camPos.lerp(goal.pos, k);
      camLook0.lerp(goal.look, k);
      camera.position.copy(camPos);
      camera.lookAt(camLook0);
    }
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
        camLook.set(sx, -0.1, 0.5);
        camHome.pos.copy(camera.position);
        camHome.look.copy(camLook);
        if (stage.camSpec) camera.position.copy(camPos);
        else camPos.copy(camera.position);
        camera.lookAt(stage.camSpec ? camLook0 : camLook);
        if (!stage.camSpec) camLook0.copy(camLook);
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
      stageTick(dt);
      for (const m of dolls) {
        const u = m.userData;
        let gx = u.at.x,
          gz = u.at.z,
          hop = 0;
        if (u.mv) {
          const k = Math.min(1, (now - u.mv.t0) / u.mv.dur);
          const e = ease(k);
          gx = u.mv.a.x + (u.mv.b.x - u.mv.a.x) * e;
          gz = u.mv.a.z + (u.mv.b.z - u.mv.a.z) * e;
          hop = Math.abs(Math.sin(k * Math.PI * u.mv.n)) * 0.32;
          if (k >= 1) {
            u.at.copy(u.mv.b);
            const f = u.mv.done;
            u.mv = null;
            if (f) f();
          }
        }
        m.position.x = gx;
        m.position.z = gz;
        const a = now - u.t0;
        if (a < 0.9) {
          // 하늘에서 톡 떨어져 통 튀기
          const k = Math.min(1, a / 0.55);
          const y = a < 0.55 ? (1 - k * k) * 6 : Math.abs(Math.sin((a - 0.55) * 9)) * 0.35 * (1 - (a - 0.55) / 0.35);
          m.position.y = u.base.y + Math.max(0, y);
          const sq = a < 0.55 ? 1 : 1 - 0.12 * Math.sin(((a - 0.55) / 0.35) * Math.PI);
          m.scale.set(DS / Math.sqrt(sq), DS * sq, DS / Math.sqrt(sq));
        } else if (u.act) {
          // 도깨비 찾기 연출 중(앞에 나온 인형)
          const o = actTick(m, u, dt);
          m.position.x += o.dx;
          m.position.y = groundH(gx, gz) + hop + o.y;
          m.rotation.z = o.rz;
          m.rotation.y = o.ry;
          m.scale.set(DS / Math.sqrt(o.sy), DS * o.sy, DS / Math.sqrt(o.sy));
        } else {
          m.position.y = u.base.y + Math.max(0, Math.sin(now * 2.2 + u.ph)) * 0.04;
          m.rotation.z = Math.sin(now * 1.3 + u.ph) * 0.03;
          m.rotation.y = -u.base.x * 0.05;
          m.scale.setScalar(DS);
        }
      }
      for (const f of floaters) {
        const u = f.userData;
        f.position.y = u.y + Math.sin(now * u.sp + u.ph) * 0.25;
        f.rotation.z = now * u.sp * 2 + u.ph;
      }
      for (const c of clouds) c.rotation.y += c.userData.sp * dt * 0.2;
      world.rotation.y = Math.sin(now * 0.12) * 0.05 * (1 - stage.dim);
      camTick(dt);
      if (pod && S.view === 'game') pod.update(now);
      renderer.render(scene, camera);
      K.placeLabels(labels, camera, W, H);
    }
    requestAnimationFrame(step);
    Object.assign(S, { renderer, scene, camera, world, chests, dolls, labels, resize });
    S.tris = () => renderer.info.render.triangles;
  };
})();
