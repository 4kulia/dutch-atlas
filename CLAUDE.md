# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Bilingual (RU/EN) interactive map of ~99 Netherlands attractions extracted from a single YouTube video (`8O8TIoHpKXQ`, see `src/types.ts`). Each marker opens a drawer that plays the video at the right timecode and lets signed-in users save favourites and personal notes. Live at https://dutch-atlas.com.

A second pillar is **Atlas**, the AI assistant: a chat panel with vector-grounded place search, multi-day route planning over Google Directions (with snap-to-road fallback for stops in water), and persistent sessions. Sign-in only.

User-submitted places are part of the schema (`source`, `status`, `author`, optional video) but the moderation flow isn't wired to a UI yet.

## Stack at a glance

- **Frontend:** Vite + React 18 + TypeScript + Tailwind, served by nginx in Docker.
- **Map:** `@vis.gl/react-google-maps` + `@googlemaps/markerclusterer` + plain `google.maps.DirectionsService` for routes.
- **Backend:** one Node.js service (`api/`, Express) — owns auth, catalogue, favourites, notes, chat sessions, and the AI agent.
- **Database:** Postgres 17 with the `vector` extension (pgvector image). Two embedding columns per attraction (RU + EN) for semantic search.
- **Embeddings:** Voyage AI (`voyage-3.5`).
- **LLM:** Anthropic `claude-sonnet-4-6` for tool-use, streamed via SSE.
- **Auth:** server-side Google OAuth (`jose` for id_token JWKs verification + own HS256 session JWT in HTTP-only cookie).
- **Deploy:** four `docker compose` services (`web`, `postgres`, `api`, plus optional `qdrant` if reintroduced) bound to `127.0.0.1`. Host nginx terminates TLS and proxies `/` → 8080, `/api/` → 8091.

## Common commands

```bash
# dev — bring postgres up, run api in a container, run vite locally
docker compose up -d postgres                 # postgres on 127.0.0.1:5440
docker compose up -d api                      # auto-migrates schema; on :8091
npm run dev                                   # vite on :5173 (proxies /api → :8091)

# api dev outside docker (faster iteration)
cd api && npm run dev                         # tsx watch src/index.ts

# production build / preview
npm run build                                 # tsc -b && vite build → dist/
npm run typecheck                             # type-only, no emit

# data pipeline (when docs/timecodes.md or scripts/enrichments.mjs change)
node scripts/prepare-data.mjs                 # parses md + transcript → data/attractions.base.json
node scripts/merge-data.mjs                   # merges base + enrichments → data/attractions.json

# seed catalogue + Voyage embeddings into Postgres (idempotent — re-runs only changed rows)
node scripts/seed-attractions.mjs

# vector search smoke test
node scripts/test-search.mjs ru "ветряные мельницы"
node scripts/test-search.mjs en "old castles with history"

# deploy (server: ssh alias `dutch-atlas`, /opt/dutch-atlas)
ssh dutch-atlas 'cd /opt/dutch-atlas && git pull && docker compose build && docker compose up -d'
```

There are no automated tests in this repo.

## Architecture

### Where places live

`data/attractions.json` is the **seed**. The runtime source of truth is the `attractions` table in Postgres:

1. `prepare-data.mjs` parses `docs/netherlands_attractions_timecodes.md` (~99 items grouped by `##` / `###` headers) and slices `docs/netherlands_transcript.json` to attach a Russian paragraph per attraction.
2. `scripts/enrichments.mjs` is a hand-maintained map of `id → { coordinates, name_en, short_en, full_en }`.
3. `merge-data.mjs` joins both sources, sorts by `videoTime`, and fails loudly on missing enrichments.
4. `scripts/seed-attractions.mjs` reads `data/attractions.json`, upserts rows in `attractions` by `id`, and recomputes Voyage embeddings only for rows whose content hash changed.

`src/data/AttractionsProvider.tsx` is the only place that fetches `/api/attractions`. It hydrates from `localStorage` (TTL 1h) → bundled JSON (`src/data/bundled.ts`) → live API. Don't reintroduce static `ATTRACTIONS` imports.

### Data model (Postgres)

- `users(id, email, name, avatar_url, google_sub UNIQUE, created_at, updated_at)`
- `attractions` — slug PK, RU+EN text, `lat/lng`, optional video, `embedding_ru/en vector(1024)`, `embedding_hash_ru/en`, `source CHECK ('curated','user')`, `status CHECK ('draft','pending','published','rejected')`, `author_id REFERENCES users` (nullable for curated rows). `ivfflat` indexes per language.
- `favorites(user_id, attraction_id, created_at)` — composite PK.
- `notes(id ULID, user_id, attraction_id, body, created_at, updated_at)`.
- `chat_sessions(id ULID, user_id, title, created_at, updated_at)`.
- `chat_messages(id ULID, user_id, session_id REFERENCES chat_sessions, role, content, ui_events JSONB, created_at)`.

Schema migration runner lives in `api/src/migrate.ts`. Each `*.sql` in `api/src/schema/` runs once, in lexical order, recorded in `_migrations`. The init file (`001_init.sql`) is idempotent and runs on every boot — it bootstraps `pgvector` and the bookkeeping table.

### AI agent

`api/src/agent.ts` owns the Anthropic streaming loop. Tools registered in `api/src/tools/index.ts`:

- `search_attractions(query, lang, near?, categories?, exclude_slugs?, limit?)` — embeds the query via Voyage and runs `pgvector` cosine search against `attractions_<lang>`. Returns matches with score + coordinates and emits a `cards.attractions` UI event.
- `get_attraction_details(slug, lang)` — fetches the full description for one place.
- `show_on_map(slugs, fly_to?)` — side-effect tool that highlights markers on the map.
- `open_drawer(slug)` — side-effect tool that opens the drawer.
- `build_route(title?, lang, days[].title, days[].stops[].slug, …)` — emits a structured route card. The frontend renders pinned numbered markers and draws the polyline via `google.maps.DirectionsService`.

