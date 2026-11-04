# Scriptorium

A Bible study and sermon-notes app: read and compare translations, look up cross-references and Strong's Hebrew/Greek, search a concordance, take sermon notes that link to each other, and turn those notes into small-group discussion questions.

## What's inside

| Part | Where | Notes |
|---|---|---|
| App (one page) | `index.html` | Plain HTML/JS, no build step |
| Built-in Bibles | `data/BSB.json`, `KJV.json`, `ASV.json` | Public domain, bundled |
| Cross-references | `data/xref.json` | OpenBible.info, CC-BY |
| Strong's lexicon | `data/lexicon.json` | Public domain (via openscriptures/strongs) |
| ESV and NLT | `api/bible.js`, `lib/licensed.js` | Fetched live from Crossway and Tyndale with your keys. Never stored |
| Discussion questions | `api/questions.js` | Calls Claude with your Anthropic key and streams questions back |

Notes are saved in the browser you write them in. Use **Back up notes** regularly, and **Restore from backup** to move them to another device.

## Set up (about 15 minutes)

### 1. Get the API keys

All three are free to start. Only use them for non-commercial purposes.

- **ESV**: create an account and an application at <https://api.esv.org/>. Copy the token.
- **NLT**: request a key at <https://api.nlt.to/>.
- **Claude**: create a key at <https://console.anthropic.com/> and add a small amount of credit. Each set of questions costs a few cents.

### 2. Deploy to Vercel

1. Sign in at <https://vercel.com> with your GitHub account.
2. **Add New → Project**, and import this repository. Leave the framework preset as **Other**. No build command is needed.
3. Before deploying, open **Environment Variables** and add:
   - `ESV_API_KEY`
   - `NLT_API_KEY`
   - `ANTHROPIC_API_KEY`
   - `APP_PASSCODE` (optional, but recommended once you share the link. Anyone using ESV, NLT or Claude through your site must enter it, so strangers can't use up your quotas)
4. Deploy. If you change a variable later, redeploy so it takes effect.

Any version whose key is missing simply doesn't appear in the menus. Without a Claude key, questions come from built-in templates.

### 3. Run it on your own computer (optional)

```bash
cp .env.example .env    # then fill in your keys
npm install
npm run dev             # http://localhost:3000
npm test                # parser tests
```

## Licensing rules this app follows

- **ESV (Crossway)**: free for non-commercial use. No more than 500 verses can be stored. The app keeps at most 500 ESV verses in memory and never saves them, so the API routes send `Cache-Control: no-store`. The copyright notice appears wherever ESV text is shown. Any commercial use, or putting it in an app store, needs a license from Crossway.
- **NLT (Tyndale)**: free key for non-commercial use, with daily limits. The copyright notice appears wherever NLT text is shown.
- **Sermon notes keep the verse text you add to them.** That's ordinary quotation, but keep each note well under 500 verses.
- If you ever charge for the app or publish it in an app store, contact Crossway and Tyndale for licenses first.

## Troubleshooting

- **"ESV/NLT is not set up yet"**: the key's environment variable is missing. Add it and redeploy.
- **NLT text looks wrong or empty**: open `/api/bible?v=NLT&b=42&c=3&raw=1` on your site (with the passcode header if you set one). It returns the raw response from Tyndale so the parser in `lib/licensed.js` can be adjusted.
- **Questions fall back to the built-in set**: check `ANTHROPIC_API_KEY` and that the account has credit. The model is `claude-opus-5-5` at low effort. Set `CLAUDE_EFFORT=medium` for deeper questions that take longer to start.
