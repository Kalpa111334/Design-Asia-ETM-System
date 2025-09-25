import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet';
import L from 'leaflet';
import { LocationTaskService, LocationBasedTask } from '../../services/LocationTaskService';
import { RealTimeLocationService } from '../../services/RealTimeLocationService';
import { useAuth } from '../../contexts/AuthContext';
import { formatCurrency } from '../../utils/currency';
import {
  MapIcon,
  LocationMarkerIcon,
  ClockIcon,
  TrendingUpIcon,
  TruckIcon,
  PlayIcon,
  RefreshIcon,
} from '@heroicons/react/outline';
import toast from 'react-hot-toast';

// Fix for default markers
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

interface RouteStop {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  task: LocationBasedTask;
  estimatedTime: number; // minutes
  priority: number; // 1-10 scale
}

interface OptimizedRoute {
  stops: RouteStop[];
  totalDistance: number;
  estimatedDuration: number; // minutes
  totalReward: number;
  efficiency: number; // reward per hour
}

interface RouteOptimizerProps {
  employeeId?: string;
  onClose: () => void;
}

export default function RouteOptimizer({ employeeId, onClose }: RouteOptimizerProps) {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<LocationBasedTask[]>([]);
  const [selectedTasks, setSelectedTasks] = useState<string[]>([]);
  const [optimizedRoute, setOptimizedRoute] = useState<OptimizedRoute | null>(null);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [optimizing, setOptimizing] = useState(false);
  const [mapCenter, setMapCenter] = useState<[number, number]>([7.8731, 80.7718]);

  useEffect(() => {
    fetchTasks();
    getCurrentLocation();
  }, [employeeId]);

  const fetchTasks = async () => {
    try {
      setLoading(true);
      const targetEmployeeId = employeeId || user?.id;
      if (!targetEmployeeId) return;

      const locationTasks = await LocationTaskService.getLocationBasedTasks({
        assigned_to: targetEmployeeId,
        status: 'Not Started',
      });

      // Filter tasks that have location data
      const validTasks = locationTasks.filter(task => 
        task.task_locations?.[0]?.required_latitude && 
        task.task_locations?.[0]?.required_longitude
      );

      setTasks(validTasks);
      
      // Set map center to first task location
      if (validTasks.length > 0 && validTasks[0].task_locations?.[0]) {
        const firstTask = validTasks[0].task_locations[0];
        setMapCenter([firstTask.required_latitude!, firstTask.required_longitude!]);
      }

    } catch (error) {
      console.error('Error fetching tasks:', error);
      toast.error('Failed to load tasks');
    } finally {
      setLoading(false);
    }
  };

  const getCurrentLocation = async () => {
    try {
      const location = await RealTimeLocationService.getCurrentLocation();
      setUserLocation(location);
      setMapCenter([location.lat, location.lng]);
    } catch (error) {
      console.log('Could not get current location:', error);
    }
  };

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    return RealTimeLocationService.calculateDistance(lat1, lon1, lat2, lon2);
  };

  const estimateTaskTime = (task: LocationBasedTask): number => {
    // Base time estimation based on task complexity and priority
    const baseTime = 30; // 30 minutes base
    const priorityMultiplier = task.priority === 'High' ? 1.5 : task.priority === 'Medium' ? 1.2 : 1.0;
    const descriptionLength = task.description?.length || 0;
    const complexityTime = Math.min(descriptionLength / 10, 30); // Max 30 minutes for complexity
    
    return Math.round(baseTime * priorityMultiplier + complexityTime);
  };

  const calculatePriority = (task: LocationBasedTask): number => {
    const priorityMap = { 'High': 8, 'Medium': 5, 'Low': 2 };
    const basePriority = priorityMap[task.priority as keyof typeof priorityMap] || 5;
    
    // Increase priority based on due date proximity
    const dueDate = new Date(task.due_date);
    const now = new Date();
    const hoursUntilDue = (dueDate.getTime() - now.getTime()) / (1000 * 60 * 60);
    
    const urgencyBonus = hoursUntilDue < 24 ? 3 : hoursUntilDue < 48 ? 2 : hoursUntilDue < 72 ? 1 : 0;
    
    // Increase priority based on reward
    const rewardBonus = (task.price || 0) > 5000 ? 2 : (task.price || 0) > 2000 ? 1 : 0;
    
    return Math.min(basePriority + urgencyBonus + rewardBonus, 10);
  };

  const optimizeRoute = async () => {
    if (selectedTasks.length === 0) {
      toast.error('Please select at least one task');
      return;
    }

    if (!userLocation) {
      toast.error('Current location not available');
      return;
    }

    setOptimizing(true);
    
    try {
      // Convert selected tasks to route stops
      const stops: RouteStop[] = selectedTasks.map(taskId => {
        const task = tasks.find(t => t.id === taskId)!;
        const location = task.task_locations![0];
        
        return {
          id: task.id,
          name: task.title,
          latitude: location.required_latitude!,
          longitude: location.required_longitude!,
          task,
          estimatedTime: estimateTaskTime(task),
          priority: calculatePriority(task),
        };
      });

      // Simple greedy algorithm for route optimization
      // Start from current location and always go to the nearest unvisited stop
      // considering both distance and priority
      const optimizedStops: RouteStop[] = [];
      const unvisited = [...stops];
      let currentLat = userLocation.lat;
      let currentLng = userLocation.lng;
      let totalDistance = 0;
      let totalTime = 0;
      let totalReward = 0;

      while (unvisited.length > 0) {
        let bestStop: RouteStop | null = null;
        let bestScore = -1;
        let bestDistance = 0;

        for (const stop of unvisited) {
          const distance = calculateDistance(currentLat, currentLng, stop.latitude, stop.longitude);
          
          // Calculate score based on distance (lower is better), priority (higher is better), and reward
          const distanceScore = Math.max(0, 10 - (distance / 1000)); // Normalize distance to 0-10 scale
          const priorityScore = stop.priority;
          const rewardScore = Math.min((stop.task.price || 0) / 1000, 10); // Normalize reward to 0-10 scale
          
          // Weighted score: priority and reward are more important than distance
          const score = (distanceScore * 0.3) + (priorityScore * 0.4) + (rewardScore * 0.3);
          
          if (score > bestScore) {
            bestScore = score;
            bestStop = stop;
            bestDistance = distance;
          }
        }

        if (bestStop) {
          optimizedStops.push(bestStop);
          unvisited.splice(unvisited.indexOf(bestStop), 1);
          
          totalDistance += bestDistance;
          totalTime += bestStop.estimatedTime;
          totalReward += bestStop.task.price || 0;
          
          currentLat = bestStop.latitude;
          currentLng = bestStop.longitude;
        }
      }

      // Add travel time between stops (assume 30 km/h average speed in city)
      const travelTime = Math.round(totalDistance / 1000 * 2); // 2 minutes per km
      const estimatedDuration = totalTime + travelTime;
      const efficiency = estimatedDuration > 0 ? (totalReward / (estimatedDuration / 60)) : 0;

      const route: OptimizedRoute = {
        stops: optimizedStops,
        totalDistance,
        estimatedDuration,
        totalReward,
        efficiency,
      };

      setOptimizedRoute(route);
      toast.success('Route optimized successfully!');

    } catch (error) {
      console.error('Error optimizing route:', error);
      toast.error('Failed to optimize route');
    } finally {
      setOptimizing(false);
    }
  };

  const toggleTaskSelection = (taskId: string) => {
    setSelectedTasks(prev => 
      prev.includes(taskId) 
        ? prev.filter(id => id !== taskId)
        : [...prev, taskId]
    );
  };

  const selectAllTasks = () => {
    setSelectedTasks(tasks.map(t => t.id));
  };

  const clearSelection = () => {
    setSelectedTasks([]);
    setOptimizedRoute(null);
  };

  const createTaskMarker = (task: LocationBasedTask, index?: number) => {
    const isSelected = selectedTasks.includes(task.id);
    const statusColor = isSelected ? '#3b82f6' : '#6b7280';
    
    return L.divIcon({
      className: 'custom-route-marker',
      html: `
        <div style="
          width: 36px;
          height: 36px;
          background: ${statusColor};
          border: 3px solid white;
          border-radius: 50%;
          box-shadow: 0 2px 8px rgba(0,0,0,0.3);
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
        ">
          <span style="
            color: white;
            font-weight: bold;
            font-size: 14px;
          ">${index !== undefined ? index + 1 : '📋'}</span>
          ${isSelected ? `
            <div style="
              position: absolute;
              top: -2px;
              right: -2px;
              width: 12px;
              height: 12px;
              background: #10b981;
              border-radius: 50%;
              border: 2px solid white;
            "></div>
          ` : ''}
        </div>
      `,
      iconSize: [36, 36],
      iconAnchor: [18, 18],
    });
  };

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center">
        <div className="bg-white rounded-lg p-8 max-w-md w-full mx-4">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mr-4"></div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Loading Route Optimizer</h3>
              <p className="text-gray-600">Fetching location-based tasks...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      <div className="flex min-h-screen">
        <div className="fixed inset-0 bg-black bg-opacity-50" onClick={onClose} />
        
        <div className="relative bg-white w-full max-w-7xl mx-auto shadow-xl flex flex-col">
          {/* Header */}
          <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-purple-600 to-indigo-600">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <TruckIcon className="h-6 w-6 text-white mr-3" />
                <div>
                  <h2 className="text-xl font-bold text-white">Route Optimizer</h2>
                  <p className="text-purple-100 text-sm">
                    Optimize your route for maximum efficiency
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="text-white hover:text-gray-200 transition-colors"
              >
                ✕
              </button>
            </div>
          </div>

          {tasks.length === 0 ? (
            <div className="flex-1 flex items-center justify-center p-8">
              <div className="text-center max-w-md">
                <MapIcon className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-gray-900 mb-2">No Tasks Available</h3>
                <p className="text-gray-600">
                  No location-based tasks available for route optimization.
                </p>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col lg:flex-row">
              {/* Task Selection Panel */}
              <div className="w-full lg:w-1/3 border-r border-gray-200 flex flex-col max-h-96 lg:max-h-none">
                <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-900">Available Tasks</h3>
                    <div className="flex gap-2">
                      <button
                        onClick={selectAllTasks}
                        className="text-xs bg-indigo-600 text-white px-2 py-1 rounded hover:bg-indigo-700"
                      >
                        Select All
                      </button>
                      <button
                        onClick={clearSelection}
                        className="text-xs bg-gray-600 text-white px-2 py-1 rounded hover:bg-gray-700"
                      >
                        Clear
                      </button>
                    </div>
                  </div>
                  
                  <button
                    onClick={optimizeRoute}
                    disabled={selectedTasks.length === 0 || optimizing}
                    className="w-full bg-purple-600 text-white py-2 px-4 rounded-md hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                  >
                    {optimizing ? (
                      <RefreshIcon className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <TrendingUpIcon className="h-4 w-4 mr-2" />
                    )}
                    {optimizing ? 'Optimizing...' : 'Optimize Route'}
                  </button>
                </div>
                
                <div className="flex-1 overflow-y-auto">
                  {tasks.map((task) => (
                    <div
                      key={task.id}
                      onClick={() => toggleTaskSelection(task.id)}
                      className={`px-6 py-4 border-b border-gray-100 cursor-pointer hover:bg-gray-50 transition-colors ${
                        selectedTasks.includes(task.id) ? 'bg-indigo-50 border-indigo-200' : ''
                      }`}
                    >
                      <div className="flex items-start">
                        <input
                          type="checkbox"
                          checked={selectedTasks.includes(task.id)}
                          onChange={() => toggleTaskSelection(task.id)}
                          className="mt-1 mr-3"
                        />
                        <div className="flex-1 min-w-0">
                          <h4 className="text-sm font-semibold text-gray-900 truncate">
                            {task.title}
                          </h4>
                          <p className="text-xs text-gray-600 mt-1 line-clamp-2">
                            {task.description}
                          </p>
                          
                          <div className="mt-2 flex items-center justify-between">
                            <div className="flex items-center space-x-2">
                              <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                                task.priority === 'High' ? 'bg-red-100 text-red-800' :
                                task.priority === 'Medium' ? 'bg-yellow-100 text-yellow-800' :
                                'bg-green-100 text-green-800'
                              }`}>
                                {task.priority}
                              </span>
                              
                              <span className="text-xs text-gray-500 flex items-center">
                                <ClockIcon className="h-3 w-3 mr-1" />
                                {estimateTaskTime(task)}m
                              </span>
                            </div>
                            
                            <div className="text-right">
                              <div className="text-sm font-semibold text-green-600">
                                {formatCurrency(task.price || 0)}
                              </div>
                            </div>
                          </div>
                          
                          <div className="mt-1 text-xs text-gray-500">
                            <div className="flex items-center">
                              <LocationMarkerIcon className="h-3 w-3 mr-1" />
                              {task.task_locations?.[0]?.location_name || 'Custom Location'}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Map */}
              <div className="flex-1 relative">
                <MapContainer
                  center={mapCenter}
                  zoom={12}
                  style={{ height: '100%', width: '100%' }}
                  scrollWheelZoom={true}
                  touchZoom={true}
                  doubleClickZoom={true}
                  dragging={true}
                >
                  <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />
                  
                  {/* User Location */}
                  {userLocation && (
                    <Marker
                      position={[userLocation.lat, userLocation.lng]}
                      icon={L.divIcon({
                        className: 'user-location-marker',
                        html: `
                          <div style="
                            width: 24px;
                            height: 24px;
                            background: #10b981;
                            border: 3px solid white;
                            border-radius: 50%;
                            box-shadow: 0 2px 8px rgba(0,0,0,0.3);
                          "></div>
                        `,
                        iconSize: [24, 24],
                        iconAnchor: [12, 12],
                      })}
                    >
                      <Popup>Your Current Location</Popup>
                    </Marker>
                  )}

                  {/* Task Markers */}
                  {tasks.map((task) => {
                    const taskLocation = task.task_locations?.[0];
                    if (!taskLocation?.required_latitude || !taskLocation?.required_longitude) return null;

                    const routeIndex = optimizedRoute ? optimizedRoute.stops.findIndex(stop => stop.id === task.id) : -1;
                    
                    return (
                      <Marker
                        key={task.id}
                        position={[taskLocation.required_latitude, taskLocation.required_longitude]}
                        icon={createTaskMarker(task, routeIndex !== -1 ? routeIndex : undefined)}
                        eventHandlers={{
                          click: () => toggleTaskSelection(task.id),
                        }}
                      >
                        <Popup>
                          <div className="p-2 max-w-sm">
                            <h4 className="font-semibold text-gray-900 mb-2">{task.title}</h4>
                            <div className="space-y-1 text-sm">
                              <div className="flex justify-between">
                                <span className="text-gray-600">Priority:</span>
                                <span className="font-medium">{task.priority}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-600">Reward:</span>
                                <span className="font-medium text-green-600">{formatCurrency(task.price || 0)}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-600">Est. Time:</span>
                                <span className="font-medium">{estimateTaskTime(task)}m</span>
                              </div>
                              {routeIndex !== -1 && (
                                <div className="flex justify-between">
                                  <span className="text-gray-600">Route Order:</span>
                                  <span className="font-medium text-indigo-600">#{routeIndex + 1}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </Popup>
                      </Marker>
                    );
                  })}

                  {/* Optimized Route Line */}
                  {optimizedRoute && userLocation && (
                    <Polyline
                      positions={[
                        [userLocation.lat, userLocation.lng],
                        ...optimizedRoute.stops.map(stop => [stop.latitude, stop.longitude] as [number, number])
                      ]}
                      pathOptions={{
                        color: '#8b5cf6',
                        weight: 4,
                        opacity: 0.8,
                        dashArray: '10, 10',
                      }}
                    />
                  )}
                </MapContainer>
              </div>
            </div>
          )}

          {/* Route Summary */}
          {optimizedRoute && (
            <div className="border-t border-gray-200 bg-gray-50 px-6 py-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="text-center">
                  <p className="text-2xl font-bold text-indigo-600">{optimizedRoute.stops.length}</p>
                  <p className="text-sm text-gray-600">Tasks</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-green-600">
                    {RealTimeLocationService.formatDistance(optimizedRoute.totalDistance)}
                  </p>
                  <p className="text-sm text-gray-600">Total Distance</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-blue-600">
                    {Math.round(optimizedRoute.estimatedDuration / 60 * 10) / 10}h
                  </p>
                  <p className="text-sm text-gray-600">Est. Duration</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-purple-600">
                    {formatCurrency(optimizedRoute.efficiency)}/h
                  </p>
                  <p className="text-sm text-gray-600">Efficiency</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}