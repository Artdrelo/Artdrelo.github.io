// ---------------------------------------------------------------------------
// SPACE DEFENDER: a fixed shooter (a nod to the Space Ascent project).
// Waves of pixel aliens march side to side and step down; shoot them before
// they land. â† â†’ move, Space fires (hold to auto-fire). 3 lives.
// Scoring: back rows 10, middle 20, front row 30, satellite 100,
// wave clear bonus 50 x wave.
// ---------------------------------------------------------------------------
window.Games = window.Games || {};
Games.defender = function () {
  const COLS = 8, ROWS = 4;
  // sprites: x = body, w = eyes/highlight, a = accent
  const SHIP = [
    "......w......",
    ".....waw.....",
    ".....mmm.....",
    "..m..mmm..m..",
    ".mmm.mmm.mmm.",
    "mmmmmmmmmmmmm",
    "mmammmmmmmamm",
    "mm.mm...mm.mm"
  ];
  const ALIENS = [
    // orb drone (front rows)
    [["..xxxx..", ".xxxxxx.", "xxwxxwxx", "xxxxxxxx", ".x.xx.x.", "x......x"],
     ["..xxxx..", ".xxxxxx.", "xxwxxwxx", "xxxxxxxx", ".x.xx.x.", ".x....x."]],
    // bat-wing (middle)
    [["x......x", "xx.xx.xx", "xxxxxxxx", "x.xwwx.x", "..xxxx..", ".x....x."],
     ["........", "x..xx..x", "xxxxxxxx", "xxxwwxxx", ".xxxxxx.", "x......x"]],
    // crystal (back row)
    [["...xx...", "..xxxx..", ".xwxxwx.", "xxxxxxxx", "..x..x..", ".x.xx.x."],
     ["...xx...", "..xxxx..", ".xwxxwx.", "xxxxxxxx", ".x.xx.x.", "x......x"]]
  ];
  const SAT = ["....xxxx....", "..xxwwwwxx..", "xxxxxxxxxxxx", ".a..a..a..a."];
  const ROW_TYPE = [2, 1, 0, 0], ROW_POINTS = [30, 20, 10, 10];

  let api, state = "ready", t = 0, score = 0, lives = 3, wave = 1, stateT = 0;
  let px = 113, inv = 0, cool = 0, frame = 0;
  let aliens = [], dir = 1, stepT = 0, fireT = 1, bullets = [], bombs = [], pops = [], stars = [];
  let sat = null, satT = 12;

  const P = () => api.palette();

  function makeWave() {
    aliens = [];
    const top = 22 + Math.min((wave - 1) * 4, 20);
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++)
      aliens.push({ x: 34 + c * 20, y: top + r * 14, r, alive: true });
    dir = 1; stepT = 0; fireT = 1.2; bombs = []; bullets = [];
  }

  function reset() {
    score = 0; lives = 3; wave = 1; px = 113; inv = 0; cool = 0; pops = []; sat = null; satT = 10 + Math.random() * 6;
    makeWave();
  }

  function burst(x, y, color, n = 10) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, s = 15 + Math.random() * 55;
      pops.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: .35 + Math.random() * .35, color });
    }
  }

  function addScore(n) { score += n; api.score(score); }

  const hit = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  const rowColor = r => [P().a3, P().a2, P().a4, P().a4][r];

  return {
    init(a) {
      api = a;
      for (let i = 0; i < 60; i++) stars.push({ x: Math.random() * 240, y: Math.random() * 160, s: Math.random() < .3 ? 2 : 1 });
      reset();
    },
    start() { reset(); state = "intro"; stateT = 0; SFX.gameStart(); },

    update(dt, input) {
      t += dt; stateT += dt;
      for (const s of stars) { s.y += (s.s === 2 ? 22 : 9) * dt; if (s.y > 160) { s.y = 0; s.x = Math.random() * 240; } }
      for (let i = pops.length - 1; i >= 0; i--) {
        const p = pops[i]; p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt;
        if (p.life <= 0) pops.splice(i, 1);
      }
      if (state === "intro" && stateT > 1.4) state = "play";
      if (state === "wave" && stateT > 1.2) { makeWave(); state = "play"; }

      // aliens march in steps (also in the attract/ready screen, so the thumbnail looks alive)
      const alive = aliens.filter(a => a.alive);
      if (state === "play" || state === "ready" || state === "intro") {
        stepT -= dt;
        if (stepT <= 0) {
          stepT = Math.max(.05, .55 * (alive.length / (ROWS * COLS))) / (1 + (wave - 1) * .15);
          frame ^= 1;
          const minX = Math.min(...alive.map(a => a.x)), maxX = Math.max(...alive.map(a => a.x));
          if ((dir > 0 && maxX + 8 + 4 > 236) || (dir < 0 && minX - 4 < 4)) {
            dir = -dir;
            if (state === "play") for (const a of alive) a.y += 6;
          } else for (const a of alive) a.x += 4 * dir;
        }
      }
      if (state !== "play") return;

      // player
      const move = (input.right ? 1 : 0) - (input.left ? 1 : 0);
      px = Math.max(2, Math.min(240 - 15, px + move * 105 * dt));
      cool -= dt; inv -= dt;
      if ((input.action || input.actionPressed) && cool <= 0 && bullets.length < 2) {
        bullets.push({ x: px + 6, y: 136, w: 1, h: 4 });
        cool = .24; SFX.shoot();
      }
      for (let i = bullets.length - 1; i >= 0; i--) {
        const b = bullets[i]; b.y -= 190 * dt;
        if (b.y < -4) { bullets.splice(i, 1); continue; }
        let used = false;
        for (const a of alive) {
          if (a.alive && hit(b, { x: a.x, y: a.y, w: 8, h: 6 })) {
            a.alive = false; used = true; addScore(ROW_POINTS[a.r]);
            burst(a.x + 4, a.y + 3, rowColor(a.r)); SFX.boom();
            break;
          }
        }
        if (!used && sat && hit(b, { x: sat.x, y: sat.y, w: 12, h: 4 })) {
          used = true; addScore(100); burst(sat.x + 6, sat.y + 2, P().main, 18); SFX.coin(); sat = null;
        }
        if (used) bullets.splice(i, 1);
      }

      // alien fire: the lowest alien in a random column drops a bomb
      fireT -= dt;
      if (fireT <= 0 && alive.length) {
        const cols = [...new Set(alive.map(a => Math.round(a.x)))];
        const cx = cols[(Math.random() * cols.length) | 0];
        const shooter = alive.filter(a => Math.round(a.x) === cx).sort((p, q) => q.y - p.y)[0];
        bombs.push({ x: shooter.x + 3, y: shooter.y + 6, w: 2, h: 4 });
        fireT = (.9 + Math.random() * .6) / (1 + (wave - 1) * .2);
      }
      const ship = { x: px + 1, y: 138, w: 11, h: 7 };
      for (let i = bombs.length - 1; i >= 0; i--) {
        const b = bombs[i]; b.y += 70 * dt;
        if (b.y > 160) { bombs.splice(i, 1); continue; }
        if (inv <= 0 && hit(b, ship)) {
          bombs.splice(i, 1);
          lives--; inv = 1.4; burst(px + 6, 140, P().main, 16); SFX.hurt();
          if (lives <= 0) { state = "over"; stateT = 0; api.end({ score }); return; }
        }
      }

      // satellite bonus
      satT -= dt;
      if (!sat && satT <= 0) { sat = { x: -12, y: 12, v: 40 }; satT = 12 + Math.random() * 8; }
      if (sat) { sat.x += sat.v * dt; if (sat.x > 244) sat = null; }

      // aliens landing ends the run; clearing them starts the next wave
      if (alive.some(a => a.alive && a.y + 6 >= 134)) { lives = 0; state = "over"; stateT = 0; SFX.hurt(); api.end({ score }); return; }
      if (!aliens.some(a => a.alive)) { addScore(50 * wave); wave++; state = "wave"; stateT = 0; SFX.unlock(); }
    },

    render(ctx) {
      const p = P();
      // background: palette-tinted space with stepped bands and stars
      ctx.fillStyle = p.shade(.05, 0); ctx.fillRect(0, 0, 240, 160);
      ctx.fillStyle = p.shade(.1, 0); ctx.fillRect(0, 100, 240, 60);
      ctx.fillStyle = p.shade(.16, 1); ctx.fillRect(0, 140, 240, 20);
      for (const s of stars) { ctx.fillStyle = s.s === 2 ? p.a3 : p.shade(.6, 3); ctx.fillRect(Math.round(s.x), Math.round(s.y), 1, s.s); }
      // ground line
      ctx.fillStyle = p.main; ctx.fillRect(0, 148, 240, 1);

      // aliens
      for (const a of aliens) if (a.alive) {
        const img = api.sprite(ALIENS[ROW_TYPE[a.r]][frame], { x: rowColor(a.r), w: "#ffffff" });
        ctx.drawImage(img, Math.round(a.x), Math.round(a.y));
      }
      if (sat) ctx.drawImage(api.sprite(SAT, { x: p.a2, w: "#ffffff", a: p.main }), Math.round(sat.x), Math.round(sat.y));

      // ship (blinks while invulnerable)
      if (state !== "over" && !(inv > 0 && Math.floor(t * 16) % 2))
        ctx.drawImage(api.sprite(SHIP, { m: p.main, w: "#ffffff", a: p.a2 }), Math.round(px), 138);

      ctx.fillStyle = "#ffffff";
      for (const b of bullets) ctx.fillRect(Math.round(b.x), Math.round(b.y), 1, 4);
      ctx.fillStyle = p.a2;
      for (const b of bombs) ctx.fillRect(Math.round(b.x), Math.round(b.y), 2, 4);
      for (const q of pops) { ctx.fillStyle = q.color; ctx.fillRect(Math.round(q.x), Math.round(q.y), 2, 2); }

      // HUD
      if (state !== "ready") {
        api.text(ctx, `SCORE ${score}`, 4, 3, { color: p.main });
        api.text(ctx, `WAVE ${wave}`, 120, 3, { color: p.a3, align: "center" });
        for (let i = 0; i < lives; i++) ctx.drawImage(api.sprite(SHIP, { m: p.a2, w: "#ffffff", a: p.a2 }), 236 - 14 * (i + 1), 3);
      }
      const banner = (a, b) => {
        ctx.fillStyle = p.shade(.12, 0); ctx.fillRect(30, 58, 180, 40);
        ctx.fillStyle = p.main; ctx.fillRect(30, 58, 180, 2); ctx.fillRect(30, 96, 180, 2);
        api.text(ctx, a, 120, 66, { color: p.main, align: "center", size: 10 });
        if (b) api.text(ctx, b, 120, 82, { color: "#ffffff", align: "center" });
      };
      if (state === "intro") banner(`WAVE ${wave}`, "GET READY!");
      if (state === "wave") banner("WAVE CLEAR!", `BONUS ${50 * (wave - 1)}`);
      if (state === "over") banner("GAME OVER", `SCORE ${score}`);
    }
  };
};
