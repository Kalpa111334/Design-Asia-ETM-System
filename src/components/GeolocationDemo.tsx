import React, { useState, useEffect } from 'react';
import { MapThemeProvider, useMapTheme, MapThemeSelector } from './MapThemeProvider';
import EnhancedOSMMap from './EnhancedOSMMap';
import { EnhancedGeolocationService } from '../services/EnhancedGeolocationService';
import {
  MapIcon,
  LocationMarkerIcon,
  ClockIcon,
  PlayIcon,
  PauseIcon,
  RefreshIcon,
  ChartBarIcon,
  EyeIcon,
  CogIcon
} from '@heroicons/react/outline';

// Demo data
const demoEmployees = [
  {
    id: 'emp-1',
    latitude: 7.8731,
    longitude: 80.7718,
    full_name: 'John Doe',
    email: 'john@example.com',
    connection_status: 'online',
    battery_level: 85,
    movement_type: 'driving',
    recorded_at: new Date().toISOString(),
    address: 'Kandy, Central Province, Sri Lanka'
  },
  {
    id: 'emp-2',
    latitude: 7.2906,
    longitude: 80.6337,
    full_name: 'Jane Smith',
    email: 'jane@example.com',
    connection_status: 'online',
    battery_level: 45,
    movement_type: 'walking',
    recorded_at: new Date().toISOString(),
    address: 'Colombo, Western Province, Sri Lanka'
  },
  {
    id: 'emp-3',
    latitude: 6.9271,
    longitude: 79.8612,
    full_name: 'Mike Johnson',
    email: 'mike@example.com',
    connection_status: 'offline',
    battery_level: 15,
    movement_type: 'stationary',
    recorded_at: new Date(Date.now() - 300000).toISOString(),
    address: 'Galle, Southern Province, Sri Lanka'
  }
];

const demoTasks = [
  {
    id: 'task-1',
    title: 'Site Inspection',
    description: 'Inspect construction site progress',
    status: 'In Progress',
    priority: 'High',
    price: 150,
    due_date: new Date(Date.now() + 86400000).toISOString(),
    location_latitude: 7.8731,
    location_longitude: 80.7718
  },
  {
    id: 'task-2',
    title: 'Client Meeting',
    description: 'Meet with potential client',
    status: 'Planned',
    priority: 'Medium',
    price: 200,
    due_date: new Date(Date.now() + 172800000).toISOString(),
    location_latitude: 7.2906,
    location_longitude: 80.6337
  },
  {
    id: 'task-3',
    title: 'Equipment Check',
    description: 'Check equipment status',
    status: 'Completed',
    priority: 'Low',
    price: 75,
    due_date: new Date(Date.now() - 86400000).toISOString(),
    location_latitude: 6.9271,
    location_longitude: 79.8612
  }
];

const demoLocations = [
  { id: 'loc-1', lat: 7.8731, lng: 80.7718, timestamp: new Date().toISOString() },
  { id: 'loc-2', lat: 7.2906, lng: 80.6337, timestamp: new Date(Date.now() - 60000).toISOString() },
  { id: 'loc-3', lat: 6.9271, lng: 79.8612, timestamp: new Date(Date.now() - 120000).toISOString() }
];

