import React from 'react';
import { useState, useEffect } from 'react';
import Layout from '../../components/Layout';
import { withPermission } from '../../components/withPermission';
import { supabase } from '../../lib/supabase';
import { Task } from '../../types/index';
import {
  ChartBarIcon,
  UserGroupIcon,
  ClockIcon,
  CheckIcon,
  DocumentDownloadIcon,
} from '@heroicons/react/outline';
import EmployeeTrackingMapOSM from '../../components/EmployeeTrackingMapOSM';
import { TaskAutoForwardingService } from '../../services/TaskAutoForwardingService';
import { TaskStatusService } from '../../services/TaskStatusService';
import { AlertService } from '../../services/AlertService';
import { DailyTaskReportService } from '../../services/DailyTaskReportService';
import { EmployeeTaskReportService } from '../../services/EmployeeTaskReportService';
import { calculateEffectiveDurationMs, formatDuration } from '../../utils/time';
import { TimeAssigningUtils } from '../../utils/timeAssigning';
import { ResponsiveContainer, ResponsiveGrid, ResponsiveCard, StatCard } from '../../components/ui/ResponsiveComponents';
import TaskProofView from '../../components/TaskProofView';
import { TaskProof } from '../../types/index';

function AdminDashboard() {
  const [stats, setStats] = useState({
    totalTasks: 0,
    completedTasks: 0,
    totalEmployees: 0,
    averageCompletionTime: 0,
    totalActiveMs: 0,
  });
  const [recentTasks, setRecentTasks] = useState<Task[]>([]);
  const [plannedTasks, setPlannedTasks] = useState<Task[]>([]);
  const [pendingTasks, setPendingTasks] = useState<Task[]>([]);
  const [employees, setEmployees] = useState<Array<{id: string, full_name: string, avatar_url?: string}>>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [taskProofs, setTaskProofs] = useState<TaskProof[]>([]);
  const [showTaskProofs, setShowTaskProofs] = useState(false);

  useEffect(() => {
    fetchDashboardData();
    fetchPlannedAndPendingTasks();
    fetchEmployees();
    fetchTaskProofs();
  }, []);

  const fetchEmployees = async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, full_name, avatar_url')
        .eq('role', 'employee')
        .order('full_name');

      if (error) throw error;
      setEmployees(data || []);
    } catch (error) {
      console.error('Error fetching employees:', error);
    }
  };

  const fetchTaskProofs = async () => {
    try {
      const { data, error } = await supabase
        .from('task_proofs')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTaskProofs(data || []);
    } catch (error) {
      console.error('Error fetching task proofs:', error);
    }
  };

  const handleApproveProof = async (proofId: string) => {
    try {
      const { error } = await supabase
        .from('task_proofs')
        .update({ status: 'Approved' })
        .eq('id', proofId);

      if (error) throw error;
      
      // Update local state
      setTaskProofs(prev => prev.map(proof => 
        proof.id === proofId ? { ...proof, status: 'Approved' } : proof
      ));
      
      await AlertService.success('Success', 'Task proof approved successfully!');
    } catch (error) {
      await AlertService.error('Error', 'Failed to approve task proof');
    }
  };

  const handleRejectProof = async (proofId: string) => {
    try {
      const { error } = await supabase
        .from('task_proofs')
        .update({ status: 'Rejected' })
        .eq('id', proofId);

      if (error) throw error;
      
      // Update local state
      setTaskProofs(prev => prev.map(proof => 
        proof.id === proofId ? { ...proof, status: 'Rejected' } : proof
      ));
      
      await AlertService.success('Success', 'Task proof rejected');
    } catch (error) {
      await AlertService.error('Error', 'Failed to reject task proof');
    }
  };

  async function fetchDashboardData() {
    try {
      // Fetch tasks statistics
      const { data: tasks, error: tasksError } = await supabase
        .from('tasks')
        .select('*');

      if (tasksError) throw tasksError;

      // Fetch employees count
      const { count: employeesCount, error: employeesError } = await supabase
        .from('users')
        .select('*', { count: 'exact' })
        .eq('role', 'employee');

      if (employeesError) throw employeesError;

      // Calculate statistics
      const completedTasks = tasks?.filter((task) => task.status === 'Completed') || [];
      const avgTime =
        completedTasks.reduce((acc, task) => acc + (task.actual_time || 0), 0) /
        (completedTasks.length || 1);

      const activeTasks = (tasks || []).filter(t => t.status === 'In Progress' || t.status === 'Paused');
      const totalActiveMs = activeTasks.reduce((sum, t) => sum + calculateEffectiveDurationMs(t as any), 0);

      setStats({
        totalTasks: tasks?.length || 0,
        completedTasks: completedTasks.length,
        totalEmployees: employeesCount || 0,
        averageCompletionTime: Math.round(avgTime),
        totalActiveMs,
      });

      // Set recent tasks
      setRecentTasks(
        (tasks || [])
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
          .slice(0, 5)
      );
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  }

  async function fetchPlannedAndPendingTasks() {
    try {
      const [plannedResult, pendingResult] = await Promise.all([
        TaskAutoForwardingService.getAllPlannedTasks(),
        TaskAutoForwardingService.getAllPendingTasks()
      ]);

      if (plannedResult.error) {
        console.error('Error fetching planned tasks:', plannedResult.error);
      } else {
        setPlannedTasks(plannedResult.data);
      }

      if (pendingResult.error) {
        console.error('Error fetching pending tasks:', pendingResult.error);
      } else {
        setPendingTasks(pendingResult.data);
      }
    } catch (error) {
      console.error('Error fetching planned and pending tasks:', error);
    }
  }

  const handleForwardTasks = async () => {
    try {
      const confirmed = await AlertService.confirm({
        title: 'Forward all overdue Expected tasks?',
        text: 'This will move all overdue Expected tasks to Pending and adjust due dates.',
        confirmText: 'Yes, forward',
        cancelText: 'Cancel',
        icon: 'warning'
      });
      if (!confirmed) return;

      const result = await TaskAutoForwardingService.forwardExpectedTasks();
      if (result.success) {
        await AlertService.success('Tasks forwarded', `Successfully forwarded ${result.forwardedCount} task(s) to Pending.`);
        fetchPlannedAndPendingTasks(); // Refresh the data
        fetchDashboardData();
      } else {
        await AlertService.error('Forwarding failed', result.error || 'Unknown error');
      }
    } catch (error) {
      console.error('Error forwarding tasks:', error);
      await AlertService.error('Error', 'Error forwarding tasks. Please try again.');
    }
  };

  const handleDownloadReport = async () => {
    try {
      setLoading(true);
      const result = await DailyTaskReportService.generateAndDownloadReport();
      if (result.success) {
        await AlertService.success('Success', 'Daily report downloaded successfully!');
      } else {
        await AlertService.error('Error', result.error || 'Failed to generate report');
      }
    } catch (error) {
      await AlertService.error('Error', 'Failed to generate report');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadEmployeeReport = async () => {
    if (!selectedEmployee) {
      await AlertService.error('Error', 'Please select an employee first');
      return;
    }

    try {
      setLoading(true);
      const employee = employees.find(emp => emp.id === selectedEmployee);
      if (!employee) {
        await AlertService.error('Error', 'Employee not found');
        return;
      }

      const result = await EmployeeTaskReportService.generateAndDownloadReport(selectedEmployee, employee.full_name);
      if (result.success) {
        await AlertService.success('Success', `Employee report for ${employee.full_name} downloaded successfully!`);
      } else {
        await AlertService.error('Error', result.error || 'Failed to generate employee report');
      }
    } catch (error) {
      await AlertService.error('Error', 'Failed to generate employee report');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Layout>
        <ResponsiveContainer>
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500"></div>
          </div>
        </ResponsiveContainer>
      </Layout>
    );
  }

  return (
    <Layout>
      <ResponsiveContainer>
        <div className="space-y-4 sm:space-y-6">
          <ResponsiveCard>
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-gray-800 mb-2 sm:mb-4">Admin Dashboard</h1>
                <p className="text-sm sm:text-base text-gray-600">
            Monitor your team's activities and track field employees in real-time.
          </p>
        </div>
              <button
                onClick={handleDownloadReport}
                disabled={loading}
                className="w-full sm:w-auto inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation transform active:scale-95 transition-transform"
              >
                <DocumentDownloadIcon className="h-5 w-5 mr-2" />
                Download Daily Report
              </button>
                    </div>
          </ResponsiveCard>

          {/* Employee Profile Section */}
          <ResponsiveCard>
            <h2 className="text-lg font-semibold text-gray-800 mb-4">Team Members</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {employees.map((employee) => (
                <div key={employee.id} className="bg-white border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center space-x-3">
                    <div className="flex-shrink-0">
                      {employee.avatar_url ? (
                        <img
                          className="h-10 w-10 rounded-full"
                          src={employee.avatar_url}
                          alt={employee.full_name}
                        />
                      ) : (
                        <div className="h-10 w-10 rounded-full bg-indigo-500 flex items-center justify-center">
                          <span className="text-white font-medium text-sm">
                            {employee.full_name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {employee.full_name}
                      </p>
                      <p className="text-sm text-gray-500">Employee</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </ResponsiveCard>

          {/* Employee Filter and Report Section */}
          <ResponsiveCard>
            <h2 className="text-lg font-semibold text-gray-800 mb-4">Employee Reports</h2>
            <div className="flex flex-col sm:flex-row gap-4 items-end">
              <div className="flex-1">
                <label htmlFor="employee-select" className="block text-sm font-medium text-gray-700 mb-2">
                  Select Employee
                </label>
                <select
                  id="employee-select"
                  value={selectedEmployee}
                  onChange={(e) => setSelectedEmployee(e.target.value)}
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm touch-manipulation"
                >
                  <option value="">Choose an employee...</option>
                  {employees.map((employee) => (
                    <option key={employee.id} value={employee.id}>
                      {employee.full_name}
                    </option>
                  ))}
                </select>
              </div>
              <button
                onClick={handleDownloadEmployeeReport}
                disabled={loading || !selectedEmployee}
                className="w-full sm:w-auto inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation transform active:scale-95 transition-transform"
              >
                <DocumentDownloadIcon className="h-5 w-5 mr-2" />
                Download Employee Report
              </button>
                    </div>
          </ResponsiveCard>

          {/* Task Proofs Section */}
          <ResponsiveCard>
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-4">
              <h2 className="text-lg font-semibold text-gray-800">Task Proofs</h2>
              <button
                onClick={() => setShowTaskProofs(!showTaskProofs)}
                className="w-full sm:w-auto inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500"
              >
                {showTaskProofs ? 'Hide Proofs' : 'View Task Proofs'}
              </button>
              </div>

            {showTaskProofs && (
              <div className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setShowTaskProofs(false)}
                    className="px-3 py-1 text-sm font-medium rounded-md bg-gray-100 text-gray-700 hover:bg-gray-200"
                  >
                    All Proofs ({taskProofs.length})
                  </button>
                  <button
                    onClick={() => setShowTaskProofs(false)}
                    className="px-3 py-1 text-sm font-medium rounded-md bg-yellow-100 text-yellow-700 hover:bg-yellow-200"
                  >
                    Pending ({taskProofs.filter(p => p.status === 'Pending').length})
                  </button>
                  <button
                    onClick={() => setShowTaskProofs(false)}
                    className="px-3 py-1 text-sm font-medium rounded-md bg-green-100 text-green-700 hover:bg-green-200"
                  >
                    Approved ({taskProofs.filter(p => p.status === 'Approved').length})
                  </button>
                  <button
                    onClick={() => setShowTaskProofs(false)}
                    className="px-3 py-1 text-sm font-medium rounded-md bg-red-100 text-red-700 hover:bg-red-200"
                  >
                    Rejected ({taskProofs.filter(p => p.status === 'Rejected').length})
                  </button>
                </div>

                <TaskProofView
                  proofs={taskProofs}
                  onApprove={handleApproveProof}
                  onReject={handleRejectProof}
                />
              </div>
            )}
          </ResponsiveCard>

          {/* Employee Tracking Map */}
          <EmployeeTrackingMapOSM />
          
          {/* Stats Section */}
          <div className="mt-6 sm:mt-8">
            <ResponsiveGrid cols={{ default: 1, sm: 2, lg: 4 }} gap={4}>
              <StatCard
                icon={<ChartBarIcon className="h-6 w-6" />}
                title="Total Tasks"
                value={stats.totalTasks.toString()}
                color="indigo"
              />
              <StatCard
                icon={<CheckIcon className="h-6 w-6" />}
                title="Completed Tasks"
                value={stats.completedTasks.toString()}
                color="green"
              />
              <StatCard
                icon={<UserGroupIcon className="h-6 w-6" />}
                title="Total Employees"
                value={stats.totalEmployees.toString()}
                color="blue"
              />
              <StatCard
                icon={<ClockIcon className="h-6 w-6" />}
                title="Total Active Time"
                value={formatDuration(stats.totalActiveMs)}
                color="purple"
              />
            </ResponsiveGrid>
          </div>

          {/* Planned Tasks */}
          {plannedTasks.length > 0 && (
            <div className="mt-6 sm:mt-8">
              <ResponsiveCard>
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-4">
                  <h3 className="text-lg leading-6 font-medium text-gray-900">Planned Tasks</h3>
                  <button
                    onClick={handleForwardTasks}
                    className="w-full sm:w-auto inline-flex items-center justify-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 touch-manipulation transform active:scale-95 transition-transform"
                  >
                    Forward to Pending
                  </button>
                </div>
                <div className="overflow-x-auto">
                <ul role="list" className="divide-y divide-gray-200">
                    {plannedTasks.map((task) => (
                    <li key={task.id}>
                        <div className="px-3 sm:px-4 py-4">
                          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                            <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-indigo-600 truncate">{task.title}</p>
                              <div className="mt-1 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                                <p className="text-xs sm:text-sm text-gray-500">
                                  Assigned to: {task.assigned_to || 'Unknown'}
                                </p>
                                <p className="text-xs sm:text-sm text-gray-500">
                                  Priority: {task.priority}
                                </p>
                                <p className="text-xs sm:text-sm text-gray-500">
                                  Due: {new Date(task.due_date).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                            <div className="flex-shrink-0">
                              <p className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                                Planned
                            </p>
                          </div>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
              </ResponsiveCard>
            </div>
          )}

          {/* Pending Tasks */}
          {pendingTasks.length > 0 && (
            <div className="mt-6 sm:mt-8">
              <ResponsiveCard>
                <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">Pending Tasks (Auto-Forwarded)</h3>
                <div className="overflow-x-auto">
                <ul role="list" className="divide-y divide-gray-200">
                  {pendingTasks.map((task) => (
                    <li key={task.id}>
                        <div className="px-3 sm:px-4 py-4">
                          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                            <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-indigo-600 truncate">{task.title}</p>
                              <div className="mt-1 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                                <p className="text-xs sm:text-sm text-gray-500">
                              Assigned to: {task.assigned_to || 'Unknown'}
                            </p>
                                <p className="text-xs sm:text-sm text-gray-500">
                              Priority: {task.priority}
                            </p>
                                <p className="text-xs sm:text-sm text-gray-500">
                                  Due: {new Date(task.due_date).toLocaleDateString()}
                                </p>
                            {task.original_due_date && (
                                  <p className="text-xs text-orange-500">
                                Originally: {new Date(task.original_due_date).toLocaleDateString()}
                              </p>
                            )}
                              </div>
                            </div>
                            <div className="flex-shrink-0">
                              <p className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-orange-100 text-orange-800">
                                Pending
                              </p>
                          </div>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
              </ResponsiveCard>
            </div>
          )}

          {/* Recent Tasks */}
          <div className="mt-6 sm:mt-8">
            <ResponsiveCard>
              <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">Recent Tasks</h3>
              <div className="overflow-x-auto">
              <ul role="list" className="divide-y divide-gray-200">
                {recentTasks.map((task) => (
                  <li key={task.id}>
                      <div className="px-3 sm:px-4 py-4">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                          <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-indigo-600 truncate">{task.title}</p>
                            <div className="mt-1 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                              <p className="text-xs sm:text-sm text-gray-500">
                                Priority: {task.priority}
                              </p>
                              <p className="text-xs sm:text-sm text-gray-500">
                                Due: {new Date(task.due_date).toLocaleDateString()}
                              </p>
                              <p className="text-xs sm:text-sm text-gray-500">
                                Worked: {formatDuration(calculateEffectiveDurationMs(task as any))}
                              </p>
                            </div>
                          </div>
                          <div className="flex-shrink-0">
                          <p
                            className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                              task.status === 'Completed'
                                ? 'bg-green-100 text-green-800'
                                : 'bg-yellow-100 text-yellow-800'
                            }`}
                          >
                            {task.status}
                          </p>
                        </div>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
              </div>
            </ResponsiveCard>
          </div>
        </div>
      </ResponsiveContainer>
    </Layout>
  );
}

export default withPermission(AdminDashboard, {
  pageName: 'dashboard',
  requiredPermission: 'view',
  showPermissionIndicator: true
}); 