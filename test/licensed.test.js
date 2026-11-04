import { test } from "node:test";
import assert from "node:assert/strict";
import { parseEsvText, parseNltHtml, decodeEntities } from "../lib/licensed.js";

test("ESV text splits on verse markers", () => {
  const v = parseEsvText("  [16] For God so loved the world, that he gave his only Son,\n    that whoever believes in him should not perish but have eternal life. [17] For God did not send his Son into the world to condemn the world. (ESV)");
  assert.equal(v[16], "For God so loved the world, that he gave his only Son, that whoever believes in him should not perish but have eternal life.");
  assert.equal(v[17], "For God did not send his Son into the world to condemn the world.");
});

test("NLT HTML: strips headings, verse numbers and footnotes", () => {
  const html = `<div id="bibletext"><section><h2 class="bk_ch_vs_header">John 3:16-17, NLT</h2>
  <verse_export orig="john_3_16" bk="John" ch="3" vn="16"><span class="vn">16</span>“For this is how God loved the world: He gave his one and only Son,<a class="a-tn">*</a><span class="tn"><span class="tn-ref">3:16</span> Or <em>For God loved the world so much that he gave his</em> one and only Son.</span> so that everyone who believes in him will not perish but have eternal life.</verse_export>
  <verse_export orig="john_3_17" bk="John" ch="3" vn="17"><h3 class="subhead">A Heading</h3><span class="vn">17</span>God sent his Son into the world not to judge the world, but to save the world through him.</verse_export></section></div>`;
  const v = parseNltHtml(html);
  assert.equal(v[16], "“For this is how God loved the world: He gave his one and only Son, so that everyone who believes in him will not perish but have eternal life.");
  assert.equal(v[17], "God sent his Son into the world not to judge the world, but to save the world through him.");
});

test("entities decode", () => {
  assert.equal(decodeEntities("Lord&rsquo;s &amp; &#8220;x&#x201D;"), "Lord’s & “x”");
});
