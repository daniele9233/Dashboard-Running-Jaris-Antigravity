# METIC LAB

Dashboard di training & analytics per podisti — frontend React 19 + backend FastAPI/MongoDB.

> Stato auth: l'app supporta piu atleti Strava locali con un atleta attivo alla volta. Il multi-tenant SaaS con login separato (`user_id`/JWT) e ancora in scaffold.

---

## ⚡ Quick start (5 min)

### 1. Prerequisiti

- **Node.js** ≥ 20
- **Python** ≥ 3.11
- Cluster MongoDB (Atlas free tier OK)
- App Strava registrata → `STRAVA_CLIENT_ID` + `STRAVA_CLIENT_SECRET`
- (Opzionale) Mapbox public token, Anthropic/Gemini API key

### 2. Setup

```bash
git clone <repo>
cd webapp-antiG

# Frontend env
cp .env.example .env
# → compila VITE_BACKEND_URL, VITE_MAPBOX_TOKEN, GEMINI_API_KEY

# Backend env
cp backend/.env.example backend/.env
# → compila MONGO_URL, STRAVA_*, ANTHROPIC_API_KEY, GEMINI_API_KEY

# Install
npm install
pip install -r backend/requirements.txt
```

### 3. Run

```bash
npm run dev
# → backend uvicorn :8000 + vite :3000 in parallelo
```

Apri `http://localhost:3000`.

### 4. Build prod

```bash
npm run build       # → dist/
npm run preview     # serve dist/ in locale
```

---

## 📚 Documentazione (chi cosa)

Tre fonti di verità documentale, separate per scopo:

| File | Scopo | Ownership |
|---|---|---|
| **[README.md](./README.md)** | Onboarding 5 min, comandi, env-var | Indice |
| **[PRD.md](./PRD.md)** | Product Requirements: visione prodotto, feature, UX | Product |
| **[REPORT-TECNICO.md](./REPORT-TECNICO.md)** | Architettura tecnica: ogni componente, hook, util, formula scientifica, CHANGELOG fix | Architettura |
| **[ROADMAP.md](./ROADMAP.md)** | Cosa è fatto, cosa manca | Roadmap |
| **[CHECKLIST-PENDING.md](./CHECKLIST-PENDING.md)** | 12 punti audit non eseguiti, con priorità + costi | Backlog |
| **[CHANGELOG-AI.md](./CHANGELOG-AI.md)** | Log modifiche AI assistant | Storia |
| **[repo-map.md](./repo-map.md)** | Mappa file generata (auto) | Auto |

> Per modifiche **prodotto** → tocca `PRD.md`.
> Per modifiche **archittettura/codice** → tocca `REPORT-TECNICO.md`.
> Per **preferenze utente** → `~/.claude/projects/.../memory/MEMORY.md` (locale, non in repo).

---

## 🧱 Stack

**Frontend** (`src/`):
- React 19 + TypeScript + Vite 6
- React Router 7 (SPA)
- Tailwind CSS 4 + tailwind-merge
- Recharts (charts), Mapbox GL / MapLibre (mappe), Three.js (3D), Framer Motion + GSAP
- i18next (IT/EN)
- `@google/genai` (JARVIS voice assistant)

**Backend** (`backend/`):
- FastAPI 0.115 + uvicorn
- Motor (Mongo async)
- Anthropic + Gemini SDK (AI run analysis, JARVIS)
- garminconnect / garth (Garmin sync)
- fitdecode (FIT files)
- slowapi (rate limiting — opzionale)

**Hosting** (`render.yaml`):
- Backend → Render web service (Python)
- Frontend → Render static site (Vite build)

---

## 🔑 Env-var

### Frontend (`.env`)

| Var | Note |
|---|---|
| `VITE_BACKEND_URL` | URL backend FastAPI |
| `VITE_MAPBOX_TOKEN` | Public token Mapbox (`pk.*`) — restringere per dominio |
| `GEMINI_API_KEY` | Gemini key per JARVIS client-side |

### Backend (`backend/.env`)

