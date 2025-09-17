import { supabase } from '../lib/supabase';
import { LocationTaskService } from './LocationTaskService';
import { GeofencingService } from './GeofencingService';

export interface RealTimeLocationUpdate {
  user_id: string;
  latitude: number;
  longitude: number;
  accuracy?: number;
  timestamp: string;
  task_id?: string;
  battery_level?: number;
  speed?: number;
  heading?: number;
}

export interface LocationSubscriptionCallback {
  onLocationUpdate: (update: RealTimeLocationUpdate) => void;
  onTaskLocationEvent: (event: any) => void;
  onGeofenceEvent: (event: any) => void;
}

export class RealTimeLocationService {
  private static subscriptions: Map<string, any> = new Map();
  private static watchId: number | null = null;
  private static lastLocation: { lat: number; lng: number } | null = null;
  private static locationUpdateInterval: NodeJS.Timeout | null = null;

  /**
   * Start real-time location tracking for the current user
   */
  static startLocationTracking(userId: string, options?: {
    enableHighAccuracy?: boolean;
    timeout?: number;
    maximumAge?: number;
    updateInterval?: number;
  }): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation is not supported by this browser'));
        return;
      }

      const defaultOptions = {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 60000,
        updateInterval: 30000, // Update every 30 seconds
        ...options,
      };

      // Stop any existing tracking
      this.stopLocationTracking();

      this.watchId = navigator.geolocation.watchPosition(
        async (position) => {
          const locationUpdate: RealTimeLocationUpdate = {
            user_id: userId,
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            timestamp: new Date().toISOString(),
            speed: position.coords.speed || undefined,
            heading: position.coords.heading || undefined,
          };

          // Get battery level if available
          if ('getBattery' in navigator) {
            try {
              const battery = await (navigator as any).getBattery();
              locationUpdate.battery_level = Math.round(battery.level * 100);
            } catch (error) {
              // Battery API not available
            }
          }

          // Store the latest location
          this.lastLocation = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          };

          // Update location in database periodically
          this.updateLocationInDatabase(locationUpdate);

          // Check for geofence events
          this.checkGeofenceEvents(userId, locationUpdate);

          resolve();
        },
        (error) => {
          console.error('Location tracking error:', error);
          reject(error);
        },
        {
          enableHighAccuracy: defaultOptions.enableHighAccuracy,
          timeout: defaultOptions.timeout,
          maximumAge: defaultOptions.maximumAge,
        }
      );

      // Set up periodic updates
      this.locationUpdateInterval = setInterval(() => {
        if (this.lastLocation) {
          navigator.geolocation.getCurrentPosition(
            async (position) => {
              const locationUpdate: RealTimeLocationUpdate = {
                user_id: userId,
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
                accuracy: position.coords.accuracy,
                timestamp: new Date().toISOString(),
                speed: position.coords.speed || undefined,
                heading: position.coords.heading || undefined,
              };

              this.updateLocationInDatabase(locationUpdate);
            },
            (error) => {
              console.log('Periodic location update failed:', error);
            },
            { enableHighAccuracy: false, timeout: 10000, maximumAge: 30000 }
          );
        }
      }, defaultOptions.updateInterval);
    });
  }

  /**
   * Stop location tracking
   */
  static stopLocationTracking(): void {
    if (this.watchId !== null) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }

    if (this.locationUpdateInterval) {
      clearInterval(this.locationUpdateInterval);
      this.locationUpdateInterval = null;
    }

    this.lastLocation = null;
  }

  /**
   * Get the current location once
   */
  static getCurrentLocation(options?: {
    enableHighAccuracy?: boolean;
    timeout?: number;
    maximumAge?: number;
  }): Promise<{ lat: number; lng: number; accuracy?: number }> {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation is not supported by this browser'));
        return;
      }

      const defaultOptions = {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000,
        ...options,
      };

      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            accuracy: position.coords.accuracy,
          });
        },
        (error) => {
          reject(error);
        },
        defaultOptions
      );
    });
  }

  /**
   * Subscribe to real-time location updates
   */
  static subscribeToLocationUpdates(
    userId: string,
    callback: LocationSubscriptionCallback
  ): string {
    const subscriptionId = `location_${userId}_${Date.now()}`;

    // Subscribe to location updates
    const locationSubscription = supabase
      .channel('location_updates')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'employee_locations',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          if (payload.new) {
            callback.onLocationUpdate({
              user_id: payload.new.user_id,
              latitude: payload.new.latitude,
              longitude: payload.new.longitude,
              accuracy: payload.new.location_accuracy,
              timestamp: payload.new.timestamp,
              task_id: payload.new.task_id,
              battery_level: payload.new.battery_level,
            });
          }
        }
      )
      .subscribe();

    // Subscribe to task location events
    const taskLocationSubscription = supabase
      .channel('task_location_events')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'task_location_events',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          if (payload.new) {
            callback.onTaskLocationEvent(payload.new);
          }
        }
      )
      .subscribe();

    // Subscribe to geofence events
    const geofenceSubscription = supabase
      .channel('geofence_events')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'location_alerts',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          if (payload.new) {
            callback.onGeofenceEvent(payload.new);
          }
        }
      )
      .subscribe();

    // Store subscriptions
    this.subscriptions.set(subscriptionId, {
      locationSubscription,
      taskLocationSubscription,
      geofenceSubscription,
    });

    return subscriptionId;
  }

  /**
   * Unsubscribe from location updates
   */
  static unsubscribeFromLocationUpdates(subscriptionId: string): void {
    const subscriptions = this.subscriptions.get(subscriptionId);
    if (subscriptions) {
      subscriptions.locationSubscription.unsubscribe();
      subscriptions.taskLocationSubscription.unsubscribe();
      subscriptions.geofenceSubscription.unsubscribe();
      this.subscriptions.delete(subscriptionId);
    }
  }

  /**
   * Check if user is within any task locations
   */
  static async checkTaskLocationProximity(
    userId: string,
    location: { lat: number; lng: number }
  ): Promise<Array<{
    taskId: string;
    taskTitle: string;
    distance: number;
    isWithinLocation: boolean;
  }>> {
    try {
      // Get all active tasks for the user
      const tasks = await LocationTaskService.getLocationBasedTasks({
        assigned_to: userId,
        status: 'In Progress',
      });

      const results = [];
      for (const task of tasks) {
        if (task.task_locations?.[0]) {
          const locationCheck = await LocationTaskService.checkEmployeeInTaskLocation(
            task.id,
            location
          );

          results.push({
            taskId: task.id,
            taskTitle: task.title,
            distance: locationCheck.distance,
            isWithinLocation: locationCheck.isWithinLocation,
          });
        }
      }

      return results;
    } catch (error) {
      console.error('Error checking task location proximity:', error);
      return [];
    }
  }

  /**
   * Update location in database
   */
  private static async updateLocationInDatabase(
    locationUpdate: RealTimeLocationUpdate
  ): Promise<void> {
    try {
      const { error } = await supabase
        .from('employee_locations')
        .upsert(
          {
            user_id: locationUpdate.user_id,
            latitude: locationUpdate.latitude,
            longitude: locationUpdate.longitude,
            timestamp: locationUpdate.timestamp,
            location_accuracy: locationUpdate.accuracy,
            battery_level: locationUpdate.battery_level,
            connection_status: 'online',
            task_id: locationUpdate.task_id,
          },
          {
            onConflict: 'user_id',
          }
        );

      if (error) {
        console.error('Error updating location in database:', error);
      }
    } catch (error) {
      console.error('Error updating location:', error);
    }
  }

  /**
   * Check for geofence events
   */
  private static async checkGeofenceEvents(
    userId: string,
    locationUpdate: RealTimeLocationUpdate
  ): Promise<void> {
    try {
      // Get all active geofences
      const geofences = await GeofencingService.getGeofences(true);

      for (const geofence of geofences) {
        const isWithin = GeofencingService.isWithinGeofence(
          locationUpdate.latitude,
          locationUpdate.longitude,
          geofence
        );

        // Check if this is a new entry or exit event
        // This would require storing previous states, which we'll skip for now
        // In a full implementation, you'd track entry/exit events
      }
    } catch (error) {
      console.error('Error checking geofence events:', error);
    }
  }

  /**
   * Calculate distance between two points
   */
  static calculateDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number {
    return GeofencingService.calculateDistance(lat1, lon1, lat2, lon2);
  }

  /**
   * Format distance for display
   */
  static formatDistance(meters: number): string {
    if (meters < 1000) {
      return `${Math.round(meters)}m`;
    } else {
      return `${(meters / 1000).toFixed(1)}km`;
    }
  }

  /**
   * Get location permission status
   */
  static async getLocationPermissionStatus(): Promise<'granted' | 'denied' | 'prompt' | 'unsupported'> {
    if (!navigator.permissions) {
      return 'unsupported';
    }

    try {
      const result = await navigator.permissions.query({ name: 'geolocation' as PermissionName });
      return result.state as 'granted' | 'denied' | 'prompt';
    } catch (error) {
      return 'unsupported';
    }
  }

  /**
   * Request location permission
   */
  static async requestLocationPermission(): Promise<boolean> {
    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: false,
          timeout: 5000,
          maximumAge: 60000,
        });
      });
      return true;
    } catch (error) {
      return false;
    }
  }
}