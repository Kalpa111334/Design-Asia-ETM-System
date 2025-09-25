import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './contexts/AuthContext';
import SplashScreen from './components/SplashScreen';
import ErrorBoundary from './components/ErrorBoundary';
import PrivateRoute from './components/PrivateRoute';
import OpenStreetMapLoader from './components/OpenStreetMapLoader';
import AppRoutes from './routes.tsx';
import TaskAutoForwarder from './components/TaskAutoForwarder';
import TaskStatusUpdater from './components/TaskStatusUpdater';
import './styles/mobile-optimization.css';
import { RealtimeProvider } from './contexts/RealtimeContext';

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

// Employee Pages
import EmployeeDashboard from './pages/employee/Dashboard';
import EmployeeTasks from './pages/employee/Tasks';
import EmployeeChat from './pages/employee/Chat';

// Auth Pages
import Login from './pages/Login';
import Register from './pages/Register';

export default function App() {
  const [showSplash, setShowSplash] = useState(true);

  return (
    <ErrorBoundary>
      <Router>
        <AuthProvider>
          {showSplash ? (
            <SplashScreen onFinish={() => setShowSplash(false)} />
          ) : (
            <OpenStreetMapLoader>
              <RealtimeProvider>
                <AppRoutes />
                <TaskAutoForwarder />
                <TaskStatusUpdater 
                  intervalMs={30000}
                  onStatusUpdate={(count) => {
                    if (count > 0) {
                      console.log(`Updated ${count} task statuses`);
                    }
                  }}
                  onTimeCompletion={(count) => {
                    if (count > 0) {
                      console.log(`Auto-completed ${count} tasks based on time`);
                    }
                  }}
                />
                <Toaster position="top-right" />
              </RealtimeProvider>
            </OpenStreetMapLoader>
          )}
        </AuthProvider>
      </Router>
    </ErrorBoundary>
  );
}