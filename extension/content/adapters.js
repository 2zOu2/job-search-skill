// ATS adapters for the content script. DOM-based; one object per ATS.
window.JAC = window.JAC || {};

function radioLabel(inp) {
  if (inp.value) return inp.value;
  const p = inp.closest("label") || inp.parentElement;
  return JAC.txt(p);
}

// ---------------------------------------------------------------- Lever ------
const Lever = {
  name: "lever",
  detect: (url) => /^https?:\/\/jobs\.lever\.co\//i.test(url),
  isApplyForm: () => !!document.querySelector("form#application-form, .application-form, input[name='name']"),

  extractJD() {
    const parts = [];
    const t = document.querySelector(".posting-headline h2");
    if (t) parts.push("Title: " + JAC.txt(t));
    const loc = document.querySelector(".posting-categories .location, .location");
    if (loc) parts.push("Location: " + JAC.txt(loc));
    const body = document.querySelector(".section-wrapper, [data-qa='job-description'], .content");
    parts.push(JAC.txt(body) || document.body.innerText);
    return parts.join("\n").slice(0, 12000);
  },

  fillBasics(bank) {
    const b = bank.basics || {};
    const map = [
      ["input[name='name']", "name", b.name],
      ["input[name='email']", "email", b.email],
      ["input[name='phone']", "phone", b.phone],
      ["input[name='org']", "current company", b.current_company],
      ["input[name='urls[LinkedIn]']", "LinkedIn", b.linkedin],
      ["input[name='urls[GitHub]']", "GitHub", b.github],
      ["input[name='urls[Portfolio]']", "Portfolio", b.portfolio],
    ];
    const out = [];
    for (const [sel, label, val] of map) {
      const el = document.querySelector(sel);
      if (el && val) out.push({ label, value: val, confidence: "auto", filled: JAC.fillText(el, val) });
    }
    return out;
  },

  extractQuestions() {
    const STD = new Set(["name", "email", "phone", "org", "resume", "comments", "pronouns"]);
    const STD_LABEL = /^(full name|name|email|phone|current company|current location|linkedin|twitter|github|portfolio|other website|resume|cv)\b/i;
    const qs = [];
    for (const blk of document.querySelectorAll(".application-question")) {
      const label = JAC.txt(blk.querySelector(".application-label, label, .text"));
      if (!label) continue;
      const field = blk.querySelector("input:not([type=hidden]), textarea, select");
      const name = (field && field.getAttribute("name")) || "";
      if (STD.has(name) || name.startsWith("urls[") || STD_LABEL.test(label)) continue;
      qs.push(buildQuestion(blk, label));
    }
    return qs;
  },

  fillQuestion: fillInBlock,
  parseMeta() {
    const company = JAC.txt(document.querySelector(".main-header-logo img"))
      || (document.querySelector(".main-header-logo img")?.alt || "");
    return { company, role: (document.title || "").split(" - ")[0].trim() };
  },
};

