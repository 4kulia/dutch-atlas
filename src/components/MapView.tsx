import { APIProvider, AdvancedMarker, Map as GMap, useAdvancedMarkerRef, useMap } from '@vis.gl/react-google-maps';
import { MarkerClusterer, type Marker } from '@googlemaps/markerclusterer';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ATTRACTIONS, ATTRACTIONS_BY_ID } from '../data/attractions';
import type { Attraction, Category } from '../types';
import { MarkerIcon } from './MarkerIcon';
import { useLang } from '../i18n/LanguageProvider';
import { UI } from '../i18n/strings';

const NETHERLANDS_CENTER = { lat: 52.1, lng: 5.3 };
const CARIBBEAN_CENTER = { lat: 14.5, lng: -67.5 };

const MAP_ID = import.meta.env.VITE_GOOGLE_MAPS_MAP_ID || 'NL_ATTRACTIONS_MAP';

interface Props {
  apiKey: string;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  activeCategories: Set<Category>;
  attractions?: Attraction[];
}

export function MapView({ apiKey, selectedId, onSelect, activeCategories, attractions }: Props) {
  const { lang } = useLang();
  const visible = useMemo(
    () => attractions ?? ATTRACTIONS.filter((a) => activeCategories.has(a.category)),
    [activeCategories, attractions],
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
  flyTo: google.maps.LatLngLiteral;
  flyZoom: number;
  flyKey: string;
}

function MapBody({ visible, selectedId, onSelect, flyTo, flyZoom, flyKey }: BodyProps) {
  const map = useMap();

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
    const a = ATTRACTIONS_BY_ID.get(selectedId);
    if (!a) return;
    const currentZoom = map.getZoom() ?? 7;
    const targetZoom = Math.max(currentZoom, 10);
    map.panTo(a.coordinates);
    if (targetZoom !== currentZoom) {
      // Brief delay so the pan animates first.
      window.setTimeout(() => map.setZoom(targetZoom), 220);
    }
  }, [map, selectedId]);

  return (
    <ClusteredMarkers
      visible={visible}
      selectedId={selectedId}
      onSelect={onSelect}
    />
  );
}

interface ClusterProps {
  visible: Attraction[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}

function ClusteredMarkers({ visible, selectedId, onSelect }: ClusterProps) {
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

  const visibleIds = useMemo(() => new Set(visible.map((a) => a.id)), [visible]);

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
      {visible.map((a) => (
        <AttractionMarker
          key={a.id}
          attraction={a}
          selected={selectedId === a.id}
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
  updateMarker: (id: string, marker: Marker | null) => void;
  onClick: () => void;
}

function AttractionMarker({ attraction, selected, updateMarker, onClick }: MarkerProps) {
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
      <MarkerIcon category={attraction.category} selected={selected} />
    </AdvancedMarker>
  );
}
