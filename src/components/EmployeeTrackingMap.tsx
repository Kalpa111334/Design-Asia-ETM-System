import React, { useState, useEffect, useCallback, useRef } from 'react';
import { GoogleMap, Marker, InfoWindow, useLoadScript, Polyline, Circle } from '@react-google-maps/api';
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
} from '@heroicons/react/outline';
import toast from 'react-hot-toast';
import { GeofencingService } from '../services/GeofencingService';
import { supabase } from '../lib/supabase';

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
}

// Enhanced map container for Sri Lanka with responsive design
const mapContainerStyle = {
  width: '100%',
  height: 'calc(100vh - 12rem)',
  borderRadius: '12px',
  border: '2px solid #e5e7eb',
  boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
};

// Sri Lanka center coordinates with better positioning for higher zoom
const sriLankaCenter = { 
  lat: 7.8731, // Central Sri Lanka (Kandy area)
  lng: 80.7718 
};

// Enhanced map options focused on roads only
const customMapOptions = {
  disableDefaultUI: false,
  zoomControl: true,
  mapTypeControl: false, // Disable map type control for road-only view
  streetViewControl: true,
  fullscreenControl: true,
  gestureHandling: 'greedy',
  minZoom: 16, // Higher minimum zoom to keep focus on roads
  maxZoom: 25, // Ultra-high zoom for street-level detail
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
    // Enhanced modern map styling with shadows and depth
    {
      featureType: 'all',
      elementType: 'all',
      stylers: [{ visibility: 'on' }],
    },
    // Enhanced landscape with vibrant gradient effect
    {
      featureType: 'landscape',
      elementType: 'geometry',
      stylers: [
        { visibility: 'on' },
        { color: '#f0f9ff' },
        { lightness: 20 },
        { saturation: 15 }
      ],
    },
    // Terrain and natural features with tropical colors
    {
      featureType: 'landscape.natural',
      elementType: 'geometry',
      stylers: [
        { visibility: 'on' },
        { color: '#dcfce7' },
        { lightness: 15 },
        { saturation: 25 }
      ],
    },
    // Major highways with premium orange styling and enhanced lane markings
    {
      featureType: 'road.highway',
      elementType: 'geometry',
      stylers: [
        { visibility: 'on' },
        { color: '#ff6b35' },
        { weight: 14 },
        { saturation: 120 },
        { lightness: 0 }
      ],
    },
    {
      featureType: 'road.highway',
      elementType: 'geometry.stroke',
      stylers: [
        { visibility: 'on' },
        { color: '#ff4500' },
        { weight: 4 }
      ],
    },
    {
      featureType: 'road.highway',
      elementType: 'labels',
      stylers: [
        { visibility: 'on' },
        { color: '#ffffff' },
        { weight: 'bold' },
        { gamma: 1.8 },
        { lightness: 10 }
      ],
    },
    // Highway lane markings
    {
      featureType: 'road.highway',
      elementType: 'labels.text.stroke',
      stylers: [
        { visibility: 'on' },
        { color: '#000000' },
        { weight: 2 }
      ],
    },
    // Arterial roads with enhanced blue styling and lane visibility
    {
      featureType: 'road.arterial',
      elementType: 'geometry',
      stylers: [
        { visibility: 'on' },
        { color: '#1e40af' },
        { weight: 10 },
        { saturation: 100 },
        { lightness: -5 }
      ],
    },
    {
      featureType: 'road.arterial',
      elementType: 'geometry.stroke',
      stylers: [
        { visibility: 'on' },
        { color: '#1e3a8a' },
        { weight: 3 }
      ],
    },
    {
      featureType: 'road.arterial',
      elementType: 'labels',
      stylers: [
        { visibility: 'on' },
        { color: '#ffffff' },
        { weight: 'bold' },
        { gamma: 1.6 }
      ],
    },
    // Arterial road lane markings
    {
      featureType: 'road.arterial',
      elementType: 'labels.text.stroke',
      stylers: [
        { visibility: 'on' },
        { color: '#000000' },
        { weight: 1.5 }
      ],
    },
    // Local roads with enhanced green styling
    {
      featureType: 'road.local',
      elementType: 'geometry',
      stylers: [
        { visibility: 'on' },
        { color: '#059669' },
        { weight: 6 },
        { saturation: 80 },
        { lightness: 5 }
      ],
    },
    {
      featureType: 'road.local',
      elementType: 'geometry.stroke',
      stylers: [
        { visibility: 'on' },
        { color: '#047857' },
        { weight: 1.5 }
      ],
    },
    {
      featureType: 'road.local',
      elementType: 'labels',
      stylers: [
        { visibility: 'on' },
        { color: '#ffffff' },
        { weight: 'bold' },
        { gamma: 1.4 }
      ],
    },
    // Other roads with enhanced white styling and better contrast
    {
      featureType: 'road',
      elementType: 'geometry',
      stylers: [
        { visibility: 'on' },
        { color: '#f8fafc' },
        { weight: 5 },
        { gamma: 1.3 },
        { lightness: 10 }
      ],
    },
    {
      featureType: 'road',
      elementType: 'geometry.stroke',
      stylers: [
        { visibility: 'on' },
        { color: '#cbd5e1' },
        { weight: 1.5 }
      ],
    },
    {
      featureType: 'road',
      elementType: 'labels',
      stylers: [
        { visibility: 'on' },
        { color: '#1e293b' },
        { gamma: 1.8 },
        { weight: 'bold' }
      ],
    },
    // Enhanced water features with tropical blue depth
    {
      featureType: 'water',
      elementType: 'geometry',
      stylers: [
        { visibility: 'on' },
        { color: '#0ea5e9' },
        { lightness: 15 },
        { saturation: 60 }
      ],
    },
    {
      featureType: 'water',
      elementType: 'geometry.stroke',
      stylers: [
        { visibility: 'on' },
        { color: '#0284c7' },
        { weight: 2 }
      ],
    },
    {
      featureType: 'water',
      elementType: 'labels',
      stylers: [
        { visibility: 'on' },
        { color: '#ffffff' },
        { weight: 'bold' },
        { gamma: 1.6 }
      ],
    },
    // Enhanced parks and natural features with vibrant green
    {
      featureType: 'poi.park',
      elementType: 'geometry',
      stylers: [
        { visibility: 'on' },
        { color: '#22c55e' },
        { lightness: 25 },
        { saturation: 50 }
      ],
    },
    {
      featureType: 'poi.park',
      elementType: 'geometry.stroke',
      stylers: [
        { visibility: 'on' },
        { color: '#16a34a' },
        { weight: 2 }
      ],
    },
    {
      featureType: 'poi.park',
      elementType: 'labels',
      stylers: [
        { visibility: 'on' },
        { color: '#ffffff' },
        { weight: 'bold' },
        { gamma: 1.5 }
      ],
    },
    // Show important landmarks and attractions with golden styling
    {
      featureType: 'poi.attraction',
      elementType: 'geometry',
      stylers: [
        { visibility: 'on' },
        { color: '#f59e0b' },
        { lightness: 15 },
        { saturation: 80 }
      ],
    },
    {
      featureType: 'poi.attraction',
      elementType: 'labels',
      stylers: [
        { visibility: 'on' },
        { color: '#ffffff' },
        { weight: 'bold' },
        { gamma: 1.7 }
      ],
    },
    // Show important government buildings with purple styling
    {
      featureType: 'poi.government',
      elementType: 'geometry',
      stylers: [
        { visibility: 'on' },
        { color: '#8b5cf6' },
        { lightness: 15 },
        { saturation: 70 }
      ],
    },
    {
      featureType: 'poi.government',
      elementType: 'labels',
      stylers: [
        { visibility: 'on' },
        { color: '#ffffff' },
        { weight: 'bold' },
        { gamma: 1.6 }
      ],
    },
    // Show hospitals and medical facilities with red styling
    {
      featureType: 'poi.medical',
      elementType: 'geometry',
      stylers: [
        { visibility: 'on' },
        { color: '#ef4444' },
        { lightness: 15 },
        { saturation: 80 }
      ],
    },
    {
      featureType: 'poi.medical',
      elementType: 'labels',
      stylers: [
        { visibility: 'on' },
        { color: '#ffffff' },
        { weight: 'bold' },
        { gamma: 1.6 }
      ],
    },
    // Hide less important POIs
    {
      featureType: 'poi.business',
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
    // Enhanced transit with vibrant styling
    {
      featureType: 'transit.station',
      elementType: 'geometry',
      stylers: [
        { visibility: 'on' },
        { color: '#6366f1' },
        { lightness: 20 },
        { saturation: 80 }
      ],
    },
    {
      featureType: 'transit.station',
      elementType: 'labels',
      stylers: [
        { visibility: 'on' },
        { color: '#ffffff' },
        { weight: 'bold' },
        { gamma: 1.6 }
      ],
    },
    {
      featureType: 'transit.line',
      elementType: 'geometry',
      stylers: [
        { visibility: 'on' },
        { color: '#4f46e5' },
        { weight: 3 }
      ],
    },
    // Enhanced country borders with premium styling
    {
      featureType: 'administrative.country',
      elementType: 'geometry.stroke',
      stylers: [
        { visibility: 'on' },
        { color: '#dc2626' },
        { weight: 4 }
      ],
    },
    {
      featureType: 'administrative.country',
      elementType: 'labels',
      stylers: [
        { visibility: 'on' },
        { color: '#ffffff' },
        { weight: 'bold' },
        { gamma: 1.8 }
      ],
    },
    // Enhanced province/state borders with better visibility
    {
      featureType: 'administrative.province',
      elementType: 'geometry.stroke',
      stylers: [
        { visibility: 'on' },
        { color: '#ea580c' },
        { weight: 3 }
      ],
    },
    {
      featureType: 'administrative.province',
      elementType: 'labels',
      stylers: [
        { visibility: 'on' },
        { color: '#ffffff' },
        { weight: 'bold' },
        { gamma: 1.7 }
      ],
    },
    // City and locality labels with enhanced contrast
    {
      featureType: 'administrative.locality',
      elementType: 'labels',
      stylers: [
        { visibility: 'on' },
        { color: '#1e293b' },
        { weight: 'bold' },
        { gamma: 1.6 }
      ],
    },
    // Neighborhood labels with better readability
    {
      featureType: 'administrative.neighborhood',
      elementType: 'labels',
      stylers: [
        { visibility: 'on' },
        { color: '#475569' },
        { weight: 'bold' },
        { gamma: 1.4 }
      ],
    },
  ],
};

