---
name: apply
description: >
  Evaluate a job description against the user's profile, then tailor a resume
  for it and record the application. Use when the user runs `/apply` with a
  pasted job description (JD), or asks to assess / apply to / tailor a resume
  for a specific role. Reads the user's master resume and preferences as the
  source of truth — never invents experience.
---

# /apply — judge → tailor → record

You are helping the user decide whether to apply to a role, and if so, produce a
tailored resume and log the application. Run the three phases below in order.

## Inputs

The user invokes this with a job description, e.g. `/apply <pasted JD>` or a URL.
Before doing anything else, load the user's profile:

1. **Master resume** — `~/job-search/profile/resume.md` (source of truth for all
   experience, skills, education, dates).
2. **Preferences** — `~/job-search/profile/preferences.md` (location, comp floor,
   role types, work authorization / visa status, dealbreakers).
3. **Application log** — `~/job-search/applications.json` (array of past
   applications; create as `[]` if missing).

If `resume.md` or `preferences.md` is missing or still contains template
placeholders, STOP and tell the user to fill them in first — point them at
`~/job-search/profile/`. **Never fabricate experience, skills, or dates** that
aren't in the master resume.

If the input is a URL rather than pasted text, fetch it. If the fetch fails
(login wall, JS-rendered board), ask the user to paste the JD text directly.

## Phase 1 — Judge

Parse the JD and produce a short, honest assessment. Do not pad it.

Extract from the JD:
- Title, company, location (and remote/hybrid/onsite).
- Required years of experience and must-have skills.
- Compensation if stated.
- Visa / work-authorization language ("must be authorized to work without
  sponsorship", "no sponsorship available", "US citizen / GC only", etc.).

Then score the fit and surface flags:

- **Fit summary** — 2-4 bullets: where the user clearly matches, and the biggest
  gaps. Be candid about stretch roles; don't oversell.
- **⚠️ Visa conflict** — if the JD says no sponsorship and the user's
  `preferences.md` indicates they need sponsorship now or in the future (e.g. an
  `OPT` / `STEM-OPT` / `H-1B-needed` line), flag this prominently. This is the
  single most common silent rejection — call it out before they spend effort.
- **⚠️ Other dealbreakers** — comp below floor, wrong location, role type the
  user said they don't want.
- **Verdict** — one of: `Strong fit`, `Worth applying`, `Stretch`,
  `Skip (here's why)`.

Present this and let the user decide. If the verdict is a skip or there's a visa
conflict, ask whether they still want to proceed before tailoring.

## Phase 2 — Tailor

Only after the user wants to proceed. Produce a tailored resume in Markdown.

Rules:
- Start from the master resume. **Reorder, reword, and re-emphasize** existing
  content to match the JD's keywords and priorities. Do not add anything the
  master resume doesn't support.
- Lead with the experience and skills most relevant to this JD.
- Mirror the JD's terminology where it honestly maps to the user's experience
  (e.g. if the JD says "distributed systems" and the resume says "built a
  sharded queue", surface that bullet and use the JD's framing).
- Keep it to one page of content unless the master resume is clearly senior /
  long. Quantify impact where the master resume gives numbers.
- Output the tailored resume to
  `~/job-search/applications/<company>-<role-slug>/resume.md` and show it.

Optionally, if the user asks, draft a short cover note in the same folder
(`cover.md`) — grounded only in real experience.

## Phase 3 — Record

Append an entry to `~/job-search/applications.json`. Read the file, push a new
object, write it back (pretty-printed). Schema:

```json
{
  "company": "Stripe",
  "role": "Backend Engineer",
  "location": "Remote (US)",
  "url": "",
  "verdict": "Worth applying",
  "visa_conflict": false,
  "status": "tailored",
  "applied_date": null,
  "created_date": "2026-05-29",
  "resume_path": "applications/stripe-backend-engineer/resume.md",
  "notes": ""
}
```

- `status` starts as `tailored`. Later flows (`/applied`, `/interview`) advance it
  to `applied`, `interviewing`, `offer`, `rejected`, `withdrawn`.
- `created_date` is today; `applied_date` stays `null` until they actually submit.
- Don't duplicate an existing entry for the same company+role — if one exists,
  update it instead of appending.

After recording, give the user a one-line confirmation and the path to the
tailored resume.

## Notes

- All user data lives under `~/job-search/` (private, gitignored / separate repo).
  This skill lives globally at `~/.claude/skills/apply/`.
- Be concise in chat. The deliverables are the assessment, the tailored resume
  file, and the log entry — not a wall of narration.
