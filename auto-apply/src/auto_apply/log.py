"""Append a completed application to ~/job-search/applications.json."""
from __future__ import annotations

import json
from datetime import date

from .profile import job_search_home


def record(meta: dict, url: str, ats: str, fields, answers: dict, review: dict) -> None:
    path = job_search_home() / "applications.json"
    apps = []
    if path.exists():
        try:
            apps = json.loads(path.read_text(encoding="utf-8"))
        except Exception:
            apps = []
    apps.append(
        {
            "company": meta.get("company", ""),
            "role": meta.get("role", ""),
            "url": url,
            "ats": ats,
            "status": "applied",
            "appliedDate": date.today().isoformat(),
            "answers": answers,
            "review": review,
        }
    )
    path.write_text(json.dumps(apps, indent=2, ensure_ascii=False), encoding="utf-8")
