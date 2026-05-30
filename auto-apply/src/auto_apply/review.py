"""Terminal review gate.

Phase 1 keeps the review in the terminal: we fill the live form, print a summary
of what was filled and what needs the user, then leave the browser open. The user
reviews/edits IN the real browser, solves any CAPTCHA, and clicks Submit
themselves. Only after they confirm do we log the application.
"""
from __future__ import annotations

_ICON = {"auto": "✓", "drafted": "✎", "needs-you": "✗"}


def show_and_wait(meta: dict, fields) -> bool:
    print("\n" + "=" * 64)
    print(f"  {meta.get('company','?')} — {meta.get('role','?')}")
    print("=" * 64)
    print(f"  {_ICON['auto']} auto-filled   {_ICON['drafted']} drafted (review)   "
          f"{_ICON['needs-you']} needs you\n")

    needs, drafted = [], []
    for f in fields:
        icon = _ICON.get(f.confidence, "?")
        status = "" if f.filled else "  [NOT FILLED]"
        preview = (f.value[:60] + "…") if len(f.value) > 60 else f.value
        print(f"  {icon} {f.label}: {preview}{status}")
        if f.confidence == "needs-you":
            needs.append(f.label)
        elif f.confidence == "drafted":
            drafted.append(f.label)

    print("\n  ---")
    if needs:
        print(f"  ✗ You MUST answer in the browser: {', '.join(needs)}")
    if drafted:
        print(f"  ✎ Review these drafted answers before submitting: {', '.join(drafted)}")
    print("  ✗ Also handle any CAPTCHA / sensitive (visa, salary, EEO) fields yourself.\n")

    print("  → Switch to the browser, finish the form, and click Submit.")
    ans = input("  After you've submitted, type 'y' to log it (anything else skips): ").strip().lower()
    return ans == "y"
