#!/usr/bin/env python3
"""
design-codemod — migrazioni meccaniche verso il tema Elite Analytics.

Fa solo sostituzioni sicure e rivedibili sui file che gli si passano; tutto il
resto (struttura delle card, tooltip con `content` custom, margini speciali) si
rivede a mano. Non tocca mai dati, domini, scale, formatter o logica.

Uso:  python scripts/design-codemod.py [--dry] <file.tsx> [...]

Cosa fa
  1. Testo: `text-[7..11.5px]` → `text-xs`; `fontSize` JS/SVG sotto 12 → 12
  2. <CartesianGrid …/>            → preset `chartGrid` / `chartGridBoth`
  3. <XAxis/YAxis …/>              → preset `chartXAxis` / `chartYAxis` (toglie stroke, fontSize,
                                     tickLine, axisLine e `tick` letterale; mantiene dataKey, domain, formatter…)
  4. margin={{… negativo …}}       → margin={chartMargin}
  5. <Tooltip contentStyle…>       → <ChartTip …> (senza content custom); cursore per tipo di grafico
  6. colori esadecimali nel codice JS/JSX (non nelle classi Tailwind) → CHART_* del tema, solo
     per le famiglie con significato univoco (vedi HEX_MAP)
  7. aggiunge l'import da `../charts` (o `./charts`) dei simboli usati
"""
import re
import sys

# esadecimale → espressione del tema (solo famiglie con un significato solo)
HEX_MAP = {
    # lime = metrica primaria
    "#C0FF00": "CHART_SERIES.primary", "#CCFF00": "CHART_SERIES.primary", "#C8FF2D": "CHART_SERIES.primary",
    "#D4FF00": "CHART_SERIES.primary", "#D4FF33": "CHART_SERIES.primary", "#D4FF1A": "CHART_SERIES.primary",
    # ciano / blu / teal = aerobico, confronto
    "#22D3EE": "CHART_SERIES.compare", "#06B6D4": "CHART_SERIES.compare", "#3B82F6": "CHART_SERIES.compare",
    "#14B8A6": "CHART_SERIES.compare", "#38BDF8": "CHART_SERIES.compare", "#0EA5E9": "CHART_SERIES.compare",
    "#2DD4BF": "CHART_SERIES.compare",
    # viola = struttura
    "#A78BFA": "CHART_SERIES.tertiary", "#8B5CF6": "CHART_SERIES.tertiary", "#A855F7": "CHART_SERIES.tertiary",
    # ambra / arancio / giallo = carico e soglia
    "#F59E0B": "CHART_SERIES.load", "#F97316": "CHART_SERIES.load", "#FB923C": "CHART_SERIES.load",
    "#FF5B00": "CHART_SERIES.load", "#FBBF24": "CHART_SERIES.load", "#EAB308": "CHART_SERIES.load",
    # rosso / rosa = rischio, fatica, FC
    "#F43F5E": "CHART_SERIES.risk", "#EF4444": "CHART_SERIES.risk", "#FF4B93": "CHART_SERIES.risk",
    "#FF4D8D": "CHART_SERIES.risk",
    # verde = recupero, progresso
    "#22C55E": "CHART_SERIES.positive", "#10B981": "CHART_SERIES.positive", "#34D399": "CHART_SERIES.positive",
    "#4ADE80": "CHART_SERIES.positive", "#00FFAA": "CHART_SERIES.positive", "#06FFA5": "CHART_SERIES.positive",
    # indaco = modello / previsione
    "#6366F1": "CHART_SERIES.projected", "#818CF8": "CHART_SERIES.projected",
    # varianti già viste nelle viste analitiche
    "#FACC15": "CHART_SERIES.load", "#FFD700": "CHART_SERIES.load", "#60A5FA": "CHART_SERIES.compare",
    "#D7FF76": "CHART_SERIES.primary", "#4ADE80": "CHART_SERIES.positive", "#EC4899": "CHART_SERIES.risk",
    "#A2ACB7": "CHART_TEXT.muted", "#C7D0D8": "CHART_TEXT.muted", "#8A9562": "CHART_TEXT.muted", "#7EA533": "CHART_SERIES.primary",
    "#64748B": "CHART_TEXT.axis", "#475569": "CHART_TEXT.axis", "#555555": "CHART_TEXT.axis", "#888": "CHART_TEXT.axis",
    "#1F1F1F": "CHART_SURFACE.border", "#232323": "CHART_SURFACE.border", "#191919": "CHART_SURFACE.border",
    "#0C0C0C": "CHART_SURFACE.panel", "#101010": "CHART_SURFACE.panel", "#0F0F0F": "CHART_SURFACE.panel",
    "#2A3A2A": "CHART_SURFACE.borderStrong",
    # neutri
    "#FFFFFF": "CHART_TEXT.primary", "#FFF": "CHART_TEXT.primary", "#A0A0A0": "CHART_TEXT.muted",
    "#8A8A8A": "CHART_TEXT.axis", "#666666": "CHART_TEXT.faint", "#666": "CHART_TEXT.faint",
    "#0E0E0E": "CHART_SURFACE.panel", "#0A0A0A": "CHART_SURFACE.panel", "#111111": "CHART_SURFACE.panelSoft",
    "#111": "CHART_SURFACE.panelSoft", "#141414": "CHART_SURFACE.panelSoft", "#1A1A1A": "CHART_SURFACE.raised",
    "#1E1E1E": "CHART_SURFACE.border", "#2A2A2A": "CHART_SURFACE.borderStrong", "#333": "CHART_SURFACE.borderStrong",
    "#333333": "CHART_SURFACE.borderStrong", "#050505": "CHART_SURFACE.ink",
}

