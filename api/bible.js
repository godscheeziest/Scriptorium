// GET /api/bible?v=ESV|NLT&b=42&c=3[&v1=16&v2=18]  -> { verses: {16: "..."}, copyright }
// GET /api/bible?v=ESV&search=abide[&page=2]        -> { total, page, pages, results: [{ref, text}] }
// GET /api/bible?status=1                          -> { ESV: true|false, NLT: true|false, passcode: true|false }
import { esvPassage, esvSearch, nltPassage, COPYRIGHT, UpstreamError } from "../lib/licensed.js";
import { sendJson, checkPasscode } from "../lib/http.js";

export default async function handler(req, res) {
  const q = new URL(req.url, "http://x").searchParams;

  if (q.get("status")) {
    return sendJson(res, 200, { ESV: !!process.env.ESV_API_KEY, NLT: !!process.env.NLT_API_KEY, claude: !!process.env.ANTHROPIC_API_KEY, passcode: !!process.env.APP_PASSCODE });
  }
  if (!checkPasscode(req, res)) return;

  const v = (q.get("v") || "").toUpperCase();
  if (v !== "ESV" && v !== "NLT") return sendJson(res, 400, { error: "Unknown version. Use ESV or NLT." });

  try {
    if (q.get("search")) {
      if (v !== "ESV") return sendJson(res, 400, { error: "Search is available for ESV only." });
      const term = q.get("search").slice(0, 200);
      return sendJson(res, 200, { ...(await esvSearch(term, Math.max(1, +q.get("page") || 1))), copyright: COPYRIGHT.ESV });
    }
    const b = +q.get("b"), c = +q.get("c");
    const v1 = q.get("v1") ? +q.get("v1") : null, v2 = q.get("v2") ? +q.get("v2") : v1;
    if (!(b >= 0 && b < 66) || !(c >= 1 && c <= 150)) return sendJson(res, 400, { error: "Give a book (0–65) and chapter." });
    if (v === "NLT" && q.get("raw")) { // troubleshooting: see what the NLT API sent back
      const html = await nltPassage(b, c, v1, v2, { raw: true });
      return sendJson(res, 200, { raw: html.slice(0, 4000) });
    }
    const verses = v === "ESV" ? await esvPassage(b, c, v1, v2) : await nltPassage(b, c, v1, v2);
    if (!Object.keys(verses).length) return sendJson(res, 502, { error: `${v} returned no text for that passage.` });
    return sendJson(res, 200, { verses, copyright: COPYRIGHT[v] });
  } catch (e) {
    const status = e instanceof UpstreamError ? e.status : 502;
    return sendJson(res, status, { error: e.message || "Could not reach the Bible API." });
  }
}
