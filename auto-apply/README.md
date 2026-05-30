# Auto-Apply Co-pilot (Phase 1 — Lever)

Semi-automated job applications. For a given **Lever** application URL, it opens
the form in your real browser, auto-fills the standard fields, uploads your
resume, drafts answers to open-ended questions — then **hands control to you** to
review, fix sensitive answers, clear any CAPTCHA, and click **Submit** yourself.

It never auto-submits, and it never auto-answers sensitive questions (work
authorization / sponsorship, salary, EEO) — those are always routed to you.

See `../docs/auto-apply-copilot-design.md` for the full design and roadmap.

## Setup

```bash
cd auto-apply
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
playwright install chromium          # or use your installed Chrome via channel="chrome"
```

Your private profile lives under `~/job-search/` (never in this repo):

```bash
mkdir -p ~/job-search/profile
# 1. your master resume (markdown) — source of truth for drafted answers
cp ../templates/profile/resume.md ~/job-search/profile/resume.md   # then fill it in
# 2. your PDF resume — this is the file uploaded to applications
cp /path/to/your/Resume.pdf ~/job-search/profile/

# 3. your answer bank — copy the example and fill in YOUR real answers
cp config/answer_bank.example.json ~/job-search/answer_bank.json
$EDITOR ~/job-search/answer_bank.json
```

Set your API key (used to draft open-ended answers; optional — without it those
questions just become "needs-you"):

```bash
export ANTHROPIC_API_KEY=sk-ant-...
```

## Use

```bash
cd auto-apply/src
python -m auto_apply apply "https://jobs.lever.co/<company>/<id>"
```

What happens:
1. A real Chrome window opens on the application form (your sessions persist via a
   dedicated profile dir, override with `APPLY_BROWSER_PROFILE`).
2. Standard fields + resume upload are filled automatically.
3. Open-ended questions are drafted from your resume and pre-filled.
4. The terminal prints a review summary:
   - `✓ auto` — confident, filled
   - `✎ drafted` — LLM answer, **review before submitting**
   - `✗ needs-you` — sensitive/unknown, **you must fill in the browser**
5. You finish + Submit in the browser, then type `y` to log it to
   `~/job-search/applications.json`.

## Environment knobs

| Var | Default | Purpose |
|---|---|---|
| `ANTHROPIC_API_KEY` | — | enables drafting open-ended answers |
| `APPLY_DRAFT_MODEL` | `claude-sonnet-4-6` | model used for drafting |
| `APPLY_BROWSER_PROFILE` | `~/.job-apply-browser` | persistent Chrome profile dir |
| `JOB_SEARCH_HOME` | `~/job-search` | where your private profile/data live |

## Status

Phase 1 (this): one Lever URL, end-to-end, you submit. Selectors are best-effort
and isolated in `adapters/lever.py` — easy to tweak when a form differs. Next:
Greenhouse adapter + answer-bank memory, then LinkedIn-assisted batch sourcing.
