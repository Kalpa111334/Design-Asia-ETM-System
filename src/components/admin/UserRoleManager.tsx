import React, { useState, useEffect } from 'react';
import { PermissionsService, Role } from '../../services/PermissionsService';
import { User } from '../../types';
import { supabase } from '../../lib/supabase';
import {
  UserGroupIcon,
  PlusIcon,
  TrashIcon,
  ClockIcon,
  CheckIcon,
  XIcon,
  ExclamationIcon
} from '@heroicons/react/outline';
import toast from 'react-hot-toast';

interface UserRoleManagerProps {
  user: User;
  onClose: () => void;
  onUpdate: () => void;
}

interface UserRole {
  id: string;
  user_id: string;
  role_id: string;
  assigned_at: string;
  assigned_by?: string;
  expires_at?: string;
  is_active: boolean;
  role: Role;
}

export default function UserRoleManager({ user, onClose, onUpdate }: UserRoleManagerProps) {
  const [roles, setRoles] = useState<Role[]>([]);
  const [userRoles, setUserRoles] = useState<UserRole[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showAddRoleModal, setShowAddRoleModal] = useState(false);
  const [selectedRoleId, setSelectedRoleId] = useState('');
  const [expirationDate, setExpirationDate] = useState('');

  useEffect(() => {
    fetchData();
  }, [user.id]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [rolesData, userRolesData] = await Promise.all([
        PermissionsService.getAllRoles(),
        supabase
          .from('user_roles')
          .select(`
            *,
            role:roles(*)
          `)
          .eq('user_id', user.id)
          .eq('is_active', true)
          .then(({ data, error }) => {
            if (error) throw error;
            return data || [];
          })
      ]);

      setRoles(rolesData);
      setUserRoles(userRolesData);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Failed to load user role data');
    } finally {
      setLoading(false);
    }
  };

  const handleAddRole = async () => {
    if (!selectedRoleId) {
      toast.error('Please select a role');
      return;
    }

    setSaving(true);
    try {
      await PermissionsService.assignRoleToUser(
        user.id, 
        selectedRoleId, 
        expirationDate || undefined
      );
      
      toast.success('Role assigned successfully');
      setShowAddRoleModal(false);
      setSelectedRoleId('');
      setExpirationDate('');
      fetchData();
      onUpdate();
    } catch (error) {
      console.error('Error adding role:', error);
      toast.error('Failed to assign role');
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveRole = async (userRoleId: string) => {
    if (!confirm('Are you sure you want to remove this role from the user?')) {
      return;
    }

    try {
      await PermissionsService.updateUserRole(userRoleId, { is_active: false });
      toast.success('Role removed successfully');
      fetchData();
      onUpdate();
    } catch (error) {
      console.error('Error removing role:', error);
      toast.error('Failed to remove role');
    }
  };

  const getAvailableRoles = () => {
    const assignedRoleIds = userRoles.map(ur => ur.role_id);
    return roles.filter(role => !assignedRoleIds.includes(role.id));
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const isExpired = (expiresAt: string | undefined) => {
    if (!expiresAt) return false;
    return new Date(expiresAt) < new Date();
  };

  const isExpiringSoon = (expiresAt: string | undefined) => {
    if (!expiresAt) return false;
    const expirationDate = new Date(expiresAt);
    const now = new Date();
    const daysUntilExpiration = Math.ceil((expirationDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return daysUntilExpiration <= 7 && daysUntilExpiration > 0;
  };

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-10 mx-auto p-5 border w-11/12 max-w-4xl shadow-lg rounded-md bg-white">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center">
            <UserGroupIcon className="h-8 w-8 text-indigo-600 mr-3" />
            <div>
              <h3 className="text-xl font-semibold text-gray-900">
                Manage Roles for {user.full_name}
              </h3>
              <p className="text-sm text-gray-600">
                {user.email}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <XIcon className="h-6 w-6" />
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Current Roles */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-lg font-medium text-gray-900">
                  Current Roles
                </h4>
                <button
                  onClick={() => setShowAddRoleModal(true)}
                  className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
                >
                  <PlusIcon className="h-4 w-4 mr-2" />
                  Add Role
                </button>
              </div>

              {userRoles.length === 0 ? (
                <div className="text-center py-8 bg-gray-50 rounded-lg">
                  <UserGroupIcon className="mx-auto h-12 w-12 text-gray-400" />
                  <h3 className="mt-2 text-sm font-medium text-gray-900">No roles assigned</h3>
                  <p className="mt-1 text-sm text-gray-500">
                    This user doesn't have any roles assigned yet.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {userRoles.map((userRole) => (
                    <div
                      key={userRole.id}
                      className={`border rounded-lg p-4 ${
                        isExpired(userRole.expires_at) 
                          ? 'border-red-200 bg-red-50' 
                          : isExpiringSoon(userRole.expires_at)
                          ? 'border-yellow-200 bg-yellow-50'
                          : 'border-gray-200 bg-white'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h5 className="text-sm font-medium text-gray-900">
                            {userRole.role.display_name}
                          </h5>
                          <p className="text-sm text-gray-500 mt-1">
                            {userRole.role.description}
                          </p>
                          <div className="mt-2 flex items-center text-xs text-gray-500">
                            <span className="bg-gray-100 px-2 py-1 rounded">
                              Level {userRole.role.level}
                            </span>
                            {userRole.role.is_system_role && (
                              <span className="ml-2 bg-blue-100 text-blue-800 px-2 py-1 rounded">
                                System
                              </span>
                            )}
                          </div>
                          <div className="mt-2 text-xs text-gray-500">
                            <div>Assigned: {formatDate(userRole.assigned_at)}</div>
                            {userRole.expires_at && (
                              <div className={`${
                                isExpired(userRole.expires_at) 
                                  ? 'text-red-600' 
                                  : isExpiringSoon(userRole.expires_at)
                                  ? 'text-yellow-600'
                                  : 'text-gray-500'
                              }`}>
                                Expires: {formatDate(userRole.expires_at)}
                                {isExpired(userRole.expires_at) && ' (Expired)'}
                                {isExpiringSoon(userRole.expires_at) && ' (Expiring Soon)'}
                              </div>
                            )}
                          </div>
                        </div>
                        <button
                          onClick={() => handleRemoveRole(userRole.id)}
                          className="ml-2 p-1 text-gray-400 hover:text-red-600"
                          title="Remove Role"
                        >
                          <TrashIcon className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Role Hierarchy Info */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-start">
                <ExclamationIcon className="h-5 w-5 text-blue-400 mt-0.5 mr-3" />
                <div>
                  <h4 className="text-sm font-medium text-blue-900">
                    Role Hierarchy
                  </h4>
                  <p className="text-sm text-blue-700 mt-1">
                    Users inherit permissions from all their assigned roles. Higher level roles have more permissions.
                  </p>
                  <div className="mt-2 text-xs text-blue-600">
                    Current user's highest level: {Math.max(...userRoles.map(ur => ur.role.level), 0)}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Add Role Modal */}
        {showAddRoleModal && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-60">
            <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
              <div className="mt-3">
                <h3 className="text-lg font-medium text-gray-900 mb-4">
                  Add Role to {user.full_name}
                </h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Select Role
                    </label>
                    <select
                      value={selectedRoleId}
                      onChange={(e) => setSelectedRoleId(e.target.value)}
                      className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    >
                      <option value="">Choose a role...</option>
                      {getAvailableRoles().map((role) => (
                        <option key={role.id} value={role.id}>
                          {role.display_name} (Level {role.level})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Expiration Date (Optional)
                    </label>
                    <input
                      type="date"
                      value={expirationDate}
                      onChange={(e) => setExpirationDate(e.target.value)}
                      className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    />
                    <p className="mt-1 text-xs text-gray-500">
                      Leave empty for permanent assignment
                    </p>
                  </div>
                </div>
                <div className="flex justify-end space-x-3 mt-6">
                  <button
                    onClick={() => {
                      setShowAddRoleModal(false);
                      setSelectedRoleId('');
                      setExpirationDate('');
                    }}
                    className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleAddRole}
                    disabled={saving || !selectedRoleId}
                    className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {saving ? 'Adding...' : 'Add Role'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