// ------------------------------------------------------------ Greenhouse -----
const Greenhouse = {
  name: "greenhouse",
  detect: (url) => /^https?:\/\/(boards|job-boards)(\.[a-z]{2})?\.greenhouse\.io\//i.test(url),
  isApplyForm: () => !!document.querySelector("#first_name, #application_form, form[id*='application']"),

  extractJD() {
    const t = document.querySelector(".app-title, h1");
    const body = document.querySelector("#content, .job__description, #job_description, main");
    return ((t ? "Title: " + JAC.txt(t) + "\n" : "") + (JAC.txt(body) || document.body.innerText)).slice(0, 12000);
  },

  fillBasics(bank) {
    const b = bank.basics || {};
    const parts = (b.name || "").trim().split(/\s+/);
    const first = parts[0] || "";
    const last = parts.slice(1).join(" ");
    const map = [
      ["#first_name", "first name", first],
      ["#last_name", "last name", last],
      ["#email", "email", b.email],
      ["#phone", "phone", b.phone],
    ];
    const out = [];
    for (const [sel, label, val] of map) {
      const el = document.querySelector(sel);
      if (el && val) out.push({ label, value: val, confidence: "auto", filled: JAC.fillText(el, val) });
    }
    return out;
  },

  extractQuestions() {
    const STD = new Set(["first_name", "last_name", "email", "phone"]);
    const qs = [];
    const seen = new Set();
    const controls = document.querySelectorAll(
      "input[type=text], input[type=tel], input[type=email], input[type=url], input:not([type]), textarea, select"
    );
    for (const ctrl of controls) {
      const id = ctrl.id || "";
      if (STD.has(id)) continue;
      const label = labelFor(ctrl);
      if (!label || seen.has(label.toLowerCase())) continue;
      const tag = ctrl.tagName.toLowerCase();
      const qtype = tag === "textarea" ? "textarea" : tag === "select" ? "select" : "text";
      const options = tag === "select" ? Array.from(ctrl.options).map((o) => o.text.trim()) : [];
      seen.add(label.toLowerCase());
      qs.push({ label, qtype, options, el: ctrl });
    }
    return qs;
  },

  fillQuestion(q, value) {
    if (!value) return false;
    if (q.qtype === "text" || q.qtype === "textarea") return JAC.fillText(q.el, value);
    if (q.qtype === "select") return JAC.selectOption(q.el, q.options, value);
    return false;
  },

  parseMeta() {
    const m = location.href.match(/greenhouse\.io\/([^/]+)\//);
    return {
      company: m ? m[1].replace(/-/g, " ") : "",
      role: (document.title || "").split(/ - | at /)[0].trim(),
    };
  },
};

// ---- shared helpers for Lever-style .application-question blocks ------------
function buildQuestion(blk, label) {
  const ta = blk.querySelector("textarea");
  const sel = blk.querySelector("select");
  const radios = blk.querySelectorAll("input[type=radio]");
  const checks = blk.querySelectorAll("input[type=checkbox]");
  let qtype = "text";
  let options = [];
  if (ta) qtype = "textarea";
  else if (sel) { qtype = "select"; options = Array.from(sel.options).map((o) => o.text.trim()); }
  else if (radios.length) { qtype = "radio"; options = Array.from(radios).map(radioLabel); }
  else if (checks.length) { qtype = "checkbox"; options = Array.from(checks).map(radioLabel); }
  return { label, qtype, options, el: blk };
}

function fillInBlock(q, value) {
  if (!value) return false;
  const blk = q.el;
  if (q.qtype === "textarea") return JAC.fillText(blk.querySelector("textarea"), value);
  if (q.qtype === "text") return JAC.fillText(blk.querySelector("input[type=text], input:not([type])"), value);
  if (q.qtype === "select") return JAC.selectOption(blk.querySelector("select"), q.options, value);
  if (q.qtype === "radio" || q.qtype === "checkbox") {
    const opt = JAC.bestOption(q.options, value);
    if (!opt) return false;
    for (const inp of blk.querySelectorAll("input[type=radio], input[type=checkbox]")) {
      if (radioLabel(inp).trim().toLowerCase() === opt.trim().toLowerCase()) {
        inp.click();
        return true;
      }
    }
  }
  return false;
}

function labelFor(ctrl) {
  if (ctrl.id) {
    const lab = document.querySelector(`label[for='${CSS.escape(ctrl.id)}']`);
    if (lab) return JAC.txt(lab);
  }
  if (ctrl.getAttribute("aria-label")) return ctrl.getAttribute("aria-label").trim();
  const wrap = ctrl.closest("div, .field, fieldset");
  if (wrap) {
    const lab = wrap.querySelector("label");
    if (lab) return JAC.txt(lab);
  }
  return "";
}

JAC.getAdapter = function (url) {
  for (const a of [Lever, Greenhouse]) if (a.detect(url)) return a;
  return null;
};
