import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { supabase } from '../../lib/supabase';
import { GeofencingService, Geofence } from '../../services/GeofencingService';
import { JobService } from '../../services/JobService';
import { User } from '../../types/index';
import { Job } from '../../types/job';
import { formatCurrency, parseCurrencyInput } from '../../utils/currency';
import { TimeAssigningUtils } from '../../utils/timeAssigning';
import { MapIcon, LocationMarkerIcon, PlusIcon, TrashIcon, ClockIcon, ChevronDownIcon } from '@heroicons/react/outline';
import MapLocationPickerOSM from './MapLocationPickerOSM';
import FileAttachmentUploader from './FileAttachmentUploader';
import { Attachment } from '../../types/attachment';
import SearchableDropdown from '../ui/SearchableDropdown';
import toast from 'react-hot-toast';

interface EnhancedTaskFormProps {
  onSubmit: (data: any) => void;
  initialData?: any;
  isEdit?: boolean;
}

interface TaskLocation {
  id?: string;
  geofence_id: string | null;
  latitude: number | null;
  longitude: number | null;
  radius_meters: number;
  arrival_required: boolean;
  departure_required: boolean;
}

interface FormInputs {
  title: string;
  description: string;
  status: 'Completed' | 'Planned' | 'In Progress' | 'Not Started';
  priority: 'Low' | 'Medium' | 'High';
  assigned_to: string;
  assigned_to_ids: string[]; // new multi-assign
  job_id: string; // job assignment
  due_date: string;
  start_date: string;
  end_date: string;
  time_assigning: number;
  time_assigning_hours: number;
  time_assigning_minutes: number;
  estimated_time: number;
  price: string;
  location_required: boolean;
  locations: TaskLocation[];
  attachments: Attachment[];
  progress_percentage?: number;
}

