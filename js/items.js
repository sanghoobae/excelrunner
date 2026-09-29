// 아이템 정의와 효과
CR.ITEMS = {
  SUM:     { label: '=SUM()',     weight: 28 },
  IFERROR: { label: '=IFERROR()', weight: 20 },
  VLOOKUP: { label: '=VLOOKUP()', weight: 18 },
  F9:      { label: 'F9',         weight: 12 },
  CTRLZ:   { label: 'Ctrl+Z',     weight: 11, stored: true },
  MAX:     { label: '=MAX()',     weight: 11, stored: true },
};

CR.pickItem = () => {
  const keys = Object.keys(CR.ITEMS);
  let r = Math.random() * keys.reduce((s, k) => s + CR.ITEMS[k].weight, 0);
  for (const k of keys) {
    r -= CR.ITEMS[k].weight;
    if (r <= 0) return k;
  }
  return keys[0];
};

CR.applyItem = (g, key) => {
  const it = CR.ITEMS[key];
  if (it.stored) {
    g.stored = key;
    g.ui.flash(`보관함 ← ${it.label}   (Enter로 사용)`);
    return;
  }
  switch (key) {
    case 'SUM':
      g.coins += 10;
      g.ui.flash('=SUM(₩10) → 코인 +10');
      break;
    case 'IFERROR':
      g.buff.shield = g.stats.shieldDur;
      g.ui.flash(`=IFERROR(오류, "무시") → 방어막 ${g.stats.shieldDur}초`);
      break;
    case 'VLOOKUP':
      g.buff.magnet = 8;
      g.ui.flash('=VLOOKUP(₩, 주변, 흡수) → 자석 8초');
      break;
    case 'F9':
      g.buff.slow = 3;
      g.ui.flash('F9 재계산 → 3초간 슬로우 모션');
      break;
  }
};

CR.useStored = (g) => {
  const key = g.stored;
  if (!key) return;
  g.stored = null;
  if (key === 'MAX') {
    g.buff.max = 5;
    g.ui.flash('=MAX(무적) → 5초간 오류 파괴');
  } else if (key === 'CTRLZ') {
    g.rewind();
    g.ui.flash('Ctrl+Z → 실행 취소 (1.5초 전으로)');
  }
};
