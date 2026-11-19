// Local preview: `npm run dev`, then open http://localhost:3000
// Serves the static app and runs the same /api handlers Vercel runs.
import http from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL(".", import.meta.url));

// Load .env if present (keys stay on your machine).
try {
  for (const line of (await readFile(join(root, ".env"), "utf8")).split("\n")) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/);
    if (m && m[2] && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
} catch {}

const routes = {
  "/api/bible": (await import("./api/bible.js")).default,
  "/api/questions": (await import("./api/questions.js")).default,
};
const types = { ".html": "text/html; charset=utf-8", ".json": "application/json", ".js": "text/javascript", ".png": "image/png", ".webmanifest": "application/manifest+json" };

const server = http.createServer(async (req, res) => {
  const path = new URL(req.url, "http://x").pathname;
  if (routes[path]) return routes[path](req, res);
  const file = normalize(join(root, path === "/" ? "index.html" : path));
  const allowed = file === join(root, "index.html") || file === join(root, "manifest.webmanifest") || file.startsWith(join(root, "data") + "/") || file.startsWith(join(root, "icons") + "/") || file.startsWith(join(root, "vendor") + "/");
  if (!allowed) { res.statusCode = 404; return res.end("Not found"); }
  try {
    await stat(file);
    res.setHeader("Content-Type", types[extname(file)] || "application/octet-stream");
    res.end(await readFile(file));
  } catch { res.statusCode = 404; res.end("Not found"); }
});

const port = +process.env.PORT || 3000;
server.listen(port, () => console.log(`Scriptorium running at http://localhost:${port}`));
