/* mypacks.js — 선생님이 엑셀로 넣은 문제 묶음 저장소
 * 서버(qp_packs, 선생님만 읽고 쓴다 — firestore.rules)와 이 브라우저(localStorage) 두 곳에 둔다.
 *   - 집 PC에서 넣고 교실 전자칠판에서 써도 서버에서 받아 온다.
 *   - 서버에 못 쓰면(규칙을 아직 안 올렸거나 인터넷이 끊김) 이 브라우저에만 두고, 다음에 목록을 열 때 서버로 올린다.
 * 아이 기기는 이 묶음(정답)을 읽을 수 없다. 아이는 심판이 보낸 문제만 받는다.
 */
(function (root) {
  'use strict';
  const QP = root.QP;
  const COL = 'qp_packs';
  QP.MyPacks = class {
    constructor(net, kv) {
      this.net = net;
      this.kv = kv; // {get(), set(v)}
      this.serverOk = null;
    }
    local() {
      return this.kv.get() || {};
    }
    setLocal(m) {
      this.kv.set(m);
    }
    meta(p) {
      const m = { id: p.id, title: p.title, subject: p.subject, grade: p.grade, count: p.questions.length, nChoice: p.questions.filter((q) => (q.type || 'choice') === 'choice').length, test: !!p.test, at: p.at || 0, source: p.source || '' };
      for (const k of ['unit', 'unitTitle', 'topic', 'topicTitle', 'lessons', 'name', 'tb']) if (p[k] !== undefined) m[k] = p[k];
      return m;
    }
    // 목록(문제 없이). 서버와 이 브라우저를 합치고, 이 브라우저에만 있는 것은 서버로 올린다
    async list() {
      const loc = this.local();
      let server = [];
      try {
        server = (await this.net.all(COL)).map((d) => d.data).filter(Boolean);
        this.serverOk = true;
      } catch (e) {
        this.serverOk = false;
      }
      const map = new Map();
      for (const p of server) map.set(p.id, Object.assign(this.meta(p), { where: 'server' }));
      for (const id in loc) {
        if (map.has(id)) continue;
        map.set(id, Object.assign(this.meta(loc[id]), { where: 'local' }));
        if (this.serverOk) await this.net.set(COL + '/' + id, loc[id]).then(() => (map.get(id).where = 'server')).catch(() => {});
      }
      // 서버에 있는 것은 이 브라우저에도 사본을 둔다(인터넷이 잠깐 끊겨도 판을 만들 수 있게)
      if (this.serverOk) {
        const m = Object.assign({}, loc);
        for (const p of server) m[p.id] = p;
        this.setLocal(m);
      }
      return [...map.values()].sort((a, b) => (a.subject + a.title < b.subject + b.title ? -1 : 1));
    }
    async get(id) {
      try {
        const p = await this.net.get(COL + '/' + id);
        if (p) return p;
      } catch (e) {}
      return this.local()[id] || null;
    }
    // 넣기(같은 id 면 새것으로 바꾼다). 돌려줌: 서버에 저장했는지
    async save(pack) {
      pack = Object.assign({}, pack, { at: this.net.now() });
      const m = this.local();
      m[pack.id] = pack;
      this.setLocal(m);
      try {
        await this.net.set(COL + '/' + pack.id, pack);
        return true;
      } catch (e) {
        return false;
      }
    }
    async remove(id) {
      const m = this.local();
      delete m[id];
      this.setLocal(m);
      try {
        await this.net.del(COL + '/' + id);
      } catch (e) {}
    }
    async rename(id, title) {
      const p = await this.get(id);
      if (!p) return false;
      p.title = title;
      return this.save(p);
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
