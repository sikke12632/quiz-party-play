/* bot-runner.js — 가짜 친구(봇)를 브라우저 안에서 돌린다. 가짜 서버(?mock·미리 보기)에서만.
 * 선생님 화면에서 판을 만들면 모이는 곳 판을 찾아 들어간다. 정답률 40~95%, 상자·대상도 스스로 고른다.
 */
(function () {
  'use strict';
  const QP = window.QP;
  QP.runBots = async function (N, onStatus) {
    QP.mockStore = QP.mockStore || QP.localStore();
    let gid = null,
      code = null;
    while (!code) {
      const g = QP.mockStore.list('qp_games').filter((d) => d.data && d.data.phase === 'lobby').sort((a, b) => b.data.at - a.data.at)[0];
      if (g) (gid = g.id), (code = g.data.code);
      else await QP.sleep(1000);
    }
    if (onStatus) onStatus(code);
    const answerOf = (qid) => {
      const s = QP.mockStore.read('qp_games/' + gid + '/private/state');
      const q = s && s.qs.find((x) => x.id === qid);
      return q ? (Array.isArray(q.answer) ? q.answer[0] : q.answer) : null;
    };
    const nums = QP.NUMS.slice().reverse();
    const bots = [];
    for (let i = 0; i < N; i++) {
      const net = QP.mockNet(QP.mockStore, { uid: 'bot-' + i, latency: [60, 200] });
      const b = { i, acc: 0.4 + Math.random() * 0.55, speed: 3 + Math.random() * 10, busy: {}, num: nums[i] };
      b.c = new QP.KidClient(net, { onUpdate: () => act(b) });
      bots.push(b);
      b.c.enter(code).then(() => b.c.join(b.num));
      await QP.sleep(150);
    }
    function act(b) {
      const c = b.c;
      if (c.screen !== 'seat') return;
      const r = c.round, q = c.myQ();
      if (q && b.busy.a !== r) {
        b.busy.a = r;
        setTimeout(() => {
          const right = Math.random() < b.acc, a = answerOf(q.id);
          let v;
          if (q.type === 'choice') v = right ? a : q.ch.find((x) => x !== a);
          else if (q.type === 'ox') v = right ? a : a === 'O' ? 'X' : 'O';
          else v = right ? a : '0';
          c.answer(v);
        }, QP.ms(b.speed * (0.5 + Math.random())));
      }
      const res = c.myRes();
      if (c.phase === 'chest' && res && res.ok && b.busy.c !== r) {
        b.busy.c = r;
        setTimeout(() => c.pickChest(Math.floor(Math.random() * 3)), QP.ms(1 + Math.random() * 3));
      }
      const o = c.myOpen();
      if (c.phase === 'chest' && o && o.targets && b.busy.tg !== r) {
        b.busy.tg = r;
        const t = Math.random() < 0.7 ? o.targets[0] : o.targets[Math.floor(Math.random() * o.targets.length)];
        setTimeout(() => c.pickTarget(t), QP.ms(1 + Math.random() * 3));
      }
    }
    return bots;
  };
})();
