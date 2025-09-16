import React, { useState, useEffect, useCallback, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, Circle, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { LocationService } from '../services/LocationService';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import {
  UserGroupIcon,
  LocationMarkerIcon,
  AdjustmentsIcon,
  ExclamationIcon,
  ArrowLeftIcon,
  SearchIcon,
  RefreshIcon,
  ViewGridIcon,
  MapIcon,
  ClockIcon,
  ChartBarIcon,
  EyeIcon,
  PlayIcon,
  PauseIcon,
  ChevronDownIcon,
  ChevronUpIcon,
} from '@heroicons/react/outline';
import toast from 'react-hot-toast';
import { GeofencingService } from '../services/GeofencingService';
import { supabase } from '../lib/supabase';
import { ResponsiveContainer, ResponsiveCard, ResponsiveGrid } from './ui/ResponsiveComponents';

interface EmployeeLocation {
  id: string;
  user_id: string;
  latitude: number;
  longitude: number;
  recorded_at: string;
  battery_level?: number;
  connection_status?: string;
  location_accuracy?: number;
  task_id?: string;
  full_name: string;
  avatar_url?: string;
  email: string;
  task_title?: string;
  task_status?: string;
  task_due_date?: string;
  address?: string;
  speed?: number;
  heading?: number;
  altitude?: number;
  movement_type?: 'walking' | 'driving' | 'stationary' | 'unknown';
}

// Sri Lanka center coordinates
const sriLankaCenter: [number, number] = [7.8731, 80.7718]; // [lat, lng] for Leaflet

// Beautiful custom map styles
const mapStyles = {
  // Modern Dark Theme
  dark: {
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
    name: 'Dark Theme'
  },
  // Vibrant Satellite
  satellite: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: '&copy; <a href="https://www.esri.com/">Esri</a>',
    name: 'Satellite'
  },
  // Clean Light Theme
  light: {
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    name: 'Light Theme'
  },
  // High Contrast Roads
  roads: {
    url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
    name: 'Road Focus'
  },
  // Terrain Theme
  terrain: {
    url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://opentopomap.org/">OpenTopoMap</a>',
    name: 'Terrain'
  }
};

