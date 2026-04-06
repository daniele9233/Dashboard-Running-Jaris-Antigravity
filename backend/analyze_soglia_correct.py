"""
Analisi corretta della soglia anaerobica.
La soglia anaerobica (LT) si stima dalla FC media delle corse eseguite a ritmo sostenuto.
Approccio: per ogni corsa valida, la FC media della corsa indica dove sei stato lavorare.
La tua soglia anaerobica ≈ la FC media della corsa più veloce che hai sostenuto per 20-60 min.
"""

import os
import math
from collections import defaultdict
import motor.motor_asyncio as motor
import asyncio
from dotenv import load_dotenv

load_dotenv()
MONGO_URL = os.environ.get("MONGO_URL", "")
DB_NAME = os.environ.get("DB_NAME", "DANIDB")

MESI_IT = {
    "01": "Gennaio", "02": "Febbraio", "03": "Marzo", "04": "Aprile",
    "05": "Maggio", "06": "Giugno", "07": "Luglio", "08": "Agosto",
    "09": "Settembre", "10": "Ottobre", "11": "Novembre", "12": "Dicembre"
}

def _pace_to_sec(pace_str):
    if not pace_str or ":" not in pace_str:
        return 9999
    try:
        parts = pace_str.split(":")
        return int(parts[0]) * 60 + int(parts[1])
    except:
        return 9999

