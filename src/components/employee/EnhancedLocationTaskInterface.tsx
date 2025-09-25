import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { EnhancedGeolocationService } from '../../services/EnhancedGeolocationService';
import EnhancedOSMMap from '../EnhancedOSMMap';
import Layout from '../Layout';
import {
  MapIcon,
  LocationMarkerIcon,
  ClockIcon,
  CheckCircleIcon,
  ExclamationIcon,
  PlayIcon,
  PauseIcon,
  RefreshIcon,
  UserIcon,
  CalendarIcon,
  CurrencyDollarIcon
} from '@heroicons/react/outline';
import toast from 'react-hot-toast';

interface Task {
  id: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  assigned_to: string;
  price: number;
  due_date: string;
  location_required: boolean;
  location_latitude: number;
  location_longitude: number;
  location_radius_meters: number;
  created_at: string;
}

interface LocationData {
  latitude: number;
  longitude: number;
  accuracy?: number;
  address?: string;
  battery_level?: number;
  connection_status?: 'online' | 'offline';
  movement_type?: 'walking' | 'driving' | 'stationary' | 'unknown';
  timestamp: string;
}

export default function EnhancedLocationTaskInterface() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [currentLocation, setCurrentLocation] = useState<LocationData | null>(null);
  const [isTracking, setIsTracking] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [locationHistory, setLocationHistory] = useState<LocationData[]>([]);
  const [movementStats, setMovementStats] = useState({
    totalDistance: 0,
    averageSpeed: 0,
    totalTime: 0,
    activeTime: 0,
    idleTime: 0
  });

  const geolocationService = EnhancedGeolocationService.getInstance();

  // Fetch location-based tasks
  const fetchLocationTasks = useCallback(async () => {
    if (!user) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('assigned_to', user.id)
        .eq('location_required', true)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTasks(data || []);
    } catch (error) {
      console.error('Error fetching location tasks:', error);
      toast.error('Failed to fetch location tasks');
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Get current location
  const getCurrentLocation = useCallback(async () => {
    try {
      const location = await geolocationService.getCurrentPosition();
      setCurrentLocation(location);
      
      // Update movement stats
      const stats = geolocationService.getMovementStats();
      setMovementStats(stats);
      
      return location;
    } catch (error) {
      console.error('Error getting current location:', error);
      toast.error('Failed to get current location');
      return null;
    }
  }, [geolocationService]);

  // Start/stop location tracking
  const toggleTracking = useCallback(async () => {
    if (isTracking) {
      geolocationService.stopTracking();
      setIsTracking(false);
      toast.success('Location tracking stopped');
    } else {
      try {
        await geolocationService.startTracking(
          (location) => {
            setCurrentLocation(location);
            setLocationHistory(prev => [...prev.slice(-49), location]); // Keep last 50 locations
            
            // Update movement stats
            const stats = geolocationService.getMovementStats();
            setMovementStats(stats);
          },
          (error) => {
            console.error('Location tracking error:', error);
            toast.error('Location tracking error: ' + error.message);
          },
          {
            interval: 5000,
            enableHighAccuracy: true,
            geofenceCheck: true,
            batteryOptimization: true
          }
        );
        
        setIsTracking(true);
        toast.success('Location tracking started');
      } catch (error) {
        console.error('Error starting tracking:', error);
        toast.error('Failed to start location tracking');
      }
    }
  }, [isTracking, geolocationService]);

  // Check if user is within task location
  const checkTaskLocation = useCallback((task: Task, location: LocationData): boolean => {
    if (!task.location_required || !task.location_latitude || !task.location_longitude) {
      return false;
    }

    const distance = geolocationService.calculateDistance(
      location.latitude,
      location.longitude,
      task.location_latitude,
      task.location_longitude
    );

    return distance <= (task.location_radius_meters || 100);
  }, [geolocationService]);

  // Update task status
  const updateTaskStatus = useCallback(async (taskId: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from('tasks')
        .update({ 
          status: newStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', taskId);

      if (error) throw error;
      
      // Update local state
      setTasks(prev => prev.map(task => 
        task.id === taskId ? { ...task, status: newStatus } : task
      ));
      
      toast.success(`Task ${newStatus.toLowerCase()}`);
    } catch (error) {
      console.error('Error updating task status:', error);
      toast.error('Failed to update task status');
    }
  }, []);

  // Auto-check-in when within task location
  useEffect(() => {
    if (currentLocation && tasks.length > 0) {
      tasks.forEach(task => {
        if (task.status === 'Planned' && checkTaskLocation(task, currentLocation)) {
          updateTaskStatus(task.id, 'In Progress');
          toast.success(`Auto-checked into task: ${task.title}`);
        }
      });
    }
  }, [currentLocation, tasks, checkTaskLocation, updateTaskStatus]);

  // Initial load
  useEffect(() => {
    fetchLocationTasks();
    getCurrentLocation();
  }, [fetchLocationTasks, getCurrentLocation]);

  // Get distance to task
  const getDistanceToTask = useCallback((task: Task): number => {
    if (!currentLocation || !task.location_latitude || !task.location_longitude) {
      return 0;
    }

    return geolocationService.calculateDistance(
      currentLocation.latitude,
      currentLocation.longitude,
      task.location_latitude,
      task.location_longitude
    );
  }, [currentLocation, geolocationService]);

  // Format distance
  const formatDistance = (meters: number): string => {
    if (meters < 1000) {
      return `${Math.round(meters)}m`;
    }
    return `${(meters / 1000).toFixed(1)}km`;
  };

  // Format time
  const formatTime = (minutes: number): string => {
    if (minutes < 60) {
      return `${Math.round(minutes)}m`;
    }
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    return `${hours}h ${mins}m`;
  };

  return (
    <Layout>
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50">
        {/* Header */}
        <div className="bg-white shadow-lg border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 py-6">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <div>
                <h1 className="text-2xl font-bold text-gray-900 flex items-center">
                  <MapIcon className="h-8 w-8 mr-3 text-indigo-600" />
                  Location-Based Tasks
                </h1>
                <p className="text-gray-600 mt-1">
                  Enhanced geolocation interface with OpenStreetMap
                </p>
              </div>

              {/* Location Status */}
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
                  <span>{isTracking ? 'Stop Tracking' : 'Start Tracking'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column - Tasks */}
            <div className="lg:col-span-1 space-y-6">
              {/* Current Location Info */}
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

              {/* Movement Statistics */}
              <div className="bg-white rounded-xl shadow-lg p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                  <ClockIcon className="h-5 w-5 mr-2 text-indigo-600" />
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

              {/* Location Tasks */}
              <div className="bg-white rounded-xl shadow-lg p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                  <UserIcon className="h-5 w-5 mr-2 text-indigo-600" />
                  Location Tasks ({tasks.length})
                </h3>
                
                {loading ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
                    <p className="text-gray-600 mt-2">Loading tasks...</p>
                  </div>
                ) : tasks.length === 0 ? (
                  <div className="text-center py-8">
                    <MapIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600">No location-based tasks assigned</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {tasks.map((task) => {
                      const distance = getDistanceToTask(task);
                      const isWithinRange = checkTaskLocation(task, currentLocation!);
                      
                      return (
                        <div
                          key={task.id}
                          className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                            selectedTask?.id === task.id
                              ? 'border-indigo-500 bg-indigo-50'
                              : isWithinRange
                              ? 'border-green-500 bg-green-50'
                              : 'border-gray-200 bg-white hover:border-gray-300'
                          }`}
                          onClick={() => setSelectedTask(task)}
                        >
                          <div className="flex items-start justify-between mb-2">
                            <h4 className="font-semibold text-gray-900">{task.title}</h4>
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                              task.priority === 'High' ? 'bg-red-100 text-red-800' :
                              task.priority === 'Medium' ? 'bg-yellow-100 text-yellow-800' :
                              'bg-green-100 text-green-800'
                            }`}>
                              {task.priority}
                            </span>
                          </div>
                          
                          <p className="text-sm text-gray-600 mb-3">{task.description}</p>
                          
                          <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                              <span className="text-gray-600">Distance:</span>
                              <span className={`font-medium ${
                                isWithinRange ? 'text-green-600' : 'text-gray-900'
                              }`}>
                                {formatDistance(distance)}
                                {isWithinRange && ' ✓'}
                              </span>
                            </div>
                            
                            <div className="flex justify-between">
                              <span className="text-gray-600">Status:</span>
                              <span className={`font-medium ${
                                task.status === 'Completed' ? 'text-green-600' :
                                task.status === 'In Progress' ? 'text-blue-600' :
                                'text-yellow-600'
                              }`}>
                                {task.status}
                              </span>
                            </div>
                            
                            <div className="flex justify-between">
                              <span className="text-gray-600">Due:</span>
                              <span className="font-medium">
                                {new Date(task.due_date).toLocaleDateString()}
                              </span>
                            </div>
                            
                            <div className="flex justify-between">
                              <span className="text-gray-600">Price:</span>
                              <span className="font-medium text-green-600">${task.price}</span>
                            </div>
                          </div>
                          
                          {/* Action Buttons */}
                          <div className="mt-4 flex space-x-2">
                            {task.status === 'Planned' && isWithinRange && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  updateTaskStatus(task.id, 'In Progress');
                                }}
                                className="flex-1 bg-blue-600 text-white py-2 px-3 rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                              >
                                Start Task
                              </button>
                            )}
                            
                            {task.status === 'In Progress' && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  updateTaskStatus(task.id, 'Completed');
                                }}
                                className="flex-1 bg-green-600 text-white py-2 px-3 rounded-lg hover:bg-green-700 transition-colors text-sm font-medium"
                              >
                                Complete Task
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Right Column - Enhanced Map */}
            <div className="lg:col-span-2">
              <div className="bg-white rounded-xl shadow-lg overflow-hidden">
                <div className="p-4 border-b border-gray-200">
                  <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                    <MapIcon className="h-5 w-5 mr-2 text-indigo-600" />
                    Interactive Map
                  </h3>
                  <p className="text-sm text-gray-600 mt-1">
                    Real-time location tracking with OpenStreetMap
                  </p>
                </div>
                
                <div className="h-[600px]">
                  <EnhancedOSMMap
                    center={currentLocation ? [currentLocation.latitude, currentLocation.longitude] : [7.8731, 80.7718]}
                    zoom={currentLocation ? 16 : 8}
                    employees={currentLocation ? [{
                      id: user?.id,
                      latitude: currentLocation.latitude,
                      longitude: currentLocation.longitude,
                      full_name: user?.full_name || 'You',
                      email: user?.email,
                      connection_status: currentLocation.connection_status,
                      battery_level: currentLocation.battery_level,
                      movement_type: currentLocation.movement_type,
                      recorded_at: currentLocation.timestamp,
                      address: currentLocation.address
                    }] : []}
                    tasks={tasks.filter(task => task.location_latitude && task.location_longitude).map(task => ({
                      id: task.id,
                      title: task.title,
                      description: task.description,
                      status: task.status,
                      priority: task.priority,
                      price: task.price,
                      due_date: task.due_date,
                      location_latitude: task.location_latitude,
                      location_longitude: task.location_longitude
                    }))}
                    locations={locationHistory.map(loc => ({
                      id: loc.timestamp,
                      lat: loc.latitude,
                      lng: loc.longitude,
                      timestamp: loc.timestamp
                    }))}
                    onEmployeeSelect={(employee) => {
                      console.log('Selected employee:', employee);
                    }}
                    onTaskSelect={(task) => {
                      setSelectedTask(task);
                    }}
                    onLocationSelect={(location) => {
                      console.log('Selected location:', location);
                    }}
                    height="100%"
                    showControls={true}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
