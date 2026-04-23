# Module Summary: Runner DNA

## Purpose

Runner DNA turns real activity, fitness and biomechanics data into an athletic identity: strength score, improvement margin, distance talent, strengths, weaknesses and practical priorities.

## Main Files

- `src/components/RunnerDnaView.tsx`
- `src/components/RunnerDnaV2View.tsx`
- `src/components/runner-dna/RunnerDnaLoading.tsx`
- `src/hooks/useRunnerDnaUiModel.ts`
- `src/utils/runnerDnaModel.ts`
- `backend/server.py` around `/api/runner-dna`

## API

- `getRunnerDna()` -> `/api/runner-dna`
- `clearRunnerDnaCache()` -> `/api/runner-dna/cache`
- `getProfile()` -> `/api/profile`
- `getBestEfforts()` -> `/api/best-efforts`

## Touch When

- Runner DNA identity, score or chart.
- Runner DNA V2 premium UI.
- Real-data fallback/missing-value behavior.
- Biomechanics benchmark/reference tables.
- Runner DNA cache signature or freshness.

## Watch Outs

- Runner DNA V2 must not use mock values.
- Missing data should be explicit (`N/D` or unavailable).
- Garmin CSV import/link should invalidate Runner DNA cache.
- Backend `data_freshness` must reflect relevant data sources, not only last Strava date.
