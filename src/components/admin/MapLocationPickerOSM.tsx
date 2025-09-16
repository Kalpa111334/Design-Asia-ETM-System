import React, { useState, useCallback, useRef } from 'react';
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet';
import L from 'leaflet';
import { SearchIcon } from '@heroicons/react/outline';
import { AlertService } from '../../services/AlertService';

interface MapLocationPickerProps {
  onLocationSelect: (location: { lat: number; lng: number }) => void;
  existingLocations?: { latitude: number; longitude: number }[];
  initialCenter?: { lat: number; lng: number };
}

const defaultCenter: [number, number] = [7.8731, 80.7718]; // Default to Central Sri Lanka

// Custom marker icon
const createLocationMarker = (isSelected: boolean) => {
  return L.divIcon({
    className: 'custom-marker',
    html: `
      <div style="
        width: 32px;
        height: 32px;
        position: relative;
        display: flex;
        align-items: center;
        justify-content: center;
      ">
        <div style="
          position: absolute;
          width: 32px;
          height: 32px;
          background: ${isSelected ? '#ef4444' : '#3b82f6'};
          border-radius: 50%;
          border: 3px solid white;
          box-shadow: 0 4px 8px rgba(0,0,0,0.3);
          display: flex;
          align-items: center;
          justify-content: center;
        ">
          <span style="
            color: white;
            font-weight: bold;
            font-size: 16px;
          ">📍</span>
        </div>
        ${isSelected ? `
          <div style="
            position: absolute;
            top: -8px;
            left: 50%;
            transform: translateX(-50%);
            width: 0;
            height: 0;
            border-left: 6px solid transparent;
            border-right: 6px solid transparent;
            border-bottom: 8px solid #ef4444;
            filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3));
          "></div>
        ` : ''}
      </div>
    `,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -16],
  });
};

// Map component that handles map interactions
function MapComponent({ 
  selectedLocation, 
  onLocationSelect, 
  existingLocations 
}: {
  selectedLocation: [number, number] | null;
  onLocationSelect: (location: { lat: number; lng: number }) => void;
  existingLocations: { latitude: number; longitude: number }[];
}) {
  const map = useMap();

  const handleMapClick = useCallback((e: L.LeafletMouseEvent) => {
    const { lat, lng } = e.latlng;
    onLocationSelect({ lat, lng });
  }, [onLocationSelect]);

  React.useEffect(() => {
    map.on('click', handleMapClick);
    return () => {
      map.off('click', handleMapClick);
    };
  }, [map, handleMapClick]);

  return (
    <>
      {/* Selected Location Marker */}
      {selectedLocation && (
        <Marker
          position={selectedLocation}
          icon={createLocationMarker(true)}
        />
      )}

      {/* Existing Locations Markers */}
      {existingLocations.map((location, index) => (
        <Marker
          key={index}
          position={[location.latitude, location.longitude]}
          icon={createLocationMarker(false)}
        />
      ))}
    </>
  );
}

export default function MapLocationPickerOSM({ 
  onLocationSelect, 
  existingLocations = [], 
  initialCenter 
}: MapLocationPickerProps) {
  const [searchInput, setSearchInput] = useState('');
  const [selectedLocation, setSelectedLocation] = useState<[number, number] | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const mapRef = useRef<L.Map>(null);

  const handleLocationSelect = useCallback((location: { lat: number; lng: number }) => {
    const coords: [number, number] = [location.lat, location.lng];
    setSelectedLocation(coords);
    onLocationSelect(location);
  }, [onLocationSelect]);

  const handleSearchLocation = async () => {
    if (!searchInput.trim()) return;

    setIsSearching(true);
    try {
      // Using OpenStreetMap Nominatim for geocoding (free)
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchInput)}&limit=1&addressdetails=1&accept-language=en`
      );
      const data = await response.json();
      
      if (data && data.length > 0) {
        const result = data[0];
        const lat = parseFloat(result.lat);
        const lng = parseFloat(result.lon);
        
        if (!isNaN(lat) && !isNaN(lng)) {
          const coords: [number, number] = [lat, lng];
          setSelectedLocation(coords);
          onLocationSelect({ lat, lng });
          
          // Pan to the searched location
          if (mapRef.current) {
            mapRef.current.setView(coords, 15);
          }
        }
      } else {
        await AlertService.info('Location not found', 'Please try a different search term.');
      }
    } catch (error) {
      console.error('Geocoding error:', error);
      await AlertService.error('Search error', 'Error searching for location. Please try again.');
    } finally {
      setIsSearching(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearchLocation();
    }
  };

  const clearSelection = () => {
    setSelectedLocation(null);
    setSearchInput('');
  };

  const center = initialCenter ? [initialCenter.lat, initialCenter.lng] as [number, number] : defaultCenter;

  return (
    <div className="space-y-4">
      {/* Search Bar */}
      <div className="flex space-x-2">
        <div className="flex-1 relative">
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Search for a location (e.g., Colombo, Sri Lanka)"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>
        <button
          onClick={handleSearchLocation}
          disabled={isSearching || !searchInput.trim()}
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
        >
          <SearchIcon className="h-4 w-4" />
          <span>{isSearching ? 'Searching...' : 'Search'}</span>
        </button>
      </div>

      {/* Map Container */}
      <div className="relative">
        <MapContainer
          center={center}
          zoom={12}
          style={{ height: '400px', width: '100%' }}
          ref={mapRef}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          
          <MapComponent
            selectedLocation={selectedLocation}
            onLocationSelect={handleLocationSelect}
            existingLocations={existingLocations}
          />
        </MapContainer>
        
        {/* Map Instructions */}
        <div className="absolute top-4 left-4 bg-white bg-opacity-90 rounded-lg p-3 shadow-lg max-w-xs">
          <h4 className="font-medium text-gray-900 mb-2">Instructions:</h4>
          <ul className="text-sm text-gray-600 space-y-1">
            <li>• Click on the map to select a location</li>
            <li>• Use the search bar to find specific places</li>
            <li>• Red marker shows your selected location</li>
            <li>• Blue markers show existing locations</li>
          </ul>
        </div>
      </div>

      {/* Selected Location Info */}
      {selectedLocation && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-medium text-green-900">Selected Location</h4>
              <p className="text-sm text-green-700">
                Latitude: {selectedLocation[0].toFixed(6)}
              </p>
              <p className="text-sm text-green-700">
                Longitude: {selectedLocation[1].toFixed(6)}
              </p>
            </div>
            <button
              onClick={clearSelection}
              className="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {/* OpenStreetMap Info */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
        <div className="flex items-center">
          <div className="flex-shrink-0">
            <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
          </div>
          <div className="ml-3">
            <p className="text-sm text-blue-800">
              <strong>OpenStreetMap:</strong> Free and open-source mapping data. No API key required.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
