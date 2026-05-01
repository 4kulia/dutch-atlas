# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Bilingual (RU/EN) interactive map of ~99 Netherlands attractions extracted from a single YouTube video (`8O8TIoHpKXQ`, see `src/types.ts`). Each marker opens a drawer that plays the video at the right timecode and lets signed-in users save favorites and personal notes. Live at https://dutch-atlas.com.

## Stack at a glance

- **Frontend:** Vite + React 18 + TypeScript + Tailwind, served by nginx in Docker.
- **Map:** `@vis.gl/react-google-maps` + `@googlemaps/markerclusterer`.
- **Backend:** PocketBase 0.26 (Go binary in its own container) — Google OAuth + per-user `favorites` + `notes` collections.
- **Deploy:** Two `docker compose` services (`web`, `pb`), both bind to `127.0.0.1`. Host nginx terminates TLS and proxies `/` → 8080, `/pb/` → 8090.

## Common commands

```bash
# dev (run both)
docker compose up -d pb        # PB on :8090
npm run dev                    # Vite on :5173 (proxies /pb → :8090)

# production build / preview
npm run build                  # tsc -b && vite build → dist/
npm run preview
npm run typecheck              # type-only, no emit

# data pipeline (when docs/timecodes.md or scripts/enrichments.mjs change)
node scripts/prepare-data.mjs  # parses md + transcript → data/attractions.base.json
node scripts/merge-data.mjs    # merges base + enrichments → data/attractions.json

# PocketBase admin: http://localhost:8090/_/   (superuser is created via CLI)
docker compose exec pb /pb/pocketbase superuser upsert EMAIL PASSWORD

# configure Google OAuth from a downloaded client_secret_*.json
POCKETBASE_ADMIN_EMAIL=… POCKETBASE_ADMIN_PASSWORD=… \
  node scripts/setup-pb-oauth.mjs path/to/client_secret_*.json

# deploy (server: ssh alias `dutch-atlas`, /opt/dutch-atlas)
ssh dutch-atlas 'cd /opt/dutch-atlas && git pull && docker compose build web && docker compose up -d web'
```

There are no automated tests in this repo.

## Architecture

### Single source of truth for places

`data/attractions.json` is the **only** runtime data. It is built by hand‑in‑the‑loop:

1. `prepare-data.mjs` parses `docs/netherlands_attractions_timecodes.md` (~99 items grouped by `##`/`###` headers) and slices `docs/netherlands_transcript.json` to attach a Russian paragraph per attraction. Output is `data/attractions.base.json` (RU only, no coordinates).
2. `scripts/enrichments.mjs` is a hand‑maintained map of `id → { coordinates, name_en, short_en, full_en }`. Adding a new place means adding both an entry in `timecodes.md` *and* an enrichment.
3. `merge-data.mjs` joins both sources, sorts by `videoTime`, and fails loudly if any id is missing an enrichment.

`src/data/attractions.ts` re‑exports the JSON typed as `Attraction[]` (see `src/types.ts`) and exposes `ATTRACTIONS_BY_ID` and `countByCategory`.

### State and data flow in the UI

`App.tsx` holds the only client state worth knowing about:

- `selectedId` — which attraction's drawer is open. Synced to `?id=` in the URL on every change. Selecting an id closes the My Places panel and triggers a map fly‑to (in `MapView`).
- `active: Set<Category>` — which category chips are on. The "All" chip toggles between all‑on and the current solo selection.
- `favoritesOnly`, `myPlacesOpen`, `myPlacesRefreshKey` — UI flags.
- `useFavorites()` (from `src/auth/useFavorites.ts`) provides `favoriteIds: Set<string>` and an optimistic `toggle()`.

`MapView.tsx` is the only place clusters live. `ClusteredMarkers` keeps a `Record<id, Marker>` in React state and rebuilds the `MarkerClusterer` whenever that record changes — this is intentional: the earlier "register marker via ref callback" approach raced with cluster init and lost markers. When `selectedId` changes, the body pans the map and bumps zoom past 10 so the marker isn't hidden inside a cluster.

### Auth + per-user data (PocketBase)

`src/auth/pb.ts` reads `VITE_POCKETBASE_URL` (default `/pb`). `auto-cancellation` is **off** so concurrent reads from different components don't cancel each other.

`AuthProvider` mirrors `pb.authStore.record` into React state. On mount it calls `authRefresh()`; if PB returns 401/403/404 the local token is cleared. This is load-bearing: when `pb_data` was wiped on the server, browsers kept JWTs for users that no longer existed and every write returned a generic `400 Failed to create record` because relation validation rejected the dangling user id.

