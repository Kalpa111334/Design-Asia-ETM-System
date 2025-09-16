import { supabase } from '../lib/supabase';
import { LocationService } from './LocationService';

export interface EnhancedLocationData {
  latitude: number;
  longitude: number;
  accuracy?: number;
  timestamp: string;
  battery_level?: number;
  connection_status?: 'online' | 'offline';
  task_id?: string;
  speed?: number;
  heading?: number;
  altitude?: number;
}

export class EnhancedLocationService extends LocationService {
  static async getEmployeeLocations(): Promise<any[]> {
    try {
      // First try the RPC function
      const { data: rpcData, error: rpcError } = await supabase.rpc('get_latest_employee_locations');
      
      if (!rpcError && rpcData && rpcData.length > 0) {
        // Use RPC data if available
        return rpcData.map((row: any) => ({
          id: row.id,
          user_id: row.user_id,
          latitude: row.latitude,
          longitude: row.longitude,
          timestamp: row.recorded_at || row.timestamp,
          battery_level: row.battery_level,
          connection_status: row.connection_status,
          location_accuracy: row.location_accuracy,
          task_id: row.task_id,
          users: {
            full_name: row.full_name || row.email?.split('@')[0] || `User ${row.user_id.slice(0, 8)}`,
            avatar_url: row.avatar_url ?? null,
          },
        }));
      }

      // Fallback: Direct query with manual user joining
      const { data: locations, error: locationError } = await supabase
        .from('employee_locations')
        .select('*')
        .order('timestamp', { ascending: false });

      if (locationError) {
        console.warn('Error fetching locations:', locationError);
        return [];
      }

      // Get all unique user IDs
      const userIds = [...new Set(locations?.map(loc => loc.user_id) || [])];
      
      // Fetch user data from both tables
      const { data: publicUsers } = await supabase
        .from('users')
        .select('id, full_name, email, avatar_url')
        .in('id', userIds);

      // Try to get current user's auth data as a fallback
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      const authUsersMap = new Map();
      
      if (currentUser) {
        authUsersMap.set(currentUser.id, {
          full_name: currentUser.user_metadata?.full_name,
          email: currentUser.email
        });
      }

      const publicUsersMap = new Map(publicUsers?.map(user => [user.id, user]) || []);

      // Combine location data with user data
      return locations?.map((location: any) => {
        const publicUser = publicUsersMap.get(location.user_id);
        const authUser = authUsersMap.get(location.user_id);
        
        let fullName = 'Unknown Employee';
        let email = '';
        
        if (publicUser?.full_name) {
          fullName = publicUser.full_name;
          email = publicUser.email || '';
        } else if (authUser?.full_name) {
          fullName = authUser.full_name;
          email = authUser.email || '';
        } else if (authUser?.email) {
          fullName = authUser.email.split('@')[0];
          email = authUser.email;
        } else {
          fullName = `User ${location.user_id.slice(0, 8)}`;
        }

        return {
          id: location.id,
          user_id: location.user_id,
          latitude: location.latitude,
          longitude: location.longitude,
          timestamp: location.timestamp,
          battery_level: location.battery_level,
          connection_status: location.connection_status,
          location_accuracy: location.location_accuracy,
          task_id: location.task_id,
          users: {
            full_name: fullName,
            avatar_url: publicUser?.avatar_url ?? null,
          },
        };
      }) || [];
    } catch (error) {
      console.error('Error in getEmployeeLocations:', error);
      throw error;
    }
  }

  static async getLocationWithTaskInfo(userId: string): Promise<any | null> {
    try {
      // Get the latest location for the user
      const { data: location, error: locationError } = await supabase
        .from('employee_locations')
        .select('*')
        .eq('user_id', userId)
        .order('timestamp', { ascending: false })
        .limit(1)
        .single();

      if (locationError && locationError.code !== 'PGRST116') {
        throw locationError;
      }

      if (!location) {
        return null;
      }

      // Get user data separately
      const { data: user, error: userError } = await supabase
        .from('users')
        .select('id, full_name, avatar_url')
        .eq('id', userId)
        .single();

      if (userError) {
        console.warn('User not found:', userError);
      }

      // Get task data if task_id exists
      let taskData = null;
      if (location.task_id) {
        const { data: task, error: taskError } = await supabase
          .from('tasks')
          .select('id, title, status')
          .eq('id', location.task_id)
          .single();

        if (!taskError) {
          taskData = task;
        }
      }

      return {
        ...location,
        users: user || { 
          full_name: `User ${userId.slice(0, 8)}`, 
          avatar_url: null 
        },
        tasks: taskData
      };
    } catch (error) {
      console.error('Error in getLocationWithTaskInfo:', error);
      throw error;
    }
  }

