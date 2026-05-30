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
4. A frontend Supabase kliens elsődlegesen a `SUPABASE_PUBLISHABLE_KEY` értéket olvassa; a régi `SUPABASE_ANON_KEY` név csak visszafelé kompatibilis fallback.

## Bejelentkezési szolgáltatók
- Az email/jelszó alapú bejelentkezés továbbra is a Supabase Auth beépített email providerén keresztül működik.
- A Google és Facebook gombok Supabase OAuth bejelentkezést indítanak; a Supabase Dashboardban környezetenként engedélyezni kell a `Google` és `Facebook` providereket, valamint a publikus alkalmazás URL-jét fel kell venni Redirect URL-ként.
- A frontend OAuth visszatérési URL-je az aktuális origin + pathname, query/hash nélkül, így ugyanarra a statikus oldalra érkezik vissza a felhasználó.

## Deployment pipeline
- A workflow a branch alapján választ environmentet:
  - `develop` → `dev`
  - `staging` → `stage`
  - `main` → `prod`
- Build lépésben placeholder csere történik `index.html` és `app-config.js` fájlokban. Ha a live/static preview build nélkül szolgálja ki a fájlokat, az `app-config.js` a publikus dev Supabase konfigurációra esik vissza, hogy a térképes lista továbbra is működjön.
- Artifactként egy deployolható `dist/` csomag készül.

## Monitoring + Error tracking
- Frontend automatikusan küld eseményeket:
  - `navigation.timing`
  - `window.error`
  - `window.unhandledrejection`
- Az endpointok env-specifikusan, build időben kerülnek behelyettesítésre.

## Abuse-védelem és moderáció
- Új bejelentések alapértelmezett státusza: `review`, ezért nyilvánosan csak admin jóváhagyás után (`aktiv`) jelennek meg.
- SQL oldali rate limit védelem:
  - bejelentések: max 5 / óra és 20 / nap / user
  - üzenetek: max 60 / óra / user
  - abuse reportok: max 20 / óra / user
- Bejelentés részletező modalban már valódi `abuse_reports` rekord jön létre (nem csak placeholder alert).
- Frontend oldalon extra bot-fék:
  - kötelező “Nem vagyok robot” checkbox mentésnél
  - lokális cooldown (bejelentés és üzenet küldés között)

### Képek moderációja (javasolt pipeline)
1. Feltöltés után a rekord `review` státuszban maradjon.
2. Opcionális háttér worker vizsgálja a képet (NSFW/violence/illicit tartalom).
3. Pozitív moderáció után admin workflow automatikusan `aktiv` státuszra állíthat.
4. Elutasított tartalomnál `rejected` státusz + audit trail.
