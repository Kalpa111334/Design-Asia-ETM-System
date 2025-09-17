import { supabase } from '../lib/supabase';
import { GeofencingService, Geofence, TaskLocation } from './GeofencingService';

export interface TaskLocationData {
  id?: string;
  task_id: string;
  geofence_id?: string;
  required_latitude?: number;
  required_longitude?: number;
  required_radius_meters: number;
  arrival_required: boolean;
  departure_required: boolean;
  location_name?: string;
  location_address?: string;
  created_at?: string;
}

export interface LocationBasedTask {
  id: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  assigned_to: string;
  due_date: string;
  price: number;
  location_based: boolean;
  task_locations?: TaskLocationData[];
  geofences?: Geofence[];
  created_at: string;
  updated_at: string;
}

export class LocationTaskService {
  /**
   * Create a location-based task with geofence or custom location
   */
  static async createLocationBasedTask(taskData: {
    title: string;
    description: string;
    priority: string;
    assigned_to: string;
    due_date: string;
    price: number;
    geofence_id?: string;
    custom_location?: {
      lat: number;
      lng: number;
      address?: string;
    };
  }): Promise<LocationBasedTask> {
    try {
      // First create the task
      const { data: task, error: taskError } = await supabase
        .from('tasks')
        .insert([{
          title: taskData.title,
          description: taskData.description,
          priority: taskData.priority,
          assigned_to: taskData.assigned_to,
          due_date: taskData.due_date,
          price: taskData.price,
          status: 'Not Started',
          location_based: true,
        }])
        .select()
        .single();

      if (taskError) throw taskError;

      // Create task location entry
      const locationData: Omit<TaskLocationData, 'id' | 'created_at'> = {
        task_id: task.id,
        required_radius_meters: 100, // Default radius
        arrival_required: true,
        departure_required: false,
      };

      if (taskData.geofence_id) {
        // Use geofence location
        locationData.geofence_id = taskData.geofence_id;
        
        // Get geofence details for location data
        const geofence = await this.getGeofenceById(taskData.geofence_id);
        if (geofence) {
          locationData.required_latitude = geofence.center_latitude;
          locationData.required_longitude = geofence.center_longitude;
          locationData.required_radius_meters = geofence.radius_meters;
          locationData.location_name = geofence.name;
        }
      } else if (taskData.custom_location) {
        // Use custom location
        locationData.required_latitude = taskData.custom_location.lat;
        locationData.required_longitude = taskData.custom_location.lng;
        locationData.location_address = taskData.custom_location.address;
        locationData.location_name = 'Custom Location';
      } else {
        throw new Error('Either geofence_id or custom_location must be provided');
      }

      const { data: taskLocation, error: locationError } = await supabase
        .from('task_locations')
        .insert([locationData])
        .select()
        .single();

      if (locationError) {
        // If location creation fails, clean up the task
        await supabase.from('tasks').delete().eq('id', task.id);
        throw locationError;
      }

      // Return the complete task with location data
      return {
        ...task,
        task_locations: [taskLocation],
        geofences: taskData.geofence_id ? [await this.getGeofenceById(taskData.geofence_id)].filter(Boolean) : [],
      } as LocationBasedTask;
    } catch (error) {
      console.error('Error creating location-based task:', error);
      throw error;
    }
  }

  /**
   * Update a location-based task
   */
  static async updateLocationBasedTask(
    taskId: string, 
    updates: Partial<{
      title: string;
      description: string;
      priority: string;
      assigned_to: string;
      due_date: string;
      price: number;
      geofence_id?: string;
      custom_location?: {
        lat: number;
        lng: number;
        address?: string;
      };
    }>
  ): Promise<LocationBasedTask> {
    try {
      // Update the main task
      const taskUpdates = { ...updates };
      delete taskUpdates.geofence_id;
      delete taskUpdates.custom_location;

      const { data: task, error: taskError } = await supabase
        .from('tasks')
        .update(taskUpdates)
        .eq('id', taskId)
        .select()
        .single();

      if (taskError) throw taskError;

      // Update task location if location data is provided
      if (updates.geofence_id || updates.custom_location) {
        const locationUpdates: Partial<TaskLocationData> = {};

        if (updates.geofence_id) {
          locationUpdates.geofence_id = updates.geofence_id;
          
          const geofence = await this.getGeofenceById(updates.geofence_id);
          if (geofence) {
            locationUpdates.required_latitude = geofence.center_latitude;
            locationUpdates.required_longitude = geofence.center_longitude;
            locationUpdates.required_radius_meters = geofence.radius_meters;
            locationUpdates.location_name = geofence.name;
          }
        } else if (updates.custom_location) {
          (locationUpdates as any).geofence_id = null;
          locationUpdates.required_latitude = updates.custom_location.lat;
          locationUpdates.required_longitude = updates.custom_location.lng;
          locationUpdates.location_address = updates.custom_location.address;
          locationUpdates.location_name = 'Custom Location';
        }

        await supabase
          .from('task_locations')
          .update(locationUpdates)
          .eq('task_id', taskId);
      }

      return this.getLocationBasedTaskById(taskId);
    } catch (error) {
      console.error('Error updating location-based task:', error);
      throw error;
    }
  }

