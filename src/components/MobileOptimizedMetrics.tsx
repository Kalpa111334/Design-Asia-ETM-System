import React, { useState } from 'react';
import { useRealTimeMetrics } from '../hooks/useRealTimeMetrics';
import { 
  ChevronUpIcon, 
  ChevronDownIcon,
  LocationMarkerIcon,
  ClockIcon,
  ChartBarIcon
} from '@heroicons/react/outline';

interface MobileOptimizedMetricsProps {
  selectedEmployeeId: string | null;
  selectedEmployeeName?: string;
  className?: string;
}

export default function MobileOptimizedMetrics({ 
  selectedEmployeeId, 
  selectedEmployeeName,
  className = "" 
}: MobileOptimizedMetricsProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const { metrics, isLive, lastUpdate, error } = useRealTimeMetrics(selectedEmployeeId, {
    updateInterval: 2000,
    timeframe: 'today'
  });

  if (!selectedEmployeeId) {
    return null;
  }

  if (error) {
    return (
      <div className={`bg-red-50 border border-red-200 rounded-lg p-3 mx-3 mb-3 ${className}`}>
        <div className="text-red-800 text-sm">
          Error loading metrics: {error.message}
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white border-t border-gray-200 ${className}`}>
      {/* Mobile Header - Collapsible */}
      <div 
        className="flex items-center justify-between p-3 cursor-pointer active:bg-gray-50 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2">
            <LocationMarkerIcon className="h-5 w-5 text-blue-600" />
            <div>
              <h3 className="text-sm font-semibold text-gray-900">
                {selectedEmployeeName || 'Employee Metrics'}
              </h3>
              <div className="flex items-center space-x-2">
                <div className={`w-1.5 h-1.5 rounded-full ${isLive ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`}></div>
                <span className="text-xs text-gray-500">
                  {isLive ? 'Live' : 'Offline'}
                </span>
              </div>
            </div>
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          {/* Quick overview when collapsed */}
          {!isExpanded && (
            <div className="flex items-center space-x-3 text-xs text-gray-600">
              <span>{metrics.distance}km</span>
              <span>{metrics.averageSpeed}km/h</span>
              <span>{metrics.gpsPoints} pts</span>
            </div>
          )}
          {isExpanded ? 
            <ChevronUpIcon className="h-5 w-5 text-gray-400" /> : 
            <ChevronDownIcon className="h-5 w-5 text-gray-400" />
          }
        </div>
      </div>

      {/* Expandable Metrics Content */}
      {isExpanded && (
        <div className="px-3 pb-4">
          {/* Primary Metrics - 2x2 Grid */}
          <div className="grid grid-cols-2 gap-3 mb-3">
            {/* Distance */}
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-3 border border-blue-200 active:scale-95 transition-transform">
              <div className="flex items-center justify-between mb-1">
                <ChartBarIcon className="h-4 w-4 text-blue-600" />
                <span className="text-xs text-blue-700 font-medium">Distance</span>
              </div>
              <div className="text-xl font-bold text-blue-800">{metrics.distance}</div>
              <div className="text-xs text-blue-600">km traveled</div>
            </div>

            {/* Average Speed */}
            <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-3 border border-green-200 active:scale-95 transition-transform">
              <div className="flex items-center justify-between mb-1">
                <svg className="h-4 w-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                <span className="text-xs text-green-700 font-medium">Speed</span>
              </div>
              <div className="text-xl font-bold text-green-800">{metrics.averageSpeed}</div>
              <div className="text-xs text-green-600">km/h avg</div>
            </div>

            {/* Active Time */}
            <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-3 border border-purple-200 active:scale-95 transition-transform">
              <div className="flex items-center justify-between mb-1">
                <ClockIcon className="h-4 w-4 text-purple-600" />
                <span className="text-xs text-purple-700 font-medium">Active</span>
              </div>
              <div className="text-xl font-bold text-purple-800">{metrics.activeTime}</div>
              <div className="text-xs text-purple-600">min moving</div>
            </div>

            {/* Idle Time */}
            <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-lg p-3 border border-orange-200 active:scale-95 transition-transform">
              <div className="flex items-center justify-between mb-1">
                <svg className="h-4 w-4 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-xs text-orange-700 font-medium">Idle</span>
              </div>
              <div className="text-xl font-bold text-orange-800">{metrics.idleTime}</div>
              <div className="text-xs text-orange-600">min idle</div>
            </div>
          </div>

          {/* GPS Points - Full Width */}
          <div className="bg-gradient-to-r from-indigo-50 to-indigo-100 rounded-lg p-3 border border-indigo-200 active:scale-95 transition-transform">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="bg-indigo-200 rounded-full p-2">
                  <LocationMarkerIcon className="h-4 w-4 text-indigo-700" />
                </div>
                <div>
                  <div className="text-lg font-bold text-indigo-800">{metrics.gpsPoints}</div>
                  <div className="text-xs text-indigo-600">GPS tracking points</div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs text-indigo-700 font-medium">Data Quality</div>
                <div className="text-xs text-indigo-600">
                  {metrics.gpsPoints > 50 ? 'Excellent' : 
                   metrics.gpsPoints > 20 ? 'Good' : 
                   metrics.gpsPoints > 5 ? 'Fair' : 'Limited'}
                </div>
              </div>
            </div>
          </div>

          {/* Last Update */}
          {lastUpdate && (
            <div className="mt-3 pt-3 border-t border-gray-100">
              <div className="flex items-center justify-center space-x-2 text-xs text-gray-500">
                <div className="w-1 h-1 bg-gray-400 rounded-full animate-pulse"></div>
                <span>Last updated: {lastUpdate.toLocaleTimeString()}</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
