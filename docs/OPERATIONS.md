# HovaLett üzemeltetési alapok

## Külső dependency stratégia
- Leaflet betöltése SRI ellenőrzéssel történik (unpkg → jsDelivr fallback).
- Supabase scriptnél két CDN fallback útvonal van (jsDelivr → unpkg).
- Betöltési hiba esetén a UI felhasználóbarát hibasávot jelenít meg.

## Környezetek (dev / stage / prod)
1. `config/environments.example.json` alapján hozz létre környezet-specifikus secret készletet.
2. GitHub Environments ajánlott nevei:
   - `dev`
   - `stage`
   - `prod`
3. Minden environmentben állítsd be ezeket a secret-eket:
   - `SUPABASE_URL`
   - `SUPABASE_PUBLISHABLE_KEY`
   - `MONITORING_ENDPOINT`
   - `ERROR_TRACKING_ENDPOINT`

## Deployment pipeline
- A workflow a branch alapján választ environmentet:
  - `develop` → `dev`
  - `staging` → `stage`
  - `main` → `prod`
- Build lépésben placeholder csere történik `index.html` és `app-config.js` fájlokban.
- Artifactként egy deployolható `dist/` csomag készül.

## Monitoring + Error tracking
- Frontend automatikusan küld eseményeket:
  - `navigation.timing`
  - `window.error`
  - `window.unhandledrejection`
- Az endpointok env-specifikusan, build időben kerülnek behelyettesítésre.
