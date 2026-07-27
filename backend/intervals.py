"""
Parziali delle sedute di ripetute — estrazione e normalizzazione.

Problema che risolve: su una seduta di ripetute lo split automatico per km
media lavoro e recupero dentro lo stesso chilometro e la seduta sparisce
("5 km @ 4:35" invece di "6×600 @ 3:58 con rec 2:10"). I giri dell'orologio
sono il dato giusto, ma nel database sono presenti solo su una manciata di
corse: il sync li scarica solo per le attività nuove.

Questo modulo produce i parziali dalla fonte migliore disponibile:

    1. laps     — giri dell'orologio (gold standard)
    2. streams  — segmentazione lavoro/recupero dai dati per-punto
    3. splits   — parziali automatici per km (ultima spiaggia, dichiarata)

L'output è la stessa struttura in tutti e tre i casi, così la UI non deve
sapere da dove arriva il dato — solo dichiararlo all'utente.
"""
from typing import Optional


def _import_server():
    """Import tardivo, come in deps.py: evita import circolari a load time."""
    try:
        import server as _s  # noqa: PLC0415
        return _s
    except ImportError:  # pragma: no cover
        from backend import server as _s  # type: ignore  # noqa: PLC0415
        return _s


def grade_adjustment_sec(grade_pct: float) -> float:
    """Secondi/km da sottrarre al passo grezzo per avere il passo equivalente in piano.

    Delega a server.py, che è la fonte unica del modello (Minetti asimmetrico:
    salita ~12.5 s/km per 1%, discesa ~7 s/km per 1% con attenuazione oltre
    l'-8% e tetto a 55 s/km). Duplicare la formula qui significherebbe avere due
    PBP diversi nella stessa app.
    """
    try:
        return _import_server()._grade_adjustment_sec(grade_pct)
    except Exception:  # pragma: no cover — solo se server non è importabile
        if grade_pct >= 0:
            return grade_pct * 12.5
        g = abs(grade_pct)
        benefit = 7.0 if g <= 8.0 else max(2.0, 7.0 - (g - 8.0) * 1.2)
        return -min(g * benefit, 55.0)


def _two_means(vals: list, iters: int = 25) -> tuple:
    """2-means monodimensionale sui pace. Ritorna (centroide veloce, lento)."""
    if not vals:
        return (0.0, 0.0)
    cf, cs = min(vals), max(vals)
    if cf == cs:
        return (cf, cs)
    for _ in range(iters):
        fast = [v for v in vals if abs(v - cf) <= abs(v - cs)]
        slow = [v for v in vals if abs(v - cf) > abs(v - cs)]
        if not fast or not slow:
            break
        nf, ns = sum(fast) / len(fast), sum(slow) / len(slow)
        if abs(nf - cf) < 0.1 and abs(ns - cs) < 0.1:
            cf, cs = nf, ns
            break
        cf, cs = nf, ns
    return (cf, cs)


