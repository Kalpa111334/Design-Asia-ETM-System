import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { PermissionsService, Permission, Role } from '../services/PermissionsService';

export interface UsePermissionsReturn {
  permissions: Permission[];
  roles: Role[];
  hasPermission: (permissionName: string) => boolean;
  hasAnyPermission: (permissionNames: string[]) => boolean;
  hasAllPermissions: (permissionNames: string[]) => boolean;
  hasRole: (roleName: string) => boolean;
  hasAnyRole: (roleNames: string[]) => boolean;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function usePermissions(): UsePermissionsReturn {
  const { user } = useAuth();
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPermissions = useCallback(async () => {
    if (!user) {
      setPermissions([]);
      setRoles([]);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const [permissionsData, rolesData] = await Promise.all([
        PermissionsService.getUserPermissions(user.id),
        PermissionsService.getUserRoles(user.id)
      ]);

      setPermissions(permissionsData);
      setRoles(rolesData);
    } catch (err) {
      console.error('Error fetching permissions:', err);
      setError('Failed to load permissions');
      setPermissions([]);
      setRoles([]);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchPermissions();
  }, [fetchPermissions]);

  const hasPermission = useCallback((permissionName: string): boolean => {
    return permissions.some(p => p.name === permissionName);
  }, [permissions]);

  const hasAnyPermission = useCallback((permissionNames: string[]): boolean => {
    return permissionNames.some(name => hasPermission(name));
  }, [hasPermission]);

  const hasAllPermissions = useCallback((permissionNames: string[]): boolean => {
    return permissionNames.every(name => hasPermission(name));
  }, [hasPermission]);

  const hasRole = useCallback((roleName: string): boolean => {
    return roles.some(r => r.name === roleName);
  }, [roles]);

  const hasAnyRole = useCallback((roleNames: string[]): boolean => {
    return roleNames.some(name => hasRole(name));
  }, [hasRole]);

  const refresh = useCallback(async () => {
    await fetchPermissions();
  }, [fetchPermissions]);

  return {
    permissions,
    roles,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    hasRole,
    hasAnyRole,
    isLoading,
    error,
    refresh
  };
}

// Hook for checking specific permissions
export function usePermission(permissionName: string): boolean {
  const { hasPermission } = usePermissions();
  return hasPermission(permissionName);
}

// Hook for checking specific roles
export function useRole(roleName: string): boolean {
  const { hasRole } = usePermissions();
  return hasRole(roleName);
}

// Hook for checking multiple permissions
export function usePermissionsCheck(permissionNames: string[]): {
  hasAny: boolean;
  hasAll: boolean;
  isLoading: boolean;
} {
  const { hasAnyPermission, hasAllPermissions, isLoading } = usePermissions();
  
  return {
    hasAny: hasAnyPermission(permissionNames),
    hasAll: hasAllPermissions(permissionNames),
    isLoading
  };
}

// Hook for checking multiple roles
export function useRolesCheck(roleNames: string[]): {
  hasAny: boolean;
  isLoading: boolean;
} {
  const { hasAnyRole, isLoading } = usePermissions();
  
  return {
    hasAny: hasAnyRole(roleNames),
    isLoading
  };
}

// Permission categories for easy checking
export const PERMISSION_CATEGORIES = {
  USERS: [
    'users.create',
    'users.read',
    'users.update',
    'users.delete',
    'users.manage_roles'
  ],
  TASKS: [
    'tasks.create',
    'tasks.read',
    'tasks.update',
    'tasks.delete',
    'tasks.assign',
    'tasks.approve',
    'tasks.reject'
  ],
  ANALYTICS: [
    'analytics.view',
    'analytics.export',
    'analytics.create_reports'
  ],
  LOCATION: [
    'location.view',
    'location.track',
    'location.manage_geofences'
  ],
  COMMUNICATION: [
    'chat.send',
    'chat.read',
    'chat.moderate'
  ],
  SYSTEM: [
    'system.settings',
    'system.permissions',
    'system.audit',
    'system.backup'
  ],
  FILES: [
    'files.upload',
    'files.download',
    'files.delete'
  ],
  NOTIFICATIONS: [
    'notifications.send',
    'notifications.read',
    'notifications.manage'
  ]
} as const;

// Role levels for easy checking
export const ROLE_LEVELS = {
  SUPER_ADMIN: 100,
  ADMIN: 80,
  MANAGER: 60,
  SUPERVISOR: 40,
  EMPLOYEE: 20,
  GUEST: 10
} as const;
