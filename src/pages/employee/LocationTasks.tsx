import React from 'react';
import Layout from '../../components/Layout';
import LocationTaskInterface from '../../components/employee/LocationTaskInterface';

export default function LocationTasks() {
  return (
    <Layout>
      <div className="py-4 sm:py-6">
        <div className="max-w-7xl mx-auto px-2 sm:px-4 md:px-6 lg:px-8">
          <div className="mb-4 sm:mb-8">
            <h1 className="text-xl sm:text-3xl font-bold text-gray-900">Location-Based Tasks</h1>
            <p className="mt-1 sm:mt-2 text-sm sm:text-base text-gray-600">
              Manage your location-based tasks and check-in/check-out functionality
            </p>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-2 sm:p-4">
            <LocationTaskInterface />
          </div>
        </div>
      </div>
    </Layout>
  );
}