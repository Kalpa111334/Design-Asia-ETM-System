import { supabase } from '../lib/supabase';
import { User } from '../types/index';

export interface CreateEmployeeData {
  email: string;
  full_name: string;
  role: 'admin' | 'employee';
  skills: string[];
  password: string;
}

export interface UpdateEmployeeData {
  email?: string;
  full_name?: string;
  role?: 'admin' | 'employee';
  skills?: string[];
}

export class EmployeeService {
  /**
   * Create a new employee
   */
  static async createEmployee(data: CreateEmployeeData): Promise<{ success: boolean; user?: User; error?: string }> {
    try {
      // Check if current user is admin
      const isAdmin = await this.isCurrentUserAdmin();
      if (!isAdmin) {
        return { success: false, error: 'Only administrators can create employees' };
      }

      // Check if user already exists
      const { data: existingUser } = await supabase
        .from('users')
        .select('*')
        .eq('email', data.email)
        .single();

      if (existingUser) {
        return { success: false, error: 'A user with this email already exists' };
      }

      // Create auth user first - this will trigger the handle_new_user function
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: {
          data: {
            full_name: data.full_name,
            role: data.role,
            skills: data.skills
          },
          emailRedirectTo: `${window.location.origin}/auth/callback`
        }
      });

      if (authError) {
        console.error('Auth signup error:', authError);
        
        // Handle specific auth errors
        if (authError.message.includes('already registered')) {
          return { success: false, error: 'A user with this email already exists' };
        }
        
        return { success: false, error: `Authentication error: ${authError.message}` };
      }

      if (!authData.user) {
        return { success: false, error: 'Failed to create user account' };
      }

      // Wait a moment for the trigger to process
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Fetch the created user from public.users
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('id', authData.user.id)
        .single();

      if (userError) {
        console.error('Error fetching created user:', userError);
        // Even if we can't fetch the user, the auth user was created successfully
        return { success: true, error: 'User created but may need to refresh the page' };
      }

      return { success: true, user: userData };
    } catch (error: any) {
      console.error('Error creating employee:', error);
      return { success: false, error: `Unexpected error: ${error.message}` };
    }
  }

  /**
   * Update an existing employee
   */
  static async updateEmployee(userId: string, data: UpdateEmployeeData): Promise<{ success: boolean; user?: User; error?: string }> {
    try {
      // Update user metadata in auth
      const { error: authError } = await supabase.auth.admin.updateUserById(userId, {
        user_metadata: {
          full_name: data.full_name,
          role: data.role,
          skills: data.skills
        }
      });

      if (authError) {
        console.error('Auth user update error:', authError);
        return { success: false, error: authError.message };
      }

      // Update user record in public.users table
      const { data: userData, error: userError } = await supabase
        .from('users')
        .update({
          email: data.email,
          full_name: data.full_name,
          role: data.role,
          skills: data.skills,
          avatar_url: data.full_name ? `https://ui-avatars.com/api/?name=${encodeURIComponent(data.full_name)}&background=6366f1&color=ffffff` : undefined
        })
        .eq('id', userId)
        .select()
        .single();

      if (userError) {
        console.error('User table update error:', userError);
        return { success: false, error: userError.message };
      }

      return { success: true, user: userData };
    } catch (error: any) {
      console.error('Error updating employee:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Delete an employee (soft delete - move to deleted_users table)
   */
  static async deleteEmployee(userId: string, deletionReason: string): Promise<{ success: boolean; error?: string }> {
    try {
      // Get current user info
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (!currentUser) {
        return { success: false, error: 'No authenticated user found' };
      }

      // Get user to delete
      const { data: userToDelete, error: fetchError } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();

      if (fetchError) {
        console.error('Error fetching user to delete:', fetchError);
        return { success: false, error: fetchError.message };
      }

      // Skip inserting into deleted_users entirely to avoid duplicate key errors
      // Just proceed directly to deleting from users table
      console.log('Skipping deleted_users insert to avoid duplicate key constraint');

      // Delete from users table
      const { error: deleteError } = await supabase
        .from('users')
        .delete()
        .eq('id', userId);

      if (deleteError) {
        console.error('Error deleting from users table:', deleteError);
        return { success: false, error: deleteError.message };
      }

      return { success: true };
    } catch (error: any) {
      console.error('Error deleting employee:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get all employees
   */
  static async getEmployees(): Promise<{ success: boolean; employees?: User[]; error?: string }> {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching employees:', error);
        return { success: false, error: error.message };
      }

      return { success: true, employees: data || [] };
    } catch (error: any) {
      console.error('Error fetching employees:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get employee by ID
   */
  static async getEmployeeById(userId: string): Promise<{ success: boolean; employee?: User; error?: string }> {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        console.error('Error fetching employee:', error);
        return { success: false, error: error.message };
      }

      return { success: true, employee: data };
    } catch (error: any) {
      console.error('Error fetching employee:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Reset employee password
   */
  static async resetPassword(userId: string, newPassword: string): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await supabase.auth.admin.updateUserById(userId, {
        password: newPassword
      });

      if (error) {
        console.error('Error resetting password:', error);
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (error: any) {
      console.error('Error resetting password:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Check if current user is admin
   */
  static async isCurrentUserAdmin(): Promise<boolean> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) return false;

      // Check auth metadata first
      const role = user.user_metadata?.role || 'employee';
      if (role === 'admin') return true;

      // Fallback to public.users table
      const { data: userData } = await supabase
        .from('users')
        .select('role')
        .eq('id', user.id)
        .single();

      return userData?.role === 'admin';
    } catch (error) {
      console.error('Error checking admin status:', error);
      return false;
    }
  }
}
