import { Attachment } from './attachment';

export interface User {
  id: string;
  email: string;
  full_name: string;
  avatar_url?: string;
  role: 'admin' | 'employee';
  skills?: string[];
  created_at: string;
  has_auth_access?: boolean;
}

export interface TaskLocation {
  id: string;
  task_id: string;
  geofence_id?: string;
  required_latitude?: number;
  required_longitude?: number;
  required_radius_meters?: number;
  arrival_required?: boolean;
  departure_required?: boolean;
  created_at: string;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  status: 'Planned' | 'Not Started' | 'In Progress' | 'Paused' | 'Completed' | 'Pending';
  priority: 'High' | 'Medium' | 'Low';
  assigned_to?: string;
  price: number;
  due_date: string;
  start_date: string;
  end_date: string;
  time_assigning: number; // in minutes
  progress_percentage?: number;
  created_at: string;
  started_at?: string;
  completed_at?: string;
  actual_time?: number;
  last_pause_at?: string;
  total_pause_duration?: number;
  hasApprovedProof?: boolean;
  task_proofs?: TaskProof[];
  proof_photo_url?: string;
  completion_notes?: string;
  updated_at?: string;
  task_locations?: TaskLocation[];
  forwarded_at?: string;
  original_due_date?: string;
  task_attachments?: Attachment[];
  completion_type?: 'with_proof' | 'without_proof';
}

export interface TaskProof {
  id: string;
  task_id: string;
  image_url: string;
  description: string;
  submitted_by: string;
  created_at: string;
  status: 'Pending' | 'Approved' | 'Rejected';
  reviewed_by?: string;
  reviewed_at?: string;
  rejection_reason?: string;
}

export interface ChatMessage {
  id: number;
  content: string;
  sender_id: string;
  created_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: 'task' | 'chat' | 'system';
  read: boolean;
  created_at: string;
}

export interface TimeLog {
  id: string;
  task_id: string;
  user_id: string;
  start_time: string;
  end_time?: string;
  duration?: number;
  created_at: string;
}

// Re-export attachment types
export * from './attachment'; 