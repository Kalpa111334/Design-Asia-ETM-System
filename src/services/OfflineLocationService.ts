import { supabase } from '../lib/supabase';
import { LocationTaskService, LocationBasedTask } from './LocationTaskService';
import { RealTimeLocationService } from './RealTimeLocationService';
import { GeofencingService, Geofence } from './GeofencingService';

export interface OfflineLocationData {
  id: string;
  user_id: string;
  latitude: number;
  longitude: number;
  accuracy?: number;
  timestamp: string;
  task_id?: string;
  battery_level?: number;
  synced: boolean;
  created_offline: Date;
}

export interface OfflineTaskData {
  task: LocationBasedTask;
  locations: OfflineLocationData[];
  events: any[];
  lastSync: Date;
}

export interface CachedMapTile {
  url: string;
  blob: Blob;
  timestamp: Date;
  zoom: number;
  x: number;
  y: number;
}

export class OfflineLocationService {
  private static readonly DB_NAME = 'LocationTasksOfflineDB';
  private static readonly DB_VERSION = 1;
  private static readonly LOCATION_STORE = 'locations';
  private static readonly TASK_STORE = 'tasks';
  private static readonly TILE_STORE = 'mapTiles';
  private static readonly GEOFENCE_STORE = 'geofences';
  
  private static db: IDBDatabase | null = null;
  private static isOnline = navigator.onLine;
  private static syncQueue: OfflineLocationData[] = [];

  /**
   * Initialize offline database and sync mechanisms
   */
  static async initialize(): Promise<void> {
    try {
      await this.initializeIndexedDB();
      this.setupOnlineOfflineListeners();
      this.setupPeriodicSync();
      
      // Start background sync if online
      if (this.isOnline) {
        await this.syncOfflineData();
      }
      
    } catch (error) {
      console.error('Error initializing offline service:', error);
    }
  }

