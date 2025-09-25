import { Link } from 'react-router-dom';
import Layout from '../../components/Layout';
import TaskList from '../../components/TaskList';
import LocationAnalytics from '../../components/admin/LocationAnalytics';
import RouteOptimizer from '../../components/admin/RouteOptimizer';
import { PlusIcon, ChartBarIcon, TruckIcon } from '@heroicons/react/outline';
import { ResponsiveContainer, ResponsiveCard } from '../../components/ui/ResponsiveComponents';
import { withPermission } from '../../components/withPermission';
import { useState } from 'react';

function AdminTasks() {
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [showRouteOptimizer, setShowRouteOptimizer] = useState(false);

  return (
    <Layout>
      <ResponsiveContainer>
        <div className="space-y-4 sm:space-y-6">
          {/* Header Section */}
          <ResponsiveCard>
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-between items-start sm:items-center">
              <div>
                <h1 className="text-xl sm:text-2xl font-semibold text-gray-900">Tasks Management</h1>
                <p className="mt-1 text-sm text-gray-600">
                  Manage and monitor all tasks across your organization
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 w-full sm:w-auto">
                <button
                  onClick={() => setShowAnalytics(true)}
                  className="w-full sm:w-auto inline-flex items-center justify-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 touch-manipulation transform active:scale-95 transition-transform"
                >
                  <ChartBarIcon className="h-5 w-5 mr-2" />
                  Analytics
                </button>
                
                <button
                  onClick={() => setShowRouteOptimizer(true)}
                  className="w-full sm:w-auto inline-flex items-center justify-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 touch-manipulation transform active:scale-95 transition-transform"
                >
                  <TruckIcon className="h-5 w-5 mr-2" />
                  Route Optimizer
                </button>
                
                <Link
                  to="/admin/tasks/create"
                  className="w-full sm:w-auto inline-flex items-center justify-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 touch-manipulation transform active:scale-95 transition-transform"
                >
                  <PlusIcon className="h-5 w-5 mr-2" />
                  Create Task
                </Link>
              </div>
            </div>
          </ResponsiveCard>

          {/* Tasks List Section */}
          {!showAnalytics && (
            <ResponsiveCard>
              <TaskList isAdmin={true} />
            </ResponsiveCard>
          )}

          {/* Analytics Section */}
          {showAnalytics && (
            <ResponsiveCard>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-gray-900">Location Analytics</h2>
                <button
                  onClick={() => setShowAnalytics(false)}
                  className="text-gray-600 hover:text-gray-800"
                >
                  Back to Tasks
                </button>
              </div>
              <LocationAnalytics />
            </ResponsiveCard>
          )}
        </div>

        {/* Route Optimizer Modal */}
        {showRouteOptimizer && (
          <RouteOptimizer
            onClose={() => setShowRouteOptimizer(false)}
            employeeId={undefined}
          />
        )}
      </ResponsiveContainer>
    </Layout>
  );
}

export default withPermission(AdminTasks, {
  pageName: 'tasks',
  requiredPermission: 'view',
  showPermissionIndicator: true
}); 