import math
import os
import sys
from pathlib import Path

os.environ.setdefault("MONGO_URL", "mongodb://localhost:27017")
sys.path.insert(0, str(Path(__file__).resolve().parent))

import server  # type: ignore


def _run(days_ago: int = 0, pace_s: int = 300, avg_hr: int = 158, temp=None, humidity=None):
    date = server.dt.date.today() - server.dt.timedelta(days=days_ago)
    distance_km = 5.0
    return {
        "date": date.isoformat(),
        "distance_km": distance_km,
        "duration_minutes": pace_s * distance_km / 60,
        "avg_pace": f"{pace_s // 60}:{pace_s % 60:02d}",
        "avg_hr": avg_hr,
        "is_treadmill": False,
        "temperature": temp,
        "humidity": humidity,
    }


def test_vdot_recency_weight_is_070_after_30_days():
    as_of = server.dt.date(2026, 5, 2)
    run = {"date": "2026-04-02"}
    assert math.isclose(server._vdot_recency_weight(run, as_of), 0.70, rel_tol=0.01)


def test_hot_weather_adjustment_raises_equivalent_vdot():
    baseline = server._vdot_from_run(_run(temp=10, humidity=55), max_hr=180)
    hot = server._vdot_from_run(_run(temp=30, humidity=75), max_hr=180)
    assert baseline is not None
    assert hot is not None
    assert hot > baseline


def test_current_vdot_uses_decayed_best_samples():
    runs = [
        _run(days_ago=1, pace_s=280, avg_hr=158),
        _run(days_ago=10, pace_s=285, avg_hr=158),
        _run(days_ago=35, pace_s=290, avg_hr=158),
        _run(days_ago=90, pace_s=270, avg_hr=158),
    ]

    current = server._calc_vdot(runs, max_hr=180)
    raw_values = sorted((server._vdot_from_run(r, max_hr=180) for r in runs), reverse=True)
    old_top3 = sum(raw_values[:3]) / 3

    assert current is not None
    assert current < round(old_top3, 1)


def test_three_km_runs_are_valid_for_vdot():
    run = _run(pace_s=275, avg_hr=160)
    run["distance_km"] = 3.0
    run["duration_minutes"] = 13.75

    assert server._vdot_from_run(run, max_hr=180) is not None


def test_interval_sessions_use_fast_work_block_from_splits():
    run = _run(pace_s=360, avg_hr=150)
    run.update({
        "run_type": "intervals",
        "distance_km": 6.0,
        "duration_minutes": 36.0,
        "avg_pace": "6:00",
        "splits": [
            {"distance": 1000, "elapsed_time": 360, "hr": 130},
            {"distance": 1000, "elapsed_time": 270, "hr": 158},
            {"distance": 1000, "elapsed_time": 268, "hr": 162},
            {"distance": 1000, "elapsed_time": 266, "hr": 165},
            {"distance": 1000, "elapsed_time": 390, "hr": 140},
            {"distance": 1000, "elapsed_time": 380, "hr": 138},
        ],
    })

    total_only = server._vdot_from_effort(run, 6.0, 36.0, 360, 150, 180)
    with_intervals = server._vdot_from_run(run, max_hr=180)

    assert total_only is not None
    assert with_intervals is not None
    assert with_intervals > total_only


def test_split_pattern_detects_unlabeled_repetitions():
    run = _run(pace_s=281, avg_hr=158)
    run.update({
        "run_type": "tempo",
        "distance_km": 4.3,
        "duration_minutes": 20.22,
        "avg_pace": "4:41",
        "splits": [
            {"distance": 1000.4, "elapsed_time": 272, "pace": "4:31", "hr": 145.2},
            {"distance": 1000.1, "elapsed_time": 298, "pace": "4:57", "hr": 157.3},
            {"distance": 1000.8, "elapsed_time": 267, "pace": "4:26", "hr": 162.9},
            {"distance": 998.7, "elapsed_time": 304, "pace": "5:03", "hr": 163.0},
        ],
    })

    assert server._is_interval_session(run)
    assert server._interval_vdot_from_splits(run, max_hr=180) is not None


def test_recent_quality_session_anchors_current_vdot():
    recent_hard = _run(days_ago=3, pace_s=270, avg_hr=160)
    older_good = _run(days_ago=25, pace_s=285, avg_hr=158)
    older_easy = _run(days_ago=35, pace_s=330, avg_hr=145)

    current = server._calc_vdot([recent_hard, older_good, older_easy], max_hr=180)
    recent_vdot = server._vdot_from_run(recent_hard, max_hr=180)

    assert current is not None
    assert recent_vdot is not None
    assert current == round(recent_vdot, 1)


