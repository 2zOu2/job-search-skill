"""Greenhouse adapter (boards.greenhouse.io / job-boards.greenhouse.io).

Greenhouse application form:
  - standard inputs: #first_name, #last_name (split!), #email, #phone
  - resume upload:    input[type=file] (often #resume)
  - custom questions: label[for=<id>] + input/textarea/select control
  - EEO/demographic:  selects (Gender/Race/Veteran/Disability) → routed to user

We locate each control and its <label>, skip the standard contact fields, and
fill via the control's element handle. Newer React comboboxes (non-native
<select>) are not yet handled and degrade gracefully to "you fill it".
"""
from __future__ import annotations

import re

from .base import Adapter, FilledField, Question

_GH_RE = re.compile(r"https?://(boards|job-boards)(\.[a-z]{2})?\.greenhouse\.io/", re.I)

_STANDARD_IDS = {"first_name", "last_name", "email", "phone"}
_STANDARD_NAMES = {
    "job_application[first_name]", "job_application[last_name]",
    "job_application[email]", "job_application[phone]",
    "first_name", "last_name", "email", "phone",
}


def _split_name(full: str) -> tuple[str, str]:
    parts = full.strip().split()
    if not parts:
        return "", ""
    if len(parts) == 1:
        return parts[0], ""
    return parts[0], " ".join(parts[1:])


class GreenhouseAdapter(Adapter):
    name = "greenhouse"

    @staticmethod
    def detect(url: str) -> bool:
        return bool(_GH_RE.match(url))

    def goto_apply(self, page) -> None:
        # Reveal the form if it's behind an Apply button.
        for sel in ("button#apply_button", "a#apply_button",
                    "a[href*='#app']", "button:has-text('Apply')"):
            try:
                el = page.query_selector(sel)
                if el and el.is_visible():
                    el.click()
                    page.wait_for_load_state("domcontentloaded")
                    break
            except Exception:
                pass

    def fill_basics(self, page, profile) -> list[FilledField]:
        b = profile.basics
        first, last = _split_name(b.get("name", ""))
        out: list[FilledField] = []
        for sel, label, val in (
            ("#first_name", "first name", first),
            ("#last_name", "last name", last),
            ("#email", "email", b.get("email", "")),
            ("#phone", "phone", b.get("phone", "")),
        ):
            if val and self._fill_text(page, sel, val):
                out.append(FilledField(label, val, "auto", True))
        return out

    def upload_resume(self, page, resume_path: str) -> bool:
        for sel in ("input[type=file]#resume",
                    "input[type=file][name*='resume']",
                    "input[type=file]"):
            try:
                page.set_input_files(sel, resume_path, timeout=4000)
                return True
            except Exception:
                continue
        return False

    def extract_questions(self, page) -> list[Question]:
        questions: list[Question] = []
        seen: set[str] = set()
        controls = page.query_selector_all(
            "input[type=text], input[type=tel], input[type=email], "
            "input[type=url], input:not([type]), textarea, select"
        )
        for ctrl in controls:
            cid = ctrl.get_attribute("id") or ""
            name = ctrl.get_attribute("name") or ""
            if cid in _STANDARD_IDS or name in _STANDARD_NAMES:
                continue
            label = self._label_for(page, ctrl)
            if not label or label.lower() in seen:
                continue
            try:
                tag = ctrl.evaluate("e => e.tagName.toLowerCase()")
            except Exception:
                continue
            if tag == "textarea":
                qtype, opts = "textarea", []
            elif tag == "select":
                qtype = "select"
                opts = [o.inner_text().strip() for o in ctrl.query_selector_all("option")]
            else:
                qtype, opts = "text", []
            seen.add(label.lower())
            questions.append(Question(label, qtype, "", False, opts, handle=ctrl))
        return questions

    def fill_question(self, page, q: Question, value: str) -> bool:
        if not value or q.handle is None:
            return False
        try:
            if q.qtype in ("text", "textarea"):
                q.handle.fill(value)
                return True
            if q.qtype == "select":
                opt = self._best_option(q.options, value)
                if opt:
                    q.handle.select_option(label=opt)
                    return True
        except Exception:
            return False
        return False

    def parse_meta(self, page) -> dict:
        meta = {}
        try:
            meta["role"] = page.title().split(" - ")[0].split(" at ")[0].strip()
        except Exception:
            pass
        m = re.search(r"greenhouse\.io/([^/]+)/", page.url)
        if m:
            meta["company"] = m.group(1).replace("-", " ").title()
        return meta

    # ---- helpers -------------------------------------------------------------
    @staticmethod
    def _fill_text(page, selector: str, value: str) -> bool:
        try:
            page.fill(selector, value, timeout=2500)
            return True
        except Exception:
            return False

    @staticmethod
    def _label_for(page, ctrl) -> str:
        cid = ctrl.get_attribute("id")
        if cid:
            lab = page.query_selector(f"label[for='{cid}']")
            if lab:
                return lab.inner_text().replace("*", "").strip()
        al = ctrl.get_attribute("aria-label")
        if al:
            return al.strip()
        try:
            lab = ctrl.evaluate_handle(
                "e => (e.closest('div,.field,fieldset')||document).querySelector('label')"
            ).as_element()
            if lab:
                return lab.inner_text().replace("*", "").strip()
        except Exception:
            pass
        return ""

    @staticmethod
    def _best_option(options: list[str], value: str) -> str | None:
        v = value.strip().lower()
        for o in options:
            ol = o.strip().lower()
            if not ol or ol.startswith(("select", "--")):
                continue
            if ol == v or v.startswith(ol) or ol in v:
                return o
        return None
