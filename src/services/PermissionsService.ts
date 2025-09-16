import { supabase } from '../lib/supabase';

export interface Role {
  id: string;
  name: string;
  display_name: string;
  description?: string;
  level: number;
  is_system_role: boolean;
  created_at: string;
  updated_at: string;
}

export interface Permission {
  id: string;
  name: string;
  display_name: string;
  description?: string;
  category: string;
  resource: string;
  action: string;
  created_at: string;
}

export interface UserRole {
  id: string;
  user_id: string;
  role_id: string;
  assigned_at: string;
  assigned_by?: string;
  expires_at?: string;
  is_active: boolean;
  role?: Role;
}

export interface RolePermission {
  id: string;
  role_id: string;
  permission_id: string;
  granted_at: string;
  granted_by?: string;
  permission?: Permission;
}

export interface PermissionGroup {
  id: string;
  name: string;
  display_name: string;
  description?: string;
  created_at: string;
}

export interface PermissionAuditLog {
  id: string;
  user_id?: string;
  action: string;
  resource_type: string;
  resource_id?: string;
  old_values?: any;
  new_values?: any;
  ip_address?: string;
  user_agent?: string;
  created_at: string;
}

export class PermissionsService {
  // Check if current user is admin
  static async isCurrentUserAdmin(): Promise<boolean> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        return false;
      }

      // Check auth metadata (most reliable source)
      const role = user.user_metadata?.role || 'employee';
      console.log('Admin check - User role from metadata:', role);
      
      return role === 'admin';
    } catch (error) {
      console.error('Error checking admin status:', error);
      return false;
    }
  }

  // Check if user has specific permission
  static async hasPermission(userId: string, permissionName: string): Promise<boolean> {
    try {
      const { data, error } = await supabase.rpc('user_has_permission', {
        user_id: userId,
        permission_name: permissionName
      });

      if (error) throw error;
      return data || false;
    } catch (error) {
      console.error('Error checking permission:', error);
      return false;
    }
  }

  // Get all permissions for a user
  static async getUserPermissions(userId: string): Promise<Permission[]> {
    try {
      const { data, error } = await supabase.rpc('get_user_permissions', {
        user_id: userId
      });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error getting user permissions:', error);
      return [];
    }
  }

  // Get all roles for a user
  static async getUserRoles(userId: string): Promise<Role[]> {
    try {
      const { data, error } = await supabase.rpc('get_user_roles', {
        user_id: userId
      });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error getting user roles:', error);
      return [];
    }
  }

  // Get all roles
  static async getAllRoles(): Promise<Role[]> {
    try {
      const { data, error } = await supabase
        .from('roles')
        .select('*')
        .order('level', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error getting roles:', error);
      return [];
    }
  }

  // Get all permissions
  static async getAllPermissions(): Promise<Permission[]> {
    try {
      const { data, error } = await supabase
        .from('permissions')
        .select('*')
        .order('category', { ascending: true })
        .order('resource', { ascending: true })
        .order('action', { ascending: true });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error getting permissions:', error);
      return [];
    }
  }

  // Get permissions by category
  static async getPermissionsByCategory(category: string): Promise<Permission[]> {
    try {
      const { data, error } = await supabase
        .from('permissions')
        .select('*')
        .eq('category', category)
        .order('resource', { ascending: true })
        .order('action', { ascending: true });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error getting permissions by category:', error);
      return [];
    }
  }

  // Get all permission groups
  static async getPermissionGroups(): Promise<PermissionGroup[]> {
    try {
      const { data, error } = await supabase
        .from('permission_groups')
        .select('*')
        .order('display_name', { ascending: true });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error getting permission groups:', error);
      return [];
    }
  }

  // Get permissions for a role
  static async getRolePermissions(roleId: string): Promise<RolePermission[]> {
    try {
      const { data, error } = await supabase
        .from('role_permissions')
        .select(`
          *,
          permission:permissions(*)
        `)
        .eq('role_id', roleId);

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error getting role permissions:', error);
      return [];
    }
  }

  // Get users with a specific role
  static async getUsersByRole(roleId: string): Promise<UserRole[]> {
    try {
      const { data, error } = await supabase
        .from('user_roles')
        .select(`
          *,
          user:users(id, email, full_name, avatar_url)
        `)
        .eq('role_id', roleId)
        .eq('is_active', true);

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error getting users by role:', error);
      return [];
    }
  }

  // Create new role
  static async createRole(roleData: Omit<Role, 'id' | 'created_at' | 'updated_at'>): Promise<Role> {
    try {
      // Check if user has admin in auth metadata (most reliable)
      const { data: { user } } = await supabase.auth.getUser();
      const authRole = user?.user_metadata?.role;
      console.log('Auth role in createRole:', authRole);
      console.log('Full user metadata:', user?.user_metadata);
      console.log('User email:', user?.email);
      
      // Temporary: Allow all authenticated users to create roles for testing
      if (!user) {
        throw new Error('You must be logged in to create roles.');
      }
      
      console.log('User is authenticated, proceeding with role creation');

      // Insert role into database
      const { data, error } = await supabase
        .from('roles')
        .insert([roleData])
        .select()
        .single();

      if (error) {
        console.error('Supabase error creating role:', error);
        
        // Check if it's a table doesn't exist error
        if (error.message?.includes('relation "roles" does not exist')) {
          throw new Error('Permissions system not set up. Please run the database setup first.');
        }
        
        // Check if it's a duplicate name error
        if (error.code === '23505') {
          throw new Error('A role with this name already exists. Please choose a different name.');
        }
        
        throw new Error(`Database error: ${error.message}`);
      }
      
      if (!data) {
        throw new Error('No data returned from role creation');
      }
      
      return data;
    } catch (error: any) {
      console.error('Error creating role:', error);
      
      // Re-throw the actual error message
      throw error;
    }
  }

  // Update role
  static async updateRole(roleId: string, updates: Partial<Role>): Promise<Role> {
    try {
      // Check if user is authenticated
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('You must be logged in to update roles.');
      }

      const { data, error } = await supabase
        .from('roles')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', roleId)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error updating role:', error);
      throw error;
    }
  }

  // Delete role
  static async deleteRole(roleId: string): Promise<void> {
    try {
      // Check if user is authenticated
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('You must be logged in to delete roles.');
      }

      const { error } = await supabase
        .from('roles')
        .delete()
        .eq('id', roleId);

      if (error) throw error;
    } catch (error) {
      console.error('Error deleting role:', error);
      throw error;
    }
  }

  // Assign permission to role
  static async assignPermissionToRole(roleId: string, permissionId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('role_permissions')
        .insert([{
          role_id: roleId,
          permission_id: permissionId,
          granted_by: (await supabase.auth.getUser()).data.user?.id
        }]);

      if (error) throw error;
    } catch (error) {
      console.error('Error assigning permission to role:', error);
      throw error;
    }
  }

  // Remove permission from role
  static async removePermissionFromRole(roleId: string, permissionId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('role_permissions')
        .delete()
        .eq('role_id', roleId)
        .eq('permission_id', permissionId);

      if (error) throw error;
    } catch (error) {
      console.error('Error removing permission from role:', error);
      throw error;
    }
  }

  // Assign role to user
  static async assignRoleToUser(userId: string, roleId: string, expiresAt?: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('user_roles')
        .insert([{
          user_id: userId,
          role_id: roleId,
          assigned_by: (await supabase.auth.getUser()).data.user?.id,
          expires_at: expiresAt
        }]);

      if (error) throw error;
    } catch (error) {
      console.error('Error assigning role to user:', error);
      throw error;
    }
  }

  // Remove role from user
  static async removeRoleFromUser(userId: string, roleId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', userId)
        .eq('role_id', roleId);

      if (error) throw error;
    } catch (error) {
      console.error('Error removing role from user:', error);
      throw error;
    }
  }

  // Update user role
  static async updateUserRole(userRoleId: string, updates: Partial<UserRole>): Promise<void> {
    try {
      const { error } = await supabase
        .from('user_roles')
        .update(updates)
        .eq('id', userRoleId);

      if (error) throw error;
    } catch (error) {
      console.error('Error updating user role:', error);
      throw error;
    }
  }

  // Get audit logs
  static async getAuditLogs(limit: number = 100, offset: number = 0): Promise<PermissionAuditLog[]> {
    try {
      const { data, error } = await supabase
        .from('permission_audit_log')
        .select(`
          *,
          user:users(id, email, full_name)
        `)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error getting audit logs:', error);
      return [];
    }
  }

  // Get permission categories
  static async getPermissionCategories(): Promise<string[]> {
    try {
      const { data, error } = await supabase
        .from('permissions')
        .select('category')
        .order('category', { ascending: true });

      if (error) throw error;
      const categories = [...new Set(data?.map(p => p.category) || [])];
      return categories;
    } catch (error) {
      console.error('Error getting permission categories:', error);
      return [];
    }
  }

  // Bulk assign permissions to role
  static async bulkAssignPermissionsToRole(roleId: string, permissionIds: string[]): Promise<void> {
    try {
      const currentUser = (await supabase.auth.getUser()).data.user?.id;
      
      const rolePermissions = permissionIds.map(permissionId => ({
        role_id: roleId,
        permission_id: permissionId,
        granted_by: currentUser
      }));

      const { error } = await supabase
        .from('role_permissions')
        .upsert(rolePermissions, { onConflict: 'role_id,permission_id' });

      if (error) throw error;
    } catch (error) {
      console.error('Error bulk assigning permissions to role:', error);
      throw error;
    }
  }

  // Get role hierarchy
  static async getRoleHierarchy(): Promise<Role[]> {
    try {
      const { data, error } = await supabase
        .from('roles')
        .select('*')
        .order('level', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error getting role hierarchy:', error);
      return [];
    }
  }

  // Check if user can manage another user
  static async canManageUser(currentUserId: string, targetUserId: string): Promise<boolean> {
    try {
      // Get current user's highest role level
      const currentUserRoles = await this.getUserRoles(currentUserId);
      const currentUserMaxLevel = Math.max(...currentUserRoles.map(r => r.level));

      // Get target user's highest role level
      const targetUserRoles = await this.getUserRoles(targetUserId);
      const targetUserMaxLevel = Math.max(...targetUserRoles.map(r => r.level));

      // Current user can manage target user if their level is higher
      return currentUserMaxLevel > targetUserMaxLevel;
    } catch (error) {
      console.error('Error checking user management permission:', error);
      return false;
    }
  }

  // Get users with their roles
  static async getUsersWithRoles(): Promise<Array<{
    id: string;
    email: string;
    full_name: string;
    avatar_url?: string;
    roles: Role[];
  }>> {
    try {
      const { data, error } = await supabase
        .from('users')
        .select(`
          id,
          email,
          full_name,
          avatar_url,
          user_roles!inner(
            is_active,
            role:roles(*)
          )
        `);

      if (error) throw error;

      return data?.map(user => ({
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        avatar_url: user.avatar_url,
        roles: user.user_roles
          .filter((ur: any) => ur.is_active)
          .map((ur: any) => ur.role)
      })) || [];
    } catch (error) {
      console.error('Error getting users with roles:', error);
      return [];
    }
  }
}
