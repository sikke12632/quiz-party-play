/* podium.js — TV 게임 중 화면: 단상 위 상위 5명이 춤춘다 (작업/결정-황금찾기.md 2·3절)
 * 단상 자리(왼쪽부터): 4등 2등 1등 3등 5등. 1등 머리 위에는 왕관.
 * 순위가 바뀌면(라운드 끝 발표) setTop()으로 새 5명을 넘긴다. 들어옴·떨어짐·오름·내림 동작은 엔진 단계에서 붙인다.
 */
(function () {
  'use strict';
  const JK = window.JK;
  const T = THREE;
  const col = JK.col;
  const K = JK.kit2;
  const TAU = Math.PI * 2;
  const STAGE = new T.Vector3(60, 0, 0);
  const ORDER = [3, 1, 0, 2, 4]; // 왼쪽부터 몇 등 자리인가(0 = 1등)
  const HEIGHT = [1.25, 0.95, 0.75, 0.52, 0.4];
  const TOPC = ['#f2c14e', '#d5dbe0', '#d99a5e', '#9fc7d8', '#b8d89a'];
  const DS = 1.45;

  function crown() {
    const b = new JK.Builder();
    const g = col('#f2c14e'),
      gd = col('#c8902a');
    b.cyl(0, 0, 0, 0.16, 0.17, 0.08, 10, gd, { top: g, noTop: true });
    for (let i = 0; i < 5; i++) {
      const u = (i / 5) * TAU;
      b.push().t(Math.cos(u) * 0.15, 0.07, Math.sin(u) * 0.15);
      b.cyl(0, 0, 0, 0.045, 0, 0.11, 4, g);
      b.ball(0, 0.12, 0, 0.022, 0, col('#ffe08a'));
      b.pop();
    }
    b.ball(0, 0.05, 0.17, 0.03, 0, col('#e2475a'), 1.2);
    return b.build();
  }

  JK.Podium = {
    STAGE,
    build(scene, labelLayer, labels) {
      const g = new T.Group();
      g.position.copy(STAGE);
      scene.add(g);
      const b = new JK.Builder();
      // 둥근 무대 섬
      b.ao(-0.4, 0.5, 0.7);
      b.cyl(0, -0.4, 0, 6.2, 6.3, 0.4, 56, col('#b98457'), { top: col('#9ccc72') });
      b.cyl(0, -1.5, 0, 4.2, 6.2, 1.1, 56, col('#a87449'));
      b.cyl(0, -2.8, 0, 0.0, 4.2, 1.3, 56, col('#7f5637'));
      b.ao(0, 0, 1);
      // 단상 다섯
      const W = 1.75;
      ORDER.forEach((rank, i) => {
        const x = (i - 2) * (W + 0.12);
        const h = HEIGHT[rank];
        const top = col(TOPC[rank]);
        b.box(x, h / 2, 0.4, W, h, 1.5, col('#e9d6b0'), { top });
        b.box(x, h - 0.03, 0.4, W + 0.06, 0.08, 1.56, top.clone().multiplyScalar(0.85), { top });
      });
      g.add(K.mesh(b.build(), K.MATD));
      // 뒤 금 더미와 나무
      const pile = K.mesh(JK.goldPile(5, 1.5), JK.GOLD_MAT);
      pile.position.set(0, -0.05, -2.6);
      g.add(pile);
      const pine = JK.pineTree(),
        round = JK.roundTree();
      const rng = JK.rng(31);
      const LEAF = ['#5f9a5a', '#78b060', '#4f8a55', '#8cbf62'];
      for (const [geo, keep] of [[pine, (i) => i % 3], [round, (i) => !(i % 3)]]) {
        const ids = [...Array(14).keys()].filter(keep);
        const im = new T.InstancedMesh(geo, JK.MAT, ids.length);
        ids.forEach((i, k) => {
          const u = Math.PI * 1.08 + (i / 13) * Math.PI * 0.84;
          const r = 4.6 + rng() * 1.2;
          const sc = 1.8 + rng() * 0.8;
          im.setMatrixAt(k, new T.Matrix4().compose(new T.Vector3(Math.cos(u) * r, -0.02, Math.sin(u) * r), new T.Quaternion().setFromAxisAngle(new T.Vector3(0, 1, 0), rng() * TAU), new T.Vector3(sc, sc, sc)));
          im.setColorAt(k, col(LEAF[i % 4]));
        });
        im.castShadow = true;
        g.add(im);
      }
      // 꽃가루(색종이)
      const confGeo = new T.PlaneGeometry(0.09, 0.05);
      const CC = ['#e2475a', '#3fa7e0', '#5fd08a', '#f2c14e', '#b06ae0', '#ff9a52'];
      const conf = new T.InstancedMesh(confGeo, new T.MeshBasicMaterial({ side: T.DoubleSide }), 120);
      const cd = [];
      for (let i = 0; i < 120; i++) {
        cd.push({ x: (rng() - 0.5) * 11, y: rng() * 7, z: (rng() - 0.5) * 4 + 0.5, sp: 0.6 + rng() * 0.8, ph: rng() * TAU });
        conf.setColorAt(i, col(CC[i % CC.length]));
      }
      g.add(conf);

      const crownGeo = crown();
      const crownM = K.mesh(crownGeo, JK.GOLD_MAT);
      g.add(crownM);
      const slots = ORDER.map((rank, i) => ({ rank, x: (i - 2) * (W + 0.12), y: HEIGHT[rank] }));
      let dolls = [];
      const plates = [];
      for (let r = 0; r < 5; r++) {
        const el = document.createElement('div');
        el.className = 'podplate';
        labelLayer.appendChild(el);
        const o = new T.Object3D();
        g.add(o);
        plates.push({ el, o });
        labels.push({ el, obj: o, dy: 0, view: 'game', below: true });
      }
      const DANCE = ['hop', 'spin', 'sway', 'wave', 'twist'];
      // 춤마다 팔 자세와 얼굴 (rig.js). 얼굴은 두 가지를 오간다.
      const MOVE = { hop: ['cheer', 'happy', 'shout'], spin: ['spin', 'shout', 'happy'], sway: ['sway', 'joy', 'happy'], wave: ['wave', 'happy', 'joy'], twist: ['clap', 'joy', 'happy'] };
      /* ===== 순위 바뀜 연출 (작업/담임피드백.md) =====
       * 1등 자리부터 차례로 정리한다(올라갈 아이가 먼저 차이는 일이 없게).
       *  - 올라오는 아이(새로 들어옴·등수 오름): 높이 뛰어 다른 아이 머리 위로 넘어가 목표 자리에 내려앉으며 그 자리 아이를 찬다.
       *  - 차인 아이가 아직 5등 안이면: 단상 앞 땅으로 굴러떨어졌다가, 땅을 걸어 새 자리 앞으로 가서 올라간다
       *    (그 자리에 내려갈 아이가 있으면 밀어내고, 올라갈 아이가 아직 있으면 앞에서 기다린다).
       *  - 5등 밖으로 밀려난 아이만 「뻥!」 하고 섬 밖으로 날아간다.
       * 움직이는 동안 이름판은 숨기고, 모두 자리 잡으면 다시 보인다.
       */
      const GROUND_Z = 2.35; // 단상 앞 땅
      const slotOf = (r) => slots.find((q) => q.rank === r);
      const slotPos = (r) => new T.Vector3(slotOf(r).x, slotOf(r).y, 0.35);
      let laneN = 0; // 땅을 걷는 아이끼리 겹치지 않게 줄을 나눈다
      const frontOf = (x, lane) => new T.Vector3(x, 0, GROUND_Z + (lane || 0) * 0.6);
      let cast = []; // 이번 연출에 나오는 모든 인형
      let occ = [null, null, null, null, null]; // 지금 그 자리에 서 있는 인형
      let acts = []; // 차례를 기다리는 올라오는 아이
      let actBusy = false,
        nextActAt = 0,
        settled = true,
        kidOf = new Map(),
        crownOn = null,
        crownAt = 0,
        introMode = false;
      let clock = 0;
      function pow(pos, text) {
        const el = document.createElement('div');
        el.className = 'pow';
        el.textContent = text;
        labelLayer.appendChild(el);
        const o = new T.Object3D();
        o.position.copy(pos).add(new T.Vector3(0, 1.2, 0.4));
        g.add(o);
        const L = { el, obj: o, dy: 0, view: 'game', center: true };
        labels.push(L);
        setTimeout(() => {
          el.remove();
          g.remove(o);
          labels.splice(labels.indexOf(L), 1);
        }, 1000);
      }
      function showPlates(on) {
        for (let r = 0; r < 5; r++) {
          const m = occ[r];
          const kid = m && kidOf.get(m);
          const p = plates[r];
          const sl = slotOf(r);
          p.o.position.set(sl.x, sl.y + 0.02, 1.2);
          p.el.className = 'podplate r' + (r + 1) + (on && kid ? '' : ' hide');
          if (kid && kid.tag) p.el.innerHTML = '<em>' + kid.tag + '</em><b>' + kid.nick + '</b>';
          else if (kid) p.el.innerHTML = '<em>' + (kid.rank || r + 1) + '등</em><b>' + kid.nick + '</b><span><i class="coin"></i>' + kid.gold.toLocaleString() + '</span>';
        }
      }
      // 움직임 하나: from(지금 자리) → to, arc 높이, spin 구르기, at(k) 중간 일, done 끝 일
      function move(m, o) {
        const u = m.userData;
        u.mv = Object.assign({ t0: clock, from: m.position.clone(), arc: 0, spin: 0, lean: 0 }, o);
        if (o.pose) u.pose(o.pose);
        if (o.face) u.face((u.curFace = o.face));
        if (u.slot !== undefined && u.slot !== null && occ[u.slot] === m) occ[u.slot] = null;
        u.slot = null;
        settled = false;
      }
      function landOn(m, r) {
        const u = m.userData;
        u.slot = r;
        u.s = slotOf(r);
        occ[r] = m;
        m.position.copy(slotPos(r));
      }
      // 차이기: 5등 밖이면 섬 밖으로, 아니면 앞 땅으로 굴러떨어짐
      function kick(X, big) {
        const u = X.userData;
        if (u.tgt < 0) {
          const sx = X.position.x >= 0 ? 1 : -1;
          pow(X.position, '뻥!');
          move(X, { to: new T.Vector3(X.position.x + sx * 8, -7, 6), dur: 1.8, arc: 4.5, spin: 8 * -sx, pose: 'wow', face: 'wow', kind: 'out', done: () => ((u.gone = true), g.remove(X)) });
          return;
        }
        pow(X.position, big ? '뻥!' : '쿵!');
        u.lane = laneN++ % 3;
        move(X, { to: frontOf(X.position.x, u.lane), dur: 0.75, arc: 0.9, spin: 0, lean: 1, pose: 'wow', face: 'wow', kind: 'tumble', done: () => (u.state = 'walk') });
      }
      // 올라오는 아이의 차례
      function startAct(A) {
        const u = A.userData;
        actBusy = true;
        if (u.state === 'off') {
          A.visible = true;
          // 새 친구: 섬 아래에서 앞 땅으로 뛰어올라 온 다음
          move(A, { to: frontOf(slotOf(u.tgt).x), dur: 0.8, arc: 2.2, pose: 'wow', face: 'shout', kind: 'enter', done: () => leap(A) });
          return;
        }
        leap(A);
      }
      function leap(A) {
        const u = A.userData,
          r = u.tgt;
        const dist = Math.abs(A.position.x - slotOf(r).x) / 1.87;
        const X = occ[r] && occ[r] !== A ? occ[r] : null;
        move(A, {
          to: slotPos(r),
          dur: 1.15 + dist * 0.15,
          arc: 2.4 + dist * 0.35,
          pose: 'spin',
          face: 'shout',
          kind: 'leap',
          at: 0.6,
          atFn: () => X && occ[r] === X && kick(X, true),
          done: () => {
            landOn(A, r);
            u.react = { pose: 'cheer', face: 'happy', until: clock + 1.5 };
            u.state = 'home';
            if (!introMode) {
              actBusy = false;
              nextActAt = clock + 0.7;
            }
          },
        });
      }
      // 땅을 걷는 아이: 새 자리 앞까지 걸어가서, 자리가 비면(또는 내려갈 아이면 밀고) 올라간다
      function stepWalker(m) {
        const u = m.userData;
        const fx = slotOf(u.tgt).x;
        if (Math.abs(m.position.x - fx) > 0.05) {
          const d = Math.abs(m.position.x - fx);
          move(m, { to: frontOf(fx, u.lane), dur: 0.35 + d / 2.4, arc: 0, pose: 'droop', face: 'sad', kind: 'walk', done: () => (u.state = 'walk') });
          return;
        }
        const Y = occ[u.tgt];
        if (Y && Y !== m && Y.userData.tgt >= 0 && Y.userData.tgt < u.tgt) {
          u.state = 'wait'; // 올라갈 아이가 아직 있다: 기다림
          return;
        }
        move(m, {
          to: slotPos(u.tgt),
          dur: 0.75,
          arc: 0.9,
          pose: 'droop',
          face: 'sad',
          kind: 'hop',
          at: 0.6,
          atFn: () => Y && Y !== m && occ[u.tgt] === Y && kick(Y, false),
          done: () => {
            landOn(m, u.tgt);
            u.react = { pose: 'droop', face: 'sad', until: clock + 1.6 };
            u.state = 'home';
          },
        });
      }
      // 연출이 남아 있으면 끝 자리로 바로
      function finishAll() {
        for (const m of cast) {
          const u = m.userData;
          u.mv = null;
          if (u.tgt < 0 || u.gone) {
            g.remove(m);
            continue;
          }
        }
        occ = [null, null, null, null, null];
        for (const m of dolls) landOn(m, m.userData.tgt), (m.userData.state = 'home'), (m.visible = true);
        acts = [];
        actBusy = false;
        settled = true;
      }
      function setTop(kids) {
        finishAll();
        const top = kids.slice(0, 5);
        const bySid = new Map(dolls.map((d) => [d.userData.sid, d]));
        const intro = !dolls.length;
        const next = [];
        kidOf = new Map();
        top.forEach((kid, r) => {
          const sid = kid.sid || kid.nick;
          let m = bySid.get(sid);
          if (!m) {
            m = JK.makeRig(kid.avatar);
            m.scale.setScalar(DS);
            Object.assign(m.userData, { sid, state: 'off', slot: null, s: null });
            m.position.set(slotOf(r).x, -3, 6.5); // 섬 앞 아래(화면 밖)
            m.visible = false;
            g.add(m);
          }
          m.userData.tgt = r;
          m.userData.dance = r === 0 ? 'hop' : DANCE[1 + ((kid.avatar + r) % (DANCE.length - 1))];
          m.userData.ph = r * 1.3;
          kidOf.set(m, kid);
          next.push(m);
        });
        for (const d of dolls) if (!next.includes(d)) d.userData.tgt = -1;
        cast = dolls.concat(next.filter((m) => !dolls.includes(m)));
        // 올라오는 아이: 1등 자리부터
        acts = next.filter((m) => m.userData.state === 'off' || m.userData.tgt < m.userData.slot).sort((a, b) => a.userData.tgt - b.userData.tgt);
        if (intro) acts.reverse(); // 처음엔 5등부터 차례로 뛰어오른다
        introMode = intro;
        dolls = next;
        settled = !acts.length && cast.every((m) => m.userData.tgt === m.userData.slot);
        nextActAt = clock + 0.3;
        crownOn = null;
        showPlates(settled);
      }
      const mm = new T.Matrix4(),
        q = new T.Quaternion(),
        e = new T.Euler(),
        one = new T.Vector3(1, 1, 1);
      let lastNow = 0;
      function stepMove(m, now) {
        const u = m.userData,
          o = u.mv;
        const k = Math.min(1, (now - o.t0) / o.dur);
        const ease = o.kind === 'out' || o.kind === 'walk' ? k : k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
        m.position.lerpVectors(o.from, o.to, ease);
        m.position.y += Math.sin(k * Math.PI) * o.arc;
        m.rotation.set(0, 0, 0);
        m.scale.setScalar(DS);
        if (o.kind === 'walk') {
          m.position.y += Math.abs(Math.sin(k * o.dur * 9)) * 0.12; // 터벅터벅
          m.rotation.z = Math.sin(k * o.dur * 9) * 0.08;
        } else if (o.kind === 'leap') m.rotation.x = Math.sin(k * Math.PI) * 0.45; // 몸을 숙여 돌진
        else if (o.kind === 'tumble') m.rotation.x = k * Math.PI * 2; // 앞으로 한 바퀴 구름
        else if (o.kind === 'out') {
          m.rotation.z = k * o.spin;
          m.rotation.x = k * 3;
        }
        if (o.at && !o.atDone && k >= o.at) {
          o.atDone = true;
          o.atFn();
        }
        if (k >= 1) {
          u.mv = null;
          m.rotation.set(0, 0, 0);
          if (o.done) o.done();
        }
      }
      function update(now) {
        const dt = Math.max(0, Math.min(0.1, now - lastNow));
        lastNow = now;
        clock = now;
        // 감독: 다음 올라오는 아이
        if (!actBusy && acts.length && now >= nextActAt) {
          startAct(acts.shift());
          if (introMode) {
            actBusy = false; // 처음엔 겹쳐서 빠르게
            nextActAt = now + 0.45;
          }
        }
        let moving = false;
        for (const m of cast) {
          const u = m.userData;
          if (u.gone) continue;
          u.update(now + (u.ph || 0), dt);
          if (u.mv) {
            stepMove(m, now);
            moving = true;
            continue;
          }
          if (u.state === 'walk' || u.state === 'wait') {
            moving = true;
            stepWalker(m);
            if (u.mv) continue;
            // 기다리는 중: 제자리에서 발 동동
            m.rotation.set(0, 0, 0);
            m.position.y = Math.abs(Math.sin(now * 6)) * 0.06;
            continue;
          }
          if (u.state === 'off') continue; // 아직 차례 아님(화면 밖)
          // 차례가 끝났는데 아직 자기 자리가 아닌 아이(내려갈 자리를 아무도 비워 주지 않을 때): 스스로 내려온다
          if (!acts.length && !actBusy && u.slot !== null && u.tgt !== u.slot && !u.mv) {
            if (u.tgt < 0) kick(m, true);
            else move(m, { to: frontOf(m.position.x, (u.lane = laneN++ % 3)), dur: 0.7, arc: 0.6, pose: 'droop', face: 'sad', kind: 'hop', done: () => (u.state = 'walk') });
            continue;
          }
          if (u.slot === null) continue;
          // 자리에서 춤
          const t = now * 2.4 + u.ph;
          const reacting = u.react && now < u.react.until;
          const fc = reacting ? u.react.face : MOVE[u.dance][1 + (Math.floor((now + u.ph) / 1.6) % 2)];
          if (u.curFace !== fc) u.face((u.curFace = fc));
          u.pose(reacting ? u.react.pose : MOVE[u.dance][0]);
          m.rotation.set(0, 0, 0);
          m.scale.setScalar(DS);
          m.position.copy(slotPos(u.slot));
          if (reacting) {
            if (u.react.face === 'sad') m.rotation.z = Math.sin(now * 3) * 0.05;
            else m.position.y += Math.abs(Math.sin(now * 7)) * 0.3;
            continue;
          }
          if (!settled) continue; // 연출 중엔 가만히 서서 본다
          const k = DS;
          if (u.dance === 'hop') {
            const h = Math.abs(Math.sin(t * 1.3));
            m.position.y += h * 0.45;
            const sq = 1 - (1 - h) * 0.12;
            m.scale.set(k / Math.sqrt(sq), k * sq, k / Math.sqrt(sq));
          } else if (u.dance === 'spin') {
            m.rotation.y = t * 1.6;
            m.position.y += Math.abs(Math.sin(t * 3.2)) * 0.12;
          } else if (u.dance === 'sway') {
            m.rotation.z = Math.sin(t * 1.4) * 0.22;
            m.position.x += Math.sin(t * 1.4) * 0.12;
          } else if (u.dance === 'wave') {
            m.rotation.z = Math.sin(t * 2.6) * 0.12;
            m.rotation.y = Math.sin(t * 1.3) * 0.5;
            m.position.y += Math.abs(Math.sin(t * 2.6)) * 0.08;
          } else {
            m.rotation.y = Math.sin(t * 2.0) * 0.8;
            m.position.y += Math.abs(Math.sin(t * 4.0)) * 0.1;
          }
        }
        // 다 끝났나: 이름판 다시, 나간 아이 정리
        if (!settled && !moving && !acts.length && !actBusy && dolls.every((m) => m.userData.slot === m.userData.tgt)) {
          settled = true;
          cast = dolls.slice();
          showPlates(true);
        }
        // 왕관: 1등 자리에 자리 잡은 아이에게 위에서 떨어진다
        const lead = occ[0] && occ[0].userData.tgt === 0 && !occ[0].userData.mv ? occ[0] : null;
        if (lead !== crownOn) {
          crownOn = lead;
          crownAt = now;
        }
        crownM.visible = !!lead;
        if (lead) {
          const drop = Math.max(0, 1 - (now - crownAt) / 0.6);
          crownM.position.set(lead.position.x, lead.position.y + 1.24 * lead.scale.y + 0.06 + drop * drop * 3, lead.position.z);
          crownM.rotation.set(0, now * 1.5, Math.sin(now * 3) * 0.08);
        }
        for (let i = 0; i < cd.length; i++) {
          const c = cd[i];
          const y = 7 - ((now * c.sp * 0.6 + c.y) % 7.5);
          e.set(now * c.sp * 3 + c.ph, now * c.sp * 2, c.ph);
          q.setFromEuler(e);
          mm.compose(new T.Vector3(c.x + Math.sin(now + c.ph) * 0.3, y, c.z), q, one);
          conf.setMatrixAt(i, mm);
        }
        conf.instanceMatrix.needsUpdate = true;
      }
      // 새 판: 단상을 비운다(전 판 아이들이 남지 않게, 2026-11-03 담임)
      function reset() {
        for (const m of new Set(cast.concat(dolls))) g.remove(m);
        dolls = [];
        cast = [];
        acts = [];
        actBusy = false;
        occ = [null, null, null, null, null];
        kidOf = new Map();
        settled = true;
        crownOn = null;
        showPlates(false);
      }
      return { group: g, setTop, update, reset };
    },
  };
})();
