/* toy.js — 장난감 디오라마용 공통 재질과 지오메트리 빌더
 * 모든 모형은 코드로 만든 로우폴리다. 면마다 법선이 하나(플랫 셰이딩)이고,
 * 색은 꼭짓점 색으로 칠한다. 바닥 쪽을 미리 어둡게 칠해(AO) 그림자가 없는
 * 낮은 화질에서도 입체감이 남게 한다.
 *
 * aFx 속성(vec3) = (u, v, 종류)
 *   종류 0 보통, 1 기와(골 무늬), 2 창(해 질 녘 불빛), 3 옷(인스턴스 색으로 물듦),
 *   4 물(반짝임), 5 폭포(흘러내림)
 */
(function () {
  'use strict';
  const JK = (window.JK = window.JK || {});
  const T = THREE;

  /* ---------- 공통 유니폼 ---------- */
  const U = (JK.U = {
    uTime: { value: 0 },
    uNight: { value: 0 }, // 0 낮 ~ 1 밤: 창 불빛
    uLights: { value: 1 }, // 창 불빛 세기(게이지 위기 때 줄어듦)
    uDry: { value: 0 }, // 0 보통 ~ 1 가뭄: 초록(논·풀·잎)이 누렇게 바램 (돌발 10-13)
    uWater: { value: new T.Color('#5fb7c9') },
  });

  /* ---------- 재질 ---------- */
  function patchToy(shader) {
    shader.uniforms.uTime = U.uTime;
    shader.uniforms.uNight = U.uNight;
    shader.uniforms.uLights = U.uLights;
    shader.uniforms.uDry = U.uDry;
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        '#include <common>\nattribute vec3 aFx;\nvarying vec3 vFx;'
      )
      .replace(
        '#include <color_vertex>',
        [
          '#if defined( USE_COLOR_ALPHA )',
          '  vColor = vec4( 1.0 );',
          '#elif defined( USE_COLOR ) || defined( USE_INSTANCING_COLOR )',
          '  vColor = vec3( 1.0 );',
          '#endif',
          '#ifdef USE_COLOR',
          '  vColor *= color;',
          '#endif',
          '#ifdef USE_INSTANCING_COLOR',
          // 옷(종류 3)만 인스턴스 색으로 물들인다. 얼굴·나무 결은 그대로.
          '  float tintK = step( 2.5, aFx.z ) * step( aFx.z, 3.5 );',
          '  vColor.xyz *= mix( vec3( 1.0 ), instanceColor.xyz, tintK );',
          '#endif',
          'vFx = aFx;',
        ].join('\n')
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        '#include <common>\nvarying vec3 vFx;\nuniform float uTime;\nuniform float uNight;\nuniform float uLights;\nuniform float uDry;'
      )
      .replace(
        '#include <color_fragment>',
        [
          '#include <color_fragment>',
          'float kind = vFx.z;',
          // 가뭄: 초록이 강한 곳(풀·논·잎)만 짚빛으로 바랜다
          'if ( uDry > 0.001 ) {',
          '  float gr = clamp( ( diffuseColor.g - max( diffuseColor.r, diffuseColor.b ) ) * 5.0, 0.0, 1.0 );',
          '  float lum = dot( diffuseColor.rgb, vec3( 0.3, 0.55, 0.15 ) );',
          '  diffuseColor.rgb = mix( diffuseColor.rgb, vec3( 1.05, 0.82, 0.45 ) * ( lum * 1.15 + 0.08 ), uDry * gr * 0.8 );',
          '}',
          // 기와 골: 처마 방향으로 줄무늬
          'if ( kind > 0.5 && kind < 1.5 ) {',
          '  float g = abs( fract( vFx.x ) - 0.5 ) * 2.0;',
          '  diffuseColor.rgb *= 0.70 + 0.30 * smoothstep( 0.10, 0.55, g );',
          '  diffuseColor.rgb *= 0.92 + 0.08 * smoothstep( 0.0, 0.08, vFx.y );',
          '}',
          // 물: 흐르는 물결 빛
          'if ( kind > 3.5 && kind < 4.5 ) {',
          '  float w = sin( vFx.x * 5.0 - uTime * 1.6 + sin( vFx.y * 9.0 + uTime ) * 1.2 );',
          '  float w2 = sin( vFx.x * 11.0 + vFx.y * 6.0 - uTime * 2.3 );',
          '  diffuseColor.rgb += vec3( 0.20, 0.26, 0.28 ) * smoothstep( 0.82, 1.0, w * 0.6 + w2 * 0.4 );',
          '}',
          // 폭포: 아래로 흐르는 흰 줄
          'if ( kind > 4.5 && kind < 5.5 ) {',
          '  float s = fract( vFx.y * 1.4 - uTime * 0.9 + sin( vFx.x * 13.0 ) * 0.3 );',
          '  float st = smoothstep( 0.55, 1.0, s ) * ( 0.6 + 0.4 * sin( vFx.x * 31.0 ) );',
          '  diffuseColor.rgb = mix( diffuseColor.rgb, vec3( 0.95, 0.98, 1.0 ), clamp( st + vFx.y * 0.05, 0.0, 0.85 ) );',
          '}',
        ].join('\n')
      )
      .replace(
        '#include <emissivemap_fragment>',
        [
          '#include <emissivemap_fragment>',
          'if ( kind > 1.5 && kind < 2.5 ) {',
          '  totalEmissiveRadiance += vec3( 1.0, 0.62, 0.26 ) * uNight * uLights * 1.6;',
          '}',
          'if ( kind > 4.5 && kind < 5.5 ) { totalEmissiveRadiance += diffuseColor.rgb * 0.25; }',
        ].join('\n')
      );
  }

  function toyMaterial(opts) {
    const m = new T.MeshLambertMaterial(
      Object.assign({ vertexColors: true, flatShading: true }, opts || {})
    );
    m.onBeforeCompile = patchToy;
    m.customProgramCacheKey = () => 'toy1';
    return m;
  }
  JK.toyMaterial = toyMaterial;
  JK.MAT = toyMaterial();

  /* ---------- 색 ---------- */
  const _c = new T.Color();
  function col(hex) {
    return new T.Color(hex);
  }
  JK.col = col;

  /* ---------- 빌더 ---------- */
  const _m = new T.Matrix4();
  const _v = new T.Vector3();
  const _n = new T.Matrix3();

  class Builder {
    constructor() {
      this.p = [];
      this.c = [];
      this.f = [];
      this.m = new T.Matrix4();
      this.stack = [];
      this.aoBase = 0;
      this.aoH = 0; // 0이면 AO 없음
      this.aoMin = 0.62;
      this.fx = [0, 0, 0];
    }
    push() {
      this.stack.push(this.m.clone());
      return this;
    }
    pop() {
      this.m.copy(this.stack.pop());
      return this;
    }
    t(x, y, z) {
      this.m.multiply(_m.makeTranslation(x, y, z));
      return this;
    }
    ry(a) {
      this.m.multiply(_m.makeRotationY(a));
      return this;
    }
    rx(a) {
      this.m.multiply(_m.makeRotationX(a));
      return this;
    }
    rz(a) {
      this.m.multiply(_m.makeRotationZ(a));
      return this;
    }
    s(x, y, z) {
      this.m.multiply(_m.makeScale(x, y === undefined ? x : y, z === undefined ? x : z));
      return this;
    }
    ao(base, h, min) {
      this.aoBase = base;
      this.aoH = h;
      if (min !== undefined) this.aoMin = min;
      return this;
    }
    kind(k, u, v) {
      this.fx = [u || 0, v || 0, k || 0];
      return this;
    }
    _vert(pt, color, fx) {
      _v.set(pt[0], pt[1], pt[2]).applyMatrix4(this.m);
      this.p.push(_v.x, _v.y, _v.z);
      let k = 1;
      if (this.aoH > 0) {
        const t = Math.min(1, Math.max(0, (_v.y - this.aoBase) / this.aoH));
        k = this.aoMin + (1 - this.aoMin) * (t * t * (3 - 2 * t));
      }
      this.c.push(color.r * k, color.g * k, color.b * k);
      const f = fx || this.fx;
      this.f.push(f[0], f[1], f[2]);
    }
    // 세 점 삼각형 (반시계 = 앞면). color: Color 또는 [Color,Color,Color]. fx: 꼭짓점별 [u,v,k] 배열
    tri(a, b, c, color, fxa, fxb, fxc) {
      const ca = color.isColor ? color : color[0];
      const cb = color.isColor ? color : color[1];
      const cc = color.isColor ? color : color[2];
      this._vert(a, ca, fxa);
      this._vert(b, cb, fxb);
      this._vert(c, cc, fxc);
      return this;
    }
    quad(a, b, c, d, color, fa, fb, fc, fd) {
      const isArr = !color.isColor;
      const ca = isArr ? color[0] : color,
        cb = isArr ? color[1] : color,
        cc = isArr ? color[2] : color,
        cd = isArr ? color[3] : color;
      this.tri(a, b, c, [ca, cb, cc], fa, fb, fc);
      this.tri(a, c, d, [ca, cc, cd], fa, fc, fd);
      return this;
    }
    // 상자: 중심 (x,y,z) 바닥 기준이 아닌 가운데 기준. opts.top 윗면 색, opts.noBottom
    box(x, y, z, sx, sy, sz, color, opts) {
      opts = opts || {};
      const hx = sx / 2,
        hy = sy / 2,
        hz = sz / 2;
      const top = opts.top || color;
      const side = color;
      const P = (a, b, c) => [x + a * hx, y + b * hy, z + c * hz];
      // +y
      this.quad(P(-1, 1, 1), P(1, 1, 1), P(1, 1, -1), P(-1, 1, -1), top);
      // +z
      this.quad(P(-1, -1, 1), P(1, -1, 1), P(1, 1, 1), P(-1, 1, 1), opts.front || side);
      // -z
      this.quad(P(1, -1, -1), P(-1, -1, -1), P(-1, 1, -1), P(1, 1, -1), opts.back || side);
      // +x
      this.quad(P(1, -1, 1), P(1, -1, -1), P(1, 1, -1), P(1, 1, 1), opts.right || side);
      // -x
      this.quad(P(-1, -1, -1), P(-1, -1, 1), P(-1, 1, 1), P(-1, 1, -1), opts.left || side);
      if (!opts.noBottom) this.quad(P(-1, -1, -1), P(1, -1, -1), P(1, -1, 1), P(-1, -1, 1), side);
      return this;
    }
    // 원기둥/원뿔대: 바닥 중심 (x,y,z), 높이 h
    cyl(x, y, z, rb, rt, h, seg, color, opts) {
      opts = opts || {};
      const topC = opts.top || color;
      for (let i = 0; i < seg; i++) {
        const a0 = (i / seg) * Math.PI * 2 + (opts.phase || 0);
        const a1 = ((i + 1) / seg) * Math.PI * 2 + (opts.phase || 0);
        const c0 = Math.cos(a0),
          s0 = Math.sin(a0),
          c1 = Math.cos(a1),
          s1 = Math.sin(a1);
        const b0 = [x + c0 * rb, y, z + s0 * rb],
          b1 = [x + c1 * rb, y, z + s1 * rb];
        const t0 = [x + c0 * rt, y + h, z + s0 * rt],
          t1 = [x + c1 * rt, y + h, z + s1 * rt];
        if (rt > 0.0001) {
          this.quad(b1, b0, t0, t1, color);
          if (!opts.noTop) this.tri([x, y + h, z], t1, t0, topC);
        } else {
          this.tri(b1, b0, [x, y + h, z], color);
        }
        if (opts.bottom) this.tri([x, y, z], b0, b1, color);
      }
      return this;
    }
    // 회전체: pts = [[r,y,색], ...] 아래에서 위로
    lathe(pts, seg, opts) {
      opts = opts || {};
      for (let j = 0; j < pts.length - 1; j++) {
        const [r0, y0, cA] = pts[j];
        const [r1, y1, cB] = pts[j + 1];
        const k0 = pts[j][3] !== undefined ? pts[j][3] : opts.kind || 0;
        for (let i = 0; i < seg; i++) {
          const a0 = (i / seg) * Math.PI * 2,
            a1 = ((i + 1) / seg) * Math.PI * 2;
          const c0 = Math.cos(a0),
            s0 = Math.sin(a0),
            c1 = Math.cos(a1),
            s1 = Math.sin(a1);
          const fx = [0, 0, k0];
          const p00 = [c0 * r0, y0, s0 * r0],
            p01 = [c1 * r0, y0, s1 * r0],
            p10 = [c0 * r1, y1, s0 * r1],
            p11 = [c1 * r1, y1, s1 * r1];
          const cc = cA === cB ? cA : [cA, cA, cB, cB];
          if (r1 < 1e-5) this.tri(p01, p00, p10, cc.isColor ? cc : [cA, cA, cB], fx, fx, fx);
          else if (r0 < 1e-5) this.tri(p00, p10, p11, cc.isColor ? cc : [cA, cB, cB], fx, fx, fx);
          else this.quad(p01, p00, p10, p11, cc.isColor ? cc : [cA, cA, cB, cB], fx, fx, fx, fx);
        }
      }
      return this;
    }
    // 두 점 A→B 를 잇는 원뿔대 (반지름 rA, rB)
    cylAB(A, B, rA, rB, seg, color) {
      const d = new T.Vector3(B[0] - A[0], B[1] - A[1], B[2] - A[2]);
      const len = d.length();
      const q = new T.Quaternion().setFromUnitVectors(new T.Vector3(0, 1, 0), d.normalize());
      this.push();
      this.m.multiply(new T.Matrix4().compose(new T.Vector3(A[0], A[1], A[2]), q, new T.Vector3(1, 1, 1)));
      this.cyl(0, 0, 0, rA, rB, len, seg, color, { bottom: true });
      this.pop();
      return this;
    }
    // 낮은 다면체 구 (세분 정이십면체)
    ball(x, y, z, r, detail, color, sy) {
      const g = new T.IcosahedronGeometry(r, detail);
      const pos = g.attributes.position;
      const sY = sy || 1;
      for (let i = 0; i < pos.count; i += 3) {
        const a = [pos.getX(i) + x, pos.getY(i) * sY + y, pos.getZ(i) + z];
        const b = [pos.getX(i + 1) + x, pos.getY(i + 1) * sY + y, pos.getZ(i + 1) + z];
        const c = [pos.getX(i + 2) + x, pos.getY(i + 2) * sY + y, pos.getZ(i + 2) + z];
        this.tri(a, b, c, typeof color === 'function' ? color(a, b, c) : color);
      }
      g.dispose();
      return this;
    }
    // 경로를 따라 네모 단면 막대 (마루 등)
    bar(points, w, h, color) {
      for (let i = 0; i < points.length - 1; i++) {
        const a = points[i],
          b = points[i + 1];
        const dx = b[0] - a[0],
          dz = b[2] - a[2];
        const len = Math.hypot(dx, dz) || 1;
        const nx = (-dz / len) * (w / 2),
          nz = (dx / len) * (w / 2);
        const A0 = [a[0] - nx, a[1], a[2] - nz],
          A1 = [a[0] + nx, a[1], a[2] + nz];
        const B0 = [b[0] - nx, b[1], b[2] - nz],
          B1 = [b[0] + nx, b[1], b[2] + nz];
        const A0t = [A0[0], A0[1] + h, A0[2]],
          A1t = [A1[0], A1[1] + h, A1[2]];
        const B0t = [B0[0], B0[1] + h, B0[2]],
          B1t = [B1[0], B1[1] + h, B1[2]];
        this.quad(A0t, A1t, B1t, B0t, color); // 위
        this.quad(A1, B1, B1t, A1t, color);
        this.quad(B0, A0, A0t, B0t, color);
        if (i === 0) this.quad(A0, A1, A1t, A0t, color);
        if (i === points.length - 2) this.quad(B1, B0, B0t, B1t, color);
      }
      return this;
    }
    count() {
      return this.p.length / 9;
    }
    build() {
      const g = new T.BufferGeometry();
      g.setAttribute('position', new T.Float32BufferAttribute(this.p, 3));
      g.setAttribute('color', new T.Float32BufferAttribute(this.c, 3));
      g.setAttribute('aFx', new T.Float32BufferAttribute(this.f, 3));
      g.computeVertexNormals();
      g.computeBoundingSphere();
      g.computeBoundingBox();
      return g;
    }
  }
  JK.Builder = Builder;

  /* ---------- 작은 수학 ---------- */
  JK.lerp = (a, b, t) => a + (b - a) * t;
  JK.clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
  JK.smooth = (a, b, x) => {
    const t = JK.clamp((x - a) / (b - a), 0, 1);
    return t * t * (3 - 2 * t);
  };
  // 시드 고정 난수 (같은 섬이 매번 같은 모양)
  JK.rng = function (seed) {
    let s = seed >>> 0 || 1;
    return function () {
      s = (s + 0x6d2b79f5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };
  // 부드러운 값 잡음
  function hash2(x, y) {
    let h = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
    return h - Math.floor(h);
  }
  JK.noise2 = function (x, y) {
    const xi = Math.floor(x),
      yi = Math.floor(y);
    const xf = x - xi,
      yf = y - yi;
    const u = xf * xf * (3 - 2 * xf),
      v = yf * yf * (3 - 2 * yf);
    const a = hash2(xi, yi),
      b = hash2(xi + 1, yi),
      c = hash2(xi, yi + 1),
      d = hash2(xi + 1, yi + 1);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  };
  JK.fbm = function (x, y) {
    return JK.noise2(x, y) * 0.55 + JK.noise2(x * 2.1 + 5.2, y * 2.1 + 1.3) * 0.3 + JK.noise2(x * 4.3 + 9.1, y * 4.3 + 7.7) * 0.15;
  };
})();
