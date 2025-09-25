import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';

/**
 * Comprehensive Task Deletion Service
 * 
 * This service ensures that when tasks are deleted, ALL related data is properly
 * removed from the database to prevent orphaned records and maintain data integrity.
 * 
 * Tables that reference tasks (with foreign keys):
 * - task_attachments (ON DELETE CASCADE)
 * - task_assignees (ON DELETE CASCADE)
 * - task_proofs (ON DELETE CASCADE)
 * - time_logs (ON DELETE CASCADE)
 * - task_events (ON DELETE CASCADE)
 * - task_locations (ON DELETE CASCADE)
 * - task_location_events (ON DELETE CASCADE)
 * - location_alerts (ON DELETE CASCADE)
 * - employee_locations (task_id ON DELETE SET NULL)
 * - employee_movement_history (task_id ON DELETE SET NULL)
 */

interface DeletionResult {
  success: boolean;
  deletedTaskIds: string[];
  errors: string[];
  warnings: string[];
  totalDeleted: number;
}

interface DeletionStats {
  tasks: number;
  attachments: number;
  assignees: number;
  proofs: number;
  timeLogs: number;
  events: number;
  locations: number;
  locationEvents: number;
  alerts: number;
  storageFiles: number;
}

class TaskDeletionService {
  /**
   * Permanently delete tasks and all related data
   */
  async deleteTasksPermanently(taskIds: string[]): Promise<DeletionResult> {
    if (!taskIds || taskIds.length === 0) {
      return {
        success: false,
        deletedTaskIds: [],
        errors: ['No task IDs provided'],
        warnings: [],
        totalDeleted: 0
      };
    }

    const result: DeletionResult = {
      success: false,
      deletedTaskIds: [],
      errors: [],
      warnings: [],
      totalDeleted: 0
    };

    const stats: DeletionStats = {
      tasks: 0,
      attachments: 0,
      assignees: 0,
      proofs: 0,
      timeLogs: 0,
      events: 0,
      locations: 0,
      locationEvents: 0,
      alerts: 0,
      storageFiles: 0
    };

    try {
      console.log(`Starting deletion process for ${taskIds.length} task(s):`, taskIds);

      // Step 1: Delete storage files for task attachments
      await this.deleteTaskAttachmentFiles(taskIds, stats, result);

      // Step 2: Delete related data in dependency order
      // Note: Many tables have ON DELETE CASCADE, but we'll delete explicitly for better control and logging
      
      // Delete location alerts first (no dependencies)
      await this.deleteLocationAlerts(taskIds, stats, result);
      
      // Delete task location events
      await this.deleteTaskLocationEvents(taskIds, stats, result);
      
      // Delete employee movement history references (SET NULL)
      await this.updateEmployeeMovementHistory(taskIds, stats, result);
      
      // Delete employee location references (SET NULL)
      await this.updateEmployeeLocations(taskIds, stats, result);
      
      // Delete task events
      await this.deleteTaskEvents(taskIds, stats, result);
      
      // Delete time logs
      await this.deleteTimeLogs(taskIds, stats, result);
      
      // Delete task proofs
      await this.deleteTaskProofs(taskIds, stats, result);
      
      // Delete task locations
      await this.deleteTaskLocations(taskIds, stats, result);
      
      // Delete task assignees
      await this.deleteTaskAssignees(taskIds, stats, result);
      
      // Delete task attachments metadata
      await this.deleteTaskAttachments(taskIds, stats, result);

      // Step 3: Finally delete the tasks themselves
      await this.deleteTasks(taskIds, stats, result);

      // Log deletion statistics
      console.log('Deletion completed with stats:', stats);
      
      result.success = true;
      result.deletedTaskIds = taskIds;
      result.totalDeleted = stats.tasks;

      // Show detailed success message
      const deletionSummary = this.generateDeletionSummary(stats);
      toast.success(`Successfully deleted ${taskIds.length} task(s) and all related data\n${deletionSummary}`);

    } catch (error) {
      console.error('Critical error during task deletion:', error);
      result.errors.push(`Critical deletion error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      toast.error('Failed to delete tasks completely. Some data may remain.');
    }

    return result;
  }

  /**
   * Delete storage files for task attachments
   */
  private async deleteTaskAttachmentFiles(taskIds: string[], stats: DeletionStats, result: DeletionResult): Promise<void> {
    try {
      // Get all attachment file paths for these tasks
      const { data: attachments, error } = await supabase
        .from('task_attachments')
        .select('file_url, file_name, task_id')
        .in('task_id', taskIds);

      if (error) {
        result.warnings.push(`Warning getting attachment files: ${error.message}`);
        return;
      }

      if (!attachments || attachments.length === 0) {
        console.log('No attachment files to delete');
        return;
      }

      console.log(`Deleting ${attachments.length} attachment files from storage`);

      // Delete files from storage
      for (const attachment of attachments) {
        try {
          // Extract file path from URL
          const filePath = this.extractFilePathFromUrl(attachment.file_url);
          if (filePath) {
            const { error: storageError } = await supabase.storage
              .from('task-attachments')
              .remove([filePath]);

            if (storageError) {
              result.warnings.push(`Warning deleting file ${attachment.file_name}: ${storageError.message}`);
            } else {
              stats.storageFiles++;
            }
          }
        } catch (fileError) {
          result.warnings.push(`Warning deleting file ${attachment.file_name}: ${fileError instanceof Error ? fileError.message : 'Unknown error'}`);
        }
      }

      console.log(`Deleted ${stats.storageFiles} storage files`);

    } catch (error) {
      result.warnings.push(`Warning during storage file deletion: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Delete location alerts related to tasks
   */
  private async deleteLocationAlerts(taskIds: string[], stats: DeletionStats, result: DeletionResult): Promise<void> {
    try {
      const { count, error } = await supabase
        .from('location_alerts')
        .delete({ count: 'exact' })
        .in('task_id', taskIds);

      if (error) {
        result.warnings.push(`Warning deleting location alerts: ${error.message}`);
      } else {
        stats.alerts = count || 0;
        console.log(`Deleted ${stats.alerts} location alerts`);
      }
    } catch (error) {
      result.warnings.push(`Warning deleting location alerts: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Delete task location events
   */
  private async deleteTaskLocationEvents(taskIds: string[], stats: DeletionStats, result: DeletionResult): Promise<void> {
    try {
      const { count, error } = await supabase
        .from('task_location_events')
        .delete({ count: 'exact' })
        .in('task_id', taskIds);

      if (error) {
        result.warnings.push(`Warning deleting task location events: ${error.message}`);
      } else {
        stats.locationEvents = count || 0;
        console.log(`Deleted ${stats.locationEvents} task location events`);
      }
    } catch (error) {
      result.warnings.push(`Warning deleting task location events: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Update employee movement history to remove task references
   */
  private async updateEmployeeMovementHistory(taskIds: string[], stats: DeletionStats, result: DeletionResult): Promise<void> {
    try {
      const { error } = await supabase
        .from('employee_movement_history')
        .update({ task_id: null })
        .in('task_id', taskIds);

      if (error) {
        result.warnings.push(`Warning updating employee movement history: ${error.message}`);
      } else {
        console.log('Updated employee movement history task references');
      }
    } catch (error) {
      result.warnings.push(`Warning updating employee movement history: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Update employee locations to remove task references
   */
  private async updateEmployeeLocations(taskIds: string[], stats: DeletionStats, result: DeletionResult): Promise<void> {
    try {
      const { error } = await supabase
        .from('employee_locations')
        .update({ task_id: null })
        .in('task_id', taskIds);

      if (error) {
        result.warnings.push(`Warning updating employee locations: ${error.message}`);
      } else {
        console.log('Updated employee locations task references');
      }
    } catch (error) {
      result.warnings.push(`Warning updating employee locations: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Delete task events
   */
  private async deleteTaskEvents(taskIds: string[], stats: DeletionStats, result: DeletionResult): Promise<void> {
    try {
      const { count, error } = await supabase
        .from('task_events')
        .delete({ count: 'exact' })
        .in('task_id', taskIds);

      if (error) {
        result.warnings.push(`Warning deleting task events: ${error.message}`);
      } else {
        stats.events = count || 0;
        console.log(`Deleted ${stats.events} task events`);
      }
    } catch (error) {
      result.warnings.push(`Warning deleting task events: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Delete time logs
   */
  private async deleteTimeLogs(taskIds: string[], stats: DeletionStats, result: DeletionResult): Promise<void> {
    try {
      const { count, error } = await supabase
        .from('time_logs')
        .delete({ count: 'exact' })
        .in('task_id', taskIds);

      if (error) {
        result.warnings.push(`Warning deleting time logs: ${error.message}`);
      } else {
        stats.timeLogs = count || 0;
        console.log(`Deleted ${stats.timeLogs} time logs`);
      }
    } catch (error) {
      result.warnings.push(`Warning deleting time logs: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Delete task proofs
   */
  private async deleteTaskProofs(taskIds: string[], stats: DeletionStats, result: DeletionResult): Promise<void> {
    try {
      const { count, error } = await supabase
        .from('task_proofs')
        .delete({ count: 'exact' })
        .in('task_id', taskIds);

      if (error) {
        result.warnings.push(`Warning deleting task proofs: ${error.message}`);
      } else {
        stats.proofs = count || 0;
        console.log(`Deleted ${stats.proofs} task proofs`);
      }
    } catch (error) {
      result.warnings.push(`Warning deleting task proofs: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Delete task locations
   */
  private async deleteTaskLocations(taskIds: string[], stats: DeletionStats, result: DeletionResult): Promise<void> {
    try {
      const { count, error } = await supabase
        .from('task_locations')
        .delete({ count: 'exact' })
        .in('task_id', taskIds);

      if (error) {
        result.warnings.push(`Warning deleting task locations: ${error.message}`);
      } else {
        stats.locations = count || 0;
        console.log(`Deleted ${stats.locations} task locations`);
      }
    } catch (error) {
      result.warnings.push(`Warning deleting task locations: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Delete task assignees
   */
  private async deleteTaskAssignees(taskIds: string[], stats: DeletionStats, result: DeletionResult): Promise<void> {
    try {
      const { count, error } = await supabase
        .from('task_assignees')
        .delete({ count: 'exact' })
        .in('task_id', taskIds);

      if (error) {
        result.warnings.push(`Warning deleting task assignees: ${error.message}`);
      } else {
        stats.assignees = count || 0;
        console.log(`Deleted ${stats.assignees} task assignees`);
      }
    } catch (error) {
      result.warnings.push(`Warning deleting task assignees: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Delete task attachments metadata
   */
  private async deleteTaskAttachments(taskIds: string[], stats: DeletionStats, result: DeletionResult): Promise<void> {
    try {
      const { count, error } = await supabase
        .from('task_attachments')
        .delete({ count: 'exact' })
        .in('task_id', taskIds);

      if (error) {
        result.warnings.push(`Warning deleting task attachments: ${error.message}`);
      } else {
        stats.attachments = count || 0;
        console.log(`Deleted ${stats.attachments} task attachments`);
      }
    } catch (error) {
      result.warnings.push(`Warning deleting task attachments: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Delete the tasks themselves
   */
  private async deleteTasks(taskIds: string[], stats: DeletionStats, result: DeletionResult): Promise<void> {
    const { count, error } = await supabase
      .from('tasks')
      .delete({ count: 'exact' })
      .in('id', taskIds);

    if (error) {
      throw new Error(`Failed to delete tasks: ${error.message}`);
    }

    stats.tasks = count || 0;
    console.log(`Deleted ${stats.tasks} tasks`);

    if (stats.tasks !== taskIds.length) {
      result.warnings.push(`Expected to delete ${taskIds.length} tasks, but only deleted ${stats.tasks}`);
    }
  }

  /**
   * Extract file path from storage URL
   */
  private extractFilePathFromUrl(url: string): string | null {
    try {
      // Extract path from Supabase storage URL
      const matches = url.match(/\/storage\/v1\/object\/public\/task-attachments\/(.+)$/);
      return matches ? matches[1] : null;
    } catch {
      return null;
    }
  }

  /**
   * Generate a summary of deletion statistics
   */
  private generateDeletionSummary(stats: DeletionStats): string {
    const summary = [];
    
    if (stats.tasks > 0) summary.push(`${stats.tasks} tasks`);
    if (stats.attachments > 0) summary.push(`${stats.attachments} attachments`);
    if (stats.storageFiles > 0) summary.push(`${stats.storageFiles} files`);
    if (stats.assignees > 0) summary.push(`${stats.assignees} assignees`);
    if (stats.proofs > 0) summary.push(`${stats.proofs} proofs`);
    if (stats.timeLogs > 0) summary.push(`${stats.timeLogs} time logs`);
    if (stats.events > 0) summary.push(`${stats.events} events`);
    if (stats.locations > 0) summary.push(`${stats.locations} locations`);
    if (stats.locationEvents > 0) summary.push(`${stats.locationEvents} location events`);
    if (stats.alerts > 0) summary.push(`${stats.alerts} alerts`);

    return summary.length > 0 ? `(${summary.join(', ')})` : '';
  }

  /**
   * Verify that tasks are completely deleted from database
   */
  async verifyDeletion(taskIds: string[]): Promise<{ success: boolean; remainingTasks: string[]; issues: string[] }> {
    const issues: string[] = [];
    const remainingTasks: string[] = [];

    try {
      // Check if any tasks still exist
      const { data: tasks, error: tasksError } = await supabase
        .from('tasks')
        .select('id')
        .in('id', taskIds);

      if (tasksError) {
        issues.push(`Error checking tasks: ${tasksError.message}`);
      } else if (tasks && tasks.length > 0) {
        remainingTasks.push(...tasks.map(t => t.id));
        issues.push(`${tasks.length} tasks still exist in database`);
      }

      // Check for orphaned related data
      const relatedTables = [
        'task_attachments',
        'task_assignees', 
        'task_proofs',
        'time_logs',
        'task_events',
        'task_locations',
        'task_location_events',
        'location_alerts'
      ];

      for (const table of relatedTables) {
        try {
          const { count, error } = await supabase
            .from(table)
            .select('*', { count: 'exact', head: true })
            .in('task_id', taskIds);

          if (error) {
            issues.push(`Error checking ${table}: ${error.message}`);
          } else if (count && count > 0) {
            issues.push(`${count} orphaned records found in ${table}`);
          }
        } catch (tableError) {
          issues.push(`Error checking table ${table}: ${tableError instanceof Error ? tableError.message : 'Unknown error'}`);
        }
      }

    } catch (error) {
      issues.push(`Verification error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    return {
      success: issues.length === 0 && remainingTasks.length === 0,
      remainingTasks,
      issues
    };
  }
}

// Export singleton instance
export const taskDeletionService = new TaskDeletionService();
export default taskDeletionService;
