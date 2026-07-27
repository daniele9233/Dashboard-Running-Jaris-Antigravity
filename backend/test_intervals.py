"""
Test della segmentazione dei parziali (backend/intervals.py).

Il valore di questo modulo sta tutto nel NON inventare ripetute dove non ce ne
sono: una corsa facile con due soste al semaforo produce lo stesso contrasto di
passo di una seduta di 6×600, e senza i guardrail verrebbe presentata come tale.
Metà di questi test verificano proprio i falsi positivi.
"""
import os
import sys
from pathlib import Path

os.environ.setdefault("MONGO_URL", "mongodb://localhost:27017")
sys.path.insert(0, str(Path(__file__).resolve().parent))

import intervals  # type: ignore


# ─── Helper per costruire dati sintetici ─────────────────────────────────────
def lap(distance, moving_time, hr=None, elev=None, idx=None):
    return {
        "distance": distance,
        "moving_time": moving_time,
        "elapsed_time": moving_time,
        "average_speed": distance / moving_time if moving_time else 0,
        "average_heartrate": hr,
        "max_heartrate": hr + 5 if hr else None,
        "total_elevation_gain": elev,
        "lap_index": idx,
    }


def streams_from_segments(segs, hz_seconds=5.0):
    """Costruisce streams per-punto da una lista di (metri, sec/km, hr, quota_delta)."""
    pts = []
    d = 0.0
    alt = 100.0
    for meters, pace_sec, hr, elev_delta in segs:
        n = max(2, int(round((meters / 1000.0 * pace_sec) / hz_seconds)))
        step_d = meters / n
        step_a = (elev_delta or 0) / n
        for _ in range(n):
            d += step_d
            alt += step_a
            pts.append({"d": round(d, 1), "hr": hr, "alt": round(alt, 1)})
    total_time = sum(m / 1000.0 * p for m, p, _, _ in segs)
    return pts, total_time / 60.0


# ─── Modello di pendenza ─────────────────────────────────────────────────────
def test_grade_adjustment_is_asymmetric():
    """La salita costa più di quanto la discesa regali: modello Minetti, non simmetrico."""
    uphill = intervals.grade_adjustment_sec(2.0)
    downhill = intervals.grade_adjustment_sec(-2.0)
    assert uphill > 0 and downhill < 0
    assert abs(uphill) > abs(downhill)


def test_steep_downhill_benefit_is_capped():
    """Una discesa ripidissima non deve diventare un regalo illimitato."""
    assert intervals.grade_adjustment_sec(-30.0) >= -55.0


def test_pbp_is_faster_uphill_and_slower_downhill():
    up = intervals._mk_segment(1, "work", 1000, 300, elev_delta_m=20)     # +2%
    down = intervals._mk_segment(1, "work", 1000, 300, elev_delta_m=-20)  # -2%
    assert up["gap_pace_sec"] < up["pace_sec"], "in salita il PBP deve risultare più veloce"
    assert down["gap_pace_sec"] > down["pace_sec"], "in discesa il PBP deve risultare più lento"


# ─── Parziali dai giri ───────────────────────────────────────────────────────
def test_laps_separate_work_from_recovery():
    laps = []
    for i in range(4):
        laps.append(lap(600, 143, hr=165, idx=i * 2 + 1))   # 600 m @ ~3:58
        laps.append(lap(200, 120, hr=140, idx=i * 2 + 2))   # recupero lento
    segs = intervals.segments_from_laps(laps)
    kinds = [s["kind"] for s in segs]
    assert kinds.count("work") == 4
    assert kinds.count("recovery") == 4


def test_laps_of_a_steady_run_are_not_called_intervals():
    """Auto-lap da 1 km su una corsa continua: nessun lavoro, nessun recupero."""
    laps = [lap(1000, 265, hr=150, idx=i + 1) for i in range(6)]
    segs = intervals.segments_from_laps(laps)
    assert all(s["kind"] == "steady" for s in segs)
    assert intervals.summarize(segs) is None


def test_easy_run_with_stops_is_not_called_intervals():
    """Il caso critico: contrasto di passo alto ma andatura da corsa facile.

    Senza il tetto sul passo di lavoro questa uscita verrebbe presentata come
    una seduta di ripetute, che è una lettura semplicemente inventata.
    """
    laps = [
        lap(2000, 760, hr=135, idx=1),  # 6:20/km
        lap(300, 300, hr=120, idx=2),   # sosta lunga
        lap(1800, 700, hr=138, idx=3),
        lap(250, 280, hr=118, idx=4),
        lap(1500, 590, hr=140, idx=5),
    ]
    segs = intervals.segments_from_laps(laps)
    assert all(s["kind"] == "steady" for s in segs)


def test_tiny_laps_are_discarded():
    laps = [lap(600, 143, idx=1), lap(8, 6, idx=2), lap(600, 145, idx=3)]
    segs = intervals.segments_from_laps(laps)
    assert len(segs) == 2