# colori testo usati sugli assi con contrasto insufficiente → asse (5.6:1)
AXIS_TEXT_FIX = {"#333": "CHART_TEXT.axis", "#444": "CHART_TEXT.axis", "#555": "CHART_TEXT.axis",
                 "#666": "CHART_TEXT.axis", "#71717A": "CHART_TEXT.axis", "#64748B": "CHART_TEXT.axis",
                 "#475569": "CHART_TEXT.axis", "#888": "CHART_TEXT.axis", "#777": "CHART_TEXT.axis"}

used = set()


def need(*names):
    used.update(names)


# ── 1 · testo ────────────────────────────────────────────────────────────────
def fix_text_sizes(s):
    s = re.sub(r"text-\[(?:7|8|9|9\.5|10|10\.5|11|11\.5)px\]", "text-xs", s)
    def js(m):
        v = float(m.group(2))
        return m.group(1) + ("12" if v < 12 else m.group(2)) + m.group(3)
    s = re.sub(r"(fontSize:\s*)(\d+(?:\.\d+)?)(\b)", js, s)
    s = re.sub(r"(fontSize=\{)(\d+(?:\.\d+)?)(\})", js, s)
    s = re.sub(r'(fontSize=")(\d+(?:\.\d+)?)(")', js, s)
    return s


# ── helpers per tag JSX ──────────────────────────────────────────────────────
def find_tag_end(s, i):
    """Indice del `>` che chiude il tag aperto in `i`, rispettando {} e stringhe."""
    depth = 0
    j = i
    q = None
    while j < len(s):
        c = s[j]
        if q:
            if c == q and s[j - 1] != "\\":
                q = None
        elif c in "\"'`":
            q = c
        elif c == "{":
            depth += 1
        elif c == "}":
            depth -= 1
        elif c == ">" and depth == 0:
            return j
        j += 1
    return -1


