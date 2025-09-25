import React, { useState, useEffect } from 'react';
import { Task, User } from '../types/index';

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
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import TaskCountdown from './TaskCountdown';
import {
  CheckIcon,
  PauseIcon,
  PlayIcon,
  XIcon,
  DocumentIcon,
  EyeIcon,
  ClockIcon,
  UserIcon,
  CalendarIcon,
  TrashIcon,
  ChevronLeftIcon,
  ChevronRightIcon
} from '@heroicons/react/outline';
import { formatCurrency } from '../utils/currency';
import { format } from 'date-fns';
import { ResponsiveContainer } from './ui/ResponsiveComponents';
import { taskDeletionService } from '../services/taskDeletionService';
import RealTimeTaskService from '../services/RealTimeTaskService';

interface TaskListProps {
  isAdmin?: boolean;
}

interface PaginationInfo {
  currentPage: number;
  totalPages: number;
  totalTasks: number;
  pageSize: number;
}

interface ConfirmDeleteModalProps {
  isOpen: boolean;
  selectedCount: number;
  onConfirm: () => void;
  onCancel: () => void;
}

// Confirmation Modal Component
function ConfirmDeleteModal({ isOpen, selectedCount, onConfirm, onCancel }: ConfirmDeleteModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
        <div className="mt-3 text-center">
          <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100">
            <TrashIcon className="h-6 w-6 text-red-600" />
          </div>
          <h3 className="text-lg leading-6 font-medium text-gray-900 mt-4">
            Permanently Delete Tasks
          </h3>
          <div className="mt-2 px-7 py-3">
            <p className="text-sm text-gray-500">
              Are you sure you want to permanently delete {selectedCount} task{selectedCount > 1 ? 's' : ''}? 
              This action cannot be undone.
            </p>
          </div>
          <div className="items-center px-4 py-3">
            <button
              onClick={onConfirm}
              className="px-4 py-2 bg-red-600 text-white text-base font-medium rounded-md w-full shadow-sm hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500"
            >
              Delete Permanently
            </button>
            <button
              onClick={onCancel}
              className="mt-3 px-4 py-2 bg-gray-300 text-gray-700 text-base font-medium rounded-md w-full shadow-sm hover:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-500"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function TaskList({ isAdmin = false }: TaskListProps) {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [users, setUsers] = useState<{ [key: string]: User }>({});
  const [taskAssignees, setTaskAssignees] = useState<{ [key: string]: User[] }>({});
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  
  // Selection and deletion states
  const [selectedTasks, setSelectedTasks] = useState<Set<string>>(new Set());
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  
  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalTasks, setTotalTasks] = useState(0);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    fetchTasks();
    fetchUsers();
    if (isAdmin) {
      fetchTaskAssignees();
    }
  }, [user, isAdmin, currentPage, pageSize, filter, refreshTrigger]);

  // Realtime subscriptions for task changes
  useEffect(() => {
    if (!user) return;

    const subscriptionKey = `tasklist_${isAdmin ? 'admin' : user.id}`;

    const onRefresh = () => {
      // Minimal debounce via microtask to avoid storms
      setRefreshTrigger(prev => prev + 1);
    };

    let unsubscribe: (() => void) | undefined;

    if (isAdmin) {
      const unsubTasks = RealTimeTaskService.subscribeAdminTasks(subscriptionKey, onRefresh);
      const unsubRelated = RealTimeTaskService.subscribeTaskRelatedForAdmin(`${subscriptionKey}_related`, onRefresh);
      unsubscribe = () => { try { unsubTasks(); } catch {}; try { unsubRelated(); } catch {} };
    } else {
      unsubscribe = RealTimeTaskService.subscribeEmployeeTasks(subscriptionKey, user.id, onRefresh, onRefresh);
    }

    return () => {
      try { unsubscribe?.(); } catch {}
      RealTimeTaskService.unsubscribe(subscriptionKey);
      RealTimeTaskService.unsubscribe(`${subscriptionKey}_related`);
    };
  }, [user, isAdmin]);

  async function fetchTasks() {
    try {
      if (!user) {
        console.log('No user found, skipping task fetch');
        setLoading(false);
        return;
      }

      // Clear existing tasks to prevent showing stale data
      setTasks([]);

      if (!isAdmin) {
        const { data: directTasks, error: directErr } = await supabase.from('tasks').select('*').eq('assigned_to', user.id);
        const { data: viaAssignees, error: assigneesErr } = await supabase
          .from('task_assignees')
          .select('task:tasks(*)')
          .eq('user_id', user.id);

        const error = directErr || assigneesErr || null;
        if (error) {
          console.error('Supabase error fetching tasks:', error);
          throw new Error(`Database error: ${error.message}`);
        }
        const joined = (viaAssignees || []).map((r: any) => r.task).filter(Boolean);
        const byId = new Map<string, any>();
        [...(directTasks || []), ...joined].forEach((t: any) => byId.set(t.id, t));
        setTasks(Array.from(byId.values()));
        setTotalTasks(Array.from(byId.values()).length);
      } else {
        // For admin, implement pagination
        const from = (currentPage - 1) * pageSize;
        const to = from + pageSize - 1;

        // First get the total count
        const { count, error: countError } = await supabase
          .from('tasks')
          .select('*', { count: 'exact', head: true });

        if (countError) {
          console.error('Error getting task count:', countError);
          throw new Error(`Database error: ${countError.message}`);
        }

        setTotalTasks(count || 0);

        // Then get the paginated data
        const { data, error } = await supabase
          .from('tasks')
          .select('*')
          .order('created_at', { ascending: false })
          .range(from, to);

        if (error) {
          console.error('Supabase error fetching tasks:', error);
          throw new Error(`Database error: ${error.message}`);
        }
        setTasks(data || []);
      }
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

  async function fetchUsers() {
    try {
      const { data, error } = await supabase.from('users').select('*');
      if (error) throw error;

      const usersMap = (data || []).reduce((acc: { [key: string]: User }, user: any) => {
        acc[user.id] = user;
        return acc;
      }, {} as { [key: string]: User });

      setUsers(usersMap);
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  }

  async function fetchTaskAssignees() {
    try {
      const { data, error } = await supabase
        .from('task_assignees')
        .select(`
          task_id,
          user_id,
          users!task_assignees_user_id_fkey (
            id,
            full_name,
            email,
            role,
            created_at
          )
        `);
      
      if (error) throw error;

      const assigneesMap = (data || []).reduce((acc: { [key: string]: User[] }, assignee: any) => {
        const taskId = assignee.task_id;
        const user = assignee.users as unknown as User;
        
        if (!acc[taskId]) {
          acc[taskId] = [];
        }
        
        if (user) {
          acc[taskId].push(user);
        }
        
        return acc;
      }, {} as { [key: string]: User[] });

      setTaskAssignees(assigneesMap);
    } catch (error) {
      console.error('Error fetching task assignees:', error);
    }
  }

  async function updateTaskStatus(taskId: string, newStatus: Task['status']) {
    try {
      const now = new Date().toISOString();
      const task = tasks.find(t => t.id === taskId);
      if (!task) return;

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
          const pauseDuration = new Date(now).getTime() - new Date(task.last_pause_at).getTime();
          updates.total_pause_duration = `${Math.floor(((task.total_pause_duration || 0) + pauseDuration) / 1000)} seconds`;
          updates.last_pause_at = null;
        }
      } else if (newStatus === 'Paused') {
        updates.last_pause_at = now;
      } else if (newStatus === 'Completed') {
        updates.completed_at = now;
        if (task.last_pause_at) {
          const pauseDuration = new Date(now).getTime() - new Date(task.last_pause_at).getTime();
          updates.total_pause_duration = `${Math.floor(((task.total_pause_duration || 0) + pauseDuration) / 1000)} seconds`;
        }
      }

      const { error: taskError } = await supabase
        .from('tasks')
        .update(updates)
        .eq('id', taskId);

      if (taskError) throw taskError;

      // Log the action
      const { error: logError } = await supabase
        .from('time_logs')
        .insert({
          task_id: taskId,
          action: newStatus === 'In Progress' 
            ? task.started_at ? 'resume' : 'start'
            : newStatus.toLowerCase(),
          timestamp: now
        });

      if (logError) throw logError;

      setTasks((prev) =>
        prev.map((t) => (t.id === taskId ? { ...t, ...updates } : t))
      );

      toast.success(`Task ${newStatus.toLowerCase()}`);
    } catch (error) {
      console.error('Error updating task:', error);
      toast.error('Failed to update task');
    }
  }

  const calculateWorkingTime = (task: Task): string => {
    if (!task.started_at) return '0h';

    const start = new Date(task.started_at).getTime();
    const end = task.completed_at ? new Date(task.completed_at).getTime() : Date.now();
    const totalPauseDuration = parseIntervalToMs(task.total_pause_duration);
    const currentPauseDuration = task.last_pause_at 
      ? Date.now() - new Date(task.last_pause_at).getTime()
      : 0;

    const workingTimeMs = end - start - totalPauseDuration - (task.status === 'Paused' ? currentPauseDuration : 0);
    const workingTimeHours = Math.round(workingTimeMs / (1000 * 60 * 60) * 10) / 10;

    return `${workingTimeHours}h`;
  };

  // Efficiency = (estimated_time / actual_time) * 100
  const calculateEfficiency = (task: Task): number | null => {
    // Estimated time in minutes (fallback to time_assigning)
    const estimatedMinutes = (task as any).estimated_time ?? task.time_assigning ?? 0;
    const estimatedMs = Math.max(0, Number(estimatedMinutes) || 0) * 60 * 1000;

    // Actual time: from started_at to completed_at or now, minus pauses
    if (!task.started_at) return null;
    const start = new Date(task.started_at).getTime();
    const end = task.completed_at ? new Date(task.completed_at).getTime() : Date.now();
    const totalPauseDuration = parseIntervalToMs(task.total_pause_duration);
    const currentPauseDuration = task.last_pause_at 
      ? Date.now() - new Date(task.last_pause_at).getTime()
      : 0;
    const actualMs = Math.max(0, end - start - totalPauseDuration - (task.status === 'Paused' ? currentPauseDuration : 0));
    if (actualMs <= 0 || estimatedMs <= 0) return null;

    const pct = (estimatedMs / actualMs) * 100;
    return Math.round(pct);
  };

  // Selection handlers
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const allTaskIds = new Set(tasks.map(task => task.id));
      setSelectedTasks(allTaskIds);
    } else {
      setSelectedTasks(new Set());
    }
  };

  const handleSelectTask = (taskId: string, checked: boolean) => {
    const newSelected = new Set(selectedTasks);
    if (checked) {
      newSelected.add(taskId);
    } else {
      newSelected.delete(taskId);
    }
    setSelectedTasks(newSelected);
  };

  // Permanent delete handlers
  const handleDeleteSelected = async () => {
    if (selectedTasks.size === 0) return;
    
    setDeleting(true);
    try {
      const taskIds = Array.from(selectedTasks);
      
      // Clear selection and close modal first for immediate UI feedback
      setSelectedTasks(new Set());
      setShowDeleteModal(false);
      
      console.log('Starting comprehensive task deletion for:', taskIds);
      
      // Use the comprehensive deletion service
      const deletionResult = await taskDeletionService.deleteTasksPermanently(taskIds);
      
      if (!deletionResult.success) {
        throw new Error(`Deletion failed: ${deletionResult.errors.join(', ')}`);
      }
      
      // Log any warnings
      if (deletionResult.warnings.length > 0) {
        console.warn('Deletion warnings:', deletionResult.warnings);
      }
      
      // Calculate if we need to adjust the current page
      const remainingTasks = totalTasks - deletionResult.totalDeleted;
      const maxPageForRemainingTasks = Math.ceil(remainingTasks / pageSize);
      
      // If current page would be empty after deletion, go to the last available page
      if (currentPage > maxPageForRemainingTasks && maxPageForRemainingTasks > 0) {
        setCurrentPage(maxPageForRemainingTasks);
      } else if (remainingTasks === 0) {
        // If no tasks remain, reset to page 1
        setCurrentPage(1);
      }
      
      // Force refresh the task list and assignees
      setRefreshTrigger(prev => prev + 1);
      
      // Also refresh task assignees for admin
      if (isAdmin) {
        fetchTaskAssignees();
      }
      
      // Verify deletion after a short delay
      setTimeout(async () => {
        const verification = await taskDeletionService.verifyDeletion(taskIds);
        if (!verification.success) {
          console.warn('Deletion verification issues:', verification.issues);
          toast.error('Some data may not have been completely deleted. Please refresh the page.');
        } else {
          console.log('✅ Deletion verified successfully - all data removed from database');
        }
      }, 2000);
      
    } catch (error) {
      console.error('Error deleting tasks:', error);
      toast.error(`Failed to delete tasks: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setDeleting(false);
    }
  };

  // Pagination handlers
  const totalPages = Math.ceil(totalTasks / pageSize);
  
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    setSelectedTasks(new Set()); // Clear selection when changing pages
  };

  const handlePageSizeChange = (newPageSize: number) => {
    setPageSize(newPageSize);
    setCurrentPage(1); // Reset to first page
    setSelectedTasks(new Set());
  };

  const getTaskAssignmentDisplay = (task: Task): string => {
    // If this is admin view, check for multiple assignees first
    if (isAdmin && taskAssignees[task.id] && taskAssignees[task.id].length > 0) {
      const assigneeNames = taskAssignees[task.id].map(user => user.full_name).filter(Boolean);
      if (assigneeNames.length > 0) {
        return assigneeNames.join(', ');
      }
    }
    
    // Fallback to single assigned_to field
    if (task.assigned_to && users[task.assigned_to]) {
      return users[task.assigned_to].full_name || 'Unknown';
    }
    
    return 'Unassigned';
  };

  const filteredTasks = tasks.filter((task) => {
    if (filter === 'active') return task.status !== 'Completed';
    if (filter === 'completed') return task.status === 'Completed';
    return true;
  });

  // For admin view, we don't apply additional filtering since pagination is handled server-side
  const displayTasks = isAdmin ? tasks : filteredTasks;

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Admin Controls */}
      {isAdmin && (
        <div className="bg-white px-4 py-3 border-b border-gray-200 sm:px-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            {/* Selection Controls */}
            <div className="flex items-center gap-4">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  checked={selectedTasks.size === tasks.length && tasks.length > 0}
                  onChange={(e) => handleSelectAll(e.target.checked)}
                />
                <span className="ml-2 text-sm text-gray-700">
                  Select All ({selectedTasks.size} selected)
                </span>
              </label>
              
              {selectedTasks.size > 0 && (
                <button
                  onClick={() => setShowDeleteModal(true)}
                  disabled={deleting}
                  className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <TrashIcon className="h-4 w-4 mr-2" />
                  {deleting ? 'Deleting...' : `Delete ${selectedTasks.size} Selected`}
                </button>
              )}
            </div>

            {/* Page Size Control */}
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-700">Show:</label>
              <select
                value={pageSize}
                onChange={(e) => handlePageSizeChange(Number(e.target.value))}
                className="border border-gray-300 rounded-md text-sm px-2 py-1 focus:ring-indigo-500 focus:border-indigo-500"
              >
                <option value={5}>5</option>
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
              </select>
              <span className="text-sm text-gray-700">tasks</span>
            </div>
          </div>
        </div>
      )}

      {/* Task List */}
      <div className="overflow-x-auto">
        <ul role="list" className="divide-y divide-gray-200">
          {displayTasks.map((task) => (
            <li key={task.id}>
              <div className="px-3 sm:px-4 py-4 hover:bg-gray-50 transition-colors">
                {/* Main Task Info */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  {/* Selection Checkbox for Admin */}
                  {isAdmin && (
                    <div className="flex-shrink-0">
                      <input
                        type="checkbox"
                        className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                        checked={selectedTasks.has(task.id)}
                        onChange={(e) => handleSelectTask(task.id, e.target.checked)}
                      />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                      <p className="text-sm sm:text-base font-medium text-indigo-600 truncate">
                        {isAdmin ? (
                          <Link to={`/admin/tasks/${task.id}`} className="hover:underline touch-manipulation">
                            {task.title}
                          </Link>
                        ) : (
                          task.title
                        )}
                      </p>
                      <div className="flex items-center gap-2">
                        <p className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          task.priority === 'High'
                            ? 'bg-red-100 text-red-800'
                            : task.priority === 'Medium'
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-green-100 text-green-800'
                        }`}>
                          {task.priority}
                        </p>
                        <p className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          task.status === 'Completed'
                            ? 'bg-green-100 text-green-800'
                            : task.status === 'In Progress'
                            ? 'bg-blue-100 text-blue-800'
                            : task.status === 'Paused'
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          {task.status}
                        </p>
                        {isAdmin && typeof (task as any).progress_percentage === 'number' && (
                          (() => {
                            const pct = Math.max(0, Math.min(100, Number((task as any).progress_percentage)));
                            const barColor = pct >= 80 ? 'bg-green-500' : pct >= 40 ? 'bg-yellow-500' : 'bg-red-500';
                            return (
                              <div className="ml-1 w-28" title={`${pct}%`}>
                                <div className="relative w-full bg-gray-200 rounded-full h-2">
                                  <div className={`${barColor} h-2 rounded-full transition-all`} style={{ width: `${pct}%` }} />
                                  <span className="absolute inset-0 flex items-center justify-center text-[10px] leading-none text-white">
                                    {pct}%
                                  </span>
                                </div>
                              </div>
                            );
                          })()
                        )}
                      </div>
                    </div>
                  </div>
                  
                  {/* Price and Action Button */}
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
                    <span className="text-sm text-gray-700 font-medium flex items-center">
                      <span className="text-gray-500 mr-1">LKR</span>
                      {formatCurrency(task.price)}
                    </span>
                    {isAdmin && (
                      (() => {
                        const eff = calculateEfficiency(task);
                        if (eff == null) return null;
                        const color = eff >= 100 ? 'text-green-700 bg-green-100 border-green-300' : eff >= 70 ? 'text-yellow-700 bg-yellow-100 border-yellow-300' : 'text-red-700 bg-red-100 border-red-300';
                        return (
                          <span className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded-md border ${color}`} title="Efficiency = Estimated / Actual * 100">
                            Eff: {eff}%
                          </span>
                        );
                      })()
                    )}
                    <div className="flex gap-2">
                      {/* View Attachments Button */}
                      {task.task_attachments && task.task_attachments.length > 0 && (
                        <button
                          onClick={() => {
                            // Create a modal or navigate to view attachments
                            const attachmentUrls = task.task_attachments?.map(att => att.file_url).join('\n');
                            if (attachmentUrls) {
                              alert(`Task Attachments:\n${attachmentUrls}`);
                            }
                          }}
                          className="inline-flex items-center px-2 py-1 border border-gray-300 text-xs sm:text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 touch-manipulation transform active:scale-95"
                          aria-label="View attachments"
                          title={`View ${task.task_attachments.length} attachment${task.task_attachments.length > 1 ? 's' : ''}`}
                        >
                          <EyeIcon className="h-4 w-4" />
                          <span className="ml-1 hidden sm:inline">{task.task_attachments.length}</span>
                        </button>
                      )}
                      
                      {task.status !== 'Completed' && (
                        <button
                          onClick={() => updateTaskStatus(task.id, task.status === 'In Progress' ? 'Paused' : 'In Progress')}
                          className={`w-full sm:w-auto inline-flex items-center justify-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md shadow-sm text-white touch-manipulation transform active:scale-95 transition-transform ${
                            task.status === 'In Progress'
                              ? 'bg-yellow-600 hover:bg-yellow-700'
                              : 'bg-green-600 hover:bg-green-700'
                          } focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500`}
                        >
                          {task.status === 'In Progress' ? 'Pause' : 'Start'}
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Task Details */}
                <div className="mt-3 space-y-2 sm:space-y-0 sm:flex sm:justify-between sm:items-center">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-6">
                    <p className="flex items-center text-xs sm:text-sm text-gray-500">
                      <UserIcon className="flex-shrink-0 mr-1.5 h-4 w-4 sm:h-5 sm:w-5 text-gray-400" />
                      <span className="truncate">{getTaskAssignmentDisplay(task)}</span>
                    </p>
                    <p className="flex items-center text-xs sm:text-sm text-gray-500">
                      <CalendarIcon className="flex-shrink-0 mr-1.5 h-4 w-4 sm:h-5 sm:w-5 text-gray-400" />
                      Due {format(new Date(task.due_date), 'MMM dd, yyyy')}
                    </p>
                    <div className="flex items-center text-xs sm:text-sm text-gray-500">
                      <ClockIcon className="flex-shrink-0 mr-1.5 h-4 w-4 sm:h-5 sm:w-5 text-gray-400" />
                      <span>
                        {task.started_at
                          ? `Started ${format(new Date(task.started_at), 'MMM dd')}`
                          : 'Not started'}
                      </span>
                    </div>
                  </div>
                  
                  {/* Countdown Timer */}
                  <div className="flex justify-start sm:justify-end">
                    <TaskCountdown dueDate={task.due_date} status={task.status} />
                  </div>
                </div>

                {/* Working Time Display */}
                {task.started_at && (
                  <div className="mt-2 flex items-center text-xs sm:text-sm text-gray-500">
                    <ClockIcon className="flex-shrink-0 mr-1.5 h-4 w-4 text-gray-400" />
                    <span>Working time: {calculateWorkingTime(task)}</span>
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      </div>

      {/* Empty State */}
      {displayTasks.length === 0 && (
        <div className="text-center py-12">
          <div className="mx-auto h-12 w-12 text-gray-400">
            <DocumentIcon className="h-12 w-12" />
          </div>
          <h3 className="mt-2 text-sm font-medium text-gray-900">No tasks found</h3>
          <p className="mt-1 text-sm text-gray-500">
            {filter === 'all' 
              ? 'Get started by creating a new task.'
              : `No ${filter} tasks at the moment.`
            }
          </p>
        </div>
      )}

      {/* Pagination Controls for Admin */}
      {isAdmin && totalPages > 1 && (
        <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
          <div className="flex-1 flex justify-between sm:hidden">
            <button
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1}
              className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <button
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
              className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
          <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
            <div>
              <p className="text-sm text-gray-700">
                Showing{' '}
                <span className="font-medium">{(currentPage - 1) * pageSize + 1}</span>
                {' '}to{' '}
                <span className="font-medium">
                  {Math.min(currentPage * pageSize, totalTasks)}
                </span>
                {' '}of{' '}
                <span className="font-medium">{totalTasks}</span>
                {' '}results
              </p>
            </div>
            <div>
              <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                <button
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span className="sr-only">Previous</span>
                  <ChevronLeftIcon className="h-5 w-5" />
                </button>
                
                {/* Page Numbers */}
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum;
                  if (totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (currentPage <= 3) {
                    pageNum = i + 1;
                  } else if (currentPage >= totalPages - 2) {
                    pageNum = totalPages - 4 + i;
                  } else {
                    pageNum = currentPage - 2 + i;
                  }
                  
                  return (
                    <button
                      key={pageNum}
                      onClick={() => handlePageChange(pageNum)}
                      className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                        currentPage === pageNum
                          ? 'z-10 bg-indigo-50 border-indigo-500 text-indigo-600'
                          : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
                
                <button
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span className="sr-only">Next</span>
                  <ChevronRightIcon className="h-5 w-5" />
                </button>
              </nav>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmDeleteModal
        isOpen={showDeleteModal}
        selectedCount={selectedTasks.size}
        onConfirm={handleDeleteSelected}
        onCancel={() => setShowDeleteModal(false)}
      />
    </div>
  );
}