// ---------------------------------------------------------------------------
// ARCADE: tiny shared framework for the site's minigames.
//  - a 240x160 "handheld" screen, scaled up as crisp pixel art
//  - pixel sprites defined as text maps (one character = one pixel)
//  - keyboard input (arrows / WASD + Space) and on-screen buttons on phones
//  - fixed 60 fps update loop that pauses in hidden tabs
//  - high scores and unlock flags saved in the browser (localStorage)
//
// A game is an object with:
//   init(api)            called once when mounted
//   start()              the player pressed START
//   update(dt, input)    60 times a second; input = { left, right, up, down, action, actionPressed }
//   render(ctx)          draw the frame
// and calls api.end({ won, score }) when a run is over.
// ---------------------------------------------------------------------------
window.Arcade = (() => {
  const W = 240, H = 160;

  // --- storage ---------------------------------------------------------------
  const store = {
    get(k, d = null) { try { const v = localStorage.getItem("arcade:" + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem("arcade:" + k, JSON.stringify(v)); } catch (e) {} },
    del(k) { try { localStorage.removeItem("arcade:" + k); } catch (e) {} }
  };
  // best score per game; lowerIsBetter for times
  function best(id) { return store.get("best:" + id); }
  function submit(id, value, lowerIsBetter = false) {
    const b = best(id);
    const isBest = b === null || (lowerIsBetter ? value < b : value > b);
    if (isBest) store.set("best:" + id, value);
    return isBest;
  }

  // --- drawing helpers ---------------------------------------------------------
  const spriteCache = new Map();
  // rows: array of equal-length strings; colors: { char: cssColor }; "." = transparent
  function sprite(rows, colors) {
    const key = rows.join("|") + JSON.stringify(colors);
    let c = spriteCache.get(key);
    if (c) return c;
    c = document.createElement("canvas");
    c.width = rows[0].length; c.height = rows.length;
    const g = c.getContext("2d");
    rows.forEach((r, y) => {
      for (let x = 0; x < r.length; x++) {
        const col = colors[r[x]];
        if (col) { g.fillStyle = col; g.fillRect(x, y, 1, 1); }
      }
    });
    spriteCache.set(key, c);
    return c;
  }
  // Pixel-crisp text: the browser draws text with soft anti-aliased edges, which
  // look blurry once the screen is scaled up. So each label is drawn once,
  // snapped to fully on/off pixels, cached, and then stamped like a sprite.
  const textCache = new Map();
  function textSprite(str, color, size) {
    const key = str + "|" + color + "|" + size;
    let c = textCache.get(key);
    if (c) return c;
    const m = document.createElement("canvas").getContext("2d");
    m.font = `${size}px Silkscreen, monospace`;
    const w = Math.ceil(m.measureText(str).width) + 2, h = size + 4;
    c = document.createElement("canvas");
    c.width = Math.max(1, w); c.height = h;
    const g = c.getContext("2d");
    g.font = m.font; g.textBaseline = "top"; g.fillStyle = color;
    g.fillText(str, 0, 1);
    const img = g.getImageData(0, 0, c.width, h), d = img.data;
    for (let i = 3; i < d.length; i += 4) d[i] = d[i] > 100 ? 255 : 0;   // hard pixel edges
    g.putImageData(img, 0, 0);
    if (textCache.size > 400) textCache.clear();
    textCache.set(key, c);
    return c;
  }
  function text(ctx, str, x, y, { color = "#fff", align = "left", size = 8, shadow = "#000" } = {}) {
    str = String(str);
    const s = textSprite(str, color, size);
    const w = s.width - 2;
    const left = Math.round(align === "center" ? x - w / 2 : align === "right" ? x - w : x);
    if (shadow) ctx.drawImage(textSprite(str, shadow, size), left + 1, Math.round(y));
    ctx.drawImage(s, left, Math.round(y) - 1);
  }
  // fonts can finish loading after the first frames: drop text drawn with the fallback font
  if (document.fonts) document.fonts.ready.then(() => textCache.clear());
  const css = v => getComputedStyle(document.documentElement).getPropertyValue(v).trim();

  // --- palette -------------------------------------------------------------------
  // All game art pulls its colours from the site's current palette (js/palette.js),
  // so switching palettes recolours the games too. Cached until the palette changes;
  // `version` lets games know when to rebuild pre-rendered backgrounds.
  let pal = null, palVersion = 0;
  document.addEventListener("palettechange", () => { pal = null; palVersion++; });
  const rgbStr = c => `rgb(${c.map(v => Math.round(Math.max(0, Math.min(255, v)))).join(",")})`;
  const mixRgb = (a, b, k) => a.map((v, i) => v + (b[i] - v) * k);
  function palette() {
    if (pal) return pal;
    const T = window.THEME || {}, water = T.water || [[60, 22, 66], [8, 99, 117], [29, 211, 176], [178, 255, 158]];
    const black = [7, 8, 12];
    pal = {
      version: palVersion,
      main: css("--c1") || "#AFFC41",
      a2: css("--accent-2") || "#4fd9bc", a3: css("--accent-3") || "#b2ff9e", a4: css("--accent-4") || "#6fb3c0",
      // dark shades of the palette for skies, ground and silhouettes
      shade: (k, which = 0) => rgbStr(mixRgb(black, water[which], k)),
      tint: (c, k) => rgbStr(mixRgb(c, [255, 255, 255], k)),
      water, mix: (a, b, k) => rgbStr(mixRgb(a, b, k)), rgb: rgbStr
    };
    return pal;
  }

  // --- input -------------------------------------------------------------------
  const keys = { left: false, right: false, up: false, down: false, action: false };
  let actionPressed = false, playing = null;
  const KEYMAP = {
    ArrowLeft: "left", KeyA: "left", ArrowRight: "right", KeyD: "right",
    ArrowUp: "up", KeyW: "up", ArrowDown: "down", KeyS: "down", Space: "action"
  };
  addEventListener("keydown", e => {
    const k = KEYMAP[e.code];
    if (!k || !playing) return;
    e.preventDefault();                                     // no page scrolling while playing
    if (k === "action" && !keys.action) actionPressed = true;
    keys[k] = true;
  });
  addEventListener("keyup", e => { const k = KEYMAP[e.code]; if (k) keys[k] = false; });
  addEventListener("blur", () => { for (const k in keys) keys[k] = false; });

  const TOUCH_LABEL = { left: "◀", right: "▶", up: "▲", down: "▼", action: "A" };

  // --- mounting a game on a screen element --------------------------------------
  // screenEl contains a <canvas>; padEl (optional) receives on-screen buttons
  function mount(screenEl, game, { touch = ["left", "right"], padEl = null, onEnd = () => {}, onScore = () => {} } = {}) {
    const canvas = screenEl.querySelector("canvas");
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext("2d");
    ctx.imageSmoothingEnabled = false;

    // whole-number scaling is crispest; use it when it fills the frame well,
    // otherwise fill the frame exactly (no black bars)
    function fit() {
      const cs = getComputedStyle(screenEl);
      const avail = screenEl.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
      const whole = Math.floor(avail / W);
      const s = whole >= 1 && (whole * W) / avail >= .92 ? whole : avail / W;
      canvas.style.width = W * s + "px";
      canvas.style.height = H * s + "px";
    }
    const ro = new ResizeObserver(fit); ro.observe(screenEl); fit();

    // on-screen buttons (only shown on touch screens via CSS)
    if (padEl) {
      padEl.innerHTML = "";
      touch.forEach(k => {
        const b = document.createElement("button");
        b.type = "button"; b.className = "pad-btn pad-" + k; b.textContent = TOUCH_LABEL[k];
        b.setAttribute("aria-label", k);
        const down = e => { e.preventDefault(); if (k === "action" && !keys.action) actionPressed = true; keys[k] = true; b.classList.add("down"); };
        const up = () => { keys[k] = false; b.classList.remove("down"); };
        b.addEventListener("pointerdown", down);
        ["pointerup", "pointercancel", "pointerleave"].forEach(ev => b.addEventListener(ev, up));
        padEl.appendChild(b);
      });
    }

    const session = {
      W, H, sprite, text, css, store, palette,
      end(result) { playing = null; onEnd(result); },
      score(n) { onScore(n); },                             // report the running score (live unlocks)
      start() {
        for (const k in keys) keys[k] = false;
        if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
        playing = session;
        game.start();
      },
      // freeze the game (the frame stays on screen); input is released while paused
      pause(on) {
        paused = !!on;
        for (const k in keys) keys[k] = false;
        playing = paused ? null : session;
        last = performance.now();
      },
      destroy() { cancelAnimationFrame(raf); ro.disconnect(); if (playing === session) playing = null; }
    };
    let paused = false;
    game.init(session);

    // fixed-timestep loop
    let raf = 0, last = performance.now(), acc = 0;
    const DT = 1 / 60;
    (function frame(now) {
      raf = requestAnimationFrame(frame);
      if (document.hidden || paused) { last = now; return; }
      acc += Math.min(.1, (now - last) / 1000); last = now;
      while (acc >= DT) {
        game.update(DT, { ...keys, actionPressed });
        actionPressed = false;
        acc -= DT;
      }
      game.render(ctx);
    })(last);

    return session;
  }

  // progress bar strip that sits inside the top of a game screen
  function progressBar(screenEl, tag) {
    const el = document.createElement("div");
    el.className = "arcade-bar";
    el.innerHTML = `<span class="arcade-bar-tag">${tag}</span><div class="arcade-bar-track" role="progressbar" aria-valuemin="0" aria-valuemax="100"><span class="arcade-bar-fill"></span></div>`;
    screenEl.prepend(el);
    el.set = (fraction, label) => {
      const pct = Math.max(0, Math.min(100, Math.round(fraction * 100)));
      el.querySelector(".arcade-bar-fill").style.width = pct + "%";
      const track = el.querySelector(".arcade-bar-track");
      track.setAttribute("aria-valuenow", pct);
      if (label) track.setAttribute("aria-label", label);
    };
    el.setTag = t => { el.querySelector(".arcade-bar-tag").textContent = t; };
    return el;
  }

  // render a single frame of a game into a new canvas (used for preview thumbnails)
  function snapshot(game, steps = 90) {
    const c = document.createElement("canvas");
    c.width = W; c.height = H;
    const ctx = c.getContext("2d");
    ctx.imageSmoothingEnabled = false;
    game.init({ W, H, sprite, text, css, store, palette, end() {}, score() {}, start() {}, destroy() {} });
    const idle = { left: false, right: false, up: false, down: false, action: false, actionPressed: false };
    for (let i = 0; i < steps; i++) game.update(1 / 60, idle);
    game.render(ctx);
    return c;
  }

  return { W, H, store, best, submit, sprite, text, css, palette, mount, snapshot, progressBar };
})();
