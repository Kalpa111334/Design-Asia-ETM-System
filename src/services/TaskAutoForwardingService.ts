import { supabase } from '../lib/supabase';

export class TaskAutoForwardingService {
  /**
   * Manually trigger the auto-forwarding of Expected tasks to Pending
   * This can be called from the frontend or scheduled jobs
   */
  static async forwardExpectedTasks(): Promise<{ success: boolean; forwardedCount: number; error?: string }> {
    try {
      const { data, error } = await supabase.rpc('auto_forward_expected_tasks');
      
      if (error) {
        console.error('Error auto-forwarding tasks:', error);
        return { success: false, forwardedCount: 0, error: error.message };
      }

      // Get the count of tasks that were forwarded
      const { data: forwardedTasks, error: countError } = await supabase
        .from('tasks')
        .select('id')
        .eq('status', 'Pending')
        .not('forwarded_at', 'is', null)
        .gte('forwarded_at', new Date().toISOString().split('T')[0]); // Today

      if (countError) {
        console.error('Error counting forwarded tasks:', countError);
        return { success: true, forwardedCount: 0 };
      }

      return { 
        success: true, 
        forwardedCount: forwardedTasks?.length || 0 
      };
    } catch (error) {
      console.error('Unexpected error in auto-forwarding:', error);
      return { 
        success: false, 
        forwardedCount: 0, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  /**
   * Get all Pending tasks for a specific user
   */
  static async getPendingTasksForUser(userId: string) {
    try {
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('assigned_to', userId)
        .eq('status', 'Pending')
        .order('due_date', { ascending: true });

      if (error) throw error;
      return { data: data || [], error: null };
    } catch (error) {
      console.error('Error fetching pending tasks:', error);
      return { data: [], error };
    }
  }

  /**
   * Get all Pending tasks for admin view
   */
  static async getAllPendingTasks() {
    try {
      const { data, error } = await supabase
        .from('tasks')
        .select(`
          *,
          users!tasks_assigned_to_fkey(full_name, email)
        `)
        .eq('status', 'Pending')
        .order('due_date', { ascending: true });

      if (error) throw error;
      return { data: data || [], error: null };
    } catch (error) {
      console.error('Error fetching all pending tasks:', error);
      return { data: [], error };
    }
  }

  /**
   * Get all Planned tasks for admin view
   */
  static async getAllPlannedTasks() {
    try {
      const { data, error } = await supabase
        .from('tasks')
        .select(`
          *,
          users!tasks_assigned_to_fkey(full_name, email)
        `)
        .eq('status', 'Planned')
        .order('due_date', { ascending: true });

      if (error) throw error;
      return { data: data || [], error: null };
    } catch (error) {
      console.error('Error fetching expected tasks:', error);
      return { data: [], error };
    }
  }

  /**
   * Create a task with Expected status
   */
  static async createExpectedTask(taskData: {
    title: string;
    description: string;
    priority: 'High' | 'Medium' | 'Low';
    assigned_to: string;
    price: number;
    due_date: string;
    estimated_time: number;
  }) {
    try {
      const { data, error } = await supabase
        .from('tasks')
        .insert([{
          ...taskData,
          status: 'Planned'
        }])
        .select()
        .single();

      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      console.error('Error creating expected task:', error);
      return { data: null, error };
    }
  }

  /**
   * Move a Pending task back to Expected (for admin override)
   */
  static async movePendingToExpected(taskId: string) {
    try {
      const { data, error } = await supabase
        .from('tasks')
        .update({
          status: 'Planned',
          due_date: 'original_due_date',
          forwarded_at: null,
          original_due_date: null,
          updated_at: new Date().toISOString()
        })
        .eq('id', taskId)
        .select()
        .single();

      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      console.error('Error moving task back to expected:', error);
      return { data: null, error };
    }
  }

  /**
   * Get statistics about Expected and Pending tasks
   */
  static async getTaskForwardingStats() {
    try {
      const [expectedResult, pendingResult] = await Promise.all([
        supabase
          .from('tasks')
          .select('id', { count: 'exact' })
          .eq('status', 'Planned'),
        supabase
          .from('tasks')
          .select('id', { count: 'exact' })
          .eq('status', 'Pending')
      ]);

      if (expectedResult.error) throw expectedResult.error;
      if (pendingResult.error) throw pendingResult.error;

      return {
        expectedCount: expectedResult.count || 0,
        pendingCount: pendingResult.count || 0,
        error: null
      };
    } catch (error) {
      console.error('Error fetching task forwarding stats:', error);
      return {
        expectedCount: 0,
        pendingCount: 0,
        error
      };
    }
  }
}
