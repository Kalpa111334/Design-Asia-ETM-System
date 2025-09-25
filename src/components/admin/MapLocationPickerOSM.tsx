import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import { GeofencingService, Geofence } from '../../services/GeofencingService';
import {
  LocationMarkerIcon,
  SearchIcon,
  XCircleIcon,
  CheckCircleIcon,
  MapIcon,
} from '@heroicons/react/outline';
import toast from 'react-hot-toast';

// Fix for default markers
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

interface MapLocationPickerOSMProps {
  onLocationSelect: (location: { lat: number; lng: number; address?: string }) => void;
  onClose: () => void;
  initialLocation?: { lat: number; lng: number };
  title?: string;
  geofences?: Geofence[];
}

interface LocationData {
  lat: number;
  lng: number;
  address?: string;
}

// Component for handling map clicks
function LocationSelector({ 
  onLocationSelect, 
  selectedLocation 
}: { 
  onLocationSelect: (lat: number, lng: number) => void;
  selectedLocation: LocationData | null;
}) {
  const map = useMap();

  useMapEvents({
    click(e) {
      onLocationSelect(e.latlng.lat, e.latlng.lng);
    },
  });

  // Auto-zoom to Sri Lanka bounds on mount
  useEffect(() => {
    const sriLankaBounds = L.latLngBounds(
      [5.9169, 79.6951], // Southwest
      [9.8317, 81.8914]  // Northeast
    );
    map.fitBounds(sriLankaBounds);
  }, [map]);

  return selectedLocation ? (
    <Marker
      position={[selectedLocation.lat, selectedLocation.lng]}
      icon={L.divIcon({
        className: 'selected-location-marker',
        html: `
          <div style="
            width: 50px;
            height: 50px;
            position: relative;
            display: flex;
            align-items: center;
            justify-content: center;
          ">
            <!-- Pulsing outer ring -->
            <div style="
              position: absolute;
              width: 50px;
              height: 50px;
              background: #3b82f6;
              border-radius: 50%;
              opacity: 0.3;
              animation: pulse 2s infinite;
            "></div>
            
            <!-- Main marker -->
            <div style="
              position: absolute;
              width: 36px;
              height: 36px;
              background: #3b82f6;
              border: 3px solid white;
              border-radius: 50%;
              box-shadow: 0 4px 12px rgba(0,0,0,0.4);
              display: flex;
              align-items: center;
              justify-content: center;
              z-index: 1000;
            ">
              <span style="
                color: white;
                font-size: 18px;
                font-weight: bold;
              ">📍</span>
            </div>
          </div>
          <style>
            @keyframes pulse {
              0% { transform: scale(1); opacity: 0.3; }
              50% { transform: scale(1.2); opacity: 0.1; }
              100% { transform: scale(1); opacity: 0.3; }
            }
          </style>
        `,
        iconSize: [50, 50],
        iconAnchor: [25, 25],
      })}
    >
      <Popup>
        <div className="text-center">
          <div className="flex items-center justify-center mb-2">
            <CheckCircleIcon className="h-5 w-5 text-green-500 mr-2" />
            <span className="font-semibold text-green-700">Selected Location</span>
          </div>
          <p className="text-sm text-gray-600">
            Lat: {selectedLocation.lat.toFixed(6)}<br />
            Lng: {selectedLocation.lng.toFixed(6)}
          </p>
          {selectedLocation.address && (
            <p className="text-xs text-gray-500 mt-2">{selectedLocation.address}</p>
          )}
        </div>
      </Popup>
    </Marker>
  ) : null;
}

// Map controls component
function MapControls({ 
  onZoomToSriLanka, 
  onGetCurrentLocation, 
  onSearch 
}: {
  onZoomToSriLanka: () => void;
  onGetCurrentLocation: () => void;
  onSearch: () => void;
}) {
  return (
    <div className="absolute top-4 right-4 z-[1000] space-y-2">
      <button
        onClick={onZoomToSriLanka}
        className="bg-white hover:bg-gray-50 border border-gray-300 rounded-lg p-3 shadow-lg transition-colors"
        title="Zoom to Sri Lanka"
      >
        🇱🇰
      </button>
      <button
        onClick={onGetCurrentLocation}
        className="bg-white hover:bg-gray-50 border border-gray-300 rounded-lg p-3 shadow-lg transition-colors"
        title="Get Current Location"
      >
        <LocationMarkerIcon className="h-5 w-5 text-blue-600" />
      </button>
      <button
        onClick={onSearch}
        className="bg-white hover:bg-gray-50 border border-gray-300 rounded-lg p-3 shadow-lg transition-colors"
        title="Search Location"
      >
        <SearchIcon className="h-5 w-5 text-green-600" />
      </button>
    </div>
  );
}

