import { useState, useEffect, useRef, useCallback } from 'react';
import { RealTimeMetricsService, EmployeeMetrics } from '../services/RealTimeMetricsService';

interface UseRealTimeMetricsOptions {
  updateInterval?: number;
  timeframe?: 'today' | 'hour';
  enabled?: boolean;
}

interface UseRealTimeMetricsReturn {
  metrics: EmployeeMetrics;
  isLive: boolean;
  lastUpdate: Date | null;
  error: Error | null;
  refresh: () => Promise<void>;
}

/**
 * Custom hook for managing real-time employee metrics
 */
export function useRealTimeMetrics(
  employeeId: string | null,
  options: UseRealTimeMetricsOptions = {}
): UseRealTimeMetricsReturn {
  const {
    updateInterval = 3000,
    timeframe = 'today',
    enabled = true
  } = options;

  const [metrics, setMetrics] = useState<EmployeeMetrics>({
    distance: 0,
    averageSpeed: 0,
    activeTime: 0,
    idleTime: 0,
    gpsPoints: 0
  });

  const [isLive, setIsLive] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const subscriptionRef = useRef<string | null>(null);

  // Manual refresh function
  const refresh = useCallback(async () => {
    if (!employeeId || !enabled) return;

    try {
      setError(null);
      const newMetrics = await RealTimeMetricsService.calculateEmployeeMetrics(employeeId, timeframe);
      setMetrics(newMetrics);
      setLastUpdate(new Date());
    } catch (err) {
      setError(err as Error);
    }
  }, [employeeId, enabled, timeframe]);

  // Set up subscription
  useEffect(() => {
    // Clean up previous subscription
    if (subscriptionRef.current) {
      RealTimeMetricsService.unsubscribe(subscriptionRef.current);
      subscriptionRef.current = null;
    }

    if (!employeeId || !enabled) {
      setMetrics({
        distance: 0,
        averageSpeed: 0,
        activeTime: 0,
        idleTime: 0,
        gpsPoints: 0
      });
      setIsLive(false);
      setLastUpdate(null);
      setError(null);
      return;
    }

    setIsLive(true);
    setError(null);

    // Subscribe to real-time updates
    const subscriptionId = RealTimeMetricsService.subscribeToEmployeeMetrics(
      employeeId,
      {
        onMetricsUpdate: (newMetrics) => {
          setMetrics(newMetrics);
          setLastUpdate(new Date());
          setError(null);
        },
        onError: (err) => {
          setError(err);
          setIsLive(false);
        }
      },
      {
        updateInterval,
        timeframe
      }
    );

    subscriptionRef.current = subscriptionId;

    return () => {
      if (subscriptionId) {
        RealTimeMetricsService.unsubscribe(subscriptionId);
      }
      setIsLive(false);
    };
  }, [employeeId, enabled, updateInterval, timeframe]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (subscriptionRef.current) {
        RealTimeMetricsService.unsubscribe(subscriptionRef.current);
      }
    };
  }, []);

  return {
    metrics,
    isLive,
    lastUpdate,
    error,
    refresh
  };
}
