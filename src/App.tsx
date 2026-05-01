import { useCallback, useEffect, useMemo, useState } from 'react';
import { Header } from './components/Header';
import { CategoryFilter } from './components/CategoryFilter';
import { MapView } from './components/MapView';
import { AttractionDrawer } from './components/AttractionDrawer';
import { MyPlacesPanel } from './components/MyPlacesPanel';
import { ATTRACTIONS, ATTRACTIONS_BY_ID, countByCategory } from './data/attractions';
import { CATEGORIES, type Category } from './types';
import { useFavorites } from './auth/useFavorites';

function readInitialId(): string | null {
  if (typeof window === 'undefined') return null;
  const id = new URL(window.location.href).searchParams.get('id');
  return id && ATTRACTIONS_BY_ID.has(id) ? id : null;
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
  const { ids: favoriteIds, toggle: toggleFavorite } = useFavorites();

  useEffect(() => {
    syncIdToUrl(selectedId);
  }, [selectedId]);

  const counts = useMemo(() => countByCategory(), []);

  const visibleAttractions = useMemo(() => {
    let result = ATTRACTIONS.filter((a) => active.has(a.category));
    if (favoritesOnly) result = result.filter((a) => favoriteIds.has(a.id));
    return result;
  }, [active, favoritesOnly, favoriteIds]);

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
  const selected = selectedId ? ATTRACTIONS_BY_ID.get(selectedId) ?? null : null;
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
      />
      <Header onSelectAttraction={onSelect} onOpenMyPlaces={onOpenMyPlaces} />
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
    </div>
  );
}