def test_net_elevation_from_streams_beats_cumulative_gain():
    """Un giro che sale e ridiscende ha guadagno >0 ma dislivello netto ~0.

    Usare il guadagno cumulato come se fosse netto fa risultare in salita un
    tratto pianeggiante e gonfia il PBP.
    """
    pts, _ = streams_from_segments([(500, 240, 160, 25), (500, 240, 160, -25)])
    laps = [lap(1000, 240, hr=160, elev=25, idx=1)]  # gain 25 m, netto 0
    segs = intervals.segments_from_laps(laps, pts)
    assert abs(segs[0]["grade_pct"]) < 0.5, "il dislivello netto deve essere quasi zero"


# ─── Parziali dagli streams ──────────────────────────────────────────────────
def test_streams_detect_repeats_when_laps_are_missing():
    segs_def = []
    for _ in range(5):
        segs_def += [(800, 240, 168, 0), (200, 480, 140, 0)]
    pts, dur = streams_from_segments(segs_def)
    segs = intervals.segments_from_streams(pts, dur)
    assert len([s for s in segs if s["kind"] == "work"]) >= 4


def test_streams_reject_a_continuous_run():
    pts, dur = streams_from_segments([(5000, 300, 150, 0)])
    assert intervals.segments_from_streams(pts, dur) == []


def test_streams_reject_slow_blocks_even_with_contrast():
    """Contrasto forte ma passo lento: sono soste, non ripetute."""
    segs_def = []
    for _ in range(4):
        segs_def += [(1000, 380, 135, 0), (100, 900, 110, 0)]
    pts, dur = streams_from_segments(segs_def)
    assert intervals.segments_from_streams(pts, dur) == []


def test_streams_reject_oversized_blocks():
    """Blocchi da 6 km non sono ripetute: è una continua spezzata da una sosta."""
    segs_def = [(6000, 300, 150, 0), (150, 900, 120, 0), (5000, 298, 152, 0)]
    pts, dur = streams_from_segments(segs_def)
    assert intervals.segments_from_streams(pts, dur) == []


# ─── Riepilogo ───────────────────────────────────────────────────────────────
def test_summary_reads_like_a_training_log():
    laps = []
    for i in range(6):
        laps.append(lap(600, 143, hr=165 + i, idx=i * 2 + 1))
        laps.append(lap(200, 130, hr=140, idx=i * 2 + 2))
    s = intervals.summarize(intervals.segments_from_laps(laps))
    assert s["n_work"] == 6
    assert s["regular"] is True
    assert "6 × 600 m" in s["label"]
    assert "rec" in s["label"]


def test_summary_flags_irregular_series():
    laps = [
        lap(1200, 288, hr=160, idx=1), lap(200, 130, hr=140, idx=2),
        lap(800, 190, hr=163, idx=3), lap(200, 130, hr=140, idx=4),
        lap(400, 94, hr=168, idx=5),
    ]
    s = intervals.summarize(intervals.segments_from_laps(laps))
    assert s["regular"] is False
    assert "variabili" in s["label"]


def test_summary_reports_fade_and_hr_drift():
    """Ultima ripetuta più lenta della prima e FC che sale: la seduta è calata."""
    laps = [
        lap(1000, 235, hr=160, idx=1), lap(200, 130, hr=145, idx=2),
        lap(1000, 240, hr=168, idx=3), lap(200, 130, hr=150, idx=4),
        lap(1000, 250, hr=175, idx=5),
    ]
    s = intervals.summarize(intervals.segments_from_laps(laps))
    assert s["fade_sec"] > 0, "positivo = ha rallentato"
    assert s["hr_drift_bpm"] == 15


def test_summary_needs_at_least_two_reps():
    assert intervals.summarize([]) is None


# ─── Scelta della fonte ──────────────────────────────────────────────────────
def test_build_prefers_laps_over_streams():
    laps = []
    for i in range(4):
        laps.append(lap(600, 143, hr=165, idx=i * 2 + 1))
        laps.append(lap(200, 120, hr=140, idx=i * 2 + 2))
    pts, dur = streams_from_segments([(800, 240, 168, 0), (200, 480, 140, 0)] * 4)
    out = intervals.build_intervals({"laps": laps, "streams": pts, "duration_minutes": dur})
    assert out["source"] == "laps"


def test_build_falls_back_to_streams_then_splits():
    pts, dur = streams_from_segments([(800, 240, 168, 0), (200, 480, 140, 0)] * 4)
    assert intervals.build_intervals({"streams": pts, "duration_minutes": dur})["source"] == "streams"

    splits = [{"km": i + 1, "pace": "4:30", "distance": 1000, "elapsed_time": 270,
               "elevation_difference": 0, "hr": 150} for i in range(4)]
    out = intervals.build_intervals({"splits": splits})
    assert out["source"] == "splits"
    assert len(out["segments"]) == 4


def test_build_reports_none_when_there_is_nothing():
    out = intervals.build_intervals({})
    assert out["source"] == "none"
    assert out["segments"] == []


def test_trailing_junk_split_is_dropped():
    """Strava chiude sempre con uno split residuo: 12 m non sono un parziale."""
    splits = [
        {"km": 1, "pace": "4:30", "distance": 1000, "elapsed_time": 270},
        {"km": 2, "pace": "4:30", "distance": 12, "elapsed_time": 3},
    ]
    assert len(intervals.segments_from_splits(splits)) == 1
