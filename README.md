# job-search-skill

A Claude Code skill (`/apply`) that turns a pasted job description into an
honest fit assessment, a tailored resume, and a logged application — grounded in
your real experience, never invented.

It runs a three-phase flow:

1. **Judge** — parses the JD, scores fit against your profile, and flags
   dealbreakers (comp, location, and especially **visa / sponsorship conflicts**).
2. **Tailor** — reorders and rewords your master resume to match the role. It
   only uses experience your master resume actually contains.
3. **Record** — logs the application to `~/job-search/applications.json` so you
   can track status and follow up later.

## Install (~2 min)

```bash
# 1. Skill goes global — usable from any directory
mkdir -p ~/.claude/skills/apply
cp skills/apply/SKILL.md ~/.claude/skills/apply/SKILL.md

# 2. Your private data folder (keep this OUT of this repo)
mkdir -p ~/job-search/profile ~/job-search/applications
cp templates/profile/resume.md      ~/job-search/profile/resume.md
cp templates/profile/preferences.md ~/job-search/profile/preferences.md
echo '[]' > ~/job-search/applications.json
```

Then fill in `~/job-search/profile/resume.md` and `preferences.md` with your real
information. The skill treats `resume.md` as the single source of truth — it will
not invent experience, skills, or dates.

## Usage

In any Claude Code session:

```
/apply <paste the job description here>
```

Claude will assess the role, ask before tailoring if it's a skip or there's a
visa conflict, then write the tailored resume to
`~/job-search/applications/<company>-<role>/resume.md` and log it.

## Layout

| Path | What it is |
|---|---|
| `skills/apply/SKILL.md` | The behavior spec Claude runs |
| `templates/profile/resume.md` | Master-resume template (your source of truth) |
| `templates/profile/preferences.md` | Preferences, incl. the visa/OPT line that drives the conflict flag |

Your actual profile and application history live under `~/job-search/`, separate
from this repo, so private data never gets committed here.

## Roadmap

- **Follow-up nudger** — read `applications.json`, surface "applied 10 days ago,
  no reply", draft a follow-up.
- **Status commands** — `/applied <company>`, `/interview <company>` to advance
  status without hand-editing JSON.
- **URL ingestion** — paste a Greenhouse / Lever link, auto-fetch the JD.
