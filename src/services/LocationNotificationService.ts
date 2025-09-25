import { supabase } from '../lib/supabase';
import { RealTimeLocationService } from './RealTimeLocationService';
import { LocationTaskService } from './LocationTaskService';
import { GeofencingService } from './GeofencingService';
import toast from 'react-hot-toast';

export interface LocationNotification {
  id: string;
  type: 'arrival' | 'departure' | 'proximity' | 'deadline' | 'check_in_reminder';
  title: string;
  message: string;
  taskId?: string;
  geofenceId?: string;
  latitude?: number;
  longitude?: number;
  distance?: number;
  priority: 'low' | 'medium' | 'high' | 'critical';
  timestamp: string;
  isRead: boolean;
  actionUrl?: string;
}

export class LocationNotificationService {
  private static notificationQueue: LocationNotification[] = [];
  private static isProcessing = false;
  private static subscribers: Map<string, (notification: LocationNotification) => void> = new Map();

  /**
   * Initialize notification service with location tracking
   */
  static async initialize(userId: string): Promise<void> {
    try {
      // Request notification permission
      await this.requestNotificationPermission();

      // Start location tracking with notification checks
      await RealTimeLocationService.startLocationTracking(userId, {
        updateInterval: 30000, // Check every 30 seconds
      });

      // Subscribe to real-time location updates
      RealTimeLocationService.subscribeToLocationUpdates(userId, {
        onLocationUpdate: (update) => this.handleLocationUpdate(update),
        onTaskLocationEvent: (event) => this.handleTaskLocationEvent(event),
        onGeofenceEvent: (event) => this.handleGeofenceEvent(event),
      });

      // Set up periodic checks for reminders
      this.setupPeriodicChecks(userId);

    } catch (error) {
      console.error('Error initializing location notifications:', error);
    }
  }

  /**
   * Request notification permission from browser
   */
  static async requestNotificationPermission(): Promise<boolean> {
    if (!('Notification' in window)) {
      console.log('This browser does not support notifications');
      return false;
    }

    if (Notification.permission === 'granted') {
      return true;
    }

    if (Notification.permission === 'denied') {
      return false;
    }

    const permission = await Notification.requestPermission();
    return permission === 'granted';
  }

  /**
   * Handle location updates and check for notifications
   */
  private static async handleLocationUpdate(update: any): Promise<void> {
    try {
      // Check proximity to task locations
      const proximityResults = await RealTimeLocationService.checkTaskLocationProximity(
        update.user_id,
        { lat: update.latitude, lng: update.longitude }
      );

      for (const result of proximityResults) {
        if (result.distance <= 100 && result.isWithinLocation) {
          // User is very close to task location
          await this.createNotification({
            type: 'arrival',
            title: 'Task Location Reached',
            message: `You've arrived at the location for "${result.taskTitle}". Don't forget to check in!`,
            taskId: result.taskId,
            latitude: update.latitude,
            longitude: update.longitude,
            distance: result.distance,
            priority: 'high',
            timestamp: new Date().toISOString(),
          });
        } else if (result.distance <= 500 && result.distance > 100) {
          // User is approaching task location
          await this.createNotification({
            type: 'proximity',
            title: 'Approaching Task Location',
            message: `You're ${Math.round(result.distance)}m away from "${result.taskTitle}" location.`,
            taskId: result.taskId,
            latitude: update.latitude,
            longitude: update.longitude,
            distance: result.distance,
            priority: 'medium',
            timestamp: new Date().toISOString(),
          });
        }
      }

    } catch (error) {
      console.error('Error handling location update:', error);
    }
  }

  /**
   * Handle task location events
   */
  private static async handleTaskLocationEvent(event: any): Promise<void> {
    try {
      let notification: Partial<LocationNotification> = {
        taskId: event.task_id,
        latitude: event.latitude,
        longitude: event.longitude,
        timestamp: event.timestamp,
      };

      switch (event.event_type) {
        case 'check_in':
          notification = {
            ...notification,
            type: 'arrival',
            title: 'Successfully Checked In',
            message: 'You have successfully checked in to the task location.',
            priority: 'medium',
          };
          break;

        case 'check_out':
          notification = {
            ...notification,
            type: 'departure',
            title: 'Checked Out',
            message: 'You have checked out from the task location.',
            priority: 'low',
          };
          break;

        case 'arrival':
          notification = {
            ...notification,
            type: 'arrival',
            title: 'Location Reached',
            message: 'You have arrived at the task location.',
            priority: 'medium',
          };
          break;

        case 'departure':
          notification = {
            ...notification,
            type: 'departure',
            title: 'Left Location',
            message: 'You have left the task location area.',
            priority: 'low',
          };
          break;

        case 'boundary_violation':
          notification = {
            ...notification,
            type: 'proximity',
            title: 'Location Boundary Alert',
            message: 'You have moved outside the required task location area.',
            priority: 'high',
          };
          break;
      }

      if (notification.type) {
        await this.createNotification(notification as Omit<LocationNotification, 'id' | 'isRead'>);
      }

    } catch (error) {
      console.error('Error handling task location event:', error);
    }
  }

