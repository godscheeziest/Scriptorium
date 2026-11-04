// Small helpers shared by the API routes (plain Node req/res, which Vercel also uses).

export function sendJson(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(body));
}

// Optional shared passcode. When APP_PASSCODE is set, every API call must send it,
// so a public link can't spend your API quotas.
export function checkPasscode(req, res) {
  const want = process.env.APP_PASSCODE;
  if (!want) return true;
  if (req.headers["x-app-passcode"] === want) return true;
  sendJson(res, 401, { error: "passcode_required" });
  return false;
}

export async function readJson(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string") return JSON.parse(req.body || "{}");
  let data = "";
  for await (const chunk of req) {
    data += chunk;
    if (data.length > 200_000) throw new Error("Request too large");
  }
  return JSON.parse(data || "{}");
}
