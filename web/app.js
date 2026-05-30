import { callClaude, parseJson } from "./claude.js";
import { judgePrompt, tailorPrompt, coverLetterPrompt } from "./prompt.js";
import { buildBookmarklet } from "./bookmarklet.js";

const $ = (id) => document.getElementById(id);
const LS = {
  resume: "jfc.resume",
  prefs: "jfc.prefs",
  apiKey: "jfc.apiKey",
  model: "jfc.model",
  records: "jfc.records",
};
const STATUSES = ["Interested", "Applied", "Interviewing", "Offer", "Rejected"];

// In-progress assessment for the currently pasted JD.
let current = null; // { jd, assessment, tailored, changes, coverLetter }
// Source URL of the JD when captured via the bookmarklet (else "").
let sourceUrl = "";

// --- settings persistence ---------------------------------------------------
function loadSettings() {
  $("resume").value = localStorage.getItem(LS.resume) || "";
  $("prefs").value = localStorage.getItem(LS.prefs) || "";
  $("apiKey").value = localStorage.getItem(LS.apiKey) || "";
  $("model").value = localStorage.getItem(LS.model) || "claude-haiku-4-5-20251001";
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

const getModel = () => localStorage.getItem(LS.model) || "claude-haiku-4-5-20251001";
const getResume = () => (localStorage.getItem(LS.resume) || "").trim();

// --- assess -----------------------------------------------------------------
$("assess").onclick = async () => {
  const jd = $("jd").value.trim();
  if (!jd) return setStatus("Paste a job description first.", true);
  if (!getResume()) {
    $("settings").classList.remove("hidden");
    return setStatus("Add your resume in Settings first.", true);
  }

  setStatus("Assessing…");
  $("assess").disabled = true;
  try {
    const text = await callClaude({
      apiKey: localStorage.getItem(LS.apiKey),
      model: getModel(),
      prompt: judgePrompt(jd, getResume(), localStorage.getItem(LS.prefs) || ""),
      maxTokens: 900,
    });
    current = { jd, assessment: parseJson(text), tailored: "", changes: [], coverLetter: "" };
    renderResult();
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

// --- render assessment + actions --------------------------------------------
function renderResult() {
  const a = current.assessment;
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
    ${sourceUrl ? `<div class="muted src-line">↗ <a href="${esc(sourceUrl)}" target="_blank" rel="noopener">${esc(shortUrl(sourceUrl))}</a></div>` : ""}
    <span class="verdict ${vClass}">${esc(a.verdict || "")}</span>
    ${a.verdictReason ? `<span class="muted"> ${esc(a.verdictReason)}</span>` : ""}
    ${a.visaConflict ? `<div class="flag">⚠️ Visa: ${esc(a.visaNote || "sponsorship conflict")}</div>` : ""}
    ${a.dealbreakers && a.dealbreakers.length ? `<div class="flag">⛔ ${a.dealbreakers.map(esc).join(" · ")}</div>` : ""}
    ${a.matches && a.matches.length ? `<h3>Why you match</h3>${list(a.matches)}` : ""}
    ${a.gaps && a.gaps.length ? `<h3>Gaps</h3>${list(a.gaps, "gap")}` : ""}
    ${a.missingInfo && a.missingInfo.length ? `<h3>Not stated in the posting</h3>${list(a.missingInfo)}` : ""}
    <div class="row" id="resultActions">
      <button id="tailorBtn" class="ghost">Tailor resume</button>
      <button id="saveBtn" class="ghost">Save to tracker</button>
      <span id="resultStatus" class="muted"></span>
    </div>
    <div id="tailoredOut"></div>
    <div id="coverOut"></div>
  `;
  el.classList.remove("hidden");
  $("tailorBtn").onclick = doTailor;
  $("saveBtn").onclick = saveToTracker;
  if (current.tailored) renderTailored(current.tailored, current.changes);
  if (current.coverLetter) renderCoverLetter(current.coverLetter);
  el.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

async function doTailor() {
  const btn = $("tailorBtn");
  const st = $("resultStatus");
  btn.disabled = true;
  st.textContent = "Tailoring…";
  try {
    const raw = await callClaude({
      apiKey: localStorage.getItem(LS.apiKey),
      model: getModel(),
      prompt: tailorPrompt(current.jd, getResume()),
      maxTokens: 2400,
    });
    const parsed = parseJson(raw);
    current.tailored = parsed.resume || raw; // fallback: model returned plain md
    current.changes = Array.isArray(parsed.changes) ? parsed.changes : [];
    renderTailored(current.tailored, current.changes);
    st.textContent = "";
  } catch (e) {
    st.textContent = e.message;
    st.style.color = "var(--red)";
  } finally {
    btn.disabled = false;
  }
}

function renderTailored(md, changes) {
  const a = current.assessment;
  const slug = ((a.company || "company") + "-" + (a.title || "role"))
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const changeHtml =
    changes && changes.length
      ? `<div class="changes-box">
           <div class="changes-title">What changed vs your master resume</div>
           <ul class="changes-list">${changes.map((c) => `<li>${esc(c)}</li>`).join("")}</ul>
         </div>`
      : "";
  const out = $("tailoredOut");
  out.innerHTML = `
    <h3>Tailored resume</h3>
    ${changeHtml}
    <div class="row" style="margin-top:8px">
      <a id="dlBtn" class="btnlink" download="${slug}-resume.md">Download .md</a>
      <button id="copyResumeBtn" class="ghost">Copy</button>
      <button id="coverBtn" class="ghost">Draft cover letter</button>
    </div>
    <pre id="tailoredPre"></pre>
  `;
  $("tailoredPre").textContent = md;
  const url = URL.createObjectURL(new Blob([md], { type: "text/markdown" }));
  $("dlBtn").href = url;
  $("copyResumeBtn").onclick = async () => {
    await navigator.clipboard.writeText(md);
    $("copyResumeBtn").textContent = "Copied ✓";
    setTimeout(() => ($("copyResumeBtn").textContent = "Copy"), 1500);
  };
  $("coverBtn").onclick = doCoverLetter;
}

async function doCoverLetter() {
  const btn = $("coverBtn");
  btn.disabled = true;
  btn.textContent = "Drafting…";
  try {
    const letter = await callClaude({
      apiKey: localStorage.getItem(LS.apiKey),
      model: getModel(),
      prompt: coverLetterPrompt(current.jd, getResume(), current.assessment),
      maxTokens: 700,
    });
    current.coverLetter = letter;
    renderCoverLetter(letter);
    btn.textContent = "Re-draft cover letter";
  } catch (e) {
    btn.textContent = "Draft cover letter";
    const st = $("resultStatus");
    st.textContent = e.message;
    st.style.color = "var(--red)";
  } finally {
    btn.disabled = false;
  }
}

function renderCoverLetter(letter) {
  const a = current.assessment;
  const slug = ((a.company || "company") + "-" + (a.title || "role"))
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const out = $("coverOut");
  out.innerHTML = `
    <h3>Cover letter</h3>
    <div class="row" style="margin-top:0">
      <a id="dlCoverBtn" class="btnlink" download="${slug}-cover.txt">Download .txt</a>
      <button id="copyCoverBtn" class="ghost">Copy</button>
    </div>
    <pre id="coverPre"></pre>
  `;
  $("coverPre").textContent = letter;
  const url = URL.createObjectURL(new Blob([letter], { type: "text/plain" }));
  $("dlCoverBtn").href = url;
  $("copyCoverBtn").onclick = async () => {
    await navigator.clipboard.writeText(letter);
    $("copyCoverBtn").textContent = "Copied ✓";
    setTimeout(() => ($("copyCoverBtn").textContent = "Copy"), 1500);
  };
  out.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

// --- tracker ----------------------------------------------------------------
function getRecords() {
  try { return JSON.parse(localStorage.getItem(LS.records) || "[]"); } catch { return []; }
}
function setRecords(recs) {
  localStorage.setItem(LS.records, JSON.stringify(recs));
}

function saveToTracker() {
  if (!current) return;
  const a = current.assessment;
  const recs = getRecords();
  recs.unshift({
    id: Date.now().toString(36),
    createdAt: new Date().toISOString(),
    title: a.title || "",
    company: a.company || "",
    location: a.location || "",
    verdict: a.verdict || "",
    status: "Interested",
    sourceUrl: sourceUrl || "",
    jd: current.jd,
    assessment: a,
    tailored: current.tailored || "",
    changes: current.changes || [],
    coverLetter: current.coverLetter || "",
  });
  setRecords(recs);
  renderTracker();
  const st = $("resultStatus");
  st.textContent = "Saved to tracker ✓";
  st.style.color = "var(--green)";
  setTimeout(() => (st.textContent = ""), 2000);
}

function updateRecord(id, patch) {
  const recs = getRecords().map((r) => (r.id === id ? { ...r, ...patch } : r));
  setRecords(recs);
}
function deleteRecord(id) {
  setRecords(getRecords().filter((r) => r.id !== id));
  renderTracker();
}

function renderTracker() {
  const recs = getRecords();
  const card = $("trackerCard");
  if (!recs.length) { card.classList.add("hidden"); return; }
  card.classList.remove("hidden");
  $("trackerCount").textContent = `${recs.length} saved`;

  const tracker = $("tracker");
  tracker.innerHTML = "";
  for (const r of recs) {
    const vClass =
      { "Strong fit": "v-strong", "Worth applying": "v-worth", Stretch: "v-stretch", Skip: "v-skip" }[
        r.verdict
      ] || "v-stretch";
    const row = document.createElement("div");
    row.className = "trow";
    const date = new Date(r.createdAt).toLocaleDateString();
    row.innerHTML = `
      <div class="trow-main">
        <span class="t-co">${esc(r.company || "—")}</span>
        <span class="muted"> · ${esc(r.title || "role")}</span>
        ${r.verdict ? `<span class="verdict sm ${vClass}">${esc(r.verdict)}</span>` : ""}
        ${r.sourceUrl ? `<a class="src-ico" href="${esc(r.sourceUrl)}" target="_blank" rel="noopener" title="Open job posting">↗</a>` : ""}
      </div>
      <select class="t-status">${STATUSES.map(
        (s) => `<option ${s === r.status ? "selected" : ""}>${s}</option>`
      ).join("")}</select>
      <span class="muted t-date">${date}</span>
      <button class="ghost sm t-view">View</button>
      <button class="ghost sm t-del" title="Delete">✕</button>
    `;
    row.querySelector(".t-status").onchange = (e) => updateRecord(r.id, { status: e.target.value });
    row.querySelector(".t-del").onclick = () => {
      if (confirm(`Delete ${r.company || "this"} ${r.title || ""}?`)) deleteRecord(r.id);
    };
    const detail = document.createElement("div");
    detail.className = "tdetail hidden";
    row.querySelector(".t-view").onclick = () => {
      if (detail.classList.contains("hidden")) {
        renderDetail(detail, r);
        detail.classList.remove("hidden");
      } else {
        detail.classList.add("hidden");
      }
    };
    tracker.appendChild(row);
    tracker.appendChild(detail);
  }
}

function renderDetail(el, r) {
  const a = r.assessment || {};
  const li = (items, cls = "") =>
    items && items.length ? `<ul class="${cls}">${items.map((i) => `<li>${esc(i)}</li>`).join("")}</ul>` : "";
  const changesHtml =
    r.changes && r.changes.length
      ? `<div class="changes-box">
           <div class="changes-title">What changed vs master resume</div>
           ${li(r.changes)}
         </div>`
      : "";
  el.innerHTML = `
    ${r.sourceUrl ? `<p class="muted src-line">↗ <a href="${esc(r.sourceUrl)}" target="_blank" rel="noopener">${esc(r.sourceUrl)}</a></p>` : ""}
    ${a.matches && a.matches.length ? `<h4>Why you match</h4>${li(a.matches)}` : ""}
    ${a.gaps && a.gaps.length ? `<h4>Gaps</h4>${li(a.gaps, "gap")}` : ""}
    ${r.tailored
      ? `<h4>Tailored resume</h4>
         ${changesHtml}
         <div class="row" style="margin-top:4px">
           <a class="btnlink sm" id="d-res-${r.id}" download="resume.md">Download .md</a>
         </div>
         <pre>${esc(r.tailored)}</pre>`
      : `<p class="muted">No tailored resume saved.</p>`}
    ${r.coverLetter
      ? `<h4>Cover letter</h4>
         <div class="row" style="margin-top:0">
           <a class="btnlink sm" id="d-cov-${r.id}" download="cover.txt">Download .txt</a>
         </div>
         <pre>${esc(r.coverLetter)}</pre>`
      : ""}
    <h4>Job description</h4><pre class="jd">${esc(r.jd || "")}</pre>
  `;
  if (r.tailored) {
    const url = URL.createObjectURL(new Blob([r.tailored], { type: "text/markdown" }));
    el.querySelector(`#d-res-${r.id}`).href = url;
  }
  if (r.coverLetter) {
    const url = URL.createObjectURL(new Blob([r.coverLetter], { type: "text/plain" }));
    el.querySelector(`#d-cov-${r.id}`).href = url;
  }
}

function esc(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
}

function shortUrl(u) {
  try {
    const { hostname, pathname } = new URL(u);
    const p = pathname.length > 24 ? pathname.slice(0, 24) + "…" : pathname;
    return hostname.replace(/^www\./, "") + p;
  } catch { return u; }
}

// If the user edits the JD by hand, it's no longer tied to the captured source.
$("jd").addEventListener("input", () => { sourceUrl = ""; });

// --- one-click capture (Phase 3) --------------------------------------------
// Reads a JD handed in via the URL hash (#jd=…&src=…) from the bookmarklet,
// and renders the draggable bookmarklet itself in Settings.
function importFromHash() {
  const hash = location.hash.slice(1);
  if (!hash) return;
  const params = new URLSearchParams(hash);
  const jd = params.get("jd");
  if (!jd) return;
  $("jd").value = jd;
  sourceUrl = params.get("src") || "";
  // Clear the hash so a refresh doesn't re-import.
  history.replaceState(null, "", location.pathname + location.search);
  setStatus("Captured from the job page — review, then Assess fit.");
  $("jd").scrollIntoView({ behavior: "smooth", block: "center" });
}

function setupBookmarklet() {
  const link = $("bookmarklet");
  if (!link) return;
  link.href = buildBookmarklet(location.origin);
  // Stop accidental clicks (it's meant to be dragged to the bookmarks bar).
  link.addEventListener("click", (e) => {
    e.preventDefault();
    alert("Drag this button to your bookmarks bar, then click it on any job posting.");
  });
}

loadSettings();
setupBookmarklet();
importFromHash();
renderTracker();