  /**
   * Handle geofence events
   */
  private static async handleGeofenceEvent(event: any): Promise<void> {
    try {
      const notification: Partial<LocationNotification> = {
        type: event.alert_type === 'arrival' ? 'arrival' : 'departure',
        title: event.title,
        message: event.message,
        geofenceId: event.geofence_id,
        latitude: event.latitude,
        longitude: event.longitude,
        priority: event.priority,
        timestamp: event.created_at,
      };

      await this.createNotification(notification as Omit<LocationNotification, 'id' | 'isRead'>);

    } catch (error) {
      console.error('Error handling geofence event:', error);
    }
  }

  /**
   * Create and display a notification
   */
  static async createNotification(
    notificationData: Omit<LocationNotification, 'id' | 'isRead'>
  ): Promise<void> {
    try {
      const notification: LocationNotification = {
        ...notificationData,
        id: `notification_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        timestamp: notificationData.timestamp || new Date().toISOString(),
        isRead: false,
      };

      // Add to queue
      this.notificationQueue.push(notification);

      // Process queue
      await this.processNotificationQueue();

      // Store in database
      await this.storeNotification(notification);

      // Notify subscribers
      this.notifySubscribers(notification);

    } catch (error) {
      console.error('Error creating notification:', error);
    }
  }

  /**
   * Process notification queue to avoid spam
   */
  private static async processNotificationQueue(): Promise<void> {
    if (this.isProcessing || this.notificationQueue.length === 0) {
      return;
    }

    this.isProcessing = true;

    try {
      // Group similar notifications to avoid spam
      const groupedNotifications = new Map<string, LocationNotification[]>();
      
      for (const notification of this.notificationQueue) {
        const key = `${notification.type}_${notification.taskId || notification.geofenceId}`;
        if (!groupedNotifications.has(key)) {
          groupedNotifications.set(key, []);
        }
        groupedNotifications.get(key)!.push(notification);
      }

      // Process each group (show only the latest notification per group)
      for (const [key, notifications] of groupedNotifications) {
        const latestNotification = notifications.sort(
          (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        )[0];

        await this.displayNotification(latestNotification);
      }

      // Clear the queue
      this.notificationQueue = [];

    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Display notification to user
   */
  private static async displayNotification(notification: LocationNotification): Promise<void> {
    try {
      // Show browser notification if permission granted
      if (Notification.permission === 'granted') {
        const browserNotification = new Notification(notification.title, {
          body: notification.message,
          icon: '/favicon.ico',
          badge: '/favicon.ico',
          tag: notification.id,
          requireInteraction: notification.priority === 'critical',
        });

        browserNotification.onclick = () => {
          if (notification.actionUrl) {
            window.open(notification.actionUrl, '_blank');
          }
          browserNotification.close();
        };

        // Auto-close after 5 seconds unless critical
        if (notification.priority !== 'critical') {
          setTimeout(() => {
            browserNotification.close();
          }, 5000);
        }
      }

      // Show toast notification
      const toastOptions = {
        duration: notification.priority === 'critical' ? 10000 : 4000,
        position: 'top-right' as const,
      };

      switch (notification.priority) {
        case 'critical':
          toast.error(notification.message, toastOptions);
          break;
        case 'high':
          toast.error(notification.message, toastOptions);
          break;
        case 'medium':
          toast.success(notification.message, toastOptions);
          break;
        case 'low':
          toast(notification.message, toastOptions);
          break;
      }

    } catch (error) {
      console.error('Error displaying notification:', error);
    }
  }

  /**
   * Store notification in database
   */
  private static async storeNotification(notification: LocationNotification): Promise<void> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from('location_alerts')
        .insert({
          user_id: user.id,
          task_id: notification.taskId,
          alert_type: notification.type,
          title: notification.title,
          message: notification.message,
          latitude: notification.latitude,
          longitude: notification.longitude,
          priority: notification.priority,
          is_read: notification.isRead,
        });

      if (error) {
        console.error('Error storing notification:', error);
      }
    } catch (error) {
      console.error('Error storing notification:', error);
    }
  }

  /**
   * Set up periodic checks for reminders
   */
  private static setupPeriodicChecks(userId: string): void {
    // Check every 5 minutes for reminders
    setInterval(async () => {
      await this.checkForReminders(userId);
    }, 5 * 60 * 1000);
  }

  /**
   * Check for various reminder conditions
   */
  private static async checkForReminders(userId: string): Promise<void> {
    try {
      // Get user's current location
      const currentLocation = await RealTimeLocationService.getCurrentLocation();
      
      // Get active tasks
      const tasks = await LocationTaskService.getLocationBasedTasks({
        assigned_to: userId,
        status: 'In Progress',
      });

      for (const task of tasks) {
        // Check if task is due soon and user is not at location
        const dueDate = new Date(task.due_date);
        const now = new Date();
        const hoursUntilDue = (dueDate.getTime() - now.getTime()) / (1000 * 60 * 60);

        if (hoursUntilDue <= 2 && hoursUntilDue > 0) {
          if (task.task_locations?.[0]) {
            const locationCheck = await LocationTaskService.checkEmployeeInTaskLocation(
              task.id,
              currentLocation
            );

            if (!locationCheck.isWithinLocation) {
              await this.createNotification({
                type: 'deadline',
                title: 'Task Deadline Approaching',
                message: `"${task.title}" is due in ${Math.round(hoursUntilDue)} hour(s). You're not at the required location yet.`,
                taskId: task.id,
                priority: 'high',
                actionUrl: `/tasks?highlight=${task.id}`,
                timestamp: new Date().toISOString(),
              });
            }
          }
        }

        // Check if user has been at location for a while without checking in
        if (task.task_locations?.[0]) {
          const locationCheck = await LocationTaskService.checkEmployeeInTaskLocation(
            task.id,
            currentLocation
          );

          if (locationCheck.isWithinLocation) {
            // Check if user has been here for more than 10 minutes without checking in
            // This would require tracking when they arrived, which we'll implement later
              await this.createNotification({
              type: 'check_in_reminder',
              title: 'Check In Reminder',
              message: `You're at the location for "${task.title}". Don't forget to check in!`,
              taskId: task.id,
              priority: 'medium',
                timestamp: new Date().toISOString(),
            });
          }
        }
      }

    } catch (error) {
      console.error('Error checking for reminders:', error);
    }
  }

  /**
   * Subscribe to notifications
   */
  static subscribe(
    subscriberId: string,
    callback: (notification: LocationNotification) => void
  ): void {
    this.subscribers.set(subscriberId, callback);
  }

  /**
   * Unsubscribe from notifications
   */
  static unsubscribe(subscriberId: string): void {
    this.subscribers.delete(subscriberId);
  }

  /**
   * Notify all subscribers
   */
  private static notifySubscribers(notification: LocationNotification): void {
    for (const callback of this.subscribers.values()) {
      try {
        callback(notification);
      } catch (error) {
        console.error('Error notifying subscriber:', error);
      }
    }
  }

  /**
   * Get notification history
   */
  static async getNotificationHistory(userId: string, limit = 50): Promise<LocationNotification[]> {
    try {
      const { data, error } = await supabase
        .from('location_alerts')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;

      return (data || []).map(alert => ({
        id: alert.id,
        type: alert.alert_type,
        title: alert.title,
        message: alert.message,
        taskId: alert.task_id,
        latitude: alert.latitude,
        longitude: alert.longitude,
        priority: alert.priority,
        timestamp: alert.created_at,
        isRead: alert.is_read,
      }));

    } catch (error) {
      console.error('Error fetching notification history:', error);
      return [];
    }
  }

  /**
   * Mark notification as read
   */
  static async markAsRead(notificationId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('location_alerts')
        .update({ is_read: true })
        .eq('id', notificationId);

      if (error) throw error;
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  }

  /**
   * Clear all notifications
   */
  static async clearAllNotifications(userId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('location_alerts')
        .update({ is_read: true })
        .eq('user_id', userId);

      if (error) throw error;
    } catch (error) {
      console.error('Error clearing notifications:', error);
    }
  }

  /**
   * Stop notification service
   */
  static stop(): void {
    RealTimeLocationService.stopLocationTracking();
    this.subscribers.clear();
    this.notificationQueue = [];
  }
}