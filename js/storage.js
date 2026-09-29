window.CR = window.CR || {};

// 게임 공통 상수 (게임 띠 = 셀 5행)
CR.C = {
  ROW_H: 22,
  BAND_ROWS: 5,
  BAND_ROW: 3,          // 게임 띠가 시작하는 시트 행 번호
  HEADER_W: 40,         // 행 머리글 폭
  BASE_SPEED: 250,      // px/s
  GRAVITY: 2400,
  JUMP_V: 420,
  DJUMP_V: 360,
  HOLD_GRAV: 0.45,      // Space를 누르고 있는 동안의 중력 배율
  HOLD_MAX: 0.16,       // 길게 눌러 상승을 유지할 수 있는 최대 시간(초)
};
CR.C.BAND_H = CR.C.ROW_H * CR.C.BAND_ROWS;   // 110
CR.C.GROUND_Y = CR.C.BAND_H - CR.C.ROW_H;    // 88

CR.Storage = (() => {
  const KEY = 'cellRunner.save';
  const defaults = () => ({
    version: 1,
    coins: 0,
    upgrades: { jump: 0, doubleJump: 0, shield: 0, magnet: 0, lives: 0, coinMult: 0, itemRate: 0 },
    unlockedStage: 1,
    bestScores: { mon: 0, tue: 0, wed: 0, thu: 0, fri: 0 },
    bestSurvivalSec: 0,
  });
  let data = defaults();

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const p = JSON.parse(raw);
        const d = defaults();
        data = {
          ...d, ...p,
          upgrades: { ...d.upgrades, ...(p.upgrades || {}) },
          bestScores: { ...d.bestScores, ...(p.bestScores || {}) },
        };
      }
    } catch (e) { /* 저장소를 못 쓰면 기본값으로 진행 */ }
    return data;
  }

  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) { /* 무시 */ }
  }

  function reset() { data = defaults(); save(); }

  return { load, save, reset, get data() { return data; } };
})();
