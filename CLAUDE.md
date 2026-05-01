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
docker compose up -d postgres                 # postgres on 127.0.0.1:5440 (host) → :5432 (container)
docker compose up -d api                      # auto-migrates schema on every boot; listens on :8091
npm run dev                                   # vite on :5173 (proxies /api → :8091)

# api dev outside docker (faster iteration)
cd api && npm install
cd api && npm run dev                         # tsx watch src/index.ts
cd api && npm run migrate                     # apply schema migrations against DATABASE_URL

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

### Top-level UI orchestration

`App.tsx` owns the cross-cutting state that ties the chat panel, the map, and the drawer together:

- `selectedId` — drives the drawer; written to `?id=` in the URL.
- `active: Set<Category>` + `favoritesOnly` — filter chips.
- `chatOpen`, `myPlacesOpen` — sheets/drawers visibility.
- `highlightedIds: Set<string> | null` — which markers stay full-opacity. Non-matching markers fade to `opacity: 0.28`. Set when the agent emits `map.show` (multi-slug) or `route.show`, or when the user clicks an inactive RouteCard in the chat.
- `activeRoute` + `activeRouteSig` — the structured route currently drawn on the map. `sig` is a UUID minted in `useAgentChat` when each `route.show` event arrives, so multiple RouteCards in the same conversation can be told apart and individually re-activated.
- `travelMode: 'DRIVING' | 'WALKING' | 'BICYCLING' | 'TRANSIT'` — sent to the agent on every turn AND to `RouteOverlay` for Directions requests. Single source of truth, lives in App and is mirrored down through `ChatPanel` props.

`App` subscribes to `agentBus` (`src/agent/events.ts`) — the only channel between the chat hook and the rest of the UI. Three event types: `drawer.open`, `map.show`, `route.show`. The hook emits, App orchestrates state. We don't lift state up into a context because only App needs it; passing through props is shallower.

The "Снять выделение / Clear selection" chip under the category filters appears whenever `highlightedIds` or `activeRoute` is non-null, and reverts the map to the unfiltered marker view in one click. Selecting a marker via the drawer does NOT clear the highlight (a route should stay drawn while you read about its stops).

### Chat panel & timeline state

`useAgentChat({lang, travelMode, sessionId, onSessionCreated})` is the only hook that talks to `/api/agent/messages`. State shape is intentional:

```ts
type TimelineItem =
  | { kind: 'text'; value: string }
  | { kind: 'tool'; label: string; count: number }
  | { kind: 'cards'; items: CardItem[] }
  | { kind: 'route'; data: RouteCardData; sig: string };

interface AgentMessage {
  id; role; text; items: TimelineItem[]; isStreaming?
}
```

Every assistant turn is a *timeline of items in arrival order*, not separate buckets for text/cards/route. Critical reasons:

1. The model often interleaves tool calls and text — bucketing by type would put all cards at the bottom regardless of when they appeared.
2. Consecutive identical tool hints collapse: when the model calls `get_attraction_details` 7 times in a row we render one row with `×7`. Logic lives in the `tool` event handler — if `last item is tool with same label`, bump `count`; otherwise push a new item.
3. Card dedup is global per turn — a slug shown earlier in any `cards` item is filtered out of subsequent ones. Order of the *first* mention is preserved.

Markdown rendering for assistant text uses a homemade ~80-line parser (`src/agent/markdown.tsx`). Supports paragraphs, `#/##/###` headings, `---` rules, ordered/unordered lists, **bold**, *italic*, `code`. No HTML injection. Don't add `react-markdown` — we explicitly chose not to.

Replaying a stored session needs a different path: `rebuildAssistantTimeline(text, uiEvents)` reconstructs items from the persisted reply text + the `ui_events` JSON column. Tool hints are dropped (they were ephemeral progress indicators — re-showing them out of order would be misleading).

### Chat panel layout (mobile)

Bottom sheet with three snap points: `peek` (~9svh), `mid` (~62svh), `full` (~92svh). Drag handle at the top supports both tap-to-cycle and pointer drag (60-px threshold). On desktop (`md:`) it switches to a 440-px right drawer with full height — closed-state transform is responsive (`translate-y-full` on mobile, `translate-x-full` on desktop), pointer-events disabled when closed.

Heights use `svh`, not `dvh`, on iOS — Safari's URL bar transition makes `dvh` shrink with a delay and crops the composer. Don't change this without testing on a real iPhone.

The composer auto-grows to ~5 lines and pulls the sheet to `full` on focus. `visualViewport` API watches for keyboard appearance — when the viewport ratio drops below 0.8 we force `full`.

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

`MapView.RouteOverlay` runs the active route through `google.maps.DirectionsService` per day. The strategy stack:

