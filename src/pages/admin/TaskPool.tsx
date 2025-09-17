import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Layout from '../../components/Layout';
import { supabase } from '../../lib/supabase';
import { Task, User } from '../../types/index';
import { formatCurrency } from '../../utils/currency';
import toast from 'react-hot-toast';
import {
  UserIcon,
  ClockIcon,
  CalendarIcon,
  CurrencyDollarIcon,
  PlusIcon,
  DocumentIcon,
} from '@heroicons/react/outline';
import { ResponsiveContainer, ResponsiveCard } from '../../components/ui/ResponsiveComponents';

export default function TaskPool() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [employees, setEmployees] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [assigningTask, setAssigningTask] = useState<string | null>(null);
  const [selectedAssigneesByTask, setSelectedAssigneesByTask] = useState<Record<string, Set<string>>>({});

  useEffect(() => {
    fetchTasks();
    fetchEmployees();
  }, []);

  async function fetchTasks() {
    try {
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .is('assigned_to', null)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Supabase error fetching tasks:', error);
        throw new Error(`Database error: ${error.message}`);
      }
      const taskList = data || [];
      setTasks(taskList);

      // Seed existing assignees from task_assignees and legacy assigned_to so UI shows names when present
      if (taskList.length > 0) {
        try {
          const taskIds = taskList.map((t: Task) => t.id);
          const { data: taRows, error: taError } = await supabase
            .from('task_assignees')
            .select('task_id,user_id')
            .in('task_id', taskIds);

          if (taError) {
            console.warn('Could not fetch task_assignees:', taError);
          } else if (taRows && taRows.length > 0) {
            const nextState: Record<string, Set<string>> = {};
            for (const row of taRows as Array<{ task_id: string; user_id: string }>) {
              if (!nextState[row.task_id]) nextState[row.task_id] = new Set<string>();
              nextState[row.task_id].add(row.user_id);
            }
            // Also seed from legacy single assigned_to field if present
            for (const t of taskList) {
              if (t.assigned_to) {
                if (!nextState[t.id]) nextState[t.id] = new Set<string>();
                nextState[t.id].add(t.assigned_to);
              }
            }
            setSelectedAssigneesByTask((prev) => ({ ...prev, ...nextState }));
          } else {
            // No task_assignees rows; fallback to legacy assigned_to seeding only
            const nextState: Record<string, Set<string>> = {};
            for (const t of taskList) {
              if (t.assigned_to) {
                nextState[t.id] = new Set<string>([t.assigned_to]);
              }
            }
            if (Object.keys(nextState).length > 0) {
              setSelectedAssigneesByTask((prev) => ({ ...prev, ...nextState }));
            }
          }
        } catch (seedError) {
          console.warn('Error seeding assignees state:', seedError);
        }
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

  async function fetchEmployees() {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('role', 'employee');

      if (error) {
        console.error('Supabase error fetching employees:', error);
        throw new Error(`Database error: ${error.message}`);
      }
      setEmployees(data || []);
    } catch (error: any) {
      console.error('Error fetching employees:', error);
      
      // Provide more specific error messages
      let errorMessage = 'Failed to fetch employees';
      
      if (error.message?.includes('relation "users" does not exist')) {
        errorMessage = 'Users table not found. Please run database migrations.';
      } else if (error.message?.includes('permission denied')) {
        errorMessage = 'Permission denied. Please check your access rights.';
      } else if (error.message?.includes('Database error')) {
        errorMessage = `Database error: ${error.message.split('Database error: ')[1]}`;
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      toast.error(errorMessage);
    }
  }

  function toggleAssignee(taskId: string, employeeId: string) {
    setSelectedAssigneesByTask((prev: Record<string, Set<string>>) => {
      const current = new Set(prev[taskId] || []);
      if (current.has(employeeId)) {
        current.delete(employeeId);
      } else {
        current.add(employeeId);
      }
      return { ...prev, [taskId]: current };
    });
  }

  async function assignTask(taskId: string, employeeId: string) {
    try {
      const { error } = await supabase
        .from('tasks')
        .update({
          assigned_to: employeeId,
          updated_at: new Date().toISOString()
        })
        .eq('id', taskId);

      if (error) throw error;

      toast.success('Task assigned successfully');
      setAssigningTask(null);
      fetchTasks(); // Refresh the task list
    } catch (error) {
      console.error('Error assigning task:', error);
      toast.error('Failed to assign task');
    }
  }

  async function assignMultiple(taskId: string) {
    try {
      const selection = Array.from(selectedAssigneesByTask[taskId] || []);
      if (selection.length === 0) {
        toast.error('Select at least one employee');
        return;
      }

      // Set primary assignee for compatibility
      const primaryAssignee = selection[0];
      const { error: updateError } = await supabase
        .from('tasks')
        .update({ assigned_to: primaryAssignee, updated_at: new Date().toISOString() })
        .eq('id', taskId);
      if (updateError) throw updateError;

      // Insert all assignees into task_assignees (ignore duplicates)
      const rows = selection.map((userId) => ({ task_id: taskId, user_id: userId }));
      const { error: insertError } = await supabase
        .from('task_assignees')
        .upsert(rows, { onConflict: 'task_id,user_id' });
      if (insertError) throw insertError;

      toast.success('Task assigned to selected employees');
      setAssigningTask(null);
      setSelectedAssigneesByTask((prev: Record<string, Set<string>>) => ({ ...prev, [taskId]: new Set() }));
      fetchTasks();
    } catch (error) {
      console.error('Error assigning multiple employees:', error);
      toast.error('Failed to assign to selected employees');
    }
  }

  const getStatusColor = (priority: string) => {
    switch (priority) {
      case 'High':
        return 'bg-red-100 text-red-800';
      case 'Medium':
        return 'bg-yellow-100 text-yellow-800';
      case 'Low':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <Layout>
      <ResponsiveContainer>
        <div className="space-y-4 sm:space-y-6">
          {/* Header Section */}
          <ResponsiveCard>
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-between items-start sm:items-center">
              <div>
                <h1 className="text-xl sm:text-2xl font-semibold text-gray-900">Task Pool</h1>
                <p className="mt-1 text-sm text-gray-600">
                  Unassigned tasks waiting to be assigned to employees.
                </p>
              </div>
              <Link
                to="/admin/tasks/create"
                className="w-full sm:w-auto inline-flex items-center justify-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 touch-manipulation transform active:scale-95 transition-transform"
              >
                <PlusIcon className="h-5 w-5 mr-2" />
                Create Task
              </Link>
            </div>
          </ResponsiveCard>

          {/* Content Section */}
          <ResponsiveCard>
            {loading ? (
              <div className="flex justify-center items-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500"></div>
              </div>
            ) : tasks.length === 0 ? (
              <div className="text-center py-12">
                <div className="mx-auto h-12 w-12 text-gray-400">
                  <DocumentIcon className="h-12 w-12" />
                </div>
                <h3 className="mt-2 text-sm font-medium text-gray-900">No unassigned tasks</h3>
                <p className="mt-1 text-sm text-gray-500">
                  All tasks have been assigned or there are no tasks yet.
                </p>
                <div className="mt-6">
                  <Link
                    to="/admin/tasks/create"
                    className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 touch-manipulation transform active:scale-95 transition-transform"
                  >
                    <PlusIcon className="h-5 w-5 mr-2" />
                    Create New Task
                  </Link>
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <ul role="list" className="divide-y divide-gray-200">
                  {tasks.map((task: Task) => (
                    <li key={task.id} className="px-3 sm:px-4 py-4 hover:bg-gray-50 transition-colors">
                      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                        {/* Task Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                            <p className="text-base sm:text-lg font-medium text-indigo-600 truncate">
                              {task.title}
                            </p>
                            <div className="flex items-center gap-2">
                              <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(task.priority)}`}>
                                {task.priority}
                              </span>
                              <span
                                className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-100 text-gray-800 max-w-[160px] sm:max-w-[260px] md:max-w-[320px] whitespace-nowrap overflow-hidden text-ellipsis"
                                title={(() => {
                                  const selected = Array.from(selectedAssigneesByTask[task.id] || new Set<string>());
                                  const names = selected
                                    .map((id) => employees.find((e) => e.id === id)?.full_name)
                                    .filter(Boolean) as string[];
                                  return names.length > 0 ? names.join(', ') : 'Unassigned';
                                })()}
                              >
                              {(() => {
                                const selected = Array.from(selectedAssigneesByTask[task.id] || new Set<string>());
                                if (selected.length > 0) {
                                  const names = selected
                                    .map((id) => employees.find((e) => e.id === id)?.full_name)
                                    .filter(Boolean) as string[];
                                  if (names.length === 1) return names[0];
                                  return `${names[0]} + ${names.length - 1} selected`;
                                }
                                return 'Unassigned';
                              })()}
                              </span>
                            </div>
                          </div>
                          <p className="mt-1 text-sm text-gray-600 line-clamp-2">{task.description}</p>
                          
                          {/* Task Details */}
                          <div className="mt-3 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                            <div className="flex items-center text-xs sm:text-sm text-gray-500">
                              <ClockIcon className="h-4 w-4 mr-1.5 flex-shrink-0" />
                              <span>{task.actual_time || 0}h estimated</span>
                            </div>
                            <div className="flex items-center text-xs sm:text-sm text-gray-500">
                              <CurrencyDollarIcon className="h-4 w-4 mr-1.5 flex-shrink-0" />
                              <span>{formatCurrency(task.price)}</span>
                            </div>
                            <div className="flex items-center text-xs sm:text-sm text-gray-500">
                              <CalendarIcon className="h-4 w-4 mr-1.5 flex-shrink-0" />
                              <span>Due: {new Date(task.due_date).toLocaleDateString()}</span>
                            </div>
                          </div>
                        </div>

                        {/* Assignment Controls */}
                        <div className="flex-shrink-0">
                          {assigningTask === task.id ? (
                            <div className="flex flex-col gap-2 sm:gap-3">
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-auto border rounded-md p-2">
                                {employees.map((employee: User) => {
                                  const selected = (selectedAssigneesByTask[task.id] || new Set()).has(employee.id);
                                  return (
                                    <label key={employee.id} className="inline-flex items-center gap-2 text-sm text-gray-700">
                                      <input
                                        type="checkbox"
                                        className="h-4 w-4 text-indigo-600 border-gray-300 rounded"
                                        checked={selected}
                                        onChange={() => toggleAssignee(task.id, employee.id)}
                                      />
                                      <span>{employee.full_name}</span>
                                    </label>
                                  );
                                })}
                              </div>
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => assignMultiple(task.id)}
                                  className="inline-flex items-center justify-center px-3 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 touch-manipulation transform active:scale-95 transition-transform"
                                >
                                  Assign Selected
                                </button>
                                <button
                                  onClick={() => setAssigningTask(null)}
                                  className="inline-flex items-center justify-center px-3 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 touch-manipulation transform active:scale-95 transition-transform"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          ) : (
                            <button
                              onClick={() => setAssigningTask(task.id)}
                              className="w-full sm:w-auto inline-flex items-center justify-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 touch-manipulation transform active:scale-95 transition-transform"
                            >
                              <UserIcon className="h-5 w-5 mr-2" />
                              Assign
                            </button>
                          )}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </ResponsiveCard>
        </div>
      </ResponsiveContainer>
    </Layout>
  );
} 