import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import { OfflineLocationService } from '../../services/OfflineLocationService';
import {
  WifiIcon,
  CloudDownloadIcon,
  ExclamationIcon,
  CheckCircleIcon,
  RefreshIcon,
} from '@heroicons/react/outline';
import toast from 'react-hot-toast';

interface OfflineCapableMapProps {
  center: [number, number];
  zoom: number;
  style?: React.CSSProperties;
  children?: React.ReactNode;
  onMapReady?: (map: L.Map) => void;
  enableOfflineSupport?: boolean;
  preloadRadius?: number; // km
}

interface OfflineStatus {
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

// Custom tile layer that supports offline caching
class OfflineTileLayer extends L.TileLayer {
  constructor(urlTemplate: string, options?: L.TileLayerOptions) {
    super(urlTemplate, options);
  }

  createTile(coords: L.Coords, done: L.DoneCallback): HTMLElement {
    const tile = document.createElement('img');
    const url = this.getTileUrl(coords);

    // Try to get cached tile first
    OfflineLocationService.getCachedMapTile(url)
      .then(cachedBlob => {
        if (cachedBlob) {
          // Use cached tile
          const objectURL = URL.createObjectURL(cachedBlob);
          tile.src = objectURL;
          tile.onload = () => {
            URL.revokeObjectURL(objectURL);
            done(undefined, tile);
          };
        } else {
          // Fall back to network
          tile.crossOrigin = 'anonymous';
          tile.src = url;
          tile.onload = () => done(undefined, tile);
          tile.onerror = () => {
            // Show offline indicator on tile
            tile.src = this.createOfflineTile(coords);
            done(undefined, tile);
          };
        }
      })
      .catch(() => {
        // Network request as fallback
        tile.crossOrigin = 'anonymous';
        tile.src = url;
        tile.onload = () => done(undefined, tile);
        tile.onerror = () => {
          tile.src = this.createOfflineTile(coords);
          done(undefined, tile);
        };
      });

    return tile;
  }

  private createOfflineTile(coords: L.Coords): string {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;
    
    // Draw offline tile
    ctx.fillStyle = '#f0f0f0';
    ctx.fillRect(0, 0, 256, 256);
    
    ctx.strokeStyle = '#ddd';
    ctx.strokeRect(0, 0, 256, 256);
    
    ctx.fillStyle = '#999';
    ctx.font = '12px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Offline', 128, 120);
    ctx.fillText(`${coords.z}/${coords.x}/${coords.y}`, 128, 140);
    
    return canvas.toDataURL();
  }
}

// Custom hook to create offline tile layer
function useOfflineTileLayer(url: string, attribution: string) {
  const tileLayerRef = useRef<L.TileLayer | null>(null);

  useEffect(() => {
    if (tileLayerRef.current) {
      return;
    }

    // Create the offline tile layer
    tileLayerRef.current = new OfflineTileLayer(url, {
      attribution,
    });

    return () => {
      if (tileLayerRef.current) {
        tileLayerRef.current.remove();
        tileLayerRef.current = null;
      }
    };
  }, [url, attribution]);

  return tileLayerRef.current;
}

// Component to handle map initialization with offline support
function OfflineMapController({ 
  onMapReady, 
  enableOfflineSupport, 
  center, 
  preloadRadius 
}: {
  onMapReady?: (map: L.Map) => void;
  enableOfflineSupport?: boolean;
  center: [number, number];
  preloadRadius?: number;
}) {
  const map = useMap();

  useEffect(() => {
    if (onMapReady) {
      onMapReady(map);
    }

    // Initialize offline support if enabled (disabled for now to fix constructor error)
    if (enableOfflineSupport) {
      try {
        OfflineLocationService.initialize();
        
        // Preload map area if specified
        if (preloadRadius && preloadRadius > 0) {
          OfflineLocationService.preloadMapArea(center[0], center[1], preloadRadius)
            .then(() => {
              console.log(`Preloaded map area within ${preloadRadius}km radius`);
            })
            .catch(error => {
              console.error('Error preloading map area:', error);
            });
        }
      } catch (error) {
        console.error('Error initializing offline support:', error);
      }
    }
  }, [map, onMapReady, enableOfflineSupport, center, preloadRadius]);

  return null;
}