def split_attrs(body):
    """Divide gli attributi di un tag JSX in token (nome=valore | nome | {...spread})."""
    attrs = []
    i = 0
    n = len(body)
    while i < n:
        while i < n and body[i].isspace():
            i += 1
        if i >= n:
            break
        start = i
        if body[i] == "{":
            depth = 0
            while i < n:
                if body[i] == "{":
                    depth += 1
                elif body[i] == "}":
                    depth -= 1
                    if depth == 0:
                        i += 1
                        break
                i += 1
            attrs.append(body[start:i])
            continue
        while i < n and not body[i].isspace() and body[i] != "=":
            i += 1
        name = body[start:i]
        if i < n and body[i] == "=":
            i += 1
            if body[i] == '"' or body[i] == "'":
                q = body[i]
                i += 1
                while i < n and body[i] != q:
                    i += 1
                i += 1
            elif body[i] == "{":
                depth = 0
                q = None
                while i < n:
                    c = body[i]
                    if q:
                        if c == q and body[i - 1] != "\\":
                            q = None
                    elif c in "\"'`":
                        q = c
                    elif c == "{":
                        depth += 1
                    elif c == "}":
                        depth -= 1
                        if depth == 0:
                            i += 1
                            break
                    i += 1
            attrs.append(body[start:i])
        else:
            attrs.append(name)
    return attrs


def attr_name(a):
    return a.split("=", 1)[0].strip()


def rewrite_tags(s, tag, fn):
    out = []
    i = 0
    pat = re.compile(r"<" + tag + r"(?=[\s/>])")
    while True:
        m = pat.search(s, i)
        if not m:
            out.append(s[i:])
            break
        out.append(s[i:m.start()])
        end = find_tag_end(s, m.end())
        if end < 0:
            out.append(s[m.start():])
            break
        selfclose = s[end - 1] == "/"
        body = s[m.end():end - 1 if selfclose else end]
        res = fn(split_attrs(body), selfclose, s, m.start())
        if res is None:
            out.append(s[m.start():end + 1])
        else:
            out.append(res)
        i = end + 1
    return "".join(out)


# ── 2 · griglia ──────────────────────────────────────────────────────────────
def grid_fn(attrs, selfclose, s, pos):
    names = {attr_name(a): a for a in attrs}
    # già migrata: non toccare (idempotenza)
    if any(a.startswith("{...chartGrid") for a in attrs):
        return None
    allowed = {"strokeDasharray", "stroke", "vertical", "horizontal", "opacity"}
    if not set(names) <= allowed:
        return None
    kind = chart_kind_before(s, pos)
    vertical = names.get("vertical", "vertical={true}")
    horizontal = names.get("horizontal", "horizontal={true}")
    if "false" in horizontal and "false" not in vertical:
        need("chartGridBoth")
        return "<CartesianGrid {...chartGridBoth} horizontal={false} />"
    if kind == "ScatterChart" or ("false" not in vertical and kind not in ("LineChart", "AreaChart", "ComposedChart", "BarChart")):
        need("chartGridBoth")
        return "<CartesianGrid {...chartGridBoth} />"
    need("chartGrid")
    return "<CartesianGrid {...chartGrid} />"


# ── 3 · assi ─────────────────────────────────────────────────────────────────
TICK_LITERAL = re.compile(r"^tick=\{\{[^{}]*\}\}$", re.S)


def axis_fn(kind):
    preset = "chartXAxis" if kind == "XAxis" else "chartYAxis"

    def fn(attrs, selfclose, s, pos):
        keep = []
        for a in attrs:
            n = attr_name(a)
            if a.startswith("{...chart") and a.endswith("Axis}"):
                continue
            if n in ("stroke", "fontSize", "tickLine", "axisLine"):
                continue
            if n == "tick" and TICK_LITERAL.match(a.replace("\n", " ")):
                # `tick={{ fill, fontSize, fontFamily, fontWeight }}` letterale: lo fa il preset
                inner = a[a.index("{{") + 2:-2]
                if re.fullmatch(r"\s*(?:(?:fill|fontSize|fontFamily|fontWeight)\s*:\s*[^,]+,?\s*)+", inner):
                    continue
            keep.append(a)
        need(preset)
        if kind == "YAxis" and any(attr_name(a) == "hide" for a in keep) and not any(attr_name(a) == "width" for a in keep):
            keep.append("width={0}")  # un asse nascosto non deve riservare spazio
        body = " ".join(["{..." + preset + "}"] + keep)
        return f"<{kind} {body} />" if selfclose else f"<{kind} {body}>"

    return fn


