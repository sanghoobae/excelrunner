// 게임 본체: 상태, 월드 스크롤, 충돌, 렌더링
(() => {
  const C = CR.C;
  const H = C.BAND_H;
  const GY = C.GROUND_Y;
  const ROW = C.ROW_H;
  const FONT = '"Malgun Gothic","맑은 고딕","Segoe UI",sans-serif';
  const rand = (a, b) => a + Math.random() * (b - a);
  const hit = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  const BUFFS = ['shield', 'magnet', 'slow', 'max', 'invuln'];

  function pickWeighted(w) {
    const keys = Object.keys(w);
    let r = Math.random() * keys.reduce((s, k) => s + w[k], 0);
    for (const k of keys) { r -= w[k]; if (r <= 0) return k; }
    return keys[0];
  }

  CR.Game = class {
    constructor(canvas, ui) {
      this.cv = canvas;
      this.ctx = canvas.getContext('2d');
      this.ui = ui;
      this.W = 800;
      this.colW = [104];
      this.player = new CR.Player();
      this.stageIdx = 0;
      this.state = 'idle';     // idle | playing | paused | over | clear
      this.onStateChange = () => {};
      this.onFinish = () => {};
      this.reset();
    }

    get stage() { return CR.STAGES[this.stageIdx]; }

    setState(s) {
      this.state = s;
      this.onStateChange(s);
      this.updateHud();
      this.render();
    }

    resize(w, colWidths) {
      if (w <= 0) return;
      const dpr = window.devicePixelRatio || 1;
      this.W = w;
      this.cv.width = Math.round(w * dpr);
      this.cv.height = Math.round(H * dpr);
      this.cv.style.width = w + 'px';
      this.cv.style.height = H + 'px';
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      this.colW = colWidths;
      this.fill();
      this.render();
    }

    computeStats() {
      const u = CR.Storage.data.upgrades;
      this.stats = {
        jumpMult: 1 + 0.03 * u.jump,
        airJumps: 1 + u.doubleJump,   // 기본 2단 점프, 업그레이드 시 3단
        shieldDur: 8 + 2 * u.shield,
        magnetR: 90 * (1 + 0.25 * u.magnet),
        lives: 1 + u.lives,
        coinMult: 1 + 0.1 * u.coinMult,
        itemChance: Math.min(0.9, 0.3 * (1 + 0.1 * u.itemRate)),
      };
    }

    reset() {
      this.computeStats();
      this.groundEnd = Math.min(this.W, 700);
      this.grounds = [{ x: -100, w: this.groundEnd + 100 }];
      this.obstacles = [];
      this.pickups = [];
      this.effects = [];
      this.player.reset();
      this.elapsed = 0;
      this.distance = 0;
      this.coins = 0;
      this.bonus = 0;
      this.lives = this.stats.lives;
      this.stored = null;
      this.buff = { shield: 0, magnet: 0, slow: 0, max: 0, invuln: 0 };
      this.snaps = [];
      this.snapT = 0;
      this.fxRewind = 0;
      this.deathCause = '';
      this.fill();
    }

    // ---------- 난이도 ----------
    progress() {
      return this.stage.endless ? Math.min(this.elapsed / 180, 1) : Math.min(this.elapsed / this.stage.duration, 1);
    }

    speedMult() {
      const st = this.stage;
      return st.endless ? Math.min(1 + this.elapsed / 150, 2.4) : st.speed * (1 + 0.12 * this.progress());
    }

    score() { return Math.floor(this.distance / 10) + this.coins * 10 + this.bonus; }

    // ---------- 월드 생성 ----------
    fill() {
      while (this.groundEnd < this.W + 150) this.generate();
    }

    addGround(x, w) {
      const g = this.grounds[this.grounds.length - 1];
      if (g && Math.abs(g.x + g.w - x) < 0.5) g.w += w;
      else this.grounds.push({ x, w });
    }

    generate() {
      const st = this.stage;
      const sf = this.speedMult();
      const gapF = st.endless ? Math.max(0.6, 1 - this.elapsed / 300) : 1 - 0.25 * this.progress();
      const gap = rand(st.gap[0], st.gap[1]) * sf * gapF;
      this.addGround(this.groundEnd, gap);
      if (gap > 200 && Math.random() < this.stats.itemChance * 0.4) this.addItem(this.groundEnd + gap / 2, GY - 40);
      this.groundEnd += gap;

      const kit = {
        sf,
        ground: (x, w) => this.addGround(x, w),
        obstacle: (o) => this.obstacles.push(o),
        coin: (x, y) => this.pickups.push({ kind: 'coin', x, y, w: 14, h: 14 }),
        item: (x, y) => { if (Math.random() < this.stats.itemChance) this.addItem(x, y); },
      };
      this.groundEnd += CR.Chunks[pickWeighted(st.chunks)](this.groundEnd, kit);
    }

    addItem(cx, y) {
      const key = CR.pickItem();
      const label = CR.ITEMS[key].label;
      this.ctx.font = '12px ' + FONT;
      const w = Math.ceil(this.ctx.measureText(label).width) + 10;
      this.pickups.push({ kind: 'item', key, label, x: cx - w / 2, y, w, h: 20 });
    }

    isOver(x1, x2) {
      for (const g of this.grounds) if (g.x < x2 && g.x + g.w > x1) return true;
      return false;
    }

    // ---------- 입력 ----------
    start() {
      if (this.state === 'over' || this.state === 'clear') this.reset();
      this.setState('playing');
      this.ui.flash(this.stage.line, 2.2);
    }
    pause() { if (this.state === 'playing') { this.player.release(); this.setState('paused'); } }
    resume() { if (this.state === 'paused') this.setState('playing'); }

    onSpaceDown() {
      if (this.state === 'idle') this.start();
      else if (this.state === 'paused') this.resume();
      else if (this.state === 'playing') this.player.press();
    }
    onSpaceUp() { this.player.release(); }
    onEnter() { if (this.state === 'playing') CR.useStored(this); }

    // ---------- 업데이트 ----------
    update(dt) {
      if (this.state !== 'playing') return;
      const p = this.player;
      this.elapsed += dt;
      for (const k of BUFFS) this.buff[k] = Math.max(0, this.buff[k] - dt);
      this.fxRewind = Math.max(0, this.fxRewind - dt);

      const slowF = this.buff.slow > 0 ? 0.55 : 1;
      const dx = C.BASE_SPEED * this.speedMult() * slowF * dt;
      this.distance += dx;

      for (const g of this.grounds) g.x -= dx;
      for (const k of this.pickups) k.x -= dx;
      for (const o of this.obstacles) {
        o.x -= dx;
        if (o.vx && o.x < p.x + o.trigger) o.x -= o.vx * slowF * dt;
        if (o.amp) { o.phase += o.freq * slowF * dt; o.y = o.base + Math.sin(o.phase) * o.amp; }
      }
      this.groundEnd -= dx;
      this.grounds = this.grounds.filter(g => g.x + g.w > -50);
      this.obstacles = this.obstacles.filter(o => !o.dead && o.x + o.w > -50);
      this.pickups = this.pickups.filter(k => !k.taken && k.x + k.w > -50);
      this.fill();

      p.update(dt, (a, b) => this.isOver(a, b), this.stats);

      // 자석
      if (this.buff.magnet > 0) {
        const cx = p.x + p.w / 2, cy = p.y + p.h / 2, R = this.stats.magnetR;
        for (const k of this.pickups) {
          if (k.kind !== 'coin') continue;
          const ddx = cx - (k.x + 7), ddy = cy - (k.y + 7), d = Math.hypot(ddx, ddy);
          if (d < R && d > 1) { const s = Math.min(d, 520 * dt) / d; k.x += ddx * s; k.y += ddy * s; }
        }
      }

      // 아이템/코인
      const pb = { x: p.x - 2, y: p.y - 2, w: p.w + 4, h: p.h + 4 };
      for (const k of this.pickups) {
        if (k.taken || !hit(pb, k)) continue;
        k.taken = true;
        if (k.kind === 'coin') this.coins += 1;
        else CR.applyItem(this, k.key);
      }

      // 장애물
      const hb = { x: p.x + 2, y: p.y + 2, w: p.w - 4, h: p.h - 4 };
      for (const o of this.obstacles) {
        if (o.dead) continue;
        if (hit(hb, { x: o.x + 2, y: o.y + 2, w: o.w - 4, h: o.h - 4 })) this.onHit(o);
        if (this.state !== 'playing') return;
      }

      // 절벽 추락
      if (p.y > H + 4) this.onFall();
      if (this.state !== 'playing') return;

      // 효과
      for (const e of this.effects) e.t -= dt;
      this.effects = this.effects.filter(e => e.t > 0);

      // 되감기용 스냅샷 (0.1초마다, 2초 보관)
      this.snapT += dt;
      if (this.snapT >= 0.1) { this.snapT = 0; this.snapshot(); }

      if (!this.stage.endless && this.elapsed >= this.stage.duration) { this.finish(true); return; }
      this.updateHud();
    }

    breakFx(o) {
      o.dead = true;
      this.effects.push({ x: o.x, y: o.y, w: o.w, h: o.h, label: o.label, t: 0.35, max: 0.35 });
    }

    onHit(o) {
      if (this.buff.max > 0) { this.breakFx(o); this.bonus += 20; return; }
      if (this.buff.invuln > 0) return;
      if (this.buff.shield > 0) {
        this.buff.shield = 0;
        this.buff.invuln = 0.6;
        this.breakFx(o);
        this.ui.flash(`=IFERROR(${o.label}, "") → 오류 무시됨`);
        return;
      }
      this.damage(o.label, false);
    }

    onFall() {
      if (this.buff.max > 0 || this.buff.invuln > 0) { this.rescue(); return; }
      this.damage('#NULL!', true);
    }

    damage(label, fell) {
      this.lives -= 1;
      if (this.lives <= 0) {
        if (this.stored === 'CTRLZ') {
          this.stored = null;
          this.rewind();
          this.ui.flash('Ctrl+Z 자동 실행 → 실행 취소됨');
          return;
        }
        this.deathCause = label;
        this.finish(false);
        return;
      }
      this.buff.invuln = 1.5;
      if (fell) this.rescue();
      this.ui.flash(`${label} 오류 발생 → 목숨 ${this.lives}개 남음`);
    }

    // 절벽에서 떨어졌을 때: 발 밑에 임시 발판을 깔고 위에서 다시 떨어뜨림
    rescue() {
      const p = this.player;
      const x1 = p.x - 30, x2 = p.x + 230;
      this.grounds.push({ x: x1, w: x2 - x1 });
      this.grounds.sort((a, b) => a.x - b.x);
      for (const o of this.obstacles) if (o.x < x2 && o.x + o.w > x1) o.dead = true;
      p.y = 0;
      p.vy = 0;
      p.onGround = false;
      this.buff.invuln = Math.max(this.buff.invuln, 1.2);
    }

    snapshot() {
      this.snaps.push(structuredClone({
        grounds: this.grounds, obstacles: this.obstacles, pickups: this.pickups,
        groundEnd: this.groundEnd, py: this.player.y, pvy: this.player.vy,
        elapsed: this.elapsed, distance: this.distance,
      }));
      if (this.snaps.length > 20) this.snaps.shift();
    }

    rewind() {
      const i = Math.max(0, this.snaps.length - 15);
      const s = this.snaps[i];
      if (s) {
        Object.assign(this, {
          grounds: s.grounds, obstacles: s.obstacles, pickups: s.pickups,
          groundEnd: s.groundEnd, elapsed: s.elapsed, distance: s.distance,
        });
        this.player.y = s.py;
        this.player.vy = s.pvy;
        this.player.onGround = false;
        this.snaps.length = i;
      }
      this.lives = Math.max(this.lives, 1);
      this.buff.invuln = 1.5;
      this.fxRewind = 0.4;
    }

    finish(cleared) {
      const d = CR.Storage.data;
      const st = this.stage;
      const earned = Math.floor(this.coins * this.stats.coinMult);
      let bonusCoins = 0;
      if (cleared) {
        this.bonus += 500 * (this.stageIdx + 1);
        bonusCoins = 30 + 20 * this.stageIdx;
        d.unlockedStage = Math.max(d.unlockedStage, this.stageIdx + 2);
      }
      const score = this.score();
      const sec = Math.floor(this.elapsed);
      let best, newBest;
      if (st.endless) {
        newBest = sec > d.bestSurvivalSec;
        if (newBest) d.bestSurvivalSec = sec;
        best = d.bestSurvivalSec;
      } else {
        newBest = score > d.bestScores[st.id];
        if (newBest) d.bestScores[st.id] = score;
        best = d.bestScores[st.id];
      }
      d.coins += earned + bonusCoins;
      CR.Storage.save();
      this.player.release();
      this.setState(cleared ? 'clear' : 'over');
      this.onFinish({ cleared, stage: st, stageIdx: this.stageIdx, score, earned, bonusCoins, best, newBest, sec, cause: this.deathCause });
    }

    // ---------- HUD ----------
    cellAddr() {
      const p = this.player;
      const cx = p.x + p.w / 2;
      let x = 0, col = 0;
      for (; col < this.colW.length; col++) { x += this.colW[col]; if (cx < x) break; }
      const row = C.BAND_ROW + Math.min(C.BAND_ROWS - 1, Math.max(0, Math.floor((p.y + p.h / 2) / ROW)));
      return CR.colName(col) + row;
    }

    updateHud() {
      const st = this.stage;
      let formula, left;
      if (this.state === 'idle') {
        formula = `${st.line}   →  목표: ${st.endless ? '최대한 오래 버티기' : st.duration + '초 생존'}`;
        left = '준비';
      } else {
        const lives = '♥'.repeat(Math.max(0, this.lives));
        const stored = this.stored ? `  |  보관: ${CR.ITEMS[this.stored].label} (Enter)` : '';
        formula = st.endless
          ? `=야근시간(${Math.floor(this.elapsed)}초)  |  목숨 ${lives}${stored}`
          : `=퇴근까지(${Math.max(0, Math.ceil(st.duration - this.elapsed))}초)  |  목숨 ${lives}${stored}`;
        left = this.state === 'playing'
          ? (st.endless ? '계산 중...' : `계산 중(4 프로세서): ${Math.floor(this.progress() * 100)}%`)
          : '준비';
      }
      this.ui.setHud({
        name: this.cellAddr(),
        formula,
        left,
        stats: `평균: ${this.speedMult().toFixed(2)}     개수: ${this.coins}     합계: ${this.score().toLocaleString('ko-KR')}`,
      });
    }

    // ---------- 렌더링 ----------
    render() {
      const c = this.ctx, W = this.W;
      c.fillStyle = '#fff';
      c.fillRect(0, 0, W, H);
      this.drawGrid(c);
      if (this.ui.boss) return;

      const t = performance.now() / 1000;

      // 바닥 (채워진 셀은 격자선을 가림)
      for (const g of this.grounds) {
        c.fillStyle = '#ddebf7';
        c.fillRect(g.x, GY, g.w, ROW);
        c.fillStyle = '#9bc2e6';
        c.fillRect(g.x, GY, g.w, 1);
        c.fillRect(g.x, H - 1, g.w, 1);
      }

      c.textAlign = 'center';
      c.textBaseline = 'middle';

      // 코인 / 아이템
      for (const k of this.pickups) {
        if (k.taken) continue;
        if (k.kind === 'coin') {
          c.fillStyle = '#ffeb9c';
          c.fillRect(k.x, k.y, k.w, k.h);
          c.fillStyle = '#9c5700';
          c.font = 'bold 10px ' + FONT;
          c.fillText('₩', k.x + k.w / 2, k.y + k.h / 2 + 0.5);
        } else {
          const bob = Math.sin(t * 4 + k.x * 0.05) * 1.5;
          c.fillStyle = '#c6efce';
          c.fillRect(k.x, k.y + bob, k.w, k.h);
          c.strokeStyle = '#8fd19e';
          c.lineWidth = 1;
          c.strokeRect(k.x + 0.5, k.y + bob + 0.5, k.w - 1, k.h - 1);
          c.fillStyle = '#006100';
          c.font = '12px ' + FONT;
          c.fillText(k.label, k.x + k.w / 2, k.y + bob + k.h / 2 + 0.5);
        }
      }

      // 장애물
      c.font = '10.5px ' + FONT;
      for (const o of this.obstacles) this.drawErr(c, o, 1);
      for (const e of this.effects) {
        this.drawErr(c, e, e.t / e.max);
        c.globalAlpha = e.t / e.max;
        c.fillStyle = '#9c0006';
        c.fillRect(e.x + 3, e.y + e.h / 2, e.w - 6, 1);
        c.globalAlpha = 1;
      }

      this.drawPlayer(c, t);

      if (this.fxRewind > 0 && this.state === 'playing') {
        c.fillStyle = `rgba(155,194,230,${this.fxRewind})`;
        c.fillRect(0, 0, W, H);
      }

      this.drawOverlay(c);
    }

    drawGrid(c) {
      c.fillStyle = '#e0e0e0';
      for (let r = 1; r <= C.BAND_ROWS; r++) c.fillRect(0, r * ROW - 1, this.W, 1);
      let x = 0;
      for (const w of this.colW) { x += w; if (x > this.W + 1) break; c.fillRect(x - 1, 0, 1, H); }
    }

    drawErr(c, o, alpha) {
      c.globalAlpha = alpha;
      c.fillStyle = '#ffc7ce';
      c.fillRect(o.x, o.y, o.w, o.h);
      c.strokeStyle = '#f4a3ad';
      c.lineWidth = 1;
      c.strokeRect(o.x + 0.5, o.y + 0.5, o.w - 1, o.h - 1);
      c.fillStyle = '#9c0006';
      for (let yy = o.y; yy < o.y + o.h - 1; yy += ROW) {
        c.fillText(o.label, o.x + o.w / 2, yy + ROW / 2 + 0.5);
        if (yy > o.y) { c.fillStyle = '#f4a3ad'; c.fillRect(o.x, yy, o.w, 1); c.fillStyle = '#9c0006'; }
      }
      c.globalAlpha = 1;
    }

    drawPlayer(c, t) {
      const p = this.player;
      const blink = this.buff.invuln > 0 && this.buff.max <= 0 && Math.floor(t * 16) % 2 === 0;
      c.globalAlpha = blink ? 0.3 : 1;

      if (this.buff.max > 0) {
        c.fillStyle = Math.floor(t * 10) % 2 ? '#c6efce' : '#ffeb9c';
        c.fillRect(p.x, p.y, p.w, p.h);
      }
      c.strokeStyle = '#217346';
      c.lineWidth = 2;
      c.strokeRect(p.x + 1, p.y + 1, p.w - 2, p.h - 2);
      // 채우기 핸들
      c.fillStyle = '#fff';
      c.fillRect(p.x + p.w - 5, p.y + p.h - 5, 7, 7);
      c.fillStyle = '#217346';
      c.fillRect(p.x + p.w - 4, p.y + p.h - 4, 5, 5);

      // 방어막 = 복사 모드의 점선 테두리
      if (this.buff.shield > 0) {
        c.setLineDash([4, 3]);
        c.lineDashOffset = -t * 30;
        c.lineWidth = 1.5;
        c.strokeRect(p.x - 3.5, p.y - 3.5, p.w + 7, p.h + 7);
        c.setLineDash([]);
      }
      if (this.buff.magnet > 0) {
        c.strokeStyle = 'rgba(33,115,70,0.18)';
        c.lineWidth = 1;
        c.beginPath();
        c.arc(p.x + p.w / 2, p.y + p.h / 2, this.stats.magnetR, 0, Math.PI * 2);
        c.stroke();
      }
      c.globalAlpha = 1;
    }

    drawOverlay(c) {
      c.font = '11px ' + FONT;
      c.textBaseline = 'middle';
      c.fillStyle = '#8a8a8a';

      if (this.state === 'playing' || this.state === 'paused') {
        const parts = [];
        const names = { shield: 'IFERROR', magnet: 'VLOOKUP', slow: 'F9', max: 'MAX' };
        for (const k in names) if (this.buff[k] > 0) parts.push(`${names[k]} ${this.buff[k].toFixed(1)}`);
        if (this.stored) parts.push(`[Enter] ${CR.ITEMS[this.stored].label}`);
        parts.push('♥'.repeat(Math.max(0, this.lives)));
        c.textAlign = 'right';
        c.fillText(parts.join('    '), this.W - 10, ROW / 2);
      }

      c.textAlign = 'left';
      const x = (this.colW[0] || 100) + 10;
      if (this.state === 'idle') {
        c.fillStyle = '#7a7a7a';
        c.fillText('Space: 시작    |    길게 누르면 높이 점프    |    공중에서 한 번 더: 2단 점프    |    Enter: 보관 아이템 사용    |    Esc: 숨기기', x, ROW + ROW / 2);
      } else if (this.state === 'paused') {
        c.fillStyle = '#7a7a7a';
        c.fillText('일시정지됨 — Space를 누르면 계속합니다', x, ROW + ROW / 2);
      }
    }
  };
})();