def _median_filter(arr: list, w: int) -> list:
    n = len(arr)
    out = []
    for i in range(n):
        window = sorted(arr[max(0, i - w):min(n, i + w + 1)])
        out.append(window[len(window) // 2] if window else arr[i])
    return out


def _mk_segment(
    idx: int,
    kind: str,
    distance_m: float,
    moving_time_s: float,
    avg_hr: Optional[float] = None,
    max_hr: Optional[float] = None,
    elev_delta_m: Optional[float] = None,
) -> Optional[dict]:
    """Normalizza un segmento e ne calcola passo e PBP.

    `elev_delta_m` è il dislivello NETTO (arrivo − partenza), non il guadagno
    cumulato: usare il guadagno farebbe risultare in salita anche un tratto che
    torna al punto di partenza, gonfiando il PBP.
    """
    if distance_m <= 0 or moving_time_s <= 0:
        return None
    km = distance_m / 1000.0
    pace_sec = moving_time_s / km
    seg = {
        "index": idx,
        "kind": kind,
        "distance_m": round(distance_m, 1),
        "moving_time_s": round(moving_time_s, 1),
        "pace_sec": round(pace_sec, 1),
        "avg_hr": round(avg_hr) if avg_hr else None,
        "max_hr": round(max_hr) if max_hr else None,
        "grade_pct": None,
        "gap_pace_sec": None,
    }
    if elev_delta_m is not None and distance_m > 0:
        grade = (elev_delta_m / distance_m) * 100.0
        seg["grade_pct"] = round(grade, 2)
        seg["elev_delta_m"] = round(elev_delta_m, 1)
        # PBP: passo che avresti tenuto in piano con lo stesso sforzo.
        seg["gap_pace_sec"] = round(pace_sec - grade_adjustment_sec(grade), 1)
    return seg


# Soglie allineate al classificatore strutturale già in uso in server.py
# (`_classify_run_v2`), così una seduta è "ripetute" qui se lo è anche lì.
MAX_WORK_PACE_SEC = 330.0   # 5:30/km — oltre non è lavoro di qualità
MIN_SEPARATION = 1.15       # rapporto recupero/lavoro minimo sui giri
MIN_STREAM_SEPARATION = 1.30  # più severo: gli streams rumoreggiano di più
MAX_REP_DISTANCE_M = 5000.0  # una ripetuta più lunga di così è un tratto continuo
MIN_REP_DISTANCE_M = 150.0


def _label_work_recovery(segments: list) -> list:
    """Etichetta i segmenti come lavoro o recupero separando i pace in due gruppi.

    Servono DUE condizioni, non una: un contrasto reale fra i due centroidi e un
    passo di lavoro abbastanza veloce. Solo il contrasto non basta — una corsa
    facile con due soste al semaforo produce lo stesso identico contrasto, e
    chiamare "ripetute" quei tratti sarebbe una lettura inventata.
    """
    usable = [s for s in segments if s["distance_m"] >= 120 and s["moving_time_s"] >= 15]
    if len(usable) < 3:
        return segments
    paces = [s["pace_sec"] for s in usable]
    cf, cs = _two_means(paces)
    if cf <= 0 or cs / cf < MIN_SEPARATION or cf > MAX_WORK_PACE_SEC:
        for s in segments:
            s["kind"] = "steady"
        return segments
    thr = (cf + cs) / 2.0
    for s in segments:
        s["kind"] = "work" if s["pace_sec"] <= thr else "recovery"
    return segments


# ─── Fonte 1: giri dell'orologio ─────────────────────────────────────────────
def _net_elevation_by_lap(laps: list, streams: list) -> list:
    """Dislivello NETTO per giro, ricavato dall'altimetria degli streams.

    I laps di Strava portano solo `total_elevation_gain` (guadagno cumulato):
    su un giro che sale e ridiscende vale >0 anche se il netto è zero, e il PBP
    ne uscirebbe falsato. Con gli streams si legge la quota agli estremi del
    giro e si ottiene il netto vero.
    """
    out: list = [None] * len(laps)
    if not streams:
        return out
    pts = [s for s in streams if isinstance(s, dict) and s.get("d") is not None]
    if len(pts) < 4:
        return out
    ds = [p["d"] for p in pts]
    alts = [p.get("alt") for p in pts]
    if all(a is None for a in alts):
        return out

    def alt_at(target_m: float) -> Optional[float]:
        # primo punto oltre la distanza cercata
        for i, d in enumerate(ds):
            if d >= target_m:
                for j in range(i, -1, -1):
                    if alts[j] is not None:
                        return alts[j]
                return None
        for j in range(len(alts) - 1, -1, -1):
            if alts[j] is not None:
                return alts[j]
        return None

    cursor = 0.0
    for i, lp in enumerate(laps):
        dist = lp.get("distance") or 0
        if dist <= 0:
            cursor += dist
            continue
        a0 = alt_at(cursor)
        a1 = alt_at(cursor + dist)
        if a0 is not None and a1 is not None:
            out[i] = a1 - a0
        cursor += dist
    return out


def segments_from_laps(laps: list, streams: Optional[list] = None) -> list:
    """Parziali dai giri dell'orologio. Scarta i giri-artefatto (<120 m o <15 s)."""
    if not laps:
        return []
    net_elev = _net_elevation_by_lap(laps, streams or [])
    segs = []
    for i, lp in enumerate(laps):
        dist = lp.get("distance") or 0
        mt = lp.get("moving_time") or lp.get("elapsed_time") or 0
        if dist < 120 or mt < 15:
            continue
        elev = net_elev[i]
        if elev is None:
            # Ripiego sul guadagno cumulato: meglio di niente, ma sovrastima la
            # salita sui giri che tornano indietro.
            elev = lp.get("total_elevation_gain")
        seg = _mk_segment(
            idx=lp.get("lap_index") or (i + 1),
            kind="work",
            distance_m=dist,
            moving_time_s=mt,
            avg_hr=lp.get("average_heartrate"),
            max_hr=lp.get("max_heartrate"),
            elev_delta_m=elev,
        )
        if seg:
            segs.append(seg)
    return _label_work_recovery(segs)


# ─── Fonte 2: streams per-punto ──────────────────────────────────────────────
def segments_from_streams(streams: list, duration_minutes: float) -> list:
    """Segmenta lavoro/recupero dai dati per-punto quando i giri non ci sono.

    Stessa base del classificatore strutturale già in uso (`_workout_structure_
    from_streams`), ma qui si conservano gli indici dei blocchi per poter
    calcolare passo, FC e dislivello di ogni singolo tratto.
    """
    st = streams or []
    dur_s = (duration_minutes or 0) * 60
    if len(st) < 12 or dur_s <= 0:
        return []
    pts = [s for s in st if isinstance(s, dict)]
    ds = [p.get("d") for p in pts]
    if len(ds) < 12:
        return []
    for i in range(len(ds)):
        if ds[i] is None:
            ds[i] = ds[i - 1] if i > 0 else 0.0
    n = len(ds)
    dt = dur_s / (n - 1)

    pace = []
    for i in range(n - 1):
        dd = ds[i + 1] - ds[i]
        pace.append(999.0 if dd <= 0.3 else 1000.0 * dt / dd)  # 999 = fermo
    pace.append(pace[-1] if pace else 999.0)
    sp = _median_filter(pace, max(2, int(round(15.0 / dt))))  # smoothing ~15 s

    moving = [p for p in sp if p < 900]
    if len(moving) < 12:
        return []
    cf, cs = _two_means(moving)
    # Il contrasto da solo produce falsi positivi: una corsa facile con qualche
    # sosta ha lo stesso profilo di una seduta di ripetute. Serve anche che il
    # passo "veloce" sia davvero un passo di qualità.
    if cf <= 0 or cs / cf < MIN_STREAM_SEPARATION or cf > MAX_WORK_PACE_SEC:
        return []
    thr = (cf + cs) / 2.0

    flags = [1 if (p < thr and p < 900) else 0 for p in sp]
    blocks = []
    i = 0
    while i < n:
        v = flags[i]
        j = i
        while j < n and flags[j] == v:
            j += 1
        blocks.append({"v": v, "i0": i, "i1": min(j, n - 1)})
        i = j

    # Fonde i micro-blocchi (<20 s) nel precedente: un singolo campione lento in
    # mezzo a una ripetuta non è un recupero.
    merged: list = []
    for b in blocks:
        dur_b = (b["i1"] - b["i0"]) * dt
        if merged and dur_b < 20:
            merged[-1]["i1"] = b["i1"]
        else:
            merged.append(dict(b))

    hrs = [p.get("hr") for p in pts]
    alts = [p.get("alt") for p in pts]

    segs = []
    idx = 0
    for b in merged:
        i0, i1 = b["i0"], b["i1"]
        dist = ds[i1] - ds[i0]
        time_s = (i1 - i0) * dt
        if dist < 100 or time_s < 15:
            continue
        idx += 1
        window_hr = [h for h in hrs[i0:i1 + 1] if isinstance(h, (int, float))]
        a0 = next((a for a in alts[i0:i1 + 1] if a is not None), None)
        a1 = next((a for a in reversed(alts[i0:i1 + 1]) if a is not None), None)
        seg = _mk_segment(
            idx=idx,
            kind="work" if b["v"] == 1 else "recovery",
            distance_m=dist,
            moving_time_s=time_s,
            avg_hr=(sum(window_hr) / len(window_hr)) if window_hr else None,
            max_hr=max(window_hr) if window_hr else None,
            elev_delta_m=(a1 - a0) if (a0 is not None and a1 is not None) else None,
        )
        if seg:
            segs.append(seg)

    # Una "ripetuta" di 6 km non è una ripetuta: è il corpo di una corsa
    # continua che il clustering ha separato da una sosta.
    reps = [
        s for s in segs
        if s["kind"] == "work" and MIN_REP_DISTANCE_M <= s["distance_m"] <= MAX_REP_DISTANCE_M
    ]
    if len(reps) < 2:
        return []
    return segs


# ─── Fonte 3: split automatici per km ────────────────────────────────────────
def segments_from_splits(splits: list) -> list:
    """Parziali per km. Non separano lavoro e recupero: vanno dichiarati come tali."""
    segs = []
    for i, sp in enumerate(splits or []):
        dist = sp.get("distance") or 1000
        # Coda di fine corsa: Strava chiude sempre con uno split residuo che può
        # essere di pochi metri. Mostrarlo come parziale è solo rumore.
        if dist < 150:
            continue
        elapsed = sp.get("elapsed_time") or 0
        if not elapsed:
            pace_str = sp.get("pace") or ""
            if ":" in pace_str:
                try:
                    m, s = pace_str.split(":")
                    elapsed = (int(m) * 60 + int(s)) * (dist / 1000.0)
                except (ValueError, TypeError):
                    continue
        seg = _mk_segment(
            idx=sp.get("km") or (i + 1),
            kind="split",
            distance_m=dist,
            moving_time_s=elapsed,
            avg_hr=sp.get("hr"),
            elev_delta_m=sp.get("elevation_difference"),
        )
        if seg:
            segs.append(seg)
    return segs


# ─── Riepilogo leggibile ─────────────────────────────────────────────────────
def _fmt_pace(sec: float) -> str:
    if not sec or sec <= 0:
        return "—"
    total = int(round(sec))
    return f"{total // 60}:{total % 60:02d}"


def _fmt_clock(sec: float) -> str:
    total = int(round(sec or 0))
    return f"{total // 60}:{total % 60:02d}"


def _round_distance_label(meters: float) -> str:
    """Etichetta la distanza sui tagli tipici delle ripetute (400/600/800/1000…)."""
    if meters >= 1800:
        return f"{meters / 1000:.1f} km".replace(".0 km", " km")
    for target in (200, 300, 400, 500, 600, 800, 1000, 1200, 1500):
        if abs(meters - target) <= max(40, target * 0.08):
            return f"{target} m"
    return f"{int(round(meters / 50) * 50)} m"


def summarize(segments: list) -> Optional[dict]:
    """Riepilogo tipo `6 × 600 m @ 3:58 · rec 2:10`, più il drift di FC."""
    work = [s for s in segments if s["kind"] == "work"]
    rec = [s for s in segments if s["kind"] == "recovery"]
    if len(work) < 2:
        return None

    avg_pace = sum(s["pace_sec"] for s in work) / len(work)
    avg_dist = sum(s["distance_m"] for s in work) / len(work)
    gaps = [s["gap_pace_sec"] for s in work if s.get("gap_pace_sec") is not None]
    hrs = [s["avg_hr"] for s in work if s.get("avg_hr")]

    # Le distanze si somigliano? Se sì è una serie regolare (6×600), altrimenti
    # è una piramide o una progressione e va detto.
    spread = (max(s["distance_m"] for s in work) - min(s["distance_m"] for s in work))
    regular = spread <= max(60, avg_dist * 0.12)

    label = (
        f"{len(work)} × {_round_distance_label(avg_dist)} @ {_fmt_pace(avg_pace)}/km"
        if regular
        else f"{len(work)} ripetute variabili @ {_fmt_pace(avg_pace)}/km medio"
    )
    if rec:
        label += f" · rec {_fmt_clock(sum(s['moving_time_s'] for s in rec) / len(rec))}"

    return {
        "label": label,
        "n_work": len(work),
        "regular": regular,
        "avg_work_pace_sec": round(avg_pace, 1),
        "avg_work_gap_sec": round(sum(gaps) / len(gaps), 1) if gaps else None,
        "avg_work_distance_m": round(avg_dist, 1),
        "total_work_distance_m": round(sum(s["distance_m"] for s in work), 1),
        "avg_recovery_s": round(sum(s["moving_time_s"] for s in rec) / len(rec), 1) if rec else None,
        "fastest_pace_sec": min(s["pace_sec"] for s in work),
        "slowest_pace_sec": max(s["pace_sec"] for s in work),
        # Tenuta: quanto rallenta l'ultima rispetto alla prima (positivo = calo).
        "fade_sec": round(work[-1]["pace_sec"] - work[0]["pace_sec"], 1),
        # Deriva cardiaca sulle ripetute: stesso passo con FC che sale = fatica.
        "hr_drift_bpm": round(hrs[-1] - hrs[0]) if len(hrs) >= 2 else None,
    }


def build_intervals(run: dict) -> dict:
    """Parziali di una corsa dalla fonte migliore disponibile."""
    laps = run.get("laps") or []
    streams = run.get("streams") or []

    segments = segments_from_laps(laps, streams)
    source = "laps"

    if len([s for s in segments if s["kind"] == "work"]) < 2:
        derived = segments_from_streams(streams, run.get("duration_minutes"))
        if derived:
            segments, source = derived, "streams"

    if not segments:
        segments = segments_from_splits(run.get("splits") or [])
        source = "splits"

    return {
        "source": source if segments else "none",
        "segments": segments,
        "summary": summarize(segments),
    }
