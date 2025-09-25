import React, { useState, useEffect, useCallback, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { EnhancedLocationService } from '../../services/EnhancedLocationService';
import { GeofencingService, Geofence, LocationAlert } from '../../services/GeofencingService';
import { supabase } from '../../lib/supabase';
import { Task, User } from '../../types/index';
import { formatCurrency } from '../../utils/currency';
import {
  LocationMarkerIcon,
  ExclamationIcon,
  CheckCircleIcon,
  ClockIcon,
  UserGroupIcon,
  MapIcon,
  BellIcon,
} from '@heroicons/react/outline';
import toast from 'react-hot-toast';

const center: [number, number] = [7.8731, 80.7718]; // Central Sri Lanka

// Custom marker icons
const createTaskMarker = (task: Task, isCompleted: boolean) => {
  const statusColor = isCompleted ? '#10b981' : '#f59e0b';
  const priorityColor = task.priority === 'High' ? '#ef4444' : task.priority === 'Medium' ? '#f59e0b' : '#10b981';
  
  return L.divIcon({
    className: 'custom-marker',
    html: `
      <div style="
        width: 48px;
        height: 48px;
        position: relative;
        display: flex;
        align-items: center;
        justify-content: center;
      ">
        <!-- Outer ring -->
        <div style="
          position: absolute;
          width: 48px;
          height: 48px;
          background: ${statusColor};
          border-radius: 50%;
          opacity: 0.3;
          filter: blur(2px);
        "></div>
        
        <!-- Main marker -->
        <div style="
          position: absolute;
          width: 36px;
          height: 36px;
          background: ${statusColor};
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
            font-size: 14px;
          ">📋</span>
        </div>
        
        <!-- Priority indicator -->
        <div style="
          position: absolute;
          top: -2px;
          right: -2px;
          width: 16px;
          height: 16px;
          background: ${priorityColor};
          border-radius: 50%;
          border: 2px solid white;
          box-shadow: 0 2px 4px rgba(0,0,0,0.3);
        "></div>
        
        <!-- Status indicator -->
        <div style="
          position: absolute;
          bottom: -2px;
          left: -2px;
          width: 16px;
          height: 16px;
          background: ${isCompleted ? '#10b981' : '#6b7280'};
          border-radius: 50%;
          border: 2px solid white;
          box-shadow: 0 2px 4px rgba(0,0,0,0.3);
          display: flex;
          align-items: center;
          justify-content: center;
        ">
          <span style="
            color: white;
            font-size: 8px;
          ">${isCompleted ? '✓' : '○'}</span>
        </div>
      </div>
    `,
    iconSize: [48, 48],
    iconAnchor: [24, 24],
    popupAnchor: [0, -24],
  });
};

const createGeofenceMarker = (geofence: Geofence) => {
  return L.divIcon({
    className: 'custom-marker',
    html: `
      <div style="
        width: 40px;
        height: 40px;
        position: relative;
        display: flex;
        align-items: center;
        justify-content: center;
      ">
        <div style="
          position: absolute;
          width: 40px;
          height: 40px;
          background: #8b5cf6;
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
      </div>
    `,
    iconSize: [40, 40],
    iconAnchor: [20, 20],
    popupAnchor: [0, -20],
  });
};

// Map component that handles map interactions
function MapComponent({ 
  tasks, 
  geofences, 
  selectedTask, 
  onTaskSelect, 
  onGeofenceSelect 
}: {
  tasks: Task[];
  geofences: Geofence[];
  selectedTask: Task | null;
  onTaskSelect: (task: Task) => void;
  onGeofenceSelect: (geofence: Geofence) => void;
}) {
  const map = useMap();

  return (
    <>
      {/* Task Markers */}
      {tasks.map((task) => {
        if (!task.task_locations?.[0]?.required_latitude || !task.task_locations?.[0]?.required_longitude) return null;
        const isCompleted = task.status === 'Completed';
        
        return (
          <Marker
            key={task.id}
            position={[task.task_locations[0].required_latitude, task.task_locations[0].required_longitude]}
            icon={createTaskMarker(task, isCompleted)}
            eventHandlers={{
              click: () => onTaskSelect(task),
            }}
          >
            <Popup>
              <div className="p-3 max-w-sm">
                <div className="flex items-center mb-3">
                  <div className={`w-3 h-3 rounded-full mr-2 ${
                    task.priority === 'High' ? 'bg-red-500' : 
                    task.priority === 'Medium' ? 'bg-yellow-500' : 'bg-green-500'
                  }`}></div>
                  <h4 className="font-semibold text-gray-900">{task.title}</h4>
                </div>
                
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Status:</span>
                    <span className={`font-medium ${
                      isCompleted ? 'text-green-600' : 'text-yellow-600'
                    }`}>
                      {task.status}
                    </span>
                  </div>
                  
                  <div className="flex justify-between">
                    <span className="text-gray-600">Priority:</span>
                    <span className="font-medium capitalize">{task.priority}</span>
                  </div>
                  
                  <div className="flex justify-between">
                    <span className="text-gray-600">Reward:</span>
                    <span className="font-medium text-green-600">{formatCurrency(task.price || 0)}</span>
                  </div>
                  
                  <div className="flex justify-between">
                    <span className="text-gray-600">Due:</span>
                    <span className="font-medium">{new Date(task.due_date).toLocaleDateString()}</span>
                  </div>
                  
                  {task.description && (
                    <div className="mt-2 p-2 bg-gray-50 rounded">
                      <div className="text-xs text-gray-600">{task.description}</div>
                    </div>
                  )}
                </div>
              </div>
            </Popup>
          </Marker>
        );
      })}

      {/* Geofence Markers */}
      {geofences.map((geofence) => (
        <Marker
          key={geofence.id}
          position={[geofence.center_latitude, geofence.center_longitude]}
          icon={createGeofenceMarker(geofence)}
          eventHandlers={{
            click: () => onGeofenceSelect(geofence),
          }}
        >
          <Popup>
            <div className="p-3 max-w-sm">
              <h4 className="font-semibold text-gray-900 mb-2">{geofence.name}</h4>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Radius:</span>
                  <span className="font-medium">{geofence.radius_meters || 100}m</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Type:</span>
                  <span className="font-medium capitalize">Geofence</span>
                </div>
                {geofence.description && (
                  <div className="mt-2 text-xs text-gray-600">{geofence.description}</div>
                )}
              </div>
            </div>
          </Popup>
        </Marker>
      ))}

      {/* Geofence Circles */}
      {geofences.map((geofence) => (
        <Circle
          key={`circle-${geofence.id}`}
          center={[geofence.center_latitude, geofence.center_longitude]}
          radius={geofence.radius_meters || 100}
          pathOptions={{
            color: '#8b5cf6',
            weight: 2,
            opacity: 0.6,
            fillColor: '#8b5cf6',
            fillOpacity: 0.1,
          }}
        />
      ))}
    </>
  );
}

export default function LocationTaskDashboardOSM() {
  console.log('LocationTaskDashboardOSM component rendering...');
  
  const [tasks, setTasks] = useState<Task[]>([]);
  const [geofences, setGeofences] = useState<Geofence[]>([]);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [selectedGeofence, setSelectedGeofence] = useState<Geofence | null>(null);
  const [alerts, setAlerts] = useState<LocationAlert[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState({
    totalTasks: 0,
    completedTasks: 0,
    pendingTasks: 0,
    totalReward: 0,
    completedReward: 0,
  });

  const mapRef = useRef<L.Map>(null);
  
  function PickHandler({ onPick }: { onPick: (lat: number, lng: number) => void }) {
    useMapEvents({
      click(e) {
        onPick(e.latlng.lat, e.latlng.lng);
      },
    });
    return null;
  }

  // Manual controls state
  const [latInput, setLatInput] = useState<string>('');
  const [lngInput, setLngInput] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [searchResults, setSearchResults] = useState<Array<{ display_name: string; lat: number; lon: number }>>([]);
  const [pickedPoint, setPickedPoint] = useState<{ lat: number; lng: number } | null>(null);
  const [isPickMode, setIsPickMode] = useState<boolean>(false);

  const fetchTasks = useCallback(async () => {
    try {
      setIsLoading(true);
      console.log('Fetching tasks with location data...');
      
      // First, test basic connection with a simple query
      const { data: testData, error: testError } = await supabase
        .from('tasks')
        .select('id')
        .limit(1);
      
      if (testError) {
        console.error('Database connection error:', testError);
        throw new Error(`Database connection failed: ${testError.message}`);
      }
      
      console.log('Database connection successful');
      
      // Now try to get tasks with location data
      const { data, error } = await supabase
        .from('tasks')
        .select(`
          *,
          assigned_to:users!tasks_assigned_to_fkey(id, full_name, email, avatar_url),
          task_locations(required_latitude, required_longitude, required_radius_meters)
        `)
        .not('task_locations.required_latitude', 'is', null)
        .not('task_locations.required_longitude', 'is', null);

      console.log('Location tasks query result:', { data, error });

      if (error) {
        console.error('Location tasks query error:', error);
        // If no location tasks found, show empty state instead of error
        setTasks([]);
        setError(null);
        return;
      }

      console.log('Tasks loaded:', data?.length || 0);
      setTasks(data || []);
      
      // Calculate stats
      const totalTasks = data?.length || 0;
      const completedTasks = data?.filter(t => t.status === 'Completed').length || 0;
      const pendingTasks = totalTasks - completedTasks;
      const totalReward = data?.reduce((sum, t) => sum + (t.price || 0), 0) || 0;
      const completedReward = data?.filter(t => t.status === 'Completed').reduce((sum, t) => sum + (t.price || 0), 0) || 0;

      setStats({
        totalTasks,
        completedTasks,
        pendingTasks,
        totalReward,
        completedReward,
      });
    } catch (error) {
      console.error('Error fetching tasks:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      setError(`Failed to load tasks: ${errorMessage}`);
      toast.error(`Failed to load tasks: ${errorMessage}`);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchGeofences = useCallback(async () => {
    try {
      const data = await GeofencingService.getGeofences();
      setGeofences(data);
    } catch (error) {
      console.error('Error fetching geofences:', error);
    }
  }, []);

  const fetchAlerts = useCallback(async () => {
    try {
      const data = await GeofencingService.getLocationAlerts('all');
      setAlerts(data);
    } catch (error) {
      console.error('Error fetching alerts:', error);
    }
  }, []);

  useEffect(() => {
    fetchTasks();
    fetchGeofences();
    fetchAlerts();
  }, [fetchTasks, fetchGeofences, fetchAlerts]);

  const handleTaskSelect = (task: Task) => {
    setSelectedTask(task);
    setSelectedGeofence(null);
  };

  const handleGeofenceSelect = (geofence: Geofence) => {
    setSelectedGeofence(geofence);
    setSelectedTask(null);
  };

  const fitAllTasks = () => {
    if (tasks.length > 0 && mapRef.current) {
      const group = L.featureGroup(
        tasks
          .filter(t => t.task_locations?.[0]?.required_latitude && t.task_locations?.[0]?.required_longitude)
          .map(t => L.marker([t.task_locations?.[0]?.required_latitude || 0, t.task_locations?.[0]?.required_longitude || 0]))
      );
      mapRef.current.fitBounds(group.getBounds().pad(0.1));
    }
  };

  const zoomToSriLanka = () => {
    if (mapRef.current) {
      mapRef.current.setView(center, 8);
    }
  };

  // Helpers for manual controls
  const centerToInputs = () => {
    const lat = parseFloat(latInput);
    const lon = parseFloat(lngInput);
    if (Number.isFinite(lat) && Number.isFinite(lon) && mapRef.current) {
      mapRef.current.setView([lat, lon], Math.max(18, mapRef.current.getZoom()));
      setPickedPoint({ lat, lng: lon });
    }
  };

  const getCurrentLocation = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;
        setLatInput(String(lat));
        setLngInput(String(lon));
        if (mapRef.current) {
          mapRef.current.setView([lat, lon], 18);
        }
        setPickedPoint({ lat, lng: lon });
      },
      () => {},
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const searchLocation = async () => {
    const q = searchQuery.trim();
    if (!q) return;
    setIsSearching(true);
    try {
      const resp = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&addressdetails=1&limit=7`);
      const data = await resp.json();
      const first = data?.[0];
      if (first && mapRef.current) {
        const lat = parseFloat(first.lat);
        const lon = parseFloat(first.lon);
        mapRef.current.setView([lat, lon], 18);
        setPickedPoint({ lat, lng: lon });
      }
    } catch {}
    finally {
      setIsSearching(false);
    }
  };

  const zoomIn = () => {
    if (!mapRef.current) return;
    mapRef.current.setZoom(Math.min(25, mapRef.current.getZoom() + 1));
  };

  const zoomOut = () => {
    if (!mapRef.current) return;
    mapRef.current.setZoom(Math.max(1, mapRef.current.getZoom() - 1));
  };

  const centerToInputs = () => {
    const lat = parseFloat(latInput);
    const lon = parseFloat(lngInput);
    if (Number.isFinite(lat) && Number.isFinite(lon) && mapRef.current) {
      mapRef.current.setView([lat, lon], Math.max(18, mapRef.current.getZoom()));
      setPickedPoint({ lat, lng: lon });
    }
  };

  const getCurrentLocation = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;
        setLatInput(String(lat));
        setLngInput(String(lon));
        if (mapRef.current) {
          mapRef.current.setView([lat, lon], 18);
        }
        setPickedPoint({ lat, lng: lon });
      },
      () => {},
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const searchLocation = async () => {
    const q = searchQuery.trim();
    if (!q) return;
    setIsSearching(true);
    try {
      const resp = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&addressdetails=1&limit=7`);
      const data = await resp.json();
      const items = (data || []).map((r: any) => ({ display_name: r.display_name, lat: parseFloat(r.lat), lon: parseFloat(r.lon) }));
      setSearchResults(items);
      if (items[0] && mapRef.current) {
        mapRef.current.setView([items[0].lat, items[0].lon], 18);
        setPickedPoint({ lat: items[0].lat, lng: items[0].lon });
      }
    } catch {
      // ignore
    } finally {
      setIsSearching(false);
    }
  };

  const zoomIn = () => {
    if (!mapRef.current) return;
    const z = mapRef.current.getZoom();
    mapRef.current.setZoom(Math.min(25, z + 1));
  };

  const zoomOut = () => {
    if (!mapRef.current) return;
    const z = mapRef.current.getZoom();
    mapRef.current.setZoom(Math.max(1, z - 1));
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Loading Location Dashboard</h3>
          <p className="text-gray-600">Fetching tasks and geofences...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-red-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full">
          <div className="flex items-center mb-4">
            <ExclamationIcon className="h-8 w-8 text-red-500 mr-3" />
            <h3 className="text-lg font-semibold text-red-800">Error</h3>
          </div>
          <p className="text-red-600 mb-4">{error}</p>
          <div className="space-y-2">
            <button
              onClick={() => {
                setError(null);
                fetchTasks();
              }}
              className="w-full bg-red-600 text-white py-2 px-4 rounded-md hover:bg-red-700 transition-colors"
            >
              Retry
            </button>
            <button
              onClick={() => {
                setError(null);
                setTasks([]);
              }}
              className="w-full bg-gray-600 text-white py-2 px-4 rounded-md hover:bg-gray-700 transition-colors"
            >
              Continue Without Tasks
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50">
      {/* Header */}
      <div className="bg-white shadow-lg border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-2 sm:px-4 md:px-6 lg:px-8 py-3 sm:py-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h1 className="text-lg sm:text-2xl font-bold text-gray-900 flex items-center">
                <MapIcon className="h-5 w-5 sm:h-7 sm:w-7 mr-2 sm:mr-3 text-indigo-600" />
                <span className="hidden sm:inline">Location Task Dashboard (OpenStreetMap)</span>
                <span className="sm:hidden">Location Tasks</span>
              </h1>
              <p className="text-xs sm:text-sm text-gray-600 mt-1">
                Monitor location-based tasks and geofences using OpenStreetMap
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
              <button
                onClick={zoomToSriLanka}
                className="w-full sm:w-auto inline-flex items-center justify-center bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition-colors touch-manipulation transform active:scale-95"
              >
                🇱🇰 Sri Lanka View
              </button>
              <button
                onClick={fitAllTasks}
                className="w-full sm:w-auto inline-flex items-center justify-center bg-green-600 text-white py-2 px-4 rounded-md hover:bg-green-700 transition-colors touch-manipulation transform active:scale-95"
              >
                Fit All Tasks
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="max-w-7xl mx-auto px-2 sm:px-4 md:px-6 lg:px-8 py-4 sm:py-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4 mb-4 sm:mb-6">
          <div className="bg-white rounded-lg shadow p-4 sm:p-6">
            <div className="flex items-center">
              <div className="p-2 bg-blue-100 rounded-lg flex-shrink-0">
                <UserGroupIcon className="h-5 w-5 sm:h-6 sm:w-6 text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-xs sm:text-sm font-medium text-gray-600">Total Tasks</p>
                <p className="text-lg sm:text-2xl font-semibold text-gray-900">{stats.totalTasks}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-4 sm:p-6">
            <div className="flex items-center">
              <div className="p-2 bg-green-100 rounded-lg flex-shrink-0">
                <CheckCircleIcon className="h-5 w-5 sm:h-6 sm:w-6 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-xs sm:text-sm font-medium text-gray-600">Completed</p>
                <p className="text-lg sm:text-2xl font-semibold text-gray-900">{stats.completedTasks}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-4 sm:p-6">
            <div className="flex items-center">
              <div className="p-2 bg-yellow-100 rounded-lg flex-shrink-0">
                <ClockIcon className="h-5 w-5 sm:h-6 sm:w-6 text-yellow-600" />
              </div>
              <div className="ml-4">
                <p className="text-xs sm:text-sm font-medium text-gray-600">Pending</p>
                <p className="text-lg sm:text-2xl font-semibold text-gray-900">{stats.pendingTasks}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-4 sm:p-6">
            <div className="flex items-center">
              <div className="p-2 bg-purple-100 rounded-lg flex-shrink-0">
                <LocationMarkerIcon className="h-5 w-5 sm:h-6 sm:w-6 text-purple-600" />
              </div>
              <div className="ml-4">
                <p className="text-xs sm:text-sm font-medium text-gray-600">Total Reward</p>
                <p className="text-lg sm:text-2xl font-semibold text-gray-900">{formatCurrency(stats.totalReward)}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-4 sm:p-6">
            <div className="flex items-center">
              <div className="p-2 bg-green-100 rounded-lg flex-shrink-0">
                <CheckCircleIcon className="h-5 w-5 sm:h-6 sm:w-6 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-xs sm:text-sm font-medium text-gray-600">Completed Reward</p>
                <p className="text-lg sm:text-2xl font-semibold text-gray-900">{formatCurrency(stats.completedReward)}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Map Container */}
        <div className="bg-white rounded-xl shadow-xl overflow-hidden">
          {tasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-72 sm:h-96 text-center p-6 sm:p-8">
              <MapIcon className="h-12 w-12 sm:h-16 sm:w-16 text-gray-400 mb-4" />
              <h3 className="text-lg sm:text-xl font-semibold text-gray-900 mb-2">No Location-Based Tasks Found</h3>
              <p className="text-sm sm:text-base text-gray-600 mb-4 max-w-md">
                There are currently no tasks with location requirements. Create tasks with location data to see them on the map.
              </p>
              <div className="bg-blue-50 rounded-lg p-3 sm:p-4 max-w-lg">
                <h4 className="font-medium text-blue-900 mb-2 text-sm sm:text-base">To add location-based tasks:</h4>
                <ul className="text-xs sm:text-sm text-blue-800 space-y-1 text-left">
                  <li>• Go to Tasks → Create Task</li>
                  <li>• Enable "Location Required" option</li>
                  <li>• Set the required latitude and longitude</li>
                  <li>• Save the task to see it on the map</li>
                </ul>
              </div>
            </div>
          ) : (
            <>
              {/* Manual Map Controls */}
              <div className="p-3 border-b border-gray-100 bg-white">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={latInput}
                      onChange={(e) => setLatInput(e.target.value)}
                      placeholder="Latitude"
                      className="flex-1 rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                    />
                    <input
                      type="text"
                      value={lngInput}
                      onChange={(e) => setLngInput(e.target.value)}
                      placeholder="Longitude"
                      className="flex-1 rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                    />
                    <button onClick={centerToInputs} className="px-3 py-2 bg-indigo-600 text-white rounded-md">Center</button>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') searchLocation(); }}
                      placeholder="Search any place or address..."
                      className="flex-1 rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                    />
                    <button onClick={searchLocation} disabled={isSearching} className="px-3 py-2 bg-green-600 text-white rounded-md">{isSearching ? 'Searching...' : 'Search'}</button>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={getCurrentLocation} className="px-3 py-2 bg-blue-600 text-white rounded-md">Current</button>
                    <button onClick={zoomOut} className="px-3 py-2 bg-gray-200 rounded-md">-</button>
                    <button onClick={zoomIn} className="px-3 py-2 bg-gray-200 rounded-md">+</button>
                    <label className="inline-flex items-center gap-2 ml-2 text-sm text-gray-700"><input type="checkbox" checked={isPickMode} onChange={(e) => setIsPickMode(e.target.checked)} className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"/> Pick location</label>
                  </div>
                </div>
              </div>

              <MapContainer
              center={center}
              zoom={8}
              style={{ height: '60vh', width: '100%' }}
              ref={mapRef}
              maxZoom={25}
              zoomAnimation={true}
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              
              <MapComponent
                tasks={tasks}
                geofences={geofences}
                selectedTask={selectedTask}
                onTaskSelect={handleTaskSelect}
                onGeofenceSelect={handleGeofenceSelect}
              />

              {/* Pick mode click handler */}
              {isPickMode && (
                <PickHandler onPick={(lat, lng) => {
                  setLatInput(String(lat));
                  setLngInput(String(lng));
                  setPickedPoint({ lat, lng });
                }} />
              )}

              {/* Picked point marker */}
              {pickedPoint && (
                <Marker position={[pickedPoint.lat, pickedPoint.lng]}>
                  <Popup>
                    <div className="text-sm">
                      <div className="font-semibold mb-1">Picked Location</div>
                      <div>Lat: {pickedPoint.lat.toFixed(6)}</div>
                      <div>Lng: {pickedPoint.lng.toFixed(6)}</div>
                    </div>
                  </Popup>
                </Marker>
              )}
              </MapContainer>
            </>
          )}
        </div>

        {/* Selected Task Details */}
        {selectedTask && (
          <div className="mt-6 bg-white rounded-xl shadow-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Selected Task Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-medium text-gray-900 mb-2">{selectedTask.title}</h4>
                <p className="text-sm text-gray-600 mb-4">{selectedTask.description}</p>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Status:</span>
                    <span className={`font-medium ${
                      selectedTask.status === 'Completed' ? 'text-green-600' : 'text-yellow-600'
                    }`}>
                      {selectedTask.status}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Priority:</span>
                    <span className="font-medium capitalize">{selectedTask.priority}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Reward:</span>
                    <span className="font-medium text-green-600">{formatCurrency(selectedTask.price || 0)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Due Date:</span>
                    <span className="font-medium">{new Date(selectedTask.due_date).toLocaleDateString()}</span>
                  </div>
                </div>
              </div>
              <div>
                <h4 className="font-medium text-gray-900 mb-2">Location</h4>
                <p className="text-sm text-gray-600">
                  Latitude: {selectedTask.task_locations?.[0]?.required_latitude?.toFixed(6)}
                </p>
                <p className="text-sm text-gray-600">
                  Longitude: {selectedTask.task_locations?.[0]?.required_longitude?.toFixed(6)}
                </p>
                {selectedTask.assigned_to && (
                  <div className="mt-4">
                    <h4 className="font-medium text-gray-900 mb-2">Assigned To</h4>
                    <div className="flex items-center">
                      <img
                        src={(selectedTask.assigned_to as any)?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent((selectedTask.assigned_to as any)?.full_name || 'Unknown')}&background=3b82f6&color=fff`}
                        alt={(selectedTask.assigned_to as any)?.full_name || 'Unknown'}
                        className="w-8 h-8 rounded-full mr-3"
                      />
                      <div>
                        <p className="font-medium text-gray-900">{(selectedTask.assigned_to as any)?.full_name || 'Unknown'}</p>
                        <p className="text-sm text-gray-600">{(selectedTask.assigned_to as any)?.email || 'No email'}</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Alerts */}
        {alerts.length > 0 && (
          <div className="mt-6 bg-white rounded-xl shadow-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <BellIcon className="h-5 w-5 mr-2 text-yellow-500" />
              Recent Alerts
            </h3>
            <div className="space-y-3">
              {alerts.slice(0, 5).map((alert) => (
                <div key={alert.id} className="flex items-center p-3 bg-yellow-50 rounded-lg">
                  <ExclamationIcon className="h-5 w-5 text-yellow-500 mr-3" />
                  <div>
                    <p className="font-medium text-gray-900">{alert.message}</p>
                    <p className="text-sm text-gray-600">
                      {new Date(alert.created_at).toLocaleString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
