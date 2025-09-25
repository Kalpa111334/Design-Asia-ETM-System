import React, { useState, useEffect, useCallback, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle, Polyline, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';

// Import marker cluster plugin
import MarkerClusterGroup from 'react-leaflet-cluster';

// Custom CSS for enhanced styling
const mapStyles = `
  .leaflet-container {
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  }
  
  .custom-popup .leaflet-popup-content-wrapper {
    border-radius: 12px;
    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
    border: 1px solid rgba(0, 0, 0, 0.1);
  }
  
  .custom-popup .leaflet-popup-content {
    margin: 0;
    padding: 0;
  }
  
  .custom-popup .leaflet-popup-tip {
    background: white;
    border: 1px solid rgba(0, 0, 0, 0.1);
  }
  
  .marker-cluster {
    background: linear-gradient(135deg, #3b82f6, #1d4ed8) !important;
    border: 3px solid white !important;
    border-radius: 50% !important;
    box-shadow: 0 8px 16px rgba(0, 0, 0, 0.2) !important;
    transition: all 0.3s ease !important;
  }
  
  .marker-cluster:hover {
    transform: scale(1.1) !important;
    box-shadow: 0 12px 24px rgba(0, 0, 0, 0.3) !important;
  }
  
  .marker-cluster div {
    background: transparent !important;
    color: white !important;
    font-weight: bold !important;
    font-size: 14px !important;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5) !important;
  }
  
  .heatmap-overlay {
    background: linear-gradient(45deg, rgba(59, 130, 246, 0.1), rgba(16, 185, 129, 0.1));
    border-radius: 8px;
    backdrop-filter: blur(10px);
  }
  
  .map-controls {
    background: rgba(255, 255, 255, 0.95);
    backdrop-filter: blur(10px);
    border: 1px solid rgba(0, 0, 0, 0.1);
    border-radius: 12px;
    box-shadow: 0 8px 16px rgba(0, 0, 0, 0.1);
  }
  
  .map-controls button {
    transition: all 0.2s ease;
  }
  
  .map-controls button:hover {
    transform: translateY(-1px);
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
  }
  
  .location-pulse {
    animation: pulse 2s infinite;
  }
  
  @keyframes pulse {
    0% { transform: scale(1); opacity: 1; }
    50% { transform: scale(1.1); opacity: 0.7; }
    100% { transform: scale(1); opacity: 1; }
  }
  
  .route-animation {
    stroke-dasharray: 10, 10;
    animation: dash 1s linear infinite;
  }
  
  @keyframes dash {
    to { stroke-dashoffset: -20; }
  }
`;

// Enhanced map tile providers with MapBox-like styling
const tileProviders = {
  // Modern Light Theme (MapBox-like)
  light: {
    url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
    name: 'Light Theme',
    maxZoom: 20
  },
  
  // Dark Theme (MapBox-like)
  dark: {
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
    name: 'Dark Theme',
    maxZoom: 20
  },
  
  // Satellite with Labels
  satellite: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: '&copy; <a href="https://www.esri.com/">Esri</a>',
    name: 'Satellite',
    maxZoom: 19
  },
  
  // Terrain
  terrain: {
    url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://opentopomap.org/">OpenTopoMap</a>',
    name: 'Terrain',
    maxZoom: 17
  },
  
  // High Contrast Roads
  roads: {
    url: 'https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
    name: 'Road Focus',
    maxZoom: 20
  },
  
  // Watercolor Style
  watercolor: {
    url: 'https://stamen-tiles-{s}.a.ssl.fastly.net/watercolor/{z}/{x}/{y}.jpg',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://stamen.com/">Stamen Design</a>',
    name: 'Watercolor',
    maxZoom: 16
  }
};

