// 플레이어: 엑셀 선택 셀 커서
(() => {
  const C = CR.C;
  const GY = C.GROUND_Y;

  CR.Player = class {
    constructor() {
      this.x = 90;
      this.w = 18;
      this.h = 18;
      this.reset();
    }

    reset() {
      this.y = GY - this.h;
      this.vy = 0;
      this.onGround = true;
      this.keyDown = false;   // Space가 눌려 있는지
      this.holding = false;   // 길게 눌러 상승 유지 중인지
      this.holdT = 0;
      this.airUsed = 0;
      this.coyote = 0;        // 발판에서 떨어진 직후 점프 허용 시간
      this.buffer = 0;        // 착지 직전 입력 기억 시간
    }

    press() { this.keyDown = true; this.buffer = 0.12; }
    release() { this.keyDown = false; this.holding = false; }

    tryJump(stats) {
      if (this.buffer <= 0) return;
      if (this.onGround || this.coyote > 0) {
        this.vy = -C.JUMP_V * stats.jumpMult;
        this.onGround = false;
        this.coyote = 0;
      } else if (this.airUsed < stats.airJumps) {
        this.vy = -C.DJUMP_V * stats.jumpMult;
        this.airUsed += 1;
      } else {
        return;
      }
      this.holding = this.keyDown;
      this.holdT = 0;
      this.buffer = 0;
    }

    // isOver(x1, x2): 해당 구간 아래에 바닥이 있는지
    update(dt, isOver, stats) {
      this.buffer = Math.max(0, this.buffer - dt);
      this.coyote = Math.max(0, this.coyote - dt);
      this.tryJump(stats);

      let g = C.GRAVITY;
      if (this.holding && this.keyDown && this.vy < 0 && this.holdT < C.HOLD_MAX) {
        g *= C.HOLD_GRAV;
        this.holdT += dt;
      } else {
        this.holding = false;
      }

      const prevBottom = this.y + this.h;
      this.vy += g * dt;
      this.y += this.vy * dt;
      if (this.y < 0) { this.y = 0; if (this.vy < 0) this.vy = 0; }

      const bottom = this.y + this.h;
      const over = isOver(this.x + 3, this.x + this.w - 3);
      if (over && this.vy >= 0 && prevBottom <= GY + 2 && bottom >= GY) {
        this.y = GY - this.h;
        this.vy = 0;
        if (!this.onGround) this.airUsed = 0;
        this.onGround = true;
      } else {
        if (this.onGround) this.coyote = 0.08;
        this.onGround = false;
      }
    }
  };
})();