// Main demo component
function GeolocationDemoContent() {
  const { currentTheme } = useMapTheme();
  const [currentLocation, setCurrentLocation] = useState<any>(null);
  const [isTracking, setIsTracking] = useState(false);
  const [movementStats, setMovementStats] = useState({
    totalDistance: 0,
    averageSpeed: 0,
    totalTime: 0,
    activeTime: 0,
    idleTime: 0
  });
  const [showClusters, setShowClusters] = useState(true);
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [selectedMarker, setSelectedMarker] = useState<any>(null);

  const geolocationService = EnhancedGeolocationService.getInstance();

  // Simulate location tracking
  const toggleTracking = () => {
    if (isTracking) {
      setIsTracking(false);
    } else {
      setIsTracking(true);
      // Simulate location updates
      const interval = setInterval(() => {
        if (!isTracking) {
          clearInterval(interval);
          return;
        }
        
        const newLocation = {
          latitude: 7.8731 + (Math.random() - 0.5) * 0.01,
          longitude: 80.7718 + (Math.random() - 0.5) * 0.01,
          accuracy: 5 + Math.random() * 10,
          timestamp: new Date().toISOString(),
          battery_level: 85 - Math.random() * 10,
          connection_status: 'online' as const,
          movement_type: 'driving' as const,
          address: 'Kandy, Central Province, Sri Lanka'
        };
        
        setCurrentLocation(newLocation);
        
        // Update stats
        const stats = {
          totalDistance: 2.5 + Math.random() * 0.5,
          averageSpeed: 25 + Math.random() * 10,
          totalTime: 45 + Math.random() * 15,
          activeTime: 30 + Math.random() * 10,
          idleTime: 15 + Math.random() * 5
        };
        setMovementStats(stats);
      }, 2000);
    }
  };

  const handleMarkerSelect = (marker: any, type: string) => {
    setSelectedMarker({ ...marker, type });
  };

  const formatTime = (minutes: number): string => {
    if (minutes < 60) {
      return `${Math.round(minutes)}m`;
    }
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    return `${hours}h ${mins}m`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50">
      {/* Header */}
      <div className="bg-white shadow-lg border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 flex items-center">
                <MapIcon className="h-10 w-10 mr-4 text-indigo-600" />
                Enhanced Geolocation Demo
              </h1>
              <p className="text-gray-600 mt-2">
                MapBox-like OpenStreetMap integration with advanced geolocation features
              </p>
            </div>

            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <div className={`w-3 h-3 rounded-full ${
                  currentLocation?.connection_status === 'online' ? 'bg-green-500' : 'bg-red-500'
                }`}></div>
                <span className="text-sm text-gray-600">
                  {currentLocation?.connection_status === 'online' ? 'Online' : 'Offline'}
                </span>
              </div>
              
              {currentLocation?.battery_level && (
                <div className="flex items-center space-x-1">
                  <div className="h-4 w-4 text-gray-500">🔋</div>
                  <span className="text-sm text-gray-600">{currentLocation.battery_level}%</span>
                </div>
              )}

              <button
                onClick={toggleTracking}
                className={`flex items-center space-x-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                  isTracking
                    ? 'bg-red-600 text-white hover:bg-red-700'
                    : 'bg-green-600 text-white hover:bg-green-700'
                }`}
              >
                {isTracking ? <PauseIcon className="h-4 w-4" /> : <PlayIcon className="h-4 w-4" />}
                <span>{isTracking ? 'Stop Demo' : 'Start Demo'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Left Sidebar - Controls */}
          <div className="lg:col-span-1 space-y-6">
            {/* Theme Selector */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <CogIcon className="h-5 w-5 mr-2 text-indigo-600" />
                Map Settings
              </h3>
              <MapThemeSelector />
            </div>

            {/* Display Options */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <EyeIcon className="h-5 w-5 mr-2 text-indigo-600" />
                Display Options
              </h3>
              
              <div className="space-y-4">
                <label className="flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showClusters}
                    onChange={(e) => setShowClusters(e.target.checked)}
                    className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="ml-2 text-sm text-gray-700">Show Marker Clusters</span>
                </label>
                
                <label className="flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showHeatmap}
                    onChange={(e) => setShowHeatmap(e.target.checked)}
                    className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="ml-2 text-sm text-gray-700">Show Heatmap Overlay</span>
                </label>
              </div>
            </div>

            {/* Movement Statistics */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <ChartBarIcon className="h-5 w-5 mr-2 text-indigo-600" />
                Movement Stats
              </h3>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">{movementStats.totalDistance.toFixed(1)}</div>
                  <div className="text-sm text-gray-600">Distance (km)</div>
                </div>
                
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">{movementStats.averageSpeed.toFixed(1)}</div>
                  <div className="text-sm text-gray-600">Avg Speed (km/h)</div>
                </div>
                
                <div className="text-center">
                  <div className="text-2xl font-bold text-indigo-600">{formatTime(movementStats.activeTime)}</div>
                  <div className="text-sm text-gray-600">Active Time</div>
                </div>
                
                <div className="text-center">
                  <div className="text-2xl font-bold text-orange-600">{formatTime(movementStats.idleTime)}</div>
                  <div className="text-sm text-gray-600">Idle Time</div>
                </div>
              </div>
            </div>

            {/* Current Location */}
            {currentLocation && (
              <div className="bg-white rounded-xl shadow-lg p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                  <LocationMarkerIcon className="h-5 w-5 mr-2 text-indigo-600" />
                  Current Location
                </h3>
                
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Address:</span>
                    <span className="font-medium text-right text-sm">
                      {currentLocation.address || 'Unknown'}
                    </span>
                  </div>
                  
                  <div className="flex justify-between">
                    <span className="text-gray-600">Accuracy:</span>
                    <span className="font-medium">±{Math.round(currentLocation.accuracy || 0)}m</span>
                  </div>
                  
                  <div className="flex justify-between">
                    <span className="text-gray-600">Movement:</span>
                    <span className="font-medium capitalize">
                      {currentLocation.movement_type || 'Unknown'}
                    </span>
                  </div>
                  
                  <div className="flex justify-between">
                    <span className="text-gray-600">Last Update:</span>
                    <span className="font-medium text-sm">
                      {new Date(currentLocation.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Selected Marker Info */}
            {selectedMarker && (
              <div className="bg-white rounded-xl shadow-lg p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                  <EyeIcon className="h-5 w-5 mr-2 text-indigo-600" />
                  Selected Marker
                </h3>
                
                <div className="space-y-2">
                  <div className="font-medium text-gray-900">
                    {selectedMarker.full_name || selectedMarker.title || 'Location'}
                  </div>
                  
                  <div className="text-sm text-gray-600">
                    Type: {selectedMarker.type}
                  </div>
                  
                  {selectedMarker.email && (
                    <div className="text-sm text-gray-600">
                      {selectedMarker.email}
                    </div>
                  )}
                  
                  {selectedMarker.description && (
                    <div className="text-sm text-gray-600">
                      {selectedMarker.description}
                    </div>
                  )}
                  
                  {selectedMarker.status && (
                    <div className="text-sm">
                      Status: <span className="font-medium">{selectedMarker.status}</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Main Map Area */}
          <div className="lg:col-span-3">
            <div className="bg-white rounded-xl shadow-lg overflow-hidden">
              <div className="p-4 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                  <MapIcon className="h-5 w-5 mr-2 text-indigo-600" />
                  Interactive Map - {currentTheme.name}
                </h3>
                <p className="text-sm text-gray-600 mt-1">
                  Enhanced OpenStreetMap with MapBox-like features
                </p>
              </div>
              
              <div className="h-[700px]">
                <EnhancedOSMMap
                  center={currentLocation ? [currentLocation.latitude, currentLocation.longitude] : [7.8731, 80.7718]}
                  zoom={currentLocation ? 16 : 8}
                  employees={demoEmployees}
                  tasks={demoTasks}
                  locations={demoLocations}
                  onEmployeeSelect={(employee) => handleMarkerSelect(employee, 'employee')}
                  onTaskSelect={(task) => handleMarkerSelect(task, 'task')}
                  onLocationSelect={(location) => handleMarkerSelect(location, 'location')}
                  height="100%"
                  showControls={true}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Wrapper with theme provider
export default function GeolocationDemo() {
  return (
    <MapThemeProvider defaultTheme="light">
      <GeolocationDemoContent />
    </MapThemeProvider>
  );
}
