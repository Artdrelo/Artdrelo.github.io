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
      i++;
      const p = Math.round((i / steps.length) * 100);
      fill.style.width = p + "%"; pct.textContent = p + "%";
      setTimeout(next, 180 + Math.random() * 220);
    };
    setTimeout(next, 250);
  }
  boot();

  // -------------------------------------------------------------------------
  // FX toggle
  // -------------------------------------------------------------------------
  const fxBtn = $("#fx-toggle");
  let fxOn = store.get("fx") !== "off" && !reducedMotion;
  const applyFx = () => {
    document.body.classList.toggle("fx-off", !fxOn);
    fxBtn.setAttribute("aria-pressed", String(fxOn));
    fxBtn.textContent = fxOn ? "FX on" : "FX off";
  };
  fxBtn.addEventListener("click", () => { fxOn = !fxOn; store.set("fx", fxOn ? "on" : "off"); applyFx(); });
  applyFx();

  // -------------------------------------------------------------------------
  // Colour palettes: defined and applied in js/palette.js (loaded in <head>).
  // THEME.c1 = main colour (cursor FX), THEME.water = the other four, sorted
  // dark -> bright, used by the hero water.
  // -------------------------------------------------------------------------
  const theme = window.THEME;
  $("#palette-toggle").addEventListener("click", () => setPalette(theme.index + 1));

  // -------------------------------------------------------------------------
  // Cursor particles — sparks trail the mouse, ambient embers drift and get
  // pushed away by the cursor, clicks emit a radial burst.
  // -------------------------------------------------------------------------
  function particles() {
    const cv = $("#particles");
    const ctx = cv.getContext("2d");
    // colours are looked up from `theme` at draw time so palette switches apply instantly;
    // the cursor effect only uses the main colour (c1) and a lighter tint of it
    const SPARK_KEYS = ["c1", "c1", "c1light"];
    let W = 0, H = 0, dpr = 1;
    const sparks = [];
    const embers = [];
    const mouse = { x: -999, y: -999, px: -999, py: -999, active: false };

    function resize() {
      dpr = Math.min(devicePixelRatio || 1, 2);
      W = innerWidth; H = innerHeight;
      cv.width = W * dpr; cv.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const target = Math.round((W * H) / 24000);
      while (embers.length < target) embers.push(makeEmber(true));
      embers.length = target;
    }

    function makeEmber(randomY) {
      return {
        x: Math.random() * W,
        y: randomY ? Math.random() * H : H + 10,
        vx: (Math.random() - .5) * .2,
        vy: -(.15 + Math.random() * .35),
        r: .6 + Math.random() * 1.6,
        a: .06 + Math.random() * .2,
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
      mouse.x = e.clientX; mouse.y = e.clientY; mouse.active = true;
      if (!fxOn) return;
      const dx = mouse.x - mouse.px, dy = mouse.y - mouse.py;
      const speed = Math.min(Math.hypot(dx, dy), 60);
      if (mouse.px > -999) {
        // roughly one spark every ~24px of travel, so slow moves leave only a faint trail
        const n = Math.floor(speed / 24) + (Math.random() < (speed % 24) / 24 ? 1 : 0);
        for (let i = 0; i < n; i++) {
          const t = i / n;
          spawnSpark(
            mouse.px + dx * t, mouse.py + dy * t,
            dx * .04 + (Math.random() - .5) * 1.2,
            dy * .04 + (Math.random() - .5) * 1.2 - .3,
            30 + Math.random() * 30,
            .8 + Math.random() * 1.4
          );
        }
      }
      mouse.px = mouse.x; mouse.py = mouse.y;
    }, { passive: true });
    document.addEventListener("pointerleave", () => { mouse.active = false; mouse.px = mouse.py = -999; });

    addEventListener("pointerdown", e => {
      if (!fxOn || e.target.closest("a, button, iframe, .modal-panel")) return;
      for (let i = 0; i < 24; i++) {
        const a = (i / 24) * Math.PI * 2 + Math.random() * .2;
        const s = 1.5 + Math.random() * 2.5;
        spawnSpark(e.clientX, e.clientY, Math.cos(a) * s, Math.sin(a) * s, 40 + Math.random() * 30, .8 + Math.random() * 1.6);
      }
    });

    function frame() {
      requestAnimationFrame(frame);
      if (!fxOn || document.hidden) return;
      ctx.clearRect(0, 0, W, H);
      ctx.globalCompositeOperation = "lighter";

      // ambient embers
      for (const p of embers) {
        p.tw += .03;
        if (mouse.active) {
          const dx = p.x - mouse.x, dy = p.y - mouse.y;
          const d2 = dx * dx + dy * dy;
          if (d2 < 140 * 140) {
            const d = Math.sqrt(d2) || 1, f = (1 - d / 140) * .6;
            p.vx += (dx / d) * f; p.vy += (dy / d) * f;
            // faint link to the cursor
            ctx.strokeStyle = `rgba(${theme[p.c]},${(1 - d / 140) * .1})`;
            ctx.lineWidth = .6;
            ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(mouse.x, mouse.y); ctx.stroke();
          }
        }
        p.vx *= .96; p.vy = p.vy * .96 - .012;
        p.x += p.vx; p.y += p.vy;
        if (p.y < -10 || p.x < -20 || p.x > W + 20) Object.assign(p, makeEmber(false));
        const a = p.a * (.6 + .4 * Math.sin(p.tw));
        ctx.fillStyle = `rgba(${theme[p.c]},${a})`;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
      }

      // cursor sparks
      for (let i = sparks.length - 1; i >= 0; i--) {
        const s = sparks[i];
        s.life--;
        if (s.life <= 0) { sparks.splice(i, 1); continue; }
        s.vx *= .95; s.vy = s.vy * .95 + .03;
        s.x += s.vx; s.y += s.vy;
        const k = s.life / s.max;
        const r = s.size * (0.4 + k);
        const g = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, r * 3);
        g.addColorStop(0, `rgba(${theme[s.c]},${k * .35})`);
        g.addColorStop(1, `rgba(${theme[s.c]},0)`);
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(s.x, s.y, r * 3, 0, Math.PI * 2); ctx.fill();
      }

      // soft glow under the cursor
      if (mouse.active) {
        const g = ctx.createRadialGradient(mouse.x, mouse.y, 0, mouse.x, mouse.y, 90);
        g.addColorStop(0, `rgba(${theme.c1},.04)`);
        g.addColorStop(1, `rgba(${theme.c1},0)`);
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(mouse.x, mouse.y, 90, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalCompositeOperation = "source-over";
    }

    addEventListener("resize", resize);
    resize();
    frame();
  }
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

    // Resolution budget: render a capped number of pixels and let CSS upscale.
    // Weaker devices start with a smaller budget, and if frames still run slow
    // the budget drops further (up to twice).
    const lowEnd = (navigator.hardwareConcurrency || 8) <= 4 || (navigator.deviceMemory || 8) <= 4;
    let budget = lowEnd ? 120000 : 260000;
    let scale = 1, downgrades = 0;
    const target = { x: 0, y: 0 }, cur = { x: 0, y: 0 };
    let visible = true;

    function resize() {
      const w = cv.clientWidth, h = cv.clientHeight;
      scale = Math.min(.6, Math.sqrt(budget / Math.max(1, w * h)));
      cv.width = Math.max(1, Math.round(w * scale));
      cv.height = Math.max(1, Math.round(h * scale));
      gl.viewport(0, 0, cv.width, cv.height);
      target.x = cur.x = cv.width * .7; target.y = cur.y = cv.height * .6;
    }
    addEventListener("resize", resize);
    resize();

    addEventListener("pointermove", e => {
      const r = cv.getBoundingClientRect();
      target.x = (e.clientX - r.left) * scale;
      target.y = (r.height - (e.clientY - r.top)) * scale;
    }, { passive: true });

    new IntersectionObserver(([en]) => { visible = en.isIntersecting; }).observe(cv);

    const start = performance.now();
    let last = start, slowFrames = 0, sampled = 0;
    (function loop(now) {
      requestAnimationFrame(loop);
      const dt = now - last; last = now;
      if (!visible || document.hidden) return;
      if (!fxOn && now - start > 100) return; // keep the first frame as a static backdrop

      // adaptive quality: sample 90 frames, downgrade if most are slower than ~40 fps
      if (downgrades < 2 && dt < 200) {
        sampled++;
        if (dt > 25) slowFrames++;
        if (sampled >= 90) {
          if (slowFrames > 45) { budget *= .5; downgrades++; resize(); }
          sampled = slowFrames = 0;
        }
      }

      cur.x += (target.x - cur.x) * .06; cur.y += (target.y - cur.y) * .06;
      gl.uniform2f(uRes, cv.width, cv.height);
      gl.uniform1f(uTime, reducedMotion ? 0 : ((now - start) / 1000) % 3600);
      gl.uniform2f(uMouse, cur.x, cur.y);
      uCols.forEach((u, k) => { const c = theme.water[k]; gl.uniform3f(u, c[0] / 255, c[1] / 255, c[2] / 255); });
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    })(start);
  }
  heroShader();

  // -------------------------------------------------------------------------
  // Project cards
  // -------------------------------------------------------------------------
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  function cardHTML(p) {
    return `
      <button class="card reveal" type="button" data-slug="${p.slug}" aria-label="Open ${esc(p.title)}">
        <div class="card-media">
          <img src="${p.cover}" alt="" loading="lazy">
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
    card.addEventListener("pointermove", e => {
      const r = card.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
      card.style.transform = `perspective(900px) rotateY(${(x - .5) * 8}deg) rotateX(${(.5 - y) * 8}deg) translateY(-4px)`;
      card.style.setProperty("--mx", x * 100 + "%");
      card.style.setProperty("--my", y * 100 + "%");
    });
    card.addEventListener("pointerleave", () => { card.style.transform = ""; });
  });

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
        thumb = v.poster || `https://i.ytimg.com/vi/${v.id}/hqdefault.jpg`;
        break;
      case "vimeo": src = `https://player.vimeo.com/video/${v.id}?autoplay=1`; break;
      case "adobe": src = `https://www-ccv.adobe.io/v1/player/ccv/${v.id}/embed?api_key=behance1&bgcolor=%23191919&autoplay=true`; break;
      case "file":
        return `<div class="video"><video src="${v.src}" controls playsinline preload="metadata" loop muted${thumb ? ` poster="${thumb}"` : ""}></video></div>`;
      default: return "";
    }
    return `<button class="video video-facade" type="button" data-src="${src}" aria-label="Play video">
      ${thumb ? `<img src="${thumb}" alt="" loading="lazy">` : ""}<span class="play" aria-hidden="true">▶</span></button>`;
  }

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
      ${p.gallery ? `<div class="gallery">${p.gallery.map(src => `<img src="${src}" alt="" loading="lazy">`).join("")}</div>` : ""}
    `;
    modal.hidden = false;
    document.body.style.overflow = "hidden";
    $(".modal-panel").scrollTop = 0;
    $(".modal-close").focus();
  }

  function closeModal() {
    if (modal.hidden) return;
    modal.hidden = true;
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
})();
