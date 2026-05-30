// Thin async wrappers over chrome.storage.local. All user data lives here, in the
// browser only — nothing is sent anywhere except Claude API calls you trigger.

const DEFAULTS = {
  profile: { resumeMarkdown: "", preferencesMarkdown: "", answerBank: {} },
  settings: {
    apiKey: "",
    judgeModel: "claude-haiku-4-5-20251001",
    tailorModel: "claude-sonnet-4-6",
  },
};

export async function getProfile() {
  const { profile } = await chrome.storage.local.get("profile");
  return { ...DEFAULTS.profile, ...(profile || {}) };
}

export async function getSettings() {
  const { settings } = await chrome.storage.local.get("settings");
  return { ...DEFAULTS.settings, ...(settings || {}) };
}

export async function setProfile(profile) {
  await chrome.storage.local.set({ profile });
}

export async function setSettings(settings) {
  await chrome.storage.local.set({ settings });
}

export async function getAll() {
  return { profile: await getProfile(), settings: await getSettings() };
}