# ── 4 · margini ──────────────────────────────────────────────────────────────
def fix_margins(s):
    def rep(m):
        txt = m.group(0)
        if re.search(r"(?:left|right)\s*:\s*-\d", txt):
            need("chartMargin")
            return "margin={chartMargin}"
        return txt
    return re.sub(r"margin=\{\{[^{}]*\}\}", rep, s)


# ── 5 · tooltip ──────────────────────────────────────────────────────────────
def chart_kind_before(s, pos):
    kinds = list(re.finditer(r"<(BarChart|LineChart|AreaChart|ComposedChart|ScatterChart|RadarChart|RadialBarChart|PieChart)\b", s[:pos]))
    return kinds[-1].group(1) if kinds else ""


def tooltip_fn(attrs, selfclose, s, pos):
    names = {attr_name(a): a for a in attrs}
    if "content" in names:
        return None  # custom: a mano
    drop = {"contentStyle", "labelStyle", "itemStyle", "wrapperStyle"}
    keep = [a for a in attrs if attr_name(a) not in drop]
    kind = chart_kind_before(s, pos)
    if "cursor" not in names:
        if kind == "BarChart":
            need("chartCursorBar")
            keep.append("cursor={chartCursorBar}")
    else:
        keep = [a for a in keep if attr_name(a) != "cursor"]
        if kind == "BarChart":
            need("chartCursorBar")
            keep.append("cursor={chartCursorBar}")
    need("ChartTip")
    return "<ChartTip " + " ".join(keep) + " />"


# ── 6 · colori ───────────────────────────────────────────────────────────────
def fix_colors(s):
    # solo letterali "#RRGGBB" / '#RRGGBB' dentro attributi JSX o oggetti JS (non classi Tailwind)
    def jsx_attr(m):
        name, q, hx = m.group(1), m.group(2), m.group(3).upper()
        expr = HEX_MAP.get(hx)
        if name in ("stroke", "fill") and hx in AXIS_TEXT_FIX and m.group(0).startswith("stroke") and False:
            expr = AXIS_TEXT_FIX[hx]
        if not expr:
            return m.group(0)
        need(expr.split(".")[0])
        return f"{name}={{{expr}}}"
    s = re.sub(r"\b(stroke|fill|stopColor|color|background|backgroundColor|borderColor)=([\"'])(#[0-9A-Fa-f]{3,6})\2", jsx_attr, s)

    def obj(m):
        key, q, hx = m.group(1), m.group(2), m.group(3).upper()
        expr = HEX_MAP.get(hx)
        if not expr:
            return m.group(0)
        need(expr.split(".")[0])
        return f"{key}: {expr}"
    s = re.sub(r"\b(stroke|fill|stopColor|color|background|backgroundColor|borderColor|border)\s*:\s*([\"'])(#[0-9A-Fa-f]{3,6})\2", obj, s)

    # alternative di un ternario: `cond ? '#F43F5E' : '#555555'` (solo valori noti)
    def tern(m):
        op, q, hx = m.group(1), m.group(2), m.group(3).upper()
        expr = HEX_MAP.get(hx)
        if not expr:
            return m.group(0)
        need(expr.split(".")[0])
        return f"{op} {expr}"
    s = re.sub(r"([?:])\s*([\"'])(#[0-9A-Fa-f]{6})\2(?=\s*[:,)}\n]|\s*$)", tern, s)
    return s


# ── 7 · contenitori di plot ─────────────────────────────────────────────────
def plot_size(px):
    return "compact" if px <= 180 else "standard" if px <= 270 else "tall" if px <= 340 else "hero"


def fix_plots(s):
    pat = re.compile(r'<div className="(?:h-\[(\d+)px\] w-full|w-full h-\[(\d+)px\])">(\s*)<ResponsiveContainer')
    out = []
    i = 0
    while True:
        m = pat.search(s, i)
        if not m:
            out.append(s[i:])
            break
        end = re.compile(r"</ResponsiveContainer>(\s*)</div>").search(s, m.end())
        if not end:
            out.append(s[i:])
            break
        px = int(m.group(1) or m.group(2))
        need("ChartPlot")
        out.append(s[i:m.start()])
        out.append(f'<ChartPlot size="{plot_size(px)}">' + m.group(3) + "<ResponsiveContainer" + s[m.end():end.start()] + "</ResponsiveContainer>" + end.group(1) + "</ChartPlot>")
        i = end.end()
    return "".join(out)


