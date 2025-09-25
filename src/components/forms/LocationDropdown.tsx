import React, { useEffect, useMemo, useState } from 'react';
import { GeofencingService, Geofence } from '../../services/GeofencingService';
import { SearchIcon, LocationMarkerIcon } from '@heroicons/react/outline';
import toast from 'react-hot-toast';

export default function LocationDropdown({
  value,
  onChange,
  placeholder = 'Search saved locations...'
}: {
  value: string;
  onChange: (option: { id: string; name: string } | null) => void;
  placeholder?: string;
}) {
  const [items, setItems] = useState<Geofence[]>([]);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const data = await GeofencingService.getGeofences(true);
        setItems(data);
      } catch (e) {
        console.error('Failed to load locations', e);
        toast.error('Failed to load locations');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(i =>
      i.name.toLowerCase().includes(q) || (i.description || '').toLowerCase().includes(q)
    );
  }, [items, query]);

  const selected = useMemo(() => items.find(i => i.id === value) || null, [items, value]);

  return (
    <div className="relative">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <SearchIcon className="h-4 w-4 text-gray-400 absolute left-3 top-3" />
          <input
            value={query}
            onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
            onFocus={() => setOpen(true)}
            placeholder={placeholder}
            className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>
        {selected ? (
          <button
            onClick={() => { onChange(null); setQuery(''); }}
            className="px-3 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
          >
            Clear
          </button>
        ) : null}
      </div>

      {open && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-auto">
          {loading ? (
            <div className="p-3 text-sm text-gray-500">Loading...</div>
          ) : filtered.length === 0 ? (
            <div className="p-3 text-sm text-gray-500">No locations found</div>
          ) : (
            filtered.map(loc => (
              <button
                key={loc.id}
                onClick={() => { onChange({ id: loc.id, name: loc.name }); setOpen(false); setQuery(loc.name); }}
                className={`w-full text-left px-3 py-2 hover:bg-indigo-50 ${value === loc.id ? 'bg-indigo-50' : ''}`}
              >
                <div className="flex items-center">
                  <LocationMarkerIcon className="h-4 w-4 text-indigo-600 mr-2" />
                  <div>
                    <div className="text-sm font-medium text-gray-900">{loc.name}</div>
                    {loc.description && (
                      <div className="text-xs text-gray-500">{loc.description}</div>
                    )}
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      )}

      {selected && (
        <div className="mt-1 text-xs text-gray-600">Lat {selected.center_latitude.toFixed(6)}, Lng {selected.center_longitude.toFixed(6)}</div>
      )}
    </div>
  );
}


