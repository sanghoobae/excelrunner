// 초기화, 게임 루프, 키 입력, 화면 전환
(() => {
  const S = CR.Storage;
  S.load();

  const ui = new CR.UI();
  const game = new CR.Game(ui.canvas, ui);
  ui.game = game;
  const SHOP = CR.STAGES.length;
  let stageIdx = Math.min(S.data.unlockedStage - 1, CR.STAGES.length - 1);

  // ---------- 게임 루프 (고정 타임스텝) ----------
  const STEP = 1 / 120;
  let running = false, last = 0, acc = 0;
  function frame(ts) {
    if (!running) return;
    acc += Math.min(0.05, (ts - last) / 1000);
    last = ts;
    while (acc >= STEP && running) { game.update(STEP); acc -= STEP; }
    game.render();
    requestAnimationFrame(frame);
  }
  game.onStateChange = (s) => {
    if (s === 'playing' && !running) {
      running = true; last = performance.now(); acc = 0;
      requestAnimationFrame(frame);
    } else if (s !== 'playing') {
      running = false;
    }
  };

  // ---------- 화면 전환 ----------
  const refreshTabs = () => ui.renderTabs(stageIdx, S.data.unlockedStage);

  function selectStage(i) {
    ui.closeDialog();
    stageIdx = i;
    game.stageIdx = i;
    game.reset();
    ui.build('game');
    refreshTabs();
    game.setState('idle');
  }

  function openShop() {
    game.pause();
    ui.closeDialog();
    ui.build('shop');
    refreshTabs();
  }

  ui.onTab = (i) => {
    if (i === SHOP) { openShop(); return; }
    if (i >= S.data.unlockedStage) {
      ui.dialog({
        icon: 'warn',
        html: '변경하려는 셀이나 차트가 보호된 시트에 있습니다.<br>이전 요일 시트를 먼저 완료하면 보호가 해제됩니다.',
        buttons: [{ label: '확인', primary: true }],
      });
      return;
    }
    // 상점에서 진행 중이던 판으로 돌아가기
    if (i === stageIdx && ui.mode === 'shop' && (game.state === 'paused' || game.state === 'idle')) {
      ui.build('game');
      refreshTabs();
      game.updateHud();
      game.render();
      return;
    }
    selectStage(i);
  };

  ui.onAction = (a) => {
    if (a.startsWith('buy:')) {
      const u = CR.Shop.buy(a.slice(4));
      if (u) {
        ui.build('shop');
        ui.flash(`=구매("${u.name}") → Lv ${S.data.upgrades[u.key]}`);
      }
    } else if (a === 'reset') {
      ui.dialog({
        icon: 'warn',
        html: '코인, 업그레이드, 기록, 해금된 시트가 모두 삭제됩니다.<br>계속하시겠습니까?',
        buttons: [
          { label: '초기화', action: () => { S.reset(); stageIdx = 0; game.stageIdx = 0; game.reset(); game.state = 'idle'; ui.build('shop'); refreshTabs(); } },
          { label: '취소', primary: true },
        ],
      });
    }
  };

  // ---------- 결과 대화상자 ----------
  game.onFinish = (r) => {
    refreshTabs();
    const fmt = (n) => n.toLocaleString('ko-KR');
    const newTag = r.newBest ? '<span class="new">신기록!</span>' : '';
    const coinLine = `₩ ${fmt(r.earned)}` + (r.bonusCoins ? ` + 보너스 ₩ ${r.bonusCoins}` : '');
    const rows = r.stage.endless
      ? [['생존 시간', `${r.sec}초${newTag}`], ['점수', fmt(r.score)], ['획득 코인', coinLine], ['최장 생존', `${r.best}초`]]
      : [['점수', fmt(r.score) + newTag], ['획득 코인', coinLine], ['최고 점수', fmt(r.best)]];
    const table = '<table>' + rows.map(([k, v]) => `<tr><td>${k}</td><td class="v">${v}</td></tr>`).join('') + '</table>';

    if (r.cleared) {
      const isFri = r.stageIdx === CR.STAGES.length - 2;
      const next = r.stageIdx + 1;
      ui.dialog({
        icon: 'info',
        html: `<b>'${r.stage.name}' 시트 저장 완료 — 퇴근 성공!</b>`
          + (isFri ? '<br>이번 주 칼퇴 달성! <b>무한야근</b> 시트가 해금되었습니다.' : `<br><b>${CR.STAGES[next].name}</b> 시트가 해금되었습니다.`)
          + table,
        buttons: [
          { label: isFri ? '무한야근 시작' : '다음 시트', primary: true, action: () => selectStage(next) },
          { label: '업그레이드', action: openShop },
        ],
      });
    } else {
      ui.dialog({
        icon: 'error',
        html: `수식에 오류가 있습니다: <b class="err">${r.cause}</b>` + table,
        buttons: [
          { label: '다시 시도', primary: true, action: () => { selectStage(stageIdx); game.start(); } },
          { label: '업그레이드', action: openShop },
        ],
      });
    }
  };

  // ---------- 키 입력 ----------
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Escape') {
      e.preventDefault();
      if (!ui.boss) game.pause();
      ui.toggleBoss();
      game.render();
      return;
    }
    if (ui.boss) return;

    if (e.code === 'Space') {
      e.preventDefault();
      if (e.repeat) return;
      if (ui.dialogOpen()) { ui.dialogPrimary(); return; }
      if (ui.mode === 'game') game.onSpaceDown();
    } else if (e.code === 'Enter' || e.code === 'NumpadEnter') {
      e.preventDefault();
      if (ui.dialogOpen()) { ui.dialogPrimary(); return; }
      if (ui.mode === 'game') game.onEnter();
    }
  });
  window.addEventListener('keyup', (e) => {
    if (e.code === 'Space') game.onSpaceUp();
  });

  ui.bandBody.addEventListener('click', () => {
    if (ui.dialogOpen() || ui.boss) return;
    if (game.state === 'idle' || game.state === 'paused') game.onSpaceDown();
  });

  // 다른 창으로 전환하면 자동 일시정지
  window.addEventListener('blur', () => game.pause());
  document.addEventListener('visibilitychange', () => { if (document.hidden) game.pause(); });

  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => ui.build(), 100);
  });

  // ---------- 시작 ----------
  game.stageIdx = stageIdx;
  game.reset();
  ui.build('game');
  refreshTabs();
  game.updateHud();
  game.render();

  CR.debug = { game, ui };
})();