def test_vdot_chart_bucket_uses_current_model_not_monthly_average():
    interval = _run(pace_s=281, avg_hr=158)
    interval.update({
        "date": "2026-04-28",
        "run_type": "tempo",
        "distance_km": 4.3,
        "duration_minutes": 20.22,
        "avg_pace": "4:41",
        "splits": [
            {"distance": 1000.4, "elapsed_time": 272, "pace": "4:31", "hr": 145.2},
            {"distance": 1000.1, "elapsed_time": 298, "pace": "4:57", "hr": 157.3},
            {"distance": 1000.8, "elapsed_time": 267, "pace": "4:26", "hr": 162.9},
            {"distance": 998.7, "elapsed_time": 304, "pace": "5:03", "hr": 163.0},
        ],
    })
    easy = _run(pace_s=330, avg_hr=145)
    easy["date"] = "2026-04-20"

    chart, _, _ = server._build_vdot_chart([easy, interval], 180, "month", "vo2_vdot_trend")
    row = chart["series_card"][-1]
    interval_vdot = round(server._vdot_from_run(interval, max_hr=180), 1)
    easy_vdot = server._vdot_from_run(easy, max_hr=180)
    old_monthly_average = round((interval_vdot + easy_vdot) / 2, 1)

    assert row["vdot"] == interval_vdot
    assert row["vdot"] > old_monthly_average


def test_history_vdot_goal_distance_path_does_not_crash():
    as_of = server.dt.date(2026, 5, 2)
    runs = [
        {**_run(days_ago=4, pace_s=282, avg_hr=160), "date": "2026-04-28", "distance_km": 10.0, "duration_minutes": 47.0},
        {**_run(days_ago=18, pace_s=288, avg_hr=158), "date": "2026-04-14", "distance_km": 10.0, "duration_minutes": 48.0},
    ]

    history = server._calc_vdot_with_history(runs, max_hr=180, goal_dist_km=10.0, as_of=as_of)

    assert history["current"] is not None
    assert history["race_specific_vdot"] is not None


def test_stop_history_softens_vdot_and_starts_with_base_phase():
    as_of = server.dt.date(2026, 5, 2)
    runs = [
        {**_run(pace_s=280, avg_hr=160), "date": "2026-03-01", "distance_km": 8.0, "duration_minutes": 37.3},
        {**_run(pace_s=285, avg_hr=158), "date": "2026-02-22", "distance_km": 8.0, "duration_minutes": 38.0},
    ]
    history = server._calc_vdot_with_history(runs, max_hr=180, goal_dist_km=5.0, as_of=as_of)
    ctx = server._build_training_history_context(runs, history, as_of=as_of)
    adjusted = server._apply_stop_adjustment_to_vdot(history["current"], ctx)
    phases = server._tp_history_phase_alloc(12, ctx)

    assert ctx["training_status"] == "return_from_stop"
    assert adjusted < history["current"]
    assert phases[0][0] == "Base Aerobica"
    assert phases[0][1] >= 0.35


def test_quality_history_reduces_base_phase():
    as_of = server.dt.date(2026, 5, 2)
    runs = []
    for i in range(16):
        runs.append({
            **_run(pace_s=335, avg_hr=140),
            "date": (as_of - server.dt.timedelta(days=i * 3)).isoformat(),
            "distance_km": 8.0,
            "duration_minutes": 44.6,
            "run_type": "easy",
        })
    for days_ago in (5, 12, 19):
        runs.append({
            **_run(pace_s=270, avg_hr=162),
            "date": (as_of - server.dt.timedelta(days=days_ago)).isoformat(),
            "distance_km": 6.0,
            "duration_minutes": 27.0,
            "run_type": "intervals",
            "name": "Ripetute 800",
        })

    history = server._calc_vdot_with_history(runs, max_hr=180, goal_dist_km=5.0, as_of=as_of)
    ctx = server._build_training_history_context(runs, history, as_of=as_of)
    phases = server._tp_history_phase_alloc(12, ctx)

    assert ctx["quality_sessions_8w"] >= 2
    assert ctx["training_status"] == "trained_with_quality"
    assert phases[0][0] == "Base Aerobica"
    assert phases[0][1] <= 0.15
