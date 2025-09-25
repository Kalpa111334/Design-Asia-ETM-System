import React, { useState, useEffect } from 'react';
import Layout from '../../components/Layout';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Task } from '../../types/index';
import { withPermission } from '../../components/withPermission';

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
import TaskSubmissionWithProof from '../../components/TaskSubmissionWithProof';
import TaskCountdown from '../../components/TaskCountdown';
import DeleteTaskModal from '../../components/DeleteTaskModal';
import AttachmentDisplay from '../../components/AttachmentDisplay';
import TaskAttachmentModal from '../../components/TaskAttachmentModal';
import TasksWithLocationMap from '../../components/employee/TasksWithLocationMap';
import toast from 'react-hot-toast';
import { formatCurrency } from '../../utils/currency';
import {
  CheckIcon,
  PauseIcon,
  PlayIcon,
  ClockIcon,
  CurrencyDollarIcon,
  CalendarIcon,
  PhotographIcon,
  CheckCircleIcon,
  TrashIcon,
  EyeIcon,
  MapIcon
} from '@heroicons/react/outline';

function Tasks() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'active' | 'completed'>('all');
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [showSubmissionForm, setShowSubmissionForm] = useState(false);
  const [taskToDelete, setTaskToDelete] = useState<Task | null>(null);
  const [showAttachments, setShowAttachments] = useState<Task | null>(null);
  const [showLocationMap, setShowLocationMap] = useState(false);
  const [selectedLocationTaskId, setSelectedLocationTaskId] = useState<string | undefined>(undefined);

  async function updateTaskProgress(taskId: string, progress: number) {
    try {
      const clamped = Math.max(0, Math.min(100, Math.round(progress)));
      const now = new Date().toISOString();
      const task = tasks.find(t => t.id === taskId);
      if (!task) return;
      if (task.assigned_to !== user?.id) {
        toast.error('You are not authorized to update this task');
        return;
      }

      const { error } = await supabase
        .from('tasks')
        .update({ progress_percentage: clamped, updated_at: now })
        .eq('id', taskId)
        .eq('assigned_to', user?.id);

      if (error) {
        console.error('Supabase update error:', error);
        toast.error(error.message || 'Failed to update progress');
        return;
      }

      setTasks(prev => prev.map(t => (t.id === taskId ? { ...t, progress_percentage: clamped, updated_at: now } as any : t)));
    } catch (e) {
      console.error('Error updating task progress:', e);
      toast.error('Failed to update progress');
    }
  }

  useEffect(() => {
    fetchTasks();
  }, [user]);

  async function fetchTasks() {
    try {
      if (!user) {
        console.log('No user found, skipping task fetch');
        setLoading(false);
        return;
      }

      console.log('🔍 DEBUG: Fetching tasks for user:', user.id);

      // Method 1: Try using the v_user_tasks view (if it exists and works)
      let data: any[] = [];
      let combinedError: any = null;

      try {
        const { data: viewTasks, error: viewError } = await supabase
          .from('v_user_tasks')
          .select('*, task_proofs(status, image_url, description, reviewed_at), task_attachments(*)')
          .order('created_at', { ascending: false });

        if (!viewError && viewTasks && viewTasks.length > 0) {
          console.log('🔍 DEBUG: Successfully fetched tasks using v_user_tasks view:', viewTasks.length);
          data = viewTasks;
        } else {
          console.log('🔍 DEBUG: v_user_tasks view failed or returned no data, trying alternative method');
          throw new Error('View method failed');
        }
      } catch (viewError) {
        console.log('🔍 DEBUG: View method failed, using separate queries');
        
        // Method 2: Fetch tasks assigned directly or via task_assignees separately
        const { data: directTasks, error: directErr } = await supabase
          .from('tasks')
          .select('*, task_proofs(status, image_url, description, reviewed_at), task_attachments(*)')
          .eq('assigned_to', user.id)
          .order('created_at', { ascending: false });

        const { data: viaAssignees, error: assigneesErr } = await supabase
          .from('task_assignees')
          .select('task:tasks(*, task_proofs(status, image_url, description, reviewed_at), task_attachments(*))')
          .eq('user_id', user.id);

        data = (directTasks || []);
        if (viaAssignees && viaAssignees.length > 0) {
          const joined = viaAssignees.map((r: any) => r.task).filter(Boolean);
          const byId = new Map<string, any>();
          [...data, ...joined].forEach((t: any) => { byId.set(t.id, t); });
          data = Array.from(byId.values()).sort((a, b) => (new Date(b.created_at).getTime() - new Date(a.created_at).getTime()));
        }
        combinedError = directErr || assigneesErr || null;
      }

      // If that fails or returns no attachments, try a comprehensive fallback approach
      if (combinedError || !data || data.length === 0) {
        console.log('🔍 DEBUG: Primary queries failed or returned no data, trying comprehensive fallback...');
        
        // Fetch all tasks assigned to the user (both direct and via task_assignees)
        const { data: directTasksOnly, error: directError } = await supabase
          .from('tasks')
          .select('*')
          .eq('assigned_to', user.id);

        const { data: assigneeTaskIds, error: assigneeError } = await supabase
          .from('task_assignees')
          .select('task_id')
          .eq('user_id', user.id);

        if (directError && assigneeError) {
          throw new Error(`Failed to fetch tasks: ${directError?.message || assigneeError?.message}`);
        }

        // Combine task IDs from both sources
        const allTaskIds = new Set<string>();
        (directTasksOnly || []).forEach(task => allTaskIds.add(task.id));
        (assigneeTaskIds || []).forEach(item => allTaskIds.add(item.task_id));

        if (allTaskIds.size === 0) {
          console.log('🔍 DEBUG: No tasks found for user');
          data = [];
        } else {
          // Fetch full task data for all task IDs
          const { data: allTasksData, error: allTasksError } = await supabase
            .from('tasks')
            .select('*')
            .in('id', Array.from(allTaskIds))
            .order('created_at', { ascending: false });

          if (allTasksError) {
            throw allTasksError;
          }

          // Fetch attachments for each task
          const tasksWithAttachments = await Promise.all(
            (allTasksData || []).map(async (task) => {
              const { data: attachments, error: attachmentsError } = await supabase
                .from('task_attachments')
                .select('*')
                .eq('task_id', task.id);

              const { data: proofs, error: proofsError } = await supabase
                .from('task_proofs')
                .select('status, image_url, description, reviewed_at')
                .eq('task_id', task.id);

              if (attachmentsError) {
                console.error('Error fetching attachments for task:', task.id, attachmentsError);
              }

              if (proofsError) {
                console.error('Error fetching proofs for task:', task.id, proofsError);
              }

              return {
                ...task,
                task_attachments: attachments || [],
                task_proofs: proofs || []
              };
            })
          );

          data = tasksWithAttachments;
          console.log('🔍 DEBUG: Fallback method found tasks:', data.length);
        }
      }

      if (combinedError && (!data || data.length === 0)) {
        console.error('Supabase error fetching tasks:', combinedError);
        throw new Error(`Database error: ${combinedError}`);
      }
      
      const processedTasks = (data || []).map(task => ({
        ...task,
        hasApprovedProof: task.task_proofs?.some((proof: any) => proof.status === 'Approved')
      }));
      
      // Debug: Log task attachments
      console.log('🔍 DEBUG: Tasks fetched:', processedTasks.length);
      console.log('🔍 DEBUG: Current user ID:', user?.id);
      console.log('🔍 DEBUG: Tasks with attachments:', processedTasks.filter(task => task.task_attachments && task.task_attachments.length > 0));
      
      processedTasks.forEach((task, index) => {
        console.log(`🔍 DEBUG: Task ${index + 1} (${task.title}):`, {
          id: task.id,
          assigned_to: task.assigned_to,
          isAssignedToCurrentUser: task.assigned_to === user?.id,
          attachments: task.task_attachments,
          attachmentCount: task.task_attachments?.length || 0,
          attachmentDetails: task.task_attachments?.map((att: any) => ({
            id: att.id,
            file_name: att.file_name,
            file_type: att.file_type,
            file_url: att.file_url
          }))
        });
      });
      
      // Test direct attachment query
      console.log('🔍 DEBUG: Testing direct attachment query...');
      const { data: directAttachments, error: directError } = await supabase
        .from('task_attachments')
        .select('*')
        .limit(5);
      
      console.log('🔍 DEBUG: Direct attachment query result:', {
        error: directError,
        count: directAttachments?.length || 0,
        sample: directAttachments?.[0]
      });
      
      setTasks(processedTasks);
    } catch (error: any) {
      console.error('Error fetching tasks:', error);
      
      // Provide more specific error messages
      let errorMessage = 'Failed to fetch tasks';
      
      if (error.message?.includes('relation "tasks" does not exist')) {
        errorMessage = 'Tasks table not found. Please run database migrations.';
      } else if (error.message?.includes('permission denied')) {
        errorMessage = 'Permission denied. Please check your access rights.';
      } else if (error.message?.includes('Database error')) {
        errorMessage = `Database error: ${error.message.split('Database error: ')[1]}`;
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  }

  async function updateTaskStatus(taskId: string, newStatus: Task['status']) {
    try {
      const now = new Date().toISOString();
      const task = tasks.find(t => t.id === taskId);
      if (!task) {
        toast.error('Task not found');
        return;
      }

      // Check if the task is assigned to the current user
      if (task.assigned_to !== user?.id) {
        toast.error('You are not authorized to update this task');
        return;
      }

      let updates: any = {
        status: newStatus,
        updated_at: now
      };

      // Handle timing updates
      if (newStatus === 'In Progress') {
        if (!task.started_at) {
          updates.started_at = now;
        } else if (task.last_pause_at) {
          // Calculate additional pause duration if resuming
          const pauseDuration = Math.max(0, new Date(now).getTime() - new Date(task.last_pause_at).getTime());
          const currentPauseMs = parseIntervalToMs(task.total_pause_duration);
          updates.total_pause_duration = `${Math.floor((currentPauseMs + pauseDuration) / 1000)} seconds`;
          updates.last_pause_at = null;
        }
      } else if (newStatus === 'Paused') {
        updates.last_pause_at = now;
      }

      const { error } = await supabase
        .from('tasks')
        .update(updates)
        .eq('id', taskId)
        .eq('assigned_to', user?.id); // Additional security check

      if (error) {
        console.error('Supabase update error:', error);
        toast.error(error.message || 'Failed to update task status');
        return;
      }

      setTasks(prev =>
        prev.map(t => (t.id === taskId ? { ...t, ...updates } : t))
      );

      toast.success(`Task ${newStatus.toLowerCase()}`);
    } catch (error) {
      console.error('Error updating task:', error);
      toast.error('Failed to update task status');
    }
  }

  const handleCompleteClick = (task: Task) => {
    setSelectedTask(task);
    setShowSubmissionForm(true);
  };

  const handleSubmitProof = async (data: { taskId: string; proofPhoto: string; notes: string }) => {
    try {
      if (!user) throw new Error('User not authenticated');

      // Upload the image to storage and use its public URL
      const storagePath = `${data.taskId}/${Date.now()}.jpg`;
      const blob = await fetch(data.proofPhoto).then(res => res.blob());
      const { error: uploadError } = await supabase.storage
        .from('task-proofs')
        .upload(storagePath, blob, { contentType: 'image/jpeg', cacheControl: '3600' });
      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage
        .from('task-proofs')
        .getPublicUrl(storagePath);

      // Create the task proof row with correct columns
      const { error: proofError } = await supabase
        .from('task_proofs')
        .insert([
          {
            task_id: data.taskId,
            image_url: publicUrlData.publicUrl,
            description: data.notes,
            submitted_by: user.id,
            status: 'Pending',
          },
        ]);
      if (proofError) throw proofError;

      // Then update the task status
      const now = new Date().toISOString();
      const task = tasks.find(t => t.id === data.taskId);
      
      if (task) {
        type TaskUpdate = Partial<Task> & { updated_at: string };
        const updates: TaskUpdate = {
          status: 'Completed',
          completed_at: now,
          updated_at: now,
          proof_photo_url: publicUrlData.publicUrl,
          completion_notes: data.notes,
        };

        if (task.last_pause_at) {
          const pauseDuration = new Date(now).getTime() - new Date(task.last_pause_at).getTime();
          const currentPauseMs = parseIntervalToMs(task.total_pause_duration);
          updates.total_pause_duration = currentPauseMs + pauseDuration;
        }

        const { error: taskError } = await supabase
          .from('tasks')
          .update(updates)
          .eq('id', data.taskId);

        if (taskError) throw taskError;
      }

      toast.success('Task proof submitted successfully');
      setShowSubmissionForm(false);
      fetchTasks();
    } catch (error) {
      console.error('Error submitting task proof:', error);
      toast.error('Failed to submit task proof');
    }
  };

  const handleDeleteTask = async () => {
    if (!taskToDelete) return;

    try {
      const { error } = await supabase
        .from('tasks')
        .delete()
        .eq('id', taskToDelete.id);

      if (error) throw error;

      setTasks(prev => prev.filter(task => task.id !== taskToDelete.id));
      toast.success('Task deleted successfully');
      setTaskToDelete(null);
    } catch (error) {
      console.error('Error deleting task:', error);
      toast.error('Failed to delete task');
    }
  };

  const handleShowLocationTasks = (taskId?: string) => {
    setSelectedLocationTaskId(taskId);
    setShowLocationMap(true);
  };

  const filteredTasks = tasks.filter(task => {
    if (filter === 'active') return (task.status !== 'Completed' || !task.hasApprovedProof) && task.status !== 'Planned';
    if (filter === 'completed') return task.status === 'Completed' && task.hasApprovedProof;
    return true;
  });

  const getStatusColor = (status: string, hasApprovedProof: boolean | undefined) => {
    if (status === 'Completed' && hasApprovedProof) {
      return 'bg-green-100 text-green-800';
    }
    switch (status) {
      case 'Planned':
        return 'bg-blue-100 text-blue-800';
      case 'Not Started':
        return 'bg-gray-100 text-gray-800';
      case 'In Progress':
        return 'bg-blue-100 text-blue-800';
      case 'Paused':
        return 'bg-yellow-100 text-yellow-800';
      case 'Completed':
        return 'bg-yellow-100 text-yellow-800'; // Pending approval
      case 'Pending':
        return 'bg-orange-100 text-orange-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusText = (status: string, hasApprovedProof: boolean | undefined) => {
    if (status === 'Completed') {
      return hasApprovedProof ? 'Completed' : 'Pending Approval';
    }
    return status;
  };

  return (
    <Layout>
      <div className="px-2 sm:px-4 md:px-6 lg:px-8">
        <div className="sm:flex sm:items-center sm:justify-between">
          <div className="sm:flex-auto">
            <h1 className="text-xl sm:text-3xl font-semibold text-gray-900">My Tasks</h1>
            <p className="mt-1 sm:mt-2 text-sm text-gray-700">
              A list of all your assigned tasks and their current status.
            </p>
          </div>
          <div className="mt-4 sm:mt-0">
            <button
              onClick={() => handleShowLocationTasks()}
              className="w-full sm:w-auto inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 touch-manipulation transform active:scale-95 transition-transform"
            >
              <MapIcon className="h-5 w-5 mr-2" />
              View Location Tasks
            </button>
          </div>
        </div>

        <div className="mt-4 sm:mt-6 bg-white rounded-lg shadow">
          <div className="p-3 sm:p-4 border-b border-gray-200">
            <div className="flex flex-wrap gap-2 sm:gap-3">
              <button
                onClick={() => setFilter('all')}
                className={`w-full sm:w-auto px-4 py-2 text-sm font-medium rounded-md touch-manipulation transform active:scale-95 transition-transform ${
                  filter === 'all'
                    ? 'bg-pink-100 text-pink-700'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                All Tasks
              </button>
              <button
                onClick={() => setFilter('active')}
                className={`w-full sm:w-auto px-4 py-2 text-sm font-medium rounded-md touch-manipulation transform active:scale-95 transition-transform ${
                  filter === 'active'
                    ? 'bg-pink-100 text-pink-700'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Active
              </button>
              <button
                onClick={() => setFilter('completed')}
                className={`w-full sm:w-auto px-4 py-2 text-sm font-medium rounded-md touch-manipulation transform active:scale-95 transition-transform ${
                  filter === 'completed'
                    ? 'bg-pink-100 text-pink-700'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Completed
              </button>
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center items-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-pink-500"></div>
            </div>
          ) : filteredTasks.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500">No tasks found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <ul role="list" className="divide-y divide-gray-200">
                {filteredTasks.map((task) => (
                  <li key={task.id} className="px-3 sm:px-4 py-4">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className={`inline-flex items-center px-3 py-1 rounded-full text-xs sm:text-sm font-semibold border
                              ${task.priority === 'High' ? 'bg-red-100 text-red-800 border-red-300' : ''}
                              ${task.priority === 'Medium' ? 'bg-yellow-100 text-yellow-800 border-yellow-300' : ''}
                              ${task.priority === 'Low' ? 'bg-green-100 text-green-800 border-green-300' : ''}`}
                          >
                            Priority: {task.priority}
                          </span>
                          <h3 className="text-base sm:text-lg font-medium text-gray-900 truncate">{task.title}</h3>
                        </div>
                        <p className="mt-1 text-xs sm:text-sm text-gray-500 line-clamp-2">{task.description}</p>
                        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
                          <div className="flex items-center text-xs sm:text-sm text-gray-500">
                            <CalendarIcon className="mr-1.5 h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0 text-gray-400" />
                            Due: {new Date(task.due_date).toLocaleDateString()}
                          </div>
                          <div className="flex items-center text-xs sm:text-sm text-gray-500">
                            <CurrencyDollarIcon className="mr-1.5 h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0 text-gray-400" />
                            {formatCurrency(task.price)}
                          </div>
                          {(task as any).location_based && (
                            <div className="flex items-center text-xs sm:text-sm text-indigo-600">
                              <MapIcon className="mr-1.5 h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0" />
                              Location Required
                            </div>
                          )}
                          <div className="flex items-center">
                            <TaskCountdown dueDate={task.due_date} status={task.status} />
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-col sm:flex-row gap-2 items-end sm:items-center">
                        <span className={`inline-flex items-center px-2.5 sm:px-3 py-0.5 sm:py-1 rounded-full text-xs sm:text-sm font-medium ${getStatusColor(task.status, task.hasApprovedProof)}`}>
                          {getStatusText(task.status, task.hasApprovedProof)}
                          {task.status === 'In Progress' && typeof (task as any).progress_percentage === 'number' && (
                            <span className="ml-2 text-gray-700">{(task as any).progress_percentage}%</span>
                          )}
                        </span>
                        {task.status === 'In Progress' && task.assigned_to === user?.id && (
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              min={0}
                              max={100}
                              step={1}
                              value={typeof (task as any).progress_percentage === 'number' ? (task as any).progress_percentage : ''}
                              onChange={(e) => updateTaskProgress(task.id, Number(e.target.value))}
                              className="block w-20 rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-xs sm:text-sm"
                              aria-label="Progress percentage"
                              placeholder="0-100"
                            />
                            <span className="text-xs text-gray-500">%</span>
                          </div>
                        )}
                        <div className="flex gap-2">
                          {/* View Attachments Button */}
                          <button
                            onClick={() => setShowAttachments(task)}
                            className="inline-flex items-center px-2 py-1 border border-gray-300 text-xs sm:text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 touch-manipulation transform active:scale-95"
                            aria-label="View attachments"
                            title={task.task_attachments && task.task_attachments.length > 0 
                              ? `View ${task.task_attachments.length} attachment${task.task_attachments.length > 1 ? 's' : ''}`
                              : 'View attachments'
                            }
                          >
                            <EyeIcon className="h-4 w-4" />
                            <span className="ml-1 hidden sm:inline">
                              {task.task_attachments ? task.task_attachments.length : '0'}
                            </span>
                          </button>
                          
                          {/* View on Map Button for location-based tasks */}
                          {(task as any).location_based && (
                            <button
                              onClick={() => handleShowLocationTasks(task.id)}
                              className="inline-flex items-center px-2 py-1 border border-indigo-300 text-xs sm:text-sm font-medium rounded-md text-indigo-700 bg-indigo-50 hover:bg-indigo-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 touch-manipulation transform active:scale-95"
                              title="View task location on map"
                            >
                              <MapIcon className="h-4 w-4" />
                              <span className="ml-1 hidden sm:inline">Map</span>
                            </button>
                          )}
                          
                          {task.status !== 'Completed' && task.status !== 'Planned' && (
                            <>
                              {task.status === 'In Progress' ? (
                                <button
                                  onClick={() => updateTaskStatus(task.id, 'Paused')}
                                  className="inline-flex items-center px-3 py-1 border border-transparent text-xs sm:text-sm font-medium rounded-md shadow-sm text-white bg-yellow-600 hover:bg-yellow-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500 touch-manipulation transform active:scale-95"
                                >
                                  <PauseIcon className="h-4 w-4 mr-1" />
                                  Pause
                                </button>
                              ) : (
                                <button
                                  onClick={() => updateTaskStatus(task.id, 'In Progress')}
                                  className="inline-flex items-center px-3 py-1 border border-transparent text-xs sm:text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 touch-manipulation transform active:scale-95"
                                >
                                  <PlayIcon className="h-4 w-4 mr-1" />
                                  {task.status === 'Paused' ? 'Resume' : 'Start'}
                                </button>
                              )}
                              {(task.status === 'In Progress' || task.status === 'Paused') && (
                                <button
                                  onClick={() => handleCompleteClick(task)}
                                  className="inline-flex items-center px-3 py-1 border border-transparent text-xs sm:text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 touch-manipulation transform active:scale-95"
                                >
                                  <CheckIcon className="h-4 w-4 mr-1" />
                                  Complete
                                </button>
                              )}
                              {/* Latest proof status badge */}
                              {Array.isArray((task as any).task_proofs) && (task as any).task_proofs.length > 0 && (
                                (() => {
                                  const latest = [...(task as any).task_proofs].sort((a: any, b: any) => new Date(b.reviewed_at || b.created_at).getTime() - new Date(a.reviewed_at || a.created_at).getTime())[0];
                                  if (!latest) return null;
                                  if (latest.status === 'Approved') {
                                    return (
                                      <span className="inline-flex items-center px-2 py-1 rounded-md text-xs sm:text-sm font-medium bg-green-100 text-green-800">
                                        Approved
                                      </span>
                                    );
                                  }
                                  if (latest.status === 'Rejected') {
                                    return (
                                      <span className="inline-flex items-center px-2 py-1 rounded-md text-xs sm:text-sm font-medium bg-red-100 text-red-800">
                                        Rejected
                                      </span>
                                    );
                                  }
                                  return (
                                    <span className="inline-flex items-center px-2 py-1 rounded-md text-xs sm:text-sm font-medium bg-yellow-100 text-yellow-800">
                                      Pending
                                    </span>
                                  );
                                })()
                              )}
                            </>
                          )}
                          <button
                            onClick={() => setTaskToDelete(task)}
                            className="inline-flex items-center px-2 py-1 border border-gray-300 text-xs sm:text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 touch-manipulation transform active:scale-95"
                            aria-label="Delete task"
                          >
                            <TrashIcon className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* Task Submission Form */}
      {showSubmissionForm && selectedTask && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" />
            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <TaskSubmissionWithProof
                taskId={selectedTask.id}
                onSubmit={handleSubmitProof}
                onCancel={() => setShowSubmissionForm(false)}
              />
            </div>
          </div>
        </div>
      )}

      {/* Delete Task Modal */}
      {taskToDelete && (
        <DeleteTaskModal
          isOpen={!!taskToDelete}
          onClose={() => setTaskToDelete(null)}
          onConfirm={handleDeleteTask}
          taskTitle={taskToDelete.title}
        />
      )}

      {/* View Attachments Modal */}
      <TaskAttachmentModal
        isOpen={!!showAttachments}
        onClose={() => setShowAttachments(null)}
        task={showAttachments}
      />

      {/* Location Tasks Map Modal */}
      {showLocationMap && (
        <TasksWithLocationMap
          onClose={() => {
            setShowLocationMap(false);
            setSelectedLocationTaskId(undefined);
          }}
          selectedTaskId={selectedLocationTaskId}
        />
      )}
    </Layout>
  );
}

export default withPermission(Tasks, {
  pageName: 'tasks',
  requiredPermission: 'view',
  showPermissionIndicator: true
}); 