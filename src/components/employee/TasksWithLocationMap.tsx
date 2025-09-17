import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle } from 'react-leaflet';
import L from 'leaflet';
import { LocationTaskService, LocationBasedTask } from '../../services/LocationTaskService';
import { GeofencingService, Geofence } from '../../services/GeofencingService';
import { useAuth } from '../../contexts/AuthContext';
import { formatCurrency } from '../../utils/currency';
import {
  MapIcon,
  LocationMarkerIcon,
  CheckCircleIcon,
  ClockIcon,
  ExclamationIcon,
  EyeIcon,
  XIcon,
} from '@heroicons/react/outline';
import toast from 'react-hot-toast';

// Fix for default markers
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

interface TasksWithLocationMapProps {
  onClose: () => void;
  selectedTaskId?: string;
}

// Create custom task marker
const createTaskMarker = (task: LocationBasedTask) => {
  const statusColor = task.status === 'Completed' ? '#10b981' : 
                     task.status === 'In Progress' ? '#3b82f6' : 
                     task.status === 'Paused' ? '#f59e0b' : '#6b7280';
  
  const priorityColor = task.priority === 'High' ? '#ef4444' : 
                       task.priority === 'Medium' ? '#f59e0b' : '#10b981';

  return L.divIcon({
    className: 'custom-task-marker',
    html: `
      <div style="
        width: 48px;
        height: 48px;
        position: relative;
        display: flex;
        align-items: center;
        justify-content: center;
      ">
        <!-- Pulsing outer ring -->
        <div style="
          position: absolute;
          width: 48px;
          height: 48px;
          background: ${statusColor};
          border-radius: 50%;
          opacity: 0.3;
          animation: pulse 2s infinite;
        "></div>
        
        <!-- Main marker -->
        <div style="
          position: absolute;
          width: 36px;
          height: 36px;
          background: ${statusColor};
          border-radius: 50%;
          border: 3px solid white;
          box-shadow: 0 4px 12px rgba(0,0,0,0.4);
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
          background: ${task.status === 'Completed' ? '#10b981' : '#6b7280'};
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
          ">${task.status === 'Completed' ? '✓' : '○'}</span>
        </div>
      </div>
      <style>
        @keyframes pulse {
          0% { transform: scale(1); opacity: 0.3; }
          50% { transform: scale(1.2); opacity: 0.1; }
          100% { transform: scale(1); opacity: 0.3; }
        }
      </style>
    `,
    iconSize: [48, 48],
    iconAnchor: [24, 24],
    popupAnchor: [0, -24],
  });
};

