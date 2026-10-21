#!/usr/bin/env python3
"""
prune-imports — toglie dai file indicati i nomi importati da `recharts` e dal kit
`charts` che nel resto del file non compaiono più (dopo una migrazione).

Uso:  python scripts/prune-imports.py <file.tsx> [...]
"""
import re
import sys


def prune(path):
    s = open(path, encoding="utf-8").read()
    changed = False
    for mod in (r"recharts", r"(?:\.\./)+charts|\./charts"):
        pat = re.compile(r"import\s*\{([^}]*)\}\s*from\s*[\"'](" + mod + r")[\"'];?", re.S)
        m = pat.search(s)
        if not m:
            continue
        names = [x.strip() for x in m.group(1).split(",") if x.strip()]
        rest = s[:m.start()] + s[m.end():]
        keep = []
        for n in names:
            local = n.split(" as ")[-1].strip()
            if local.startswith("type "):
                local = local[5:].strip()
            if re.search(r"(?<![\w$])" + re.escape(local) + r"(?![\w$])", rest):
                keep.append(n)
        if len(keep) != len(names):
            changed = True
            if keep:
                new = "import { " + ", ".join(keep) + " } from \"" + m.group(2) + "\";"
            else:
                new = ""
            s = s[:m.start()] + new + s[m.end():]
    if changed:
        open(path, "w", encoding="utf-8").write(s)
    print(path, "pruned" if changed else "ok")


if __name__ == "__main__":
    for p in sys.argv[1:]:
        prune(p)
