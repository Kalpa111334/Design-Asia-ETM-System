import { supabase } from '../lib/supabase';

// Add battery interface at the top
interface Battery {
  level: number;
  addEventListener: (type: string, listener: () => void) => void;
  removeEventListener: (type: string, listener: () => void) => void;
}

interface NavigatorWithBattery extends Navigator {
  getBattery?: () => Promise<Battery>;
}

export interface LocationData {
  latitude: number;
  longitude: number;
  accuracy?: number;
  timestamp: string;
  battery_level?: number;
  connection_status?: 'online' | 'offline';
  task_id?: string;
  speed?: number;
  heading?: number;
  altitude?: number;
  address?: string;
  movement_type?: 'walking' | 'driving' | 'stationary' | 'unknown';
}

export interface MovementHistory {
  id: string;
  latitude: number;
  longitude: number;
  recorded_at: string;
  speed?: number;
  heading?: number;
  movement_type?: string;
  address?: string;
}

export interface MovementStats {
  total_distance_km: number;
  average_speed_kmh: number;
  max_speed_kmh: number;
  active_time_minutes: number;
  idle_time_minutes: number;
  movement_points: number;
}

export interface NavigationData {
  user_id: string;
  full_name: string;
  current_lat: number;
  current_lng: number;
  current_speed?: number;
  current_heading?: number;
  movement_type?: string;
  last_update: string;
  battery_level?: number;
  connection_status: string;
  task_title?: string;
  estimated_arrival?: string;
}

export class LocationService {
  private static trackingInterval: NodeJS.Timeout | null = null;
  private static geolocationWatchId: number | null = null;
  private static lastLocation: { latitude: number; longitude: number } | null = null;
  private static minimumDistanceThreshold = 5; // meters (tighter for better accuracy)
  private static minimumUpdateIntervalMs = 3000; // throttle network writes
  private static lastUpdateAt: number = 0;
  private static backgroundPingMsVisible = 15000; // 15s while app is foreground
  private static backgroundPingMsHidden = 60000; // 60s when tab/app backgrounded
  private static visibilityHandler: (() => void) | null = null;
  private static batteryManager: Battery | null = null;

  static async getEmployeeLocations() {
    try {
      console.log('Calling get_latest_employee_locations function...');
      const { data, error } = await supabase
        .rpc('get_latest_employee_locations');

      if (error) {
        console.error('Supabase RPC error:', error);
        throw error;
      }
      
      console.log('RPC returned data:', data);
      return data || [];
    } catch (error) {
      console.error('Error fetching employee locations:', error);
      throw error;
    }
  }

