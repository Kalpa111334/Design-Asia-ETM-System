import React, { useState, useCallback } from 'react';
import { GoogleMap, useLoadScript, Marker } from '@react-google-maps/api';
import { SearchIcon } from '@heroicons/react/outline';

interface MapLocationPickerProps {
  onLocationSelect: (location: { lat: number; lng: number }) => void;
  existingLocations?: { latitude: number; longitude: number }[];
  initialCenter?: { lat: number; lng: number };
}

const defaultCenter = { lat: 7.8731, lng: 80.7718 }; // Default to Central Sri Lanka (Kandy area)
const libraries: ("places" | "geometry" | "drawing" | "visualization")[] = ["places"];

export default function MapLocationPicker({ 
  onLocationSelect, 
  existingLocations = [], 
  initialCenter 
}: MapLocationPickerProps) {
  const [searchInput, setSearchInput] = useState('');
  const [selectedLocation, setSelectedLocation] = useState<google.maps.LatLng | null>(null);

  const { isLoaded, loadError } = useLoadScript({
    googleMapsApiKey: "AIzaSyARSoKujCNX2odk8wachQyz0DIjBCqJNd4",
    libraries,
  });

  const handleMapClick = useCallback((e: google.maps.MapMouseEvent) => {
    if (e.latLng) {
      setSelectedLocation(e.latLng);
      onLocationSelect({ lat: e.latLng.lat(), lng: e.latLng.lng() });
    }
  }, [onLocationSelect]);

  const handleSearchLocation = async () => {
    if (!searchInput.trim()) return;

    try {
      const geocoder = new google.maps.Geocoder();
      const result = await geocoder.geocode({ address: searchInput });
      
      if (result.results[0]?.geometry?.location) {
        const location = result.results[0].geometry.location;
        setSelectedLocation(location);
        onLocationSelect({ lat: location.lat(), lng: location.lng() });
      }
    } catch (error) {
      console.error('Geocoding error:', error);
    }
  };

  if (loadError) return <div>Error loading maps</div>;
  if (!isLoaded) return <div>Loading maps...</div>;

  return (
    <div className="space-y-4">
      <div className="flex space-x-2">
        <input
          type="text"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && handleSearchLocation()}
          placeholder="Search for a location..."
          className="flex-1 px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
        />
        <button
          type="button"
          onClick={handleSearchLocation}
          className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          title="Search location"
          aria-label="Search location"
        >
          <SearchIcon className="h-5 w-5" />
        </button>
      </div>

      <div className="h-[400px] rounded-lg overflow-hidden">
        <GoogleMap
          mapContainerStyle={{ width: '100%', height: '100%' }}
          zoom={20} // Ultra-high zoom for road-focused detail
          center={initialCenter || defaultCenter}
          onClick={handleMapClick}
          options={{
            zoomControl: true,
            streetViewControl: false,
            mapTypeControl: false, // Disable for road-only view
            fullscreenControl: false,
            minZoom: 16, // Higher minimum zoom to focus on roads
            maxZoom: 25,
            restriction: {
              latLngBounds: {
                north: 9.8317,  // Point Pedro (Northern tip)
                south: 5.9169,  // Dondra Head (Southern tip)
                west: 79.6951,  // Kalpitiya (Western coast)  
                east: 81.8914,  // Sangamankanda Point (Eastern coast)
              },
              strictBounds: true, // Keep focus on Sri Lanka
            },
            styles: [
              // Beautiful modern map styling
              {
                featureType: 'all',
                elementType: 'all',
                stylers: [{ visibility: 'on' }],
              },
              // Beautiful landscape background
              {
                featureType: 'landscape',
                elementType: 'geometry',
                stylers: [
                  { visibility: 'on' },
                  { color: '#e3f2e3' },
                  { lightness: 10 }
                ],
              },
              // Major highways - vibrant orange
              {
                featureType: 'road.highway',
                elementType: 'geometry',
                stylers: [
                  { visibility: 'on' },
                  { color: '#f97316' },
                  { weight: 8 },
                  { saturation: 100 }
                ],
              },
              {
                featureType: 'road.highway',
                elementType: 'labels',
                stylers: [
                  { visibility: 'on' },
                  { color: '#f97316' },
                  { weight: 'bold' },
                  { gamma: 1.5 }
                ],
              },
              // Arterial roads - beautiful blue
              {
                featureType: 'road.arterial',
                elementType: 'geometry',
                stylers: [
                  { visibility: 'on' },
                  { color: '#2563eb' },
                  { weight: 6 },
                  { saturation: 80 }
                ],
              },
              {
                featureType: 'road.arterial',
                elementType: 'labels',
                stylers: [
                  { visibility: 'on' },
                  { color: '#2563eb' },
                  { weight: 'bold' }
                ],
              },
              // Local roads - vibrant green
              {
                featureType: 'road.local',
                elementType: 'geometry',
                stylers: [
                  { visibility: 'on' },
                  { color: '#10b981' },
                  { weight: 4 },
                  { saturation: 60 }
                ],
              },
              {
                featureType: 'road.local',
                elementType: 'labels',
                stylers: [
                  { visibility: 'on' },
                  { color: '#10b981' }
                ],
              },
              // Other roads - clean white
              {
                featureType: 'road',
                elementType: 'geometry',
                stylers: [
                  { visibility: 'on' },
                  { color: '#ffffff' },
                  { weight: 3 },
                  { gamma: 1.2 }
                ],
              },
              {
                featureType: 'road',
                elementType: 'labels',
                stylers: [
                  { visibility: 'on' },
                  { color: '#2563eb' },
                  { gamma: 1.5 }
                ],
              },
              // Beautiful water features
              {
                featureType: 'water',
                elementType: 'geometry',
                stylers: [
                  { visibility: 'on' },
                  { color: '#40b3e7' },
                  { lightness: 20 }
                ],
              },
              {
                featureType: 'water',
                elementType: 'labels',
                stylers: [
                  { visibility: 'on' },
                  { color: '#ffffff' },
                  { weight: 'bold' }
                ],
              },
              // Parks and natural features - vibrant green
              {
                featureType: 'poi.park',
                elementType: 'geometry',
                stylers: [
                  { visibility: 'on' },
                  { color: '#81c784' },
                  { lightness: 20 }
                ],
              },
              {
                featureType: 'poi.park',
                elementType: 'labels',
                stylers: [
                  { visibility: 'on' },
                  { color: '#2e7d32' },
                  { weight: 'bold' }
                ],
              },
              // Hide unnecessary POIs
              {
                featureType: 'poi.business',
                elementType: 'all',
                stylers: [{ visibility: 'off' }],
              },
              {
                featureType: 'poi.attraction',
                elementType: 'all',
                stylers: [{ visibility: 'off' }],
              },
              {
                featureType: 'poi.government',
                elementType: 'all',
                stylers: [{ visibility: 'off' }],
              },
              {
                featureType: 'poi.medical',
                elementType: 'all',
                stylers: [{ visibility: 'off' }],
              },
              {
                featureType: 'poi.place_of_worship',
                elementType: 'all',
                stylers: [{ visibility: 'off' }],
              },
              {
                featureType: 'poi.school',
                elementType: 'all',
                stylers: [{ visibility: 'off' }],
              },
              {
                featureType: 'poi.sports_complex',
                elementType: 'all',
                stylers: [{ visibility: 'off' }],
              },
              // Hide transit
              {
                featureType: 'transit',
                elementType: 'all',
                stylers: [{ visibility: 'off' }],
              },
              // Beautiful country borders
              {
                featureType: 'administrative.country',
                elementType: 'geometry.stroke',
                stylers: [
                  { visibility: 'on' },
                  { color: '#ff9800' },
                  { weight: 2 }
                ],
              },
              {
                featureType: 'administrative.country',
                elementType: 'labels',
                stylers: [
                  { visibility: 'on' },
                  { color: '#e65100' },
                  { weight: 'bold' }
                ],
              },
              // Province/state borders
              {
                featureType: 'administrative.province',
                elementType: 'geometry.stroke',
                stylers: [
                  { visibility: 'on' },
                  { color: '#ffb74d' },
                  { weight: 1 }
                ],
              },
            ],
          }}
        >
          {selectedLocation && (
            <Marker
              position={{ lat: selectedLocation.lat(), lng: selectedLocation.lng() }}
              icon={{
                url: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%234F46E5" width="36px" height="36px"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/></svg>',
                scaledSize: new google.maps.Size(36, 36),
                origin: new google.maps.Point(0, 0),
                anchor: new google.maps.Point(18, 36),
              }}
            />
          )}
          
          {existingLocations.map((loc, index) => (
            <Marker
              key={index}
              position={{ lat: loc.latitude, lng: loc.longitude }}
              icon={{
                url: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%23888888" width="36px" height="36px"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/></svg>',
                scaledSize: new google.maps.Size(36, 36),
                origin: new google.maps.Point(0, 0),
                anchor: new google.maps.Point(18, 36),
              }}
            />
          ))}
        </GoogleMap>
      </div>
    </div>
  );
}