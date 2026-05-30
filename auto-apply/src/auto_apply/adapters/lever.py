"""Lever adapter (jobs.lever.co/<company>/<id>).

Lever's hosted application form has a stable structure:
  - standard inputs: input[name=name|email|phone|org], input[name='urls[...]']
  - resume upload:    input[type=file][name=resume]
  - custom questions: .application-question blocks, each with a label and an
    input/textarea/select/radio group.
Selectors are best-effort and isolated here so they're easy to update.
"""
from __future__ import annotations

import re

from .base import Adapter, FilledField, Question

_LEVER_RE = re.compile(r"https?://jobs\.lever\.co/", re.I)


class LeverAdapter(Adapter):
    name = "lever"

    @staticmethod
    def detect(url: str) -> bool:
        return bool(_LEVER_RE.match(url))

    def goto_apply(self, page) -> None:
        # The posting URL works; ensure we're on the /apply form.
        if not page.url.rstrip("/").endswith("/apply"):
            try:
                page.click("a.postings-btn, a[href$='/apply']", timeout=4000)
                page.wait_for_load_state("domcontentloaded")
            except Exception:
                # Many Lever URLs are already the form; ignore if no button.
                pass

    def fill_basics(self, page, profile) -> list[FilledField]:
        b = profile.basics
        mapping = {
            "input[name='name']": b.get("name", ""),
            "input[name='email']": b.get("email", ""),
            "input[name='phone']": b.get("phone", ""),
            "input[name='org']": b.get("current_company", ""),
            "input[name='urls[LinkedIn]']": b.get("linkedin", ""),
            "input[name='urls[GitHub]']": b.get("github", ""),
            "input[name='urls[Portfolio]']": b.get("portfolio", ""),
        }
        out: list[FilledField] = []
        for sel, val in mapping.items():
            if not val:
                continue
            label = sel.split("[")[-1].rstrip("]'").replace("name='", "").strip("'")
            ok = self._set(page, sel, val)
            out.append(FilledField(label, val, "auto", ok))
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
        blocks = page.query_selector_all(".application-question, .application-additional li")
        for i, blk in enumerate(blocks):
            label_el = blk.query_selector(".application-label, label, .text")
            label = (label_el.inner_text().strip() if label_el else "").replace("✱", "").strip()
            if not label:
                continue
            ta = blk.query_selector("textarea")
            sel_el = blk.query_selector("select")
            radios = blk.query_selector_all("input[type=radio]")
            checks = blk.query_selector_all("input[type=checkbox]")
            if ta:
                qtype, selector = "textarea", f".application-question:nth-of-type({i+1}) textarea"
            elif sel_el:
                qtype, selector = "select", f".application-question:nth-of-type({i+1}) select"
            elif radios:
                qtype, selector = "radio", ""
            elif checks:
                qtype, selector = "checkbox", ""
            else:
                qtype, selector = "text", f".application-question:nth-of-type({i+1}) input[type=text]"
            opts = [o.inner_text().strip() for o in blk.query_selector_all("option")] if sel_el else []
            required = bool(blk.query_selector(".required, [aria-required='true']"))
            questions.append(Question(label, qtype, selector, required, opts))
        return questions

    def fill_question(self, page, q: Question, value: str) -> bool:
        if not value or not q.selector:
            return False
        return self._set(page, q.selector, value, is_select=(q.qtype == "select"))

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

    @staticmethod
    def _set(page, selector: str, value: str, is_select: bool = False) -> bool:
        try:
            if is_select:
                page.select_option(selector, label=value, timeout=3000)
            else:
                page.fill(selector, value, timeout=3000)
            return True
        except Exception:
            return False
