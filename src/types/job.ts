export interface Material {
  id?: string;
  name: string;
  date: string;
  description: string;
  quantity: number;
  rate: number;
  amount: number;
}

export interface Job {
  id: string;
  name: string;
  job_number: string;
  category: 'DA' | 'AL' | 'TB';
  customer_name: string;
  contact_number: string;
  sales_person: string;
  start_date: string;
  completion_date: string;
  contractor_name: string;
  description: string;
  materials_issued: Material[];
  created_at: string;
  updated_at: string;
  created_by: string;
  status: 'active' | 'completed' | 'on_hold' | 'cancelled';
}

export interface CreateJobData {
  // Selected job category prefix (e.g., DA, AL, TB)
  job_category?: 'DA' | 'AL' | 'TB';
  // Manual identifier entered by user (combined with category to form job_number)
  manual_job_id?: string;
  // Optional fully composed job number (e.g., DA-001)
  job_number?: string;
  // Optional: related saved location/geofence chosen during creation
  geofence_id?: string;
  location_name?: string;
  location_latitude?: number;
  location_longitude?: number;
  customer_name: string;
  contact_number: string;
  sales_person: string;
  start_date: string;
  completion_date: string;
  contractor_name: string;
  description: string;
  materials_issued?: Material[];
}

export interface UpdateJobData {
  customer_name?: string;
  contact_number?: string;
  sales_person?: string;
  start_date?: string;
  completion_date?: string;
  contractor_name?: string;
  description?: string;
  materials_issued?: Material[];
  status?: 'active' | 'completed' | 'on_hold' | 'cancelled';
  category?: 'DA' | 'AL' | 'TB';
}

export interface JobFilters {
  status?: string;
  customer_name?: string;
  sales_person?: string;
  date_from?: string;
  date_to?: string;
}
