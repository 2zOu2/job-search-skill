// Background service worker: routes Claude API calls and opens the side panel.
import { callClaude } from "../lib/claude.js";
import { judgePrompt, tailorPrompt, draftAnswerPrompt } from "../lib/prompts.js";
import { getAll } from "../lib/storage.js";

// Open the side panel when the toolbar icon is clicked.
chrome.action.onClicked.addListener(async (tab) => {
  if (tab?.windowId != null) {
    chrome.sidePanel.open({ windowId: tab.windowId });
  }
});

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  handle(msg)
    .then((data) => sendResponse({ ok: true, data }))
    .catch((err) => sendResponse({ ok: false, error: String(err.message || err) }));
  return true; // async response
});

async function handle(msg) {
  const { profile, settings } = await getAll();
  if (!profile.resumeMarkdown) {
    throw new Error("No resume saved yet. Open the extension options and paste your resume.");
  }

  switch (msg.type) {
    case "judge": {
      const text = await callClaude({
        apiKey: settings.apiKey,
        model: settings.judgeModel,
        prompt: judgePrompt(msg.jd, profile.resumeMarkdown, profile.preferencesMarkdown),
        maxTokens: 900,
      });
      return parseJson(text);
    }
    case "tailor": {
      return await callClaude({
        apiKey: settings.apiKey,
        model: settings.tailorModel,
        prompt: tailorPrompt(msg.jd, profile.resumeMarkdown),
        maxTokens: 2000,
      });
    }
    case "draftAnswers": {
      // msg.questions: [{label}]. Returns { label: answerText }.
      const out = {};
      for (const q of msg.questions) {
        out[q.label] = await callClaude({
          apiKey: settings.apiKey,
          model: settings.tailorModel,
          prompt: draftAnswerPrompt(q.label, profile.resumeMarkdown, msg.jobContext || ""),
          maxTokens: 600,
        });
      }
      return out;
    }
    default:
      throw new Error(`Unknown message type: ${msg.type}`);
  }
}

function parseJson(text) {
  // Models sometimes wrap JSON in ```json fences; strip and parse.
  const cleaned = text.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  return JSON.parse(cleaned.slice(start, end + 1));
}
