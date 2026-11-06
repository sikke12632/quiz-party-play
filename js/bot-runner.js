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
      if (c.mafia) return actMafia(b);
      if (c.boss) QP.boBotFly(c);
      else if (c.treasure) walkTreasure(b);
      if (c.chase) runChase(b);
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
    // 엄마 피해 도망가기 봇: 갈림길마다 고르는 시간 안에 길을 하나 누른다(맞을 확률 = 정답률보다 조금 높게)
    function runChase(b) {
      const c = b.c;
      if (c.phase !== 'chase' || !c.game.ch || b.ran === c.game.ch.mg) return;
      const L = c.game.ch,
        cfg = c.game.cfg;
      b.ran = L.mg;
      const gates = QP.chGates(L.seed, cfg, L.mg),
        times = QP.chTimes(cfg, L.mg);
      const skill = Math.min(0.98, b.acc + 0.25);
      gates.forEach((g, j) => {
        const tm = times[j];
        const at = L.t0 + QP.ms(tm.ch0 + 0.3 + Math.random() * (tm.ch1 - tm.ch0 - 0.6));
        const el = (at - L.t0) / QP.ms(1) - tm.ch0; // 고르기 시작 뒤 몇 초에 누르나
        setTimeout(() => {
          const right = Math.random() < skill;
          // 안개 속에서 누르면 그냥 찍기, 바위가 떨어지기 전에 누르면 그 길도 뚫려 보인다
          const seen = g.ev === 'fall' && el < g.fallAt ? g.open.concat([g.fall]) : g.open;
          const blind = g.ev === 'fog' && el < g.fogT;
          const lanes = blind ? [0, 1, 2, 3] : [0, 1, 2, 3].filter((l) => right === seen.includes(l));
          c.pickLane(QP.chCode(L.mg, j), lanes[Math.floor(Math.random() * lanes.length)]);
        }, Math.max(0, at - c.net.now()));
      });
    }
    // 보물 지키기 봇: 미니게임 동안 가까운 적 쪽으로 걷고 위치를 보낸다
    function walkTreasure(b) {
      const c = b.c;
      if (c.phase !== 'defend' || !c.game.live || !c.seat || b.walk === c.game.live.mg) return;
      const L = c.game.live,
        team = c.seat.team;
      b.walk = L.mg;
      const mates = (c.game.roster || []).filter((x) => x.team === team);
      const k = mates.findIndex((x) => x.sid === c.seat.sid);
      const E = QP.trSchedule(L.seed, L.dur, L.n[team], L.spd);
      const home = QP.trHome(k, mates.length);
      let p = home.slice();
      const dead = {};
      const tm = setInterval(() => {
        if (c.phase !== 'defend' || c.game.live.mg !== L.mg) return clearInterval(tm);
        const t = (c.net.now() - L.t0) / QP.ms(1);
        if (t < 0) return;
        for (const x of c.game.live.kills[team] || []) dead[x[0]] = 1;
        p = QP.trBotMove(p, E, t, 0.1, dead, home);
        c.sendPos(p[0], p[1]);
      }, QP.ms(0.1));
    }
    // 도깨비 찾기 봇: 답 → 상자 → 돋보기·지목 → 투표 (마을은 마지막 힌트 무리를 의심, 도깨비는 동료를 감싼다)
    function actMafia(b) {
      const c = b.c;
      if (!c.game.mp || !c.seat) return;
      const r = c.round;
      const q = c.myQ();
      if (q && b.busy.a !== r) {
        b.busy.a = r;
        setTimeout(() => {
          const a = answerOf(q.id);
          const right = Math.random() < b.acc;
          c.answer(right ? a : q.ch ? q.ch.find((x) => x !== a) : a === 'O' ? 'X' : '0');
        }, QP.ms(b.speed * (0.5 + Math.random())));
      }
      const role = c.seat.role || {};
      const mp = c.game.mp;
      const dolls = (c.game.dolls || []).map((d) => d.sid).filter((sid) => sid !== c.seat.sid && !mp.caught.includes(sid) && !mp.good.includes(sid));
      const res = c.myRes();
      // 돋보기(진짜·가짜 모두 같은 단추): 빛이 도는 동안 쓴다
      if (c.phase === 'result' && res && res.ok && c.mine('magR') && b.busy.mg !== r) {
        b.busy.mg = r;
        setTimeout(() => c.magnify(dolls[Math.floor(Math.random() * dolls.length)]), QP.ms(1));
      }
      if (c.mine('nomR') && b.busy.tg !== r) {
        b.busy.tg = r;
        const hint = (mp.hints.slice(-1)[0] || []).filter((x) => dolls.includes(x));
        const pool = role.g ? dolls : hint.length ? hint : dolls; // 2판: 도깨비끼리 모른다
        const pickT = Math.random() < 0.15 ? '' : pool[Math.floor(Math.random() * pool.length)];
        const tryNom = () => c.nominate(pickT) || (c.phase === 'result' && c.round === r && setTimeout(tryNom, QP.ms(0.3)));
        setTimeout(tryNom, c.rollLeft() + QP.ms(1.5));
      }
      if (c.phase === 'vote' && c.mine('voteR') && b.busy.v !== r) {
        b.busy.v = r;
        const tgt = mp.nom && mp.nom.target;
        const inHint = (mp.hints.slice(-1)[0] || []).includes(tgt);
        const yes = role.g ? true : Math.random() < (inHint ? 0.75 : 0.4);
        setTimeout(() => c.vote(yes), QP.ms(1 + Math.random() * 2));
      }
    }
    return bots;
  };
})();
