import { getProfile, getSettings, setProfile, setSettings } from "../lib/storage.js";

const $ = (id) => document.getElementById(id);

const EXAMPLE_BANK = {
  basics: { name: "", email: "", phone: "", location: "", linkedin: "", github: "", portfolio: "", current_company: "" },
  work_authorization: "",
  needs_sponsorship: "",
  salary_expectation: "",
  willing_to_relocate: "",
  earliest_start_date: "",
  how_did_you_hear: "LinkedIn",
  why_this_company: "<drafted per company from your resume + the JD>",
  eeo_gender: "", eeo_race: "", eeo_veteran: "", eeo_disability: "",
  sensitive_keys: ["eeo_gender", "eeo_race", "eeo_veteran", "eeo_disability"],
};

async function load() {
  const p = await getProfile();
  const s = await getSettings();
  $("resume").value = p.resumeMarkdown || "";
  $("prefs").value = p.preferencesMarkdown || "";
  $("bank").value = Object.keys(p.answerBank || {}).length
    ? JSON.stringify(p.answerBank, null, 2)
    : "";
  $("apiKey").value = s.apiKey || "";
  $("judgeModel").value = s.judgeModel;
  $("tailorModel").value = s.tailorModel;
}

$("loadExample").onclick = (e) => {
  e.preventDefault();
  $("bank").value = JSON.stringify(EXAMPLE_BANK, null, 2);
  $("bankErr").textContent = "";
};

$("save").onclick = async () => {
  $("bankErr").textContent = "";
  let bank = {};
  const raw = $("bank").value.trim();
  if (raw) {
    try {
      bank = JSON.parse(raw);
    } catch (e) {
      $("bankErr").textContent = "Answer bank is not valid JSON: " + e.message;
      return;
    }
  }
  await setProfile({
    resumeMarkdown: $("resume").value,
    preferencesMarkdown: $("prefs").value,
    answerBank: bank,
  });
  await setSettings({
    apiKey: $("apiKey").value.trim(),
    judgeModel: $("judgeModel").value.trim() || "claude-haiku-4-5-20251001",
    tailorModel: $("tailorModel").value.trim() || "claude-sonnet-4-6",
  });
  $("saved").textContent = "Saved ✓";
  setTimeout(() => ($("saved").textContent = ""), 2000);
};

load();
