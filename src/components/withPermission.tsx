import React from 'react';
import { PermissionGuard } from './PermissionGuard';

export interface WithPermissionOptions {
  pageName: string;
  requiredPermission?: 'view' | 'edit';
  showPermissionIndicator?: boolean;
}

export function withPermission<P extends object>(
  Component: React.ComponentType<P>,
  options: WithPermissionOptions
) {
  const WrappedComponent: React.FC<P> = (props) => {
    return (
      <PermissionGuard
        pageName={options.pageName}
        requiredPermission={options.requiredPermission}
        showPermissionIndicator={options.showPermissionIndicator}
      >
        <Component {...props} />
      </PermissionGuard>
    );
  };

  WrappedComponent.displayName = `withPermission(${Component.displayName || Component.name})`;
  
  return WrappedComponent;
}