// Enhanced marker creation with MapBox-like styling
const createEnhancedMarker = (data: any, type: 'employee' | 'task' | 'location', isSelected: boolean = false) => {
  const colors = {
    employee: {
      online: '#10b981',
      offline: '#6b7280',
      selected: '#3b82f6'
    },
    task: {
      pending: '#f59e0b',
      completed: '#10b981',
      inProgress: '#3b82f6',
      selected: '#ef4444'
    },
    location: {
      default: '#8b5cf6',
      selected: '#ef4444'
    }
  };

  let color = (colors[type] as any).default || colors[type].selected;
  let icon = '📍';
  let pulse = false;

  if (type === 'employee') {
    color = data.connection_status === 'online' ? colors.employee.online : colors.employee.offline;
    icon = data.full_name?.charAt(0).toUpperCase() || 'U';
    pulse = data.connection_status === 'online';
  } else if (type === 'task') {
    color = data.status === 'Completed' ? colors.task.completed : 
            data.status === 'In Progress' ? colors.task.inProgress : colors.task.pending;
    icon = '📋';
  }

  if (isSelected) {
    color = type === 'employee' ? colors.employee.selected : 
            type === 'task' ? colors.task.selected : colors.location.selected;
  }

  return L.divIcon({
    className: 'custom-marker',
    html: `
      <div style="
        width: ${isSelected ? '60px' : '48px'};
        height: ${isSelected ? '60px' : '48px'};
        position: relative;
        display: flex;
        align-items: center;
        justify-content: center;
        ${pulse ? 'animation: pulse 2s infinite;' : ''}
      ">
        <!-- Outer glow ring -->
        <div style="
          position: absolute;
          width: ${isSelected ? '60px' : '48px'};
          height: ${isSelected ? '60px' : '48px'};
          background: ${color};
          border-radius: 50%;
          opacity: 0.3;
          filter: blur(4px);
        "></div>
        
        <!-- Main marker circle -->
        <div style="
          position: absolute;
          width: ${isSelected ? '48px' : '36px'};
          height: ${isSelected ? '48px' : '36px'};
          background: linear-gradient(135deg, ${color}, ${color}dd);
          border-radius: 50%;
          border: 3px solid white;
          box-shadow: 0 8px 16px rgba(0, 0, 0, 0.3);
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.3s ease;
        ">
          <span style="
            color: white;
            font-weight: bold;
            font-size: ${isSelected ? '18px' : '14px'};
            text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
          ">${icon}</span>
        </div>
        
        <!-- Status indicator -->
        ${type === 'employee' && data.connection_status ? `
          <div style="
            position: absolute;
            top: -2px;
            right: -2px;
            width: 16px;
            height: 16px;
            background: ${data.connection_status === 'online' ? '#10b981' : '#ef4444'};
            border-radius: 50%;
            border: 2px solid white;
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
          "></div>
        ` : ''}
        
        <!-- Priority indicator for tasks -->
        ${type === 'task' && data.priority ? `
          <div style="
            position: absolute;
            top: -2px;
            left: -2px;
            width: 16px;
            height: 16px;
            background: ${data.priority === 'High' ? '#ef4444' : data.priority === 'Medium' ? '#f59e0b' : '#10b981'};
            border-radius: 50%;
            border: 2px solid white;
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
            display: flex;
            align-items: center;
            justify-content: center;
          ">
            <span style="color: white; font-size: 8px; font-weight: bold;">${data.priority.charAt(0)}</span>
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
          filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.3));
        "></div>
      </div>
    `,
    iconSize: [isSelected ? 60 : 48, isSelected ? 60 : 48],
    iconAnchor: [isSelected ? 30 : 24, isSelected ? 30 : 24],
    popupAnchor: [0, isSelected ? -30 : -24],
  });
};

// Enhanced popup content
const createEnhancedPopup = (data: any, type: 'employee' | 'task' | 'location') => {
  if (type === 'employee') {
    return (
      <div className="custom-popup p-4 max-w-sm">
        <div className="flex items-center mb-3">
          <img
            src={data.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(data.full_name)}&background=3b82f6&color=fff`}
            alt={data.full_name}
            className="w-12 h-12 rounded-full mr-3 border-2 border-gray-200"
          />
          <div>
            <h4 className="font-semibold text-gray-900">{data.full_name}</h4>
            <p className="text-sm text-gray-600">{data.email}</p>
          </div>
        </div>
        
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-600">Status:</span>
            <span className={`font-medium px-2 py-1 rounded-full text-xs ${
              data.connection_status === 'online' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
            }`}>
              {data.connection_status === 'online' ? 'Online' : 'Offline'}
            </span>
          </div>
          
          <div className="flex justify-between">
            <span className="text-gray-600">Last Update:</span>
            <span className="font-medium">{new Date(data.recorded_at).toLocaleTimeString()}</span>
          </div>
          
          {data.speed && data.speed > 0 && (
            <div className="flex justify-between">
              <span className="text-gray-600">Speed:</span>
              <span className="font-medium text-blue-600">{Math.round(data.speed)} km/h</span>
            </div>
          )}
          
          {data.battery_level && (
            <div className="flex justify-between">
              <span className="text-gray-600">Battery:</span>
              <span className={`font-medium ${
                data.battery_level > 20 ? 'text-green-600' : 'text-red-600'
              }`}>
                {data.battery_level}%
              </span>
            </div>
          )}
          
          {data.task_title && (
            <div className="mt-3 p-2 bg-blue-50 rounded-lg">
              <div className="text-xs text-blue-800 font-medium">Current Task:</div>
              <div className="text-sm font-medium text-blue-900">{data.task_title}</div>
            </div>
          )}
        </div>
      </div>
    );
  } else if (type === 'task') {
    return (
      <div className="custom-popup p-4 max-w-sm">
        <div className="flex items-center mb-3">
          <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mr-3">
            <span className="text-2xl">📋</span>
          </div>
          <div>
            <h4 className="font-semibold text-gray-900">{data.title}</h4>
            <p className="text-sm text-gray-600">{data.description}</p>
          </div>
        </div>
        
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-600">Status:</span>
            <span className={`font-medium px-2 py-1 rounded-full text-xs ${
              data.status === 'Completed' ? 'bg-green-100 text-green-800' :
              data.status === 'In Progress' ? 'bg-blue-100 text-blue-800' :
              'bg-yellow-100 text-yellow-800'
            }`}>
              {data.status}
            </span>
          </div>
          
          <div className="flex justify-between">
            <span className="text-gray-600">Priority:</span>
            <span className={`font-medium px-2 py-1 rounded-full text-xs ${
              data.priority === 'High' ? 'bg-red-100 text-red-800' :
              data.priority === 'Medium' ? 'bg-yellow-100 text-yellow-800' :
              'bg-green-100 text-green-800'
            }`}>
              {data.priority}
            </span>
          </div>
          
          <div className="flex justify-between">
            <span className="text-gray-600">Due Date:</span>
            <span className="font-medium">{new Date(data.due_date).toLocaleDateString()}</span>
          </div>
          
          <div className="flex justify-between">
            <span className="text-gray-600">Price:</span>
            <span className="font-medium text-green-600">${data.price}</span>
          </div>
        </div>
      </div>
    );
  }
  
  return (
    <div className="custom-popup p-4 max-w-sm">
      <div className="flex items-center mb-3">
        <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mr-3">
          <span className="text-2xl">📍</span>
        </div>
        <div>
          <h4 className="font-semibold text-gray-900">Location</h4>
          <p className="text-sm text-gray-600">Selected Location</p>
        </div>
      </div>
      
      <div className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-600">Latitude:</span>
          <span className="font-medium">{data.lat?.toFixed(6)}</span>
        </div>
        
        <div className="flex justify-between">
          <span className="text-gray-600">Longitude:</span>
          <span className="font-medium">{data.lng?.toFixed(6)}</span>
        </div>
      </div>
    </div>
  );
};

