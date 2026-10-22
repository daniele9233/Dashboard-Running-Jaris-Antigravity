#!/usr/bin/env python3
"""
prune-imports — toglie dai file indicati i nomi importati che nel resto del file
non compaiono più (dopo una migrazione o una rimozione di codice morto).

Uso:  python scripts/prune-imports.py [--all] <file.tsx> [...]

  senza `--all`  solo gli import da `recharts` e dal kit `charts`
  con    `--all` ogni import con nome (icone, componenti, tipi)
"""
import re
import sys


def prune(path, all_modules=False):
    s = open(path, encoding="utf-8").read()
    changed = False
    mods = (r"[^\"']+",) if all_modules else (r"recharts", r"(?:\.\./)+charts|\./charts")
    for mod in mods:
        pat = re.compile(r"import\s*\{([^}]*)\}\s*from\s*[\"'](" + mod + r")[\"'];?[ \t]*\r?\n?", re.S)
        # dall'ultimo al primo, così gli indici dei precedenti restano validi
        for m in reversed(list(pat.finditer(s))):
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
                new = ("import { " + ", ".join(keep) + " } from \"" + m.group(2) + "\";\n") if keep else ""
                s = s[:m.start()] + new + s[m.end():]
    if changed:
        open(path, "w", encoding="utf-8").write(s)
    print(path, "pruned" if changed else "ok")


if __name__ == "__main__":
    flags = {a for a in sys.argv[1:] if a.startswith("--")}
    for p in [a for a in sys.argv[1:] if not a.startswith("--")]:
        prune(p, "--all" in flags)
