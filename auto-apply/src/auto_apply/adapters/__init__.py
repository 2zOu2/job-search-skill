from .lever import LeverAdapter

ADAPTERS = [LeverAdapter]


def for_url(url: str):
    for a in ADAPTERS:
        if a.detect(url):
            return a()
    return None
