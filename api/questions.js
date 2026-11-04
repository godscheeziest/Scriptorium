// POST /api/questions  — streams plain text back as Claude writes it.
// body: { mode: "build" | "deeper", title, speaker, passage, body, cited: [..], xrefs: [..], question }
import Anthropic from "@anthropic-ai/sdk";
import { sendJson, checkPasscode, readJson } from "../lib/http.js";

const MODEL = process.env.CLAUDE_MODEL || "claude-opus-5-5";
const EFFORT = process.env.CLAUDE_EFFORT || "low"; // low keeps the first question appearing quickly

const clip = (s, n) => String(s ?? "").slice(0, n);
const list = (a, n, each) => (Array.isArray(a) ? a : []).slice(0, n).map((x) => clip(x, each));

function buildPrompt(p) {
  const cited = list(p.cited, 14, 700).join("\n") || "(none)";
  if (p.mode === "deeper") {
    return `A small group is discussing this question from a sermon on ${clip(p.passage || p.title || "a passage", 200)}:
"${clip(p.question, 600)}"

Verses in view (BSB):
${cited}

Write exactly 3 follow-up questions that take the conversation deeper: one that probes the text more closely, one that brings in another part of Scripture (name the reference), and one that presses toward honest personal response.
FORMAT: plain text, one question per line, each starting with "- ". No other text.`;
  }
  return `You help a small-group leader turn sermon notes into discussion questions that lead to deeper understanding of Scripture.
Write 12 to 15 open-ended questions in five groups, in this order: Observe (what the text says), Interpret (what it meant to first readers and what it reveals about God), Connect (tie the main passage to the listed cross-references, naming the verse), Apply (concrete, personal, this week; no yes/no questions), Go deeper (tensions, objections or doctrine for mature discussion).
Ground every question in the notes and verses below. Quote short phrases where useful. Don't invent sermon content the notes don't contain.
FORMAT: plain text only. Each group starts with a line "## Group name", then one question per line starting with "- ". No other text.

SERMON: ${clip(p.title, 200) || "(untitled)"}${p.speaker ? " — " + clip(p.speaker, 120) : ""}
MAIN PASSAGE: ${clip(p.passage, 200) || "(not given)"}
NOTES:
${clip(p.body, 8000)}

VERSES CITED (BSB):
${cited}

CROSS-REFERENCES (BSB):
${list(p.xrefs, 10, 400).join("\n") || "(none)"}`;
}

export default async function handler(req, res) {
  if (req.method !== "POST") return sendJson(res, 405, { error: "Use POST." });
  if (!checkPasscode(req, res)) return;
  if (!process.env.ANTHROPIC_API_KEY) return sendJson(res, 503, { error: "claude_not_configured" });

  let payload;
  try { payload = await readJson(req); } catch { return sendJson(res, 400, { error: "Send the note as JSON." }); }

  const client = new Anthropic();
  const controller = new AbortController();
  req.on("close", () => { if (!res.writableEnded) controller.abort(); });

  try {
    const stream = client.beta.messages.stream(
      {
        model: MODEL,
        max_tokens: 8000,
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        output_config: { effort: EFFORT },
        messages: [{ role: "user", content: buildPrompt(payload) }],
      },
      { signal: controller.signal },
    );

    let started = false;
    for await (const event of stream) {
      if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
        if (!started) {
          res.statusCode = 200;
          res.setHeader("Content-Type", "text/plain; charset=utf-8");
          res.setHeader("Cache-Control", "no-store");
          started = true;
        }
        res.write(event.delta.text);
      }
    }
    const final = await stream.finalMessage();
    if (!started) {
      if (final.stop_reason === "refusal") return sendJson(res, 422, { error: "Claude declined this request." });
      return sendJson(res, 502, { error: "Claude returned no text." });
    }
    res.end();
  } catch (e) {
    if (controller.signal.aborted) return res.end();
    let status = 502, error = "Claude couldn't build questions this time.";
    if (e instanceof Anthropic.RateLimitError) { status = 429; error = "Claude is busy right now. Try again in a minute."; }
    else if (e instanceof Anthropic.AuthenticationError) { status = 502; error = "The Anthropic API key was rejected. Check ANTHROPIC_API_KEY."; }
    else if (e instanceof Anthropic.APIError) { error = `Claude API error ${e.status ?? ""}`.trim(); }
    if (res.headersSent) { res.write(`\n[error] ${error}`); return res.end(); }
    return sendJson(res, status, { error });
  }
}
