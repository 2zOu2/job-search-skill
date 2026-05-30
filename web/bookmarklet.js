// Builds the "capture" bookmarklet. It runs on ANY job page the user is viewing,
// extracts the job description, and hands it back to this app via the URL hash
// (#jd=…&src=…). No backend, no cross-origin fetch.
//
// Capture priority:
//   1. Clipboard (user pressed Ctrl+C on the selection — most reliable because
//      clicking the bookmarklet clears the text selection in most browsers)
//   2. Known ATS / job-board containers
//   3. Densest text-block fallback

export function buildBookmarklet(origin) {
  function capture(APP) {
    function finish(jd) {
      jd = jd.replace(/\n{3,}/g, "\n\n").trim();
      var head = (document.title || "").trim();
      if (head && jd.indexOf(head) !== 0) jd = head + "\n\n" + jd;
      if (!jd) { alert("Couldn't find job text. Copy the description (Ctrl+C) then click again."); return; }
      jd = jd.slice(0, 24000);
      var url = APP + "/#jd=" + encodeURIComponent(jd) + "&src=" + encodeURIComponent(location.href);
      window.open(url, "_blank");
    }

    function fromSelectors() {
      var sels = [
        // LinkedIn
        ".jobs-description__content", ".job-view-layout .jobs-description",
        "#job-details", ".jobs-description-content__text--stretch",
        ".jobs-box__html-content",
        // Lever
        '[data-qa="job-description"]', ".posting-page", ".posting",
        // Greenhouse
        ".job__description", "#job_description",
        // Ashby
        '[class*="ashby-job-posting-description"]',
        // Workday
        '[data-automation-id="jobPostingDescription"]',
        // Indeed
        "#jobDescriptionText",
        // Generic
        '[class*="job-description"]', '[class*="JobDescription"]',
        "article", "main", '[role="main"]',
      ];
      for (var i = 0; i < sels.length; i++) {
        var e = document.querySelector(sels[i]);
        var t = e && (e.innerText || "").trim();
        if (t && t.length > 200) return t;
      }
      // last resort: densest block
      var best = "", bestLen = 0;
      var nodes = document.querySelectorAll("div,section,article,td");
      for (var j = 0; j < nodes.length; j++) {
        var bt = (nodes[j].innerText || "").trim();
        if (bt.length > bestLen && bt.length < 25000) { bestLen = bt.length; best = bt; }
      }
      return best || (document.body.innerText || "");
    }

    // Try clipboard first — user should Ctrl+C the description before clicking.
    if (navigator.clipboard && navigator.clipboard.readText) {
      navigator.clipboard.readText().then(function(text) {
        text = text.trim();
        // Only trust clipboard if it looks like a job description (>150 chars).
        finish(text.length > 150 ? text : fromSelectors());
      }).catch(function() {
        finish(fromSelectors());
      });
    } else {
      finish(fromSelectors());
    }
  }

  const body = `(${capture.toString()})(${JSON.stringify(origin)})`;
  return "javascript:" + encodeURIComponent(body);
}
