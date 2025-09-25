import React, { useState, useEffect, useCallback, useRef } from 'react';
import { GoogleMap, Marker, InfoWindow, Circle, CircleProps } from '@react-google-maps/api';
import { EnhancedLocationService } from '../../services/EnhancedLocationService';
import { GeofencingService, Geofence, LocationAlert } from '../../services/GeofencingService';
import { supabase } from '../../lib/supabase';
import { Task, User } from '../../types/index';
import { formatCurrency } from '../../utils/currency';
import { useGoogleMaps } from '../GoogleMapsLoader';
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

const mapContainerStyle = {
  width: '100%',
  height: '70vh',
};

const center = {
  lat: 7.8731, // Central Sri Lanka (Kandy area)
  lng: 80.7718, // Center of Sri Lanka
};

const mapOptions = {
  disableDefaultUI: false,
  zoomControl: true,
  streetViewControl: false,
  mapTypeControl: false, // Disable for road-only view
  fullscreenControl: true,
  minZoom: 16, // Higher minimum zoom to focus on roads
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
};

interface EmployeeLocation {
  id: string;
  latitude: number;
  longitude: number;
  user_id: string;
  timestamp: string;
  battery_level?: number;
  connection_status?: string;
  task_id?: string;
  location_accuracy?: number;
  users: {
    full_name: string;
    avatar_url: string;
  };
}

interface TaskWithLocation extends Task {
  location_latitude?: number;
  location_longitude?: number;
  location_radius_meters?: number;
  geofences?: Geofence[];
}

