import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { format, subDays, startOfMonth, endOfMonth } from 'date-fns';
import { PDFDownloadLink, Document, Page, Text, View, StyleSheet, Font } from '@react-pdf/renderer';
import Layout from '../../components/Layout';
import { Task, User } from '../../types/index';
import {
  ChartBarIcon,
  DocumentDownloadIcon,
  UserGroupIcon,
  CalendarIcon,
  CurrencyDollarIcon,
  ClockIcon
} from '@heroicons/react/outline';
import {
  ResponsiveCard,
  ResponsiveGrid,
  ResponsiveContainer,
  ResponsiveFlex,
  ResponsiveTable,
  StatCard,
} from '../../components/ui/ResponsiveComponents';
import { formatCurrency } from '../../utils/currency';
import { GeofencingService } from '../../services/GeofencingService';

// Register font to avoid PDF rendering issues
Font.register({
  family: 'Helvetica',
  fonts: [
    { src: 'https://fonts.gstatic.com/s/helveticaneue/v70/1Ptsg8zYS_SKggPNyC0IT4ttDfA.ttf' }
  ]
});

interface TaskReport {
  taskId: string;
  title: string;
  status: string;
  startedAt: string | null;
  completedAt: string | null;
  totalWorkingTime: string;
  price: number;
}

interface EmployeeReport {
  id: string;
  fullName: string;
  email: string;
  tasksCompleted: number;
  totalEarnings: number;
  averageCompletionTime: string;
  tasks: TaskReport[];
}

interface DailyReport {
  date: string;
  tasksCompleted: number;
  totalWorkingHours: number;
  totalEarnings: number;
  employees: {
    id: string;
    name: string;
    tasksCompleted: number;
    hoursWorked: number;
    earnings: number;
  }[];
}

// Enhanced PDF styles
const styles = StyleSheet.create({
  page: {
    padding: 30,
    fontFamily: 'Helvetica',
  },
  title: {
    fontSize: 24,
    marginBottom: 20,
    textAlign: 'center',
    color: '#1F2937',
  },
  section: {
    marginBottom: 20,
    padding: 10,
    backgroundColor: '#F9FAFB',
    borderRadius: 5,
  },
  header: {
    fontSize: 18,
    marginBottom: 10,
    color: '#374151',
    fontWeight: 'bold',
  },
  row: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    paddingVertical: 8,
    marginBottom: 4,
  },
  cell: {
    flex: 1,
    padding: 5,
  },
  bold: {
    fontWeight: 'bold',
  },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 30,
    right: 30,
    textAlign: 'center',
    color: '#6B7280',
    fontSize: 10,
  },
  value: {
    fontWeight: 'bold',
  },
});

// PDF Document components
const EmployeePDFReport = ({ employee }: { employee: EmployeeReport }) => (
  <Document>
    <Page size="A4" style={styles.page}>
      <Text style={styles.title}>Employee Performance Report</Text>
      
      <View style={styles.section}>
        <Text style={styles.header}>Employee Details</Text>
        <Text>Name: {employee.fullName}</Text>
        <Text>Email: {employee.email}</Text>
        <Text>Tasks Completed: {employee.tasksCompleted}</Text>
        <Text>Total Earnings: {formatCurrency(employee.totalEarnings)}</Text>
        <Text>Average Completion Time: {employee.averageCompletionTime}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.header}>Task Details</Text>
        {employee.tasks.map((task, index) => (
          <View key={index} style={styles.row}>
            <Text style={styles.cell}>{task.title}</Text>
            <Text style={styles.cell}>{task.totalWorkingTime}</Text>
            <Text style={styles.cell}>{formatCurrency(task.price)}</Text>
          </View>
        ))}
      </View>
    </Page>
  </Document>
);

const DailyPDFReport = ({ report }: { report: DailyReport }) => (
  <Document>
    <Page size="A4" style={styles.page}>
      <Text style={styles.title}>Daily Performance Report</Text>
      <Text style={styles.header}>Date: {report.date}</Text>

      <View style={styles.section}>
        <Text style={styles.header}>Summary</Text>
        <Text>Total Tasks Completed: {report.tasksCompleted}</Text>
        <Text>Total Working Hours: {Math.round(report.totalWorkingHours * 10) / 10}h</Text>
        <Text style={styles.value}>Total Earnings: {formatCurrency(report.totalEarnings)}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.header}>Employee Breakdown</Text>
        {report.employees.map((emp, index) => (
          <View key={index} style={styles.row}>
            <Text style={styles.cell}>{emp.name}</Text>
            <Text style={styles.cell}>{emp.tasksCompleted} tasks</Text>
            <Text style={styles.cell}>{Math.round(emp.hoursWorked * 10) / 10}h</Text>
            <Text style={styles.cell}>{formatCurrency(emp.earnings)}</Text>
          </View>
        ))}
      </View>
    </Page>
  </Document>
);

