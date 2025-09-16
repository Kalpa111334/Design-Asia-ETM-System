import React, { useState, useEffect } from 'react';
import { PermissionsService, Role, Permission, RolePermission } from '../../services/PermissionsService';
import {
  ShieldCheckIcon,
  CheckIcon,
  XIcon,
  PlusIcon,
  TrashIcon,
  CogIcon,
  InformationCircleIcon
} from '@heroicons/react/outline';
import toast from 'react-hot-toast';

interface RoleManagerProps {
  role: Role;
  onClose: () => void;
  onUpdate: () => void;
}

export default function RoleManager({ role, onClose, onUpdate }: RoleManagerProps) {
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [rolePermissions, setRolePermissions] = useState<RolePermission[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedPermissions, setSelectedPermissions] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchRoleData();
  }, [role.id]);

  const fetchRoleData = async () => {
    setLoading(true);
    try {
      const [permissionsData, rolePermissionsData] = await Promise.all([
        PermissionsService.getAllPermissions(),
        PermissionsService.getRolePermissions(role.id)
      ]);

      setPermissions(permissionsData);
      setRolePermissions(rolePermissionsData);
      
      // Set selected permissions
      const selected = new Set(rolePermissionsData.map(rp => rp.permission_id));
      setSelectedPermissions(selected);
    } catch (error) {
      console.error('Error fetching role data:', error);
      toast.error('Failed to load role data');
    } finally {
      setLoading(false);
    }
  };

  const handlePermissionToggle = (permissionId: string) => {
    const newSelected = new Set(selectedPermissions);
    if (newSelected.has(permissionId)) {
      newSelected.delete(permissionId);
    } else {
      newSelected.add(permissionId);
    }
    setSelectedPermissions(newSelected);
  };

  const handleSavePermissions = async () => {
    setSaving(true);
    try {
      // Get current permission IDs
      const currentPermissionIds = rolePermissions.map(rp => rp.permission_id);
      
      // Get new permission IDs
      const newPermissionIds = Array.from(selectedPermissions);
      
      // Find permissions to add
      const toAdd = newPermissionIds.filter(id => !currentPermissionIds.includes(id));
      
      // Find permissions to remove
      const toRemove = currentPermissionIds.filter(id => !newPermissionIds.includes(id));
      
      // Add new permissions
      for (const permissionId of toAdd) {
        await PermissionsService.assignPermissionToRole(role.id, permissionId);
      }
      
      // Remove old permissions
      for (const permissionId of toRemove) {
        await PermissionsService.removePermissionFromRole(role.id, permissionId);
      }
      
      toast.success('Role permissions updated successfully');
      onUpdate();
    } catch (error) {
      console.error('Error saving permissions:', error);
      toast.error('Failed to update role permissions');
    } finally {
      setSaving(false);
    }
  };

  const groupedPermissions = permissions.reduce((acc, permission) => {
    if (!acc[permission.category]) {
      acc[permission.category] = [];
    }
    acc[permission.category].push(permission);
    return acc;
  }, {} as Record<string, Permission[]>);

  const getPermissionStatus = (permissionId: string) => {
    return selectedPermissions.has(permissionId);
  };

  const getCategoryStatus = (category: string) => {
    const categoryPermissions = groupedPermissions[category] || [];
    const selectedCount = categoryPermissions.filter(p => selectedPermissions.has(p.id)).length;
    const totalCount = categoryPermissions.length;
    
    if (selectedCount === 0) return 'none';
    if (selectedCount === totalCount) return 'all';
    return 'partial';
  };

  const handleCategoryToggle = (category: string) => {
    const categoryPermissions = groupedPermissions[category] || [];
    const categoryStatus = getCategoryStatus(category);
    
    const newSelected = new Set(selectedPermissions);
    
    if (categoryStatus === 'all') {
      // Remove all permissions in this category
      categoryPermissions.forEach(p => newSelected.delete(p.id));
    } else {
      // Add all permissions in this category
      categoryPermissions.forEach(p => newSelected.add(p.id));
    }
    
    setSelectedPermissions(newSelected);
  };

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-10 mx-auto p-5 border w-11/12 max-w-6xl shadow-lg rounded-md bg-white">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center">
            <ShieldCheckIcon className="h-8 w-8 text-indigo-600 mr-3" />
            <div>
              <h3 className="text-xl font-semibold text-gray-900">
                {role.display_name} - Permissions
              </h3>
              <p className="text-sm text-gray-600">
                Level {role.level} • {role.description}
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
            {/* Permission Categories */}
            {Object.entries(groupedPermissions).map(([category, categoryPermissions]) => {
              const categoryStatus = getCategoryStatus(category);
              const selectedCount = categoryPermissions.filter(p => selectedPermissions.has(p.id)).length;
              const totalCount = categoryPermissions.length;

              return (
                <div key={category} className="border border-gray-200 rounded-lg">
                  <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <button
                          onClick={() => handleCategoryToggle(category)}
                          className={`mr-3 p-1 rounded ${
                            categoryStatus === 'all' 
                              ? 'bg-green-100 text-green-600' 
                              : categoryStatus === 'partial'
                              ? 'bg-yellow-100 text-yellow-600'
                              : 'bg-gray-100 text-gray-400'
                          }`}
                        >
                          {categoryStatus === 'all' ? (
                            <CheckIcon className="h-4 w-4" />
                          ) : categoryStatus === 'partial' ? (
                            <div className="h-4 w-4 bg-yellow-600 rounded-sm"></div>
                          ) : (
                            <div className="h-4 w-4 bg-gray-400 rounded-sm"></div>
                          )}
                        </button>
                        <h4 className="text-sm font-medium text-gray-900 capitalize">
                          {category.replace('_', ' ')} Permissions
                        </h4>
                      </div>
                      <span className="text-sm text-gray-500">
                        {selectedCount} of {totalCount} selected
                      </span>
                    </div>
                  </div>
                  
                  <div className="p-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {categoryPermissions.map((permission) => {
                        const isSelected = getPermissionStatus(permission.id);
                        
                        return (
                          <div
                            key={permission.id}
                            className={`border rounded-lg p-3 cursor-pointer transition-colors ${
                              isSelected 
                                ? 'border-green-200 bg-green-50' 
                                : 'border-gray-200 hover:border-gray-300'
                            }`}
                            onClick={() => handlePermissionToggle(permission.id)}
                          >
                            <div className="flex items-start">
                              <div className={`mr-3 mt-0.5 p-1 rounded ${
                                isSelected 
                                  ? 'bg-green-100 text-green-600' 
                                  : 'bg-gray-100 text-gray-400'
                              }`}>
                                {isSelected ? (
                                  <CheckIcon className="h-3 w-3" />
                                ) : (
                                  <div className="h-3 w-3 bg-gray-400 rounded-sm"></div>
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <h5 className="text-sm font-medium text-gray-900">
                                  {permission.display_name}
                                </h5>
                                <p className="text-xs text-gray-500 mt-1">
                                  {permission.description}
                                </p>
                                <div className="mt-2">
                                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
                                    {permission.resource}.{permission.action}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Summary */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-start">
                <InformationCircleIcon className="h-5 w-5 text-blue-400 mt-0.5 mr-3" />
                <div>
                  <h4 className="text-sm font-medium text-blue-900">
                    Permission Summary
                  </h4>
                  <p className="text-sm text-blue-700 mt-1">
                    {selectedPermissions.size} of {permissions.length} permissions selected
                  </p>
                  <div className="mt-2 text-xs text-blue-600">
                    {Object.entries(groupedPermissions).map(([category, categoryPermissions]) => {
                      const selectedCount = categoryPermissions.filter(p => selectedPermissions.has(p.id)).length;
                      const totalCount = categoryPermissions.length;
                      return (
                        <span key={category} className="mr-3">
                          {category.replace('_', ' ')}: {selectedCount}/{totalCount}
                        </span>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
              <button
                onClick={onClose}
                className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSavePermissions}
                disabled={saving}
                className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save Permissions'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
