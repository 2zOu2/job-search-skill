// Orchestrator: responds to the side panel. Extracts the JD for judging, and
// runs the auto-fill flow on application forms.
window.JAC = window.JAC || {};

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  run(msg)
    .then((data) => sendResponse({ ok: true, data }))
    .catch((err) => sendResponse({ ok: false, error: String(err.message || err) }));
  return true;
});

async function run(msg) {
  const adapter = JAC.getAdapter(location.href);
  if (!adapter) throw new Error("This page isn't a supported Lever/Greenhouse page.");

  if (msg.type === "getContext") {
    return { adapter: adapter.name, isApplyForm: adapter.isApplyForm(), url: location.href };
  }
  if (msg.type === "extractJD") {
    return { jd: adapter.extractJD(), meta: adapter.parseMeta() };
  }
  if (msg.type === "autofill") {
    return await autofill(adapter, msg.bank);
  }
  throw new Error("Unknown command: " + msg.type);
}

async function autofill(adapter, bank) {
  const report = [];

  // 1) standard contact fields
  for (const f of adapter.fillBasics(bank)) report.push(f);

  // 2) resume: browsers forbid programmatic file upload — flag it for the user.
  report.push({
    label: "Resume / CV upload",
    value: "(upload your PDF manually — browsers block auto-upload)",
    confidence: "needs-you",
    filled: false,
  });

  // 3) custom questions
  const questions = adapter.extractQuestions();
  const resolved = questions.map((q) => ({ q, r: JAC.resolveAnswer(q.label, q.qtype, bank) }));

  // 4) draft the open-ended ones via Claude (one background round-trip)
  const toDraft = resolved.filter((x) => x.r.confidence === "draft-needed").map((x) => ({ label: x.q.label }));
  let drafts = {};
  if (toDraft.length) {
    const resp = await chrome.runtime.sendMessage({
      type: "draftAnswers",
      questions: toDraft,
      jobContext: adapter.extractJD().slice(0, 4000),
    });
    if (resp && resp.ok) drafts = resp.data;
  }

  // 5) fill everything we can; build the review report
  for (const { q, r } of resolved) {
    let value = r.value;
    let confidence = r.confidence;
    if (confidence === "draft-needed") {
      value = drafts[q.label] || "";
      confidence = value ? "drafted" : "needs-you";
    }
    let filled = false;
    if (value && (confidence === "auto" || confidence === "drafted")) {
      filled = adapter.fillQuestion(q, value);
    }
    report.push({ label: q.label, value, confidence, filled });
  }

  return { report, meta: adapter.parseMeta() };
}
