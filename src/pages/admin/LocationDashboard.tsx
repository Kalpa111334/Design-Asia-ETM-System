import React from 'react';
import Layout from '../../components/Layout';
import GeofenceManagerOSM from '../../components/admin/GeofenceManagerOSM';
import OfflineStatusDashboard from '../../components/admin/OfflineStatusDashboard';
import QuickLocationTools from '../../components/admin/QuickLocationTools';
import { Geofence } from '../../services/GeofencingService';
import { CogIcon, CloudIcon } from '@heroicons/react/outline';

export default function LocationDashboard() {
  const [selectedGeofence, setSelectedGeofence] = React.useState<Geofence | null>(null);
  const [activeTab, setActiveTab] = React.useState<'geofences' | 'offline'>('geofences');
  const [pickerOpen, setPickerOpen] = React.useState<boolean>(false);

  return (
    <Layout>
      <div className="py-4 sm:py-6">
        <div className="max-w-7xl mx-auto px-2 sm:px-4 md:px-6 lg:px-8">
          <div className="mb-4 sm:mb-8">
            <h1 className="text-xl sm:text-3xl font-bold text-gray-900">Location Management</h1>
            <p className="mt-1 sm:mt-2 text-sm sm:text-base text-gray-600">
              Comprehensive location-based task monitoring and geofencing system
            </p>
            {/* Quick tools moved into create flow below */}
            
            {/* Tab Navigation */}
            <div className="mt-4 border-b border-gray-200">
              <nav className="-mb-px flex space-x-8">
                <button
                  onClick={() => setActiveTab('geofences')}
                  className={`py-2 px-1 border-b-2 font-medium text-sm ${
                    activeTab === 'geofences'
                      ? 'border-indigo-500 text-indigo-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <CogIcon className="h-5 w-5 inline mr-2" />
                  Geofence Management
                </button>
                <button
                  onClick={() => setActiveTab('offline')}
                  className={`py-2 px-1 border-b-2 font-medium text-sm ${
                    activeTab === 'offline'
                      ? 'border-indigo-500 text-indigo-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <CloudIcon className="h-5 w-5 inline mr-2" />
                  Offline Status
                </button>
              </nav>
            </div>
          </div>

          {/* Tab Content */}
          <div className="mt-4 sm:mt-8">
            {!pickerOpen && activeTab === 'geofences' && (
              <GeofenceManagerOSM
                onGeofenceSelect={setSelectedGeofence}
                selectedGeofenceId={selectedGeofence?.id}
              />
            )}
            
            {!pickerOpen && activeTab === 'offline' && (
              <OfflineStatusDashboard />
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}