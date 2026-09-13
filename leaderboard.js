/* ========================================================
   🏆 GLOBAL LEADERBOARD (Supabase)
   --------------------------------------------------------
   Self-contained, like auth.js/save.js/saves.js: this file does
   not modify script.js's behavior and script.js does not know
   this file exists. It reuses the auth foundation's client +
   session + modal via window.RMUAuth (exposed by auth.js)
   instead of building a second auth system, and it only watches
   script.js's own view-toggling (the `hidden` attribute on
   #view-result) rather than changing anything inside script.js.

   What this file owns:
     - the leaderboard nav button (topbar) + "see leaderboard"
       button on the Rate result + a shortcut in the account panel
     - the leaderboard overlay: locked / loading / error / empty /
       ranked-list states
     - reading + upserting public.leaderboard_entries (see
       supabase_leaderboard.sql) — ONE row per user, created/updated
       ONLY when a logged-in user explicitly clicks the "add to
       global leaderboard" CTA on a result. Checking/rating a
       username never writes a leaderboard row by itself.

   If the auth foundation isn't available on this deployment (no
   Supabase config, library failed to load), this file does
   nothing — same "guest-only, fail quietly" philosophy as the
   rest of the additive auth modules.
   ======================================================== */
(function () {
  "use strict";

  function ready(fn) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", fn);
    } else {
      fn();
    }
  }

  function whenAuthReady(cb) {
    if (window.__RMU_AUTH_STATE__ && window.__RMU_AUTH_STATE__.ready) {
      cb(window.__RMU_AUTH_STATE__.available);
      return;
    }
    window.addEventListener("rmu:auth-ready", function handler(e) {
      window.removeEventListener("rmu:auth-ready", handler);
      cb(e && e.detail ? e.detail.available : false);
    });
  }

  ready(function () {
    whenAuthReady(function (available) {
      if (!available || !window.RMUAuth) return; // guest-only deployment — no leaderboard entry points at all
      try {
        main(window.RMUAuth);
      } catch (err) {
        console.warn("[leaderboard] unexpected error during setup — leaderboard disabled.", err);
      }
    });
  });

  // How many rows we pull per load. This is a small, fun leaderboard, not
  // a hyperscale one — a generous flat limit keeps the query trivial and
  // the client-side sort/rank cheap, while comfortably covering realistic
  // usage. (If this project ever needs true pagination, this is the one
  // spot to change.)
  const FETCH_LIMIT = 1000;

  const LB_EMOJIS = ["😎", "🔥", "✨", "🥶", "🫡", "😏", "🤙", "💀", "🧊", "🦋", "🐐", "👑", "🎯", "🌪️", "🍀", "🚀", "💎", "🌈", "🥷", "🎉"];
  function hashCode(str) {
    let h = 0;
    for (let i = 0; i < str.length; i++) { h = (h * 31 + str.charCodeAt(i)) | 0; }
    return Math.abs(h);
  }
  function emojiFor(name) {
    return LB_EMOJIS[hashCode((name || "").toLowerCase()) % LB_EMOJIS.length];
  }
  function medalFor(rank) {
    if (rank === 1) return "🥇";
    if (rank === 2) return "🥈";
    if (rank === 3) return "🥉";
    return null;
  }

  function cssVar(name, fallback) {
    try {
      const v = getComputedStyle(document.documentElement).getPropertyValue(name);
      return v && v.trim() ? v.trim() : fallback;
    } catch (err) {
      return fallback;
    }
  }
  function colorForScore(score) {
    if (score >= 90) return cssVar("--mint", "#17C989");
    if (score >= 75) return cssVar("--yellow", "#FFCF3F");
    if (score >= 50) return cssVar("--blue", "#2E52FF");
    return cssVar("--red", "#FF4222");
  }

  function main(authApi) {
    const sb = authApi.getClient();

    // ---------- DOM refs ----------
    const leaderboardToggle = document.getElementById("leaderboard-toggle");
    const lbCta = document.getElementById("lb-cta");
    const lbSeeBtn = document.getElementById("lb-see-btn");
    const lbAnnounce = document.getElementById("lb-announce");
    const accountLbBtn = document.getElementById("auth-leaderboard-btn");
    const authOverlay = document.getElementById("auth-overlay");

    const overlay = document.getElementById("leaderboard-overlay");
    const closeX = document.getElementById("lb-close-x");

    const stateLocked = document.getElementById("lb-locked");
    const stateLoading = document.getElementById("lb-loading");
    const stateError = document.getElementById("lb-error");
    const stateEmpty = document.getElementById("lb-empty");
    const stateContent = document.getElementById("lb-content");

    const errorTextEl = document.getElementById("lb-error-text");
    const retryBtn = document.getElementById("lb-retry-btn");
    const lockedSignupBtn = document.getElementById("lb-locked-signup");
    const lockedLoginBtn = document.getElementById("lb-locked-login");

    const noEntryNote = document.getElementById("lb-no-entry-note");
    const yourRankBar = document.getElementById("lb-your-rank-bar");
    const yourRankNum = document.getElementById("lb-your-rank-num");
    const yourRankScore = document.getElementById("lb-your-rank-score");
    const jumpBtn = document.getElementById("lb-jump-btn");
    const listEl = document.getElementById("lb-list");

    // markup not present on this deployment/build — bail safely, same
    // philosophy as auth.js/save.js/saves.js when their own elements
    // are missing.
    if (!overlay || !closeX || !stateLocked || !stateLoading || !stateError || !stateEmpty || !stateContent || !listEl) {
      return;
    }

    // Reveal the entry points now that auth is confirmed available (they
    // ship `hidden` in the markup so guest-only deployments never show a
    // leaderboard that can't work).
    if (leaderboardToggle) leaderboardToggle.hidden = false;
    if (lbCta) lbCta.hidden = false;
    if (lbAnnounce) lbAnnounce.hidden = false;

    function isLoggedIn() {
      const session = authApi.getSession();
      return !!(session && session.user);
    }

    // ---------- state rendering ----------
    function hideAllStates() {
      stateLocked.hidden = true;
      stateLoading.hidden = true;
      stateError.hidden = true;
      stateEmpty.hidden = true;
      stateContent.hidden = true;
    }
    function showLockedState() { hideAllStates(); stateLocked.hidden = false; }
    function showLoadingState() { hideAllStates(); stateLoading.hidden = false; }
    function showErrorState(msg) {
      hideAllStates();
      errorTextEl.textContent = msg || "couldn't load the leaderboard — try again.";
      stateError.hidden = false;
    }
    function showEmptyState() { hideAllStates(); stateEmpty.hidden = false; }
    function showContentState() { hideAllStates(); stateContent.hidden = false; }

    // ---------- overlay open/close ----------
    let pendingReopenAfterAuth = false; // set when the user left this overlay specifically to sign up/log in

    function onKeydown(e) {
      if (e.key === "Escape" && overlay.classList.contains("open")) closeOverlay();
    }
    function openOverlay() {
      overlay.classList.add("open");
      document.addEventListener("keydown", onKeydown);
    }
    function closeOverlay() {
      overlay.classList.remove("open");
      document.removeEventListener("keydown", onKeydown);
    }

    closeX.addEventListener("click", function () { pendingReopenAfterAuth = false; closeOverlay(); });
    overlay.addEventListener("click", function (e) {
      if (e.target === overlay) { pendingReopenAfterAuth = false; closeOverlay(); }
    });
    retryBtn.addEventListener("click", function () { loadLeaderboard(); });

    if (lockedLoginBtn) {
      lockedLoginBtn.addEventListener("click", function () {
        pendingReopenAfterAuth = true;
        closeOverlay(); // let the auth modal take focus instead of sitting underneath this one
        authApi.openAuthModal("log in to see where you rank.");
      });
    }
    if (lockedSignupBtn) {
      lockedSignupBtn.addEventListener("click", function () {
        pendingReopenAfterAuth = true;
        closeOverlay();
        authApi.openAuthModal("create a free account to see where you rank.");
        // openAuthModal always opens in "log in" mode; flip to the sign up
        // form via the auth panel's own existing switch control instead of
        // reaching into auth.js's internals.
        const switchBtn = document.getElementById("auth-switch-btn");
        if (switchBtn) switchBtn.click();
      });
    }

    if (leaderboardToggle) {
      leaderboardToggle.addEventListener("click", function () {
        pendingReopenAfterAuth = false;
        openOverlay();
        loadLeaderboard();
      });
    }
    if (lbAnnounce) {
      lbAnnounce.addEventListener("click", function () {
        pendingReopenAfterAuth = false;
        openOverlay();
        loadLeaderboard();
      });
    }
    if (accountLbBtn) {
      accountLbBtn.addEventListener("click", function () {
        pendingReopenAfterAuth = false;
        if (authOverlay) authOverlay.classList.remove("open");
        openOverlay();
        loadLeaderboard();
      });
    }
    if (lbSeeBtn) {
      lbSeeBtn.addEventListener("click", async function () {
        pendingReopenAfterAuth = false;

        // Logged out: this CTA never creates an entry — just surface the
        // existing locked/auth leaderboard flow so the person can sign up
        // or log in first.
        if (!isLoggedIn()) {
          openOverlay();
          loadLeaderboard();
          return;
        }

        // Logged in: THIS click is the only thing that ever writes a
        // leaderboard row. Upsert the currently-displayed result first,
        // and only open/jump to the leaderboard if that actually worked —
        // never claim something was added when it wasn't.
        lbSeeBtn.disabled = true;
        const added = await upsertFromLastResult();
        lbSeeBtn.disabled = false;
        if (!added) return;

        openOverlay();
        loadLeaderboard({ scrollToSelf: true });
      });
    }

    // logged-in <-> logged-out transitions should resolve automatically:
    //  - if the person left this overlay specifically to sign up/log in,
    //    reopen it the moment a session appears ("unlock automatically")
    //  - otherwise, if the overlay is already open, just refresh it in
    //    place (unlocks if a session appeared, drops back to locked if it
    //    disappeared) without the user having to close/reopen anything
    sb.auth.onAuthStateChange(function (_event, session) {
      if (pendingReopenAfterAuth && session && session.user) {
        pendingReopenAfterAuth = false;
        openOverlay();
        loadLeaderboard();
        return;
      }
      if (overlay.classList.contains("open")) loadLeaderboard();
    });

    // ---------- row rendering ----------
    let ownRowEl = null;

    function renderRow(entry, rank, ownUserId) {
      const row = document.createElement("div");
      row.className = "lb-row";
      const isOwn = entry.user_id === ownUserId;
      if (rank === 1) row.classList.add("lb-row-top1");
      else if (rank === 2) row.classList.add("lb-row-top2");
      else if (rank === 3) row.classList.add("lb-row-top3");
      if (isOwn) row.classList.add("lb-row-you");

      const rankEl = document.createElement("span");
      rankEl.className = "lb-row-rank mono";
      rankEl.textContent = "#" + rank;
      row.appendChild(rankEl);

      const emojiEl = document.createElement("span");
      emojiEl.className = "lb-row-emoji";
      emojiEl.setAttribute("aria-hidden", "true");
      emojiEl.textContent = medalFor(rank) || emojiFor(entry.username);
      row.appendChild(emojiEl);

      const mid = document.createElement("div");
      mid.className = "lb-row-mid";
      const nameEl = document.createElement("p");
      nameEl.className = "lb-row-name mono";
      const nameText = document.createElement("span");
      nameText.textContent = "@" + (entry.username || "unknown");
      nameEl.appendChild(nameText);
      if (isOwn) {
        const youBadge = document.createElement("span");
        youBadge.className = "lb-you-badge";
        youBadge.textContent = "YOU";
        nameEl.appendChild(youBadge);
      }
      mid.appendChild(nameEl);
      row.appendChild(mid);

      const scoreEl = document.createElement("span");
      scoreEl.className = "lb-row-score";
      scoreEl.style.color = colorForScore(entry.score);
      scoreEl.textContent = entry.score + "/100";
      row.appendChild(scoreEl);

      if (isOwn) ownRowEl = row;
      return row;
    }

    function scrollToOwnRow() {
      if (!ownRowEl) return;
      ownRowEl.scrollIntoView({ behavior: "smooth", block: "center" });
      ownRowEl.classList.remove("lb-row-flash");
      void ownRowEl.offsetWidth; // restart animation if already flashed once
      ownRowEl.classList.add("lb-row-flash");
    }
    if (jumpBtn) jumpBtn.addEventListener("click", scrollToOwnRow);

    // ---------- load + render ----------
    let loadToken = 0; // guards against a slow earlier request clobbering a later one
    async function loadLeaderboard(opts) {
      if (!isLoggedIn()) {
        showLockedState();
        return;
      }
      const scrollToSelf = !!(opts && opts.scrollToSelf);
      const myToken = ++loadToken;
      showLoadingState();

      try {
        const session = authApi.getSession();
        const { data, error } = await sb
          .from("leaderboard_entries")
          .select("id, user_id, username, score, updated_at")
          .order("score", { ascending: false })
          .order("updated_at", { ascending: true })
          .order("id", { ascending: true })
          .limit(FETCH_LIMIT);

        if (myToken !== loadToken) return; // a newer load has since started
        if (error) throw error;

        const rows = data || [];
        if (!rows.length) {
          showEmptyState();
          return;
        }

        const ownUserId = session.user.id;
        const ownIndex = rows.findIndex(function (r) { return r.user_id === ownUserId; });

        listEl.innerHTML = "";
        ownRowEl = null;
        rows.forEach(function (entry, i) {
          listEl.appendChild(renderRow(entry, i + 1, ownUserId));
        });

        if (ownIndex === -1) {
          noEntryNote.hidden = false;
          yourRankBar.hidden = true;
        } else {
          noEntryNote.hidden = true;
          yourRankBar.hidden = false;
          yourRankNum.textContent = "#" + (ownIndex + 1);
          yourRankScore.textContent = rows[ownIndex].score + "/100";
        }

        showContentState();

        if (scrollToSelf && ownRowEl) {
          setTimeout(scrollToOwnRow, 60);
        }
      } catch (err) {
        if (myToken !== loadToken) return;
        console.warn("[leaderboard] could not load leaderboard", err);
        const msg = (err && err.message) || "";
        if (msg.toLowerCase().includes("network") || msg.toLowerCase().includes("fetch")) {
          showErrorState("couldn't reach the server — check your connection and try again.");
        } else {
          showErrorState("couldn't load the leaderboard — try again.");
        }
      }
    }

    // ---------- explicit create/update of the caller's leaderboard entry ----------
    // Called ONLY from the "add to global leaderboard" CTA click above —
    // nothing else in this file writes to leaderboard_entries. Reads
    // whatever result is currently on screen (window.__RMU_LAST_RESULT__,
    // set by script.js right before it shows #view-result) so the entry
    // always matches the exact result the person was looking at when they
    // clicked, and upserts on the (user_id) unique key so a user always
    // has exactly one leaderboard row, reflecting whichever result they
    // chose to add. Returns true only if the write actually succeeded.
    async function upsertFromLastResult() {
      if (!isLoggedIn()) return false;
      const r = window.__RMU_LAST_RESULT__;
      if (!r || typeof r.overall !== "number" || !r.handle) return false;

      const session = authApi.getSession();
      try {
        const { error } = await sb.from("leaderboard_entries").upsert({
          user_id: session.user.id,
          username: r.handle,
          score: r.overall,
          updated_at: new Date().toISOString()
        }, { onConflict: "user_id" });
        if (error) throw error;
        return true;
      } catch (err) {
        console.warn("[leaderboard] could not update leaderboard entry", err);
        return false;
      }
    }
  }
})();
