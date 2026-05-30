# Job Apply Co-pilot — Chrome Extension

One extension that, on a Lever or Greenhouse page:

- **Judge fit** — reads the job and assesses it against your resume, with a
  prominent ⚠️ visa/sponsorship conflict flag and a verdict.
- **Tailor resume** — rewrites your master resume for the role (Markdown
  download), grounded strictly in your real experience.
- **Auto-fill form** — fills the application's standard fields, answers known
  questions from your answer bank, and drafts open-ended answers — then leaves
  sensitive fields (visa/salary/EEO) and the resume upload for you, and you click
  Submit.

Everything is stored in your browser (`chrome.storage.local`); data leaves only
as Claude API calls you trigger.

## Install (unpacked, ~1 min)

1. Open `chrome://extensions`
2. Turn on **Developer mode** (top right)
3. Click **Load unpacked** and select this `extension/` folder
4. Click the extension's ⚙︎ (or right-click → Options) and fill in:
   - **Master resume** (Markdown) — paste your `resume.md`
   - **Preferences** (optional) — visa status, locations, comp floor
   - **Answer bank** (JSON) — click *Load example*, then fill in your answers
   - **Anthropic API key** — from console.anthropic.com
5. Pin the extension and click its icon to open the side panel.

## Use

1. Open a job on **Lever** (`jobs.lever.co/…`) or **Greenhouse**
   (`boards.greenhouse.io/…`, regional `…eu.greenhouse.io` too).
2. Open the side panel. It shows whether you're on a posting or an application form.
3. On a posting: **Judge fit**, then **Tailor resume** if you want.
4. On the application form: **Auto-fill form**. Review the report in the panel,
   finish the ✗ items in the page (resume upload + anything sensitive), **Submit**.

## Known limits

- **Resume upload is manual.** Browsers forbid extensions from setting a file
  input, so you click upload and pick your PDF yourself (one click). Everything
  else is auto-filled.
- **Sensitive answers** (work authorization/sponsorship, salary, EEO) are shown
  as suggestions but never auto-entered — you confirm them in the page.
- **Newer Greenhouse React comboboxes** (non-native dropdowns) may not auto-fill;
  they degrade to "you fill it" rather than guessing.
- Models default to Haiku (judge) and Sonnet (tailor/draft); change them in
  Options.

## Files

```
manifest.json            MV3 manifest
background/               service worker → Claude API calls, opens side panel
content/                  JD extraction + ATS adapters + form fill (Lever, Greenhouse)
sidepanel/                the main UI (judge / tailor / auto-fill)
options/                  setup: resume, preferences, answer bank, API key
lib/                      storage, prompts, Claude client
```
