import React, { useState, useEffect, useCallback, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle, useMapEvents, useMap } from 'react-leaflet';
import OfflineCapableMap from '../maps/OfflineCapableMap';
import L from 'leaflet';
import { GeofencingService, Geofence } from '../../services/GeofencingService';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import {
  MapIcon,
  PlusIcon,
  PencilIcon,
  TrashIcon,
  EyeIcon,
  EyeOffIcon,
  LocationMarkerIcon,
  CheckCircleIcon,
  XCircleIcon,
} from '@heroicons/react/outline';
import toast from 'react-hot-toast';
import { AlertService } from '../../services/AlertService';
import QuickLocationTools from './QuickLocationTools';

// Fix for default markers
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

interface GeofenceManagerOSMProps {
  onGeofenceSelect?: (geofence: Geofence) => void;
  selectedGeofenceId?: string;
}

// Component for handling map clicks and creating geofences
function MapClickHandler({ 
  isCreating, 
  onLocationSelect, 
  tempLocation 
}: { 
  isCreating: boolean;
  onLocationSelect: (lat: number, lng: number) => void;
  tempLocation: { lat: number; lng: number } | null;
}) {
  const map = useMap();

  useMapEvents({
    click(e) {
      if (isCreating) {
        onLocationSelect(e.latlng.lat, e.latlng.lng);
      }
    },
  });

  // Auto-zoom to Sri Lanka bounds
  useEffect(() => {
    const sriLankaBounds = L.latLngBounds(
      [5.9169, 79.6951], // Southwest
      [9.8317, 81.8914]  // Northeast
    );
    map.fitBounds(sriLankaBounds);
  }, [map]);

  return tempLocation ? (
    <Marker
      position={[tempLocation.lat, tempLocation.lng]}
      icon={L.divIcon({
        className: 'temp-marker',
        html: `
          <div style="
            width: 40px;
            height: 40px;
            background: #10b981;
            border: 3px solid white;
            border-radius: 50%;
            box-shadow: 0 4px 8px rgba(0,0,0,0.3);
            display: flex;
            align-items: center;
            justify-content: center;
            animation: pulse 2s infinite;
          ">
            <span style="color: white; font-size: 18px;">📍</span>
          </div>
          <style>
            @keyframes pulse {
              0% { transform: scale(1); }
              50% { transform: scale(1.1); }
              100% { transform: scale(1); }
            }
          </style>
        `,
        iconSize: [40, 40],
        iconAnchor: [20, 20],
      })}
    >
      <Popup>
        <div className="text-center">
          <p className="font-semibold text-green-600">New Geofence Location</p>
          <p className="text-sm text-gray-600">
            Lat: {tempLocation.lat.toFixed(6)}<br />
            Lng: {tempLocation.lng.toFixed(6)}
          </p>
        </div>
      </Popup>
    </Marker>
  ) : null;
}

// Component for map controls
function MapControls({ onZoomToSriLanka, onGetCurrentLocation }: {
  onZoomToSriLanka: () => void;
  onGetCurrentLocation: () => void;
}) {
  return (
    <div className="absolute top-4 right-4 z-[1000] space-y-2">
      <button
        onClick={onZoomToSriLanka}
        className="bg-white hover:bg-gray-50 border border-gray-300 rounded-lg p-2 shadow-lg transition-colors"
        title="Zoom to Sri Lanka"
      >
        🇱🇰
      </button>
      <button
        onClick={onGetCurrentLocation}
        className="bg-white hover:bg-gray-50 border border-gray-300 rounded-lg p-2 shadow-lg transition-colors"
        title="Get Current Location"
      >
        <LocationMarkerIcon className="h-5 w-5 text-blue-600" />
      </button>
    </div>
  );
}

