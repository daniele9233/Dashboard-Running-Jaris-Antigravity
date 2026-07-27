"""
Meteo per corsa risolto lato server.

Finora il meteo veniva chiesto a open-meteo dal browser e solo per le corse
visibili in una schermata: bastava non aprire quella vista perché il dato non
esistesse. Qui la risoluzione diventa un'operazione del backend, così ogni
corsa sincronizzata da Strava finisce con temperatura, umidità e vento
salvati su Mongo una volta per tutte.

L'ora della corsa NON viene indovinata: si legge da `start_date_local`, che
Strava riempie con l'orologio da parete locale. Sulle corse che non lo hanno
si ripiega sull'ora stimata dal nome ("Corsa mattutina").
"""
from typing import Optional

import httpx

ARCHIVE_URL = "https://archive-api.open-meteo.com/v1/archive"
FORECAST_URL = "https://api.open-meteo.com/v1/forecast"
HOURLY = "temperature_2m,relative_humidity_2m,apparent_temperature,wind_speed_10m"

# L'archivio open-meteo è indietro di qualche giorno: sotto questa soglia si
# usa il forecast, che serve il passato prossimo via past_days.
ARCHIVE_LAG_DAYS = 9


def _run_start_hour(run: dict) -> Optional[int]:
    s = run.get("start_date_local")
    if isinstance(s, str) and len(s) >= 13 and s[10] == "T":
        try:
            h = int(s[11:13])
            if 0 <= h <= 23:
                return h
        except ValueError:
            return None
    return None


def _infer_hour(name: Optional[str]) -> int:
    n = (name or "").lower()
    if "night" in n or "nott" in n:
        return 22
    if "evening" in n or "sera" in n:
        return 20
    if "afternoon" in n or "pomerid" in n:
        return 17
    if "lunch" in n or "pranzo" in n:
        return 13
    if "morning" in n or "mattut" in n:
        return 7
    return 8


def _covered_hours(run: dict, start_hour: int) -> list:
    """Le ore effettivamente coperte dalla corsa, non solo quella di partenza.

    All'alba la temperatura sale in fretta: leggere solo l'ora di partenza può
    sottostimare di 1-2°C quello che il corridore ha davvero sentito.
    """
    s = run.get("start_date_local")
    minutes = 0
    if isinstance(s, str) and len(s) >= 16:
        try:
            minutes = int(s[14:16])
        except ValueError:
            minutes = 0
    start_min = start_hour * 60 + minutes
    mid = start_min + max(0.0, float(run.get("duration_minutes") or 0)) / 2
    h1 = min(23, int(mid // 60))
    h2 = min(23, max(h1, round(mid / 60)))
    return [h1] if h1 == h2 else [h1, h2]


def _dewpoint(temp_c: float, rh: float) -> Optional[float]:
    """Magnus-Tetens. L'approssimazione `T - (100-RH)/5` sbaglia di gradi sotto il 50%."""
    import math
    if rh is None or temp_c is None or rh <= 0:
        return None
    rh = min(100.0, max(1.0, rh))
    gamma = math.log(rh / 100.0) + (17.625 * temp_c) / (243.04 + temp_c)
    return (243.04 * gamma) / (17.625 - gamma)


async def resolve_weather(http: httpx.AsyncClient, run: dict, today_iso: str) -> Optional[dict]:
    """Risolve il meteo di una corsa. `None` se non è georeferenziata o non c'è dato."""
    latlng = run.get("start_latlng")
    if not latlng or len(latlng) != 2 or run.get("is_treadmill"):
        return None
    date = (run.get("date") or "")[:10]
    if len(date) != 10:
        return None

    real_hour = _run_start_hour(run)
    hour = real_hour if real_hour is not None else _infer_hour(run.get("name"))

    import datetime as _dt
    age_days = (_dt.date.fromisoformat(today_iso) - _dt.date.fromisoformat(date)).days
    use_forecast = age_days < ARCHIVE_LAG_DAYS

    params = {
        "latitude": str(latlng[0]),
        "longitude": str(latlng[1]),
        "hourly": HOURLY,
        "timezone": "auto",
    }
    if use_forecast:
        params.update({"past_days": "10", "forecast_days": "1"})
        url = FORECAST_URL
    else:
        params.update({"start_date": date, "end_date": date})
        url = ARCHIVE_URL

    resp = await http.get(url, params=params)
    if resp.status_code != 200:
        return None
    data = resp.json()
    hourly = data.get("hourly") or {}
    times = hourly.get("time") or []
    if not times:
        return None

    wanted = _covered_hours(run, hour) if real_hour is not None else [hour]
    prefixes = [f"{date}T{h:02d}:00" for h in wanted]
    idx = [i for i, t in enumerate(times) if any(t.startswith(p) for p in prefixes)]
    if not idx:
        idx = [i for i, t in enumerate(times) if t.startswith(date)][:1]
    if not idx:
        return None

    def avg(key: str) -> Optional[float]:
        arr = hourly.get(key) or []
        vals = [arr[i] for i in idx if i < len(arr) and arr[i] is not None]
        return sum(vals) / len(vals) if vals else None

    temp = avg("temperature_2m")
    rh = avg("relative_humidity_2m")
    if temp is None:
        return None

    return {
        "temperature": round(temp, 1),
        "humidity": round(rh, 1) if rh is not None else None,
        "apparent_temperature": round(avg("apparent_temperature") or temp, 1),
        "wind_speed": round(avg("wind_speed_10m") or 0, 1),
        "dewpoint": round(_dewpoint(temp, rh), 1) if rh is not None else None,
        "estimated_hour": hour,
        "hour_source": "reale" if real_hour is not None else "stimata dal nome",
        "source": "forecast" if use_forecast else "archive",
    }
