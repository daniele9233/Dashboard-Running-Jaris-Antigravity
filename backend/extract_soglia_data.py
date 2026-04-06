"""
Estrae i dati della soglia anaerobica mensili per un grafico.
Formula: Soglia = FC_media / fattore (basato sulla durata della corsa)
"""

import os
import math
import json
from collections import defaultdict
import motor.motor_asyncio as motor
import asyncio
from dotenv import load_dotenv

load_dotenv()
MONGO_URL = os.environ.get("MONGO_URL", "")
DB_NAME = os.environ.get("DB_NAME", "DANIDB")

MESI_IT = {
    "01": "Gen", "02": "Feb", "03": "Mar", "04": "Apr", "05": "Mag",
    "06": "Giu", "07": "Lug", "08": "Ago", "09": "Set", "10": "Ott",
    "11": "Nov", "12": "Dic"
}

def _pace_to_sec(pace_str):
    if not pace_str or ":" not in pace_str:
        return 9999
    try:
        parts = pace_str.split(":")
        return int(parts[0]) * 60 + int(parts[1])
    except:
        return 9999

async def main():
    if not MONGO_URL:
        print("ERRORE MONGO_URL")
        return
    
    client = motor.AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    runs = await db.runs.find().sort("date", 1).to_list(1000)
    profile = await db.profile.find_one(sort=[("_id", -1)])
    max_hr = profile.get("max_hr", 180) if profile else 180
    
    # Raggruppa per mese
    months = defaultdict(list)
    for run in runs:
        date_str = run.get("date", "")
        if len(date_str) >= 7:
            months[date_str[:7]].append(run)
    
    sorted_months = sorted(months.keys())
    
    result = {"months": [], "chart_data": {"labels": [], "values": []}}
    
    for month_key in sorted_months:
        month_runs = months[month_key]
        
        # Filtra corse con FC valide per stimare la soglia
        valid_runs = []
        for r in month_runs:
            dist = r.get("distance_km", 0)
            dur = r.get("duration_minutes", 0) or 0
            avg_hr = r.get("avg_hr")
            pace_sec = _pace_to_sec(r.get("avg_pace", "0:00"))
            # Solo corse con FC, durata >= 3 min, passo < 8:00/km (scarta warm-up/defaticamento)
            if avg_hr and avg_hr > 0 and dur >= 3 and pace_sec < 480:
                valid_runs.append(r)
        
        if not valid_runs:
            # Aggiungi il mese anche se non ci sono corse con FC
            mese_label = f"{MESI_IT[month_key[5:]]} {month_key[:4]}"
            result["months"].append({
                "month_key": month_key,
                "label": mese_label,
                "soglia_hr": None,
                "pct_max": None,
                "num_corse_usate": 0
            })
            result["chart_data"]["labels"].append(mese_label)
            result["chart_data"]["values"].append(None)
            continue
        
        # Calcola soglia per ogni corsa usando TUTTE le corse con FC
        soglie_corse = []
        for r in valid_runs:
            dur = (r.get("duration_minutes", 0) or 0)
            avg_hr = r.get("avg_hr")
            
            # Formula corretta basata sulla durata
            if dur >= 60:
                fattore = 0.91  # Corsa lunga: FC media ≈ 91% della soglia
            elif dur >= 40:
                fattore = 0.96  # Corsa 40-60 min: FC media ≈ 96% della soglia
            elif dur >= 20:
                fattore = 0.98  # Corsa 20-40 min: FC media ≈ 98% della soglia
            else:
                continue  # Scarta corse troppo brevi per la stima
            
            soglia = round(avg_hr / fattore)
            soglie_corse.append(soglia)
        
        # Calcola media di TUTTE le soglie trovate
        if len(soglie_corse) > 0:
            avg_soglia = round(sum(soglie_corse) / len(soglie_corse))
            mese_label = f"{MESI_IT[month_key[5:]]} {month_key[:4]}"
        else:
            # Mese senza corse con FC >= 20 min
            mese_label = f"{MESI_IT[month_key[5:]]} {month_key[:4]}"
            result["months"].append({
                "month_key": month_key,
                "label": mese_label,
                "soglia_hr": None,
                "pct_max": None,
                "num_corse_usate": 0
            })
            result["chart_data"]["labels"].append(mese_label)
            result["chart_data"]["values"].append(None)
            continue
        
        # Calcola % FC max
        pct_max = round(avg_soglia / max_hr * 100)
        
        result["months"].append({
            "month_key": month_key,
            "label": mese_label,
            "soglia_hr": avg_soglia,
            "pct_max": pct_max,
            "num_corse_usate": len(soglie_corse)
        })
        
        result["chart_data"]["labels"].append(mese_label)
        result["chart_data"]["values"].append(avg_soglia)
    
    # Aggiungi linea per la FC max per riferimento
    result["chart_data"]["fc_max"] = max_hr
    result["chart_data"]["fc_max_line"] = [max_hr] * len(result["chart_data"]["labels"])
    
    print(json.dumps(result, indent=2, ensure_ascii=False))
    client.close()

if __name__ == "__main__":
    asyncio.run(main())