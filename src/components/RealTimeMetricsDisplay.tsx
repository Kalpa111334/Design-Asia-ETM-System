import React, { useState, useEffect, useCallback } from 'react';
import { RealTimeMetricsService, EmployeeMetrics } from '../services/RealTimeMetricsService';

interface RealTimeMetricsDisplayProps {
  selectedEmployeeId: string | null;
  onMetricsUpdate?: (metrics: EmployeeMetrics) => void;
}

export default function RealTimeMetricsDisplay({ 
  selectedEmployeeId, 
  onMetricsUpdate 
}: RealTimeMetricsDisplayProps) {
  const [metrics, setMetrics] = useState<EmployeeMetrics>({
    distance: 0,
    averageSpeed: 0,
    activeTime: 0,
    idleTime: 0,
    gpsPoints: 0
  });

  const [isLive, setIsLive] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  const [subscriptionId, setSubscriptionId] = useState<string | null>(null);

  // Set up real-time subscription for selected employee
  useEffect(() => {
    // Clean up previous subscription
    if (subscriptionId) {
      RealTimeMetricsService.unsubscribe(subscriptionId);
      setSubscriptionId(null);
    }

    if (!selectedEmployeeId) {
      setMetrics({
        distance: 0,
        averageSpeed: 0,
        activeTime: 0,
        idleTime: 0,
        gpsPoints: 0
      });
      setIsLive(false);
      return;
    }

    setIsLive(true);

    // Subscribe to real-time metrics updates
    const newSubscriptionId = RealTimeMetricsService.subscribeToEmployeeMetrics(
      selectedEmployeeId,
      {
        onMetricsUpdate: (newMetrics) => {
          setMetrics(newMetrics);
          setLastUpdate(new Date());
          onMetricsUpdate?.(newMetrics);
        },
        onError: (error) => {
          console.error('Metrics subscription error:', error);
          setIsLive(false);
        }
      },
      {
        updateInterval: 3000, // Update every 3 seconds
        timeframe: 'today'
      }
    );

    setSubscriptionId(newSubscriptionId);

    return () => {
      if (newSubscriptionId) {
        RealTimeMetricsService.unsubscribe(newSubscriptionId);
      }
      setIsLive(false);
    };
  }, [selectedEmployeeId, onMetricsUpdate]);

  return (
    <div className="bg-white rounded-lg shadow-lg p-4 mb-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-800">Real-Time Metrics</h3>
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${isLive ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`}></div>
          <span className="text-sm text-gray-600">
            {isLive ? 'Live' : 'Offline'}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-5 gap-4">
        {/* Distance */}
        <div className="text-center p-3 bg-blue-50 rounded-lg border-2 border-blue-200">
          <div className="text-2xl font-bold text-blue-600">{metrics.distance}</div>
          <div className="text-sm text-blue-800 font-medium">Distance (km)</div>
        </div>

        {/* Average Speed */}
        <div className="text-center p-3 bg-green-50 rounded-lg border-2 border-green-200">
          <div className="text-2xl font-bold text-green-600">{metrics.averageSpeed}</div>
          <div className="text-sm text-green-800 font-medium">Avg Speed (km/h)</div>
        </div>

        {/* Active Time */}
        <div className="text-center p-3 bg-purple-50 rounded-lg border-2 border-purple-200">
          <div className="text-2xl font-bold text-purple-600">{metrics.activeTime}</div>
          <div className="text-sm text-purple-800 font-medium">Active (min)</div>
        </div>

        {/* Idle Time */}
        <div className="text-center p-3 bg-orange-50 rounded-lg border-2 border-orange-200">
          <div className="text-2xl font-bold text-orange-600">{metrics.idleTime}</div>
          <div className="text-sm text-orange-800 font-medium">Idle (min)</div>
        </div>

        {/* GPS Points */}
        <div className="text-center p-3 bg-indigo-50 rounded-lg border-2 border-indigo-200">
          <div className="text-2xl font-bold text-indigo-600">{metrics.gpsPoints}</div>
          <div className="text-sm text-indigo-800 font-medium">GPS Points</div>
        </div>
      </div>

      <div className="mt-3 text-xs text-gray-500 text-center">
        Last updated: {lastUpdate.toLocaleTimeString()}
      </div>
    </div>
  );
}
