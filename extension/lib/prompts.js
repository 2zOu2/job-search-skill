// Prompt templates, ported from skills/apply/SKILL.md and the Python co-pilot.
// All grounded strictly in the user's master resume — never invent experience.

export function judgePrompt(jd, resumeMarkdown, preferencesMarkdown) {
  return `You are helping a candidate decide whether to apply to a role. Assess
fit honestly and briefly — do not pad. Use ONLY the candidate's resume and
preferences below; never invent experience.

Return your answer as JSON with this exact shape:
{
  "title": "", "company": "", "location": "",
  "fit": ["2-4 short bullets: where they match and the biggest gaps"],
  "visaConflict": false,
  "visaNote": "one line if the JD says no sponsorship and prefs need it, else empty",
  "dealbreakers": ["comp below floor / wrong location / unwanted role type, if any"],
  "verdict": "Strong fit | Worth applying | Stretch | Skip"
}
Output ONLY the JSON, no prose.

=== CANDIDATE RESUME ===
${resumeMarkdown}

=== CANDIDATE PREFERENCES ===
${preferencesMarkdown || "(none provided)"}

=== JOB DESCRIPTION ===
${jd}`;
}

export function tailorPrompt(jd, resumeMarkdown) {
  return `Tailor the candidate's master resume to the job description below.
Reorder, reword, and re-emphasize EXISTING content to match the JD's keywords and
priorities. Do NOT add anything the master resume doesn't support — no invented
experience, numbers, or skills. Lead with the most relevant experience. Keep it
to about one page. Output clean Markdown only, no commentary.

=== MASTER RESUME ===
${resumeMarkdown}

=== JOB DESCRIPTION ===
${jd}`;
}

export function draftAnswerPrompt(question, resumeMarkdown, jobContext) {
  return `You are drafting an answer to a job-application question on behalf of the
candidate. Use ONLY facts supported by the resume below — never invent experience,
numbers, or claims. Write in the first person, concise and specific (2-5 sentences
unless the question implies longer). No preamble, just the answer text.

=== CANDIDATE RESUME ===
${resumeMarkdown}

=== JOB CONTEXT ===
${jobContext || "(none provided)"}

=== QUESTION ===
${question}`;
}
