// ---------------------------------------------------------------------------
// LOCKED SECTIONS: a minigame panel at the top of a section; its items stay
// locked (blurred, with a padlock and their score goal) until a run reaches
// that goal. Several goals can be reached in one run. "Skip" unlocks all,
// "Re-lock" locks them again. Progress is remembered in the browser.
// Locked content stays in the HTML, so search engines and screen readers
// still get it; it's only visually locked.
//
// Arcade.lockSection({
//   id, anchor, items, names, goals,          // storage key, insert-before element, elements in unlock order, labels, scores
//   title, blurb, keys, touch, bestId, createGame
// })
// ---------------------------------------------------------------------------
(() => {
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  Arcade.lockSection = function (cfg) {
    const { id, anchor, items, names, goals, title, blurb, keys, touch = ["left", "right", "action"], bestId, createGame } = cfg;
    let unlocked = Math.max(0, Math.min(goals.length, Arcade.store.get("unlocked:" + id, 0) | 0));

    // --- padlock badges on the items ---
    items.forEach((el, i) => {
      const badge = document.createElement("span");
      badge.className = "lock-badge";
      badge.setAttribute("aria-hidden", "true");
      badge.innerHTML = `<i class="lock-icon"></i><span>SCORE ${goals[i]}</span>`;
      el.appendChild(badge);
      // a click on a locked item points to the game instead of opening it
      el.addEventListener("click", e => {
        if (!el.classList.contains("locked")) return;
        e.preventDefault(); e.stopImmediatePropagation();
        panel.scrollIntoView({ behavior: "smooth", block: "center" });
        panel.classList.remove("flash"); void panel.offsetWidth; panel.classList.add("flash");
      }, true);
    });

    // --- the panel ---
    const panel = document.createElement("div");
    panel.className = "arcade-panel reveal";
    panel.id = "arcade-" + id;
    panel.innerHTML = `
      <button class="arcade-thumb" type="button" data-act="play" aria-label="Play ${esc(title)}">
        <canvas width="${Arcade.W}" height="${Arcade.H}"></canvas><span class="arcade-thumb-play" aria-hidden="true">▶</span>
      </button>
      <div class="arcade-panel-body">
        <p class="arcade-tag">Minigame · unlock ${items.length} ${esc(cfg.itemWord || "items")}</p>
        <h4>${esc(title)}</h4>
        <p class="arcade-blurb">${blurb}</p>
        <p class="arcade-progress"></p>
        <div class="arcade-actions">
          <button class="btn btn-primary" type="button" data-act="play">PLAY</button>
          <button class="btn btn-small" type="button" data-act="skip">Skip and unlock everything (I don't want to have fun today)</button>
        </div>
        <p class="arcade-meta"><span class="key-hint">${keys}</span><button class="relock" type="button" data-act="relock">Re-lock</button></p>
      </div>`;
    anchor.parentNode.insertBefore(panel, anchor);

    function drawThumb() {
      const shot = Arcade.snapshot(createGame());
      const tc = panel.querySelector(".arcade-thumb canvas").getContext("2d");
      tc.imageSmoothingEnabled = false;
      tc.drawImage(shot, 0, 0);
    }
    drawThumb();
    document.addEventListener("palettechange", drawThumb);

    function apply() {
      items.forEach((el, i) => el.classList.toggle("locked", i >= unlocked));
      const best = Arcade.best(bestId);
      const next = unlocked < goals.length ? `Next goal: <strong>${goals[unlocked]}</strong>` : "<strong>All unlocked!</strong>";
      panel.querySelector(".arcade-progress").innerHTML =
        `Unlocked <strong>${unlocked}/${goals.length}</strong> · ${next} · Best: <strong>${best ?? "--"}</strong>`;
      panel.querySelector(".relock").hidden = unlocked === 0;
      panel.querySelector('[data-act="skip"]').hidden = unlocked === goals.length;
    }
    apply();

    function setUnlocked(n) {
      unlocked = n;
      Arcade.store.set("unlocked:" + id, n);
      apply();
    }

    panel.addEventListener("click", e => {
      const act = e.target.closest("[data-act]")?.dataset.act;
      if (act === "play") open();
      else if (act === "skip") { setUnlocked(goals.length); SFX.win(); }
      else if (act === "relock") { setUnlocked(0); SFX.close(); }
    });

    // --- the play overlay ---
    let ov = null, session = null, runScore = 0, runOver = true;   // score of the run in progress

    function goalLine() {
      return unlocked < goals.length
        ? `Next unlock at <strong>${goals[unlocked]}</strong> points · ${unlocked}/${goals.length} unlocked`
        : `Everything's unlocked. Go for a high score!`;
    }

    function toast(msg) {
      const t = document.createElement("div");
      t.className = "unlock-toast";
      t.textContent = msg;
      ov.querySelector(".unlock-toasts").appendChild(t);
      setTimeout(() => t.remove(), 2600);
    }

    function open() {
      ov = document.createElement("div");
      ov.className = "gate arcade-overlay";
      ov.setAttribute("role", "dialog");
      ov.setAttribute("aria-modal", "true");
      ov.setAttribute("aria-label", title);
      ov.innerHTML = `
        <div class="gate-inner">
          <p class="gate-kicker">▶ PLAYER 1</p>
          <h2>${esc(title)}</h2>
          <p class="gate-goal">${goalLine()}</p>
          <div class="arcade-screen"><canvas aria-label="${esc(title)} game"></canvas><div class="unlock-toasts" aria-live="polite"></div></div>
          <div class="arcade-pad" aria-label="Game controls"></div>
          <p class="key-hint">${keys}</p>
          <div class="gate-actions">
            <button class="btn btn-primary" type="button" data-act="again" hidden>PLAY AGAIN</button>
            <button class="btn btn-small" type="button" data-act="exit">Back to portfolio</button>
          </div>
          <p class="gate-best">BEST: ${Arcade.best(bestId) ?? "--"}</p>
        </div>`;
      document.body.appendChild(ov);
      document.body.classList.add("gate-active");
      SFX.music.setTrack("game");

      session = Arcade.mount(ov.querySelector(".arcade-screen"), createGame(), {
        touch, padEl: ov.querySelector(".arcade-pad"),
        onScore(score) {
          runScore = score;
          let gained = false;
          while (unlocked < goals.length && score >= goals[unlocked]) {
            toast(`UNLOCKED: ${names[unlocked]}`);
            unlocked++; gained = true;
          }
          if (gained) { setUnlocked(unlocked); SFX.unlock(); ov.querySelector(".gate-goal").innerHTML = goalLine(); }
        },
        onEnd({ score }) {
          runOver = true;
          const isBest = Arcade.submit(bestId, score);
          ov.querySelector(".gate-best").textContent = `BEST: ${Arcade.best(bestId)}${isBest && score > 0 ? "  · NEW BEST!" : ""}`;
          const again = ov.querySelector('[data-act="again"]');
          again.hidden = false; again.focus();
          apply();
        }
      });
      runScore = 0; runOver = false;
      session.start();

      ov.addEventListener("click", e => {
        const act = e.target.closest("[data-act]")?.dataset.act;
        if (act === "again") { e.target.closest("[data-act]").hidden = true; runScore = 0; runOver = false; session.start(); }
        else if (act === "exit") close();
      });
      ov.addEventListener("keydown", e => { if (e.key === "Escape") close(); });
      ov.tabIndex = -1; ov.focus();
    }

    function close() {
      if (!ov) return;
      if (!runOver && runScore > 0) Arcade.submit(bestId, runScore);   // leaving mid-run still counts
      session.destroy(); session = null;
      SFX.music.setTrack("lofi");
      const o = ov; ov = null;
      o.classList.add("closing");
      setTimeout(() => { o.remove(); if (!document.querySelector(".gate")) document.body.classList.remove("gate-active"); }, 350);
      apply();
      panel.querySelector('[data-act="play"].btn')?.focus({ preventScroll: true });
    }

    return { apply, get unlocked() { return unlocked; } };
  };
})();
