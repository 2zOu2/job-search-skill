// Builds the fit-assessment prompt. General-purpose: works for any pasted job
// description from any source. Grounded strictly in the user's resume.

export function judgePrompt(jd, resume, prefs) {
  return `You assess whether a candidate should apply to a job. Be honest and
concise — do not pad or flatter. Use ONLY the resume and preferences below; never
invent experience the resume doesn't support.

The job description is pasted text from an arbitrary source — it may be messy or
partial. Extract what you can; leave a field blank ("") if it isn't stated.

Return ONLY valid JSON, no prose, with this exact shape:
{
  "title": "",
  "company": "",
  "location": "",
  "matches": ["2-4 specific strengths the candidate has for THIS role"],
  "gaps": ["1-3 real gaps or stretches; [] if none worth noting"],
  "visaConflict": false,
  "visaNote": "one line ONLY if the JD rules out sponsorship and prefs need it",
  "dealbreakers": ["comp below floor / wrong location / role type mismatch, if any"],
  "missingInfo": ["important things the JD didn't state, e.g. salary, location"],
  "verdict": "Strong fit",
  "verdictReason": "one sentence explaining the verdict"
}

"verdict" MUST be exactly one of: "Strong fit", "Worth applying", "Stretch", "Skip".

=== RESUME ===
${resume}

=== PREFERENCES ===
${prefs || "(none provided)"}

=== JOB DESCRIPTION ===
${jd}`;
}

// Tailors the master resume and explains every change made.
// Returns JSON {resume, changes} in one call — no extra API round-trip.
export function tailorPrompt(jd, resume) {
  return `Tailor the candidate's master resume to the job description below.
Reorder, reword, and re-emphasize content that ALREADY EXISTS in the master resume
so it matches the JD's priorities and keywords. Lead with the most relevant
experience. Do NOT add anything the master resume doesn't support — no invented
roles, numbers, skills, or claims. Keep it to roughly one page.

Return ONLY valid JSON with this exact shape (no prose, no code fences):
{
  "resume": "<full tailored resume in Markdown>",
  "changes": [
    "short bullet describing each meaningful change vs the master resume"
  ]
}

"changes" should have 3-8 bullets that are specific and honest, e.g.:
- "Moved the Projects section above Work Experience to lead with technical work"
- "Replaced 'built dashboards' with 'built real-time analytics dashboards' to match JD keyword"
- "Removed internship from 2019 — not relevant to this role"
If a section was left untouched, don't mention it.

=== MASTER RESUME ===
${resume}

=== JOB DESCRIPTION ===
${jd}`;
}

// Drafts a cover letter grounded strictly in the resume and tailored to the JD.
export function coverLetterPrompt(jd, resume, assessment) {
  const role = assessment?.title || "this role";
  const company = assessment?.company || "the company";
  return `Write a cover letter for ${role} at ${company}.

Rules:
- Use ONLY experience and facts from the resume below — never invent anything.
- 3 paragraphs: (1) why this role / company specifically, drawing on the JD;
  (2) the 2-3 most relevant experiences from the resume, specific and concrete;
  (3) brief closing.
- Confident and direct — no hollow phrases like "I am excited to apply" or
  "I believe I would be a great fit".
- Plain text, ~250-350 words. No placeholders like [Your Name].
- Do NOT include a salutation line or a sign-off — just the 3 paragraphs.

=== RESUME ===
${resume}

=== JOB DESCRIPTION ===
${jd}`;
}
