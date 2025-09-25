import { supabase } from '../lib/supabase';

export interface UserPagePermission {
  id: string;
  user_id: string;
  page_name: string;
  permission_type: 'view' | 'edit' | 'none';
  granted_at: string;
  granted_by?: string;
  created_at: string;
  updated_at: string;
}

export interface UserWithPermissions {
  id: string;
  email: string;
  full_name: string;
  role: 'admin' | 'employee';
  avatar_url?: string;
  permissions: UserPagePermission[];
}

export interface PageDefinition {
  name: string;
  displayName: string;
  description: string;
  icon: string;
  category: string;
  roles: ('admin' | 'employee')[];
}

export class UserPagePermissionsService {
  // Define all available pages in the system
  static readonly PAGES: PageDefinition[] = [
    {
      name: 'dashboard',
      displayName: 'Dashboard',
      description: 'Main dashboard with overview and statistics',
      icon: 'ChartBarIcon',
      category: 'General',
      roles: ['admin', 'employee']
    },
    {
      name: 'tasks',
      displayName: 'Tasks',
      description: 'Task management and assignment',
      icon: 'ClipboardListIcon',
      category: 'Tasks',
      roles: ['admin', 'employee']
    },
    {
      name: 'task_pool',
      displayName: 'Task Pool',
      description: 'Available tasks for assignment',
      icon: 'QueueListIcon',
      category: 'Tasks',
      roles: ['admin']
    },
    {
      name: 'employee_tracking',
      displayName: 'Employee Tracking',
      description: 'Real-time employee location tracking',
      icon: 'MapPinIcon',
      category: 'Tracking',
      roles: ['admin']
    },
    {
      name: 'location_management',
      displayName: 'Location Management',
      description: 'Manage geofences and locations',
      icon: 'MapIcon',
      category: 'Tracking',
      roles: ['admin']
    },
    {
      name: 'meetings',
      displayName: 'Meetings',
      description: 'Schedule and manage meetings',
      icon: 'VideoCameraIcon',
      category: 'Communication',
      roles: ['admin', 'employee']
    },
    {
      name: 'reports',
      displayName: 'Reports',
      description: 'Generate and view reports',
      icon: 'DocumentChartBarIcon',
      category: 'Analytics',
      roles: ['admin']
    },
    {
      name: 'analytics',
      displayName: 'Analytics',
      description: 'Data analytics and insights',
      icon: 'ChartBarSquareIcon',
      category: 'Analytics',
      roles: ['admin']
    },
    {
      name: 'employee_management',
      displayName: 'Employee Management',
      description: 'Manage employee accounts and information',
      icon: 'UserGroupIcon',
      category: 'Administration',
      roles: ['admin']
    },
    {
      name: 'permissions_settings',
      displayName: 'Permissions & Roles',
      description: 'Manage user permissions and roles',
      icon: 'ShieldCheckIcon',
      category: 'Administration',
      roles: ['admin']
    }
  ];

  // Get all users with their page permissions
  static async getUsersWithPermissions(): Promise<UserWithPermissions[]> {
    try {
      // Get users from public.users table instead of auth.users
      const { data: users, error: usersError } = await supabase
        .from('users')
        .select('*')
        .order('created_at', { ascending: false });

      if (usersError) {
        console.error('Error fetching users:', usersError);
        return [];
      }

      if (!users || users.length === 0) {
        console.log('No users found in public.users table, trying auth.users');
        
        // Fallback: try to get users from auth.users
        try {
          const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers();
          
          if (authError) {
            console.error('Error fetching auth users:', authError);
            return [];
          }
          
          if (!authUsers?.users || authUsers.users.length === 0) {
            console.log('No users found in auth.users either');
            return [];
          }
          
          // Convert auth users to our format
          const authUsersWithPermissions: UserWithPermissions[] = authUsers.users.map(user => ({
            id: user.id,
            email: user.email || '',
            full_name: user.user_metadata?.full_name || '',
            role: (user.user_metadata?.role as 'admin' | 'employee') || 'employee',
            avatar_url: user.user_metadata?.avatar_url,
            permissions: []
          }));
          
          console.log('Found auth users:', authUsersWithPermissions.length);
          return authUsersWithPermissions;
        } catch (authError) {
          console.error('Error fetching auth users:', authError);
          return [];
        }
      }

      // Get page permissions for all users
      const { data: permissions, error: permissionsError } = await supabase
        .from('user_page_permissions')
        .select('*')
        .order('user_id, page_name');

      if (permissionsError) {
        console.error('Error fetching permissions:', permissionsError);
        // Don't return empty array, continue with empty permissions
      }

      // Combine users with their permissions
      const usersWithPermissions: UserWithPermissions[] = users.map(user => {
        const userPermissions = permissions?.filter(p => p.user_id === user.id) || [];
        
        return {
          id: user.id,
          email: user.email || '',
          full_name: user.full_name || '',
          role: (user.role as 'admin' | 'employee') || 'employee',
          avatar_url: user.avatar_url,
          permissions: userPermissions
        };
      });

      console.log('Found users with permissions:', usersWithPermissions.length);
      return usersWithPermissions;
    } catch (error) {
      console.error('Error in getUsersWithPermissions:', error);
      return [];
    }
  }

