import { supabase } from '../lib/supabase';

export interface GeolocationData {
  latitude: number;
  longitude: number;
  accuracy?: number;
  altitude?: number;
  heading?: number;
  speed?: number;
  timestamp: string;
  address?: string;
  battery_level?: number;
  connection_status?: 'online' | 'offline';
  movement_type?: 'walking' | 'driving' | 'stationary' | 'unknown';
}

export interface GeofenceData {
  id: string;
  name: string;
  center_latitude: number;
  center_longitude: number;
  radius_meters: number;
  is_active: boolean;
  created_at: string;
}

export interface LocationAlert {
  id: string;
  user_id: string;
  alert_type: 'geofence_enter' | 'geofence_exit' | 'speed_limit' | 'battery_low' | 'connection_lost';
  message: string;
  latitude: number;
  longitude: number;
  timestamp: string;
  is_read: boolean;
}

export class EnhancedGeolocationService {
  private static instance: EnhancedGeolocationService;
  private watchId: number | null = null;
  private isTracking = false;
  private lastKnownPosition: GeolocationData | null = null;
  private movementHistory: GeolocationData[] = [];
  private geofences: GeofenceData[] = [];
  private alerts: LocationAlert[] = [];

  private constructor() {}

  static getInstance(): EnhancedGeolocationService {
    if (!EnhancedGeolocationService.instance) {
      EnhancedGeolocationService.instance = new EnhancedGeolocationService();
    }
    return EnhancedGeolocationService.instance;
  }

  // Enhanced geolocation with better accuracy and battery optimization
  async getCurrentPosition(): Promise<GeolocationData> {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation is not supported by this browser'));
        return;
      }

