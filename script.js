(function(){
  "use strict";

  /* ========================================================
     DETERMINISTIC SCORING ENGINE
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

  // core deterministic analysis — same name always produces same numbers
  function scoreUsername(rawName){
    const name = cleanHandle(rawName);
    if (!name) return null;

    const lower = name.toLowerCase();
    const len = name.length;
    const rand = mulberry32(hashCode(lower));

    // --- length ---
    let lengthScore;
    if (len <= 2) lengthScore = 22;
    else if (len <= 4) lengthScore = 58;
    else if (len <= 7) lengthScore = 92;
    else if (len <= 12) lengthScore = 96;
    else if (len <= 16) lengthScore = 74;
    else if (len <= 20) lengthScore = 52;
    else lengthScore = 28;

    // --- digits ---
    const digits = (name.match(/\d/g) || []).length;
    const digitRatio = digits / len;
    let numberScore;
    if (digitRatio === 0) numberScore = 82;
    else if (digitRatio <= 0.2) numberScore = 95;
    else if (digitRatio <= 0.4) numberScore = 68;
    else numberScore = 34;
    if (/\d{2,4}$/.test(name) && digits <= 4) numberScore -= 8; // trailing "birth year" pattern, slightly less original
    numberScore = clamp(numberScore, 0, 100);

    // --- underscores & dots ---
    const underscores = (name.match(/_/g) || []).length;
    const dots = (name.match(/\./g) || []).length;
    const symTotal = underscores + dots;
    let symbolScore;
    if (symTotal === 0) symbolScore = 84;
    else if (symTotal === 1) symbolScore = 96;
    else if (symTotal === 2) symbolScore = 70;
    else symbolScore = 38;

    // --- repeated character runs ---
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

    // --- readability via vowel ratio ---
    const letters = (lower.match(/[a-z]/g) || []).length;
    const vowels = (lower.match(/[aeiou]/g) || []).length;
    const vowelRatio = letters ? vowels / letters : 0;
    let readability;
    if (letters === 0) readability = 30;
    else if (vowelRatio < 0.15) readability = 42;
    else if (vowelRatio > 0.62) readability = 58;
    else readability = 91;

    // --- uniqueness / entropy ---
    const distinct = new Set(lower.replace(/[^a-z0-9]/g, "")).size;
    const denom = Math.max(1, letters + digits);
    const uniqueScore = clamp(Math.round((distinct / denom) * 100), 0, 100);

    // --- flavor bonus for iconic internet patterns ---
    let flavor = 0;
    if (/420|69|1337|xoxo|uwu/.test(lower)) flavor += 6;
    if (/^[a-z]+\.[a-z]+$/.test(lower)) flavor += 4; // first.last clean pattern
    if (/^(the|its|im|real)[a-z]/.test(lower)) flavor += 3;

    // seeded jitter, deterministic per-name, keeps categories from feeling formulaic
    const jitter = () => Math.round((rand() - 0.5) * 10);

    const vibe = clamp(Math.round(readability * 0.45 + lengthScore * 0.25 + flavor * 3 + jitter()), 1, 100);
    const originality = clamp(Math.round(uniqueScore * 0.5 + numberScore * 0.2 + symbolScore * 0.2 + flavor * 2 + jitter()), 1, 100);
    const aura = clamp(Math.round(repeatScore * 0.3 + symbolScore * 0.25 + lengthScore * 0.25 + flavor * 3 + jitter()), 1, 100);
    const memorability = clamp(Math.round(lengthScore * 0.4 + repeatScore * 0.3 + readability * 0.3 + jitter()), 1, 100);

    const overall = clamp(Math.round(vibe * 0.27 + originality * 0.25 + aura * 0.28 + memorability * 0.20), 1, 100);

    // dominant trait for verdict copy
    const cats = { vibe, originality, aura, memorability };
    const topCat = Object.keys(cats).reduce((a, b) => cats[a] >= cats[b] ? a : b);

    return {
      handle: name,
      overall,
      categories: cats,
      topCat
    };
  }

  /* ========================================================
     COMMENT BANKS
     ======================================================== */

  const COMMENTS = {
    high: [
      "nah this is actually tuff.", "bro cooked.", "zero notes. 🔥", "this username has aura.",
      "okayyy we see you.", "certified fire 🔥", "this ate and left no crumbs.",
      "the algorithm would push this.", "main character energy.", "this is going in the hall of fame.",
      "no thoughts, just respect.", "you understood the assignment."
    ],
    good: [
      "lowkey valid.", "yeah, this works.", "kinda tuff ngl.", "solid username.",
      "you're onto something.", "respectable. very respectable.", "this passes the vibe check.",
      "not mad at this one.", "a solid B+ energy.", "quietly good, no notes really."
    ],
    mid: [
      "ehhh… it's aight.", "could be worse 💀", "we can fix this.", "mid, respectfully.",
      "not bad. not great.", "it's giving 'first draft'.", "this is a placeholder that stuck.",
      "harmless. forgettable. fine.", "middle of the pack energy."
    ],
    low: [
      "bro… who let you pick this 😭", "yeah we're rebranding.", "delete this respectfully.",
      "this needs an intervention 💀", "the username is fighting for its life.",
      "this was typed with the eyes closed.", "we don't talk about this one.",
      "the keyboard did this, not you. right?", "certified cooked (bad cooked)."
    ]
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
    const pool = COMMENTS[band];
    return pool[Math.floor(Math.random() * pool.length)];
  }

  function verdictSubtext(result){
    const band = bandFor(result.overall);
    const catLine = {
      vibe: "the vibe is doing most of the work here.",
      originality: "originality is really carrying this handle.",
      aura: "the aura is unmatched, ngl.",
      memorability: "it's the kind of name that sticks in your head."
    }[result.topCat];
    const bandLine = {
      high: "borderline unfair to the competition.",
      good: "a genuinely solid pick, no cap.",
      mid: "usable, but there's room to grow.",
      low: "might be time for a rebrand era."
    }[band];
    return `${catLine} ${bandLine}`;
  }

  const COMPARE_LINES = {
    blowout: ["bro got cooked 💀", "that wasn't even fair 😭", "absolute cinema.", "no contest, honestly.", "somebody call it."],
    close: ["close one ngl.", "we need a rematch.", "razor thin margins here.", "this one came down to the wire.", "barely, but a win's a win."],
    tie: ["actual dead heat.", "the simulation broke.", "we're calling this a draw of honor.", "both cooked equally, somehow."]
  };

  function compareLine(diff){
    if (diff === 0) return COMPARE_LINES.tie[Math.floor(Math.random() * COMPARE_LINES.tie.length)];
    if (diff <= 6) return COMPARE_LINES.close[Math.floor(Math.random() * COMPARE_LINES.close.length)];
    return COMPARE_LINES.blowout[Math.floor(Math.random() * COMPARE_LINES.blowout.length)];
  }

  function cssVar(name, fallback){
    const v = getComputedStyle(document.documentElement).getPropertyValue(name);
    return v && v.trim() ? v.trim() : fallback;
  }

  function colorForScore(score){
    if (score >= 90) return cssVar("--mint", "#17C989");
    if (score >= 75) return cssVar("--yellow", "#FFCF3F");
    if (score >= 50) return cssVar("--blue", "#2E52FF");
    return cssVar("--red", "#FF4222");
  }

  /* ========================================================
     DETERMINISTIC AVATAR (identicon-style, generated locally —
     no external images/APIs; same username always renders the same avatar)
     ======================================================== */
  function generateAvatarSVG(name){
    const seed = hashCode((name || "").toLowerCase());
    const rand = mulberry32(seed);

    const hue1 = Math.floor(rand() * 360);
    const hue2 = (hue1 + 35 + Math.floor(rand() * 70)) % 360;
    const bg1 = `hsl(${hue1} 70% 55%)`;
    const bg2 = `hsl(${hue2} 70% 42%)`;
    const gid = "av-" + seed;

    const size = 40, cols = 5, cell = size / cols;
    let cells = "";
    for (let row = 0; row < cols; row++){
      for (let col = 0; col < 3; col++){
        if (rand() > 0.55){
          const y = row * cell;
          const xL = col * cell;
          cells += `<rect x="${xL}" y="${y}" width="${cell}" height="${cell}" rx="1.6" fill="rgba(255,255,255,0.92)"/>`;
          if (col !== 2){
            const xR = (cols - 1 - col) * cell;
            cells += `<rect x="${xR}" y="${y}" width="${cell}" height="${cell}" rx="1.6" fill="rgba(255,255,255,0.92)"/>`;
          }
        }
      }
    }

    return `<svg viewBox="0 0 ${size} ${size}" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">` +
      `<defs><linearGradient id="${gid}" x1="0" y1="0" x2="1" y2="1">` +
      `<stop offset="0" stop-color="${bg1}"/><stop offset="1" stop-color="${bg2}"/>` +
      `</linearGradient></defs>` +
      `<rect width="${size}" height="${size}" fill="url(#${gid})"/>` +
      cells +
      `</svg>`;
  }

  const HANDLE_EMOJIS = ["😎","🔥","✨","🥶","🫡","😏","🤙","💀","🧊","🦋","🐐","👑","🎯","🌪️","🍀","🚀","💎","🌈","🥷","🎉"];
  function emojiForHandle(name){
    const seed = hashCode((name || "").toLowerCase() + "::emoji");
    return HANDLE_EMOJIS[seed % HANDLE_EMOJIS.length];
  }

  function stampTextForScore(score){
    if (score >= 90) return "cert. ✦";
    if (score >= 75) return "valid";
    if (score >= 50) return "review";
    if (score >= 1) return "flagged";
    return "n/a";
  }

  /* ========================================================
     VIEW SWITCHING
     ======================================================== */

  const views = {
    home: document.getElementById("view-home"),
    loading: document.getElementById("view-loading"),
    result: document.getElementById("view-result"),
    compare: document.getElementById("view-compare"),
    versus: document.getElementById("view-versus"),
    championship: document.getElementById("view-championship"),
    championshipResult: document.getElementById("view-championship-result"),
    gamecard: document.getElementById("view-gamecard"),
    gamecardPoster: document.getElementById("view-gamecard-poster")
  };

  const LOADING_LINES = [
    "calculating aura...",
    "analysing popularity...",
    "measuring uniqueness...",
    "checking the vibe...",
    "detecting main character energy...",
    "scanning the username archives...",
    "measuring internet aura...",
    "checking if this @ has potential...",
    "consulting the username council...",
    "running aura diagnostics...",
    "judging the character count...",
    "calculating the rizz-to-cringe ratio...",
    "cross-checking the vibes...",
    "asking the internet...",
    "determining how hard this @ goes..."
  ];

  // shuffled queue so messages don't repeat until the pool is exhausted
  function shuffledQueue(arr){
    const q = arr.slice();
    for (let i = q.length - 1; i > 0; i--){
      const j = Math.floor(Math.random() * (i + 1));
      [q[i], q[j]] = [q[j], q[i]];
    }
    return q;
  }

  /**
   * Runs the "analysis" state: cycles through playful status messages,
   * changing every ~500-800ms, for a minimum of 3 seconds (up to ~4s).
   * This is intentionally NOT tied to any real computation — the actual
   * deterministic score is already known; this is purely an entertaining
   * client-side beat before the reveal.
   */
  function showLoading(then){
    showView("loading");

    const textEl = document.getElementById("loading-text");
    const totalDuration = 3000 + Math.random() * 900; // 3.0s–3.9s, always >= 3s
    const startedAt = performance.now();

    let queue = shuffledQueue(LOADING_LINES);
    let queueIdx = 0;
    let cancelled = false;

    function nextMessage(){
      if (queueIdx >= queue.length){
        queue = shuffledQueue(LOADING_LINES);
        queueIdx = 0;
      }
      return queue[queueIdx++];
    }

    function setMessage(msg){
      textEl.classList.remove("show");
      setTimeout(() => {
        if (cancelled) return;
        textEl.textContent = msg;
        void textEl.offsetWidth;
        textEl.classList.add("show");
      }, 130);
    }

    function tick(){
      if (cancelled) return;
      setMessage(nextMessage());
      const elapsed = performance.now() - startedAt;
      const stepDelay = 500 + Math.random() * 300; // 500–800ms between messages
      if (elapsed + stepDelay < totalDuration){
        setTimeout(tick, stepDelay);
      }
    }

    setMessage(nextMessage());
    setTimeout(tick, 500 + Math.random() * 300);

    setTimeout(() => {
      cancelled = true;
      then();
    }, totalDuration);
  }

  function showView(name){
    Object.entries(views).forEach(([key, el]) => {
      if (key === name){
        el.hidden = false;
        el.classList.remove("view-leaving");
        void el.offsetWidth; // restart animation
        el.classList.add("view-enter");
      } else if (!el.hidden){
        el.classList.add("view-leaving");
        setTimeout(() => { el.hidden = true; el.classList.remove("view-leaving"); }, 260);
      }
    });
  }

  /* ========================================================
     RATE FLOW
     ======================================================== */

  const rateForm = document.getElementById("rate-form");
  const rateInput = document.getElementById("rate-input");
  const rateError = document.getElementById("rate-error");
  let lastResult = null;

  function validateHandle(raw){
    const trimmed = (raw || "").trim();
    const name = cleanHandle(raw);
    if (!name) return "type something first, we can't rate silence.";
    if (/\s/.test(trimmed)) return "usernames don't have spaces, bestie.";
    if (!/[a-z0-9]/i.test(name)) return "we need at least one real character in there.";
    return null;
  }

  rateForm.addEventListener("submit", function(e){
    e.preventDefault();
    const err = validateHandle(rateInput.value);
    if (err){
      rateError.textContent = err;
      rateError.classList.add("show");
      rateInput.focus();
      return;
    }
    rateError.classList.remove("show");
    const result = scoreUsername(rateInput.value);
    showLoading(function(){
      lastResult = result;
      renderResult(result);
      showView("result");
    });
  });

  document.getElementById("rate-another").addEventListener("click", function(){
    rateInput.value = "";
    rateError.classList.remove("show");
    showView("home");
    setTimeout(() => rateInput.focus(), 200);
  });

  function animateCount(el, target, duration){
    const start = performance.now();
    function tick(now){
      const p = clamp((now - start) / duration, 0, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      el.textContent = Math.round(eased * target);
      if (p < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  function renderResult(result){
    const band = bandFor(result.overall);
    document.getElementById("res-handle").textContent = emojiForHandle(result.handle) + " @" + result.handle;
    document.getElementById("res-avatar").innerHTML = generateAvatarSVG(result.handle);
    document.getElementById("res-comment").textContent = "\u201C" + randomComment(band) + "\u201D";
    document.getElementById("res-verdict").textContent = verdictSubtext(result);

    const stub = document.getElementById("result-stub");
    stub.className = "stub band-" + band;
    void stub.offsetWidth; // restart animation on repeat rates

    const scoreEl = document.getElementById("res-score");
    scoreEl.textContent = "0";
    scoreEl.style.color = colorForScore(result.overall);
    animateCount(scoreEl, result.overall, 900);

    const stamp = document.getElementById("stamp");
    stamp.className = "stamp band-" + band;
    stamp.textContent = stampTextForScore(result.overall);
    stamp.style.color = colorForScore(result.overall);

    const catsWrap = document.getElementById("res-cats");
    catsWrap.innerHTML = "";
    Object.entries(result.categories).forEach(([label, val]) => {
      const row = document.createElement("div");
      row.className = "cat-row";
      row.innerHTML = `
        <span class="cat-label">${label}</span>
        <span class="cat-track"><span class="cat-fill" style="background:${colorForScore(val)}"></span></span>
        <span class="cat-val">${val}</span>
      `;
      catsWrap.appendChild(row);
      requestAnimationFrame(() => {
        setTimeout(() => { row.querySelector(".cat-fill").style.width = val + "%"; }, 60);
      });
    });
  }

  /* ========================================================
     COMPARE FLOW
     ======================================================== */

  const goCompareBtn = document.getElementById("go-compare");
  if (goCompareBtn){
    goCompareBtn.addEventListener("click", function(){
      showView("compare");
      setTimeout(() => document.getElementById("cmp-input-1").focus(), 200);
    });
  }
  document.getElementById("go-home").addEventListener("click", function(){ showView("home"); });

  const compareForm = document.getElementById("compare-form");
  const cmpError = document.getElementById("compare-error");

  compareForm.addEventListener("submit", function(e){
    e.preventDefault();
    const raw1 = document.getElementById("cmp-input-1").value;
    const raw2 = document.getElementById("cmp-input-2").value;
    const err1 = validateHandle(raw1);
    const err2 = validateHandle(raw2);
    if (err1 || err2){
      cmpError.textContent = "enter two real usernames to start the fight.";
      cmpError.classList.add("show");
      return;
    }
    const r1 = scoreUsername(raw1);
    const r2 = scoreUsername(raw2);
    if (r1.handle.toLowerCase() === r2.handle.toLowerCase()){
      cmpError.textContent = "that's the same username twice — you can't fight yourself 💀";
      cmpError.classList.add("show");
      return;
    }
    cmpError.classList.remove("show");
    showLoading(function(){
      renderVersus(r1, r2);
      showView("versus");
    });
  });

  document.getElementById("run-it-back").addEventListener("click", function(){
    document.getElementById("cmp-input-1").value = "";
    document.getElementById("cmp-input-2").value = "";
    cmpError.classList.remove("show");
    showView("compare");
    setTimeout(() => document.getElementById("cmp-input-1").focus(), 200);
  });

  function renderVersus(r1, r2){
    document.querySelector("#vcard-1 .v-handle").textContent = emojiForHandle(r1.handle) + " @" + r1.handle;
    document.querySelector("#vcard-2 .v-handle").textContent = emojiForHandle(r2.handle) + " @" + r2.handle;

    const s1 = document.getElementById("v1-score");
    const s2 = document.getElementById("v2-score");
    s1.textContent = "0"; s2.textContent = "0";
    s1.style.color = colorForScore(r1.overall);
    s2.style.color = colorForScore(r2.overall);
    animateCount(s1, r1.overall, 800);
    animateCount(s2, r2.overall, 800);

    const card1 = document.getElementById("vcard-1");
    const card2 = document.getElementById("vcard-2");
    card1.classList.remove("winner"); card2.classList.remove("winner");

    const diff = Math.abs(r1.overall - r2.overall);
    const banner = document.getElementById("win-banner");
    const verdict = document.getElementById("win-verdict");

    let wins1 = 0, wins2 = 0;
    Object.keys(r1.categories).forEach((label) => {
      if (r1.categories[label] > r2.categories[label]) wins1++;
      else if (r2.categories[label] > r1.categories[label]) wins2++;
    });

    if (r1.overall === r2.overall){
      banner.textContent = "🤝 dead even";
    } else if (r1.overall > r2.overall){
      card1.classList.add("winner");
      banner.textContent = "🏆 @" + r1.handle + " wins " + wins1 + "–" + wins2;
    } else {
      card2.classList.add("winner");
      banner.textContent = "🏆 @" + r2.handle + " wins " + wins2 + "–" + wins1;
    }
    verdict.textContent = compareLine(diff);

    const catCompare = document.getElementById("cat-compare");
    catCompare.innerHTML = "";
    Object.keys(r1.categories).forEach((label) => {
      const v1 = r1.categories[label];
      const v2 = r2.categories[label];
      const row = document.createElement("div");
      row.className = "cc-row";
      row.innerHTML = `
        <span style="text-align:right;">${v1}</span>
        <span class="cc-bar"><span class="cc-fill left" style="width:${v1}%; background:${colorForScore(v1)}"></span></span>
        <span class="cc-label">${label}</span>
        <span class="cc-bar"><span class="cc-fill" style="width:${v2}%; background:${colorForScore(v2)}"></span></span>
        <span>${v2}</span>
      `;
      catCompare.appendChild(row);
    });
  }

  /* ========================================================
     ENTER KEY SUPPORT (compare fields submit the compare form)
     ======================================================== */
  ["cmp-input-1", "cmp-input-2"].forEach(id => {
    document.getElementById(id).addEventListener("keydown", function(e){
      if (e.key === "Enter"){ e.preventDefault(); compareForm.requestSubmit(); }
    });
  });

  /* ========================================================
     THE ULTIMATE USERNAME CHAMPIONSHIP 🏆
     (same rating engine + same dramatic reveal style as
     the compare/versus flow above — new copy & entry point only)
     ======================================================== */

  const toolChampionship = document.getElementById("tool-championship");
  if (toolChampionship){
    toolChampionship.addEventListener("click", function(){
      showView("championship");
      setTimeout(() => document.getElementById("champ-input-1").focus(), 200);
    });
  }

  const champGoHome = document.getElementById("champ-go-home");
  if (champGoHome){
    champGoHome.addEventListener("click", function(){ showView("home"); });
  }

  const championshipForm = document.getElementById("championship-form");
  const champError = document.getElementById("championship-error");

  // Battle 2 elements (see below, after renderChampionship, for the flow)
  const champ2Form = document.getElementById("championship-form-2");
  const champ2Error = document.getElementById("championship-error-2");
  const champBattle2Block = document.getElementById("champ-battle2-block");
  const champBattle2ResultBlock = document.getElementById("champ-battle2-result-block");
  let battle2RevealTimer = null;

  // Semifinal elements — contenders are the Battle 1 & Battle 2 winners,
  // captured automatically below (see below, after each battle renders).
  const champSemifinalBlock = document.getElementById("champ-semifinal-block");
  const champSemifinalResultBlock = document.getElementById("champ-semifinal-result-block");
  const startSemifinalBtn = document.getElementById("start-semifinal");
  let semifinalRevealTimer = null;
  let champWinner1 = null; // winning result object from Battle 1
  let champWinner2 = null; // winning result object from Battle 2

  // Final result — reveals once the Semifinal's winner is shown, no
  // user entry needed (the Semifinal champion is THE champion).
  const champFinalBlock = document.getElementById("champ-final-block");
  let finalRevealTimer = null;
  let champFinalWinnerResult = null; // winning result object from the Semifinal

  if (championshipForm){
    championshipForm.addEventListener("submit", function(e){
      e.preventDefault();
      const raw1 = document.getElementById("champ-input-1").value;
      const raw2 = document.getElementById("champ-input-2").value;
      const err1 = validateHandle(raw1);
      const err2 = validateHandle(raw2);
      if (err1 || err2){
        champError.textContent = "enter two real usernames to start the battle.";
        champError.classList.add("show");
        return;
      }
      const r1 = scoreUsername(raw1);
      const r2 = scoreUsername(raw2);
      if (r1.handle.toLowerCase() === r2.handle.toLowerCase()){
        champError.textContent = "that's the same username twice — you can't battle yourself 💀";
        champError.classList.add("show");
        return;
      }
      champError.classList.remove("show");
      showLoading(function(){
        renderChampionship(r1, r2);
        showView("championshipResult");
      });
    });
  }

  const champRunItBack = document.getElementById("champ-run-it-back");
  if (champRunItBack){
    champRunItBack.addEventListener("click", function(){
      document.getElementById("champ-input-1").value = "";
      document.getElementById("champ-input-2").value = "";
      champError.classList.remove("show");
      resetBattle2(); // starting Battle 1 over clears any Battle 2 (and Semifinal) that followed it
      resetSemifinal();
      champWinner1 = null;
      showView("championship");
      setTimeout(() => document.getElementById("champ-input-1").focus(), 200);
    });
  }

  ["champ-input-1", "champ-input-2"].forEach(id => {
    const el = document.getElementById(id);
    if (el){
      el.addEventListener("keydown", function(e){
        if (e.key === "Enter"){ e.preventDefault(); championshipForm.requestSubmit(); }
      });
    }
  });

  function renderChampionship(r1, r2){
    document.querySelector("#champ-vcard-1 .v-handle").textContent = emojiForHandle(r1.handle) + " @" + r1.handle;
    document.querySelector("#champ-vcard-2 .v-handle").textContent = emojiForHandle(r2.handle) + " @" + r2.handle;

    const s1 = document.getElementById("champ-v1-score");
    const s2 = document.getElementById("champ-v2-score");
    s1.textContent = "0"; s2.textContent = "0";
    s1.style.color = colorForScore(r1.overall);
    s2.style.color = colorForScore(r2.overall);
    animateCount(s1, r1.overall, 800);
    animateCount(s2, r2.overall, 800);

    const card1 = document.getElementById("champ-vcard-1");
    const card2 = document.getElementById("champ-vcard-2");
    card1.classList.remove("winner"); card2.classList.remove("winner");

    const diff = Math.abs(r1.overall - r2.overall);
    const banner = document.getElementById("champ-win-banner");
    const verdict = document.getElementById("champ-win-verdict");
    const winnerScoreEl = document.getElementById("champ-winner-score");

    let winner;
    if (r1.overall === r2.overall){
      banner.textContent = "🤝 dead even";
      winner = r1.overall >= r2.overall ? r1 : r2; // deterministic display when tied
    } else if (r1.overall > r2.overall){
      card1.classList.add("winner");
      banner.textContent = "🏆 Winner: @" + r1.handle;
      winner = r1;
    } else {
      card2.classList.add("winner");
      banner.textContent = "🏆 Winner: @" + r2.handle;
      winner = r2;
    }

    winnerScoreEl.textContent = "0";
    winnerScoreEl.style.color = colorForScore(winner.overall);
    animateCount(winnerScoreEl, winner.overall, 900);

    verdict.textContent = compareLine(diff);

    const catCompare = document.getElementById("champ-cat-compare");
    catCompare.innerHTML = "";
    Object.keys(r1.categories).forEach((label) => {
      const v1 = r1.categories[label];
      const v2 = r2.categories[label];
      const row = document.createElement("div");
      row.className = "cc-row";
      row.innerHTML = `
        <span style="text-align:right;">${v1}</span>
        <span class="cc-bar"><span class="cc-fill left" style="width:${v1}%; background:${colorForScore(v1)}"></span></span>
        <span class="cc-label">${label}</span>
        <span class="cc-bar"><span class="cc-fill" style="width:${v2}%; background:${colorForScore(v2)}"></span></span>
        <span>${v2}</span>
      `;
      catCompare.appendChild(row);
    });

    // Battle 1's winner is now revealed — clear out any previous Battle 2
    // (and Semifinal) and, after a beat so the reveal above lands first,
    // show Battle 2's entry section.
    champWinner1 = winner;
    resetBattle2();
    resetSemifinal();
    clearTimeout(battle2RevealTimer);
    battle2RevealTimer = setTimeout(revealBattle2Entry, 1000);
  }

  /* ========================================================
     THE ULTIMATE USERNAME CHAMPIONSHIP — BATTLE 2 ⚔️
     (same rating engine + same versus/reveal markup & styling as
     Battle 1 above — new entry point + result target only)
     ======================================================== */

  function resetBattle2(){
    clearTimeout(battle2RevealTimer);
    if (champ2Form) champ2Form.reset();
    if (champ2Error) champ2Error.classList.remove("show");
    if (champBattle2Block){
      champBattle2Block.hidden = true;
      champBattle2Block.classList.remove("show-battle2");
    }
    if (champBattle2ResultBlock){
      champBattle2ResultBlock.hidden = true;
      champBattle2ResultBlock.classList.remove("show-battle2");
    }
  }

  function revealBattle2Entry(){
    if (!champBattle2Block) return;
    champBattle2Block.hidden = false;
    void champBattle2Block.offsetWidth; // restart animation
    champBattle2Block.classList.add("show-battle2");
  }

  if (champ2Form){
    champ2Form.addEventListener("submit", function(e){
      e.preventDefault();
      const raw1 = document.getElementById("champ2-input-1").value;
      const raw2 = document.getElementById("champ2-input-2").value;
      const err1 = validateHandle(raw1);
      const err2 = validateHandle(raw2);
      if (err1 || err2){
        champ2Error.textContent = "enter two real usernames to start the battle.";
        champ2Error.classList.add("show");
        return;
      }
      const r1 = scoreUsername(raw1);
      const r2 = scoreUsername(raw2);
      if (r1.handle.toLowerCase() === r2.handle.toLowerCase()){
        champ2Error.textContent = "that's the same username twice — you can't battle yourself 💀";
        champ2Error.classList.add("show");
        return;
      }
      champ2Error.classList.remove("show");
      resetSemifinal(); // a re-run of Battle 2 invalidates any Semifinal that followed it
      showLoading(function(){
        renderChampionshipBattle2(r1, r2);
        showView("championshipResult");
        champBattle2ResultBlock.hidden = false;
        void champBattle2ResultBlock.offsetWidth; // restart animation
        champBattle2ResultBlock.classList.add("show-battle2");
        setTimeout(() => {
          champBattle2ResultBlock.scrollIntoView({ behavior: "smooth", block: "start" });
        }, 60);
      });
    });
  }

  const champ2RunItBack = document.getElementById("champ2-run-it-back");
  if (champ2RunItBack){
    champ2RunItBack.addEventListener("click", function(){
      document.getElementById("champ2-input-1").value = "";
      document.getElementById("champ2-input-2").value = "";
      champ2Error.classList.remove("show");
      champBattle2ResultBlock.classList.remove("show-battle2");
      champBattle2ResultBlock.hidden = true;
      resetSemifinal(); // re-entering Battle 2 invalidates any Semifinal that followed it
      revealBattle2Entry();
      setTimeout(() => document.getElementById("champ2-input-1").focus(), 200);
    });
  }

  ["champ2-input-1", "champ2-input-2"].forEach(id => {
    const el = document.getElementById(id);
    if (el){
      el.addEventListener("keydown", function(e){
        if (e.key === "Enter"){ e.preventDefault(); champ2Form.requestSubmit(); }
      });
    }
  });

  function renderChampionshipBattle2(r1, r2){
    document.querySelector("#champ2-vcard-1 .v-handle").textContent = emojiForHandle(r1.handle) + " @" + r1.handle;
    document.querySelector("#champ2-vcard-2 .v-handle").textContent = emojiForHandle(r2.handle) + " @" + r2.handle;

    const s1 = document.getElementById("champ2-v1-score");
    const s2 = document.getElementById("champ2-v2-score");
    s1.textContent = "0"; s2.textContent = "0";
    s1.style.color = colorForScore(r1.overall);
    s2.style.color = colorForScore(r2.overall);
    animateCount(s1, r1.overall, 800);
    animateCount(s2, r2.overall, 800);

    const card1 = document.getElementById("champ2-vcard-1");
    const card2 = document.getElementById("champ2-vcard-2");
    card1.classList.remove("winner"); card2.classList.remove("winner");

    const diff = Math.abs(r1.overall - r2.overall);
    const banner = document.getElementById("champ2-win-banner");
    const verdict = document.getElementById("champ2-win-verdict");
    const winnerScoreEl = document.getElementById("champ2-winner-score");

    let winner;
    if (r1.overall === r2.overall){
      banner.textContent = "🤝 dead even";
      winner = r1.overall >= r2.overall ? r1 : r2; // deterministic display when tied
    } else if (r1.overall > r2.overall){
      card1.classList.add("winner");
      banner.textContent = "🏆 Winner: @" + r1.handle;
      winner = r1;
    } else {
      card2.classList.add("winner");
      banner.textContent = "🏆 Winner: @" + r2.handle;
      winner = r2;
    }

    winnerScoreEl.textContent = "0";
    winnerScoreEl.style.color = colorForScore(winner.overall);
    animateCount(winnerScoreEl, winner.overall, 900);

    verdict.textContent = compareLine(diff);

    const catCompare = document.getElementById("champ2-cat-compare");
    catCompare.innerHTML = "";
    Object.keys(r1.categories).forEach((label) => {
      const v1 = r1.categories[label];
      const v2 = r2.categories[label];
      const row = document.createElement("div");
      row.className = "cc-row";
      row.innerHTML = `
        <span style="text-align:right;">${v1}</span>
        <span class="cc-bar"><span class="cc-fill left" style="width:${v1}%; background:${colorForScore(v1)}"></span></span>
        <span class="cc-label">${label}</span>
        <span class="cc-bar"><span class="cc-fill" style="width:${v2}%; background:${colorForScore(v2)}"></span></span>
        <span>${v2}</span>
      `;
      catCompare.appendChild(row);
    });

    // Battle 2's winner is now revealed — the Semifinal contenders (Battle 1
    // & Battle 2 champions) are both known now, so auto-advance them and,
    // after a beat, reveal the Semifinal entry (no re-typing required).
    champWinner2 = winner;
    resetSemifinal();
    clearTimeout(semifinalRevealTimer);
    semifinalRevealTimer = setTimeout(revealSemifinalEntry, 1000);
  }

  /* ========================================================
     THE ULTIMATE USERNAME CHAMPIONSHIP — SEMIFINAL ⚔️
     (contenders are auto-advanced from Battle 1's & Battle 2's winners —
     no user entry — then given a fresh rating/analysis pass using the
     same rating engine + same versus/reveal markup & styling as the
     battles above.)
     ======================================================== */

  function resetSemifinal(){
    clearTimeout(semifinalRevealTimer);
    if (champSemifinalBlock){
      champSemifinalBlock.hidden = true;
      champSemifinalBlock.classList.remove("show-battle2");
    }
    if (champSemifinalResultBlock){
      champSemifinalResultBlock.hidden = true;
      champSemifinalResultBlock.classList.remove("show-battle2");
    }
    resetFinal(); // redoing the Semifinal invalidates any Final Result that followed it
  }

  function revealSemifinalEntry(){
    if (!champSemifinalBlock || !champWinner1 || !champWinner2) return;
    const p1 = document.getElementById("semi-preview-1");
    const p2 = document.getElementById("semi-preview-2");
    if (p1) p1.textContent = "🏆 " + emojiForHandle(champWinner1.handle) + " @" + champWinner1.handle;
    if (p2) p2.textContent = "🏆 " + emojiForHandle(champWinner2.handle) + " @" + champWinner2.handle;
    champSemifinalBlock.hidden = false;
    void champSemifinalBlock.offsetWidth; // restart animation
    champSemifinalBlock.classList.add("show-battle2");
  }

  if (startSemifinalBtn){
    startSemifinalBtn.addEventListener("click", function(){
      if (!champWinner1 || !champWinner2) return;
      // fresh rating/analysis pass — re-run the scoring engine on the
      // advancing handles rather than reusing the Battle 1 / Battle 2
      // result objects directly.
      const r1 = scoreUsername(champWinner1.handle);
      const r2 = scoreUsername(champWinner2.handle);
      showLoading(function(){
        renderChampionshipSemifinal(r1, r2);
        showView("championshipResult");
        champSemifinalResultBlock.hidden = false;
        void champSemifinalResultBlock.offsetWidth; // restart animation
        champSemifinalResultBlock.classList.add("show-battle2");
        setTimeout(() => {
          champSemifinalResultBlock.scrollIntoView({ behavior: "smooth", block: "start" });
        }, 60);
      });
    });
  }

  const champSemiRunItBack = document.getElementById("champ-semi-run-it-back");
  if (champSemiRunItBack){
    champSemiRunItBack.addEventListener("click", function(){
      champSemifinalResultBlock.classList.remove("show-battle2");
      champSemifinalResultBlock.hidden = true;
      revealSemifinalEntry();
      setTimeout(() => {
        champSemifinalBlock.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 60);
    });
  }

  function renderChampionshipSemifinal(r1, r2){
    document.querySelector("#champ-semi-vcard-1 .v-handle").textContent = emojiForHandle(r1.handle) + " @" + r1.handle;
    document.querySelector("#champ-semi-vcard-2 .v-handle").textContent = emojiForHandle(r2.handle) + " @" + r2.handle;

    const s1 = document.getElementById("champ-semi-v1-score");
    const s2 = document.getElementById("champ-semi-v2-score");
    s1.textContent = "0"; s2.textContent = "0";
    s1.style.color = colorForScore(r1.overall);
    s2.style.color = colorForScore(r2.overall);
    animateCount(s1, r1.overall, 800);
    animateCount(s2, r2.overall, 800);

    const card1 = document.getElementById("champ-semi-vcard-1");
    const card2 = document.getElementById("champ-semi-vcard-2");
    card1.classList.remove("winner"); card2.classList.remove("winner");

    const diff = Math.abs(r1.overall - r2.overall);
    const banner = document.getElementById("champ-semi-win-banner");
    const verdict = document.getElementById("champ-semi-win-verdict");
    const winnerScoreEl = document.getElementById("champ-semi-winner-score");

    let winner;
    if (r1.overall === r2.overall){
      banner.textContent = "🤝 dead even";
      winner = r1.overall >= r2.overall ? r1 : r2; // deterministic display when tied
    } else if (r1.overall > r2.overall){
      card1.classList.add("winner");
      banner.textContent = "🏆 Winner: @" + r1.handle;
      winner = r1;
    } else {
      card2.classList.add("winner");
      banner.textContent = "🏆 Winner: @" + r2.handle;
      winner = r2;
    }

    winnerScoreEl.textContent = "0";
    winnerScoreEl.style.color = colorForScore(winner.overall);
    animateCount(winnerScoreEl, winner.overall, 900);

    verdict.textContent = compareLine(diff);

    const catCompare = document.getElementById("champ-semi-cat-compare");
    catCompare.innerHTML = "";
    Object.keys(r1.categories).forEach((label) => {
      const v1 = r1.categories[label];
      const v2 = r2.categories[label];
      const row = document.createElement("div");
      row.className = "cc-row";
      row.innerHTML = `
        <span style="text-align:right;">${v1}</span>
        <span class="cc-bar"><span class="cc-fill left" style="width:${v1}%; background:${colorForScore(v1)}"></span></span>
        <span class="cc-label">${label}</span>
        <span class="cc-bar"><span class="cc-fill" style="width:${v2}%; background:${colorForScore(v2)}"></span></span>
        <span>${v2}</span>
      `;
      catCompare.appendChild(row);
    });

    // The Semifinal's winner is now revealed — that's THE Ultimate
    // Username Champion. After a beat so the reveal above lands first,
    // show the Final Result.
    resetFinal();
    clearTimeout(finalRevealTimer);
    finalRevealTimer = setTimeout(() => revealChampionshipFinal(winner), 1000);
  }

  /* ========================================================
     THE ULTIMATE USERNAME CHAMPIONSHIP — FINAL RESULT 🏆
     (the Semifinal's winner, no further battles — same reveal timing
     as Battle 2 & Semifinal above, with the category list styled like
     the single Rate My Username result.)
     ======================================================== */

  function resetFinal(){
    clearTimeout(finalRevealTimer);
    champFinalWinnerResult = null;
    if (champFinalBlock){
      champFinalBlock.hidden = true;
      champFinalBlock.classList.remove("show-battle2");
    }
  }

  function renderChampionshipFinal(winner){
    champFinalWinnerResult = winner;
    document.getElementById("champ-final-avatar").innerHTML = generateAvatarSVG(winner.handle);
    document.getElementById("champ-final-handle").textContent = emojiForHandle(winner.handle) + " @" + winner.handle;

    const scoreEl = document.getElementById("champ-final-score");
    scoreEl.textContent = "0";
    scoreEl.style.color = colorForScore(winner.overall);
    animateCount(scoreEl, winner.overall, 900);

    const catsWrap = document.getElementById("champ-final-cats");
    catsWrap.innerHTML = "";
    Object.entries(winner.categories).forEach(([label, val]) => {
      const row = document.createElement("div");
      row.className = "cat-row";
      row.innerHTML = `
        <span class="cat-label">${label}</span>
        <span class="cat-track"><span class="cat-fill" style="background:${colorForScore(val)}"></span></span>
        <span class="cat-val">${val}</span>
      `;
      catsWrap.appendChild(row);
      requestAnimationFrame(() => {
        setTimeout(() => { row.querySelector(".cat-fill").style.width = val + "%"; }, 60);
      });
    });
  }

  function revealChampionshipFinal(winner){
    if (!champFinalBlock || !winner) return;
    renderChampionshipFinal(winner);
    champFinalBlock.hidden = false;
    void champFinalBlock.offsetWidth; // restart animation
    champFinalBlock.classList.add("show-battle2");
    setTimeout(() => {
      champFinalBlock.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 60);
  }

  const champFinalShareBtn = document.getElementById("champ-final-share-btn");
  if (champFinalShareBtn){
    champFinalShareBtn.addEventListener("click", function(){
      if (!champFinalWinnerResult) return;
      openShare(champFinalWinnerResult);
    });
  }

  const champFinalRestartBtn = document.getElementById("champ-final-restart-btn");
  if (champFinalRestartBtn){
    champFinalRestartBtn.addEventListener("click", function(){
      document.getElementById("champ-input-1").value = "";
      document.getElementById("champ-input-2").value = "";
      champError.classList.remove("show");
      resetBattle2();
      resetSemifinal(); // cascades into resetFinal()
      champWinner1 = null;
      champWinner2 = null;
      showView("championship");
      setTimeout(() => document.getElementById("champ-input-1").focus(), 200);
    });
  }

  /* ========================================================
     SHARE CARD (canvas)
     ======================================================== */

  const shareOverlay = document.getElementById("share-overlay");
  const shareCanvas = document.getElementById("share-canvas");
  const ctx = shareCanvas.getContext("2d");

  function drawRoundedRect(c, x, y, w, h, r){
    c.beginPath();
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r);
    c.arcTo(x, y, x + w, y, r);
    c.closePath();
  }

  function drawShareCard(result){
    const W = shareCanvas.width, H = shareCanvas.height;
    ctx.clearRect(0, 0, W, H);

    // background
    ctx.fillStyle = "#F0F2EA";
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "#E7EBDF";
    ctx.beginPath(); ctx.arc(60, 70, 160, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(W - 40, H - 90, 190, 0, Math.PI * 2); ctx.fill();

    // card
    const cardX = 40, cardY = 90, cardW = W - 80, cardH = H - 200;
    ctx.save();
    ctx.translate(0, 0);
    ctx.fillStyle = "#ffffff";
    ctx.strokeStyle = "#15151B";
    ctx.lineWidth = 4;
    drawRoundedRect(ctx, cardX, cardY, cardW, cardH, 28);
    ctx.fill(); ctx.stroke();
    ctx.restore();

    // site title
    ctx.fillStyle = "#15151B";
    ctx.font = "700 22px 'Space Grotesk', sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("rate my username.", W / 2, 60);

    // handle
    ctx.font = "500 26px 'JetBrains Mono', monospace";
    ctx.fillStyle = "#55564F";
    ctx.fillText(emojiForHandle(result.handle) + " @" + result.handle, W / 2, cardY + 74);

    // score
    ctx.font = "900 150px 'Space Grotesk', sans-serif";
    ctx.fillStyle = colorForScore(result.overall);
    ctx.fillText(String(result.overall), W / 2, cardY + 260);

    ctx.font = "500 22px 'JetBrains Mono', monospace";
    ctx.fillStyle = "#55564F";
    ctx.fillText("/ 100", W / 2, cardY + 300);

    // verdict
    const band = bandFor(result.overall);
    ctx.font = "700 30px 'Space Grotesk', sans-serif";
    ctx.fillStyle = "#15151B";
    ctx.fillText(verdictLabelFor(band), W / 2, cardY + 360);

    // category bars
    const cats = Object.entries(result.categories);
    const barsTop = cardY + 410;
    const barW = cardW - 120;
    cats.forEach(([label, val], i) => {
      const y = barsTop + i * 54;
      ctx.textAlign = "left";
      ctx.font = "500 16px 'JetBrains Mono', monospace";
      ctx.fillStyle = "#55564F";
      ctx.fillText(label, cardX + 40, y);

      const trackX = cardX + 190, trackW = barW - 150;
      ctx.fillStyle = "#ECEDE2";
      drawRoundedRect(ctx, trackX, y - 14, trackW, 14, 7);
      ctx.fill();
      ctx.fillStyle = colorForScore(val);
      drawRoundedRect(ctx, trackX, y - 14, trackW * (val / 100), 14, 7);
      ctx.fill();

      ctx.textAlign = "right";
      ctx.fillStyle = "#15151B";
      ctx.fillText(String(val), cardX + cardW - 40, y);
    });

    // footer url
    ctx.textAlign = "center";
    ctx.font = "500 15px 'JetBrains Mono', monospace";
    ctx.fillStyle = "#A8A99E";
    ctx.fillText("ratemyusername.local", W / 2, cardY + cardH - 26);
  }

  function openShare(result){
    // wait a tick for webfonts to be ready for crisper canvas text
    const draw = () => drawShareCard(result);
    if (document.fonts && document.fonts.ready){
      document.fonts.ready.then(draw).catch(draw);
    } else {
      draw();
    }
    shareOverlay.classList.add("open");

    const nativeBtn = document.getElementById("share-native");
    if (navigator.canShare && navigator.share){
      nativeBtn.style.display = "inline-flex";
    } else {
      nativeBtn.style.display = "none";
    }
  }

  document.getElementById("share-btn").addEventListener("click", function(){
    if (!lastResult) return;
    openShare(lastResult);
  });

  document.getElementById("share-close").addEventListener("click", function(){
    shareOverlay.classList.remove("open");
  });
  shareOverlay.addEventListener("click", function(e){
    if (e.target === shareOverlay) shareOverlay.classList.remove("open");
  });

  document.getElementById("share-download").addEventListener("click", function(){
    if (!lastResult) return;
    shareCanvas.toBlob(function(blob){
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "rate-my-username-" + lastResult.handle + ".png";
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    }, "image/png");
  });

  document.getElementById("share-native").addEventListener("click", function(){
    if (!lastResult) return;
    shareCanvas.toBlob(async function(blob){
      try{
        const file = new File([blob], "rate-my-username.png", { type: "image/png" });
        if (navigator.canShare({ files: [file] })){
          await navigator.share({ files: [file], title: "rate my username.", text: "@" + lastResult.handle + " scored " + lastResult.overall + "/100" });
        }
      } catch(err){ /* user cancelled or share unsupported — silently ignore */ }
    }, "image/png");
  });

  /* ---------- tips for better usernames overlay ---------- */
  const tipsTab = document.getElementById("tips-tab");
  const tipsOverlay = document.getElementById("tips-overlay");
  const tipsClose = document.getElementById("tips-close");

  if (tipsTab && tipsOverlay && tipsClose){
    tipsTab.addEventListener("click", function(){
      tipsOverlay.classList.add("open");
    });
    tipsClose.addEventListener("click", function(){
      tipsOverlay.classList.remove("open");
    });
    tipsOverlay.addEventListener("click", function(e){
      if (e.target === tipsOverlay) tipsOverlay.classList.remove("open");
    });
    document.addEventListener("keydown", function(e){
      if (e.key === "Escape" && tipsOverlay.classList.contains("open")){
        tipsOverlay.classList.remove("open");
      }
    });
  }

  /* ---------- championship: how this works modal ---------- */
  const champHowBtn = document.getElementById("champ-how-btn");
  const champHowOverlay = document.getElementById("champ-how-overlay");
  const champHowClose = document.getElementById("champ-how-close-x");

  if (champHowBtn && champHowOverlay && champHowClose){
    champHowBtn.addEventListener("click", function(){
      champHowOverlay.classList.add("open");
    });
    champHowClose.addEventListener("click", function(){
      champHowOverlay.classList.remove("open");
    });
    champHowOverlay.addEventListener("click", function(e){
      if (e.target === champHowOverlay) champHowOverlay.classList.remove("open");
    });
    document.addEventListener("keydown", function(e){
      if (e.key === "Escape" && champHowOverlay.classList.contains("open")){
        champHowOverlay.classList.remove("open");
      }
    });
  }

  /* ---------- try these: tool shortcut cards ---------- */
  const toolRate = document.getElementById("tool-rate");
  const toolCompare = document.getElementById("tool-compare");

  if (toolRate){
    toolRate.addEventListener("click", function(){
      showView("home");
      const input = document.getElementById("rate-input");
      if (input) input.focus();
    });
  }
  if (toolCompare){
    toolCompare.addEventListener("click", function(){
      const goCompare = document.getElementById("go-compare");
      if (goCompare){
        goCompare.click();
      } else if (typeof showView === "function"){
        showView("compare");
        setTimeout(() => {
          const cmp1 = document.getElementById("cmp-input-1");
          if (cmp1) cmp1.focus();
        }, 200);
      }
    });
  }

  /* ---------- gamecard ---------- */
  (function(){
    const toolGamecard = document.getElementById("tool-gamecard");
    const gcGoHome = document.getElementById("gc-go-home");
    const gcForm = document.getElementById("gamecard-form");
    const gcGetOgbio = document.getElementById("gc-get-ogbio");
    const gcError = document.getElementById("gc-error");
    const gcNameInput = document.getElementById("gc-name");
    const gcBioInput = document.getElementById("gc-bio");
    if (!toolGamecard || !gcForm) return;

    // holds the current validated selection driving the poster preview.
    let gcPosterData = null;

    const PLATFORM_META = {
      gaming: { icon: "🎮", label: "Gaming" },
      youtube: { icon: "▶️", label: "YouTube" },
      instagram: { icon: "📸", label: "Instagram" },
      streaming: { icon: "🎙️", label: "Streaming" },
      other: { icon: "💻", label: "Other" }
    };
    // small "stamp" emblem shown top-right on the poster — reuses the
    // same emoji as the style picker/switcher so the icon language
    // stays consistent everywhere it appears.
    const STYLE_META = {
      cyberpunk: { icon: "⚡", kicker: "System // identity loaded" },
      esports: { icon: "🔥", kicker: "Now competing" },
      dark: { icon: "🌌", kicker: "A profile presentation" },
      neon: { icon: "💜", kicker: "Glow mode: on" },
      pro: { icon: "🏆", kicker: "Official announcement" },
      creator: { icon: "🎥", kicker: "New drop" }
    };
    const STYLE_ORDER = ["cyberpunk", "esports", "dark", "neon", "pro", "creator"];

    /* ---------- poster preview elements ---------- */
    const gcPoster = document.getElementById("gc-poster");
    const gcPosterIcon = document.getElementById("gc-poster-platform-icon");
    const gcPosterLabel = document.getElementById("gc-poster-platform-label");
    const gcPosterName = document.getElementById("gc-poster-name");
    const gcPosterKicker = document.getElementById("gc-poster-kicker");
    const gcPosterGiant = document.getElementById("gc-poster-giant");
    const gcPosterBio = document.getElementById("gc-poster-bio");
    const gcPosterEmblemIcon = document.getElementById("gc-poster-emblem-icon");
    const gcStyleSwitcher = document.getElementById("gc-style-switcher");
    const gcPosterEdit = document.getElementById("gc-poster-edit");
    const gcPosterRegenerate = document.getElementById("gc-poster-regenerate");
    const gcPosterShare = document.getElementById("gc-poster-share");
    const gcPosterShareNote = document.getElementById("gc-poster-share-note");
    const gcPosterGoHome = document.getElementById("gc-poster-go-home");

    // quick "edit text" panel — lets name/platform/bio be tweaked
    // without leaving the poster; changes render immediately.
    const gcEditPanel = document.getElementById("gc-edit-panel");
    const gcEditName = document.getElementById("gc-edit-name");
    const gcEditGame = document.getElementById("gc-edit-game");
    const gcEditBio = document.getElementById("gc-edit-bio");
    const gcEditDone = document.getElementById("gc-edit-done");
    const gcEditFull = document.getElementById("gc-edit-full");
    const gcEditSaveDownload = document.getElementById("gc-edit-save-download");

    // font size / colour / position controls — applied as inline
    // style overrides on top of the poster's normal theme styling,
    // for the name and the bio independently.
    const gcEditNameSize = document.getElementById("gc-edit-name-size");
    const gcEditNameColor = document.getElementById("gc-edit-name-color");
    const gcEditNameX = document.getElementById("gc-edit-name-x");
    const gcEditNameY = document.getElementById("gc-edit-name-y");
    const gcEditBioSize = document.getElementById("gc-edit-bio-size");
    const gcEditBioColor = document.getElementById("gc-edit-bio-color");
    const gcEditBioX = document.getElementById("gc-edit-bio-x");
    const gcEditBioY = document.getElementById("gc-edit-bio-y");

    // default (unedited) sizes/colours used to seed the controls and
    // as the "reset to theme" fallback when a value isn't overridden.
    const GC_NAME_DEFAULT_SIZE = 52;
    const GC_NAME_DEFAULT_COLOR = "#f3f8ff";
    const GC_BIO_DEFAULT_SIZE = 13;
    const GC_BIO_DEFAULT_COLOR = "#e6f5ff";

    function defaultTextStyle(){
      return { size: null, color: null, x: 0, y: 0 };
    }

    // reads an element's current (themed) text colour so the colour
    // picker opens showing what's actually on the poster, rather than
    // a generic fallback — a plain #hex input can't display "rgb(...)".
    function rgbToHex(el){
      if (!el || !window.getComputedStyle) return null;
      const rgb = getComputedStyle(el).color;
      const m = rgb && rgb.match(/\d+(\.\d+)?/g);
      if (!m || m.length < 3) return null;
      const toHex = n => Math.max(0, Math.min(255, Math.round(Number(n)))).toString(16).padStart(2, "0");
      return "#" + toHex(m[0]) + toHex(m[1]) + toHex(m[2]);
    }

    // the hero username is the biggest element on the poster by design —
    // this length-based tiering keeps it that way for short handles while
    // stepping the size down for long ones so nothing overflows the frame.
    function nameSizeClass(name){
      const len = (name || "").length;
      if (len <= 9) return "";
      if (len <= 14) return "gc-name-lg";
      if (len <= 20) return "gc-name-md";
      return "gc-name-sm";
    }

    // long bios get a slightly smaller size so ~4 wrapped lines stay
    // comfortably inside the poster instead of clipping mid-sentence.
    function bioSizeClass(bio){
      return (bio || "").length > 120 ? "gc-bio-sm" : "";
    }

    function syncStyleGrids(styleValue){
      // keep the form's style grid and the poster's quick switcher
      // pointing at the same selection, whichever one changed last.
      const formCards = document.querySelectorAll("#gc-style-grid .gc-option-card");
      formCards.forEach(function(c){
        c.setAttribute("aria-selected", c.getAttribute("data-style") === styleValue ? "true" : "false");
      });
      if (gcStyleSwitcher){
        const swatches = gcStyleSwitcher.querySelectorAll(".gc-swatch");
        swatches.forEach(function(s){
          s.setAttribute("aria-selected", s.getAttribute("data-style") === styleValue ? "true" : "false");
        });
      }
    }

    function renderPoster(data){
      if (!gcPoster || !data) return;
      gcPoster.setAttribute("data-style", data.style);

      const meta = PLATFORM_META[data.game] || PLATFORM_META.other;
      if (gcPosterIcon) gcPosterIcon.textContent = meta.icon;
      if (gcPosterLabel) gcPosterLabel.textContent = meta.label;

      const styleMeta = STYLE_META[data.style] || STYLE_META.cyberpunk;
      if (gcPosterEmblemIcon) gcPosterEmblemIcon.textContent = styleMeta.icon;
      if (gcPosterGiant) gcPosterGiant.textContent = styleMeta.icon;
      if (gcPosterKicker) gcPosterKicker.textContent = styleMeta.kicker;

      if (gcPosterName){
        const displayName = data.name.replace(/^@/, "");
        gcPosterName.textContent = "@" + displayName;
        gcPosterName.classList.remove("gc-name-lg", "gc-name-md", "gc-name-sm");
        const sizeClass = nameSizeClass(displayName);
        if (sizeClass) gcPosterName.classList.add(sizeClass);
      }

      if (gcPosterBio){
        gcPosterBio.classList.remove("gc-bio-sm");
        if (data.bio){
          gcPosterBio.textContent = data.bio;
          gcPosterBio.classList.remove("is-placeholder");
          const bioClass = bioSizeClass(data.bio);
          if (bioClass) gcPosterBio.classList.add(bioClass);
        } else {
          gcPosterBio.textContent = "no bio yet — this space is ready when you are.";
          gcPosterBio.classList.add("is-placeholder");
        }
      }

      applyTextStyle(gcPosterName, data.nameStyle);
      applyTextStyle(gcPosterBio, data.bioStyle);

      syncStyleGrids(data.style);
    }

    // applies the saved font-size / colour / position overrides (if any)
    // to a poster text element as inline styles — leaving the element's
    // normal themed styling untouched when a field hasn't been edited.
    function applyTextStyle(el, textStyle){
      if (!el) return;
      const s = textStyle || defaultTextStyle();
      el.style.fontSize = s.size ? (s.size + "px") : "";
      el.style.color = s.color || "";
      const x = s.x || 0, y = s.y || 0;
      el.style.transform = (x || y) ? ("translate(" + x + "px, " + y + "px)") : "";
    }

    // subtle, near-instant "reshuffle" of the decorative glow
    // placement — not the 5s generation animation, just a tasteful
    // refresh so Regenerate visibly does something each time.
    function reshuffleDecor(){
      if (!gcPoster) return;
      const rand = (min, max) => Math.round(min + Math.random() * (max - min));
      gcPoster.style.setProperty("--blob-a-x", rand(-10, 10) + "px");
      gcPoster.style.setProperty("--blob-a-y", rand(-10, 10) + "px");
      gcPoster.style.setProperty("--blob-a-r", rand(-8, 8) + "deg");
      gcPoster.style.setProperty("--blob-b-x", rand(-10, 10) + "px");
      gcPoster.style.setProperty("--blob-b-y", rand(-10, 10) + "px");
      gcPoster.style.setProperty("--blob-b-r", rand(-8, 8) + "deg");

      gcPoster.classList.add("is-regenerating");
      setTimeout(() => { gcPoster.classList.remove("is-regenerating"); }, 260);
    }

    toolGamecard.addEventListener("click", function(){
      showView("gamecard");
      if (gcError) gcError.classList.remove("show");
      setTimeout(() => {
        if (gcNameInput) gcNameInput.focus();
      }, 200);
    });

    if (gcGoHome){
      gcGoHome.addEventListener("click", function(){ showView("home"); });
    }

    // single-select option grids (game/social + style/background) —
    // scoped to their own container, independent from the OG Bio
    // overlay's `.identity-card` selection.
    function wireOptionGrid(gridId){
      const grid = document.getElementById(gridId);
      if (!grid) return;
      const cards = Array.from(grid.querySelectorAll(".gc-option-card"));
      cards.forEach(function(card){
        card.addEventListener("click", function(){
          cards.forEach(function(c){ c.setAttribute("aria-selected", "false"); });
          card.setAttribute("aria-selected", "true");
          if (gcError) gcError.classList.remove("show");
        });
      });
      return cards;
    }
    wireOptionGrid("gc-game-grid");
    wireOptionGrid("gc-style-grid");

    function getSelected(gridId){
      const grid = document.getElementById(gridId);
      if (!grid) return null;
      const picked = grid.querySelector('.gc-option-card[aria-selected="true"]');
      return picked ? picked : null;
    }

    // "Get OG Bio" links straight into the existing OG Bio feature —
    // reuses the same overlay/trigger rather than rebuilding it. Flagging
    // the overlay's source lets it know to offer the bio back to GameCard.
    if (gcGetOgbio){
      gcGetOgbio.addEventListener("click", function(){
        const overlay = document.getElementById("ogbio-overlay");
        if (overlay) overlay.dataset.source = "gamecard";
        const toolOgbio = document.getElementById("tool-ogbio");
        if (toolOgbio) toolOgbio.click();
      });
    }

    if (gcBioInput){
      gcBioInput.addEventListener("input", function(){
        if (gcError) gcError.classList.remove("show");
      });
    }
    if (gcNameInput){
      gcNameInput.addEventListener("input", function(){
        if (gcError) gcError.classList.remove("show");
      });
    }

    function showGcError(msg){
      if (!gcError) return;
      gcError.textContent = msg;
      gcError.classList.add("show");
    }

    // Validates the form, packages the selection, and renders the
    // actual 9:16 poster preview.
    gcForm.addEventListener("submit", function(e){
      e.preventDefault();

      const name = gcNameInput ? gcNameInput.value.trim() : "";
      const gameCard = getSelected("gc-game-grid");
      const styleCard = getSelected("gc-style-grid");

      if (!name){
        showGcError("add your name or username first.");
        if (gcNameInput) gcNameInput.focus();
        return;
      }
      if (!gameCard){
        showGcError("pick a game or platform for your card.");
        return;
      }
      if (!styleCard){
        showGcError("choose a style for your poster.");
        return;
      }

      if (gcError) gcError.classList.remove("show");

      gcPosterData = {
        name: name,
        game: gameCard.getAttribute("data-game"),
        bio: gcBioInput ? gcBioInput.value.trim() : "",
        style: styleCard.getAttribute("data-style"),
        nameStyle: defaultTextStyle(),
        bioStyle: defaultTextStyle()
      };

      renderPoster(gcPosterData);
      if (gcPosterShareNote) gcPosterShareNote.classList.remove("show");
      if (gcEditPanel){ gcEditPanel.hidden = true; }
      if (gcPosterEdit) gcPosterEdit.setAttribute("aria-expanded", "false");
      showView("gamecardPoster");
    });

    /* ---------- poster preview controls ---------- */

    // quick style switching straight from the preview — updates the
    // poster instantly and keeps the form's style grid in sync so
    // "Edit" reflects the same choice.
    if (gcStyleSwitcher){
      const swatches = Array.from(gcStyleSwitcher.querySelectorAll(".gc-swatch"));
      swatches.forEach(function(swatch){
        swatch.addEventListener("click", function(){
          if (!gcPosterData) return;
          const style = swatch.getAttribute("data-style");
          if (style === gcPosterData.style) return;
          gcPosterData.style = style;
          renderPoster(gcPosterData);
        });
      });
    }

    // keeps the full form's fields (name/bio/game grid) in step with
    // whatever the quick edit panel last set, so hopping into the full
    // editor later never shows stale values.
    function syncFullForm(data){
      if (!data) return;
      if (gcNameInput) gcNameInput.value = data.name;
      if (gcBioInput) gcBioInput.value = data.bio || "";
      const gameCards = document.querySelectorAll("#gc-game-grid .gc-option-card");
      gameCards.forEach(function(c){
        c.setAttribute("aria-selected", c.getAttribute("data-game") === data.game ? "true" : "false");
      });
    }

    function openEditPanel(){
      if (!gcEditPanel || !gcPosterData) return;
      if (gcEditName) gcEditName.value = gcPosterData.name;
      if (gcEditGame) gcEditGame.value = gcPosterData.game;
      if (gcEditBio) gcEditBio.value = gcPosterData.bio || "";

      if (!gcPosterData.nameStyle) gcPosterData.nameStyle = defaultTextStyle();
      if (!gcPosterData.bioStyle) gcPosterData.bioStyle = defaultTextStyle();
      const ns = gcPosterData.nameStyle, bs = gcPosterData.bioStyle;

      if (gcEditNameSize) gcEditNameSize.value = ns.size || GC_NAME_DEFAULT_SIZE;
      if (gcEditNameColor) gcEditNameColor.value = ns.color || rgbToHex(gcPosterName) || GC_NAME_DEFAULT_COLOR;
      if (gcEditNameX) gcEditNameX.value = ns.x || 0;
      if (gcEditNameY) gcEditNameY.value = ns.y || 0;

      if (gcEditBioSize) gcEditBioSize.value = bs.size || GC_BIO_DEFAULT_SIZE;
      if (gcEditBioColor) gcEditBioColor.value = bs.color || rgbToHex(gcPosterBio) || GC_BIO_DEFAULT_COLOR;
      if (gcEditBioX) gcEditBioX.value = bs.x || 0;
      if (gcEditBioY) gcEditBioY.value = bs.y || 0;

      gcEditPanel.hidden = false;
      if (gcPosterEdit) gcPosterEdit.setAttribute("aria-expanded", "true");
      setTimeout(() => { if (gcEditName) gcEditName.focus(); }, 60);
    }

    function closeEditPanel(){
      if (!gcEditPanel) return;
      gcEditPanel.hidden = true;
      if (gcPosterEdit) gcPosterEdit.setAttribute("aria-expanded", "false");
    }

    if (gcPosterEdit){
      gcPosterEdit.addEventListener("click", function(){
        if (!gcEditPanel) return;
        if (gcEditPanel.hidden) openEditPanel();
        else closeEditPanel();
      });
    }

    // live text edits — the poster re-renders on every keystroke/change
    // so the "updates immediately" requirement is felt directly, not
    // just after a Done click.
    if (gcEditName){
      gcEditName.addEventListener("input", function(){
        if (!gcPosterData) return;
        gcPosterData.name = gcEditName.value.trim() || "username";
        renderPoster(gcPosterData);
        syncFullForm(gcPosterData);
      });
    }
    if (gcEditGame){
      gcEditGame.addEventListener("change", function(){
        if (!gcPosterData) return;
        gcPosterData.game = gcEditGame.value;
        renderPoster(gcPosterData);
        syncFullForm(gcPosterData);
      });
    }
    if (gcEditBio){
      gcEditBio.addEventListener("input", function(){
        if (!gcPosterData) return;
        gcPosterData.bio = gcEditBio.value.trim();
        renderPoster(gcPosterData);
        syncFullForm(gcPosterData);
      });
    }
    // font size / colour / position — each control updates its own
    // field on the current name/bio style and re-renders instantly,
    // same live-update behaviour as the text content fields above.
    function wireNameStyleControl(input, field, parse){
      if (!input) return;
      input.addEventListener("input", function(){
        if (!gcPosterData) return;
        if (!gcPosterData.nameStyle) gcPosterData.nameStyle = defaultTextStyle();
        gcPosterData.nameStyle[field] = parse ? parse(input.value) : input.value;
        renderPoster(gcPosterData);
      });
    }
    function wireBioStyleControl(input, field, parse){
      if (!input) return;
      input.addEventListener("input", function(){
        if (!gcPosterData) return;
        if (!gcPosterData.bioStyle) gcPosterData.bioStyle = defaultTextStyle();
        gcPosterData.bioStyle[field] = parse ? parse(input.value) : input.value;
        renderPoster(gcPosterData);
      });
    }
    wireNameStyleControl(gcEditNameSize, "size", Number);
    wireNameStyleControl(gcEditNameColor, "color");
    wireNameStyleControl(gcEditNameX, "x", Number);
    wireNameStyleControl(gcEditNameY, "y", Number);
    wireBioStyleControl(gcEditBioSize, "size", Number);
    wireBioStyleControl(gcEditBioColor, "color");
    wireBioStyleControl(gcEditBioX, "x", Number);
    wireBioStyleControl(gcEditBioY, "y", Number);

    /* ---------- directional text position movement buttons ---------- */
    // allows users to move text position using arrow buttons for fine control
    const STEP_SIZE = 3; // pixels per button click
    
    function moveTextPosition(target, direction){
      if (!gcPosterData) return;
      const style = target === "name" ? gcPosterData.nameStyle : gcPosterData.bioStyle;
      if (!style) return;
      
      const step = STEP_SIZE;
      switch(direction){
        case "left":
          style.x = (style.x || 0) - step;
          break;
        case "right":
          style.x = (style.x || 0) + step;
          break;
        case "up":
          style.y = (style.y || 0) - step;
          break;
        case "down":
          style.y = (style.y || 0) + step;
          break;
      }
      
      // clamp values to slider limits
      style.x = Math.max(-40, Math.min(40, style.x));
      style.y = Math.max(-40, Math.min(40, style.y));
      
      // update sliders
      if (target === "name"){
        if (gcEditNameX) gcEditNameX.value = style.x;
        if (gcEditNameY) gcEditNameY.value = style.y;
      } else {
        if (gcEditBioX) gcEditBioX.value = style.x;
        if (gcEditBioY) gcEditBioY.value = style.y;
      }
      
      renderPoster(gcPosterData);
    }
    
    function resetTextPosition(target){
      if (!gcPosterData) return;
      const style = target === "name" ? gcPosterData.nameStyle : gcPosterData.bioStyle;
      if (!style) return;
      
      style.x = 0;
      style.y = 0;
      
      // update sliders
      if (target === "name"){
        if (gcEditNameX) gcEditNameX.value = 0;
        if (gcEditNameY) gcEditNameY.value = 0;
      } else {
        if (gcEditBioX) gcEditBioX.value = 0;
        if (gcEditBioY) gcEditBioY.value = 0;
      }
      
      renderPoster(gcPosterData);
    }
    
    // wire up directional movement buttons
    const posButtons = document.querySelectorAll(".gc-pos-btn");
    posButtons.forEach(function(btn){
      btn.addEventListener("click", function(e){
        e.preventDefault();
        const target = btn.getAttribute("data-target");
        const direction = btn.getAttribute("data-direction");
        moveTextPosition(target, direction);
      });
    });
    
    // wire up position reset buttons
    const resetButtons = document.querySelectorAll(".gc-pos-reset-btn");
    resetButtons.forEach(function(btn){
      btn.addEventListener("click", function(e){
        e.preventDefault();
        const target = btn.getAttribute("data-target");
        resetTextPosition(target);
      });
    });

    // renders the current poster (with any font size/colour/position
    // edits applied) to an image and downloads it as a PNG.
    function downloadPoster(){
      if (!gcPoster || typeof html2canvas === "undefined") return;
      const fileHandle = (gcPosterData && gcPosterData.name ? gcPosterData.name : "poster").replace(/^@/, "").replace(/[^a-z0-9_-]/gi, "-");
      html2canvas(gcPoster, { backgroundColor: null, scale: 3, useCORS: true }).then(function(canvas){
        canvas.toBlob(function(blob){
          if (!blob) return;
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = "gamecard-" + fileHandle + ".png";
          document.body.appendChild(a);
          a.click();
          a.remove();
          setTimeout(() => URL.revokeObjectURL(url), 2000);
        }, "image/png");
      }).catch(function(){ /* rendering failed — nothing to download */ });
    }

    if (gcEditDone){
      gcEditDone.addEventListener("click", closeEditPanel);
    }
    if (gcEditSaveDownload){
      gcEditSaveDownload.addEventListener("click", function(){
        // edits are already applied live; "save" = keep them and close
        // the panel, then hand the finished poster off as a download.
        closeEditPanel();
        downloadPoster();
      });
    }
    if (gcEditFull){
      gcEditFull.addEventListener("click", function(){
        closeEditPanel();
        showView("gamecard");
      });
    }

    if (gcPosterRegenerate){
      gcPosterRegenerate.addEventListener("click", function(){
        if (!gcPosterData) return;
        // re-render whatever is currently set (quick edits and full-form
        // edits both keep gcPosterData current) and give the decorative
        // glow a fresh, tasteful reshuffle.
        renderPoster(gcPosterData);
        reshuffleDecor();
      });
    }

    if (gcPosterShare){
      gcPosterShare.addEventListener("click", function(){
        if (!gcPosterShareNote) return;
        gcPosterShareNote.classList.add("show");
        clearTimeout(gcPosterShare._hideTimer);
        gcPosterShare._hideTimer = setTimeout(() => {
          gcPosterShareNote.classList.remove("show");
        }, 3600);
      });
    }

    if (gcPosterGoHome){
      gcPosterGoHome.addEventListener("click", function(){
        closeEditPanel();
        showView("home");
      });
    }

    /* ---------- drag-to-reposition text elements on poster ---------- */
    let draggedElement = null;
    let dragOffset = { x: 0, y: 0 };
    let dragElementType = null; // "name" or "bio"

    function makeElementDraggable(el, elementType){
      if (!el) return;
      
      el.style.cursor = "grab";
      el.style.touchAction = "none";
      el.style.userSelect = "none";

      function onMouseDown(e){
        draggedElement = el;
        dragElementType = elementType;
        dragOffset.x = e.clientX || e.touches?.[0].clientX || 0;
        dragOffset.y = e.clientY || e.touches?.[0].clientY || 0;
        el.style.cursor = "grabbing";
        document.addEventListener("mousemove", onMouseMove);
        document.addEventListener("mouseup", onMouseUp);
        document.addEventListener("touchmove", onMouseMove);
        document.addEventListener("touchend", onMouseUp);
        e.preventDefault();
      }

      function onMouseMove(e){
        if (draggedElement !== el || !gcPosterData) return;
        
        const currentX = e.clientX || e.touches?.[0].clientX || 0;
        const currentY = e.clientY || e.touches?.[0].clientY || 0;
        
        const deltaX = currentX - dragOffset.x;
        const deltaY = currentY - dragOffset.y;
        
        const dragSensitivity = 0.25; // adjust sensitivity for dragging
        
        if (elementType === "name"){
          if (!gcPosterData.nameStyle) gcPosterData.nameStyle = defaultTextStyle();
          gcPosterData.nameStyle.x = Math.max(-40, Math.min(40, (gcPosterData.nameStyle.x || 0) + Math.round(deltaX * dragSensitivity)));
          gcPosterData.nameStyle.y = Math.max(-40, Math.min(40, (gcPosterData.nameStyle.y || 0) + Math.round(deltaY * dragSensitivity)));
          if (gcEditNameX) gcEditNameX.value = gcPosterData.nameStyle.x;
          if (gcEditNameY) gcEditNameY.value = gcPosterData.nameStyle.y;
        } else if (elementType === "bio"){
          if (!gcPosterData.bioStyle) gcPosterData.bioStyle = defaultTextStyle();
          gcPosterData.bioStyle.x = Math.max(-40, Math.min(40, (gcPosterData.bioStyle.x || 0) + Math.round(deltaX * dragSensitivity)));
          gcPosterData.bioStyle.y = Math.max(-40, Math.min(40, (gcPosterData.bioStyle.y || 0) + Math.round(deltaY * dragSensitivity)));
          if (gcEditBioX) gcEditBioX.value = gcPosterData.bioStyle.x;
          if (gcEditBioY) gcEditBioY.value = gcPosterData.bioStyle.y;
        }
        
        renderPoster(gcPosterData);
        
        dragOffset.x = currentX;
        dragOffset.y = currentY;
      }

      function onMouseUp(e){
        el.style.cursor = "grab";
        draggedElement = null;
        dragElementType = null;
        document.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("mouseup", onMouseUp);
        document.removeEventListener("touchmove", onMouseMove);
        document.removeEventListener("touchend", onMouseUp);
      }

      el.addEventListener("mousedown", onMouseDown);
      el.addEventListener("touchstart", onMouseDown);
    }

    // Enable drag for name and bio elements when edit panel opens
    const originalOpenEditPanel = openEditPanel;
    window.openEditPanel = function(){
      originalOpenEditPanel();
      // Delay to ensure poster is rendered
      setTimeout(() => {
        makeElementDraggable(gcPosterName, "name");
        makeElementDraggable(gcPosterBio, "bio");
      }, 50);
    };
  })();

  /* ---------- get og bio modal ---------- */
  (function(){
    const toolOgbio = document.getElementById("tool-ogbio");
    const overlay = document.getElementById("ogbio-overlay");
    if (!toolOgbio || !overlay) return;

    const closeBtn = document.getElementById("ogbio-close");
    const closeX = document.getElementById("ogbio-close-x");
    const stepIdentity = document.getElementById("ogbio-step-identity");
    const stepNext = document.getElementById("ogbio-step-next");
    const identityCards = Array.from(document.querySelectorAll(".identity-card"));
    const continueBtn = document.getElementById("ogbio-continue");
    const backBtn = document.getElementById("ogbio-back");
    const selectedSummary = document.getElementById("ogbio-selected-summary");
    const regenerateBtn = document.getElementById("ogbio-regenerate");
    const copyBtn = document.getElementById("ogbio-copy");
    const bioTextEl = document.getElementById("ogbio-bio-text");
    const useInGamecardBtn = document.getElementById("ogbio-use-gamecard");

    const identityLabels = {
      gamer: "🎮 Gamer",
      creator: "🎨 Creator",
      social: "📱 Social",
      memelord: "😂 Meme Lord",
      music: "🎧 Music",
      justme: "✨ Just Me"
    };

    // Bio lines are only defined (and only shown) for the Gamer identity.
    // Every other identity falls back to a "coming soon" state.
    const BIO_LINES_BY_IDENTITY = {
      gamer: [
        "Not for everyone, exactly how I like it.",
        "Main character energy, side character patience.",
        "Living quiet, moving smart, staying unbothered.",
        "Some things are better left unexplained.",
        "Not lost, just taking the long way.",
        "Soft spoken, hard to read, easy to love.",
        "Chasing peace more than I chase clout.",
        "Certain things just aren't meant for everyone.",
        "Built my own lane, still adding lanes.",
        "Low profile, high standards, no explanations.",
        "Not everything in my life deserves a caption.",
        "Here for the story, not the spotlight.",
        "Growing in silence, glowing without warning.",
        "Not competing, just quietly outlasting everyone.",
        "Some chapters just aren't for the timeline.",
        "Calm exterior, chaotic playlist, honest heart.",
        "Doing my own thing, no commentary needed.",
        "Mysterious by choice, not by accident.",
        "Still figuring it out, still winning quietly.",
        "Energy speaks louder than any caption could.",
        "Not chasing trends, just chasing better days.",
        "Present but private, that's the whole vibe.",
        "Some things you just have to witness.",
        "Living proof that quiet can be loud.",
        "Not lost in the noise, just above it."
      ],
      creator: [
        "Building ideas that shouldn't exist",
        "Creating more, explaining less",
        "Turning random ideas into real things",
        "Just creating and figuring it out",
        "Building quietly, growing loudly",
        "Ideas today, projects tomorrow",
        "Creating things people actually use",
        "Making the internet a little more fun",
        "One idea away from something big",
        "Creating my own little corner online",
        "Turning imagination into digital things",
        "Making stuff instead of just scrolling",
        "Small creator, big ideas",
        "Creating because why not",
        "Building things I wish existed",
        "Documenting the journey, not the destination",
        "Ideas, edits, uploads, repeat",
        "Creating things worth sharing",
        "Just here to make cool stuff",
        "Building in public, learning every day",
        "From random thoughts to real projects",
        "Creating my way through the internet",
        "Less consuming, more creating",
        "Currently turning ideas into reality",
        "Making something out of nothing"
      ],
      social: [
        "Just here for good vibes",
        "Making memories, not excuses",
        "Somewhere between online and offline",
        "Good energy, better company",
        "Living life one moment at a time",
        "Here for the moments worth remembering",
        "Collecting memories, not followers",
        "Just vibing through life",
        "Making every moment count",
        "Good people, good times, good energy",
        "Offline life hits different",
        "Currently making memories",
        "A little chaos, a lot of fun",
        "Keeping life interesting",
        "Here for the fun of it",
        "Just enjoying the little things",
        "Making moments worth posting",
        "Life feels better with good company",
        "Somewhere between plans and adventures",
        "Just another day, another memory",
        "Good vibes are always welcome",
        "Living beyond the screen",
        "Finding fun in ordinary days",
        "Making memories along the way",
        "Just here to enjoy the ride"
      ],
      memelord: [
        "Professional overthinker, part-time meme dealer",
        "My humor needs a software update",
        "Born to meme, forced to behave",
        "Running entirely on memes and bad decisions",
        "Life is temporary, memes are forever",
        "I came, I saw, I memed",
        "Currently accepting memes as emotional support",
        "Making jokes nobody asked for",
        "My personality is basically random memes",
        "Certified yapper with questionable humor",
        "Too funny for my own algorithm",
        "Probably laughing at something completely stupid",
        "Turning everyday problems into premium memes",
        "Humor level: should probably be concerning",
        "I take memes more seriously than life",
        "Just another victim of internet humor",
        "My brain has seventeen tabs open",
        "Professional screenshot collector and meme enthusiast",
        "Serving memes with absolutely zero context",
        "If confused, just add a meme",
        "Making the timeline slightly more chaotic",
        "Fluent in sarcasm, memes, and nonsense",
        "My humor left the group chat",
        "Creating problems just to make memes",
        "Here to make the internet slightly worse"
      ],
      music: [
        "Living life one song at a time",
        "Headphones on, world completely off",
        "My playlist knows me better than anyone",
        "Currently lost somewhere inside my playlist",
        "Music speaks where words simply cannot",
        "Collecting songs, memories, and late-night thoughts",
        "Every mood deserves its own soundtrack",
        "Probably listening to music right now",
        "Life sounds better with headphones on",
        "Finding myself somewhere between songs",
        "My playlist changes with my personality",
        "Emotionally attached to fictional music moments",
        "Turning ordinary moments into movie soundtracks",
        "Music first, everything else can wait",
        "Just vibing somewhere between beats and lyrics",
        "One playlist, a thousand different moods",
        "Late nights, loud music, endless thoughts",
        "My headphones are basically my personality",
        "Living between melodies and random thoughts",
        "If lost, check my current playlist",
        "Making memories with every song",
        "My mood has a background soundtrack",
        "Music is my favorite kind of escape",
        "Press play and let everything disappear",
        "Somewhere between reality and my headphones"
      ],
      justme: [
        "Just being myself, nothing more, nothing less",
        "Doing my thing at my own pace",
        "Just me, figuring life out",
        "No bio needed, just vibes",
        "Keeping it simple, keeping it real",
        "Just another chapter of my story",
        "Being myself is more than enough",
        "Nothing special, just uniquely me",
        "Living life my own way",
        "Just existing and enjoying the journey",
        "A work in progress, always",
        "Quietly becoming who I want to be",
        "Just me doing me",
        "No explanations, just my energy",
        "Making my own rules along the way",
        "Somewhere between dreams and reality",
        "Taking life one moment at a time",
        "Still figuring things out, honestly",
        "Just here, being completely myself",
        "Becoming better without becoming someone else",
        "My vibe, my rules, my story",
        "Simply me, with a little chaos",
        "Learning, growing, and enjoying the ride",
        "Nothing to prove, just here to live",
        "Just me, and that's the whole story"
      ]
    };

    const COMING_SOON_TEXT = "Coming soon 🚧";

    let selectedIdentity = null;
    let lastBioIndex = -1;

    function hasBioLines(identity){
      const lines = BIO_LINES_BY_IDENTITY[identity];
      return Array.isArray(lines) && lines.length > 0;
    }

    function pickBioLine(identity){
      const lines = BIO_LINES_BY_IDENTITY[identity];
      if (!lines || !lines.length) return COMING_SOON_TEXT;
      if (lines.length < 2){
        return lines[0];
      }
      let idx = lastBioIndex;
      while (idx === lastBioIndex){
        idx = Math.floor(Math.random() * lines.length);
      }
      lastBioIndex = idx;
      return lines[idx];
    }

    function showNewBio(){
      const isComingSoon = !hasBioLines(selectedIdentity);
      const resultBox = document.getElementById("ogbio-result-box");
      const loadingEl = document.getElementById("ogbio-bio-loading");

      function applyBio(){
        if (bioTextEl) bioTextEl.textContent = isComingSoon ? COMING_SOON_TEXT : pickBioLine(selectedIdentity);
        if (resultBox) resultBox.classList.toggle("is-coming-soon", isComingSoon);

        // Regenerate/copy only make sense once there's an actual bio to work with.
        if (regenerateBtn) regenerateBtn.hidden = isComingSoon;
        if (copyBtn) copyBtn.hidden = isComingSoon;

        if (copyBtn) copyBtn.classList.remove("is-copied");
        if (copyBtn) copyBtn.textContent = "copy";

        // Only offer to send the bio into GameCard when that's where the
        // "Get OG Bio" link was opened from, and there's a real bio to send.
        if (useInGamecardBtn){
          const fromGameCard = overlay.dataset.source === "gamecard";
          useInGamecardBtn.hidden = isComingSoon || !fromGameCard;
          useInGamecardBtn.classList.remove("is-used");
          useInGamecardBtn.textContent = "✨ Use This Bio in GameCard →";
        }
      }

      if (isComingSoon){
        applyBio();
        return;
      }

      if (resultBox) resultBox.classList.add("is-loading");
      if (regenerateBtn) regenerateBtn.disabled = true;
      if (loadingEl) loadingEl.setAttribute("aria-hidden", "false");

      const delay = 500 + Math.random() * 500; // 0.5s - 1s
      window.setTimeout(function(){
        applyBio();
        if (resultBox) resultBox.classList.remove("is-loading");
        if (regenerateBtn) regenerateBtn.disabled = false;
        if (loadingEl) loadingEl.setAttribute("aria-hidden", "true");
      }, delay);
    }

    function resetModal(){
      selectedIdentity = null;
      identityCards.forEach(function(c){ c.setAttribute("aria-selected", "false"); });
      if (continueBtn) continueBtn.disabled = true;
      if (stepIdentity) stepIdentity.hidden = false;
      if (stepNext) stepNext.hidden = true;
    }

    function openOverlay(){
      resetModal();
      overlay.classList.add("open");
    }
    function closeOverlay(){
      overlay.classList.remove("open");
    }

    toolOgbio.addEventListener("click", function(e){
      // Real user clicks on the home "Get OG Bio" card start a fresh,
      // standalone session. Programmatic clicks (from GameCard's
      // "✨ Get OG Bio →" link) are e.isTrusted === false and leave
      // overlay.dataset.source as "gamecard" (set just before the click)
      // so the result step can offer the bio back to GameCard.
      if (e.isTrusted) overlay.dataset.source = "home";
      openOverlay();
    });
    if (closeBtn) closeBtn.addEventListener("click", closeOverlay);
    if (closeX) closeX.addEventListener("click", closeOverlay);
    overlay.addEventListener("click", function(e){
      if (e.target === overlay) closeOverlay();
    });
    document.addEventListener("keydown", function(e){
      if (e.key === "Escape" && overlay.classList.contains("open")) closeOverlay();
    });

    identityCards.forEach(function(card){
      card.addEventListener("click", function(){
        identityCards.forEach(function(c){ c.setAttribute("aria-selected", "false"); });
        card.setAttribute("aria-selected", "true");
        selectedIdentity = card.getAttribute("data-identity");
        if (continueBtn) continueBtn.disabled = false;
      });
    });

    if (continueBtn){
      continueBtn.addEventListener("click", function(){
        if (!selectedIdentity) return;
        if (selectedSummary){
          selectedSummary.textContent = "you picked: " + (identityLabels[selectedIdentity] || selectedIdentity);
        }
        if (stepIdentity) stepIdentity.hidden = true;
        if (stepNext) stepNext.hidden = false;
        showNewBio();
      });
    }

    if (regenerateBtn){
      regenerateBtn.addEventListener("click", showNewBio);
    }

    if (copyBtn){
      copyBtn.addEventListener("click", function(){
        const text = bioTextEl ? bioTextEl.textContent : "";
        if (!text) return;
        function markCopied(){
          copyBtn.textContent = "copied ✓";
          copyBtn.classList.add("is-copied");
          setTimeout(function(){
            copyBtn.textContent = "copy";
            copyBtn.classList.remove("is-copied");
          }, 1500);
        }
        if (navigator.clipboard && navigator.clipboard.writeText){
          navigator.clipboard.writeText(text).then(markCopied).catch(function(){
            /* clipboard unavailable — fail silently */
          });
        }
      });
    }

    if (backBtn){
      backBtn.addEventListener("click", function(){
        if (stepNext) stepNext.hidden = true;
        if (stepIdentity) stepIdentity.hidden = false;
      });
    }

    // Hands the current OG Bio straight to GameCard's bio field and
    // jumps back to it — GameCard's view stays mounted underneath this
    // overlay the whole time, so closing is enough to reveal it again.
    if (useInGamecardBtn){
      useInGamecardBtn.addEventListener("click", function(){
        const text = bioTextEl ? bioTextEl.textContent : "";
        const gcBio = document.getElementById("gc-bio");
        if (gcBio && text && text !== COMING_SOON_TEXT){
          gcBio.value = text;
          gcBio.dispatchEvent(new Event("input", { bubbles: true }));
        }
        useInGamecardBtn.textContent = "✓ added to your GameCard";
        useInGamecardBtn.classList.add("is-used");
        window.setTimeout(function(){
          closeOverlay();
          const gcBioEl = document.getElementById("gc-bio");
          if (gcBioEl) gcBioEl.focus();
        }, 450);
      });
    }
  })();

  /* ---------- collapsible about section ---------- */
  const aboutSection = document.getElementById("about");
  const aboutToggle = document.getElementById("about-toggle");
  if (aboutSection && aboutToggle){
    aboutToggle.addEventListener("click", function(){
      const isOpen = aboutSection.classList.toggle("is-open");
      aboutToggle.setAttribute("aria-expanded", isOpen ? "true" : "false");
      const icon = aboutToggle.querySelector(".about-toggle-icon");
      if (icon) icon.textContent = isOpen ? "×" : "+";
    });
  }

  /* ---------- light / dark theme toggle ---------- */
  const THEME_KEY = "rmu-theme";
  const themeToggle = document.getElementById("theme-toggle");
  const rootEl = document.documentElement;

  function storeTheme(theme){
    try{ localStorage.setItem(THEME_KEY, theme); } catch(e){ /* storage unavailable */ }
  }
  function applyTheme(theme){
    rootEl.setAttribute("data-theme", theme);
    if (themeToggle) themeToggle.setAttribute("aria-pressed", theme === "dark" ? "true" : "false");
  }

  // sync toggle state with whatever the anti-flash inline script already set
  applyTheme(rootEl.getAttribute("data-theme") === "dark" ? "dark" : "light");

  if (themeToggle){
    themeToggle.addEventListener("click", function(){
      const next = rootEl.getAttribute("data-theme") === "dark" ? "light" : "dark";
      applyTheme(next);
      storeTheme(next);
    });
  }

  /* focus home input on load */
  window.addEventListener("load", function(){ rateInput.focus(); });

})();
/* ========================================================
   SAFE URL ROUTER (PASTE AT THE VERY BOTTOM)
   ======================================================== */
function handleRouting() {
  const path = window.location.pathname.replace(/^\//, '').trim();
  
  // Hide all screens first using your setup's layout class
  document.querySelectorAll('.view').forEach(view => {
    view.setAttribute('hidden', 'true');
    view.classList.remove('view-enter');
  });

  // Match the URL path to your screens
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

// Intercept tool-card grid clicks to update the URL bar smoothly
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.tool-card').forEach(card => {
    card.addEventListener('click', () => {
      const featureName = card.getAttribute('data-feature');
      if (!featureName) return;
      
      history.pushState({ feature: featureName }, '', `/${featureName}`);
      handleRouting();
    });
  });

  // Wire up back links to clear the subpath URL
  document.querySelectorAll('.back-home-btn, #rate-another, [id^="back-to-"]').forEach(btn => {
    btn.addEventListener('click', () => {
      history.pushState(null, '', '/');
      handleRouting();
    });
  });

  handleRouting();
});

window.addEventListener('popstate', handleRouting);