export default function OfflineCapableMap({
  center,
  zoom,
  style = { height: '100%', width: '100%' },
  children,
  onMapReady,
  enableOfflineSupport = true,
  preloadRadius = 0,
}: OfflineCapableMapProps) {
  const [offlineStatus, setOfflineStatus] = useState<OfflineStatus>({
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
  const [isPreloading, setIsPreloading] = useState(false);
  const [showOfflinePanel, setShowOfflinePanel] = useState(false);

  useEffect(() => {
    if (!enableOfflineSupport) return;

    // Update status periodically
    const updateStatus = async () => {
      try {
        const storageStats = await OfflineLocationService.getStorageStats();
        const syncQueueSize = OfflineLocationService.getSyncQueueSize();
        
        setOfflineStatus(prev => ({
          ...prev,
          isOnline: navigator.onLine,
          syncQueueSize,
          storageStats,
          lastSync: prev.lastSync,
        }));
      } catch (error) {
        console.error('Error updating offline status:', error);
        // Set default values if offline service fails
        setOfflineStatus(prev => ({
          ...prev,
          isOnline: navigator.onLine,
          syncQueueSize: 0,
          storageStats: {
            locations: 0,
            tasks: 0,
            geofences: 0,
            tiles: 0,
            totalSize: 0,
          },
        }));
      }
    };

    updateStatus();
    const statusInterval = setInterval(updateStatus, 30000); // Update every 30 seconds

    // Listen for online/offline events
    const handleOnline = () => {
      setOfflineStatus(prev => ({ ...prev, isOnline: true }));
      toast.success('Connection restored - syncing data');
    };

    const handleOffline = () => {
      setOfflineStatus(prev => ({ ...prev, isOnline: false }));
      toast.error('Connection lost - switching to offline mode');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      clearInterval(statusInterval);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [enableOfflineSupport]);

  const handlePreloadArea = async () => {
    if (!enableOfflineSupport) return;

    setIsPreloading(true);
    try {
      await OfflineLocationService.preloadMapArea(center[0], center[1], preloadRadius || 5);
      toast.success('Map area cached for offline use');
      
      // Update storage stats
      const storageStats = await OfflineLocationService.getStorageStats();
      setOfflineStatus(prev => ({ ...prev, storageStats }));
    } catch (error) {
      console.error('Error preloading map area:', error);
      toast.error('Failed to cache map area - offline features disabled');
    } finally {
      setIsPreloading(false);
    }
  };

  const handleForceSync = async () => {
    if (!enableOfflineSupport || !offlineStatus.isOnline) return;

    try {
      await OfflineLocationService.forceSyncNow();
      toast.success('Data synchronized successfully');
      
      setOfflineStatus(prev => ({
        ...prev,
        syncQueueSize: 0,
        lastSync: new Date(),
      }));
    } catch (error) {
      console.error('Error syncing data:', error);
      toast.error('Failed to sync data - offline features disabled');
    }
  };

  const handleClearCache = async () => {
    if (!enableOfflineSupport) return;

    try {
      await OfflineLocationService.clearAllCache();
      toast.success('Cache cleared successfully');
      
      const storageStats = await OfflineLocationService.getStorageStats();
      setOfflineStatus(prev => ({ ...prev, storageStats, syncQueueSize: 0 }));
    } catch (error) {
      console.error('Error clearing cache:', error);
      toast.error('Failed to clear cache - offline features disabled');
    }
  };

  return (
    <div className="relative" style={style}>
      <MapContainer
        center={center}
        zoom={zoom}
        style={{ height: '100%', width: '100%' }}
        scrollWheelZoom={true}
        touchZoom={true}
        doubleClickZoom={true}
        dragging={true}
        maxZoom={22}
        minZoom={2}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          maxNativeZoom={19}
          maxZoom={22}
        />
        
        <OfflineMapController
          onMapReady={onMapReady}
          enableOfflineSupport={enableOfflineSupport}
          center={center}
          preloadRadius={preloadRadius}
        />
        
        {children}
      </MapContainer>

      {/* Offline Status Indicator */}
      {enableOfflineSupport && (
        <div className="absolute top-4 left-4 z-[1000]">
          <button
            onClick={() => setShowOfflinePanel(!showOfflinePanel)}
            className={`flex items-center px-3 py-2 rounded-lg shadow-lg text-sm font-medium transition-colors ${
              offlineStatus.isOnline
                ? 'bg-green-100 text-green-800 border border-green-200'
                : 'bg-red-100 text-red-800 border border-red-200'
            }`}
          >
            <WifiIcon className="h-4 w-4 mr-2" />
            {offlineStatus.isOnline ? 'Online' : 'Offline'}
            {offlineStatus.syncQueueSize > 0 && (
              <span className="ml-2 bg-orange-500 text-white rounded-full px-2 py-1 text-xs">
                {offlineStatus.syncQueueSize}
              </span>
            )}
          </button>

          {/* Offline Panel */}
          {showOfflinePanel && (
            <div className="absolute top-12 left-0 bg-white rounded-lg shadow-xl border border-gray-200 p-4 min-w-80 max-w-sm">
              <div className="space-y-4">
                {/* Connection Status */}
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700">Connection</span>
                  <div className="flex items-center">
                    {offlineStatus.isOnline ? (
                      <CheckCircleIcon className="h-4 w-4 text-green-500 mr-1" />
                    ) : (
                      <ExclamationIcon className="h-4 w-4 text-red-500 mr-1" />
                    )}
                    <span className={`text-sm font-medium ${
                      offlineStatus.isOnline ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {offlineStatus.isOnline ? 'Connected' : 'Disconnected'}
                    </span>
                  </div>
                </div>

                {/* Sync Queue */}
                {offlineStatus.syncQueueSize > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700">Pending Sync</span>
                    <span className="text-sm text-orange-600 font-medium">
                      {offlineStatus.syncQueueSize} items
                    </span>
                  </div>
                )}

                {/* Storage Stats */}
                <div className="border-t border-gray-200 pt-3">
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Cached Data</h4>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Map Tiles:</span>
                      <span className="font-medium">{offlineStatus.storageStats.tiles}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Tasks:</span>
                      <span className="font-medium">{offlineStatus.storageStats.tasks}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Locations:</span>
                      <span className="font-medium">{offlineStatus.storageStats.locations}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Geofences:</span>
                      <span className="font-medium">{offlineStatus.storageStats.geofences}</span>
                    </div>
                  </div>
                  <div className="flex justify-between mt-2 pt-2 border-t border-gray-100">
                    <span className="text-gray-600 text-xs">Total Size:</span>
                    <span className="font-medium text-xs">{offlineStatus.storageStats.totalSize} MB</span>
                  </div>
                </div>

                {/* Last Sync */}
                {offlineStatus.lastSync && (
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <span>Last sync:</span>
                    <span>{offlineStatus.lastSync.toLocaleTimeString()}</span>
                  </div>
                )}

                {/* Actions */}
                <div className="border-t border-gray-200 pt-3 space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={handlePreloadArea}
                      disabled={isPreloading || !offlineStatus.isOnline}
                      className="flex items-center justify-center px-3 py-2 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded hover:bg-blue-100 disabled:opacity-50"
                    >
                      {isPreloading ? (
                        <RefreshIcon className="h-3 w-3 mr-1 animate-spin" />
                      ) : (
                        <CloudDownloadIcon className="h-3 w-3 mr-1" />
                      )}
                      Cache Area
                    </button>
                    
                    <button
                      onClick={handleForceSync}
                      disabled={!offlineStatus.isOnline || offlineStatus.syncQueueSize === 0}
                      className="flex items-center justify-center px-3 py-2 text-xs font-medium text-green-700 bg-green-50 border border-green-200 rounded hover:bg-green-100 disabled:opacity-50"
                    >
                      <RefreshIcon className="h-3 w-3 mr-1" />
                      Sync Now
                    </button>
                  </div>
                  
                  <button
                    onClick={handleClearCache}
                    className="w-full flex items-center justify-center px-3 py-2 text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded hover:bg-red-100"
                  >
                    Clear Cache
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}