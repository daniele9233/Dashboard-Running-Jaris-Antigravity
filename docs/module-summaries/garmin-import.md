# Module Summary: Garmin Import

## Purpose

Garmin import adds authoritative running dynamics to Strava runs. It supports Garmin auth/sync and manual CSV import/link.

## Main Files

- `backend/server.py`
- `src/api/index.ts`
- `src/types/api.ts`
- related UI controls in dashboard/sidebar/statistics depending on current feature.

## API

- `getGarminStatus()` -> `/api/garmin/status`
- `syncGarmin()` -> `/api/garmin/sync`
- `syncGarminAll()` -> `/api/garmin/sync-all`
- `getGarminAuthUrl()` -> `/api/garmin/auth-start`
- `exchangeGarminTicket()` -> `/api/garmin/exchange-ticket`
- `saveGarminToken()` -> `/api/garmin/save-token`
- `importGarminCsv()` -> `/api/garmin/csv-import`
- `linkGarminCsv()` -> `/api/garmin/csv-link`
- `getGarminCsvData()` -> `/api/garmin/csv-data`
- `deleteGarminCsvData()` -> `/api/garmin/csv-data/{doc_id}`
- `getGctAnalysis()` -> `/api/garmin/gct-analysis`

## Touch When

- CSV column parsing.
- Cadence normalization.
- Duplicate CSV repair/inactivation.
- Match/link confidence.
- Running dynamics enrichment.
- GCT/vertical ratio/stride length analysis.

## Watch Outs

- Garmin CSV cadence is authoritative. Values already above 120 should remain SPM.
- Legacy half-cadence values can be repaired, but do not double everything blindly.
- CSV rows should not duplicate chart/statistics.
- Import/link must invalidate analytics and Runner DNA caches.
