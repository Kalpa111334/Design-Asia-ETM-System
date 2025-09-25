import React, { useState, useEffect } from 'react';
import Layout from '../../components/Layout';
import { JobService } from '../../services/JobService';
import { Job, CreateJobData } from '../../types/job';
import { useAuth } from '../../contexts/AuthContext';
import toast from 'react-hot-toast';
import { PlusIcon, PencilIcon, TrashIcon, EyeIcon, XIcon } from '@heroicons/react/outline';
import JobForm from '../../components/forms/JobForm';

export default function Jobs() {
  const { user } = useAuth();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<'DA' | 'AL' | 'TB' | ''>('');
  const [showViewModal, setShowViewModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);

  useEffect(() => {
    fetchJobs();
  }, []);

  const fetchJobs = async () => {
    try {
      setLoading(true);
      const data = await JobService.getJobs();
      setJobs(data);
    } catch (error) {
      console.error('Error fetching jobs:', error);
      toast.error('Failed to fetch jobs');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateJob = async (formData: any) => {
    if (!user) {
      toast.error('User not authenticated');
      return;
    }

    try {
      setLoading(true);
      await JobService.createJob(formData, user.id);
        toast.success('Job created successfully');
      setShowCreateModal(false);
        fetchJobs();
    } catch (error: any) {
      console.error('Error creating job:', error);
      const message = error?.message || 'Failed to create job';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setShowCreateModal(false);
    setShowEditModal(false);
  };

  const handleViewJob = (job: Job) => {
    setSelectedJob(job);
    setShowViewModal(true);
  };

  const handleEditJob = (job: Job) => {
    setSelectedJob(job);
    setShowEditModal(true);
  };

  const handleDeleteJob = (job: Job) => {
    setSelectedJob(job);
    setShowDeleteConfirm(true);
  };

  const confirmDelete = async () => {
    if (!selectedJob) return;

    try {
      setLoading(true);
      await JobService.deleteJob(selectedJob.id);
        toast.success('Job deleted successfully');
      setShowDeleteConfirm(false);
      setSelectedJob(null);
        fetchJobs();
    } catch (error) {
      console.error('Error deleting job:', error);
      toast.error('Failed to delete job');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateJob = async (formData: CreateJobData) => {
    if (!selectedJob) return;

    try {
      setLoading(true);
      
      // Add confirmation for status changes
      if ((formData as any).status && (formData as any).status !== selectedJob.status) {
        const confirmed = window.confirm(
          `Are you sure you want to change the job status from "${selectedJob.status}" to "${(formData as any).status}"?`
        );
        if (!confirmed) {
          setLoading(false);
          return;
        }
      }

      await JobService.updateJob(selectedJob.id, formData);
      toast.success('Job updated successfully');
      setShowEditModal(false);
      setSelectedJob(null);
      fetchJobs();
    } catch (error: any) {
      console.error('Error updating job:', error);
      const message = error?.message || 'Failed to update job';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const closeModals = () => {
    setShowViewModal(false);
    setShowEditModal(false);
    setShowDeleteConfirm(false);
    setSelectedJob(null);
  };

  return (
    <Layout>
      <div className="py-3 sm:py-6">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8">
          {/* Header - Mobile Responsive */}
          <div className="mb-4 sm:mb-8">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
              <div className="flex-1">
                <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900">Jobs Management</h1>
                <p className="mt-1 sm:mt-2 text-sm sm:text-base text-gray-600">Create and manage customer jobs</p>
              </div>
              <div className="w-full sm:w-auto flex flex-col sm:flex-row gap-3 sm:items-center">
                <div className="w-full sm:w-56">
                  <label className="block text-xs font-medium text-gray-600 mb-1 sm:mb-0 sm:hidden">Job Category</label>
                  <select
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory((e.target.value as any) || '')}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                  >
                    <option value="">Select category</option>
                    <option value="DA">DA - (Design Asia)</option>
                    <option value="AL">AL - (Alushine)</option>
                    <option value="TB">TB - (Top baas)</option>
                  </select>
                </div>
                <button
                  onClick={() => {
                    if (!selectedCategory) {
                      toast.error('Please select a Job Category first');
                      return;
                    }
                    setShowCreateModal(true);
                  }}
                  className="w-full sm:w-auto inline-flex items-center justify-center px-4 py-3 sm:py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 touch-manipulation transition-colors"
                >
                  <PlusIcon className="h-4 w-4 sm:h-5 sm:w-5 mr-2" />
                  Create Job
                </button>
              </div>
            </div>
          </div>

          {/* Jobs List - Enhanced Mobile Responsive Cards */}
          <div className="space-y-3 sm:space-y-0">
            {loading ? (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200">
                <div className="flex justify-center items-center py-8 sm:py-12">
                  <div className="animate-spin rounded-full h-6 w-6 sm:h-8 sm:w-8 border-b-2 border-indigo-500"></div>
                </div>
              </div>
            ) : jobs.length === 0 ? (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200">
                <div className="text-center py-8 sm:py-12 px-4">
                  <div className="mx-auto h-12 w-12 text-gray-400 mb-4">
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <h3 className="text-sm sm:text-base font-medium text-gray-900">No jobs found</h3>
                  <p className="mt-1 text-xs sm:text-sm text-gray-500">Get started by creating a new job.</p>
                </div>
              </div>
            ) : (
              <div className="space-y-3 sm:space-y-0">
                {/* Mobile Card Layout */}
                <div className="block sm:hidden space-y-3">
                  {jobs.map((job) => (
                    <div key={job.id} className="bg-white rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow duration-200">
                      <div className="p-4">
                        {/* Job Header */}
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center space-x-2 mb-1">
                              <span className="text-sm font-bold text-indigo-600">{job.job_number}</span>
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                                job.status === 'completed' ? 'bg-green-100 text-green-800' :
                                job.status === 'active' ? 'bg-blue-100 text-blue-800' :
                                job.status === 'on_hold' ? 'bg-yellow-100 text-yellow-800' :
                                job.status === 'cancelled' ? 'bg-red-100 text-red-800' :
                                'bg-gray-100 text-gray-800'
                              }`}>
                                {job.status}
                              </span>
                  </div>
                            <h3 className="text-base font-semibold text-gray-900 truncate">{job.customer_name}</h3>
                            <p className="text-sm text-gray-600 truncate">{job.sales_person}</p>
                  </div>
                </div>

                        {/* Job Details */}
                        <div className="grid grid-cols-2 gap-3 mb-4">
                          <div>
                            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Start Date</p>
                            <p className="text-sm text-gray-900">{new Date(job.start_date).toLocaleDateString()}</p>
              </div>
                          <div>
                            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">End Date</p>
                            <p className="text-sm text-gray-900">{new Date(job.completion_date).toLocaleDateString()}</p>
                  </div>
                </div>

                        {/* Contractor */}
                        <div className="mb-4">
                          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Contractor</p>
                          <p className="text-sm text-gray-900 truncate">{job.contractor_name}</p>
              </div>

                        {/* Materials Summary */}
                        {job.materials_issued && job.materials_issued.length > 0 && (
                          <div className="mb-4 p-3 bg-gray-50 rounded-md">
                            <div className="flex justify-between items-center">
                              <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Materials</span>
                              <span className="text-sm font-semibold text-gray-900">
                                ${job.materials_issued.reduce((total, material) => total + material.amount, 0).toFixed(2)}
                              </span>
                  </div>
                            <p className="text-xs text-gray-600 mt-1">{job.materials_issued.length} item(s)</p>
            </div>
          )}

                        {/* Action Buttons */}
                        <div className="flex justify-between items-center pt-3 border-t border-gray-200">
                          <div className="flex items-center space-x-2">
                            <button 
                              onClick={() => handleViewJob(job)}
                              className="flex-1 inline-flex items-center justify-center px-3 py-2 border border-gray-300 shadow-sm text-xs font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 touch-manipulation"
                            >
                              <EyeIcon className="h-4 w-4 mr-1" />
                              View
                            </button>
                            <button 
                              onClick={() => handleEditJob(job)}
                              className="flex-1 inline-flex items-center justify-center px-3 py-2 border border-gray-300 shadow-sm text-xs font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 touch-manipulation"
                            >
                              <PencilIcon className="h-4 w-4 mr-1" />
                              Edit
                            </button>
                </div>
                          <button 
                            onClick={() => handleDeleteJob(job)}
                            className="inline-flex items-center justify-center px-3 py-2 border border-red-300 shadow-sm text-xs font-medium rounded-md text-red-700 bg-white hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 touch-manipulation"
                          >
                            <TrashIcon className="h-4 w-4" />
                          </button>
              </div>
            </div>
          </div>
                  ))}
              </div>

                {/* Tablet Layout - Compact Cards */}
                <div className="hidden sm:block lg:hidden">
                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                {jobs.map((job) => (
                      <div key={job.id} className="bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-md transition-shadow duration-200">
                        <div className="p-6">
                          {/* Header */}
                          <div className="flex items-start justify-between mb-4">
                            <div className="flex items-center space-x-3">
                              <div className="h-8 w-8 bg-indigo-100 rounded-lg flex items-center justify-center">
                                <span className="text-xs font-semibold text-indigo-600">
                                  {job.job_number.split('-')[1] || '001'}
                                </span>
                              </div>
                              <div>
                                <h3 className="text-sm font-bold text-indigo-600">{job.job_number}</h3>
                                <p className="text-sm font-semibold text-gray-900">{job.customer_name}</p>
                              </div>
                            </div>
                            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                              job.status === 'completed' ? 'bg-green-100 text-green-800' :
                              job.status === 'active' ? 'bg-blue-100 text-blue-800' :
                              job.status === 'on_hold' ? 'bg-yellow-100 text-yellow-800' :
                              job.status === 'cancelled' ? 'bg-red-100 text-red-800' :
                              'bg-gray-100 text-gray-800'
                            }`}>
                              {job.status}
                            </span>
                              </div>

                          {/* Details */}
                          <div className="grid grid-cols-2 gap-4 mb-4">
                            <div>
                              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Sales Person</p>
                              <p className="text-sm text-gray-900">{job.sales_person}</p>
                              </div>
                            <div>
                              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Contractor</p>
                              <p className="text-sm text-gray-900 truncate">{job.contractor_name}</p>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-4 mb-4">
                            <div>
                              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Start Date</p>
                              <p className="text-sm text-gray-900">{new Date(job.start_date).toLocaleDateString()}</p>
                            </div>
                            <div>
                              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">End Date</p>
                              <p className="text-sm text-gray-900">{new Date(job.completion_date).toLocaleDateString()}</p>
                            </div>
                          </div>

                          {/* Materials */}
                          {job.materials_issued && job.materials_issued.length > 0 && (
                            <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                              <div className="flex justify-between items-center">
                                <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Materials</span>
                                <span className="text-sm font-semibold text-gray-900">
                                  ${job.materials_issued.reduce((total, material) => total + material.amount, 0).toFixed(2)}
                                </span>
                              </div>
                              <p className="text-xs text-gray-600 mt-1">{job.materials_issued.length} item(s)</p>
                        </div>
                          )}

                          {/* Actions */}
                          <div className="flex justify-end space-x-2 pt-4 border-t border-gray-200">
                            <button 
                              onClick={() => handleViewJob(job)}
                              className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-xs font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors duration-200"
                            >
                              <EyeIcon className="h-4 w-4 mr-1" />
                              View
                            </button>
                            <button 
                              onClick={() => handleEditJob(job)}
                              className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-xs font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors duration-200"
                            >
                              <PencilIcon className="h-4 w-4 mr-1" />
                              Edit
                            </button>
                            <button 
                              onClick={() => handleDeleteJob(job)}
                              className="inline-flex items-center px-3 py-2 border border-red-300 shadow-sm text-xs font-medium rounded-md text-red-700 bg-white hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-colors duration-200"
                            >
                              <TrashIcon className="h-4 w-4 mr-1" />
                              Delete
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Enhanced Desktop Table Layout */}
                <div className="hidden lg:block bg-white shadow-sm rounded-lg border border-gray-200 overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gradient-to-r from-gray-50 to-gray-100">
                        <tr>
                          <th className="px-8 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                            <div className="flex items-center">
                              <svg className="h-4 w-4 mr-2 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                              </svg>
                              Job Details
                            </div>
                          </th>
                          <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                            <div className="flex items-center">
                              <svg className="h-4 w-4 mr-2 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              Status
                            </div>
                          </th>
                          <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                            <div className="flex items-center">
                              <svg className="h-4 w-4 mr-2 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                              </svg>
                              Timeline
                            </div>
                          </th>
                          <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                            <div className="flex items-center">
                              <svg className="h-4 w-4 mr-2 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                              </svg>
                              Materials
                            </div>
                          </th>
                          <th className="px-8 py-4 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">
                            <div className="flex items-center justify-center">
                              <svg className="h-4 w-4 mr-2 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              </svg>
                              Actions
                            </div>
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-100">
                        {jobs.map((job, index) => (
                          <tr key={job.id} className={`hover:bg-gray-50 transition-all duration-200 ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'}`}>
                            <td className="px-8 py-6">
                              <div className="flex items-start space-x-4">
                                <div className="flex-shrink-0">
                                  <div className="h-10 w-10 bg-indigo-100 rounded-lg flex items-center justify-center">
                                    <span className="text-sm font-semibold text-indigo-600">
                                      {job.job_number.split('-')[1] || '001'}
                                    </span>
                                  </div>
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center space-x-2 mb-1">
                                    <p className="text-sm font-bold text-indigo-600">{job.job_number}</p>
                                  </div>
                                  <p className="text-sm font-semibold text-gray-900 truncate">{job.customer_name}</p>
                                  <p className="text-sm text-gray-500 truncate">{job.sales_person}</p>
                                  <p className="text-xs text-gray-400 truncate mt-1">{job.contractor_name}</p>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-6 whitespace-nowrap">
                              <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${
                                job.status === 'completed' ? 'bg-green-100 text-green-800 border border-green-200' :
                                job.status === 'active' ? 'bg-blue-100 text-blue-800 border border-blue-200' :
                                job.status === 'on_hold' ? 'bg-yellow-100 text-yellow-800 border border-yellow-200' :
                                job.status === 'cancelled' ? 'bg-red-100 text-red-800 border border-red-200' :
                                'bg-gray-100 text-gray-800 border border-gray-200'
                              }`}>
                                <div className={`w-2 h-2 rounded-full mr-2 ${
                                  job.status === 'completed' ? 'bg-green-500' :
                                  job.status === 'active' ? 'bg-blue-500' :
                                  job.status === 'on_hold' ? 'bg-yellow-500' :
                                  job.status === 'cancelled' ? 'bg-red-500' :
                                  'bg-gray-500'
                                }`}></div>
                                {job.status}
                              </span>
                            </td>
                            <td className="px-6 py-6 whitespace-nowrap">
                              <div className="space-y-1">
                                <div className="flex items-center text-sm text-gray-900">
                                  <svg className="h-4 w-4 mr-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                  </svg>
                                  <span className="font-medium">Start:</span>
                                  <span className="ml-1">{new Date(job.start_date).toLocaleDateString()}</span>
                                </div>
                                <div className="flex items-center text-sm text-gray-900">
                                  <svg className="h-4 w-4 mr-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                  </svg>
                                  <span className="font-medium">End:</span>
                                  <span className="ml-1">{new Date(job.completion_date).toLocaleDateString()}</span>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-6 whitespace-nowrap">
                              {job.materials_issued && job.materials_issued.length > 0 ? (
                                <div className="space-y-1">
                                  <div className="flex items-center">
                                    <svg className="h-4 w-4 mr-2 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                                    </svg>
                                    <span className="text-sm font-bold text-gray-900">
                                      ${job.materials_issued.reduce((total, material) => total + material.amount, 0).toFixed(2)}
                                    </span>
                                  </div>
                                  <div className="flex items-center text-sm text-gray-500">
                                    <svg className="h-3 w-3 mr-1 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                                    </svg>
                                    {job.materials_issued.length} item{job.materials_issued.length !== 1 ? 's' : ''}
                                  </div>
                                </div>
                              ) : (
                                <div className="flex items-center text-sm text-gray-400">
                                  <svg className="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                                  </svg>
                                  No materials
                                </div>
                              )}
                            </td>
                            <td className="px-8 py-6 whitespace-nowrap text-center">
                              <div className="flex items-center justify-center space-x-1">
                        <button
                                  onClick={() => handleViewJob(job)}
                                  className="group relative inline-flex items-center justify-center p-2 text-indigo-600 hover:text-indigo-900 hover:bg-indigo-50 rounded-lg transition-all duration-200 border border-transparent hover:border-indigo-200"
                                  title="View job details"
                        >
                          <EyeIcon className="h-4 w-4" />
                                  <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 text-xs text-white bg-gray-900 rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap">
                                    View Details
                                  </div>
                        </button>
                        <button
                                  onClick={() => handleEditJob(job)}
                                  className="group relative inline-flex items-center justify-center p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-lg transition-all duration-200 border border-transparent hover:border-gray-200"
                                  title="Edit job"
                        >
                          <PencilIcon className="h-4 w-4" />
                                  <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 text-xs text-white bg-gray-900 rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap">
                                    Edit Job
                                  </div>
                        </button>
                        <button
                          onClick={() => handleDeleteJob(job)}
                                  className="group relative inline-flex items-center justify-center p-2 text-red-600 hover:text-red-900 hover:bg-red-50 rounded-lg transition-all duration-200 border border-transparent hover:border-red-200"
                                  title="Delete job"
                        >
                          <TrashIcon className="h-4 w-4" />
                                  <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 text-xs text-white bg-gray-900 rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap">
                                    Delete Job
                                  </div>
                        </button>
                      </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Create Job Modal - Mobile Responsive */}
      {showCreateModal && (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-4 sm:top-10 lg:top-20 mx-auto p-3 sm:p-5 border w-full sm:w-11/12 max-w-4xl shadow-lg rounded-md bg-white min-h-[calc(100vh-2rem)] sm:min-h-auto">
            <div className="mt-1 sm:mt-3">
              <div className="flex justify-between items-center mb-4 sm:mb-6">
                <h3 className="text-lg sm:text-xl font-medium text-gray-900">Create New Job</h3>
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
                initialData={{ job_category: selectedCategory as 'DA' | 'AL' | 'TB' | undefined }}
                onSubmit={handleCreateJob}
                onCancel={handleCancel}
                loading={loading}
                submitButtonText="Create Job"
                title="Create New Job"
              />
            </div>
          </div>
        </div>
      )}

      {/* View Job Modal */}
      {showViewModal && selectedJob && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-4 sm:top-10 mx-auto p-3 sm:p-5 border w-full sm:w-11/12 max-w-4xl shadow-lg rounded-md bg-white min-h-[calc(100vh-2rem)] sm:min-h-auto">
            <div className="mt-1 sm:mt-3">
              <div className="flex justify-between items-center mb-4 sm:mb-6">
                <h3 className="text-lg sm:text-xl font-medium text-gray-900">Job Details</h3>
                <button
                  onClick={closeModals}
                  className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full touch-manipulation"
                >
                  <XIcon className="h-5 w-5 sm:h-6 sm:w-6" />
                </button>
              </div>

              <div className="space-y-4 sm:space-y-6">
                {/* Job Card Header */}
                <div className="bg-gray-50 p-3 sm:p-4 rounded-lg">
                  <h4 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4">JOB CARD</h4>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Job Number</label>
                      <div className="px-3 py-2 bg-white border border-gray-300 rounded text-sm font-medium text-indigo-600">
                        {selectedJob.job_number}
                      </div>
            </div>
            <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                      <div className="px-3 py-2 bg-white border border-gray-300 rounded text-sm">
                        {selectedJob.status}
                      </div>
            </div>
            <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Customer Name</label>
                      <div className="px-3 py-2 bg-white border border-gray-300 rounded text-sm">
                        {selectedJob.customer_name}
                      </div>
            </div>
            <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Contact Number</label>
                      <div className="px-3 py-2 bg-white border border-gray-300 rounded text-sm">
                        {selectedJob.contact_number}
                      </div>
            </div>
            <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Sales Person</label>
                      <div className="px-3 py-2 bg-white border border-gray-300 rounded text-sm">
                        {selectedJob.sales_person}
                      </div>
            </div>
            <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Contractor Name</label>
                      <div className="px-3 py-2 bg-white border border-gray-300 rounded text-sm">
                        {selectedJob.contractor_name}
                      </div>
            </div>
            <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                      <div className="px-3 py-2 bg-white border border-gray-300 rounded text-sm">
                        {selectedJob.start_date}
                      </div>
            </div>
            <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Completion Date</label>
                      <div className="px-3 py-2 bg-white border border-gray-300 rounded text-sm">
                        {selectedJob.completion_date}
                      </div>
            </div>
          </div>

                  <div className="mt-3 sm:mt-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                    <div className="px-3 py-2 bg-white border border-gray-300 rounded text-sm min-h-[80px]">
                      {selectedJob.description}
                    </div>
                  </div>
            </div>

                {/* Materials Section */}
                {selectedJob.materials_issued && selectedJob.materials_issued.length > 0 && (
                  <div className="bg-gray-50 p-3 sm:p-4 rounded-lg">
                    <h4 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4">Material Issued</h4>
                    
                    {/* Desktop Table */}
                    <div className="hidden sm:block overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Qty</th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rate</th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                          {selectedJob.materials_issued.map((material, index) => (
                      <tr key={index}>
                              <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">{material.name}</td>
                              <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">{material.date}</td>
                              <td className="px-3 py-2 text-sm text-gray-900">{material.description}</td>
                              <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">{material.quantity}</td>
                              <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">${material.rate.toFixed(2)}</td>
                              <td className="px-3 py-2 whitespace-nowrap text-sm font-medium text-gray-900">${material.amount.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                        <tfoot className="bg-gray-50">
                          <tr>
                            <td colSpan={5} className="px-3 py-2 text-right text-sm font-medium text-gray-900">Total:</td>
                            <td className="px-3 py-2 whitespace-nowrap text-sm font-bold text-gray-900">
                              ${selectedJob.materials_issued.reduce((total, material) => total + material.amount, 0).toFixed(2)}
                            </td>
                          </tr>
                        </tfoot>
                </table>
              </div>

                    {/* Mobile Cards */}
                    <div className="block sm:hidden space-y-3">
                      {selectedJob.materials_issued.map((material, index) => (
                        <div key={index} className="bg-white p-3 rounded-lg border border-gray-200">
                          <div className="flex justify-between items-start mb-2">
                            <h5 className="text-sm font-medium text-gray-900">{material.name}</h5>
                            <span className="text-sm font-bold text-gray-900">${material.amount.toFixed(2)}</span>
                          </div>
                          <div className="text-xs text-gray-500 space-y-1">
                            <div>Date: {material.date}</div>
                            <div>Qty: {material.quantity} × ${material.rate.toFixed(2)}</div>
                            {material.description && <div>Description: {material.description}</div>}
                          </div>
                        </div>
                      ))}
                      <div className="bg-white p-3 rounded-lg border-2 border-gray-300">
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-medium text-gray-900">Total:</span>
                          <span className="text-sm font-bold text-gray-900">
                            ${selectedJob.materials_issued.reduce((total, material) => total + material.amount, 0).toFixed(2)}
                          </span>
                        </div>
                      </div>
              </div>
            </div>
          )}

                <div className="flex justify-end">
          <button
                    onClick={closeModals}
                    className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
          >
            Close
          </button>
        </div>
      </div>
    </div>
          </div>
        </div>
      )}

      {/* Edit Job Modal */}
      {showEditModal && selectedJob && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-4 sm:top-10 lg:top-20 mx-auto p-3 sm:p-5 border w-full sm:w-11/12 max-w-4xl shadow-lg rounded-md bg-white min-h-[calc(100vh-2rem)] sm:min-h-auto">
            <div className="mt-1 sm:mt-3">
              <div className="flex justify-between items-center mb-4 sm:mb-6">
                <h3 className="text-lg sm:text-xl font-medium text-gray-900">Edit Job</h3>
                <button
                  onClick={closeModals}
                  className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full touch-manipulation"
                >
                  <XIcon className="h-5 w-5 sm:h-6 sm:w-6" />
                </button>
              </div>

              <JobForm
                initialData={{
                  customer_name: selectedJob.customer_name,
                  contact_number: selectedJob.contact_number,
                  sales_person: selectedJob.sales_person,
                  start_date: selectedJob.start_date,
                  completion_date: selectedJob.completion_date,
                  contractor_name: selectedJob.contractor_name,
                  description: selectedJob.description,
                  materials_issued: selectedJob.materials_issued || [],
                  status: selectedJob.status
                }}
                onSubmit={handleUpdateJob}
                onCancel={closeModals}
                loading={loading}
                submitButtonText="Update Job"
                title="Edit Job"
              />
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && selectedJob && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-4 sm:top-20 mx-auto p-3 sm:p-5 border w-full sm:w-96 shadow-lg rounded-md bg-white">
            <div className="mt-1 sm:mt-3">
              <div className="flex items-center mb-4">
                <div className="flex-shrink-0">
                  <TrashIcon className="h-6 w-6 text-red-600" />
                </div>
                <div className="ml-3">
                  <h3 className="text-lg font-medium text-gray-900">Delete Job</h3>
                </div>
              </div>
              
              <div className="mb-6">
                <p className="text-sm text-gray-500">
                  Are you sure you want to delete job <span className="font-medium text-gray-900">{selectedJob.job_number}</span>? 
                  This action cannot be undone.
                </p>
              </div>

              <div className="flex justify-end space-x-3">
                <button
                  onClick={closeModals}
                  className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDelete}
                  disabled={loading}
                  className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}