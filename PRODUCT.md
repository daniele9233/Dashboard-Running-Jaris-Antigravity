# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Daniele Pascolini, a competitive amateur runner, is the one user today (confirmed: personal use only, no outside audience claimed). He reads the dashboard to decide the next training step toward a specific race (half marathon, then a sub-20 5 K). The app can hold several local Strava athletes, one active at a time; this is a technical capability, not a target audience.

## Product Purpose

METIC LAB (also called ELITE ANALYTICS) turns Strava and Garmin data into scientific analysis of running: performance, biomechanics, training load, physiological projections, race prediction and an adaptive training plan. Success is that every number on screen can be trusted and acted on: the user reads a chart and knows what to do in the next session.

## Positioning

Not a generic tracker: the models behind the numbers (Daniels VDOT, Banister fitness/fatigue, Seiler 80/20, Foster, Mujika taper, Riegel, Miner/Daniels pace tank) are applied to the athlete's own history, including gradient and endurance holding, and the plan adapts to real performance.

## Operating Context

- Frontend React 19 + Vite 6 + TypeScript + Tailwind CSS 4, Recharts 3.8 for most charts, custom SVG for proprietary visualisations (Race Lab, gamification, prediction curves), Mapbox GL and Three.js for maps and 3D.
- Backend FastAPI + MongoDB; data from Strava OAuth and Garmin (CSV and reverse-engineered API).
- Routes: dashboard `/`, `/training`, `/statistics` (analytical sub-sections: load and form, potential and progress V1 and V2, biomechanics and efficiency, biology and future V1 and V2, climate and pace, detraining), `/race-lab`, `/pace-lab`, `/runner-dna`, `/gamification-v1`, `/ranking`, `/badges`, `/profile`, `/activities`.
- A full-screen intro hero opens the app and then hands over to the dashboard.
- Interface language is Italian (i18next IT/EN, part of the strings still hardcoded).

## Capabilities and Constraints

- Numbers are authoritative: formulas, units, aggregations, filters, interpolations and API contracts are not changed by design work. Pace in min/km keeps its direction and formatting.
- Cycling and indoor-bike data live only in the DETRAINING widget: never in distance, load, VDOT or statistics.
- Predictions follow the VDOT rule (runs of 5 K and longer) and always account for gradient and endurance holding.
- The local backend writes to the production MongoDB: UI verification must not trigger saving actions.
- No LICENSE file; dependencies are MIT-compatible.
- Not decided: commercialisation (Garmin reverse-engineered API carries legal risk), public multi-user SaaS.

## Brand Commitments

- Name METIC LAB, also ELITE ANALYTICS.
- Dark interface with electric lime as the primary colour (`#C0FF00` in the code today); recognisable scientific charts and sports KPIs. The design system keeps this identity and does not replace it with a generic SaaS template.

## Evidence on Hand

- Real training and race data in MongoDB from Strava and Garmin; no invented testimonials, customers or benchmarks.
- Existing product documents: `PRD.md`, `README.md`, `REPORT-TECNICO.md`, `DESIGN.md` (spec of the intro hero only, not of the app).

## Product Principles

1. Data integrity before beauty: a chart never changes a number to look better.
2. Scientific legibility: precision, units and direction of every axis are readable at a glance.
3. One language: the same concept looks the same in every route.
4. Observed, derived and predicted values are always visually distinguishable; uncertainty is never invented.
5. Dense but calm: lots of information, no decoration that does not serve reading.

## Accessibility & Inclusion

Contrast and keyboard focus must be verified in the browser; colour is never the only carrier of risk or improvement; motion respects `prefers-reduced-motion`; colour palettes for multiple series should stay distinguishable for colour-blind users.
