"""Claude API wrapper for drafting open-ended application answers.

Grounded strictly in the user's master resume — it must not invent experience.
Requires ANTHROPIC_API_KEY in the environment.
"""
from __future__ import annotations

import os

from .profile import Profile

_DRAFT_MODEL = os.environ.get("APPLY_DRAFT_MODEL", "claude-sonnet-4-6")


class LLM:
    def __init__(self):
        from anthropic import Anthropic

        if not os.environ.get("ANTHROPIC_API_KEY"):
            raise RuntimeError("Set ANTHROPIC_API_KEY to draft open-ended answers.")
        self.client = Anthropic()

    def draft_answer(self, question: str, profile: Profile, job_context: str = "") -> str:
        prompt = (
            "You are drafting an answer to a job-application question on behalf of "
            "the candidate. Use ONLY facts supported by the candidate's resume below "
            "— never invent experience, numbers, or claims. Write in the first "
            "person, concise and specific (2-5 sentences unless the question implies "
            "longer). No preamble, just the answer text.\n\n"
            f"=== CANDIDATE RESUME ===\n{profile.resume_markdown}\n\n"
            f"=== JOB CONTEXT ===\n{job_context or '(none provided)'}\n\n"
            f"=== QUESTION ===\n{question}\n"
        )
        resp = self.client.messages.create(
            model=_DRAFT_MODEL,
            max_tokens=600,
            messages=[{"role": "user", "content": prompt}],
        )
        return "".join(b.text for b in resp.content if b.type == "text").strip()
