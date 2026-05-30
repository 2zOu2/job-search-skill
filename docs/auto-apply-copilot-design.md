# Auto-Apply Co-pilot — Design (v1: Greenhouse / Lever)

A semi-automated job-application assistant. It does the tedious 95% — open the
application page, fill known fields from your profile, upload your resume, draft
answers to open-ended questions — then **stops and hands control to you** to
review, fix sensitive answers, clear any CAPTCHA, and click **Submit**.

Chosen scope (per user): **human-in-the-loop**, **Greenhouse + Lever first**.

It reuses the profile and `/apply` logic already in this repo: the master resume
(`resume.md`), preferences, the judge/tailor prompts, and the `applications`
schema.

---

## 1. Why human-in-the-loop (and not lights-out)

Fully unattended cross-site submission is **not reliably achievable** and is
high-risk: per-company form variation, CAPTCHAs/bot detection, and — most
importantly — **sensitive questions** (work authorization / sponsorship, salary,
EEO) that must not be auto-answered wrong, because submission is irreversible and
a wrong visa answer can read as misrepresentation. So the contract is:

> The tool fills everything it's confident about and drafts the rest.
> **You always press Submit.** Anything sensitive or low-confidence is flagged.

---

## 2. Pipeline

```
[1] SOURCE          [2] FILTER         [3] PREP (per job)        [4] REVIEW GATE
LinkedIn recommended → recent (≈ today) → open Greenhouse/Lever → you check, fix,
jobs (your session)   top ~10            form, autofill, draft     CAPTCHA, SUBMIT
                                          answers, upload resume         │
                                                                         ▼
                                                              [5] LOG → applications.json
```

**Step 1 — Source (LinkedIn).** Note: automating LinkedIn account actions is
against LinkedIn's User Agreement and risks account limits. To stay low-risk in
v1, sourcing is **assisted, not headless-scraped**: the tool opens your
*Recommended* page in your real browser session; you skim, and it collects the
**external apply links** (a large share of LinkedIn jobs link out to
Greenhouse/Lever). We deliberately don't hammer LinkedIn with a bot.

**Step 2 — Filter.** Keep postings whose listed date is within N days of today
(default ~3), cap at 10.

**Step 3 — Prep (the automated part).** For each Greenhouse/Lever URL:
- Map standard fields from profile (name, email, phone, LinkedIn, resume upload).
- For each remaining question, try the **answer bank** (see §4); if no match,
  draft an answer with Claude grounded in `resume.md` (e.g. "Why this company?").
- Mark every field as `auto` (confident), `drafted` (LLM, review me), or
  `needs-you` (sensitive/unknown).

**Step 4 — Review gate.** The browser sits on the filled form. A side overlay
lists what was filled, highlights `drafted` / `needs-you` fields, and shows
sensitive answers (visa/sponsorship/salary/EEO) prominently. You edit inline,
solve any CAPTCHA, and click the real **Submit**.

**Step 5 — Log.** Append to `applications.json` (status `applied`, with the URL
and the answers used).

---

## 3. Tech

- **Playwright** driving a **persistent browser context** = your real, logged-in
  Chrome profile, so your LinkedIn/company sessions and cookies persist and you
  look like a normal user (not a fresh headless bot).
- **Node or Python** runner. Adapters per ATS. Claude API for drafting answers.
- Runs **locally on your machine** — your data and credentials never leave it.

Why not a Chrome extension here: cross-site form driving + reading session state +
file uploads + pausing/resuming is much cleaner in Playwright than in MV3.

---

## 4. The answer bank (what makes it fast over time)

A local store of your confirmed answers to recurring questions, so the second
application is mostly pre-filled:

```jsonc
{
  "work_authorization": "Authorized to work in the US (F-1 OPT)",   // EDIT to your truth
  "needs_sponsorship": "Yes — will require sponsorship in the future",
  "salary_expectation": "",            // leave blank → always needs-you
  "willing_to_relocate": "Yes",
  "eeo_gender": "", "eeo_race": "", "eeo_veteran": "", "eeo_disability": "",
  "why_this_company": "<LLM drafts per-company from resume + JD>"
}
```

- **Exact/known fields** → auto-filled.
- **Sensitive fields** (salary, EEO, visa) → default to `needs-you` even if a value
  exists, so you consciously confirm each time.
- Bank grows: when you confirm a new answer at the review gate, it's offered to
  remember for next time.

---

## 5. ATS adapters (v1)

| ATS | Form shape | Notes |
|---|---|---|
| **Lever** (`jobs.lever.co/<co>/<id>/apply`) | Standard fields + custom "cards" | Clean DOM, stable selectors. Good first target. |
| **Greenhouse** (`boards.greenhouse.io/<co>/jobs/<id>` / `job_app`) | Labeled fields + custom questions | Structured; questions carry labels we map on. |

Each adapter exposes: `detect(url)`, `extractQuestions(page)`,
`fillField(page, field, value)`, `locateSubmit(page)`. Adding iCIMS/Workday later
= new adapters, same interface.

---

## 6. Storage / schema

Reuses the repo's `applications` schema, plus answers used:

```jsonc
{
  "company": "...", "role": "...", "url": "...",
  "ats": "greenhouse",
  "status": "applied",
  "appliedDate": "2026-05-30",
  "answers": { "why_this_company": "...", "...": "..." },
  "review": { "auto": 7, "drafted": 2, "editedByUser": 1 }
}
```

Profile (`resume.md`, preferences, answer bank) stays under `~/job-search/`,
private and git-ignored.

---

## 7. Risks & limits (be honest in the UI)

- **LinkedIn ToS / account risk** — keep sourcing assisted and gentle; never a
  high-rate headless scraper. Use sparingly.
- **CAPTCHA / bot detection** — the tool stops and lets you solve it; it does not
  try to defeat CAPTCHAs.
- **Sensitive answers** — always routed to you; never auto-submitted blind.
- **Form variation** — even within Greenhouse/Lever, custom questions vary;
  unknown questions degrade gracefully to `needs-you`, never a wrong guess.
- **No mass spam** — capped at ~10 and gated by your Submit, by design; this is a
  speed-up of deliberate applications, not a blast cannon.

---

## 8. Phased plan

- **Phase 1 — One Lever form, end-to-end.** Given a Lever apply URL: autofill
  standard fields + resume upload, draft open questions, open the review overlay,
  you submit. Log it. (Proves the whole loop on the easiest ATS.)
- **Phase 2 — Greenhouse adapter** + the answer bank with memory.
- **Phase 3 — Batch + source.** LinkedIn-assisted collection of recent recommended
  jobs → queue of ~10 → run them one-by-one through the review gate.
- **Phase 4 — More ATS** (iCIMS, then Workday), PDF resume per application,
  follow-up nudger.

---

## 9. Open decisions before building Phase 1

1. **Runner language:** Node (TypeScript) or Python? (Both fine; pick what you'd
   rather maintain.)
2. **Answer-bank seed:** want me to pre-fill it from your resume + a few
   questions (esp. your real visa/sponsorship wording)?
3. **Resume file for upload:** keep your existing PDF as the upload artifact, or
   also generate a tailored PDF per job (more work)?