def replace_function(s, name, replacement):
    m = re.search(r"^(?:export )?function " + name + r"\b", s, re.M)
    if not m:
        return s
    i = s.index("{", s.index(")", m.start()))
    # salta la firma con eventuale tipo oggetto: trova la `{` del corpo = prima `{` dopo `)` o dopo `: ... {`
    depth = 0
    j = s.index("(", m.start())
    paren = 0
    while True:
        c = s[j]
        if c == "(":
            paren += 1
        elif c == ")":
            paren -= 1
            if paren == 0:
                break
        j += 1
    k = s.index("{", j)
    # un eventuale tipo di ritorno non è usato in questa base di codice
    depth = 0
    while True:
        if s[k] == "{":
            depth += 1
        elif s[k] == "}":
            depth -= 1
            if depth == 0:
                break
        k += 1
    return s[:m.start()] + replacement + s[k + 1:]


def drop_unused_box(s):
    m = re.search(r"^const box = \{[^;]*?\};" + chr(10), s, re.M | re.S)
    if m and s.count("box") == m.group(0).count("box"):
        return s[:m.start()] + s[m.end():]
    return s


# ── 8 · classi Tailwind: colori arbitrari → token, vetro → piatto ─────────────
CLS_MAP = {
    # (prefisso, esadecimale minuscolo) → classe del token
    "text": {
        "#c0ff00": "text-ea-lime", "#ccff00": "text-ea-lime", "#22d3ee": "text-ea-cyan", "#f59e0b": "text-ea-amber",
        "#f43f5e": "text-ea-rose", "#22c55e": "text-ea-green", "#10b981": "text-ea-green", "#34d399": "text-ea-green",
        "#a78bfa": "text-ea-violet", "#8b5cf6": "text-ea-violet", "#818cf8": "text-ea-indigo", "#6366f1": "text-ea-indigo",
        "#a0a0a0": "text-ea-text-muted", "#999": "text-ea-text-muted", "#9ca3af": "text-ea-text-muted", "#aaa": "text-ea-text-muted",
        "#8a8a8a": "text-ea-text-axis", "#888": "text-ea-text-axis", "#777": "text-ea-text-axis", "#7a7a7a": "text-ea-text-axis",
        "#6b7280": "text-ea-text-axis", "#666": "text-ea-text-axis", "#666666": "text-ea-text-axis", "#555": "text-ea-text-axis",
        "#555555": "text-ea-text-axis", "#444": "text-ea-text-axis", "#333": "text-ea-text-axis", "#3a3a3a": "text-ea-text-axis",
        "#475569": "text-ea-text-axis", "#64748b": "text-ea-text-axis", "#71717a": "text-ea-text-axis", "#5a5a5a": "text-ea-text-axis",
        "#fff": "text-white", "#ffffff": "text-white",
        "#a6a6a6": "text-ea-text-muted", "#dadada": "text-white", "#bdbdbd": "text-ea-text-muted", "#787878": "text-ea-text-axis",
        "#ff4b93": "text-ea-rose", "#ff5b00": "text-ea-amber", "#facc15": "text-ea-amber", "#f97316": "text-ea-amber",
        "#60a5fa": "text-ea-cyan", "#14b8a6": "text-ea-cyan", "#3b82f6": "text-ea-cyan", "#ccff00": "text-ea-lime",
    },
    "bg": {
        "#c0ff00": "bg-ea-lime", "#ccff00": "bg-ea-lime", "#22d3ee": "bg-ea-cyan", "#f59e0b": "bg-ea-amber",
        "#f43f5e": "bg-ea-rose", "#22c55e": "bg-ea-green", "#10b981": "bg-ea-green", "#34d399": "bg-ea-green",
        "#a78bfa": "bg-ea-violet", "#8b5cf6": "bg-ea-violet", "#818cf8": "bg-ea-indigo", "#6366f1": "bg-ea-indigo",
        "#050505": "bg-ea-ink", "#000": "bg-ea-ink", "#000000": "bg-ea-ink",
        "#0a0a0a": "bg-ea-surface-1", "#0e0e0e": "bg-ea-surface-1", "#0d0d0d": "bg-ea-surface-1", "#101010": "bg-ea-surface-1",
        "#0f0f0f": "bg-ea-surface-1", "#0c0c0c": "bg-ea-surface-1",
        "#111": "bg-ea-surface-2", "#111111": "bg-ea-surface-2", "#121212": "bg-ea-surface-2", "#141414": "bg-ea-surface-2",
        "#151515": "bg-ea-surface-2", "#161616": "bg-ea-surface-2",
        "#1a1a1a": "bg-ea-surface-3", "#1e1e1e": "bg-ea-surface-3", "#1f1f1f": "bg-ea-surface-3", "#2a2a2a": "bg-ea-hairline-strong",
        "#ff5b00": "bg-ea-amber", "#facc15": "bg-ea-amber", "#4ade80": "bg-ea-green", "#ff4b93": "bg-ea-rose", "#60a5fa": "bg-ea-cyan",
        # tinte scure di lime usate come fondo di icone e chip → lime a bassa opacità
        "#2d350a": "bg-ea-lime/10", "#1b2a0b": "bg-ea-lime/10", "#243018": "bg-ea-lime/10", "#273510": "bg-ea-lime/10",
        "#10130d": "bg-ea-lime/5", "#10130a": "bg-ea-lime/5", "#1f290e": "bg-ea-lime/10", "#20290f": "bg-ea-lime/10",
    },
    "border": {
        "#c0ff00": "border-ea-lime", "#22d3ee": "border-ea-cyan", "#f59e0b": "border-ea-amber", "#f43f5e": "border-ea-rose",
        "#22c55e": "border-ea-green", "#a78bfa": "border-ea-violet",
        "#2a2a2a": "border-ea-hairline-strong", "#242424": "border-ea-hairline-strong", "#252525": "border-ea-hairline-strong",
        "#222": "border-ea-hairline-strong", "#262626": "border-ea-hairline-strong", "#2f2f2f": "border-ea-hairline-strong",
        "#333": "border-ea-hairline-strong", "#3a3a3a": "border-ea-hairline-strong",
        "#1e1e1e": "border-ea-hairline", "#1a1a1a": "border-ea-hairline", "#191919": "border-ea-hairline", "#181818": "border-ea-hairline",
        "#202020": "border-ea-hairline", "#111": "border-ea-hairline",
    },
}
# vetro decorativo → tonale piatto
GLASS_SHADOW = "shadow-[0_8px_32px_rgba(0,0,0,0.7),inset_0_1px_0_rgba(255,255,255,0.08)]"