      const options: PositionOptions = {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 30000 // Accept cached position up to 30 seconds old
      };

      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const geolocationData: GeolocationData = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            altitude: position.coords.altitude || undefined,
            heading: position.coords.heading || undefined,
            speed: position.coords.speed || undefined,
            timestamp: new Date().toISOString(),
            battery_level: await this.getBatteryLevel(),
            connection_status: navigator.onLine ? 'online' : 'offline',
            movement_type: await this.detectMovementType(position.coords.speed)
          };

          // Get address using reverse geocoding
          try {
            geolocationData.address = await this.reverseGeocode(
              position.coords.latitude,
              position.coords.longitude
            );
          } catch (error) {
            console.warn('Failed to get address:', error);
          }

          this.lastKnownPosition = geolocationData;
          this.movementHistory.push(geolocationData);
          
          // Keep only last 100 positions to manage memory
          if (this.movementHistory.length > 100) {
            this.movementHistory = this.movementHistory.slice(-100);
          }

          resolve(geolocationData);
        },
        (error) => {
          reject(new Error(`Geolocation error: ${error.message}`));
        },
        options
      );
    });
  }

  // Start continuous tracking with intelligent updates
  async startTracking(
    onLocationUpdate: (location: GeolocationData) => void,
    onError: (error: Error) => void,
    options: {
      interval?: number;
      enableHighAccuracy?: boolean;
      geofenceCheck?: boolean;
      batteryOptimization?: boolean;
    } = {}
  ): Promise<void> {
    if (this.isTracking) {
      console.warn('Tracking is already active');
      return;
    }

    const {
      interval = 5000,
      enableHighAccuracy = true,
      geofenceCheck = true,
      batteryOptimization = true
    } = options;

    this.isTracking = true;

    // Load geofences if geofence checking is enabled
    if (geofenceCheck) {
      await this.loadGeofences();
    }

    const trackLocation = async () => {
      try {
        const position = await this.getCurrentPosition();
        
        // Check geofences if enabled
        if (geofenceCheck && this.geofences.length > 0) {
          await this.checkGeofences(position);
        }

        // Battery optimization: reduce accuracy when battery is low
        if (batteryOptimization && position.battery_level && position.battery_level < 20) {
          console.log('Low battery detected, reducing tracking frequency');
          setTimeout(trackLocation, interval * 2); // Double the interval
          return;
        }

        onLocationUpdate(position);
        
        // Store in database
        await this.storeLocationData(position);

        // Schedule next update
        setTimeout(trackLocation, interval);
      } catch (error) {
        onError(error as Error);
        // Retry after error with exponential backoff
        setTimeout(trackLocation, interval * 2);
      }
    };

    // Start tracking
    trackLocation();
  }

  // Stop tracking
  stopTracking(): void {
    this.isTracking = false;
    if (this.watchId) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }
  }

  // Enhanced reverse geocoding with multiple providers
  async reverseGeocode(latitude: number, longitude: number): Promise<string> {
    try {
      // Try OpenStreetMap Nominatim first (free)
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&addressdetails=1&accept-language=en&zoom=18`
      );
      
      if (response.ok) {
        const data = await response.json();
        return data.display_name || 'Address not found';
      }
    } catch (error) {
      console.warn('Nominatim geocoding failed:', error);
    }

    try {
      // Fallback to Google Geocoding API (requires API key)
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=YOUR_GOOGLE_API_KEY`
      );
      
      if (response.ok) {
        const data = await response.json();
        return data.results[0]?.formatted_address || 'Address not found';
      }
    } catch (error) {
      console.warn('Google geocoding failed:', error);
    }

    return 'Address lookup failed';
  }

  // Calculate distance between two points (Haversine formula)
  calculateDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c; // Distance in meters
  }

  // Detect movement type based on speed
  private async detectMovementType(speed: number | null): Promise<'walking' | 'driving' | 'stationary' | 'unknown'> {
    if (!speed) return 'unknown';
    
    const speedKmh = speed * 3.6; // Convert m/s to km/h
    
    if (speedKmh < 1) return 'stationary';
    if (speedKmh < 8) return 'walking';
    if (speedKmh < 50) return 'driving';
    return 'unknown';
  }

  // Get battery level (if supported)
  private async getBatteryLevel(): Promise<number | undefined> {
    try {
      if ('getBattery' in navigator) {
        const battery = await (navigator as any).getBattery();
        return Math.round(battery.level * 100);
      }
    } catch (error) {
      console.warn('Battery API not supported:', error);
    }
    return undefined;
  }

  // Load geofences from database
  private async loadGeofences(): Promise<void> {
    try {
      const { data, error } = await supabase
        .from('geofences')
        .select('*')
        .eq('is_active', true);

      if (error) throw error;
      this.geofences = data || [];
    } catch (error) {
      console.error('Failed to load geofences:', error);
    }
  }

  // Check if position is within any geofence
  private async checkGeofences(position: GeolocationData): Promise<void> {
    for (const geofence of this.geofences) {
      const distance = this.calculateDistance(
        position.latitude,
        position.longitude,
        geofence.center_latitude,
        geofence.center_longitude
      );

      const isInside = distance <= geofence.radius_meters;
      const wasInside = this.movementHistory.length > 1 && 
        this.calculateDistance(
          this.movementHistory[this.movementHistory.length - 2].latitude,
          this.movementHistory[this.movementHistory.length - 2].longitude,
          geofence.center_latitude,
          geofence.center_longitude
        ) <= geofence.radius_meters;

      // Trigger alerts for geofence events
      if (isInside && !wasInside) {
        await this.createAlert({
          alert_type: 'geofence_enter',
          message: `Entered geofence: ${geofence.name}`,
          latitude: position.latitude,
          longitude: position.longitude,
          timestamp: position.timestamp
        });
      } else if (!isInside && wasInside) {
        await this.createAlert({
          alert_type: 'geofence_exit',
          message: `Exited geofence: ${geofence.name}`,
          latitude: position.latitude,
          longitude: position.longitude,
          timestamp: position.timestamp
        });
      }
    }
  }

  // Create location alert
  private async createAlert(alertData: Omit<LocationAlert, 'id' | 'user_id' | 'is_read'>): Promise<void> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from('location_alerts')
        .insert([{
          ...alertData,
          user_id: user.id,
          is_read: false
        }]);

      if (error) throw error;
    } catch (error) {
      console.error('Failed to create alert:', error);
    }
  }

  // Store location data in database
  private async storeLocationData(location: GeolocationData): Promise<void> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from('employee_locations')
        .insert([{
          user_id: user.id,
          latitude: location.latitude,
          longitude: location.longitude,
          accuracy: location.accuracy,
          altitude: location.altitude,
          heading: location.heading,
          speed: location.speed,
          battery_level: location.battery_level,
          connection_status: location.connection_status,
          movement_type: location.movement_type,
          address: location.address,
          recorded_at: location.timestamp
        }]);

      if (error) throw error;
    } catch (error) {
      console.error('Failed to store location data:', error);
    }
  }

  // Get movement history
  getMovementHistory(): GeolocationData[] {
    return [...this.movementHistory];
  }

  // Get last known position
  getLastKnownPosition(): GeolocationData | null {
    return this.lastKnownPosition;
  }

  // Check if tracking is active
  isCurrentlyTracking(): boolean {
    return this.isTracking;
  }

  // Get geofences
  getGeofences(): GeofenceData[] {
    return [...this.geofences];
  }

  // Calculate total distance traveled
  calculateTotalDistance(): number {
    if (this.movementHistory.length < 2) return 0;

    let totalDistance = 0;
    for (let i = 1; i < this.movementHistory.length; i++) {
      const prev = this.movementHistory[i - 1];
      const curr = this.movementHistory[i];
      totalDistance += this.calculateDistance(
        prev.latitude,
        prev.longitude,
        curr.latitude,
        curr.longitude
      );
    }

    return totalDistance;
  }

  // Get average speed
  getAverageSpeed(): number {
    if (this.movementHistory.length < 2) return 0;

    const speeds = this.movementHistory
      .map(loc => loc.speed)
      .filter(speed => speed !== null && speed !== undefined) as number[];

    if (speeds.length === 0) return 0;

    const totalSpeed = speeds.reduce((sum, speed) => sum + speed, 0);
    return totalSpeed / speeds.length;
  }

  // Get movement statistics
  getMovementStats(): {
    totalDistance: number;
    averageSpeed: number;
    totalTime: number;
    activeTime: number;
    idleTime: number;
  } {
    const totalDistance = this.calculateTotalDistance();
    const averageSpeed = this.getAverageSpeed();
    
    if (this.movementHistory.length < 2) {
      return {
        totalDistance: 0,
        averageSpeed: 0,
        totalTime: 0,
        activeTime: 0,
        idleTime: 0
      };
    }

    const firstTime = new Date(this.movementHistory[0].timestamp).getTime();
    const lastTime = new Date(this.movementHistory[this.movementHistory.length - 1].timestamp).getTime();
    const totalTime = (lastTime - firstTime) / 1000; // seconds

    let activeTime = 0;
    let idleTime = 0;

    for (let i = 1; i < this.movementHistory.length; i++) {
      const prev = this.movementHistory[i - 1];
      const curr = this.movementHistory[i];
      const timeDiff = (new Date(curr.timestamp).getTime() - new Date(prev.timestamp).getTime()) / 1000;
      
      const distance = this.calculateDistance(
        prev.latitude,
        prev.longitude,
        curr.latitude,
        curr.longitude
      );

      if (distance > 10) { // Moving threshold: 10 meters
        activeTime += timeDiff;
      } else {
        idleTime += timeDiff;
      }
    }

    return {
      totalDistance: totalDistance / 1000, // Convert to km
      averageSpeed: averageSpeed * 3.6, // Convert m/s to km/h
      totalTime: totalTime / 60, // Convert to minutes
      activeTime: activeTime / 60, // Convert to minutes
      idleTime: idleTime / 60 // Convert to minutes
    };
  }
}
