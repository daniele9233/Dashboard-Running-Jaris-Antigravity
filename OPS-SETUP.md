# OPS Setup — alerts + telemetry attivazione

Setup operativo richiesto per **non rompere prod silenziosamente** come è
successo round 5 (backend stuck a vecchia versione 24h, scoperto per caso).

> ⏱ Tempo totale: 30 min. Tutto click-only sui dashboard di Render + Sentry.

---

## 1. Render — Build/Deploy failure alerts (10 min)

**Why**: round 5 ha pushato codice rotto (`from backend.routers` con
`rootDir: backend`). Build fallita, Render ha mantenuto vecchia versione,
nessuna notifica. Fix arrivato 24h dopo.

### Step-by-step

**Backend service `dani-backend-ea0s`**:

1. https://dashboard.render.com → service `dani-backend-ea0s`
2. Tab **Settings** → scroll a **Notifications** (sidebar sinistra)
3. Click **Add notification**
4. Provider: **Email** (free) o **Slack** (Slack webhook URL)
5. Events da abilitare:
   - ✅ `Deploy failed`
   - ✅ `Build failed`
   - ✅ `Service suspended`
   - ☐ `Deploy succeeded` (opzionale, rumoroso)
6. Save.

**Frontend service `dani-frontend-y63x`**: ripeti gli stessi step.

### Verifica funziona

Pusha intenzionalmente un commit rotto su un branch (NON main). Apri PR → CI
GitHub Actions blocca prima di merge (vedi #2 sotto). Se merge accidentale →
Render notification arriva entro 5 min.

---

## 2. Sentry — error tracking frontend (15 min)

**Why**: errori widget/route in prod oggi sono invisibili. Telemetry stub
round 4 → solo `console.error`. Round 7 → Sentry SDK wired in `telemetry.ts`,
attiva con sola env var.

### Step-by-step

1. Vai su https://sentry.io/signup → crea account (free 5k events/mese).
2. **Create new project**:
   - Platform: **React**
   - Project name: `metic-lab-frontend`
   - Alert frequency: **Alert me on every new issue**
3. Copia il **DSN** (formato `https://xxx@oNNN.ingest.sentry.io/MMM`).

### Configura su Render

1. https://dashboard.render.com → service `dani-frontend-y63x`
2. Tab **Environment** → **Add Environment Variable**
3. Key: `VITE_SENTRY_DSN`
4. Value: `<DSN copiato>`
5. Save → trigger manual deploy (Render rebuilda con env nuova).

### Configura locale (opzionale)

In `.env`:
```
VITE_SENTRY_DSN=<DSN>
```

### Verifica funziona

Apri il sito in prod (https://dani-frontend-y63x.onrender.com). DevTools →
Console → digita:
```js
throw new Error('test sentry');
```
Entro 1 min → Sentry dashboard mostra issue + email arriva (se configurato).

### Sentry user context (opzionale, multi-tenant ready)

Quando #1 auth arriva, in `App.tsx` aggiungi:
```ts
import { identifyUser } from './utils/telemetry';
useEffect(() => { identifyUser(profile); }, [profile]);
```

---

## 3. CI gate — backend smoke test (già attivo round 7)

**Why**: blocca merge di codice che rompe import `from server import app` con
`CWD=backend/` (Render layout).

### File già pronti

- `backend/test_smoke.py` — 6 test (import test + endpoint smoke).
- `.github/workflows/ci.yml` — `pytest backend/` con `continue-on-error: false`.

### Local run

```bash
cd D:/webapp-antiG
MONGO_URL=mongodb://localhost:27017 python -m pytest backend/ -v
```

Output atteso: **6 passed**.

### Cosa cattura

| Test | Cosa verifica |
|---|---|
| `test_app_loads_in_render_layout` | `from server import app` con CWD=backend/ (Render) |
| `test_app_loads_in_dev_layout` | `from backend.server import app` con CWD=root (dev) |
| `test_health_root` | `GET /` ritorna 200 |
| `test_version_endpoint` | `GET /api/version` ha `timestamp` (router round 5) |
| `test_sse_endpoint_registered` | `/api/events/stream` registrato (round 5 SSE) |
| `test_routes_critical_present` | 8 endpoint critici tutti registrati |

**Da ora in poi**: ogni PR/push triggera CI. Se uno dei 6 test fallisce →
PR bloccata, no merge, no deploy rotto.

---

## 4. Health check periodico (extra — 5 min, opzionale)

Render ha già health check su `GET /` configurato (default `/`). Ma aggiungere
uno script esterno migliora copertura.

### Opzione A: UptimeRobot (free)

1. https://uptimerobot.com → signup
2. Add monitor → HTTP(s) → URL: `https://dani-backend-ea0s.onrender.com/api/version`
3. Interval: 5 min
4. Alert email/Slack su downtime > 5 min.

### Opzione B: GitHub Action cron

Aggiungere a `.github/workflows/`:

```yaml
name: Health check
on:
  schedule:
    - cron: '*/15 * * * *'   # ogni 15 min
jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - run: |
          curl -fsS https://dani-backend-ea0s.onrender.com/api/version > /dev/null
          # Se fallisce, Action fallisce → notification GitHub default
```

Free GitHub Actions cron sul main branch. Failure → email a maintainer del repo.

---

## Riepilogo cosa hai dopo questi 30 min

| Pre-setup | Post-setup |
|---|---|
| Deploy rotto invisibile per giorni | Notification entro 5 min (Render alerts) |
| Errori frontend in prod invisibili | Sentry dashboard + email su nuovo issue |
| PR rompe backend silenziosamente | CI smoke test blocca merge |
| Sito down → scopri quando lo apri | UptimeRobot / GitHub cron alerta |

**Costo recurring**: $0/mese (tutto su free tier).

**Costo prossimo deploy rotto**: zero secondi a sapere + zero-down nel ripristino.
