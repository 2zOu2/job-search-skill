// Calls the Anthropic Messages API directly from the extension service worker.
// Requires the browser-access header; the API key lives in chrome.storage.local.

const API_URL = "https://api.anthropic.com/v1/messages";

export async function callClaude({ apiKey, model, prompt, maxTokens = 1024 }) {
  if (!apiKey) throw new Error("No API key set. Open the extension options.");
  const res = await fetch(API_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Claude API ${res.status}: ${body.slice(0, 300)}`);
  }
  const data = await res.json();
  return (data.content || [])
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();
}
