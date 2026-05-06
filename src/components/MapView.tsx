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
  visitedIds?: ReadonlySet<string>;
  route?: { title?: string; days: RouteDay[] } | null;
  travelMode?: TravelMode;
  // Pin-drop mode: when active, the map centres a fixed pin and shows
  // Done / My-GPS / Cancel controls. The user pans the map under the pin
  // (Apple/Uber-style) and presses Done to commit the centre point.
  picking?: { active: boolean; prompt?: string } | null;
  onPicked?: (coords: { lat: number; lng: number; accuracyM?: number }) => void;
  onPickCancel?: () => void;
}

export function MapView({
  apiKey,
  selectedId,
  onSelect,
  activeCategories,
  attractions,
  highlightedIds,
  visitedIds,
  route,
  travelMode,
  picking,
  onPicked,
  onPickCancel,
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
    <div className="relative h-full w-full">
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
            visitedIds={visitedIds ?? null}
            route={route ?? null}
            travelMode={travelMode ?? 'DRIVING'}
            flyTo={onlyCaribbean ? CARIBBEAN_CENTER : NETHERLANDS_CENTER}
            flyZoom={onlyCaribbean ? 6 : 7}
            flyKey={onlyCaribbean ? 'carib' : 'nl'}
          />
          {picking?.active && (
            <PickPointOverlay
              prompt={picking.prompt}
              lang={lang}
              onCommit={(c) => onPicked?.(c)}
              onCancel={() => onPickCancel?.()}
            />
          )}
        </GMap>
      </APIProvider>
    </div>
  );
}

interface PickOverlayProps {
  prompt?: string;
  lang: 'ru' | 'en';
  onCommit: (c: { lat: number; lng: number; accuracyM?: number }) => void;
  onCancel: () => void;
}