1. **Whole-day request** with waypoints in non-transit modes (one API call per day).
2. **Pairwise** otherwise — each leg becomes its own request. Used when (1) fails or for `TRANSIT` (Google rejects waypoints in transit mode).
3. **Snap-to-road** on `ZERO_RESULTS`: `google.maps.Geocoder` reverse-geocodes the failing endpoint, preferring `street_address` → `route` → `premise` → `postal_code` → `locality`. Retry with the snapped point. Snap results are cached per-coordinate within a single overlay build to avoid re-asking for the same dam.
4. **Dashed fallback** as a last resort. The RouteCard surfaces a short explanation that some legs degraded.

If a snapped endpoint diverged from the original numbered pin by more than 50 m (typical for stops on dams or man-made islands), a short **dashed "last metres" tail** visually links the routed path back to the marker. This makes it honest: the line says "you can drive here, the rest of the way is on foot".

`RouteDirectionsContext` (`src/agent/routeDirections.tsx`) is the read/write surface for live timing data. `RouteOverlay` writes per-leg `{minutes, meters}` into it as Directions returns; `RouteCard` reads via `findLeg(legs, dayIdx, stopIdx)` and shows actual ETAs and distances next to each stop. When live data isn't available yet the card falls back to the haversine estimate emitted by `build_route` (with a leading `≈`).

For TRANSIT we use `transitOptions.departureTime = tomorrow 09:00` — better schedule matches than "right now" if the user is browsing late.

### RouteCard internals

Lives in `ChatPanel.tsx`. Per route:

- Travel-mode segmented control (Drive / Walk / Bike / Transit) — single source of truth in App state, change reaches every RouteCard via prop.
- Active vs inactive visual: active card has accent ring + "НА КАРТЕ / on map" pill; inactive cards have a "На карту / show map" button that calls `onActivateRoute(sig, data)` to reactivate that itinerary on the map.
- Each day header has a **Maps** deeplink — formatted as `https://www.google.com/maps/dir/?api=1&origin=…&destination=…&waypoints=…|…&travelmode=driving`. Capped at 9 waypoints (Google's free-tier URL limit). Travel mode follows the segmented control.
- Each stop button goes through `onSelectStop(slug)` → opens the drawer for that place; the active route stays highlighted.

### Auth

- `/api/auth/google` → 302 to Google with a state nonce in an HTTP-only cookie.
- `/api/auth/google/callback` → exchanges the code, verifies the `id_token` against Google's JWKs (`jose.createRemoteJWKSet`), upserts the user by `google_sub`, signs an HS256 session JWT, sets `nl_session` HTTP-only cookie, redirects back to `return_to`.
- `/api/auth/me` → 401 or `{user}`.

The frontend reads no JWT directly — `apiFetch` always sends `credentials: 'include'`.

⚠️ **Docker IPv6 footgun**: the api container forces IPv4 (`NODE_OPTIONS=--dns-result-order=ipv4first` + `setGlobalDispatcher(new Agent({ connect: { family: 4 } }))` in `api/src/index.ts`). Without this, `fetch('https://oauth2.googleapis.com/token')` stalls with `ETIMEDOUT` because the docker bridge has no IPv6 route but undici's Happy Eyeballs prefers AAAA. Don't remove these lines.

### Sessions UI

`SessionsOverlay` in `ChatPanel` slides in over the chat body (`absolute inset-0`) — list of past chats newest-first, each with the first user prompt as preview, hover-to-reveal delete button.

Lifecycle:
- "New chat" button → `setSessionId(null)` + `chat.reset()`. The next `send()` creates a server-side session in `POST /api/agent/messages` (sessionId is omitted in the body) and the SSE `start` event echoes back `{ sessionId, sessionFresh: true }`. The hook calls `onSessionCreated(id)` so `ChatPanel.setSessionId(id)` happens, and `refreshSessions()` re-pulls the list.
- Picking an old session → `setSessionId(id)`. `useEffect on sessionId` fetches `/api/chat/sessions/:id`, calls `rebuildAssistantTimeline(text, uiEvents)` for each assistant message, and **re-emits the latest `route.show` on the bus** so the map snaps back to whatever this conversation last looked like. Without that re-emit, switching sessions would leave a stale or empty map.
- Delete → cascade-deletes messages on the server (FK `ON DELETE CASCADE`), then if the deleted session was active we drop chat state.

There's a race-fix that's **load-bearing**: `useEffect on sessionId` keeps `internalSidRef.current` in sync with the hook's own state.sessionId, and skips the network round-trip when the prop simply echoes a session id we just minted ourselves during a streaming send. Without this guard, the `onSessionCreated → setSessionId(prop) → useEffect` chain hits the API while the stream is still writing, gets the half-saved DB state (only the user message), and clobbers the in-flight assistant reply with empty timeline.

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
