# Data Flow

## Strava Flow

1. Frontend asks `/api/strava/auth-url`.
2. User authorizes Strava.
3. Frontend exchanges code through `/api/strava/exchange-code`.
4. Backend stores the token as `active: true` and marks other local Strava athletes inactive.
5. Profile can call `/api/strava/connections` and `/api/strava/active-athlete` to switch the active athlete.
6. Sync runs through `/api/strava/sync` for the active athlete.
7. Backend upserts runs, splits, cadence, route polyline/start coordinates and profile totals.
8. Backend recomputes fitness/freshness, best efforts, VDOT-related state and invalidates dependent caches.

Important: run list endpoints should remain lean. Full stream data belongs in detail endpoints only.

## Garmin Flow

Garmin can enter the system through:

- Garmin auth and sync endpoints.
- Manual CSV import through `/api/garmin/csv-import`.
- Relinking existing CSV through `/api/garmin/csv-link`.

CSV import stores rows in `garmin_csv_data`, dedupes/repairs rows, validates plausible metric ranges, then links rows to Strava runs. When matched, Garmin CSV is authoritative for running dynamics.

Key metrics:

- cadence in steps per minute (`avg_cadence_spm`).
- ground contact time in ms.
- vertical oscillation in cm.
- vertical ratio in percent.
- stride length in meters.
- HR, pace, power when available.

## Dashboard Flow

Dashboard data comes from `/api/dashboard`, which aggregates profile, current week/plan, last run, fitness/freshness and recovery score. The frontend renders it in `DashboardView`.

## Runner DNA Flow

1. Frontend calls `/api/runner-dna`.
2. Backend checks cache signature/data freshness.
3. Backend calculates or returns Runner DNA from real data:
   - Strava runs.
   - best efforts.
   - fitness/freshness.
   - Garmin CSV/running dynamics.
4. Frontend original view consumes raw-ish backend structure.
5. Runner DNA V2 uses `useRunnerDnaUiModel()` and `buildRunnerDnaUiModel()` to create a stable UI model.

## Training Plan Flow

1. User enters goal race/time/weeks/start date in frontend.
2. Frontend calls `/api/training-plan/generate`.
3. Backend computes current VDOT, target VDOT, feasibility and strategy.
4. Backend computes `history_context` (stop days, recent volume, recent peak, quality sessions, easy ratio, readiness and CTL/ATL/TSB).
5. Backend uses `history_context` to soften VDOT after stops, allocate phases and calibrate starting volume.
6. Backend writes training weeks.
7. Future Strava sync can auto-adapt the plan through backend logic and `/api/training-plan/adapt`.

## Analytics Flow

Analytics endpoints include:

- `/api/analytics`
- `/api/analytics/pro`
- `/api/fitness-freshness`
- `/api/vdot/paces`
- `/api/best-efforts`
- `/api/garmin/gct-analysis`

The frontend statistics pages are in `src/components/statistics/`.
