import React, { useState } from 'react';
import { useLocation } from '@/hooks/useLocation';
import { RadiusMapFilter } from './RadiusMapFilter';

export const LocationTracker: React.FC = () => {
  const { isTracking, startTracking, stopTracking, error, clearError, searchRadius, setSearchRadius } = useLocation();
  const [showMap, setShowMap] = useState(false);

  const handleToggleTracking = () => {
    if (isTracking) {
      stopTracking();
    } else {
      clearError();
      startTracking();
    }
  };

  return (
    <div className="location-tracker">
      <div className="tracker-controls">
        <button
          className={`btn ${isTracking ? 'btn-danger' : 'btn-primary'}`}
          onClick={handleToggleTracking}
        >
          {isTracking ? '⏹ Stop Tracking' : '📍 Start Tracking Nearby'}
        </button>

        <button
          className="btn btn-secondary"
          onClick={() => setShowMap(v => !v)}
          style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          🗺 {showMap ? 'Hide Map' : 'Map Filter'}
        </button>

        {isTracking && (
          <span className="status-badge active">
            <span className="dot"></span> Tracking Active
          </span>
        )}
      </div>

      {error && (
        <div style={{
          marginTop: '12px', padding: '12px',
          background: '#fff3cd', border: '1px solid #ffc107',
          borderRadius: '8px', fontSize: '13px', color: '#856404', lineHeight: '1.5',
        }}>
          ⚠️ {error}
          {error.includes('permission') && (
            <div style={{ marginTop: '8px', fontSize: '12px' }}>
              <strong>How to allow location:</strong>
              <ul style={{ margin: '4px 0 0 16px', padding: 0 }}>
                <li>Click the 🔒 lock icon in your browser address bar</li>
                <li>Set <em>Location</em> to <strong>Allow</strong></li>
                <li>Refresh the page and try again</li>
              </ul>
            </div>
          )}
        </div>
      )}

      {showMap && (
        <div style={{ marginTop: '16px' }}>
          <RadiusMapFilter
            radius={searchRadius}
            onRadiusChange={setSearchRadius}
          />
        </div>
      )}

      {isTracking && !showMap && (
        <div className="tracking-info">
          <p>📍 Your location is being shared</p>
          <p>🔍 Searching within {searchRadius >= 1000 ? `${(searchRadius / 1000).toFixed(1)} km` : `${searchRadius} m`} radius</p>
        </div>
      )}
    </div>
  );
};
