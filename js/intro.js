// ---------------------------------------------------------------------------
// INTRO GATE: "Coin Catcher", a quick game shown on a visitor's first visit
// (right after the loading screen). Catch GOAL coins to unlock the portfolio,
// or skip it. Can't really be lost: bombs just stun you and cost a coin.
// Best (fastest) time is saved as the high score. Replay it from the footer.
// ---------------------------------------------------------------------------
window.IntroGate = (() => {
  const GOAL = 10;                 // coins needed to unlock
  const DONE_KEY = "intro-done";   // remembered once the gate is completed or skipped

  // --- sprites (one character = one pixel) ------------------------------------
  const ROBOT_TOP = [
    ".kkkkkkkkkkkkkk.",
    ".kaaaaaaaaaaaak.",
    "..kkkkkkkkkkkk..",
    "...k........k...",
    "...k.kkkkkk.k...",
    "...k.kbbbbk.k...",
    "...k.kwbbwk.k...",
    "...kkkbbbbkkk...",
    ".....kkkkkk.....",
    "....kggggggk....",
    "....kgaggagk....",
    "....kggggggk....",
    "....kkkkkkkk...."
  ];
  const LEGS = [
    [".....k....k.....", "....kk....kk....", "................"],
    ["......k..k......", ".....kk..kk.....", "................"]
  ];
  const COIN = [
    ["..kkkk..", ".kyyyyk.", "kyhyyyyk", "kyhyyydk", "kyyyyydk", "kyyyyydk", ".kyddyk.", "..kkkk.."],
    ["...kk...", "..kyyk..", ".khyydk.", ".khyydk.", ".kyyydk.", ".kyyydk.", "..kddk..", "...kk..."],
    ["...kk...", "...kyk..", "...kyk..", "...kyk..", "...kyk..", "...kyk..", "...kyk..", "...kk..."]
  ];
  const BOMB = [".....s..", "....k...", "..kkkk..", ".kxxxxk.", "kxwxxxxk", "kxxxxxxk", ".kxxxxk.", "..kkkk.."];
  const COIN_COLORS = { k: "#2a1a05", y: "#ffcc33", h: "#fff2a8", d: "#c98a1a" };

  // --- the game ---------------------------------------------------------------
  function createGame() {
    let api, state = "ready", t = 0, runTime = 0, caught = 0, spawnIn = 0;
    let px = 112, stun = 0, shake = 0, winT = 0, walk = 0, newBest = false;
    const PY = 124;                                  // player top (tray height)
    let items = [], pops = [], stars = [];

    // colours come from the site's current palette (see Arcade.palette)
    let pal = null;
    const colors = () => {
      const p = api.palette();
      if (!pal || pal.p !== p) pal = {
        p, a: p.main, b: p.a2,
        robot: { k: "#0b0c10", a: p.main, b: p.a2, w: "#ffffff", g: p.tint(p.water[1], .35) }
      };
      return pal;
    };

    function reset() {
      t = runTime = 0; caught = 0; spawnIn = .4; px = 112; stun = 0; shake = 0; winT = 0;
      items = []; pops = [];
    }

    function spawn() {
      const bomb = caught >= 3 && Math.random() < .2;
      items.push({ x: 8 + Math.random() * (api.W - 24), y: -10, bomb, vy: 42 + caught * 4 + Math.random() * 10, f: Math.random() * 4 });
      spawnIn = .55 + Math.random() * .35;
    }

    let bg = null, bgPal = null;
    function drawBackground(c) {
      const { W, H } = api, cv = document.createElement("canvas");
      cv.width = W; cv.height = H;
      const g = cv.getContext("2d"), p = c.p;
      // sky: stepped bands of the palette's water colours (no smooth gradients, 16-bit style)
      const bands = [p.shade(.06, 0), p.shade(.12, 0), p.shade(.2, 0), p.shade(.28, 1), p.shade(.38, 1)];
      bands.forEach((col, i) => { g.fillStyle = col; g.fillRect(0, i * 26, W, i === bands.length - 1 ? H : 26); });
      // dim stars
      g.fillStyle = p.shade(.55, 3);
      for (const s of stars) g.fillRect(Math.round(s.x), Math.round(s.y), 1, 1);
      // far skyline (lighter) and near skyline, windows lit in the accent colours
      const lights = [p.a2, p.a3, p.a4];
      for (let layer = 0; layer < 2; layer++) {
        const base = layer ? p.shade(.1, 0) : p.shade(.22, 1);
        for (let x = layer ? 0 : -6, i = layer * 7; x < W; i++) {
          const w = 12 + ((i * 37) % 18), h = (layer ? 18 : 34) + ((i * 53) % 30);
          g.fillStyle = base; g.fillRect(x, H - 16 - h, w, h);
          if (layer) {
            g.fillStyle = lights[i % 3]; g.globalAlpha = .75;
            for (let wy = H - 16 - h + 4; wy < H - 20; wy += 6) for (let wx = x + 3; wx < x + w - 3; wx += 5) if (((wx + wy + i) % 3) === 0) g.fillRect(wx, wy, 2, 2);
            g.globalAlpha = 1;
          }
          x += w + (layer ? 2 : 6);
        }
      }
      // ground tiles
      g.fillStyle = p.shade(.18, 0); g.fillRect(0, H - 16, W, 16);
      g.fillStyle = c.a; g.fillRect(0, H - 16, W, 2);
      g.fillStyle = p.shade(.4, 1);
      for (let x = 0; x < W; x += 8) g.fillRect(x + ((Math.floor(x / 8) % 2) * 4), H - 10, 4, 2);
      return cv;
    }

    function burst(x, y, color, n = 8) {
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2, s = 20 + Math.random() * 50;
        pops.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 20, life: .5 + Math.random() * .3, color });
      }
    }

    return {
      init(a) {
        api = a; reset();
        for (let i = 0; i < 40; i++) stars.push({ x: Math.random() * api.W, y: Math.random() * 100, p: Math.random() * 6 });
      },
      start() { reset(); newBest = false; state = "play"; SFX.gameStart(); },
      get state() { return state; },
      get caught() { return caught; },
      get time() { return runTime; },

      update(dt, input) {
        t += dt;
        for (const s of stars) s.p += dt;
        // coins keep falling in the attract screen too, so it looks alive
        if (state === "ready" || state === "play") {
          spawnIn -= dt;
          if (spawnIn <= 0) spawn();
        }
        if (state === "play") {
          runTime += dt;
          if (stun > 0) stun -= dt;
          else {
            const dir = (input.right ? 1 : 0) - (input.left ? 1 : 0);
            px = Math.max(0, Math.min(api.W - 16, px + dir * 120 * dt));
            if (dir) walk += dt;
          }
        } else if (state === "ready") {
          px = 112 + Math.sin(t * 1.2) * 60;           // demo: the robot wanders
          walk += dt;
        }

        for (let i = items.length - 1; i >= 0; i--) {
          const it = items[i];
          it.y += it.vy * dt; it.f += dt * 10;
          // caught in the tray?
          if (state === "play" && it.y + 8 >= PY && it.y + 8 <= PY + 6 && it.x + 6 > px && it.x + 2 < px + 16) {
            items.splice(i, 1);
            if (it.bomb) {
              stun = .6; shake = .3; caught = Math.max(0, caught - 1);
              burst(it.x + 4, it.y + 4, "#ff7700", 12); SFX.hurt();
            } else {
              caught++; burst(it.x + 4, it.y + 4, "#ffcc33", 5); burst(it.x + 4, it.y + 4, colors().a, 4); SFX.coin();
              if (caught >= GOAL) {
                state = "won"; winT = 0;
                newBest = Arcade.submit("intro", Math.round(runTime * 10) / 10, true);
                SFX.win();
                items = [];
                api.end({ won: true, score: runTime });
              }
            }
            continue;
          }
          if (it.y > api.H - 16) { items.splice(i, 1); if (state === "play") burst(it.x + 4, api.H - 16, it.bomb ? "#ff7700" : "#c98a1a", 3); }
        }
        for (let i = pops.length - 1; i >= 0; i--) {
          const p = pops[i];
          p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 120 * dt;
          if (p.life <= 0) pops.splice(i, 1);
        }
        if (shake > 0) shake -= dt;
        if (state === "won") {
          winT += dt;
          if (Math.random() < .5) { const p = colors().p; burst(Math.random() * api.W, Math.random() * 60, ["#ffcc33", p.main, p.a2, p.a3][(Math.random() * 4) | 0], 2); }
        }
      },

      render(ctx) {
        const { W, H } = api, c = colors();
        ctx.save();
        if (shake > 0) ctx.translate(Math.round((Math.random() - .5) * 4), Math.round((Math.random() - .5) * 4));

        // static background, drawn once per palette into an offscreen canvas
        if (!bg || bgPal !== c.p) { bg = drawBackground(c); bgPal = c.p; }
        ctx.drawImage(bg, 0, 0);
        // twinkling stars on top
        for (const s of stars) {
          if (Math.sin(s.p * 2) > .6) { ctx.fillStyle = c.p.a3; ctx.fillRect(Math.round(s.x), Math.round(s.y), 1, 1); }
        }

        // falling items
        for (const it of items) {
          const img = it.bomb
            ? api.sprite(BOMB, { k: "#0b0c10", x: "#3a3e49", w: "#c9c7c2", s: Math.floor(t * 12) % 2 ? "#ff7700" : "#ffee55" })
            : api.sprite(COIN[[0, 1, 2, 1][Math.floor(it.f) % 4]], COIN_COLORS);
          ctx.drawImage(img, Math.round(it.x), Math.round(it.y));
        }

        // player (blinks while stunned)
        if (!(stun > 0 && Math.floor(t * 20) % 2)) {
          const top = api.sprite(ROBOT_TOP, c.robot);
          const legs = api.sprite(LEGS[Math.floor(walk * 8) % 2], c.robot);
          ctx.drawImage(top, Math.round(px), PY);
          ctx.drawImage(legs, Math.round(px), PY + 13);
        }

        // particles
        for (const p of pops) { ctx.fillStyle = p.color; ctx.fillRect(Math.round(p.x), Math.round(p.y), 2, 2); }

        // HUD
        if (state !== "ready") {
          api.text(ctx, `COINS ${String(caught).padStart(2, "0")}/${GOAL}`, 6, 5, { color: "#ffcc33" });
          api.text(ctx, runTime.toFixed(1) + "s", W - 6, 5, { color: c.b, align: "right" });
        }
        if (state === "won") {
          const y = 52 + Math.round(Math.sin(winT * 4) * 2);
          ctx.fillStyle = c.p.shade(.12, 0); ctx.fillRect(20, y - 8, W - 40, 40);
          ctx.fillStyle = c.a; ctx.fillRect(20, y - 8, W - 40, 2); ctx.fillRect(20, y + 30, W - 40, 2);
          api.text(ctx, "PORTFOLIO UNLOCKED!", W / 2, y, { color: c.a, align: "center", size: 10 });
          api.text(ctx, `TIME ${runTime.toFixed(1)}s${newBest ? "  NEW BEST!" : ""}`, W / 2, y + 16, { color: "#ffffff", align: "center" });
        }
        ctx.restore();
      }
    };
  }

  // --- the gate overlay ---------------------------------------------------------
  let el = null, session = null, game = null, onClose = null, autoTimer = 0;

  function bestText() {
    const b = Arcade.best("intro");
    return b === null ? "BEST: --" : `BEST: ${b.toFixed(1)}s`;
  }

  function build() {
    el = document.createElement("div");
    el.className = "gate";
    el.id = "gate";
    el.setAttribute("role", "dialog");
    el.setAttribute("aria-modal", "true");
    el.setAttribute("aria-labelledby", "gate-title");
    el.innerHTML = `
      <div class="gate-inner">
        <p class="gate-kicker">▶ INSERT COIN</p>
        <h2 id="gate-title">Play to Unlock Portfolio</h2>
        <p class="gate-goal">Catch <strong>${GOAL} coins</strong> to unlock. Dodge the bombs!</p>
        <div class="arcade-screen"><canvas aria-label="Coin Catcher game"></canvas></div>
        <div class="arcade-pad" aria-label="Game controls"></div>
        <p class="key-hint"><kbd>←</kbd><kbd>→</kbd> move</p>
        <div class="gate-actions">
          <button class="btn btn-primary" type="button" data-act="start">START</button>
          <button class="btn btn-small" type="button" data-act="skip">Skip the fun and go to portfolio</button>
        </div>
        <p class="gate-best">${bestText()}</p>
      </div>`;
    document.body.appendChild(el);

    game = createGame();
    session = Arcade.mount(el.querySelector(".arcade-screen"), game, {
      touch: ["left", "right"],
      padEl: el.querySelector(".arcade-pad"),
      onEnd: () => {
        el.classList.add("won");
        el.querySelector(".gate-best").textContent = bestText();
        const start = el.querySelector('[data-act="start"]');
        start.textContent = "ENTER PORTFOLIO";
        start.dataset.act = "enter";
        el.classList.remove("playing");
        start.focus();
        autoTimer = setTimeout(close, 4500);
      }
    });

    el.addEventListener("click", e => {
      const act = e.target.closest("[data-act]")?.dataset.act;
      if (act === "start") {
        SFX.music.setTrack("game");
        el.classList.add("playing");
        session.start();
      } else if (act === "skip" || act === "enter") {
        close();
      }
    });
  }

  function open(cb) {
    onClose = cb || null;
    if (!el) build();
    else {
      // replay: reset buttons to the start state
      const b = el.querySelector('[data-act="enter"]');
      if (b) { b.textContent = "START"; b.dataset.act = "start"; }
      el.classList.remove("won", "playing", "closing");
      el.querySelector(".gate-best").textContent = bestText();
    }
    el.hidden = false;
    document.body.classList.add("gate-active");
    setTimeout(() => el.querySelector('[data-act="start"]')?.focus(), 50);
  }

  function close() {
    clearTimeout(autoTimer);
    Arcade.store.set(DONE_KEY, true);
    SFX.music.setTrack("lofi");
    el.classList.add("closing");
    setTimeout(() => {
      el.hidden = true;
      document.body.classList.remove("gate-active");
      if (session) { session.destroy(); session = null; el.remove(); el = null; }
      if (onClose) onClose();
    }, 450);
  }

  return {
    get done() { return !!Arcade.store.get(DONE_KEY); },
    open
  };
})();