// Enhanced custom marker icons with animations and navigation data
const createCustomMarker = (location: EmployeeLocation, isSelected: boolean = false) => {
  const isOnline = location.connection_status === 'online';
  const batteryColor = location.battery_level && location.battery_level > 20 ? '#10b981' : '#ef4444';
  const taskColor = location.task_title ? '#f59e0b' : '#6b7280';
  const selectedGlow = isSelected ? '0 0 20px rgba(59, 130, 246, 0.8)' : '0 4px 12px rgba(0,0,0,0.3)';
  
  // Movement type colors
  const movementColors = {
    walking: '#10b981',
    driving: '#3b82f6', 
    stationary: '#6b7280',
    unknown: '#f59e0b'
  };
  
  const movementColor = movementColors[location.movement_type || 'unknown'];

  return L.divIcon({
    className: 'custom-marker',
    html: `
      <div style="
        width: ${isSelected ? '80px' : '64px'};
        height: ${isSelected ? '80px' : '64px'};
        position: relative;
        display: flex;
        align-items: center;
        justify-content: center;
        animation: ${isOnline ? 'pulse 2s infinite' : 'none'};
      ">
        <!-- Pulsing outer ring for online users -->
        ${isOnline ? `
          <div style="
            position: absolute;
            width: 70px;
            height: 70px;
            background: linear-gradient(45deg, #3b82f6, #1d4ed8);
            border-radius: 50%;
            opacity: 0.3;
            animation: ripple 2s infinite;
          "></div>
        ` : ''}
        
        <!-- Outer glow ring -->
        <div style="
          position: absolute;
          width: ${isSelected ? '70px' : '60px'};
          height: ${isSelected ? '70px' : '60px'};
          background: ${isOnline ? 'linear-gradient(135deg, #3b82f6, #1d4ed8)' : 'linear-gradient(135deg, #6b7280, #4b5563)'};
          border-radius: 50%;
          opacity: 0.2;
          filter: blur(4px);
        "></div>
        
        <!-- Main marker circle -->
        <div style="
          position: absolute;
          width: ${isSelected ? '56px' : '48px'};
          height: ${isSelected ? '56px' : '48px'};
          background: ${isOnline ? `linear-gradient(135deg, ${movementColor}, ${movementColor}dd)` : 'linear-gradient(135deg, #6b7280, #4b5563)'};
          border-radius: 50%;
          border: 4px solid white;
          box-shadow: ${selectedGlow};
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.3s ease;
        ">
          <span style="
            color: white;
            font-weight: bold;
            font-size: ${isSelected ? '18px' : '16px'};
            font-family: Arial, sans-serif;
          ">${location.full_name.charAt(0).toUpperCase()}</span>
        </div>
        
        <!-- Status indicator -->
        <div style="
          position: absolute;
          top: 0;
          right: 0;
          width: 20px;
          height: 20px;
          background: ${isOnline ? 'linear-gradient(135deg, #10b981, #059669)' : 'linear-gradient(135deg, #6b7280, #4b5563)'};
          border-radius: 50%;
          border: 3px solid white;
          box-shadow: 0 2px 6px rgba(0,0,0,0.3);
          display: flex;
          align-items: center;
          justify-content: center;
        ">
          <span style="
            color: white;
            font-size: 12px;
            font-weight: bold;
          ">${isOnline ? '●' : '○'}</span>
        </div>
        
        <!-- Battery indicator -->
        ${location.battery_level ? `
          <div style="
            position: absolute;
            top: 0;
            left: 0;
            width: 16px;
            height: 8px;
            background: ${batteryColor};
            border-radius: 2px;
            border: 2px solid white;
            box-shadow: 0 2px 4px rgba(0,0,0,0.3);
            display: flex;
            align-items: center;
            justify-content: center;
          ">
            <span style="
              color: white;
              font-size: 6px;
              font-weight: bold;
            ">${location.battery_level}%</span>
          </div>
        ` : ''}
        
        <!-- Task indicator -->
        ${location.task_title ? `
          <div style="
            position: absolute;
            bottom: 0;
            left: 0;
            width: 16px;
            height: 16px;
            background: ${taskColor};
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
            ">📋</span>
          </div>
        ` : ''}
        
        <!-- Speed indicator -->
        ${location.speed && location.speed > 0 ? `
          <div style="
            position: absolute;
            bottom: 0;
            right: 0;
            width: 20px;
            height: 12px;
            background: ${movementColor};
            border-radius: 3px;
            border: 2px solid white;
            box-shadow: 0 2px 4px rgba(0,0,0,0.3);
            display: flex;
            align-items: center;
            justify-content: center;
          ">
            <span style="
              color: white;
              font-size: 6px;
              font-weight: bold;
            ">${Math.round(location.speed)}</span>
          </div>
        ` : ''}
        
        <!-- Movement type indicator -->
        ${location.movement_type && location.movement_type !== 'unknown' ? `
          <div style="
            position: absolute;
            top: -12px;
            left: 50%;
            transform: translateX(-50%);
            width: 24px;
            height: 12px;
            background: ${movementColor};
            border-radius: 6px;
            border: 2px solid white;
            box-shadow: 0 2px 4px rgba(0,0,0,0.3);
            display: flex;
            align-items: center;
            justify-content: center;
          ">
            <span style="
              color: white;
              font-size: 8px;
            ">${location.movement_type === 'walking' ? '🚶' : location.movement_type === 'driving' ? '🚗' : '⏸️'}</span>
          </div>
        ` : ''}
        
        <!-- Direction arrow -->
        <div style="
          position: absolute;
          top: -8px;
          left: 50%;
          transform: translateX(-50%);
          width: 0;
          height: 0;
          border-left: 6px solid transparent;
          border-right: 6px solid transparent;
          border-bottom: 8px solid white;
          filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3));
        "></div>
      </div>
      
      <style>
        @keyframes pulse {
          0% { transform: scale(1); }
          50% { transform: scale(1.05); }
          100% { transform: scale(1); }
        }
        @keyframes ripple {
          0% { transform: scale(0.8); opacity: 0.3; }
          100% { transform: scale(1.2); opacity: 0; }
        }
      </style>
    `,
    iconSize: [isSelected ? 80 : 64, isSelected ? 80 : 64],
    iconAnchor: [isSelected ? 40 : 32, isSelected ? 40 : 32],
    popupAnchor: [0, isSelected ? -40 : -32],
  });
};

// Enhanced map controls component with mobile responsiveness
function MapControls({ 
  onSriLankaView, 
  onResetView, 
  onFitAll, 
  onFocusEmployee, 
  selectedEmployee,
  showInactive,
  setShowInactive,
  followMode,
  setFollowMode,
  lastRefresh,
  onRefresh,
  isLoading,
  currentStyle,
  onStyleChange,
  isPlaying,
  onTogglePlay,
  speed,
  onSpeedChange
}: {
  onSriLankaView: () => void;
  onResetView: () => void;
  onFitAll: () => void;
  onFocusEmployee: () => void;
  selectedEmployee: EmployeeLocation | null;
  showInactive: boolean;
  setShowInactive: (show: boolean) => void;
  followMode: boolean;
  setFollowMode: (follow: boolean) => void;
  lastRefresh: Date;
  onRefresh: () => void;
  isLoading: boolean;
  currentStyle: string;
  onStyleChange: (style: string) => void;
  isPlaying: boolean;
  onTogglePlay: () => void;
  speed: number;
  onSpeedChange: (speed: number) => void;
}) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <ResponsiveCard>
      <div className="space-y-4 sm:space-y-6">
        {/* Mobile Header with Toggle */}
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Map Controls</h2>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="sm:hidden p-2 rounded-md text-gray-500 hover:text-gray-700 hover:bg-gray-100 touch-manipulation"
            aria-label="Toggle controls"
          >
            {isExpanded ? <ChevronUpIcon className="h-5 w-5" /> : <ChevronDownIcon className="h-5 w-5" />}
          </button>
        </div>

        {/* Controls Grid - Hidden on mobile when collapsed */}
        <div className={`space-y-4 sm:space-y-0 ${isExpanded ? 'block' : 'hidden sm:block'}`}>
          <ResponsiveGrid cols={{ default: 1, sm: 2, lg: 5 }} gap={4}>
        {/* View Controls */}
            <div className="space-y-3">
              <label className="block text-sm font-medium text-gray-700">
            Map Controls
          </label>
          <div className="space-y-2">
            <button
              onClick={onSriLankaView}
                  className="w-full bg-blue-600 text-white py-2 px-3 rounded-md hover:bg-blue-700 transition-colors text-sm font-medium touch-manipulation transform active:scale-95"
            >
              🇱🇰 Sri Lanka View
            </button>
            <button
              onClick={onResetView}
                  className="w-full bg-green-600 text-white py-2 px-3 rounded-md hover:bg-green-700 transition-colors text-sm font-medium touch-manipulation transform active:scale-95"
            >
              🔄 Reset View
            </button>
            <button
              onClick={onFitAll}
                  className="w-full bg-indigo-600 text-white py-2 px-3 rounded-md hover:bg-indigo-700 transition-colors text-sm font-medium touch-manipulation transform active:scale-95"
            >
              Fit All
            </button>
            <button
              onClick={onFocusEmployee}
              disabled={!selectedEmployee}
                  className="w-full bg-purple-600 text-white py-2 px-3 rounded-md hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium touch-manipulation transform active:scale-95"
            >
              Focus Employee
            </button>
          </div>
        </div>

        {/* Map Style Selector */}
            <div className="space-y-3">
              <label className="block text-sm font-medium text-gray-700">
            Map Style
          </label>
          <select
            value={currentStyle}
            onChange={(e) => onStyleChange(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 touch-manipulation"
            aria-label="Select map style"
          >
            {Object.entries(mapStyles).map(([key, style]) => (
              <option key={key} value={key}>{style.name}</option>
            ))}
          </select>
        </div>

        {/* Display Options */}
            <div className="space-y-3">
              <label className="block text-sm font-medium text-gray-700">
            Display Options
          </label>
              <div className="space-y-3">
            <label className="flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={showInactive}
                onChange={(e) => setShowInactive(e.target.checked)}
                    className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 touch-manipulation"
              />
              <span className="ml-2 text-sm text-gray-700">Show Offline Employees</span>
            </label>
            <label className="flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={followMode}
                onChange={(e) => setFollowMode(e.target.checked)}
                    className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 touch-manipulation"
              />
              <span className="ml-2 text-sm text-gray-700">Follow Mode</span>
            </label>
          </div>
        </div>

        {/* Animation Controls */}
            <div className="space-y-3">
              <label className="block text-sm font-medium text-gray-700">
            Animation
          </label>
              <div className="space-y-3">
            <button
              onClick={onTogglePlay}
                  className={`w-full flex items-center justify-center py-2 px-3 rounded-md text-sm font-medium transition-colors touch-manipulation transform active:scale-95 ${
                isPlaying 
                  ? 'bg-red-600 text-white hover:bg-red-700' 
                  : 'bg-green-600 text-white hover:bg-green-700'
              }`}
            >
              {isPlaying ? <PauseIcon className="h-4 w-4 mr-2" /> : <PlayIcon className="h-4 w-4 mr-2" />}
              {isPlaying ? 'Pause' : 'Play'}
            </button>
            <div>
              <label className="text-xs text-gray-600">Speed: {speed}x</label>
              <input
                type="range"
                min="0.5"
                max="3"
                step="0.5"
                value={speed}
                onChange={(e) => onSpeedChange(parseFloat(e.target.value))}
                    className="w-full touch-manipulation"
                aria-label="Animation speed control"
              />
            </div>
          </div>
        </div>

        {/* Refresh Info */}
            <div className="space-y-3">
              <label className="block text-sm font-medium text-gray-700">
            Last Refresh
          </label>
          <div className="text-sm text-gray-600">
                <div className="mb-2">{lastRefresh.toLocaleTimeString()}</div>
            <button
              onClick={onRefresh}
              disabled={isLoading}
                  className="w-full flex items-center justify-center space-x-2 bg-indigo-600 text-white py-2 px-4 rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors font-medium touch-manipulation transform active:scale-95"
            >
              <RefreshIcon className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              <span>{isLoading ? 'Refreshing...' : 'Refresh'}</span>
            </button>
          </div>
        </div>
          </ResponsiveGrid>
      </div>
    </div>
    </ResponsiveCard>
  );
}

// Enhanced map component with real-time updates
function MapComponent({ 
  locations, 
  selectedEmployee, 
  onEmployeeSelect, 
  selectedEmployeePath,
  followMode,
  currentStyle,
  isPlaying,
  speed
}: {
  locations: EmployeeLocation[];
  selectedEmployee: EmployeeLocation | null;
  onEmployeeSelect: (employee: EmployeeLocation) => void;
  selectedEmployeePath: Array<{ lat: number; lng: number; timestamp: string }>;
  followMode: boolean;
  currentStyle: string;
  isPlaying: boolean;
  speed: number;
}) {
  const map = useMap();

  // Follow selected employee
  useEffect(() => {
    if (selectedEmployee && followMode) {
      map.setView([selectedEmployee.latitude, selectedEmployee.longitude], 18);
    }
  }, [selectedEmployee, followMode, map]);

  // Real-time updates when playing
  useEffect(() => {
    if (!isPlaying) return;
    
    const interval = setInterval(() => {
      // Trigger a re-render to update positions
      map.invalidateSize();
    }, 1000 / speed);

    return () => clearInterval(interval);
  }, [isPlaying, speed, map]);

  return (
    <>
      {/* Employee Markers */}
      {locations.map((location) => (
        <Marker
          key={location.id}
          position={[location.latitude, location.longitude]}
          icon={createCustomMarker(location, selectedEmployee?.user_id === location.user_id)}
          eventHandlers={{
            click: () => onEmployeeSelect(location),
          }}
        >
          <Popup>
            <div className="p-3 max-w-sm">
              <div className="flex items-center mb-3">
                <img
                  src={location.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(location.full_name)}&background=3b82f6&color=fff`}
                  alt={location.full_name}
                  className="w-10 h-10 rounded-full mr-3"
                />
                <div>
                  <h4 className="font-semibold text-gray-900">{location.full_name}</h4>
                  <p className="text-sm text-gray-600">{location.email}</p>
                </div>
              </div>
              
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Status:</span>
                  <span className={`font-medium ${
                    location.connection_status === 'online' ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {location.connection_status === 'online' ? 'Online' : 'Offline'}
                  </span>
                </div>

                <div className="flex justify-between">
                  <span className="text-gray-600">Last Update:</span>
                  <span className="font-medium">{new Date(location.recorded_at).toLocaleTimeString()}</span>
                </div>
                
                <div className="flex justify-between">
                  <span className="text-gray-600">Location:</span>
                  <span className="font-medium text-right">{location.address}</span>
                </div>
                
                {location.speed && location.speed > 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Speed:</span>
                    <span className="font-medium">{Math.round(location.speed)} km/h</span>
                  </div>
                )}
                
                {location.movement_type && location.movement_type !== 'unknown' && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Movement:</span>
                    <span className="font-medium capitalize flex items-center">
                      {location.movement_type === 'walking' ? '🚶 Walking' : 
                       location.movement_type === 'driving' ? '🚗 Driving' : 
                       location.movement_type === 'stationary' ? '⏸️ Stationary' : '❓ Unknown'}
                    </span>
                  </div>
                )}
                
                {location.heading && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Heading:</span>
                    <span className="font-medium">{Math.round(location.heading)}°</span>
                  </div>
                )}
                
                {location.battery_level && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Battery:</span>
                    <span className={`font-medium ${
                      location.battery_level > 20 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {location.battery_level}%
                    </span>
                  </div>
                )}

                {location.location_accuracy && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Accuracy:</span>
                    <span className="font-medium">±{Math.round(location.location_accuracy)}m</span>
                  </div>
                )}
                
                {location.task_title && (
                  <div className="mt-3 p-2 bg-blue-50 rounded">
                    <div className="text-xs text-blue-800 font-medium">Current Task:</div>
                    <div className="text-sm font-medium text-blue-900">{location.task_title}</div>
                  </div>
                )}
              </div>
            </div>
          </Popup>
        </Marker>
      ))}

      {/* Selected Employee Path with enhanced styling */}
      {selectedEmployeePath.length > 1 && (
        <Polyline
          positions={selectedEmployeePath.map(p => [p.lat, p.lng] as [number, number])}
          pathOptions={{
            color: '#f59e0b',
            weight: 6,
            opacity: 0.9,
            dashArray: isPlaying ? '10, 10' : undefined,
            dashOffset: isPlaying ? '0' : undefined,
          }}
        />
      )}

      {/* Accuracy Circle for Selected Employee */}
      {selectedEmployee?.location_accuracy && (
        <Circle
          center={[selectedEmployee.latitude, selectedEmployee.longitude]}
          radius={selectedEmployee.location_accuracy}
          pathOptions={{
            color: '#f59e0b',
            weight: 3,
            opacity: 0.8,
            fillColor: '#f59e0b',
            fillOpacity: 0.15,
          }}
        />
      )}

      {/* Heat map overlay for movement density */}
      {locations.length > 1 && (
        <Circle
          center={[sriLankaCenter[0], sriLankaCenter[1]]}
          radius={50000}
          pathOptions={{
            color: 'transparent',
            fillColor: '#3b82f6',
            fillOpacity: 0.05,
          }}
        />
      )}
    </>
  );
}

export default function EmployeeTrackingMapOSM() {
  const navigate = useNavigate();
  const [locations, setLocations] = useState<EmployeeLocation[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<EmployeeLocation | null>(null);
  const [showInactive, setShowInactive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [addressCache, setAddressCache] = useState<Record<string, string>>({});
  
  // Enhanced tracking state
  const [selectedEmployeePath, setSelectedEmployeePath] = useState<Array<{ lat: number; lng: number; timestamp: string }>>([]);
  const [trackingMetrics, setTrackingMetrics] = useState({
    totalDistance: 0,
    dailyDistance: 0,
    averageSpeed: 0,
    activeTime: 0,
    idleTime: 0,
  });
  
  // View controls
  const [followMode, setFollowMode] = useState<boolean>(false);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [currentStyle, setCurrentStyle] = useState<string>('light');
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [speed, setSpeed] = useState<number>(1);

  const fetchAddress = useCallback(async (lat: number, lng: number): Promise<string> => {
    const cacheKey = `${lat.toFixed(4)},${lng.toFixed(4)}`;
    if (addressCache[cacheKey]) return addressCache[cacheKey];

    try {
      // Using OpenStreetMap Nominatim for reverse geocoding (free)
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&addressdetails=1&accept-language=en`
      );
      const data = await response.json();
      
      const address = data.display_name || 'Address unknown';
      setAddressCache(prev => ({ ...prev, [cacheKey]: address }));
      return address;
    } catch (error) {
      console.error('Geocoding error:', error);
      return 'Address lookup failed';
    }
  }, [addressCache]);

  const fetchEmployeeLocations = useCallback(async () => {
    if (isLoading) return;
    
    setIsLoading(true);
    setLastRefresh(new Date());
    
    try {
      const data = await LocationService.getEmployeeLocations();
      
      if (!data || data.length === 0) {
        setLocations([]);
        setError(null);
        return;
      }

      // Enhanced location processing with addresses
      const locationsWithAddresses = await Promise.all(
        data.map(async (location: any) => ({
          id: location.id,
          user_id: location.user_id,
          latitude: location.latitude,
          longitude: location.longitude,
          recorded_at: location.recorded_at || location.timestamp,
          battery_level: location.battery_level,
          connection_status: location.connection_status,
          location_accuracy: location.location_accuracy,
          task_id: location.task_id,
          full_name: location.full_name || location.email?.split('@')[0] || `User ${location.user_id.slice(0, 8)}`,
          avatar_url: location.avatar_url,
          email: location.email,
          task_title: location.task_title,
          task_status: location.task_status,
          task_due_date: location.task_due_date,
          address: await fetchAddress(location.latitude, location.longitude),
        }))
      );

      setLocations(locationsWithAddresses);
      setError(null);
    } catch (error) {
      console.error('Error fetching employee locations:', error);
      setError('Unable to load employee locations');
      toast.error('Failed to refresh employee locations');
    } finally {
      setIsLoading(false);
    }
  }, [fetchAddress, isLoading]);

  const fetchMovementHistory = useCallback(async (userId: string) => {
    try {
      const since = new Date(Date.now() - 8 * 60 * 60 * 1000); // Last 8 hours
      const history = await GeofencingService.getMovementHistory(userId, since);
      
      if (!history || history.length === 0) {
        setSelectedEmployeePath([]);
        setTrackingMetrics({
          totalDistance: 0,
          dailyDistance: 0,
          averageSpeed: 0,
          activeTime: 0,
          idleTime: 0,
        });
        return;
      }

      const coords = history
        .map(h => ({ lat: h.latitude, lng: h.longitude, timestamp: h.timestamp }))
        .filter(p => typeof p.lat === 'number' && typeof p.lng === 'number')
        .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

      // Calculate comprehensive metrics
      let totalDistance = 0;
      let activeTimeMs = 0;
      let idleTimeMs = 0;
      const speeds: number[] = [];

      for (let i = 1; i < coords.length; i++) {
        const prev = coords[i - 1];
        const curr = coords[i];
        const distance = GeofencingService.calculateDistance(prev.lat, prev.lng, curr.lat, curr.lng);
        const timeMs = new Date(curr.timestamp).getTime() - new Date(prev.timestamp).getTime();
        
        totalDistance += distance;
        
        if (distance > 10) { // Moving threshold: 10 meters
          activeTimeMs += timeMs;
          if (timeMs > 0) {
            const speedKmh = (distance / 1000) / (timeMs / 3600000);
            if (speedKmh < 100) speeds.push(speedKmh); // Filter unrealistic speeds
          }
        } else {
          idleTimeMs += timeMs;
        }
      }

      const avgSpeed = speeds.length > 0 ? speeds.reduce((a, b) => a + b, 0) / speeds.length : 0;

      setSelectedEmployeePath(coords);
      setTrackingMetrics({
        totalDistance: Math.round(totalDistance / 1000 * 100) / 100, // km
        dailyDistance: Math.round(totalDistance / 1000 * 100) / 100, // km (using same for now)
        averageSpeed: Math.round(avgSpeed * 10) / 10,
        activeTime: Math.round(activeTimeMs / 60000), // minutes
        idleTime: Math.round(idleTimeMs / 60000), // minutes
      });

    } catch (error) {
      console.error('Error fetching movement history:', error);
    }
  }, []);

  const handleEmployeeSelect = useCallback((employee: EmployeeLocation) => {
    setSelectedEmployee(employee);
    fetchMovementHistory(employee.user_id);
  }, [fetchMovementHistory]);

  // Map control functions
  const mapRef = useRef<L.Map>(null);

  const zoomToSriLanka = () => {
    if (mapRef.current) {
      mapRef.current.setView(sriLankaCenter, 8);
    }
  };

  const zoomToEmployee = () => {
    if (selectedEmployee && mapRef.current) {
      mapRef.current.setView([selectedEmployee.latitude, selectedEmployee.longitude], 18);
    }
  };

  const fitAllEmployees = () => {
    if (locations.length > 0 && mapRef.current) {
      const group = L.featureGroup(
        locations.map(loc => L.marker([loc.latitude, loc.longitude]))
      );
      mapRef.current.fitBounds(group.getBounds().pad(0.1));
    }
  };

  const resetView = () => {
    if (mapRef.current) {
      mapRef.current.setView(sriLankaCenter, 8);
    }
  };

  const togglePlay = () => {
    setIsPlaying(!isPlaying);
  };

  // Auto-refresh when playing
  useEffect(() => {
    if (!isPlaying) return;
    
    const interval = setInterval(() => {
      fetchEmployeeLocations();
    }, 5000 / speed); // Refresh every 5 seconds divided by speed

    return () => clearInterval(interval);
  }, [isPlaying, speed, fetchEmployeeLocations]);

  // Initial load
  useEffect(() => {
    fetchEmployeeLocations();
  }, []);

  if (error) {
    return (
      <div className="min-h-screen bg-red-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full">
          <div className="flex items-center mb-4">
            <ExclamationIcon className="h-8 w-8 text-red-500 mr-3" />
            <h3 className="text-lg font-semibold text-red-800">Tracking Error</h3>
          </div>
          <p className="text-red-600 mb-4">{error}</p>
          <button
            onClick={() => {
              setError(null);
              fetchEmployeeLocations();
            }}
            className="w-full bg-red-600 text-white py-2 px-4 rounded-md hover:bg-red-700 transition-colors"
          >
            Retry Loading
          </button>
        </div>
      </div>
    );
  }

  const activeEmployees = locations.filter(loc => loc.connection_status === 'online');
  const filteredLocations = showInactive ? locations : activeEmployees;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50">
      {/* Enhanced Header */}
      <div className="bg-white shadow-lg border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-2 sm:px-4 md:px-6 lg:px-8 py-3 sm:py-4">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 sm:gap-4">
            <div className="flex items-center space-x-2 sm:space-x-4">
              <button
                onClick={() => navigate('/admin/dashboard')}
                className="flex items-center text-gray-600 hover:text-gray-800 transition-colors touch-manipulation transform active:scale-95"
              >
                <ArrowLeftIcon className="h-4 w-4 sm:h-5 sm:w-5 mr-1 sm:mr-2" />
                <span className="font-medium text-sm sm:text-base">Dashboard</span>
              </button>

              <div className="h-4 sm:h-6 w-px bg-gray-300"></div>
              
              <div>
                <h1 className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900 flex items-center">
                  <MapIcon className="h-5 w-5 sm:h-6 sm:w-6 lg:h-7 lg:w-7 mr-2 sm:mr-3 text-indigo-600" />
                  <span className="hidden sm:inline">Sri Lanka Employee Tracking (OpenStreetMap)</span>
                  <span className="sm:hidden">Employee Tracking</span>
                </h1>
                <p className="text-xs sm:text-sm text-gray-600 mt-1">
                  Real-time location monitoring using OpenStreetMap
                </p>
              </div>
            </div>

            {/* Quick Stats */}
            <div className="flex items-center justify-center sm:justify-end space-x-4 sm:space-x-6 text-xs sm:text-sm">
              <div className="text-center">
                <div className="text-lg sm:text-xl lg:text-2xl font-bold text-green-600">{activeEmployees.length}</div>
                <div className="text-gray-500">Active</div>
              </div>
              <div className="text-center">
                <div className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-600">{locations.length - activeEmployees.length}</div>
                <div className="text-gray-500">Offline</div>
              </div>
              <div className="text-center">
                <div className="text-lg sm:text-xl lg:text-2xl font-bold text-indigo-600">{locations.length}</div>
                <div className="text-gray-500">Total</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Enhanced Controls Panel */}
      <ResponsiveContainer>
        <div className="space-y-4 sm:space-y-6">
        <MapControls
          onSriLankaView={zoomToSriLanka}
          onResetView={resetView}
          onFitAll={fitAllEmployees}
          onFocusEmployee={zoomToEmployee}
          selectedEmployee={selectedEmployee}
          showInactive={showInactive}
          setShowInactive={setShowInactive}
          followMode={followMode}
          setFollowMode={setFollowMode}
          lastRefresh={lastRefresh}
          onRefresh={fetchEmployeeLocations}
          isLoading={isLoading}
          currentStyle={currentStyle}
          onStyleChange={setCurrentStyle}
          isPlaying={isPlaying}
          onTogglePlay={togglePlay}
          speed={speed}
          onSpeedChange={setSpeed}
        />

        {/* Selected Employee Metrics */}
        {selectedEmployee && (
            <ResponsiveCard>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 mb-4">
              <div className="flex items-center space-x-3">
                <img
                  src={selectedEmployee.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(selectedEmployee.full_name)}&background=3b82f6&color=fff`}
                  alt={selectedEmployee.full_name}
                    className="w-10 h-10 sm:w-12 sm:h-12 rounded-full border-2 border-indigo-200"
                />
                <div>
                    <h3 className="text-base sm:text-lg font-semibold text-gray-900">{selectedEmployee.full_name}</h3>
                    <p className="text-xs sm:text-sm text-gray-500">{selectedEmployee.email}</p>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                  <span className={`inline-flex items-center px-2 sm:px-3 py-1 rounded-full text-xs sm:text-sm font-medium ${
                  selectedEmployee.connection_status === 'online' 
                    ? 'bg-green-100 text-green-800' 
                    : 'bg-red-100 text-red-800'
                }`}>
                    <div className={`w-2 h-2 rounded-full mr-1 sm:mr-2 ${
                    selectedEmployee.connection_status === 'online' ? 'bg-green-500' : 'bg-red-500'
                  }`}></div>
                  {selectedEmployee.connection_status === 'online' ? 'Online' : 'Offline'}
                </span>
              </div>
            </div>

              <ResponsiveGrid cols={{ default: 2, sm: 3, lg: 5 }} gap={3}>
                <div className="bg-blue-50 rounded-lg p-2 sm:p-3 text-center">
                  <div className="text-lg sm:text-xl lg:text-2xl font-bold text-blue-600">{trackingMetrics.totalDistance}</div>
                <div className="text-xs text-blue-800">Distance (km)</div>
              </div>
                <div className="bg-green-50 rounded-lg p-2 sm:p-3 text-center">
                  <div className="text-lg sm:text-xl lg:text-2xl font-bold text-green-600">{trackingMetrics.averageSpeed}</div>
                <div className="text-xs text-green-800">Avg Speed (km/h)</div>
              </div>
                <div className="bg-indigo-50 rounded-lg p-2 sm:p-3 text-center">
                  <div className="text-lg sm:text-xl lg:text-2xl font-bold text-indigo-600">{trackingMetrics.activeTime}</div>
                <div className="text-xs text-indigo-800">Active (min)</div>
              </div>
                <div className="bg-orange-50 rounded-lg p-2 sm:p-3 text-center">
                  <div className="text-lg sm:text-xl lg:text-2xl font-bold text-orange-600">{trackingMetrics.idleTime}</div>
                <div className="text-xs text-orange-800">Idle (min)</div>
              </div>
                <div className="bg-purple-50 rounded-lg p-2 sm:p-3 text-center">
                  <div className="text-lg sm:text-xl lg:text-2xl font-bold text-purple-600">{selectedEmployeePath.length}</div>
                <div className="text-xs text-purple-800">GPS Points</div>
              </div>
              </ResponsiveGrid>
            </ResponsiveCard>
        )}

        {/* Main Map Container */}
        <div className="bg-white rounded-xl shadow-xl overflow-hidden">
          <MapContainer
            center={sriLankaCenter}
            zoom={8}
              style={{ height: 'calc(100vh - 16rem)', width: '100%' }}
            ref={mapRef}
          >
            <TileLayer
              attribution={mapStyles[currentStyle as keyof typeof mapStyles].attribution}
              url={mapStyles[currentStyle as keyof typeof mapStyles].url}
            />
            
            <MapComponent
              locations={filteredLocations}
              selectedEmployee={selectedEmployee}
              onEmployeeSelect={handleEmployeeSelect}
              selectedEmployeePath={selectedEmployeePath}
              followMode={followMode}
              currentStyle={currentStyle}
              isPlaying={isPlaying}
              speed={speed}
            />
          </MapContainer>
        </div>

        {/* Employee Grid */}
        {locations.length === 0 ? (
            <ResponsiveCard>
              <div className="text-center py-8 sm:py-12">
            <div className="text-gray-400 mb-4">
                  <MapIcon className="mx-auto h-12 w-12 sm:h-16 sm:w-16" />
            </div>
                <h3 className="text-lg sm:text-xl font-semibold text-gray-900 mb-2">No Employees Currently Tracked</h3>
                <p className="text-sm sm:text-base text-gray-600 mb-4 sm:mb-6 max-w-md mx-auto">
              Employee locations will appear here once they start using the mobile app and grant location permissions.
            </p>
                <div className="bg-blue-50 rounded-lg p-3 sm:p-4 max-w-lg mx-auto">
                  <h4 className="font-medium text-blue-900 mb-2 text-sm sm:text-base">For employees to appear on the map:</h4>
                  <ul className="text-xs sm:text-sm text-blue-800 space-y-1 text-left">
                <li>• Log into the employee mobile interface</li>
                <li>• Grant location permissions when prompted</li>
                <li>• Access location-based tasks or check-in features</li>
                <li>• Use 'Refresh' button to update locations</li>
              </ul>
            </div>
          </div>
            </ResponsiveCard>
          ) : (
            <ResponsiveCard>
              <div className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 bg-gray-50 border-b border-gray-200">
                <h3 className="text-base sm:text-lg font-semibold text-gray-900 flex items-center">
                  <UserGroupIcon className="h-5 w-5 sm:h-6 sm:w-6 mr-2 text-indigo-600" />
                Employee Status ({filteredLocations.length})
              </h3>
            </div>
            
              <div className="p-3 sm:p-4 md:p-6">
                <ResponsiveGrid cols={{ default: 1, sm: 2, lg: 3, xl: 4 }} gap={3}>
                {filteredLocations.map((location) => (
                  <div
                    key={location.user_id}
                      className={`p-3 sm:p-4 rounded-lg border-2 cursor-pointer transition-all hover:shadow-md touch-manipulation transform active:scale-95 ${
                      selectedEmployee?.user_id === location.user_id
                        ? 'border-indigo-500 bg-indigo-50'
                        : 'border-gray-200 bg-white hover:border-gray-300'
                    }`}
                    onClick={() => handleEmployeeSelect(location)}
                  >
                      <div className="flex items-center mb-2 sm:mb-3">
                      <div className="relative">
                        <img
                          src={location.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(location.full_name)}&background=3b82f6&color=fff`}
                          alt={location.full_name}
                            className="w-10 h-10 sm:w-12 sm:h-12 rounded-full"
                        />
                          <div className={`absolute -bottom-1 -right-1 w-3 h-3 sm:w-4 sm:h-4 rounded-full border-2 border-white ${
                          location.connection_status === 'online' ? 'bg-green-500' : 'bg-red-500'
                        }`}></div>
                      </div>
                        <div className="ml-2 sm:ml-3 flex-1 min-w-0">
                          <h4 className="font-semibold text-gray-900 truncate text-sm sm:text-base">{location.full_name}</h4>
                        <p className="text-xs text-gray-500 truncate">{location.email}</p>
                      </div>
                    </div>
                    
                      <div className="space-y-1 sm:space-y-2 text-xs">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Last Seen:</span>
                        <span className="font-medium">{new Date(location.recorded_at).toLocaleTimeString()}</span>
                      </div>
                      
                      <div className="flex justify-between">
                        <span className="text-gray-600">Location:</span>
                        <span className="font-medium text-right truncate ml-2" title={location.address}>
                          {location.address?.split(',')[0] || 'Unknown'}
                        </span>
                      </div>
                      
                      {location.speed && location.speed > 0 && (
                        <div className="flex justify-between">
                          <span className="text-gray-600">Speed:</span>
                          <span className="font-medium text-blue-600">{Math.round(location.speed)} km/h</span>
                        </div>
                      )}
                      
                      {location.movement_type && location.movement_type !== 'unknown' && (
                        <div className="flex justify-between">
                          <span className="text-gray-600">Movement:</span>
                          <span className="font-medium capitalize">
                            {location.movement_type === 'walking' ? '🚶 Walking' : 
                             location.movement_type === 'driving' ? '🚗 Driving' : 
                             location.movement_type === 'stationary' ? '⏸️ Stationary' : '❓ Unknown'}
                          </span>
                        </div>
                      )}
                      
                      {location.battery_level && (
                        <div className="flex justify-between">
                          <span className="text-gray-600">Battery:</span>
                          <span className={`font-medium ${
                            location.battery_level > 20 ? 'text-green-600' : 'text-red-600'
                          }`}>
                            {location.battery_level}%
                          </span>
                        </div>
                      )}
                      
                      {location.task_title && (
                        <div className="mt-2 p-2 bg-blue-50 rounded text-center">
                            <div className="text-blue-800 font-medium truncate text-xs" title={location.task_title}>
                            📋 {location.task_title}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                </ResponsiveGrid>
              </div>
            </ResponsiveCard>
        )}
      </div>
      </ResponsiveContainer>
    </div>
  );
}
