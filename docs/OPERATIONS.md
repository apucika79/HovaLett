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
3. Repository vagy environment szinten kötelező secret-ek a Supabase projekt eléréséhez:
   - `SUPABASE_ACCESS_TOKEN` – Supabase personal/fine-grained access token, amely látja az érintett projektet és olvasni tudja a projekt API kulcsait.
   - `SUPABASE_PROJECT_REF` – a Supabase projekt ref azonosítója (a projekt URL előtagja).
4. Opcionális, környezetenként felülírható secret-ek / változók:
   - `SUPABASE_URL` – ha nincs megadva, a pipeline `https://<SUPABASE_PROJECT_REF>.supabase.co` értékre állítja.
   - `SUPABASE_PUBLISHABLE_KEY` – ha nincs megadva, a pipeline a Supabase Management API-n keresztül próbálja lekérni.
   - `MONITORING_ENDPOINT`
   - `ERROR_TRACKING_ENDPOINT`
   - `AUTH_SOCIAL_PROVIDERS` (vesszővel elválasztva, alapértelmezés: `google,facebook`)
5. A Google/Facebook social login élesítéséhez add meg a választott providerek OAuth adatait is GitHub repository vagy environment secretként. Támogatott secret nevek:
   - Google: `GOOGLE_OAUTH_CLIENT_ID` + `GOOGLE_OAUTH_CLIENT_SECRET` (aliasok: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID`, `SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET`).
   - Facebook: `FACEBOOK_OAUTH_CLIENT_ID` + `FACEBOOK_OAUTH_CLIENT_SECRET` (aliasok: `FACEBOOK_CLIENT_ID`, `FACEBOOK_CLIENT_SECRET`, `FACEBOOK_APP_ID`, `FACEBOOK_APP_SECRET`, `SUPABASE_AUTH_EXTERNAL_FACEBOOK_CLIENT_ID`, `SUPABASE_AUTH_EXTERNAL_FACEBOOK_SECRET`).
6. A frontend Supabase kliens elsődlegesen a `SUPABASE_PUBLISHABLE_KEY` értéket olvassa; a régi `SUPABASE_ANON_KEY` név csak visszafelé kompatibilis fallback.

## Bejelentkezési szolgáltatók
- Az email/jelszó alapú bejelentkezés továbbra is a Supabase Auth beépített email providerén keresztül működik.
- A közösségi bejelentkezési gombokat az `AUTH_SOCIAL_PROVIDERS` konfiguráció szabályozza. Az alapértelmezett érték `google,facebook`, ezért a Google és Facebook gombok külön konfiguráció nélkül is megjelennek; csak olyan értéket adj meg, amelyhez a megfelelő OAuth secret-ek is rendelkezésre állnak.
- A deploy pipeline a `scripts/configure-supabase-auth-providers.sh` helperrel automatikusan bekapcsolja a `google` és/vagy `facebook` Supabase Auth providert a `AUTH_SOCIAL_PROVIDERS` lista és a fenti OAuth secret-ek alapján. Így a frontend gombok és a Supabase Auth provider állapota nem tud szétcsúszni; ha egy kért providerhez hiányzik a client ID vagy secret, a deploy hibával megáll a hibás publikus build helyett.
- A Google és Facebook gombok Supabase OAuth bejelentkezést indítanak. Támogatott `AUTH_SOCIAL_PROVIDERS` értékek: `google`, `facebook`, illetve Facebook aliasokként `fb` és `meta`. A Facebook appban Valid OAuth Redirect URI-ként a Supabase callback URL-t add meg: `https://<SUPABASE_PROJECT_REF>.supabase.co/auth/v1/callback`, a Supabase Auth Redirect URL-ek közé pedig a publikus alkalmazás URL-jét vedd fel.
- A frontend OAuth visszatérési URL-je az aktuális origin + pathname, query/hash nélkül, így ugyanarra a statikus oldalra érkezik vissza a felhasználó.

## Deployment pipeline
- A workflow a branch alapján választ environmentet:
  - `develop` → `dev`
  - `staging` → `stage`
  - `main` → `prod`
- A `scripts/prepare-supabase-env.sh` helper a build előtt ellenőrzi, hogy a `SUPABASE_ACCESS_TOKEN` eléri-e a `SUPABASE_PROJECT_REF` projektet, majd kitölti a `SUPABASE_URL` és `SUPABASE_PUBLISHABLE_KEY` értékeket a további GitHub Actions lépéseknek.
- A `scripts/configure-supabase-auth-providers.sh` helper ezután Supabase Management API `PATCH /v1/projects/<ref>/config/auth` hívással engedélyezi a kért Google/Facebook Auth providereket.
- Build lépésben placeholder csere történik `index.html` és `app-config.js` fájlokban. Ha a live/static preview build nélkül szolgálja ki a fájlokat, az `app-config.js` a publikus dev Supabase konfigurációra esik vissza, hogy a térképes lista továbbra is működjön.
- Artifactként egy deployolható `dist/` csomag készül.

## Supabase hozzáférés GitHub Actionsból és Codexből
- A `.github/workflows/supabase-access.yml` workflow statikusan ellenőrzi az infrastruktúra fájlokat pull requestekben, push és manuális futtatás esetén pedig Supabase CLI-vel és Management API-val is validálja a projekt elérést.
- A Supabase projekt eléréséhez a workflow-k továbbra is a `SUPABASE_ACCESS_TOKEN` és `SUPABASE_PROJECT_REF` secretet használják; a social providerek bekapcsolásához emellett a kiválasztott Google/Facebook OAuth client ID + secret párok is szükségesek.
- Codex vagy lokális automatizáció ugyanígy tudja előkészíteni a környezetet:

  ```bash
  export SUPABASE_ACCESS_TOKEN="..."
  export SUPABASE_PROJECT_REF="..."
  scripts/prepare-supabase-env.sh
  ```

  A parancs siker esetén kiírja a `SUPABASE_PROJECT_REF`, `SUPABASE_URL` és `SUPABASE_PUBLISHABLE_KEY` értékeket, illetve hiba esetén nem módosít alkalmazásfájlokat.
- GitHub Actions alatt a helper `--github-env` kapcsolóval fut, így az értékek a későbbi lépésekben környezeti változóként elérhetők, a tokenek pedig maszkolásra kerülnek a logokban.

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