export default function Reports() {
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [selectedEmployee, setSelectedEmployee] = useState<string>('');
  const [employees, setEmployees] = useState<EmployeeReport[]>([]);
  const [dailyReport, setDailyReport] = useState<DailyReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<'daily' | 'weekly' | 'monthly'>('daily');
  const [monthlyStats, setMonthlyStats] = useState<{
    totalTasks: number;
    totalEarnings: number;
    avgCompletionTime: number;
    topPerformer: string;
  } | null>(null);
  // Location & Attendance report state
  const [attStart, setAttStart] = useState<string>(format(new Date(), 'yyyy-MM-01'));
  const [attEnd, setAttEnd] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [attEmployee, setAttEmployee] = useState<string>('');
  const [attGenerating, setAttGenerating] = useState<boolean>(false);

  useEffect(() => {
    fetchEmployeeReports();
    fetchMonthlyStats();
    if (selectedDate) {
      fetchDailyReport();
    }
  }, [selectedDate, dateRange]);

  async function fetchEmployeeReports() {
    try {
      const { data: users, error: usersError } = await supabase
        .from('users')
        .select('id, full_name, email');

      if (usersError) throw usersError;
      if (!users) return;

      const employeeReports: EmployeeReport[] = await Promise.all(
        users.map(async (user) => {
          const { data: tasks, error: tasksError } = await supabase
            .from('tasks')
            .select('*')
            .eq('assigned_to', user.id)
            .eq('status', 'Completed');

          if (tasksError) throw tasksError;
          if (!tasks) return {
            id: user.id,
            fullName: user.full_name,
            email: user.email,
            tasksCompleted: 0,
            totalEarnings: 0,
            averageCompletionTime: '0h',
            tasks: []
          };

          const totalEarnings = tasks.reduce((sum, task) => sum + (task.price || 0), 0);
          const avgTime = tasks.length > 0
            ? tasks.reduce((sum, task) => {
                if (!task.started_at || !task.completed_at) return sum;
                const workingTime = new Date(task.completed_at).getTime() - new Date(task.started_at).getTime();
                return sum + workingTime;
              }, 0) / tasks.length / (1000 * 60 * 60)
            : 0;

          return {
            id: user.id,
            fullName: user.full_name,
            email: user.email,
            tasksCompleted: tasks.length,
            totalEarnings,
            averageCompletionTime: `${Math.round(avgTime * 10) / 10}h`,
            tasks: tasks.map(task => ({
              taskId: task.id,
              title: task.title,
              status: task.status,
              startedAt: task.started_at,
              completedAt: task.completed_at,
              totalWorkingTime: task.started_at && task.completed_at
                ? `${Math.round((new Date(task.completed_at).getTime() - new Date(task.started_at).getTime()) / (1000 * 60 * 60) * 10) / 10}h`
                : '0h',
              price: task.price || 0
            }))
          };
        })
      );

      setEmployees(employeeReports);
    } catch (error) {
      console.error('Error fetching reports:', error);
    } finally {
      setLoading(false);
    }
  }

  async function fetchMonthlyStats() {
    try {
      const start = startOfMonth(new Date());
      const end = endOfMonth(new Date());

      const { data: monthTasks, error } = await supabase
        .from('tasks')
        .select(`
          *,
          assigned_user:users!tasks_assigned_to_fkey(
            id,
            full_name
          )
        `)
        .gte('created_at', start.toISOString())
        .lte('created_at', end.toISOString());

      if (error) throw error;
      if (!monthTasks) return;

      const stats = monthTasks.reduce((acc: any, task) => {
        if (task.status === 'Completed') {
          acc.totalTasks++;
          acc.totalEarnings += task.price || 0;
          
          if (task.started_at && task.completed_at) {
            const completionTime = new Date(task.completed_at).getTime() - new Date(task.started_at).getTime();
            acc.totalTime += completionTime;
            acc.completedTasksCount++;
          }

          // Track employee performance
          acc.employeeStats[task.assigned_to] = acc.employeeStats[task.assigned_to] || {
            name: task.assigned_user?.full_name || 'Unknown',
            tasksCompleted: 0,
            earnings: 0
          };
          acc.employeeStats[task.assigned_to].tasksCompleted++;
          acc.employeeStats[task.assigned_to].earnings += task.price || 0;
        }
        return acc;
      }, {
        totalTasks: 0,
        totalEarnings: 0,
        totalTime: 0,
        completedTasksCount: 0,
        employeeStats: {}
      });

      // Find top performer
      const topPerformer = Object.values(stats.employeeStats)
        .sort((a: any, b: any) => b.tasksCompleted - a.tasksCompleted)[0] as any;

      setMonthlyStats({
        totalTasks: stats.totalTasks,
        totalEarnings: stats.totalEarnings,
        avgCompletionTime: stats.completedTasksCount ? stats.totalTime / stats.completedTasksCount / (1000 * 60 * 60) : 0,
        topPerformer: topPerformer?.name || 'N/A'
      });
    } catch (error) {
      console.error('Error fetching monthly stats:', error);
    }
  }

  async function fetchDailyReport() {
    try {
      const startDate = new Date(selectedDate);
      const endDate = new Date(selectedDate);
      endDate.setDate(endDate.getDate() + 1);

      const { data: dailyTasks, error: tasksError } = await supabase
        .from('tasks')
        .select(`
          *,
          assigned_to,
          assigned_user:users!tasks_assigned_to_fkey(
            id,
            full_name
          )
        `)
        .gte('started_at', startDate.toISOString())
        .lt('started_at', endDate.toISOString());

      if (tasksError) throw tasksError;
      if (!dailyTasks) return;

      const employeeStats = dailyTasks.reduce((acc: Record<string, any>, task) => {
        const employeeId = task.assigned_to;
        if (!acc[employeeId]) {
          acc[employeeId] = {
            id: employeeId,
            name: task.assigned_user?.full_name || 'Unknown',
            tasksCompleted: 0,
            hoursWorked: 0,
            earnings: 0
          };
        }

        if (task.status === 'Completed') {
          acc[employeeId].tasksCompleted += 1;
          acc[employeeId].earnings += task.price || 0;
        }

        const workingTime = task.completed_at && task.started_at
          ? (new Date(task.completed_at).getTime() - new Date(task.started_at).getTime()) / (1000 * 60 * 60)
          : 0;
        acc[employeeId].hoursWorked += workingTime;

        return acc;
      }, {});

      const report: DailyReport = {
        date: format(startDate, 'MMMM dd, yyyy'),
        tasksCompleted: dailyTasks.filter(t => t.status === 'Completed').length,
        totalWorkingHours: Object.values(employeeStats).reduce((sum: number, emp: any) => sum + emp.hoursWorked, 0),
        totalEarnings: Object.values(employeeStats).reduce((sum: number, emp: any) => sum + emp.earnings, 0),
        employees: Object.values(employeeStats)
      };

      setDailyReport(report);
    } catch (error) {
      console.error('Error fetching daily report:', error);
    }
  }

  // Helper: Fetch location-based tasks and attendance events
  async function generateLocationAttendanceData(empId: string, startISO: string, endISO: string) {
    // Tasks assigned to employee in window
    const { data: tasksDirect } = await supabase
      .from('tasks')
      .select('*, task_locations(*), task_location_events(*)')
      .eq('assigned_to', empId)
      .gte('created_at', startISO)
      .lte('created_at', endISO);

    const { data: viaAssignees } = await supabase
      .from('task_assignees')
      .select('task:tasks(*, task_locations(*), task_location_events(*))')
      .eq('user_id', empId);

    const tasks = (() => {
      const primary = tasksDirect || [];
      const joined = (viaAssignees || []).map((r: any) => r.task).filter(Boolean);
      const byId = new Map<string, any>();
      [...primary, ...joined].forEach((t: any) => byId.set(t.id, t));
      return Array.from(byId.values());
    })();

    // Attendance events (check_in/check_out) for employee in window
    const { data: events } = await supabase
      .from('task_location_events')
      .select('*')
      .eq('user_id', empId)
      .gte('timestamp', startISO)
      .lte('timestamp', endISO)
      .order('timestamp', { ascending: true });

    // Movement history in window (optional, for metrics)
    const movement = await GeofencingService.getMovementHistory(empId, new Date(startISO), new Date(endISO));

    return { tasks, events: events || [], movement };
  }

  function exportAttendanceCSV(rows: Array<Record<string, any>>, filename: string) {
    const headers = Object.keys(rows[0] || {});
    const csv = [headers.join(','), ...rows.map(r => headers.map(h => JSON.stringify(r[h] ?? '')).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function exportAttendancePDF(summary: { employeeName: string; start: string; end: string; }, rows: Array<Record<string, any>>, filename: string) {
    const { default: jsPDF } = await import('jspdf');
    // @ts-ignore
    const autoTable = (await import('jspdf-autotable')).default;
    const doc = new jsPDF();
    doc.setFontSize(14);
    doc.text('Location-based Tasks & Attendance Report', 14, 16);
    doc.setFontSize(11);
    doc.text(`Employee: ${summary.employeeName}`, 14, 24);
    doc.text(`Period: ${summary.start} to ${summary.end}`, 14, 30);
    const headers = Object.keys(rows[0] || {});
    const body = rows.map(r => headers.map(h => String(r[h] ?? '')));
    autoTable(doc, { startY: 36, head: [headers], body });
    doc.save(filename);
  }

  async function handleDownloadAttendance(kind: 'csv' | 'pdf') {
    try {
      if (!attEmployee) throw new Error('Please select an employee');
      setAttGenerating(true);
      const startISO = new Date(attStart);
      const endISO = new Date(attEnd);
      endISO.setHours(23,59,59,999);

      const { data: user } = await supabase.from('users').select('full_name').eq('id', attEmployee).single();
      const employeeName = user?.full_name || 'Employee';

      const { tasks, events, movement } = await generateLocationAttendanceData(attEmployee, startISO.toISOString(), endISO.toISOString());

      // Flatten rows per task and event
      const rows: Array<Record<string, any>> = [];
      tasks.forEach((t: any) => {
        const taskEvents = events.filter(e => e.task_id === t.id);
        const firstCheckIn = taskEvents.find(e => e.event_type === 'check_in');
        const lastCheckOut = [...taskEvents].reverse().find(e => e.event_type === 'check_out');
        rows.push({
          task_title: t.title,
          status: t.status,
          due_date: t.due_date ? new Date(t.due_date).toLocaleString() : '',
          location_required: t.location_required ? 'yes' : 'no',
          check_in_time: firstCheckIn ? new Date(firstCheckIn.timestamp).toLocaleString() : '',
          check_out_time: lastCheckOut ? new Date(lastCheckOut.timestamp).toLocaleString() : '',
          check_in_lat: firstCheckIn?.latitude ?? '',
          check_in_lng: firstCheckIn?.longitude ?? '',
          check_out_lat: lastCheckOut?.latitude ?? '',
          check_out_lng: lastCheckOut?.longitude ?? '',
        });
      });

      // Add summary row using movement metrics
      if (movement && movement.length > 1) {
        // compute distance via service util
        let distance = 0;
        for (let i = 1; i < movement.length; i++) {
          distance += GeofencingService.calculateDistance(
            movement[i-1].latitude, movement[i-1].longitude,
            movement[i].latitude, movement[i].longitude
          );
        }
        rows.push({ task_title: '[Summary]', status: '', due_date: '', location_required: '', check_in_time: '', check_out_time: '', check_in_lat: '', check_in_lng: '', check_out_lat: '', check_out_lng: '',
          total_distance_km: Math.round(distance/1000*100)/100
        });
      }

      const filenameBase = `${employeeName.replace(/\s+/g,'_')}_location_attendance_${attStart}_to_${attEnd}`;
      if (kind === 'csv') {
        exportAttendanceCSV(rows, `${filenameBase}.csv`);
      } else {
        await exportAttendancePDF({ employeeName, start: attStart, end: attEnd }, rows, `${filenameBase}.pdf`);
      }
    } catch (e: any) {
      console.error('Export error:', e);
    } finally {
      setAttGenerating(false);
    }
  }

  if (loading) {
    return (
      <Layout>
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-pink-500"></div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <ResponsiveContainer>
        <div className="space-y-6">
          {/* Header */}
          <ResponsiveFlex className="justify-between items-center">
            <h1 className="text-2xl font-semibold text-gray-900">Reports Dashboard</h1>
            <div className="w-full sm:w-auto">
              <label htmlFor="date-range" className="sr-only">Date Range</label>
              <select
                id="date-range"
                className="w-full sm:w-auto rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                value={dateRange}
                onChange={(e) => setDateRange(e.target.value as any)}
              >
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
            </div>
          </ResponsiveFlex>

          {/* Monthly Overview */}
          {monthlyStats && (
            <ResponsiveCard>
              <h2 className="text-xl font-semibold mb-4 flex items-center">
                <CalendarIcon className="h-6 w-6 mr-2 text-indigo-500" />
                Monthly Overview
              </h2>
              <ResponsiveGrid cols={{ default: 1, sm: 2, lg: 4 }} gap={4}>
                <StatCard
                  icon={<ChartBarIcon className="h-8 w-8" />}
                  title="Total Tasks"
                  value={monthlyStats.totalTasks}
                  color="indigo"
                />
                <StatCard
                  icon={<CurrencyDollarIcon className="h-8 w-8" />}
                  title="Total Earnings"
                  value={formatCurrency(monthlyStats.totalEarnings)}
                  color="green"
                />
                <StatCard
                  icon={<ClockIcon className="h-8 w-8" />}
                  title="Avg Completion Time"
                  value={`${Math.round(monthlyStats.avgCompletionTime * 10) / 10}h`}
                  color="blue"
                />
                <StatCard
                  icon={<UserGroupIcon className="h-8 w-8" />}
                  title="Top Performer"
                  value={monthlyStats.topPerformer}
                  color="purple"
                />
              </ResponsiveGrid>
            </ResponsiveCard>
          )}

          {/* Employee Reports Section */}
          <ResponsiveCard>
            <ResponsiveFlex className="justify-between items-center mb-4">
              <h2 className="text-xl font-semibold flex items-center">
                <UserGroupIcon className="h-6 w-6 mr-2 text-indigo-500" />
                Employee Reports
              </h2>
              <div className="w-full sm:w-auto">
                <label htmlFor="employee-filter" className="sr-only">Filter by Employee</label>
                <select
                  id="employee-filter"
                  className="w-full sm:w-auto rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                  value={selectedEmployee}
                  onChange={(e) => setSelectedEmployee(e.target.value)}
                >
                  <option value="">All Employees</option>
                  {employees.map(emp => (
                    <option key={emp.id} value={emp.id}>{emp.fullName}</option>
                  ))}
                </select>
              </div>
            </ResponsiveFlex>
            <ResponsiveGrid cols={{ default: 1, md: 2, lg: 3 }} gap={4}>
              {employees
                .filter(emp => !selectedEmployee || emp.id === selectedEmployee)
                .map(employee => (
                  <div key={employee.id} className="border rounded-lg p-4 hover:shadow-lg transition-shadow duration-200">
                    <h3 className="font-semibold text-lg text-indigo-600">{employee.fullName}</h3>
                    <p className="text-sm text-gray-600">{employee.email}</p>
                    <div className="mt-4 space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-gray-600">Tasks Completed</span>
                        <span className="font-semibold">{employee.tasksCompleted}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-600">Total Earnings</span>
                        <div className="text-lg font-semibold">
                          {formatCurrency(employee.totalEarnings)}
                        </div>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-600">Avg. Completion Time</span>
                        <span className="font-semibold">{employee.averageCompletionTime}</span>
                      </div>
                    </div>
                    <div className="mt-4 flex justify-end">
                      <PDFDownloadLink
                        document={<EmployeePDFReport employee={employee} />}
                        fileName={`${employee.fullName.replace(' ', '_')}_report.pdf`}
                        className="inline-flex items-center text-sm text-indigo-600 hover:text-indigo-900"
                      >
                        {({ loading }) => (
                          <>
                            <DocumentDownloadIcon className="h-5 w-5 mr-1" />
                            {loading ? 'Generating...' : 'Download Report'}
                          </>
                        )}
                      </PDFDownloadLink>
                    </div>
                  </div>
                ))}
            </ResponsiveGrid>
          </ResponsiveCard>

          {/* Daily Report Section */}
          <ResponsiveCard>
            <ResponsiveFlex className="justify-between items-center mb-4">
              <h2 className="text-xl font-semibold flex items-center">
                <CalendarIcon className="h-6 w-6 mr-2 text-indigo-500" />
                Daily Report
              </h2>
              <div className="w-full sm:w-auto flex items-center gap-2">
                <label htmlFor="report-date" className="text-sm font-medium text-gray-700 whitespace-nowrap">
                  Select Date
                </label>
                <input
                  id="report-date"
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="w-full sm:w-auto rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                />
              </div>
            </ResponsiveFlex>

            {dailyReport && (
              <div>
                <ResponsiveGrid cols={{ default: 1, sm: 3 }} gap={4} className="mb-6">
                  <StatCard
                    icon={<ChartBarIcon className="h-8 w-8" />}
                    title="Tasks Completed"
                    value={dailyReport.tasksCompleted}
                    color="indigo"
                  />
                  <StatCard
                    icon={<ClockIcon className="h-8 w-8" />}
                    title="Total Working Hours"
                    value={`${Math.round(dailyReport.totalWorkingHours * 10) / 10}h`}
                    color="green"
                  />
                  <StatCard
                    icon={<CurrencyDollarIcon className="h-8 w-8" />}
                    title="Total Earnings"
                    value={formatCurrency(dailyReport.totalEarnings)}
                    color="blue"
                  />
                </ResponsiveGrid>

                <div className="mt-6">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Employee Breakdown</h3>
                  <ResponsiveTable>
                    <table className="min-w-full divide-y divide-gray-300">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900">Employee</th>
                          <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Tasks</th>
                          <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Hours</th>
                          <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Earnings</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200 bg-white">
                        {dailyReport.employees.map((emp, index) => (
                          <tr key={emp.id} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                            <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900">
                              {emp.name}
                            </td>
                            <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                              {emp.tasksCompleted}
                            </td>
                            <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                              {Math.round(emp.hoursWorked * 10) / 10}h
                            </td>
                            <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                              {formatCurrency(emp.earnings)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </ResponsiveTable>
                </div>

                <div className="mt-6 flex justify-end">
                  <PDFDownloadLink
                    document={<DailyPDFReport report={dailyReport} />}
                    fileName={`daily_report_${selectedDate}.pdf`}
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                  >
                    {({ loading }) => (
                      <>
                        <DocumentDownloadIcon className="h-5 w-5 mr-2" />
                        {loading ? 'Generating PDF...' : 'Download Daily Report'}
                      </>
                    )}
                  </PDFDownloadLink>
                </div>
              </div>
            )}
          </ResponsiveCard>

          {/* Location-based Tasks + Attendance Report */}
          <ResponsiveCard>
            <ResponsiveFlex className="justify-between items-center mb-4">
              <h2 className="text-xl font-semibold flex items-center">
                <UserGroupIcon className="h-6 w-6 mr-2 text-indigo-500" />
                Location & Attendance Report
              </h2>
            </ResponsiveFlex>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700">Employee</label>
                <select
                  className="mt-1 w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                  value={attEmployee}
                  onChange={(e) => setAttEmployee(e.target.value)}
                >
                  <option value="">Select Employee</option>
                  {employees.map(emp => (
                    <option key={emp.id} value={emp.id}>{emp.fullName}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Start Date</label>
                <input
                  type="date"
                  className="mt-1 w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                  value={attStart}
                  onChange={(e) => setAttStart(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">End Date</label>
                <input
                  type="date"
                  className="mt-1 w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                  value={attEnd}
                  onChange={(e) => setAttEnd(e.target.value)}
                />
              </div>
              <div className="flex items-end space-x-2">
                <button
                  onClick={() => handleDownloadAttendance('csv')}
                  disabled={attGenerating}
                  className="w-full inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  {attGenerating ? 'Generating…' : 'Download CSV'}
                </button>
                <button
                  onClick={() => handleDownloadAttendance('pdf')}
                  disabled={attGenerating}
                  className="w-full inline-flex items-center justify-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  {attGenerating ? 'Generating…' : 'Download PDF'}
                </button>
              </div>
            </div>
          </ResponsiveCard>
        </div>
      </ResponsiveContainer>
    </Layout>
  );
}