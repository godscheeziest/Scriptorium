// POST /api/sync-account  { username, password }
// Creates a sync account without sending any email. Uses Supabase's admin API with the
// project's secret key (SUPABASE_SECRET_KEY), which stays on the server and never reaches the page.
import { sendJson, readJson } from "../lib/http.js";

const SB_URL = process.env.SUPABASE_URL || "https://flxsbmrwameevpoqcenc.supabase.co";
const DOMAIN = "users.scriptorium.app";

// Light protection against scripted sign-ups: a few attempts per address per 10 minutes, per server instance.
const hits = new Map();
function tooMany(ip) {
  const now = Date.now(), win = 10 * 60 * 1000;
  const list = (hits.get(ip) || []).filter((t) => now - t < win);
  list.push(now); hits.set(ip, list);
  return list.length > 8;
}

export default async function handler(req, res) {
  if (req.method !== "POST") return sendJson(res, 405, { error: "Use POST." });
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!key) return sendJson(res, 503, { error: "not_configured" });
  const ip = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim() || "unknown";
  if (tooMany(ip)) return sendJson(res, 429, { error: "Too many tries just now. Wait a few minutes and try again." });

  let body;
  try { body = await readJson(req); } catch { return sendJson(res, 400, { error: "Send a username and password." }); }
  const username = String(body.username || "").trim().toLowerCase();
  const password = String(body.password || "");
  if (!/^[a-z0-9._-]{3,30}$/.test(username)) return sendJson(res, 400, { error: "Usernames are 3 to 30 letters, numbers, dots, dashes or underscores." });
  if (password.length < 6 || password.length > 72) return sendJson(res, 400, { error: "Choose a password between 6 and 72 characters." });

  const r = await fetch(`${SB_URL}/auth/v1/admin/users`, {
    method: "POST",
    headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ email: `${username}@${DOMAIN}`, password, email_confirm: true, user_metadata: { username } }),
  });
  if (r.ok) return sendJson(res, 201, { ok: true });
  const j = await r.json().catch(() => ({}));
  const msg = String(j.msg || j.message || j.error_description || j.error || "");
  if (r.status === 422 && /already|exists|registered/i.test(msg)) return sendJson(res, 409, { error: "taken" });
  if (r.status === 401 || r.status === 403) return sendJson(res, 502, { error: "The Supabase secret key was rejected. Check SUPABASE_SECRET_KEY in Vercel." });
  return sendJson(res, 502, { error: msg || `Supabase answered ${r.status}.` });
}