export default function LocationTaskDashboard() {
  const { isLoaded, loadError } = useGoogleMaps();

  const [locations, setLocations] = useState<EmployeeLocation[]>([]);
  const [tasks, setTasks] = useState<TaskWithLocation[]>([]);
  const [geofences, setGeofences] = useState<Geofence[]>([]);
  const [alerts, setAlerts] = useState<LocationAlert[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<EmployeeLocation | null>(null);
  const [selectedTask, setSelectedTask] = useState<TaskWithLocation | null>(null);
  const [showGeofences, setShowGeofences] = useState(true);
  const [showTaskLocations, setShowTaskLocations] = useState(true);
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'completed'>('active');
  const [isCreatingGeofence, setIsCreatingGeofence] = useState(false);
  const [newGeofence, setNewGeofence] = useState<{
    center: google.maps.LatLng | null;
    radius: number;
    name: string;
    description: string;
  }>({
    center: null,
    radius: 100,
    name: '',
    description: '',
  });

  const mapRef = useRef<google.maps.Map>();
  const latestLocationsRef = useRef<EmployeeLocation[]>([]);

  // Manual map controls
  const [latInput, setLatInput] = useState<string>('');
  const [lngInput, setLngInput] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [pickedPoint, setPickedPoint] = useState<{ lat: number; lng: number } | null>(null);
  const [isPickMode, setIsPickMode] = useState<boolean>(false);

  const onMapLoad = useCallback((map: google.maps.Map) => {
    mapRef.current = map;
    
    // Set initial center and a balanced zoom for visibility
    map.setCenter(center);
    map.setZoom(16);

    // Build a custom control panel (view + layers + overlays)
    const controlDiv = document.createElement('div');
    controlDiv.style.margin = '10px';
    controlDiv.innerHTML = `
      <div style="background: white; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); padding: 12px; display: flex; flex-direction: column; gap: 8px; min-width: 200px;">
        <div style="display:flex; align-items:center; justify-content:space-between; gap:8px; font-size: 14px; font-weight: bold; color: #374151; margin-bottom: 8px;">
          <span>🗺️ Map Controls</span>
          <button id="dash-hide-controls" title="Hide controls" style="padding:6px 10px; border:none; background:#e5e7eb; color:#111827; border-radius:6px; cursor:pointer; font-size:12px; font-weight:600;">Hide</button>
        </div>
        <button id="dash-sri-lanka-view" style="padding: 10px 16px; border: none; background: linear-gradient(135deg, #3b82f6, #1d4ed8); color: white; border-radius: 8px; cursor: pointer; font-size: 12px; font-weight: 600;">🇱🇰 Sri Lanka View</button>
        <button id="dash-reset-view" style="padding: 10px 16px; border: none; background: linear-gradient(135deg, #10b981, #059669); color: white; border-radius: 8px; cursor: pointer; font-size: 12px; font-weight: 600;">🔄 Reset View</button>
        <div style="border-top: 1px solid #e5e7eb; margin: 8px 0; padding-top: 8px;">
          <div style="font-size: 12px; font-weight: 600; color: #6b7280; margin-bottom: 6px;">Map Layers</div>
          <button id="dash-toggle-traffic" style="padding: 8px 12px; border: none; background: linear-gradient(135deg, #f59e0b, #d97706); color: white; border-radius: 6px; cursor: pointer; font-size: 11px; font-weight: 500; width: 100%; margin-bottom: 4px;">🚦 Traffic Layer</button>
          <button id="dash-toggle-transit" style="padding: 8px 12px; border: none; background: linear-gradient(135deg, #8b5cf6, #7c3aed); color: white; border-radius: 6px; cursor: pointer; font-size: 11px; font-weight: 500; width: 100%; margin-bottom: 4px;">🚌 Transit Lines</button>
          <button id="dash-toggle-bicycling" style="padding: 8px 12px; border: none; background: linear-gradient(135deg, #06b6d4, #0891b2); color: white; border-radius: 6px; cursor: pointer; font-size: 11px; font-weight: 500; width: 100%;">🚴 Bicycle Paths</button>
          <button id="dash-toggle-terrain" style="padding: 8px 12px; border: none; background: linear-gradient(135deg, #84cc16, #65a30d); color: white; border-radius: 6px; cursor: pointer; font-size: 11px; font-weight: 500; width: 100%; margin-top: 4px;">🏔️ Terrain</button>
        </div>
        <div style="border-top: 1px solid #e5e7eb; margin: 8px 0; padding-top: 8px;">
          <div style="font-size: 12px; font-weight: 600; color: #6b7280; margin-bottom: 6px;">Overlays</div>
          <button id="dash-toggle-heatmap" style="padding: 8px 12px; border: none; background: linear-gradient(135deg, #ef4444, #dc2626); color: white; border-radius: 6px; cursor: pointer; font-size: 11px; font-weight: 500; width: 100%; margin-bottom: 4px;">🔥 Heat Map</button>
          <button id="dash-toggle-weather" style="padding: 8px 12px; border: none; background: linear-gradient(135deg, #0ea5e9, #0284c7); color: white; border-radius: 6px; cursor: pointer; font-size: 11px; font-weight: 500; width: 100%;">🌤️ Weather</button>
        </div>
      </div>
    `;

    // Hover effects
    const buttons = controlDiv.querySelectorAll('button');
    buttons.forEach((button) => {
      button.addEventListener('mouseenter', () => {
        (button as HTMLElement).style.transform = 'translateY(-2px)';
        (button as HTMLElement).style.boxShadow = '0 6px 16px rgba(0,0,0,0.2)';
      });
      button.addEventListener('mouseleave', () => {
        (button as HTMLElement).style.transform = 'translateY(0)';
        (button as HTMLElement).style.boxShadow = 'none';
      });
    });

    const sriLankaBtn = controlDiv.querySelector('#dash-sri-lanka-view') as HTMLElement;
    sriLankaBtn.onclick = () => {
      map.setCenter(center);
      map.setZoom(8);
    };

    const resetBtn = controlDiv.querySelector('#dash-reset-view') as HTMLElement;
    resetBtn.onclick = () => {
      map.setCenter(center);
      map.setZoom(16);
    };

    // Layers and Overlays
    let trafficLayer: google.maps.TrafficLayer | null = null;
    let transitLayer: google.maps.TransitLayer | null = null;
    let bicyclingLayer: google.maps.BicyclingLayer | null = null;
    let heatmapLayer: google.maps.visualization.HeatmapLayer | null = null;
    let weatherCircles: google.maps.Circle[] = [];

    const trafficBtn = controlDiv.querySelector('#dash-toggle-traffic') as HTMLElement;
    trafficBtn.onclick = () => {
      if (!trafficLayer) {
        trafficLayer = new window.google.maps.TrafficLayer();
        trafficLayer.setMap(map);
        trafficBtn.innerHTML = '🚦 Hide Traffic';
        (trafficBtn as HTMLElement).style.background = 'linear-gradient(135deg, #ef4444, #dc2626)';
      } else {
        trafficLayer.setMap(null);
        trafficLayer = null;
        trafficBtn.innerHTML = '🚦 Traffic Layer';
        (trafficBtn as HTMLElement).style.background = 'linear-gradient(135deg, #f59e0b, #d97706)';
      }
    };

    const heatmapBtn = controlDiv.querySelector('#dash-toggle-heatmap') as HTMLElement;
    heatmapBtn.onclick = () => {
      try {
        if (!heatmapLayer) {
          const pts = (latestLocationsRef.current || []).map(loc => ({
            location: new window.google.maps.LatLng(loc.latitude, loc.longitude),
            weight: 1,
          }));
          if (!('visualization' in window.google.maps)) {
            toast.error('Heatmap library not available');
            return;
          }
          heatmapLayer = new window.google.maps.visualization.HeatmapLayer({
            data: pts,
            radius: 48,
            opacity: 0.6,
          });
          heatmapLayer.setMap(map);
          heatmapBtn.innerHTML = '🔥 Hide Heat Map';
          (heatmapBtn as HTMLElement).style.background = 'linear-gradient(135deg, #ef4444, #dc2626)';
        } else {
          heatmapLayer.setMap(null);
          heatmapLayer = null;
          heatmapBtn.innerHTML = '🔥 Heat Map';
          (heatmapBtn as HTMLElement).style.background = 'linear-gradient(135deg, #ef4444, #dc2626)';
        }
      } catch {
        toast.error('Unable to toggle heatmap');
      }
    };

    const weatherBtn = controlDiv.querySelector('#dash-toggle-weather') as HTMLElement;
    weatherBtn.onclick = () => {
      if (weatherCircles.length === 0) {
        const centers = [
          { lat: 6.9271, lng: 79.8612 },
          { lat: 7.2906, lng: 80.6337 },
          { lat: 6.0535, lng: 80.2210 },
        ];
        weatherCircles = centers.map(c => new window.google.maps.Circle({
          center: c,
          radius: 20000,
          strokeColor: '#0ea5e9',
          strokeOpacity: 0,
          strokeWeight: 0,
          fillColor: '#0ea5e9',
          fillOpacity: 0.15,
          map,
        }));
        weatherBtn.innerHTML = '🌤️ Hide Weather';
        (weatherBtn as HTMLElement).style.background = 'linear-gradient(135deg, #ef4444, #dc2626)';
      } else {
        weatherCircles.forEach(c => c.setMap(null));
        weatherCircles = [];
        weatherBtn.innerHTML = '🌤️ Weather';
        (weatherBtn as HTMLElement).style.background = 'linear-gradient(135deg, #0ea5e9, #0284c7)';
      }
    };

    const transitBtn = controlDiv.querySelector('#dash-toggle-transit') as HTMLElement;
    transitBtn.onclick = () => {
      if (!transitLayer) {
        transitLayer = new window.google.maps.TransitLayer();
        transitLayer.setMap(map);
        transitBtn.innerHTML = '🚌 Hide Transit';
        (transitBtn as HTMLElement).style.background = 'linear-gradient(135deg, #ef4444, #dc2626)';
      } else {
        transitLayer.setMap(null);
        transitLayer = null;
        transitBtn.innerHTML = '🚌 Transit Lines';
        (transitBtn as HTMLElement).style.background = 'linear-gradient(135deg, #8b5cf6, #7c3aed)';
      }
    };

    const bicyclingBtn = controlDiv.querySelector('#dash-toggle-bicycling') as HTMLElement;
    bicyclingBtn.onclick = () => {
      if (!bicyclingLayer) {
        bicyclingLayer = new window.google.maps.BicyclingLayer();
        bicyclingLayer.setMap(map);
        bicyclingBtn.innerHTML = '🚴 Hide Bicycle';
        (bicyclingBtn as HTMLElement).style.background = 'linear-gradient(135deg, #ef4444, #dc2626)';
      } else {
        bicyclingLayer.setMap(null);
        bicyclingLayer = null;
        bicyclingBtn.innerHTML = '🚴 Bicycle Paths';
        (bicyclingBtn as HTMLElement).style.background = 'linear-gradient(135deg, #06b6d4, #0891b2)';
      }
    };

    const terrainBtn = controlDiv.querySelector('#dash-toggle-terrain') as HTMLElement;
    terrainBtn.onclick = () => {
      if (map.getMapTypeId && map.getMapTypeId() !== 'terrain') {
        map.setMapTypeId('terrain');
        terrainBtn.innerHTML = '🏔️ Hide Terrain';
        (terrainBtn as HTMLElement).style.background = 'linear-gradient(135deg, #ef4444, #dc2626)';
      } else {
        map.setMapTypeId('roadmap');
        terrainBtn.innerHTML = '🏔️ Terrain';
        (terrainBtn as HTMLElement).style.background = 'linear-gradient(135deg, #84cc16, #65a30d)';
      }
    };

    map.controls[window.google.maps.ControlPosition.TOP_RIGHT].push(controlDiv);

    // Hide/Show controls toggle
    const hideBtn = controlDiv.querySelector('#dash-hide-controls') as HTMLElement;
    let showBtn: HTMLDivElement | null = null;
    hideBtn.onclick = () => {
      (controlDiv.firstElementChild as HTMLElement).style.display = 'none';
      controlDiv.style.display = 'none';
      showBtn = document.createElement('div');
      showBtn.style.margin = '10px';
      showBtn.innerHTML = `
        <div id="dash-show-controls" style="background: #111827; color: #ffffff; border-radius: 9999px; padding: 8px 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.2); cursor: pointer; font-size:12px; font-weight:600;">
          Show Controls
        </div>
      `;
      map.controls[window.google.maps.ControlPosition.TOP_RIGHT].push(showBtn);
      const showBtnEl = showBtn.querySelector('#dash-show-controls') as HTMLElement;
      showBtnEl.onclick = () => {
        if (showBtn) {
          const ctrls = map.controls[window.google.maps.ControlPosition.TOP_RIGHT];
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
  }, []);

  const centerToInputs = () => {
    const lat = parseFloat(latInput);
    const lng = parseFloat(lngInput);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || !mapRef.current) return;
    mapRef.current.setCenter({ lat, lng });
    mapRef.current.setZoom(Math.max(mapRef.current.getZoom() || 18, 18));
    setPickedPoint({ lat, lng });
  };

  const getCurrentLocation = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setLatInput(String(lat));
        setLngInput(String(lng));
        if (mapRef.current) {
          mapRef.current.setCenter({ lat, lng });
          mapRef.current.setZoom(18);
        }
        setPickedPoint({ lat, lng });
      },
      () => {},
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const searchLocation = async () => {
    const query = searchQuery.trim();
    if (!query || !mapRef.current) return;
    setIsSearching(true);
    try {
      const geocoder = new window.google.maps.Geocoder();
      const res = await geocoder.geocode({ address: query });
      const first = res.results?.[0];
      if (first?.geometry?.location) {
        const lat = first.geometry.location.lat();
        const lng = first.geometry.location.lng();
        mapRef.current.setCenter({ lat, lng });
        mapRef.current.setZoom(18);
        setPickedPoint({ lat, lng });
      }
    } catch {
      // ignore
    } finally {
      setIsSearching(false);
    }
  };

  const zoomIn = () => {
    if (!mapRef.current) return;
    const z = mapRef.current.getZoom() || 16;
    mapRef.current.setZoom(Math.min(25, z + 1));
  };

  const zoomOut = () => {
    if (!mapRef.current) return;
    const z = mapRef.current.getZoom() || 16;
    mapRef.current.setZoom(Math.max(1, z - 1));
  };

  const fetchData = useCallback(async () => {
    // Fetch locations, tasks (with relation if available), and geofences.
    try {
      const locationsPromise = EnhancedLocationService.getEmployeeLocations();

      // Try selecting tasks with related task_locations; fall back to plain tasks if relation missing
      const tasksPromise = (async () => {
        const { data, error } = await supabase
          .from('tasks')
          .select(`
            *,
            task_locations (
              geofence_id,
              required_latitude,
              required_longitude,
              required_radius_meters
            )
          `)
          .order('created_at', { ascending: false });

        if (error) {
          // Fallback: fetch tasks without relation (e.g., when relation/table not present yet)
          const fallback = await supabase
            .from('tasks')
            .select('*')
            .order('created_at', { ascending: false });
          if (fallback.error) throw fallback.error;
          return (fallback.data || []).map((t: any) => ({ ...t, task_locations: [] }));
        }

        return data || [];
      })();

      // Geofences may not exist in some deployments. Default to empty array on error.
      const geofencesPromise = GeofencingService.getGeofences(true).catch(() => [] as Geofence[]);

      const [locationData, taskData, geofenceData] = await Promise.all([
        locationsPromise,
        tasksPromise,
        geofencesPromise,
      ]);

      setLocations(locationData);
      latestLocationsRef.current = locationData;
      setGeofences(geofenceData);

      // Process tasks with geofence data when available
      const tasksWithGeofences = (taskData || []).map((task: any) => {
        const taskGeofences: Geofence[] = [];
        if (Array.isArray(task.task_locations)) {
          for (const taskLocation of task.task_locations) {
            if (taskLocation.geofence_id) {
              const geofence = geofenceData.find((g: Geofence) => g.id === taskLocation.geofence_id);
              if (geofence) taskGeofences.push(geofence);
            }
          }
        }
        return { ...task, geofences: taskGeofences } as TaskWithLocation;
      });

      setTasks(tasksWithGeofences);

      // Fit map bounds to include all markers
      if (locationData.length > 0 && mapRef.current) {
        const bounds = new window.google.maps.LatLngBounds();
        locationData.forEach((location) => {
          bounds.extend({ lat: location.latitude, lng: location.longitude });
        });
        tasksWithGeofences.forEach((task) => {
          if (task.location_latitude && task.location_longitude) {
            bounds.extend({ lat: task.location_latitude, lng: task.location_longitude });
          }
          task.geofences?.forEach((geofence: any) => {
            bounds.extend({ lat: geofence.center_latitude, lng: geofence.center_longitude });
          });
        });
        mapRef.current.fitBounds(bounds);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      // Do not interrupt the UI with a toast; keep dashboard usable even if one source fails
    }
  }, []);

  const fetchAlerts = useCallback(async () => {
    try {
      // Fetch recent alerts for all users (admin view)
      const { data, error } = await supabase
        .from('location_alerts')
        .select(`
          *,
          users:user_id (
            full_name
          )
        `)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      setAlerts(data || []);
    } catch (error) {
      console.error('Error fetching alerts:', error);
    }
  }, []);

  useEffect(() => {
    fetchData();
    fetchAlerts();
    
    // DISABLED automatic updates to prevent continuous refreshing
    // const interval = setInterval(fetchData, 30000);

    // Subscribe to location alerts
    const alertSubscription = supabase
      .channel('location_alerts_admin')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'location_alerts',
        },
        () => {
          fetchAlerts();
        }
      )
      .subscribe();

    return () => {
      // clearInterval(interval);
      alertSubscription.unsubscribe();
    };
  }, []); // Empty dependency array to run only once on mount

  const handleMapClick = useCallback((event: google.maps.MapMouseEvent) => {
    if (isCreatingGeofence && event.latLng) {
      setNewGeofence(prev => ({
        ...prev,
        center: event.latLng,
      }));
    }
  }, [isCreatingGeofence]);

  const createGeofence = async () => {
    if (!newGeofence.center || !newGeofence.name.trim()) {
      toast.error('Please select a location and provide a name for the geofence');
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      await GeofencingService.createGeofence({
        name: newGeofence.name,
        description: newGeofence.description,
        center_latitude: newGeofence.center.lat(),
        center_longitude: newGeofence.center.lng(),
        radius_meters: newGeofence.radius,
        created_by: user.id,
        is_active: true,
      });

      toast.success('Geofence created successfully');
      setIsCreatingGeofence(false);
      setNewGeofence({
        center: null,
        radius: 100,
        name: '',
        description: '',
      });
      fetchData();
    } catch (error) {
      console.error('Error creating geofence:', error);
      toast.error('Failed to create geofence');
    }
  };

  const getEmployeeStatusColor = (location: EmployeeLocation) => {
    const timeDiff = Date.now() - new Date(location.timestamp).getTime();
    const minutesAgo = timeDiff / (1000 * 60);

    if (minutesAgo > 30) return '#EF4444'; // Red - offline/stale
    if (location.connection_status === 'offline') return '#F59E0B'; // Orange - offline but recent
    return '#10B981'; // Green - online and recent
  };

  const getTaskStatusColor = (task: TaskWithLocation) => {
    switch (task.status) {
      case 'Not Started': return '#6B7280';
      case 'In Progress': return '#3B82F6';
      case 'Paused': return '#F59E0B';
      case 'Completed': return '#10B981';
      default: return '#6B7280';
    }
  };

  const filteredTasks = tasks.filter(task => {
    if (filterStatus === 'active') return task.status !== 'Completed';
    if (filterStatus === 'completed') return task.status === 'Completed';
    return true;
  });

  const unreadAlerts = alerts.filter(alert => !alert.is_read);

  const handleGeofenceSelect = (geofence: Geofence) => {
    // Implementation
  };

  if (loadError) return <div className="p-4 text-red-600">Error loading maps</div>;
  if (!isLoaded) return <div className="p-4">Loading maps...</div>;

  return (
    <div className="space-y-6">
      {/* Header with Controls */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Location Task Dashboard</h2>
            <p className="text-gray-600">Monitor employee locations and task progress in real-time</p>
          </div>
          
          <div className="flex flex-wrap gap-4">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="show-geofences"
                checked={showGeofences}
                onChange={(e) => setShowGeofences(e.target.checked)}
                className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
              />
              <label htmlFor="show-geofences" className="text-sm font-medium text-gray-700">
                Show Geofences
              </label>
            </div>
            
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="show-task-locations"
                checked={showTaskLocations}
                onChange={(e) => setShowTaskLocations(e.target.checked)}
                className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
              />
              <label htmlFor="show-task-locations" className="text-sm font-medium text-gray-700">
                Show Task Locations
              </label>
            </div>

            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as any)}
              className="rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
              aria-label="Filter tasks by status"
            >
              <option value="all">All Tasks</option>
              <option value="active">Active Tasks</option>
              <option value="completed">Completed Tasks</option>
            </select>

            <button
              onClick={() => setIsCreatingGeofence(!isCreatingGeofence)}
              className={`inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white ${
                isCreatingGeofence ? 'bg-red-600 hover:bg-red-700' : 'bg-indigo-600 hover:bg-indigo-700'
              } focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500`}
            >
              <MapIcon className="h-5 w-5 mr-2" />
              {isCreatingGeofence ? 'Cancel' : 'Create Geofence'}
            </button>
        </div>

        {/* Manual Map Controls */}
        <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
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

      {/* Geofence Creation Form */}
        {isCreatingGeofence && (
          <div className="mt-4 p-4 bg-gray-50 rounded-lg">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Create New Geofence</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Name</label>
                <input
                  type="text"
                  value={newGeofence.name}
                  onChange={(e) => setNewGeofence(prev => ({ ...prev, name: e.target.value }))}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                  placeholder="Geofence name"
                />
              </div>
              <div>
                <label htmlFor="radius" className="block text-sm font-medium text-gray-700">Radius (meters)</label>
                <input
                  id="radius"
                  type="number"
                  value={newGeofence.radius}
                  onChange={(e) => setNewGeofence(prev => ({ ...prev, radius: parseInt(e.target.value) }))}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                  min="10"
                  max="5000"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Description</label>
                <input
                  type="text"
                  value={newGeofence.description}
                  onChange={(e) => setNewGeofence(prev => ({ ...prev, description: e.target.value }))}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                  placeholder="Optional description"
                />
              </div>
            </div>
            <div className="mt-4 flex gap-2">
              <button
                onClick={createGeofence}
                disabled={!newGeofence.center || !newGeofence.name.trim()}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50"
              >
                Create Geofence
              </button>
              <p className="text-sm text-gray-600 flex items-center">
                {newGeofence.center ? 'Geofence location selected' : 'Click on the map to select location'}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <UserGroupIcon className="h-8 w-8 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Active Employees</p>
              <p className="text-2xl font-semibold text-gray-900">{locations.length}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <ClockIcon className="h-8 w-8 text-yellow-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Active Tasks</p>
              <p className="text-2xl font-semibold text-gray-900">
                {tasks.filter(t => t.status !== 'Completed').length}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <CheckCircleIcon className="h-8 w-8 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Completed Today</p>
              <p className="text-2xl font-semibold text-gray-900">
                {tasks.filter(t => 
                  t.status === 'Completed' && 
                  t.completed_at && 
                  new Date(t.completed_at).toDateString() === new Date().toDateString()
                ).length}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <BellIcon className="h-8 w-8 text-red-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Unread Alerts</p>
              <p className="text-2xl font-semibold text-gray-900">{unreadAlerts.length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Map */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <GoogleMap
          mapContainerStyle={mapContainerStyle}
          zoom={16}
          center={center}
          options={mapOptions}
          onLoad={onMapLoad}
          onClick={(e) => {
            handleMapClick(e);
            if (isPickMode && e.latLng) {
              const lat = e.latLng.lat();
              const lng = e.latLng.lng();
              setLatInput(String(lat));
              setLngInput(String(lng));
              setPickedPoint({ lat, lng });
            }
          }}
        >
          {/* Employee Location Markers */}
          {locations.map((location) => (
            <Marker
              key={location.id}
              position={{
                lat: location.latitude,
                lng: location.longitude,
              }}
              icon={{
                url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`
                  <svg width="56" height="56" viewBox="0 0 56 56" xmlns="http://www.w3.org/2000/svg">
                    <defs>
                      <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
                        <feGaussianBlur stdDeviation="4" result="coloredBlur"/>
                        <feMerge> 
                          <feMergeNode in="coloredBlur"/>
                          <feMergeNode in="SourceGraphic"/>
                        </feMerge>
                      </filter>
                      <filter id="shadow" x="-50%" y="-50%" width="200%" height="200%">
                        <feDropShadow dx="2" dy="4" stdDeviation="3" flood-color="rgba(0,0,0,0.3)"/>
                      </filter>
                      <linearGradient id="markerGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" style="stop-color:#ff4444;stop-opacity:1" />
                        <stop offset="100%" style="stop-color:#cc0000;stop-opacity:1" />
                      </linearGradient>
                    </defs>
                    <!-- Outer glow ring -->
                    <circle cx="28" cy="28" r="26" fill="#ff0000" opacity="0.2" filter="url(#glow)"/>
                    <!-- Main marker with gradient -->
                    <circle cx="28" cy="28" r="20" fill="url(#markerGradient)" stroke="white" stroke-width="4" filter="url(#shadow)"/>
                    <!-- Inner white circle -->
                    <circle cx="28" cy="28" r="12" fill="white" opacity="0.9"/>
                    <!-- Enhanced status indicator -->
                    <circle cx="42" cy="14" r="8" fill="${getEmployeeStatusColor(location)}" stroke="white" stroke-width="3" filter="url(#shadow)"/>
                  </svg>
                `)}`,
                scaledSize: new window.google.maps.Size(56, 56),
                anchor: new window.google.maps.Point(28, 28),
              }}
              onClick={() => setSelectedLocation(location)}
            />
          ))}

          {/* Task Location Markers */}
          {showTaskLocations && filteredTasks.map((task) => {
            if (task.location_latitude && task.location_longitude) {
              return (
                <Marker
                  key={`task-${task.id}`}
                  position={{
                    lat: task.location_latitude,
                    lng: task.location_longitude,
                  }}
                  icon={{
                    url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`
                      <svg width="30" height="30" viewBox="0 0 30 30" xmlns="http://www.w3.org/2000/svg">
                        <rect x="5" y="5" width="20" height="20" fill="${getTaskStatusColor(task)}" stroke="white" stroke-width="2" rx="3"/>
                        <text x="15" y="18" text-anchor="middle" fill="white" font-size="12" font-weight="bold">T</text>
                      </svg>
                    `)}`,
                    scaledSize: new window.google.maps.Size(30, 30),
                    anchor: new window.google.maps.Point(15, 15),
                  }}
                  onClick={() => setSelectedTask(task)}
                />
              );
            }
            return null;
          })}

          {/* Geofence Circles */}
          {showGeofences && geofences.map((geofence) => (
            <Circle
              key={geofence.id}
              center={{
                lat: geofence.center_latitude,
                lng: geofence.center_longitude,
              }}
              radius={geofence.radius_meters}
              options={{
                strokeColor: '#FF0000',
                strokeOpacity: 0.8,
                strokeWeight: 2,
                fillColor: '#FF0000',
                fillOpacity: 0.35,
                clickable: true,
                draggable: false,
                editable: true,
                visible: true,
                zIndex: 1
              }}
            />
          ))}

          {/* New Geofence Preview */
          }
          {isCreatingGeofence && newGeofence.center && (
            <Circle
              center={{
                lat: newGeofence.center.lat(),
                lng: newGeofence.center.lng(),
              }}
              radius={newGeofence.radius}
              options={{
                strokeColor: '#FF0000',
                strokeOpacity: 0.8,
                strokeWeight: 2,
                fillColor: '#FF0000',
                fillOpacity: 0.35,
                clickable: true,
                draggable: false,
                editable: true,
                visible: true,
                zIndex: 1
              }}
            />
          )}

          {/* Picked Location Marker */}
          {pickedPoint && (
            <Marker position={{ lat: pickedPoint.lat, lng: pickedPoint.lng }} />
          )}

          {/* Employee Location Info Window */}
          {selectedLocation && (
            <InfoWindow
              position={{
                lat: selectedLocation.latitude,
                lng: selectedLocation.longitude,
              }}
              onCloseClick={() => setSelectedLocation(null)}
            >
              <div className="p-2 max-w-xs">
                <div className="flex items-center mb-2">
                  <img
                    src={selectedLocation.users.avatar_url || `https://ui-avatars.com/api/?name=${selectedLocation.users.full_name}`}
                    alt={selectedLocation.users.full_name}
                    className="w-10 h-10 rounded-full mr-2"
                  />
                  <div>
                    <h3 className="font-semibold">{selectedLocation.users.full_name}</h3>
                    <p className="text-sm text-gray-600">
                      {new Date(selectedLocation.timestamp).toLocaleString()}
                    </p>
                  </div>
                </div>
                <div className="text-sm space-y-1">
                  <p>
                    Status: <span className={`font-semibold ${
                      selectedLocation.connection_status === 'online' ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {selectedLocation.connection_status}
                    </span>
                  </p>
                  {selectedLocation.battery_level && (
                    <p>Battery: <span className="font-semibold">{selectedLocation.battery_level}%</span></p>
                  )}
                  {selectedLocation.location_accuracy && (
                    <p>Accuracy: <span className="font-semibold">{Math.round(selectedLocation.location_accuracy)}m</span></p>
                  )}
                  {selectedLocation.task_id && (
                    <p className="text-blue-600">Currently on task</p>
                  )}
                </div>
              </div>
            </InfoWindow>
          )}

          {/* Task Info Window */}
          {selectedTask && (
            <InfoWindow
              position={{
                lat: selectedTask.location_latitude!,
                lng: selectedTask.location_longitude!,
              }}
              onCloseClick={() => setSelectedTask(null)}
            >
              <div className="p-2 max-w-xs">
                <h3 className="font-semibold text-lg">{selectedTask.title}</h3>
                <p className="text-sm text-gray-600 mb-2">{selectedTask.description}</p>
                <div className="text-sm space-y-1">
                  <p>
                    Status: <span className={`font-semibold`} style={{ color: getTaskStatusColor(selectedTask) }}>
                      {selectedTask.status}
                    </span>
                  </p>
                  <p>Priority: <span className="font-semibold">{selectedTask.priority}</span></p>
                  <p>Price: <span className="font-semibold">{formatCurrency(selectedTask.price)}</span></p>
                  <p>Due: <span className="font-semibold">{new Date(selectedTask.due_date).toLocaleDateString()}</span></p>
                  {selectedTask.geofences && selectedTask.geofences.length > 0 && (
                    <p className="text-blue-600">Has geofence requirements</p>
                  )}
                </div>
              </div>
            </InfoWindow>
          )}
        </GoogleMap>
      </div>

      {/* Recent Alerts */}
      {unreadAlerts.length > 0 && (
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">Recent Alerts</h3>
          </div>
          <div className="divide-y divide-gray-200">
            {unreadAlerts.slice(0, 5).map((alert) => (
              <div key={alert.id} className="px-6 py-4">
                <div className="flex items-start">
                  <div className="flex-shrink-0">
                    {alert.alert_type === 'emergency' && (
                      <ExclamationIcon className="h-6 w-6 text-red-600" />
                    )}
                    {alert.alert_type === 'arrival' && (
                      <LocationMarkerIcon className="h-6 w-6 text-green-600" />
                    )}
                    {alert.alert_type === 'task_completion' && (
                      <CheckCircleIcon className="h-6 w-6 text-blue-600" />
                    )}
                    {!['emergency', 'arrival', 'task_completion'].includes(alert.alert_type) && (
                      <BellIcon className="h-6 w-6 text-yellow-600" />
                    )}
                  </div>
                  <div className="ml-3 flex-1">
                    <p className="text-sm font-medium text-gray-900">{alert.title}</p>
                    <p className="text-sm text-gray-600">{alert.message}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      {new Date(alert.created_at).toLocaleString()}
                    </p>
                  </div>
                  <div className="ml-3">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      alert.priority === 'critical' ? 'bg-red-100 text-red-800' :
                      alert.priority === 'high' ? 'bg-orange-100 text-orange-800' :
                      alert.priority === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {alert.priority}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}