export default function TasksWithLocationMap({ onClose, selectedTaskId }: TasksWithLocationMapProps) {
  const { user } = useAuth();
  const [locationTasks, setLocationTasks] = useState<LocationBasedTask[]>([]);
  const [selectedTask, setSelectedTask] = useState<LocationBasedTask | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [mapCenter, setMapCenter] = useState<[number, number]>([7.8731, 80.7718]); // Default to Sri Lanka center

  useEffect(() => {
    fetchLocationTasks();
    getCurrentLocation();
  }, [user]);

  useEffect(() => {
    if (selectedTaskId && locationTasks.length > 0) {
      const task = locationTasks.find(t => t.id === selectedTaskId);
      if (task) {
        handleTaskSelect(task);
      }
    }
  }, [selectedTaskId, locationTasks]);

  const fetchLocationTasks = async () => {
    if (!user) return;

    try {
      setLoading(true);
      // Get all location-based tasks assigned to the current user
      const tasks = await LocationTaskService.getLocationBasedTasks({
        assigned_to: user.id,
      });
      setLocationTasks(tasks);
      
      // If there are tasks, center the map on the first one
      if (tasks.length > 0 && tasks[0].task_locations?.[0]) {
        const firstTask = tasks[0].task_locations[0];
        if (firstTask.required_latitude && firstTask.required_longitude) {
          setMapCenter([firstTask.required_latitude, firstTask.required_longitude]);
        }
      }
    } catch (error) {
      console.error('Error fetching location tasks:', error);
      setError('Failed to load location-based tasks');
      toast.error('Failed to load location-based tasks');
    } finally {
      setLoading(false);
    }
  };

  const getCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
        },
        (error) => {
          console.log('Could not get user location:', error);
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 60000
        }
      );
    }
  };

  const handleTaskSelect = (task: LocationBasedTask) => {
    setSelectedTask(task);
    
    // Center map on selected task
    if (task.task_locations?.[0]?.required_latitude && task.task_locations?.[0]?.required_longitude) {
      setMapCenter([
        task.task_locations[0].required_latitude,
        task.task_locations[0].required_longitude
      ]);
    }
  };

  const checkInToTask = async (task: LocationBasedTask) => {
    if (!userLocation) {
      toast.error('Unable to get your current location. Please enable location services.');
      return;
    }

    try {
      await LocationTaskService.recordEmployeeArrival(
        task.id,
        user!.id,
        userLocation
      );
      toast.success('Successfully checked in to task location!');
      fetchLocationTasks(); // Refresh tasks
    } catch (error: any) {
      toast.error(error.message || 'Failed to check in to task location');
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center">
        <div className="bg-white rounded-lg p-8 max-w-md w-full mx-4">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mr-4"></div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Loading Location Tasks</h3>
              <p className="text-gray-600">Fetching your location-based tasks...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center">
        <div className="bg-white rounded-lg p-8 max-w-md w-full mx-4">
          <div className="flex items-center mb-4">
            <ExclamationIcon className="h-8 w-8 text-red-500 mr-3" />
            <h3 className="text-lg font-semibold text-red-800">Error</h3>
          </div>
          <p className="text-red-600 mb-4">{error}</p>
          <div className="flex space-x-3">
            <button
              onClick={() => {
                setError(null);
                fetchLocationTasks();
              }}
              className="flex-1 bg-red-600 text-white py-2 px-4 rounded-md hover:bg-red-700"
            >
              Retry
            </button>
            <button
              onClick={onClose}
              className="flex-1 bg-gray-600 text-white py-2 px-4 rounded-md hover:bg-gray-700"
            >
              Close
            </button>
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
          <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-indigo-600 to-blue-600">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <MapIcon className="h-6 w-6 text-white mr-3" />
                <div>
                  <h2 className="text-xl font-bold text-white">Location-Based Tasks</h2>
                  <p className="text-indigo-100 text-sm">
                    {locationTasks.length} location-based task{locationTasks.length !== 1 ? 's' : ''} assigned to you
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="text-white hover:text-gray-200 transition-colors"
              >
                <XIcon className="h-6 w-6" />
              </button>
            </div>
          </div>

          {locationTasks.length === 0 ? (
            <div className="flex-1 flex items-center justify-center p-8">
              <div className="text-center max-w-md">
                <MapIcon className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-gray-900 mb-2">No Location-Based Tasks</h3>
                <p className="text-gray-600">
                  You don't have any tasks that require you to be at a specific location.
                </p>
                <button
                  onClick={onClose}
                  className="mt-4 bg-indigo-600 text-white px-6 py-2 rounded-md hover:bg-indigo-700"
                >
                  Back to Tasks
                </button>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col lg:flex-row">
              {/* Task List Sidebar */}
              <div className="w-full lg:w-1/3 border-r border-gray-200 flex flex-col max-h-96 lg:max-h-none tasks-location-sidebar">
                <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
                  <h3 className="text-lg font-semibold text-gray-900">Your Location Tasks</h3>
                </div>
                
                <div className="flex-1 overflow-y-auto">
                  {locationTasks.map((task) => (
                    <div
                      key={task.id}
                      onClick={() => handleTaskSelect(task)}
                      className={`px-6 py-4 border-b border-gray-100 cursor-pointer hover:bg-gray-50 transition-colors ${
                        selectedTask?.id === task.id ? 'bg-indigo-50 border-indigo-200' : ''
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <h4 className="text-sm font-semibold text-gray-900 truncate">
                            {task.title}
                          </h4>
                          <p className="text-xs text-gray-600 mt-1 line-clamp-2">
                            {task.description}
                          </p>
                          
                          <div className="mt-2 flex items-center space-x-4">
                            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                              task.status === 'Completed' ? 'bg-green-100 text-green-800' :
                              task.status === 'In Progress' ? 'bg-blue-100 text-blue-800' :
                              task.status === 'Paused' ? 'bg-yellow-100 text-yellow-800' :
                              'bg-gray-100 text-gray-800'
                            }`}>
                              {task.status}
                            </span>
                            
                            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                              task.priority === 'High' ? 'bg-red-100 text-red-800' :
                              task.priority === 'Medium' ? 'bg-yellow-100 text-yellow-800' :
                              'bg-green-100 text-green-800'
                            }`}>
                              {task.priority}
                            </span>
                          </div>
                          
                          <div className="mt-2 text-xs text-gray-500">
                            <div className="flex items-center">
                              <LocationMarkerIcon className="h-3 w-3 mr-1" />
                              {task.task_locations?.[0]?.location_name || 'Custom Location'}
                            </div>
                            <div className="flex items-center mt-1">
                              <ClockIcon className="h-3 w-3 mr-1" />
                              Due: {new Date(task.due_date).toLocaleDateString()}
                            </div>
                          </div>
                        </div>
                        
                        <div className="ml-2 text-right">
                          <div className="text-sm font-semibold text-green-600">
                            {formatCurrency(task.price)}
                          </div>
                          {userLocation && task.task_locations?.[0] && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                checkInToTask(task);
                              }}
                              className="mt-2 text-xs bg-indigo-600 text-white px-2 py-1 rounded hover:bg-indigo-700"
                            >
                              Check In
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Map */}
              <div className="flex-1 relative tasks-location-map">
                <MapContainer
                  center={mapCenter}
                  zoom={selectedTask ? 16 : 10}
                  style={{ height: '100%', width: '100%' }}
                  key={`${mapCenter[0]}-${mapCenter[1]}`} // Force re-render when center changes
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
                            width: 20px;
                            height: 20px;
                            background: #3b82f6;
                            border: 3px solid white;
                            border-radius: 50%;
                            box-shadow: 0 2px 8px rgba(0,0,0,0.3);
                          "></div>
                        `,
                        iconSize: [20, 20],
                        iconAnchor: [10, 10],
                      })}
                    >
                      <Popup>
                        <div className="text-center">
                          <p className="font-semibold text-blue-600">Your Location</p>
                          <p className="text-xs text-gray-600">
                            {userLocation.lat.toFixed(6)}, {userLocation.lng.toFixed(6)}
                          </p>
                        </div>
                      </Popup>
                    </Marker>
                  )}

                  {/* Task Markers */}
                  {locationTasks.map((task) => {
                    const taskLocation = task.task_locations?.[0];
                    if (!taskLocation?.required_latitude || !taskLocation?.required_longitude) return null;

                    return (
                      <React.Fragment key={task.id}>
                        <Marker
                          position={[taskLocation.required_latitude, taskLocation.required_longitude]}
                          icon={createTaskMarker(task)}
                          eventHandlers={{
                            click: () => handleTaskSelect(task),
                          }}
                        >
                          <Popup>
                            <div className="p-3 max-w-sm">
                              <h4 className="font-semibold text-gray-900 mb-2">{task.title}</h4>
                              <p className="text-sm text-gray-600 mb-3">{task.description}</p>
                              
                              <div className="space-y-2 text-sm">
                                <div className="flex justify-between">
                                  <span className="text-gray-600">Status:</span>
                                  <span className={`font-medium ${
                                    task.status === 'Completed' ? 'text-green-600' : 
                                    task.status === 'In Progress' ? 'text-blue-600' : 'text-yellow-600'
                                  }`}>
                                    {task.status}
                                  </span>
                                </div>
                                
                                <div className="flex justify-between">
                                  <span className="text-gray-600">Priority:</span>
                                  <span className="font-medium">{task.priority}</span>
                                </div>
                                
                                <div className="flex justify-between">
                                  <span className="text-gray-600">Reward:</span>
                                  <span className="font-medium text-green-600">{formatCurrency(task.price)}</span>
                                </div>
                                
                                <div className="flex justify-between">
                                  <span className="text-gray-600">Due:</span>
                                  <span className="font-medium">{new Date(task.due_date).toLocaleDateString()}</span>
                                </div>
                                
                                <div className="flex justify-between">
                                  <span className="text-gray-600">Location:</span>
                                  <span className="font-medium">{taskLocation.location_name || 'Custom'}</span>
                                </div>
                              </div>
                              
                              {userLocation && (
                                <button
                                  onClick={() => checkInToTask(task)}
                                  className="mt-3 w-full bg-indigo-600 text-white py-2 px-4 rounded-md text-sm hover:bg-indigo-700"
                                >
                                  Check In to Task
                                </button>
                              )}
                            </div>
                          </Popup>
                        </Marker>
                        
                        {/* Location radius circle */}
                        <Circle
                          center={[taskLocation.required_latitude, taskLocation.required_longitude]}
                          radius={taskLocation.required_radius_meters}
                          pathOptions={{
                            color: task.status === 'Completed' ? '#10b981' : '#3b82f6',
                            weight: 2,
                            opacity: 0.6,
                            fillColor: task.status === 'Completed' ? '#10b981' : '#3b82f6',
                            fillOpacity: 0.1,
                          }}
                        />
                      </React.Fragment>
                    );
                  })}
                </MapContainer>

                {/* Map Controls */}
                <div className="absolute top-4 right-4 z-[1000] space-y-2">
                  <button
                    onClick={getCurrentLocation}
                    className="bg-white hover:bg-gray-50 border border-gray-300 rounded-lg p-3 shadow-lg transition-colors"
                    title="Get Current Location"
                  >
                    <LocationMarkerIcon className="h-5 w-5 text-blue-600" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Selected Task Details */}
          {selectedTask && (
            <div className="border-t border-gray-200 bg-gray-50 px-6 py-4">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900">{selectedTask.title}</h3>
                  <p className="text-sm text-gray-600 mt-1">{selectedTask.description}</p>
                  
                  <div className="mt-2 flex items-center space-x-6">
                    <div className="flex items-center text-sm text-gray-600">
                      <CheckCircleIcon className="h-4 w-4 mr-1" />
                      Status: <span className="font-medium ml-1">{selectedTask.status}</span>
                    </div>
                    <div className="flex items-center text-sm text-gray-600">
                      <ClockIcon className="h-4 w-4 mr-1" />
                      Due: <span className="font-medium ml-1">{new Date(selectedTask.due_date).toLocaleDateString()}</span>
                    </div>
                    <div className="flex items-center text-sm text-gray-600">
                      <LocationMarkerIcon className="h-4 w-4 mr-1" />
                      Location: <span className="font-medium ml-1">
                        {selectedTask.task_locations?.[0]?.location_name || 'Custom Location'}
                      </span>
                    </div>
                  </div>
                </div>
                
                <div className="text-right">
                  <div className="text-2xl font-bold text-green-600 mb-2">
                    {formatCurrency(selectedTask.price)}
                  </div>
                  {userLocation && selectedTask.task_locations?.[0] && (
                    <button
                      onClick={() => checkInToTask(selectedTask)}
                      className="bg-indigo-600 text-white px-6 py-2 rounded-md hover:bg-indigo-700 transition-colors"
                    >
                      Check In to Location
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}