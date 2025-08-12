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

const mapContainerStyle = {
  width: '100%',
  height: 'calc(100vh - 16rem)',
  borderRadius: '0.5rem',
};

const defaultCenter = { lat: 7.8731, lng: 80.7718 };

const mapOptions = {
  disableDefaultUI: false,
  zoomControl: true,
  mapTypeControl: true,
  streetViewControl: false,
  fullscreenControl: true,
  styles: [
    { featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] },
  ],
};

export default function EmployeeTrackingMap() {
  const { isLoaded } = useLoadScript({
    googleMapsApiKey: 'AIzaSyARSoKujCNX2odk8wachQyz0DIjBCqJNd4',
    libraries: ['places', 'geometry'],
  });

  const navigate = useNavigate();
  const [locations, setLocations] = useState<EmployeeLocation[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<EmployeeLocation | null>(null);
  const [showInactive, setShowInactive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mapRef = useRef<google.maps.Map>();
  const [addressCache, setAddressCache] = useState<Record<string, string>>({});

  // Path tracking state
  const [movementPath, setMovementPath] = useState<Array<{ lat: number; lng: number; timestamp: string }>>([]);
  const [turnPoints, setTurnPoints] = useState<Array<{ lat: number; lng: number; angle: number; timestamp: string }>>([]);
  const [totalDistanceKm, setTotalDistanceKm] = useState<number>(0);
  const [dailyDistanceKm, setDailyDistanceKm] = useState<number>(0);
  const [speedKmh, setSpeedKmh] = useState<number>(0);
  const [headingDeg, setHeadingDeg] = useState<number>(0);
  const [followSelected, setFollowSelected] = useState<boolean>(true);
  const [lookbackHours, setLookbackHours] = useState<number>(2);
  const [dailyMovingMin, setDailyMovingMin] = useState<number>(0);
  const [dailyIdleMin, setDailyIdleMin] = useState<number>(0);
  const [dailyAvgSpeedKmh, setDailyAvgSpeedKmh] = useState<number>(0);
  const [dailyTimePerKmMin, setDailyTimePerKmMin] = useState<number>(0);
  const [dailyStops, setDailyStops] = useState<number>(0);

  const onMapLoad = useCallback((map: google.maps.Map) => {
    mapRef.current = map;
  }, []);

  const fetchAddress = useCallback(async (lat: number, lng: number): Promise<string> => {
    const cacheKey = `${lat},${lng}`;
    if (addressCache[cacheKey]) return addressCache[cacheKey];
    try {
      const geocoder = new google.maps.Geocoder();
      const result = await geocoder.geocode({ location: { lat, lng } });
      const address = result.results[0]?.formatted_address || 'Address unknown';
      setAddressCache(prev => ({ ...prev, [cacheKey]: address }));
      return address;
    } catch (error) {
      console.error('Geocoding error:', error);
      return 'Address lookup failed';
    }
  }, [addressCache]);

  const fetchLocations = useCallback(async () => {
    try {
      const data = await LocationService.getEmployeeLocations();
      const locationsWithAddresses = await Promise.all(
        data.map(async (location: EmployeeLocation) => ({
          ...location,
          address: await fetchAddress(location.latitude, location.longitude),
        }))
      );

      setLocations(locationsWithAddresses);
      setError(null);

      // Keep selected employee updated with latest position
      if (selectedLocation) {
        const latest = locationsWithAddresses
          .filter(l => l.user_id === selectedLocation.user_id)
          .sort((a, b) => new Date(b.recorded_at).getTime() - new Date(a.recorded_at).getTime())[0];
        if (latest) {
          setSelectedLocation(latest);
          if (followSelected && mapRef.current) {
            mapRef.current.panTo({ lat: latest.latitude, lng: latest.longitude });
          }
        }
      }

      // Fit bounds if nothing is selected
      if (!selectedLocation && locationsWithAddresses.length > 0 && mapRef.current) {
        const bounds = new google.maps.LatLngBounds();
        locationsWithAddresses.forEach((location) => {
          bounds.extend({ lat: location.latitude, lng: location.longitude });
        });
        mapRef.current.fitBounds(bounds);
        if (locationsWithAddresses.length === 1) {
          mapRef.current.setZoom(20);
        }
      }
    } catch (error) {
      console.error('Error fetching locations:', error);
      setError('Failed to fetch employee locations');
      toast.error('Failed to update employee locations');
    }
  }, [fetchAddress, selectedLocation, followSelected]);

  const computeBearing = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const toRad = (deg: number) => (deg * Math.PI) / 180;
    const toDeg = (rad: number) => (rad * 180) / Math.PI;
    const φ1 = toRad(lat1);
    const φ2 = toRad(lat2);
    const Δλ = toRad(lon2 - lon1);
    const y = Math.sin(Δλ) * Math.cos(φ2);
    const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
    const θ = Math.atan2(y, x);
    return (toDeg(θ) + 360) % 360;
  };

  const fetchMovementHistory = useCallback(async (userId: string) => {
    try {
      const since = new Date(Date.now() - lookbackHours * 60 * 60 * 1000);
      const history = await GeofencingService.getMovementHistory(userId, since);
      if (!history || history.length === 0) {
        setMovementPath([]);
        setTurnPoints([]);
        setTotalDistanceKm(0);
        setDailyDistanceKm(0);
        setSpeedKmh(0);
        setHeadingDeg(0);
        setDailyMovingMin(0);
        setDailyIdleMin(0);
        setDailyAvgSpeedKmh(0);
        setDailyTimePerKmMin(0);
        setDailyStops(0);
        return;
      }

      const coords = history
        .map(h => ({ lat: h.latitude, lng: h.longitude, timestamp: h.timestamp }))
        .filter(p => typeof p.lat === 'number' && typeof p.lng === 'number');

      // Total distance (lookback)
      let totalMeters = 0;
      for (let i = 1; i < coords.length; i += 1) {
        totalMeters += GeofencingService.calculateDistance(
          coords[i - 1].lat,
          coords[i - 1].lng,
          coords[i].lat,
          coords[i].lng
        );
      }

      // Daily metrics
      const midnight = new Date();
      midnight.setHours(0, 0, 0, 0);
      const todayHistory = await GeofencingService.getMovementHistory(userId, midnight);
      let dailyMeters = 0;
      let movingSec = 0;
      let idleSec = 0;
      let stops = 0;
      let idleStreakSec = 0;
      const MOVE_THRESHOLD_M = 15;
      const STOP_THRESHOLD_SEC = 5 * 60;
      for (let i = 1; i < (todayHistory?.length || 0); i += 1) {
        const prev = todayHistory![i - 1];
        const curr = todayHistory![i];
        const segMeters = GeofencingService.calculateDistance(prev.latitude, prev.longitude, curr.latitude, curr.longitude);
        const segSec = (new Date(curr.timestamp).getTime() - new Date(prev.timestamp).getTime()) / 1000;
        dailyMeters += segMeters;
        if (segMeters >= MOVE_THRESHOLD_M) {
          movingSec += segSec;
          if (idleStreakSec >= STOP_THRESHOLD_SEC) stops += 1;
          idleStreakSec = 0;
        } else {
          idleSec += segSec;
          idleStreakSec += segSec;
        }
      }
      if (idleStreakSec >= STOP_THRESHOLD_SEC) stops += 1;

      const dailyKm = dailyMeters / 1000;
      const avgSpeed = movingSec > 0 ? (dailyKm) / (movingSec / 3600) : 0;
      const timePerKmMin = dailyKm > 0 ? (movingSec / 60) / dailyKm : 0;

      setDailyDistanceKm(Math.round(dailyKm * 100) / 100);
      setDailyMovingMin(Math.round(movingSec / 60));
      setDailyIdleMin(Math.round(idleSec / 60));
      setDailyStops(stops);
      setDailyAvgSpeedKmh(Math.round(avgSpeed * 10) / 10);
      setDailyTimePerKmMin(Math.round(timePerKmMin * 10) / 10);

      // Speed/heading (lookback)
      if (coords.length >= 2) {
        const a = coords[coords.length - 2];
        const b = coords[coords.length - 1];
        const meters = GeofencingService.calculateDistance(a.lat, a.lng, b.lat, b.lng);
        const seconds = (new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()) / 1000;
        const kmh = seconds > 0 ? (meters / 1000) / (seconds / 3600) : 0;
        setSpeedKmh(Math.max(0, Math.round(kmh * 10) / 10));
        setHeadingDeg(Math.round(computeBearing(a.lat, a.lng, b.lat, b.lng)));
      } else {
        setSpeedKmh(0);
        setHeadingDeg(0);
      }

      // Turns
      const TURN_THRESHOLD_DEGREES = 35;
      const turns: Array<{ lat: number; lng: number; angle: number; timestamp: string }> = [];
      for (let i = 2; i < coords.length; i += 1) {
        const a = coords[i - 2];
        const b = coords[i - 1];
        const c = coords[i];
        const bearingAB = computeBearing(a.lat, a.lng, b.lat, b.lng);
        const bearingBC = computeBearing(b.lat, b.lng, c.lat, c.lng);
        let delta = Math.abs(bearingBC - bearingAB);
        if (delta > 180) delta = 360 - delta;
        if (delta >= TURN_THRESHOLD_DEGREES) {
          turns.push({ lat: b.lat, lng: b.lng, angle: Math.round(delta), timestamp: b.timestamp });
        }
      }

      setMovementPath(coords);
      setTurnPoints(turns);
      setTotalDistanceKm(Math.round((totalMeters / 1000) * 100) / 100);

      const last = coords[coords.length - 1];
      if (followSelected && mapRef.current) {
        mapRef.current.panTo({ lat: last.lat, lng: last.lng });
        mapRef.current.setZoom(19);
      }
    } catch (e) {
      console.error('Failed to fetch movement history:', e);
    }
  }, [followSelected, lookbackHours]);

  // Realtime updates for selected user
  useEffect(() => {
    if (!selectedLocation?.user_id) return;
    const channel = supabase
      .channel(`movement_${selectedLocation.user_id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'employee_movement_history', filter: `user_id=eq.${selectedLocation.user_id}` },
        (payload) => {
          const row: any = payload.new;
          const point = { lat: row.latitude, lng: row.longitude, timestamp: row.timestamp };
          setMovementPath(prev => {
            const updated = [...prev, point];
            if (updated.length >= 2) {
              const a = updated[updated.length - 2];
              const b = updated[updated.length - 1];
              const incM = GeofencingService.calculateDistance(a.lat, a.lng, b.lat, b.lng);
              setTotalDistanceKm(prevKm => Math.round((prevKm + incM / 1000) * 100) / 100);
              const seconds = (new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()) / 1000;
              const kmh = seconds > 0 ? (incM / 1000) / (seconds / 3600) : 0;
              setSpeedKmh(Math.max(0, Math.round(kmh * 10) / 10));
              setHeadingDeg(Math.round(computeBearing(a.lat, a.lng, b.lat, b.lng)));
            }
            return updated;
          });
          setSelectedLocation(prev => (prev ? { ...prev, latitude: point.lat, longitude: point.lng, recorded_at: point.timestamp } : prev));
          if (followSelected && mapRef.current) {
            mapRef.current.panTo({ lat: point.lat, lng: point.lng });
          }
        }
      )
      .subscribe();
    return () => {
      channel.unsubscribe();
    };
  }, [selectedLocation?.user_id, followSelected]);

  // Periodic refresh for list & movement
  useEffect(() => {
    fetchLocations();
    const interval = setInterval(fetchLocations, 30000);
    return () => clearInterval(interval);
  }, [fetchLocations]);

  if (!isLoaded) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 p-4 rounded-md">
        <div className="flex">
          <ExclamationIcon className="h-5 w-5 text-red-400" aria-hidden="true" />
          <div className="ml-3">
            <h3 className="text-sm font-medium text-red-800">Error loading employee locations</h3>
            <p className="text-sm text-red-700 mt-2">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  const filteredLocations = locations.filter(
    location => showInactive || location.connection_status === 'online'
  );

  const zoomToSelected = () => {
    if (selectedLocation && mapRef.current) {
      mapRef.current.panTo({ lat: selectedLocation.latitude, lng: selectedLocation.longitude });
      mapRef.current.setZoom(19);
    }
  };

  const fitPath = () => {
    if (movementPath.length > 0 && mapRef.current) {
      const bounds = new google.maps.LatLngBounds();
      movementPath.forEach(p => bounds.extend({ lat: p.lat, lng: p.lng }));
      mapRef.current.fitBounds(bounds);
    }
  };

  const handleSelectUser = (userId: string) => {
    const latest = locations
      .filter(l => l.user_id === userId)
      .sort((a, b) => new Date(b.recorded_at).getTime() - new Date(a.recorded_at).getTime())[0];
    if (latest) {
      setSelectedLocation(latest);
      fetchMovementHistory(latest.user_id);
      if (mapRef.current) {
        mapRef.current.panTo({ lat: latest.latitude, lng: latest.longitude });
        mapRef.current.setZoom(19);
      }
    }
  };

  // Heading arrow SVG icon for latest point
  const headingIconUrl = (deg: number) =>
    'data:image/svg+xml;charset=UTF-8,' +
    encodeURIComponent(`
      <svg width="32" height="32" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
        <g transform="rotate(${deg},16,16)">
          <circle cx="16" cy="16" r="14" fill="rgba(37,99,235,0.15)" stroke="#2563eb" stroke-width="2" />
          <polygon points="16,6 22,16 16,14 10,16" fill="#2563eb" />
        </g>
      </svg>
    `);

  const lastPoint = movementPath.length > 0 ? movementPath[movementPath.length - 1] : null;

  const exportDailyPdfReport = async () => {
    if (!selectedLocation) {
      toast.error('Select an employee first');
      return;
    }
    try {
      const { Document, Page, Text, View, StyleSheet, pdf } = await import('@react-pdf/renderer');
      const styles = StyleSheet.create({
        page: { padding: 24, fontSize: 11, fontFamily: 'Helvetica' },
        h1: { fontSize: 16, marginBottom: 12, fontWeight: 700 },
        section: { marginBottom: 12 },
        row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
        label: { color: '#6b7280' },
        value: { fontWeight: 700 },
        small: { color: '#6b7280', fontSize: 10 },
      });

      const todayStr = new Date().toLocaleDateString();
      const doc = (
        <Document>
          <Page size="A4" style={styles.page}>
            <Text style={styles.h1}>Employee Movement Report</Text>
            <View style={styles.section}>
              <View style={styles.row}><Text style={styles.label}>Employee</Text><Text style={styles.value}>{selectedLocation.full_name}</Text></View>
              <View style={styles.row}><Text style={styles.label}>Date</Text><Text style={styles.value}>{todayStr}</Text></View>
              <View style={styles.row}><Text style={styles.label}>Email</Text><Text style={styles.value}>{selectedLocation.email || '-'}</Text></View>
            </View>
            <View style={styles.section}>
              <Text style={{ marginBottom: 6, fontWeight: 700 }}>Today Summary</Text>
              <View style={styles.row}><Text style={styles.label}>Total Distance</Text><Text style={styles.value}>{dailyDistanceKm.toFixed(2)} km</Text></View>
              <View style={styles.row}><Text style={styles.label}>Moving Time</Text><Text style={styles.value}>{dailyMovingMin} min</Text></View>
              <View style={styles.row}><Text style={styles.label}>Idle Time (waste)</Text><Text style={styles.value}>{dailyIdleMin} min</Text></View>
              <View style={styles.row}><Text style={styles.label}>Average Speed</Text><Text style={styles.value}>{dailyAvgSpeedKmh.toFixed(1)} km/h</Text></View>
              <View style={styles.row}><Text style={styles.label}>Time per Km</Text><Text style={styles.value}>{dailyTimePerKmMin.toFixed(1)} min/km</Text></View>
              <View style={styles.row}><Text style={styles.label}>Stops (&gt; 5 min)</Text><Text style={styles.value}>{dailyStops}</Text></View>
              <Text style={styles.small}>Idle time approximates non-moving periods (segment movement &lt; 15m). Stop is an idle streak &gt;= 5 minutes.</Text>
            </View>
            <View style={styles.section}>
              <Text style={{ marginBottom: 6, fontWeight: 700 }}>Current Status</Text>
              <View style={styles.row}><Text style={styles.label}>Last Fix</Text><Text style={styles.value}>{lastPoint ? new Date(lastPoint.timestamp).toLocaleTimeString() : '-'}</Text></View>
              <View style={styles.row}><Text style={styles.label}>Speed</Text><Text style={styles.value}>{speedKmh.toFixed(1)} km/h</Text></View>
              <View style={styles.row}><Text style={styles.label}>Heading</Text><Text style={styles.value}>{headingDeg}°</Text></View>
              <View style={styles.row}><Text style={styles.label}>Accuracy</Text><Text style={styles.value}>{selectedLocation.location_accuracy ? Math.round(selectedLocation.location_accuracy) + ' m' : '-'}</Text></View>
            </View>
            <View style={styles.section}>
              <Text style={styles.small}>Generated by Task Management System</Text>
            </View>
          </Page>
        </Document>
      );

      const blob = await pdf(doc).toBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `movement_report_${selectedLocation.full_name.replace(/\s+/g, '_')}_${todayStr}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('PDF report exported');
    } catch (err) {
      console.error('PDF export failed:', err);
      toast.error('Failed to export PDF report');
    }
  };

  return (
    <div className="space-y-4 p-2 md:p-4">
      {/* Back Button and Controls */}
      <div className="flex flex-col space-y-3">
        <button
          onClick={() => navigate('/admin/dashboard')}
          className="flex items-center text-gray-600 hover:text-gray-800 transition-colors w-fit"
        >
          <ArrowLeftIcon className="h-5 w-5 mr-1" />
          <span className="text-sm font-medium">Back to Dashboard</span>
        </button>

        {/* Controls and Legend */}
        <div className="bg-white p-3 md:p-4 rounded-lg shadow">
          <div className="flex flex-col md:flex-row md:justify-between md:items-center space-y-3 md:space-y-0">
            <div className="flex flex-col md:flex-row md:items-center space-y-2 md:space-y-0 md:space-x-4">
              <h2 className="text-lg font-semibold flex items-center">
                <UserGroupIcon className="h-5 w-5 mr-2" />
                Employee Tracking
              </h2>
              <div className="flex items-center space-x-4 text-sm">
                <span className="inline-flex items-center">
                  <div className="w-3 h-3 rounded-full bg-green-500 mr-1"></div>
                  Active
                </span>
                <span className="inline-flex items-center">
                  <div className="w-3 h-3 rounded-full bg-red-500 mr-1"></div>
                  Inactive
                </span>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <label className="inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={showInactive}
                  onChange={(e) => setShowInactive(e.target.checked)}
                  className="form-checkbox h-4 w-4 text-indigo-600"
                />
                <span className="ml-2 text-sm text-gray-700">Show Inactive</span>
              </label>

              <label className="inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={followSelected}
                  onChange={(e) => setFollowSelected(e.target.checked)}
                  className="form-checkbox h-4 w-4 text-indigo-600"
                />
                <span className="ml-2 text-sm text-gray-700">Follow Selected</span>
              </label>

              <select
                value={selectedLocation?.user_id || ''}
                onChange={(e) => handleSelectUser(e.target.value)}
                className="rounded-md border-gray-300 text-sm shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                title="Select employee"
                aria-label="Select employee"
              >
                <option value="">Select employee…</option>
                {[...new Map(locations.map(l => [l.user_id, l])).values()]
                  .sort((a, b) => a.full_name.localeCompare(b.full_name))
                  .map(l => (
                    <option key={l.user_id} value={l.user_id}>
                      {l.full_name}
                    </option>
                  ))}
              </select>

              <select
                value={lookbackHours}
                onChange={(e) => setLookbackHours(Number(e.target.value))}
                className="rounded-md border-gray-300 text-sm shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                title="Path lookback window"
                aria-label="Path lookback window"
              >
                {[1, 2, 6, 12, 24].map(h => (
                  <option key={h} value={h}>{h}h</option>
                ))}
              </select>

              <button
                onClick={zoomToSelected}
                className="px-3 py-1.5 text-sm rounded-md bg-indigo-600 text-white hover:bg-indigo-700"
                disabled={!selectedLocation}
                aria-label="Zoom to employee"
                title="Zoom to employee"
              >
                Zoom to Employee
              </button>

              <button
                onClick={fitPath}
                className="px-3 py-1.5 text-sm rounded-md bg-blue-600 text-white hover:bg-blue-700"
                disabled={movementPath.length === 0}
                aria-label="Fit path to view"
                title="Fit path to view"
              >
                Fit Path
              </button>

              <button
                onClick={exportDailyPdfReport}
                className="px-3 py-1.5 text-sm rounded-md bg-gray-700 text-white hover:bg-gray-800"
                disabled={!selectedLocation}
                aria-label="Export daily PDF report"
                title="Export daily PDF report"
              >
                Export PDF
              </button>
            </div>
          </div>

          {selectedLocation && (
            <div className="mt-3 grid grid-cols-1 md:grid-cols-5 gap-3 text-sm">
              <div className="bg-gray-50 rounded-md p-2">
                <div className="text-gray-500">Selected</div>
                <div className="font-medium text-gray-900 truncate">{selectedLocation.full_name}</div>
              </div>
              <div className="bg-gray-50 rounded-md p-2">
                <div className="text-gray-500">Distance (today)</div>
                <div className="font-medium text-gray-900">{dailyDistanceKm.toFixed(2)} km</div>
              </div>
              <div className="bg-gray-50 rounded-md p-2">
                <div className="text-gray-500">Moving</div>
                <div className="font-medium text-gray-900">{dailyMovingMin} min</div>
              </div>
              <div className="bg-gray-50 rounded-md p-2">
                <div className="text-gray-500">Idle (waste)</div>
                <div className="font-medium text-gray-900">{dailyIdleMin} min</div>
              </div>
              <div className="bg-gray-50 rounded-md p-2">
                <div className="text-gray-500">Avg speed</div>
                <div className="font-medium text-gray-900">{dailyAvgSpeedKmh.toFixed(1)} km/h</div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Map */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <GoogleMap
          mapContainerStyle={mapContainerStyle}
          zoom={18}
          center={defaultCenter}
          options={mapOptions}
          onLoad={onMapLoad}
        >
          {filteredLocations.map((location) => (
            <Marker
              key={location.id}
              position={{ lat: location.latitude, lng: location.longitude }}
              icon={{
                url: location.connection_status === 'online'
                  ? 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
                      <svg width=\"36\" height=\"36\" viewBox=\"0 0 36 36\" xmlns=\"http://www.w3.org/2000/svg\">\n                        <circle cx=\"18\" cy=\"18\" r=\"16\" fill=\"#22c55e\" stroke=\"white\" stroke-width=\"2\"/>\n                        <circle cx=\"18\" cy=\"18\" r=\"8\" fill=\"white\"/>\n                      </svg>\n                    `)
                  : 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
                      <svg width=\"36\" height=\"36\" viewBox=\"0 0 36 36\" xmlns=\"http://www.w3.org/2000/svg\">\n                        <circle cx=\"18\" cy=\"18\" r=\"16\" fill=\"#ef4444\" stroke=\"white\" stroke-width=\"2\"/>\n                        <circle cx=\"18\" cy=\"18\" r=\"8\" fill=\"white\"/>\n                      </svg>\n                    `),
                scaledSize: new google.maps.Size(36, 36),
                anchor: new google.maps.Point(18, 18),
              }}
              onClick={() => setSelectedLocation(location)}
            />
          ))}

          {/* Selected employee path */}
          {movementPath.length > 1 && (
            <Polyline
              path={movementPath.map(p => ({ lat: p.lat, lng: p.lng }))}
              options={{ strokeColor: '#2563eb', strokeOpacity: 0.9, strokeWeight: 4 }}
            />
          )}

          {/* Heading arrow at last point */}
          {lastPoint && (
            <Marker
              position={{ lat: lastPoint.lat, lng: lastPoint.lng }}
              icon={{
                url: headingIconUrl(headingDeg),
                scaledSize: new google.maps.Size(32, 32),
                anchor: new google.maps.Point(16, 16),
              }}
            />
          )}

          {/* Accuracy circle for selected location */}
          {selectedLocation?.location_accuracy && (
            <Circle
              center={{ lat: selectedLocation.latitude, lng: selectedLocation.longitude }}
              radius={selectedLocation.location_accuracy}
              options={{
                strokeColor: '#3b82f6',
                strokeOpacity: 0.5,
                strokeWeight: 1,
                fillColor: '#3b82f6',
                fillOpacity: 0.15,
              }}
            />
          )}

          {/* Turn markers */}
          {turnPoints.map((turn, idx) => (
            <Marker
              key={`turn-${idx}`}
              position={{ lat: turn.lat, lng: turn.lng }}
              icon={{
                url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
                  <svg width=\"20\" height=\"20\" viewBox=\"0 0 20 20\" xmlns=\"http://www.w3.org/2000/svg\">\n                    <circle cx=\"10\" cy=\"10\" r=\"9\" fill=\"#f59e0b\" stroke=\"white\" stroke-width=\"2\"/>\n                    <text x=\"10\" y=\"14\" text-anchor=\"middle\" font-size=\"10\" fill=\"white\" font-family=\"Arial\" font-weight=\"bold\">↪</text>\n                  </svg>\n                `),
                scaledSize: new google.maps.Size(20, 20),
                anchor: new google.maps.Point(10, 10),
              }}
            />
          ))}

          {/* InfoWindow */}
          {selectedLocation && (
            <InfoWindow
              position={{ lat: selectedLocation.latitude, lng: selectedLocation.longitude }}
              onCloseClick={() => setSelectedLocation(null)}
            >
              <div className="p-2 max-w-[280px] md:max-w-xs">
                <div className="flex items-center mb-2">
                  <img
                    src={selectedLocation?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(selectedLocation?.full_name || 'User')}`}
                    alt={selectedLocation?.full_name || 'User'}
                    className="w-8 h-8 md:w-10 md:h-10 rounded-full mr-2"
                  />
                  <div>
                    <h3 className="font-semibold text-sm md:text-base">{selectedLocation?.full_name || 'User'}</h3>
                    <p className="text-xs md:text-sm text-gray-600">{selectedLocation?.email || 'No email'}</p>
                  </div>
                </div>
                <div className="text-xs md:text-sm space-y-1">
                  <p className="font-medium">Location:</p>
                  <p className="text-gray-600 break-words">{selectedLocation.address}</p>
                  <div className="flex justify-between items-center mt-2">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                      selectedLocation.connection_status === 'online' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                    }`}>
                      {selectedLocation.connection_status === 'online' ? 'Active' : 'Inactive'}
                    </span>
                    <span className="text-gray-500 text-xs">
                      {new Date(selectedLocation.recorded_at).toLocaleTimeString()}
                    </span>
                  </div>
                  {selectedLocation.task_title && (
                    <div className="mt-2 p-2 bg-gray-50 rounded">
                      <p className="font-medium">Current Task:</p>
                      <p className="text-gray-800">{selectedLocation.task_title}</p>
                      <p className="text-xs text-gray-600">Due: {new Date(selectedLocation.task_due_date || '').toLocaleDateString()}</p>
                    </div>
                  )}
                  {selectedLocation.battery_level !== undefined && (
                    <p className="text-xs md:text-sm">Battery: <span className="font-medium">{selectedLocation.battery_level}%</span></p>
                  )}
                  {selectedLocation.location_accuracy && (
                    <p className="text-xs md:text-sm">Accuracy: <span className="font-medium">{Math.round(selectedLocation.location_accuracy)}m</span></p>
                  )}
                </div>
              </div>
            </InfoWindow>
          )}
        </GoogleMap>
      </div>

      {/* Status Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 md:gap-4">
        <div className="bg-white rounded-lg shadow p-3 md:p-4">
          <div className="flex items-center">
            <UserGroupIcon className="h-5 w-5 md:h-6 md:w-6 text-indigo-600" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500">Total Employees</p>
              <p className="text-lg md:text-xl font-semibold text-gray-900">{locations.length}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-3 md:p-4">
          <div className="flex items-center">
            <div className="rounded-full bg-green-100 p-2">
              <LocationMarkerIcon className="h-5 w-5 md:h-6 md:w-6 text-green-600" />
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500">Active</p>
              <p className="text-lg md:text-xl font-semibold text-gray-900">{locations.filter(l => l.connection_status === 'online').length}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-3 md:p-4">
          <div className="flex items-center">
            <div className="rounded-full bg-red-100 p-2">
              <AdjustmentsIcon className="h-5 w-5 md:h-6 md:w-6 text-red-600" />
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500">Inactive</p>
              <p className="text-lg md:text-xl font-semibold text-gray-900">{locations.filter(l => l.connection_status !== 'online').length}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 