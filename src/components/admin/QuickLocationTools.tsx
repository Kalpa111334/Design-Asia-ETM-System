import React, { useState } from 'react';
import MapLocationPickerOSM from './MapLocationPickerOSM';
import { LocationMarkerIcon, SearchIcon, MapIcon } from '@heroicons/react/outline';

export default function QuickLocationTools({ 
  onOpenChange, 
  onSelect, 
  required = false,
  title = 'Quick Location Tools'
}: { 
  onOpenChange?: (open: boolean) => void; 
  onSelect?: (location: { lat: number; lng: number; address?: string }) => void;
  required?: boolean;
  title?: string;
}) {
  const [lat, setLat] = useState<string>('');
  const [lng, setLng] = useState<string>('');
  const [query, setQuery] = useState<string>('');
  const [showPicker, setShowPicker] = useState<boolean>(false);
  const [initialLocation, setInitialLocation] = useState<{ lat: number; lng: number } | undefined>(undefined);
  const [selected, setSelected] = useState<{ lat: number; lng: number; address?: string } | null>(null);

  const openPicker = (center?: { lat: number; lng: number }) => {
    setInitialLocation(center);
    setShowPicker(true);
    onOpenChange?.(true);
  };

  const handleSearch = async () => {
    if (!query.trim()) return;
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1&addressdetails=1`);
      const results = await response.json();
      if (results && results.length > 0) {
        const hit = results[0];
        const hitLat = parseFloat(hit.lat);
        const hitLng = parseFloat(hit.lon);
        openPicker({ lat: hitLat, lng: hitLng });
      } else {
        openPicker(undefined);
      }
    } catch (_e) {
      openPicker(undefined);
    }
  };

  const handleSetCoords = () => {
    const latNum = parseFloat(lat);
    const lngNum = parseFloat(lng);
    if (isFinite(latNum) && isFinite(lngNum)) {
      openPicker({ lat: latNum, lng: lngNum });
    } else {
      openPicker(undefined);
    }
  };

  const handleCurrentLocation = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setSelected(loc);
        onSelect?.(loc);
      },
      () => {
        // ignore errors silently as per concise requirement
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-4 sm:p-5 mb-4">
      <div className="flex items-center mb-3">
        <MapIcon className="h-5 w-5 text-indigo-600 mr-2" />
        <h3 className="text-sm sm:text-base font-semibold text-gray-900">{title} {required && <span className="ml-2 text-xs text-red-600">(Required)</span>}</h3>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="flex items-center gap-2">
          <input
            type="text"
            inputMode="decimal"
            placeholder="Latitude"
            value={lat}
            onChange={(e) => setLat(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          />
          <input
            type="text"
            inputMode="decimal"
            placeholder="Longitude"
            value={lng}
            onChange={(e) => setLng(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          />
          <button
            onClick={handleSetCoords}
            className="px-3 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
          >
            Set
          </button>
        </div>

        <div className="flex items-center gap-2 md:col-span-2">
          <input
            type="text"
            placeholder="Search any place or address"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          />
          <button
            onClick={handleSearch}
            className="px-3 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 inline-flex items-center"
          >
            <SearchIcon className="h-4 w-4 mr-1" /> Find
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleCurrentLocation}
            className="w-full px-3 py-2 bg-gray-700 text-white rounded-md hover:bg-gray-800 inline-flex items-center justify-center"
          >
            <LocationMarkerIcon className="h-4 w-4 mr-1" /> Current
          </button>
        </div>
      </div>

      {selected && (
        <div className="mt-3 text-sm text-gray-700">
          <span className="font-medium">Selected:</span> {selected.lat.toFixed(6)}, {selected.lng.toFixed(6)}
          {selected.address && <span className="text-gray-500"> — {selected.address}</span>}
        </div>
      )}

      {showPicker && (
        <MapLocationPickerOSM
          onLocationSelect={(loc) => { setSelected(loc); onSelect?.(loc); setShowPicker(false); onOpenChange?.(false); }}
          onClose={() => { setShowPicker(false); onOpenChange?.(false); }}
          initialLocation={initialLocation}
          title="Pick Exact Location"
        />
      )}
    </div>
  );
}


