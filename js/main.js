(() => {
  "use strict";

  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch {} }
  };
  const $ = (s, el = document) => el.querySelector(s);

  document.getElementById("year").textContent = new Date().getFullYear();

  // -------------------------------------------------------------------------
  // Boot sequence — plays once per browser session, any key / click skips.
  // -------------------------------------------------------------------------
  function boot() {
    const el = $("#boot");
    let seen = false;
    try { seen = sessionStorage.getItem("booted") === "1"; } catch {}
    if (seen || reducedMotion) { el.remove(); return; }

    document.body.classList.add("boot-active");
    SFX.warmup();
    const steps = [
      "initializing unity runtime",
      "loading gameplay systems",
      "compiling shaders",
      "baking particle systems",
      "syncing build pipeline",
      "spawning player"
    ];
    const list = $("#boot-lines"), fill = $("#boot-fill"), pct = $("#boot-pct");
    let i = 0, finished = false;

    const finish = () => {
      if (finished) return;
      finished = true;
      fill.style.width = "100%"; pct.textContent = "100%";
      SFX.bootDone();
      try { sessionStorage.setItem("booted", "1"); } catch {}
      el.classList.add("done");
      document.body.classList.remove("boot-active");
      setTimeout(() => el.remove(), 700);
      removeEventListener("keydown", finish);
      el.removeEventListener("click", finish);
    };
    addEventListener("keydown", finish);
    el.addEventListener("click", finish);

    const next = () => {
      if (finished) return;
      if (i >= steps.length) { setTimeout(finish, 350); return; }
      const li = document.createElement("li");
      li.innerHTML = `<span>${steps[i]}</span><span class="dots">${".".repeat(80)}</span><span class="ok">OK</span>`;
      list.appendChild(li);
      SFX.bootTick(i);
      i++;
      const p = Math.round((i / steps.length) * 100);
      fill.style.width = p + "%"; pct.textContent = p + "%";
      setTimeout(next, 180 + Math.random() * 220);
    };
    setTimeout(next, 250);
  }
  boot();

  // -------------------------------------------------------------------------
  // Intro gate (js/intro.js): first visit only, opened right away so it sits
  // behind the loading screen and the page is never shown before it. Direct
  // links to a project skip it. The footer button replays it any time.
  // -------------------------------------------------------------------------
  const introBusy = () => document.body.classList.contains("boot-active") || document.body.classList.contains("gate-active");
  if (window.IntroGate && !IntroGate.done && !location.hash.startsWith("#p/")) IntroGate.open();
  $("#replay-intro")?.addEventListener("click", () => IntroGate.open());

  // -------------------------------------------------------------------------
  // FX toggle
  // -------------------------------------------------------------------------
  const fxBtn = $("#fx-toggle");
  let fxOn = store.get("fx") !== "off" && !reducedMotion;
  const applyFx = () => {
    document.body.classList.toggle("fx-off", !fxOn);
    fxBtn.setAttribute("aria-pressed", String(fxOn));   // on/off look comes from CSS
  };
  fxBtn.addEventListener("click", () => { fxOn = !fxOn; store.set("fx", fxOn ? "on" : "off"); applyFx(); requestHeroFrame(); SFX.toggle(fxOn); });
  applyFx();

  // sound effects and background music toggles (audio lives in js/sfx.js)
  const sfxBtn = $("#sfx-toggle"), muteBtn = $("#bgm-mute"), bars = $("#bgm-bars");
  const applyAudio = () => {
    const lvl = SFX.music.level;
    sfxBtn.setAttribute("aria-pressed", String(SFX.enabled));
    muteBtn.setAttribute("aria-pressed", String(lvl > 0));
    muteBtn.setAttribute("aria-label", lvl > 0 ? "Mute music" : "Unmute music");
    bars.setAttribute("aria-valuenow", String(lvl));
    bars.setAttribute("aria-valuetext", lvl ? `${lvl} of ${SFX.music.LEVELS}` : "off");
    bars.querySelectorAll("i").forEach((b, i) => b.classList.toggle("on", i < lvl));
  };
  sfxBtn.addEventListener("click", () => { SFX.setEnabled(!SFX.enabled); applyAudio(); SFX.toggle(SFX.enabled); });
  muteBtn.addEventListener("click", () => { SFX.music.toggleMute(); applyAudio(); });

  // music volume bars: click or drag across them, or use the arrow keys
  const setVol = n => { if (n !== SFX.music.level) { SFX.music.setLevel(n); applyAudio(); } };
  const levelAt = x => {
    const r = bars.getBoundingClientRect();
    return Math.max(0, Math.min(SFX.music.LEVELS, Math.ceil(((x - r.left) / r.width) * SFX.music.LEVELS)));
  };
  bars.addEventListener("pointerdown", e => {
    bars.setPointerCapture(e.pointerId);
    const n = levelAt(e.clientX);
    setVol(n === 1 && SFX.music.level === 1 ? 0 : n);       // clicking the only lit bar turns it off
  });
  bars.addEventListener("pointermove", e => { if (bars.hasPointerCapture(e.pointerId)) setVol(levelAt(e.clientX)); });
  bars.addEventListener("keydown", e => {
    const l = SFX.music.level, keys = { ArrowRight: l + 1, ArrowUp: l + 1, ArrowLeft: l - 1, ArrowDown: l - 1, Home: 0, End: SFX.music.LEVELS };
    if (e.key in keys) { e.preventDefault(); setVol(Math.max(0, Math.min(SFX.music.LEVELS, keys[e.key]))); }
  });
  applyAudio();

  // the hero shader only animates while FX are on; when they're off it still
  // redraws a single frame whenever something visible changes (palette, resize)
  let requestHeroFrame = () => {};

  // -------------------------------------------------------------------------
  // Colour palettes: defined and applied in js/palette.js (loaded in <head>).
  // THEME.c1 = main colour (cursor FX), THEME.water = the other four, sorted
  // dark -> bright, used by the hero water.
  // -------------------------------------------------------------------------
  const theme = window.THEME;
  $("#palette-toggle").addEventListener("click", () => { setPalette(theme.index + 1); SFX.palette(); });
  document.addEventListener("palettechange", () => requestHeroFrame());

  // -------------------------------------------------------------------------
  // Cursor particles — sparks trail the mouse, ambient embers drift and get
  // pushed away by the cursor, clicks emit a radial burst.
  // -------------------------------------------------------------------------
  function particles() {
    const cv = $("#particles");
    const ctx = cv.getContext("2d");
    // Pixel-art rendering: the canvas is drawn at 1/PX resolution and scaled
    // up with nearest-neighbour filtering (CSS image-rendering: pixelated), so
    // every particle snaps to a chunky pixel grid. Also 1/9 of the pixels to draw.
    const PX = 3;
    // the cursor effect only uses the main colour (c1) and a lighter tint of it
    const SPARK_KEYS = ["c1", "c1", "c1light"];
    let W = 0, H = 0;      // canvas size in game pixels
    const sparks = [];
    const embers = [];
    const mouse = { x: -999, y: -999, px: -999, py: -999, active: false };
    // alpha in a few hard steps, like a limited palette
    const stepA = a => Math.ceil(a * 4) / 4;

    // small blocky glow used under the cursor and behind big sparks
    let glow = null;
    function buildGlow() {
      const S = 16;
      glow = document.createElement("canvas");
      glow.width = glow.height = S;
      const g = glow.getContext("2d");
      for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
        const d = Math.hypot(x + .5 - S / 2, y + .5 - S / 2) / (S / 2);
        if (d >= 1) continue;
        // ordered (Bayer-style) dither so the falloff reads as pixel art
        const level = (1 - d) * (1 - d);
        const threshold = (((x & 1) * 2 + (y & 1) * 3) % 4) / 4;
        if (level * 1.6 > threshold) {
          g.fillStyle = `rgba(${theme.c1},${stepA(level)})`;
          g.fillRect(x, y, 1, 1);
        }
      }
    }
    buildGlow();
    document.addEventListener("palettechange", buildGlow);

    function resize() {
      W = Math.ceil(innerWidth / PX); H = Math.ceil(innerHeight / PX);
      cv.width = W; cv.height = H;
      ctx.imageSmoothingEnabled = false;
      const target = Math.round((innerWidth * innerHeight) / 24000);
      while (embers.length < target) embers.push(makeEmber(true));
      embers.length = target;
    }

    function makeEmber(randomY) {
      return {
        x: Math.random() * W,
        y: randomY ? Math.random() * H : H + 4,
        vx: (Math.random() - .5) * .07,
        vy: -(.05 + Math.random() * .12),
        size: Math.random() < .8 ? 1 : 2,
        a: .1 + Math.random() * .25,
        c: Math.random() < .75 ? "c1" : "c1light",
        tw: Math.random() * Math.PI * 2
      };
    }

    function spawnSpark(x, y, vx, vy, life, size) {
      if (sparks.length > 160) sparks.shift();
      sparks.push({
        x, y, vx, vy, life, max: life, size,
        c: SPARK_KEYS[(Math.random() * SPARK_KEYS.length) | 0]
      });
    }

    addEventListener("pointermove", e => {
      mouse.x = e.clientX / PX; mouse.y = e.clientY / PX; mouse.active = true;
      if (!fxOn) return;
      const dx = mouse.x - mouse.px, dy = mouse.y - mouse.py;
      const speed = Math.min(Math.hypot(dx, dy) * PX, 60);
      if (mouse.px > -999) {
        // roughly one spark every ~24px of travel, so slow moves leave only a faint trail
        const n = Math.floor(speed / 24) + (Math.random() < (speed % 24) / 24 ? 1 : 0);
        for (let i = 0; i < n; i++) {
          const t = i / n;
          spawnSpark(
            mouse.px + dx * t, mouse.py + dy * t,
            dx * .04 + (Math.random() - .5) * .4,
            dy * .04 + (Math.random() - .5) * .4 - .1,
            30 + Math.random() * 30,
            Math.random() < .35 ? 2 : 1
          );
        }
      }
      mouse.px = mouse.x; mouse.py = mouse.y;
    }, { passive: true });
    document.addEventListener("pointerleave", () => { mouse.active = false; mouse.px = mouse.py = -999; });

    // exposed so the click handler can trigger a burst
    burst = (cx, cy) => {
      const x = cx / PX, y = cy / PX;
      for (let i = 0; i < 26; i++) {
        const a = (i / 26) * Math.PI * 2 + Math.random() * .2;
        const s = .5 + Math.random() * 1.1;
        spawnSpark(x, y, Math.cos(a) * s, Math.sin(a) * s, 40 + Math.random() * 35, Math.random() < .4 ? 2 : 1);
      }
    };

    // a spark drawn as a pixel; big ones are a "+" sparkle with a white core
    function drawSpark(s, k) {
      const x = Math.round(s.x), y = Math.round(s.y);
      const col = theme[s.c];
      ctx.globalAlpha = stepA(Math.min(1, k * 1.1));
      if (s.size === 2 && k > .35) {
        ctx.fillStyle = `rgb(${col})`;
        ctx.fillRect(x - 1, y, 3, 1);
        ctx.fillRect(x, y - 1, 1, 3);
        if (k > .7) {                           // long arms while it's fresh
          ctx.globalAlpha *= .5;
          ctx.fillRect(x - 2, y, 1, 1); ctx.fillRect(x + 2, y, 1, 1);
          ctx.fillRect(x, y - 2, 1, 1); ctx.fillRect(x, y + 2, 1, 1);
          ctx.globalAlpha /= .5;
        }
        ctx.fillStyle = "#fff";
        ctx.fillRect(x, y, 1, 1);
      } else {
        ctx.fillStyle = k > .75 ? "#fff" : `rgb(${col})`;   // flash white when born
        ctx.fillRect(x, y, 1, 1);
      }
    }

    let cleared = false;
    function frame() {
      requestAnimationFrame(frame);
      if (!fxOn || document.hidden) {
        if (!cleared) { ctx.clearRect(0, 0, W, H); sparks.length = 0; cleared = true; }
        return;
      }
      cleared = false;
      ctx.clearRect(0, 0, W, H);
      ctx.globalCompositeOperation = "lighter";

      // ambient embers: drifting pixels pushed away by the cursor
      const R = 140 / PX;
      for (const p of embers) {
        p.tw += .03;
        if (mouse.active) {
          const dx = p.x - mouse.x, dy = p.y - mouse.y;
          const d2 = dx * dx + dy * dy;
          if (d2 < R * R) {
            const d = Math.sqrt(d2) || 1, f = (1 - d / R) * .2;
            p.vx += (dx / d) * f; p.vy += (dy / d) * f;
            // faint pixel line to the cursor
            ctx.globalAlpha = stepA((1 - d / R) * .25);
            ctx.strokeStyle = `rgb(${theme[p.c]})`;
            ctx.lineWidth = 1;
            ctx.beginPath(); ctx.moveTo(Math.round(p.x) + .5, Math.round(p.y) + .5);
            ctx.lineTo(Math.round(mouse.x) + .5, Math.round(mouse.y) + .5); ctx.stroke();
          }
        }
        p.vx *= .96; p.vy = p.vy * .96 - .004;
        p.x += p.vx; p.y += p.vy;
        if (p.y < -4 || p.x < -8 || p.x > W + 8) Object.assign(p, makeEmber(false));
        ctx.globalAlpha = stepA(p.a * (.6 + .4 * Math.sin(p.tw)));
        ctx.fillStyle = `rgb(${theme[p.c]})`;
        ctx.fillRect(Math.round(p.x), Math.round(p.y), p.size, p.size);
      }

      // cursor sparks
      for (let i = sparks.length - 1; i >= 0; i--) {
        const s = sparks[i];
        s.life--;
        if (s.life <= 0) { sparks.splice(i, 1); continue; }
        s.vx *= .95; s.vy = s.vy * .95 + .01;
        s.x += s.vx; s.y += s.vy;
        drawSpark(s, s.life / s.max);
      }

      // blocky dithered glow under the cursor
      if (mouse.active) {
        ctx.globalAlpha = .22;
        const G = 60 / PX * 2;
        ctx.drawImage(glow, Math.round(mouse.x - G / 2), Math.round(mouse.y - G / 2), G, G);
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";
    }

    addEventListener("resize", resize);
    resize();
    frame();
  }
  let burst = () => {};
  particles();

  // -------------------------------------------------------------------------
  // Hero shader — underwater caustics with light shafts; the cursor drops a
  // ripple into the surface. Kept cheap (no textures, two 4-step loops) and
  // rendered at reduced resolution with an adaptive pixel budget.
  // -------------------------------------------------------------------------
  function heroShader() {
    const cv = $("#hero-shader");
    const gl = cv.getContext("webgl", { antialias: false, alpha: false, depth: false, stencil: false, powerPreference: "low-power" });
    if (!gl) { cv.style.background = "radial-gradient(circle at 70% 20%, rgba(var(--deep-rgb),.55), #0b0c10 65%)"; return; }

    const vs = `attribute vec2 p; void main(){ gl_Position = vec4(p,0.,1.); }`;
    const fs = `
      #ifdef GL_FRAGMENT_PRECISION_HIGH
      precision highp float;
      #else
      precision mediump float;
      #endif
      uniform vec2 uRes; uniform float uTime; uniform vec2 uMouse;
      uniform vec3 uDrop;   // last click on the water: xy = position (px), z = seconds since
      uniform vec3 uC2, uC3, uC4, uC5;   // non-main palette colours, dark -> bright (c1 is kept for the cursor FX)

      // Iterative domain-warp caustic: each pass feeds the warped coordinate
      // back in, so the bright filaments braid and merge irregularly instead of
      // forming a regular grid. 4 passes, ~6 trig calls each, no textures.
      float caustic(vec2 p, float t){
        vec2 i = p;
        float c = 1.;
        for (int n = 0; n < 4; n++) {
          float tt = t * (1. - 3.5 / float(n + 1));
          i = p + vec2(cos(tt - i.x) + sin(tt + i.y), sin(tt - i.y) + cos(tt + i.x));
          float s = sin(i.x + tt), k = cos(i.y + tt);
          // 1/length(1/s, 1/k) written without divisions by zero
          c += abs(s * k) / (1.25 * sqrt(s*s + k*k) + 1e-4);
        }
        c /= 4.;
        c = 1.17 - pow(c, 1.4);
        return pow(abs(c), 8.);
      }

      mat2 rot(float a){ float s = sin(a), c = cos(a); return mat2(c, -s, s, c); }

      // scale a palette colour to a target brightness, so a bright palette
      // colour doesn't wash out the dark water body
      vec3 dim(vec3 c, float k){ return c * k * min(1., .25 / max(.01, dot(c, vec3(.3, .59, .11)))); }

      void main(){
        vec2 uv = gl_FragCoord.xy / uRes.y;
        vec2 st = gl_FragCoord.xy / uRes;          // 0..1 both axes, y = depth
        float t = uTime;

        // cursor ripple: radial sine wave that fades with distance
        vec2 d = uv - uMouse / uRes.y;
        float dl = length(d) + 1e-4;
        vec2 p = uv + d / dl * sin(dl*38. - t*4.) * exp(-dl*6.) * .03;

        // click drop: a ring that expands from the click point and fades out
        vec2 dd = uv - uDrop.xy / uRes.y;
        float ddl = length(dd) + 1e-4;
        float front = ddl - uDrop.z * .55;                       // ring radius grows with age
        float ring = sin(front * 70.) * exp(-front * front * 900.) * exp(-uDrop.z * 2.2);
        p += dd / ddl * ring * .018;

        // slow large-scale swell bends the whole pattern so it never looks tiled
        p += .05 * vec2(sin(p.y*2.3 + t*.21), cos(p.x*1.9 - t*.17));

        // two layers at different scale, angle and speed; where they cross you
        // get the bright hot spots real caustics have
        float l1 = caustic(rot(.55) * p * 11. + vec2(5.2, 1.3), t * .45 + 23.);
        float l2 = caustic(rot(-.9) * p * 15.5 + vec2(-2.7, 8.1), t * .33 + 11.);
        float a = l1 * (.6 + 2. * l1), b = l2 * (.6 + 2. * l2);   // sharpen the filaments

        // slowly drifting colour fields decide which palette colour lights each area
        float m  = .5 + .5 * sin(uv.x * 2.2 + sin(uv.y * 1.6 + t * .09) * 1.8 + t * .06);
        float m2 = .5 + .5 * sin(uv.y * 2.7 - uv.x * .8 + t * .05 + 1.3);

        // water body: darkest colour in the depths rising to the next one near the surface
        vec3 deep    = dim(uC2, .32);
        vec3 shallow = dim(mix(uC3, uC2, m2 * .5), .34);
        vec3 col = mix(deep, shallow, smoothstep(0., 1., st.y));

        vec3 lift2 = min(uC2 * 2.4, vec3(1.));          // c2 brightened enough to read as light
        vec3 tintA = mix(mix(uC4, uC5, m), lift2, smoothstep(.55, 1., m2) * .55);
        vec3 tintB = mix(uC5, mix(uC3 * 1.7, lift2, .35), m2);
        float depthK = .35 + .65 * st.y;               // light weakens with depth
        col += tintA * a * .42 * depthK;
        col += tintB * b * .26 * depthK;
        col += mix(uC5, vec3(1.), .4) * l1 * l2 * 1.3 * depthK;

        // god rays from the surface
        float r = sin(st.x*9. + sin(st.x*3. + t*.25)*1.6 + st.y*1.2);
        col += mix(uC4, uC3, m2) * pow(.5 + .5*r, 8.) * smoothstep(.15, 1., st.y) * .09;

        // faint glint where the cursor touches the water
        col += uC4 * exp(-dl*dl*60.) * .05;
        col += mix(uC5, vec3(1.), .3) * max(ring, 0.) * .22 * depthK;   // light catching the drop ring

        float vig = smoothstep(1.4, .2, length(st - .5) * 1.6);
        gl_FragColor = vec4(col * vig, 1.);
      }`;

    const sh = (type, src) => {
      const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) console.warn(gl.getShaderInfoLog(s));
      return s;
    };
    const prog = gl.createProgram();
    gl.attachShader(prog, sh(gl.VERTEX_SHADER, vs));
    gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(prog);
    gl.useProgram(prog);

    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, "p");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    const uRes = gl.getUniformLocation(prog, "uRes");
    const uTime = gl.getUniformLocation(prog, "uTime");
    const uMouse = gl.getUniformLocation(prog, "uMouse");
    const uCols = [2, 3, 4, 5].map(k => gl.getUniformLocation(prog, "uC" + k));
    const uDrop = gl.getUniformLocation(prog, "uDrop");

    // Resolution budget: render a capped number of pixels and let CSS upscale.
    // Weaker devices start with a smaller budget, and if frames still run slow
    // the budget drops further (up to twice).
    const lowEnd = (navigator.hardwareConcurrency || 8) <= 4 || (navigator.deviceMemory || 8) <= 4;
    let budget = lowEnd ? 120000 : 260000;
    let scale = 1, downgrades = 0;
    const target = { x: 0, y: 0 }, cur = { x: 0, y: 0 };
    let visible = true;

    // The hero's page position is cached so pointer handlers don't force a
    // layout read (getBoundingClientRect) on every mouse move.
    let heroTop = 0, heroLeft = 0, heroH = 1;
    function measure() {
      const r = cv.getBoundingClientRect();
      heroTop = r.top + scrollY; heroLeft = r.left + scrollX; heroH = r.height;
    }
    const toCanvas = (cx, cy) => [
      (cx + scrollX - heroLeft) * scale,
      (heroH - (cy + scrollY - heroTop)) * scale
    ];

    function resize() {
      const w = cv.clientWidth, h = cv.clientHeight;
      scale = Math.min(.6, Math.sqrt(budget / Math.max(1, w * h)));
      cv.width = Math.max(1, Math.round(w * scale));
      cv.height = Math.max(1, Math.round(h * scale));
      gl.viewport(0, 0, cv.width, cv.height);
      target.x = cur.x = cv.width * .7; target.y = cur.y = cv.height * .6;
      measure();
      dirty = true;
    }
    let dirty = true;
    addEventListener("resize", resize);

    addEventListener("pointermove", e => {
      [target.x, target.y] = toCanvas(e.clientX, e.clientY);
    }, { passive: true });

    // click on the water: ripple ring + drop sound
    const drop = { x: -9999, y: -9999, at: -1e9 };
    dropAt = (cx, cy) => {
      [drop.x, drop.y] = toCanvas(cx, cy);
      drop.at = performance.now();
    };
    isOverWater = (cx, cy) => {
      const y = cy + scrollY - heroTop;
      return y >= 0 && y <= heroH;
    };

    requestHeroFrame = () => { dirty = true; };
    addEventListener("load", measure);   // fonts/images can shift the layout after start
    new IntersectionObserver(([en]) => { visible = en.isIntersecting; }).observe(cv);

    const start = performance.now();
    let last = start, slowFrames = 0, sampled = 0, shownTime = 0;
    resize();
    (function loop(now) {
      requestAnimationFrame(loop);
      const dt = now - last; last = now;
      if (!visible || document.hidden || modalOpen) return;   // nothing to see: skip the GPU work
      // FX off: hold a still frame, but redraw it when something changes
      // (palette switch, resize) so the colours always match the page
      if (!fxOn && !dirty) return;
      dirty = false;

      // adaptive quality: sample 90 frames, downgrade if most are slower than ~40 fps
      if (fxOn && downgrades < 2 && dt < 200) {
        sampled++;
        if (dt > 25) slowFrames++;
        if (sampled >= 90) {
          if (slowFrames > 45) { budget *= .5; downgrades++; resize(); }
          sampled = slowFrames = 0;
        }
      }

      if (fxOn && !reducedMotion) shownTime = ((now - start) / 1000) % 3600;
      cur.x += (target.x - cur.x) * .06; cur.y += (target.y - cur.y) * .06;
      gl.uniform2f(uRes, cv.width, cv.height);
      gl.uniform1f(uTime, shownTime);
      gl.uniform2f(uMouse, cur.x, cur.y);
      gl.uniform3f(uDrop, drop.x, drop.y, Math.min((now - drop.at) / 1000, 60));
      uCols.forEach((u, k) => { const c = theme.water[k]; gl.uniform3f(u, c[0] / 255, c[1] / 255, c[2] / 255); });
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    })(start);
  }
  let dropAt = () => {}, isOverWater = () => false, modalOpen = false;

  // -------------------------------------------------------------------------
  // Clicks and hovers: sounds + click effects
  // -------------------------------------------------------------------------
  const INTERACTIVE = "a, button, .card, .live-icon, summary, [role=button], [role=slider]";
  addEventListener("pointerdown", e => {
    const t = e.target;
    if (t.closest(INTERACTIVE)) { SFX.click(); return; }
    if (!fxOn || t.closest("iframe, .modal-panel, .modal-backdrop, input, textarea, .gate")) return;
    burst(e.clientX, e.clientY);
    if (isOverWater(e.clientX, e.clientY)) { dropAt(e.clientX, e.clientY); SFX.water(); }
    else SFX.sparkle();
  }, { passive: true });

  let hoverEl = null;
  document.addEventListener("pointerover", e => {
    if (e.pointerType !== "mouse") return;
    const el = e.target.closest(INTERACTIVE);
    if (el && el !== hoverEl) SFX.hover();
    hoverEl = el;
  }, { passive: true });
  heroShader();

  // -------------------------------------------------------------------------
  // Project cards
  // -------------------------------------------------------------------------
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  function cardHTML(p) {
    return `
      <button class="card reveal" type="button" data-slug="${p.slug}" aria-label="Open ${esc(p.title)}">
        <div class="card-media">
          <img src="${p.cover}" alt="" loading="lazy" decoding="async">
          <span class="play" aria-hidden="true">▶</span>
        </div>
        <div class="card-body">
          <h3>${esc(p.title)}</h3>
          <p>${esc(p.tagline)}</p>
          <div class="meta"><span>${esc(p.role)}</span><span>${esc(p.studio)}</span><span>${esc(p.period)}</span></div>
        </div>
      </button>`;
  }
  $("#featured-grid").innerHTML = PROJECTS.filter(p => p.featured).map(cardHTML).join("");
  $("#more-grid").innerHTML = PROJECTS.filter(p => !p.featured).map(cardHTML).join("");

  // -------------------------------------------------------------------------
  // Live games (data: LIVE_GAMES in js/projects.js)
  // -------------------------------------------------------------------------
  const STORE_LABEL = { appstore: "App Store", googleplay: "Google Play", steam: "Steam" };
  $("#live-grid").innerHTML = (window.LIVE_GAMES || []).map((g, i) => `
    <article class="live reveal" style="--live: var(--accent-${2 + (i % 3)})">
      <a class="live-icon" href="${esc(g.stores[0].url)}" target="_blank" rel="noopener" aria-label="${esc(g.title)} on ${STORE_LABEL[g.stores[0].store]}">
        <img src="${esc(g.icon)}" alt="" loading="lazy" width="256" height="256">
      </a>
      <div class="live-body">
        <h3>${esc(g.title)}</h3>
        ${g.note ? `<p>${esc(g.note)}</p>` : ""}
        <div class="live-stores">
          ${g.stores.map(s => `<a href="${esc(s.url)}" target="_blank" rel="noopener" class="store store-${s.store}">${STORE_LABEL[s.store] || s.store} ↗</a>`).join("")}
        </div>
      </div>
    </article>`).join("");

  document.querySelectorAll(".card").forEach(card => {
    card.addEventListener("click", () => { location.hash = "p/" + card.dataset.slug; });
    if (reducedMotion) return;
    // tilt is applied at most once per frame, and the card's rect is read once
    // per hover instead of on every mouse move
    let rect = null, pending = null, raf = 0;
    card.addEventListener("pointerenter", () => { rect = card.getBoundingClientRect(); });
    card.addEventListener("pointermove", e => {
      pending = e;
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        if (!pending) return;
        rect = rect || card.getBoundingClientRect();
        const x = (pending.clientX - rect.left) / rect.width, y = (pending.clientY - rect.top) / rect.height;
        card.style.transform = `perspective(900px) rotateY(${(x - .5) * 8}deg) rotateX(${(.5 - y) * 8}deg) translateY(-4px)`;
        card.style.setProperty("--mx", x * 100 + "%");
        card.style.setProperty("--my", y * 100 + "%");
      });
    }, { passive: true });
    card.addEventListener("pointerleave", () => { pending = null; rect = null; card.style.transform = ""; });
  });

  // -------------------------------------------------------------------------
  // Minigame locks (js/arcade-sections.js). Goals are default values to tune
  // after playtesting: one per item, in the order the items appear.
  // -------------------------------------------------------------------------
  if (window.Arcade && Arcade.lockSection) {
    const moreProjects = PROJECTS.filter(p => !p.featured);
    Arcade.lockSection({
      id: "more",
      anchor: $("#more-grid"),
      items: [...document.querySelectorAll("#more-grid .card")],
      names: moreProjects.map(p => p.title),
      goals: [50, 150, 300, 500, 750, 1050, 1400, 1800],
      itemWord: "projects",
      title: "Space Ascent Defender",
      blurb: "Blast the alien waves before they land. Every score goal unlocks another project, and one great run can unlock them all.",
      keys: "<kbd>←</kbd><kbd>→</kbd> move <kbd>Space</kbd> fire",
      touch: ["left", "right", "action"],
      bestId: "defender",
      createGame: Games.defender
    });
  }

  // -------------------------------------------------------------------------
  // Project modal (deep-linkable: #p/<slug>)
  // -------------------------------------------------------------------------
  // Videos render as a poster + play button and only load the player on click:
  // keeps the modal fast and avoids loading many players at once.
  function embed(v, poster) {
    if (!v) return "";
    let src, thumb = v.poster || poster;
    switch (v.type) {
      case "youtube":
        src = `https://www.youtube-nocookie.com/embed/${v.id}?rel=0&autoplay=1${v.start ? "&start=" + v.start : ""}`;
        // 1280x720 thumbnail; falls back to the 480px one if a video has none
        thumb = v.poster || `https://i.ytimg.com/vi/${v.id}/maxresdefault.jpg`;
        break;
      case "vimeo": src = `https://player.vimeo.com/video/${v.id}?autoplay=1`; break;
      case "adobe":
        src = `https://www-ccv.adobe.io/v1/player/ccv/${v.id}/embed?api_key=behance1&bgcolor=%23191919&autoplay=true`;
        // the video's own frame, saved locally at 1280px (Adobe's links expire)
        thumb = v.poster || `assets/img/posters/${v.id}.jpg`;
        break;
      case "file":
        return `<div class="video"><video src="${v.src}" controls playsinline preload="metadata" loop muted${thumb ? ` poster="${thumb}"` : ""}></video></div>`;
      default: return "";
    }
    return `<button class="video video-facade" type="button" data-src="${src}" aria-label="Play video">
      ${thumb ? `<img src="${thumb}" alt="" loading="lazy" decoding="async"${v.type === "youtube" && !v.poster ? ` data-yt="${v.id}"` : ""}>` : ""}<span class="play" aria-hidden="true">▶</span></button>`;
  }

  // YouTube answers a missing maxres thumbnail with a 120x90 placeholder
  // (sometimes as an error): swap in the always-present 480px version
  const ytFallback = img => { if (img.dataset.yt) { img.src = `https://i.ytimg.com/vi/${img.dataset.yt}/hqdefault.jpg`; delete img.dataset.yt; } };
  document.addEventListener("load", e => { const img = e.target; if (img.dataset?.yt && img.naturalWidth <= 120) ytFallback(img); }, true);
  document.addEventListener("error", e => { if (e.target.dataset?.yt) ytFallback(e.target); }, true);

  document.addEventListener("click", e => {
    const f = e.target.closest(".video-facade");
    if (!f) return;
    const wrap = document.createElement("div");
    wrap.className = "video";
    wrap.innerHTML = `<iframe src="${f.dataset.src}" title="Project video" referrerpolicy="strict-origin-when-cross-origin" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen></iframe>`;
    f.replaceWith(wrap);
  });

  const modal = $("#modal"), body = $("#modal-body");
  let lastFocus = null;

  function openProject(slug) {
    const p = PROJECTS.find(x => x.slug === slug);
    if (!p) return closeModal();
    lastFocus = document.activeElement;
    body.innerHTML = `
      <p class="eyebrow">${esc(p.studio)}</p>
      <h2 id="modal-title">${esc(p.title)}</h2>
      <div class="meta"><span>${esc(p.role)}</span><span>${esc(p.period)}</span><span>${esc(p.tech)}</span></div>
      <p>${esc(p.description)}</p>
      ${(p.videos || []).map(v => embed(v, p.cover)).join("")}
      ${(p.highlights || []).map(h => `
        <div class="highlight">
          <div><h3>${esc(h.title)}</h3><p>${esc(h.text)}</p></div>
          ${embed(h.video, p.cover)}
        </div>`).join("")}
      ${p.gallery ? `<div class="gallery">${p.gallery.map(src => `<img src="${src}" alt="" loading="lazy" decoding="async">`).join("")}</div>` : ""}
    `;
    if (modal.hidden) SFX.open();
    modal.hidden = false;
    modalOpen = true;
    document.body.style.overflow = "hidden";
    $(".modal-panel").scrollTop = 0;
    $(".modal-close").focus();
  }

  function closeModal() {
    if (modal.hidden) return;
    SFX.close();
    modal.hidden = true;
    modalOpen = false;
    body.innerHTML = ""; // stops any playing video
    document.body.style.overflow = "";
    if (location.hash.startsWith("#p/")) history.replaceState(null, "", location.pathname + location.search);
    lastFocus?.focus?.();
  }

  modal.addEventListener("click", e => { if (e.target.closest("[data-close]")) closeModal(); });
  addEventListener("keydown", e => { if (e.key === "Escape") closeModal(); });

  function route() {
    const m = location.hash.match(/^#p\/(.+)$/);
    if (m) openProject(decodeURIComponent(m[1])); else closeModal();
  }
  addEventListener("hashchange", route);
  route();

  // -------------------------------------------------------------------------
  // Scroll reveal
  // -------------------------------------------------------------------------
  const io = new IntersectionObserver(entries => {
    entries.forEach(en => {
      if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); }
    });
  }, { rootMargin: "0px 0px -8% 0px" });
  document.querySelectorAll(".reveal").forEach((el, i) => {
    el.style.transitionDelay = (i % 4) * 70 + "ms";
    io.observe(el);
  });

  // -------------------------------------------------------------------------
  // Avatar: the photo starts pixelated (with a reduced, retro colour range) and
  // steps up to full resolution on hover; leaving re-pixelates it. Touch
  // screens have no hover, so there it resolves once when it comes into view.
  // -------------------------------------------------------------------------
  function avatar() {
    const fig = $("#avatar");
    if (!fig) return;
    const frame = fig.querySelector(".avatar-frame");
    const img = fig.querySelector("img"), cv = fig.querySelector("canvas");
    const ctx = cv.getContext("2d", { willReadFrequently: true });
    const LEVELS = [18, 24, 32, 44, 64, 96, 0];           // pixels across; 0 = full photo
    let level = 0, target = 0, timer = 0, ready = false;

    function draw(n) {
      if (!n) { cv.style.opacity = 0; return; }
      cv.width = cv.height = n;
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(img, 0, 0, n, n);
      // posterize: 6 levels per channel, like a limited console palette
      const d = ctx.getImageData(0, 0, n, n), p = d.data;
      for (let i = 0; i < p.length; i += 4) {
        p[i] = Math.round(p[i] / 51) * 51; p[i + 1] = Math.round(p[i + 1] / 51) * 51; p[i + 2] = Math.round(p[i + 2] / 51) * 51;
      }
      ctx.putImageData(d, 0, 0);
      cv.style.opacity = 1;
    }

    function stepTo(t) {
      target = t;
      if (timer || !ready) return;
      timer = setInterval(() => {
        if (level === target) { clearInterval(timer); timer = 0; return; }
        level += level < target ? 1 : -1;
        draw(LEVELS[level]);
      }, 60);
    }

    const full = LEVELS.length - 1;
    img.decode().catch(() => {}).then(() => {
      ready = true;
      if (reducedMotion) { level = full; draw(0); return; }
      draw(LEVELS[0]);
      if (matchMedia("(hover: none)").matches) {
        // phones/tablets: resolve once when visible, then stay sharp
        const reveal = () => {
          if (introBusy()) { setTimeout(reveal, 200); return; }
          setTimeout(() => { stepTo(full); SFX.pixel(true); }, 400);
        };
        const o = new IntersectionObserver(([en]) => {
          if (!en.isIntersecting) return;
          o.disconnect();
          reveal();
        }, { threshold: .6 });
        o.observe(fig);
      }
    });

    frame.addEventListener("pointerenter", e => {
      if (e.pointerType !== "mouse" || reducedMotion) return;
      stepTo(full); SFX.pixel(true);
    });
    frame.addEventListener("pointerleave", e => {
      if (e.pointerType !== "mouse" || reducedMotion) return;
      stepTo(0); SFX.pixel(false);
    });
  }
  avatar();

  // -------------------------------------------------------------------------
  // Typewriter: short labels and titles type themselves in with a block cursor
  // the first time they scroll into view. Fast (under half a second) and the
  // full text keeps its space the whole time, so nothing jumps while reading.
  // -------------------------------------------------------------------------
  const TYPE_SEL = ".hero .eyebrow, .section .eyebrow, .section h2, .section .sub, .timeline .when, .focus h3, .skill-group h3";

  function typeOut(el) {
    if (introBusy()) { setTimeout(() => typeOut(el), 150); return; }
    const text = el.textContent;
    if (!text.trim() || el.children.length) return;          // plain text only
    el.setAttribute("aria-label", text);
    const typed = document.createTextNode("");
    const cursor = document.createElement("span");
    const rest = document.createElement("span");
    cursor.className = "tw-cursor"; rest.className = "tw-rest";
    cursor.setAttribute("aria-hidden", "true"); rest.setAttribute("aria-hidden", "true");
    el.textContent = "";
    el.append(typed, cursor, rest);
    const total = Math.min(450, Math.max(180, text.length * 22));   // ms for the whole line
    const t0 = performance.now();
    (function step(now) {
      const n = Math.min(text.length, Math.ceil(((now - t0) / total) * text.length));
      typed.data = text.slice(0, n);
      rest.textContent = text.slice(n);
      if (n < text.length) { requestAnimationFrame(step); return; }
      cursor.classList.add("blink");                        // blink twice, then clean up
      setTimeout(() => { el.textContent = text; el.removeAttribute("aria-label"); }, 1000);
    })(t0);
  }

  if (!reducedMotion) {
    const tio = new IntersectionObserver(entries => {
      entries.forEach(en => {
        if (en.isIntersecting) { tio.unobserve(en.target); typeOut(en.target); }
      });
    }, { rootMargin: "0px 0px -10% 0px" });
    document.querySelectorAll(TYPE_SEL).forEach(el => tio.observe(el));
  }
})();
