(function(){
  "use strict";

  /* ========================================================
     1. DETERMINISTIC SCORING ENGINE
     ======================================================== */

  function hashCode(str){
    let h = 5381;
    for (let i = 0; i < str.length; i++){
      h = ((h << 5) + h + str.charCodeAt(i)) | 0; // djb2-ish
    }
    return h >>> 0;
  }

  function mulberry32(seed){
    let a = seed >>> 0;
    return function(){
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function clamp(n, lo, hi){ return Math.max(lo, Math.min(hi, n)); }

  function cleanHandle(raw){
    return (raw || "").trim().replace(/^@+/, "");
  }

  function scoreUsername(rawName){
    const name = cleanHandle(rawName);
    if (!name) return null;

    const lower = name.toLowerCase();
    const len = name.length;
    const rand = mulberry32(hashCode(lower));

    let lengthScore;
    if (len <= 2) lengthScore = 22;
    else if (len <= 4) lengthScore = 58;
    else if (len <= 7) lengthScore = 92;
    else if (len <= 12) lengthScore = 96;
    else if (len <= 16) lengthScore = 74;
    else if (len <= 20) lengthScore = 52;
    else lengthScore = 28;

    const digits = (name.match(/\d/g) || []).length;
    const digitRatio = digits / len;
    let numberScore;
    if (digitRatio === 0) numberScore = 82;
    else if (digitRatio <= 0.2) numberScore = 95;
    else if (digitRatio <= 0.4) numberScore = 68;
    else numberScore = 34;
    if (/\d{2,4}$/.test(name) && digits <= 4) numberScore -= 8;
    numberScore = clamp(numberScore, 0, 100);

    const underscores = (name.match(/_/g) || []).length;
    const dots = (name.match(/\./g) || []).length;
    const symTotal = underscores + dots;
    let symbolScore;
    if (symTotal === 0) symbolScore = 84;
    else if (symTotal === 1) symbolScore = 96;
    else if (symTotal === 2) symbolScore = 70;
    else symbolScore = 38;

    let maxRun = 1, run = 1;
    for (let i = 1; i < name.length; i++){
      if (name[i].toLowerCase() === name[i - 1].toLowerCase()) { run++; maxRun = Math.max(maxRun, run); }
      else run = 1;
    }
    let repeatScore;
    if (maxRun <= 2) repeatScore = 94;
    else if (maxRun === 3) repeatScore = 68;
    else if (maxRun === 4) repeatScore = 42;
    else repeatScore = 18;

    const letters = (lower.match(/[a-z]/g) || []).length;
    const vowels = (lower.match(/[aeiou]/g) || []).length;
    const vowelRatio = letters ? vowels / letters : 0;
    let readability;
    if (letters === 0) readability = 30;
    else if (vowelRatio < 0.15) readability = 42;
    else if (vowelRatio > 0.62) readability = 58;
    else readability = 91;

    const distinct = new Set(lower.replace(/[^a-z0-9]/g, "")).size;
    const denom = Math.max(1, letters + digits);
    const uniqueScore = clamp(Math.round((distinct / denom) * 100), 0, 100);

    let flavor = 0;
    if (/420|69|1337|xoxo|uwu/.test(lower)) flavor += 6;
    if (/^[a-z]+\.[a-z]+$/.test(lower)) flavor += 4;
    if (/^(the|its|im|real)[a-z]/.test(lower)) flavor += 3;

    const jitter = () => Math.round((rand() - 0.5) * 10);

    const vibe = clamp(Math.round(readability * 0.45 + lengthScore * 0.25 + flavor * 3 + jitter()), 1, 100);
    const originality = clamp(Math.round(uniqueScore * 0.5 + numberScore * 0.2 + symbolScore * 0.2 + flavor * 2 + jitter()), 1, 100);
    const aura = clamp(Math.round(repeatScore * 0.3 + symbolScore * 0.25 + lengthScore * 0.25 + flavor * 3 + jitter()), 1, 100);
    const memorability = clamp(Math.round(lengthScore * 0.4 + repeatScore * 0.3 + readability * 0.3 + jitter()), 1, 100);

    const overall = clamp(Math.round(vibe * 0.27 + originality * 0.25 + aura * 0.28 + memorability * 0.20), 1, 100);

    const cats = { vibe, originality, aura, memorability };
    const topCat = Object.keys(cats).reduce((a, b) => cats[a] >= cats[b] ? a : b);

    return { handle: name, overall, categories: cats, topCat };
  }

  /* ========================================================
     2. COMMENT & VERDICT POOLS
     ======================================================== */

  const COMMENTS = {
    high: ["nah this is actually tuff.", "bro cooked.", "zero notes. 🔥", "this username has aura.", "okayyy we see you.", "certified fire 🔥", "this ate and left no crumbs.", "main character energy.", "no thoughts, just respect."],
    good: ["lowkey valid.", "yeah, this works.", "kinda tuff ngl.", "solid username.", "respectable. very respectable.", "this passes the vibe check."],
    mid: ["ehhh… it's aight.", "could be worse 💀", "we can fix this.", "mid, respectfully.", "not bad. not great.", "it's giving 'first draft'."],
    low: ["bro… who let you pick this 😭", "yeah we're rebranding.", "delete this respectfully.", "this needs an intervention 💀", "the username is fighting for its life."]
  };

  function bandFor(score){
    if (score >= 90) return "high";
    if (score >= 75) return "good";
    if (score >= 50) return "mid";
    return "low";
  }

  function verdictLabelFor(band){
    return { high: "certified fire 🔥", good: "lowkey valid", mid: "mid, respectfully", low: "needs an intervention" }[band];
  }

  function randomComment(band){
    return COMMENTS[band][Math.floor(Math.random() * COMMENTS[band].length)];
  }

  function verdictSubtext(result){
    const band = bandFor(result.overall);
    const catLine = { vibe: "the vibe is doing work.", originality: "originality is carrying this.", aura: "the aura is unmatched.", memorability: "it sticks in your head." }[result.topCat];
    const bandLine = { high: "borderline unfair.", good: "a genuinely solid pick.", mid: "room to grow.", low: "time for a rebrand era." }[band];
    return `${catLine} ${bandLine}`;
  }

  function cssVar(name, fallback){
    const v = getComputedStyle(document.documentElement).getPropertyValue(name);
    return v && v.trim() ? v.trim() : fallback;
  }
  /* ========================================================
     3. URL ROUTING ENGINE (HANDLES /COMPARE, /GAMECARD, ETC)
     ======================================================== */

  function handleRouting() {
    const path = window.location.pathname.replace(/^\//, '').trim();
    
    // Hide all view screens first
    document.querySelectorAll('.view').forEach(view => {
      view.setAttribute('hidden', 'true');
      view.classList.remove('view-enter');
    });

    // Check which URL path matches the window layout
    if (path === '' || path === 'index.html') {
      const homeView = document.getElementById('view-home');
      if (homeView) { homeView.removeAttribute('hidden'); homeView.classList.add('view-enter'); }
    } else if (path === 'rate') {
      const rateView = document.getElementById('view-rate') || document.getElementById('view-home');
      if (rateView) { rateView.removeAttribute('hidden'); rateView.classList.add('view-enter'); }
    } else if (path === 'compare') {
      const compareView = document.getElementById('view-compare');
      if (compareView) { compareView.removeAttribute('hidden'); compareView.classList.add('view-enter'); }
    } else if (path === 'bio') {
      const bioView = document.getElementById('view-bio');
      if (bioView) { bioView.removeAttribute('hidden'); bioView.classList.add('view-enter'); }
    } else if (path === 'championship') {
      const champView = document.getElementById('view-championship');
      if (champView) { champView.removeAttribute('hidden'); champView.classList.add('view-enter'); }
    } else if (path === 'gamecard') {
      const gamecardView = document.getElementById('view-gamecard');
      if (gamecardView) { gamecardView.removeAttribute('hidden'); gamecardView.classList.add('view-enter'); }
    } else {
      const homeView = document.getElementById('view-home');
      if (homeView) { homeView.removeAttribute('hidden'); homeView.classList.add('view-enter'); }
    }
  }

  /* ========================================================
     4. CLICK LISTENERS & EVENT HANDLERS
     ======================================================== */
  document.addEventListener('DOMContentLoaded', () => {
    
    // Listen for grid card feature clicks
    document.querySelectorAll('.tool-card').forEach(card => {
      card.addEventListener('click', () => {
        const featureName = card.getAttribute('data-feature');
        if (!featureName) return;
        
        history.pushState({ feature: featureName }, '', `/${featureName}`);
        handleRouting();
      });
    });

    // Listen for back buttons to go back home smoothly
    document.querySelectorAll('.back-home-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        history.pushState(null, '', '/');
        handleRouting();
      });
    });

    // Run layout router instantly on page startup
    handleRouting();
  });

  // Track browser forward / back button clicks
  window.addEventListener('popstate', () => {
    handleRouting();
  });

})(); // <--- THIS IS THE EXACT END OF YOUR ENTIRE FILE!
