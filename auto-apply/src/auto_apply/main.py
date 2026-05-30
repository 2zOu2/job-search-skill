"""CLI entry point.

    python -m auto_apply apply <application-url>

Phase 1 supports Lever. It opens the form in your real browser, auto-fills what
it can, drafts open-ended answers, then hands control to you to review and Submit.
"""
from __future__ import annotations

import argparse
import sys

from . import adapters, log, review
from .answers import resolve_answer
from .adapters.base import FilledField
from .profile import load_profile
from .runner import browser_page


def cmd_apply(url: str) -> int:
    adapter = adapters.for_url(url)
    if adapter is None:
        print(f"No adapter for this URL yet (Phase 1 = Lever only): {url}")
        return 2

    profile = load_profile()

    # LLM is optional: if no API key, drafted answers just become needs-you.
    llm = None
    try:
        from .llm import LLM
        llm = LLM()
    except Exception as e:
        print(f"(LLM drafting disabled: {e})")

    with browser_page() as page:
        print(f"Opening {url} …")
        page.goto(url, wait_until="domcontentloaded")
        adapter.goto_apply(page)

        fields: list[FilledField] = []

        # 1) standard fields + resume upload
        fields += adapter.fill_basics(page, profile)
        resume_path = _resume_path(profile)
        if resume_path:
            ok = adapter.upload_resume(page, resume_path)
            fields.append(FilledField("resume upload", resume_path, "auto", ok))

        # 2) custom questions
        for q in adapter.extract_questions(page):
            r = resolve_answer(q.label, q.qtype, profile, llm) if llm else \
                _no_llm_resolve(q, profile)
            filled = adapter.fill_question(page, q, r.value) if r.value else False
            fields.append(FilledField(q.label, r.value, r.confidence, filled))

        meta = adapter.parse_meta(page)

        # 3) review gate — you submit in the browser, then confirm here
        if review.show_and_wait(meta, fields):
            answers = {f.label: f.value for f in fields if f.value}
            counts = _counts(fields)
            log.record(meta, url, adapter.name, fields, answers, counts)
            print("  ✓ Logged to applications.json")
        else:
            print("  – Skipped logging.")
    return 0


def _resume_path(profile):
    from pathlib import Path
    from .profile import job_search_home
    # use the existing PDF resume as the upload artifact
    cand = list((job_search_home() / "profile").glob("*.pdf"))
    return str(cand[0]) if cand else None


def _no_llm_resolve(q, profile):
    from .answers import Resolved, _match_key
    key = _match_key(q.label)
    if key and key not in profile.sensitive_keys:
        val = profile.lookup(key)
        if val:
            return Resolved(str(val), "auto", key)
    return Resolved("", "needs-you", key)


def _counts(fields):
    out = {"auto": 0, "drafted": 0, "needs-you": 0}
    for f in fields:
        out[f.confidence] = out.get(f.confidence, 0) + 1
    return out


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(prog="auto_apply")
    sub = parser.add_subparsers(dest="cmd", required=True)
    p_apply = sub.add_parser("apply", help="Co-pilot a single application URL")
    p_apply.add_argument("url")
    args = parser.parse_args(argv)

    if args.cmd == "apply":
        return cmd_apply(args.url)
    return 1


if __name__ == "__main__":
    sys.exit(main())
