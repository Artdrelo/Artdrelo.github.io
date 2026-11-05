// ---------------------------------------------------------------------------
// SOUND EFFECTS: tiny synthesized chiptune sounds (Web Audio, no audio files):
// square/pulse waves and stepped arpeggios like old console sound chips.
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
  let ctx = null, master = null;

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

  // --- chiptune helpers -----------------------------------------------------
  const note = m => 440 * Math.pow(2, (m - 69) / 12);    // MIDI note -> Hz
  const PENTA = [0, 2, 4, 7, 9, 12, 14];

  // pulse waves (12.5% / 25% duty) like old sound chips, built once
  const waves = {};
  function wave(kind) {
    if (kind !== "pulse12" && kind !== "pulse25") return null;   // built-in shapes (sine, square, triangle)
    if (waves[kind]) return waves[kind];
    const duty = kind === "pulse12" ? .125 : .25, N = 32;
    const re = new Float32Array(N), im = new Float32Array(N);
    for (let n = 1; n < N; n++) im[n] = (2 / (n * Math.PI)) * Math.sin(n * Math.PI * duty);
    return (waves[kind] = ctx.createPeriodicWave(re, im));
  }

  // play a sequence of notes as hard steps (no glides), with an instant attack
  // and a short release: the classic 8-bit envelope
  function chip({ wave: kind = "square", notes, step = .05, vol = .03, delay = 0, vibrato = 0, at = null, gate = 1, out = master }) {
    const t = at != null ? at : ctx.currentTime + delay, end = t + notes.length * step;
    const o = ctx.createOscillator(), g = ctx.createGain();
    const pw = wave(kind);
    if (pw) o.setPeriodicWave(pw); else o.type = kind;
    notes.forEach((f, i) => o.frequency.setValueAtTime(f, t + i * step));
    if (vibrato) {
      const lfo = ctx.createOscillator(), lg = ctx.createGain();
      lfo.frequency.value = vibrato; lg.gain.value = notes[notes.length - 1] * .015;
      lfo.connect(lg).connect(o.frequency);
      lfo.start(t); lfo.stop(end + .05);
    }
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + .003);
    const off = t + (end - t) * gate;
    g.gain.setValueAtTime(vol, off - .012);
    g.gain.linearRampToValueAtTime(0, off);
    o.connect(g).connect(out);
    o.start(t); o.stop(end + .02);
  }

  // short burst of "8-bit" noise (sample-and-hold, so it sounds crunchy)
  let crunchBuf = null;
  function crunch({ dur = .15, vol = .03, delay = 0, at = null, out = master }) {
    if (!crunchBuf) {
      crunchBuf = ctx.createBuffer(1, ctx.sampleRate * .4, ctx.sampleRate);
      const d = crunchBuf.getChannelData(0);
      let v = 0;
      for (let i = 0; i < d.length; i++) { if (i % 24 === 0) v = Math.random() * 2 - 1; d[i] = v; }
    }
    const t = at != null ? at : ctx.currentTime + delay;
    const s = ctx.createBufferSource(), g = ctx.createGain();
    s.buffer = crunchBuf;
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(g).connect(out);
    s.start(t); s.stop(t + dur + .02);
  }

  // --- water helpers ----------------------------------------------------------
  function bubble({ f0, f1, dur, vol, delay = 0 }) {
    const t = ctx.currentTime + delay;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = "sine";
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + .003);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur * 1.6);
    o.connect(g).connect(master);
    o.start(t); o.stop(t + dur * 1.6 + .02);
  }
  let noiseBuf = null;
  function splash({ dur = .2, vol = .025, delay = 0 }) {
    if (!noiseBuf) {
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate * .5, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    const t = ctx.currentTime + delay;
    const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = noiseBuf;
    f.type = "bandpass"; f.Q.value = .8;
    f.frequency.setValueAtTime(3200, t);
    f.frequency.exponentialRampToValueAtTime(900, t + dur);
    g.gain.setValueAtTime(vol, t);
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
    warmup() {
      if ((enabled || level > 0) && init() && ctx.state === "suspended") ctx.resume().then(() => tryStart()).catch(() => {});
    },

    // loading screen: one blip per line, climbing a pentatonic scale
    bootTick(i) { if (ready()) chip({ wave: "pulse25", notes: [note(72 + PENTA[i % PENTA.length])], step: .045, vol: .035 }); },
    // "ready" jingle: quick rising arpeggio that lands on a held note with vibrato
    bootDone() {
      if (!ready()) return;
      chip({ wave: "square", notes: [60, 64, 67, 72, 76].map(note), step: .055, vol: .035 });
      chip({ wave: "square", notes: [note(79)], step: .32, vol: .035, delay: .275, vibrato: 6 });
      chip({ wave: "triangle", notes: [48, 55, 60].map(note), step: .1, vol: .07, delay: .02 });   // bass
    },
    // menu cursor move
    hover() {
      if (!ready()) return;
      const now = performance.now();
      if (now - lastHover < 70) return;
      lastHover = now;
      chip({ wave: "pulse12", notes: [note(93)], step: .022, vol: .014 });
    },
    // menu "confirm": two quick notes up
    click() { if (ready()) chip({ wave: "square", notes: [note(83), note(88)], step: .04, vol: .03 }); },
    toggle(on) { if (ready()) chip({ wave: "pulse25", notes: (on ? [72, 79] : [79, 72]).map(note), step: .05, vol: .03 }); },
    // water drop: a real drop "plop" is a tiny air bubble ringing, i.e. a sine
    // whose pitch shoots upward as it fades. One main plop, two smaller
    // follow-up bubbles at random pitches, and a soft splash of filtered noise.
    water() {
      if (!ready()) return;
      const r = .9 + Math.random() * .25;
      bubble({ f0: 480 * r, f1: 1500 * r, dur: .09, vol: .16 });
      bubble({ f0: 850 * r, f1: 2300 * r, dur: .05, vol: .05, delay: .07 + Math.random() * .03 });
      bubble({ f0: 1250 * r, f1: 3000 * r, dur: .035, vol: .03, delay: .13 + Math.random() * .05 });
      splash({ dur: .2, vol: .025 });
    },
    // photo resolving / pixelating again
    pixel(on) {
      if (!ready()) return;
      const n = on ? [72, 76, 79, 84] : [84, 79, 76, 72];
      chip({ wave: "pulse12", notes: n.map(note), step: .045, vol: .016 });
    },
    // sparkle for click bursts outside the water (kept from the first version)
    sparkle() {
      if (!ready()) return;
      for (let i = 0; i < 3; i++) tone({ f0: 1800 + Math.random() * 1600, dur: .12, vol: .025, delay: i * .035 });
    },
    // power-up arpeggio, random key so repeated switches don't get tiring
    palette() {
      if (!ready()) return;
      const root = 60 + PENTA[(Math.random() * PENTA.length) | 0];
      chip({ wave: "square", notes: [0, 4, 7, 12, 16, 19, 24].map(n => note(root + n)), step: .028, vol: .028 });
    },
    // --- minigame sounds ---
    coin() { if (ready()) chip({ wave: "square", notes: [note(83), note(88)], step: .05, vol: .03 }); },
    hurt() {
      if (!ready()) return;
      chip({ wave: "square", notes: [64, 61, 58, 55].map(note), step: .035, vol: .03 });
      crunch({ dur: .18, vol: .035 });
    },
    gameStart() { if (ready()) chip({ wave: "pulse25", notes: [60, 67, 72, 79].map(note), step: .06, vol: .03 }); },
    win() {
      if (!ready()) return;
      chip({ wave: "square", notes: [72, 76, 79, 84, 79, 84].map(note), step: .08, vol: .035 });
      chip({ wave: "square", notes: [note(88)], step: .5, vol: .035, delay: .48, vibrato: 6 });
      chip({ wave: "triangle", notes: [48, 55, 60, 64].map(note), step: .14, vol: .07 });
    },
    // window open / close: stepped sweeps
    open() { if (ready()) chip({ wave: "pulse25", notes: [60, 64, 67, 71, 74, 79].map(note), step: .02, vol: .03 }); },
    close() { if (ready()) chip({ wave: "pulse25", notes: [79, 74, 71, 67, 64, 60].map(note), step: .018, vol: .025 }); }
  };
  // -------------------------------------------------------------------------
  // BACKGROUND MUSIC: an original "magic fountain" lo-fi chiptune song,
  // synthesized live. Dreamy and bright: harp-like chip arpeggios over sparkly
  // major-7th/9th chords, the odd bell twinkle, a soft triangle bass, a light
  // swung lo-fi beat and vinyl crackle, low-passed so it stays in the background.
  // 16 bars (~2 minutes) in four sections so the loop doesn't feel repetitive:
  //   A  - the main theme       A2 - rolling harp an octave up, more twinkles
  //   B  - new chords, falling harp, half-time beat
  //   A3 - drum-less breakdown, then the beat returns with a fill into the loop
  // Volume: 5 levels from the nav control (0 = off), remembered.
  // Starts after the first click/key (browser rule) and pauses in hidden tabs.
  // -------------------------------------------------------------------------
  const MUSIC_MAX = 0.6;                                   // gain at the top level
  const LEVELS_N = 5, DEFAULT_LEVEL = 3;                   // default = 0.36 gain
  const LOFI_BPM = 35, LOFI_SWING = .18;                   // lo-fi tempo; gentle swing on off-beat 16ths
  const C = {                                              // chords: bass root + voicing (MIDI)
    D:   { bass: 38, notes: [61, 64, 66, 69] },  // Dmaj9   (D  - C# E F# A)
    Bm:  { bass: 47, notes: [62, 66, 69, 73] },  // Bm9     (B  - D F# A C#)
    G:   { bass: 43, notes: [59, 62, 66, 69] },  // Gmaj9   (G  - B D F# A)
    A:   { bass: 45, notes: [61, 64, 66, 71] },  // A6/9    (A  - C# E F# B)
    Fsm: { bass: 42, notes: [57, 61, 64, 66] },  // F#m7    (F# - A C# E F#)
    Em:  { bass: 40, notes: [55, 59, 62, 66] },  // Em9     (E  - G B D F#)
    As:  { bass: 45, notes: [59, 62, 64, 67] }   // A13sus  (A  - B D E G), leads home to D
  };
  // the song: one entry per bar
  const bar = (chord, harp, drums, twinkle, fill = false) => ({ chord: C[chord], harp, drums, twinkle, fill });
  const SONG = [
    bar("D", "cascade", "full", .3),  bar("Bm", "cascade", "full", .3),  bar("G", "cascade", "full", .3),  bar("A", "cascade", "full", .3),
    bar("D", "waves", "full", .45),   bar("Bm", "waves", "full", .45),   bar("G", "waves", "full", .45),   bar("A", "waves", "full", .45, true),
    bar("G", "fall", "half", .25),    bar("Fsm", "fall", "half", .25),   bar("Em", "fall", "half", .25),   bar("As", "fall", "half", .35, true),
    bar("D", "cascade", "none", .5),  bar("Bm", "cascade", "none", .5),  bar("G", "cascade", "full", .3),  bar("A", "cascade", "full", .3, true)
  ];
  // drum patterns per 16th: k = kick, s = soft snare, h = hat, o = soft open hat
  const DRUMS = {
    full: ["k", "", "h", "", "s", "", "h", "", "", "", "k", "h", "s", "", "h", "o"],
    half: ["k", "", "h", "", "", "", "h", "", "s", "", "h", "", "", "", "h", "o"],
    none: ["", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""]
  };
  // harp patterns: [chord tone index, octave] per 16th (null = rest).
  // At most 2 notes per beat, never on neighbouring 16ths, so the arpeggio
  // breathes instead of running non-stop.
  const _ = null;
  const HARP = {
    cascade: [[0,0],_,[2,0],_, [0,1],_,[2,1],_, [0,2],_,[2,1],_, [0,1],_,[2,0],_],
    waves:   [[0,1],_,[2,1],_, [1,1],_,_,_, [2,1],_,[0,2],_, [3,1],_,_,_],
    fall:    [[0,2],_,[2,1],_, [0,1],_,[2,0],_, [0,2],_,[2,1],_, [0,1],_,[2,0],_]
  };

  let level = DEFAULT_LEVEL;
  try {
    const saved = localStorage.getItem("bgm-vol");
    if (saved !== null) level = Math.max(0, Math.min(LEVELS_N, parseInt(saved, 10) || 0));
    else if (localStorage.getItem("bgm") === "off") level = 0;     // older on/off setting
  } catch (e) {}
  const musicGain = () => (level / LEVELS_N) * MUSIC_MAX * (TRACKS[track] ? TRACKS[track].gain : 1);

  let bus = null, busLP = null, playing = false, timer = 0, nextTime = 0, stepIdx = 0, crackleSrc = null;
  let track = "lofi";                                      // "lofi" (page) or "game" (minigames)
  let skipSteps = new Set();                               // harp notes left out of the current bar

  // each bar (phrase) leaves out 1 random harp note: never the bar's first
  // note, so the downbeat stays clear
  function pickSkips(pattern) {
    const playable = [];
    pattern.forEach((p, i) => { if (p && i > 0) playable.push(i); });
    return new Set(playable.length ? [playable[(Math.random() * playable.length) | 0]] : []);
  }

  function makeBus() {
    if (bus) return;
    bus = ctx.createGain();
    bus.gain.value = 0;
    const lp = busLP = ctx.createBiquadFilter();           // per-track top end (warm for lo-fi)
    lp.type = "lowpass"; lp.frequency.value = 2800; lp.Q.value = .4;
    bus.connect(lp).connect(ctx.destination);
  }

  // a soft keys/pad note: slow attack, long release, random detune (tape wobble)
  function softNote({ wave: kind, freq, at, dur, vol, attack = .06, release = .5 }) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    const pw = wave(kind);
    if (pw) o.setPeriodicWave(pw); else o.type = kind;
    o.frequency.value = freq;
    o.detune.value = (Math.random() - .5) * 14;
    g.gain.setValueAtTime(0, at);
    g.gain.linearRampToValueAtTime(vol, at + attack);
    g.gain.setTargetAtTime(0, at + dur, release / 3);
    o.connect(g).connect(bus);
    o.start(at); o.stop(at + dur + release * 2);
  }

  function noiseBuffer() {
    if (!noiseBuf) {
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate * .5, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    return noiseBuf;
  }
  function noiseHit({ at, dur, vol, type = "bandpass", freq = 2000, q = .8 }) {
    const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = noiseBuffer();
    f.type = type; f.frequency.value = freq; f.Q.value = q;
    g.gain.setValueAtTime(vol, at);
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    s.connect(f).connect(g).connect(bus);
    s.start(at, Math.random() * .3); s.stop(at + dur + .02);
  }
  function kick(at) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = "sine";
    o.frequency.setValueAtTime(110, at);
    o.frequency.exponentialRampToValueAtTime(42, at + .14);
    g.gain.setValueAtTime(.32, at);
    g.gain.exponentialRampToValueAtTime(0.0001, at + .32);
    o.connect(g).connect(bus);
    o.start(at); o.stop(at + .34);
  }

  // looping vinyl crackle: faint hiss plus sparse random pops
  function startCrackle() {
    const len = ctx.sampleRate * 4, buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      d[i] = (Math.random() * 2 - 1) * .012;                          // hiss
      if (Math.random() < .0004) d[i] += (Math.random() < .5 ? -1 : 1) * (.2 + Math.random() * .5);   // pop
    }
    crackleSrc = ctx.createBufferSource();
    crackleSrc.buffer = buf; crackleSrc.loop = true;
    const g = ctx.createGain(); g.gain.value = .2;   // vinyl crackle level
    crackleSrc.connect(g).connect(bus);
    crackleSrc.start();
  }

  function scheduleLofi(i, t, STEP) {
    const b = SONG[Math.floor(i / 16) % SONG.length], s16 = i % 16, chord = b.chord;
    if (s16 % 2) t += STEP * LOFI_SWING;                   // swing the off-beats
    const beat = STEP * 4;

    // soft pad: the chord held under everything, entering slowly on beat 1
    if (s16 === 0) {
      chord.notes.forEach(n => softNote({ wave: "triangle", freq: note(n), at: t, dur: beat * 3.6, vol: .024, attack: .3, release: 1 }));
    }
    // harp: plucked chip notes following this bar's pattern
    if (s16 === 0) skipSteps = pickSkips(HARP[b.harp]);
    const hp = HARP[b.harp][s16];
    if (hp && !skipSteps.has(s16)) {
      const h = chord.notes[hp[0]] + 12 * hp[1];
      const long = b.harp === "waves";                     // the rolling pattern rings longer
      softNote({ wave: "pulse25", freq: note(h), at: t, dur: STEP * (long ? 1 : .5), vol: .02, attack: .004, release: long ? .7 : .45 });
      softNote({ wave: "triangle", freq: note(h), at: t, dur: STEP * (long ? 1.2 : .6), vol: .03, attack: .004, release: long ? .9 : .6 });
    }

    // bass: root on 1, fifth on 3, a passing note before the next section
    if (s16 === 0) softNote({ wave: "triangle", freq: note(chord.bass), at: t, dur: beat * 1.7, vol: .1, attack: .01, release: .3 });
    if (s16 === 8 && b.drums !== "half") softNote({ wave: "triangle", freq: note(chord.bass + 7), at: t, dur: beat * 1.4, vol: .075, attack: .01, release: .25 });
    if (s16 === 14 && b.fill) softNote({ wave: "triangle", freq: note(chord.bass + 4), at: t, dur: beat * .45, vol: .06, attack: .01, release: .15 });

    // drums: light and a little loose; fills roll softly into the next section
    const d = DRUMS[b.drums][s16], late = Math.random() * .01;
    if (d === "k") kick(t + late);
    if (d === "s") noiseHit({ at: t + .01 + late, dur: .12, vol: .03, freq: 2200, q: .7 });
    if (b.drums !== "none" && (d === "h" || (s16 % 2 === 0 && Math.random() < .25))) crunch({ dur: .02, vol: .005 + Math.random() * .003, at: t + late, out: bus });
    if (d === "o") noiseHit({ at: t, dur: .2, vol: .007, type: "highpass", freq: 6000 });
    if (b.fill && s16 >= 12) noiseHit({ at: t + late, dur: .07, vol: .012 + (s16 - 12) * .005, freq: 2400, q: .8 });

    // twinkles: the odd high bell note from the chord, like sparkles in the water
    if ((s16 === 3 || s16 === 9 || s16 === 13) && Math.random() < b.twinkle) {
      const n = chord.notes[(Math.random() * chord.notes.length) | 0] + 24;
      softNote({ wave: "triangle", freq: note(n), at: t, dur: .05, vol: .022, attack: .003, release: .8 });
      softNote({ wave: "sine", freq: note(n) * 2.01, at: t, dur: .03, vol: .006, attack: .003, release: .5 });   // bell overtone
    }
  }


  // -------------------------------------------------------------------------
  // GAME MUSIC: an original upbeat chiptune loop for the minigames.
  // 8 bars (C - Am - F - G, twice with a varied lead), 132 BPM: bouncy octave
  // bass, quiet 16th arpeggio, square-wave lead and a punchy little beat.
  // -------------------------------------------------------------------------
  const GAME_BPM = 132;
  const GC = {
    C:  { bass: 36, arp: [60, 64, 67] },
    Am: { bass: 45, arp: [57, 60, 64] },
    F:  { bass: 41, arp: [57, 60, 65] },
    G:  { bass: 43, arp: [59, 62, 67] }
  };
  const GAME_BARS = ["C", "Am", "F", "G", "C", "Am", "F", "G"];
  const GAME_LEAD = [                                      // one 8th note per entry (_ = rest)
    [72, 76, 79, 76, 84, _, 79, _], [81, _, 79, 76, 72, _, 74, 76],
    [77, _, 76, 74, 72, _, 69, 72], [74, _, _, 71, 67, _, _, _],
    [72, 76, 79, 84, _, 83, 84, _], [88, _, 86, 84, 81, _, 79, _],
    [77, 79, 81, _, 84, _, 81, 79], [79, _, 77, _, 74, _, 71, _]
  ];

  function scheduleGame(i, t, STEP) {
    const bi = Math.floor(i / 16) % GAME_BARS.length, s16 = i % 16, chord = GC[GAME_BARS[bi]];
    // arpeggio: every 16th, quiet
    const a = chord.arp[[0, 1, 2, 1][s16 % 4]] + 12;
    chip({ wave: "pulse12", notes: [note(a)], step: STEP, gate: .5, vol: .01, at: t, out: bus });
    if (s16 % 2 === 0) {
      const e = s16 / 2;
      // bass: root / octave bounce on 8ths
      chip({ wave: "triangle", notes: [note(chord.bass + (e % 2 ? 12 : 0))], step: STEP * 2, gate: .7, vol: .09, at: t, out: bus });
      // lead
      const m = GAME_LEAD[bi][e];
      if (m !== _) {
        const long = GAME_LEAD[bi][e + 1] === _;
        chip({ wave: "pulse25", notes: [note(m)], step: STEP * (long ? 4 : 2), gate: .85, vol: .022, at: t, out: bus, vibrato: long ? 6 : 0 });
      }
    }
    // drums
    if (s16 === 0 || s16 === 8 || (s16 === 14 && bi % 2)) kick(t);
    if (s16 === 4 || s16 === 12) noiseHit({ at: t, dur: .1, vol: .035, freq: 2600, q: .7 });
    if (s16 % 4 === 2) crunch({ dur: .025, vol: .008, at: t, out: bus });
  }

  const TRACKS = {
    lofi: { bpm: LOFI_BPM, steps: 16 * SONG.length, schedule: scheduleLofi, crackle: true, lp: 2800, gain: 1, fadeIn: 3 },
    game: { bpm: GAME_BPM, steps: 16 * GAME_BARS.length, schedule: scheduleGame, crackle: false, lp: 5200, gain: .85, fadeIn: .6 }
  };

  function tick() {
    // schedule a little ahead so timing stays tight even if the page is busy
    const tr = TRACKS[track], STEP = 60 / tr.bpm / 4;
    while (nextTime < ctx.currentTime + .25) {
      tr.schedule(stepIdx, nextTime, STEP);
      nextTime += STEP;
      stepIdx = (stepIdx + 1) % tr.steps;
    }
  }

  function startMusic() {
    if (playing || level === 0 || !ctx || ctx.state !== "running" || document.hidden) return;
    makeBus();
    playing = true;
    stepIdx = 0;
    nextTime = ctx.currentTime + .1;
    const tr = TRACKS[track];
    busLP.frequency.setValueAtTime(tr.lp, ctx.currentTime);
    bus.gain.cancelScheduledValues(ctx.currentTime);
    bus.gain.setValueAtTime(bus.gain.value, ctx.currentTime);
    bus.gain.linearRampToValueAtTime(musicGain(), ctx.currentTime + tr.fadeIn);   // fade in
    if (tr.crackle) startCrackle();
    tick();
    timer = setInterval(tick, 50);
  }
  function stopMusic(fade = .4) {
    if (!playing) return;
    playing = false;
    clearInterval(timer);
    bus.gain.cancelScheduledValues(ctx.currentTime);
    bus.gain.setValueAtTime(bus.gain.value, ctx.currentTime);
    bus.gain.linearRampToValueAtTime(0, ctx.currentTime + fade);
    if (crackleSrc) { crackleSrc.stop(ctx.currentTime + fade + .05); crackleSrc = null; }
  }

  // start as soon as audio is allowed; pause while the tab is hidden
  const tryStart = () => { if (ctx) { ctx.onstatechange = tryStart; startMusic(); } };
  addEventListener("pointerdown", () => setTimeout(tryStart, 50), { passive: true });
  addEventListener("keydown", () => setTimeout(tryStart, 50));
  document.addEventListener("visibilitychange", () => document.hidden ? stopMusic(.2) : tryStart());

  let lastLevel = level || DEFAULT_LEVEL;                  // restored when un-muting
  api.music = {
    LEVELS: LEVELS_N,
    get level() { return level; },
    get enabled() { return level > 0; },
    setLevel(n) {
      level = Math.max(0, Math.min(LEVELS_N, n | 0));
      if (level) lastLevel = level;
      try { localStorage.setItem("bgm-vol", String(level)); } catch (e) {}
      if (!level) { stopMusic(); return; }
      if (playing) {                                       // smooth change while playing
        bus.gain.cancelScheduledValues(ctx.currentTime);
        bus.gain.setValueAtTime(bus.gain.value, ctx.currentTime);
        bus.gain.linearRampToValueAtTime(musicGain(), ctx.currentTime + .15);
      } else { init(); unlock(); setTimeout(tryStart, 50); }
    },
    toggleMute() { this.setLevel(level ? 0 : lastLevel); },
    get track() { return track; },
    // switch between "lofi" (page) and "game" (minigames) with a short crossfade
    setTrack(name) {
      if (name === track || !TRACKS[name]) return;
      const wasPlaying = playing;
      if (wasPlaying) stopMusic(.25);
      track = name;
      if (wasPlaying) setTimeout(tryStart, 300); else setTimeout(tryStart, 50);
    },
    tryStart
  };

  return api;
})();
