import { useEffect, useRef, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { env } from '@/config/env';

const MAPBOX_TOKEN = env.mapboxToken;
mapboxgl.accessToken = MAPBOX_TOKEN;

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
  const map = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const onMarkerChangeRef = useRef(onMarkerChange);
  onMarkerChangeRef.current = onMarkerChange;
  const canRenderMap = Boolean(MAPBOX_TOKEN);

  // Initialize map
  useEffect(() => {
    if (!canRenderMap) return;
    if (!mapContainer.current || map.current) return;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/streets-v12',
      center,
      zoom,
      attributionControl: false,
      interactive,
    });

    return () => {
      map.current?.remove();
      map.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canRenderMap]);

  // Update center
  useEffect(() => {
    if (!canRenderMap) return;
    if (map.current) {
      map.current.flyTo({ center, zoom, duration: 800 });
    }
  }, [canRenderMap, center[0], center[1], zoom]);

  // Update markers
  useEffect(() => {
    if (!canRenderMap) return;
    // Clear old markers
    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];

    if (!map.current) return;

    markers.forEach((markerData) => {
      const m = new mapboxgl.Marker({ draggable: draggableMarker })
        .setLngLat([markerData.lng, markerData.lat]);

      if (markerData.popup) {
        m.setPopup(new mapboxgl.Popup({ offset: 25 }).setHTML(markerData.popup));
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
  }, [canRenderMap, markers, draggableMarker]);

  if (!canRenderMap) {
    return (
      <div
        className="flex items-center justify-center rounded-xl border border-dashed border-amber-200 bg-amber-50 px-4 py-6 text-center text-sm text-amber-700"
        style={{ height, width }}
      >
        Configure `VITE_MAPBOX_TOKEN` para habilitar o mapa do consultorio.
      </div>
    );
  }

  return <div ref={mapContainer} style={{ height, width, borderRadius: '12px' }} />;
}
