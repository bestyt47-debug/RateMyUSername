/* ========================================================
   SAVE + DOWNLOAD GATING (Supabase)
   --------------------------------------------------------
   Self-contained, like auth.js: this file does not modify
   script.js's behavior and script.js does not know this file
   exists. It reuses the auth foundation's client, session and
   modal via window.RMUAuth (exposed by auth.js) instead of
   building a second auth system.

   Scope (per the current spec): Save + Download gating for the
   three result types that have a single persisted result object
   and an existing download action — Rate, Roast, and GameCard.
   Compare/Versus/Championship are untouched.

   If the auth foundation isn't available on this deployment
   (no Supabase config, library failed to load), this file does
   nothing and every button behaves exactly as it did before —
   same "guest-only, fail quietly" philosophy as auth.js.
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
      if (!available || !window.RMUAuth) return; // guest-only deployment — leave every button as-is
      try {
        main(window.RMUAuth);
      } catch (err) {
        console.warn("[save] unexpected error during setup — save/download extras disabled.", err);
      }
    });
  });

  function main(authApi) {
    const sb = authApi.getClient();

    function isLoggedIn() {
      const session = authApi.getSession();
      return !!(session && session.user);
    }

    // ---------- gate the existing download buttons (no change to what they do once allowed) ----------
    function gateDownload(buttonId, promptText) {
      const btn = document.getElementById(buttonId);
      if (!btn) return;
      // Capture phase so this runs before script.js's own click handler on
      // the same button, letting us block the download without touching
      // script.js's listener at all.
      btn.addEventListener("click", function (e) {
        if (!isLoggedIn()) {
          e.preventDefault();
          e.stopImmediatePropagation();
          authApi.openAuthModal(promptText);
        }
      }, true);
    }

    gateDownload("share-download", "create a free account to download your username score card.");
    gateDownload("roast-share-download", "create a free account to download your roast card.");
    gateDownload("gc-edit-save-download", "create a free account to download your gamecard poster.");

    // ---------- saving to saved_results ----------
    async function insertSavedResult(row) {
      const session = authApi.getSession();
      if (!session || !session.user) throw new Error("not signed in");
      const payload = Object.assign({ user_id: session.user.id }, row);
      const { error } = await sb.from("saved_results").insert(payload);
      // 23505 = unique_violation on (user_id, dedupe_key) — this exact
      // result was already saved by this user; treat that as success
      // rather than surfacing an error, so re-clicking Save never fails.
      if (error && error.code !== "23505") throw error;
    }

    function makeButton(id, label, className) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.id = id;
      btn.className = className;
      btn.dataset.idleLabel = label;
      btn.textContent = label;
      return btn;
    }

    // host: element to append the button into
    // getResult(): returns {username, score, result_type, result_data, dedupe_key} or null
    function attachSaveButton(host, id, label, getResult, promptText, className) {
      if (!host || document.getElementById(id)) return;
      const btn = makeButton(id, label, className || "btn btn-outline share");
      host.appendChild(btn);

      let savedKey = null;
      let busy = false;

      btn.addEventListener("click", async function () {
        if (busy) return;

        if (!isLoggedIn()) {
          authApi.openAuthModal(promptText);
          return;
        }

        const result = getResult();
        if (!result) return;

        if (savedKey === result.dedupe_key) {
          btn.disabled = true;
          btn.textContent = "✓ saved";
          return; // already saved this exact result — no duplicate insert
        }

        busy = true;
        btn.disabled = true;
        btn.textContent = "saving…";
        try {
          await insertSavedResult(result);
          savedKey = result.dedupe_key;
          btn.textContent = "✓ saved";
        } catch (err) {
          console.warn("[save] could not save result", err);
          btn.textContent = "save failed — retry";
          btn.disabled = false;
        } finally {
          busy = false;
        }
      });

      return {
        resetToIdle: function () {
          if (busy) return;
          btn.disabled = false;
          btn.textContent = btn.dataset.idleLabel;
        }
      };
    }

    // resets a save button to its idle label whenever the given view
    // section becomes visible again (script.js toggles the `hidden`
    // attribute on view sections; we just watch it, no script.js changes).
    function resetOnViewShown(viewEl, control) {
      if (!viewEl || !control) return;
      const observer = new MutationObserver(function () {
        if (!viewEl.hidden) control.resetToIdle();
      });
      observer.observe(viewEl, { attributes: true, attributeFilter: ["hidden"] });
    }

    // ---------- Rate result ----------
    const resultActions = document.querySelector("#view-result .result-actions");
    const rateSaveControl = attachSaveButton(
      resultActions,
      "rmu-save-result-btn",
      "💾 save result",
      function () {
        const r = window.__RMU_LAST_RESULT__;
        if (!r) return null;
        return {
          username: r.handle,
          score: r.overall,
          result_type: "rate",
          result_data: { categories: r.categories, topCat: r.topCat },
          dedupe_key: "rate:" + r.handle + ":" + r.overall
        };
      },
      "create a free account to save your username score."
    );
    resetOnViewShown(document.getElementById("view-result"), rateSaveControl);

    // ---------- Roast result ----------
    const roastActions = document.querySelector("#view-roast-result .result-actions");
    const roastSaveControl = attachSaveButton(
      roastActions,
      "rmu-save-roast-btn",
      "💾 save roast",
      function () {
        const r = window.__RMU_LAST_ROAST__;
        if (!r) return null;
        return {
          username: r.handle,
          score: null,
          result_type: "roast",
          result_data: { text: r.text, level: r.level },
          dedupe_key: "roast:" + r.handle + ":" + r.text
        };
      },
      "create a free account to save your roast."
    );
    resetOnViewShown(document.getElementById("view-roast-result"), roastSaveControl);

    // ---------- GameCard poster ----------
    const gcActions = document.getElementById("gc-poster-share")
      ? document.getElementById("gc-poster-share").parentElement
      : null;
    attachSaveButton(
      gcActions,
      "rmu-save-gamecard-btn",
      "💾 save gamecard",
      function () {
        const d = window.__RMU_GC_POSTER_DATA__;
        if (!d) return null;
        return {
          username: d.name,
          score: null,
          result_type: "gamecard",
          result_data: { game: d.game, bio: d.bio, style: d.style, nameStyle: d.nameStyle, bioStyle: d.bioStyle },
          dedupe_key: "gamecard:" + d.name + ":" + d.game + ":" + d.bio + ":" + d.style
        };
      },
      "create a free account to save your gamecard.",
      "btn btn-outline gc-poster-btn"
    );
    // GameCard's poster view doesn't hide/show between regenerations the
    // way result/roast do, so it isn't wired to resetOnViewShown — the
    // dedupe key already prevents duplicate rows for an unedited poster,
    // and a genuinely edited poster gets its own dedupe key on next click.
  }
})();
