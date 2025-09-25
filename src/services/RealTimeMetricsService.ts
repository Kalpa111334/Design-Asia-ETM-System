import { supabase } from '../lib/supabase';

export interface EmployeeMetrics {
  distance: number; // km
  averageSpeed: number; // km/h
  activeTime: number; // minutes
  idleTime: number; // minutes
  gpsPoints: number; // count of location updates
  lastLocationTime?: string;
}

export interface MetricsSubscriptionCallback {
  onMetricsUpdate: (metrics: EmployeeMetrics) => void;
  onError?: (error: Error) => void;
}

export class RealTimeMetricsService {
  private static subscriptions: Map<string, any> = new Map();
  private static metricsCache: Map<string, EmployeeMetrics> = new Map();

  /**
   * Calculate distance between two coordinates using Haversine formula
   */
  private static calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371000; // Earth's radius in meters
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  /**
   * Calculate metrics for an employee based on their location history
   */
  static async calculateEmployeeMetrics(userId: string, timeframe: 'today' | 'hour' = 'today'): Promise<EmployeeMetrics> {
    try {
      const now = new Date();
      let startTime: Date;

      if (timeframe === 'today') {
        startTime = new Date(now);
        startTime.setHours(0, 0, 0, 0);
      } else {
        startTime = new Date(now.getTime() - 60 * 60 * 1000); // 1 hour ago
      }

      const { data: locations, error } = await supabase
        .from('employee_locations')
        .select('*')
        .eq('user_id', userId)
        .gte('timestamp', startTime.toISOString())
        .order('timestamp', { ascending: true });

      if (error) throw error;

      if (!locations || locations.length < 2) {
        return {
          distance: 0,
          averageSpeed: 0,
          activeTime: 0,
          idleTime: 0,
          gpsPoints: locations?.length || 0,
          lastLocationTime: locations?.[0]?.timestamp
        };
      }

      let totalDistance = 0;
      let activeTimeMs = 0;
      let idleTimeMs = 0;
      const speeds: number[] = [];

      // Process consecutive location points
      for (let i = 1; i < locations.length; i++) {
        const prev = locations[i - 1];
        const curr = locations[i];
        
        const distance = this.calculateDistance(
          prev.latitude,
          prev.longitude,
          curr.latitude,
          curr.longitude
        );
        
        const timeMs = new Date(curr.timestamp).getTime() - new Date(prev.timestamp).getTime();
        totalDistance += distance;

        // Movement threshold: 10 meters
        if (distance > 10 && timeMs > 0) {
          activeTimeMs += timeMs;
          const speedKmh = (distance / 1000) / (timeMs / 3600000);
          
          // Filter unrealistic speeds (0-200 km/h)
          if (speedKmh > 0 && speedKmh < 200) {
            speeds.push(speedKmh);
          }
        } else {
          idleTimeMs += timeMs;
        }
      }

      const averageSpeed = speeds.length > 0 
        ? speeds.reduce((a, b) => a + b, 0) / speeds.length 
        : 0;

      const metrics: EmployeeMetrics = {
        distance: Math.round(totalDistance / 1000 * 100) / 100, // km with 2 decimal places
        averageSpeed: Math.round(averageSpeed * 10) / 10, // km/h with 1 decimal place
        activeTime: Math.round(activeTimeMs / 60000), // minutes
        idleTime: Math.round(idleTimeMs / 60000), // minutes
        gpsPoints: locations.length,
        lastLocationTime: locations[locations.length - 1]?.timestamp
      };

      // Cache the metrics
      this.metricsCache.set(userId, metrics);
      
      return metrics;

    } catch (error) {
      console.error('Error calculating employee metrics:', error);
      return {
        distance: 0,
        averageSpeed: 0,
        activeTime: 0,
        idleTime: 0,
        gpsPoints: 0
      };
    }
  }

  /**
   * Subscribe to real-time metrics updates for an employee
   */
  static subscribeToEmployeeMetrics(
    userId: string,
    callback: MetricsSubscriptionCallback,
    options: { updateInterval?: number; timeframe?: 'today' | 'hour' } = {}
  ): string {
    const subscriptionId = `metrics_${userId}_${Date.now()}`;
    const { updateInterval = 5000, timeframe = 'today' } = options;

    // Initial metrics calculation
    this.calculateEmployeeMetrics(userId, timeframe).then(metrics => {
      callback.onMetricsUpdate(metrics);
    }).catch(error => {
      callback.onError?.(error);
    });

    // Set up real-time location subscription
    const locationSubscription = supabase
      .channel(`employee_metrics_${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'employee_locations',
          filter: `user_id=eq.${userId}`,
        },
        async (payload) => {
          try {
            // Recalculate metrics when new location is received
            const metrics = await this.calculateEmployeeMetrics(userId, timeframe);
            callback.onMetricsUpdate(metrics);
          } catch (error) {
            callback.onError?.(error as Error);
          }
        }
      )
      .subscribe();

    // Set up periodic updates (for cases where location updates are infrequent)
    const intervalId = setInterval(async () => {
      try {
        const metrics = await this.calculateEmployeeMetrics(userId, timeframe);
        const cached = this.metricsCache.get(userId);
        
        // Only update if metrics have changed
        if (!cached || JSON.stringify(cached) !== JSON.stringify(metrics)) {
          callback.onMetricsUpdate(metrics);
        }
      } catch (error) {
        callback.onError?.(error as Error);
      }
    }, updateInterval);

    // Store subscription details
    this.subscriptions.set(subscriptionId, {
      locationSubscription,
      intervalId,
      userId
    });

    return subscriptionId;
  }

  /**
   * Unsubscribe from metrics updates
   */
  static unsubscribe(subscriptionId: string): void {
    const subscription = this.subscriptions.get(subscriptionId);
    if (subscription) {
      // Unsubscribe from real-time updates
      subscription.locationSubscription?.unsubscribe();
      
      // Clear interval
      if (subscription.intervalId) {
        clearInterval(subscription.intervalId);
      }

      // Remove from cache
      this.metricsCache.delete(subscription.userId);
      this.subscriptions.delete(subscriptionId);
    }
  }

  /**
   * Get cached metrics for an employee (if available)
   */
  static getCachedMetrics(userId: string): EmployeeMetrics | null {
    return this.metricsCache.get(userId) || null;
  }

  /**
   * Clear all subscriptions and cache
   */
  static cleanup(): void {
    this.subscriptions.forEach((_, subscriptionId) => {
      this.unsubscribe(subscriptionId);
    });
    this.subscriptions.clear();
    this.metricsCache.clear();
  }

  /**
   * Get metrics for multiple employees at once
   */
  static async getMultipleEmployeeMetrics(
    userIds: string[], 
    timeframe: 'today' | 'hour' = 'today'
  ): Promise<Record<string, EmployeeMetrics>> {
    const results: Record<string, EmployeeMetrics> = {};
    
    await Promise.all(
      userIds.map(async (userId) => {
        results[userId] = await this.calculateEmployeeMetrics(userId, timeframe);
      })
    );

    return results;
  }
}
