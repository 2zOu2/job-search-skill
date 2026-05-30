"""Playwright runner using a persistent browser context.

A persistent context reuses a real Chrome profile dir, so your logged-in sessions
(LinkedIn, company SSO) and cookies persist between runs and you look like a
normal user — not a fresh headless bot. The browser is always visible
(headless=False) because the whole point is that YOU review and submit.
"""
from __future__ import annotations

import os
from contextlib import contextmanager
from pathlib import Path

_PROFILE_DIR = Path(
    os.environ.get("APPLY_BROWSER_PROFILE", Path.home() / ".job-apply-browser")
)


@contextmanager
def browser_page():
    from playwright.sync_api import sync_playwright

    _PROFILE_DIR.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as p:
        ctx = p.chromium.launch_persistent_context(
            user_data_dir=str(_PROFILE_DIR),
            headless=False,
            channel="chrome",  # use real Chrome; falls back to bundled if absent
            viewport={"width": 1280, "height": 900},
            args=["--disable-blink-features=AutomationControlled"],
        )
        page = ctx.pages[0] if ctx.pages else ctx.new_page()
        try:
            yield page
        finally:
            ctx.close()
