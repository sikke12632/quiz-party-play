/* connect.js — 어느 서버에 붙을지 고른다
 *   ?mock : 이 브라우저 안의 가짜 서버(탭끼리 연결. 시험·미리 보기용)
 *   ?emu  : 이 컴퓨터의 Firebase 에뮬레이터
 *   (없음): 진짜 서버
 * 가짜 서버에서 ?as=이름 을 붙이면 다른 기기인 척한다(같은 브라우저에서 아이 여러 명 시험).
 */
(function (root) {
  'use strict';
  const QP = root.QP;
  const P = new URLSearchParams(location.search);
  // 미리 보기(claude.ai 비공개 페이지): 시작 페이지가 이 표시를 남긴다. 탭마다 다른 아이가 된다.
  let PV = root.QP_PREVIEW || null;
  try {
    PV = PV || JSON.parse(localStorage.getItem('qp-preview') || 'null');
  } catch (e) {}
  QP.preview = PV;
  QP.isMock = P.has('mock') || !!root.QP_MOCK || !!PV;
  // 시험용: 가짜 서버에서 ?fast=0.3 이면 모든 시간을 0.3배로
  if (QP.isMock && +P.get('fast') > 0) QP.timeScale = +P.get('fast');
  QP.connect = async function (kind) {
    if (QP.isMock) {
      let uid;
      if (kind === 'teacher') uid = 'teacher-mock';
      else if (P.get('as')) uid = 'kid-' + P.get('as');
      else {
        try {
          const st = PV ? sessionStorage : localStorage; // 미리 보기: 탭 하나 = 아이 한 명
          uid = st.getItem('qp-mock-uid');
          if (!uid) st.setItem('qp-mock-uid', (uid = 'kid-' + QP.id(6)));
        } catch (e) {
          uid = 'kid-' + QP.id(6);
        }
      }
      QP.mockStore = QP.mockStore || QP.localStore();
      return QP.mockNet(QP.mockStore, { uid, teacher: kind === 'teacher', latency: [40, 160] });
    }
    const net = await QP.fireNet({ emu: P.has('emu') });
    return net;
  };
  // 새로 고침 뒤 이어 하기용 저장 (실패해도 괜찮게)
  QP.kv = function (key, perTab) {
    const st = () => (perTab ? sessionStorage : localStorage);
    return {
      get() {
        try {
          return JSON.parse(st().getItem(key) || 'null');
        } catch (e) {
          return null;
        }
      },
      set(v) {
        try {
          v === null ? st().removeItem(key) : st().setItem(key, JSON.stringify(v));
        } catch (e) {}
      },
    };
  };
})(window);
