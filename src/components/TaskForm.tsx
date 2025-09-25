import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { supabase } from '../lib/supabase';
import { User } from '../types/index';
import { formatCurrency, parseCurrencyInput } from '../utils/currency';
import { GeofencingService, Geofence } from '../services/GeofencingService';
import MapLocationPickerOSM from './admin/MapLocationPickerOSM';
import { MapIcon, LocationMarkerIcon, CheckCircleIcon } from '@heroicons/react/outline';
import toast from 'react-hot-toast';

interface TaskFormProps {
  onSubmit: (data: any) => void;
  initialData?: any;
  isEdit?: boolean;
}

interface FormInputs {
  title: string;
  description: string;
  priority: 'Low' | 'Medium' | 'High';
  assigned_to: string;
  due_date: string;
  price: string;
  location_based: boolean;
  geofence_id?: string;
  custom_location?: {
    lat: number;
    lng: number;
    address?: string;
  };
}

export default function TaskForm({ onSubmit, initialData, isEdit = false }: TaskFormProps) {
  const [employees, setEmployees] = useState<User[]>([]);
  const [geofences, setGeofences] = useState<Geofence[]>([]);
  const [priceInput, setPriceInput] = useState(
    initialData?.price ? formatCurrency(initialData.price) : 'Rs. 0'
  );
  const [isLocationBased, setIsLocationBased] = useState(initialData?.location_based || false);
  const [selectedGeofence, setSelectedGeofence] = useState<Geofence | null>(null);
  const [customLocation, setCustomLocation] = useState<{ lat: number; lng: number; address?: string } | null>(
    initialData?.custom_location || null
  );
  const [showMapPicker, setShowMapPicker] = useState(false);
  const [locationType, setLocationType] = useState<'geofence' | 'custom'>('geofence');

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
  } = useForm<FormInputs>({
    defaultValues: initialData || {
      priority: 'Medium',
      price: 'Rs. 0',
    },
  });

  useEffect(() => {
    fetchEmployees();
    fetchGeofences();
    if (initialData?.price) {
      setPriceInput(formatCurrency(initialData.price));
    }
    if (initialData?.geofence_id) {
      setLocationType('geofence');
    } else if (initialData?.custom_location) {
      setLocationType('custom');
    }
  }, [initialData]);

  const fetchEmployees = async () => {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('role', 'employee');

    if (error) {
      console.error('Error fetching employees:', error);
      return;
    }

    setEmployees(data || []);
  };

  const fetchGeofences = async () => {
    try {
      const data = await GeofencingService.getGeofences(true); // Only active geofences
      setGeofences(data);
      
      // Set selected geofence if editing
      if (initialData?.geofence_id) {
        const geofence = data.find(g => g.id === initialData.geofence_id);
        if (geofence) {
          setSelectedGeofence(geofence);
        }
      }
    } catch (error) {
      console.error('Error fetching geofences:', error);
      toast.error('Failed to load saved locations');
    }
  };

  const handlePriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    const numericValue = parseCurrencyInput(value);
    setPriceInput(formatCurrency(numericValue));
    setValue('price', String(numericValue));
  };

  const handleFormSubmit = (data: FormInputs) => {
    const formattedData = {
      ...data,
      price: parseCurrencyInput(priceInput),
      location_based: isLocationBased,
      geofence_id: isLocationBased && locationType === 'geofence' ? selectedGeofence?.id : undefined,
      custom_location: isLocationBased && locationType === 'custom' ? customLocation : undefined,
    };
    
    // Validation for location-based tasks
    if (isLocationBased) {
      if (locationType === 'geofence' && !selectedGeofence) {
        toast.error('Please select a geofence for location-based task');
        return;
      }
      if (locationType === 'custom' && !customLocation) {
        toast.error('Please set a custom location for location-based task');
        return;
      }
    }
    
    onSubmit(formattedData);
  };

  const handleLocationSelect = (location: { lat: number; lng: number; address?: string }) => {
    setCustomLocation(location);
    setShowMapPicker(false);
    toast.success('Custom location set successfully');
  };

  const handleGeofenceSelect = (geofenceId: string) => {
    const geofence = geofences.find(g => g.id === geofenceId);
    setSelectedGeofence(geofence || null);
  };

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">
      <div>
        <label htmlFor="title" className="block text-sm font-medium text-gray-700">
          Title
        </label>
        <input
          type="text"
          id="title"
          {...register('title', { required: 'Title is required' })}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
        />
        {errors.title && (
          <p className="mt-1 text-sm text-red-600">{errors.title.message}</p>
        )}
      </div>

      <div>
        <label htmlFor="description" className="block text-sm font-medium text-gray-700">
          Description
        </label>
        <textarea
          id="description"
          rows={3}
          {...register('description', { required: 'Description is required' })}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
        />
        {errors.description && (
          <p className="mt-1 text-sm text-red-600">{errors.description.message}</p>
        )}
      </div>

      <div>
        <label htmlFor="price" className="block text-sm font-medium text-gray-700">
          Price (LKR)
        </label>
        <div className="mt-1 relative rounded-md shadow-sm">
          <input
            type="text"
            id="price"
            value={priceInput}
            onChange={handlePriceChange}
            className="block w-full rounded-md border-gray-300 pl-7 pr-12 focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            placeholder="Rs. 0"
          />
        </div>
      </div>

      <div>
        <label htmlFor="priority" className="block text-sm font-medium text-gray-700">
          Priority
        </label>
        <select
          id="priority"
          {...register('priority')}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
        >
          <option value="Low">Low</option>
          <option value="Medium">Medium</option>
          <option value="High">High</option>
        </select>
      </div>

      <div>
        <label htmlFor="assigned_to" className="block text-sm font-medium text-gray-700">
          Assign To
        </label>
        <select
          id="assigned_to"
          {...register('assigned_to', { required: 'Please assign the task to an employee' })}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
        >
          <option value="">Select Employee</option>
          {employees.map((employee) => (
            <option key={employee.id} value={employee.id}>
              {employee.full_name}
            </option>
          ))}
        </select>
        {errors.assigned_to && (
          <p className="mt-1 text-sm text-red-600">{errors.assigned_to.message}</p>
        )}
      </div>

      <div>
        <label htmlFor="due_date" className="block text-sm font-medium text-gray-700">
          Due Date
        </label>
        <input
          type="date"
          id="due_date"
          {...register('due_date', { required: 'Due date is required' })}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
        />
        {errors.due_date && (
          <p className="mt-1 text-sm text-red-600">{errors.due_date.message}</p>
        )}
      </div>

      {/* Location-Based Task Section */}
      <div className="border-t border-gray-200 pt-6">
        <div className="flex items-center space-x-3 mb-4">
          <input
            type="checkbox"
            id="location_based"
            checked={isLocationBased}
            onChange={(e) => setIsLocationBased(e.target.checked)}
            className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
          />
          <label htmlFor="location_based" className="text-sm font-medium text-gray-700 flex items-center">
            <MapIcon className="h-5 w-5 text-indigo-600 mr-2" />
            Location-Based Task
          </label>
        </div>
        
        {isLocationBased && (
          <div className="space-y-4 pl-8 border-l-2 border-indigo-200">
            <p className="text-sm text-gray-600">
              This task requires the employee to be at a specific location to complete it.
            </p>
            
            {/* Location Type Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Location Type</label>
              <div className="flex space-x-4">
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="locationType"
                    value="geofence"
                    checked={locationType === 'geofence'}
                    onChange={(e) => setLocationType(e.target.value as 'geofence' | 'custom')}
                    className="mr-2"
                  />
                  <span className="text-sm text-gray-700">Use Saved Location (Geofence)</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="locationType"
                    value="custom"
                    checked={locationType === 'custom'}
                    onChange={(e) => setLocationType(e.target.value as 'geofence' | 'custom')}
                    className="mr-2"
                  />
                  <span className="text-sm text-gray-700">Set Custom Location</span>
                </label>
              </div>
            </div>

            {/* Geofence Selection */}
            {locationType === 'geofence' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Saved Location
                </label>
                {geofences.length === 0 ? (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <div className="flex items-center">
                      <MapIcon className="h-5 w-5 text-yellow-500 mr-2" />
                      <span className="text-sm text-yellow-800">
                        No saved locations available. Create geofences in Location Management first.
                      </span>
                    </div>
                  </div>
                ) : (
                  <>
                    <select
                      value={selectedGeofence?.id || ''}
                      onChange={(e) => handleGeofenceSelect(e.target.value)}
                      className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                    >
                      <option value="">Select a saved location...</option>
                      {geofences.map((geofence) => (
                        <option key={geofence.id} value={geofence.id}>
                          {geofence.name} - {geofence.radius_meters}m radius
                        </option>
                      ))}
                    </select>
                    
                    {selectedGeofence && (
                      <div className="mt-3 bg-green-50 border border-green-200 rounded-lg p-3">
                        <div className="flex items-center mb-2">
                          <CheckCircleIcon className="h-5 w-5 text-green-500 mr-2" />
                          <span className="text-sm font-medium text-green-800">
                            Selected: {selectedGeofence.name}
                          </span>
                        </div>
                        <div className="text-xs text-green-700 space-y-1">
                          <p>Location: {selectedGeofence.center_latitude.toFixed(6)}, {selectedGeofence.center_longitude.toFixed(6)}</p>
                          <p>Radius: {selectedGeofence.radius_meters} meters</p>
                          {selectedGeofence.description && (
                            <p>Description: {selectedGeofence.description}</p>
                          )}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* Custom Location Selection */}
            {locationType === 'custom' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Custom Location
                </label>
                
                {customLocation ? (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center">
                        <CheckCircleIcon className="h-5 w-5 text-blue-500 mr-2" />
                        <span className="text-sm font-medium text-blue-800">Custom Location Set</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowMapPicker(true)}
                        className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                      >
                        Change Location
                      </button>
                    </div>
                    <div className="text-xs text-blue-700 space-y-1">
                      <p>Latitude: {customLocation.lat.toFixed(6)}</p>
                      <p>Longitude: {customLocation.lng.toFixed(6)}</p>
                      {customLocation.address && (
                        <p>Address: {customLocation.address}</p>
                      )}
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowMapPicker(true)}
                    className="w-full flex items-center justify-center px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg text-sm font-medium text-gray-600 hover:border-indigo-500 hover:text-indigo-600 transition-colors"
                  >
                    <LocationMarkerIcon className="h-5 w-5 mr-2" />
                    Click to Select Location on Map
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex justify-end">
        <button
          type="submit"
          className="inline-flex justify-center rounded-md border border-transparent bg-indigo-600 py-2 px-4 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
        >
          {isEdit ? 'Update Task' : 'Create Task'}
        </button>
      </div>

      {/* Map Location Picker Modal */}
      {showMapPicker && (
        <MapLocationPickerOSM
          onLocationSelect={handleLocationSelect}
          onClose={() => setShowMapPicker(false)}
          initialLocation={customLocation ? { lat: customLocation.lat, lng: customLocation.lng } : undefined}
          title="Select Task Location"
          geofences={geofences}
        />
      )}
    </form>
  );
} 