export default function MapLocationPickerOSM({ 
  onLocationSelect, 
  onClose, 
  initialLocation,
  title = "Select Location",
  geofences = []
}: MapLocationPickerOSMProps) {
  const [selectedLocation, setSelectedLocation] = useState<LocationData | null>(
    initialLocation ? { lat: initialLocation.lat, lng: initialLocation.lng } : null
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const mapRef = useRef<L.Map>(null);

  const handleLocationClick = async (lat: number, lng: number) => {
    const location: LocationData = { lat, lng };
    
    // Try to get address from reverse geocoding (OpenStreetMap Nominatim)
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&addressdetails=1`
      );
      const data = await response.json();
      if (data.display_name) {
        location.address = data.display_name;
      }
    } catch (error) {
      console.log('Could not get address for location');
    }
    
    setSelectedLocation(location);
    
    // Auto-zoom to selected location for better precision
    if (mapRef.current) {
      mapRef.current.setView([lat, lng], 16);
    }
    
    toast.success('Location selected! Click "Confirm Location" to proceed.');
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      toast.error('Please enter a search query');
      return;
    }

    setIsSearching(true);
    try {
      // Search using OpenStreetMap Nominatim
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&countrycodes=lk&limit=5&addressdetails=1`
      );
      const results = await response.json();
      
      if (results.length > 0) {
        const result = results[0];
        const lat = parseFloat(result.lat);
        const lng = parseFloat(result.lon);
        
        handleLocationClick(lat, lng);
        setShowSearch(false);
        setSearchQuery('');
        toast.success('Location found!');
      } else {
        toast.error('Location not found. Try a different search term.');
      }
    } catch (error) {
      console.error('Search error:', error);
      toast.error('Search failed. Please try again.');
    } finally {
      setIsSearching(false);
    }
  };

  const getCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          handleLocationClick(lat, lng);
        },
        (error) => {
          console.error('Error getting location:', error);
          toast.error('Failed to get current location. Please ensure location access is enabled.');
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0
        }
      );
    } else {
      toast.error('Geolocation is not supported by this browser');
    }
  };

  const zoomToSriLanka = () => {
    if (mapRef.current) {
      const sriLankaBounds = L.latLngBounds(
        [5.9169, 79.6951], // Southwest
        [9.8317, 81.8914]  // Northeast
      );
      mapRef.current.fitBounds(sriLankaBounds);
    }
  };

  const handleConfirm = () => {
    if (selectedLocation) {
      onLocationSelect(selectedLocation);
    } else {
      toast.error('Please select a location first');
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="fixed inset-0 bg-black bg-opacity-50 transition-opacity" onClick={onClose} />
        
        <div className="relative bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden location-picker-modal">
          {/* Header */}
          <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-blue-600 to-indigo-600">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <MapIcon className="h-6 w-6 text-white mr-3" />
                <h3 className="text-lg font-semibold text-white">{title}</h3>
              </div>
              <button
                onClick={onClose}
                className="text-white hover:text-gray-200 transition-colors"
              >
                <XCircleIcon className="h-6 w-6" />
              </button>
            </div>
            <p className="text-blue-100 text-sm mt-1">
              Click anywhere on the map to select a location, or use the controls to search or get your current location.
            </p>
          </div>

          {/* Search Bar */}
          {showSearch && (
            <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
              <div className="flex gap-3">
                <div className="flex-1">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                    className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                    placeholder="Search for a location in Sri Lanka..."
                  />
                </div>
                <button
                  onClick={handleSearch}
                  disabled={isSearching}
                  className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 disabled:opacity-50"
                >
                  {isSearching ? 'Searching...' : 'Search'}
                </button>
                <button
                  onClick={() => setShowSearch(false)}
                  className="bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-700"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Map */}
          <div className="relative map-container-modal" style={{ height: '500px' }}>
            <MapContainer
              center={initialLocation ? [initialLocation.lat, initialLocation.lng] : [7.8731, 80.7718]}
              zoom={initialLocation ? 16 : 8}
              style={{ height: '100%', width: '100%' }}
              ref={mapRef}
              className="location-picker-map"
              scrollWheelZoom={true}
              touchZoom={true}
              doubleClickZoom={true}
              dragging={true}
              maxZoom={22}
              minZoom={2}
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                maxNativeZoom={19}
                maxZoom={22}
              />
              
              <LocationSelector
                onLocationSelect={handleLocationClick}
                selectedLocation={selectedLocation}
              />

              {/* Show existing geofences for reference */}
              {geofences.map((geofence) => (
                <Marker
                  key={geofence.id}
                  position={[geofence.center_latitude, geofence.center_longitude]}
                  icon={L.divIcon({
                    className: 'geofence-reference-marker',
                    html: `
                      <div style="
                        width: 30px;
                        height: 30px;
                        background: #8b5cf6;
                        border: 2px solid white;
                        border-radius: 50%;
                        box-shadow: 0 2px 4px rgba(0,0,0,0.3);
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        opacity: 0.7;
                      ">
                        <span style="color: white; font-size: 12px;">📍</span>
                      </div>
                    `,
                    iconSize: [30, 30],
                    iconAnchor: [15, 15],
                  })}
                >
                  <Popup>
                    <div className="text-xs">
                      <p className="font-semibold">{geofence.name}</p>
                      <p className="text-gray-600">Existing geofence</p>
                    </div>
                  </Popup>
                </Marker>
              ))}
            </MapContainer>

            {/* Controls hidden as per new requirement; search and current handled by QuickLocationTools */}
          </div>

          {/* Selected Location Info */}
          {selectedLocation && (
            <div className="px-6 py-4 bg-green-50 border-t border-gray-200">
              <div className="flex items-center">
                <CheckCircleIcon className="h-5 w-5 text-green-500 mr-2" />
                <div className="flex-1">
                  <p className="font-medium text-green-800">Location Selected</p>
                  <p className="text-sm text-green-700">
                    Latitude: {selectedLocation.lat.toFixed(6)}, Longitude: {selectedLocation.lng.toFixed(6)}
                  </p>
                  {selectedLocation.address && (
                    <p className="text-xs text-green-600 mt-1">{selectedLocation.address}</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex justify-end space-x-3">
            <button
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-100 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={!selectedLocation}
              className="px-6 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Confirm Location
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}