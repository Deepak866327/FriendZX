import React, { useEffect, useRef } from 'react';
import { useLocation } from '@/hooks/useLocation';
import { calculateDistance } from '@/utils/helpers';

interface MapMarker {
  id: string;
  latitude: number;
  longitude: number;
  title: string;
  type: 'user' | 'nearby';
}

export const LocationMap: React.FC = () => {
  const mapRef = useRef<HTMLDivElement>(null);
  const { currentLocation, nearbyUsers } = useLocation();
  const [markers, setMarkers] = React.useState<MapMarker[]>([]);
  const [selectedMarker, setSelectedMarker] = React.useState<MapMarker | null>(null);

  // Simulate map rendering (in production, use Leaflet or Google Maps)
  useEffect(() => {
    const newMarkers: MapMarker[] = [];

    if (currentLocation) {
      newMarkers.push({
        id: 'user',
        latitude: currentLocation.coordinates.latitude,
        longitude: currentLocation.coordinates.longitude,
        title: 'Your Location',
        type: 'user',
      });
    }

    nearbyUsers.forEach(user => {
      newMarkers.push({
        id: user.userId,
        latitude: user.coordinates.latitude,
        longitude: user.coordinates.longitude,
        title: `User ${user.userId}`,
        type: 'nearby',
      });
    });

    setMarkers(newMarkers);
  }, [currentLocation, nearbyUsers]);

  return (
    <div className="location-map-container">
      <div className="map-wrapper">
        <div ref={mapRef} className="map">
          {/* Map canvas would go here */}
          <div className="map-placeholder">
            <p>📍 Map View</p>
            {currentLocation && (
              <p className="location-info">
                Latitude: {currentLocation.coordinates.latitude.toFixed(4)}<br />
                Longitude: {currentLocation.coordinates.longitude.toFixed(4)}
              </p>
            )}
          </div>

          {/* Marker indicators */}
          <div className="markers">
            {markers.map(marker => (
              <div
                key={marker.id}
                className={`marker ${marker.type}`}
                onClick={() => setSelectedMarker(marker)}
                title={marker.title}
              >
                {marker.type === 'user' ? '📍' : '👤'}
              </div>
            ))}
          </div>
        </div>

        {/* Selected marker details */}
        {selectedMarker && (
          <div className="marker-details">
            <div className="details-header">
              <h3>{selectedMarker.title}</h3>
              <button onClick={() => setSelectedMarker(null)}>✕</button>
            </div>
            <div className="details-content">
              <p>Latitude: {selectedMarker.latitude.toFixed(4)}</p>
              <p>Longitude: {selectedMarker.longitude.toFixed(4)}</p>
              
              {selectedMarker.type === 'nearby' && currentLocation && (
                <p className="distance">
                  Distance: {calculateDistance(
                    currentLocation.coordinates.latitude,
                    currentLocation.coordinates.longitude,
                    selectedMarker.latitude,
                    selectedMarker.longitude
                  )}m
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Map controls */}
      <div className="map-controls">
        <button className="control-btn" title="Zoom In">+</button>
        <button className="control-btn" title="Zoom Out">−</button>
        <button className="control-btn" title="Center">⊚</button>
      </div>
    </div>
  );
};