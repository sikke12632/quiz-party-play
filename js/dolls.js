/* dolls.js — 동물 모자를 쓴 목각 인형과 별명
 * 몸과 얼굴은 조선의 왕·타임머신 인형(JK.dollBase)과 같고, 머리에 동물 모자를 쓴다.
 * 별명 = 꾸미는 말 + 동물 이름 (예: "용감한 여우"). 아이가 고르지 않고 판마다 자동으로 정해진다.
 */
(function () {
  'use strict';
  const JK = window.JK;
  const col = JK.col;
  const K = JK.kit2;
  const HC = [0, 1.0, 0]; // 머리 가운데
  const HR = 0.228; // 모자 반지름

  // 얼굴 구멍을 뺀 모자 덮개
  function hood(b, color, detail) {
    K.partBall(b, HC[0], HC[1], HC[2] - 0.004, HR, detail || 2, color, (n) => !(n[2] > 0.28 && n[1] < 0.5) && n[1] > -0.5);
  }
  // 둥근 귀 (가운데 x,y,z / 반지름 / 앞으로 납작)
  function roundEar(b, x, y, z, r, c, inner, rz) {
    b.push().t(x, y, z).rz(rz || 0).s(1, 1, 0.55);
    b.ball(0, 0, 0, r, 1, c);
    if (inner) b.ball(0, -r * 0.08, r * 0.5, r * 0.62, 1, inner, 1);
    b.pop();
  }
  // 뾰족 귀
  function pointEar(b, x, y, z, w, h, c, inner, rz, rx, tip) {
    b.push().t(x, y, z).rz(rz || 0).rx(rx || 0);
    b.push().s(1, 1, 0.5);
    b.cyl(0, 0, 0, w, 0, h, 6, c);
    if (tip) b.cyl(0, h * 0.62, 0, w * 0.38, 0, h * 0.38, 6, tip);
    b.pop();
    if (inner) {
      b.push().t(0, 0.01, w * 0.3).s(1, 1, 0.25);
      b.cyl(0, 0, 0, w * 0.6, 0, h * 0.75, 6, inner);
      b.pop();
    }
    b.pop();
  }
  function beak(b, y, z, c, len) {
    b.push().t(0, y, z).rx(Math.PI / 2 - 0.15).s(1.3, 1, 0.7);
    b.cyl(0, 0, 0, 0.045, 0, len || 0.09, 6, c);
    b.pop();
  }
  const EARS_Y = 1.17,
    EARS_X = 0.145;

  const ANIMALS = [
    {
      key: 'bear',
      name: '곰',
      hood: '#a8754d',
      build(b, c) {
        hood(b, c);
        for (const sx of [-1, 1]) roundEar(b, sx * EARS_X, EARS_Y, -0.02, 0.08, c, col('#e7c39a'));
      },
    },
    {
      key: 'rabbit',
      name: '토끼',
      hood: '#f6f1ea',
      build(b, c) {
        hood(b, c);
        for (const sx of [-1, 1]) {
          b.push().t(sx * 0.085, 1.27, -0.04).rz(-sx * 0.18).rx(-0.15).s(1, 1, 0.5);
          b.ball(0, 0.1, 0, 0.065, 1, c, 2.4);
          b.ball(0, 0.1, 0.035, 0.04, 1, col('#f2a6ad'), 2.2);
          b.pop();
        }
      },
    },
    {
      key: 'cat',
      name: '고양이',
      hood: '#9aa4ae',
      build(b, c) {
        hood(b, c);
        for (const sx of [-1, 1]) pointEar(b, sx * 0.13, 1.16, -0.01, 0.075, 0.13, c, col('#f2b0b4'), -sx * 0.35);
        // 수염 대신 이마 줄무늬
        for (const dx of [-0.04, 0, 0.04]) b.box(dx, 1.19, 0.16, 0.018, 0.05, 0.02, col('#6f7882'));
      },
    },
    {
      key: 'fox',
      name: '여우',
      hood: '#e8823a',
      build(b, c) {
        hood(b, c);
        for (const sx of [-1, 1]) pointEar(b, sx * 0.135, 1.15, -0.02, 0.085, 0.17, c, col('#fbeee0'), -sx * 0.32, 0, col('#4a3426'));
      },
    },
    {
      key: 'frog',
      name: '개구리',
      hood: '#6dbb5a',
      build(b, c) {
        hood(b, c);
        for (const sx of [-1, 1]) {
          b.ball(sx * 0.095, 1.19, 0.07, 0.072, 1, c);
          b.ball(sx * 0.095, 1.2, 0.115, 0.05, 1, col('#fbfbf4'));
          b.ball(sx * 0.095, 1.2, 0.155, 0.025, 1, col('#2a1d16'));
        }
      },
    },
    {
      key: 'chick',
      name: '병아리',
      hood: '#f7d14c',
      build(b, c) {
        hood(b, c);
        beak(b, 1.17, 0.17, col('#f08a2c'));
        for (const [dx, rz] of [[-0.03, 0.4], [0, 0], [0.03, -0.4]]) {
          b.push().t(dx, 1.21, -0.01).rz(rz).s(1, 1, 0.5);
          b.cyl(0, 0, 0, 0.03, 0, 0.1, 5, c);
          b.pop();
        }
      },
    },
    {
      key: 'panda',
      name: '판다',
      hood: '#f7f5f0',
      build(b, c) {
        hood(b, c);
        const k = col('#2c2a2e');
        for (const sx of [-1, 1]) roundEar(b, sx * EARS_X, EARS_Y, -0.02, 0.075, k);
        // 이마 위 까만 눈 무늬(모자 장식)
        for (const sx of [-1, 1]) {
          b.push().t(sx * 0.06, 1.165, 0.165).rz(sx * 0.5).s(1, 0.7, 0.4);
          b.ball(0, 0, 0, 0.04, 1, k);
          b.pop();
        }
      },
    },
    {
      key: 'tiger',
      name: '호랑이',
      hood: '#f0953a',
      build(b, c) {
        const k = col('#3a2a22');
        hood(b, (n) => (n[1] > 0.25 && Math.abs(Math.sin(n[0] * 9.0)) < 0.28 && n[2] < 0.8 ? k : c));
        for (const sx of [-1, 1]) roundEar(b, sx * EARS_X, EARS_Y - 0.01, -0.02, 0.07, c, col('#fbeee0'));
      },
    },
    {
      key: 'penguin',
      name: '펭귄',
      hood: '#34445e',
      build(b, c) {
        hood(b, c);
        beak(b, 1.16, 0.17, col('#f3b33d'), 0.08);
      },
    },
    {
      key: 'sheep',
      name: '양',
      hood: '#f3ead8',
      build(b, c) {
        hood(b, c);
        // 복슬복슬 털 뭉치
        const rng = JK.rng(7);
        for (let i = 0; i < 14; i++) {
          const u = (i / 14) * Math.PI * 2;
          const up = 0.35 + 0.5 * rng();
          const nx = Math.cos(u) * Math.sqrt(1 - up * up),
            nz = Math.sin(u) * Math.sqrt(1 - up * up);
          if (nz > 0.3 && up < 0.6) continue;
          b.ball(nx * HR, HC[1] + up * HR, nz * HR, 0.06 + rng() * 0.02, 1, c);
        }
        b.ball(0, 1.22, 0.02, 0.07, 1, c);
        for (const sx of [-1, 1]) {
          b.push().t(sx * 0.22, 1.05, 0).rz(sx * 1.2).s(1, 1, 0.5);
          b.ball(0, 0, 0, 0.05, 1, col('#5c4a3e'), 1.6);
          b.pop();
        }
      },
    },
    {
      key: 'deer',
      name: '사슴',
      hood: '#c08850',
      build(b, c) {
        hood(b, c);
        const ant = col('#f0dcb4');
        for (const sx of [-1, 1]) {
          b.cylAB([sx * 0.08, 1.2, -0.02], [sx * 0.12, 1.36, -0.03], 0.018, 0.014, 5, ant);
          b.cylAB([sx * 0.11, 1.29, -0.025], [sx * 0.19, 1.34, -0.02], 0.013, 0.01, 5, ant);
          pointEar(b, sx * 0.2, 1.1, -0.02, 0.05, 0.11, c, col('#f6d9bd'), -sx * 1.15);
        }
        // 이마 흰 점
        b.ball(0, 1.2, 0.16, 0.022, 0, col('#fbeee0'), 0.6);
      },
    },
    {
      key: 'pig',
      name: '돼지',
      hood: '#f3a6b2',
      build(b, c) {
        hood(b, c);
        for (const sx of [-1, 1]) pointEar(b, sx * 0.13, 1.17, 0.0, 0.07, 0.1, c, col('#e98796'), -sx * 0.5, 0.6);
        b.push().t(0, 1.17, 0.18).rx(Math.PI / 2 - 0.25);
        b.cyl(0, 0, 0, 0.045, 0.045, 0.04, 10, col('#ec93a1'), { top: col('#f7b9c3') });
        b.pop();
      },
    },
    {
      key: 'dino',
      name: '공룡',
      hood: '#5fae8a',
      build(b, c) {
        hood(b, c);
        const sp = col('#f2a33a');
        for (let i = 0; i < 5; i++) {
          const a = -0.25 + i * 0.42; // 앞 위 → 뒤
          const y = HC[1] + Math.cos(a) * HR,
            z = Math.sin(-a) * HR * -1;
          b.push().t(0, y - 0.01, -z).rx(-a).s(0.45, 1, 1);
          b.cyl(0, 0, 0, 0.05 - i * 0.004, 0, 0.09 - i * 0.006, 4, sp, { phase: Math.PI / 4 });
          b.pop();
        }
        for (const [x, y, z] of [[0.13, 1.12, 0.1], [-0.15, 1.08, 0.06], [0.17, 1.0, -0.08]]) b.ball(x, y, z, 0.025, 0, col('#4a8f6f'), 0.5);
      },
    },
    {
      key: 'koala',
      name: '코알라',
      hood: '#a3a8b0',
      build(b, c) {
        hood(b, c);
        for (const sx of [-1, 1]) roundEar(b, sx * 0.19, 1.13, -0.02, 0.1, c, col('#f1ece4'), sx * -0.3);
        b.push().t(0, 1.17, 0.175).s(1, 1.25, 0.6);
        b.ball(0, 0, 0, 0.03, 1, col('#3b3a40'));
        b.pop();
      },
    },
  ];
  JK.ANIMALS = ANIMALS;

  // 옷 색 (동물 모자와 잘 어울리게 밝고 맑게)
  const CLOTH = ['#d9573f', '#3f7fa8', '#5f9a55', '#e0a93a', '#8a63b8', '#e07a9a', '#2f8f8a', '#c2683a', '#4f6fc0', '#9aa83e'];
  JK.CLOTH = CLOTH;
  const ADJ = [
    '용감한', '졸린', '신난', '씩씩한', '느긋한', '반짝이는', '재빠른', '엉뚱한', '다정한', '똑똑한',
    '꼼꼼한', '명랑한', '행복한', '날쌘', '배고픈', '수줍은', '힘센', '노래하는', '춤추는', '웃는',
    '용기 있는', '궁금한', '부지런한', '튼튼한', '상냥한', '번쩍이는', '달리는', '꿈꾸는', '뛰노는', '든든한',
  ];
  JK.ADJ = ADJ;

  // 아바타 번호(0~) → 동물·옷 색. 같은 판 안에서 겹치지 않는다(동물 14 × 옷 2 = 28, 그 뒤는 옷 색을 더 돌린다)
  JK.avatarOf = function (idx) {
    // 도깨비 찾기 인형(1000~1027): 동물 7 × 색 4
    if (idx >= 1000 && window.QP && QP.MAFIA_ANIMALS) {
      const k = idx - 1000;
      return { animal: ANIMALS[QP.MAFIA_ANIMALS[Math.floor(k / 4)][1]], cloth: QP.MAFIA_COLORS[k % 4][1] };
    }
    const a = idx % ANIMALS.length;
    const round = Math.floor(idx / ANIMALS.length);
    const cloth = CLOTH[(a * 3 + round * 5) % CLOTH.length];
    return { animal: ANIMALS[a], cloth };
  };
  JK.nickname = function (avatarIdx, adjIdx) {
    return ADJ[adjIdx % ADJ.length] + ' ' + JK.avatarOf(avatarIdx).animal.name;
  };

  const cache = new Map();
  JK.makeAnimalDoll = function (avatarIdx, seg) {
    const key = avatarIdx + ':' + (seg || 18);
    if (cache.has(key)) return cache.get(key);
    const { animal, cloth } = JK.avatarOf(avatarIdx);
    const b = new JK.Builder();
    JK.dollBase(b, col(cloth), seg || 18);
    animal.build(b, col(animal.hood));
    const g = b.build();
    cache.set(key, g);
    return g;
  };

  /* 인형 사진 한 장(아이 화면 위쪽의 내 인형). 3D를 계속 돌리지 않고 한 번만 그려 그림으로 쓴다. */
  // 3D(WebGL)를 쓸 수 있는 컴퓨터인지. 학교 PC는 학교 설정으로 막혀 있기도 하다(2026-11-03 담임: 노트북은 되고 학교 PC는 안 됨)
  JK.has3D = function () {
    if (JK._has3D === undefined) {
      try {
        const c = document.createElement('canvas');
        JK._has3D = !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
      } catch (e) {
        JK._has3D = false;
      }
    }
    return JK._has3D;
  };
  // 3D 없이 그리는 인형 얼굴(모자 색·옷 색·얼굴)
  function portrait2D(avatarIdx, s) {
    const { animal, cloth } = JK.avatarOf(avatarIdx);
    const cv = document.createElement('canvas');
    cv.width = cv.height = s;
    const g = cv.getContext('2d');
    const ball = (x, y, r, c) => {
      g.fillStyle = c;
      g.beginPath();
      g.arc(x * s, y * s, r * s, 0, Math.PI * 2);
      g.fill();
    };
    g.fillStyle = cloth;
    g.beginPath();
    g.ellipse(0.5 * s, 1.02 * s, 0.4 * s, 0.36 * s, 0, 0, Math.PI * 2);
    g.fill();
    ball(0.5, 0.44, 0.31, animal.hood);
    ball(0.5, 0.5, 0.22, '#f1d5ad');
    ball(0.42, 0.48, 0.028, '#3a2a20');
    ball(0.58, 0.48, 0.028, '#3a2a20');
    ball(0.37, 0.56, 0.035, 'rgba(233,146,138,.7)');
    ball(0.63, 0.56, 0.035, 'rgba(233,146,138,.7)');
    g.strokeStyle = '#a0503a';
    g.lineWidth = Math.max(1, s * 0.02);
    g.beginPath();
    g.arc(0.5 * s, 0.55 * s, 0.05 * s, 0.2, Math.PI - 0.2);
    g.stroke();
    return cv.toDataURL('image/png');
  }
  const portraitCache = new Map();
  JK.dollPortrait = function (avatarIdx, size) {
    size = size || 160;
    const key = avatarIdx + '|' + size;
    if (!portraitCache.has(key)) {
      let url;
      try {
        url = JK.has3D() ? portrait3D(avatarIdx, size) : portrait2D(avatarIdx, size);
      } catch (e) {
        JK._has3D = false;
        url = portrait2D(avatarIdx, size);
      }
      portraitCache.set(key, url);
    }
    return portraitCache.get(key);
  };
  function portrait3D(avatarIdx, size) {
    const T = THREE;
    const cv = document.createElement('canvas');
    cv.width = cv.height = size;
    const r = new T.WebGLRenderer({ canvas: cv, antialias: true, alpha: true, preserveDrawingBuffer: true });
    r.outputColorSpace = T.SRGBColorSpace;
    const sc = new T.Scene();
    sc.add(new T.HemisphereLight(0xfff4e0, 0xd8c8a8, 1.4));
    const sun = new T.DirectionalLight(0xffffff, 1.6);
    sun.position.set(2, 3, 4);
    sc.add(sun);
    const m = new T.Mesh(JK.makeAnimalDoll(avatarIdx, 20), JK.MAT);
    m.rotation.y = -0.35;
    sc.add(m);
    const cam = new T.PerspectiveCamera(26, 1, 0.1, 20);
    cam.position.set(0, 1.15, 2.05);
    cam.lookAt(0, 0.93, 0);
    r.render(sc, cam);
    const url = cv.toDataURL('image/png');
    r.dispose();
    r.forceContextLoss && r.forceContextLoss();
    return url;
  }
})();