export default function GeofenceManagerOSM({ onGeofenceSelect, selectedGeofenceId }: GeofenceManagerOSMProps) {
  const { user } = useAuth();
  const [geofences, setGeofences] = useState<Geofence[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [editingGeofence, setEditingGeofence] = useState<Geofence | null>(null);
  const [tempLocation, setTempLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    radius_meters: 100,
  });

  const mapRef = useRef<L.Map | null>(null);

  useEffect(() => {
    fetchGeofences();
  }, []);

  const fetchGeofences = async () => {
    try {
      const data = await GeofencingService.getGeofences(false); // Include inactive
      setGeofences(data);
    } catch (error) {
      console.error('Error fetching geofences:', error);
      toast.error('Failed to fetch geofences');
    } finally {
      setLoading(false);
    }
  };

  const handleLocationSelect = (lat: number, lng: number) => {
    setTempLocation({ lat, lng });
    
    // Zoom in to the selected location for better precision
    if (mapRef.current) {
      mapRef.current.setView([lat, lng], 16);
    }
    
    toast.success('Location selected! Fill in the details and create the geofence.');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) {
      toast.error('User not authenticated');
      return;
    }

    if (!formData.name.trim()) {
      toast.error('Geofence name is required');
      return;
    }

    if (!tempLocation && !editingGeofence) {
      toast.error('Please select a location on the map');
      return;
    }

    if (formData.radius_meters <= 0) {
      toast.error('Radius must be greater than 0');
      return;
    }

    try {
      if (editingGeofence) {
        await GeofencingService.updateGeofence(editingGeofence.id, {
          name: formData.name,
          description: formData.description,
          radius_meters: formData.radius_meters,
        });
        toast.success('Geofence updated successfully');
      } else {
        if (!tempLocation) {
          toast.error('Please select a location on the map');
          return;
        }

        await GeofencingService.createGeofence({
          name: formData.name,
          description: formData.description,
          center_latitude: tempLocation.lat,
          center_longitude: tempLocation.lng,
          radius_meters: formData.radius_meters,
          created_by: user.id,
          is_active: true,
        });
        toast.success('Geofence created successfully');
      }
      
      resetForm();
      fetchGeofences();
    } catch (error: any) {
      console.error('Error saving geofence:', error);
      
      let errorMessage = 'Failed to save geofence';
      if (error.message?.includes('Geofences table not found')) {
        errorMessage = 'Database not set up. Please contact administrator.';
      } else if (error.message?.includes('permission denied')) {
        errorMessage = 'You do not have permission to create geofences';
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      toast.error(errorMessage);
    }
  };

  const handleEdit = (geofence: Geofence) => {
    setEditingGeofence(geofence);
    setFormData({
      name: geofence.name,
      description: geofence.description || '',
      radius_meters: geofence.radius_meters,
    });
    setTempLocation({
      lat: geofence.center_latitude,
      lng: geofence.center_longitude,
    });
    setIsCreating(true);

    // Zoom to the geofence location
    if (mapRef.current) {
      mapRef.current.setView([geofence.center_latitude, geofence.center_longitude], 16);
    }
  };

  const handleDelete = async (geofence: Geofence) => {
    const confirmed = await AlertService.confirm({
      title: 'Delete geofence?',
      text: `Are you sure you want to delete the geofence "${geofence.name}"?`,
      confirmText: 'Delete',
      cancelText: 'Cancel',
      icon: 'warning'
    });
    if (!confirmed) return;

    try {
      await GeofencingService.deleteGeofence(geofence.id);
      toast.success('Geofence deleted successfully');
      fetchGeofences();
    } catch (error) {
      console.error('Error deleting geofence:', error);
      toast.error('Failed to delete geofence');
    }
  };

  const toggleActive = async (geofence: Geofence) => {
    try {
      await GeofencingService.updateGeofence(geofence.id, {
        is_active: !geofence.is_active,
      });
      toast.success(`Geofence ${geofence.is_active ? 'deactivated' : 'activated'}`);
      fetchGeofences();
    } catch (error) {
      console.error('Error toggling geofence status:', error);
      toast.error('Failed to update geofence status');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      radius_meters: 100,
    });
    setIsCreating(false);
    setEditingGeofence(null);
    setTempLocation(null);
  };

  const getCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          setTempLocation({ lat, lng });
          
          if (mapRef.current) {
            mapRef.current.setView([lat, lng], 16);
          }
          
          toast.success('Current location set');
        },
        (error) => {
          console.error('Error getting location:', error);
          toast.error('Failed to get current location');
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

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-between items-start sm:items-center">
        <h2 className="text-2xl font-bold text-gray-900">Geofence Management</h2>
        <button
          onClick={() => setIsCreating(true)}
          className="w-full sm:w-auto inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        >
          <PlusIcon className="h-5 w-5 mr-2" />
          Create Geofence
        </button>
      </div>

      {/* Interactive Map */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">
            {isCreating ? 'Click on the map to select location' : 'Geofence Locations'}
          </h3>
          {isCreating && (
            <p className="text-sm text-gray-600 mt-1">
              Click anywhere on the map to set the center of your new geofence. Use the controls to zoom and navigate.
            </p>
          )}
        </div>
        
        <div className="relative map-container" style={{ height: '500px' }}>
          <OfflineCapableMap
            center={[7.8731, 80.7718]} // Central Sri Lanka
            zoom={8}
            style={{ height: '100%', width: '100%' }}
            onMapReady={(map) => { mapRef.current = map; }}
            enableOfflineSupport={true}
            preloadRadius={10} // Cache 10km radius
          >
            <MapClickHandler
              isCreating={isCreating}
              onLocationSelect={handleLocationSelect}
              tempLocation={tempLocation}
            />

            {/* Existing Geofences */}
            {geofences.map((geofence) => (
              <React.Fragment key={geofence.id}>
                <Marker
                  position={[geofence.center_latitude, geofence.center_longitude]}
                  eventHandlers={{
                    click: () => onGeofenceSelect?.(geofence),
                  }}
                >
                  <Popup>
                    <div className="p-2">
                      <h4 className="font-semibold text-gray-900">{geofence.name}</h4>
                      {geofence.description && (
                        <p className="text-sm text-gray-600 mt-1">{geofence.description}</p>
                      )}
                      <div className="mt-2 text-xs text-gray-500">
                        <p>Radius: {geofence.radius_meters}m</p>
                        <p>Status: {geofence.is_active ? 'Active' : 'Inactive'}</p>
                        <p>Created: {new Date(geofence.created_at).toLocaleDateString()}</p>
                      </div>
                    </div>
                  </Popup>
                </Marker>
                
                <Circle
                  center={[geofence.center_latitude, geofence.center_longitude]}
                  radius={geofence.radius_meters}
                  pathOptions={{
                    color: geofence.is_active ? '#10b981' : '#6b7280',
                    weight: 2,
                    opacity: 0.8,
                    fillColor: geofence.is_active ? '#10b981' : '#6b7280',
                    fillOpacity: 0.2,
                  }}
                />
              </React.Fragment>
            ))}

            {/* Temporary geofence preview */}
            {tempLocation && (
              <Circle
                center={[tempLocation.lat, tempLocation.lng]}
                radius={formData.radius_meters}
                pathOptions={{
                  color: '#3b82f6',
                  weight: 3,
                  opacity: 0.8,
                  fillColor: '#3b82f6',
                  fillOpacity: 0.3,
                  dashArray: '10, 10',
                }}
              />
            )}
          </OfflineCapableMap>

          <div className="map-controls">
            <button
              onClick={zoomToSriLanka}
              className="map-control-button"
              title="Zoom to Sri Lanka"
            >
              🇱🇰
            </button>
            <button
              onClick={getCurrentLocation}
              className="map-control-button"
              title="Get Current Location"
            >
              <LocationMarkerIcon className="h-5 w-5 text-blue-600" />
            </button>
          </div>
        </div>
      </div>

      {/* Create/Edit Form */}
      {isCreating && (
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-gray-900">
              {editingGeofence ? 'Edit Geofence' : 'Create New Geofence'}
            </h3>
            <button
              onClick={resetForm}
              className="text-gray-400 hover:text-gray-600"
            >
              <XCircleIcon className="h-6 w-6" />
            </button>
          </div>

          {/* Required location tools */}
          <QuickLocationTools
            title="Select Geofence Center"
            required
            onOpenChange={(open) => {
              // When picker is open, avoid double map rendering by hiding the big map via CSS overlay
              const container = document.querySelector('.map-container') as HTMLElement | null;
              if (container) container.style.visibility = open ? 'hidden' : 'visible';
            }}
            onSelect={(loc) => {
              setTempLocation({ lat: loc.lat, lng: loc.lng });
            }}
          />
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Name *</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                  placeholder="Enter geofence name"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700">Radius (meters) *</label>
                <input
                  type="number"
                  required
                  min="10"
                  max="10000"
                  value={formData.radius_meters}
                  onChange={(e) => setFormData(prev => ({ ...prev, radius_meters: parseInt(e.target.value) || 100 }))}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                  placeholder="100"
                />
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700">Description</label>
              <textarea
                rows={3}
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                placeholder="Optional description"
              />
            </div>

            {tempLocation && (
              <div className="bg-green-50 rounded-lg p-3">
                <div className="flex items-center">
                  <CheckCircleIcon className="h-5 w-5 text-green-500 mr-2" />
                  <span className="text-sm font-medium text-green-800">Location Selected</span>
                </div>
                <p className="text-sm text-green-700 mt-1">
                  Latitude: {tempLocation.lat.toFixed(6)}, Longitude: {tempLocation.lng.toFixed(6)}
                </p>
              </div>
            )}
            
            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={resetForm}
                className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!tempLocation && !editingGeofence}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {editingGeofence ? 'Update' : 'Create'} Geofence
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Geofences List */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">Existing Geofences</h3>
        </div>
        
        {geofences.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <MapIcon className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No geofences</h3>
            <p className="mt-1 text-sm text-gray-500">Get started by creating a new geofence.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {geofences.map((geofence) => (
              <div
                key={geofence.id}
                className={`px-6 py-4 hover:bg-gray-50 cursor-pointer ${
                  selectedGeofenceId === geofence.id ? 'bg-indigo-50' : ''
                }`}
                onClick={() => onGeofenceSelect?.(geofence)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center">
                      <h4 className="text-lg font-medium text-gray-900">{geofence.name}</h4>
                      <span className={`ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        geofence.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                      }`}>
                        {geofence.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    {geofence.description && (
                      <p className="text-sm text-gray-600 mt-1">{geofence.description}</p>
                    )}
                    <div className="mt-2 flex items-center space-x-4 text-sm text-gray-500">
                      <span>Radius: {geofence.radius_meters}m</span>
                      <span>
                        Location: {geofence.center_latitude.toFixed(6)}, {geofence.center_longitude.toFixed(6)}
                      </span>
                      <span>Created: {new Date(geofence.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                  
                  <div className="ml-6 flex items-center space-x-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleActive(geofence);
                      }}
                      className={`inline-flex items-center p-2 border border-transparent rounded-md shadow-sm text-white ${
                        geofence.is_active ? 'bg-gray-600 hover:bg-gray-700' : 'bg-green-600 hover:bg-green-700'
                      }`}
                      title={geofence.is_active ? 'Deactivate' : 'Activate'}
                    >
                      {geofence.is_active ? (
                        <EyeOffIcon className="h-4 w-4" />
                      ) : (
                        <EyeIcon className="h-4 w-4" />
                      )}
                    </button>
                    
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEdit(geofence);
                      }}
                      className="inline-flex items-center p-2 border border-transparent rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700"
                      title="Edit"
                    >
                      <PencilIcon className="h-4 w-4" />
                    </button>
                    
                    <button
                      onClick={async (e) => {
                        e.stopPropagation();
                        await handleDelete(geofence);
                      }}
                      className="inline-flex items-center p-2 border border-transparent rounded-md shadow-sm text-white bg-red-600 hover:bg-red-700"
                      title="Delete"
                    >
                      <TrashIcon className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}