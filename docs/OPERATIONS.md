# HovaLett üzemeltetési alapok

## Verziózott adatbázis-migrációk

A séma kanonikus forrása a `supabase/migrations` könyvtár. A
`20260928000000_baseline.sql` a jelenlegi adatmodellt egyetlen, tranzakciós
baseline-ként rögzíti: a négy alkalmazástáblát, indexeket, függvényeket,
triggereket, RLS policy-kat, valamint a publikus `report-images` bucketet és
annak Storage policy-jait. A migráció nem tartalmaz `DROP TABLE`, `TRUNCATE`
vagy `DELETE FROM` utasítást. A `supabase_schema.sql` csak legacy/bootstrap
kompatibilitás miatt maradt a repóban; új telepítésnél nem szabad külön
lefuttatni.

### Teljesen új projekt indítása

1. Telepítsd a [Supabase CLI-t](https://supabase.com/docs/guides/local-development/cli/getting-started), majd a repó gyökerében jelentkezz be.
2. Hozd létre a projektet a Dashboardon, és jegyezd fel a projekt refet.
3. Kapcsold a repót a projekthez, majd alkalmazd a verziózott migrációkat:

   ```bash
   supabase login
   supabase link --project-ref "$SUPABASE_PROJECT_REF"
   supabase db push
   ```

4. A migráció után állítsd be az Auth redirect URL-eket és a szükséges OAuth
   providereket az alább dokumentált környezeti konfigurációval. A migráció
   kizárólag az adatbázis- és Storage-sémát kezeli, titkokat nem.

Helyi, teljesen tiszta próbához Docker mellett futtasd:

```bash
supabase start
supabase db reset --local
supabase db lint --local --level warning
```

A `db reset` **csak a lokális fejlesztői adatbázison** használható; linkelt vagy
éles projekt adatainak baseline-olására tilos.

### Már létező projekt átállítása

Az átállás előtt készíts Dashboard backupot, illetve exportáld a távoli sémát.
A jelenlegi környezet ebben a repóban nem tartalmaz Supabase tokent vagy
adatbázis-jelszót, ezért az élő állapot automatikus lekérdezése helyett az alábbi
auditot a projektgazdának kell elvégeznie:

```bash
supabase link --project-ref "$SUPABASE_PROJECT_REF"
supabase db dump --linked --schema public,storage --file /tmp/hovalett-before.sql
supabase migration list
supabase db push --dry-run
```

- Ha az élő projektet korábban a `supabase_schema.sql` aktuális változatával
  hozták létre, és a dump alapján a táblák, constraint-ek, függvények,
  triggerek, policy-k és bucket megegyeznek a baseline-nal, **ne futtasd újra a
  DDL-t**. Jelöld a baseline verziót már alkalmazottnak, majd ellenőrizd a
  listát:

  ```bash
  supabase migration repair --linked --status applied 20260928000000
  supabase migration list
  ```

- Ha a séma a legacy fájl egy korábbi, de kompatibilis állapota, először nézd át
  a `supabase db push --dry-run` kimenetét. A baseline idempotens
  `CREATE ... IF NOT EXISTS`, `CREATE OR REPLACE`, illetve policy/trigger
  újralétrehozást használ, és nem töröl alkalmazásadatot; az ellenőrzött
  baseline a `supabase db push` paranccsal alkalmazható. Ismeretlen drift vagy
  eltérő oszloptípus esetén ne kényszerítsd a baseline-t: készíts külön,
  előremenő, adatmegőrző javítómigrációt.

A `migration repair` csak a migrációs előzményt módosítja, magát a sémát nem;
ezért kizárólag bizonyított sémaegyezésnél használd.

### Ellenőrzés

Repószinten és CI-ben az alábbi ellenőrzések futnak:

```bash
bash -n scripts/validate-supabase-migrations.sh
scripts/validate-supabase-migrations.sh
supabase start
supabase db reset --local
supabase db lint --local --level warning
```

Az első kettő ellenőrzi a shell szintaxist, a migrációk szabványos időbélyeges
nevét, valamint tiltja az adatvesztő `DROP TABLE`, `TRUNCATE` és `DELETE FROM`
utasításokat. A lokális reset egy üres Supabase adatbázisra ténylegesen
alkalmazza az összes migrációt, a lint pedig a létrejött adatbázist ellenőrzi.
Linkelt projekt esetén a `supabase migration list` helyi/távoli verzióinak
egyezniük kell. Végül egy jogosultság nélküli klienssel ellenőrizd, hogy csak az
`aktiv` bejelentések olvashatók, bejelentkezett tesztuserrel pedig a saját
rekordokra és a `report-images/<user-id>/...` útvonalra vonatkozó műveleteket.

### Visszaállítás hiba esetén

- A baseline `BEGIN`/`COMMIT` tranzakcióban fut, ezért SQL-hiba esetén a DDL
  automatikusan teljes egészében visszagördül, és az adatok megmaradnak.
- Sikertelen futás után javítsd a hibát egy új, nagyobb időbélyegű migrációban,
  majd futtasd újra a `supabase db push` parancsot. Már publikált migrációt ne
  írd át, és éles táblát ne dobj el.
- Ha csak tévesen lett „applied” állapotúra javítva a baseline, a ledger
  visszaállítható anélkül, hogy a séma vagy az adatok változnának:

  ```bash
  supabase migration repair --linked --status reverted 20260928000000
  ```

- Sikeresen commitolt, de hibás séma esetén előremenő korrekciós migráció az
  elsődleges helyreállítás. Adatsérülés gyanújakor állítsd le az írásokat, és a
  futtatás előtt készített Supabase backupból állíts helyre; destruktív kézi
  „rollback” helyett előbb klónozott/staging projekten próbáld ki a helyreállítást.

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

### Üzenetküldési szabályok

- Üzenetet kizárólag bejelentkezett felhasználó küldhet, saját nevében, a
  hivatkozott bejelentés tulajdonosának; saját magának nem küldhet.
- **Első üzenet csak `aktiv` bejelentéshez küldhető.** Ha ugyanaz a küldő az
  adott bejelentés tulajdonosának már küldött üzenetet, a megkezdett kapcsolat
  `lezart` (vagy más nem aktív) státusz után is folytatható. Ez nem nyitja meg a
  beszélgetést más felhasználóknak.
- A `body` a whitespace levágása után nem lehet üres, maximális hossza **2000
  karakter**.
- Az elküldött üzenet teljesen változtathatatlan: nincs update policy vagy
  `authenticated` UPDATE jogosultság. Így a `body`, `from_user_id`,
  `to_user_id`, `report_id` és `created_at` sem írható át; javítást új üzenetben
  kell elküldeni, ezért nincs félrevezető, auditnyom nélküli szerkesztés.
- Az automatizált RLS tesztek a `supabase/tests/database` könyvtárban vannak;
  helyi Supabase indítása után a `supabase test db` futtatja őket.
- Bejelentés részletező modalban már valódi `abuse_reports` rekord jön létre (nem csak placeholder alert).
- Frontend oldalon extra bot-fék:
  - kötelező “Nem vagyok robot” checkbox mentésnél
  - lokális cooldown (bejelentés és üzenet küldés között)

### Képek moderációja (javasolt pipeline)
1. Feltöltés után a rekord `review` státuszban maradjon.
2. Opcionális háttér worker vizsgálja a képet (NSFW/violence/illicit tartalom).
3. Pozitív moderáció után admin workflow automatikusan `aktiv` státuszra állíthat.
4. Elutasított tartalomnál `rejected` státusz + audit trail.
