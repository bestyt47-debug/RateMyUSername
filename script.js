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
    versus: document.getElementById("view-versus")
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

    toolOgbio.addEventListener("click", openOverlay);
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
