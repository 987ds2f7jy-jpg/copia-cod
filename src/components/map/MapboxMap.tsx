import { useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN || '';
mapboxgl.accessToken = MAPBOX_TOKEN;

interface MapboxMapProps {
  center?: [number, number];
  zoom?: number;
  markers?: Array<{
    lng: number;
    lat: number;
    popup?: string;
  }>;
  height?: string;
  width?: string;
}

export default function MapboxMap({
  center = [-46.6333, -23.5505],
  zoom = 14,
  markers = [],
  height = '400px',
  width = '100%',
}: MapboxMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);

  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/streets-v12',
      center,
      zoom,
      attributionControl: false,
    });

    markers.forEach((marker) => {
      const m = new mapboxgl.Marker()
        .setLngLat([marker.lng, marker.lat]);
      if (marker.popup) {
        m.setPopup(new mapboxgl.Popup().setHTML(marker.popup));
      }
      m.addTo(map.current!);
    });

    return () => {
      map.current?.remove();
      map.current = null;
    };
  }, [center, zoom, markers]);

  return <div ref={mapContainer} style={{ height, width }} />;
}