  /**
   * Get a location-based task by ID with all related data
   */
  static async getLocationBasedTaskById(taskId: string): Promise<LocationBasedTask> {
    try {
      const { data, error } = await supabase
        .from('tasks')
        .select(`
          *,
          assigned_to:users!tasks_assigned_to_fkey(id, full_name, email, avatar_url),
          task_locations(*)
        `)
        .eq('id', taskId)
        .eq('location_based', true)
        .single();

      if (error) throw error;

      // Get geofences for this task
      const geofences: Geofence[] = [];
      if (data.task_locations) {
        for (const taskLocation of data.task_locations) {
          if (taskLocation.geofence_id) {
            const geofence = await this.getGeofenceById(taskLocation.geofence_id);
            if (geofence) geofences.push(geofence);
          }
        }
      }

      return {
        ...data,
        geofences,
      } as LocationBasedTask;
    } catch (error) {
      console.error('Error fetching location-based task:', error);
      throw error;
    }
  }

  /**
   * Get all location-based tasks with filtering options
   */
  static async getLocationBasedTasks(filters?: {
    status?: string;
    assigned_to?: string;
    geofence_id?: string;
  }): Promise<LocationBasedTask[]> {
    try {
      let query = supabase
        .from('tasks')
        .select(`
          *,
          assigned_to:users!tasks_assigned_to_fkey(id, full_name, email, avatar_url),
          task_locations(*)
        `)
        .eq('location_based', true)
        .order('created_at', { ascending: false });

      if (filters?.status) {
        query = query.eq('status', filters.status);
      }

      if (filters?.assigned_to) {
        query = query.eq('assigned_to', filters.assigned_to);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Enrich with geofence data
      const enrichedTasks: LocationBasedTask[] = [];
      for (const task of data || []) {
        const geofences: Geofence[] = [];
        
        if (task.task_locations) {
          for (const taskLocation of task.task_locations) {
            if (taskLocation.geofence_id) {
              const geofence = await this.getGeofenceById(taskLocation.geofence_id);
              if (geofence) geofences.push(geofence);
            }
          }
        }

        enrichedTasks.push({
          ...task,
          geofences,
        } as LocationBasedTask);
      }

      return enrichedTasks;
    } catch (error) {
      console.error('Error fetching location-based tasks:', error);
      throw error;
    }
  }

  /**
   * Check if employee is within task location
   */
  static async checkEmployeeInTaskLocation(
    taskId: string,
    employeeLocation: { lat: number; lng: number }
  ): Promise<{
    isWithinLocation: boolean;
    distance: number;
    taskLocation: TaskLocationData | null;
  }> {
    try {
      const { data: taskLocation, error } = await supabase
        .from('task_locations')
        .select('*')
        .eq('task_id', taskId)
        .single();

      if (error || !taskLocation || !taskLocation.required_latitude || !taskLocation.required_longitude) {
        return {
          isWithinLocation: false,
          distance: Infinity,
          taskLocation: null,
        };
      }

      const distance = GeofencingService.calculateDistance(
        employeeLocation.lat,
        employeeLocation.lng,
        taskLocation.required_latitude,
        taskLocation.required_longitude
      );

      const isWithinLocation = distance <= taskLocation.required_radius_meters;

      return {
        isWithinLocation,
        distance,
        taskLocation,
      };
    } catch (error) {
      console.error('Error checking employee location:', error);
      return {
        isWithinLocation: false,
        distance: Infinity,
        taskLocation: null,
      };
    }
  }

  /**
   * Record employee arrival at task location
   */
  static async recordEmployeeArrival(
    taskId: string,
    userId: string,
    location: { lat: number; lng: number }
  ): Promise<void> {
    try {
      // Check if employee is actually within the required location
      const locationCheck = await this.checkEmployeeInTaskLocation(taskId, location);
      
      if (!locationCheck.isWithinLocation) {
        throw new Error(`You are ${Math.round(locationCheck.distance)}m away from the required location`);
      }

      // Record the location event
      await GeofencingService.recordLocationEvent({
        task_id: taskId,
        user_id: userId,
        event_type: 'arrival',
        latitude: location.lat,
        longitude: location.lng,
        geofence_id: locationCheck.taskLocation?.geofence_id,
        timestamp: new Date().toISOString(),
      });

      // Update task status if it's not started
      const { data: task } = await supabase
        .from('tasks')
        .select('status')
        .eq('id', taskId)
        .single();

      if (task?.status === 'Not Started') {
        await supabase
          .from('tasks')
          .update({ status: 'In Progress' })
          .eq('id', taskId);
      }
    } catch (error) {
      console.error('Error recording employee arrival:', error);
      throw error;
    }
  }

  /**
   * Get task locations for map display
   */
  static async getTaskLocationsForMap(): Promise<Array<{
    task_id: string;
    task_title: string;
    task_status: string;
    task_priority: string;
    latitude: number;
    longitude: number;
    radius: number;
    location_name?: string;
    assigned_to?: string;
  }>> {
    try {
      const { data, error } = await supabase
        .from('task_locations')
        .select(`
          *,
          tasks!inner(
            id,
            title,
            status,
            priority,
            assigned_to,
            users!tasks_assigned_to_fkey(full_name)
          )
        `)
        .not('required_latitude', 'is', null)
        .not('required_longitude', 'is', null);

      if (error) throw error;

      return (data || []).map((item: any) => ({
        task_id: item.task_id,
        task_title: item.tasks.title,
        task_status: item.tasks.status,
        task_priority: item.tasks.priority,
        latitude: item.required_latitude,
        longitude: item.required_longitude,
        radius: item.required_radius_meters,
        location_name: item.location_name,
        assigned_to: item.tasks.users?.full_name,
      }));
    } catch (error) {
      console.error('Error fetching task locations for map:', error);
      return [];
    }
  }

  /**
   * Helper method to get geofence by ID
   */
  private static async getGeofenceById(geofenceId: string): Promise<Geofence | null> {
    try {
      const geofences = await GeofencingService.getGeofences(false);
      return geofences.find(g => g.id === geofenceId) || null;
    } catch (error) {
      console.error('Error fetching geofence:', error);
      return null;
    }
  }

  /**
   * Delete a location-based task and its associated location data
   */
  static async deleteLocationBasedTask(taskId: string): Promise<void> {
    try {
      // Delete task locations first (foreign key constraint)
      await supabase
        .from('task_locations')
        .delete()
        .eq('task_id', taskId);

      // Delete the task
      const { error } = await supabase
        .from('tasks')
        .delete()
        .eq('id', taskId);

      if (error) throw error;
    } catch (error) {
      console.error('Error deleting location-based task:', error);
      throw error;
    }
  }

  /**
   * Get statistics for location-based tasks
   */
  static async getLocationTaskStats(): Promise<{
    total: number;
    active: number;
    completed: number;
    withGeofences: number;
    withCustomLocations: number;
  }> {
    try {
      const { data: tasks, error: tasksError } = await supabase
        .from('tasks')
        .select('id, status')
        .eq('location_based', true);

      if (tasksError) throw tasksError;

      const { data: locations, error: locationsError } = await supabase
        .from('task_locations')
        .select('geofence_id');

      if (locationsError) throw locationsError;

      const total = tasks?.length || 0;
      const active = tasks?.filter(t => t.status !== 'Completed').length || 0;
      const completed = tasks?.filter(t => t.status === 'Completed').length || 0;
      const withGeofences = locations?.filter(l => l.geofence_id).length || 0;
      const withCustomLocations = locations?.filter(l => !l.geofence_id).length || 0;

      return {
        total,
        active,
        completed,
        withGeofences,
        withCustomLocations,
      };
    } catch (error) {
      console.error('Error fetching location task stats:', error);
      return {
        total: 0,
        active: 0,
        completed: 0,
        withGeofences: 0,
        withCustomLocations: 0,
      };
    }
  }
}