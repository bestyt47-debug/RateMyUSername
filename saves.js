/* ========================================================
   MY SAVES — VIEW / MANAGE SAVED RESULTS (Supabase)
   --------------------------------------------------------
   Self-contained, like auth.js and save.js: this file does not
   modify script.js's behavior and script.js does not know this
   file exists. It reuses the auth foundation's client + session
   via window.RMUAuth (exposed by auth.js) instead of building a
   second auth system, and reuses the existing overlay/modal
   visual language (.share-overlay/.share-panel) that auth.js
   and the "get og bio" feature already use, rather than the
   view/showView system that lives inside script.js's closure.

   Scope (per the current spec): let a logged-in user see and
   delete the rows they already saved to `saved_results` via
   save.js. RLS ("select own" / "delete own") is the actual
   security boundary — every query below also filters by the
   current session's user id as defense in depth, but the
   database policy is what actually protects the data.

   If the auth foundation isn't available on this deployment (no
   Supabase config, library failed to load), this file does
   nothing — same "guest-only, fail quietly" philosophy as
   auth.js and save.js.
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
      if (!available || !window.RMUAuth) return; // guest-only deployment — nothing to wire up
      try {
        main(window.RMUAuth);
      } catch (err) {
        console.warn("[saves] unexpected error during setup — My Saves disabled.", err);
      }
    });
  });

  function escapeHTML(str) {
    return String(str).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function main(authApi) {
    const sb = authApi.getClient();

    // ---------- DOM refs ----------
    const myBtn = document.getElementById("auth-my-saves-btn");
    const authOverlay = document.getElementById("auth-overlay");

    const overlay = document.getElementById("saves-overlay");
    const closeX = document.getElementById("saves-close-x");

    const stateLoading = document.getElementById("saves-loading");
    const stateError = document.getElementById("saves-error");
    const stateEmpty = document.getElementById("saves-empty");
    const errorTextEl = document.getElementById("saves-error-text");
    const retryBtn = document.getElementById("saves-retry-btn");
    const listEl = document.getElementById("saves-list");

    // markup not present on this deployment/build — bail safely, same
    // philosophy as auth.js/save.js when their own elements are missing.
    if (!myBtn || !overlay || !closeX || !stateLoading || !stateError || !stateEmpty || !errorTextEl || !retryBtn || !listEl) {
      return;
    }

    function isLoggedIn() {
      const session = authApi.getSession();
      return !!(session && session.user);
    }

    // ---------- state rendering ----------
    function hideAllStates() {
      stateLoading.hidden = true;
      stateError.hidden = true;
      stateEmpty.hidden = true;
      listEl.hidden = true;
    }
    function showLoadingState() {
      hideAllStates();
      stateLoading.hidden = false;
    }
    function showErrorState(msg) {
      hideAllStates();
      errorTextEl.textContent = msg || "couldn't load your saves — try again.";
      stateError.hidden = false;
    }
    function showEmptyState() {
      hideAllStates();
      stateEmpty.hidden = false;
    }
    function showListState() {
      hideAllStates();
      listEl.hidden = false;
    }

    // ---------- overlay open/close ----------
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

    closeX.addEventListener("click", closeOverlay);
    overlay.addEventListener("click", function (e) {
      if (e.target === overlay) closeOverlay();
    });
    retryBtn.addEventListener("click", loadSaves);

    myBtn.addEventListener("click", function () {
      if (!isLoggedIn()) return; // button only appears in the signed-in account view anyway
      if (authOverlay) authOverlay.classList.remove("open");
      openOverlay();
      loadSaves();
    });

    // logout (or an expired/invalidated session) while My Saves is open
    // should never leave the user staring at a stale, now-inaccessible
    // list — close the overlay the moment the session goes away.
    sb.auth.onAuthStateChange(function (_event, session) {
      if (!session && overlay.classList.contains("open")) {
        closeOverlay();
      }
    });

    // ---------- formatting helpers ----------
    function formatDate(iso) {
      try {
        const d = new Date(iso);
        if (isNaN(d.getTime())) return "";
        const datePart = d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
        const timePart = d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
        return datePart + " · " + timePart;
      } catch (err) {
        return "";
      }
    }

    function typeLabel(t) {
      if (t === "rate") return "rate";
      if (t === "roast") return "roast";
      if (t === "gamecard") return "gamecard";
      return t || "result";
    }

    // Builds a short, escaped detail line from result_data per type. Only
    // ever reads fields save.js is known to write — never invents data the
    // stored row doesn't actually have.
    function detailText(row) {
      const d = row.result_data || {};
      if (row.result_type === "rate") {
        return d.topCat ? "strongest category: " + escapeHTML(d.topCat) : "";
      }
      if (row.result_type === "roast") {
        return d.text ? escapeHTML(d.text) : "";
      }
      if (row.result_type === "gamecard") {
        const bits = [];
        if (d.game) bits.push(escapeHTML(d.game));
        if (d.bio) bits.push(escapeHTML(d.bio));
        return bits.join(" — ");
      }
      return "";
    }

    // ---------- delete (two-click confirm, no browser dialog) ----------
    let confirmingId = null;
    async function handleDelete(id, card, btn) {
      if (confirmingId !== id) {
        confirmingId = id;
        btn.textContent = "confirm delete?";
        setTimeout(function () {
          if (confirmingId === id) {
            confirmingId = null;
            btn.textContent = "delete";
          }
        }, 3000);
        return;
      }
      confirmingId = null;
      card.classList.add("is-deleting");
      btn.disabled = true;
      btn.textContent = "deleting…";
      try {
        const session = authApi.getSession();
        if (!session || !session.user) throw new Error("not signed in");
        // .eq("user_id", ...) is defense in depth on top of the actual
        // boundary: the "delete own saved_results" RLS policy, which is
        // what actually stops anyone from deleting another user's row.
        const { error } = await sb.from("saved_results").delete().eq("id", id).eq("user_id", session.user.id);
        if (error) throw error;
        card.remove();
        if (!listEl.querySelector(".save-card")) showEmptyState();
      } catch (err) {
        console.warn("[saves] could not delete result", err);
        card.classList.remove("is-deleting");
        btn.disabled = false;
        btn.textContent = "delete failed — retry";
      }
    }

    // ---------- card rendering ----------
    function renderCard(row) {
      const card = document.createElement("div");
      card.className = "save-card";

      const top = document.createElement("div");
      top.className = "save-card-top";

      const handle = document.createElement("p");
      handle.className = "save-card-handle mono";
      handle.textContent = "@" + (row.username || "unknown");
      top.appendChild(handle);

      const meta = document.createElement("div");
      meta.className = "save-card-meta";
      if (typeof row.score === "number") {
        const score = document.createElement("span");
        score.className = "save-card-score";
        score.textContent = row.score + "/100";
        meta.appendChild(score);
      }
      const typeBadge = document.createElement("span");
      typeBadge.className = "save-card-type";
      typeBadge.textContent = typeLabel(row.result_type);
      meta.appendChild(typeBadge);
      top.appendChild(meta);
      card.appendChild(top);

      const date = document.createElement("p");
      date.className = "save-card-date mono";
      date.textContent = formatDate(row.created_at);
      card.appendChild(date);

      const detail = detailText(row);
      let detailEl = null;
      if (detail) {
        detailEl = document.createElement("p");
        detailEl.className = "save-card-detail";
        detailEl.innerHTML = detail; // built via escapeHTML above — safe
        detailEl.hidden = true;
        card.appendChild(detailEl);
      }

      const actions = document.createElement("div");
      actions.className = "save-card-actions";

      if (detailEl) {
        const viewBtn = document.createElement("button");
        viewBtn.type = "button";
        viewBtn.className = "btn btn-outline";
        viewBtn.textContent = "view →";
        viewBtn.addEventListener("click", function () {
          const willShow = detailEl.hidden;
          detailEl.hidden = !willShow;
          viewBtn.textContent = willShow ? "hide" : "view →";
        });
        actions.appendChild(viewBtn);
      }

      // Download intentionally isn't offered here: the existing download
      // buttons (share-download / roast-share-download / gc-edit-save-download)
      // work by snapshotting the live, fully-rendered result screen with
      // html2canvas — saved_results only stores the underlying data
      // (categories, roast text, gamecard bio/style), not that rendered
      // screen, so there's nothing here to feed a download button without
      // rebuilding a whole result view. Per the spec, showing the saved
      // info + delete is what the data actually supports.

      const delBtn = document.createElement("button");
      delBtn.type = "button";
      delBtn.className = "btn btn-outline save-card-delete";
      delBtn.textContent = "delete";
      delBtn.addEventListener("click", function () {
        handleDelete(row.id, card, delBtn);
      });
      actions.appendChild(delBtn);

      card.appendChild(actions);
      return card;
    }

    // ---------- load ----------
    async function loadSaves() {
      if (!isLoggedIn()) {
        showErrorState("you need to be logged in to see your saves.");
        return;
      }
      showLoadingState();
      try {
        const session = authApi.getSession();
        // .eq("user_id", ...) here is belt-and-braces: the actual security
        // boundary is the "select own saved_results" RLS policy on the
        // table, which only ever returns rows where auth.uid() = user_id
        // regardless of what this query asks for.
        const { data, error } = await sb
          .from("saved_results")
          .select("id, username, score, result_type, result_data, created_at")
          .eq("user_id", session.user.id)
          .order("created_at", { ascending: false });

        if (error) throw error;

        const rows = data || [];
        if (!rows.length) {
          showEmptyState();
          return;
        }
        listEl.innerHTML = "";
        rows.forEach(function (row) {
          listEl.appendChild(renderCard(row));
        });
        showListState();
      } catch (err) {
        console.warn("[saves] could not load saved results", err);
        const msg = (err && err.message) || "";
        if (msg.toLowerCase().includes("network") || msg.toLowerCase().includes("fetch")) {
          showErrorState("couldn't reach the server — check your connection and try again.");
        } else {
          showErrorState("couldn't load your saves — try again.");
        }
      }
    }
  }
})();
