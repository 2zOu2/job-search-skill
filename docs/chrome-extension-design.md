# Chrome Extension Design — Job Apply Assistant

A browser extension that brings the `/apply` flow (**judge → tailor → record**)
to the page where the job actually lives. Click the extension on a job posting →
it reads the JD → assesses fit against your profile (with the visa-conflict flag)
→ on your go-ahead, tailors your resume and logs the application.

This document is the v1 design. It reuses the prompt logic already specified in
`skills/apply/SKILL.md` — the extension is a new delivery surface, not new logic.

---

## 1. Goals & non-goals

**Goals**
- One-click JD capture from common job boards (no copy-paste).
- Honest fit assessment + prominent visa/sponsorship conflict flag.
- Resume tailoring grounded strictly in the user's master resume.
- Local application log the user owns.

**Non-goals (v1)**
- Auto-filling application forms / auto-submitting.
- A hosted backend or multi-user accounts.
- Storing the user's data on any server (everything stays local).

---

## 2. Architecture (Manifest V3)

```
┌──────────────────────────────────────────────────────────────┐
│  Job posting page (LinkedIn / Greenhouse / Lever / Indeed …)  │
│                                                                │
│   content script ──(extract JD: title, company, body, visa)──┐ │
└──────────────────────────────────────────────────────────────┼─┘
                                                               │
        ┌──────────────────────────────────────────────────────▼─────┐
        │  Side panel (chrome.sidePanel) — main UI                    │
        │   • Judge result + ⚠️ flags                                 │
        │   • "Tailor" button → tailored resume (view / download)     │
        │   • Application log + status                                │
        └───────────────┬───────────────────────────┬────────────────┘
                        │                            │
            ┌───────────▼─────────┐      ┌───────────▼──────────────┐
            │ background (service │      │ chrome.storage.local     │
            │ worker)             │      │  • master resume (md)    │
            │  • calls Claude API │      │  • preferences           │
            │  • routes models    │      │  • applications[]        │
            │  • holds prompts    │      │  • API key (see §7)      │
            └─────────────────────┘      └──────────────────────────┘
```

