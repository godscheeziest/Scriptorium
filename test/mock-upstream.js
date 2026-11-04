// Fake ESV, NLT and Claude APIs for local end-to-end testing (no real keys or network).
import http from "node:http";
const sse = (res, ev) => res.write(`event: ${ev.type}\ndata: ${JSON.stringify(ev)}\n\n`);
http.createServer(async (req, res) => {
  const u = new URL(req.url, "http://x");
  if (u.pathname === "/v3/passage/text/") {
    if (req.headers.authorization !== "Token test-esv") { res.statusCode = 403; return res.end("{}"); }
    const q = u.searchParams.get("q");
    const one = q.includes(":");
    res.setHeader("Content-Type", "application/json");
    return res.end(JSON.stringify({ query: q, passages: [one ? `[${q.split(":")[1]}] ESV single verse for ${q}. (ESV)` : `[1] ESV verse one of ${q}. [2] ESV verse two.\n [3] ESV verse three. (ESV)`] }));
  }
  if (u.pathname === "/v3/passage/search/") {
    res.setHeader("Content-Type", "application/json");
    return res.end(JSON.stringify({ page: 1, total_results: 2, total_pages: 1, results: [{ reference: "John 15:4", content: "Abide in me, and I in you." }, { reference: "1 John 2:28", content: "And now, little children, abide in him" }] }));
  }
  if (u.pathname === "/api/passages") {
    const ref = u.searchParams.get("ref");
    return res.end(`<section><verse_export vn="1"><span class="vn">1</span>NLT one (${ref}).</verse_export><verse_export vn="2"><span class="vn">2</span>NLT two.</verse_export><verse_export vn="16"><span class="vn">16</span>NLT sixteen.</verse_export></section>`);
  }
  if (u.pathname === "/v1/messages") {
    let body = ""; for await (const c of req) body += c; const j = JSON.parse(body);
    const deeper = j.messages[0].content.includes("follow-up");
    const text = deeper ? "- Follow one?\n- Follow two (see Rom 8:1)?\n- Follow three?" : "## Observe\n- What does Jesus call himself?\n- Who is the gardener?\n## Apply\n- Where are you striving?\n- What would abiding look like this week?";
    res.writeHead(200, { "Content-Type": "text/event-stream" });
    sse(res, { type: "message_start", message: { id: "msg_1", type: "message", role: "assistant", model: j.model, content: [], stop_reason: null, usage: { input_tokens: 10, output_tokens: 0 } } });
    sse(res, { type: "content_block_start", index: 0, content_block: { type: "text", text: "" } });
    for (const part of text.match(/[\s\S]{1,12}/g)) { sse(res, { type: "content_block_delta", index: 0, delta: { type: "text_delta", text: part } }); await new Promise(r => setTimeout(r, 30)); }
    sse(res, { type: "content_block_stop", index: 0 });
    sse(res, { type: "message_delta", delta: { stop_reason: "end_turn" }, usage: { output_tokens: 40 } });
    sse(res, { type: "message_stop" });
    globalThis.lastClaudeRequest = j;
    return res.end();
  }
  res.statusCode = 404; res.end();
}).listen(4100);
