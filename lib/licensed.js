// Fetches licensed translations (ESV from Crossway, NLT from Tyndale) on the server,
// so API keys never reach the browser. Nothing here is cached or stored:
// Crossway's terms limit how much ESV text an app may keep.

export const BOOKS = ["Genesis","Exodus","Leviticus","Numbers","Deuteronomy","Joshua","Judges","Ruth","1 Samuel","2 Samuel","1 Kings","2 Kings","1 Chronicles","2 Chronicles","Ezra","Nehemiah","Esther","Job","Psalms","Proverbs","Ecclesiastes","Song of Solomon","Isaiah","Jeremiah","Lamentations","Ezekiel","Daniel","Hosea","Joel","Amos","Obadiah","Jonah","Micah","Nahum","Habakkuk","Zephaniah","Haggai","Zechariah","Malachi","Matthew","Mark","Luke","John","Acts","Romans","1 Corinthians","2 Corinthians","Galatians","Ephesians","Philippians","Colossians","1 Thessalonians","2 Thessalonians","1 Timothy","2 Timothy","Titus","Philemon","Hebrews","James","1 Peter","2 Peter","1 John","2 John","3 John","Jude","Revelation"];
export const OSIS = "Gen Exod Lev Num Deut Josh Judg Ruth 1Sam 2Sam 1Kgs 2Kgs 1Chr 2Chr Ezra Neh Esth Job Ps Prov Eccl Song Isa Jer Lam Ezek Dan Hos Joel Amos Obad Jonah Mic Nah Hab Zeph Hag Zech Mal Matt Mark Luke John Acts Rom 1Cor 2Cor Gal Eph Phil Col 1Thess 2Thess 1Tim 2Tim Titus Phlm Heb Jas 1Pet 2Pet 1John 2John 3John Jude Rev".split(" ");

export const COPYRIGHT = {
  ESV: "Scripture quotations marked ESV are from the ESV® Bible (The Holy Bible, English Standard Version®), © 2001 by Crossway, a publishing ministry of Good News Publishers. Used by permission. All rights reserved.",
  NLT: "Scripture quotations marked NLT are taken from the Holy Bible, New Living Translation, copyright © 1996, 2004, 2015 by Tyndale House Foundation. Used by permission of Tyndale House Publishers, Carol Stream, Illinois 60188. All rights reserved.",
};

export class UpstreamError extends Error {
  constructor(message, status = 502) { super(message); this.status = status; }
}

const ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", rsquo: "’", lsquo: "‘", rdquo: "”", ldquo: "“", mdash: "—", ndash: "–", hellip: "…" };
export function decodeEntities(s) {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
    if (e[0] === "#") return String.fromCodePoint(e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : +e.slice(1));
    return ENTITIES[e.toLowerCase()] ?? m;
  });
}

// ---------- ESV ----------
// Text endpoint with "[16]" verse markers; we split on those markers.
export function parseEsvText(passage) {
  const verses = {};
  const parts = passage.split(/\[(\d+)\]/);
  for (let i = 1; i < parts.length; i += 2) {
    const t = parts[i + 1].replace(/\s+/g, " ").replace(/\s*\(ESV\)\s*$/, "").trim();
    if (t) verses[+parts[i]] = t;
  }
  return verses;
}

const ESV_PARAMS = {
  "include-passage-references": "false", "include-verse-numbers": "true", "include-first-verse-numbers": "true",
  "include-footnotes": "false", "include-footnote-body": "false", "include-headings": "false",
  "include-short-copyright": "false", "include-copyright": "false", "include-selahs": "true",
  "indent-paragraphs": "0", "indent-poetry": "false", "indent-declares": "0", "indent-psalm-doxology": "0", "line-length": "0",
};

async function esvGet(path, params) {
  const key = process.env.ESV_API_KEY;
  if (!key) throw new UpstreamError("ESV is not set up yet: add ESV_API_KEY in your hosting settings.", 503);
  const url = `${process.env.ESV_API_BASE || "https://api.esv.org"}/v3/${path}?${new URLSearchParams(params)}`;
  const r = await fetch(url, { headers: { Authorization: `Token ${key}` } });
  if (r.status === 401 || r.status === 403) throw new UpstreamError("The ESV API rejected the key. Check ESV_API_KEY.", 502);
  if (r.status === 429) throw new UpstreamError("The ESV API's daily limit was reached. Try again later.", 429);
  if (!r.ok) throw new UpstreamError(`The ESV API answered ${r.status}.`, 502);
  return r.json();
}

export async function esvPassage(b, c, v1, v2) {
  const q = `${BOOKS[b]} ${c}` + (v1 ? `:${v1}${v2 && v2 !== v1 ? "-" + v2 : ""}` : "");
  const data = await esvGet("passage/text/", { q, ...ESV_PARAMS });
  return parseEsvText((data.passages || []).join(" "));
}

export async function esvSearch(query, page = 1) {
  const data = await esvGet("passage/search/", { q: query, "page-size": "100", page: String(page) });
  return {
    total: data.total_results || 0, page: data.page || page, pages: data.total_pages || 1,
    results: (data.results || []).map((r) => ({ ref: r.reference, text: String(r.content || "").replace(/\s+/g, " ").trim() })),
  };
}

// ---------- NLT ----------
// The NLT API returns HTML with one <verse_export vn="16"> element per verse.
export function parseNltHtml(html) {
  const verses = {};
  const re = /<verse_export\b([^>]*)>([\s\S]*?)<\/verse_export>/gi;
  let m;
  while ((m = re.exec(html))) {
    const vn = m[1].match(/\bvn="(\d+)"/);
    if (!vn) continue;
    let body = m[2]
      .replace(/<h\d\b[^>]*>[\s\S]*?<\/h\d>/gi, " ")               // section headings
      .replace(/<a\b[^>]*class="a-tn"[^>]*>[\s\S]*?<\/a>/gi, "")     // footnote markers
      .replace(/<span\b[^>]*class="tn"[^>]*>(?:[^<]|<(?!\/?span)[^>]*>|<span\b[^>]*>[\s\S]*?<\/span>)*<\/span>/gi, "") // footnote bodies
      .replace(/<span\b[^>]*class="vn"[^>]*>[\s\S]*?<\/span>/gi, "") // verse numbers
      .replace(/<[^>]+>/g, " ");
    body = decodeEntities(body).replace(/\s+/g, " ").replace(/\s+([,.;:!?’”])/g, "$1").trim();
    if (body) verses[+vn[1]] = verses[+vn[1]] ? verses[+vn[1]] + " " + body : body;
  }
  return verses;
}

export async function nltPassage(b, c, v1, v2, { raw = false } = {}) {
  const key = process.env.NLT_API_KEY;
  if (!key) throw new UpstreamError("NLT is not set up yet: add NLT_API_KEY in your hosting settings.", 503);
  const ref = `${OSIS[b]}.${c}` + (v1 ? `.${v1}${v2 && v2 !== v1 ? "-" + OSIS[b] + "." + c + "." + v2 : ""}` : "");
  const url = `${process.env.NLT_API_BASE || "https://api.nlt.to"}/api/passages?${new URLSearchParams({ ref, version: "NLT", key })}`;
  const r = await fetch(url);
  if (r.status === 401 || r.status === 403) throw new UpstreamError("The NLT API rejected the key. Check NLT_API_KEY.", 502);
  if (r.status === 429) throw new UpstreamError("The NLT API's daily limit was reached. Try again later.", 429);
  if (!r.ok) throw new UpstreamError(`The NLT API answered ${r.status}.`, 502);
  const html = await r.text();
  if (raw) return html;
  return parseNltHtml(html);
}
