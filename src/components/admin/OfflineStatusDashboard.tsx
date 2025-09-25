import React, { useState, useEffect } from 'react';
import { OfflineLocationService } from '../../services/OfflineLocationService';
import { useAuth } from '../../contexts/AuthContext';
import {
  CloudIcon,
  CloudDownloadIcon,
  DatabaseIcon,
  RefreshIcon,
  TrashIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  InformationCircleIcon,
} from '@heroicons/react/outline';
import toast from 'react-hot-toast';

interface OfflineStats {
  isOnline: boolean;
  syncQueueSize: number;
  storageStats: {
    locations: number;
    tasks: number;
    geofences: number;
    tiles: number;
    totalSize: number;
  };
  lastSync?: Date;
}

export default function OfflineStatusDashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState<OfflineStats>({
    isOnline: navigator.onLine,
    syncQueueSize: 0,
    storageStats: {
      locations: 0,
      tasks: 0,
      geofences: 0,
      tiles: 0,
      totalSize: 0,
    },
  });
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [caching, setCaching] = useState(false);

  useEffect(() => {
    updateStats();
    
    // Update stats every 30 seconds
    const interval = setInterval(updateStats, 30000);
    
    // Listen for online/offline events
    const handleOnline = () => {
      setStats(prev => ({ ...prev, isOnline: true }));
      toast.success('Connection restored');
    };

    const handleOffline = () => {
      setStats(prev => ({ ...prev, isOnline: false }));
      toast.error('Connection lost - offline mode active');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      clearInterval(interval);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const updateStats = async () => {
    try {
      const storageStats = await OfflineLocationService.getStorageStats();
      const syncQueueSize = OfflineLocationService.getSyncQueueSize();
      
      setStats(prev => ({
        ...prev,
        isOnline: navigator.onLine,
        syncQueueSize,
        storageStats,
      }));
    } catch (error) {
      console.error('Error updating offline stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async () => {
    if (!stats.isOnline) {
      toast.error('Cannot sync while offline');
      return;
    }

    setSyncing(true);
    try {
      await OfflineLocationService.forceSyncNow();
      toast.success('Data synchronized successfully');
      
      setStats(prev => ({
        ...prev,
        syncQueueSize: 0,
        lastSync: new Date(),
      }));
    } catch (error) {
      console.error('Error syncing:', error);
      toast.error('Failed to sync data');
    } finally {
      setSyncing(false);
    }
  };

  const handleCacheData = async () => {
    if (!stats.isOnline || !user) {
      toast.error('Cannot cache data while offline');
      return;
    }

    setCaching(true);
    try {
      // Cache location tasks
      await OfflineLocationService.cacheLocationTasks(user.id);
      
      // Cache map tiles for Sri Lanka major cities
      const cities = [
        { name: 'Colombo', lat: 6.9271, lng: 79.8612 },
        { name: 'Kandy', lat: 7.2906, lng: 80.6337 },
        { name: 'Galle', lat: 6.0535, lng: 80.2210 },
      ];

      for (const city of cities) {
        await OfflineLocationService.preloadMapArea(city.lat, city.lng, 5);
      }

      toast.success('Data cached for offline use');
      await updateStats();
    } catch (error) {
      console.error('Error caching data:', error);
      toast.error('Failed to cache data');
    } finally {
      setCaching(false);
    }
  };

  const handleClearCache = async () => {
    setClearing(true);
    try {
      await OfflineLocationService.clearAllCache();
      toast.success('Cache cleared successfully');
      await updateStats();
    } catch (error) {
      console.error('Error clearing cache:', error);
      toast.error('Failed to clear cache');
    } finally {
      setClearing(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-center h-32">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center">
            <CloudIcon className="h-7 w-7 mr-3 text-indigo-600" />
            Offline Status
          </h2>
          <p className="text-gray-600 mt-1">
            Monitor offline capabilities and cached data
          </p>
        </div>
      </div>

      {/* Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Connection Status */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className={`p-3 rounded-lg ${
              stats.isOnline ? 'bg-green-100' : 'bg-red-100'
            }`}>
              {stats.isOnline ? (
                <CheckCircleIcon className="h-6 w-6 text-green-600" />
              ) : (
                <ExclamationCircleIcon className="h-6 w-6 text-red-600" />
              )}
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Connection</p>
              <p className={`text-2xl font-semibold ${
                stats.isOnline ? 'text-green-600' : 'text-red-600'
              }`}>
                {stats.isOnline ? 'Online' : 'Offline'}
              </p>
            </div>
          </div>
        </div>

        {/* Sync Queue */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className={`p-3 rounded-lg ${
              stats.syncQueueSize > 0 ? 'bg-orange-100' : 'bg-green-100'
            }`}>
              <RefreshIcon className={`h-6 w-6 ${
                stats.syncQueueSize > 0 ? 'text-orange-600' : 'text-green-600'
              }`} />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Pending Sync</p>
              <p className={`text-2xl font-semibold ${
                stats.syncQueueSize > 0 ? 'text-orange-600' : 'text-green-600'
              }`}>
                {stats.syncQueueSize}
              </p>
            </div>
          </div>
        </div>

        {/* Cached Items */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="p-3 bg-blue-100 rounded-lg">
              <DatabaseIcon className="h-6 w-6 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Cached Items</p>
              <p className="text-2xl font-semibold text-blue-600">
                {stats.storageStats.tasks + stats.storageStats.locations + stats.storageStats.geofences}
              </p>
            </div>
          </div>
        </div>

        {/* Storage Size */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="p-3 bg-purple-100 rounded-lg">
              <CloudDownloadIcon className="h-6 w-6 text-purple-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Storage Used</p>
              <p className="text-2xl font-semibold text-purple-600">
                {stats.storageStats.totalSize} MB
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Detailed Storage Breakdown */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Storage Breakdown</h3>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-indigo-600">{stats.storageStats.tiles}</div>
              <div className="text-sm text-gray-600 mt-1">Map Tiles</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-green-600">{stats.storageStats.tasks}</div>
              <div className="text-sm text-gray-600 mt-1">Tasks</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-blue-600">{stats.storageStats.locations}</div>
              <div className="text-sm text-gray-600 mt-1">Locations</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-purple-600">{stats.storageStats.geofences}</div>
              <div className="text-sm text-gray-600 mt-1">Geofences</div>
            </div>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Offline Actions</h3>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <button
              onClick={handleSync}
              disabled={!stats.isOnline || syncing || stats.syncQueueSize === 0}
              className="flex items-center justify-center px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {syncing ? (
                <RefreshIcon className="h-5 w-5 mr-2 animate-spin" />
              ) : (
                <RefreshIcon className="h-5 w-5 mr-2" />
              )}
              Sync Now
            </button>

            <button
              onClick={handleCacheData}
              disabled={!stats.isOnline || caching}
              className="flex items-center justify-center px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {caching ? (
                <RefreshIcon className="h-5 w-5 mr-2 animate-spin" />
              ) : (
                <CloudDownloadIcon className="h-5 w-5 mr-2" />
              )}
              Cache Data
            </button>

            <button
              onClick={handleClearCache}
              disabled={clearing}
              className="flex items-center justify-center px-4 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {clearing ? (
                <RefreshIcon className="h-5 w-5 mr-2 animate-spin" />
              ) : (
                <TrashIcon className="h-5 w-5 mr-2" />
              )}
              Clear Cache
            </button>
          </div>
        </div>
      </div>

      {/* Last Sync Info */}
      {stats.lastSync && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center">
            <InformationCircleIcon className="h-5 w-5 text-blue-500 mr-2" />
            <span className="text-blue-800 text-sm">
              Last synchronized: {stats.lastSync.toLocaleString()}
            </span>
          </div>
        </div>
      )}

      {/* Offline Tips */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <div className="flex">
          <InformationCircleIcon className="h-5 w-5 text-yellow-500 mr-2 mt-0.5 flex-shrink-0" />
          <div className="text-yellow-800 text-sm">
            <h4 className="font-semibold mb-2">Offline Mode Tips:</h4>
            <ul className="list-disc list-inside space-y-1">
              <li>Cache data before going offline for better experience</li>
              <li>Location data is stored locally and synced when connection returns</li>
              <li>Map tiles are cached for offline viewing</li>
              <li>Clear cache periodically to free up storage space</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}