// 엑셀 위장 UI: 시트 격자, 수식 입력줄, 상태 표시줄, 시트 탭, 대화상자, 보스 키
(() => {
  const C = CR.C;
  const $ = (s) => document.querySelector(s);
  const el = (tag, cls) => { const e = document.createElement(tag); if (cls) e.className = cls; return e; };

  function colName(i) {
    let s = '';
    i += 1;
    while (i > 0) { const m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); }
    return s;
  }
  CR.colName = colName;

  // ---------- 가짜 매출 데이터 ----------
  CR.FakeData = (() => {
    const REGIONS = ['서울', '경기', '인천', '부산', '대구', '광주', '대전', '울산', '세종', '강원',
      '충북', '충남', '전북', '전남', '경북', '경남', '제주', '해외(미주)', '해외(유럽)', '해외(아시아)'];
    const HEADS = ['지역', '7월', '8월', '9월', '3분기 합계', '전년 동기', '증감률', '목표', '달성률'];
    const HEAD_ROW = 9;
    const fmt = (n) => Math.round(n).toLocaleString('ko-KR');
    const pct = (x) => (x * 100).toFixed(1) + '%';

    let seed = 20260929;
    const rnd = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };

    const rows = REGIONS.map((name) => {
      const base = 300 + rnd() * 2400;
      const m = [0, 1, 2].map(() => base * (0.88 + rnd() * 0.24));
      const sum = m[0] + m[1] + m[2];
      const prev = sum * (0.85 + rnd() * 0.3);
      const target = sum * (0.9 + rnd() * 0.2);
      return { name, m, sum, prev, target };
    });
    const tot = rows.reduce((a, r) => ({
      m: a.m.map((v, i) => v + r.m[i]), sum: a.sum + r.sum, prev: a.prev + r.prev, target: a.target + r.target,
    }), { m: [0, 0, 0], sum: 0, prev: 0, target: 0 });

    function rowCells(r, c, cls) {
      const g = r.sum / r.prev - 1;
      switch (c) {
        case 0: return { t: r.name, cls };
        case 1: case 2: case 3: return { t: fmt(r.m[c - 1]), cls: cls + ' num' };
        case 4: return { t: fmt(r.sum), cls: cls + ' num' };
        case 5: return { t: fmt(r.prev), cls: cls + ' num' };
        case 6: return { t: pct(g), cls: cls + ' num' + (g < 0 ? ' neg' : '') };
        case 7: return { t: fmt(r.target), cls: cls + ' num' };
        case 8: return { t: pct(r.sum / r.target), cls: cls + ' num' };
      }
      return null;
    }

    function cell(r, c) {
      if (r === 1 && c === 0) return { t: '2026년 3분기 지역별 매출 실적', cls: 'title' };
      if (r === 2 && c === 0) return { t: '기준일: 2026-09-29  |  단위: 백만원', cls: 'muted' };
      if (r === HEAD_ROW && c < HEADS.length) return { t: HEADS[c], cls: 'th' };
      const i = r - HEAD_ROW - 1;
      if (c < HEADS.length) {
        if (i >= 0 && i < rows.length) return rowCells(rows[i], c, 'td');
        if (i === rows.length) return rowCells({ name: '합계', ...tot }, c, 'total');
      }
      return null;
    }

    function widths() { return [104]; }

    return { cell, widths };
  })();

  // ---------- UI ----------
  CR.UI = class {
    constructor() {
      this.sheet = $('#sheet');
      this.grid = $('#grid');
      this.nameBox = $('#nameBox');
      this.formula = $('#formula');
      this.stLeft = $('#stLeft');
      this.stStats = $('#stStats');
      this.tabsEl = $('#tabs');
      this.dlgLayer = $('#dialogLayer');

      this.mode = 'game';
      this.boss = false;
      this.game = null;
      this.hud = { name: 'A1', formula: '', left: '준비', stats: '' };
      this.flashText = '';
      this.flashUntil = 0;
      this.shown = {};
      this.tabState = { current: 0, unlocked: 1 };
      this.dlg = null;
      this.onTab = null;
      this.onAction = null;

      // 게임 띠 (시트 3~7행)
      this.band = el('div', 'band');
      const hdrs = el('div', 'band-hdrs');
      for (let i = 0; i < C.BAND_ROWS; i++) {
        const h = el('div', 'rh');
        h.textContent = C.BAND_ROW + i;
        hdrs.appendChild(h);
      }
      this.bandBody = el('div', 'band-body');
      this.canvas = el('canvas');
      this.bandBody.appendChild(this.canvas);
      this.band.append(hdrs, this.bandBody);

      this.grid.addEventListener('click', (e) => {
        const t = e.target.closest('[data-action]');
        if (t && this.onAction) this.onAction(t.dataset.action);
      });
    }

    widths(mode, avail) {
      const base = mode === 'shop' ? CR.Shop.widths() : CR.FakeData.widths();
      const arr = [];
      let sum = 0;
      for (let i = 0; sum < avail + 80; i++) {
        const w = base[i] ?? 72;
        arr.push(w);
        sum += w;
      }
      return arr;
    }

    // 시트 격자를 다시 그린다. 보스 모드에서는 항상 매출 데이터 화면.
    build(mode) {
      if (mode) this.mode = mode;
      const vm = this.boss ? 'game' : this.mode;
      const widths = this.widths(vm, this.sheet.clientWidth - C.HEADER_W);
      const frag = document.createDocumentFragment();

      const hr = el('div', 'row');
      hr.appendChild(el('div', 'corner'));
      widths.forEach((w, i) => {
        const d = el('div', 'ch');
        d.style.width = w + 'px';
        d.textContent = colName(i);
        hr.appendChild(d);
      });
      frag.appendChild(hr);

      const content = vm === 'shop' ? CR.Shop.cell : CR.FakeData.cell;
      const nRows = Math.ceil(this.sheet.clientHeight / C.ROW_H) + 1;
      for (let r = 1; r <= nRows; r++) {
        if (vm === 'game' && r === C.BAND_ROW) {
          frag.appendChild(this.band);
          r += C.BAND_ROWS - 1;
          continue;
        }
        const row = el('div', 'row');
        const h = el('div', 'rh');
        h.textContent = r;
        row.appendChild(h);
        widths.forEach((w, c) => {
          const d = el('div', 'c');
          d.style.width = w + 'px';
          const v = content(r, c);
          if (v) {
            d.textContent = v.t;
            if (v.cls) d.className = 'c ' + v.cls;
            if (v.action) d.dataset.action = v.action;
          }
          row.appendChild(d);
        });
        frag.appendChild(row);
      }
      this.grid.replaceChildren(frag);

      if (vm === 'game' && this.game) this.game.resize(this.bandBody.clientWidth, widths);
      this.paint();
    }

    renderTabs(current, unlocked) {
      if (current !== undefined) this.tabState = { current, unlocked };
      const { current: cur, unlocked: un } = this.tabState;
      const names = this.boss
        ? ['요약', '7월', '8월', '9월', '지역별', '원자료', '참고']
        : [...CR.STAGES.map(s => s.name), '업그레이드'];
      const shopIdx = CR.STAGES.length;
      this.tabsEl.replaceChildren(...names.map((n, i) => {
        const t = el('div', 'tab');
        t.textContent = n;
        const active = this.boss ? i === 0 : (this.mode === 'shop' ? i === shopIdx : i === cur);
        if (active) t.classList.add('active');
        if (!this.boss && i < shopIdx && i >= un) t.classList.add('locked');
        t.addEventListener('click', () => { if (!this.boss && this.onTab) this.onTab(i); });
        return t;
      }));
    }

    setHud(h) { Object.assign(this.hud, h); this.paint(); }

    flash(text, sec = 1.6) {
      this.flashText = text;
      this.flashUntil = performance.now() + sec * 1000;
      this.paint();
      clearTimeout(this.flashTimer);
      this.flashTimer = setTimeout(() => this.paint(), sec * 1000 + 20);
    }

    // 수식 입력줄 / 이름 상자 / 상태 표시줄 갱신 (바뀐 값만 DOM에 반영)
    paint() {
      const flashing = performance.now() < this.flashUntil;
      let v;
      if (this.boss) {
        v = { name: 'A1', formula: '2026년 3분기 지역별 매출 실적', left: '준비', stats: '' };
      } else if (this.mode === 'shop') {
        v = {
          name: 'F5',
          formula: flashing ? this.flashText : '업그레이드 계획표',
          left: '준비',
          stats: `합계: ₩ ${CR.Storage.data.coins.toLocaleString('ko-KR')}`,
        };
      } else {
        v = { ...this.hud, formula: flashing ? this.flashText : this.hud.formula };
      }
      this.set('name', this.nameBox, v.name);
      this.set('formula', this.formula, v.formula);
      this.set('left', this.stLeft, v.left);
      this.set('stats', this.stStats, v.stats);
    }

    set(key, node, val) {
      if (this.shown[key] !== val) { this.shown[key] = val; node.textContent = val; }
    }

    toggleBoss() {
      this.boss = !this.boss;
      document.body.classList.toggle('boss', this.boss);
      this.build();
      this.renderTabs();
    }

    // ---------- 대화상자 ----------
    dialog({ icon = 'info', title = 'Microsoft Excel', html, buttons }) {
      this.closeDialog();
      const d = el('div', 'dlg');
      const glyph = { error: '✕', info: 'i', warn: '!' }[icon];
      d.innerHTML = `
        <div class="dlg-title"><span>${title}</span><span class="x">✕</span></div>
        <div class="dlg-body"><div class="dlg-ico ${icon}">${glyph}</div><div class="dlg-msg">${html}</div></div>
        <div class="dlg-btns"></div>`;
      const btnBox = d.querySelector('.dlg-btns');
      buttons.forEach((b) => {
        const e = el('button', b.primary ? 'primary' : '');
        e.textContent = b.label;
        e.addEventListener('click', () => { this.closeDialog(); b.action && b.action(); });
        btnBox.appendChild(e);
      });
      d.querySelector('.x').addEventListener('click', () => this.closeDialog());
      this.dlgLayer.appendChild(d);
      this.dlg = { el: d, buttons, armedAt: performance.now() + 450 };
    }

    dialogOpen() { return !!this.dlg; }

    dialogPrimary() {
      if (!this.dlg || performance.now() < this.dlg.armedAt) return;
      const b = this.dlg.buttons.find(x => x.primary) || this.dlg.buttons[0];
      this.closeDialog();
      b.action && b.action();
    }

    closeDialog() {
      if (this.dlg) { this.dlg.el.remove(); this.dlg = null; }
    }
  };
})();
