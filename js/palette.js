// ---------------------------------------------------------------------------
// COLOUR PALETTES: the palette button in the nav cycles through these.
// Each palette has 5 colours; the first is the main colour (buttons, cursor
// particles). The other four tint the hero water and the section accents,
// so their order doesn't matter: they are sorted by brightness automatically.
// Loaded in <head> so the saved palette is applied before the first paint.
// ---------------------------------------------------------------------------
window.PALETTES = [
  ["#AFFC41", "#3C1642", "#086375", "#1DD3B0", "#B2FF9E"],
  ["#DDDF00", "#007F5F", "#55A630", "#BFD200", "#FFFF3F"],
  ["#ffbe0b", "#fb5607", "#ff006e", "#8338ec", "#3a86ff"],
  ["#1be7ff", "#6eeb83", "#e4ff1a", "#ffb800", "#ff5714"],
  ["#ff00c1", "#9600ff", "#4900ff", "#00b8ff", "#00fff9"],
  ["#ff2f0f", "#ff3f00", "#ff7700", "#fab300", "#fff1a4"]
];

(function () {
  const rgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
  const hex = c => "#" + c.map(v => v.toString(16).padStart(2, "0")).join("");
  const lum = c => (.299 * c[0] + .587 * c[1] + .114 * c[2]) / 255;
  const mixWhite = (c, k) => c.map(v => Math.round(v + (255 - v) * k));
  const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  // lift dark colours until they're readable as text on the dark background
  const readable = c => { let k = 0, o = c; while (lum(o) < .5 && k < 1) { k += .05; o = mixWhite(c, k); } return o; };

  // THEME is read by main.js (particles + hero shader)
  window.THEME = {};

  window.setPalette = function (i) {
    const n = PALETTES.length;
    i = ((i % n) + n) % n;
    const cols = PALETTES[i].map(rgb);
    const main = cols[0];
    const rest = cols.slice(1).sort((a, b) => lum(a) - lum(b));   // darkest → brightest

    // section accents: the three brightest secondary colours, the one most
    // different from the main colour first
    const accents = rest.slice(1).map(readable).sort((a, b) => dist(b, main) - dist(a, main));

    const s = document.documentElement.style;
    cols.forEach((c, k) => s.setProperty("--c" + (k + 1), hex(c)));
    s.setProperty("--c1-rgb", main.join(","));
    s.setProperty("--deep-rgb", rest[0].join(","));
    s.setProperty("--on-accent", lum(main) > .3 ? "#0b0c10" : "#ffffff");
    accents.forEach((c, k) => s.setProperty("--accent-" + (k + 2), hex(c)));

    THEME.index = i;
    THEME.c1 = main;
    THEME.c1light = mixWhite(main, .55);
    THEME.water = rest;                       // [deep, shallow, light, light]
    try { localStorage.setItem("palette", String(i)); } catch (e) {}
    document.dispatchEvent(new CustomEvent("palettechange", { detail: i }));
  };

  let saved = 0;
  try { saved = parseInt(localStorage.getItem("palette"), 10) || 0; } catch (e) {}
  setPalette(saved);
})();
