// Direct browser call to the Anthropic Messages API. The key never leaves the
// browser except in this request to api.anthropic.com.

const API_URL = "https://api.anthropic.com/v1/messages";

export async function callClaude({ apiKey, model, prompt, maxTokens = 1024 }) {
  if (!apiKey) throw new Error("Add your Anthropic API key in Settings first.");
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
    let detail = await res.text();
    try { detail = JSON.parse(detail).error?.message || detail; } catch {}
    throw new Error(`Claude API ${res.status}: ${detail}`.slice(0, 300));
  }
  const data = await res.json();
  return (data.content || [])
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();
}

// Tolerant JSON extraction — models sometimes wrap output in ``` fences.
export function parseJson(text) {
  const cleaned = text.replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start < 0 || end < 0) throw new Error("Model did not return JSON.");
  return JSON.parse(cleaned.slice(start, end + 1));
}
