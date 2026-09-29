// 장애물 패턴(chunk) 생성기
// 각 함수는 시작 x와 kit을 받아 지형/장애물/코인을 배치하고, 사용한 길이를 반환한다.
(() => {
  const GY = CR.C.GROUND_Y;
  const ROW = CR.C.ROW_H;
  const rand = (a, b) => a + Math.random() * (b - a);

  const OBS = {
    NA:    { label: '#N/A',    w: 32 },
    VALUE: { label: '#VALUE!', w: 44 },
    NAME:  { label: '#NAME?',  w: 44 },
    REF:   { label: '#REF!',   w: 36 },
    DIV:   { label: '#DIV/0!', w: 44 },
  };

  // rows: 높이(셀 행 수), yTop 미지정 시 바닥에 붙음
  function err(type, x, rows = 1, yTop = null, extra = {}) {
    const o = OBS[type];
    const h = ROW * rows;
    return { label: o.label, x, y: yTop ?? GY - h, w: o.w, h, vx: 0, ...extra };
  }

  CR.Chunks = {
    coins(x, k) {
      const n = 5, sp = 28, L = n * sp + 140;
      k.ground(x, L);
      const arc = Math.random() < 0.6;
      for (let i = 0; i < n; i++) {
        const t = i / (n - 1);
        k.coin(x + 30 + i * sp, arc ? GY - 20 - Math.sin(t * Math.PI) * 36 : GY - 18);
      }
      k.item(x + L - 50, GY - 40);
      return L;
    },

    low(x, k) {
      const L = 150 * k.sf;
      k.ground(x, L);
      k.obstacle(err('NA', x + L * 0.45));
      k.coin(x + L * 0.45 + 9, GY - 52);
      return L;
    },

    doubleLow(x, k) {
      const d = 170 * k.sf;
      const L = d + 160 * k.sf;
      k.ground(x, L);
      k.obstacle(err('NA', x + 60 * k.sf));
      k.obstacle(err(Math.random() < 0.5 ? 'NA' : 'DIV', x + 60 * k.sf + d));
      return L;
    },

    tall(x, k) {
      const L = 180 * k.sf;
      k.ground(x, L);
      k.obstacle(err('VALUE', x + L * 0.45, 2));
      k.coin(x + L * 0.45 + 15, GY - 72);
      return L;
    },

    pit(x, k) {
      const a = 40, g = rand(50, 75) * k.sf, b = 70;
      k.ground(x, a);
      k.ground(x + a + g, b);
      for (let i = 0; i < 3; i++) k.coin(x + a + g / 2 - 28 + i * 28 - 7, GY - 40 - (i === 1 ? 10 : 0));
      return a + g + b;
    },

    pitWide(x, k) {
      const a = 40, g = rand(80, 95) * k.sf, b = 80;
      k.ground(x, a);
      k.ground(x + a + g, b);
      k.coin(x + a + g / 2 - 7, GY - 62);
      return a + g + b;
    },

    // 공중 오류: 가만히 있으면 머리 위로 지나감, 점프하면 부딪힘
    air(x, k) {
      const L = 220 * k.sf;
      k.ground(x, L);
      k.obstacle(err('NAME', x + L * 0.5, 1, GY - 2 * ROW, { vx: 120, trigger: 420 }));
      return L;
    },

    // 바닥으로 빠르게 달려오는 오류: 타이밍 점프
    airLow(x, k) {
      const L = 220 * k.sf;
      k.ground(x, L);
      k.obstacle(err('NAME', x + L * 0.5, 1, null, { vx: 110, trigger: 380 }));
      return L;
    },

    // 위아래로 움직이는 오류
    moving(x, k) {
      const L = 200 * k.sf;
      k.ground(x, L);
      k.obstacle(err('REF', x + L * 0.5, 1, GY - 2 * ROW, {
        base: GY - 2 * ROW, amp: ROW, freq: 3.2, phase: rand(0, Math.PI * 2),
      }));
      return L;
    },

    // 짧은 발판 연속
    steps(x, k) {
      let cx = x;
      k.ground(cx, 30); cx += 30;
      const n = 3;
      for (let i = 0; i < n; i++) {
        const gap = rand(40, 55) * k.sf, plat = rand(60, 75) * k.sf;
        cx += gap;
        k.ground(cx, plat);
        k.coin(cx + plat / 2 - 7, GY - 30);
        cx += plat;
      }
      return cx - x;
    },

    // 결산 러시: 오류 셀이 연달아 등장
    rush(x, k) {
      const sp = 170 * k.sf;
      const L = sp * 3 + 60;
      k.ground(x, L);
      k.obstacle(err('DIV', x + 40));
      k.obstacle(err('DIV', x + 40 + sp, 2));
      k.obstacle(err('DIV', x + 40 + sp * 2));
      return L;
    },
  };
})();
