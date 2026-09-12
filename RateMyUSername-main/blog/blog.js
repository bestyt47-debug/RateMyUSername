(function(){
  "use strict";

  /* ---------- light / dark theme toggle ----------
     Shares the same localStorage key ("rmu-theme") as the
     homepage script.js so the theme choice stays in sync
     across the whole site. */
  var THEME_KEY = "rmu-theme";
  var rootEl = document.documentElement;
  var themeToggle = document.getElementById("theme-toggle");

  function applyTheme(theme){
    rootEl.setAttribute("data-theme", theme);
    if (themeToggle) themeToggle.setAttribute("aria-pressed", theme === "dark" ? "true" : "false");
  }
  function storeTheme(theme){
    try{ localStorage.setItem(THEME_KEY, theme); } catch(e){ /* storage unavailable */ }
  }

  applyTheme(rootEl.getAttribute("data-theme") === "dark" ? "dark" : "light");

  if (themeToggle){
    themeToggle.addEventListener("click", function(){
      var next = rootEl.getAttribute("data-theme") === "dark" ? "light" : "dark";
      applyTheme(next);
      storeTheme(next);
    });
  }

  /* ---------- reading progress bar (article pages only) ---------- */
  var article = document.querySelector(".article-body");
  var progress = document.getElementById("reading-progress");
  if (article && progress){
    var onScroll = function(){
      var start = article.offsetTop;
      var end = article.offsetTop + article.offsetHeight - window.innerHeight;
      var y = window.scrollY;
      var value = end > start ? ((y - start) / (end - start)) * 100 : 0;
      value = Math.min(100, Math.max(0, value));
      progress.style.width = value + "%";
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    onScroll();
  }
})();
