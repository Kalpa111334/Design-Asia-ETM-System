import React, { useState } from 'react';
import { Material } from '../../types/job';
import LocationDropdown from './LocationDropdown';
import { PlusIcon, TrashIcon } from '@heroicons/react/outline';

interface JobFormData {
  job_category?: 'DA' | 'AL' | 'TB';
  manual_job_id?: string;
  geofence_id?: string;
  location_name?: string;
  customer_name: string;
  contact_number: string;
  sales_person: string;
  start_date: string;
  completion_date: string;
  contractor_name: string;
  description: string;
  materials_issued: Material[];
  status?: 'active' | 'completed' | 'on_hold' | 'cancelled';
}

interface JobFormProps {
  initialData?: Partial<JobFormData>;
  onSubmit: (data: JobFormData) => void;
  onCancel: () => void;
  loading?: boolean;
  submitButtonText?: string;
  title?: string;
}

const initialFormData: JobFormData = {
  job_category: undefined,
  manual_job_id: '',
  geofence_id: undefined,
  location_name: '',
  customer_name: '',
  contact_number: '',
  sales_person: '',
  start_date: '',
  completion_date: '',
  contractor_name: '',
  description: '',
  materials_issued: [],
  status: 'active'
};

const initialMaterial: Material = {
  name: '',
  date: '',
  description: '',
  quantity: 0,
  rate: 0,
  amount: 0
};

