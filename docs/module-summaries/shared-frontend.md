# Module Summary: Shared Frontend

## Purpose

Shared frontend modules keep routing, API calls, types, themes, context and generic utilities consistent.

## Main Files

- `src/App.tsx`
- `src/main.tsx`
- `src/api/client.ts`
- `src/api/index.ts`
- `src/types/api.ts`
- `src/types/jarvis.ts`
- `src/hooks/useApi.ts`
- `src/context/JarvisContext.tsx`
- `src/context/LayoutContext.tsx`
- `src/context/ThemeContext.tsx`
- `src/lib/utils.ts`

## Touch When

- Adding a page route or top nav item.
- Adding/changing backend endpoint wrappers.
- Adding/changing API response types.
- Changing fetch base URL behavior.
- Updating app-level providers or global layout.

## Watch Outs

- Update `src/types/api.ts` together with `src/api/index.ts`.
- Keep route changes reflected in `repo-map` via `npm run context:update`.
- Do not hardcode production secrets in client code.
