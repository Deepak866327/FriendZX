import React, { useState, useCallback } from 'react';
import { locationService } from '@/services/locationService';
import { debounce } from '@/utils/helpers';

interface SearchResult {
  id: string;
  address: string;
  coordinates: {
    latitude: number;
    longitude: number;
  };
}

interface SearchLocationProps {
  onSelectLocation?: (location: SearchResult) => void;
}

export const SearchLocation: React.FC<SearchLocationProps> = ({ onSelectLocation }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  const performSearch = useCallback(
    debounce(async (searchQuery: string) => {
      if (!searchQuery.trim()) {
        setResults([]);
        return;
      }

      try {
        setIsLoading(true);
        const data = await locationService.searchLocations(searchQuery, 5);
        
        const mappedResults: SearchResult[] = (data.results || []).map((result: any) => ({
          id: result.id,
          address: result.address || 'Unknown Location',
          coordinates: {
            latitude: result.coordinates.latitude,
            longitude: result.coordinates.longitude,
          },
        }));

        setResults(mappedResults);
        setIsOpen(true);
      } catch (error) {
        console.error('Search error:', error);
        setResults([]);
      } finally {
        setIsLoading(false);
      }
    }, 500),
    []
  );

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setQuery(value);
    performSearch(value);
  };

  const handleSelectResult = (result: SearchResult) => {
    setQuery(result.address);
    setIsOpen(false);
    if (onSelectLocation) {
      onSelectLocation(result);
    }
  };

  return (
    <div className="search-location">
      <div className="search-input-wrapper">
        <input
          type="text"
          value={query}
          onChange={handleChange}
          onFocus={() => results.length > 0 && setIsOpen(true)}
          placeholder="Search locations..."
          className="search-input"
        />
        {isLoading && <span className="loading-spinner">⟳</span>}
      </div>

      {isOpen && results.length > 0 && (
        <div className="search-results">
          {results.map(result => (
            <div
              key={result.id}
              className="search-result-item"
              onClick={() => handleSelectResult(result)}
            >
              <div className="result-icon">📍</div>
              <div className="result-content">
                <p className="result-title">{result.address}</p>
                <p className="result-coords">
                  {result.coordinates.latitude.toFixed(4)}, {result.coordinates.longitude.toFixed(4)}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {isOpen && results.length === 0 && query && !isLoading && (
        <div className="search-empty">
          <p>No locations found</p>
        </div>
      )}
    </div>
  );
};