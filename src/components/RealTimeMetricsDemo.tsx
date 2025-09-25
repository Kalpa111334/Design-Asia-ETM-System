import React, { useState, useEffect } from 'react';
import RealTimeMetricsDisplay from './RealTimeMetricsDisplay';
import { supabase } from '../lib/supabase';

interface Employee {
  user_id: string;
  full_name: string;
  email: string;
}

export default function RealTimeMetricsDemo() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchEmployees();
  }, []);

  const fetchEmployees = async () => {
    try {
      setLoading(true);
      
      // Get employees who have location data
      const { data, error } = await supabase
        .from('employee_locations')
        .select(`
          user_id,
          users!inner(
            full_name,
            email
          )
        `)
        .not('user_id', 'is', null)
        .order('timestamp', { ascending: false });

      if (error) throw error;

      // Remove duplicates and format data
      const uniqueEmployees = data
        .filter((item, index, self) => 
          index === self.findIndex(t => t.user_id === item.user_id)
        )
        .map((item: any) => ({
          user_id: item.user_id,
          full_name: item.users?.full_name || '',
          email: item.users?.email || ''
        }))
        .filter(emp => emp.full_name); // Only include employees with names

      setEmployees(uniqueEmployees);
      
      // Auto-select first employee if available
      if (uniqueEmployees.length > 0 && !selectedEmployeeId) {
        setSelectedEmployeeId(uniqueEmployees[0].user_id);
      }
    } catch (error) {
      console.error('Error fetching employees:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading employees...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-3 sm:p-4 lg:p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-4 sm:mb-6">
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 mb-2">
            Real-Time Employee Metrics Demo
          </h1>
          <p className="text-sm sm:text-base text-gray-600">
            Select an employee to view their real-time tracking metrics. 
            The metrics update automatically as new location data comes in.
          </p>
        </div>

        {/* Employee Selector */}
        <div className="bg-white rounded-lg shadow-lg p-4 sm:p-6 mb-4 sm:mb-6">
          <label className="block text-sm sm:text-base font-medium text-gray-700 mb-3">
            Select Employee
          </label>
          <select
            value={selectedEmployeeId || ''}
            onChange={(e) => setSelectedEmployeeId(e.target.value || null)}
            className="w-full px-3 py-3 sm:py-2 text-base sm:text-sm border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
          >
            <option value="">-- Select an employee --</option>
            {employees.map(employee => (
              <option key={employee.user_id} value={employee.user_id}>
                {employee.full_name} ({employee.email})
              </option>
            ))}
          </select>
        </div>

        {/* Real-Time Metrics */}
        {selectedEmployeeId ? (
          <RealTimeMetricsDisplay 
            selectedEmployeeId={selectedEmployeeId}
            onMetricsUpdate={(metrics) => {
              console.log('Metrics updated:', metrics);
            }}
          />
        ) : (
          <div className="bg-white rounded-lg shadow-lg p-6 sm:p-8 text-center">
            <div className="text-gray-400 mb-4">
              <svg className="mx-auto h-12 w-12 sm:h-16 sm:w-16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <h3 className="text-base sm:text-lg font-medium text-gray-900 mb-2">No Employee Selected</h3>
            <p className="text-sm sm:text-base text-gray-600">Please select an employee from the dropdown above to view their real-time metrics.</p>
          </div>
        )}

        {/* Instructions */}
        <div className="mt-6 sm:mt-8 bg-blue-50 border border-blue-200 rounded-lg p-4 sm:p-6">
          <h3 className="text-base sm:text-lg font-medium text-blue-900 mb-3 sm:mb-4">How It Works</h3>
          <ul className="text-sm sm:text-base text-blue-800 space-y-2 sm:space-y-3">
            <li className="flex items-start">
              <span className="flex-shrink-0 w-2 h-2 bg-blue-600 rounded-full mt-2 mr-3"></span>
              <div>
                <strong>Distance (km):</strong> Total distance traveled today based on GPS coordinates
              </div>
            </li>
            <li className="flex items-start">
              <span className="flex-shrink-0 w-2 h-2 bg-green-600 rounded-full mt-2 mr-3"></span>
              <div>
                <strong>Avg Speed (km/h):</strong> Average speed calculated from movement between GPS points
              </div>
            </li>
            <li className="flex items-start">
              <span className="flex-shrink-0 w-2 h-2 bg-purple-600 rounded-full mt-2 mr-3"></span>
              <div>
                <strong>Active (min):</strong> Time spent moving (when distance between points &gt; 10 meters)
              </div>
            </li>
            <li className="flex items-start">
              <span className="flex-shrink-0 w-2 h-2 bg-orange-600 rounded-full mt-2 mr-3"></span>
              <div>
                <strong>Idle (min):</strong> Time spent stationary (when distance between points ≤ 10 meters)
              </div>
            </li>
            <li className="flex items-start">
              <span className="flex-shrink-0 w-2 h-2 bg-indigo-600 rounded-full mt-2 mr-3"></span>
              <div>
                <strong>GPS Points:</strong> Total number of location updates recorded today
              </div>
            </li>
          </ul>
        </div>

        {/* Refresh Button */}
        <div className="mt-6 sm:mt-8 text-center">
          <button
            onClick={fetchEmployees}
            className="w-full sm:w-auto px-6 py-3 sm:px-4 sm:py-2 bg-blue-600 text-white text-base sm:text-sm rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
          >
            Refresh Employee List
          </button>
        </div>
      </div>
    </div>
  );
}