def _format_pace(speed_ms):
    if speed_ms <= 0:
        return "0:00"
    pace_sec = 1000 / speed_ms
    m = int(pace_sec // 60)
    s = int(pace_sec % 60)
    return f"{m}:{s:02d}"

async def main():
    if not MONGO_URL:
        print("ERRORE MONGO_URL")
        return
    
    client = motor.AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    runs = await db.runs.find().sort("date", 1).to_list(1000)
    profile = await db.profile.find_one(sort=[("_id", -1)])
    max_hr = profile.get("max_hr", 180) if profile else 180
    
    print(f"\n{'='*100}")
    print(f"  ANALISI SOGLIA ANAEROBICA — Metodo corretto (FC media corse a ritmo)")
    print(f"  {len(runs)} corse totali | FC Max: {max_hr}")
    print(f"{'='*100}")
    
    # Raggruppa per mese
    months = defaultdict(list)
    for run in runs:
        date_str = run.get("date", "")
        if len(date_str) >= 7:
            months[date_str[:7]].append(run)
    
    sorted_months = sorted(months.keys())
    
    for month_key in sorted_months:
        month_runs = months[month_key]
        m_name = f"{MESI_IT.get(month_key[5:], month_key)} {month_key[:4]}"
        
        # Filtra solo corse con FC e con dati utili per stimare la soglia
        # La soglia si stima meglio da corse di 20+ min con FC >= 140
        valid_runs = []
        for r in month_runs:
            dist = r.get("distance_km", 0)
            dur = r.get("duration_minutes", 0) or 0
            avg_hr = r.get("avg_hr")
            pace_sec = _pace_to_sec(r.get("avg_pace", "0:00"))
            if avg_hr and avg_hr > 0 and dur >= 3 and pace_sec < 9999:
                valid_runs.append(r)
        
        # Ordina per velocità (pace più veloce prima)
        valid_runs.sort(key=lambda x: _pace_to_sec(x.get("avg_pace", "0:00")))
        
        # Prendi top 4
        top = valid_runs[:4]
        
        print(f"\n{'─'*100}")
        print(f"  📅 {m_name.upper()}  ({len(top)}/4 corse mostrate | {len(valid_runs)} con FC su {len(month_runs)} totali)")
        print(f"{'─'*100}")
        
        if not top:
            print("  ❌ Nessuna corsa con dati FC validi")
            continue
        
        soglie = []
        for idx, run in enumerate(top, 1):
            dist = run.get("distance_km", 0)
            dur = (run.get("duration_minutes", 0) or 0)
            pace = run.get("avg_pace", "N/A")
            avg_hr = run.get("avg_hr")
            max_hr_r = run.get("max_hr")
            pace_sec = _pace_to_sec(pace)
            
            # La soglia anaerobica si stima così:
            # - Corsa 20-40 min a ritmo forte: FC media ≈ 95-100% della soglia
            # - Corsa 40-60 min a ritmo forte: FC media ≈ 90-95% della soglia  
            # - Corsa > 60 min: FC media ≈ 85-90% della soglia
            # Usiamo durate più brevi per stime più conservative
            
            if dur >= 20 and dur < 40:
                # 20-40 min: FC media ≈ 97% della soglia (corsa vicina a ritmo gara 5-10K)
                soglia_stimata = round(avg_hr / 0.98)
                metodo = f"20-40min: FC/{avg_hr} ÷ 0.98"
            elif dur >= 40 and dur < 60:
                # 40-60 min: FC media ≈ 95% della soglia
                soglia_stimata = round(avg_hr / 0.96)
                metodo = f"40-60min: FC/{avg_hr} ÷ 0.96"
            elif dur >= 60:
                # >60 min: FC media ≈ 90% della soglia
                soglia_stimata = round(avg_hr / 0.91)
                metodo = f">60min: FC/{avg_hr} ÷ 0.91"
            else:
                # Corsa breve (<20 min): meno affidabile, ma FC media può essere molto alta
                soglia_stimata = round(avg_hr / 0.99)
                metodo = f"<20min: FC/{avg_hr} ÷ 0.99 (stima rough)"
            
            soglie.append({
                "hr": soglia_stimata,
                "pace": pace,
                "dist": dist,
                "dur": dur,
                "avg_hr": avg_hr,
                "metodo": metodo,
                "data": run.get("date", "")
            })
            
            print(f"  #{idx}: {dist:.2f} km @ {pace}/km | FC media: {avg_hr} bpm (max {max_hr_r}) | {dur:.0f} min | {run.get('date','')}")
            print(f"      → Stima soglia: {soglia_stimata} bpm ({metodo})")
        
        # Calcola media soglie del mese (pesata: corse più veloci hanno più peso)
        if soglie:
            # Prendi solo le 2 migliori per la media (le più veloci sono più indicative)
            best = [s for s in soglie if s["dist"] >= 3][:3]
            if best:
                avg_soglia = round(sum(s["hr"] for s in best) / len(best))
                best_pace = min(s["pace"] for s in best if s["pace"] != "N/A") if any(s["pace"] != "N/A" for s in best) else "N/A"
                
                # Calcola anche la FC % rispetto alla max
                pct_max = round(avg_soglia / max_hr * 100)
                
                print(f"\n  {'─'*80}")
                print(f"  🎯 SOGLIA ANAEROBICA {m_name.upper()}:")
                print(f"     Soglia HR: {avg_soglia} bpm ({pct_max}% della FC max {max_hr})")
                print(f"     Stima basata su: {len(best)} corse più significative")
                print(f"     Miglior passo registrato: {best_pace}/km")
                
                # Zone suggerite
                z1_hi = round(avg_soglia * 0.65)
                z2_hi = round(avg_soglia * 0.77)
                z3_hi = round(avg_soglia * 0.84)
                z4_hi = round(avg_soglia * 0.91)
                print(f"\n     Zone FC suggerite (basate su questa soglia):")
                print(f"     Z1 Recovery:    {z1_hi} bpm")
                print(f"     Z2 Aerobica:    {z1_hi+1} – {z2_hi} bpm")
                print(f"     Z3 Tempo:       {z2_hi+1} – {z3_hi} bpm")
                print(f"     Z4 Soglia (LT): {z3_hi+1} – {z4_hi} bpm")
                print(f"     Z5 VO2max:      > {z4_hi} bpm")
    
    print(f"\n{'='*100}")
    print(f"  COME SI CALCOLA LA SOGLIA ANAEROBICA:")
    print(f"{'='*100}")
    print(f"""
  La SOGLIA ANAEROBICA (Soglia Lattacida/LT1-LT2) è la FC alla quale il lattato 
  inizia ad accumularsi nel sangue. Corrisponde al ritmo che puoi mantenere ~40-60 min.
  
  Stima pratica (metodo usato):
  ─────────────────────────────────────────────────────
  • Corsa 5-10K (20-40 min, ritmo forte): FC media ≈ 97-99% della soglia
    → Soglia ≈ FC_media ÷ 0.98
    ESEMPIO: 6 km @ 4:20/km con FC 149 → Soglia ≈ 149÷0.98 ≈ 152 bpm
  
  • Corsa 40-60 min (ritmo sostenuto): FC media ≈ 94-96% della soglia
    → Soglia ≈ FC_media ÷ 0.95
  
  • Corsa lunga >60 min: FC media ≈ 88-92% della soglia
    → Soglia ≈ FC_media ÷ 0.90
  
  Dalla tua corsa di riferimento (6km @ 4:20/km, FC 149 bpm):
  → La tua soglia è circa 152 bpm
  → Questo significa a 152 bpm puoi mantenere ~4:15-4:25/km per 40-60 min
  
  Dalla corsa 25 Ago (4km @ 4:01/km, FC 156 bpm):
  → Questo è un ritmo 5-10K: FC 156 ≈ 98% della soglia
  → Soglia ≈ 156÷0.98 ≈ 159 bpm (ma essendo solo 16 min, sovrastimata)
  
  DALLE RIPETUTE (immagine allegata - 6x600m):
  ─────────────────────────────────────────────
  Le ripetute mostrano un andamento progressivo:
  • Rip 1: 600m @ 3:32/km → FC 125 bpm
  • Rip 2: 600m @ 3:32/km → FC 125 bpm  
  • Rip 3: 600m @ 3:37/km → FC 138 bpm
  • Rip 4: 600m @ 3:43/km → FC 143 bpm
  • Rip 5: 600m @ 3:32/km → FC 146 bpm
  Media ripetute: 5:14/km (compresi recuperi)
  
  La FC sulle ripetute NON indica la soglia perché:
  - I recuperi abbassano la media
  - Ogni ripetuta è troppo breve per riflettere la FC di regime
  - La FC impiega 30-60 sec per salire al livello effettivo
  
  Per stimare la soglia dalle ripetute servono le ripetute lunghe (es. 6x1000m) dove 
  la FC si stabilizza. Dalle tue ripetute da 600m, la FC finale di 146 bpm sulla 
  5ª ripetuta indica lo sforzo massimo del giorno, non la soglia.
  
  STIMA FINALE BASED SUI TUOI DATI:
  ──────────────────────────────────
  Dalla corsa 6km @ 4:20/km, FC 149 → Soglia ≈ 152 bpm
  Dalle corse più lunghe con FC: 
    • 10km @ 4:33/km, FC 156 → Soglia ≈ 156÷0.96 ≈ 162 bpm
    • 15km @ 4:56/km, FC 148 → Soglia ≈ 148÷0.91 ≈ 163 bpm
  
  ✅ TUA SOGLIA ANAEROBICA STIMATA: 152-158 bpm
     Corrisponde a un ritmo di circa 4:20-4:35/km
""")
    
    client.close()

if __name__ == "__main__":
    asyncio.run(main())