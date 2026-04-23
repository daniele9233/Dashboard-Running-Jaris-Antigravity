# Module Summary: Training

## Purpose

Training renders the calendar and manages plan generation, adaptation and session completion. Backend logic uses VDOT, target race, plan mode, weeks, start date and fitness signals.

## Main Files

- `src/components/TrainingView.tsx`
- `src/components/TrainingGrid.tsx`
- `src/components/TrainingSidebar.tsx`
- `backend/server.py` around `/api/training-plan/*`

## API

- `getTrainingPlan()` -> `/api/training-plan`
- `getCurrentWeek()` -> `/api/training-plan/current`
- `toggleSessionComplete()` -> `/api/training-plan/session/complete`
- `generateTrainingPlan()` -> `/api/training-plan/generate`
- `evaluateTest()` -> `/api/training-plan/evaluate-test`
- `adaptTrainingPlan()` -> `/api/training-plan/adapt`

## Touch When

- Plan generation modal.
- Strategy cards.
- VDOT calibration test.
- Year/month/week calendar rendering.
- Session completion/adaptation logic.
- Backend scientific plan progression.

## Watch Outs

- Keep strategy probability consistent between preview and generated plan.
- Auto-adaptation must respond to future Strava syncs.
- Do not mark sessions complete without clear matching logic.