export default function JobForm({
  initialData = {},
  onSubmit,
  onCancel,
  loading = false,
  submitButtonText = 'Create Job',
  title = 'Create New Job'
}: JobFormProps) {
  const [formData, setFormData] = useState<JobFormData>({
    ...initialFormData,
    ...initialData
  });

  const addMaterial = () => {
    setFormData(prev => ({
      ...prev,
      materials_issued: [...prev.materials_issued, { ...initialMaterial }]
    }));
  };

  const updateMaterial = (index: number, field: keyof Material, value: any) => {
    setFormData(prev => ({
      ...prev,
      materials_issued: prev.materials_issued.map((material, i) => {
        if (i === index) {
          const updated = { ...material, [field]: value };
          if (field === 'quantity' || field === 'rate') {
            updated.amount = updated.quantity * updated.rate;
          }
          return updated;
        }
        return material;
      })
    }));
  };

  const removeMaterial = (index: number) => {
    setFormData(prev => ({
      ...prev,
      materials_issued: prev.materials_issued.filter((_, i) => i !== index)
    }));
  };

  const calculateTotalMaterialCost = (materials: Material[]): number => {
    return materials.reduce((total, material) => total + material.amount, 0);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Basic required field validation (prevents DB NOT NULL errors)
    if (!formData.customer_name || formData.customer_name.trim() === '') {
      alert('Customer Name is required.');
      return;
    }
    if (!formData.start_date) {
      alert('Start Date is required.');
      return;
    }
    if (!formData.completion_date) {
      alert('Completion Date is required.');
      return;
    }
    // Build composed job_number from category + manual id if both provided
    let job_number: string | undefined = undefined;
    if (formData.job_category && formData.manual_job_id && formData.manual_job_id.trim() !== '') {
      const numericPart = formData.manual_job_id.replace(/\D/g, '');
      if (!numericPart) {
        alert('Job ID must contain numbers.');
        return;
      }
      job_number = `${formData.job_category}-${parseInt(numericPart, 10).toString().padStart(3, '0')}`;
    }
    if (!formData.job_category) {
      alert('Please select a Job Category.');
      return;
    }
    onSubmit({ ...formData, job_category: formData.job_category, ...(job_number ? { job_number } : {}) } as any);
  };

  const totalMaterialCost = calculateTotalMaterialCost(formData.materials_issued);

  return (
    <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
      {/* Job Card Header */}
      <div className="bg-white border border-gray-200 p-4 sm:p-6 rounded-lg shadow-sm">
        <div className="flex items-center mb-4 sm:mb-6">
          <div className="flex-shrink-0">
            <div className="h-8 w-8 sm:h-10 sm:w-10 bg-indigo-100 rounded-lg flex items-center justify-center">
              <svg className="h-5 w-5 sm:h-6 sm:w-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
          </div>
          <div className="ml-3 sm:ml-4">
            <h4 className="text-lg sm:text-xl font-semibold text-gray-900">JOB CARD</h4>
            <p className="text-sm text-gray-500">Enter job details and information</p>
          </div>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
          {/* Saved Locations Dropdown */}
          <div className="lg:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-2">Location / Place</label>
            <LocationDropdown
              value={formData.geofence_id || ''}
              onChange={(opt) => setFormData(prev => ({ ...prev, geofence_id: opt?.id || undefined, location_name: opt?.name || '' }))}
            />
            {formData.location_name && (
              <p className="mt-1 text-xs text-gray-500">Selected: {formData.location_name}</p>
            )}
          </div>
          {/* Job Category */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Job Category
            </label>
            <select
              value={formData.job_category || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, job_category: (e.target.value || undefined) as any }))}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-base touch-manipulation transition-colors duration-200"
            >
              <option value="">Select category</option>
              <option value="DA">DA - (Design Asia)</option>
              <option value="AL">AL - (Alushine)</option>
              <option value="TB">TB - (Top baas)</option>
            </select>
          </div>

          {/* Manual Job ID */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Manual Job ID (numbers only)
            </label>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              value={formData.manual_job_id}
              onChange={(e) => setFormData(prev => ({ ...prev, manual_job_id: e.target.value }))}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-base touch-manipulation transition-colors duration-200"
              placeholder="e.g. 1 or 023"
            />
            {formData.job_category && formData.manual_job_id && (
              <p className="mt-1 text-xs text-gray-500">Composed Job Number: <span className="font-semibold text-indigo-600">{`${formData.job_category}-${(parseInt(formData.manual_job_id.replace(/\D/g, '') || '0', 10)).toString().padStart(3, '0')}`}</span></p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Customer Name *
            </label>
            <input
              type="text"
              required
              value={formData.customer_name}
              onChange={(e) => setFormData(prev => ({ ...prev, customer_name: e.target.value }))}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-base touch-manipulation transition-colors duration-200"
              placeholder="Enter customer name"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Contact Number *
            </label>
            <input
              type="tel"
              required
              value={formData.contact_number}
              onChange={(e) => setFormData(prev => ({ ...prev, contact_number: e.target.value }))}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-base touch-manipulation transition-colors duration-200"
              placeholder="Enter contact number"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Sales Person *
            </label>
            <input
              type="text"
              required
              value={formData.sales_person}
              onChange={(e) => setFormData(prev => ({ ...prev, sales_person: e.target.value }))}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-base touch-manipulation transition-colors duration-200"
              placeholder="Enter sales person name"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Contractor Name / Worker *
            </label>
            <input
              type="text"
              required
              value={formData.contractor_name}
              onChange={(e) => setFormData(prev => ({ ...prev, contractor_name: e.target.value }))}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-base touch-manipulation transition-colors duration-200"
              placeholder="Enter contractor/worker name"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Start Date *
            </label>
            <input
              type="date"
              required
              value={formData.start_date}
              onChange={(e) => setFormData(prev => ({ ...prev, start_date: e.target.value }))}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-base touch-manipulation transition-colors duration-200"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Completion Date *
            </label>
            <input
              type="date"
              required
              value={formData.completion_date}
              onChange={(e) => setFormData(prev => ({ ...prev, completion_date: e.target.value }))}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-base touch-manipulation transition-colors duration-200"
            />
          </div>

          {/* Job Status - Only show in edit mode */}
          {initialData && Object.keys(initialData).length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Job Status
              </label>
              <select
                value={formData.status || 'active'}
                onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value as any }))}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-base touch-manipulation transition-colors duration-200"
              >
                <option value="active">Active</option>
                <option value="completed">Completed</option>
                <option value="on_hold">On Hold</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
          )}
        </div>

        <div className="mt-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Description *
          </label>
          <textarea
            required
            rows={4}
            value={formData.description}
            onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-base touch-manipulation resize-none transition-colors duration-200"
            placeholder="Enter job description"
          />
        </div>
      </div>

      {/* Materials Section */}
      <div className="bg-white border border-gray-200 p-4 sm:p-6 rounded-lg shadow-sm">
        <div className="flex items-center mb-4 sm:mb-6">
          <div className="flex-shrink-0">
            <div className="h-8 w-8 sm:h-10 sm:w-10 bg-green-100 rounded-lg flex items-center justify-center">
              <svg className="h-5 w-5 sm:h-6 sm:w-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            </div>
          </div>
          <div className="ml-3 sm:ml-4 flex-1">
            <h4 className="text-lg sm:text-xl font-semibold text-gray-900">Material Issued</h4>
            <p className="text-sm text-gray-500">Add materials and quantities for this job</p>
          </div>
          <button
            type="button"
            onClick={addMaterial}
            className="inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 touch-manipulation transition-colors duration-200 shadow-sm"
          >
            <PlusIcon className="h-4 w-4 mr-2" />
            <span className="hidden sm:inline">Add Material</span>
            <span className="sm:hidden">Add</span>
          </button>
        </div>

        {formData.materials_issued.length > 0 && (
          <>
            {/* Mobile Layout - Enhanced Cards */}
            <div className="block sm:hidden space-y-4">
              {formData.materials_issued.map((material, index) => (
                <div key={index} className="bg-gray-50 border border-gray-200 p-4 rounded-lg">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center">
                      <div className="h-6 w-6 bg-indigo-100 rounded-full flex items-center justify-center mr-2">
                        <span className="text-xs font-medium text-indigo-600">{index + 1}</span>
                      </div>
                      <h5 className="text-sm font-semibold text-gray-900">Material #{index + 1}</h5>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeMaterial(index)}
                      className="p-2 text-red-600 hover:text-red-900 hover:bg-red-50 rounded-full touch-manipulation transition-colors duration-200"
                    >
                      <TrashIcon className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Material Name</label>
                      <input
                        type="text"
                        value={material.name}
                        onChange={(e) => updateMaterial(index, 'name', e.target.value)}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg text-base focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 touch-manipulation transition-colors duration-200"
                        placeholder="Enter material name"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Date</label>
                        <input
                          type="date"
                          value={material.date}
                          onChange={(e) => updateMaterial(index, 'date', e.target.value)}
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg text-base focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 touch-manipulation transition-colors duration-200"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Total Amount</label>
                        <div className="px-4 py-3 bg-white border border-gray-300 rounded-lg text-base font-semibold text-gray-900">
                          ${material.amount.toFixed(2)}
                        </div>
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                      <input
                        type="text"
                        value={material.description}
                        onChange={(e) => updateMaterial(index, 'description', e.target.value)}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg text-base focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 touch-manipulation transition-colors duration-200"
                        placeholder="Enter description"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Quantity</label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={material.quantity}
                          onChange={(e) => updateMaterial(index, 'quantity', parseFloat(e.target.value) || 0)}
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg text-base focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 touch-manipulation transition-colors duration-200"
                          placeholder="0"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Rate ($)</label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={material.rate}
                          onChange={(e) => updateMaterial(index, 'rate', parseFloat(e.target.value) || 0)}
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg text-base focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 touch-manipulation transition-colors duration-200"
                          placeholder="0.00"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              <div className="bg-indigo-50 border-2 border-indigo-200 p-4 rounded-lg">
                <div className="flex justify-between items-center">
                  <span className="text-base font-semibold text-gray-900">Total Amount:</span>
                  <span className="text-lg font-bold text-indigo-600">${totalMaterialCost.toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* Desktop Layout - Table */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Name
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Description
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Qty
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Rate
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Amount
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {formData.materials_issued.map((material, index) => (
                    <tr key={index}>
                      <td className="px-3 py-2 whitespace-nowrap">
                        <input
                          type="text"
                          value={material.name}
                          onChange={(e) => updateMaterial(index, 'name', e.target.value)}
                          className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-indigo-500 focus:border-indigo-500"
                          placeholder="Material name"
                        />
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        <input
                          type="date"
                          value={material.date}
                          onChange={(e) => updateMaterial(index, 'date', e.target.value)}
                          className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-indigo-500 focus:border-indigo-500"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="text"
                          value={material.description}
                          onChange={(e) => updateMaterial(index, 'description', e.target.value)}
                          className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-indigo-500 focus:border-indigo-500"
                          placeholder="Description"
                        />
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={material.quantity}
                          onChange={(e) => updateMaterial(index, 'quantity', parseFloat(e.target.value) || 0)}
                          className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-indigo-500 focus:border-indigo-500"
                          placeholder="0"
                        />
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={material.rate}
                          onChange={(e) => updateMaterial(index, 'rate', parseFloat(e.target.value) || 0)}
                          className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-indigo-500 focus:border-indigo-500"
                          placeholder="0.00"
                        />
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        <span className="text-sm font-medium text-gray-900">
                          {material.amount.toFixed(2)}
                        </span>
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => removeMaterial(index)}
                          className="text-red-600 hover:text-red-900"
                        >
                          <TrashIcon className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gray-50">
                  <tr>
                    <td colSpan={5} className="px-3 py-2 text-right text-sm font-medium text-gray-900">
                      Total Amount:
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-sm font-bold text-gray-900">
                      {totalMaterialCost.toFixed(2)}
                    </td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </>
        )}

        {formData.materials_issued.length === 0 && (
          <div className="text-center py-8">
            <div className="mx-auto h-12 w-12 text-gray-400 mb-4">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            </div>
            <p className="text-sm text-gray-500">No materials added yet</p>
            <p className="text-xs text-gray-400 mt-1">Click "Add Material" to get started</p>
          </div>
        )}
      </div>

      {/* Form Actions */}
      <div className="bg-white border border-gray-200 p-4 sm:p-6 rounded-lg shadow-sm">
        <div className="flex flex-col sm:flex-row justify-end gap-3 sm:gap-4">
          <button
            type="button"
            onClick={onCancel}
            className="w-full sm:w-auto px-6 py-3 border border-gray-300 rounded-lg shadow-sm text-base font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 touch-manipulation transition-colors duration-200"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="w-full sm:w-auto px-6 py-3 border border-transparent rounded-lg shadow-sm text-base font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation transition-colors duration-200"
          >
            {loading ? (
              <div className="flex items-center justify-center">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Processing...
              </div>
            ) : (
              submitButtonText
            )}
          </button>
        </div>
      </div>
    </form>
  );
}
