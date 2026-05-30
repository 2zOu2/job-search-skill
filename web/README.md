# Job Fit Co-pilot — web app

A single static page. Paste a job description, get an honest fit assessment
against your resume, tailor your resume to it, and track everything locally.
No backend, no install, not tied to any job site.

**Phase 1** — paste & assess. **Phase 2 (now)** — tailor resume + application
tracker. Next: one-click capture from job sites (Phase 3), then PDF export /
follow-up reminders / API-key proxy (Phase 4).

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

## Tailor & track (Phase 2)

On the assessment card:

- **Tailor resume** — rewrites your master resume for this role, reordering and
  re-emphasizing only what your resume already supports (never invents). Preview
  it, **Copy** or **Download .md**.
- **Save to tracker** — saves the role, verdict, JD, assessment, and tailored
  resume to a local list.

The **Tracker** lists everything you saved: set a status (Interested → Applied →
Interviewing → Offer / Rejected), expand **View** to re-read the assessment, JD,
and re-download the tailored resume, or delete. All in `localStorage`.

## Privacy

Resume, preferences, API key, and your whole tracker live only in your browser
(`localStorage`). Data is sent only to `api.anthropic.com`, only when you run an
assessment or tailor a resume.

## Files

```
index.html   markup + layout
styles.css   styling
app.js        UI, localStorage, assess loop, tailoring, tracker
prompt.js     fit-assessment + resume-tailoring prompts (grounded in your resume)
claude.js     Anthropic API call + JSON parsing
```
