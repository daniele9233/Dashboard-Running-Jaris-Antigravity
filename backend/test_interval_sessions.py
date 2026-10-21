"""
Test dell'elenco delle sedute a ripetute (backend/server.py, /api/interval-sessions).

L'elenco serve a scegliere da dove far partire un piano, quindi due promesse:
ogni seduta si legge sulle SUE ripetute (un riscaldamento lento con i recuperi
camminati non deve contare come lavoro) e il VDOT è lo stesso conto del resto
dell'app, che qui non si è toccato.
"""
import asyncio
import datetime as dt
import os
import sys
from pathlib import Path

os.environ.setdefault("MONGO_URL", "mongodb://localhost:27017")
sys.path.insert(0, str(Path(__file__).resolve().parent))

import server  # type: ignore


def lap(distance, seconds, hr=150):
    return {"distance": distance, "moving_time": seconds, "elapsed_time": seconds,
            "average_speed": distance / seconds, "average_heartrate": hr}


def reps_laps(rep_s=235, n=4):
    """Riscaldamento a 5:30, n×1000 con 250 m di camminata in 3', defaticamento."""
    out = [lap(2000, 660)]
    for _ in range(n):
        out += [lap(1000, rep_s), lap(250, 180)]
    out.append(lap(1500, 560))
    return out


def run(date="2026-10-06", **over):
    base = {"_id": "r1", "date": date, "name": "Ripetute", "distance_km": 8.5, "run_type": "intervals",
            "is_treadmill": False, "laps": reps_laps(), "temperature": 18.0, "humidity": 55}
    base.update(over)
    return base


# ── la parte comune non cambia il conto ufficiale ──────────────────────────

def test_official_interval_vdot_is_unchanged():
    # valori fissati PRIMA di estrarre la parte comune
    sess = {"laps": reps_laps(), "distance_km": 8.5, "temperature": 26.1, "humidity": 70}
    assert abs(server._interval_vdot_from_laps(sess) - 40.43957455548018) < 1e-9
    two = {"laps": [lap(1000, 235), lap(250, 180), lap(1000, 235), lap(250, 180), lap(1000, 300)]}
    assert abs(server._interval_vdot_from_laps(two) - 43.42564281761725) < 1e-9


def test_steady_run_is_not_an_interval_session():
    assert server._interval_vdot_from_laps({"laps": [lap(1000, 300)] * 6}) is None
    assert server._interval_lap_groups([lap(1000, 300)] * 6, tight=True) is None


# ── la lettura stretta ─────────────────────────────────────────────────────

def test_tight_groups_leave_the_warm_up_out_of_the_work():
    loose = server._interval_lap_groups(reps_laps())
    tight = server._interval_lap_groups(reps_laps(), tight=True)
    assert len(loose[0]) == 6          # le 4 ripetute + riscaldamento e defaticamento
    assert len(tight[0]) == 4          # solo le ripetute
    assert len(tight[1]) == 4          # i recuperi restano quelli


def test_tight_vdot_reads_the_reps_not_the_warm_up():
    s = server._interval_session_summary(run())
    # 4×1000 a 3:55 con 3' di recupero, a 18 °C: lo sconto del recupero è ~5,3%,
    # quindi 3:55 vale un ritmo gara di ~4:07/km (5 km in ~20:38), VDOT ~48. Con
    # il riscaldamento contato come lavoro la seduta varrebbe ~40.
    assert 47.5 <= s["vdot"] <= 49.0
    assert server._interval_vdot_from_laps(run()) < s["vdot"] - 5


def test_summary_describes_the_session():
    s = server._interval_session_summary(run())
    assert s["n_reps"] == 4
    assert s["avg_rep_m"] == 1000
    assert s["fastest_rep_m"] == 1000
    assert s["fastest_pace_sec"] == 235.0
    assert s["work_pace_sec"] == 235.0
    assert s["rest_avg_sec"] == 180
    assert s["date"] == "2026-10-06"


def test_the_fastest_rep_is_not_the_average():
    laps = [lap(2000, 660)]
    for sec in (240, 236, 232, 228):
        laps += [lap(1000, sec), lap(250, 180)]
    s = server._interval_session_summary(run(laps=laps))
    assert s["fastest_pace_sec"] == 228.0
    assert s["work_pace_sec"] == 234.0


def test_a_steady_run_has_no_summary():
    assert server._interval_session_summary(run(laps=[lap(1000, 300)] * 6)) is None


# ── l'elenco ───────────────────────────────────────────────────────────────

class _Cursor:
    def __init__(self, docs):
        self.docs = docs

    async def to_list(self, length=None):
        return list(self.docs)


class _Runs:
    def __init__(self, docs):
        self.docs = docs
        self.query = None

    def find(self, query, projection=None):
        self.query = query
        return _Cursor(self.docs)


class _Db:
    def __init__(self, docs):
        self.runs = _Runs(docs)


def _list(docs, **kw):
    async def no_athlete():
        return None

    real_db, real_athlete = server.db, server._get_athlete_id
    server.db, server._get_athlete_id = _Db(docs), no_athlete
    try:
        return asyncio.run(server.get_interval_sessions(**kw)), server.db.runs.query
    finally:
        server.db, server._get_athlete_id = real_db, real_athlete


def _days_ago(n):
    return (dt.date.today() - dt.timedelta(days=n)).isoformat()


def test_list_keeps_the_last_four_months_strongest_first():
    docs = [
        run(date=_days_ago(10), _id="a", laps=reps_laps(rep_s=242)),
        run(date=_days_ago(40), _id="b", laps=reps_laps(rep_s=232)),
        run(date=_days_ago(200), _id="vecchia", laps=reps_laps(rep_s=225)),
        run(date=_days_ago(20), _id="piatta", laps=[lap(1000, 300)] * 6),
    ]
    out, _ = _list(docs)
    ids = [s["run_id"] for s in out["sessions"]]
    assert ids == ["b", "a"]            # la vecchia e la corsa piatta fuori, la più forte prima
    assert out["months"] == 4


def test_list_months_and_limit_are_clamped():
    docs = [run(date=_days_ago(i), _id=str(i), laps=reps_laps(rep_s=230 + i)) for i in range(1, 8)]
    out, _ = _list(docs, months=99, limit=3)
    assert out["months"] == 12
    assert len(out["sessions"]) == 3


def test_list_asks_only_for_outdoor_runs_with_enough_laps():
    _, q = _list([])
    assert q["is_treadmill"] == {"$ne": True}
    assert q["laps.3"] == {"$exists": True}
