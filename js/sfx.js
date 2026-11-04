// ---------------------------------------------------------------------------
// SOUND EFFECTS: tiny synthesized sounds (Web Audio, no audio files).
// Kept short and quiet on purpose. Toggle with the "SFX" button in the nav;
// the choice is remembered. Tweak the overall loudness with MASTER_VOLUME.
//
// Browsers only allow audio after the visitor has clicked or pressed a key, so
// the loading-screen sounds play only when the browser already trusts the
// site (e.g. on a return visit); everything else works after the first click.
// ---------------------------------------------------------------------------
window.SFX = (() => {
  const MASTER_VOLUME = 0.5;
  let enabled = true;
  try { enabled = localStorage.getItem("sfx") !== "off"; } catch (e) {}

  const AC = window.AudioContext || window.webkitAudioContext;
  let ctx = null, master = null, noiseBuf = null;

  function init() {
    if (ctx || !AC) return ctx;
    try {
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = MASTER_VOLUME;
      // gentle low-pass on everything so nothing is harsh
      const lp = ctx.createBiquadFilter();
      lp.type = "lowpass"; lp.frequency.value = 7000;
      master.connect(lp).connect(ctx.destination);
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate * .5, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    } catch (e) { ctx = null; }
    return ctx;
  }
  const unlock = () => { if (init() && ctx.state === "suspended") ctx.resume(); };
  addEventListener("pointerdown", unlock, { capture: true, passive: true });
  addEventListener("keydown", unlock, { capture: true });

  const ready = () => enabled && ctx && ctx.state === "running";

  // one enveloped oscillator: freq can glide from f0 to f1
  function tone({ type = "sine", f0, f1 = f0, dur = .08, vol = .1, delay = 0, attack = .004 }) {
    const t = ctx.currentTime + delay;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(master);
    o.start(t); o.stop(t + dur + .02);
  }

  // band-passed noise, optionally sweeping (whooshes, splashes)
  function noise({ f0, f1 = f0, q = 1, dur = .2, vol = .05, delay = 0 }) {
    const t = ctx.currentTime + delay;
    const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = noiseBuf;
    f.type = "bandpass"; f.Q.value = q;
    f.frequency.setValueAtTime(f0, t);
    f.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + dur * .3);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f).connect(g).connect(master);
    s.start(t); s.stop(t + dur + .02);
  }

  let lastHover = 0;
  const api = {
    get enabled() { return enabled; },
    setEnabled(on) {
      enabled = on;
      try { localStorage.setItem("sfx", on ? "on" : "off"); } catch (e) {}
    },
    // try to start audio early (for the loading screen); stays silent if the
    // browser hasn't allowed it yet
    warmup() { if (enabled && init() && ctx.state === "suspended") ctx.resume().catch(() => {}); },

    bootTick(i) { if (ready()) tone({ type: "triangle", f0: 880 + i * 90, dur: .05, vol: .05 }); },
    bootDone() {
      if (!ready()) return;
      tone({ f0: 523, dur: .35, vol: .06 });
      tone({ f0: 784, dur: .45, vol: .05, delay: .07 });
      tone({ f0: 1046, dur: .6, vol: .04, delay: .14 });
    },
    hover() {
      if (!ready()) return;
      const now = performance.now();
      if (now - lastHover < 70) return;
      lastHover = now;
      tone({ f0: 2200, f1: 2600, dur: .03, vol: .018 });
    },
    click() { if (ready()) tone({ type: "triangle", f0: 640, f1: 320, dur: .07, vol: .07 }); },
    toggle(on) { if (ready()) tone({ type: "triangle", f0: on ? 500 : 700, f1: on ? 900 : 380, dur: .09, vol: .06 }); },
    // water drop: quick rising "bloop", a smaller echo drop and a soft splash
    water() {
      if (!ready()) return;
      const p = .85 + Math.random() * .3;
      tone({ f0: 380 * p, f1: 1400 * p, dur: .09, vol: .11, attack: .002 });
      tone({ f0: 620 * p, f1: 1900 * p, dur: .06, vol: .04, delay: .11, attack: .002 });
      noise({ f0: 1800, f1: 600, q: .8, dur: .25, vol: .025 });
    },
    // sparkle for click bursts outside the water
    sparkle() {
      if (!ready()) return;
      for (let i = 0; i < 3; i++) tone({ f0: 1800 + Math.random() * 1600, dur: .12, vol: .025, delay: i * .035 });
    },
    palette() {
      if (!ready()) return;
      const base = [392, 494, 587, 659, 784][(Math.random() * 5) | 0];
      [1, 1.25, 1.5].forEach((m, i) => tone({ f0: base * m, dur: .18, vol: .045, delay: i * .05 }));
    },
    open() { if (ready()) noise({ f0: 400, f1: 2400, q: 1.2, dur: .22, vol: .05 }); },
    close() { if (ready()) noise({ f0: 2000, f1: 350, q: 1.2, dur: .18, vol: .04 }); }
  };
  return api;
})();
