/* ========================================================
   AUTH FOUNDATION (Supabase)
   --------------------------------------------------------
   Self-contained: this file does not read or modify anything
   inside script.js, and script.js does not know this file
   exists. It only touches its own DOM elements (#auth-*), so
   every existing feature (rating, compare, championship,
   roast, gamecard, og bio, share cards, etc.) is untouched.

   Guests are always allowed to use the whole site. If Supabase
   isn't configured (env vars missing) or the client library
   fails to load, the account button simply stays hidden and
   the rest of the site works exactly as before.

   This file ONLY builds the auth foundation:
     - sign up (email + password)
     - log in (email + password)
     - log out
     - persistent session / session restoration
     - logged-in state reflected in the topbar

   It intentionally does NOT gate the leaderboard, saving
   results, or downloads yet.
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

  ready(function () {
    main().catch(function (err) {
      console.warn("[auth] unexpected error during setup — running in guest-only mode.", err);
    });
  });

  async function resolveConfig() {
    // 1) Already set inline (e.g. a small <script> block someone added by
    //    hand directly in index.html before this file runs). Highest
    //    priority since it requires no network round trip.
    if (window.__SUPABASE_CONFIG__ && window.__SUPABASE_CONFIG__.url && window.__SUPABASE_CONFIG__.anonKey) {
      return window.__SUPABASE_CONFIG__;
    }

    // 2) A same-origin runtime endpoint, e.g. functions/config.js (a
    //    Cloudflare Pages Function). We fetch it ourselves — rather than
    //    load it as a <script src>  — specifically so that a wrong
    //    response (for example a host without Functions support serving
    //    index.html for every unknown path) is just data we can inspect,
    //    not a browser-level MIME-type/script error.
    try {
      const res = await fetch("/config.js", { cache: "no-store", headers: { Accept: "application/json" } });
      if (res.ok) {
        const contentType = res.headers.get("content-type") || "";
        if (contentType.indexOf("json") !== -1) {
          const data = await res.json();
          if (data && data.url && data.anonKey) return data;
        }
        // else: got a 200 but not JSON (commonly an SPA fallback serving
        // index.html) — this host isn't actually running the function.
        // Fall through to the static override below.
      }
    } catch (err) {
      // network error / endpoint doesn't exist — fall through.
    }

    // 3) A plain static file (env.js) the deployer creates locally from
    //    env.example.js and uploads alongside the rest of the site. This
    //    is what makes auth work on hosts/deploy methods that can't run
    //    server code, e.g. Cloudflare Pages "drag and drop" uploads.
    if (window.SUPABASE_URL && window.SUPABASE_ANON_KEY) {
      return { url: window.SUPABASE_URL, anonKey: window.SUPABASE_ANON_KEY };
    }

    return null;
  }

  async function main() {
    // ---------- config ----------
    const config = await resolveConfig();
    const SUPABASE_URL = (config && config.url) || "";
    const SUPABASE_ANON_KEY = (config && config.anonKey) || "";

    const authToggle = document.getElementById("auth-toggle");

    const hasLibrary = typeof window.supabase !== "undefined" && typeof window.supabase.createClient === "function";
    const hasConfig = !!SUPABASE_URL && !!SUPABASE_ANON_KEY;

    if (!hasLibrary || !hasConfig) {
      // No auth for this deployment/session — fail quietly. Guests keep
      // full access to every existing feature; we just never reveal the
      // account button.
      if (!hasConfig) {
        console.warn("[auth] Supabase config not found — running in guest-only mode. See functions/config.js and env.example.js.");
      } else if (!hasLibrary) {
        console.warn("[auth] Supabase client library failed to load — running in guest-only mode.");
      }
      return;
    }

    const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    });

    // Library loaded, config present, client created — safe to reveal the
    // account button now. Don't wait on the async getSession() call below;
    // that call restores the session but has no bearing on whether the
    // button itself should be shown.
    authToggle.hidden = false;

    // ---------- DOM refs ----------
    const authToggleDot = document.getElementById("auth-toggle-dot");
    const overlay = document.getElementById("auth-overlay");
    const closeX = document.getElementById("auth-close-x");

    const viewForm = document.getElementById("auth-view-form");
    const viewAccount = document.getElementById("auth-view-account");

    const titleEl = document.getElementById("auth-title");
    const subEl = document.getElementById("auth-sub");
    const form = document.getElementById("auth-form");
    const emailInput = document.getElementById("auth-email");
    const passwordInput = document.getElementById("auth-password");
    const errorEl = document.getElementById("auth-error");
    const submitBtn = document.getElementById("auth-submit-btn");
    const switchText = document.getElementById("auth-switch-text");
    const switchBtn = document.getElementById("auth-switch-btn");

    const accountEmailEl = document.getElementById("auth-account-email");
    const logoutBtn = document.getElementById("auth-logout-btn");

    if (!authToggle || !overlay || !form) return; // markup not present, bail safely

    let mode = "login"; // "login" | "signup"
    let currentSession = null;

    // ---------- small helpers ----------
    function clearError() {
      errorEl.textContent = "";
      errorEl.classList.remove("show");
    }
    function showError(msg) {
      errorEl.textContent = msg;
      errorEl.classList.add("show");
    }

    function setLoading(isLoading) {
      submitBtn.disabled = isLoading;
      switchBtn.disabled = isLoading;
      submitBtn.textContent = isLoading
        ? "please wait..."
        : mode === "signup" ? "sign up →" : "log in →";
    }

    function validateEmail(email) {
      if (!email) return "enter your email first.";
      // simple, deliberately permissive check — Supabase does the real validation
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return "that email doesn't look right.";
      return null;
    }
    function validatePassword(password) {
      if (!password) return "enter a password first.";
      if (password.length < 6) return "password should be at least 6 characters.";
      return null;
    }

    function friendlyError(err) {
      const raw = (err && err.message) || "";
      const msg = raw.toLowerCase();
      if (msg.includes("invalid login credentials")) return "incorrect email or password.";
      if (msg.includes("already registered") || msg.includes("already exists")) return "an account with this email already exists — try logging in instead.";
      if (msg.includes("password") && (msg.includes("least") || msg.includes("short") || msg.includes("weak") || msg.includes("6 characters"))) return "password should be at least 6 characters.";
      if (msg.includes("email") && (msg.includes("invalid") || msg.includes("valid"))) return "that email doesn't look right.";
      if (msg.includes("rate limit") || msg.includes("too many")) return "too many attempts — wait a bit and try again.";
      if (msg.includes("network") || msg.includes("fetch")) return "couldn't reach the server — check your connection and try again.";
      return raw || "something went wrong — try again.";
    }

    function setMode(next) {
      mode = next;
      clearError();
      if (mode === "signup") {
        titleEl.textContent = "sign up";
        subEl.textContent = "takes a few seconds. you can still rate as a guest instead.";
        passwordInput.setAttribute("autocomplete", "new-password");
        submitBtn.textContent = "sign up →";
        switchText.textContent = "already have an account?";
        switchBtn.textContent = "log in";
      } else {
        titleEl.textContent = "log in";
        subEl.textContent = "optional — you can keep rating as a guest, no account needed.";
        passwordInput.setAttribute("autocomplete", "current-password");
        submitBtn.textContent = "log in →";
        switchText.textContent = "new here?";
        switchBtn.textContent = "sign up";
      }
    }

    function showFormView() {
      viewForm.hidden = false;
      viewAccount.hidden = true;
    }
    function showAccountView() {
      viewForm.hidden = true;
      viewAccount.hidden = false;
    }

    function openOverlay() {
      overlay.classList.add("open");
      if (currentSession) {
        showAccountView();
      } else {
        showFormView();
        setMode("login");
        setTimeout(function () { emailInput.focus(); }, 50);
      }
    }
    function closeOverlay() {
      overlay.classList.remove("open");
      clearError();
      passwordInput.value = "";
    }

    // ---------- reflect auth state in the topbar ----------
    function updateUIForSession(session) {
      currentSession = session || null;
      const user = currentSession && currentSession.user;
      if (user) {
        authToggle.classList.add("is-authed");
        authToggle.setAttribute("aria-label", "Account (" + (user.email || "signed in") + ")");
        if (authToggleDot) authToggleDot.hidden = false;
        if (accountEmailEl) accountEmailEl.textContent = user.email || "";
        if (overlay.classList.contains("open")) showAccountView();
      } else {
        authToggle.classList.remove("is-authed");
        authToggle.setAttribute("aria-label", "Sign up or log in");
        if (authToggleDot) authToggleDot.hidden = true;
        if (overlay.classList.contains("open")) showFormView();
      }
    }

    // ---------- wire up UI ----------
    authToggle.addEventListener("click", openOverlay);
    closeX.addEventListener("click", closeOverlay);
    overlay.addEventListener("click", function (e) {
      if (e.target === overlay) closeOverlay();
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && overlay.classList.contains("open")) closeOverlay();
    });

    switchBtn.addEventListener("click", function () {
      setMode(mode === "login" ? "signup" : "login");
      emailInput.focus();
    });

    form.addEventListener("submit", async function (e) {
      e.preventDefault();
      clearError();

      const email = emailInput.value.trim();
      const password = passwordInput.value;

      const emailErr = validateEmail(email);
      if (emailErr) { showError(emailErr); emailInput.focus(); return; }
      const passErr = validatePassword(password);
      if (passErr) { showError(passErr); passwordInput.focus(); return; }

      setLoading(true);
      try {
        if (mode === "signup") {
          const { data, error } = await sb.auth.signUp({ email, password });
          if (error) throw error;
          if (data && data.user && !data.session) {
            // email confirmation is required by this Supabase project
            setMode("login");
            emailInput.value = email;
            showError("account created — check your email to confirm, then log in.");
          } else {
            closeOverlay();
          }
        } else {
          const { data, error } = await sb.auth.signInWithPassword({ email, password });
          if (error) throw error;
          closeOverlay();
        }
      } catch (err) {
        showError(friendlyError(err));
      } finally {
        setLoading(false);
      }
    });

    logoutBtn.addEventListener("click", async function () {
      logoutBtn.disabled = true;
      try {
        await sb.auth.signOut();
      } catch (err) {
        // logout failures are rare and non-actionable for the user here;
        // the UI will simply reflect whatever the real session state is.
      }
      logoutBtn.disabled = false;
      closeOverlay();
    });

    // ---------- session restoration + live updates ----------
    sb.auth.getSession().then(function (res) {
      updateUIForSession(res && res.data && res.data.session);
    }).catch(function () {
      // If session restoration fails (e.g. transient network issue), the
      // button is already visible and simply behaves as logged-out until
      // the user tries again.
    });

  sb.auth.onAuthStateChange(function (_event, session) {
  updateUIForSession(session);
  
  // This removes the hash and tokens from the URL bar without reloading the page
  if (session && window.location.hash) {
    window.history.replaceState(null, null, window.location.pathname);
  }
});
