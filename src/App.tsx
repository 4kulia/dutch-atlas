import { useCallback, useEffect, useMemo, useState } from 'react';
import { Header } from './components/Header';
import { CategoryFilter } from './components/CategoryFilter';
import { MapView } from './components/MapView';
import { AttractionDrawer } from './components/AttractionDrawer';
import { MyPlacesPanel } from './components/MyPlacesPanel';
import { ChatPanel } from './components/ChatPanel';
import { useAttractions } from './data/AttractionsProvider';
import { CATEGORIES, type Category } from './types';
import { useFavorites } from './auth/useFavorites';
import { useVisits } from './auth/useVisits';
import { agentBus, type RouteDay } from './agent/events';
import { DEFAULT_TRAVEL_MODE, type TravelMode } from './agent/travelMode';
import { useLang } from './i18n/LanguageProvider';

function readInitialId(): string | null {
  if (typeof window === 'undefined') return null;
  return new URL(window.location.href).searchParams.get('id');
}

function syncIdToUrl(id: string | null) {
  if (typeof window === 'undefined') return;
  const url = new URL(window.location.href);
  if (id) url.searchParams.set('id', id);
  else url.searchParams.delete('id');
  window.history.replaceState(null, '', url.toString());
}

const CLEAR_FOCUS_LABEL = { ru: 'Снять выделение', en: 'Clear selection' } as const;

