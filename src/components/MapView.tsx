import {
  APIProvider,
  AdvancedMarker,
  Map as GMap,
  useAdvancedMarkerRef,
  useMap,
} from '@vis.gl/react-google-maps';
import { MarkerClusterer, type Marker } from '@googlemaps/markerclusterer';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAttractions } from '../data/AttractionsProvider';
import type { Attraction, Category } from '../types';
import { MarkerIcon } from './MarkerIcon';
import { useLang } from '../i18n/LanguageProvider';
import { UI } from '../i18n/strings';
import type { RouteDay } from '../agent/events';
import { useRouteDirections, type RouteLeg } from '../agent/routeDirections';
import type { TravelMode } from '../agent/travelMode';

const NETHERLANDS_CENTER = { lat: 52.1, lng: 5.3 };
const CARIBBEAN_CENTER = { lat: 14.5, lng: -67.5 };

const MAP_ID = import.meta.env.VITE_GOOGLE_MAPS_MAP_ID || 'NL_ATTRACTIONS_MAP';

interface Props {
  apiKey: string;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  activeCategories: Set<Category>;
  attractions?: Attraction[];
  highlightedIds?: Set<string> | null;
  route?: { title?: string; days: RouteDay[] } | null;
  travelMode?: TravelMode;
}

export function MapView({
  apiKey,
  selectedId,
  onSelect,
  activeCategories,
  attractions,
  highlightedIds,
  route,
  travelMode,
}: Props) {
  const { lang } = useLang();
  const { attractions: allAttractions } = useAttractions();
  const visible = useMemo(
    () => attractions ?? allAttractions.filter((a) => activeCategories.has(a.category)),
    [activeCategories, attractions, allAttractions],
  );

  const onlyCaribbean = useMemo(() => {
    if (visible.length === 0) return false;
    return visible.every((a) => a.category === 'caribbean');
  }, [visible]);

  if (!apiKey) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-ink-950 px-6 text-center text-ink-300">
        <p>{UI.api_key_missing[lang]}</p>
      </div>
    );
  }

  return (
    <APIProvider apiKey={apiKey} libraries={['marker']}>
      <GMap
        defaultCenter={NETHERLANDS_CENTER}
        defaultZoom={7}
        mapId={MAP_ID}
        gestureHandling="greedy"
        disableDefaultUI={false}
        clickableIcons={false}
        fullscreenControl={false}
        mapTypeControl={false}
        streetViewControl={false}
        zoomControl
        className="h-full w-full"
      >
        <MapBody
          visible={visible}
          selectedId={selectedId}
          onSelect={onSelect}
          highlightedIds={highlightedIds ?? null}
          route={route ?? null}
          travelMode={travelMode ?? 'DRIVING'}
          flyTo={onlyCaribbean ? CARIBBEAN_CENTER : NETHERLANDS_CENTER}
          flyZoom={onlyCaribbean ? 6 : 7}
          flyKey={onlyCaribbean ? 'carib' : 'nl'}
        />
      </GMap>
    </APIProvider>
  );
}

