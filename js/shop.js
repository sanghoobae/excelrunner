// 업그레이드 상점 ("업그레이드" 시트)
CR.UPGRADES = [
  { key: 'jump',       name: '점프력',        desc: '최대 점프 높이 +6%',                max: 5, costs: [30, 60, 100, 150, 220] },
  { key: 'doubleJump', name: '3단 점프',      desc: '공중 점프 횟수 +1 (2단 → 3단)',      max: 1, costs: [200] },
  { key: 'shield',     name: '방어막 지속',   desc: '=IFERROR() 지속시간 +2초',          max: 3, costs: [50, 100, 180] },
  { key: 'magnet',     name: '자석 범위',     desc: '=VLOOKUP() 흡수 범위 +25%',         max: 3, costs: [50, 100, 180] },
  { key: 'lives',      name: '시작 목숨',     desc: '시작 목숨 +1',                      max: 2, costs: [200, 400] },
  { key: 'coinMult',   name: '코인 배율',     desc: '코인 획득량 +10%',                  max: 5, costs: [40, 80, 130, 190, 260] },
  { key: 'itemRate',   name: '아이템 등장률', desc: '아이템 등장 확률 +10%',             max: 3, costs: [60, 120, 200] },
];

CR.Shop = (() => {
  const fmt = (n) => Number(n).toLocaleString('ko-KR');
  const HEAD_ROW = 4;
  const NOTE_ROW = HEAD_ROW + CR.UPGRADES.length + 2;
  const REC_ROW = NOTE_ROW + 2;
  const recRows = () => [
    ...CR.STAGES.filter(s => !s.endless).map(s => [s.name, fmt(CR.Storage.data.bestScores[s.id]) + '점']),
    ['무한야근 (최장 생존)', CR.Storage.data.bestSurvivalSec + '초'],
  ];

  function widths() { return [150, 300, 72, 72, 90, 84]; }

  function cell(r, c) {
    const d = CR.Storage.data;
    if (r === 1 && c === 0) return { t: '업그레이드 계획표', cls: 'title' };
    if (r === 2 && c === 0) return { t: '보유 코인', cls: 'bold' };
    if (r === 2 && c === 1) return { t: '₩ ' + fmt(d.coins), cls: 'bold coin' };

    const heads = ['항목', '효과', '현재 Lv', '최대 Lv', '다음 비용', '구매'];
    if (r === HEAD_ROW && c < heads.length) return { t: heads[c], cls: 'th' };

    const i = r - HEAD_ROW - 1;
    if (i >= 0 && i < CR.UPGRADES.length && c < heads.length) {
      const u = CR.UPGRADES[i];
      const lv = d.upgrades[u.key];
      const maxed = lv >= u.max;
      const cost = maxed ? 0 : u.costs[lv];
      switch (c) {
        case 0: return { t: u.name, cls: 'td' };
        case 1: return { t: u.desc, cls: 'td' };
        case 2: return { t: String(lv), cls: 'td num' };
        case 3: return { t: String(u.max), cls: 'td num' };
        case 4: return { t: maxed ? '-' : '₩ ' + fmt(cost), cls: 'td num' };
        case 5:
          if (maxed) return { t: 'MAX', cls: 'td center muted' };
          if (d.coins >= cost) return { t: '구매', cls: 'td center link', action: 'buy:' + u.key };
          return { t: '코인 부족', cls: 'td center muted' };
      }
    }

    if (r === NOTE_ROW && c === 0) return { t: '※ 코인은 매 판이 끝날 때 적립되며, 업그레이드는 다음 판부터 적용됩니다.', cls: 'muted' };

    if (r === REC_ROW && c < 2) return { t: ['시트', '최고 기록'][c], cls: 'th' };
    const rows = recRows();
    const j = r - REC_ROW - 1;
    if (j >= 0 && j < rows.length && c < 2) return { t: rows[j][c], cls: c ? 'td num' : 'td' };

    if (r === REC_ROW + rows.length + 2 && c === 0) return { t: '저장 데이터 초기화', cls: 'link muted', action: 'reset' };
    return null;
  }

  function buy(key) {
    const d = CR.Storage.data;
    const u = CR.UPGRADES.find(x => x.key === key);
    const lv = d.upgrades[key];
    if (!u || lv >= u.max || d.coins < u.costs[lv]) return false;
    d.coins -= u.costs[lv];
    d.upgrades[key] = lv + 1;
    CR.Storage.save();
    return u;
  }

  return { widths, cell, buy };
})();
