/* fire.js — 진짜 서버(Firebase Firestore, 프로젝트 mathgame2-d835d: 꼬맨틀·타임머신과 같은 곳)
 * mock.js 와 같은 모양(get set update del batch onDoc onCol find now)으로 감싼다.
 * 학교 인터넷이 실시간 연결을 막아도 되도록 긴 폴링을 스스로 고른다.
 * ?emu 를 붙이면 이 컴퓨터의 Firebase 에뮬레이터에 붙는다(시험용).
 */
(function (root) {
  'use strict';
  const QP = root.QP;
  // 이 게임만 쓰는 프로젝트(2026-11-02 새로 만듦). 공개해도 되는 값이다(접근은 firestore.rules 가 막는다).
  const CONFIG = {
    apiKey: 'AIzaSyA38u3pmuxW9NBu5-M2Dt3qFE6TgmXhgnw',
    authDomain: 'quizparty-sikke.firebaseapp.com',
    projectId: 'quizparty-sikke',
    storageBucket: 'quizparty-sikke.firebasestorage.app',
    messagingSenderId: '350905420839',
    appId: '1:350905420839:web:59ac9b5958a6bb83575202',
  };
  QP.FIRE_CONFIG = CONFIG;
  let appN = 0;
  const SDK = 'https://www.gstatic.com/firebasejs/10.12.2/';

  QP.fireNet = async function (opts) {
    opts = opts || {};
    // node 봇 시험은 node_modules 의 firebase 모듈을 opts.mods 로 준다
    const [{ initializeApp }, A, F] = opts.mods || (await Promise.all([import(SDK + 'firebase-app.js'), import(SDK + 'firebase-auth.js'), import(SDK + 'firebase-firestore.js')]));
    const app = initializeApp(CONFIG, 'qp' + (appN++ ? appN : ''));
    const auth = A.getAuth(app);
    const db = F.initializeFirestore(app, { experimentalAutoDetectLongPolling: true });
    if (opts.emu) {
      A.connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
      F.connectFirestoreEmulator(db, '127.0.0.1', 8180);
    }
    await auth.authStateReady();
    let uid = auth.currentUser ? auth.currentUser.uid : null;
    let offset = 0;
    const ref = (p) => F.doc(db, p);
    // Firestore 는 목록 안의 목록을 못 담는다 → 쓸 때 {__a:[…]} 로 싸고 읽을 때 푼다
    const enc = (v, inArr) => {
      if (Array.isArray(v)) {
        const a = v.map((x) => enc(x, true));
        return inArr ? { __a: a } : a;
      }
      if (v && typeof v === 'object' && v.constructor === Object) {
        const o = {};
        for (const k in v) if (v[k] !== undefined) o[k] = enc(v[k], false);
        return o;
      }
      return v;
    };
    const dec = (v) => {
      if (Array.isArray(v)) return v.map(dec);
      if (v && typeof v === 'object' && v.constructor === Object) {
        if (v.__a && Object.keys(v).length === 1) return v.__a.map(dec);
        const o = {};
        for (const k in v) o[k] = dec(v[k]);
        return o;
      }
      return v;
    };
    const wrapErr = (e) => {
      if (e && /permission/i.test(e.code || e.message)) e.code = 'permission-denied';
      return e;
    };
    const net = {
      mock: false,
      get uid() {
        return uid;
      },
      get email() {
        return auth.currentUser && auth.currentUser.email;
      },
      // 아이: 이름 없는 임시 접속(같은 브라우저면 같은 uid). 선생님: 구글 로그인
      async signIn(kind) {
        if (kind === 'teacher' && opts.emu && opts.fakeTeacher) {
          // 에뮬레이터 시험: 가짜 구글 증명서로 선생님인 척
          await A.signInWithCredential(auth, A.GoogleAuthProvider.credential(JSON.stringify({ sub: opts.fakeTeacher, email: opts.fakeEmail, email_verified: true })));
        } else if (kind === 'teacher') {
          if (!auth.currentUser || auth.currentUser.isAnonymous) {
            const p = new A.GoogleAuthProvider();
            await A.signInWithPopup(auth, p);
          }
        } else if (!auth.currentUser) await A.signInAnonymously(auth);
        uid = auth.currentUser.uid;
        return uid;
      },
      async signOut() {
        await A.signOut(auth);
        uid = null;
      },
      now: () => Date.now() + offset,
      // 기기 시계 맞추기: 서버 시각을 한 번 써 보고 되읽는다
      async calibrate(path) {
        try {
          const t0 = Date.now();
          await F.setDoc(ref(path), { ts: F.serverTimestamp() }, { merge: true });
          const s = await F.getDoc(ref(path));
          const t1 = Date.now();
          const ts = s.get('ts');
          if (ts && ts.toMillis) offset = ts.toMillis() - (t0 + t1) / 2;
        } catch (e) {
          /* 못 맞추면 기기 시계 그대로 */
        }
        return offset;
      },
      async get(path) {
        try {
          const s = await F.getDoc(ref(path));
          return s.exists() ? dec(s.data()) : null;
        } catch (e) {
          throw wrapErr(e);
        }
      },
      set: (path, data) => F.setDoc(ref(path), enc(data)).catch((e) => Promise.reject(wrapErr(e))),
      // 윗칸만 바꾼다(mock 과 같음). 문서가 없으면 만든다(규칙의 create 가 적용된다)
      update: (path, data) => F.setDoc(ref(path), enc(data), { mergeFields: Object.keys(data) }).catch((e) => Promise.reject(wrapErr(e))),
      del: (path) => F.deleteDoc(ref(path)).catch((e) => Promise.reject(wrapErr(e))),
      async batch(ops) {
        // 한 번에 500개까지
        for (let i = 0; i < ops.length; i += 450) {
          const b = F.writeBatch(db);
          for (const o of ops.slice(i, i + 450)) {
            if (o.del) b.delete(ref(o.path));
            else if (o.merge) b.set(ref(o.path), enc(o.data), { mergeFields: Object.keys(o.data) });
            else b.set(ref(o.path), enc(o.data));
          }
          await b.commit().catch((e) => Promise.reject(wrapErr(e)));
        }
      },
      onDoc(path, cb, onErr) {
        return F.onSnapshot(
          ref(path),
          (s) => cb(s.exists() ? dec(s.data()) : null, { cache: s.metadata.fromCache }),
          (e) => onErr && onErr(wrapErr(e))
        );
      },
      onCol(path, cb, onErr) {
        return F.onSnapshot(
          F.collection(db, path),
          (qs) => cb(qs.docs.map((d) => ({ id: d.id, data: dec(d.data()) }))),
          (e) => onErr && onErr(wrapErr(e))
        );
      },
      // 시험용: 와이파이 끊김 흉내
      setOffline(on) {
        net.offline = on;
        return on ? F.disableNetwork(db) : F.enableNetwork(db);
      },
      offline: false,
      async find(col, field, value) {
        const qs = await F.getDocs(F.query(F.collection(db, col), F.where(field, '==', value)));
        return qs.docs.map((d) => ({ id: d.id, data: dec(d.data()) }));
      },
    };
    return net;
  };
})(typeof window !== 'undefined' ? window : globalThis);
