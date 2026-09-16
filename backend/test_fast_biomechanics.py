"""
Test della biomeccanica "a ritmo" (backend/server.py, sezione biomechanics).

La promessa è una sola: i grafici della sezione descrivono il gesto veloce, non
la media di tutte le uscite. Quindi un lento non deve entrare nei numeri a
ritmo, una seduta di ripetute va letta sui giri di lavoro (non sugli split al
km, che mescolano ripetuta e trotto) e la cadenza di ogni giro viene dagli
streams dentro quel giro.
"""
import os
import sys
from pathlib import Path

os.environ.setdefault("MONGO_URL", "mongodb://localhost:27017")
sys.path.insert(0, str(Path(__file__).resolve().parent))

import server  # type: ignore


def lap(distance, seconds, hr=150):
    return {"distance": distance, "moving_time": seconds, "elapsed_time": seconds,
            "average_speed": distance / seconds, "average_heartrate": hr}


def split(distance, seconds, cadence, hr=150):
    return {"km": 1, "pace": "", "distance": distance, "elapsed_time": seconds, "cadence": cadence, "hr": hr, "elevation_difference": 0}


def run(**over):
    base = {
        "_id": over.pop("rid", "r1"), "date": "2026-09-10", "name": "Corsa", "distance_km": 10.0,
        "duration_minutes": 55.0, "avg_pace": "5:30", "avg_hr": 140, "run_type": "easy",
        "is_treadmill": False, "splits": [], "laps": [], "biomechanics": {},
    }
    base.update(over)
    return base


def reps_session():
    """5×1000 a 3:58 con 330 m di trotto in 2′: la FC media e il passo medio mentono."""
    laps = []
    for i in range(5):
        laps.append(lap(1000, 238, 152))
        if i < 4:
            laps.append(lap(330, 120, 140))
    return run(rid="reps", date="2026-09-16", name="5x1000", run_type="intervals", distance_km=6.32,
               duration_minutes=27.9, avg_pace="4:24", laps=laps,
               splits=[split(1000, 243, 183), split(1000, 277, 179)],
               biomechanics={"avg_ground_contact_time_ms": 226, "avg_vertical_ratio_pct": 7.3,
                             "avg_stride_length_m": 1.24, "avg_cadence_spm": 181})


def reps_streams():
    """Streams per-punto: cadenza 186 dentro le ripetute, 160 nei recuperi."""
    pts, d = [], 0.0
    for i in range(5):
        for _ in range(40):
            pts.append({"d": d, "cad": 186})
            d += 25
        if i < 4:
            for _ in range(12):
                pts.append({"d": d, "cad": 160})
                d += 27.5
    return pts


def easy_run():
    return run(rid="easy", date="2026-09-15", avg_pace="6:00", distance_km=8.0, duration_minutes=48,
               splits=[split(1000, 360, 172)] * 8,
               biomechanics={"avg_ground_contact_time_ms": 268, "avg_vertical_ratio_pct": 9.1,
                             "avg_stride_length_m": 0.95, "avg_cadence_spm": 172})


def tempo_run():
    return run(rid="tempo", date="2026-09-05", run_type="tempo", avg_pace="4:30", distance_km=6.0,
               duration_minutes=27, splits=[split(1000, 270, 182)] * 6,
               biomechanics={"avg_ground_contact_time_ms": 232, "avg_vertical_ratio_pct": 7.6,
                             "avg_stride_length_m": 1.2, "avg_cadence_spm": 182})


def build(runs, streams=None, only=None):
    return server._build_biomechanics_charts(runs, "month", 50.0, [], only, streams or {})


def test_rep_laps_read_only_work_and_take_cadence_from_streams():
    reps = server._fast_rep_laps(reps_session(), reps_streams())
    assert len(reps) == 5
    assert all(abs(r["pace_sec"] - 238) < 1 for r in reps)
    assert all(r["cadence"] == 186 for r in reps)
    # 1000 m in 238 s a 186 passi: 1,36 m a passo
    assert abs(reps[0]["stride_m"] - 1.36) < 0.01


def test_easy_laps_are_not_reps():
    auto = run(laps=[lap(1000, 360)] * 8)
    assert server._fast_rep_laps(auto, []) == []


def test_split_samples_skip_interval_sessions():
    # sulle ripetute uno split al km è mezza ripetuta e mezzo trotto
    assert server._fast_split_samples(reps_session()) == []
    assert len(server._fast_split_samples(tempo_run())) == 6
    assert server._fast_split_samples(easy_run()) == []


def test_fast_biomechanics_compares_fast_with_easy():
    charts = build([easy_run(), tempo_run(), reps_session()], {"reps": reps_streams()})
    fb = charts["fast_biomechanics"]
    k = fb["kpis"]
    assert fb["quality"]["status"] == "ok"
    assert k["fast_runs"] == 2
    assert k["reps"] == 5
    assert k["gct"] < k["gct_easy"]
    assert k["cadence"] > k["cadence_easy"]
    assert k["stride"] > k["stride_easy"]
    session = fb["summary"]["sessions"][0]
    assert session["n_work"] == 5 and session["cadence"] == 186


def test_stability_ignores_easy_runs():
    charts = build([easy_run(), tempo_run(), reps_session()], {"reps": reps_streams()}, only="ground_contact_stability")
    k = charts["ground_contact_stability"]["kpis"]
    # la media fra 226 e 232: il lento a 268 ms non entra
    assert 225 <= k["gct"] <= 233
    assert k["runs"] == 2


def test_no_fast_data_is_declared_not_invented():
    charts = build([easy_run()], only="fast_biomechanics")
    assert charts["fast_biomechanics"]["quality"]["status"] == "insufficient_data"


def test_matrix_marks_fast_segments():
    charts = build([easy_run(), tempo_run(), reps_session()], {"reps": reps_streams()}, only="cadence_speed_matrix")
    kinds = {p.get("kind") for p in charts["cadence_speed_matrix"]["series_detail"]}
    assert {"run", "rep", "km"} <= kinds


def test_a_rep_split_in_two_laps_stays_one_rep():
    """3×1600 con il tasto premuto a 1000 m: sono tre ripetute, non sei."""
    laps = [lap(2000, 720, 130)]
    for i in range(3):
        laps += [lap(1000, 238, 150), lap(600, 143, 155)]
        if i < 2:
            laps.append(lap(400, 150, 140))
    laps.append(lap(1500, 540, 130))
    reps = server._fast_rep_laps(run(run_type="intervals", laps=laps), [])
    assert len(reps) == 3
    assert all(r["distance_m"] == 1600 for r in reps)
    assert all(abs(r["pace_sec"] - 238.1) < 0.5 for r in reps)