// Pin sits at the visual centre of the map (absolute-positioned, NOT a marker)
// — the user pans the map under the pin to place it precisely. "My GPS" pans
// the map to the device location; "Done" commits the current map centre.
function PickPointOverlay({ prompt, lang, onCommit, onCancel }: PickOverlayProps) {
  const map = useMap();
  const [accuracyM, setAccuracyM] = useState<number | null>(null);
  const [gpsBusy, setGpsBusy] = useState(false);

  const useMyLocation = useCallback(() => {
    if (!map || !navigator.geolocation) return;
    setGpsBusy(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGpsBusy(false);
        setAccuracyM(pos.coords.accuracy);
        map.panTo({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        const z = map.getZoom() ?? 7;
        if (z < 16) map.setZoom(16);
      },
      (err) => {
        setGpsBusy(false);
        console.warn('[pick] geolocation denied/unavailable', err);
      },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 30_000 },
    );
  }, [map]);

  const commit = useCallback(() => {
    if (!map) return;
    const c = map.getCenter();
    if (!c) return;
    onCommit({
      lat: c.lat(),
      lng: c.lng(),
      ...(accuracyM != null ? { accuracyM } : {}),
    });
  }, [map, accuracyM, onCommit]);

  return (
    <>
      {/* Centred pin — pure CSS, doesn't move while the map pans. */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 z-30"
        style={{ transform: 'translate(-50%, -100%)' }}
      >
        <svg width="36" height="46" viewBox="0 0 36 46" fill="none">
          <path
            d="M18 2c8.84 0 16 6.93 16 15.47C34 28.5 18 44 18 44S2 28.5 2 17.47C2 8.93 9.16 2 18 2z"
            fill="#ff6a3d"
            stroke="#0b0f17"
            strokeWidth="2"
          />
          <circle cx="18" cy="17" r="5.5" fill="#0b0f17" />
        </svg>
        <div
          aria-hidden
          className="absolute left-1/2 top-full mt-1 h-1.5 w-3 -translate-x-1/2 rounded-full bg-black/30 blur-[1px]"
        />
      </div>

      {/* Top hint banner */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-30 flex justify-center pt-3"
           style={{ paddingTop: 'calc(env(safe-area-inset-top) + 12px)' }}>
        <div className="pointer-events-auto rounded-full border border-accent/55 bg-ink-900/90 px-4 py-1.5 text-[12px] font-medium text-ink-100 backdrop-blur-md">
          {prompt || (lang === 'ru' ? 'Двигайте карту, чтобы поставить точку' : 'Pan the map to drop the pin')}
        </div>
      </div>

      {/* Bottom action bar */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30 flex justify-center pb-4 px-3"
           style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 16px)' }}>
        <div className="pointer-events-auto flex items-center gap-2 rounded-full border border-ink-700/60 bg-ink-900/95 p-1.5 shadow-lg backdrop-blur-md">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-full px-3 py-1.5 text-[12.5px] text-ink-300 hover:bg-ink-800 hover:text-ink-100"
          >
            {lang === 'ru' ? 'Отмена' : 'Cancel'}
          </button>
          <button
            type="button"
            onClick={useMyLocation}
            disabled={gpsBusy}
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12.5px] text-ink-100 hover:bg-ink-800 disabled:opacity-50"
          >
            <span aria-hidden>📍</span>
            {gpsBusy
              ? (lang === 'ru' ? 'Ищу…' : 'Locating…')
              : (lang === 'ru' ? 'Моё местоположение' : 'My location')}
          </button>
          <button
            type="button"
            onClick={commit}
            className="rounded-full bg-accent px-4 py-1.5 text-[12.5px] font-semibold text-ink-950 hover:opacity-90"
          >
            {lang === 'ru' ? 'Готово' : 'Done'}
          </button>
        </div>
      </div>
    </>
  );
}

interface BodyProps {
  visible: Attraction[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  highlightedIds: Set<string> | null;
  visitedIds: ReadonlySet<string> | null;
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
  visitedIds,
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
        visitedIds={visitedIds}
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
  visitedIds: ReadonlySet<string> | null;
  suppressedIds: Set<string> | null;
}

function ClusteredMarkers({
  visible,
  selectedId,
  onSelect,
  highlightedIds,
  visitedIds,
  suppressedIds,
}: ClusterProps) {
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
          visited={visitedIds ? visitedIds.has(a.id) : false}
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
  visited: boolean;
  updateMarker: (id: string, marker: Marker | null) => void;
  onClick: () => void;
}

function AttractionMarker({ attraction, selected, dimmed, visited, updateMarker, onClick }: MarkerProps) {
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
        <MarkerIcon category={attraction.category} selected={selected} visited={visited} />
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

    function drawSolidLine(path: google.maps.LatLngLiteral[], color: string) {
      if (path.length < 2) return;
      const line = new google.maps.Polyline({
        path,
        strokeColor: color,
        strokeOpacity: travelMode === 'WALKING' || travelMode === 'BICYCLING' ? 0 : 0.85,
        strokeWeight: 4,
        icons:
          travelMode === 'WALKING' || travelMode === 'BICYCLING'
            ? [
                {
                  icon: { path: 'M 0,-1 0,1', strokeOpacity: 1, strokeColor: color, strokeWeight: 3, scale: 3 },
                  offset: '0',
                  repeat: '12px',
                },
              ]
            : undefined,
        map,
      });
      overlays.push(line);
    }

    function drawDashedFallback(from: google.maps.LatLngLiteral, to: google.maps.LatLngLiteral, color: string) {
      const fallback = new google.maps.Polyline({
        path: [from, to],
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
    }

    function pathFromResult(result: google.maps.DirectionsResult): {
      path: google.maps.LatLngLiteral[];
      legMinutes: number;
      legMeters: number;
    } {
      const path: google.maps.LatLngLiteral[] = [];
      let legMinutes = 0;
      let legMeters = 0;
      const legs = result.routes[0]?.legs ?? [];
      for (const leg of legs) {
        if (leg.steps) {
          for (const step of leg.steps) {
            if (step.path) for (const p of step.path) path.push({ lat: p.lat(), lng: p.lng() });
          }
        }
        legMinutes += Math.round((leg.duration?.value ?? 0) / 60);
        legMeters += leg.distance?.value ?? 0;
      }
      return { path, legMinutes, legMeters };
    }

    async function tryPair(
      from: google.maps.LatLngLiteral,
      to: google.maps.LatLngLiteral,
    ): Promise<google.maps.DirectionsResult | null> {
      const params: google.maps.DirectionsRequest = {
        origin: from,
        destination: to,
        travelMode: googleTravelMode(travelMode),
        ...(travelMode === 'TRANSIT' ? { transitOptions: { departureTime: nextMorning() } } : {}),
      };
      try {
        return await service.route(params);
      } catch (err) {
        console.warn('[directions] pair failed', err);
        return null;
      }
    }

    // When a stop's coordinates land somewhere unrouteable (a dam in the
    // middle of water, a beach, an offshore island), reverse-geocode it to
    // the nearest street address and use THAT for the routing request. The
    // numbered pin still sits at the original point on the map, but the
    // polyline reaches as close as Google can manage by car/bike.
    const snapCache = new Map<string, google.maps.LatLngLiteral | null>();
    async function snapToNearestRoad(
      point: google.maps.LatLngLiteral,
    ): Promise<google.maps.LatLngLiteral | null> {
      const key = `${point.lat.toFixed(4)},${point.lng.toFixed(4)}`;
      if (snapCache.has(key)) return snapCache.get(key) ?? null;
      const geocoder = new google.maps.Geocoder();
      try {
        const res = await geocoder.geocode({ location: point });
        // Prefer types that imply a routable place — fall back to anything
        // with a geometry.location, since the Geocoder returns the closest
        // address it can find for water/forest points.
        const ranked = (res.results ?? []).slice().sort((a, b) => {
          const score = (r: google.maps.GeocoderResult) =>
            r.types.includes('street_address') ? 0
            : r.types.includes('route') ? 1
            : r.types.includes('premise') ? 2
            : r.types.includes('postal_code') ? 3
            : r.types.includes('locality') ? 4
            : 5;
          return score(a) - score(b);
        });
        const best = ranked[0];
        if (best?.geometry?.location) {
          const snapped = {
            lat: best.geometry.location.lat(),
            lng: best.geometry.location.lng(),
          };
          // Skip the snap if it didn't actually move — saves a redundant retry.
          if (Math.abs(snapped.lat - point.lat) < 1e-5 && Math.abs(snapped.lng - point.lng) < 1e-5) {
            snapCache.set(key, null);
            return null;
          }
          snapCache.set(key, snapped);
          return snapped;
        }
      } catch (err) {
        console.warn('[directions] geocode snap failed', err);
      }
      snapCache.set(key, null);
      return null;
    }

    async function tryPairWithSnap(
      from: google.maps.LatLngLiteral,
      to: google.maps.LatLngLiteral,
    ): Promise<google.maps.DirectionsResult | null> {
      // 1. Direct first.
      const direct = await tryPair(from, to);
      if (direct) return direct;
      // 2. Snap the destination to the nearest road and retry. Most failures
      //    we see are caused by a point landing in water (Afsluitdijk, etc).
      const snappedTo = await snapToNearestRoad(to);
      if (snappedTo) {
        const r = await tryPair(from, snappedTo);
        if (r) return r;
      }
      // 3. Same for the origin. Useful when the *previous* stop is also
      //    a problematic dam/island and its point bleeds into this leg.
      const snappedFrom = await snapToNearestRoad(from);
      if (snappedFrom && snappedTo) {
        const r = await tryPair(snappedFrom, snappedTo);
        if (r) return r;
      }
      if (snappedFrom) {
        const r = await tryPair(snappedFrom, to);
        if (r) return r;
      }
      return null;
    }

    async function buildDay(day: RouteDay, dayIdx: number) {
      const stops = day.stops
        .map((s) => ({ slug: s.slug, coords: byId.get(s.slug)?.coordinates }))
        .filter((s): s is { slug: string; coords: google.maps.LatLngLiteral } => !!s.coords);
      if (stops.length < 2) return;
      const color = DAY_COLORS[dayIdx % DAY_COLORS.length] ?? '#ff6a3d';

      // Strategy A — for non-transit modes, try the whole day in one request
      // with waypoints. Fast and low-quota.
      if (travelMode !== 'TRANSIT' && stops.length >= 2) {
        const params: google.maps.DirectionsRequest = {
          origin: stops[0]!.coords,
          destination: stops[stops.length - 1]!.coords,
          waypoints: stops.slice(1, -1).map((s) => ({ location: s.coords, stopover: true })),
          travelMode: googleTravelMode(travelMode),
        };
        try {
          const result = await service.route(params);
          if (cancelled) return;
          const legs = result.routes[0]?.legs ?? [];
          if (legs.length === stops.length - 1) {
            const fullPath: google.maps.LatLngLiteral[] = [];
            legs.forEach((leg, legIdx) => {
              if (leg.steps) {
                for (const step of leg.steps) {
                  if (step.path) for (const p of step.path) fullPath.push({ lat: p.lat(), lng: p.lng() });
                }
              }
              const minutes = Math.round((leg.duration?.value ?? 0) / 60);
              const meters = leg.distance?.value ?? 0;
              collectedLegs.push({ dayIdx, stopIdx: legIdx + 1, minutes, meters });
            });
            drawSolidLine(fullPath, color);
            return;
          }
        } catch (err) {
          // Fall through to pairwise.
          console.warn('[directions] day request failed, trying pairwise', err);
        }
      }

      // Strategy B — pairwise with snap-to-road fallback. Each leg gets its
      // own request; if it fails we reverse-geocode the endpoints to the
      // nearest road and retry, then fall back to a dashed line.
      let degraded = false;
      for (let i = 1; i < stops.length; i++) {
        if (cancelled) return;
        const from = stops[i - 1]!.coords;
        const to = stops[i]!.coords;
        const result = await tryPairWithSnap(from, to);
        if (!result) {
          drawDashedFallback(from, to, color);
          degraded = true;
          continue;
        }
        const { path, legMinutes, legMeters } = pathFromResult(result);
        if (path.length < 2) {
          drawDashedFallback(from, to, color);
          degraded = true;
          continue;
        }

        // The snapped endpoints can be tens of metres from the original
        // numbered pin. Add a short dashed tail from the routed end-point
        // back to the original stop coordinate so the line visually meets
        // the marker even when the actual road stops short.
        const first = path[0]!;
        const last = path[path.length - 1]!;
        if (distanceMeters(first, from) > 50) drawDashedFallback(from, first, color);
        drawSolidLine(path, color);
        if (distanceMeters(last, to) > 50) drawDashedFallback(last, to, color);

        collectedLegs.push({ dayIdx, stopIdx: i, minutes: legMinutes, meters: legMeters });
      }
      if (degraded && !cancelled) {
        directions.setError(
          travelMode === 'TRANSIT'
            ? 'Для некоторых отрезков нет общественного транспорта — показаны пунктиром.'
            : 'Часть отрезков не пробивается — показаны пунктиром.',
        );
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

// Quick haversine in metres — used to decide whether the snapped-routed
// endpoint diverged from the original stop enough to warrant a small
// dashed "last metres" connector to the marker.
function distanceMeters(a: google.maps.LatLngLiteral, b: google.maps.LatLngLiteral): number {
  const R = 6_371_000;
  const toRad = (x: number) => (x * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
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
