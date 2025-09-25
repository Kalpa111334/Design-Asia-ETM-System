import React, { useState, useEffect } from 'react';
import { UserPagePermissionsService, UserWithPermissions, PageDefinition } from '../../services/UserPagePermissionsService';
import {
  XIcon,
  EyeIcon,
  PencilIcon,
  BanIcon,
  CheckIcon,
  UserIcon
} from '@heroicons/react/outline';
import toast from 'react-hot-toast';

interface UserPermissionsModalProps {
  user: UserWithPermissions | null;
  isOpen: boolean;
  onClose: () => void;
  onPermissionsUpdated: () => void;
}

const UserPermissionsModal: React.FC<UserPermissionsModalProps> = ({
  user,
  isOpen,
  onClose,
  onPermissionsUpdated
}) => {
  const [permissions, setPermissions] = useState<{ [pageName: string]: 'view' | 'edit' | 'none' }>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user && isOpen) {
      loadUserPermissions();
    }
  }, [user, isOpen]);

  const loadUserPermissions = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      const userPermissions = await UserPagePermissionsService.getUserPermissions(user.id);
      
      // Initialize permissions object
      const permissionsMap: { [pageName: string]: 'view' | 'edit' | 'none' } = {};
      
      // Set existing permissions
      userPermissions.forEach(permission => {
        permissionsMap[permission.page_name] = permission.permission_type;
      });
      
      // Set default permissions based on user role
      UserPagePermissionsService.getAllPages().forEach(page => {
        if (!permissionsMap[page.name]) {
          // Set default permissions based on user role
          if (user?.role === 'admin') {
            // Admins get edit access to most pages, none for admin-only pages
            if (page.name === 'employee_management' || page.name === 'permissions_settings') {
              permissionsMap[page.name] = 'edit';
            } else {
              permissionsMap[page.name] = 'edit';
            }
          } else {
            // Employees get view access to most pages, none for admin-only pages
            if (page.name === 'employee_management' || page.name === 'permissions_settings') {
              permissionsMap[page.name] = 'none';
            } else {
              permissionsMap[page.name] = 'view';
            }
          }
        }
      });
      
      setPermissions(permissionsMap);
    } catch (error) {
      console.error('Error loading user permissions:', error);
      
      // Don't show error toast, just set default permissions
      const permissionsMap: { [pageName: string]: 'view' | 'edit' | 'none' } = {};
      
      // Set default permissions based on user role
      UserPagePermissionsService.getAllPages().forEach(page => {
        if (user?.role === 'admin') {
          permissionsMap[page.name] = 'edit';
        } else {
          if (page.name === 'employee_management' || page.name === 'permissions_settings') {
            permissionsMap[page.name] = 'none';
          } else {
            permissionsMap[page.name] = 'view';
          }
        }
      });
      
      setPermissions(permissionsMap);
    } finally {
      setLoading(false);
    }
  };

  const handlePermissionChange = (pageName: string, permissionType: 'view' | 'edit' | 'none') => {
    setPermissions(prev => ({
      ...prev,
      [pageName]: permissionType
    }));
  };

  const handleSave = async () => {
    if (!user) return;
    
    setSaving(true);
    try {
      const permissionUpdates = Object.entries(permissions).map(([pageName, permissionType]) => ({
        pageName,
        permissionType
      }));
      
      console.log('Saving permissions for user:', user.id, permissionUpdates);
      
      const success = await UserPagePermissionsService.updateUserPermissions(user.id, permissionUpdates);
      
      if (success) {
        toast.success(`Permissions updated successfully for ${user.full_name}`);
        onPermissionsUpdated();
        onClose();
      } else {
        toast.error('Failed to update user permissions');
      }
    } catch (error) {
      console.error('Error saving permissions:', error);
      toast.error('Failed to save permissions');
    } finally {
      setSaving(false);
    }
  };

  const getPermissionIcon = (permissionType: 'view' | 'edit' | 'none') => {
    switch (permissionType) {
      case 'view':
        return <EyeIcon className="h-4 w-4 text-blue-500" />;
      case 'edit':
        return <PencilIcon className="h-4 w-4 text-green-500" />;
      case 'none':
        return <BanIcon className="h-4 w-4 text-gray-400" />;
    }
  };

  const getPermissionColor = (permissionType: 'view' | 'edit' | 'none') => {
    switch (permissionType) {
      case 'view':
        return 'bg-blue-50 border-blue-200 text-blue-700';
      case 'edit':
        return 'bg-green-50 border-green-200 text-green-700';
      case 'none':
        return 'bg-gray-50 border-gray-200 text-gray-500';
    }
  };

  const pagesByCategory = user ? UserPagePermissionsService.getPagesByCategoryForRole(user.role) : {};

  if (!isOpen || !user) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 sm:p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[85vh] sm:max-h-[80vh] overflow-hidden mx-2 sm:mx-0 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-6 border-b border-gray-200">
          <div className="flex items-center space-x-2 sm:space-x-3 flex-1 min-w-0">
            <div className="w-8 h-8 sm:w-10 sm:h-10 bg-indigo-100 rounded-full flex items-center justify-center flex-shrink-0">
              {user.avatar_url ? (
                <img 
                  src={user.avatar_url} 
                  alt={user.full_name}
                  className="w-6 h-6 sm:w-8 sm:h-8 rounded-full"
                />
              ) : (
                <UserIcon className="h-4 w-4 sm:h-6 sm:w-6 text-indigo-600" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-lg sm:text-xl font-semibold text-gray-900 truncate">{user.full_name}</h2>
              <p className="text-xs sm:text-sm text-gray-500 truncate">{user.email}</p>
              <span className={`inline-flex items-center px-1.5 py-0.5 sm:px-2 sm:py-1 rounded-full text-xs font-medium ${
                user?.role === 'admin' 
                  ? 'bg-purple-100 text-purple-800' 
                  : 'bg-blue-100 text-blue-800'
              }`}>
                {user?.role}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors flex-shrink-0 ml-2"
          >
            <XIcon className="h-5 w-5 sm:h-6 sm:w-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1">
          {loading ? (
            <div className="flex justify-center items-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
            </div>
          ) : (
            <div className="space-y-4 sm:space-y-6">
              <div className="mb-4">
                <h3 className="text-base sm:text-lg font-medium text-gray-900 mb-2">Page Access Permissions</h3>
                <p className="text-xs sm:text-sm text-gray-600">
                  Configure which pages this user can access and their permission level.
                </p>
              </div>

              {/* Permission Legend */}
              <div className="bg-gray-50 rounded-lg p-3 sm:p-4">
                <h4 className="text-xs sm:text-sm font-medium text-gray-900 mb-2 sm:mb-3">Permission Types:</h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-4">
                  <div className="flex items-center space-x-2">
                    <EyeIcon className="h-3 w-3 sm:h-4 sm:w-4 text-blue-500" />
                    <span className="text-xs sm:text-sm text-gray-700">View Only</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <PencilIcon className="h-3 w-3 sm:h-4 sm:w-4 text-green-500" />
                    <span className="text-xs sm:text-sm text-gray-700">Edit Access</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <BanIcon className="h-3 w-3 sm:h-4 sm:w-4 text-gray-400" />
                    <span className="text-xs sm:text-sm text-gray-700">No Access</span>
                  </div>
                </div>
              </div>

              {/* Pages by Category */}
              {Object.entries(pagesByCategory).map(([category, pages]) => (
                <div key={category} className="space-y-2 sm:space-y-3">
                  <h4 className="text-sm sm:text-md font-medium text-gray-900 border-b border-gray-200 pb-1 sm:pb-2">
                    {category}
                  </h4>
                  <div className="grid grid-cols-1 gap-2 sm:gap-3">
                    {pages.map((page) => (
                      <div key={page.name} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 sm:p-4 border border-gray-200 rounded-lg space-y-2 sm:space-y-0">
                        <div className="flex-1 min-w-0">
                          <h5 className="text-sm sm:text-base font-medium text-gray-900 truncate">{page.displayName}</h5>
                          <p className="text-xs sm:text-sm text-gray-500 mt-1">{page.description}</p>
                        </div>
                        <div className="flex items-center justify-end space-x-1 sm:space-x-2">
                          {/* Permission Buttons */}
                          <button
                            onClick={() => handlePermissionChange(page.name, 'none')}
                            className={`px-2 py-1 sm:px-3 sm:py-1 rounded-md text-xs font-medium border transition-colors ${
                              permissions[page.name] === 'none'
                                ? 'bg-gray-100 border-gray-300 text-gray-700'
                                : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'
                            }`}
                            title="No Access"
                          >
                            <BanIcon className="h-3 w-3 sm:h-4 sm:w-4" />
                          </button>
                          <button
                            onClick={() => handlePermissionChange(page.name, 'view')}
                            className={`px-2 py-1 sm:px-3 sm:py-1 rounded-md text-xs font-medium border transition-colors ${
                              permissions[page.name] === 'view'
                                ? 'bg-blue-100 border-blue-300 text-blue-700'
                                : 'bg-white border-gray-200 text-gray-500 hover:bg-blue-50'
                            }`}
                            title="View Only"
                          >
                            <EyeIcon className="h-3 w-3 sm:h-4 sm:w-4" />
                          </button>
                          <button
                            onClick={() => handlePermissionChange(page.name, 'edit')}
                            className={`px-2 py-1 sm:px-3 sm:py-1 rounded-md text-xs font-medium border transition-colors ${
                              permissions[page.name] === 'edit'
                                ? 'bg-green-100 border-green-300 text-green-700'
                                : 'bg-white border-gray-200 text-gray-500 hover:bg-green-50'
                            }`}
                            title="Edit Access"
                          >
                            <PencilIcon className="h-3 w-3 sm:h-4 sm:w-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end space-y-2 sm:space-y-0 sm:space-x-3 p-4 sm:p-6 border-t border-gray-200 bg-gray-50 flex-shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors order-2 sm:order-1"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center space-x-2 order-1 sm:order-2"
          >
            {saving ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                <span>Saving...</span>
              </>
            ) : (
              <>
                <CheckIcon className="h-4 w-4" />
                <span>Save Permissions</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default UserPermissionsModal;
