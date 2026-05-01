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
import { agentBus, type RouteDay } from './agent/events';
import { DEFAULT_TRAVEL_MODE, type TravelMode } from './agent/travelMode';

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

export default function App() {
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY ?? '';

  const [selectedId, setSelectedId] = useState<string | null>(() => readInitialId());
  const [active, setActive] = useState<Set<Category>>(() => new Set(CATEGORIES));
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [myPlacesOpen, setMyPlacesOpen] = useState(false);
  const [myPlacesRefreshKey, setMyPlacesRefreshKey] = useState(0);
  const [chatOpen, setChatOpen] = useState(false);
  const [highlightedIds, setHighlightedIds] = useState<Set<string> | null>(null);
  const [activeRoute, setActiveRoute] = useState<{ title?: string; days: RouteDay[] } | null>(null);
  const [activeRouteSig, setActiveRouteSig] = useState<string | null>(null);
  const [travelMode, setTravelMode] = useState<TravelMode>(DEFAULT_TRAVEL_MODE);
  const { ids: favoriteIds, toggle: toggleFavorite } = useFavorites();
  const { attractions, byId, countByCategory: counts } = useAttractions();

  useEffect(() => {
    syncIdToUrl(selectedId);
  }, [selectedId]);

  const visibleAttractions = useMemo(() => {
    let result = attractions.filter((a) => active.has(a.category));
    if (favoritesOnly) result = result.filter((a) => favoriteIds.has(a.id));
    return result;
  }, [attractions, active, favoritesOnly, favoriteIds]);

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
    setFavoritesOnly(false);
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
      }
    });
  }, []);

  // Clear the map's highlight/route overlay when the user picks a marker
  // directly — they're done with the agent's pre-built focus.
  useEffect(() => {
    if (selectedId) {
      setHighlightedIds(null);
    }
  }, [selectedId]);

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
  const handleToggleFavorite = useCallback(() => {
    if (selectedId) toggleFavorite(selectedId);
  }, [selectedId, toggleFavorite]);

  return (
    <div className="relative h-[100dvh] w-full overflow-hidden bg-ink-950">
      <MapView
        apiKey={apiKey}
        selectedId={selectedId}
        onSelect={onSelect}
        activeCategories={active}
        attractions={visibleAttractions}
        highlightedIds={highlightedIds}
        route={activeRoute}
        travelMode={travelMode}
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
            favoritesOnly={favoritesOnly}
            onToggleFavoritesOnly={onToggleFavoritesOnly}
            favoritesCount={favoriteIds.size}
          />
        </div>
      </div>
      <AttractionDrawer
        attraction={selected}
        onClose={onClose}
        isFavorite={selectedId ? favoriteIds.has(selectedId) : false}
        onToggleFavorite={handleToggleFavorite}
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
      />
    </div>
  );
}
