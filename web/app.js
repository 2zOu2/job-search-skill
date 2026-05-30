import { callClaude, parseJson } from "./claude.js";
import { judgePrompt } from "./prompt.js";

const $ = (id) => document.getElementById(id);
const LS = {
  resume: "jfc.resume",
  prefs: "jfc.prefs",
  apiKey: "jfc.apiKey",
  model: "jfc.model",
};

// --- settings persistence ---------------------------------------------------
function loadSettings() {
  $("resume").value = localStorage.getItem(LS.resume) || "";
  $("prefs").value = localStorage.getItem(LS.prefs) || "";
  $("apiKey").value = localStorage.getItem(LS.apiKey) || "";
  $("model").value = localStorage.getItem(LS.model) || "claude-haiku-4-5-20251001";
  // First run with no resume → open settings so the user knows what to do.
  if (!localStorage.getItem(LS.resume)) $("settings").classList.remove("hidden");
}

$("saveSettings").onclick = () => {
  localStorage.setItem(LS.resume, $("resume").value);
  localStorage.setItem(LS.prefs, $("prefs").value);
  localStorage.setItem(LS.apiKey, $("apiKey").value.trim());
  localStorage.setItem(LS.model, $("model").value);
  const note = $("savedNote");
  note.textContent = "Saved ✓";
  setTimeout(() => (note.textContent = ""), 2000);
};

$("toggleSettings").onclick = () => $("settings").classList.toggle("hidden");

// --- assess loop ------------------------------------------------------------
$("assess").onclick = async () => {
  const jd = $("jd").value.trim();
  const resume = (localStorage.getItem(LS.resume) || "").trim();
  if (!jd) return setStatus("Paste a job description first.", true);
  if (!resume) {
    $("settings").classList.remove("hidden");
    return setStatus("Add your resume in Settings first.", true);
  }

  setStatus("Assessing…");
  $("assess").disabled = true;
  try {
    const text = await callClaude({
      apiKey: localStorage.getItem(LS.apiKey),
      model: localStorage.getItem(LS.model) || "claude-haiku-4-5-20251001",
      prompt: judgePrompt(jd, resume, localStorage.getItem(LS.prefs) || ""),
      maxTokens: 900,
    });
    render(parseJson(text));
    setStatus("");
  } catch (e) {
    setStatus(e.message, true);
  } finally {
    $("assess").disabled = false;
  }
};

function setStatus(msg, isErr = false) {
  const s = $("status");
  s.textContent = msg;
  s.style.color = isErr ? "var(--red)" : "var(--muted)";
}

// --- render -----------------------------------------------------------------
function render(a) {
  const vClass =
    { "Strong fit": "v-strong", "Worth applying": "v-worth", Stretch: "v-stretch", Skip: "v-skip" }[
      a.verdict
    ] || "v-stretch";

  const list = (items, cls = "") =>
    items && items.length
      ? `<ul class="${cls}">${items.map((i) => `<li>${esc(i)}</li>`).join("")}</ul>`
      : "";

  const headBits = [a.company, a.location].filter(Boolean).map(esc).join(" · ");

  const el = $("result");
  el.innerHTML = `
    <div class="head-line">
      <strong>${esc(a.title || "Untitled role")}</strong>${headBits ? " — " + headBits : ""}
    </div>
    <span class="verdict ${vClass}">${esc(a.verdict || "")}</span>
    ${a.verdictReason ? `<span class="muted"> ${esc(a.verdictReason)}</span>` : ""}
    ${a.visaConflict ? `<div class="flag">⚠️ Visa: ${esc(a.visaNote || "sponsorship conflict")}</div>` : ""}
    ${a.dealbreakers && a.dealbreakers.length ? `<div class="flag">⛔ ${a.dealbreakers.map(esc).join(" · ")}</div>` : ""}
    ${a.matches && a.matches.length ? `<h3>Why you match</h3>${list(a.matches)}` : ""}
    ${a.gaps && a.gaps.length ? `<h3>Gaps</h3>${list(a.gaps, "gap")}` : ""}
    ${a.missingInfo && a.missingInfo.length ? `<h3>Not stated in the posting</h3>${list(a.missingInfo)}` : ""}
  `;
  el.classList.remove("hidden");
  el.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function esc(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
}

loadSettings();