interface BodyProps {
  visible: Attraction[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  highlightedIds: Set<string> | null;
  route: { title?: string; days: RouteDay[] } | null;
  travelMode: TravelMode;
  flyTo: google.maps.LatLngLiteral;
  flyZoom: number;
  flyKey: string;
}

function MapBody({
  visible,
  selectedId,
  onSelect,
  highlightedIds,
  route,
  travelMode,
  flyTo,
  flyZoom,
  flyKey,
}: BodyProps) {
  const map = useMap();
  const { byId } = useAttractions();

  useEffect(() => {
    if (!map) return;
    map.panTo(flyTo);
    map.setZoom(flyZoom);
  }, [map, flyKey, flyTo, flyZoom]);

  // When a marker is selected, pan to it and ensure zoom is high enough that
  // it sits outside any cluster — otherwise the user can't see what they
  // picked.
  useEffect(() => {
    if (!map || !selectedId) return;
    const a = byId.get(selectedId);
    if (!a) return;
    const currentZoom = map.getZoom() ?? 7;
    const targetZoom = Math.max(currentZoom, 10);
    map.panTo(a.coordinates);
    if (targetZoom !== currentZoom) {
      window.setTimeout(() => map.setZoom(targetZoom), 220);
    }
  }, [map, selectedId, byId]);

  // When the agent highlights a set of places (search shortlist or route),
  // fit them all in the viewport with some padding so the user immediately
  // sees the answer without panning.
  useEffect(() => {
    if (!map) return;
    const slugs = highlightedIds && highlightedIds.size > 0
      ? Array.from(highlightedIds)
      : route
        ? route.days.flatMap((d) => d.stops.map((s) => s.slug))
        : null;
    if (!slugs || slugs.length === 0) return;
    const bounds = new google.maps.LatLngBounds();
    let hits = 0;
    for (const s of slugs) {
      const a = byId.get(s);
      if (!a) continue;
      bounds.extend(a.coordinates);
      hits += 1;
    }
    if (hits === 0) return;
    if (hits === 1) {
      // fitBounds with one point would zoom to max; pan + reasonable zoom instead.
      map.panTo(bounds.getCenter());
      const z = map.getZoom() ?? 7;
      if (z < 10) map.setZoom(10);
    } else {
      map.fitBounds(bounds, { top: 80, right: 80, bottom: 80, left: 80 });
    }
  }, [map, highlightedIds, route, byId]);

  return (
    <>
      <ClusteredMarkers
        visible={visible}
        selectedId={selectedId}
        onSelect={onSelect}
        highlightedIds={highlightedIds}
        // When a route is active, hide the regular markers for its stops —
        // the numbered overlay represents them instead.
        suppressedIds={routeStopIds(route)}
      />
      {route && (
        <RouteOverlay
          route={route}
          byId={byId}
          onSelect={onSelect}
          travelMode={travelMode}
        />
      )}
    </>
  );
}

function routeStopIds(route: { days: RouteDay[] } | null): Set<string> | null {
  if (!route) return null;
  return new Set(route.days.flatMap((d) => d.stops.map((s) => s.slug)));
}

interface ClusterProps {
  visible: Attraction[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  highlightedIds: Set<string> | null;
  suppressedIds: Set<string> | null;
}

function ClusteredMarkers({ visible, selectedId, onSelect, highlightedIds, suppressedIds }: ClusterProps) {
  const map = useMap();
  const [markers, setMarkers] = useState<Record<string, Marker>>({});

  const clusterer = useMemo(() => {
    if (!map) return null;
    return new MarkerClusterer({ map });
  }, [map]);

  useEffect(() => {
    if (!clusterer) return;
    clusterer.clearMarkers();
    const toAdd = Object.values(markers);
    if (toAdd.length > 0) clusterer.addMarkers(toAdd);
  }, [clusterer, markers]);

  const renderable = useMemo(
    () => (suppressedIds ? visible.filter((a) => !suppressedIds.has(a.id)) : visible),
    [visible, suppressedIds],
  );
  const visibleIds = useMemo(() => new Set(renderable.map((a) => a.id)), [renderable]);

  // Drop registered markers that are no longer visible (filtered out).
  useEffect(() => {
    setMarkers((prev) => {
      let changed = false;
      const next: Record<string, Marker> = {};
      for (const [id, m] of Object.entries(prev)) {
        if (visibleIds.has(id)) next[id] = m;
        else changed = true;
      }
      return changed ? next : prev;
    });
  }, [visibleIds]);

  const updateMarker = useCallback((id: string, marker: Marker | null) => {
    setMarkers((prev) => {
      if (marker) {
        if (prev[id] === marker) return prev;
        return { ...prev, [id]: marker };
      }
      if (!prev[id]) return prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }, []);

  return (
    <>
      {renderable.map((a) => (
        <AttractionMarker
          key={a.id}
          attraction={a}
          selected={selectedId === a.id}
          dimmed={highlightedIds ? !highlightedIds.has(a.id) : false}
          updateMarker={updateMarker}
          onClick={() => onSelect(a.id)}
        />
      ))}
    </>
  );
}

interface MarkerProps {
  attraction: Attraction;
  selected: boolean;
  dimmed: boolean;
  updateMarker: (id: string, marker: Marker | null) => void;
  onClick: () => void;
}

function AttractionMarker({ attraction, selected, dimmed, updateMarker, onClick }: MarkerProps) {
  const [markerRef, marker] = useAdvancedMarkerRef();
  const id = attraction.id;

  useEffect(() => {
    updateMarker(id, marker);
    return () => updateMarker(id, null);
  }, [id, marker, updateMarker]);

  return (
    <AdvancedMarker
      ref={markerRef}
      position={attraction.coordinates}
      onClick={onClick}
      title={attraction.name.ru}
    >
      <div style={{ opacity: dimmed ? 0.28 : 1, transition: 'opacity 200ms ease' }}>
        <MarkerIcon category={attraction.category} selected={selected} />
      </div>
    </AdvancedMarker>
  );
}

// ── Route overlay ──────────────────────────────────────────────────────
// Numbered markers + a polyline connecting them. We use the Google Maps
// Polyline directly (not a wrapper) since @vis.gl/react-google-maps
// doesn't ship a Polyline component yet for the v3 API.

interface RouteOverlayProps {
  route: { title?: string; days: RouteDay[] };
  byId: ReadonlyMap<string, Attraction>;
  onSelect: (id: string | null) => void;
  travelMode: TravelMode;
}

const DAY_COLORS = ['#ff6a3d', '#0ea5e9', '#a855f7', '#10b981', '#f59e0b'];

function RouteOverlay({ route, byId, onSelect, travelMode }: RouteOverlayProps) {
  const map = useMap();
  const directions = useRouteDirections();

  // Build the actual route polyline via google.maps.DirectionsService — same
  // engine Google Maps uses, so the line follows real roads/transit/bike lanes.
  // We render our own polyline (not DirectionsRenderer) so we can colour it
  // per day and keep our existing numbered pins. Falls back to a straight
  // dashed line between stops when DirectionsService refuses (e.g. transit
  // unavailable for a leg).
  useEffect(() => {
    if (!map || !route) return;
    if (typeof google === 'undefined' || !google.maps?.DirectionsService) return;

    let cancelled = false;
    const overlays: google.maps.Polyline[] = [];

    directions.setLoading(true);
    directions.setError(null);

    const service = new google.maps.DirectionsService();
    const collectedLegs: RouteLeg[] = [];

    async function buildDay(day: RouteDay, dayIdx: number) {
      const stops = day.stops
        .map((s) => ({ slug: s.slug, coords: byId.get(s.slug)?.coordinates }))
        .filter((s): s is { slug: string; coords: google.maps.LatLngLiteral } => !!s.coords);
      if (stops.length < 2) return;
      const origin = stops[0]!.coords;
      const destination = stops[stops.length - 1]!.coords;
      const waypoints = stops.slice(1, -1).map((s) => ({ location: s.coords, stopover: true }));
      const color = DAY_COLORS[dayIdx % DAY_COLORS.length] ?? '#ff6a3d';

      // For TRANSIT we can't pass intermediate waypoints — Google rejects them.
      // Build the day in pairwise legs in that case.
      const requests = travelMode === 'TRANSIT'
        ? stops.slice(1).map((to, i) => ({
            origin: stops[i]!.coords,
            destination: to.coords,
            mode: travelMode,
            stopIdx: i + 1,
          }))
        : [{
            origin,
            destination,
            waypoints,
            mode: travelMode,
            stopIdx: -1, // single multi-leg request
          }];

      for (const req of requests) {
        const params: google.maps.DirectionsRequest = {
          origin: req.origin,
          destination: req.destination,
          travelMode: googleTravelMode(req.mode),
          ...(req.stopIdx === -1 && 'waypoints' in req && req.waypoints?.length
            ? { waypoints: req.waypoints }
            : {}),
          ...(req.mode === 'TRANSIT'
            ? { transitOptions: { departureTime: nextMorning() } }
            : {}),
        };

        try {
          const result = await service.route(params);
          if (cancelled) return;

          // Build a polyline from the path of every leg's overview coordinates.
          const path: google.maps.LatLngLiteral[] = [];
          const legs = result.routes[0]?.legs ?? [];
          legs.forEach((leg, legIdx) => {
            if (leg.steps) {
              for (const step of leg.steps) {
                if (step.path) for (const p of step.path) path.push({ lat: p.lat(), lng: p.lng() });
              }
            }
            const minutes = Math.round((leg.duration?.value ?? 0) / 60);
            const meters = leg.distance?.value ?? 0;
            const stopIdx = req.stopIdx === -1 ? legIdx + 1 : req.stopIdx;
            collectedLegs.push({ dayIdx, stopIdx, minutes, meters });
          });

          if (path.length >= 2) {
            const line = new google.maps.Polyline({
              path,
              strokeColor: color,
              strokeOpacity: travelMode === 'WALKING' || travelMode === 'BICYCLING' ? 0 : 0.85,
              strokeWeight: 4,
              icons:
                travelMode === 'WALKING' || travelMode === 'BICYCLING'
                  ? [
                      {
                        icon: {
                          path: 'M 0,-1 0,1',
                          strokeOpacity: 1,
                          strokeColor: color,
                          strokeWeight: 3,
                          scale: 3,
                        },
                        offset: '0',
                        repeat: '12px',
                      },
                    ]
                  : undefined,
              map,
            });
            overlays.push(line);
          }
        } catch (err) {
          // Directions failed for this leg — drop a straight dashed fallback.
          console.warn('[directions] leg failed', err);
          const fallback = new google.maps.Polyline({
            path: [req.origin, req.destination],
            strokeColor: color,
            strokeOpacity: 0,
            icons: [
              {
                icon: { path: 'M 0,-1 0,1', strokeOpacity: 1, strokeColor: color, strokeWeight: 3, scale: 3 },
                offset: '0',
                repeat: '14px',
              },
            ],
            map,
          });
          overlays.push(fallback);
          if (!cancelled) directions.setError(humanizeDirectionsError(err));
        }
      }
    }

    (async () => {
      try {
        for (let i = 0; i < route.days.length; i++) {
          if (cancelled) return;
          await buildDay(route.days[i]!, i);
        }
      } finally {
        if (!cancelled) {
          directions.setLegs(collectedLegs);
          directions.setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
      for (const l of overlays) l.setMap(null);
    };
    // We intentionally exclude `directions` from deps — its setters are stable
    // and including the whole context value would re-fire on every leg update.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, route, byId, travelMode]);

  let counter = 0;
  return (
    <>
      {route.days.flatMap((day, dayIdx) =>
        day.stops.map((stop) => {
          const a = byId.get(stop.slug);
          if (!a) return null;
          const n = ++counter;
          const color = DAY_COLORS[dayIdx % DAY_COLORS.length] ?? '#ff6a3d';
          return (
            <AdvancedMarker
              key={`route-${dayIdx}-${stop.slug}`}
              position={a.coordinates}
              title={`${n}. ${a.name.ru}`}
              onClick={() => onSelect(stop.slug)}
            >
              <NumberedPin n={n} color={color} />
            </AdvancedMarker>
          );
        }),
      )}
    </>
  );
}

function googleTravelMode(mode: TravelMode): google.maps.TravelMode {
  switch (mode) {
    case 'WALKING':
      return google.maps.TravelMode.WALKING;
    case 'BICYCLING':
      return google.maps.TravelMode.BICYCLING;
    case 'TRANSIT':
      return google.maps.TravelMode.TRANSIT;
    default:
      return google.maps.TravelMode.DRIVING;
  }
}

function nextMorning(): Date {
  // Use tomorrow at 09:00 local — better transit matches than "right now"
  // (and avoids midnight schedule gaps when the user is browsing late).
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(9, 0, 0, 0);
  return d;
}

function humanizeDirectionsError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (/ZERO_RESULTS/i.test(msg)) return 'Маршрут не найден для выбранного транспорта.';
  if (/OVER_QUERY_LIMIT/i.test(msg)) return 'Слишком много запросов к Directions, попробуйте позже.';
  if (/NOT_FOUND/i.test(msg)) return 'Не удалось найти точку маршрута.';
  return 'Не удалось построить маршрут — показан прямой пунктир.';
}

function NumberedPin({ n, color }: { n: number; color: string }) {
  return (
    <div
      style={{
        width: 32,
        height: 32,
        borderRadius: 999,
        background: color,
        boxShadow: '0 2px 8px rgba(0,0,0,0.35), 0 0 0 3px rgba(255,255,255,0.85)',
        color: '#0b0f17',
        fontWeight: 700,
        fontSize: 14,
        display: 'grid',
        placeItems: 'center',
        fontVariantNumeric: 'tabular-nums',
        cursor: 'pointer',
      }}
    >
      {n}
    </div>
  );
}