**Why a side panel, not a popup:** the assessment + tailored resume is too much
content for a popup, and a popup closes when you click back to the page. The side
panel stays open next to the posting. (Popup kept only as a quick "capture this
JD" entry point.)

---

## 3. Components

| Component | Responsibility |
|---|---|
| `content/extract.js` | Per-site JD extraction + generic fallback (user selects text). |
| `sidepanel/` | The main UI: judge → tailor → record, plus settings & log. |
| `background/worker.js` | Calls the Claude API, holds the prompt templates, routes models, never blocks the UI. |
| `lib/prompts.js` | The judge & tailor prompts, ported from `SKILL.md`. |
| `lib/storage.js` | Typed wrappers over `chrome.storage.local`. |
| `options/` | First-run setup: paste master resume (md), fill preferences, enter API key. |

---

## 4. JD extraction strategy

Job boards have stable-ish DOM structures, so we use per-site adapters with a
generic fallback:

| Site | Approach |
|---|---|
| LinkedIn | Adapter targeting the job-details container; expand "see more" first. |
| Greenhouse (`boards.greenhouse.io`) | Adapter on the posting body; clean, semantic markup. |
| Lever (`jobs.lever.co`) | Adapter on the description sections. |
| Indeed | Adapter on the job-description pane. |
| **Anything else** | **Fallback:** user highlights the JD text and clicks "Capture selection", or pastes manually. |

Each adapter returns a normalized object:

```js
{ title, company, location, workMode, body, sponsorshipText, url }
```

`sponsorshipText` = any line matching visa/authorization patterns
("no sponsorship", "must be authorized…", "US citizen/GC only", "will not
sponsor"). Surfacing it explicitly makes the visa flag reliable instead of
hoping the model notices.

> Adapters are the part most likely to break when sites change their markup.
> Keep them small, isolated, and easy to update; always fall back to manual.

---

## 5. The flow, mapped to UI

1. **Capture** — user clicks the extension on a posting. Content script extracts
   the JD; side panel opens showing the parsed title/company/location for a
   quick sanity check (with an "edit / re-capture" affordance).
2. **Judge** — background worker calls Claude (cheaper model) with the JD +
   master resume + preferences. Side panel renders: fit bullets, ⚠️ visa
   conflict, ⚠️ other dealbreakers, and a verdict
   (`Strong fit` / `Worth applying` / `Stretch` / `Skip`).
3. **Tailor** — only on the user's click (and a confirm if it's a Skip/visa
   conflict). Worker calls Claude (stronger model) to reorder/reword the master
   resume for this JD. Output shown in-panel; **download as Markdown** (PDF
   export is a later add-on, see §9).
4. **Record** — appends to `applications[]` in local storage with status
   `tailored`. The log tab lists everything with status chips and lets the user
   advance status (`applied` / `interviewing` / `offer` / `rejected`).

This is the same three-phase contract as `SKILL.md`; the prompts are shared.

---

## 6. Model routing (cost control)

| Phase | Model | Why |
|---|---|---|
| Judge | **Haiku** | Cheap, fast; classification + flagging doesn't need a big model. |
| Tailor | **Sonnet** | Better writing quality where it actually matters. |

User can override the models in settings. Rough cost stays in the
"a few dollars for hundreds of applications" range (see project README / earlier
estimate).

---

## 7. Privacy & security

- **All user data stays in `chrome.storage.local`** — resume, preferences, and
  application log never leave the browser except as part of an API call the user
  triggers.
- **API key:** stored locally. Be honest in the UI that it lives in extension
  storage (not OS-keychain-grade). The cleanest hardening path is an optional
  user-run proxy that holds the key server-side — out of scope for v1, noted in
  roadmap.
- **API calls go directly browser → Anthropic** over HTTPS. The only data sent is
  the JD + the user's own resume/preferences, for the explicit assessment/tailor
  action.
- Extension permissions kept minimal: `storage`, `sidePanel`, `activeTab`/
  `scripting`, and host permissions only for the supported job boards.

---

## 8. Storage schema

```jsonc
// chrome.storage.local
{
  "profile": {
    "resumeMarkdown": "…",      // the master resume (from your PDF → md)
    "preferences": {
      "visaStatus": "F-1 OPT",
      "needsSponsorship": "future",
      "titles": ["Biostatistician", "Clinical Data Analyst"],
      "locations": ["Atlanta", "Remote (US)"],
      "compFloor": null,
      "dealbreakers": []
    }
  },
  "settings": { "apiKey": "…", "judgeModel": "haiku", "tailorModel": "sonnet" },
  "applications": [
    {
      "id": "uuid",
      "company": "…", "role": "…", "location": "…", "url": "…",
      "verdict": "Worth applying", "visaConflict": false,
      "status": "tailored",        // tailored→applied→interviewing→offer/rejected
      "createdDate": "2026-05-30", "appliedDate": null,
      "tailoredResumeMarkdown": "…", "notes": ""
    }
  ]
}
```

Mirrors the `applications.json` schema in `SKILL.md`, so the skill and the
extension stay interchangeable / exportable.

---

## 9. Tech choices

- **Manifest V3** (required for new Chrome extensions).
- **UI:** start with plain HTML/CSS/JS to keep it lightweight; move to a small
  framework (e.g. Preact/React via Vite) only if the side panel UI grows.
- **Build:** Vite for bundling the side panel + background worker.
- **Markdown rendering:** a tiny md-to-HTML lib for the in-panel preview.
- **PDF export (later):** render the tailored Markdown to a styled PDF in-browser
  — deferred because matching nice resume typography is real work.

---

## 10. Phased plan

**Phase 0 — Setup & data (✅ partly done)**
- Master resume already converted to Markdown. Define preferences.

**Phase 1 — MVP (manual capture, judge only)**
- Options page (paste resume md, fill preferences, enter API key).
- Side panel: paste-JD box → Judge → show assessment + visa flag.
- No site adapters yet; manual paste only. Proves the core loop end-to-end.

**Phase 2 — Tailor + record**
- Add the Tailor step (download tailored resume md).
- Add the application log with status tracking.

**Phase 3 — One-click capture**
- Content-script adapters for LinkedIn / Greenhouse / Lever / Indeed + fallback
  selection capture.

**Phase 4 — Polish**
- PDF export, follow-up nudger (reuse roadmap), model/settings tuning, optional
  proxy for the API key.

---

## 11. Open decisions (need your input before building)

1. **API access:** your own Anthropic API key in the extension (simplest) vs. a
   self-hosted proxy (safer, more work)?
2. **Which job boards first** for one-click capture? (LinkedIn is most common but
   has the most fragile DOM.)
3. **Tailored-resume output:** Markdown download is enough for v1, or do you need
   a polished PDF from the start (more work)?
4. **Stack:** plain JS MVP first, or set up Vite + a small framework up front?
