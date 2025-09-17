import React, { useState, useEffect } from 'react';
import { LocationTaskService } from '../../services/LocationTaskService';
import { RealTimeLocationService } from '../../services/RealTimeLocationService';
import { supabase } from '../../lib/supabase';
import { formatCurrency } from '../../utils/currency';
import {
  ChartBarIcon,
  LocationMarkerIcon,
  ClockIcon,
  TrendingUpIcon,
  UserGroupIcon,
  MapIcon,
  CalendarIcon,
} from '@heroicons/react/outline';
import toast from 'react-hot-toast';

interface LocationStats {
  totalTasks: number;
  completedTasks: number;
  averageDistance: number;
  totalDistance: number;
  averageTimeAtLocation: number;
  mostVisitedLocation: string;
  totalReward: number;
  completionRate: number;
}

interface LocationActivity {
  date: string;
  tasksCompleted: number;
  distanceTraveled: number;
  timeAtLocations: number;
  reward: number;
}

interface PopularLocation {
  name: string;
  visits: number;
  completions: number;
  averageTime: number;
  totalReward: number;
}

export default function LocationAnalytics() {
  const [stats, setStats] = useState<LocationStats>({
    totalTasks: 0,
    completedTasks: 0,
    averageDistance: 0,
    totalDistance: 0,
    averageTimeAtLocation: 0,
    mostVisitedLocation: 'N/A',
    totalReward: 0,
    completionRate: 0,
  });
  
  const [recentActivity, setRecentActivity] = useState<LocationActivity[]>([]);
  const [popularLocations, setPopularLocations] = useState<PopularLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<'7d' | '30d' | '90d'>('30d');

  useEffect(() => {
    fetchAnalytics();
  }, [dateRange]);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      
      // Calculate date range
      const endDate = new Date();
      const startDate = new Date();
      const days = dateRange === '7d' ? 7 : dateRange === '30d' ? 30 : 90;
      startDate.setDate(startDate.getDate() - days);

      // Fetch location-based tasks
      const tasks = await LocationTaskService.getLocationBasedTasks({});
      const filteredTasks = tasks.filter(task => 
        new Date(task.created_at) >= startDate && new Date(task.created_at) <= endDate
      );

      // Calculate basic stats
      const totalTasks = filteredTasks.length;
      const completedTasks = filteredTasks.filter(t => t.status === 'Completed').length;
      const totalReward = filteredTasks.reduce((sum, t) => sum + (t.price || 0), 0);
      const completionRate = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

      // Fetch location events for distance calculations
      const { data: locationEvents } = await supabase
        .from('task_location_events')
        .select(`
          *,
          tasks!inner(price, title),
          task_locations!inner(location_name, required_latitude, required_longitude)
        `)
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString());

      // Calculate distance and time metrics
      let totalDistance = 0;
      let totalTimeAtLocations = 0;
      const locationVisits = new Map<string, { visits: number; completions: number; time: number; reward: number }>();
      const dailyActivity = new Map<string, LocationActivity>();

      if (locationEvents) {
        for (const event of locationEvents) {
          const date = new Date(event.created_at).toISOString().split('T')[0];
          const locationName = event.task_locations?.location_name || 'Unknown Location';
          
          // Track location visits
          const current = locationVisits.get(locationName) || { visits: 0, completions: 0, time: 0, reward: 0 };
          current.visits += 1;
          if (event.event_type === 'check_out') {
            current.completions += 1;
            current.reward += event.tasks?.price || 0;
          }
          locationVisits.set(locationName, current);

          // Track daily activity
          const dayActivity = dailyActivity.get(date) || {
            date,
            tasksCompleted: 0,
            distanceTraveled: 0,
            timeAtLocations: 0,
            reward: 0,
          };
          
          if (event.event_type === 'check_out') {
            dayActivity.tasksCompleted += 1;
            dayActivity.reward += event.tasks?.price || 0;
          }
          
          dailyActivity.set(date, dayActivity);
        }
      }

      // Calculate popular locations
      const popularLocationsList: PopularLocation[] = Array.from(locationVisits.entries())
        .map(([name, data]) => ({
          name,
          visits: data.visits,
          completions: data.completions,
          averageTime: data.visits > 0 ? data.time / data.visits : 0,
          totalReward: data.reward,
        }))
        .sort((a, b) => b.visits - a.visits)
        .slice(0, 5);

      // Get most visited location
      const mostVisitedLocation = popularLocationsList.length > 0 
        ? popularLocationsList[0].name 
        : 'N/A';

      // Calculate averages
      const averageDistance = locationEvents?.length ? totalDistance / locationEvents.length : 0;
      const averageTimeAtLocation = locationEvents?.length ? totalTimeAtLocations / locationEvents.length : 0;

      setStats({
        totalTasks,
        completedTasks,
        averageDistance,
        totalDistance,
        averageTimeAtLocation,
        mostVisitedLocation,
        totalReward,
        completionRate,
      });

      setPopularLocations(popularLocationsList);
      setRecentActivity(Array.from(dailyActivity.values()).slice(-7));

    } catch (error) {
      console.error('Error fetching analytics:', error);
      toast.error('Failed to load location analytics');
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (minutes: number): string => {
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center">
            <ChartBarIcon className="h-7 w-7 mr-3 text-indigo-600" />
            Location Analytics
          </h2>
          <p className="text-gray-600 mt-1">
            Insights and metrics for location-based tasks
          </p>
        </div>
        
        <div className="flex items-center space-x-2">
          <CalendarIcon className="h-5 w-5 text-gray-400" />
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value as '7d' | '30d' | '90d')}
            className="rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
          >
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
          </select>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="p-3 bg-blue-100 rounded-lg">
              <MapIcon className="h-6 w-6 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total Tasks</p>
              <p className="text-2xl font-semibold text-gray-900">{stats.totalTasks}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="p-3 bg-green-100 rounded-lg">
              <TrendingUpIcon className="h-6 w-6 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Completion Rate</p>
              <p className="text-2xl font-semibold text-gray-900">{stats.completionRate.toFixed(1)}%</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="p-3 bg-purple-100 rounded-lg">
              <LocationMarkerIcon className="h-6 w-6 text-purple-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total Distance</p>
              <p className="text-2xl font-semibold text-gray-900">
                {RealTimeLocationService.formatDistance(stats.totalDistance)}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="p-3 bg-yellow-100 rounded-lg">
              <ClockIcon className="h-6 w-6 text-yellow-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Avg. Time/Location</p>
              <p className="text-2xl font-semibold text-gray-900">
                {formatTime(stats.averageTimeAtLocation)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Popular Locations */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">Popular Locations</h3>
          </div>
          <div className="p-6">
            {popularLocations.length === 0 ? (
              <div className="text-center py-8">
                <LocationMarkerIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500">No location data available</p>
              </div>
            ) : (
              <div className="space-y-4">
                {popularLocations.map((location, index) => (
                  <div key={location.name} className="flex items-center justify-between">
                    <div className="flex items-center">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-semibold ${
                        index === 0 ? 'bg-yellow-500' :
                        index === 1 ? 'bg-gray-400' :
                        index === 2 ? 'bg-yellow-600' : 'bg-blue-500'
                      }`}>
                        {index + 1}
                      </div>
                      <div className="ml-3">
                        <p className="font-medium text-gray-900">{location.name}</p>
                        <p className="text-sm text-gray-600">
                          {location.visits} visits • {location.completions} completed
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-green-600">
                        {formatCurrency(location.totalReward)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">Recent Activity</h3>
          </div>
          <div className="p-6">
            {recentActivity.length === 0 ? (
              <div className="text-center py-8">
                <ChartBarIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500">No recent activity</p>
              </div>
            ) : (
              <div className="space-y-4">
                {recentActivity.map((activity) => (
                  <div key={activity.date} className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-900">
                        {new Date(activity.date).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                        })}
                      </p>
                      <p className="text-sm text-gray-600">
                        {activity.tasksCompleted} tasks completed
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-green-600">
                        {formatCurrency(activity.reward)}
                      </p>
                      <p className="text-sm text-gray-600">
                        {RealTimeLocationService.formatDistance(activity.distanceTraveled)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="bg-gradient-to-r from-indigo-600 to-blue-600 rounded-lg shadow text-white p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="text-center">
            <p className="text-3xl font-bold">{formatCurrency(stats.totalReward)}</p>
            <p className="text-indigo-100">Total Rewards Earned</p>
          </div>
          <div className="text-center">
            <p className="text-3xl font-bold">{stats.mostVisitedLocation}</p>
            <p className="text-indigo-100">Most Popular Location</p>
          </div>
          <div className="text-center">
            <p className="text-3xl font-bold">
              {RealTimeLocationService.formatDistance(stats.averageDistance)}
            </p>
            <p className="text-indigo-100">Average Distance per Task</p>
          </div>
        </div>
      </div>
    </div>
  );
}