  private static async updateLocation(userId: string, position: GeolocationPosition) {
    try {
      const now = Date.now();
      if (now - this.lastUpdateAt < this.minimumUpdateIntervalMs) {
        return; // throttle overly frequent updates
      }
      
      // Get battery information if available
      let batteryLevel = null;
      if ((navigator as NavigatorWithBattery).getBattery) {
        const battery = await (navigator as NavigatorWithBattery).getBattery?.();
        if (battery) {
          batteryLevel = Math.round(battery.level * 100);
        }
      }

      // Check if we should update based on distance threshold
      if (this.lastLocation) {
        const distance = this.calculateDistance(
          this.lastLocation.latitude,
          this.lastLocation.longitude,
          position.coords.latitude,
          position.coords.longitude
        );
        
        if (distance < this.minimumDistanceThreshold) {
          return; // Skip update if movement is below threshold
        }
      }

      // Get address using reverse geocoding
      let address = null;
      try {
        address = await this.getAddressFromCoordinates(
          position.coords.latitude, 
          position.coords.longitude
        );
      } catch (error) {
        console.warn('Failed to get address:', error);
      }

      // Calculate speed in km/h if available
      const speedKmh = typeof position.coords.speed === 'number' 
        ? Math.max(0, position.coords.speed * 3.6) // Convert m/s to km/h
        : null;

      const { error } = await supabase
        .from('employee_locations')
        .insert({
          user_id: userId,
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          timestamp: new Date().toISOString(),
          battery_level: batteryLevel,
          connection_status: navigator.onLine ? 'online' : 'offline',
          location_accuracy: position.coords.accuracy,
          speed: speedKmh,
          heading: typeof position.coords.heading === 'number' ? position.coords.heading : null,
          altitude: typeof position.coords.altitude === 'number' ? position.coords.altitude : null,
          address: address,
        });

      if (error) throw error;

      this.lastLocation = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      };
      this.lastUpdateAt = now;
    } catch (error) {
      console.error('Error updating location:', error);
      throw error;
    }
  }

  private static calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c;
  }

  static startTracking(userId: string) {
    if (!navigator.geolocation) {
      throw new Error('Geolocation is not supported by this browser');
    }

    // Set up online/offline status monitoring
    window.addEventListener('online', () => this.handleConnectivityChange(userId, true));
    window.addEventListener('offline', () => this.handleConnectivityChange(userId, false));

    // Set up battery monitoring if available
    if ((navigator as NavigatorWithBattery).getBattery) {
      (navigator as NavigatorWithBattery).getBattery?.().then(battery => {
        if (battery) {
          this.batteryManager = battery;
          battery.addEventListener('levelchange', () => this.handleBatteryChange(userId));
        }
      });
    }

    // Start location tracking
    // Request high-accuracy, frequent updates. maximumAge small ensures fresh fixes.
    const watchId = navigator.geolocation.watchPosition(
      (position) => this.updateLocation(userId, position),
      (error) => {
        console.error('Error getting location:', error);
        throw error;
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 2000,
      }
    );

    // Store watch ID for cleanup
    this.geolocationWatchId = watchId;

    // Start resilient background pings as a safety net in case browsers pause watchPosition
    this.startBackgroundPings(userId);
    return watchId;
  }

  static stopTracking() {
    if (this.trackingInterval) {
      clearInterval(this.trackingInterval);
      this.trackingInterval = null;
    }

    // Remove event listeners
    window.removeEventListener('online', () => {});
    window.removeEventListener('offline', () => {});

    if (this.batteryManager) {
      this.batteryManager.removeEventListener('levelchange', () => {});
      this.batteryManager = null;
    }

    if (this.geolocationWatchId !== null && navigator.geolocation) {
      navigator.geolocation.clearWatch(this.geolocationWatchId);
      this.geolocationWatchId = null;
    }

    if (this.visibilityHandler) {
      document.removeEventListener('visibilitychange', this.visibilityHandler);
      this.visibilityHandler = null;
    }

    this.lastLocation = null;
  }

  // Background ping scheduler – triggers periodic getCurrentPosition calls even if watchPosition stalls
  private static startBackgroundPings(userId: string) {
    const schedule = () => {
      const interval = document.visibilityState === 'visible'
        ? this.backgroundPingMsVisible
        : this.backgroundPingMsHidden;

      if (this.trackingInterval) {
        clearInterval(this.trackingInterval);
      }

      this.trackingInterval = setInterval(() => {
        try {
          navigator.geolocation.getCurrentPosition(
            (position) => this.updateLocation(userId, position),
            (error) => {
              console.warn('Background ping location error:', error?.message || error);
            },
            {
              enableHighAccuracy: true,
              timeout: 15000,
              maximumAge: 2000,
            }
          );
        } catch (e) {
          console.warn('Background ping failed:', e);
        }
      }, interval);
    };

    // Set up visibility listener to adapt interval when app moves foreground/background
    this.visibilityHandler = () => schedule();
    document.addEventListener('visibilitychange', this.visibilityHandler);

    // Kick off now
    schedule();
  }

  private static async handleConnectivityChange(userId: string, isOnline: boolean) {
    try {
      const { error } = await supabase
        .from('employee_locations')
        .update({ connection_status: isOnline ? 'online' : 'offline' })
        .eq('user_id', userId)
        .order('timestamp', { ascending: false })
        .limit(1);

      if (error) throw error;
    } catch (error) {
      console.error('Error updating connectivity status:', error);
    }
  }

  private static async handleBatteryChange(userId: string) {
    if (!this.batteryManager) return;

    try {
      const { error } = await supabase
        .from('employee_locations')
        .update({ battery_level: Math.round(this.batteryManager.level * 100) })
        .eq('user_id', userId)
        .order('timestamp', { ascending: false })
        .limit(1);

      if (error) throw error;
    } catch (error) {
      console.error('Error updating battery level:', error);
    }
  }

  static async getBatteryLevel(): Promise<number | null> {
    try {
      if ((navigator as NavigatorWithBattery).getBattery) {
        const battery = await (navigator as NavigatorWithBattery).getBattery?.();
        return battery ? Math.round(battery.level * 100) : null;
      }
      return null;
    } catch (error) {
      console.error('Error getting battery level:', error);
      return null;
    }
  }

  static async saveLocation(userId: string, location: { latitude: number; longitude: number }): Promise<void> {
    try {
      const batteryLevel = await this.getBatteryLevel();
      await supabase
        .from('employee_locations')
        .insert({
          user_id: userId,
          latitude: location.latitude,
          longitude: location.longitude,
          timestamp: new Date().toISOString(),
          battery_level: batteryLevel,
          connection_status: navigator.onLine ? 'online' : 'offline',
        });
    } catch (error) {
      console.error('Error saving location:', error);
      throw error;
    }
  }

  // Enhanced navigation methods
  static async getEmployeeMovementHistory(userId: string, hours: number = 8): Promise<MovementHistory[]> {
    try {
      const { data, error } = await supabase
        .rpc('get_employee_movement_history', {
          p_user_id: userId,
          p_hours: hours
        });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching movement history:', error);
      throw error;
    }
  }

  static async getMovementStats(userId: string, hours: number = 8): Promise<MovementStats | null> {
    try {
      const { data, error } = await supabase
        .rpc('calculate_movement_stats', {
          p_user_id: userId,
          p_hours: hours
        });

      if (error) throw error;
      return data?.[0] || null;
    } catch (error) {
      console.error('Error fetching movement stats:', error);
      throw error;
    }
  }

  static async getRealtimeNavigationData(): Promise<NavigationData[]> {
    try {
      const { data, error } = await supabase
        .rpc('get_realtime_navigation_data');

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching realtime navigation data:', error);
      throw error;
    }
  }

  // Helper method for reverse geocoding
  private static async getAddressFromCoordinates(lat: number, lng: number): Promise<string | null> {
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&addressdetails=1&accept-language=en`
      );
      const data = await response.json();
      return data.display_name || null;
    } catch (error) {
      console.error('Reverse geocoding error:', error);
      return null;
    }
  }

  // Method to get navigation route between two points
  static async getNavigationRoute(
    startLat: number, 
    startLng: number, 
    endLat: number, 
    endLng: number
  ): Promise<Array<{ lat: number; lng: number }> | null> {
    try {
      // Using OpenRouteService for routing (free tier available)
      const response = await fetch(
        `https://api.openrouteservice.org/v2/directions/driving-car?api_key=YOUR_API_KEY&start=${startLng},${startLat}&end=${endLng},${endLat}`
      );
      
      if (!response.ok) {
        throw new Error('Routing service unavailable');
      }
      
      const data = await response.json();
      
      if (data.features && data.features[0] && data.features[0].geometry) {
        return data.features[0].geometry.coordinates.map((coord: [number, number]) => ({
          lng: coord[0],
          lat: coord[1]
        }));
      }
      
      return null;
    } catch (error) {
      console.error('Error getting navigation route:', error);
      return null;
    }
  }

  // Method to calculate estimated time of arrival
  static calculateETA(
    currentLat: number,
    currentLng: number,
    destinationLat: number,
    destinationLng: number,
    currentSpeed: number
  ): number | null {
    if (!currentSpeed || currentSpeed <= 0) return null;
    
    const distance = this.calculateDistance(currentLat, currentLng, destinationLat, destinationLng);
    const timeInHours = distance / (currentSpeed * 1000); // Convert km/h to m/h
    return timeInHours * 60; // Return in minutes
  }
}