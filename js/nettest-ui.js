/* nettest-ui.js — 실시간 시험방 화면 (nettest.html). 셈은 js/core/nettest.js
 *   nettest.html?host   선생님(방장): 방 열기 → 코드·QR → 시작(1분) → 기기별 표·판정 → 기록 지우기
 *   nettest.html        아이: 코드 → 번호 → 방향 버튼(또는 키보드 방향키)으로 움직이기
 *   nettest.html?bot&c=1234&num=5   시험용 가짜 아이(혼자 아무 데나 걸어다님)
 *   ?mock 가짜 서버(이 컴퓨터 안), ?emu 에뮬레이터
 */
(function () {
  'use strict';
  const QP = window.QP,
    NT = QP.NT,
    JK = window.JK;
  const P = new URLSearchParams(location.search);
  const HOST = P.has('host'),
    BOT = P.has('bot');
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const ui = $('ui');
  let net, host, kid;
  const COLORS = ['#e0574a', '#3d82c4', '#4ea65a', '#e8a92e', '#9b6bd1', '#e86fa0', '#2f9e9a', '#c47a3a'];
  const colorOf = (n) => COLORS[(parseInt(n) || 0) % COLORS.length];
  const shortUA = () => {
    const u = navigator.userAgent;
    const os = /Android/.test(u) ? 'Android' : /iPad|iPhone/.test(u) ? 'iOS' : /CrOS/.test(u) ? 'Chromebook' : /Windows/.test(u) ? 'Windows' : /Mac/.test(u) ? 'Mac' : 'Linux';
    const br = /Whale/.test(u) ? 'Whale' : /Edg\//.test(u) ? 'Edge' : /SamsungBrowser/.test(u) ? 'Samsung' : /Chrome\//.test(u) ? 'Chrome' : /Safari/.test(u) ? 'Safari' : 'Browser';
    return os + ' ' + br + ' ' + screen.width + 'x' + screen.height;
  };

  /* ---------- 마당 그리기: 2D(동그라미) / 3D(인형) ---------- */
  const cv = $('cv');
  const g2 = cv.getContext('2d');
  let gl = null; // 3D: {renderer, scene, camera, dolls:Map}
  let mode = 2;
  function fit() {
    const r = cv.parentElement.getBoundingClientRect();
    const k = Math.min(r.width / NT.W, r.height / NT.H);
    cv.style.width = NT.W * k + 'px';
    cv.style.height = NT.H * k + 'px';
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = Math.round(NT.W * k * dpr);
    cv.height = Math.round(NT.H * k * dpr);
    const c3 = $('cv3');
    c3.style.width = cv.style.width;
    c3.style.height = cv.style.height;
    if (gl) {
      gl.renderer.setSize(NT.W * k, NT.H * k, false);
      gl.camera.aspect = NT.W / NT.H;
      gl.camera.updateProjectionMatrix();
    }
  }
  window.addEventListener('resize', fit);
  // 그릴 것: [{n, x, y, me}]
  function draw2D(list) {
    const s = cv.width / NT.W;
    g2.fillStyle = '#e9dcbf';
    g2.fillRect(0, 0, cv.width, cv.height);
    g2.strokeStyle = 'rgba(120,90,50,.15)';
    g2.lineWidth = 1;
    for (let x = 0; x <= NT.W; x += 10) (g2.beginPath(), g2.moveTo(x * s, 0), g2.lineTo(x * s, cv.height), g2.stroke());
    for (let y = 0; y <= NT.H; y += 10) (g2.beginPath(), g2.moveTo(0, y * s), g2.lineTo(cv.width, y * s), g2.stroke());
    for (const d of list) {
      g2.beginPath();
      g2.arc(d.x * s, d.y * s, 2.2 * s, 0, Math.PI * 2);
      g2.fillStyle = colorOf(d.n);
      g2.fill();
      if (d.me) {
        g2.lineWidth = 0.6 * s;
        g2.strokeStyle = '#ffd23f';
        g2.stroke();
        g2.fillStyle = '#ffd23f';
        g2.beginPath();
        g2.moveTo(d.x * s, (d.y - 3) * s);
        g2.lineTo((d.x - 1.2) * s, (d.y - 5) * s);
        g2.lineTo((d.x + 1.2) * s, (d.y - 5) * s);
        g2.fill();
      }
      g2.fillStyle = '#fff';
      g2.font = 'bold ' + Math.round(1.8 * s) + 'px sans-serif';
      g2.textAlign = 'center';
      g2.textBaseline = 'middle';
      g2.fillText(String(d.n).replace('번', ''), d.x * s, d.y * s);
    }
  }
  function init3D() {
    if (gl || gl === false) return gl;
    try {
      const T = THREE;
      const c3 = $('cv3');
      const renderer = new T.WebGLRenderer({ canvas: c3, antialias: false });
      renderer.outputColorSpace = T.SRGBColorSpace;
      renderer.setPixelRatio(Math.min(1.5, window.devicePixelRatio || 1));
      const scene = new T.Scene();
      scene.background = new T.Color('#f3e3d3');
      scene.add(new T.HemisphereLight(0xd4e6ff, 0xe8dcbc, 1.2));
      const sun = new T.DirectionalLight(0xfff1d8, 2.2);
      sun.position.set(30, 60, 40);
      scene.add(sun);
      const ground = new T.Mesh(new T.PlaneGeometry(NT.W, NT.H), new T.MeshLambertMaterial({ color: '#a8cf78' }));
      ground.rotation.x = -Math.PI / 2;
      ground.position.set(NT.W / 2, 0, NT.H / 2);
      scene.add(ground);
      const camera = new T.PerspectiveCamera(42, NT.W / NT.H, 1, 500);
      camera.position.set(NT.W / 2, 78, NT.H / 2 + 52);
      camera.lookAt(NT.W / 2, 0, NT.H / 2 + 3);
      gl = { renderer, scene, camera, dolls: new Map(), ring: null };
      const ring = new T.Mesh(new T.RingGeometry(2.4, 3.1, 24), new T.MeshBasicMaterial({ color: '#ffd23f' }));
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.05;
      scene.add(ring);
      gl.ring = ring;
      fit();
      // 미리 한 번 그려 둔다(처음 그릴 때 멈칫하는 것을 재는 시간 밖으로)
      const warm = new T.Mesh(JK.makeAnimalDoll(1, 12), JK.MAT);
      scene.add(warm);
      renderer.render(scene, camera);
      scene.remove(warm);
    } catch (e) {
      console.warn('3D 안 됨', e);
      gl = false;
      if (kid) kid.fps3Fail = true;
    }
    return gl;
  }
  function draw3D(list) {
    const G = init3D();
    if (!G) return draw2D(list);
    const seen = new Set();
    for (const d of list) {
      const key = d.key;
      seen.add(key);
      let m = G.dolls.get(key);
      if (!m) {
        m = new THREE.Mesh(JK.makeAnimalDoll(parseInt(d.n) || 0, 12), JK.MAT);
        m.scale.setScalar(5.5);
        G.scene.add(m);
        G.dolls.set(key, m);
      }
      m.position.set(d.x, 0, d.y);
      m.rotation.z = Math.sin(NT.clock() / 160 + (parseInt(d.n) || 0)) * 0.08; // 흐느적
      if (d.me) G.ring.position.set(d.x, 0.05, d.y);
    }
    for (const [k, m] of G.dolls) if (!seen.has(k)) (G.scene.remove(m), G.dolls.delete(k));
    G.renderer.render(G.scene, G.camera);
  }
  function setMode(m) {
    if (m === mode) return;
    mode = m;
    cv.hidden = m === 3;
    $('cv3').hidden = m !== 3;
    if (m === 3) init3D();
    const lab = $('mode');
    if (lab) lab.textContent = m === 3 ? '3D 인형' : '2D 동그라미';
  }
  // 그리기 + 화면 수 재기
  let frames = 0,
    fpsT = NT.clock(),
    last = NT.clock();
  function frame() {
    const t = NT.clock();
    const dt = Math.min(0.05, (t - last) / 1000);
    last = t;
    let list = [];
    let room = null;
    if (kid) {
      kid.step(dt);
      room = kid.room;
      for (const uid of Object.keys(kid.view)) {
        const p = kid.friendAt(uid, t);
        const n = (room && room.pos && room.pos[uid] && kid.names[uid]) || '';
        list.push({ key: uid, n: kid.names[uid] || '?', x: p[0], y: p[1] });
      }
      list.push({ key: 'me', n: kid.n, x: kid.x, y: kid.y, me: true });
    } else if (host) {
      room = { phase: host.phase };
      for (const [uid, k] of Object.entries(host.kids)) if (typeof k.x === 'number') list.push({ key: uid, n: k.n, x: k.x, y: k.y });
    }
    // 앞 절반 2D, 뒤 절반 3D
    const run = kid ? kid.running && kid.room : host && host.phase === 'run';
    if (run) {
      const startAt = kid ? kid.room.startAt : host.startAt;
      const half = (kid ? kid.room.dur : host.dur) / 2;
      const el = (net.now() - startAt) / 1000;
      setMode(el > half ? 3 : 2);
      const tl = $('tl');
      if (tl) tl.textContent = Math.max(0, Math.ceil((kid ? kid.room.dur : host.dur) - el)) + '초';
    }
    if (mode === 3) draw3D(list);
    else draw2D(list);
    frames++;
    if (t - fpsT >= 1000) {
      const f = Math.round((frames * 1000) / (t - fpsT));
      frames = 0;
      fpsT = t;
      if (kid) kid.addFps(mode, f);
      const fe = $('fps');
      if (fe) fe.textContent = f;
      if (kid) liveKid();
    }
    requestAnimationFrame(frame);
  }

  /* ---------- 방향 버튼(누르고 있는 동안) + 키보드 방향키 ---------- */
  const held = { up: false, down: false, left: false, right: false };
  function applyInput() {
    if (!kid || BOT) return;
    let x = (held.right ? 1 : 0) - (held.left ? 1 : 0),
      y = (held.down ? 1 : 0) - (held.up ? 1 : 0);
    const l = Math.hypot(x, y) || 1;
    kid.input = { x: x / l, y: y / l };
  }
  function bindPad() {
    document.querySelectorAll('[data-dir]').forEach((b) => {
      const d = b.dataset.dir;
      const on = (e) => (e.preventDefault(), (held[d] = true), b.classList.add('on'), applyInput());
      const off = (e) => (e.preventDefault(), (held[d] = false), b.classList.remove('on'), applyInput());
      b.addEventListener('pointerdown', on);
      b.addEventListener('pointerup', off);
      b.addEventListener('pointercancel', off);
      b.addEventListener('pointerleave', off);
    });
  }
  const KEYS = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' };
  window.addEventListener('keydown', (e) => KEYS[e.key] && ((held[KEYS[e.key]] = true), e.preventDefault(), applyInput()));
  window.addEventListener('keyup', (e) => KEYS[e.key] && ((held[KEYS[e.key]] = false), applyInput()));

  /* ---------- 아이 화면 ---------- */
  function liveKid() {
    const s = kid.stats();
    const el = $('live');
    if (el) el.textContent = '왕복 ' + (s.rn ? (s.avg / 1000).toFixed(2) + '초' : '–') + ' · 끊김 ' + s.gaps + ' · FPS ' + ($('fps') ? $('fps').textContent : '');
  }
  let codeBuf = '';
  function kidCode(msg) {
    ui.innerHTML =
      '<div class="card"><h2>실시간 시험방</h2><p>선생님 화면의 <b>4자리 번호</b>를 눌러요</p><div class="code">' + [0, 1, 2, 3].map((i) => '<i>' + (codeBuf[i] || '') + '</i>').join('') + '</div>' +
      '<div class="pad">' + [1, 2, 3, 4, 5, 6, 7, 8, 9, '←', 0, '확인'].map((k) => '<button data-k="' + k + '">' + k + '</button>').join('') + '</div><p class="err">' + (msg || '') + '</p></div>';
  }
  function kidNum(code) {
    ui.innerHTML = '<div class="card"><h2>내 번호를 골라요</h2><div class="nums">' + QP.NUMS.map((n) => '<button data-num="' + n + '">' + n + '</button>').join('') + '</div></div>';
    ui.dataset.code = code;
  }
  async function kidJoin(code, num) {
    ui.innerHTML = '<div class="card"><p>들어가는 중…</p></div>';
    kid = new NT.Kid(net, { bot: BOT, ua: shortUA(), onUpdate: kidUpdate });
    kid.names = {};
    try {
      await kid.join(code, num + '번');
    } catch (e) {
      kid = null;
      codeBuf = '';
      return kidCode(e.message === '없는 방이에요' ? '그런 방이 없어요. 번호를 다시 봐요' : '들어가지 못했어요: ' + e.message);
    }
    ui.innerHTML =
      '<div class="top"><b>' + esc(num) + '번</b> <span id="st">선생님이 「시작」을 누르면 움직여요</span><span class="sp"></span><span id="mode">2D 동그라미</span> <b id="tl"></b> <small>FPS <b id="fps">–</b></small></div>' +
      '<div class="pads"><button data-dir="up">▲</button><button data-dir="left">◀</button><button data-dir="down">▼</button><button data-dir="right">▶</button></div>' +
      '<div class="live" id="live"></div>';
    bindPad();
    document.body.classList.add('playing');
    fit();
    setTimeout(init3D, 300); // 3D 를 미리 켜 둔다
  }
  let lastPhase = '';
  function kidUpdate(k) {
    const r = k.room || {};
    // 친구 이름(번호)은 방장이 pos 에 안 넣으므로, 처음 본 친구는 번호 없이 그린다 → 방 문서 names 가 있으면 쓴다
    if (r.names) Object.assign(k.names, r.names);
    if (r.phase !== lastPhase) {
      lastPhase = r.phase;
      const st = $('st');
      if (st) st.textContent = r.phase === 'run' ? '방향 버튼으로 움직여요!' : r.phase === 'end' ? '끝! 고마워요. 선생님 화면을 봐요' : '선생님이 「시작」을 누르면 움직여요';
    }
  }

  /* ---------- 선생님(방장) 화면 ---------- */
  function joinURL() {
    return location.href.replace(/[?#].*$/, '') + '?c=' + host.code + (QP.isMock ? '&mock' : P.has('emu') ? '&emu' : '');
  }
  async function hostOpen() {
    host = new NT.Host(net, { onUpdate: hostUpdate, dur: +P.get('dur') || undefined }); // ?dur=초 (시험용)
    await host.open();
    const qr = qrcode(0, 'M');
    qr.addData(joinURL());
    qr.make();
    ui.innerHTML =
      '<div class="top"><b>실시간 시험방</b> <span class="code sm">' + host.code.split('').map((c) => '<i>' + c + '</i>').join('') + '</span><span class="sp"></span><span id="mode">2D 동그라미</span> <b id="tl"></b></div>' +
      '<div class="side"><div class="qr">' + qr.createImgTag(3, 0) + '</div><p class="url">' + esc(joinURL().replace(/^https?:\/\//, '')) + '</p><p>들어온 기기 <b id="n">0</b>대</p><button class="go" id="go">시작 (1분)</button><div id="res"></div></div>';
    $('go').onclick = () => host.start();
    document.body.classList.add('playing');
    fit();
    setTimeout(init3D, 300);
  }
  function hostUpdate(h) {
    const n = $('n');
    if (n) n.textContent = Object.keys(h.kids).length;
    // 아이 화면이 친구 번호를 그릴 수 있게 이름표를 방 문서에 한 번씩(들어온 수가 바뀔 때만)
    const names = {};
    for (const [uid, k] of Object.entries(h.kids)) names[uid] = k.n;
    const sig = Object.keys(names).sort().join();
    if (sig !== h.nameSig) {
      h.nameSig = sig;
      h.w++;
      net.update(h.path(), { names }).catch(() => {});
    }
    const go = $('go');
    if (go) go.hidden = h.phase !== 'open';
    if (h.phase === 'end') drawResults(h);
  }
  function drawResults(h) {
    const { rows, sum } = h.results();
    const fmt = (ms) => (ms ? (ms / 1000).toFixed(2) : '–');
    $('res').innerHTML =
      '<h3>결과</h3><p class="verdict">' + esc(sum.verdict) + '</p>' +
      '<table><tr><th>번호</th><th>평균</th><th>95%</th><th>가장 느림</th><th>끊김</th><th>FPS 2D</th><th>FPS 3D</th><th>기기</th></tr>' +
      rows
        .map((x) => '<tr class="' + (x.rn ? (x.ok ? 'ok' : 'bad') : 'none') + '"><td>' + esc(x.n) + '</td><td>' + fmt(x.avg) + '</td><td>' + fmt(x.p95) + '</td><td>' + fmt(x.max) + '</td><td>' + (x.gaps || 0) + '</td><td>' + (x.fps2 || '–') + '</td><td>' + (x.fps3 > 0 ? x.fps3 : x.fps3 === -1 ? '안 됨' : '–') + '</td><td class="ua">' + esc(x.ua) + '</td></tr>')
        .join('') +
      '</table><p class="sm">기준: 평균 0.6초·가장 느림 1.5초 이하, FPS 30 이상, 끊김(1초 넘게 소식 없음) 2번 이하 · 결과 ' + sum.got + ' / ' + sum.n + '대<br>이 시험 쓰기 ' + sum.writes.toLocaleString() + ' · 읽기 ' + sum.reads.toLocaleString() + ' → 무료 한도로 하루 약 ' + sum.perDay + '번</p>' +
      '<button class="ghost" id="clean">시험 기록 지우기</button>';
    $('clean').onclick = async () => {
      await h.cleanup();
      $('res').innerHTML += '<p>지웠어요. 이 창은 닫아도 돼요.</p>';
    };
  }

  /* ---------- 시작 ---------- */
  ui.addEventListener('click', async (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.k !== undefined) {
      const k = b.dataset.k;
      if (k === '←') codeBuf = codeBuf.slice(0, -1);
      else if (k === '확인') return codeBuf.length === 4 ? kidNum(codeBuf) : kidCode('4자리를 눌러요');
      else if (codeBuf.length < 4) codeBuf += k;
      if (codeBuf.length === 4 && k !== '←') return kidNum(codeBuf);
      return kidCode();
    }
    if (b.dataset.num) return kidJoin(ui.dataset.code, b.dataset.num);
  });
  (async () => {
    try {
      net = await QP.connect(HOST ? 'teacher' : 'kid');
      await net.signIn('kid'); // 시험방은 선생님 구글 로그인 없이(방을 연 사람이 방장)
    } catch (e) {
      ui.innerHTML = '<div class="card"><h2>서버에 붙지 못했어요</h2><p>' + esc(e.message) + '</p></div>';
      return;
    }
    requestAnimationFrame(frame);
    if (HOST) {
      ui.innerHTML = '<div class="card"><h2>실시간 시험방</h2><p>학교 와이파이에서 디벗 움직임이 얼마나 빠른지 1분 동안 재요.</p><button class="go" id="open">시험방 열기</button></div>';
      $('open').onclick = hostOpen;
    } else if (P.get('c') && (BOT || P.get('num'))) kidJoin(P.get('c'), P.get('num') || QP.NUMS[Math.floor(Math.random() * QP.NUMS.length)]);
    else {
      codeBuf = P.get('c') || '';
      if (codeBuf.length === 4) kidNum(codeBuf);
      else kidCode();
    }
  })();
})();
