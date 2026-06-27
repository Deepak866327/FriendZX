import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { Map, Satellite } from 'lucide-react';
import { useLocation } from '@/hooks/useLocation';

const TILES = {
  street: {
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://openstreetmap.org">OpenStreetMap</a> contributors',
  },
  satellite: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri',
  },
  labels: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
    attribution: '',
  },
};

const STREET_STYLE: L.CircleMarkerOptions = {
  color: '#6366f1', fillColor: '#6366f1', fillOpacity: 0.10, weight: 2, dashArray: '6 4',
};
const SAT_STYLE: L.CircleMarkerOptions = {
  color: '#38bdf8', fillColor: '#38bdf8', fillOpacity: 0.12, weight: 2.5, dashArray: '6 4',
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
  const [browserLat,  setBrowserLat]  = useState<number | null>(null);
  const [browserLng,  setBrowserLng]  = useState<number | null>(null);

  const mapDivRef  = useRef<HTMLDivElement>(null);
  const mapRef     = useRef<L.Map | null>(null);
  const tileRef    = useRef<L.TileLayer | null>(null);
  const labelsRef  = useRef<L.TileLayer | null>(null);
  const circleRef  = useRef<L.Circle | null>(null);
  const markerRef  = useRef<L.Marker | null>(null);

  const lat = currentLocation?.coordinates.latitude ?? browserLat ?? 20.5937;
  const lng = currentLocation?.coordinates.longitude ?? browserLng ?? 78.9629;
  const hasLocation = !!(currentLocation || browserLat !== null);
  const locationLabel = currentLocation ? 'Live position' : browserLat !== null ? 'Your location' : 'Default center';

  const pct = ((radius - 5) / (5000 - 5)) * 100;

  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      pos => { setBrowserLat(pos.coords.latitude); setBrowserLng(pos.coords.longitude); },
      () => {},
      { timeout: 8000, maximumAge: 300000 },
    );
  }, []);

  useEffect(() => {
    if (!mapDivRef.current) return;
    const map = L.map(mapDivRef.current, { center: [lat, lng], zoom: 14 });
    mapRef.current = map;

    const icon = L.divIcon({
      className: '',
      html: `<div style="width:14px;height:14px;border-radius:50%;background:linear-gradient(135deg,#6366f1,#8b5cf6);border:2.5px solid #fff;box-shadow:0 0 0 3px rgba(99,102,241,0.30),0 2px 8px rgba(99,102,241,0.40)"></div>`,
      iconSize: [14, 14],
      iconAnchor: [7, 7],
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
    <div className="flex flex-col gap-4">

      {/* ── Radius slider card ── */}
      <div className="glass rounded-2xl p-5">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-semibold text-slate-700">Search radius</span>
          <span
            className="text-sm font-bold px-2.5 py-1 rounded-lg text-white"
            style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)' }}
          >
            {formatRadius(radius)}
          </span>
        </div>

        <input
          type="range"
          min={5}
          max={5000}
          step={5}
          value={radius}
          onChange={e => onRadiusChange(Number(e.target.value))}
          className="fx-slider"
          style={{ '--pct': `${pct}%` } as React.CSSProperties}
        />

        <div className="flex justify-between text-[10px] text-slate-400 mt-2 font-medium">
          <span>5 m</span>
          <span>1 km</span>
          <span>2.5 km</span>
          <span>5 km</span>
        </div>
      </div>

      {/* ── Map card ── */}
      <div className="glass rounded-2xl overflow-hidden">
        {/* Layer toggle */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/40">
          {!hasLocation && (
            <p className="text-xs text-slate-400 flex items-center gap-1.5">
              <span className="w-4 h-4 rounded-full border border-amber-300 bg-amber-50 flex items-center justify-center text-[9px]">!</span>
              Allow location access to center the map
            </p>
          )}
          {hasLocation && (
            <p className="text-xs text-slate-400">
              {locationLabel}
            </p>
          )}

          <div className="flex items-center gap-1 ml-auto glass rounded-lg p-0.5">
            <button
              onClick={() => setIsSatellite(false)}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold transition-all ${
                !isSatellite ? 'bg-gradient-to-r from-indigo-500 to-violet-600 text-white' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <Map size={11} /> Street
            </button>
            <button
              onClick={() => setIsSatellite(true)}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold transition-all ${
                isSatellite ? 'bg-gradient-to-r from-sky-400 to-blue-500 text-white' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <Satellite size={11} /> Satellite
            </button>
          </div>
        </div>

        {/* Map */}
        <div ref={mapDivRef} style={{ height: 340, width: '100%' }} />

        {/* Badge */}
        <div className="px-4 py-2.5 border-t border-white/40 flex items-center justify-between">
          <span className="text-xs text-slate-500">
            {formatRadius(radius)} radius · {locationLabel}
          </span>
        </div>
      </div>
    </div>
  );
};
