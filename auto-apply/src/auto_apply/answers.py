"""Decide what to put in each application question.

Each question gets classified into one of three confidence levels:
  - "auto"      : confident value from the answer bank → fill it.
  - "drafted"   : an LLM-drafted answer → fill it, but flag for review.
  - "needs-you" : sensitive or unknown → leave blank, you must answer.

Sensitive questions (salary, EEO, work authorization / sponsorship) are ALWAYS
"needs-you" even if the answer bank has a value, so you consciously confirm each
time. Submission is irreversible; a wrong visa answer is not worth the speedup.
"""
from __future__ import annotations

import re
from dataclasses import dataclass

from .profile import Profile

# label keyword -> answer-bank key. First match wins.
_KEYWORD_MAP: list[tuple[re.Pattern, str]] = [
    (re.compile(r"sponsor", re.I), "needs_sponsorship"),
    (re.compile(r"authoriz|work permit|eligible to work|legally", re.I), "work_authorization"),
    (re.compile(r"salary|compensation|expected pay|desired pay", re.I), "salary_expectation"),
    (re.compile(r"relocat", re.I), "willing_to_relocate"),
    (re.compile(r"start date|available", re.I), "earliest_start_date"),
    (re.compile(r"notice period", re.I), "notice_period"),
    (re.compile(r"hear about|referr|source", re.I), "how_did_you_hear"),
    (re.compile(r"gender", re.I), "eeo_gender"),
    (re.compile(r"race|ethnic", re.I), "eeo_race"),
    (re.compile(r"veteran", re.I), "eeo_veteran"),
    (re.compile(r"disab", re.I), "eeo_disability"),
    (re.compile(r"why.*(company|role|position|interest|join)", re.I), "why_this_company"),
]


@dataclass
class Resolved:
    value: str
    confidence: str  # auto | drafted | needs-you
    source_key: str | None = None


def resolve_answer(label: str, qtype: str, profile: Profile, llm) -> Resolved:
    """Resolve one open question to a value + confidence."""
    bank_key = _match_key(label)

    # Sensitive questions are never auto-FILLED. If the bank has a value, surface
    # it as a suggestion (shown in the review, not typed into the form) so you can
    # confirm and enter it yourself.
    if bank_key and bank_key in profile.sensitive_keys:
        val = profile.lookup(bank_key)
        return Resolved(str(val) if val else "", "needs-you", bank_key)

    if bank_key:
        val = profile.lookup(bank_key)
        if val and bank_key == "why_this_company":
            # placeholder in the bank means "draft it per company"
            return _draft(label, profile, llm)
        if val:
            return Resolved(str(val), "auto", bank_key)

    # Essay-style question with no bank entry: draft it. Short text fields and
    # radios/selects/checkboxes with no known answer go to you (don't guess URLs
    # or pick options blindly).
    if qtype == "textarea":
        return _draft(label, profile, llm)

    return Resolved("", "needs-you", bank_key)


def _match_key(label: str) -> str | None:
    for pat, key in _KEYWORD_MAP:
        if pat.search(label):
            return key
    return None


def _draft(label: str, profile: Profile, llm) -> Resolved:
    try:
        text = llm.draft_answer(label, profile)
        return Resolved(text, "drafted")
    except Exception as e:  # never block the run on an LLM hiccup
        return Resolved("", "needs-you")