export default function EnhancedTaskForm({ onSubmit, initialData, isEdit = false }: EnhancedTaskFormProps) {
  const [employees, setEmployees] = useState<User[]>([]);
  const [jobs, setJobs] = useState<Array<{ id: string; name: string; job_number: string; customer_name: string; status: string }>>([]);
  const [geofences, setGeofences] = useState<Geofence[]>([]);
  const [priceInput, setPriceInput] = useState(
    initialData?.price ? formatCurrency(initialData.price) : 'Rs. 0'
  );
  const [gettingLocation, setGettingLocation] = useState(false);
  const [locationMethods, setLocationMethods] = useState<('geofence' | 'coordinates')[]>([]);
  const [showMapPicker, setShowMapPicker] = useState(false);
  const [activeLocationIndex, setActiveLocationIndex] = useState<number | null>(null);
  const [timeInputMode, setTimeInputMode] = useState<'separate' | 'combined'>('separate');
  const [timeStringInput, setTimeStringInput] = useState('');
  const [isStatusDropdownOpen, setIsStatusDropdownOpen] = useState(false);
  const [attachments, setAttachments] = useState<Attachment[]>([]);

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
    getValues,
  } = useForm<FormInputs>({
    defaultValues: {
      status: 'Not Started',
      priority: 'Medium',
      price: 'Rs. 0',
      location_required: false,
      locations: [],
      time_assigning: 60,
      time_assigning_hours: 1,
      time_assigning_minutes: 0,
      estimated_time: 60,
      attachments: [],
      assigned_to_ids: [],
      job_id: '',
      ...initialData,
    },
  });

  const locationRequired = watch('location_required');
  const locations = watch('locations') || [];
  const selectedStatus = watch('status');
  const progressPercentage = watch('progress_percentage');

  const statusOptions = [
    { value: 'Not Started', label: 'Not Started', color: 'text-red-600', bgColor: 'bg-red-50', borderColor: 'border-red-200' },
    { value: 'Planned', label: 'Planned', color: 'text-blue-600', bgColor: 'bg-blue-50', borderColor: 'border-blue-200' },
    { value: 'In Progress', label: 'In Progress', color: 'text-yellow-600', bgColor: 'bg-yellow-50', borderColor: 'border-yellow-200' },
    { value: 'Completed', label: 'Completed', color: 'text-green-600', bgColor: 'bg-green-50', borderColor: 'border-green-200' },
  ];

  const selectedStatusOption = statusOptions.find(option => option.value === selectedStatus) || statusOptions[0];

  useEffect(() => {
    fetchEmployees();
    fetchJobs();
    fetchGeofences();
    if (initialData?.price) {
      setPriceInput(formatCurrency(initialData.price));
    }
    if (isEdit && initialData?.id) {
      fetchTaskLocations(initialData.id);
    }
  }, [initialData]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (isStatusDropdownOpen) {
        const target = event.target as Element;
        if (!target.closest('[data-status-dropdown]')) {
          setIsStatusDropdownOpen(false);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isStatusDropdownOpen]);

  const fetchTaskLocations = async (taskId: string) => {
    const { data, error } = await supabase.rpc('get_task_locations', { p_task_id: taskId });
    if (error) {
      console.error('Error fetching task locations:', error);
      return;
    }
    if (data) {
      setValue('locations', data);
      setLocationMethods(data.map((loc: { geofence_id: string | null }) => loc.geofence_id ? 'geofence' : 'coordinates'));
    }
  };

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

  const fetchJobs = async () => {
    try {
      const data = await JobService.getJobsForDropdown();
      setJobs(data.map(job => ({
        id: job.id,
        name: `${job.job_number} - ${job.customer_name}`,
        job_number: job.job_number,
        customer_name: job.customer_name,
        status: job.status
      })));
    } catch (error) {
      console.error('Error fetching jobs:', error);
      toast.error('Failed to fetch jobs');
    }
  };

  const fetchGeofences = async () => {
    try {
      const data = await GeofencingService.getGeofences(true);
      setGeofences(data);
    } catch (error) {
      console.error('Error fetching geofences:', error);
    }
  };

  const handlePriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    const numericValue = parseCurrencyInput(value);
    setPriceInput(formatCurrency(numericValue));
    setValue('price', String(numericValue));
  };

  const handleTimeInputChange = (hours: number, minutes: number) => {
    const totalMinutes = TimeAssigningUtils.toTotalMinutes(hours, minutes);
    setValue('time_assigning', totalMinutes);
    setValue('time_assigning_hours', hours);
    setValue('time_assigning_minutes', minutes);
    setValue('estimated_time', totalMinutes);
  };

  const handleTimeStringChange = (timeString: string) => {
    setTimeStringInput(timeString);
    const parsed = TimeAssigningUtils.parseTimeString(timeString);
    setValue('time_assigning', parsed.totalMinutes);
    setValue('time_assigning_hours', parsed.hours);
    setValue('time_assigning_minutes', parsed.minutes);
    setValue('estimated_time', parsed.totalMinutes);
  };

  const applyTimeSuggestion = (hours: number, minutes: number) => {
    handleTimeInputChange(hours, minutes);
    setTimeStringInput(TimeAssigningUtils.formatTimeInput(hours, minutes));
  };

  const handleMapLocationSelect = (location: { lat: number; lng: number }) => {
    if (activeLocationIndex !== null) {
      const newLocations = [...locations];
      newLocations[activeLocationIndex] = {
        ...newLocations[activeLocationIndex],
        geofence_id: null,
        latitude: location.lat,
        longitude: location.lng,
        radius_meters: newLocations[activeLocationIndex].radius_meters || 100,
        arrival_required: newLocations[activeLocationIndex].arrival_required || false,
        departure_required: newLocations[activeLocationIndex].departure_required || false,
      };
    setValue('locations', newLocations);
    setLocationMethods((prevMethods: ('geofence' | 'coordinates')[]) => {
      const newMethods = [...prevMethods];
      newMethods[activeLocationIndex] = 'coordinates';
      return newMethods;
    });
      setShowMapPicker(false);
    }
  };

  const handleGeofenceChange = (index: number, geofenceId: string) => {
    const newLocations = [...locations];
    if (geofenceId) {
      const geofence = geofences.find(g => g.id === geofenceId);
      if (geofence) {
        newLocations[index] = {
          ...newLocations[index],
          geofence_id: geofenceId,
          latitude: null,
          longitude: null,
          radius_meters: geofence.radius_meters,
        };
      }
    } else {
      newLocations[index] = {
        ...newLocations[index],
        geofence_id: null,
        radius_meters: 100,
      };
    }
    setValue('locations', newLocations);
    setLocationMethods((prevMethods: ('geofence' | 'coordinates')[]) => {
      const newMethods = [...prevMethods];
      newMethods[index] = 'geofence';
      return newMethods;
    });
  };

  const addLocation = () => {
    const newLocations = [...locations, {
      geofence_id: null,
      latitude: null,
      longitude: null,
      radius_meters: 100,
      arrival_required: true,
      departure_required: false,
    }];
    setValue('locations', newLocations);
    setLocationMethods([...locationMethods, 'coordinates']);
    setActiveLocationIndex(locations.length);
    setShowMapPicker(true);
  };

  const addLocationFromGeofence = (geofence: Geofence) => {
    const newLocations = [...locations, {
      geofence_id: geofence.id,
      latitude: geofence.center_latitude,
      longitude: geofence.center_longitude,
      radius_meters: geofence.radius_meters,
      arrival_required: true,
      departure_required: false,
    }];
    setValue('locations', newLocations);
    setLocationMethods([...locationMethods, 'geofence']);
    toast.success(`Added location: ${geofence.name}`);
  };

  const removeLocation = (index: number) => {
    const newLocations = locations.filter((_: any, i: number) => i !== index);
    setValue('locations', newLocations);
    setLocationMethods(locationMethods.filter((_: any, i: number) => i !== index));
    if (activeLocationIndex === index) {
      setActiveLocationIndex(null);
      setShowMapPicker(false);
    }
  };

  const toggleLocationMethod = (index: number) => {
    const newMethods: ('geofence' | 'coordinates')[] = [...locationMethods];
    newMethods[index] = newMethods[index] === 'geofence' ? 'coordinates' : 'geofence';
    setLocationMethods(newMethods);

    const newLocations = [...locations];
    newLocations[index] = {
      ...newLocations[index],
      geofence_id: null,
      latitude: null,
      longitude: null,
      radius_meters: 100,
    };
    setValue('locations', newLocations);
    
    if (newMethods[index] === 'coordinates') {
      setActiveLocationIndex(index);
      setShowMapPicker(true);
    }
  };

  const handleFormSubmit = async (data: FormInputs) => {
    try {
      if (data.location_required && (!data.locations || data.locations.length === 0)) {
        throw new Error('At least one location is required');
      }

      if (data.location_required) {
        const invalidLocations = data.locations.filter(loc => {
          const hasGeofence = loc.geofence_id !== null;
          const hasCoordinates = loc.latitude !== null && loc.longitude !== null;
          return !hasGeofence && !hasCoordinates;
        });

        if (invalidLocations.length > 0) {
          throw new Error('Each location must have either a geofence or valid coordinates');
        }
      }

      const formattedData = {
        ...data,
        price: parseCurrencyInput(priceInput),
        locations: data.locations.map(loc => ({
          ...loc,
          radius_meters: loc.radius_meters || 100,
          arrival_required: loc.arrival_required || false,
          departure_required: loc.departure_required || false
        })),
        // keep single assigned_to for backward compatibility with any legacy code
        assigned_to: data.assigned_to || (data.assigned_to_ids && data.assigned_to_ids[0]) || '',
        assigned_to_ids: data.assigned_to_ids || (data.assigned_to ? [data.assigned_to] : []),
      };

      // Only include progress_percentage when status is In Progress
      if (formattedData.status !== 'In Progress') {
        delete (formattedData as any).progress_percentage;
      }

      onSubmit(formattedData);
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">
      {/* Basic Task Information */}
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
        <label htmlFor="status" className="block text-sm font-medium text-gray-700">
          Task Status <span className="text-red-500">*</span>
        </label>
        <div className="mt-1 relative" data-status-dropdown>
          {/* Custom status dropdown with color coding */}
          <button
            type="button"
            onClick={() => setIsStatusDropdownOpen(!isStatusDropdownOpen)}
            className={`relative w-full cursor-pointer rounded-md border ${selectedStatusOption.borderColor} ${selectedStatusOption.bgColor} py-2 pl-3 pr-10 text-left shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 sm:text-sm`}
            aria-haspopup="listbox"
            aria-labelledby="status-label"
          >
            <span className={`block truncate ${selectedStatusOption.color} font-medium`}>
              {selectedStatusOption.label}
            </span>
            <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
              <ChevronDownIcon className="h-5 w-5 text-gray-400" aria-hidden="true" />
            </span>
          </button>

          {isStatusDropdownOpen && (
            <div className="absolute z-10 mt-1 w-full rounded-md bg-white py-1 text-base shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none sm:text-sm">
              {statusOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => {
                    setValue('status', option.value as 'Completed' | 'Planned' | 'In Progress' | 'Not Started');
                    setIsStatusDropdownOpen(false);
                  }}
                  className={`relative w-full cursor-pointer select-none py-2 pl-3 pr-9 hover:bg-gray-50 ${option.color} ${
                    selectedStatus === option.value ? 'bg-gray-100' : ''
                  }`}
                >
                  <span className="block truncate font-medium">{option.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        {errors.status && (
          <p className="mt-1 text-sm text-red-600">{errors.status.message}</p>
        )}
      </div>

      {/* Manual Progress Percentage - only when In Progress */}
      {selectedStatus === 'In Progress' && (
        <div>
          <label htmlFor="progress_percentage" className="block text-sm font-medium text-gray-700">
            Progress Percentage
          </label>
          <div className="mt-1 flex items-center gap-3">
            <input
              type="number"
              id="progress_percentage"
              min={0}
              max={100}
              step={1}
              {...register('progress_percentage')}
              defaultValue={initialData?.progress_percentage || ''}
              className="block w-32 rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              placeholder="0-100"
            />
            <span className="text-sm text-gray-500">% (applies only for In Progress)</span>
          </div>
        </div>
      )}

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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
          <label htmlFor="assigned_to_ids" className="block text-sm font-medium text-gray-700">
            Assign To Employees
          </label>
          <SearchableDropdown
            options={employees.map(emp => ({ id: emp.id, name: emp.full_name }))}
            value={watch('assigned_to_ids') || []}
            onChange={(value) => setValue('assigned_to_ids', value as string[])}
            placeholder="Select employees..."
            multiple={true}
            searchPlaceholder="Search employees..."
            className="mt-1"
          />
          <div className="mt-1 text-xs text-gray-500">
            You can select multiple employees for this task
          </div>
          {(errors as any).assigned_to_ids && (
            <p className="mt-1 text-sm text-red-600">Assign at least one employee</p>
          )}
        </div>

        <div>
          <label htmlFor="job_id" className="block text-sm font-medium text-gray-700">
            Assign To Job
          </label>
          <SearchableDropdown
            options={jobs}
            value={watch('job_id') || ''}
            onChange={(value) => setValue('job_id', value as string)}
            placeholder="Select a job..."
            multiple={false}
            searchPlaceholder="Search jobs..."
            className="mt-1"
          />
          <div className="mt-1 text-xs text-gray-500">
            Link this task to a specific job
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div>
          <label htmlFor="start_date" className="block text-sm font-medium text-gray-700">
            Start Date <span className="text-red-500">*</span>
          </label>
          <input
            type="datetime-local"
            id="start_date"
            {...register('start_date', { required: 'Start date is required' })}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
          />
          {errors.start_date && (
            <p className="mt-1 text-sm text-red-600">{errors.start_date.message}</p>
          )}
        </div>

        <div>
          <label htmlFor="end_date" className="block text-sm font-medium text-gray-700">
            End Date <span className="text-red-500">*</span>
          </label>
          <input
            type="datetime-local"
            id="end_date"
            {...register('end_date', { required: 'End date is required' })}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
          />
          {errors.end_date && (
            <p className="mt-1 text-sm text-red-600">{errors.end_date.message}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Time Assigning <span className="text-red-500">*</span>
          </label>
          
          {/* Input Mode Toggle */}
          <div className="flex flex-col sm:flex-row gap-2 sm:space-x-4 mb-3">
            <label className="flex items-center">
              <input
                type="radio"
                name="timeInputMode"
                value="separate"
                checked={timeInputMode === 'separate'}
                onChange={(e) => setTimeInputMode(e.target.value as 'separate' | 'combined')}
                className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300"
              />
              <span className="ml-2 text-sm text-gray-700">Hours & Minutes</span>
            </label>
            <label className="flex items-center">
              <input
                type="radio"
                name="timeInputMode"
                value="combined"
                checked={timeInputMode === 'combined'}
                onChange={(e) => setTimeInputMode(e.target.value as 'separate' | 'combined')}
                className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300"
              />
              <span className="ml-2 text-sm text-gray-700">Text Input</span>
            </label>
          </div>

          {timeInputMode === 'separate' ? (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="time_assigning_hours" className="block text-xs font-medium text-gray-600">
                  Hours
                </label>
                <input
                  type="number"
                  id="time_assigning_hours"
                  min="0"
                  max="23"
                  {...register('time_assigning_hours', { 
                    required: 'Hours is required',
                    min: { value: 0, message: 'Hours cannot be negative' },
                    max: { value: 23, message: 'Hours cannot exceed 23' }
                  })}
                  onChange={(e) => {
                    const hours = parseInt(e.target.value) || 0;
                    const minutes = getValues('time_assigning_minutes') || 0;
                    handleTimeInputChange(hours, minutes);
                  }}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                  placeholder="1"
                />
                {errors.time_assigning_hours && (
                  <p className="mt-1 text-xs text-red-600">{errors.time_assigning_hours.message}</p>
                )}
              </div>
              <div>
                <label htmlFor="time_assigning_minutes" className="block text-xs font-medium text-gray-600">
                  Minutes
                </label>
                <input
                  type="number"
                  id="time_assigning_minutes"
                  min="0"
                  max="59"
                  {...register('time_assigning_minutes', { 
                    required: 'Minutes is required',
                    min: { value: 0, message: 'Minutes cannot be negative' },
                    max: { value: 59, message: 'Minutes must be less than 60' }
                  })}
                  onChange={(e) => {
                    const minutes = parseInt(e.target.value) || 0;
                    const hours = getValues('time_assigning_hours') || 0;
                    handleTimeInputChange(hours, minutes);
                  }}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                  placeholder="0"
                />
                {errors.time_assigning_minutes && (
                  <p className="mt-1 text-xs text-red-600">{errors.time_assigning_minutes.message}</p>
                )}
              </div>
            </div>
          ) : (
            <div>
              <input
                type="text"
                value={timeStringInput}
                onChange={(e) => handleTimeStringChange(e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                placeholder="e.g., 2h 30m, 90m, 1.5h"
              />
              <p className="mt-1 text-xs text-gray-500">
                Examples: "2h 30m", "90m", "1.5h", "120"
              </p>
            </div>
          )}

          {/* Time Suggestions */}
          <div className="mt-3">
            <p className="text-xs font-medium text-gray-600 mb-2">Quick Select:</p>
            <div className="flex flex-wrap gap-2">
              {TimeAssigningUtils.getTimeSuggestions().map((suggestion, index) => (
                <button
                  key={index}
                  type="button"
                  onClick={() => applyTimeSuggestion(suggestion.hours, suggestion.minutes)}
                  className="px-3 py-1 text-xs bg-gray-100 hover:bg-indigo-100 text-gray-700 hover:text-indigo-700 rounded-full border border-gray-300 hover:border-indigo-300 transition-colors"
                >
                  {suggestion.label}
                </button>
              ))}
            </div>
          </div>

          {/* Display Total Time */}
          <div className="mt-2 p-2 bg-blue-50 rounded-md">
            <div className="flex items-center text-sm">
              <ClockIcon className="h-4 w-4 text-blue-600 mr-2" />
              <span className="text-blue-800 font-medium">
                Total Time: {TimeAssigningUtils.formatTimeFromMinutes(getValues('time_assigning') || 0)}
              </span>
            </div>
          </div>

          {errors.time_assigning && (
            <p className="mt-1 text-sm text-red-600">{errors.time_assigning.message}</p>
          )}
        </div>
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

      {/* Location Requirements */}
      <div className="border-t border-gray-200 pt-6">
        <div className="flex items-center">
          <input
            type="checkbox"
            id="location_required"
            {...register('location_required')}
            className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
          />
          <label htmlFor="location_required" className="ml-2 block text-sm font-medium text-gray-700">
            Location-based task
          </label>
        </div>
        <p className="mt-1 text-sm text-gray-500">
          Require employees to be at specific locations to work on this task
        </p>

        {locationRequired && (
          <div className="mt-4 space-y-4">
            {/* Map Picker */}
            {showMapPicker && (
              <div className="mb-4">
                <MapLocationPickerOSM
                  onLocationSelect={handleMapLocationSelect}
                  onClose={() => setShowMapPicker(false)}
                  initialLocation={
                    activeLocationIndex !== null && locations[activeLocationIndex]?.latitude
                      ? {
                          lat: locations[activeLocationIndex].latitude!,
                          lng: locations[activeLocationIndex].longitude!,
                        }
                      : undefined
                  }
                />
              </div>
            )}

            {locations.map((location: any, index: number) => (
              <div key={index} className="p-4 bg-gray-50 rounded-lg space-y-4">
                <div className="flex justify-between items-center">
                  <h4 className="text-sm font-medium text-gray-900">Location {index + 1}</h4>
                  <div className="flex space-x-2">
                    {locationMethods[index] === 'coordinates' && (
                      <button
                        type="button"
                        onClick={() => {
                          setActiveLocationIndex(index);
                          setShowMapPicker(true);
                        }}
                        className="text-indigo-600 hover:text-indigo-800"
                        title="Open map picker"
                        aria-label="Open map picker for location"
                      >
                        <MapIcon className="h-5 w-5" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => removeLocation(index)}
                      className="text-red-600 hover:text-red-800"
                      title="Remove location"
                      aria-label="Remove this location"
                    >
                      <TrashIcon className="h-5 w-5" />
                    </button>
                  </div>
                </div>

                <div>
                  <fieldset 
                    aria-label={`Location method selection for location ${index + 1}`}
                    title={`Location method selection for location ${index + 1}`}
                    role="group"
                  >
                    <legend 
                      id={`location_method_label_${index}`} 
                      className="block text-sm font-medium text-gray-700"
                      title="Location method selection"
                    >
                      Location Method
                    </legend>
                    <div 
                    className="mt-2 space-y-2" 
                    role="radiogroup" 
                    aria-label="Choose location method"
                    aria-labelledby={`location_method_label_${index}`}
                    title="Location method options"
                    id={`location_method_group_${index}`}
                    tabIndex={0}
                    aria-required="true"
                    aria-describedby={`location_method_description_${index}`}
                    data-testid={`location-method-group-${index}`}
                    aria-controls={`location_method_options_${index}`}
                    aria-expanded="true"
                    aria-orientation="vertical"
                    aria-atomic="true"
                    aria-live="polite"
                    aria-relevant="all"
                    data-selected={locationMethods[index] === 'geofence'}
                    data-form-group="location-method"
                  >
                    <div className="flex items-center">
                      <input
                        type="radio"
                        id={`use_geofence_${index}`}
                        name={`location_method_${index}`}
                        title="Use geofence"
                        aria-label={`Use geofence for location ${index + 1}`}
                        aria-labelledby={`geofence_label_${index}`}
                        checked={locationMethods[index] === 'geofence'}
                        onChange={() => toggleLocationMethod(index)}
                        className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300"
                        placeholder="Use geofence"
                      />
                      <label id={`geofence_label_${index}`} htmlFor={`use_geofence_${index}`} className="ml-2 block text-sm text-gray-700">
                        Use existing geofence
                      </label>
                    </div>
                    <div className="flex items-center">
                      <input
                        type="radio"
                        id={`use_coordinates_${index}`}
                        name={`location_method_${index}`}
                        title="Use coordinates"
                        aria-label={`Use coordinates for location ${index + 1}`}
                        aria-labelledby={`coordinates_label_${index}`}
                        checked={locationMethods[index] === 'coordinates'}
                        onChange={() => toggleLocationMethod(index)}
                        className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300"
                        placeholder="Use coordinates"
                      />
                      <label id={`coordinates_label_${index}`} htmlFor={`use_coordinates_${index}`} className="ml-2 block text-sm text-gray-700">
                        Use specific coordinates
                      </label>
                    </div>
                  </div>
                  </fieldset>
                </div>

                {locationMethods[index] === 'geofence' ? (
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Select Geofence
                    </label>
                    <select
                      id={`geofence_${index}`}
                      title="Select geofence"
                      aria-label="Select geofence"
                      value={location.geofence_id || ''}
                      onChange={(e) => handleGeofenceChange(index, e.target.value)}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                    >
                      <option value="">Select a geofence</option>
                      {geofences.map((geofence) => (
                        <option key={geofence.id} value={geofence.id}>
                          {geofence.name} ({geofence.radius_meters}m radius)
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        Latitude
                      </label>
                      <input
                        type="number"
                        step="any"
                        value={location.latitude || ''}
                        onChange={(e) => {
                          const newLocations = [...locations];
                          newLocations[index] = {
                            ...newLocations[index],
                            latitude: parseFloat(e.target.value),
                          };
                          setValue('locations', newLocations);
                        }}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                        placeholder="0.000000"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        Longitude
                      </label>
                      <input
                        type="number"
                        step="any"
                        value={location.longitude || ''}
                        onChange={(e) => {
                          const newLocations = [...locations];
                          newLocations[index] = {
                            ...newLocations[index],
                            longitude: parseFloat(e.target.value),
                          };
                          setValue('locations', newLocations);
                        }}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                        placeholder="0.000000"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        Radius (meters)
                      </label>
                      <input
                        type="number"
                        min="10"
                        max="1000"
                        title="Radius in meters (10-1000)"
                        placeholder="Enter radius"
                        value={location.radius_meters}
                        onChange={(e) => {
                          const newLocations = [...locations];
                          newLocations[index] = {
                            ...newLocations[index],
                            radius_meters: parseInt(e.target.value),
                          };
                          setValue('locations', newLocations);
                        }}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                      />
                    </div>
                  </div>
                )}

                <div className="flex items-center space-x-6">
                  <div className="flex items-center">
                                          <input
                        type="checkbox"
                        id={`arrival_required_${index}`}
                        title="Auto check-in"
                        checked={location.arrival_required}
                        onChange={(e) => {
                          const newLocations = [...locations];
                          newLocations[index] = {
                            ...newLocations[index],
                            arrival_required: e.target.checked,
                          };
                          setValue('locations', newLocations);
                        }}
                        className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                      />
                    <label className="ml-2 block text-sm text-gray-700">
                      Auto check-in when employee arrives
                    </label>
                  </div>
                  <div className="flex items-center">
                                          <input
                        type="checkbox"
                        id={`departure_required_${index}`}
                        title="Auto check-out"
                        checked={location.departure_required}
                        onChange={(e) => {
                          const newLocations = [...locations];
                          newLocations[index] = {
                            ...newLocations[index],
                            departure_required: e.target.checked,
                          };
                          setValue('locations', newLocations);
                        }}
                        className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                      />
                    <label className="ml-2 block text-sm text-gray-700">
                      Auto check-out when employee leaves
                    </label>
                  </div>
                </div>
              </div>
            ))}

            {/* Geofence Selection Dropdown */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                Select Location
              </label>
              <SearchableDropdown
                options={geofences.map(geofence => ({
                  id: geofence.id,
                  name: geofence.name,
                  description: geofence.description,
                  radius: geofence.radius_meters
                }))}
                value=""
                onChange={(selectedGeofenceId) => {
                  if (selectedGeofenceId) {
                    const selectedGeofence = geofences.find(g => g.id === selectedGeofenceId);
                    if (selectedGeofence) {
                      addLocationFromGeofence(selectedGeofence);
                    }
                  }
                }}
                placeholder="Search and select a location..."
                searchPlaceholder="Search locations..."
                className="w-full"
              />
            </div>
          </div>
        )}
      </div>

      {/* File Attachments */}
      <div className="border-t border-gray-200 pt-6">
        <div className="flex items-center mb-4">
          <h3 className="text-lg font-medium text-gray-900">File Attachments</h3>
        </div>
        <p className="text-sm text-gray-500 mb-4">
          Attach photos, documents, or any relevant files to this task (max 5 files, 10MB each)
        </p>
        <FileAttachmentUploader
          taskId={initialData?.id}
          attachments={attachments}
          onAttachmentsChange={(newAttachments) => {
            setAttachments(newAttachments);
            setValue('attachments', newAttachments);
          }}
          maxFiles={5}
        />
      </div>

      <div className="flex justify-end">
        <button
          type="submit"
          className="w-full sm:w-auto inline-flex justify-center rounded-md border border-transparent bg-indigo-600 py-2 px-4 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        >
          {isEdit ? 'Update Task' : 'Create Task'}
        </button>
      </div>
    </form>
  );
}