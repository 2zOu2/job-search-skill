// Builds the "capture" bookmarklet. It runs on ANY job page the user is viewing,
// extracts the job description, and hands it back to this app via the URL hash
// (#jd=…&src=…). No backend, no cross-origin fetch, no clipboard permission.
//
// `origin` is this app's own origin, so the bookmarklet always points back here.

export function buildBookmarklet(origin) {
  // This function's source is stringified and embedded in the javascript: URL.
  // Keep it self-contained — it executes in the job page's context, not here.
  function capture(APP) {
    // 1) honor an explicit text selection — most reliable, user is in control
    var sel = String(window.getSelection() || "").trim();
    var jd = "";
    if (sel.length > 200) {
      jd = sel;
    } else {
      // 2) try known ATS / job-board containers
      var sels = [
        '[data-qa="job-description"]', ".posting-page", ".posting",
        ".job__description", "#job_description", "#job-details",
        '[data-automation-id="jobPostingDescription"]', // Workday
        ".jobs-description__content", ".jobs-box__html-content", // LinkedIn
        "#jobDescriptionText", // Indeed
        '[class*="job-description"]', '[class*="JobDescription"]',
        "article", "main", '[role="main"]',
      ];
      for (var i = 0; i < sels.length; i++) {
        var e = document.querySelector(sels[i]);
        if (e && (e.innerText || "").trim().length > 200) { jd = e.innerText; break; }
      }
      // 3) fallback: densest readable text block
      if (!jd) {
        var best = "", bestLen = 0;
        var nodes = document.querySelectorAll("div,section,article,td");
        for (var j = 0; j < nodes.length; j++) {
          var t = nodes[j].innerText || "";
          if (t.length > bestLen && t.length < 25000) { bestLen = t.length; best = t; }
        }
        jd = best || document.body.innerText || "";
      }
    }
    jd = jd.replace(/\n{3,}/g, "\n\n").trim();
    // Prepend the page title — often the cleanest source of the role name.
    var head = (document.title || "").trim();
    if (head && jd.indexOf(head) !== 0) jd = head + "\n\n" + jd;

    if (!jd) { alert("Couldn't find job text. Try selecting the description first."); return; }
    // Cap to keep the URL well within browser limits.
    jd = jd.slice(0, 24000);

    var url = APP + "/#jd=" + encodeURIComponent(jd) + "&src=" + encodeURIComponent(location.href);
    window.open(url, "_blank");
  }

  const body = `(${capture.toString()})(${JSON.stringify(origin)})`;
  return "javascript:" + encodeURIComponent(body);
}
