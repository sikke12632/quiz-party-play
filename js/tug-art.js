/* tug-art.js — 「줄다리기」 그림·소리 (전역 QP.TugArt). 작업/시안/줄다리기/tug.html 에서 옮김. 도트는 pixel-art.js 의 PX.
 *   박자표(drawLane): 작은 동그라미 「여」「엉」 → 큰 동그라미 「차!」 가 오른쪽에서 판정 원으로. 막판(19초~)은 노란 음표.
 *   팀 줄(drawTeam): 몸을 뒤로 젖히고 두 손으로 줄을 쥔 자세, 「차!」 순간 더 세게 젖힘. 밧줄(drawRope)·가운데 리본.
 *   소리(Web Audio): 딴(여)·딴(엉)·딴!(차) + 쿵·짝, 맞힘 「띵」, 헛손질 낮은 소리.
 */
(function () {
  'use strict';
  const QP = window.QP,
    PX = window.PX;
  const A = (QP.TugArt = {});

  /* ---------- 소리 ---------- */
  let ac = null;
  A.muted = false;
  A.audio = function () {
    if (A.muted) return null;
    if (!ac) {
      try {
        ac = new (window.AudioContext || window.webkitAudioContext)();
      } catch (e) {
        return null;
      }
    }
    if (ac.state === 'suspended') ac.resume();
    return ac;
  };
  function tone(at, f0, f1, dur, type, vol) {
    const a = A.audio();
    if (!a) return;
    const o = a.createOscillator(),
      g = a.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, at);
    o.frequency.exponentialRampToValueAtTime(f1, at + dur);
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(vol, at + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    o.connect(g).connect(a.destination);
    o.start(at);
    o.stop(at + dur + 0.02);
  }
  function noise(at, dur, vol, hp) {
    const a = A.audio();
    if (!a) return;
    const b = a.createBuffer(1, Math.floor(a.sampleRate * dur), a.sampleRate),
      d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
    const s = a.createBufferSource(),
      f = a.createBiquadFilter(),
      g = a.createGain();
    f.type = 'highpass';
    f.frequency.value = hp;
    g.gain.value = vol;
    s.buffer = b;
    s.connect(f).connect(g).connect(a.destination);
    s.start(at);
  }
  A.SND = {
    tick: (at, n) => {
      tone(at, n ? 660 : 520, n ? 640 : 500, 0.06, 'square', 0.07);
      noise(at, 0.03, 0.12, 3000);
    },
    cha: (at) => {
      tone(at, 150, 50, 0.18, 'sine', A.VOL ? A.VOL.drum : 0.6);
      noise(at, 0.09, 0.35, 1800);
      tone(at, 880, 860, 0.12, 'square', 0.09);
    },
    hit: (perfect) => {
      const a = A.audio();
      if (a) tone(a.currentTime, perfect ? 1320 : 990, perfect ? 1760 : 1320, 0.08, 'square', 0.08);
    },
    miss: () => {
      const a = A.audio();
      if (a) tone(a.currentTime, 180, 120, 0.12, 'sawtooth', 0.06);
    },
  };
  /* ---------- 목소리 「여엉~」「차!」 (선생님 화면·전자칠판용) ----------
   * sounds/tug-yeong.wav · sounds/tug-cha.wav (지금은 Windows 한국어 음성 Heami 로 만든 것. 선생님 목소리로 바꾸려면 같은 이름으로 넣기)
   * 「여엉」은 작게(VOL.yeong), 「차!」는 크게(VOL.cha). 막판(박자 간격 0.5초 미만)은 「여엉」 없이 「차!」만. */
  A.VOL = { yeong: 0.35, cha: 1.0, drum: 0.6 };
  A.voice = { yeong: null, cha: null };
  let voiceTried = false;
  A.loadVoice = function (base) {
    if (voiceTried) return;
    const a = A.audio();
    if (!a) return;
    voiceTried = true;
    for (const k of ['yeong', 'cha'])
      fetch((base || A.voiceBase || 'sounds/') + 'tug-' + k + '.wav')
        .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(r.status)))
        .then((buf) => a.decodeAudioData(buf))
        .then((ab) => (A.voice[k] = ab))
        .catch(() => {}); // 없으면 딴딴딴 소리만
  };
  function playBuf(ab, at, vol, rate) {
    const a = A.audio();
    if (!a || !ab) return;
    const s = a.createBufferSource(),
      g = a.createGain();
    s.buffer = ab;
    s.playbackRate.value = rate || 1;
    g.gain.value = vol;
    s.connect(g).connect(a.destination);
    s.start(Math.max(a.currentTime, at));
  }
  // 박자 소리 미리 걸기: 다음 0.15초 안 박자. st = { i: 다음에 걸 박자 번호 }. o.voice = 목소리도(선생님 화면)
  A.schedule = function (B, g, st, o) {
    const a = A.audio();
    if (!a) return;
    const voice = o && o.voice;
    while (st.i < B.length && B[st.i] - g < (voice ? 0.75 : 0.15)) {
      const b = B[st.i],
        gap = QP.tgGap(B, st.i);
      if (b - g > -0.05) {
        // 스피커까지 걸리는 시간만큼 일찍 낸다(전자칠판·블루투스 스피커 늦음 보정) + 손으로 맞춘 값(A.soundShift)
        const lat = (a.outputLatency || 0) + (a.baseLatency || 0) + (A.soundShift || 0);
        const at = a.currentTime + Math.max(0, b - g - lat);
        if (voice && A.voice.yeong && gap >= 0.5) {
          // 「여엉」: 여(첫 작은 동그라미)에서 시작해 차 바로 앞에서 끝나게 빠르기를 맞춤
          const room = gap * 0.6,
            rate = Math.min(1.6, Math.max(1, A.voice.yeong.duration / room));
          playBuf(A.voice.yeong, at - (gap * 2) / 3, A.VOL.yeong, rate);
        } else if (!voice || !A.voice.yeong) {
          A.SND.tick(Math.max(a.currentTime, at - (gap * 2) / 3), 0);
          A.SND.tick(Math.max(a.currentTime, at - gap / 3), 1);
        }
        if (voice && A.voice.cha) playBuf(A.voice.cha, at - 0.02, A.VOL.cha);
        A.SND.cha(at);
      }
      st.i++;
    }
  };

  /* ---------- 외침 글자: 여 → 여엉~ → 차! ---------- */
  A.callOf = function (B, g) {
    const i = B.findIndex((b) => b > g - 0.12);
    if (i < 0 || g < 0) return { txt: '', s: 1 };
    const b = B[i],
      gap = QP.tgGap(B, i),
      u = (g - (b - gap)) / gap;
    if (Math.abs(g - b) < 0.12) return { txt: '차!', s: 1.25 };
    if (u >= 2 / 3) return { txt: '여엉~', s: 0.95 };
    if (u >= 1 / 3) return { txt: '여', s: 0.8 };
    return { txt: '', s: 1 };
  };

  /* ---------- 박자표 ---------- */
  const NR = ['....yyyy....', '..yyYYYYyy..', '.yYYYYYYYYy.', '.yYYWWYYYYy.', 'yYYWWYYYYYYy', 'yYYYYYYYYYYy', 'yYYYYYYYYYYy', 'yYYYYYYYYYYy', '.yYYYYYYYYy.', '.yyYYYYYYyy.', '..yyyyyyyy..', '....yyyy....'];
  let NOTE, NOTEF, DOT;
  function init() {
    if (NOTE) return;
    NOTE = PX.make(NR, { y: '#b8402a', Y: '#ff7a5a', W: '#ffffff' }, '#3a1008');
    NOTEF = PX.make(NR, { y: '#c88a00', Y: '#ffd23e', W: '#ffffff' }, '#3a2a00');
    DOT = PX.make(['..ww..', '.wWWw.', 'wWWWWw', 'wWWWWw', '.wWWw.', '..ww..'], { w: '#ffd9a8', W: '#fff6e8' }, '#3a2a20');
  }
  const HIT_X = 34,
    APPROACH = 1.5,
    LW = 320,
    LH = 64;
  A.LANE = { W: LW, H: LH };
  // c = 320×64 캔버스. J = 판정기(QP.TugJudge, 아이 화면) 또는 null(TV). fx = 맞힌 순간 빛(0~0.1)
  A.drawLane = function (c, B, g, J, fx) {
    init();
    const H = LH;
    c.fillStyle = '#3a2a20';
    c.fillRect(0, 0, LW, H);
    c.fillStyle = '#5a4636';
    c.fillRect(0, 8, LW, H - 16);
    c.fillStyle = '#6b5442';
    for (let x = -((Math.max(0, g) * 60) % 16); x < LW; x += 16) c.fillRect(Math.round(x), 8, 8, H - 16);
    let pulse = 0;
    for (let i = 0; i < B.length; i++) {
      const gp = QP.tgGap(B, i);
      if (Math.abs(g - B[i]) < 0.06) pulse = 3;
      else if (!pulse && (Math.abs(g - (B[i] - gp / 3)) < 0.04 || Math.abs(g - (B[i] - (gp * 2) / 3)) < 0.04)) pulse = 1;
    }
    c.strokeStyle = '#fff';
    c.lineWidth = 2;
    c.beginPath();
    c.arc(HIT_X, H / 2, 15 + pulse, 0, Math.PI * 2);
    c.stroke();
    c.strokeStyle = 'rgba(255,255,255,.35)';
    c.beginPath();
    c.arc(HIT_X, H / 2, 20 + pulse, 0, Math.PI * 2);
    c.stroke();
    const X = (t) => HIT_X + ((t - g) / APPROACH) * (LW - HIT_X - 10);
    B.forEach((b, i) => {
      const dt = b - g;
      if (dt > APPROACH + 0.8 || dt < -0.25) return;
      const gap = QP.tgGap(B, i);
      for (const f of [2 / 3, 1 / 3]) {
        const tx = X(b - gap * f);
        if (tx < HIT_X - 4 || tx > LW + 4) continue;
        c.drawImage(DOT, Math.round(tx - DOT.width / 2), Math.round(H / 2 - DOT.height / 2));
      }
      if (dt > APPROACH) return;
      const jd = J ? J.judged[i] : null;
      if (jd !== null && jd > 0) return; // 맞힌 음표는 사라짐
      const x = X(b),
        img = QP.tgSpurt(b) ? NOTEF : NOTE;
      c.globalAlpha = jd === 0 ? 0.35 : 1;
      c.drawImage(img, Math.round(x - img.width / 2), Math.round(H / 2 - img.height / 2));
      c.globalAlpha = 1;
      if (J && J.lost[i]) {
        c.fillStyle = '#e8504a';
        for (let k = -5; k <= 5; k++) {
          c.fillRect(Math.round(x + k), Math.round(H / 2 + k), 2, 2);
          c.fillRect(Math.round(x + k), Math.round(H / 2 - k), 2, 2);
        }
      }
    });
    if (fx > 0) {
      c.fillStyle = 'rgba(255,240,160,' + Math.min(0.6, fx * 6) + ')';
      c.beginPath();
      c.arc(HIT_X, H / 2, 20, 0, Math.PI * 2);
      c.fill();
    }
  };

  /* ---------- 줄다리기 자세 ---------- */
  const pullCache = new Map();
  function pullSprite(an, cl, lean) {
    const key = an + cl + '|' + lean;
    if (pullCache.has(key)) return pullCache.get(key);
    const src = PX.kid(an, cl)[0],
      w = src.width,
      h = src.height;
    const c = document.createElement('canvas');
    c.width = w + lean + 3;
    c.height = h;
    const g = c.getContext('2d');
    for (let y = 0; y < h; y++) g.drawImage(src, 0, y, w, 1, Math.round(lean * (y / (h - 1))), y, w, 1);
    const ay = 13,
      ax = Math.round(lean * (ay / (h - 1))) + w - 3;
    g.fillStyle = '#3a2a20';
    g.fillRect(ax, ay - 1, 4, 4);
    g.fillStyle = '#f1d5ad';
    g.fillRect(ax, ay, 3, 2);
    const out = { c, handX: ax + 3, handY: ay, w: c.width, h };
    pullCache.set(key, out);
    return out;
  }
  // 한 팀 줄 서기. o = { cx: 가운데, ground: 발 높이, side: 0 왼쪽 | 1 오른쪽, list: [{an, cl, me}], B, g, px, gap, zig, mark: 「나」 표시 }
  A.drawTeam = function (c, o) {
    const px = o.px || 1,
      gap = o.gap,
      zig = o.zig || 0,
      g = o.g;
    let since = 9;
    for (const b of o.B) if (g - b >= 0 && g - b < since) since = g - b;
    const pull = since < 0.18;
    const hands = [];
    let ropeY = o.ground;
    const order = o.list.map((k, j) => j).sort((a, b) => (zig ? (b % 2) - (a % 2) : 0) || b - a);
    for (const j of order) {
      const k = o.list[j],
        backRow = zig && j % 2 === 1;
      const lean = pull ? 6 : 3 + (Math.floor(Math.max(0, g) * 3 + j) % 2);
      const P = pullSprite(k.an, k.cl || 0, lean);
      const x = o.cx + (o.side === 0 ? -1 : 1) * (10 * px + j * gap + (pull ? 2 : 0) * px);
      const top = Math.round(o.ground - (backRow ? zig : 0) - P.h * px);
      if (!backRow) ropeY = top + P.handY * px;
      c.save();
      if (o.side === 0) c.translate(Math.round(x) - P.handX * px, top);
      else {
        c.translate(Math.round(x) + P.handX * px, top);
        c.scale(-1, 1);
      }
      c.drawImage(P.c, 0, 0, P.w * px, P.h * px);
      c.restore();
      hands.push(Math.round(x));
      if (k.me && o.mark) {
        c.fillStyle = '#e8504a';
        c.fillRect(Math.round(x) - (o.side === 0 ? 8 : -6), top - 4, 4, 3);
      }
    }
    return { ropeY: ropeY + px, hands, px };
  };
  A.drawRope = function (c, x0, x1, y, rows, center) {
    const q = (rows[0] && rows[0].px) || 1;
    for (let x = x0; x < x1; x += q) {
      const t = (x / q + y) % 4;
      c.fillStyle = t < 2 ? '#a8763f' : '#7a5230';
      c.fillRect(x, y - q, q, q);
      c.fillStyle = t < 2 ? '#7a5230' : '#c9965a';
      c.fillRect(x, y, q, q);
      c.fillStyle = '#5a3a20';
      c.fillRect(x, y + q, q, q);
    }
    for (const r of rows)
      for (const hx of r.hands) {
        const p = r.px || 1;
        c.fillStyle = '#f1d5ad';
        c.fillRect(hx - p, y - p, 2 * p, 2 * p);
        c.fillStyle = '#d9b48a';
        c.fillRect(hx - p, y + p - 1, 2 * p, 1);
      }
    c.fillStyle = '#e8504a';
    c.fillRect(center - q, y + q, 3 * q, 7 * q);
    c.fillStyle = '#ff9a8a';
    c.fillRect(center - q, y + q, q, 6 * q);
  };

  /* ---------- 마당(TV 320×180) ---------- */
  let field = null;
  A.field = function () {
    if (field) return field;
    const c = document.createElement('canvas');
    c.width = 320;
    c.height = 180;
    const g = c.getContext('2d');
    const S = ['#7cc6ee', '#8bd0f2', '#9ad9f5', '#aae2f8'];
    for (let y = 0; y < 110; y++) {
      g.fillStyle = S[Math.min(3, Math.floor(y / 28))];
      g.fillRect(0, y, 320, 1);
    }
    g.fillStyle = '#9cc77a';
    for (let x = 0; x < 320; x++) {
      const h = 14 + Math.sin(x / 23) * 6 + Math.sin(x / 7) * 2;
      g.fillRect(x, 110 - h, 1, h);
    }
    g.fillStyle = '#8cc461';
    g.fillRect(0, 110, 320, 70);
    g.fillStyle = '#79b052';
    for (let i = 0; i < 300; i++) g.fillRect((i * 97) % 320, 112 + ((i * 53) % 66), 2, 1);
    g.fillStyle = '#e6cf93';
    g.fillRect(0, 138, 320, 22);
    g.fillStyle = '#fff';
    g.fillRect(70, 118, 2, 50);
    g.fillRect(248, 118, 2, 50);
    g.fillStyle = 'rgba(255,255,255,.7)';
    for (let y = 118; y < 168; y += 4) g.fillRect(159, y, 2, 2);
    field = c;
    return c;
  };
  // 팀 명단 → 그림용 목록. roster = 판 문서 roster, ta = 팀 번호, an = 동물 이름, meSid
  A.listOf = (roster, t, an, meSid) => (roster || []).filter((x) => x.team === t).map((x) => ({ an, cl: x.cl || 0, me: x.sid === meSid }));
})();
