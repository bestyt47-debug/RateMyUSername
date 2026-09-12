/*
  Optional static Supabase config — only needed if you deploy by dragging
  and dropping this folder into the Cloudflare Pages dashboard (Direct
  Upload). Cloudflare does not run the /functions folder for drag-and-drop
  deploys, so /config.js won't work in that case; this file is the
  fallback auth.js reads instead.

  If you deploy via Git integration or the Wrangler CLI, you DON'T need
  this file at all — delete it or leave it unfilled, set SUPABASE_URL and
  SUPABASE_ANON_KEY in the Cloudflare Pages dashboard instead, and
  functions/config.js will handle it automatically.

  HOW TO USE:
    1. Copy this file to env.js (same folder).
    2. Fill in your real values below.
    3. Make sure env.js is included when you drag-and-drop upload the site.
    4. Do NOT commit env.js to git — it's already listed in .gitignore.

  Note: the Supabase "anon" / "publishable" key is designed to be public
  (it's safe to ship in client-side code — access is controlled by
  Supabase Row Level Security policies, not by hiding this key).
*/
window.SUPABASE_URL = "https://fcbhmmtcssxnasiphbpp.supabase.co";
window.SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZjYmhtbXRjc3N4bmFzaXBoYnBwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkxODcyMjgsImV4cCI6MjEwNDc2MzIyOH0.iDsM2t42TMdvwsBHh_mWEGNOFUF4lDnpehe7amOEQzo";