  static async getEmployeeLocationsByTask(taskId: string): Promise<any[]> {
    try {
      // Get locations for the task
      const { data: locations, error: locationsError } = await supabase
        .from('employee_locations')
        .select('*')
        .eq('task_id', taskId)
        .order('timestamp', { ascending: false });

      if (locationsError) {
        throw locationsError;
      }

      if (!locations || locations.length === 0) {
        return [];
      }

      // Get unique user IDs
      const userIds = [...new Set(locations.map(loc => loc.user_id))];

      // Fetch user data separately
      const { data: users, error: usersError } = await supabase
        .from('users')
        .select('id, full_name, avatar_url')
        .in('id', userIds);

      if (usersError) {
        throw usersError;
      }

      // Create a map of users for quick lookup
      const userMap = new Map(users?.map(user => [user.id, user]) || []);

      // Attach user data to locations
      return locations.map(location => ({
        ...location,
        users: userMap.get(location.user_id) || { 
          full_name: `User ${location.user_id.slice(0, 8)}`, 
          avatar_url: null 
        }
      }));
    } catch (error) {
      console.error('Error in getEmployeeLocationsByTask:', error);
      throw error;
    }
  }

  static async updateLocationWithTask(userId: string, taskId: string | null): Promise<void> {
    try {
      // Get the latest location for the user
      const { data: latestLocation, error: fetchError } = await supabase
        .from('employee_locations')
        .select('*')
        .eq('user_id', userId)
        .order('timestamp', { ascending: false })
        .limit(1)
        .single();

      if (fetchError || !latestLocation) {
        console.warn('No location found to update with task info');
        return;
      }

      // Update the latest location with task information
      const { error: updateError } = await supabase
        .from('employee_locations')
        .update({ task_id: taskId })
        .eq('id', latestLocation.id);

      if (updateError) {
        throw updateError;
      }
    } catch (error) {
      console.error('Error in updateLocationWithTask:', error);
      throw error;
    }
  }

  static async getLocationAnalytics(userId?: string, days: number = 7): Promise<any> {
    try {
      const since = new Date();
      since.setDate(since.getDate() - days);

      let query = supabase
        .from('employee_locations')
        .select('*')
        .gte('timestamp', since.toISOString());

      if (userId) {
        query = query.eq('user_id', userId);
      }

      const { data: locations, error: locationsError } = await query.order('timestamp', { ascending: true });

      if (locationsError) {
        throw locationsError;
      }

      if (!locations || locations.length === 0) {
        return {
          totalLocations: 0,
          uniqueUsers: 0,
          averageAccuracy: 0,
          locationsByDay: {},
          userActivity: {},
        };
      }

      // Get user data for names
      const userIds = [...new Set(locations.map(loc => loc.user_id))];
      const { data: users, error: usersError } = await supabase
        .from('users')
        .select('id, full_name')
        .in('id', userIds);

      if (usersError) {
        throw usersError;
      }

      const userMap = new Map(users?.map(user => [user.id, user]) || []);

      // Process analytics data
      const analytics = {
        totalLocations: locations.length,
        uniqueUsers: userIds.length,
        averageAccuracy: 0,
        locationsByDay: {} as Record<string, number>,
        userActivity: {} as Record<string, { name: string; count: number; lastSeen: string }>,
      };

      // Calculate average accuracy
      const accuracyValues = locations.filter(l => l.location_accuracy).map(l => l.location_accuracy);
      if (accuracyValues.length > 0) {
        analytics.averageAccuracy = accuracyValues.reduce((sum, acc) => sum + acc, 0) / accuracyValues.length;
      }

      // Group by day
      locations.forEach(location => {
        const day = new Date(location.timestamp).toDateString();
        analytics.locationsByDay[day] = (analytics.locationsByDay[day] || 0) + 1;
      });

      // User activity
      locations.forEach(location => {
        const userId = location.user_id;
        const userData = userMap.get(userId);
        if (!analytics.userActivity[userId]) {
          analytics.userActivity[userId] = {
            name: userData?.full_name || `User ${userId.slice(0, 8)}`,
            count: 0,
            lastSeen: location.timestamp,
          };
        }
        analytics.userActivity[userId].count++;
        if (new Date(location.timestamp) > new Date(analytics.userActivity[userId].lastSeen)) {
          analytics.userActivity[userId].lastSeen = location.timestamp;
        }
      });

      return analytics;
    } catch (error) {
      console.error('Error in getLocationAnalytics:', error);
      throw error;
    }
  }
}