import React, { useState, useEffect } from 'react';
import Layout from '../../components/Layout';
import { PermissionsService, Role, Permission, UserRole, PermissionGroup } from '../../services/PermissionsService';
import { UserPagePermissionsService, UserWithPermissions } from '../../services/UserPagePermissionsService';
import RoleManager from '../../components/admin/RoleManager';
import UserPermissionsModal from '../../components/admin/UserPermissionsModal';
import AdminRoleAssignment from '../../components/admin/AdminRoleAssignment';
import { supabase } from '../../lib/supabase';
import { withPermission } from '../../components/withPermission';
import {
  ShieldCheckIcon,
  UserGroupIcon,
  CogIcon,
  PlusIcon,
  PencilIcon,
  TrashIcon,
  EyeIcon,
  CheckIcon,
  XIcon,
  ClockIcon,
  ExclamationIcon,
  InformationCircleIcon,
  RefreshIcon
} from '@heroicons/react/outline';
import toast from 'react-hot-toast';

interface User {
  id: string;
  email: string;
  full_name: string;
  avatar_url?: string;
  roles: Role[];
}

function PermissionsSettings() {
  const [activeTab, setActiveTab] = useState<'roles' | 'permissions' | 'users' | 'audit'>('roles');
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [permissionGroups, setPermissionGroups] = useState<PermissionGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [selectedUser, setSelectedUser] = useState<UserWithPermissions | null>(null);
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [showUserRoleModal, setShowUserRoleModal] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [systemNotSetUp, setSystemNotSetUp] = useState(false);
  const [usersWithPermissions, setUsersWithPermissions] = useState<UserWithPermissions[]>([]);
  const [showUserPermissionsModal, setShowUserPermissionsModal] = useState(false);
  const [showAdminRoleAssignment, setShowAdminRoleAssignment] = useState(false);
  const [roleForAssignment, setRoleForAssignment] = useState<Role | null>(null);

  // Form states
  const [roleForm, setRoleForm] = useState({
    name: '',
    display_name: '',
    description: '',
    level: 50
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [rolesData, permissionsData, usersData, groupsData, usersWithPermissionsData] = await Promise.all([
        PermissionsService.getAllRoles(),
        PermissionsService.getAllPermissions(),
        PermissionsService.getUsersWithRoles(),
        PermissionsService.getPermissionGroups(),
        UserPagePermissionsService.getUsersWithPermissions()
      ]);

      setRoles(rolesData);
      setPermissions(permissionsData);
      setUsers(usersData);
      setPermissionGroups(groupsData);
      setUsersWithPermissions(usersWithPermissionsData);
      
      console.log('Fetched data:', {
        roles: rolesData.length,
        permissions: permissionsData.length,
        users: usersData.length,
        groups: groupsData.length,
        usersWithPermissions: usersWithPermissionsData.length
      });
    } catch (error: any) {
      console.error('Error fetching data:', error);
      
      // Check if it's a permissions system not set up error
      if (error.message?.includes('relation "roles" does not exist') || 
          error.message?.includes('Permissions system not set up')) {
        setSystemNotSetUp(true);
        toast.error('Permissions system not set up. Please run the database setup first.');
      } else {
        toast.error('Failed to load permissions data');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCreateRole = async () => {
    try {
      await PermissionsService.createRole({ ...roleForm, is_system_role: false });
      toast.success('Role created successfully');
      setShowRoleModal(false);
      setRoleForm({ name: '', display_name: '', description: '', level: 50 });
      fetchData();
    } catch (error: any) {
      console.error('Error creating role:', error);
      
      // Show specific error message
      if (error.message?.includes('Permissions system not set up')) {
        toast.error('Permissions system not set up. Please run the database setup first.');
        setSystemNotSetUp(true);
      } else if (error.message?.includes('already exists')) {
        toast.error('A role with this name already exists. Please choose a different name.');
      } else {
        // Show the actual error message instead of generic permission error
        toast.error(error.message || 'Failed to create role');
      }
    }
  };

  const handleUpdateRole = async () => {
    if (!editingRole) return;

    try {
      await PermissionsService.updateRole(editingRole.id, roleForm);
      toast.success('Role updated successfully');
      setShowRoleModal(false);
      setEditingRole(null);
      setRoleForm({ name: '', display_name: '', description: '', level: 50 });
      fetchData();
    } catch (error) {
      console.error('Error updating role:', error);
      toast.error('Failed to update role');
    }
  };

  const handleDeleteRole = async (roleId: string) => {
    if (!confirm('Are you sure you want to delete this role?')) return;

    try {
      await PermissionsService.deleteRole(roleId);
      toast.success('Role deleted successfully');
      fetchData();
    } catch (error) {
      console.error('Error deleting role:', error);
      toast.error('Failed to delete role');
    }
  };

  const handleUserClick = (user: UserWithPermissions) => {
    setSelectedUser(user);
    setShowUserPermissionsModal(true);
  };

  const handlePermissionsUpdated = () => {
    fetchData(); // Refresh the data
  };

  const handleEditRole = (role: Role) => {
    setEditingRole(role);
    setRoleForm({
      name: role.name,
      display_name: role.display_name,
      description: role.description || '',
      level: role.level
    });
    setShowRoleModal(true);
  };

  const openRoleModal = () => {
    setEditingRole(null);
    setRoleForm({ name: '', display_name: '', description: '', level: 50 });
    setShowRoleModal(true);
  };

  const handleAssignRoleToAdmin = (role: Role) => {
    setRoleForAssignment(role);
    setShowAdminRoleAssignment(true);
  };

  const groupedPermissions = permissions.reduce((acc, permission) => {
    if (!acc[permission.category]) {
      acc[permission.category] = [];
    }
    acc[permission.category].push(permission);
    return acc;
  }, {} as Record<string, Permission[]>);

  const tabs = [
    { id: 'roles', name: 'Roles', icon: ShieldCheckIcon, count: roles.length },
    { id: 'permissions', name: 'Permissions', icon: CogIcon, count: permissions.length },
    { id: 'users', name: 'Users', icon: UserGroupIcon, count: users.length },
    { id: 'audit', name: 'Audit Log', icon: ClockIcon, count: 0 }
  ];

  return (
    <Layout>
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="py-4 sm:py-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
              <div className="min-w-0 flex-1">
                <h1 className="text-xl sm:text-2xl font-bold text-gray-900 flex items-center">
                  <ShieldCheckIcon className="h-6 w-6 sm:h-8 sm:w-8 mr-2 sm:mr-3 text-indigo-600 flex-shrink-0" />
                  <span className="truncate">Permissions & Roles</span>
                </h1>
                <p className="mt-1 text-sm text-gray-600">
                  Manage user roles, permissions, and access controls
                </p>
              </div>
              <div className="flex flex-shrink-0">
                {activeTab === 'roles' && (
                  <button
                    onClick={openRoleModal}
                    className="w-full sm:w-auto inline-flex items-center justify-center px-3 sm:px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                  >
                    <PlusIcon className="h-4 w-4 mr-2" />
                    <span className="hidden sm:inline">Create Role</span>
                    <span className="sm:hidden">Create</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
          {/* Tabs */}
          <div className="border-b border-gray-200 mb-6 sm:mb-8">
            <nav className="-mb-px flex space-x-2 sm:space-x-8 overflow-x-auto">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`py-2 px-1 sm:px-1 border-b-2 font-medium text-xs sm:text-sm flex items-center whitespace-nowrap ${
                      activeTab === tab.id
                        ? 'border-indigo-500 text-indigo-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    <Icon className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2 flex-shrink-0" />
                    <span className="hidden sm:inline">{tab.name}</span>
                    <span className="sm:hidden">{tab.name.split(' ')[0]}</span>
                    {tab.count > 0 && (
                      <span className="ml-1 sm:ml-2 bg-gray-100 text-gray-900 py-0.5 px-1 sm:px-2 rounded-full text-xs">
                        {tab.count}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Content */}
          {loading ? (
            <div className="flex justify-center items-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
            </div>
          ) : systemNotSetUp ? (
            <div className="bg-white shadow rounded-lg p-4 sm:p-8">
              <div className="text-center">
                <ShieldCheckIcon className="mx-auto h-12 w-12 sm:h-16 sm:w-16 text-gray-400 mb-4" />
                <h3 className="text-base sm:text-lg font-medium text-gray-900 mb-2">
                  Permissions System Not Set Up
                </h3>
                <p className="text-sm sm:text-base text-gray-600 mb-4 sm:mb-6">
                  The permissions and roles system needs to be initialized before you can manage user permissions.
                </p>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 sm:p-4 mb-4 sm:mb-6">
                  <h4 className="text-sm font-medium text-blue-900 mb-2">Setup Instructions:</h4>
                  <ol className="text-xs sm:text-sm text-blue-800 text-left space-y-1">
                    <li>1. Open Supabase Dashboard → SQL Editor</li>
                    <li>2. Copy and paste the contents of <code className="bg-blue-100 px-1 rounded">PERMISSIONS_SETUP.sql</code></li>
                    <li>3. Click "Run" to create the permissions system</li>
                    <li>4. Refresh this page</li>
                  </ol>
                </div>
                <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-3">
                  <button
                    onClick={fetchData}
                    className="w-full sm:w-auto inline-flex items-center justify-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                  >
                    <RefreshIcon className="h-4 w-4 mr-2" />
                    Refresh After Setup
                  </button>
                  <button
                    onClick={async () => {
                      // Direct auth check
                      const { data: { user } } = await supabase.auth.getUser();
                      console.log('Direct auth user:', user);
                      console.log('User metadata:', user?.user_metadata);
                      console.log('User role from metadata:', user?.user_metadata?.role);
                      
                      // Service check
                      const isAdmin = await PermissionsService.isCurrentUserAdmin();
                      console.log('Service admin check result:', isAdmin);
                      
                      toast(`Auth role: ${user?.user_metadata?.role || 'none'}, Service check: ${isAdmin ? 'Admin' : 'Not Admin'}`);
                    }}
                    className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                  >
                    <InformationCircleIcon className="h-4 w-4 mr-2" />
                    Debug Admin Status
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <>
              {/* Roles Tab */}
              {activeTab === 'roles' && (
                <div className="space-y-4 sm:space-y-6">
                  <div className="bg-white shadow rounded-lg">
                    <div className="px-4 py-4 sm:py-5 sm:p-6">
                      <h3 className="text-base sm:text-lg leading-6 font-medium text-gray-900 mb-3 sm:mb-4">
                        System Roles
                      </h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                        {roles.map((role) => (
                          <div
                            key={role.id}
                            className="border border-gray-200 rounded-lg p-3 sm:p-4 hover:shadow-md transition-shadow"
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex-1 min-w-0">
                                <h4 className="text-sm font-medium text-gray-900 truncate">
                                  {role.display_name}
                                </h4>
                                <p className="text-xs sm:text-sm text-gray-500 mt-1 line-clamp-2">
                                  {role.description}
                                </p>
                                <div className="mt-2 flex flex-wrap items-center gap-1 sm:gap-2 text-xs text-gray-500">
                                  <span className="bg-gray-100 px-2 py-1 rounded">
                                    Level {role.level}
                                  </span>
                                  {role.is_system_role && (
                                    <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded">
                                      System
                                    </span>
                                  )}
                                </div>
                              </div>
                              <div className="flex flex-col space-y-1 ml-2 flex-shrink-0">
                                <div className="flex space-x-1">
                                <button
                                  onClick={() => setSelectedRole(role)}
                                  className="p-1 text-gray-400 hover:text-gray-600"
                                  title="Manage Permissions"
                                >
                                  <EyeIcon className="h-4 w-4" />
                                </button>
                                {!role.is_system_role && (
                                  <>
                                    <button
                                      onClick={() => handleEditRole(role)}
                                      className="p-1 text-gray-400 hover:text-gray-600"
                                      title="Edit Role"
                                    >
                                      <PencilIcon className="h-4 w-4" />
                                    </button>
                                    <button
                                      onClick={() => handleDeleteRole(role.id)}
                                      className="p-1 text-gray-400 hover:text-red-600"
                                      title="Delete Role"
                                    >
                                      <TrashIcon className="h-4 w-4" />
                                    </button>
                                  </>
                                )}
                                </div>
                                {/* Assign to Admin Button */}
                                <button
                                  onClick={() => handleAssignRoleToAdmin(role)}
                                  className="inline-flex items-center px-2 py-1 border border-transparent text-xs font-medium rounded text-indigo-700 bg-indigo-100 hover:bg-indigo-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                                  title="Assign to Admin Users"
                                >
                                  <UserGroupIcon className="h-3 w-3 mr-1" />
                                  Assign to Admin
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Permissions Tab */}
              {activeTab === 'permissions' && (
                <div className="space-y-4 sm:space-y-6">
                  {Object.entries(groupedPermissions).map(([category, categoryPermissions]) => (
                    <div key={category} className="bg-white shadow rounded-lg">
                      <div className="px-4 py-4 sm:py-5 sm:p-6">
                        <h3 className="text-base sm:text-lg leading-6 font-medium text-gray-900 mb-3 sm:mb-4 capitalize">
                          {category.replace('_', ' ')} Permissions
                        </h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                          {categoryPermissions.map((permission) => (
                            <div
                              key={permission.id}
                              className="border border-gray-200 rounded-lg p-3 sm:p-4"
                            >
                              <h4 className="text-sm font-medium text-gray-900 truncate">
                                {permission.display_name}
                              </h4>
                              <p className="text-xs sm:text-sm text-gray-500 mt-1 line-clamp-2">
                                {permission.description}
                              </p>
                              <div className="mt-2 flex items-center text-xs text-gray-500">
                                <span className="bg-gray-100 px-2 py-1 rounded truncate">
                                  {permission.resource}.{permission.action}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Users Tab */}
              {activeTab === 'users' && (
                <div className="space-y-4 sm:space-y-6">
                  <div className="bg-white shadow rounded-lg">
                    <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-200">
                      <h3 className="text-base sm:text-lg font-medium text-gray-900">Users & Their Permissions</h3>
                      <p className="text-xs sm:text-sm text-gray-600 mt-1">
                        Click on any user to manage their page access permissions
                      </p>
                    </div>
                    <div className="p-4 sm:p-6">
                      {usersWithPermissions.length === 0 ? (
                        <div className="text-center py-6 sm:py-8">
                          <UserGroupIcon className="mx-auto h-10 w-10 sm:h-12 sm:w-12 text-gray-400" />
                          <h3 className="mt-2 text-sm font-medium text-gray-900">No users found</h3>
                          <p className="mt-1 text-xs sm:text-sm text-gray-500">
                            Users will appear here once they are registered in the system.
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-3 sm:space-y-4">
                          {usersWithPermissions.map((user) => (
                            <div
                              key={user.id}
                              onClick={() => handleUserClick(user)}
                              className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-3 sm:p-4 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
                            >
                              <div className="flex items-center space-x-3 sm:space-x-4 mb-2 sm:mb-0">
                                <div className="w-8 h-8 sm:w-10 sm:h-10 bg-indigo-100 rounded-full flex items-center justify-center flex-shrink-0">
                                  {user?.avatar_url ? (
                                    <img 
                                      src={user.avatar_url} 
                                      alt={user?.full_name}
                                      className="w-6 h-6 sm:w-8 sm:h-8 rounded-full"
                                    />
                                  ) : (
                                    <UserGroupIcon className="h-4 w-4 sm:h-6 sm:w-6 text-indigo-600" />
                                  )}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <h4 className="text-sm font-medium text-gray-900 truncate">{user?.full_name}</h4>
                                  <p className="text-xs sm:text-sm text-gray-500 truncate">{user?.email}</p>
                                </div>
                              </div>
                              <div className="flex items-center justify-between sm:justify-end space-x-2 sm:space-x-3">
                                <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                                  user?.role === 'admin' 
                                    ? 'bg-purple-100 text-purple-800' 
                                    : 'bg-blue-100 text-blue-800'
                                }`}>
                                  {user?.role}
                                </span>
                                <div className="flex items-center space-x-1">
                                  <span className="text-xs text-gray-500">
                                    {user?.permissions?.filter(p => p.permission_type === 'edit').length || 0}e
                                  </span>
                                  <span className="text-xs text-gray-500">•</span>
                                  <span className="text-xs text-gray-500">
                                    {user?.permissions?.filter(p => p.permission_type === 'view').length || 0}v
                                  </span>
                                </div>
                                <PencilIcon className="h-4 w-4 text-gray-400 flex-shrink-0" />
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Audit Tab */}
              {activeTab === 'audit' && (
                <div className="bg-white shadow rounded-lg">
                  <div className="px-4 py-4 sm:py-5 sm:p-6">
                    <h3 className="text-base sm:text-lg leading-6 font-medium text-gray-900 mb-3 sm:mb-4">
                      Permission Audit Log
                    </h3>
                    <div className="text-center py-6 sm:py-8">
                      <InformationCircleIcon className="mx-auto h-10 w-10 sm:h-12 sm:w-12 text-gray-400" />
                      <h3 className="mt-2 text-sm font-medium text-gray-900">Audit Log</h3>
                      <p className="mt-1 text-xs sm:text-sm text-gray-500">
                        Permission changes will be logged here for security and compliance.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Role Modal */}
        {showRoleModal && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
            <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
              <div className="mt-3">
                <h3 className="text-lg font-medium text-gray-900 mb-4">
                  {editingRole ? 'Edit Role' : 'Create New Role'}
                </h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Role Name
                    </label>
                    <input
                      type="text"
                      value={roleForm.name}
                      onChange={(e) => setRoleForm({ ...roleForm, name: e.target.value })}
                      className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                      placeholder="e.g., manager"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Display Name
                    </label>
                    <input
                      type="text"
                      value={roleForm.display_name}
                      onChange={(e) => setRoleForm({ ...roleForm, display_name: e.target.value })}
                      className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                      placeholder="e.g., Manager"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Description
                    </label>
                    <textarea
                      value={roleForm.description}
                      onChange={(e) => setRoleForm({ ...roleForm, description: e.target.value })}
                      className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                      rows={3}
                      placeholder="Role description..."
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Level
                    </label>
                    <input
                      type="number"
                      value={roleForm.level}
                      onChange={(e) => setRoleForm({ ...roleForm, level: parseInt(e.target.value) })}
                      className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                      min="0"
                      max="100"
                    />
                    <p className="mt-1 text-xs text-gray-500">
                      Higher level = more permissions (0-100)
                    </p>
                  </div>
                </div>
                <div className="flex justify-end space-x-3 mt-6">
                  <button
                    onClick={() => setShowRoleModal(false)}
                    className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={editingRole ? handleUpdateRole : handleCreateRole}
                    className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700"
                  >
                    {editingRole ? 'Update' : 'Create'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Role Manager Modal */}
        {selectedRole && (
          <RoleManager
            role={selectedRole}
            onClose={() => setSelectedRole(null)}
            onUpdate={fetchData}
          />
        )}

      </div>

      {/* User Permissions Modal */}
      <UserPermissionsModal
        user={selectedUser}
        isOpen={showUserPermissionsModal}
        onClose={() => {
          setShowUserPermissionsModal(false);
          setSelectedUser(null);
        }}
        onPermissionsUpdated={handlePermissionsUpdated}
      />

      {/* Admin Role Assignment Modal */}
      {showAdminRoleAssignment && roleForAssignment && (
        <AdminRoleAssignment
          selectedRole={roleForAssignment}
          onClose={() => {
            setShowAdminRoleAssignment(false);
            setRoleForAssignment(null);
          }}
          onUpdate={fetchData}
        />
      )}
    </Layout>
  );
}

export default withPermission(PermissionsSettings, {
  pageName: 'permissions_settings',
  requiredPermission: 'view',
  showPermissionIndicator: true
});