  /**
   * Initialize IndexedDB for offline storage
   */
  private static async initializeIndexedDB(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.DB_NAME, this.DB_VERSION);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };
      
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        // Create locations store
        if (!db.objectStoreNames.contains(this.LOCATION_STORE)) {
          const locationStore = db.createObjectStore(this.LOCATION_STORE, { keyPath: 'id' });
          locationStore.createIndex('user_id', 'user_id', { unique: false });
          locationStore.createIndex('timestamp', 'timestamp', { unique: false });
          locationStore.createIndex('synced', 'synced', { unique: false });
        }
        
        // Create tasks store
        if (!db.objectStoreNames.contains(this.TASK_STORE)) {
          const taskStore = db.createObjectStore(this.TASK_STORE, { keyPath: 'id' });
          taskStore.createIndex('user_id', 'user_id', { unique: false });
          taskStore.createIndex('lastSync', 'lastSync', { unique: false });
        }
        
        // Create map tiles store
        if (!db.objectStoreNames.contains(this.TILE_STORE)) {
          const tileStore = db.createObjectStore(this.TILE_STORE, { keyPath: 'url' });
          tileStore.createIndex('timestamp', 'timestamp', { unique: false });
          tileStore.createIndex('zoom', 'zoom', { unique: false });
        }
        
        // Create geofences store
        if (!db.objectStoreNames.contains(this.GEOFENCE_STORE)) {
          const geofenceStore = db.createObjectStore(this.GEOFENCE_STORE, { keyPath: 'id' });
          geofenceStore.createIndex('is_active', 'is_active', { unique: false });
        }
      };
    });
  }

  /**
   * Setup online/offline event listeners
   */
  private static setupOnlineOfflineListeners(): void {
    window.addEventListener('online', async () => {
      console.log('Connection restored - syncing offline data');
      this.isOnline = true;
      await this.syncOfflineData();
    });

    window.addEventListener('offline', () => {
      console.log('Connection lost - switching to offline mode');
      this.isOnline = false;
    });
  }

  /**
   * Setup periodic sync when online
   */
  private static setupPeriodicSync(): void {
    setInterval(async () => {
      if (this.isOnline) {
        await this.syncOfflineData();
      }
    }, 60000); // Sync every minute when online
  }

  /**
   * Store location data offline
   */
  static async storeLocationOffline(
    userId: string,
    latitude: number,
    longitude: number,
    options: {
      accuracy?: number;
      taskId?: string;
      batteryLevel?: number;
    } = {}
  ): Promise<string> {
    const locationData: OfflineLocationData = {
      id: `offline_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      user_id: userId,
      latitude,
      longitude,
      accuracy: options.accuracy,
      timestamp: new Date().toISOString(),
      task_id: options.taskId,
      battery_level: options.batteryLevel,
      synced: false,
      created_offline: new Date(),
    };

    if (this.isOnline) {
      // Try to sync immediately if online
      try {
        await this.syncLocationToServer(locationData);
        locationData.synced = true;
      } catch (error) {
        console.log('Failed to sync immediately, storing offline');
      }
    }

    // Store in IndexedDB
    await this.storeInIndexedDB(this.LOCATION_STORE, locationData);
    
    // Add to sync queue if not synced
    if (!locationData.synced) {
      this.syncQueue.push(locationData);
    }

    return locationData.id;
  }

  /**
   * Cache location-based tasks for offline use
   */
  static async cacheLocationTasks(userId: string): Promise<void> {
    try {
      if (!this.isOnline) {
        console.log('Cannot cache tasks while offline');
        return;
      }

      const tasks = await LocationTaskService.getLocationBasedTasks({
        assigned_to: userId,
      });

      const geofences = await GeofencingService.getGeofences(true);

      // Store tasks
      for (const task of tasks) {
        const offlineTaskData: OfflineTaskData = {
          task,
          locations: [],
          events: [],
          lastSync: new Date(),
        };
        
        await this.storeInIndexedDB(this.TASK_STORE, {
          id: task.id,
          user_id: userId,
          data: offlineTaskData,
          lastSync: new Date(),
        });
      }

      // Store geofences
      for (const geofence of geofences) {
        await this.storeInIndexedDB(this.GEOFENCE_STORE, geofence);
      }

      console.log(`Cached ${tasks.length} tasks and ${geofences.length} geofences for offline use`);

    } catch (error) {
      console.error('Error caching location tasks:', error);
    }
  }

  /**
   * Get cached location tasks for offline use
   */
  static async getCachedLocationTasks(userId: string): Promise<LocationBasedTask[]> {
    try {
      const cachedTasks = await this.getAllFromStore(this.TASK_STORE);
      return cachedTasks
        .filter((item: any) => item.user_id === userId)
        .map((item: any) => item.data.task);
    } catch (error) {
      console.error('Error getting cached tasks:', error);
      return [];
    }
  }

  /**
   * Get cached geofences for offline use
   */
  static async getCachedGeofences(): Promise<Geofence[]> {
    try {
      return await this.getAllFromStore(this.GEOFENCE_STORE);
    } catch (error) {
      console.error('Error getting cached geofences:', error);
      return [];
    }
  }

  /**
   * Cache map tiles for offline use
   */
  static async cacheMapTiles(
    bounds: { north: number; south: number; east: number; west: number },
    zoomLevels: number[] = [10, 12, 14, 16]
  ): Promise<void> {
    try {
      console.log('Starting map tile caching...');
      let totalTiles = 0;
      let cachedTiles = 0;

      for (const zoom of zoomLevels) {
        const tiles = this.getTileCoordinatesForBounds(bounds, zoom);
        totalTiles += tiles.length;

        for (const tile of tiles) {
          try {
            const url = `https://tile.openstreetmap.org/${zoom}/${tile.x}/${tile.y}.png`;
            
            // Check if tile is already cached
            const existingTile = await this.getFromIndexedDB(this.TILE_STORE, url);
            if (existingTile && this.isTileFresh(existingTile.timestamp)) {
              continue;
            }

            // Fetch and cache tile
            const response = await fetch(url);
            if (response.ok) {
              const blob = await response.blob();
              const cachedTile: CachedMapTile = {
                url,
                blob,
                timestamp: new Date(),
                zoom,
                x: tile.x,
                y: tile.y,
              };
              
              await this.storeInIndexedDB(this.TILE_STORE, cachedTile);
              cachedTiles++;
            }
            
            // Add small delay to avoid overwhelming the server
            await this.delay(100);
            
          } catch (error) {
            console.log(`Failed to cache tile ${tile.x},${tile.y} at zoom ${zoom}`);
          }
        }
      }

      console.log(`Cached ${cachedTiles}/${totalTiles} map tiles`);

    } catch (error) {
      console.error('Error caching map tiles:', error);
    }
  }

  /**
   * Get cached map tile
   */
  static async getCachedMapTile(url: string): Promise<Blob | null> {
    try {
      const cachedTile = await this.getFromIndexedDB(this.TILE_STORE, url);
      if (cachedTile && this.isTileFresh(cachedTile.timestamp)) {
        return cachedTile.blob;
      }
      return null;
    } catch (error) {
      console.error('Error getting cached tile:', error);
      return null;
    }
  }

  /**
   * Sync offline data to server
   */
  static async syncOfflineData(): Promise<void> {
    if (!this.isOnline || !this.db) return;

    try {
      // Sync locations
      const unsyncedLocations = await this.getUnsyncedLocations();
      console.log(`Syncing ${unsyncedLocations.length} offline locations`);

      for (const location of unsyncedLocations) {
        try {
          await this.syncLocationToServer(location);
          
          // Mark as synced
          location.synced = true;
          await this.storeInIndexedDB(this.LOCATION_STORE, location);
          
          // Remove from sync queue
          this.syncQueue = this.syncQueue.filter(l => l.id !== location.id);
          
        } catch (error) {
          console.log(`Failed to sync location ${location.id}:`, error);
        }
      }

      // Clean up old synced data
      await this.cleanupOldData();

    } catch (error) {
      console.error('Error syncing offline data:', error);
    }
  }

  /**
   * Sync individual location to server
   */
  private static async syncLocationToServer(location: OfflineLocationData): Promise<void> {
    const { error } = await supabase
      .from('employee_locations')
      .upsert({
        user_id: location.user_id,
        latitude: location.latitude,
        longitude: location.longitude,
        timestamp: location.timestamp,
        location_accuracy: location.accuracy,
        battery_level: location.battery_level,
        connection_status: 'online',
        task_id: location.task_id,
      }, {
        onConflict: 'user_id',
      });

    if (error) throw error;
  }

  /**
   * Get unsynced locations from IndexedDB
   */
  private static async getUnsyncedLocations(): Promise<OfflineLocationData[]> {
    if (!this.db) return [];

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.LOCATION_STORE], 'readonly');
      const store = transaction.objectStore(this.LOCATION_STORE);
      const index = store.index('synced');
      const request = index.getAll(IDBKeyRange.only(false)); // Get unsynced items

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Store data in IndexedDB
   */
  private static async storeInIndexedDB(storeName: string, data: any): Promise<void> {
    if (!this.db) return;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.put(data);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Get data from IndexedDB
   */
  private static async getFromIndexedDB(storeName: string, key: string): Promise<any> {
    if (!this.db) return null;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([storeName], 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.get(key);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Get all data from a store
   */
  private static async getAllFromStore(storeName: string): Promise<any[]> {
    if (!this.db) return [];

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([storeName], 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Get tile coordinates for given bounds
   */
  private static getTileCoordinatesForBounds(
    bounds: { north: number; south: number; east: number; west: number },
    zoom: number
  ): Array<{ x: number; y: number }> {
    const tiles: Array<{ x: number; y: number }> = [];
    
    const minX = this.lonToTileX(bounds.west, zoom);
    const maxX = this.lonToTileX(bounds.east, zoom);
    const minY = this.latToTileY(bounds.north, zoom);
    const maxY = this.latToTileY(bounds.south, zoom);

    for (let x = minX; x <= maxX; x++) {
      for (let y = minY; y <= maxY; y++) {
        tiles.push({ x, y });
      }
    }

    return tiles;
  }

  /**
   * Convert longitude to tile X coordinate
   */
  private static lonToTileX(lon: number, zoom: number): number {
    return Math.floor((lon + 180) / 360 * Math.pow(2, zoom));
  }

  /**
   * Convert latitude to tile Y coordinate
   */
  private static latToTileY(lat: number, zoom: number): number {
    const latRad = lat * Math.PI / 180;
    return Math.floor((1 - Math.asinh(Math.tan(latRad)) / Math.PI) / 2 * Math.pow(2, zoom));
  }

  /**
   * Check if tile is fresh (less than 7 days old)
   */
  private static isTileFresh(timestamp: Date): boolean {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    return new Date(timestamp) > sevenDaysAgo;
  }

  /**
   * Clean up old cached data
   */
  private static async cleanupOldData(): Promise<void> {
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      // Clean up old synced locations
      if (this.db) {
        const transaction = this.db.transaction([this.LOCATION_STORE], 'readwrite');
        const store = transaction.objectStore(this.LOCATION_STORE);
        const index = store.index('timestamp');
        
        const range = IDBKeyRange.upperBound(thirtyDaysAgo.toISOString());
        const request = index.openCursor(range);
        
        request.onsuccess = (event) => {
          const cursor = (event.target as IDBRequest).result;
          if (cursor) {
            if (cursor.value.synced) {
              cursor.delete();
            }
            cursor.continue();
          }
        };
      }

      console.log('Cleaned up old cached data');

    } catch (error) {
      console.error('Error cleaning up old data:', error);
    }
  }

  /**
   * Get offline status
   */
  static isOffline(): boolean {
    return !this.isOnline;
  }

  /**
   * Get sync queue size
   */
  static getSyncQueueSize(): number {
    return this.syncQueue.length;
  }

  /**
   * Get storage usage statistics
   */
  static async getStorageStats(): Promise<{
    locations: number;
    tasks: number;
    geofences: number;
    tiles: number;
    totalSize: number;
  }> {
    try {
      const locations = await this.getAllFromStore(this.LOCATION_STORE);
      const tasks = await this.getAllFromStore(this.TASK_STORE);
      const geofences = await this.getAllFromStore(this.GEOFENCE_STORE);
      const tiles = await this.getAllFromStore(this.TILE_STORE);

      // Estimate storage size (rough calculation)
      const totalSize = (
        JSON.stringify(locations).length +
        JSON.stringify(tasks).length +
        JSON.stringify(geofences).length +
        tiles.reduce((size, tile) => size + (tile.blob?.size || 0), 0)
      ) / 1024 / 1024; // Convert to MB

      return {
        locations: locations.length,
        tasks: tasks.length,
        geofences: geofences.length,
        tiles: tiles.length,
        totalSize: Math.round(totalSize * 100) / 100, // Round to 2 decimal places
      };
    } catch (error) {
      console.error('Error getting storage stats:', error);
      return { locations: 0, tasks: 0, geofences: 0, tiles: 0, totalSize: 0 };
    }
  }

  /**
   * Clear all cached data
   */
  static async clearAllCache(): Promise<void> {
    try {
      if (this.db) {
        const stores = [this.LOCATION_STORE, this.TASK_STORE, this.GEOFENCE_STORE, this.TILE_STORE];
        
        for (const storeName of stores) {
          const transaction = this.db.transaction([storeName], 'readwrite');
          const store = transaction.objectStore(storeName);
          await new Promise<void>((resolve, reject) => {
            const request = store.clear();
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
          });
        }
      }
      
      this.syncQueue = [];
      console.log('All cached data cleared');

    } catch (error) {
      console.error('Error clearing cache:', error);
    }
  }

  /**
   * Utility delay function
   */
  private static delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Force sync now (manual trigger)
   */
  static async forceSyncNow(): Promise<void> {
    if (this.isOnline) {
      await this.syncOfflineData();
    } else {
      throw new Error('Cannot sync while offline');
    }
  }

  /**
   * Preload map area for offline use
   */
  static async preloadMapArea(
    centerLat: number,
    centerLng: number,
    radiusKm: number = 5,
    zoomLevels: number[] = [12, 14, 16]
  ): Promise<void> {
    // Calculate bounds for the radius
    const latDelta = radiusKm / 111; // Rough conversion: 1 degree ≈ 111 km
    const lngDelta = radiusKm / (111 * Math.cos(centerLat * Math.PI / 180));

    const bounds = {
      north: centerLat + latDelta,
      south: centerLat - latDelta,
      east: centerLng + lngDelta,
      west: centerLng - lngDelta,
    };

    await this.cacheMapTiles(bounds, zoomLevels);
  }
}