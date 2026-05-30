// Answer-bank resolution, ported from the Python co-pilot.
// Classifies each question into auto | draft-needed | needs-you.
window.JAC = window.JAC || {};

const KEYWORD_MAP = [
  [/sponsor/i, "needs_sponsorship"],
  [/authoriz|work permit|eligible to work|legally/i, "work_authorization"],
  [/salary|compensation|expected pay|desired pay/i, "salary_expectation"],
  [/relocat/i, "willing_to_relocate"],
  [/start date|available/i, "earliest_start_date"],
  [/notice period/i, "notice_period"],
  [/hear about|referr|source/i, "how_did_you_hear"],
  [/gender/i, "eeo_gender"],
  [/race|ethnic/i, "eeo_race"],
  [/veteran/i, "eeo_veteran"],
  [/disab/i, "eeo_disability"],
  [/why.*(company|role|position|interest|join)/i, "why_this_company"],
];

function matchKey(label) {
  for (const [re, key] of KEYWORD_MAP) if (re.test(label)) return key;
  return null;
}

// Returns { value, confidence, key }.
//   confidence: "auto" (fill it), "draft-needed" (ask Claude), "needs-you" (leave).
JAC.resolveAnswer = function (label, qtype, bank) {
  const sensitive = new Set(bank.sensitive_keys || []);
  const key = matchKey(label);

  if (key && sensitive.has(key)) {
    // surface a suggestion but never auto-fill sensitive answers
    return { value: bank[key] || "", confidence: "needs-you", key };
  }
  if (key) {
    const val = bank[key];
    if (val && key === "why_this_company") return { value: "", confidence: "draft-needed", key };
    if (val) return { value: String(val), confidence: "auto", key };
  }
  if (qtype === "textarea") return { value: "", confidence: "draft-needed", key };
  return { value: "", confidence: "needs-you", key };
};
