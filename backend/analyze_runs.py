"""
Script per analizzare le 4 migliori corse di ogni mese e calcolare la soglia anaerobica.
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


def _format_pace(speed_ms):
    """Convert m/s to min:sec/km pace string."""
    if speed_ms <= 0:
        return "0:00"
    pace_sec = 1000 / speed_ms
    m = int(pace_sec // 60)
    s = int(pace_sec % 60)
    return f"{m}:{s:02d}"


def _pace_to_sec(pace_str):
    """Convert pace string mm:ss to seconds/km."""
    if not pace_str or ":" not in pace_str:
        return 0
    try:
        parts = pace_str.split(":")
        return int(parts[0]) * 60 + int(parts[1])
    except (ValueError, IndexError):
        return 0


def _calc_run_score(run):
    """Calcola un punteggio per classificare una corsa.
    
    Score = distanza * (1 / pace_sec) * hr_factor
    - Corsa pi lunga = punteggio pi alto
    - Passo pi veloce = punteggio pi alto  
    - HR pi alta (sforzo) = punteggio pi alto (ma ponderato)
    """
    dist = run.get("distance_km", 0)
    pace_str = run.get("avg_pace", "0:00")
    pace_sec = _pace_to_sec(pace_str)
    avg_hr = run.get("avg_hr")
    
    if dist < 3 or pace_sec <= 0:
        return 0
    
    # Score base: distanza / tempo = velocit totale
    score = dist * (1000 / pace_sec)
    
    # Bonus HR: se abbiamo HR, premiamo le corse con sforzo maggiore
    if avg_hr and avg_hr > 0:
        hr_factor = avg_hr / 180.0  # Normalizzazione
        score *= (0.7 + 0.3 * hr_factor)  # 30% peso all'HR
    
    return round(score, 2)


def _estimate_threshold_from_run(run, max_hr_profile=190):
    """Stima la soglia anaerobica da una singola corsa.
    
    Metodi combinati:
    1. Se avg_hr disponibile e la corsa > 5km: soglia ≈ avg_hr * 0.95-1.0
    2. Se avg_hr non disponibile: usa il VDOT threshold (88% VO2max)
    
    Per corse lunghe (10K+), la FC media ≈ 95-98% della soglia anaerobica.
    Per corse da 5K, la FC media ≈ 98-100% della soglia.
    """
    dist = run.get("distance_km", 0)
    avg_hr = run.get("avg_hr")
    pace_str = run.get("avg_pace", "0:00")
    pace_sec = _pace_to_sec(pace_str)
    duration_min = run.get("duration_minutes", 0) or 0
    
    result = {"method": None, "threshold_hr": None, "threshold_pace": None, "vdot": None}
    
    # --- Metodo 1: Stima dalla FC ---
    if avg_hr and avg_hr > 0 and dist >= 5 and duration_min >= 20:
        # Per corse 5K-10K: HR media ≈ 97-100% soglia
        # Per corse mezza maratona+: HR media ≈ 95-97% soglia
        if dist >= 5 and dist < 10:
            hr_threshold_ratio = 0.97  # 5K: HR media = 97% della soglia
        elif dist >= 10 and dist < 15:
            hr_threshold_ratio = 0.96  # 10K: HR media = 96% della soglia
        elif dist >= 15 and dist < 25:
            hr_threshold_ratio = 0.95  # HM: HR media = 95% della soglia
        else:
            hr_threshold_ratio = 0.94  # Lunghe: HR media = 94% della soglia
        
        estimated_threshold_hr = round(avg_hr * hr_threshold_ratio)
        result["method"] = f"HR ({dist:.1f}km @ {avg_hr}bpm × {hr_threshold_ratio})"
        result["threshold_hr"] = estimated_threshold_hr
        result["threshold_pace_zone"] = f"{estimated_threshold_hr} bpm"
    
    # --- Metodo 2: Stima dal VDOT (Daniels) ---
    if pace_sec > 0 and dist >= 4 and dist <= 21:
        speed_mpm = 60000 / pace_sec  # m/min
        vo2 = -4.60 + 0.182258 * speed_mpm + 0.000104 * speed_mpm ** 2
        if duration_min > 0:
            pct_max = 0.8 + 0.1894393 * math.exp(-0.012778 * duration_min) + 0.2989558 * math.exp(-0.1932605 * duration_min)
            if pct_max > 0:
                vdot = vo2 / pct_max
                vdot = min(vdot, 55.0)  # Cap amatoriale
                
                # Threshold pace = 88% VO2max → 83-88% della FCmax
                vo2_threshold = vdot * 0.88
                disc = 0.182258 ** 2 + 4 * 0.000104 * (vo2_threshold + 4.60)
                if disc >= 0:
                    v_thresh = (-0.182258 + math.sqrt(disc)) / (2 * 0.000104)
                    if v_thresh > 0:
                        threshold_pace = _format_pace(v_thresh / 60)
                        # Stima HR alla soglia: ~88% VO2max ≈ ~88-90% HRmax
                        estimated_hr_threshold = round(max_hr_profile * 0.89)
                        
                        result["vdot"] = round(vdot, 1)
                        result["threshold_pace"] = threshold_pace
                        if result["method"] is None:
                            result["method"] = f"VDOT ({vdot:.1f}, T-pace {threshold_pace}/km)"
                            result["threshold_hr"] = estimated_hr_threshold
                            result["threshold_pace_zone"] = f"{estimated_hr_threshold} bpm ({threshold_pace}/km)"
    
    return result


async def main():
    # Connessione a MongoDB
    if not MONGO_URL:
        print("ERRORE: MONGO_URL non impostato nel file .env")
        return
    
    client = motor.AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    
    # Recupera tutte le corse
    runs = await db.runs.find().sort("date", 1).to_list(1000)
    
    if not runs:
        print("Nessuna corsa trovata nel database.")
        return
    
    print(f"Totale corse trovate: {len(runs)}")
    print(f"Periodo: {runs[0].get('date', '?')} → {runs[-1].get('date', '?')}")
    print("=" * 100)
    
    # Recupera il profilo per il max_hr
    profile = await db.profile.find_one(sort=[("_id", -1)])
    max_hr_profile = profile.get("max_hr", 190) if profile else 190
    
    print(f"FC Max profilo: {max_hr_profile} bpm")
    print("=" * 100)
    
    # Raggruppa per mese
    months = defaultdict(list)
    for run in runs:
        date_str = run.get("date", "")
        if not date_str or len(date_str) < 7:
            continue
        month_key = date_str[:7]  # "YYYY-MM"
        months[month_key].append(run)
    
    # Ordina mesi cronologicamente
    sorted_months = sorted(months.keys())
    
    # Per ogni mese: trova le 4 migliori corse e calcola la soglia
    print(f"\n{'='*100}")
    print(f"{'ANALISI MENSILE - TOP 4 CORSE + SOGLIA ANAEROBICA':^100}")
    print(f"{'='*100}\n")
    
    for month_key in sorted_months:
        month_runs = months[month_key]
        
        # Calcola score per ogni corsa
        scored_runs = []
        for run in month_runs:
            score = _calc_run_score(run)
            if score > 0:
                scored_runs.append((score, run))
        
        # Ordina per score decrescente e prendi le top 4 (o tutte se meno di 4)
        scored_runs.sort(key=lambda x: -x[0])
        top_runs = scored_runs[:4]  # Prendi fino a 4
        
        if not top_runs:
            print(f"\n--- {month_key} ---")
            print("  Nessuna corsa valida")
            continue
        
        # Formatta il nome del mese
        try:
            month_date = datetime.strptime(month_key + "-01", "%Y-%m-%d")
            month_name = month_date.strftime("%B %Y")  # "January 2024"
            # Traduci in italiano
            mesi_it = {
                "January": "Gennaio", "February": "Febbraio", "March": "Marzo",
                "April": "Aprile", "May": "Maggio", "June": "Giugno",
                "July": "Luglio", "August": "Agosto", "September": "Settembre",
                "October": "Ottobre", "November": "Novembre", "December": "Dicembre"
            }
            month_name_it = mesi_it.get(month_date.strftime("%B"), month_key)
        except:
            month_name_it = month_key
        
        print(f"\n{'─'*100}")
        print(f"  📅 {month_name_it.upper()}")
        print(f"{'─'*100}")
        
        threshold_estimates = []
        
        for idx, (score, run) in enumerate(top_runs, 1):
            dist = run.get("distance_km", 0)
            duration = run.get("duration_minutes", 0) or 0
            pace = run.get("avg_pace", "N/A")
            avg_hr = run.get("avg_hr")
            max_hr_run = run.get("max_hr")
            
            # Calcola la soglia anaerobica per questa corsa
            thr = _estimate_threshold_from_run(run, max_hr_profile)
            if thr["threshold_hr"]:
                threshold_estimates.append(thr)
            
            hr_str = f"{avg_hr} bpm" if avg_hr else "N/A"
            max_hr_str = f"{max_hr_run} bpm" if max_hr_run else "N/A"
            
            print(f"")
            print(f"  🏃 Corsa #{idx}")
            print(f"     📆 Data:    {run.get('date', 'N/A')}")
            print(f"     📏 Distanza: {dist:.2f} km")
            print(f"     ⏱️ Durata:  {duration:.1f} min ({duration/60:.1f}h)")
            print(f"     🏎️ Passo:   {pace}/km")
            print(f"     ❤️ FC Media: {hr_str} | FC Max: {max_hr_str}")
            
            if thr["threshold_hr"]:
                print(f"     🎯 STIMA SOGLIA: {thr['threshold_hr']} bpm ({thr['method']})")
            elif thr["vdot"]:
                print(f"     📊 VDOT: {thr['vdot']} | T-Pace: {thr['threshold_pace']}/km")
            else:
                print(f"     ⚠️ Stima non disponibile (dati insufficienti)")
        
        # Calcola la soglia anaerobica del mese (media delle stime)
        print(f"")
        print(f"  {'─'*60}")
        
        if threshold_estimates:
            # Metodo A: media delle soglie HR
            hr_values = [t["threshold_hr"] for t in threshold_estimates if t["threshold_hr"]]
            if hr_values:
                avg_threshold_hr = round(sum(hr_values) / len(hr_values))
                min_threshold_hr = min(hr_values)
                max_threshold_hr = max(hr_values)
                print(f"  🎯 SOGLIA ANAEROBICA DEL MESE:")
                print(f"     Media:   {avg_threshold_hr} bpm")
                print(f"     Range:   {min_threshold_hr} - {max_threshold_hr} bpm")
                print(f"     Basato su: {len(hr_values)} corse")
                
                # Calcola anche la soglia in termini di % FC max
                pct_max = round(avg_threshold_hr / max_hr_profile * 100)
                print(f"     % FC Max: {pct_max}%")
            
            # Metodo B: media VDOT
            vdot_values = [t["vdot"] for t in threshold_estimates if t.get("vdot")]
            if vdot_values:
                avg_vdot = round(sum(vdot_values) / len(vdot_values), 1)
                print(f"")
                print(f"  📊 VDOT MEDIO DEL MESE: {avg_vdot}")
                
                # Calcola i passi di allenamento
                def pace_at_vo2_pct(pct):
                    vo2 = avg_vdot * pct
                    disc = 0.182258 ** 2 + 4 * 0.000104 * (vo2 + 4.60)
                    if disc < 0:
                        return None
                    v = (-0.182258 + math.sqrt(disc)) / (2 * 0.000104)
                    return _format_pace(v / 60) if v > 0 else None
                
                easy = pace_at_vo2_pct(0.65)
                marathon = pace_at_vo2_pct(0.80)
                threshold = pace_at_vo2_pct(0.88)
                interval = pace_at_vo2_pct(0.98)
                
                print(f"     Easy:      {easy}/km")
                print(f"     Marathon:  {marathon}/km")
                print(f"     Soglia (T): {threshold}/km")
                print(f"     Interval:  {interval}/km")
        else:
            print(f"  ⚠️ Nessuna stima valida per questo mese")
        
        print(f"")
    
    # Riepilogo finale
    print(f"\n{'='*100}")
    print(f"{'RIEPILOGO SOGLIA ANAEROBICA PER MESE':^100}")
    print(f"{'='*100}\n")
    print(f"  {'Mese':<20} {'Soglia HR (bpm)':<20} {'% FC Max':<15} {'VDOT':<10}")
    print(f"  {'─'*65}")
    
    for month_key in sorted_months:
        month_runs = months[month_key]
        scored_runs = []
        for run in month_runs:
            score = _calc_run_score(run)
            if score > 0:
                scored_runs.append((score, run))
        
        scored_runs.sort(key=lambda x: -x[0])
        top4 = scored_runs[:4]
        
        threshold_estimates = []
        for score, run in top4:
            thr = _estimate_threshold_from_run(run, max_hr_profile)
            if thr["threshold_hr"]:
                threshold_estimates.append(thr)
        
        try:
            month_date = datetime.strptime(month_key + "-01", "%Y-%m-%d")
            month_name_it = {
                "January": "Gennaio", "February": "Febbraio", "March": "Marzo",
                "April": "Aprile", "May": "Maggio", "June": "Giugno",
                "July": "Luglio", "August": "Agosto", "September": "Settembre",
                "October": "Ottobre", "November": "Novembre", "December": "Dicembre"
            }.get(month_date.strftime("%B"), month_key)
        except:
            month_name_it = month_key
        
        if threshold_estimates:
            hr_values = [t["threshold_hr"] for t in threshold_estimates if t["threshold_hr"]]
            avg_hr = round(sum(hr_values) / len(hr_values)) if hr_values else "-"
            pct_max = f"{round(avg_hr / max_hr_profile * 100)}%" if isinstance(avg_hr, int) else "-"
            vdot_values = [t["vdot"] for t in threshold_estimates if t.get("vdot")]
            avg_vdot = f"{round(sum(vdot_values)/len(vdot_values), 1)}" if vdot_values else "-"
            print(f"  {month_name_it:<20} {avg_hr:<20} {pct_max:<15} {avg_vdot:<10}")
        else:
            print(f"  {month_name_it:<20} {'-':<20} {'-':<15} {'-':<10}")
    
    print(f"\n{'='*100}\n")
    
    # Analisi delle zone HR globali
    print(f"\n{'='*100}")
    print(f"{'ANALISI ZONE FREQUENZA CARDIACA (ULTIME CORSE)':^100}")
    print(f"{'='*100}\n")
    
    zone_min = {"Z1": 0.0, "Z2": 0.0, "Z3": 0.0, "Z4": 0.0, "Z5": 0.0}
    zone_labels = {
        "Z1": "Recovery (<65%)",
        "Z2": "Aerobica (65-77%)",
        "Z3": "Tempo (77-84%)",
        "Z4": "Soglia (84-91%)",
        "Z5": "VO2max (>91%)"
    }
    
    runs_sorted = sorted(runs, key=lambda x: x.get("date", ""), reverse=True)[:120]
    runs_with_hr = [r for r in runs_sorted if r.get("avg_hr") and r.get("duration_minutes")]
    
    for r in runs_with_hr:
        hr_pct = r["avg_hr"] / max_hr_profile * 100
        dur = r["duration_minutes"]
        if hr_pct < 65:
            zone_min["Z1"] += dur
        elif hr_pct < 77:
            zone_min["Z2"] += dur
        elif hr_pct < 84:
            zone_min["Z3"] += dur
        elif hr_pct < 91:
            zone_min["Z4"] += dur
        else:
            zone_min["Z5"] += dur
    
    total_min = sum(zone_min.values()) or 1
    
    for zone in ["Z1", "Z2", "Z3", "Z4", "Z5"]:
        pct = round(zone_min[zone] / total_min * 100, 1)
        mins = round(zone_min[zone], 1)
        print(f"  {zone_labels[zone]:<30} {pct:>5}%  ({mins:>6} min)")
    
    print(f"\n{'='*100}")
    print(f"  FC Max utilizzata: {max_hr_profile} bpm")
    print(f"  Totale corse con HR: {len(runs_with_hr)}")
    print(f"  Tempo totale con HR: {round(total_min)} min ({round(total_min/60, 1)} ore)")
    print(f"{'='*100}\n")
    
    client.close()


if __name__ == "__main__":
    asyncio.run(main())