| Var | Obbligatoria | Note |
|---|---|---|
| `MONGO_URL` | ✅ | Connection string Mongo |
| `DB_NAME` | ✅ | Default `DANIDB` |
| `STRAVA_CLIENT_ID` + `STRAVA_CLIENT_SECRET` | ✅ | OAuth Strava |
| `BACKEND_URL` | ✅ | URL pubblico backend (per redirect Strava) |
| `FRONTEND_URL` | ✅ | URL frontend (per redirect post-OAuth) |
| `ALLOWED_ORIGINS` | – | CORS whitelist comma-separated. Default = dev + prod Render |
| `ANTHROPIC_API_KEY` | – | AI run analysis |
| `GEMINI_API_KEY` + `JARVIS_GEMINI_KEY` | – | AI prompt JARVIS server-side |
| `GARMIN_EMAIL` + `GARMIN_PASSWORD` | – | Garmin sync (opzionale) |

> ⚠️ I file `.env` sono in `.gitignore`. NON committare segreti. Usa `.env.example` come template.

---

## 🛠️ Comandi

```bash
npm run dev              # backend + frontend in parallelo
npm run build            # build prod (Vite → dist/)
npm run preview          # serve dist/ locale
npm run lint             # type-check (tsc --noEmit)
npm run lint:eslint      # ESLint (regole React Hooks + react-refresh)
npm run format           # Prettier write
npm run format:check     # Prettier check
npm run build:analyze    # build + bundle visualizer (apre dist/stats.html)
npm run context:update   # rigenera repo-map.md / .json
```

---

## 🔒 Note di sicurezza

- **CORS**: whitelist via `ALLOWED_ORIGINS`. No wildcard in prod.
- **Rate limiting**: 120 req/min per IP global, 10/min per AI endpoint (`/api/ai/analyze-run`, `/api/training-plan/generate`), 30/min per `/api/jarvis/chat`. Implementato via `slowapi` (no-op se non installato).
- **Secrets**: `.env*` (eccetto `.env.example`) ignorati. Per audit periodico → `gitleaks` o `trufflehog`.
- **NoSQL injection**: zero `$where` / `$regex` user-input. Tutte le query Mongo sono dict-based via motor (parametrizzate by default).
- **Mapbox token**: public (`pk.*`). Restringere per dominio nella dashboard Mapbox per evitare abuso quota.

---

## 🧪 Test

Test rapido backend (richiede MONGO_URL):

```bash
python test_backend.py
```

Frontend: niente test runner ufficiale. Type-check via `npm run lint` (tsc strict).

---

## 📁 Struttura repo

```
src/                  React app
  components/         View principali (DashboardView, StatisticsView, ...)
  hooks/              useApi (cache layer), useToast, ...
  utils/              cardiacDrift, paceFormat, racePredictions, cadence
  api.ts              fetch wrapper backend
  types/api.ts        Tipi condivisi
backend/
  server.py           FastAPI app (~7500 righe — God file, da splittare)
  requirements.txt
public/               Asset statici
scripts/              Tooling (update-ai-context, ...)
docs/                 Note interne dev
restyling/            Snapshot/branch UX
```

---

## 🤝 Contribuire

1. Branch da `main`
2. `npm run lint && npm run lint:eslint && npm run format:check` prima di PR
3. Aggiorna **`REPORT-TECNICO.md`** se tocchi architettura/util/component
4. Aggiorna **`PRD.md`** se cambi feature prodotto
5. Aggiungi entry in **`CHANGELOG-AI.md`** se la modifica è AI-driven

---

## 🔧 Troubleshooting

| Problema | Soluzione |
|---|---|
| Garmin 429 | Vedi `MEMORY.md` → `garmin_ratelimit.md` (procedura sblocco con `garth_generate_token.py`) |
| CORS blocca chiamate | Aggiungi origin a `ALLOWED_ORIGINS` in `backend/.env` |
| `slowapi` import fail | `pip install slowapi` (o lascia: il limiter degrada graceful a no-op) |
| Bundle troppo grosso | `npm run build:analyze` → ispeziona `dist/stats.html` |
