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

// Tailors the master resume to a specific JD. Reorders/rewords EXISTING content
// only — never invents experience, numbers, or skills.
export function tailorPrompt(jd, resume) {
  return `Tailor the candidate's master resume to the job description below.
Reorder, reword, and re-emphasize content that ALREADY EXISTS in the master resume
so it matches the JD's priorities and keywords. Lead with the most relevant
experience. Do NOT add anything the master resume doesn't support — no invented
roles, numbers, skills, or claims. Keep it to roughly one page. Output clean
Markdown only — no commentary, no code fences.

=== MASTER RESUME ===
${resume}

=== JOB DESCRIPTION ===
${jd}`;
}