def fix_classes(s):
    def rep(m):
        prefix, hx, op = m.group(1), m.group(2).lower(), m.group(3) or ""
        cls = CLS_MAP.get(prefix, {}).get(hx)
        return (cls + op) if cls else m.group(0)
    s = re.sub(r"\b(text|bg|border)-\[(#[0-9a-fA-F]{3,6})\](/\d+)?", rep, s)
    # bordo bianco traslucido → filo di sistema
    s = re.sub(r"border-white/\[0\.(?:06|08|1|12|10)\]", "border-ea-hairline", s)
    s = re.sub(r"border-white/(?:5|10|\[0\.05\])\b", "border-ea-hairline", s)
    # vetro: blur + gradiente + ombra interna → superficie piatta
    s = re.sub(r"\bbackdrop-blur(?:-\w+)?\b ?", "", s)
    s = re.sub(r"bg-gradient-to-br from-white/\[0\.0\d\] to-black/\d+", "bg-ea-surface-2", s)
    s = s.replace(GLASS_SHADOW + " ", "").replace(" " + GLASS_SHADOW, "").replace(GLASS_SHADOW, "")
    return s


def fix_glow(s):
    """Aloni a offset zero (box-shadow/drop-shadow/filtri glow): decorazione, non profondità."""
    # classi Tailwind
    s = re.sub(r"\s?shadow-\[0_0_[^\]]+\]", "", s)
    s = re.sub(r"\s?drop-shadow-(?:lg|xl|2xl|md|sm|\[[^\]]+\])", "", s)
    # style={{ filter: `drop-shadow(0 0 …)` }} come unica proprietà
    s = re.sub(r"\s*style=\{\{\s*filter:\s*`drop-shadow\(0 0[^`]*`,?\s*\}\}", "", s)
    s = re.sub(r"\s*style=\{\{\s*boxShadow:\s*`0 0 [^`]*`,?\s*\}\}", "", s)
    # … o dentro uno style più ricco
    s = re.sub(r",?\s*filter:\s*`drop-shadow\(0 0[^`]*`", "", s)
    s = re.sub(r",?\s*boxShadow:\s*`0 0 [^`]*`", "", s)
    # filtri glow SVG (le definizioni restano: sono inerti senza riferimenti)
    s = re.sub(r'\s*filter="url\(#[A-Za-z0-9-]*glow[A-Za-z0-9-]*\)"', "", s)
    return s


