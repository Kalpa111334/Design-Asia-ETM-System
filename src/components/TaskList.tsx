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
  CalendarIcon
} from '@heroicons/react/outline';
import { formatCurrency } from '../utils/currency';
import { format } from 'date-fns';
import { ResponsiveContainer } from './ui/ResponsiveComponents';

interface TaskListProps {
  isAdmin?: boolean;
}

export default function TaskList({ isAdmin = false }: TaskListProps) {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [users, setUsers] = useState<{ [key: string]: User }>({});
  const [taskAssignees, setTaskAssignees] = useState<{ [key: string]: User[] }>({});
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    fetchTasks();
    fetchUsers();
    if (isAdmin) {
      fetchTaskAssignees();
    }
  }, [user, isAdmin]);

  async function fetchTasks() {
    try {
      if (!user) {
        console.log('No user found, skipping task fetch');
        setLoading(false);
        return;
      }

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
      } else {
        const { data, error } = await supabase.from('tasks').select('*');
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

      const usersMap = (data || []).reduce((acc, user) => {
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

      const assigneesMap = (data || []).reduce((acc, assignee) => {
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

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Task List */}
      <div className="overflow-x-auto">
        <ul role="list" className="divide-y divide-gray-200">
          {filteredTasks.map((task) => (
            <li key={task.id}>
              <div className="px-3 sm:px-4 py-4 hover:bg-gray-50 transition-colors">
                {/* Main Task Info */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
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
                      </div>
                    </div>
                  </div>
                  
                  {/* Price and Action Button */}
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
                    <span className="text-sm text-gray-700 font-medium flex items-center">
                      <span className="text-gray-500 mr-1">LKR</span>
                      {formatCurrency(task.price)}
                    </span>
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
      {filteredTasks.length === 0 && (
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
    </div>
  );
}