Each tool returns `{ forModel, uiEvents? }`. The `forModel` payload is what the LLM sees on the next turn (kept compact). `uiEvents` are pushed to the browser via SSE in real time.

The agent endpoint (`POST /api/agent/messages`) is **sign-in only**. Body validation is `zod` and accepts `null` for optional fields (the frontend sends `sessionId: null` for fresh chats). The endpoint either uses an existing session or creates one whose title is summarised from the first prompt; the SSE `start` event echoes back `sessionId` + `sessionFresh`.

System prompt rules worth knowing about:
- Each user turn is prefixed with `[lang=…, travelMode=…]`. The model uses `travelMode` as the default when planning routes.
- After `build_route` the model is told NOT to redescribe the route in markdown — the structured RouteCard already shows times and stops.

### Google Directions on the frontend

`MapView.RouteOverlay` runs the active route through `google.maps.DirectionsService` per day. The strategy:

1. **Whole-day request** with waypoints in non-transit modes. If it succeeds and the leg count matches the stop count, draw one solid polyline.
2. **Pairwise** otherwise. Each leg gets its own request.
3. **Snap-to-road** on `ZERO_RESULTS`: reverse-geocode the failing endpoint via `google.maps.Geocoder` (preferring `street_address` → `route` → `premise` → `postal_code` → `locality`) and retry.
4. **Dashed fallback** if even snap fails.

If a snapped endpoint diverges from the original numbered marker by more than 50 m, a short dashed "last metres" tail visually links them.

`RouteDirectionsContext` collects per-leg duration + distance and feeds them back to the RouteCard so the chat shows real ETAs (not haversine guesses).

The travel-mode segmented control lives in App state and is sent to the API on every turn. For TRANSIT we split into pairwise requests (Google rejects waypoints) and use `departureTime = tomorrow 09:00`.

### Auth

- `/api/auth/google` → 302 to Google with a state nonce in an HTTP-only cookie.
- `/api/auth/google/callback` → exchanges the code, verifies the `id_token` against Google's JWKs (`jose.createRemoteJWKSet`), upserts the user by `google_sub`, signs an HS256 session JWT, sets `nl_session` HTTP-only cookie, redirects back to `return_to`.
- `/api/auth/me` → 401 or `{user}`.

The frontend reads no JWT directly — `apiFetch` always sends `credentials: 'include'`.

⚠️ **Docker IPv6 footgun**: the api container forces IPv4 (`NODE_OPTIONS=--dns-result-order=ipv4first` + `setGlobalDispatcher(new Agent({ connect: { family: 4 } }))` in `api/src/index.ts`). Without this, `fetch('https://oauth2.googleapis.com/token')` stalls with `ETIMEDOUT` because the docker bridge has no IPv6 route but undici's Happy Eyeballs prefers AAAA. Don't remove these lines.

### Sessions UI

`SessionsOverlay` in `ChatPanel` lists past chats (newest first), with first user message as preview. New chat = `setSessionId(null)`; the next prompt creates one. Switching to an existing session re-hydrates messages from `/api/chat/sessions/:id` and re-emits the latest route on the bus so the map matches.

There's a race-fix that's load-bearing: the `useEffect` on `sessionId` skips the network round-trip when the prop simply echoes a session id we just created during a streaming send (otherwise it would clobber the in-flight reply with the half-saved DB state).

### i18n

All UI strings live in `src/i18n/strings.ts` (`UI`) and `CATEGORY_LABEL`. Per-attraction text comes from `attraction.name[lang]`, `attraction.short[lang]`, `attraction.full[lang]`. Russian plurals go through `src/i18n/plurals.ts`. Language is persisted in `?lang=ru|en` and `localStorage`.

### YouTube embed

`VideoEmbed.tsx` is intentionally a plain `<iframe>` with `hl`, `cc_lang_pref`, `cc_load_policy=1`. We tried the IFrame Player API; `setAudioTrack` / `getAvailableAudioTracks` are NOT exposed for embeds — there is no documented or undocumented way to programmatically switch audio tracks. Don't relitigate this. Subtitles in the user's language do work.

### Deployment

Production lives on `185.70.186.229` (SSH alias `dutch-atlas`), repo at `/opt/dutch-atlas`. Host nginx in `/etc/nginx/sites-available/dutch-atlas.com` proxies:

- `/` → `127.0.0.1:8080` (web container, static SPA)
- `/api/` → `127.0.0.1:8091` (api container, includes the SSE-streaming agent endpoint)

Secrets live in `/opt/dutch-atlas/.env` (`POSTGRES_PASSWORD`) and `/opt/dutch-atlas/.env.api` (Anthropic / Voyage / Exa / Google OAuth client / `JWT_SECRET` / `PUBLIC_BASE_URL=https://dutch-atlas.com`). Both are gitignored. Postgres data is in the `postgres_data` named volume; back it up before destructive ops.

The api container's nginx proxy MUST disable buffering so SSE deltas reach the browser without batching:

```
proxy_buffering off;
proxy_cache off;
proxy_read_timeout 5m;
```

Google Cloud Console authorised redirect URIs must include:

```
http://localhost:5173/api/auth/google/callback         # local dev via vite
https://dutch-atlas.com/api/auth/google/callback       # production
```

Old `…/pb/api/oauth2-redirect` entries can be removed — there is no PB anymore.
