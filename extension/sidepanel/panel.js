import { getProfile } from "../lib/storage.js";

const $ = (id) => document.getElementById(id);
const statusEl = $("status");
const resultEl = $("result");

function setStatus(msg, isErr = false) {
  statusEl.textContent = msg || "";
  statusEl.className = "status" + (isErr ? " err" : "");
}

async function activeTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function toTab(msg) {
  const tab = await activeTab();
  try {
    return await chrome.tabs.sendMessage(tab.id, msg);
  } catch (e) {
    throw new Error("Open a Lever or Greenhouse page first.");
  }
}

async function toBg(msg) {
  const resp = await chrome.runtime.sendMessage(msg);
  if (!resp) throw new Error("No response from background.");
  if (!resp.ok) throw new Error(resp.error);
  return resp.data;
}

// --- page context -----------------------------------------------------------
async function refreshContext() {
  try {
    const ctx = await toTab({ type: "getContext" });
    if (!ctx.ok) throw new Error(ctx.error);
    const d = ctx.data;
    $("context").textContent = `Detected: ${d.adapter}${d.isApplyForm ? " application form" : " job posting"}`;
    $("autofill").disabled = !d.isApplyForm;
  } catch (e) {
    $("context").textContent = "Not a supported page (open a Lever/Greenhouse job).";
    $("judge").disabled = $("tailor").disabled = $("autofill").disabled = true;
  }
}

// --- actions ----------------------------------------------------------------
$("judge").onclick = async () => {
  resultEl.innerHTML = "";
  setStatus("Reading job + judging fit…");
  try {
    const { data } = await toTab({ type: "extractJD" });
    const a = await toBg({ type: "judge", jd: data.jd });
    renderJudge(a);
    setStatus("");
  } catch (e) {
    setStatus(e.message, true);
  }
};

$("tailor").onclick = async () => {
  resultEl.innerHTML = "";
  setStatus("Tailoring your resume…");
  try {
    const { data } = await toTab({ type: "extractJD" });
    const md = await toBg({ type: "tailor", jd: data.jd });
    renderTailor(md, data.meta);
    setStatus("");
  } catch (e) {
    setStatus(e.message, true);
  }
};

$("autofill").onclick = async () => {
  resultEl.innerHTML = "";
  setStatus("Filling the form…");
  try {
    const profile = await getProfile();
    const { data } = await toTab({ type: "autofill", bank: profile.answerBank });
    renderReport(data.report);
    setStatus("Filled. Review in the page, then submit yourself.");
  } catch (e) {
    setStatus(e.message, true);
  }
};

$("opts").onclick = () => chrome.runtime.openOptionsPage();

// --- rendering --------------------------------------------------------------
function renderJudge(a) {
  const vClass = { "Strong fit": "v-strong", "Worth applying": "v-worth", Stretch: "v-stretch", Skip: "v-skip" };
  const el = document.createElement("div");
  el.innerHTML = `
    <div><strong>${esc(a.title || "")}</strong> — ${esc(a.company || "")} ${a.location ? "· " + esc(a.location) : ""}</div>
    <div class="verdict ${vClass[a.verdict] || ""}">${esc(a.verdict || "")}</div>
    ${a.visaConflict ? `<div class="flag">⚠️ Visa conflict: ${esc(a.visaNote || "")}</div>` : ""}
    ${(a.dealbreakers || []).length ? `<div class="flag">⚠️ ${a.dealbreakers.map(esc).join("; ")}</div>` : ""}
    <ul>${(a.fit || []).map((f) => `<li>${esc(f)}</li>`).join("")}</ul>`;
  resultEl.appendChild(el);
}

function renderTailor(md, meta) {
  const el = document.createElement("div");
  const pre = document.createElement("pre");
  pre.textContent = md;
  const dl = document.createElement("button");
  dl.textContent = "Download .md";
  dl.onclick = () => {
    const slug = ((meta?.company || "company") + "-" + (meta?.role || "role")).toLowerCase().replace(/[^a-z0-9]+/g, "-");
    const url = URL.createObjectURL(new Blob([md], { type: "text/markdown" }));
    chrome.downloads.download({ url, filename: `${slug}-resume.md` });
  };
  el.appendChild(dl);
  el.appendChild(pre);
  resultEl.appendChild(el);
}

function renderReport(report) {
  const icon = { auto: ["✓", "t-auto"], drafted: ["✎", "t-drafted"], "needs-you": ["✗", "t-needs"] };
  const notice = document.createElement("div");
  notice.className = "notice";
  notice.textContent = "✓ filled · ✎ drafted (review) · ✗ you must do it in the page (incl. resume upload & sensitive fields)";
  resultEl.appendChild(notice);
  for (const f of report) {
    const [sym, cls] = icon[f.confidence] || ["?", ""];
    const row = document.createElement("div");
    row.className = "row";
    const v = f.value && f.value.length > 80 ? f.value.slice(0, 80) + "…" : f.value || "";
    row.innerHTML = `<span class="tag ${cls}">${sym}</span>${esc(f.label)}${v ? ": " + esc(v) : ""}${f.filled ? "" : ' <em class="muted">(not filled)</em>'}`;
    resultEl.appendChild(row);
  }
}

function esc(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
}

refreshContext();
chrome.tabs.onActivated.addListener(refreshContext);
chrome.tabs.onUpdated.addListener(refreshContext);
