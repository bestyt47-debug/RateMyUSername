// Cloudflare Pages Function.
// Because this project has no build step, we can't "bake" environment
// variables into a static JS file at build time. Instead, this function
// runs at the edge on every request to /config.js and reads the values
// straight from the environment variables configured in the Cloudflare
// Pages dashboard (Settings -> Environment variables). auth.js fetches
// this endpoint and reads the JSON — it does NOT load this as a
// <script src="..."> tag, so a misconfigured response can never trigger
// a browser MIME-type/script error; auth.js just treats it as
// "no config available" and falls back to guest mode (or to a static
// env.js override, if present).
//
// IMPORTANT — this only works if Pages Functions are actually deployed:
//   - Git integration (push to GitHub/GitLab): Functions work automatically.
//   - Wrangler CLI (`wrangler pages deploy`): Functions work automatically.
//   - Dashboard "drag and drop" / Direct Upload: Functions are NOT
//     supported by Cloudflare (this is a Cloudflare limitation, not a bug
//     here) — see https://developers.cloudflare.com/pages/functions/get-started/
//     If you deploy this way, this endpoint will never run; the browser
//     request for /config.js will instead be caught by the SPA fallback
//     rule in _redirects and return index.html (text/html), which is why
//     you'd see a 200 response with the wrong content type/body. In that
//     case, use the static env.js fallback described in env.example.js
//     instead, or switch this project to Wrangler/Git integration.
//
// Nothing here is a secret: the Supabase "anon" / "publishable" key is
// designed to be public (access is controlled by Supabase Row Level
// Security policies, not by hiding this key). We still keep it out of
// the repo and load it from env vars, as requested, so it can be
// changed per-environment (production / preview) without touching code.
//
// Required environment variables (set in Cloudflare Pages dashboard):
//   SUPABASE_URL       - e.g. https://xxxxxxxx.supabase.co
//   SUPABASE_ANON_KEY   - the Supabase "anon" / "publishable" API key

export async function onRequestGet(context) {
  const env = context.env || {};
  const supabaseUrl = env.SUPABASE_URL || "";
  const supabaseAnonKey = env.SUPABASE_ANON_KEY || "";

  const body = JSON.stringify({ url: supabaseUrl, anonKey: supabaseAnonKey });

  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      // Always fetch fresh so a key rotation in the dashboard takes effect
      // immediately without needing a redeploy.
      "Cache-Control": "no-store"
    }
  });
}