  // Get permissions for a specific user
  static async getUserPermissions(userId: string): Promise<UserPagePermission[]> {
    try {
      const { data, error } = await supabase
        .from('user_page_permissions')
        .select('*')
        .eq('user_id', userId)
        .order('page_name');

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error getting user permissions:', error);
      return [];
    }
  }

  // Set permission for a specific user and page
  static async setUserPagePermission(
    userId: string, 
    pageName: string, 
    permissionType: 'view' | 'edit' | 'none'
  ): Promise<boolean> {
    try {
      const { error } = await supabase.rpc('set_user_page_permission', {
        user_uuid: userId,
        page: pageName,
        permission: permissionType
      });

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error setting user page permission:', error);
      return false;
    }
  }

  // Bulk update permissions for a user
  static async updateUserPermissions(
    userId: string, 
    permissions: { pageName: string; permissionType: 'view' | 'edit' | 'none' }[]
  ): Promise<boolean> {
    try {
      // Update each permission
      for (const permission of permissions) {
        const success = await this.setUserPagePermission(
          userId, 
          permission.pageName, 
          permission.permissionType
        );
        
        if (!success) {
          return false;
        }
      }
      
      return true;
    } catch (error) {
      console.error('Error updating user permissions:', error);
      return false;
    }
  }

  // Check if user has permission for a specific page
  static async hasUserPagePermission(
    userId: string, 
    pageName: string, 
    requiredPermission: 'view' | 'edit'
  ): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .from('user_page_permissions')
        .select('permission_type')
        .eq('user_id', userId)
        .eq('page_name', pageName)
        .single();

      if (error) {
        console.warn('Permission not found for user:', userId, 'page:', pageName);
        return false;
      }

      const permission = data.permission_type;
      
      if (requiredPermission === 'view') {
        return permission === 'view' || permission === 'edit';
      } else if (requiredPermission === 'edit') {
        return permission === 'edit';
      }
      
      return false;
    } catch (error) {
      console.error('Error checking user page permission:', error);
      return false;
    }
  }

  // Get current user's permissions
  static async getCurrentUserPermissions(): Promise<UserPagePermission[]> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      
      return await this.getUserPermissions(user.id);
    } catch (error) {
      console.error('Error getting current user permissions:', error);
      return [];
    }
  }

  // Check if current user can access a page
  static async canCurrentUserAccess(pageName: string, requiredPermission: 'view' | 'edit' = 'view'): Promise<boolean> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return false;
      
      return await this.hasUserPagePermission(user.id, pageName, requiredPermission);
    } catch (error) {
      console.error('Error checking current user access:', error);
      return false;
    }
  }

  // Get pages grouped by category
  static getPagesByCategory(): { [category: string]: PageDefinition[] } {
    const grouped: { [category: string]: PageDefinition[] } = {};
    
    this.PAGES.forEach(page => {
      if (!grouped[page.category]) {
        grouped[page.category] = [];
      }
      grouped[page.category].push(page);
    });
    
    return grouped;
  }

  // Get pages filtered by role
  static getPagesByRole(role: 'admin' | 'employee'): PageDefinition[] {
    return this.PAGES.filter(page => page.roles.includes(role));
  }

  // Get pages grouped by category for a specific role
  static getPagesByCategoryForRole(role: 'admin' | 'employee'): { [category: string]: PageDefinition[] } {
    const filteredPages = this.getPagesByRole(role);
    const grouped: { [category: string]: PageDefinition[] } = {};
    
    filteredPages.forEach(page => {
      if (!grouped[page.category]) {
        grouped[page.category] = [];
      }
      grouped[page.category].push(page);
    });
    
    return grouped;
  }

  // Get all available pages
  static getAllPages(): PageDefinition[] {
    return this.PAGES;
  }
}
