import { Link } from 'react-router-dom';
import Layout from '../../components/Layout';
import TaskList from '../../components/TaskList';
import { PlusIcon } from '@heroicons/react/outline';
import { ResponsiveContainer, ResponsiveCard } from '../../components/ui/ResponsiveComponents';
import { withPermission } from '../../components/withPermission';

function AdminTasks() {
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
              <Link
                to="/admin/tasks/create"
                className="w-full sm:w-auto inline-flex items-center justify-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 touch-manipulation transform active:scale-95 transition-transform"
              >
                <PlusIcon className="h-5 w-5 mr-2" />
                Create Task
              </Link>
            </div>
          </ResponsiveCard>

          {/* Tasks List Section */}
          <ResponsiveCard>
            <TaskList isAdmin={true} />
          </ResponsiveCard>
        </div>
      </ResponsiveContainer>
    </Layout>
  );
}

export default withPermission(AdminTasks, {
  pageName: 'tasks',
  requiredPermission: 'view',
  showPermissionIndicator: true
}); 