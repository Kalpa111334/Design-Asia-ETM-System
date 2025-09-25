import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import PrivateRoute from './components/PrivateRoute';

// Admin Pages
import AdminDashboard from './pages/admin/Dashboard';
import AdminTasks from './pages/admin/Tasks';
import TaskView from './pages/admin/TaskView';
import CreateTask from './pages/admin/CreateTask';
import Analytics from './pages/admin/Analytics';
import Team from './pages/admin/Team';
import Chat from './pages/Chat';
import Reports from './pages/admin/Reports';
import TaskPool from './pages/admin/TaskPool';
import LocationDashboard from './pages/admin/LocationDashboard';
import EmployeeTrackingMapOSM from './components/EmployeeTrackingMapOSM';
import RealTimeMetricsDemo from './components/RealTimeMetricsDemo';
import Meetings from './pages/admin/Meetings';
import PermissionsSettings from './pages/admin/PermissionsSettings';
import Jobs from './pages/admin/Jobs';

// Employee Pages
import EmployeeDashboard from './pages/employee/Dashboard';
import EmployeeTasks from './pages/employee/Tasks';
import LocationTasks from './pages/employee/LocationTasks';

// Auth Pages
import Login from './pages/Login';
import Register from './pages/Register';
import NotFound from './pages/NotFound';

export default function AppRoutes() {
  return (
    <Routes>
      {/* Public routes */}
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />

      {/* Admin routes */}
      <Route path="/admin/*" element={
        <PrivateRoute allowedRoles={['admin']}>
          <Routes>
            <Route path="dashboard" element={<AdminDashboard />} />
            <Route path="tasks" element={<AdminTasks />} />
            <Route path="tasks/pool" element={<TaskPool />} />
            <Route path="tasks/create" element={<CreateTask />} />
            <Route path="tasks/:taskId" element={<TaskView />} />
            <Route path="tracking" element={<EmployeeTrackingMapOSM />} />
            <Route path="metrics-demo" element={<RealTimeMetricsDemo />} />
            <Route path="reports" element={<Reports />} />
            <Route path="analytics" element={<Analytics />} />
            <Route path="team" element={<Team />} />
            <Route path="chat" element={<Chat />} />
            <Route path="location" element={<LocationDashboard />} />
            <Route path="meetings" element={<Meetings />} />
            <Route path="permissions" element={<PermissionsSettings />} />
            <Route path="jobs" element={<Jobs />} />
            <Route index element={<Navigate to="/admin/dashboard" replace />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </PrivateRoute>
      } />

      {/* Employee routes */}
      <Route path="/employee/*" element={
        <PrivateRoute allowedRoles={['employee']}>
          <Routes>
            <Route index element={<EmployeeDashboard />} />
            <Route path="tasks" element={<EmployeeTasks />} />
            <Route path="location-tasks" element={<LocationTasks />} />
            <Route path="chat" element={<Chat />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </PrivateRoute>
      } />

      {/* Default redirect */}
      <Route path="/" element={<Navigate to="/login" replace />} />
      
      {/* 404 Fallback - Must be last */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}