export default function App() {
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY ?? '';
  const { lang } = useLang();

  const [selectedId, setSelectedId] = useState<string | null>(() => readInitialId());
  const [active, setActive] = useState<Set<Category>>(() => new Set(CATEGORIES));
  // Tag filter. Empty set = no tag filter (all places pass). Multiple
  // active tags = OR semantics (a place matches if it has ANY of them).
  const [activeTags, setActiveTags] = useState<Set<string>>(() => new Set());
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [myPlacesOpen, setMyPlacesOpen] = useState(false);
  const [myPlacesRefreshKey, setMyPlacesRefreshKey] = useState(0);
  const [chatOpen, setChatOpen] = useState(false);
  const [highlightedIds, setHighlightedIds] = useState<Set<string> | null>(null);
  const [activeRoute, setActiveRoute] = useState<{ title?: string; days: RouteDay[] } | null>(null);
  const [activeRouteSig, setActiveRouteSig] = useState<string | null>(null);
  const [travelMode, setTravelMode] = useState<TravelMode>(DEFAULT_TRAVEL_MODE);
  const [hideVisited, setHideVisited] = useState(false);
  // Map picking mode (driven by the agent's pick_location_on_map tool).
  const [picking, setPicking] = useState<{ active: boolean; prompt?: string } | null>(null);
  // Injections from App into the chat composer. `composerPrefill` writes
  // text into the textarea (FAB "I'm here"). `autoSend` calls chat.send
  // immediately (after the user picks a point).
  const [composerPrefill, setComposerPrefill] = useState<{ id: string; text: string } | null>(null);
  const [autoSend, setAutoSend] = useState<{ id: string; text: string } | null>(null);
  const { ids: favoriteIds, toggle: toggleFavorite } = useFavorites();
  const { ids: visitedIds, toggle: toggleVisited } = useVisits();
  const { attractions, byId, countByCategory: counts, refresh: refreshAttractions } = useAttractions();

  useEffect(() => {
    syncIdToUrl(selectedId);
  }, [selectedId]);

  const visibleAttractions = useMemo(() => {
    let result = attractions.filter((a) => active.has(a.category));
    if (activeTags.size > 0) {
      result = result.filter((a) => a.tags?.some((t) => activeTags.has(t)) ?? false);
    }
    if (favoritesOnly) result = result.filter((a) => favoriteIds.has(a.id));
    if (hideVisited) result = result.filter((a) => !visitedIds.has(a.id));
    return result;
  }, [attractions, active, activeTags, favoritesOnly, favoriteIds, hideVisited, visitedIds]);

  const toggleCategory = useCallback((c: Category) => {
    setActive((prev) => {
      // If everything is on → solo this category.
      if (prev.size === CATEGORIES.length) {
        return new Set([c]);
      }
      // If this is the only active one → restore all (acts as "show all").
      if (prev.size === 1 && prev.has(c)) {
        return new Set(CATEGORIES);
      }
      const next = new Set(prev);
      if (next.has(c)) next.delete(c);
      else next.add(c);
      // Don't allow ending up with zero — fall back to all-on.
      if (next.size === 0) return new Set(CATEGORIES);
      return next;
    });
  }, []);

  const onAll = useCallback(() => {
    setActive(new Set(CATEGORIES));
    setActiveTags(new Set());
    setFavoritesOnly(false);
    setHideVisited(false);
  }, []);
  const toggleTag = useCallback((tag: string) => {
    setActiveTags((prev) => {
      const next = new Set(prev);
      if (next.has(tag)) next.delete(tag);
      else next.add(tag);
      return next;
    });
  }, []);
  const onSelect = useCallback((id: string | null) => {
    setSelectedId(id);
    if (id) setMyPlacesOpen(false);
  }, []);
  const onClose = useCallback(() => setSelectedId(null), []);
  const onToggleFavoritesOnly = useCallback(() => setFavoritesOnly((v) => !v), []);
  const onOpenMyPlaces = useCallback(() => {
    setMyPlacesRefreshKey((k) => k + 1);
    setMyPlacesOpen(true);
  }, []);
  const onCloseMyPlaces = useCallback(() => setMyPlacesOpen(false), []);
  const onOpenChat = useCallback(() => setChatOpen(true), []);
  const onCloseChat = useCallback(() => setChatOpen(false), []);
  const selected = selectedId ? byId.get(selectedId) ?? null : null;

  // Wire the agent's UI events into the existing map+drawer state.
  useEffect(() => {
    return agentBus.subscribe((event) => {
      if (event.type === 'drawer.open') {
        setSelectedId(event.slug);
        setMyPlacesOpen(false);
      } else if (event.type === 'map.show') {
        if (event.slugs.length === 1) {
          // Single pick → open it directly; the existing pan/zoom flow runs.
          setSelectedId(event.slugs[0] ?? null);
          setHighlightedIds(null);
          setActiveRoute(null);
        } else if (event.slugs.length > 1) {
          // Multi-slug → highlight and let the map fit them in view.
          setHighlightedIds(new Set(event.slugs));
          setActiveRoute(null);
          setSelectedId(null);
        }
      } else if (event.type === 'route.show') {
        setActiveRoute({ title: event.title, days: event.days });
        setActiveRouteSig(event.sig ?? null);
        const slugs = event.days.flatMap((d) => d.stops.map((s) => s.slug));
        setHighlightedIds(new Set(slugs));
        setSelectedId(null);
      } else if (event.type === 'map.pickPoint') {
        // Agent asked the user to drop a pin. Hide the chat sheet so the
        // map is visible, then enter picking mode.
        setPicking({ active: true, prompt: event.prompt });
        setChatOpen(false);
      } else if (event.type === 'draft.saved') {
        // A new user-submitted place was persisted — refresh the catalogue
        // so the marker shows up.
        refreshAttractions();
      }
    });
  }, [refreshAttractions]);

  const onPicked = useCallback((c: { lat: number; lng: number; accuracyM?: number }) => {
    setPicking(null);
    setChatOpen(true);
    const accuracy = c.accuracyM != null ? `, accuracy=${Math.round(c.accuracyM)}m` : '';
    setAutoSend({
      id: crypto.randomUUID(),
      text: `[picked_lat=${c.lat.toFixed(6)}, picked_lng=${c.lng.toFixed(6)}${accuracy}] ${
        lang === 'ru' ? 'вот точка' : 'here is the point'
      }`,
    });
  }, [lang]);

  const onPickCancel = useCallback(() => {
    setPicking(null);
    setChatOpen(true);
  }, []);

  // FAB: "I'm here" — grab GPS, open chat, prefill the composer with the
  // coordinates so the agent has everything it needs to start.
  const onUseMyLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setChatOpen(true);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;
        const accuracyTxt = accuracy != null ? `, accuracy=${Math.round(accuracy)}m` : '';
        setComposerPrefill({
          id: crypto.randomUUID(),
          text: `[gps_lat=${latitude.toFixed(6)}, gps_lng=${longitude.toFixed(6)}${accuracyTxt}] ${
            lang === 'ru'
              ? 'добавь это место — прикреплю фото и опишу.'
              : 'add this place — I\'ll attach a photo and describe it.'
          }`,
        });
        setChatOpen(true);
      },
      (err) => {
        console.warn('[fab] geolocation failed', err);
        setComposerPrefill({
          id: crypto.randomUUID(),
          text: lang === 'ru'
            ? 'добавь новое место — нужна точка на карте.'
            : 'add a new place — pick a point on the map.',
        });
        setChatOpen(true);
      },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 30_000 },
    );
  }, [lang]);

  // We deliberately do NOT clear highlightedIds when selectedId changes —
  // a route should stay highlighted while the user opens individual stops
  // from the RouteCard. The highlight clears only when the agent emits a
  // new map.show / route.show, or when the user activates a different
  // RouteCard from the chat.

  // Activate a different route on the map (called when the user clicks an
  // older RouteCard in the chat).
  const onActivateRoute = useCallback(
    (sig: string, data: { title?: string; days: RouteDay[] }) => {
      setActiveRoute(data);
      setActiveRouteSig(sig);
      setHighlightedIds(new Set(data.days.flatMap((d) => d.stops.map((s) => s.slug))));
      setSelectedId(null);
    },
    [],
  );

  // Drop the active highlight + route from the map, going back to the
  // unfiltered marker view. Only renders the chip when something is on.
  const hasMapFocus = activeRoute !== null || (highlightedIds !== null && highlightedIds.size > 0);
  const onClearMapFocus = useCallback(() => {
    setActiveRoute(null);
    setActiveRouteSig(null);
    setHighlightedIds(null);
  }, []);
  const handleToggleFavorite = useCallback(() => {
    if (selectedId) toggleFavorite(selectedId);
  }, [selectedId, toggleFavorite]);
  const handleToggleVisited = useCallback(() => {
    if (selectedId) toggleVisited(selectedId);
  }, [selectedId, toggleVisited]);

  return (
    <div className="relative h-[100dvh] w-full overflow-hidden bg-ink-950">
      <MapView
        apiKey={apiKey}
        selectedId={selectedId}
        onSelect={onSelect}
        activeCategories={active}
        attractions={visibleAttractions}
        highlightedIds={highlightedIds}
        visitedIds={visitedIds}
        route={activeRoute}
        travelMode={travelMode}
        picking={picking}
        onPicked={onPicked}
        onPickCancel={onPickCancel}
      />
      <Header
        onSelectAttraction={onSelect}
        onOpenMyPlaces={onOpenMyPlaces}
        onOpenChat={onOpenChat}
      />
      <div
        className="pointer-events-none absolute inset-x-0 z-20"
        style={{ top: 'calc(env(safe-area-inset-top) + 60px)' }}
      >
        <div className="pointer-events-auto mx-auto max-w-[1600px]">
          <CategoryFilter
            active={active}
            counts={counts}
            onToggle={toggleCategory}
            onAll={onAll}
            activeTags={activeTags}
            onToggleTag={toggleTag}
            favoritesOnly={favoritesOnly}
            onToggleFavoritesOnly={onToggleFavoritesOnly}
            favoritesCount={favoriteIds.size}
            hideVisited={hideVisited}
            onToggleHideVisited={() => setHideVisited((v) => !v)}
            visitedCount={visitedIds.size}
          />
        </div>
        {hasMapFocus && (
          <div className="pointer-events-auto mt-2 flex justify-center">
            <button
              type="button"
              onClick={onClearMapFocus}
              className="inline-flex items-center gap-1.5 rounded-full border border-accent/40 bg-ink-900/85 px-3 py-1.5 text-[12px] font-medium text-ink-100 backdrop-blur-md transition-colors hover:border-accent/70"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path
                  d="M6 6l12 12M18 6L6 18"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
              {CLEAR_FOCUS_LABEL[lang]}
            </button>
          </div>
        )}
      </div>
      <AttractionDrawer
        attraction={selected}
        onClose={onClose}
        isFavorite={selectedId ? favoriteIds.has(selectedId) : false}
        onToggleFavorite={handleToggleFavorite}
        isVisited={selectedId ? visitedIds.has(selectedId) : false}
        onToggleVisited={handleToggleVisited}
        activeTags={activeTags}
        onToggleTag={toggleTag}
      />
      <MyPlacesPanel
        open={myPlacesOpen}
        refreshKey={myPlacesRefreshKey}
        onClose={onCloseMyPlaces}
        onSelect={onSelect}
      />
      <ChatPanel
        open={chatOpen}
        onClose={onCloseChat}
        onSelectAttraction={onSelect}
        travelMode={travelMode}
        onTravelModeChange={setTravelMode}
        activeRouteSig={activeRouteSig}
        onActivateRoute={onActivateRoute}
        composerPrefill={composerPrefill}
        autoSend={autoSend}
      />
      {!picking?.active && !chatOpen && (
        <button
          type="button"
          onClick={onUseMyLocation}
          title={lang === 'ru' ? 'Я здесь — добавить место' : 'I\'m here — add a place'}
          aria-label={lang === 'ru' ? 'Я здесь — добавить место' : 'I\'m here — add a place'}
          className="fixed z-30 right-4 grid h-12 w-12 place-items-center rounded-full border border-ink-700/60 bg-ink-900/90 text-ink-100 shadow-lg backdrop-blur-md transition-colors hover:border-accent/55 hover:text-accent"
          style={{ bottom: 'calc(env(safe-area-inset-bottom) + 96px)' }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path
              d="M12 21s7-7 7-12a7 7 0 10-14 0c0 5 7 12 7 12z"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinejoin="round"
            />
            <circle cx="12" cy="9" r="2.5" stroke="currentColor" strokeWidth="1.6" />
            <path d="M12 9v.01" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
          </svg>
        </button>
      )}
    </div>
  );
}