Two collections, both with rules `@request.auth.id != "" && user = @request.auth.id` for *all* operations:
- `favorites(user, attraction_id)` — non‑unique index on `(user, attraction_id)` (was unique in the very first migration; relaxed in `1700000001_notes_multi.js`).
- `notes(user, attraction_id, body)` — many‑per‑attraction.

Both have explicit `created` / `updated` autodate fields added in `1700000002_notes_autodate.js`. **Don't assume PB v0.23+ adds them implicitly — it doesn't.** Without those, sorts by `-created` silently no-op and dates render `Invalid Date`.

PocketBase serialises timestamps as `YYYY-MM-DD HH:MM:SS.sssZ` with a **space**, not `T`. `parsePbDate` in `MyPlacesPanel.tsx` and `NotesPanel.tsx` substitutes `T` before `new Date()`. Reuse it if you display PB timestamps anywhere new.

### PocketBase migrations and rules

Migration files live in `pb/pb_migrations/`. They are **bind-mounted** into the container in `docker-compose.yml` so adding a file + `docker compose restart pb` is enough in dev. The Docker image only embeds the snapshot at build time, so prod picks them up via `docker compose build pb`.

Two specific footguns we've already hit, in order of how subtle they are:

1. **Field construction.** `app.save(collection)` accepts a `Collection`, but plain objects in the `fields` array crash the JSVM with a nil pointer dereference. Use the proper constructors (`new AutodateField({...})`) and mutate via `collection.fields.add(...)` / `getByName(...)` / `removeById(...)`. See `1700000002_notes_autodate.js` for the working pattern.
2. **Access rule field references.** PB v0.26 evaluates `createRule` against the *record being saved*, so `user = @request.auth.id` is correct. The legacy `@request.body.user = @request.auth.id` form returns `400 Failed to create record` with **no detail in the response or PB logs**. If a write inexplicably 400s with no message, this is almost certainly the cause.

If a JSVM migration crashes PB on startup, deleting the file from `pb/pb_migrations/` and restarting unblocks PB. You can then make the same change via the admin SDK from outside (see `scripts/setup-pb-oauth.mjs` for the authentication pattern).

### Auth/data gotchas worth remembering

- The PB JS SDK uses `pb.authStore.record` (renamed from `.model` in v0.23+). All references in this codebase use `record`.
- `pb.collection('users').authWithOAuth2({ provider: 'google' })` opens a popup and uses `${pb.baseUrl}/api/oauth2-redirect` (resolved against `window.location.origin`) as the redirect URI. With our default `pb.baseUrl = '/pb'`, that's `https://<host>/pb/api/oauth2-redirect`. **This exact URL must be in Google Cloud → Authorized redirect URIs**, including the dev variants `http://localhost:5173/pb/...` and `http://localhost:8080/pb/...`.

### i18n

All UI strings live in `src/i18n/strings.ts` (`UI`) and `CATEGORY_LABEL`. Per-attraction text comes from `attraction.name[lang]`, `attraction.short[lang]`, `attraction.full[lang]`. Russian plurals go through `src/i18n/plurals.ts` (`plural('notes', n, lang)` → `'1 заметка'` / `'2 заметки'` / `'5 заметок'`).

Language is persisted in `?lang=ru|en` and `localStorage`; `LanguageProvider` keeps the URL in sync.

### YouTube embed

`VideoEmbed.tsx` is intentionally a plain `<iframe>` with `hl`, `cc_lang_pref`, `cc_load_policy=1` set. We tried the YouTube IFrame Player API and the `setAudioTrack`/`getAvailableAudioTracks` methods are **not exposed in the public API** — there is no documented or undocumented way to programmatically switch audio tracks in an embed. Don't relitigate this. Subtitles in the user's language do work.

### Deployment

Production is on `185.70.186.229` (SSH alias `dutch-atlas`), repo cloned into `/opt/dutch-atlas`, exposed by host nginx as `https://dutch-atlas.com` with Let's Encrypt. The site `/etc/nginx/sites-available/dutch-atlas.com` proxies `/pb/` → `127.0.0.1:8090` and `/` → `127.0.0.1:8080`. Secrets (`.env`, `.env.pb`, `client_secret.json`) live in `/opt/dutch-atlas` with `chmod 600` and are gitignored.

`pb_data` is a Docker named volume — back it up before destructive ops; wiping it invalidates every existing user's session in a way that's only debuggable via the `authRefresh` heuristic mentioned above.
