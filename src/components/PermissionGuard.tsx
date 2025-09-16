import React, { useState, useEffect } from 'react';
import { EyeIcon, PencilIcon, BanIcon } from '@heroicons/react/outline';
import { UserPagePermissionsService } from '../services/UserPagePermissionsService';
import { supabase } from '../lib/supabase';

interface PermissionGuardProps {
  pageName: string;
  children: React.ReactNode;
  requiredPermission?: 'view' | 'edit';
  showPermissionIndicator?: boolean;
}

interface PermissionState {
  permission: 'view' | 'edit' | 'none';
  loading: boolean;
}

export const PermissionGuard: React.FC<PermissionGuardProps> = ({
  pageName,
  children,
  requiredPermission = 'view',
  showPermissionIndicator = true
}) => {
  const [permissionState, setPermissionState] = useState<PermissionState>({
    permission: 'none',
    loading: true
  });

  useEffect(() => {
    const checkPermission = async () => {
      try {
        // Get the actual permission level for the indicator
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        
        if (userError || !user) {
          console.warn('No authenticated user found:', userError);
          setPermissionState({
            permission: 'none',
            loading: false
          });
          return;
        }

        const hasPermission = await UserPagePermissionsService.canCurrentUserAccess(
          pageName, 
          requiredPermission
        );
        
        const permissions = await UserPagePermissionsService.getUserPermissions(user.id);
        const pagePermission = permissions.find(p => p.page_name === pageName);
        
        setPermissionState({
          permission: pagePermission?.permission_type || 'none',
          loading: false
        });
      } catch (error) {
        console.error('Error checking permission:', error);
        setPermissionState({
          permission: 'none',
          loading: false
        });
      }
    };

    checkPermission();
  }, [pageName, requiredPermission]);

  const getPermissionIcon = (permission: 'view' | 'edit' | 'none') => {
    switch (permission) {
      case 'view':
        return <EyeIcon className="h-5 w-5 text-blue-500" />;
      case 'edit':
        return <PencilIcon className="h-5 w-5 text-green-500" />;
      case 'none':
        return <BanIcon className="h-5 w-5 text-gray-400" />;
    }
  };

  const getPermissionText = (permission: 'view' | 'edit' | 'none') => {
    switch (permission) {
      case 'view':
        return 'View Only';
      case 'edit':
        return 'Edit Access';
      case 'none':
        return 'No Access';
    }
  };

  const getPermissionColor = (permission: 'view' | 'edit' | 'none') => {
    switch (permission) {
      case 'view':
        return 'bg-blue-50 border-blue-200 text-blue-700';
      case 'edit':
        return 'bg-green-50 border-green-200 text-green-700';
      case 'none':
        return 'bg-gray-50 border-gray-200 text-gray-500';
    }
  };

  if (permissionState.loading) {
    return (
      <div className="flex justify-center items-center min-h-[200px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  // If user has no access, show the no access screen
  if (permissionState.permission === 'none') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="mx-auto h-24 w-24 bg-gray-100 rounded-full flex items-center justify-center mb-6">
            <BanIcon className="h-12 w-12 text-gray-400" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-4">No Access</h1>
          <p className="text-lg text-gray-600 mb-8">
            You don't have permission to access this page.
          </p>
          <button
            onClick={() => window.history.back()}
            className="px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  // If user has view only access, show the content with view-only indicator
  if (permissionState.permission === 'view' && requiredPermission === 'edit') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="mx-auto h-24 w-24 bg-blue-100 rounded-full flex items-center justify-center mb-6">
            <EyeIcon className="h-12 w-12 text-blue-500" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-4">View Only Access</h1>
          <p className="text-lg text-gray-600 mb-8">
            You can only view this page. Contact an administrator for edit access.
          </p>
          <button
            onClick={() => window.history.back()}
            className="px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  // User has appropriate access, show the content
  return (
    <div className="relative">
      {/* Permission Indicator */}
      {showPermissionIndicator && (
        <div className="bg-white border-b border-gray-200 px-4 py-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              {getPermissionIcon(permissionState.permission)}
              <span className={`text-sm font-medium px-2 py-1 rounded-md border ${getPermissionColor(permissionState.permission)}`}>
                {getPermissionText(permissionState.permission)}
              </span>
            </div>
          </div>
        </div>
      )}
      
      {/* Page Content */}
      <div className={permissionState.permission === 'view' ? 'pointer-events-none' : ''}>
        {children}
      </div>
    </div>
  );
};
