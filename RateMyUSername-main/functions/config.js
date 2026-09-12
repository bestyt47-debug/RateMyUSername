// Cloudflare Pages Function.
// Because this project has no build step, we can't "bake" environment
// variables into a static JS file at build time. Instead, this function
// runs at the edge on every request to /config.js and reads the values
// straight from the environment variables configured in the Cloudflare
// Pages dashboard (Settings -> Environment variables). It then hands the
// browser a tiny script that sets window.__SUPABASE_CONFIG__.
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

  const config = { url: supabaseUrl, anonKey: supabaseAnonKey };
  const body = "window.__SUPABASE_CONFIG__ = " + JSON.stringify(config) + ";";

  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      // Always fetch fresh so a key rotation in the dashboard takes effect
      // immediately without needing a redeploy.
      "Cache-Control": "no-store"
    }
  });
}
