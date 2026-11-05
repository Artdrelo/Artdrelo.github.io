// ---------------------------------------------------------------------------
// SKILL BREAKER: a brick breaker. ← → move the paddle, Space launches the
// ball (it also launches by itself after 2 seconds). 3 lives.
// Scoring: bricks are worth 10-60 by row (top rows more), +5 per brick in a
// combo (bricks hit before the ball comes back to the paddle), 200 for
// clearing the wall; each new wall is faster.
// ---------------------------------------------------------------------------
window.Games = window.Games || {};
Games.breaker = function () {
  const COLS = 10, ROWS = 6, BW = 22, BH = 7, GAP = 1, BX = 5, BY = 20;
  const PW = 32, PH = 4, PADDLE_Y = 146, BALL = 3;

  let api, state = "ready", t = 0, stateT = 0, score = 0, lives = 3, level = 1;
  let px = 104, bx = 0, by = 0, vx = 0, vy = 0, stuck = true, stuckT = 0, combo = 0, speed = 105;
  let bricks = [], pops = [];
  const P = () => api.palette();
  const rowColor = r => { const p = P(); return [p.main, p.a2, p.a3, p.a4, p.tint(p.water[1], .3), p.tint(p.water[0], .45)][r]; };
  const rowPoints = r => (ROWS - r) * 10;

  function buildWall() {
    bricks = [];
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++)
      bricks.push({ x: BX + c * (BW + GAP), y: BY + r * (BH + GAP), r, alive: true });
  }
  function serve() { stuck = true; stuckT = 0; combo = 0; vx = 0; vy = 0; }
  function reset() { score = 0; lives = 3; level = 1; speed = 105; px = 104; pops = []; buildWall(); serve(); }
  function launch() {
    stuck = false;
    const a = (-60 + Math.random() * 30) * Math.PI / 180;     // up and slightly to one side
    vx = Math.sin(a) * speed * (Math.random() < .5 ? -1 : 1); vy = -Math.cos(a) * speed;
  }
  function burst(x, y, color, n = 8) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, s = 15 + Math.random() * 50;
      pops.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: .3 + Math.random() * .3, color });
    }
  }
  function addScore(n) { score += n; api.score(score); }

  return {
    init(a) { api = a; reset(); },
    start() { reset(); state = "intro"; stateT = 0; SFX.gameStart(); },

    update(dt, input) {
      t += dt; stateT += dt;
      for (let i = pops.length - 1; i >= 0; i--) {
        const q = pops[i]; q.life -= dt; q.x += q.vx * dt; q.y += q.vy * dt;
        if (q.life <= 0) pops.splice(i, 1);
      }
      if (state === "intro" && stateT > 1.2) state = "play";
      if (state === "clear" && stateT > 1.4) { level++; speed = Math.min(190, speed + 15); buildWall(); serve(); state = "play"; }

      // attract mode: the paddle follows the ball on its own
      if (state === "ready") {
        if (stuck) { stuckT += dt; if (stuckT > .5) launch(); }
        px += Math.sign(bx - PW / 2 - px) * Math.min(Math.abs(bx - PW / 2 - px), 120 * dt);
      }
      if (state === "play") {
        const move = (input.right ? 1 : 0) - (input.left ? 1 : 0);
        px += move * 150 * dt;
      }
      px = Math.max(0, Math.min(240 - PW, px));
      if (state !== "play" && state !== "ready") return;

      if (stuck) {
        bx = px + PW / 2 - 1; by = PADDLE_Y - BALL - 1;
        stuckT += dt;
        if (state === "play" && (input.actionPressed || input.action || stuckT > 2)) launch();
        return;
      }

      // move in small sub-steps so a fast ball never skips through a brick
      const steps = Math.ceil(Math.max(Math.abs(vx), Math.abs(vy)) * dt / 2);
      for (let s = 0; s < steps; s++) {
        bx += vx * dt / steps; by += vy * dt / steps;
        if (bx < 0) { bx = 0; vx = Math.abs(vx); }
        if (bx > 240 - BALL) { bx = 240 - BALL; vx = -Math.abs(vx); }
        if (by < 14) { by = 14; vy = Math.abs(vy); }

        // paddle: the bounce angle depends on where the ball lands
        if (vy > 0 && by + BALL >= PADDLE_Y && by + BALL <= PADDLE_Y + PH + 2 && bx + BALL > px && bx < px + PW) {
          const off = ((bx + BALL / 2) - (px + PW / 2)) / (PW / 2);           // -1 .. 1
          const ang = off * 60 * Math.PI / 180;
          const sp = Math.min(220, Math.hypot(vx, vy) * 1.02);
          vx = Math.sin(ang) * sp; vy = -Math.cos(ang) * sp;
          by = PADDLE_Y - BALL; combo = 0;
          if (state === "play") SFX.blip(0);
        }

        // bricks
        for (const b of bricks) {
          if (!b.alive || bx + BALL <= b.x || bx >= b.x + BW || by + BALL <= b.y || by >= b.y + BH) continue;
          b.alive = false;
          // bounce off the side we came from
          const fromSide = (bx + BALL - vx * dt / steps <= b.x) || (bx - vx * dt / steps >= b.x + BW);
          if (fromSide) vx = -vx; else vy = -vy;
          if (state === "play") {
            addScore(rowPoints(b.r) + combo * 5);
            combo++;
            SFX.blip(Math.min(combo, 8));
          }
          burst(b.x + BW / 2, b.y + BH / 2, rowColor(b.r));
          break;
        }
      }

      if (by > 162) {
        if (state === "ready") { serve(); return; }
        lives--; SFX.hurt();
        if (lives <= 0) { state = "over"; stateT = 0; api.end({ score }); return; }
        serve();
      }
      if (state === "play" && !bricks.some(b => b.alive)) { addScore(200); state = "clear"; stateT = 0; SFX.unlock(); }
      if (state === "ready" && !bricks.some(b => b.alive)) buildWall();
    },

    render(ctx) {
      const p = P();
      ctx.fillStyle = p.shade(.06, 0); ctx.fillRect(0, 0, 240, 160);
      // faint pixel grid in the background
      ctx.fillStyle = p.shade(.12, 0);
      for (let y = 16; y < 160; y += 8) for (let x = (y / 8) % 2 ? 0 : 4; x < 240; x += 8) ctx.fillRect(x, y, 1, 1);
      // walls
      ctx.fillStyle = p.shade(.3, 1); ctx.fillRect(0, 13, 240, 1);

      for (const b of bricks) if (b.alive) {
        const c = rowColor(b.r);
        ctx.fillStyle = c; ctx.fillRect(b.x, b.y, BW, BH);
        ctx.fillStyle = "rgba(255,255,255,.35)"; ctx.fillRect(b.x, b.y, BW, 1);     // bevel highlight
        ctx.fillStyle = "rgba(0,0,0,.35)"; ctx.fillRect(b.x, b.y + BH - 1, BW, 1);   // bevel shadow
      }
      // paddle
      ctx.fillStyle = p.main; ctx.fillRect(Math.round(px), PADDLE_Y, PW, PH);
      ctx.fillStyle = "#ffffff"; ctx.fillRect(Math.round(px) + 2, PADDLE_Y, PW - 4, 1);
      ctx.fillStyle = p.a2; ctx.fillRect(Math.round(px), PADDLE_Y + PH - 1, 3, 1); ctx.fillRect(Math.round(px) + PW - 3, PADDLE_Y + PH - 1, 3, 1);
      // ball
      if (state !== "over") { ctx.fillStyle = "#ffffff"; ctx.fillRect(Math.round(bx), Math.round(by), BALL, BALL); }
      for (const q of pops) { ctx.fillStyle = q.color; ctx.fillRect(Math.round(q.x), Math.round(q.y), 2, 2); }

      if (state !== "ready") {
        api.text(ctx, `SCORE ${score}`, 4, 3, { color: p.main });
        api.text(ctx, combo > 1 ? `COMBO x${combo}` : `WALL ${level}`, 120, 3, { color: p.a3, align: "center" });
        for (let i = 0; i < lives; i++) { ctx.fillStyle = p.a2; ctx.fillRect(228 - i * 12, 5, 9, 3); }
        if (stuck && state === "play" && Math.floor(t * 3) % 2) api.text(ctx, "PRESS SPACE / A", 120, 110, { color: "#ffffff", align: "center" });
      }
      const banner = (a, b) => {
        ctx.fillStyle = p.shade(.12, 0); ctx.fillRect(30, 70, 180, 40);
        ctx.fillStyle = p.main; ctx.fillRect(30, 70, 180, 2); ctx.fillRect(30, 108, 180, 2);
        api.text(ctx, a, 120, 78, { color: p.main, align: "center", size: 10 });
        if (b) api.text(ctx, b, 120, 94, { color: "#ffffff", align: "center" });
      };
      if (state === "intro") banner(`WALL ${level}`, "GET READY!");
      if (state === "clear") banner("WALL CLEAR!", "BONUS 200");
      if (state === "over") banner("GAME OVER", `SCORE ${score}`);
    }
  };
};
