import { supabase } from '../lib/supabase';
import { Task } from '../types/index';

// Helper function to parse interval string to milliseconds
function parseIntervalToMs(intervalStr: string | number | null | undefined): number {
  if (!intervalStr) return 0;
  if (typeof intervalStr === 'number') return intervalStr; // Handle legacy number format
  if (typeof intervalStr === 'string') {
    // Parse PostgreSQL interval format like "123 seconds" or "1:23:45"
    const match = intervalStr.match(/(\d+)\s*seconds?/);
    if (match) return parseInt(match[1]) * 1000;
    
    // Handle HH:MM:SS format
    const timeMatch = intervalStr.match(/(\d+):(\d+):(\d+)/);
    if (timeMatch) {
      const hours = parseInt(timeMatch[1]);
      const minutes = parseInt(timeMatch[2]);
      const seconds = parseInt(timeMatch[3]);
      return (hours * 3600 + minutes * 60 + seconds) * 1000;
    }
  }
  return 0;
}

export class TaskStatusService {
  /**
   * Update task status based on current time and task dates
   */
  static async updateTaskStatus(taskId: string): Promise<{ success: boolean; newStatus?: string; error?: string }> {
    try {
      // Get the task
      const { data: task, error: fetchError } = await supabase
        .from('tasks')
        .select('*')
        .eq('id', taskId)
        .single();

      if (fetchError) throw fetchError;
      if (!task) throw new Error('Task not found');

      const now = new Date();
      const startDate = new Date(task.start_date);
      const endDate = new Date(task.end_date);
      const dueDate = new Date(task.due_date);

      let newStatus = task.status;
      let updates: any = {};

      // Determine status based on current time and task state
      if (now < startDate) {
        // Before start date - task is expected
        newStatus = 'Planned';
      } else if (now >= startDate && now <= endDate) {
        // Within active period
        if (task.status === 'Planned') {
          newStatus = 'Not Started';
        } else if (task.status === 'Pending') {
          // If task was pending but now within active period, make it available
          newStatus = 'Not Started';
        }
        // Keep current status if already started/paused/completed
      } else if (now > endDate) {
        // After end date
        if (task.status === 'Not Started') {
          // Task was never started and is now past end date
          newStatus = 'Pending';
          updates = {
            forwarded_at: now.toISOString(),
            original_due_date: task.due_date,
            due_date: new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString() // Next day
          };
        } else if (task.status === 'In Progress' || task.status === 'Paused') {
          // Task was in progress but past end date - mark as pending
          newStatus = 'Pending';
          updates = {
            forwarded_at: now.toISOString(),
            original_due_date: task.due_date,
            due_date: new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString()
          };
        }
        // Keep completed status if already completed
      }

      // Special case: Check if task should be auto-completed based on time_assigning
      if (task.status === 'In Progress' && task.started_at && task.time_assigning) {
        const startTime = new Date(task.started_at);
        const elapsedMinutes = Math.floor((now.getTime() - startTime.getTime()) / (1000 * 60));
        const pauseMinutes = Math.floor(parseIntervalToMs(task.total_pause_duration) / (1000 * 60));
        const effectiveElapsedMinutes = elapsedMinutes - pauseMinutes;

        if (effectiveElapsedMinutes >= task.time_assigning) {
          newStatus = 'Completed';
          updates = {
            completed_at: now.toISOString(),
            actual_time: effectiveElapsedMinutes,
            updated_at: now.toISOString()
          };
        }
      }

      // Update task if status changed
      if (newStatus !== task.status) {
        const { error: updateError } = await supabase
          .from('tasks')
          .update({
            status: newStatus,
            updated_at: now.toISOString(),
            ...updates
          })
          .eq('id', taskId);

        if (updateError) throw updateError;
      }

      return { success: true, newStatus };
    } catch (error: any) {
      console.error('Error updating task status:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Start a task (change status to In Progress)
   */
  static async startTask(taskId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await supabase
        .from('tasks')
        .update({
          status: 'In Progress',
          started_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', taskId);

      if (error) throw error;
      return { success: true };
    } catch (error: any) {
      console.error('Error starting task:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Pause a task
   */
  static async pauseTask(taskId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const now = new Date();
      
      // Get current task to calculate pause duration
      const { data: task, error: fetchError } = await supabase
        .from('tasks')
        .select('started_at, last_pause_at, total_pause_duration')
        .eq('id', taskId)
        .single();

      if (fetchError) throw fetchError;

      let totalPauseDuration = parseIntervalToMs(task.total_pause_duration);
      
      // If task was running (not paused), calculate current session duration
      if (task.started_at && !task.last_pause_at) {
        const sessionStart = new Date(task.started_at);
        const sessionDuration = isNaN(sessionStart.getTime()) ? 0 : now.getTime() - sessionStart.getTime();
        totalPauseDuration += Math.max(0, sessionDuration);
      }

      const { error } = await supabase
        .from('tasks')
        .update({
          status: 'Paused',
          last_pause_at: now.toISOString(),
          total_pause_duration: `${Math.floor(Math.max(0, totalPauseDuration || 0) / 1000)} seconds`,
          updated_at: now.toISOString()
        })
        .eq('id', taskId);

      if (error) throw error;
      return { success: true };
    } catch (error: any) {
      console.error('Error pausing task:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Resume a task
   */
  static async resumeTask(taskId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await supabase
        .from('tasks')
        .update({
          status: 'In Progress',
          last_pause_at: null,
          updated_at: new Date().toISOString()
        })
        .eq('id', taskId);

      if (error) throw error;
      return { success: true };
    } catch (error: any) {
      console.error('Error resuming task:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Complete a task
   */
  static async completeTask(taskId: string, completionNotes?: string): Promise<{ success: boolean; error?: string }> {
    try {
      const now = new Date();
      
      // Get current task to calculate total time
      const { data: task, error: fetchError } = await supabase
        .from('tasks')
        .select('started_at, last_pause_at, total_pause_duration, time_assigning')
        .eq('id', taskId)
        .single();

      if (fetchError) throw fetchError;

      let actualTime = 0;
      if (task.started_at) {
        const totalDuration = now.getTime() - new Date(task.started_at).getTime();
        const pauseDuration = parseIntervalToMs(task.total_pause_duration);
        actualTime = Math.max(0, totalDuration - pauseDuration);
      }

      const { error } = await supabase
        .from('tasks')
        .update({
          status: 'Completed',
          completed_at: now.toISOString(),
          actual_time: Math.round(actualTime / (1000 * 60)), // Convert to minutes
          completion_notes: completionNotes,
          completion_type: 'without_proof',
          updated_at: now.toISOString()
        })
        .eq('id', taskId);

      if (error) throw error;
      return { success: true };
    } catch (error: any) {
      console.error('Error completing task:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Complete a task with proof photo
   */
  static async completeTaskWithProof(taskId: string, proofImage: string, completionNotes?: string): Promise<{ success: boolean; error?: string }> {
    try {
      const now = new Date();
      
      // Get current task to calculate total time
      const { data: task, error: fetchError } = await supabase
        .from('tasks')
        .select('started_at, last_pause_at, total_pause_duration, time_assigning')
        .eq('id', taskId)
        .single();

      if (fetchError) throw fetchError;

      let actualTime = 0;
      if (task.started_at) {
        const totalDuration = now.getTime() - new Date(task.started_at).getTime();
        const pauseDuration = parseIntervalToMs(task.total_pause_duration);
        actualTime = Math.max(0, totalDuration - pauseDuration);
      }

      // Upload proof image to storage
      const storagePath = `${taskId}/${Date.now()}.jpg`;
      const blob = await fetch(proofImage).then(res => res.blob());
      const { error: uploadError } = await supabase.storage
        .from('task-proofs')
        .upload(storagePath, blob, { contentType: 'image/jpeg', cacheControl: '3600' });
      
      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage
        .from('task-proofs')
        .getPublicUrl(storagePath);

      // Create task proof record
      const { error: proofError } = await supabase
        .from('task_proofs')
        .insert([
          {
            task_id: taskId,
            image_url: publicUrlData.publicUrl,
            description: completionNotes || '',
            submitted_by: (await supabase.auth.getUser()).data.user?.id,
            status: 'Pending',
          },
        ]);

      if (proofError) throw proofError;

      // Update task status
      const { error } = await supabase
        .from('tasks')
        .update({
          status: 'Completed',
          completed_at: now.toISOString(),
          actual_time: Math.round(actualTime / (1000 * 60)), // Convert to minutes
          completion_notes: completionNotes,
          completion_type: 'with_proof',
          proof_photo_url: publicUrlData.publicUrl,
          updated_at: now.toISOString()
        })
        .eq('id', taskId);

      if (error) throw error;
      return { success: true };
    } catch (error: any) {
      console.error('Error completing task with proof:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get tasks that need status updates
   */
  static async getTasksNeedingStatusUpdate(): Promise<{ data: Task[]; error?: string }> {
    try {
      const now = new Date().toISOString();
      
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .in('status', ['Planned', 'Not Started', 'In Progress', 'Paused'])
        .or(`start_date.lte.${now},end_date.lte.${now}`);

      if (error) throw error;
      return { data: data || [] };
    } catch (error: any) {
      console.error('Error fetching tasks needing status update:', error);
      return { data: [], error: error.message };
    }
  }

  /**
   * Update all tasks that need status updates
   */
  static async updateAllTaskStatuses(): Promise<{ success: boolean; updatedCount: number; error?: string }> {
    try {
      const { data: tasks, error: fetchError } = await this.getTasksNeedingStatusUpdate();
      if (fetchError) throw fetchError;

      let updatedCount = 0;
      for (const task of tasks) {
        const result = await this.updateTaskStatus(task.id);
        if (result.success && result.newStatus !== task.status) {
          updatedCount++;
        }
      }

      return { success: true, updatedCount };
    } catch (error: any) {
      console.error('Error updating all task statuses:', error);
      return { success: false, updatedCount: 0, error: error.message };
    }
  }

  /**
   * Get tasks that are currently active and need time-based updates
   */
  static async getActiveTasksForTimeUpdate(): Promise<{ data: Task[]; error?: string }> {
    try {
      const now = new Date().toISOString();
      
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('status', 'In Progress')
        .not('started_at', 'is', null)
        .not('time_assigning', 'is', null);

      if (error) throw error;
      return { data: data || [] };
    } catch (error: any) {
      console.error('Error fetching active tasks for time update:', error);
      return { data: [], error: error.message };
    }
  }

  /**
   * Update task statuses based on time assignment completion
   */
  static async updateTasksByTimeCompletion(): Promise<{ success: boolean; completedCount: number; error?: string }> {
    try {
      const { data: activeTasks, error: fetchError } = await this.getActiveTasksForTimeUpdate();
      if (fetchError) throw fetchError;

      let completedCount = 0;
      const now = new Date();

      for (const task of activeTasks) {
        if (!task.started_at || !task.time_assigning) continue;

        const startTime = new Date(task.started_at);
        const elapsedMinutes = Math.floor((now.getTime() - startTime.getTime()) / (1000 * 60));
        const pauseMinutes = Math.floor(parseIntervalToMs(task.total_pause_duration) / (1000 * 60));
        const effectiveElapsedMinutes = elapsedMinutes - pauseMinutes;

        if (effectiveElapsedMinutes >= task.time_assigning) {
          const { error: updateError } = await supabase
            .from('tasks')
            .update({
              status: 'Completed',
              completed_at: now.toISOString(),
              actual_time: effectiveElapsedMinutes,
              updated_at: now.toISOString()
            })
            .eq('id', task.id);

          if (!updateError) {
            completedCount++;
          }
        }
      }

      return { success: true, completedCount };
    } catch (error: any) {
      console.error('Error updating tasks by time completion:', error);
      return { success: false, completedCount: 0, error: error.message };
    }
  }

  /**
   * Get task status summary for dashboard
   */
  static async getTaskStatusSummary(): Promise<{ 
    success: boolean; 
    summary?: {
      planned: number;
      notStarted: number;
      inProgress: number;
      paused: number;
      completed: number;
      pending: number;
    }; 
    error?: string 
  }> {
    try {
      const { data: tasks, error } = await supabase
        .from('tasks')
        .select('status');

      if (error) throw error;

      const summary = {
        planned: 0,
        notStarted: 0,
        inProgress: 0,
        paused: 0,
        completed: 0,
        pending: 0
      };

      tasks?.forEach(task => {
        switch (task.status) {
          case 'Planned': summary.planned++; break;
          case 'Not Started': summary.notStarted++; break;
          case 'In Progress': summary.inProgress++; break;
          case 'Paused': summary.paused++; break;
          case 'Completed': summary.completed++; break;
          case 'Pending': summary.pending++; break;
        }
      });

      return { success: true, summary };
    } catch (error: any) {
      console.error('Error getting task status summary:', error);
      return { success: false, error: error.message };
    }
  }
}