// Map controls component
const MapControls = ({ 
  currentStyle, 
  onStyleChange, 
  showClusters, 
  setShowClusters,
  showHeatmap,
  setShowHeatmap,
  onResetView,
  onFitBounds
}: {
  currentStyle: string;
  onStyleChange: (style: string) => void;
  showClusters: boolean;
  setShowClusters: (show: boolean) => void;
  showHeatmap: boolean;
  setShowHeatmap: (show: boolean) => void;
  onResetView: () => void;
  onFitBounds: () => void;
}) => {
  return (
    <div className="map-controls p-4 space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Map Style</label>
        <select
          value={currentStyle}
          onChange={(e) => onStyleChange(e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
        >
          {Object.entries(tileProviders).map(([key, provider]) => (
            <option key={key} value={key}>{provider.name}</option>
          ))}
        </select>
      </div>
      
      <div className="space-y-3">
        <label className="block text-sm font-medium text-gray-700">Display Options</label>
        
        <label className="flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={showClusters}
            onChange={(e) => setShowClusters(e.target.checked)}
            className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
          />
          <span className="ml-2 text-sm text-gray-700">Show Clusters</span>
        </label>
        
        <label className="flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={showHeatmap}
            onChange={(e) => setShowHeatmap(e.target.checked)}
            className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
          />
          <span className="ml-2 text-sm text-gray-700">Show Heatmap</span>
        </label>
      </div>
      
      <div className="space-y-2">
        <button
          onClick={onResetView}
          className="w-full bg-indigo-600 text-white py-2 px-4 rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium"
        >
          Reset View
        </button>
        
        <button
          onClick={onFitBounds}
          className="w-full bg-green-600 text-white py-2 px-4 rounded-lg hover:bg-green-700 transition-colors text-sm font-medium"
        >
          Fit All Markers
        </button>
      </div>
    </div>
  );
};

// Main enhanced map component
interface EnhancedOSMMapProps {
  center?: [number, number];
  zoom?: number;
  employees?: any[];
  tasks?: any[];
  locations?: any[];
  onLocationSelect?: (location: { lat: number; lng: number }) => void;
  onEmployeeSelect?: (employee: any) => void;
  onTaskSelect?: (task: any) => void;
  height?: string;
  showControls?: boolean;
  className?: string;
}

export default function EnhancedOSMMap({
  center = [7.8731, 80.7718], // Sri Lanka center
  zoom = 8,
  employees = [],
  tasks = [],
  locations = [],
  onLocationSelect,
  onEmployeeSelect,
  onTaskSelect,
  height = '500px',
  showControls = true,
  className = ''
}: EnhancedOSMMapProps) {
  const [currentStyle, setCurrentStyle] = useState('light');
  const [showClusters, setShowClusters] = useState(true);
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [selectedMarker, setSelectedMarker] = useState<any>(null);
  const mapRef = useRef<L.Map>(null);

  // Add custom styles to document
  useEffect(() => {
    const styleElement = document.createElement('style');
    styleElement.textContent = mapStyles;
    document.head.appendChild(styleElement);
    
    return () => {
      document.head.removeChild(styleElement);
    };
  }, []);

  const handleResetView = useCallback(() => {
    if (mapRef.current) {
      mapRef.current.setView(center, zoom);
    }
  }, [center, zoom]);

  const handleFitBounds = useCallback(() => {
    if (mapRef.current && (employees.length > 0 || tasks.length > 0 || locations.length > 0)) {
      const allMarkers = [
        ...employees.map(emp => [emp.latitude, emp.longitude]),
        ...tasks.map(task => [task.location_latitude, task.location_longitude]).filter(Boolean),
        ...locations.map(loc => [loc.lat, loc.lng])
      ].filter(Boolean);
      
      if (allMarkers.length > 0) {
        const group = L.featureGroup(
          allMarkers.map(coords => L.marker(coords as [number, number]))
        );
        mapRef.current.fitBounds(group.getBounds().pad(0.1));
      }
    }
  }, [employees, tasks, locations]);

  const handleMarkerClick = useCallback((data: any, type: 'employee' | 'task' | 'location') => {
    setSelectedMarker({ ...data, type });
    
    if (type === 'employee' && onEmployeeSelect) {
      onEmployeeSelect(data);
    } else if (type === 'task' && onTaskSelect) {
      onTaskSelect(data);
    } else if (type === 'location' && onLocationSelect) {
      onLocationSelect({ lat: data.lat, lng: data.lng });
    }
  }, [onEmployeeSelect, onTaskSelect, onLocationSelect]);

  return (
    <div className={`relative ${className}`}>
      <style>{mapStyles}</style>
      
      {showControls && (
        <div className="absolute top-4 right-4 z-[1000] w-64">
          <MapControls
            currentStyle={currentStyle}
            onStyleChange={setCurrentStyle}
            showClusters={showClusters}
            setShowClusters={setShowClusters}
            showHeatmap={showHeatmap}
            setShowHeatmap={setShowHeatmap}
            onResetView={handleResetView}
            onFitBounds={handleFitBounds}
          />
        </div>
      )}
      
      <MapContainer
        center={center}
        zoom={zoom}
        style={{ height, width: '100%' }}
        ref={mapRef}
        className="rounded-lg shadow-lg"
      >
        <TileLayer
          attribution={tileProviders[currentStyle as keyof typeof tileProviders].attribution}
          url={tileProviders[currentStyle as keyof typeof tileProviders].url}
          maxZoom={tileProviders[currentStyle as keyof typeof tileProviders].maxZoom}
        />
        
        {/* Employee Markers */}
        {employees.length > 0 && (
          showClusters ? (
            <MarkerClusterGroup
              chunkedLoading
              spiderfyOnMaxZoom={true}
              showCoverageOnHover={false}
              zoomToBoundsOnClick={true}
            >
              {employees.map((employee) => (
                <Marker
                  key={`emp-${employee.id}`}
                  position={[employee.latitude, employee.longitude]}
                  icon={createEnhancedMarker(employee, 'employee', selectedMarker?.id === employee.id)}
                  eventHandlers={{
                    click: () => handleMarkerClick(employee, 'employee'),
                  }}
                >
                  <Popup>
                    {createEnhancedPopup(employee, 'employee')}
                  </Popup>
                </Marker>
              ))}
            </MarkerClusterGroup>
          ) : (
            employees.map((employee) => (
              <Marker
                key={`emp-${employee.id}`}
                position={[employee.latitude, employee.longitude]}
                icon={createEnhancedMarker(employee, 'employee', selectedMarker?.id === employee.id)}
                eventHandlers={{
                  click: () => handleMarkerClick(employee, 'employee'),
                }}
              >
                <Popup>
                  {createEnhancedPopup(employee, 'employee')}
                </Popup>
              </Marker>
            ))
          )
        )}
        
        {/* Task Markers */}
        {tasks.length > 0 && (
          showClusters ? (
            <MarkerClusterGroup
              chunkedLoading
              spiderfyOnMaxZoom={true}
              showCoverageOnHover={false}
              zoomToBoundsOnClick={true}
            >
              {tasks.filter(task => task.location_latitude && task.location_longitude).map((task) => (
                <Marker
                  key={`task-${task.id}`}
                  position={[task.location_latitude, task.location_longitude]}
                  icon={createEnhancedMarker(task, 'task', selectedMarker?.id === task.id)}
                  eventHandlers={{
                    click: () => handleMarkerClick(task, 'task'),
                  }}
                >
                  <Popup>
                    {createEnhancedPopup(task, 'task')}
                  </Popup>
                </Marker>
              ))}
            </MarkerClusterGroup>
          ) : (
            tasks.filter(task => task.location_latitude && task.location_longitude).map((task) => (
              <Marker
                key={`task-${task.id}`}
                position={[task.location_latitude, task.location_longitude]}
                icon={createEnhancedMarker(task, 'task', selectedMarker?.id === task.id)}
                eventHandlers={{
                  click: () => handleMarkerClick(task, 'task'),
                }}
              >
                <Popup>
                  {createEnhancedPopup(task, 'task')}
                </Popup>
              </Marker>
            ))
          )
        )}
        
        {/* Location Markers */}
        {locations.map((location) => (
          <Marker
            key={`loc-${location.id || location.lat}-${location.lng}`}
            position={[location.lat, location.lng]}
            icon={createEnhancedMarker(location, 'location', selectedMarker?.lat === location.lat && selectedMarker?.lng === location.lng)}
            eventHandlers={{
              click: () => handleMarkerClick(location, 'location'),
            }}
          >
            <Popup>
              {createEnhancedPopup(location, 'location')}
            </Popup>
          </Marker>
        ))}
        
        {/* Heatmap overlay */}
        {showHeatmap && employees.length > 0 && (
          <Circle
            center={center}
            radius={50000}
            pathOptions={{
              color: 'transparent',
              fillColor: '#3b82f6',
              fillOpacity: 0.1,
              className: 'heatmap-overlay'
            }}
          />
        )}
      </MapContainer>
    </div>
  );
}