def fix_titles(s):
    """Titoli di card: una sola grammatica (18/24 bold, niente corsivo, niente maiuscolo spaziato)."""
    keep_re = re.compile(r"^(?:-?m[trblxy]?-|flex$|items-|gap-|min-w-|truncate$|leading-)")
    def head(m):
        tag, cls = m.group(1), m.group(2)
        if tag == "h1" or re.search(r"text-(?:3|4|5|6)xl", cls) and tag != "h3":
            return m.group(0)  # titoli di pagina e display: non sono titoli di card
        if not ("italic" in cls or ("font-black" in cls and "uppercase" in cls)):
            return m.group(0)
        keep = [c for c in cls.split() if keep_re.match(c) and not c.startswith("leading-")]
        return f'<{tag} className="{" ".join(["ea-title"] + keep)}"'
    s = re.sub(r'<(h[1-4]) className="([^"]*)"', head, s)
    # numeri e valori: mai in corsivo
    s = re.sub(r"\bfont-black italic\b", "font-black", s)
    s = re.sub(r"(?<![\w-])italic ", "", s)
    s = s.replace(' fontStyle="italic"', "")
    s = re.sub(r'\sitalic(?=")', "", s)
    return s


def fix_shells(s):
    """Il guscio delle card: niente filo laterale colorato, niente sfondi atmosferici, un solo raggio e padding."""
    # filo laterale colorato (3 px) come unica proprietà di style → via lo style
    s = re.sub(r"\s*style=\{\{\s*borderLeft:\s*`3px solid \$\{[^}`]+\}`,?\s*\}\}", "", s)
    # … o dentro uno style più ricco → via la sola riga
    s = re.sub(r"\n[ \t]*borderLeft:\s*`3px solid \$\{[^}`]+\}`,?", "", s)
    s = re.sub(r"borderLeft:\s*`3px solid \$\{[^}`]+\}`,\s*", "", s)
    s = re.sub(r"\n[ \t]*border(?:Top|Right|Bottom):\s*`[234]px solid \$\{[^}`]+\}`,?", "", s)
    s = re.sub(r"\bborder-l-(?:2|4|\[3px\])\b ?", "", s)
    # sfondi atmosferici a gradiente radiale → superficie di sistema
    s = re.sub(r"background:\s*'radial-gradient\([^']*'", "background: CHART_SURFACE.panel", s)
    s = re.sub(r"boxShadow:\s*'inset 0 1px 0 rgba\(255,255,255,0\.02\)[^']*',?\s*", "", s)
    if "background: CHART_SURFACE.panel" in s:
        need("CHART_SURFACE")
    # un solo raggio e un solo padding per le card
    s = re.sub(r"rounded-\[(?:26|28|30)px\]", "rounded-2xl", s)
    s = re.sub(r"(rounded-2xl) p-(?:6|7|8)\b", r"\1 p-5", s)
    s = re.sub(r"(rounded-2xl) p-4 md:p-7\b", r"\1 p-4 md:p-5", s)
    s = re.sub(r"(rounded-2xl) p-6 sm:p-8\b", r"\1 p-4 sm:p-5", s)
    return s


