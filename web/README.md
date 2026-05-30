# Job Fit Co-pilot — web app

A single static page. Paste a job description, get an honest fit assessment
against your resume. No backend, no install, not tied to any job site.

This is **Phase 1**: paste & assess. Tailoring + application tracking (Phase 2),
one-click capture from job sites (Phase 3), and PDF export / reminders / key
proxy (Phase 4) build on top of this.

## Run it

Best served over `http://` so the browser sends a normal origin to the API:

```bash
cd web
python3 -m http.server 8000
# open http://localhost:8000
```

(Opening `index.html` directly via `file://` can fail the API call because the
origin is `null`. Use the local server above.)

## First use

1. Click **⚙︎ Settings**.
2. Paste your **resume**, optional **preferences** (location, comp floor,
   visa/sponsorship), and your **Anthropic API key** (from console.anthropic.com).
3. **Save settings.**
4. Paste any job description → **Assess fit**.

You get: a verdict (Strong fit / Worth applying / Stretch / Skip), why you match,
real gaps, a ⚠️ visa-conflict flag when the posting rules out sponsorship and you
need it, and anything the posting didn't state (e.g. salary).

## Privacy

Resume, preferences, and API key live only in your browser (`localStorage`).
They're sent only to `api.anthropic.com`, only when you run an assessment.

## Files

```
index.html   markup + layout
styles.css   styling
app.js        UI, localStorage, the assess loop
prompt.js     the fit-assessment prompt (general; grounded in your resume)
claude.js     Anthropic API call + JSON parsing
```
