/* ========================================================
   SITE NAV GLUE (multi-page split)
   --------------------------------------------------------
   Loaded on every page, after script.js/save.js/saves.js/
   leaderboard.js. It never modifies those files or their
   behavior — it only:
     1) makes the "← back to rating" style controls perform a
        real page navigation back to index.html instead of an
        in-page view switch (each feature page ships the full
        markup, so the in-page switch would still work, this
        just makes the URL match what's on screen),
     2) highlights the current page in the .site-nav bar,
     3) focuses the right input on load for whichever feature
        page this is,
     4) on leaderboard.html, auto-opens the existing leaderboard
        overlay once auth.js/leaderboard.js confirm it's available
        (same trigger the 🏆 toggle button already uses).
   If any expected element is missing, everything here just
   quietly does nothing for that piece — same "fail quietly"
   philosophy as auth.js/save.js/saves.js/leaderboard.js.
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

  // Controls whose original job is "leave this feature, go back to
  // the Rate homepage". On every feature page these still work in
  // place (the full view-home markup is right there in the page),
  // but a real navigation to index.html is the cleaner result.
  var HOME_IDS = ["go-home", "champ-go-home", "gc-go-home", "gc-poster-go-home", "roast-go-home", "tool-rate"];

  var FOCUS_MAP = {
    "compare.html": "cmp-input-1",
    "versus.html": "cmp-input-1",
    "roast.html": "roast-input",
    "hype.html": "gc-name",
    "championship.html": "champ-input-1"
  };

  ready(function () {
    var file = (location.pathname.split("/").pop() || "index.html");

    if (file !== "index.html") {
      HOME_IDS.forEach(function (id) {
        var el = document.getElementById(id);
        if (!el) return;
        el.addEventListener(
          "click",
          function (e) {
            e.preventDefault();
            e.stopImmediatePropagation();
            window.location.href = "index.html";
          },
          true // capture phase — runs before script.js's own bubble-phase handler
        );
      });
    }

    document.querySelectorAll(".site-nav-link").forEach(function (a) {
      var href = (a.getAttribute("href") || "").split("/").pop();
      if (href === file) {
        a.classList.add("is-current");
        a.setAttribute("aria-current", "page");
      }
    });

    if (FOCUS_MAP[file]) {
      window.addEventListener("load", function () {
        var el = document.getElementById(FOCUS_MAP[file]);
        if (el) setTimeout(function () { el.focus(); }, 60);
      });
    }

    if (file === "leaderboard.html") {
      var opened = false;
      function tryOpen() {
        if (opened) return;
        var toggle = document.getElementById("leaderboard-toggle");
        if (toggle && !toggle.hidden) {
          opened = true;
          toggle.click();
        }
      }
      if (window.__RMU_AUTH_STATE__ && window.__RMU_AUTH_STATE__.ready) {
        setTimeout(tryOpen, 30);
      } else {
        window.addEventListener("rmu:auth-ready", function () { setTimeout(tryOpen, 30); });
      }
    }
  });
})();
