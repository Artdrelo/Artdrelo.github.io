// ---------------------------------------------------------------------------
// LANE RACER: a top-down traffic dodger (a nod to the Vial Security driving
// simulator). ← → switch lanes. Dodge the traffic, grab coins, and the road
// keeps getting faster. 3 lives.
// Scoring: distance (faster = more points) + 25 per coin.
// ---------------------------------------------------------------------------
window.Games = window.Games || {};
Games.racer = function () {
  const ROAD_X = 48, LANE_W = 36, LANES = 4, PY = 126;
  const laneX = i => ROAD_X + LANE_W * i + LANE_W / 2 - 5;     // car left edge in lane i
  // cars point up; m = body, w = windows, k = dark details, l = lights
  const CAR = [
    "..kmmmmk..", ".kmmllmmk.", ".kmmmmmmk.", ".kmwwwwmk.", "kkmwwwwmkk", "k.mmmmmm.k",
    "..mmmmmm..", "..mmmmmm..", "..mmmmmm..", "..mmmmmm..", "k.mwwwwm.k", "kkmmmmmmkk",
    ".kmmmmmmk.", ".kmmmmmmk.", ".krmmmmrk.", "..kkkkkk.."
  ];
  const TRUCK = [
    ".kkmmmmkk.", ".kmmllmmk.", ".kmwwwwmk.", "kkmwwwwmkk", "k.mmmmmm.k", "..kkkkkk..",
    ".kwwwwwwk.", ".kwwwwwwk.", ".kwwwwwwk.", ".kwwwwwwk.", ".kwwwwwwk.", ".kwwwwwwk.",
    ".kwwwwwwk.", ".kwwwwwwk.", ".kwwwwwwk.", ".kwwwwwwk.", ".kwwwwwwk.", ".kwwwwwwk.",
    "kkkkkkkkkk", "k.krkkrk.k", "..kkkkkk.."
  ];
  const COIN = ["..kkkk..", ".kyyyyk.", "kyhyyyyk", "kyhyyydk", "kyyyyydk", "kyyyyydk", ".kyddyk.", "..kkkk.."];
  const TREE = ["...tt...", "..tttt..", ".tttttt.", "tttttttt", ".tttttt.", "..tttt..", "...bb...", "...bb..."];
  const LAMP = ["lll.", ".k..", ".k..", ".k..", ".k..", ".k..", ".k..", "kkk."];

  let api, state = "ready", t = 0, stateT = 0, score = 0, dist = 0, lives = 3, collected = 0;
  let lane = 1, carX = laneX(1), speed = 70, inv = 0, spawnT = 0, coinT = 2, scroll = 0;
  let traffic = [], coins = [], pops = [], deco = [];
  let lastLeft = false, lastRight = false, demoT = 0;
  const P = () => api.palette();

  function reset() {
    score = 0; dist = 0; collected = 0; lives = 3; lane = 1; carX = laneX(1); speed = 70; inv = 0;
    lastLeft = lastRight = false;
    spawnT = .8; coinT = 2; traffic = []; coins = []; pops = [];
  }
  function burst(x, y, color, n = 12) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, s = 15 + Math.random() * 55;
      pops.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: .35 + Math.random() * .35, color });
    }
  }
  const hit = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

  function spawnTraffic() {
    // never block every lane: pick a free lane near the top
    const busy = new Set(traffic.filter(c => c.y < 30).map(c => c.lane));
    const free = [...Array(LANES).keys()].filter(i => !busy.has(i));
    if (free.length <= 1) return;
    const l = free[(Math.random() * free.length) | 0];
    const truck = Math.random() < .2;
    const colors = [P().a2, P().a3, P().a4, P().tint(P().water[0], .25)];
    traffic.push({ lane: l, x: laneX(l), y: truck ? -22 : -17, h: truck ? 21 : 16, truck, own: 5 + Math.random() * 20, color: colors[(Math.random() * colors.length) | 0] });
  }

  return {
    init(a) {
      api = a;
      for (let i = 0; i < 8; i++) deco.push({ y: i * 22, side: i % 2, kind: Math.random() < .6 ? "tree" : "lamp" });
      reset();
    },
    start() { reset(); state = "intro"; stateT = 0; SFX.gameStart(); },

    update(dt, input) {
      t += dt; stateT += dt;
      for (let i = pops.length - 1; i >= 0; i--) {
        const p = pops[i]; p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt;
        if (p.life <= 0) pops.splice(i, 1);
      }
      if (state === "intro" && stateT > 1.2) state = "play";
      const moving = state === "play" || state === "ready" || state === "intro";
      if (!moving) return;

      // the world scrolls by the current speed
      const v = state === "play" ? speed : 60;
      scroll = (scroll + v * dt) % 16;
      for (const d of deco) { d.y += v * dt; if (d.y > 168) { d.y -= 176; d.kind = Math.random() < .6 ? "tree" : "lamp"; } }

      if (state === "ready") {                                    // attract mode: the car weaves on its own
        demoT -= dt;
        if (demoT <= 0) { lane = Math.max(0, Math.min(3, lane + (Math.random() < .5 ? -1 : 1))); demoT = .8 + Math.random(); }
      }
      if (state === "play") {
        // one lane per key press (holding doesn't zip across the road)
        if (input.left && !lastLeft) lane = Math.max(0, lane - 1);
        if (input.right && !lastRight) lane = Math.min(LANES - 1, lane + 1);
        lastLeft = input.left; lastRight = input.right;
        speed = Math.min(210, speed + 2.2 * dt);
        dist += v * dt;
        const newScore = Math.floor(dist / 8) + collected * 25;
        if (newScore !== score) { score = newScore; api.score(score); }
        inv -= dt;
      }
      const target = laneX(lane);
      carX += Math.sign(target - carX) * Math.min(Math.abs(target - carX), 200 * dt);

      // traffic and coins
      spawnT -= dt;
      if (spawnT <= 0) { spawnTraffic(); spawnT = Math.max(.4, 1.4 - speed / 220) * (.8 + Math.random() * .5); }
      coinT -= dt;
      if (coinT <= 0) {
        const l = (Math.random() * LANES) | 0;
        if (!traffic.some(c => c.lane === l && c.y < 20)) coins.push({ x: laneX(l) + 1, y: -10, f: 0 });
        coinT = 1.4 + Math.random() * 1.6;
      }
      const me = { x: carX + 2, y: PY + 2, w: 6, h: 12 };
      for (let i = traffic.length - 1; i >= 0; i--) {
        const c = traffic[i];
        c.y += Math.max(30, v - c.own) * dt;
        if (c.y > 170) { traffic.splice(i, 1); continue; }
        if (state === "play" && inv <= 0 && hit(me, { x: c.x + 1, y: c.y + 1, w: 8, h: c.h - 2 })) {
          traffic.splice(i, 1);
          lives--; inv = 1.5; speed = Math.max(70, speed * .8);
          burst(carX + 5, PY + 8, P().main, 18); SFX.hurt();
          if (lives <= 0) { state = "over"; stateT = 0; api.end({ score }); return; }
        }
      }
      for (let i = coins.length - 1; i >= 0; i--) {
        const c = coins[i];
        c.y += v * dt; c.f += dt * 10;
        if (c.y > 170) { coins.splice(i, 1); continue; }
        if (state === "play" && hit(me, { x: c.x, y: c.y, w: 8, h: 8 })) {
          coins.splice(i, 1); collected++;
          score = Math.floor(dist / 8) + collected * 25; api.score(score);
          burst(c.x + 4, c.y + 4, "#ffcc33", 8); SFX.coin();
        }
      }
    },

    render(ctx) {
      const p = P();
      // roadside
      ctx.fillStyle = p.shade(.16, 1); ctx.fillRect(0, 0, 240, 160);
      ctx.fillStyle = p.shade(.22, 1);
      for (let y = -16 + scroll; y < 160; y += 16) { ctx.fillRect(0, Math.round(y), 40, 8); ctx.fillRect(200, Math.round(y) + 8, 40, 8); }
      for (const d of deco) {
        const x = d.side ? 214 : 16, y = Math.round(d.y) - 8;
        if (d.kind === "tree") ctx.drawImage(api.sprite(TREE, { t: p.shade(.55, 1), b: p.shade(.3, 0) }), x, y);
        else ctx.drawImage(api.sprite(LAMP, { l: p.a3, k: p.shade(.4, 0) }), x + 2, y);
      }
      // road
      ctx.fillStyle = p.shade(.07, 0); ctx.fillRect(ROAD_X, 0, LANE_W * LANES, 160);
      // curbs: alternating blocks scrolling with the road
      for (let y = -16 + scroll * 2 % 16; y < 160; y += 16) {
        ctx.fillStyle = p.main; ctx.fillRect(ROAD_X - 4, Math.round(y), 4, 8); ctx.fillRect(ROAD_X + LANE_W * LANES, Math.round(y), 4, 8);
        ctx.fillStyle = "#ffffff"; ctx.fillRect(ROAD_X - 4, Math.round(y) + 8, 4, 8); ctx.fillRect(ROAD_X + LANE_W * LANES, Math.round(y) + 8, 4, 8);
      }
      // lane dashes
      ctx.fillStyle = p.shade(.45, 3);
      for (let l = 1; l < LANES; l++) for (let y = -16 + scroll; y < 160; y += 16) ctx.fillRect(ROAD_X + LANE_W * l - 1, Math.round(y), 2, 8);

      for (const c of coins) {
        const frame = [0, 1, 0][Math.floor(c.f) % 3];
        ctx.drawImage(api.sprite(frame ? COIN.map(r => r.replace(/h/g, "y")) : COIN, { k: "#2a1a05", y: "#ffcc33", h: "#fff2a8", d: "#c98a1a" }), Math.round(c.x), Math.round(c.y));
      }
      for (const c of traffic)
        ctx.drawImage(api.sprite(c.truck ? TRUCK : CAR, { m: c.color, w: p.shade(.3, 0), k: "#07080c", l: "#ffffff", r: "#ff3355" }), Math.round(c.x), Math.round(c.y));
      if (state !== "over" && !(inv > 0 && Math.floor(t * 16) % 2))
        ctx.drawImage(api.sprite(CAR, { m: p.main, w: p.shade(.25, 1), k: "#07080c", l: "#ffffff", r: "#ff3355" }), Math.round(carX), PY);
      for (const q of pops) { ctx.fillStyle = q.color; ctx.fillRect(Math.round(q.x), Math.round(q.y), 2, 2); }

      // HUD
      if (state !== "ready") {
        ctx.fillStyle = "rgba(7,8,12,.6)"; ctx.fillRect(0, 0, 240, 13);
        api.text(ctx, `SCORE ${score}`, 4, 3, { color: p.main });
        api.text(ctx, `${Math.round(speed)} KM/H`, 120, 3, { color: p.a3, align: "center" });
        for (let i = 0; i < lives; i++) ctx.drawImage(api.sprite(CAR, { m: p.a2, w: p.a2, k: "#07080c", l: "#fff", r: "#ff3355" }), 228 - 12 * i, -1, 6, 10);
      }
      const banner = (a, b) => {
        ctx.fillStyle = p.shade(.12, 0); ctx.fillRect(30, 58, 180, 40);
        ctx.fillStyle = p.main; ctx.fillRect(30, 58, 180, 2); ctx.fillRect(30, 96, 180, 2);
        api.text(ctx, a, 120, 66, { color: p.main, align: "center", size: 10 });
        if (b) api.text(ctx, b, 120, 82, { color: "#ffffff", align: "center" });
      };
      if (state === "intro") banner("READY...", "DODGE THE TRAFFIC!");
      if (state === "over") banner("GAME OVER", `SCORE ${score}`);
    }
  };
};
