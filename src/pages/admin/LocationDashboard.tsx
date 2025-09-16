import React from 'react';
import Layout from '../../components/Layout';
import GeofenceManager from '../../components/admin/GeofenceManager';
import { Geofence } from '../../services/GeofencingService';
import { CogIcon } from '@heroicons/react/outline';

export default function LocationDashboard() {
  const [selectedGeofence, setSelectedGeofence] = React.useState<Geofence | null>(null);

  return (
    <Layout>
      <div className="py-4 sm:py-6">
        <div className="max-w-7xl mx-auto px-2 sm:px-4 md:px-6 lg:px-8">
          <div className="mb-4 sm:mb-8">
            <h1 className="text-xl sm:text-3xl font-bold text-gray-900">Location Management</h1>
            <p className="mt-1 sm:mt-2 text-sm sm:text-base text-gray-600">
              Comprehensive location-based task monitoring and geofencing system
            </p>
          </div>

          {/* Geofence Management Only */}
          <div className="mt-4 sm:mt-8">
            <div className="mb-4 flex items-center gap-2 text-gray-700">
              <CogIcon className="h-5 w-5 text-indigo-600" />
              <span className="text-sm sm:text-base font-medium">Geofence Management</span>
            </div>
            <GeofenceManager
              onGeofenceSelect={setSelectedGeofence}
              selectedGeofenceId={selectedGeofence?.id}
            />
          </div>
        </div>
      </div>
    </Layout>
  );
}