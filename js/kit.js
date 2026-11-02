/* kit.js — 퀴즈 파티 공통 3D 도구
 * 「고장 난 타임머신」 scene.js의 작은 도구(partBall·ring·disc·하늘)를 옮겨 왔다.
 * toy.js(빌더·재질)와 props.js(나무·구름·인형 몸) 다음에 불러온다.
 */
(function () {
  'use strict';
  const JK = window.JK;
  const T = THREE;
  const col = JK.col;
  const TAU = Math.PI * 2;
  const K = (JK.kit2 = {});

  // 공의 일부만(머리카락·모자 둥근 부분). keep(법선)이 참인 삼각형만
  K.partBall = function (b, cx, cy, cz, r, detail, color, keep, sy) {
    const g = new T.IcosahedronGeometry(1, detail);
    const p = g.attributes.position;
    const s = sy || 1;
    for (let i = 0; i < p.count; i += 3) {
      const v = [0, 1, 2].map((k) => [p.getX(i + k), p.getY(i + k), p.getZ(i + k)]);
      const n = [(v[0][0] + v[1][0] + v[2][0]) / 3, (v[0][1] + v[1][1] + v[2][1]) / 3, (v[0][2] + v[1][2] + v[2][2]) / 3];
      const l = Math.hypot(n[0], n[1], n[2]);
      if (keep && !keep([n[0] / l, n[1] / l, n[2] / l])) continue;
      const q = v.map((a) => [cx + a[0] * r, cy + a[1] * r * s, cz + a[2] * r]);
      b.tri(q[0], q[1], q[2], typeof color === 'function' ? color(n) : color);
    }
    g.dispose();
  };
  // 고리(도넛): 지금 좌표의 z축이 고리 축
  K.ring = function (b, R, rr, seg, seg2, color) {
    const P3 = (u, v) => [(R + rr * Math.cos(v)) * Math.cos(u), (R + rr * Math.cos(v)) * Math.sin(u), rr * Math.sin(v)];
    for (let i = 0; i < seg; i++)
      for (let j = 0; j < seg2; j++) {
        const u0 = (i / seg) * TAU,
          u1 = ((i + 1) / seg) * TAU,
          v0 = (j / seg2) * TAU,
          v1 = ((j + 1) / seg2) * TAU;
        b.quad(P3(u0, v0), P3(u1, v0), P3(u1, v1), P3(u0, v1), color);
      }
  };
  // 원판 (z축을 보는 납작한 원)
  K.disc = function (b, R, z, seg, color) {
    for (let i = 0; i < seg; i++) {
      const u0 = (i / seg) * TAU,
        u1 = ((i + 1) / seg) * TAU;
      b.tri([0, 0, z], [Math.cos(u0) * R, Math.sin(u0) * R, z], [Math.cos(u1) * R, Math.sin(u1) * R, z], color);
    }
  };
  K.MATD = JK.toyMaterial({ side: T.DoubleSide });
  K.mesh = function (geo, mat, cast, recv) {
    const m = new T.Mesh(geo, mat || JK.MAT);
    m.castShadow = cast !== false;
    m.receiveShadow = recv !== false;
    return m;
  };

  /* ---------- 하늘 (타임머신과 같은 결) ---------- */
  const skyVert = `varying vec3 vDir;
    void main(){ vDir = normalize( position ); vec4 p = modelViewMatrix * vec4( position, 1.0 ); gl_Position = projectionMatrix * p; gl_Position.z = gl_Position.w * 0.9999; }`;
  const skyFrag = `uniform vec3 uTop, uHor, uBot, uSun, uSunCol, uInk; uniform float uTime; varying vec3 vDir;
    float h21( vec2 p ){ return fract( sin( dot( p, vec2( 127.1, 311.7 ) ) ) * 43758.5453 ); }
    float vn( vec2 p ){ vec2 i = floor( p ), f = fract( p ); f = f*f*(3.0-2.0*f);
      return mix( mix( h21(i), h21(i+vec2(1,0)), f.x ), mix( h21(i+vec2(0,1)), h21(i+vec2(1,1)), f.x ), f.y ); }
    float fbm( vec2 p ){ return vn(p)*0.55 + vn(p*2.03+3.1)*0.3 + vn(p*4.1+7.7)*0.15; }
    void main(){
      vec3 d = normalize( vDir ); float e = d.y;
      vec3 c = e > 0.0 ? mix( uHor, uTop, pow( clamp( e, 0.0, 1.0 ), 0.55 ) ) : mix( uHor, uBot, pow( clamp( -e, 0.0, 1.0 ), 0.45 ) );
      float az = atan( d.z, d.x );
      vec2 q = vec2( az * 1.6, e * 4.0 ) + vec2( uTime * 0.004, 0.0 );
      c = mix( c, c * 0.9 + uInk * 0.05, smoothstep( 0.52, 0.78, fbm( q * 1.3 ) ) * 0.55 );
      float r1 = 0.035 + 0.075 * fbm( vec2( az * 2.2, 1.0 ) ) + 0.03 * vn( vec2( az * 9.0, 2.0 ) );
      float r2 = 0.015 + 0.05 * fbm( vec2( az * 3.4 + 4.0, 3.0 ) );
      c = mix( c, mix( uHor, uInk, 0.28 ), smoothstep( r1 + 0.004, r1 - 0.004, e ) * smoothstep( -0.12, 0.0, e ) );
      c = mix( c, mix( uHor, uInk, 0.45 ), smoothstep( r2 + 0.004, r2 - 0.004, e ) * smoothstep( -0.1, 0.0, e ) );
      float s = max( dot( d, normalize( uSun ) ), 0.0 );
      c += uSunCol * ( pow( s, 6.0 ) * 0.25 + pow( s, 90.0 ) * 0.6 );
      gl_FragColor = vec4( c, 1.0 );
      #include <colorspace_fragment>
    }`;
  K.sky = function (scene, sunDir, colors) {
    colors = colors || {};
    const sky = new T.Mesh(
      new T.SphereGeometry(400, 32, 16),
      new T.ShaderMaterial({
        vertexShader: skyVert,
        fragmentShader: skyFrag,
        side: T.BackSide,
        depthWrite: false,
        fog: false,
        uniforms: {
          uTop: { value: col(colors.top || '#7fb4e8') },
          uHor: { value: col(colors.hor || '#fdeed2') },
          uBot: { value: col(colors.bot || '#f2e6d6') },
          uSun: { value: sunDir.clone() },
          uSunCol: { value: col('#fff1d6') },
          uInk: { value: col('#3b4a66') },
          uTime: JK.U.uTime,
        },
      })
    );
    sky.renderOrder = -10;
    sky.frustumCulled = false;
    scene.add(sky);
    return sky;
  };

  /* ---------- 3D 위치 → 화면 위 이름표 ---------- */
  const _p = new T.Vector3();
  K.placeLabels = function (labels, camera, w, h) {
    for (const L of labels) {
      if (!L.obj.visible || L.hide || (L.view && K.view && L.view !== K.view)) {
        L.el.style.display = 'none';
        continue;
      }
      L.obj.getWorldPosition(_p);
      _p.y += (L.dy || 0) * L.obj.scale.y;
      _p.project(camera);
      if (_p.z > 1) {
        L.el.style.display = 'none';
        continue;
      }
      L.el.style.display = '';
      const x = (_p.x * 0.5 + 0.5) * w,
        y = (-_p.y * 0.5 + 0.5) * h;
      L.el.style.transform = 'translate(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px) translate(-50%,' + (L.below ? '0' : L.center ? '-50%' : '-100%') + ')';
    }
  };

  /* ---------- 가벼운 모드: 처음 몇 초 재서 느리면 화질을 낮춘다 ---------- */
  K.speedWatch = function (onSlow, minFps) {
    const s = { n: 0, sum: 0, done: false, fps: 0 };
    const q = new URLSearchParams(location.search).get('q');
    if (q === 'low') {
      s.done = true;
      setTimeout(onSlow, 0);
    }
    if (q === 'high') s.done = true;
    return function (dt) {
      if (s.done || document.hidden) return;
      s.n++;
      if (s.n <= 30) return;
      s.sum += dt;
      if (s.n >= 150) {
        s.done = true;
        s.fps = 120 / s.sum;
        K.measuredFps = s.fps;
        if (s.fps < (minFps || 24)) onSlow();
      }
    };
  };
})();
