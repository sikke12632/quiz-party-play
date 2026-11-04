/* mock.js — 가짜 서버 (Firestore 와 같은 모양의 작은 문서 저장소)
 *   - node 봇 시험: QP.MemStore(메모리) 하나를 여러 가짜 기기가 같이 쓴다.
 *   - 브라우저 ?mock: QP.localStore() 로 localStorage 에 두고 탭끼리 나눈다(이 브라우저 안에서만).
 * 서버 규칙도 흉내 낸다(아이는 자기 자리만 읽고 정해진 칸만 쓴다) — 진짜 규칙은 firestore.rules.
 * 기기마다 늦음(latency)과 끊김(setOffline)을 줄 수 있다.
 */
(function (root) {
  'use strict';
  const QP = root.QP;
  const parent = (p) => p.slice(0, p.lastIndexOf('/'));
  const depth = (p) => p.split('/').length;

  /* ---------- 저장소 ---------- */
  class MemStore {
    constructor(backing) {
      this.b = backing || memBacking();
      this.subs = new Set();
      this.stat = { w: 0, r: 0 }; // 쓰기·읽기 수 (무료 한도 어림용)
      if (this.b.onExternal) this.b.onExternal((path) => this.changed(path));
    }
    read(path) {
      const s = this.b.read(path);
      return s ? JSON.parse(s) : null;
    }
    write(path, data) {
      this.b.write(path, data === null ? null : JSON.stringify(data));
    }
    list(col) {
      const d = depth(col) + 1;
      return this.b
        .keys(col + '/')
        .filter((k) => depth(k) === d)
        .sort()
        .map((k) => ({ id: k.slice(col.length + 1), data: this.read(k) }));
    }
    changed(path) {
      for (const s of this.subs) if (s.path === path || (s.col && s.path === parent(path))) s.kick();
    }
  }
  function memBacking() {
    const m = new Map();
    return { read: (p) => m.get(p) || null, write: (p, s) => (s === null ? m.delete(p) : m.set(p, s)), keys: (pre) => [...m.keys()].filter((k) => k.startsWith(pre)) };
  }
  QP.MemStore = MemStore;
  // 브라우저: localStorage + 다른 탭의 바뀜(storage 이벤트)
  QP.localStore = function () {
    const K = 'qpmock:';
    const b = {
      read: (p) => localStorage.getItem(K + p),
      write: (p, s) => (s === null ? localStorage.removeItem(K + p) : localStorage.setItem(K + p, s)),
      keys: (pre) => Object.keys(localStorage).filter((k) => k.startsWith(K + pre)).map((k) => k.slice(K.length)),
      onExternal: (cb) => addEventListener('storage', (e) => e.key && e.key.startsWith(K) && cb(e.key.slice(K.length))),
    };
    return new MemStore(b);
  };

  /* ---------- 규칙 흉내 (firestore.rules 와 같은 뜻) ---------- */
  // path: qp_games/{g} | qp_games/{g}/joins/{uid} | qp_games/{g}/players/{num} | qp_games/{g}/private/state
  function canRead(path, who, data) {
    if (who.teacher) return true;
    const p = path.split('/');
    if (p[0] !== 'qp_games') return false; // qp_packs(넣은 문제 묶음) 등은 선생님만
    if (p.length === 2) return true; // 판 문서
    if (p[2] === 'joins') return p[3] === who.uid;
    if (p[2] === 'players') return !data || data.uid === who.uid;
    return false;
  }
  function canWrite(path, who, before, after) {
    const p = path.split('/');
    if (who.teacher) return true;
    if (p[0] !== 'qp_games' || p.length === 2) return false;
    if (p[2] === 'joins') return p[3] === who.uid && after && Object.keys(after).every((k) => ['num', 'tab', 'at', 'ts', 'res', 'rat'].includes(k)) && changedKeys(before, after).every((k) => ['num', 'tab', 'at', 'ts'].includes(k));
    if (p[2] === 'players') return before && before.uid === who.uid && after && after.uid === who.uid && changedKeys(before, after).every((k) => QP.KID_KEYS.includes(k)) && (!after.a || String(after.a.v).length <= 12); // 규칙: a.v 는 12글자까지
    return false;
  }
  function changedKeys(a, b) {
    a = a || {};
    b = b || {};
    const ks = new Set([...Object.keys(a), ...Object.keys(b)]);
    return [...ks].filter((k) => JSON.stringify(a[k]) !== JSON.stringify(b[k]));
  }
  QP._changedKeys = changedKeys;

  /* ---------- 기기 하나가 보는 서버 ---------- */
  // opts: { uid, teacher, latency:[최소ms, 최대ms] }
  QP.mockNet = function (store, opts) {
    opts = opts || {};
    const who = { uid: opts.uid || 'u' + QP.id(6), teacher: !!opts.teacher };
    const lat = opts.latency || [20, 90];
    let offline = false;
    const pending = []; // 끊겼을 때 못 보낸 쓰기
    const mine = new Set();
    const delay = () => QP.sleep(lat[0] + Math.random() * (lat[1] - lat[0]));
    const deny = (path) => {
      const e = new Error('permission-denied: ' + path);
      e.code = 'permission-denied';
      return e;
    };

    function applyOps(ops) {
      // 규칙 검사를 먼저 다 하고(하나라도 안 되면 모두 취소), 그다음 한꺼번에 쓴다
      // 같은 문서에 여러 번 쓰면 앞의 쓰기 위에 차례로 쌓는다(Firestore 묶음 쓰기와 같게)
      const staged = new Map();
      const next = ops.map((o) => {
        const before = staged.has(o.path) ? staged.get(o.path) : store.read(o.path);
        const after = o.del ? null : o.merge ? Object.assign({}, before || {}, o.data) : o.data;
        if (!canWrite(o.path, who, before, after)) throw deny(o.path);
        staged.set(o.path, after);
        return [o.path, after];
      });
      for (const [p, d] of next) store.write(p, d);
      store.stat.w += next.length;
      for (const [p] of next) store.changed(p);
    }
    // 끊겼을 때는 모아 두었다가 다시 이어지면 보낸다(그때 규칙에 걸리면 그 쓰기의 약속이 실패한다 — Firestore 와 같다)
    const later = (ops) => new Promise((res, rej) => pending.push({ ops, res, rej }));
    async function send(ops) {
      if (offline) return later(ops);
      await delay();
      if (offline) return later(ops);
      applyOps(ops);
    }
    function sub(path, col, cb, onErr) {
      let last = undefined,
        dead = false,
        timer = null;
      const s = {
        path,
        col,
        kick() {
          if (dead || offline || timer) return;
          timer = setTimeout(deliver, lat[0] + Math.random() * (lat[1] - lat[0]));
        },
      };
      function deliver() {
        timer = null;
        if (dead || offline) return;
        let val;
        if (col) val = store.list(path).filter((d) => canRead(path + '/' + d.id, who, d.data));
        else {
          val = store.read(path);
          if (!canRead(path, who, val)) {
            dead = true;
            store.subs.delete(s);
            if (onErr) onErr(deny(path));
            return;
          }
        }
        const j = JSON.stringify(val);
        if (j === last) return;
        // 읽기 수: 문서 하나면 1, 모음이면 바뀐 문서 수만큼 (Firestore 와 같은 셈)
        if (col) {
          const old = new Map((last ? JSON.parse(last) : []).map((d) => [d.id, JSON.stringify(d.data)]));
          store.stat.r += val.filter((d) => old.get(d.id) !== JSON.stringify(d.data)).length;
        } else store.stat.r += 1;
        last = j;
        cb(QP.clone(val));
      }
      store.subs.add(s);
      mine.add(s);
      s.kick();
      return () => {
        dead = true;
        store.subs.delete(s);
        mine.delete(s);
      };
    }
    return {
      mock: true,
      who,
      get uid() {
        return who.uid;
      },
      async signIn() {
        return who.uid;
      },
      now: () => Date.now(),
      async get(path) {
        await delay();
        const d = store.read(path);
        if (!canRead(path, who, d)) throw deny(path);
        return d;
      },
      set: (path, data) => send([{ path, data }]),
      update: (path, data) => send([{ path, data, merge: true }]),
      del: (path) => send([{ path, del: true }]),
      // ops: [{path, data, merge?}]  — 한꺼번에(모두 되거나 모두 안 되거나)
      batch: (ops) => send(ops),
      onDoc: (path, cb, onErr) => sub(path, false, cb, onErr),
      onCol: (path, cb, onErr) => sub(path, true, cb, onErr),
      // 모음 전체(읽을 수 없는 문서가 있으면 Firestore 처럼 통째로 거절)
      async all(col) {
        await delay();
        const list = store.list(col);
        if (list.some((d) => !canRead(col + '/' + d.id, who, d.data))) throw deny(col);
        return list;
      },
      async find(col, field, value) {
        await delay();
        return store.list(col).filter((d) => d.data && d.data[field] === value);
      },
      // 시험용: 와이파이 끊김 흉내
      setOffline(on) {
        offline = on;
        if (!on) {
          const ops = pending.splice(0);
          (async () => {
            for (const o of ops) await send(o.ops).then(o.res, o.rej);
            for (const s of mine) s.kick();
          })();
        }
      },
      get offline() {
        return offline;
      },
    };
  };
})(typeof window !== 'undefined' ? window : globalThis);
