# Module Summary: Profile

## Purpose

Profile renders athlete identity, personal records, consistency/heatmap, training zones and integrations. It is also the control surface for local multi-athlete Strava management.

## Main Files

- `src/components/ProfileView.tsx`
- `src/api/index.ts`
- `src/types/api.ts`
- `backend/server.py` around `/api/strava/*` and `/api/profile`

## API

- `getProfile()` -> `/api/profile`
- `updateProfile()` -> `/api/profile`
- `getStravaStatus()` -> `/api/strava/status`
- `getStravaConnections()` -> `/api/strava/connections`
- `setActiveStravaAthlete()` -> `/api/strava/active-athlete`
- `disconnectStrava()` -> `/api/strava/connection`
- `getStravaAuthUrl()` -> `/api/strava/auth-url`
- `syncStrava()` -> `/api/strava/sync`

## Touch When

- Profile edit fields or avatar behavior.
- Strava connect/sync/disconnect flows.
- Active athlete selection.
- Personal record celebration and profile-only UI.

## Watch Outs

- Multiple Strava athletes can exist locally, but external Strava athlete quota can still block authorizing another account.
- Switching active athlete must invalidate profile, runs, dashboard, analytics, best efforts, heatmap and supercompensation caches.
- Disconnecting an athlete should remove only that athlete's token and promote another token active if needed.
