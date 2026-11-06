// ---------------------------------------------------------------------------
// LOCKED SECTIONS: a minigame panel at the top of a section; its items stay
// locked (blurred, with a padlock and their score goal) until a run reaches
// that goal. Several goals can be reached in one run. "Skip" unlocks all,
// "Re-lock" locks them again. Progress is remembered in the browser.
// Locked content stays in the HTML, so search engines and screen readers
// still get it; it's only visually locked.
//
// While playing: a progress bar at the top of the game screen fills from
// the last goal to the next one, toasts announce each unlock, and unlocking
// the last item pauses the game with a "Back to portfolio / Keep playing"
// popup. Back on the page, newly unlocked items reveal one by one with a sound.
//
// Arcade.lockSection({
//   id, anchor, items, names, goals,          // storage key, insert-before element, elements in unlock order, labels, scores
//   title, blurb, keys, touch, bestId, createGame, itemWord
// })
// ---------------------------------------------------------------------------
(() => {
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  Arcade.lockSection = function (cfg) {
    const { id, anchor, items, names, goals, title, blurb, keys, touch = ["left", "right", "action"], bestId, createGame } = cfg;
    const itemWord = cfg.itemWord || "items";
    let unlocked = Math.max(0, Math.min(goals.length, Arcade.store.get("unlocked:" + id, 0) | 0));
    let shown = unlocked;                    // how many items are visually unlocked on the page

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

    // --- "play to unlock" message over the items while they're all locked ---
    anchor.classList.add("has-lock-hint");
    const hint = document.createElement("button");
    hint.type = "button";
    hint.className = "lock-hint";
    hint.innerHTML = `<i class="lock-icon"></i><span>Play <strong>${esc(title)}</strong> to unlock these ${esc(itemWord)}</span>`;
    hint.addEventListener("click", () => open());
    anchor.appendChild(hint);

    // --- the panel: PLAY sits on the game preview, SKIP next to it ---
    const panel = document.createElement("div");
    panel.className = "arcade-panel reveal";
    panel.id = "arcade-" + id;
    panel.innerHTML = `
      <div class="arcade-thumb">
        <canvas width="${Arcade.W}" height="${Arcade.H}" aria-hidden="true"></canvas>
        <button class="btn btn-primary arcade-big-btn" type="button" data-act="play">▶ PLAY</button>
      </div>
      <div class="arcade-panel-body">
        <p class="arcade-tag">Minigame</p>
        <h4>${esc(title)}</h4>
        <p class="arcade-blurb">${blurb}</p>
        <p class="arcade-progress"></p>
        <div class="arcade-actions">
          <button class="btn arcade-big-btn" type="button" data-act="skip">Skip and unlock everything</button>
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
      items.forEach((el, i) => el.classList.toggle("locked", i >= shown));
      hint.hidden = shown > 0;
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

    // reveal items that are unlocked but still look locked, one by one
    let revealing = false;
    function revealPending(scroll) {
      if (revealing || shown >= unlocked) return;
      revealing = true;
      hint.hidden = true;
      const first = items[shown];
      if (scroll && first) first.scrollIntoView({ behavior: "smooth", block: "center" });
      const step = () => {
        if (shown >= unlocked) { revealing = false; apply(); return; }
        const el = items[shown], i = shown;
        el.classList.add("unlock-anim");
        SFX.unlockBlock(i);
        setTimeout(() => { el.classList.remove("locked"); }, 260);
        setTimeout(() => { el.classList.remove("unlock-anim"); }, 1000);
        shown++;
        setTimeout(step, 380);
      };
      setTimeout(step, scroll ? 650 : 100);
    }

    panel.addEventListener("click", e => {
      const act = e.target.closest("[data-act]")?.dataset.act;
      if (act === "play") open();
      else if (act === "skip") { setUnlocked(goals.length); revealPending(false); }
      else if (act === "relock") { shown = 0; setUnlocked(0); SFX.close(); }
    });
    panel.querySelector(".arcade-thumb canvas").addEventListener("click", () => open());

    // --- the play overlay ---
    let ov = null, session = null, runScore = 0, runOver = true, bar = null, finalShown = false;

    const goalLine = () => unlocked < goals.length
      ? `Next unlock at <strong>${goals[unlocked]}</strong> points`
      : `All prizes unlocked`;

    // the bar fills from the last goal reached to the next one, so it starts
    // empty again after every unlock (e.g. 70 -> 150: 70 points = 0%)
    function updateBar() {
      if (unlocked >= goals.length) { bar.set(1, "All prizes unlocked"); bar.setTag("ALL UNLOCKED"); return; }
      const prev = unlocked > 0 ? goals[unlocked - 1] : 0, next = goals[unlocked];
      bar.set((runScore - prev) / (next - prev), `Progress to next unlock: ${runScore} of ${next} points`);
      bar.setTag("NEXT UNLOCK");
    }

    function toast(msg) {
      const t = document.createElement("div");
      t.className = "unlock-toast";
      t.textContent = msg;
      ov.querySelector(".unlock-toasts").appendChild(t);
      setTimeout(() => t.remove(), 2600);
    }

    // shown once per visit when the last item unlocks: the game pauses
    function finalPopup() {
      finalShown = true;
      session.pause(true);
      const pop = document.createElement("div");
      pop.className = "arcade-popup";
      pop.setAttribute("role", "alertdialog");
      pop.setAttribute("aria-label", "Everything unlocked");
      pop.innerHTML = `
        <p class="arcade-popup-title">ALL ${esc(itemWord.toUpperCase())} UNLOCKED!</p>
        <p>You unlocked everything in this section. Nice run!</p>
        <div class="arcade-popup-actions">
          <button class="btn btn-primary arcade-big-btn" type="button" data-act="exit">Back to portfolio</button>
          <button class="btn arcade-big-btn" type="button" data-act="resume">Keep playing</button>
        </div>`;
      ov.querySelector(".arcade-screen").appendChild(pop);
      SFX.win();
      setTimeout(() => pop.querySelector('[data-act="exit"]').focus(), 50);
    }

    function open() {
      if (ov) return;
      finalShown = unlocked >= goals.length;          // already complete: no popup this time
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
          <div class="arcade-screen">
            <canvas aria-label="${esc(title)} game"></canvas>
            <div class="unlock-toasts" aria-live="polite"></div>
            <button class="btn btn-primary arcade-big-btn arcade-screen-btn" type="button" data-act="again" hidden>▶ PLAY AGAIN</button>
          </div>
          <div class="arcade-pad" aria-label="Game controls"></div>
          <p class="key-hint">${keys}</p>
          <div class="gate-actions">
            <button class="btn arcade-big-btn" type="button" data-act="exit">Back to portfolio</button>
          </div>
          <p class="gate-best">BEST: ${Arcade.best(bestId) ?? "--"}</p>
        </div>`;
      bar = Arcade.progressBar(ov.querySelector(".arcade-screen"), "NEXT UNLOCK");
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
          if (gained) {
            setUnlocked(unlocked); SFX.unlock();
            ov.querySelector(".gate-goal").innerHTML = goalLine();
            if (unlocked >= goals.length && !finalShown) setTimeout(() => { if (ov) finalPopup(); }, 450);
          }
          updateBar();
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
      updateBar();
      session.start();

      ov.addEventListener("click", e => {
        const btn = e.target.closest("[data-act]"), act = btn?.dataset.act;
        if (act === "again") { btn.hidden = true; runScore = 0; runOver = false; updateBar(); session.start(); }
        else if (act === "resume") { btn.closest(".arcade-popup").remove(); session.pause(false); }
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
      setTimeout(() => {
        o.remove();
        if (!document.querySelector(".gate")) document.body.classList.remove("gate-active");
        revealPending(true);                         // show off what this run unlocked
      }, 350);
      apply();
      panel.querySelector('[data-act="play"]')?.focus({ preventScroll: true });
    }

    return { apply, get unlocked() { return unlocked; } };
  };
})();