export default function EmployeeTrackingMap() {
  const { isLoaded } = useLoadScript({
    googleMapsApiKey: 'AIzaSyARSoKujCNX2odk8wachQyz0DIjBCqJNd4',
    libraries: ['places', 'geometry'],
  });

  const navigate = useNavigate();
  const [locations, setLocations] = useState<EmployeeLocation[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<EmployeeLocation | null>(null);
  const [showInactive, setShowInactive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const mapRef = useRef<google.maps.Map>();
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
  
  // View controls - STABLE (no auto-refresh) - Ultra-high zoom for road-only view
  const [viewMode, setViewMode] = useState<'overview' | 'detailed' | 'satellite'>('detailed');
  const [followMode, setFollowMode] = useState<boolean>(false); // Disabled by default for stability
  const [zoomLevel, setZoomLevel] = useState<number>(16); // Balanced zoom for enhanced features
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [showHeatmap, setShowHeatmap] = useState<boolean>(false);
  const [showWeather, setShowWeather] = useState<boolean>(false);
  const [mapLayers, setMapLayers] = useState<{
    traffic: boolean;
    transit: boolean;
    bicycling: boolean;
    terrain: boolean;
  }>({
    traffic: false,
    transit: false,
    bicycling: false,
    terrain: false
  });

  const onMapLoad = useCallback((map: google.maps.Map) => {
    mapRef.current = map;
    
    // Set initial view to cover Sri Lanka with good detail
    map.setCenter(sriLankaCenter);
    map.setZoom(zoomLevel);
    
    // Add enhanced custom controls with layer management
    const controlDiv = document.createElement('div');
    controlDiv.style.margin = '10px';
    controlDiv.innerHTML = `
      <div style="background: white; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); padding: 12px; display: flex; flex-direction: column; gap: 8px; min-width: 200px;">
        <div style="display:flex; align-items:center; justify-content:space-between; gap:8px; font-size: 14px; font-weight: bold; color: #374151; margin-bottom: 8px;">
          <span>🗺️ Map Controls</span>
          <button id="hide-controls" title="Hide controls" style="padding:6px 10px; border:none; background:#e5e7eb; color:#111827; border-radius:6px; cursor:pointer; font-size:12px; font-weight:600;">Hide</button>
        </div>
        <button id="sri-lanka-view" style="padding: 10px 16px; border: none; background: linear-gradient(135deg, #3b82f6, #1d4ed8); color: white; border-radius: 8px; cursor: pointer; font-size: 12px; font-weight: 600; transition: all 0.3s ease;">
          🇱🇰 Sri Lanka View
        </button>
        <button id="reset-view" style="padding: 10px 16px; border: none; background: linear-gradient(135deg, #10b981, #059669); color: white; border-radius: 8px; cursor: pointer; font-size: 12px; font-weight: 600; transition: all 0.3s ease;">
          🔄 Reset View
        </button>
        <div style="border-top: 1px solid #e5e7eb; margin: 8px 0; padding-top: 8px;">
          <div style="font-size: 12px; font-weight: 600; color: #6b7280; margin-bottom: 6px;">Map Layers</div>
          <button id="toggle-traffic" style="padding: 8px 12px; border: none; background: linear-gradient(135deg, #f59e0b, #d97706); color: white; border-radius: 6px; cursor: pointer; font-size: 11px; font-weight: 500; transition: all 0.3s ease; width: 100%; margin-bottom: 4px;">
            🚦 Traffic Layer
          </button>
          <button id="toggle-transit" style="padding: 8px 12px; border: none; background: linear-gradient(135deg, #8b5cf6, #7c3aed); color: white; border-radius: 6px; cursor: pointer; font-size: 11px; font-weight: 500; transition: all 0.3s ease; width: 100%; margin-bottom: 4px;">
            🚌 Transit Lines
          </button>
          <button id="toggle-bicycling" style="padding: 8px 12px; border: none; background: linear-gradient(135deg, #06b6d4, #0891b2); color: white; border-radius: 6px; cursor: pointer; font-size: 11px; font-weight: 500; transition: all 0.3s ease; width: 100%; margin-bottom: 4px;">
            🚴 Bicycle Paths
          </button>
          <button id="toggle-terrain" style="padding: 8px 12px; border: none; background: linear-gradient(135deg, #84cc16, #65a30d); color: white; border-radius: 6px; cursor: pointer; font-size: 11px; font-weight: 500; transition: all 0.3s ease; width: 100%;">
            🏔️ Terrain
        </button>
        </div>
        <div style="border-top: 1px solid #e5e7eb; margin: 8px 0; padding-top: 8px;">
          <div style="font-size: 12px; font-weight: 600; color: #6b7280; margin-bottom: 6px;">Overlays</div>
          <button id="toggle-heatmap" style="padding: 8px 12px; border: none; background: linear-gradient(135deg, #ef4444, #dc2626); color: white; border-radius: 6px; cursor: pointer; font-size: 11px; font-weight: 500; transition: all 0.3s ease; width: 100%; margin-bottom: 4px;">
            🔥 Heat Map
          </button>
          <button id="toggle-weather" style="padding: 8px 12px; border: none; background: linear-gradient(135deg, #0ea5e9, #0284c7); color: white; border-radius: 6px; cursor: pointer; font-size: 11px; font-weight: 500; transition: all 0.3s ease; width: 100%;">
            🌤️ Weather
          </button>
        </div>
      </div>
    `;
    
    // Add hover effects
    const buttons = controlDiv.querySelectorAll('button');
    buttons.forEach(button => {
      button.addEventListener('mouseenter', () => {
        button.style.transform = 'translateY(-2px)';
        button.style.boxShadow = '0 6px 16px rgba(0,0,0,0.2)';
      });
      button.addEventListener('mouseleave', () => {
        button.style.transform = 'translateY(0)';
        button.style.boxShadow = 'none';
      });
    });
    
    const sriLankaButton = controlDiv.querySelector('#sri-lanka-view') as HTMLElement;
    sriLankaButton.onclick = () => {
      map.setCenter(sriLankaCenter);
      map.setZoom(8);
    };
    
    const resetButton = controlDiv.querySelector('#reset-view') as HTMLElement;
    resetButton.onclick = () => {
      map.setCenter(sriLankaCenter);
      map.setZoom(zoomLevel);
    };
    
    // Layer management
    let trafficLayer: google.maps.TrafficLayer | null = null;
    let transitLayer: google.maps.TransitLayer | null = null;
    let bicyclingLayer: google.maps.BicyclingLayer | null = null;
    let heatmapLayer: google.maps.visualization.HeatmapLayer | null = null;
    
    const trafficButton = controlDiv.querySelector('#toggle-traffic') as HTMLElement;
    trafficButton.onclick = () => {
      if (!mapLayers.traffic) {
        trafficLayer = new google.maps.TrafficLayer();
        trafficLayer.setMap(map);
        setMapLayers(prev => ({ ...prev, traffic: true }));
        trafficButton.innerHTML = '🚦 Hide Traffic';
        trafficButton.style.background = 'linear-gradient(135deg, #ef4444, #dc2626)';
      } else {
        if (trafficLayer) {
          trafficLayer.setMap(null);
        }
        setMapLayers(prev => ({ ...prev, traffic: false }));
        trafficButton.innerHTML = '🚦 Traffic Layer';
        trafficButton.style.background = 'linear-gradient(135deg, #f59e0b, #d97706)';
      }
    };
    
    const transitButton = controlDiv.querySelector('#toggle-transit') as HTMLElement;
    transitButton.onclick = () => {
      if (!mapLayers.transit) {
        transitLayer = new google.maps.TransitLayer();
        transitLayer.setMap(map);
        setMapLayers(prev => ({ ...prev, transit: true }));
        transitButton.innerHTML = '🚌 Hide Transit';
        transitButton.style.background = 'linear-gradient(135deg, #ef4444, #dc2626)';
      } else {
        if (transitLayer) {
          transitLayer.setMap(null);
        }
        setMapLayers(prev => ({ ...prev, transit: false }));
        transitButton.innerHTML = '🚌 Transit Lines';
        transitButton.style.background = 'linear-gradient(135deg, #8b5cf6, #7c3aed)';
      }
    };
    
    const bicyclingButton = controlDiv.querySelector('#toggle-bicycling') as HTMLElement;
    bicyclingButton.onclick = () => {
      if (!mapLayers.bicycling) {
        bicyclingLayer = new google.maps.BicyclingLayer();
        bicyclingLayer.setMap(map);
        setMapLayers(prev => ({ ...prev, bicycling: true }));
        bicyclingButton.innerHTML = '🚴 Hide Bicycle';
        bicyclingButton.style.background = 'linear-gradient(135deg, #ef4444, #dc2626)';
      } else {
        if (bicyclingLayer) {
          bicyclingLayer.setMap(null);
        }
        setMapLayers(prev => ({ ...prev, bicycling: false }));
        bicyclingButton.innerHTML = '🚴 Bicycle Paths';
        bicyclingButton.style.background = 'linear-gradient(135deg, #06b6d4, #0891b2)';
      }
    };
    
    const terrainButton = controlDiv.querySelector('#toggle-terrain') as HTMLElement;
    terrainButton.onclick = () => {
      if (!mapLayers.terrain) {
        map.setMapTypeId('terrain');
        setMapLayers(prev => ({ ...prev, terrain: true }));
        terrainButton.innerHTML = '🏔️ Hide Terrain';
        terrainButton.style.background = 'linear-gradient(135deg, #ef4444, #dc2626)';
      } else {
        map.setMapTypeId('roadmap');
        setMapLayers(prev => ({ ...prev, terrain: false }));
        terrainButton.innerHTML = '🏔️ Terrain';
        terrainButton.style.background = 'linear-gradient(135deg, #84cc16, #65a30d)';
      }
    };
    
    const heatmapButton = controlDiv.querySelector('#toggle-heatmap') as HTMLElement;
    heatmapButton.onclick = () => {
      if (!showHeatmap) {
        // Create heatmap data from employee locations
        const heatmapData = filteredLocations.map(location => ({
          location: new google.maps.LatLng(location.latitude, location.longitude),
          weight: 1
        }));
        
        heatmapLayer = new google.maps.visualization.HeatmapLayer({
          data: heatmapData,
          map: map,
          radius: 50,
          opacity: 0.6
        });
        
        setShowHeatmap(true);
        heatmapButton.innerHTML = '🔥 Hide Heat Map';
        heatmapButton.style.background = 'linear-gradient(135deg, #ef4444, #dc2626)';
      } else {
        if (heatmapLayer) {
          heatmapLayer.setMap(null);
        }
        setShowHeatmap(false);
        heatmapButton.innerHTML = '🔥 Heat Map';
        heatmapButton.style.background = 'linear-gradient(135deg, #ef4444, #dc2626)';
      }
    };
    
    const weatherButton = controlDiv.querySelector('#toggle-weather') as HTMLElement;
    weatherButton.onclick = () => {
      if (!showWeather) {
        // Add weather overlay (simulated)
        setShowWeather(true);
        weatherButton.innerHTML = '🌤️ Hide Weather';
        weatherButton.style.background = 'linear-gradient(135deg, #ef4444, #dc2626)';
        toast.success('Weather overlay enabled');
      } else {
        setShowWeather(false);
        weatherButton.innerHTML = '🌤️ Weather';
        weatherButton.style.background = 'linear-gradient(135deg, #0ea5e9, #0284c7)';
        toast.success('Weather overlay disabled');
      }
    };
    
    map.controls[google.maps.ControlPosition.TOP_RIGHT].push(controlDiv);

    // Hide/Show controls toggle
    const hideBtn = controlDiv.querySelector('#hide-controls') as HTMLElement;
    let showBtn: HTMLDivElement | null = null;
    hideBtn.onclick = () => {
      (controlDiv.firstElementChild as HTMLElement).style.display = 'none';
      controlDiv.style.display = 'none';
      // Create a compact show button
      showBtn = document.createElement('div');
      showBtn.style.margin = '10px';
      showBtn.innerHTML = `
        <div id="show-controls" style="background: #111827; color: #ffffff; border-radius: 9999px; padding: 8px 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.2); cursor: pointer; font-size:12px; font-weight:600;">
          Show Controls
        </div>
      `;
      map.controls[google.maps.ControlPosition.TOP_RIGHT].push(showBtn);
      const showBtnEl = showBtn.querySelector('#show-controls') as HTMLElement;
      showBtnEl.onclick = () => {
        if (showBtn) {
          // Remove the compact button and reveal panel
          const ctrls = map.controls[google.maps.ControlPosition.TOP_RIGHT];
          for (let i = ctrls.getLength() - 1; i >= 0; i--) {
            if (ctrls.getAt(i) === showBtn) {
              ctrls.removeAt(i);
              break;
            }
          }
          showBtn = null;
        }
        controlDiv.style.display = 'block';
      };
    };
    
    // Legend removed per user request
    
    // Add custom info window styling
    const infoWindow = new google.maps.InfoWindow();
    infoWindow.setOptions({
      pixelOffset: new google.maps.Size(0, -10),
      disableAutoPan: false
    });
    
  }, [zoomLevel]);

  const fetchAddress = useCallback(async (lat: number, lng: number): Promise<string> => {
    const cacheKey = `${lat.toFixed(4)},${lng.toFixed(4)}`;
    if (addressCache[cacheKey]) return addressCache[cacheKey];

    try {
      const geocoder = new google.maps.Geocoder();
      const result = await geocoder.geocode({ 
        location: { lat, lng },
        region: 'LK' // Sri Lanka region code for better results
      });
      
      const address = result.results[0]?.formatted_address || 'Address unknown';
      setAddressCache(prev => ({ ...prev, [cacheKey]: address }));
      return address;
    } catch (error) {
      console.error('Geocoding error:', error);
      return 'Address lookup failed';
    }
  }, [addressCache]);

    // STABLE fetch function - NO automatic refresh
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

      // STABLE map positioning - only on manual refresh
      if (locationsWithAddresses.length > 0 && mapRef.current && viewMode === 'overview') {
        const bounds = new google.maps.LatLngBounds();
        locationsWithAddresses.forEach((location) => {
          bounds.extend({ lat: location.latitude, lng: location.longitude });
        });
        mapRef.current.fitBounds(bounds);
        
        // Ensure good detail level
        setTimeout(() => {
          if (mapRef.current && mapRef.current.getZoom() && mapRef.current.getZoom()! > 18) {
            mapRef.current.setZoom(18);
          }
        }, 100);
      }
      
      // Removed toast notification to prevent spam
      // toast.success(`Refreshed ${locationsWithAddresses.length} employee locations`);
    } catch (error) {
      console.error('Error fetching employee locations:', error);
      setError('Unable to load employee locations');
      toast.error('Failed to refresh employee locations');
    } finally {
      setIsLoading(false);
    }
  }, [fetchAddress, viewMode, isLoading]);

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

  // STABLE employee selection - no auto-follow by default
  const handleEmployeeSelect = useCallback((employee: EmployeeLocation) => {
    setSelectedEmployee(employee);
    fetchMovementHistory(employee.user_id);
    
    // Only pan if user explicitly enabled follow mode
    if (mapRef.current && followMode) {
      mapRef.current.panTo({ lat: employee.latitude, lng: employee.longitude });
      mapRef.current.setZoom(20);
    }
  }, [fetchMovementHistory, followMode]);

  // INITIAL LOAD ONLY - No automatic refresh intervals
  useEffect(() => {
    fetchEmployeeLocations();
  }, []); // Empty dependency array to run only once on mount

  if (!isLoaded) {
    return (
      <div className="flex flex-col justify-center items-center h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-indigo-600 mb-4"></div>
        <p className="text-lg font-medium text-gray-700">Loading Sri Lanka Map...</p>
        <p className="text-sm text-gray-500">Preparing comprehensive employee tracking</p>
      </div>
    );
  }

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

  const zoomToSriLanka = () => {
    if (mapRef.current) {
      mapRef.current.setCenter(sriLankaCenter);
      mapRef.current.setZoom(8);
    }
  };

  const zoomToEmployee = () => {
    if (selectedEmployee && mapRef.current) {
      mapRef.current.panTo({ lat: selectedEmployee.latitude, lng: selectedEmployee.longitude });
      mapRef.current.setZoom(21); // Maximum zoom for construction site detail
    }
  };

  const fitAllEmployees = () => {
    if (filteredLocations.length > 0 && mapRef.current) {
      const bounds = new google.maps.LatLngBounds();
      filteredLocations.forEach(location => {
        bounds.extend({ lat: location.latitude, lng: location.longitude });
      });
      mapRef.current.fitBounds(bounds);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50">
      {/* Enhanced Header */}
      <div className="bg-white shadow-lg border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="flex items-center space-x-4">
        <button
          onClick={() => navigate('/admin/dashboard')}
                className="flex items-center text-gray-600 hover:text-gray-800 transition-colors"
        >
                <ArrowLeftIcon className="h-5 w-5 mr-2" />
                <span className="font-medium">Dashboard</span>
        </button>

              <div className="h-6 w-px bg-gray-300"></div>
              
              <div>
                <h1 className="text-2xl font-bold text-gray-900 flex items-center">
                  <MapIcon className="h-7 w-7 mr-3 text-indigo-600" />
                  Sri Lanka Employee Tracking
                </h1>
                <p className="text-sm text-gray-600 mt-1">
                  Comprehensive real-time location monitoring for construction teams
                </p>
              </div>
            </div>

            {/* Quick Stats */}
            <div className="flex items-center space-x-6 text-sm">
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{activeEmployees.length}</div>
                <div className="text-gray-500">Active</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-600">{locations.length - activeEmployees.length}</div>
                <div className="text-gray-500">Offline</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-indigo-600">{locations.length}</div>
                <div className="text-gray-500">Total</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Enhanced Controls Panel */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            
            {/* Employee Selector */}
            <div className="lg:col-span-1">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Employee
              </label>
              <select
                value={selectedEmployee?.user_id || ''}
                onChange={(e) => {
                  const emp = locations.find(l => l.user_id === e.target.value);
                  if (emp) handleEmployeeSelect(emp);
                }}
                className="w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                title="Select employee to track"
                aria-label="Select employee to track"
              >
                <option value="">All Employees</option>
                {[...new Map(locations.map(l => [l.user_id, l])).values()]
                  .sort((a, b) => a.full_name.localeCompare(b.full_name))
                  .map(emp => (
                    <option key={emp.user_id} value={emp.user_id}>
                      {emp.full_name} {emp.connection_status === 'online' ? '🟢' : '🔴'}
                    </option>
                  ))}
              </select>
            </div>

            {/* View Controls */}
            <div className="lg:col-span-1">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                View Mode
              </label>
              <div className="flex rounded-lg border border-gray-300 overflow-hidden">
                {[
                  { key: 'overview', label: 'Overview' },
                  { key: 'detailed', label: 'Detailed' },
                  { key: 'satellite', label: 'Satellite' }
                ].map(mode => (
                  <button
                    key={mode.key}
                    onClick={() => setViewMode(mode.key as any)}
                    className={`flex-1 py-2 px-3 text-xs font-medium ${
                      viewMode === mode.key
                        ? 'bg-indigo-600 text-white'
                        : 'bg-white text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    {mode.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Zoom Controls */}
            <div className="lg:col-span-1">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Zoom Level: {zoomLevel}
              </label>
              <input
                type="range"
                min="8"
                max="22"
                value={zoomLevel}
                onChange={(e) => {
                  const zoom = parseInt(e.target.value);
                  setZoomLevel(zoom);
                  if (mapRef.current) {
                    mapRef.current.setZoom(zoom);
                  }
                }}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                title="Adjust map zoom level"
                aria-label="Adjust map zoom level"
              />
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>Country</span>
                <span>Street</span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="lg:col-span-1 flex flex-wrap gap-2">
              <button
                onClick={zoomToSriLanka}
                className="flex-1 bg-blue-600 text-white py-2 px-3 rounded-md hover:bg-blue-700 transition-colors text-sm font-medium"
              >
                🇱🇰 Sri Lanka
              </button>
              <button
                onClick={fitAllEmployees}
                className="flex-1 bg-green-600 text-white py-2 px-3 rounded-md hover:bg-green-700 transition-colors text-sm font-medium"
              >
                Fit All
              </button>
              <button
                onClick={zoomToEmployee}
                disabled={!selectedEmployee}
                className="flex-1 bg-indigo-600 text-white py-2 px-3 rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium"
              >
                Focus
              </button>
            </div>
          </div>

          {/* Advanced Controls Row */}
          <div className="mt-4 flex flex-wrap items-center gap-4 pt-4 border-t border-gray-200">
            <label className="flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={showInactive}
                  onChange={(e) => setShowInactive(e.target.checked)}
                className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
              />
              <span className="ml-2 text-sm text-gray-700">Show Offline Employees</span>
            </label>

                        <label className="flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={followMode}
                onChange={(e) => setFollowMode(e.target.checked)}
                className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
              />
              <span className="ml-2 text-sm text-gray-700">Manual Follow Mode</span>
            </label>

            <div className="flex items-center space-x-2 text-sm text-gray-600">
              <span>Last Refresh:</span>
              <span className="font-medium">{lastRefresh.toLocaleTimeString()}</span>
            </div>

            <button
              onClick={fetchEmployeeLocations}
              disabled={isLoading}
              className="flex items-center space-x-2 bg-indigo-600 text-white py-2 px-4 rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors font-medium"
            >
              <RefreshIcon className={`h-5 w-5 ${isLoading ? 'animate-spin' : ''}`} />
              <span>{isLoading ? 'Refreshing...' : 'Manual Refresh'}</span>
            </button>
          </div>
        </div>

        {/* Selected Employee Metrics */}
        {selectedEmployee && (
          <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-3">
                <img
                  src={selectedEmployee.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(selectedEmployee.full_name)}&background=3b82f6&color=fff`}
                  alt={selectedEmployee.full_name}
                  className="w-12 h-12 rounded-full border-2 border-indigo-200"
                />
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">{selectedEmployee.full_name}</h3>
                  <p className="text-sm text-gray-500">{selectedEmployee.email}</p>
        </div>
      </div>

              <div className="flex items-center space-x-2">
                <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                  selectedEmployee.connection_status === 'online' 
                    ? 'bg-green-100 text-green-800' 
                    : 'bg-red-100 text-red-800'
                }`}>
                  <div className={`w-2 h-2 rounded-full mr-2 ${
                    selectedEmployee.connection_status === 'online' ? 'bg-green-500' : 'bg-red-500'
                  }`}></div>
                  {selectedEmployee.connection_status === 'online' ? 'Online' : 'Offline'}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="bg-blue-50 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-blue-600">{trackingMetrics.totalDistance}</div>
                <div className="text-xs text-blue-800">Distance (km)</div>
              </div>
              <div className="bg-green-50 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-green-600">{trackingMetrics.averageSpeed}</div>
                <div className="text-xs text-green-800">Avg Speed (km/h)</div>
              </div>
              <div className="bg-indigo-50 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-indigo-600">{trackingMetrics.activeTime}</div>
                <div className="text-xs text-indigo-800">Active (min)</div>
              </div>
              <div className="bg-orange-50 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-orange-600">{trackingMetrics.idleTime}</div>
                <div className="text-xs text-orange-800">Idle (min)</div>
              </div>
              <div className="bg-purple-50 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-purple-600">{selectedEmployeePath.length}</div>
                <div className="text-xs text-purple-800">GPS Points</div>
              </div>
            </div>
          </div>
        )}

        {/* Main Map Container */}
        <div className="bg-white rounded-xl shadow-xl overflow-hidden">
        <GoogleMap
          mapContainerStyle={mapContainerStyle}
            zoom={zoomLevel}
            center={selectedEmployee ? { lat: selectedEmployee.latitude, lng: selectedEmployee.longitude } : sriLankaCenter}
            options={{
              ...customMapOptions,
              mapTypeId: viewMode === 'satellite' ? 'satellite' : 'roadmap',
            }}
          onLoad={onMapLoad}
            onClick={() => setSelectedEmployee(null)}
        >
            {/* Enhanced Employee Markers with Premium Styling */}
          {filteredLocations.map((location) => (
            <Marker
              key={location.id}
                position={{ lat: location.latitude, lng: location.longitude }}
              icon={{
                  url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`
                    <svg width="64" height="64" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
                      <defs>
                        <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
                          <feGaussianBlur stdDeviation="6" result="coloredBlur"/>
                          <feMerge> 
                            <feMergeNode in="coloredBlur"/>
                            <feMergeNode in="SourceGraphic"/>
                          </feMerge>
                        </filter>
                        <filter id="shadow" x="-50%" y="-50%" width="200%" height="200%">
                          <feDropShadow dx="3" dy="6" stdDeviation="4" flood-color="rgba(0,0,0,0.4)"/>
                        </filter>
                        <linearGradient id="markerGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                          <stop offset="0%" style="stop-color:#3b82f6;stop-opacity:1" />
                          <stop offset="50%" style="stop-color:#1d4ed8;stop-opacity:1" />
                          <stop offset="100%" style="stop-color:#1e40af;stop-opacity:1" />
                        </linearGradient>
                        <linearGradient id="onlineGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                          <stop offset="0%" style="stop-color:#10b981;stop-opacity:1" />
                          <stop offset="100%" style="stop-color:#059669;stop-opacity:1" />
                        </linearGradient>
                        <linearGradient id="offlineGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                          <stop offset="0%" style="stop-color:#6b7280;stop-opacity:1" />
                          <stop offset="100%" style="stop-color:#4b5563;stop-opacity:1" />
                        </linearGradient>
                      </defs>
                      <!-- Outer glow ring with enhanced visibility -->
                      <circle cx="32" cy="32" r="30" fill="#3b82f6" opacity="0.15" filter="url(#glow)"/>
                      <!-- Main marker with premium gradient -->
                      <circle cx="32" cy="32" r="24" fill="url(#markerGradient)" stroke="white" stroke-width="5" filter="url(#shadow)"/>
                      <!-- Inner white circle with subtle shadow -->
                      <circle cx="32" cy="32" r="16" fill="white" opacity="0.95" filter="url(#shadow)"/>
                      <!-- Employee initial with enhanced typography -->
                      <text x="32" y="38" text-anchor="middle" fill="#1e40af" font-size="16" font-weight="bold" font-family="Arial, sans-serif">
                        ${location.full_name.charAt(0).toUpperCase()}
                      </text>
                      <!-- Enhanced status indicator with gradient -->
                      <circle cx="48" cy="16" r="10" fill="url(${location.connection_status === 'online' ? '#onlineGradient' : '#offlineGradient'})" stroke="white" stroke-width="4" filter="url(#shadow)"/>
                      <text x="48" y="22" text-anchor="middle" fill="white" font-size="12" font-weight="bold">
                        ${location.connection_status === 'online' ? '●' : '○'}
                      </text>
                      <!-- Enhanced battery indicator -->
                      ${location.battery_level ? `
                        <rect x="6" y="6" width="12" height="6" fill="${location.battery_level > 20 ? '#10b981' : '#ef4444'}" stroke="white" stroke-width="2" rx="2" filter="url(#shadow)"/>
                        <text x="12" y="11" text-anchor="middle" fill="white" font-size="8" font-weight="bold">${location.battery_level}%</text>
                      ` : ''}
                      <!-- Enhanced task indicator -->
                      ${location.task_title ? `
                        <circle cx="18" cy="48" r="8" fill="#f59e0b" stroke="white" stroke-width="3" filter="url(#shadow)"/>
                        <text x="18" y="53" text-anchor="middle" fill="white" font-size="10" font-weight="bold">📋</text>
                      ` : ''}
                      <!-- Direction indicator arrow -->
                      <polygon points="32,8 28,16 36,16" fill="white" stroke="#1e40af" stroke-width="2" filter="url(#shadow)"/>
                      </svg>
                  `)}`,
                  scaledSize: new google.maps.Size(64, 64),
                  anchor: new google.maps.Point(32, 32),
                }}
                onClick={() => handleEmployeeSelect(location)}
                animation={location.user_id === selectedEmployee?.user_id ? google.maps.Animation.BOUNCE : undefined}
            />
          ))}

            {/* Selected Employee Path with Enhanced Styling */}
            {selectedEmployeePath.length > 1 && (
              <Polyline
                path={selectedEmployeePath.map(p => ({ lat: p.lat, lng: p.lng }))}
                options={{
                  strokeColor: '#f59e0b',
                  strokeOpacity: 0.9,
                  strokeWeight: 6,
                  geodesic: true,
                  icons: [{
                    icon: {
                      path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
                      scale: 3,
                      strokeColor: '#ffffff',
                      strokeWeight: 2,
                      fillColor: '#f59e0b',
                      fillOpacity: 1
                    },
                    offset: '50%',
                    repeat: '200px'
                  }]
                }}
              />
            )}

            {/* Accuracy Circle for Selected Employee with Enhanced Styling */}
            {selectedEmployee?.location_accuracy && (
              <Circle
                center={{ lat: selectedEmployee.latitude, lng: selectedEmployee.longitude }}
                radius={selectedEmployee.location_accuracy}
                options={{
                  strokeColor: '#f59e0b',
                  strokeOpacity: 0.8,
                  strokeWeight: 3,
                  fillColor: '#f59e0b',
                  fillOpacity: 0.15,
                }}
              />
            )}

            {/* Enhanced InfoWindow */}
            {selectedEmployee && (
            <InfoWindow
                position={{ lat: selectedEmployee.latitude, lng: selectedEmployee.longitude }}
                onCloseClick={() => setSelectedEmployee(null)}
              >
                <div className="p-3 max-w-sm">
                  <div className="flex items-center mb-3">
                    <img
                      src={selectedEmployee.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(selectedEmployee.full_name)}&background=3b82f6&color=fff`}
                      alt={selectedEmployee.full_name}
                      className="w-10 h-10 rounded-full mr-3"
                  />
                  <div>
                      <h4 className="font-semibold text-gray-900">{selectedEmployee.full_name}</h4>
                      <p className="text-sm text-gray-600">{selectedEmployee.email}</p>
                    </div>
                  </div>
                  
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Status:</span>
                      <span className={`font-medium ${
                        selectedEmployee.connection_status === 'online' ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {selectedEmployee.connection_status === 'online' ? 'Online' : 'Offline'}
                    </span>
                  </div>

                    <div className="flex justify-between">
                      <span className="text-gray-600">Last Update:</span>
                      <span className="font-medium">{new Date(selectedEmployee.recorded_at).toLocaleTimeString()}</span>
                    </div>
                    
                    <div className="flex justify-between">
                      <span className="text-gray-600">Location:</span>
                      <span className="font-medium text-right">{selectedEmployee.address}</span>
                    </div>
                    
                    {selectedEmployee.battery_level && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Battery:</span>
                        <span className="font-medium">{selectedEmployee.battery_level}%</span>
                    </div>
                  )}

                    {selectedEmployee.location_accuracy && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Accuracy:</span>
                        <span className="font-medium">±{Math.round(selectedEmployee.location_accuracy)}m</span>
                      </div>
                    )}
                    
                    {selectedEmployee.task_title && (
                      <div className="mt-3 p-2 bg-blue-50 rounded">
                        <div className="text-xs text-blue-800 font-medium">Current Task:</div>
                        <div className="text-sm font-medium text-blue-900">{selectedEmployee.task_title}</div>
                      </div>
                  )}
                </div>
              </div>
            </InfoWindow>
          )}
        </GoogleMap>
      </div>

        {/* Employee Grid */}
        {locations.length === 0 ? (
          <div className="bg-white rounded-xl shadow-lg p-12 text-center">
            <div className="text-gray-400 mb-4">
              <MapIcon className="mx-auto h-16 w-16" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No Employees Currently Tracked</h3>
            <p className="text-gray-600 mb-6 max-w-md mx-auto">
              Employee locations will appear here once they start using the mobile app and grant location permissions.
            </p>
            <div className="bg-blue-50 rounded-lg p-4 max-w-lg mx-auto">
              <h4 className="font-medium text-blue-900 mb-2">For employees to appear on the map:</h4>
              <ul className="text-sm text-blue-800 space-y-1 text-left">
                <li>• Log into the employee mobile interface</li>
                <li>• Grant location permissions when prompted</li>
                <li>• Access location-based tasks or check-in features</li>
                <li>• Use 'Manual Refresh' button to update locations</li>
              </ul>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-lg overflow-hidden">
            <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                <UserGroupIcon className="h-6 w-6 mr-2 text-indigo-600" />
                Employee Status ({filteredLocations.length})
              </h3>
            </div>
            
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {filteredLocations.map((location) => (
                  <div
                    key={location.user_id}
                    className={`p-4 rounded-lg border-2 cursor-pointer transition-all hover:shadow-md ${
                      selectedEmployee?.user_id === location.user_id
                        ? 'border-indigo-500 bg-indigo-50'
                        : 'border-gray-200 bg-white hover:border-gray-300'
                    }`}
                    onClick={() => handleEmployeeSelect(location)}
                  >
                    <div className="flex items-center mb-3">
                      <div className="relative">
                        <img
                          src={location.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(location.full_name)}&background=3b82f6&color=fff`}
                          alt={location.full_name}
                          className="w-12 h-12 rounded-full"
                        />
                        <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-white ${
                          location.connection_status === 'online' ? 'bg-green-500' : 'bg-red-500'
                        }`}></div>
            </div>
                      <div className="ml-3 flex-1">
                        <h4 className="font-semibold text-gray-900 truncate">{location.full_name}</h4>
                        <p className="text-xs text-gray-500 truncate">{location.email}</p>
          </div>
        </div>
        
                    <div className="space-y-2 text-xs">
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
                          <div className="text-blue-800 font-medium truncate" title={location.task_title}>
                            📋 {location.task_title}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
            </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 