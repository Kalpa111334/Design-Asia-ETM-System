import React, { useState } from 'react';
import JobForm from './JobForm';
import { Job } from '../../types/job';

// Demo component showing how to use JobForm in different contexts
export default function JobFormDemo() {
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);

  const handleSubmit = async (formData: any) => {
    setLoading(true);
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 2000));
    console.log('Job form submitted:', formData);
    setLoading(false);
    setShowModal(false);
  };

  const handleCancel = () => {
    setShowModal(false);
  };

  return (
    <div className="p-6">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">JobForm Component Demo</h1>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Inline Form */}
          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-lg font-semibold mb-4">Inline Form</h2>
            <JobForm
              onSubmit={handleSubmit}
              onCancel={() => console.log('Inline form cancelled')}
              loading={loading}
              submitButtonText="Save Job"
              title="Create Job"
            />
          </div>

          {/* Modal Trigger */}
          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-lg font-semibold mb-4">Modal Form</h2>
            <button
              onClick={() => setShowModal(true)}
              className="w-full px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
            >
              Open Modal Form
            </button>
          </div>
        </div>

        {/* Modal */}
        {showModal && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
            <div className="relative top-4 sm:top-10 mx-auto p-3 sm:p-5 border w-full sm:w-11/12 max-w-4xl shadow-lg rounded-md bg-white min-h-[calc(100vh-2rem)] sm:min-h-auto">
              <div className="mt-1 sm:mt-3">
                <div className="flex justify-between items-center mb-4 sm:mb-6">
                  <h3 className="text-lg sm:text-xl font-medium text-gray-900">Modal Job Form</h3>
                  <button
                    onClick={handleCancel}
                    className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full touch-manipulation"
                  >
                    <span className="sr-only">Close</span>
                    <svg className="h-5 w-5 sm:h-6 sm:w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                <JobForm
                  onSubmit={handleSubmit}
                  onCancel={handleCancel}
                  loading={loading}
                  submitButtonText="Create Job"
                  title="Create New Job"
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
