import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { useLocation } from '@/hooks/useLocation';

const TILES = {
  street: {
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://openstreetmap.org">OpenStreetMap</a> contributors',
  },
  satellite: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, GIS User Community',
  },
  labels: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
    attribution: '',
  },
};

const STREET_STYLE: L.CircleMarkerOptions = {
  color: '#0095f6', fillColor: '#0095f6', fillOpacity: 0.12, weight: 2, dashArray: '6 4',
};
const SAT_STYLE: L.CircleMarkerOptions = {
  color: '#00d4ff', fillColor: '#00d4ff', fillOpacity: 0.15, weight: 2.5, dashArray: '6 4',
};

function formatRadius(r: number): string {
  if (r >= 1000) return `${(r / 1000).toFixed(r % 1000 === 0 ? 0 : 1)} km`;
  return `${r} m`;
}

interface Props {
  radius: number;
  onRadiusChange: (r: number) => void;
}

export const RadiusMapFilter: React.FC<Props> = ({ radius, onRadiusChange }) => {
  const { currentLocation } = useLocation();
  const [isSatellite, setIsSatellite] = useState(false);
  // Browser geolocation fetched once on open (independent of tracking state)
  const [browserLat, setBrowserLat] = useState<number | null>(null);
  const [browserLng, setBrowserLng] = useState<number | null>(null);

  const mapDivRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const tileRef = useRef<L.TileLayer | null>(null);
  const labelsRef = useRef<L.TileLayer | null>(null);
  const circleRef = useRef<L.Circle | null>(null);
  const markerRef = useRef<L.Marker | null>(null);

  // Priority: active tracking location > browser geolocation > world default
  const lat = currentLocation?.coordinates.latitude ?? browserLat ?? 20.5937;
  const lng = currentLocation?.coordinates.longitude ?? browserLng ?? 78.9629;
  const hasLocation = !!(currentLocation || browserLat !== null);
  const locationLabel = currentLocation
    ? 'Live position'
    : browserLat !== null
    ? 'Your location'
    : 'Default center';

  const pct = ((radius - 5) / (5000 - 5)) * 100;

  // Request browser geolocation once when the map opens
  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setBrowserLat(pos.coords.latitude);
        setBrowserLng(pos.coords.longitude);
      },
      () => { /* silently keep world default */ },
      { timeout: 8000, maximumAge: 300000 }
    );
  }, []);

  // Initialize map once on mount
  useEffect(() => {
    if (!mapDivRef.current) return;

    const map = L.map(mapDivRef.current, { center: [lat, lng], zoom: 14 });
    mapRef.current = map;

    const icon = L.divIcon({
      className: '',
      html: `<div style="width:16px;height:16px;border-radius:50%;background:#0095f6;border:3px solid #fff;box-shadow:0 0 0 2px #0095f6,0 2px 8px rgba(0,149,246,0.5)"></div>`,
      iconSize: [16, 16],
      iconAnchor: [8, 8],
    });
    markerRef.current = L.marker([lat, lng], { icon }).addTo(map).bindPopup('You are here');

    const circle = L.circle([lat, lng], { radius, ...STREET_STYLE }).addTo(map);
    circleRef.current = circle;
    map.fitBounds(circle.getBounds(), { padding: [30, 30] });

    return () => {
      map.remove();
      mapRef.current = null;
      tileRef.current = null;
      labelsRef.current = null;
      circleRef.current = null;
      markerRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Swap tile layers when satellite mode changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (tileRef.current) map.removeLayer(tileRef.current);
    if (labelsRef.current) { map.removeLayer(labelsRef.current); labelsRef.current = null; }

    const cfg = isSatellite ? TILES.satellite : TILES.street;
    tileRef.current = L.tileLayer(cfg.url, { attribution: cfg.attribution }).addTo(map);

    if (isSatellite) {
      labelsRef.current = L.tileLayer(TILES.labels.url, { attribution: '' }).addTo(map);
    }

    circleRef.current?.setStyle(isSatellite ? SAT_STYLE : STREET_STYLE);
  }, [isSatellite]);

  // Update marker, circle, and view when position or radius changes
  useEffect(() => {
    const map = mapRef.current;
    const circle = circleRef.current;
    if (!map || !circle) return;

    const latlng: L.LatLngExpression = [lat, lng];
    markerRef.current?.setLatLng(latlng);
    circle.setLatLng(latlng);
    circle.setRadius(radius);
    map.fitBounds(circle.getBounds(), { padding: [30, 30] });
  }, [lat, lng, radius]);

  return (
    <div className="radius-map-filter">

      {/* Slider */}
      <div className="rmf-slider-section">
        <div className="rmf-slider-header">
          <span className="rmf-label">Search Radius</span>
          <span className="rmf-value">{formatRadius(radius)}</span>
        </div>
        <div className="rmf-slider-wrap">
          <input
            type="range"
            min={5}
            max={5000}
            step={5}
            value={radius}
            onChange={e => onRadiusChange(Number(e.target.value))}
            className="rmf-slider"
            style={{ '--pct': `${pct}%` } as React.CSSProperties}
          />
        </div>
        <div className="rmf-bounds">
          <span>5 m</span>
          <div className="rmf-tick-labels">
            <span>1 km</span>
            <span>2.5 km</span>
            <span>5 km</span>
          </div>
        </div>
      </div>

      {/* Map */}
      <div className="rmf-map-wrap">
        {!hasLocation && (
          <div className="rmf-no-location">
            <p>📍 Allow location access to center the map on you</p>
          </div>
        )}

        <div className="rmf-layer-toggle">
          <button
            className={`rmf-layer-btn ${!isSatellite ? 'active' : ''}`}
            onClick={() => setIsSatellite(false)}
          >
            🗺 Street
          </button>
          <button
            className={`rmf-layer-btn ${isSatellite ? 'active' : ''}`}
            onClick={() => setIsSatellite(true)}
          >
            🛰 Satellite
          </button>
        </div>

        <div
          ref={mapDivRef}
          style={{ height: '320px', width: '100%', borderRadius: '12px' }}
        />

        <div className="rmf-map-badge">
          {formatRadius(radius)} radius · {locationLabel}
        </div>
      </div>
    </div>
  );
};
