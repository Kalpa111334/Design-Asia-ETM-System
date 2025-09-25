import React from 'react';
import { useRealTimeMetrics } from '../hooks/useRealTimeMetrics';

interface SimpleRealTimeMetricsProps {
  selectedEmployeeId: string | null;
  className?: string;
}

export default function SimpleRealTimeMetrics({ 
  selectedEmployeeId, 
  className = "" 
}: SimpleRealTimeMetricsProps) {
  const { metrics, isLive, lastUpdate, error } = useRealTimeMetrics(selectedEmployeeId, {
    updateInterval: 2000, // Update every 2 seconds for more responsive UI
    timeframe: 'today'
  });

  if (!selectedEmployeeId) {
    return null;
  }

  if (error) {
    return (
      <div className={`bg-red-50 border border-red-200 rounded-lg p-4 ${className}`}>
        <div className="text-red-800 text-sm">
          Error loading metrics: {error.message}
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white rounded-lg shadow-lg p-3 sm:p-4 ${className}`}>
      <div className="flex items-center justify-between mb-3 sm:mb-4">
        <h3 className="text-sm sm:text-base font-medium text-gray-800">Real-Time Metrics</h3>
        <div className="flex items-center gap-1 sm:gap-2">
          <div className={`w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full ${isLive ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`}></div>
          <span className="text-xs sm:text-sm text-gray-500">
            {isLive ? 'Live' : 'Offline'}
          </span>
        </div>
      </div>

      {/* Mobile: 2x3 grid, Tablet+: 5x1 grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-3">
        {/* Distance */}
        <div className="text-center p-2 sm:p-3 bg-blue-50 rounded-lg border border-blue-200 hover:bg-blue-100 transition-colors">
          <div className="text-lg sm:text-xl lg:text-2xl font-bold text-blue-600">{metrics.distance}</div>
          <div className="text-xs sm:text-sm text-blue-800 font-medium leading-tight">
            Distance<br className="sm:hidden" /><span className="hidden sm:inline"> </span>(km)
          </div>
        </div>

        {/* Average Speed */}
        <div className="text-center p-2 sm:p-3 bg-green-50 rounded-lg border border-green-200 hover:bg-green-100 transition-colors">
          <div className="text-lg sm:text-xl lg:text-2xl font-bold text-green-600">{metrics.averageSpeed}</div>
          <div className="text-xs sm:text-sm text-green-800 font-medium leading-tight">
            Avg Speed<br className="sm:hidden" /><span className="hidden sm:inline"> </span>(km/h)
          </div>
        </div>

        {/* Active Time */}
        <div className="text-center p-2 sm:p-3 bg-purple-50 rounded-lg border border-purple-200 hover:bg-purple-100 transition-colors">
          <div className="text-lg sm:text-xl lg:text-2xl font-bold text-purple-600">{metrics.activeTime}</div>
          <div className="text-xs sm:text-sm text-purple-800 font-medium leading-tight">
            Active<br className="sm:hidden" /><span className="hidden sm:inline"> </span>(min)
          </div>
        </div>

        {/* Idle Time */}
        <div className="text-center p-2 sm:p-3 bg-orange-50 rounded-lg border border-orange-200 hover:bg-orange-100 transition-colors">
          <div className="text-lg sm:text-xl lg:text-2xl font-bold text-orange-600">{metrics.idleTime}</div>
          <div className="text-xs sm:text-sm text-orange-800 font-medium leading-tight">
            Idle<br className="sm:hidden" /><span className="hidden sm:inline"> </span>(min)
          </div>
        </div>

        {/* GPS Points - Full width on mobile */}
        <div className="col-span-2 sm:col-span-1 text-center p-2 sm:p-3 bg-indigo-50 rounded-lg border border-indigo-200 hover:bg-indigo-100 transition-colors">
          <div className="text-lg sm:text-xl lg:text-2xl font-bold text-indigo-600">{metrics.gpsPoints}</div>
          <div className="text-xs sm:text-sm text-indigo-800 font-medium leading-tight">
            GPS Points
          </div>
        </div>
      </div>

      {lastUpdate && (
        <div className="mt-3 sm:mt-4 text-xs sm:text-sm text-gray-500 text-center">
          Updated: {lastUpdate.toLocaleTimeString()}
        </div>
      )}
    </div>
  );
}
