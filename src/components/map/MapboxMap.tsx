import { useEffect, useRef, useState } from 'react';
import type { Map as MapboxMapInstance, Marker as MapboxMarker } from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { env } from '@/config/env';
import { Button } from '@/components/ui/button';
import { useBrowserPrivacy } from '@/components/privacy/BrowserPrivacyContext';

const MAPBOX_TOKEN = env.mapboxToken;

interface MarkerData {
  lng: number;
  lat: number;
  popup?: string;
}

interface MapboxMapProps {
  center?: [number, number];
  zoom?: number;
  markers?: MarkerData[];
  height?: string;
  width?: string;
  interactive?: boolean;
  draggableMarker?: boolean;
  onMarkerChange?: (coords: { lat: number; lng: number }) => void;
}

export default function MapboxMap({
  center = [-46.6333, -23.5505],
  zoom = 14,
  markers = [],
  height = '400px',
  width = '100%',
  interactive = true,
  draggableMarker = false,
  onMarkerChange,
}: MapboxMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<MapboxMapInstance | null>(null);
  const mapboxApi = useRef<typeof import('mapbox-gl').default | null>(null);
  const markersRef = useRef<MapboxMarker[]>([]);
  const [mapReady, setMapReady] = useState(false);
  const [mapLoadError, setMapLoadError] = useState(false);
  const onMarkerChangeRef = useRef(onMarkerChange);
  const { ready, isTechnologyAllowed, openSettings } = useBrowserPrivacy();
  onMarkerChangeRef.current = onMarkerChange;
  const mapboxAllowed = ready && isTechnologyAllowed('mapbox');
  const canRenderMap = Boolean(MAPBOX_TOKEN) && mapboxAllowed;
  const centerLng = center[0];
  const centerLat = center[1];

  // Initialize map
  useEffect(() => {
    if (!canRenderMap) return;
    if (!mapContainer.current || map.current) return;
    let cancelled = false;
    setMapLoadError(false);

    const initialize = async () => {
      try {
        const module = await import('mapbox-gl');
        if (cancelled || !mapContainer.current) return;
        const api = module.default;
        api.accessToken = MAPBOX_TOKEN;
        mapboxApi.current = api;
        map.current = new api.Map({
          container: mapContainer.current,
          style: 'mapbox://styles/mapbox/streets-v12',
          center,
          zoom,
          attributionControl: false,
          interactive,
        });
        setMapReady(true);
      } catch {
        if (!cancelled) setMapLoadError(true);
      }
    };
    initialize();

    return () => {
      cancelled = true;
      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current = [];
      map.current?.remove();
      map.current = null;
      mapboxApi.current = null;
      setMapReady(false);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canRenderMap]);

  // Update center
  useEffect(() => {
    if (!canRenderMap || !mapReady) return;
    if (map.current) {
      map.current.flyTo({ center: [centerLng, centerLat], zoom, duration: 800 });
    }
  }, [canRenderMap, mapReady, centerLng, centerLat, zoom]);

  // Update markers
  useEffect(() => {
    if (!canRenderMap || !mapReady) return;
    // Clear old markers
    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];

    if (!map.current || !mapboxApi.current) return;
    const api = mapboxApi.current;

    markers.forEach((markerData) => {
      const m = new api.Marker({ draggable: draggableMarker })
        .setLngLat([markerData.lng, markerData.lat]);

      if (markerData.popup) {
        m.setPopup(new api.Popup({ offset: 25 }).setHTML(markerData.popup));
      }

      if (draggableMarker) {
        m.on('dragend', () => {
          const lngLat = m.getLngLat();
          onMarkerChangeRef.current?.({ lat: lngLat.lat, lng: lngLat.lng });
        });
      }

      m.addTo(map.current!);
      markersRef.current.push(m);
    });
  }, [canRenderMap, mapReady, markers, draggableMarker]);

  if (!MAPBOX_TOKEN) {
    return (
      <div
        className="flex items-center justify-center rounded-xl border border-dashed border-amber-200 bg-amber-50 px-4 py-6 text-center text-sm text-amber-700"
        style={{ height, width }}
      >
        Configure `VITE_MAPBOX_TOKEN` para habilitar o mapa do consultorio.
      </div>
    );
  }

  if (!mapboxAllowed) {
    return (
      <div
        className="flex flex-col items-center justify-center gap-3 rounded-xl border border-border bg-muted/40 px-4 py-6 text-center text-sm text-muted-foreground"
        style={{ height, width }}
      >
        <p>O mapa opcional permanece bloqueado ate sua autorizacao.</p>
        <Button type="button" size="sm" variant="outline" onClick={openSettings}>Configurar mapa</Button>
      </div>
    );
  }

  if (mapLoadError) {
    return (
      <div className="flex items-center justify-center rounded-xl border border-border bg-muted/40 px-4 py-6 text-center text-sm text-muted-foreground" style={{ height, width }}>
        Nao foi possivel carregar o mapa agora.
      </div>
    );
  }

  return <div ref={mapContainer} style={{ height, width, borderRadius: '12px' }} />;
}
