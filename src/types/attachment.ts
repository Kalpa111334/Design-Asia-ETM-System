export interface Attachment {
  id?: string;
  task_id?: string;
  file_name: string;
  file_size: number;
  file_type: string;
  file_url: string;
  uploaded_by?: string;
  created_at?: string;
  updated_at?: string;
}

export interface AttachmentUploadProgress {
  file: File;
  progress: number;
  status: 'uploading' | 'completed' | 'error';
  error?: string;
}

export interface AttachmentValidation {
  isValid: boolean;
  errors: string[];
}

export const SUPPORTED_FILE_TYPES = {
  images: ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'],
  documents: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  spreadsheets: ['application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
  presentations: ['application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation'],
  archives: ['application/zip', 'application/x-rar-compressed', 'application/x-7z-compressed'],
  text: ['text/plain', 'text/csv']
};

export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
export const MAX_FILES_PER_TASK = 5;
