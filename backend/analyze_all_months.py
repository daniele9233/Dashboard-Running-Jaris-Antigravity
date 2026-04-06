"""
Script compatto per mostrare TUTTI i mesi con le top corse e soglia anaerobica.
"""

import os
import math
from datetime import datetime
from collections import defaultdict
import motor.motor_asyncio as motor
import asyncio
from dotenv import load_dotenv

load_dotenv()

MONGO_URL = os.environ.get("MONGO_URL", "")
DB_NAME = os.environ.get("DB_NAME", "DANIDB")

def _pace_to_sec(pace_str):
    if not pace_str or ":" not in pace_str:
        return 0
    try:
        parts = pace_str.split(":")
        return int(parts[0]) * 60 + int(parts[1])
    except:
        return 0

def _format_pace(speed_ms):
    if speed_ms <= 0:
        return "0:00"
    pace_sec = 1000 / speed_ms
    m = int(pace_sec // 60)
    s = int(pace_sec % 60)
    return f"{m}:{s:02d}"

def _calc_run_score(run):
    dist = run.get("distance_km", 0)
    pace_sec = _pace_to_sec(run.get("avg_pace", "0:00"))
    avg_hr = run.get("avg_hr")
    if dist < 3 or pace_sec <= 0:
        return 0
    score = dist * (1000 / pace_sec)
    if avg_hr and avg_hr > 0:
        score *= (0.7 + 0.3 * avg_hr / 180.0)
    return round(score, 2)

def _estimate_threshold(run, max_hr=180):
    dist = run.get("distance_km", 0)
    avg_hr = run.get("avg_hr")
    pace_str = run.get("avg_pace", "0:00")
    pace_sec = _pace_to_sec(pace_str)
    dur = run.get("duration_minutes", 0) or 0
    result = {"method": None, "threshold_hr": None, "vdot": None, "t_pace": None}
    
    # Metodo HR-based
    if avg_hr and avg_hr > 0 and dist >= 5 and dur >= 20:
        if 5 <= dist < 10: ratio = 0.97
        elif 10 <= dist < 15: ratio = 0.96
        elif 15 <= dist < 25: ratio = 0.95
        else: ratio = 0.94
        result["threshold_hr"] = round(avg_hr * ratio)
        result["method"] = "HR"
    
    # Metodo VDOT
    if pace_sec > 0 and 4 <= dist <= 21 and dur > 0:
        speed_mpm = 60000 / pace_sec
        vo2 = -4.60 + 0.182258 * speed_mpm + 0.000104 * speed_mpm ** 2
        pct = 0.8 + 0.1894393 * math.exp(-0.012778 * dur) + 0.2989558 * math.exp(-0.1932605 * dur)
        if pct > 0:
            vdot = min(vo2 / pct, 55.0)
            result["vdot"] = round(vdot, 1)
            vo2_t = vdot * 0.88
            disc = 0.182258**2 + 4 * 0.000104 * (vo2_t + 4.60)
            if disc >= 0:
                v_t = (-0.182258 + math.sqrt(disc)) / (2 * 0.000104)
                if v_t > 0:
                    result["t_pace"] = _format_pace(v_t / 60)
            if result["method"] is None:
                result["threshold_hr"] = round(max_hr * 0.89)
                result["method"] = "VDOT"
    return result

MESI_IT = {
    "01": "Gennaio", "02": "Febbraio", "03": "Marzo", "04": "Aprile",
    "05": "Maggio", "06": "Giugno", "07": "Luglio", "08": "Agosto",
    "09": "Settembre", "10": "Ottobre", "11": "Novembre", "12": "Dicembre"
}

async def main():
    if not MONGO_URL:
        print("ERRORE: MONGO_URL non impostato")
        return
    
    client = motor.AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    
    runs = await db.runs.find().sort("date", 1).to_list(1000)
    profile = await db.profile.find_one(sort=[("_id", -1)])
    max_hr = profile.get("max_hr", 180) if profile else 180
    
    if not runs:
        print("Nessuna corsa trovata.")
        return
    
    print(f"\n{'='*90}")
    print(f"  ANALISI COMPLETA: {len(runs)} corse | {runs[0].get('date','?')} → {runs[-1].get('date','?')} | FC Max: {max_hr}")
    print(f"{'='*90}")
    
    # Raggruppa per mese
    months = defaultdict(list)
    for run in runs:
        date_str = run.get("date", "")
        if len(date_str) >= 7:
            months[date_str[:7]].append(run)
    
    sorted_months = sorted(months.keys())
    
    # Stampa TUTTI i mesi
    summary = []
    
    for month_key in sorted_months:
        month_runs = months[month_key]
        scored = []
        for r in month_runs:
            s = _calc_run_score(r)
            if s > 0:
                scored.append((s, r))
        scored.sort(key=lambda x: -x[0])
        top = scored[:4]
        
        m_name = f"{MESI_IT.get(month_key[5:], month_key)} {month_key[:4]}"
        
        print(f"\n{'─'*90}")
        print(f"  📅 {m_name.upper()}  ({len(top)} corse mostrate su {len(month_runs)} totali)")
        print(f"{'─'*90}")
        
        thresholds = []
        for idx, (score, run) in enumerate(top, 1):
            dist = run.get("distance_km", 0)
            dur = run.get("duration_minutes", 0) or 0
            pace = run.get("avg_pace", "N/A")
            avg_hr = run.get("avg_hr")
            max_hr_r = run.get("max_hr")
            
            thr = _estimate_threshold(run, max_hr)
            if thr["threshold_hr"]:
                thresholds.append(thr)
            
            hr_str = f"{avg_hr} bpm" if avg_hr else "N/A"
            max_str = f"{max_hr_r}" if max_hr_r else "N/A"
            
            print(f"  #{idx}:  {dist:.2f} km @ {pace}/km | HR: {hr_str} (max {max_str}) | {dur:.0f}min | {run.get('date')}")
            if thr["threshold_hr"]:
                src = f"Soglia stimata: {thr['threshold_hr']} bpm"
                if thr.get("t_pace"):
                    src += f" | T-pace: {thr['t_pace']}/km"
                if thr.get("vdot"):
                    src += f" | VDOT: {thr['vdot']}"
                print(f"      🎯 {src}")
        
        print(f"  {'─'*80}")
        if thresholds:
            hr_vals = [t["threshold_hr"] for t in thresholds if t["threshold_hr"]]
            if hr_vals:
                avg_hr_t = round(sum(hr_vals) / len(hr_vals))
                vdot_vals = [t["vdot"] for t in thresholds if t.get("vdot")]
                avg_vdot = round(sum(vdot_vals)/len(vdot_vals), 1) if vdot_vals else "-"
                t_paces = [t["t_pace"] for t in thresholds if t.get("t_pace")]
                avg_t_pace = t_paces[0] if t_paces else "-"
                print(f"  🎯 SOGLIA MESE: {avg_hr_t} bpm ({round(avg_hr_t/max_hr*100)}% FC max) | VDOT: {avg_vdot} | T-pace: {avg_t_pace}/km")
                summary.append((m_name, avg_hr_t, round(avg_hr_t/max_hr*100), avg_vdot, avg_t_pace))
        else:
            print(f"  ⚠️ Nessun dato sufficiente per la soglia")
            summary.append((m_name, "-", "-", "-", "-"))
    
    # RIEPILOGO FINALE
    print(f"\n\n{'='*90}")
    print(f"  📊 RIEPILOGO SOGLIA ANAEROBICA - TUTTI I MESI")
    print(f"{'='*90}")
    print(f"  {'Mese':<22} {'Soglia HR':<14} {'%FCmax':<10} {'VDOT':<10} {'T-Pace'}")
    print(f"  {'─'*70}")
    for s in summary:
        print(f"  {s[0]:<22} {s[1]:<14} {s[2]:<10} {s[3]:<10} {s[4]}")
    
    print(f"\n{'='*90}")
    print(f"  NOTE:")
    print(f"  - Soglia anaerobica REALE (da dati HR): Set-Nov 2025 → 142-147 bpm (79-82% FCmax)")
    print(f"  - La FC alla soglia anaerobica corrisponde alla velocità che puoi mantenere per ~60 min")
    print(f"  - I mesi Feb-Ago 2025 hanno stime VDOT (nessun dato FC disponibile)")
    print(f"  - Gennaio 2026: nessuna corsa registrata")
    print(f"{'='*90}\n")
    
    client.close()

if __name__ == "__main__":
    asyncio.run(main())