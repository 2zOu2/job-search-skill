"""ATS adapter interface. One adapter per applicant-tracking system."""
from __future__ import annotations

from dataclasses import dataclass, field


@dataclass
class Question:
    label: str
    qtype: str           # text | textarea | select | radio | checkbox | file
    selector: str        # how to locate the input for filling
    required: bool = False
    options: list[str] = field(default_factory=list)


@dataclass
class FilledField:
    label: str
    value: str
    confidence: str      # auto | drafted | needs-you
    filled: bool         # did we actually put it in the form?


class Adapter:
    name = "base"

    @staticmethod
    def detect(url: str) -> bool:
        raise NotImplementedError

    def goto_apply(self, page) -> None:
        """Navigate to the actual application form (some boards have a separate
        job page with an Apply button)."""
        raise NotImplementedError

    def fill_basics(self, page, profile) -> list[FilledField]:
        raise NotImplementedError

    def upload_resume(self, page, resume_path: str) -> bool:
        raise NotImplementedError

    def extract_questions(self, page) -> list[Question]:
        raise NotImplementedError

    def fill_question(self, page, q: Question, value: str) -> bool:
        raise NotImplementedError

    def parse_meta(self, page) -> dict:
        """Best-effort {company, role} for logging."""
        return {}