def add_import(s, rel):
    # il vecchio punto d'ingresso `./chartTheme` confluisce nell'import del kit
    legacy = re.search(r"import\s*\{([^}]*)\}\s*from\s*[\"'](?:\.{1,2}/)+(?:statistics/)?chartTheme[\"'];?[ \t]*\n?", s)
    if legacy:
        used.update(x.strip().split(" as ")[0] for x in legacy.group(1).split(",") if x.strip())
        s = s[:legacy.start()] + s[legacy.end():]
    if not used:
        return s
    names = sorted(used)
    pat = re.compile(r"import\s*\{([^}]*)\}\s*from\s*[\"']" + re.escape(rel) + r"[\"'];?")
    found = list(pat.finditer(s))
    if found:
        have = set()
        for m in found:
            have |= {x.strip() for x in m.group(1).split(",") if x.strip()}
        names = sorted(have | set(names))
        text = "import { " + ", ".join(names) + " } from \"" + rel + "\";"
        # sostituisce il primo, elimina gli altri (e la riga vuota che lasciano)
        for m in reversed(found[1:]):
            end = m.end() + (1 if s[m.end():m.end() + 1] == chr(10) else 0)
            s = s[:m.start()] + s[end:]
        m0 = found[0]
        return s[:m0.start()] + text + s[m0.end():]
    # dopo l'ultimo import
    imps = list(re.finditer(r"^import[^;]*;\s*$", s, re.M))
    at = imps[-1].end() if imps else 0
    return s[:at] + "\nimport { " + ", ".join(names) + " } from \"" + rel + "\";" + s[at:]


def process(path, dry=False):
    used.clear()
    s = open(path, encoding="utf-8").read()
    orig = s
    svg_only = "--svg" in sys.argv  # SVG proprietari: solo colori e corpi del testo, mai struttura
    s = fix_text_sizes(s)
    if "--text" in sys.argv:  # solo la regola dei dodici: nessun altro intervento
        if s != orig and not dry:
            open(path, "w", encoding="utf-8").write(s)
        print(("[dry] " if dry else "") + path, "changed" if s != orig else "unchanged", "text")
        return
    if not svg_only:
        s = fix_classes(s)
        s = fix_shells(s)
        s = fix_titles(s)
        s = fix_glow(s)
        s = s.replace("rounded-3xl", "rounded-2xl").replace("rounded-[24px]", "rounded-2xl")
    s = rewrite_tags(s, "CartesianGrid", grid_fn)
    s = rewrite_tags(s, "XAxis", axis_fn("XAxis"))
    s = rewrite_tags(s, "YAxis", axis_fn("YAxis"))
    s = fix_margins(s)
    s = rewrite_tags(s, "Tooltip", tooltip_fn)
    s = fix_colors(s)
    s = fix_plots(s)
    if "--panel" in sys.argv:
        before = s
        s = replace_function(s, "Panel", "const Panel = ChartPanel;")
        if s != before:
            need("ChartPanel")
    s = drop_unused_box(s)
    # percorso relativo del kit
    rel = "../charts" if "/statistics/" in path.replace("\\", "/") else ("../../charts" if "/dashboard/widgets/" in path.replace("\\", "/") else "./charts")
    if "/pacelab/" in path.replace("\\", "/") or "/racelab/" in path.replace("\\", "/") or "/gamification/" in path.replace("\\", "/"):
        rel = "../charts"
    s = add_import(s, rel)
    if s != orig and not dry:
        open(path, "w", encoding="utf-8").write(s)
    print(("[dry] " if dry else "") + path, "changed" if s != orig else "unchanged", sorted(used))


if __name__ == "__main__":
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    dry = "--dry" in sys.argv
    for p in args:
        process(p, dry)
