// Shared content-script helpers. Content scripts share one global scope, so we
// hang everything off window.JAC instead of using ES modules.
window.JAC = window.JAC || {};

// React-controlled inputs ignore a plain `el.value = x`. Use the native setter
// and dispatch input/change so frameworks pick up the change.
JAC.setNativeValue = function (el, value) {
  const proto =
    el.tagName === "TEXTAREA"
      ? window.HTMLTextAreaElement.prototype
      : window.HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, "value").set;
  setter.call(el, value);
  el.dispatchEvent(new Event("input", { bubbles: true }));
  el.dispatchEvent(new Event("change", { bubbles: true }));
};

JAC.fillText = function (el, value) {
  if (!el) return false;
  try {
    el.focus();
    JAC.setNativeValue(el, value);
    el.blur();
    return true;
  } catch (e) {
    return false;
  }
};

JAC.selectOption = function (selectEl, options, value) {
  const opt = JAC.bestOption(options, value);
  if (!selectEl || !opt) return false;
  const match = Array.from(selectEl.options).find(
    (o) => o.text.trim().toLowerCase() === opt.trim().toLowerCase()
  );
  if (!match) return false;
  selectEl.value = match.value;
  selectEl.dispatchEvent(new Event("change", { bubbles: true }));
  return true;
};

// Fuzzy match a bank value to one of the question's options.
// e.g. value "No" -> "No"; value "Yes, I am authorized…" -> "Yes".
JAC.bestOption = function (options, value) {
  const v = (value || "").trim().toLowerCase();
  for (const o of options) {
    const ol = (o || "").trim().toLowerCase();
    if (!ol || ol.startsWith("select") || ol.startsWith("--")) continue;
    if (ol === v || v.startsWith(ol) || v.includes(ol)) return o;
  }
  return null;
};

JAC.txt = function (el) {
  return (el ? el.textContent || "" : "").replace(/\*/g, "").trim();
};
