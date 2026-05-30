"""Lever adapter (jobs.lever.co/<company>/<id>).

Lever's hosted application form:
  - standard inputs: input[name=name|email|phone|org], input[name='urls[...]']
  - resume upload:    input[type=file][name=resume]
  - custom questions: .application-question blocks, each with a label and an
    input/textarea/select/radio group.

We fill by operating on each question's element handle directly (robust), and we
SKIP the standard contact fields here since fill_basics already handled them.
Selectors are isolated in this file so they're easy to update.
"""
from __future__ import annotations

import re

from .base import Adapter, FilledField, Question

_LEVER_RE = re.compile(r"https?://jobs\.lever\.co/", re.I)

# Lever's built-in field names handled by fill_basics — don't re-ask them.
_STANDARD_NAMES = {"name", "email", "phone", "org", "resume", "comments", "pronouns"}
_STANDARD_LABEL = re.compile(
    r"^(full name|name|email|phone|current company|current location|"
    r"linkedin|twitter|github|portfolio|other website|resume|cv)\b",
    re.I,
)


class LeverAdapter(Adapter):
    name = "lever"

    @staticmethod
    def detect(url: str) -> bool:
        return bool(_LEVER_RE.match(url))

    def goto_apply(self, page) -> None:
        if not page.url.rstrip("/").endswith("/apply"):
            try:
                page.click("a.postings-btn, a[href$='/apply']", timeout=4000)
                page.wait_for_load_state("domcontentloaded")
            except Exception:
                pass

    def fill_basics(self, page, profile) -> list[FilledField]:
        b = profile.basics
        mapping = {
            "input[name='name']": ("name", b.get("name", "")),
            "input[name='email']": ("email", b.get("email", "")),
            "input[name='phone']": ("phone", b.get("phone", "")),
            "input[name='org']": ("current company", b.get("current_company", "")),
            "input[name='urls[LinkedIn]']": ("LinkedIn", b.get("linkedin", "")),
            "input[name='urls[GitHub]']": ("GitHub", b.get("github", "")),
            "input[name='urls[Portfolio]']": ("Portfolio", b.get("portfolio", "")),
        }
        out: list[FilledField] = []
        for sel, (label, val) in mapping.items():
            if not val:
                continue
            ok = self._fill_text(page, sel, val)
            if ok:  # only report fields the form actually has
                out.append(FilledField(label, val, "auto", True))
        return out

    def upload_resume(self, page, resume_path: str) -> bool:
        for sel in ("input[type=file][name='resume']", "input[type=file]"):
            try:
                page.set_input_files(sel, resume_path, timeout=4000)
                return True
            except Exception:
                continue
        return False

    def extract_questions(self, page) -> list[Question]:
        questions: list[Question] = []
        for blk in page.query_selector_all(".application-question"):
            label_el = blk.query_selector(".application-label, label, .text")
            label = (label_el.inner_text() if label_el else "").replace("✱", "").strip()
            if not label:
                continue

            field = blk.query_selector("input:not([type=hidden]), textarea, select")
            name = (field.get_attribute("name") if field else "") or ""
            # skip standard contact fields (handled by fill_basics) and url fields
            if name in _STANDARD_NAMES or name.startswith("urls[") or \
                    _STANDARD_LABEL.match(label):
                continue

            ta = blk.query_selector("textarea")
            sel_el = blk.query_selector("select")
            radios = blk.query_selector_all("input[type=radio]")
            checks = blk.query_selector_all("input[type=checkbox]")
            if ta:
                qtype, opts = "textarea", []
            elif sel_el:
                qtype = "select"
                opts = [o.inner_text().strip() for o in sel_el.query_selector_all("option")]
            elif radios:
                qtype = "radio"
                opts = [self._radio_label(r) for r in radios]
            elif checks:
                qtype = "checkbox"
                opts = [self._radio_label(c) for c in checks]
            else:
                qtype, opts = "text", []
            required = bool(blk.query_selector(".required, [aria-required='true']"))
            questions.append(Question(label, qtype, "", required, opts, handle=blk))
        return questions

    def fill_question(self, page, q: Question, value: str) -> bool:
        if not value or q.handle is None:
            return False
        blk = q.handle
        try:
            if q.qtype == "textarea":
                el = blk.query_selector("textarea")
                if el:
                    el.fill(value)
                    return True
            elif q.qtype == "text":
                el = blk.query_selector("input[type=text], input:not([type])")
                if el:
                    el.fill(value)
                    return True
            elif q.qtype == "select":
                el = blk.query_selector("select")
                opt = self._best_option(q.options, value)
                if el and opt:
                    el.select_option(label=opt)
                    return True
            elif q.qtype in ("radio", "checkbox"):
                opt = self._best_option(q.options, value)
                if opt is None:
                    return False
                for inp in blk.query_selector_all("input[type=radio], input[type=checkbox]"):
                    if self._radio_label(inp).strip().lower() == opt.strip().lower():
                        inp.check()
                        return True
        except Exception:
            return False
        return False

    def parse_meta(self, page) -> dict:
        meta = {}
        try:
            meta["role"] = page.title().split(" - ")[0].strip()
        except Exception:
            pass
        el = page.query_selector(".main-header-logo img, .company-name")
        if el:
            meta["company"] = (el.get_attribute("alt") or el.inner_text() or "").strip()
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
    def _radio_label(inp) -> str:
        # the visible label text for a radio/checkbox option
        val = inp.get_attribute("value")
        if val:
            return val
        parent = inp.evaluate_handle("e => e.parentElement")
        try:
            return parent.as_element().inner_text().strip()
        except Exception:
            return ""

    @staticmethod
    def _best_option(options: list[str], value: str) -> str | None:
        """Match a bank value to one of the question's options, fuzzily.

        e.g. value 'No' → option 'No'; value 'Yes, I am authorized…' → option 'Yes'.
        """
        v = value.strip().lower()
        for o in options:
            ol = o.strip().lower()
            if not ol or ol.startswith("select"):
                continue
            if ol == v or v.startswith(ol) or ol in v:
                return o
        return None
