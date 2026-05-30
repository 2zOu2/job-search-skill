"""Load the user's private profile from ~/job-search/.

Everything here lives OUTSIDE the repo (git-ignored), so real personal data is
never committed. Paths can be overridden with the JOB_SEARCH_HOME env var.
"""
from __future__ import annotations

import json
import os
from dataclasses import dataclass, field
from pathlib import Path


def job_search_home() -> Path:
    return Path(os.environ.get("JOB_SEARCH_HOME", Path.home() / "job-search"))


@dataclass
class Profile:
    resume_markdown: str
    answer_bank: dict
    preferences_markdown: str = ""

    @property
    def basics(self) -> dict:
        return self.answer_bank.get("basics", {})

    @property
    def sensitive_keys(self) -> set[str]:
        return set(self.answer_bank.get("sensitive_keys", []))

    def lookup(self, key: str):
        """Top-level answer-bank value (None if missing/empty)."""
        val = self.answer_bank.get(key)
        return val if val else None


def load_profile() -> Profile:
    home = job_search_home()
    resume = home / "profile" / "resume.md"
    prefs = home / "profile" / "preferences.md"
    bank = home / "answer_bank.json"

    missing = [p for p in (resume, bank) if not p.exists()]
    if missing:
        raise FileNotFoundError(
            "Missing profile file(s): "
            + ", ".join(str(p) for p in missing)
            + "\nSee auto-apply/README.md for setup."
        )

    return Profile(
        resume_markdown=resume.read_text(encoding="utf-8"),
        answer_bank=json.loads(bank.read_text(encoding="utf-8")),
        preferences_markdown=prefs.read_text(encoding="utf-8") if prefs.exists() else "",
    )
