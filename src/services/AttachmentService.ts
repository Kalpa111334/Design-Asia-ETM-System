import { supabase } from '../lib/supabase';
import { Attachment, AttachmentValidation, MAX_FILE_SIZE, MAX_FILES_PER_TASK, SUPPORTED_FILE_TYPES } from '../types/attachment';

export class AttachmentService {
  /**
   * Validate a file before upload
   */
  static validateFile(file: File): AttachmentValidation {
    const errors: string[] = [];

    // Check file size
    if (file.size > MAX_FILE_SIZE) {
      errors.push(`File size must be less than ${MAX_FILE_SIZE / (1024 * 1024)}MB`);
    }

    // Check file type
    const allSupportedTypes = Object.values(SUPPORTED_FILE_TYPES).flat();
    if (!allSupportedTypes.includes(file.type)) {
      errors.push(`File type ${file.type} is not supported`);
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate multiple files
   */
  static validateFiles(files: File[]): AttachmentValidation {
    const errors: string[] = [];

    if (files.length > MAX_FILES_PER_TASK) {
      errors.push(`Maximum ${MAX_FILES_PER_TASK} files allowed per task`);
    }

    files.forEach((file, index) => {
      const fileValidation = this.validateFile(file);
      if (!fileValidation.isValid) {
        errors.push(`File ${index + 1} (${file.name}): ${fileValidation.errors.join(', ')}`);
      }
    });

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Upload a file to Supabase Storage
   */
  static async uploadFile(
    file: File, 
    taskId: string, 
    onProgress?: (progress: number) => void
  ): Promise<{ success: boolean; data?: Attachment; error?: string }> {
    try {
      // Validate file first
      const validation = this.validateFile(file);
      if (!validation.isValid) {
        return { success: false, error: validation.errors.join(', ') };
      }

      // Generate unique filename
      const fileExt = file.name.split('.').pop();
      const fileName = `${taskId}/${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;

      // Upload to Supabase Storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('task-attachments')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) {
        console.error('Upload error:', uploadError);
        return { success: false, error: uploadError.message };
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('task-attachments')
        .getPublicUrl(fileName);

      // Create attachment record in database
      const attachmentData: Omit<Attachment, 'id' | 'created_at' | 'updated_at'> = {
        task_id: taskId,
        file_name: file.name,
        file_size: file.size,
        file_type: file.type,
        file_url: urlData.publicUrl,
        uploaded_by: (await supabase.auth.getUser()).data.user?.id
      };

      const { data: attachment, error: dbError } = await supabase
        .from('task_attachments')
        .insert([attachmentData])
        .select()
        .single();

      if (dbError) {
        console.error('Database error:', dbError);
        return { success: false, error: dbError.message };
      }

      return { success: true, data: attachment };
    } catch (error: any) {
      console.error('Upload error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get attachments for a task
   */
  static async getTaskAttachments(taskId: string): Promise<{ success: boolean; data?: Attachment[]; error?: string }> {
    try {
      const { data, error } = await supabase
        .from('task_attachments')
        .select('*')
        .eq('task_id', taskId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching attachments:', error);
        return { success: false, error: error.message };
      }

      return { success: true, data: data || [] };
    } catch (error: any) {
      console.error('Error fetching attachments:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Delete an attachment
   */
  static async deleteAttachment(attachmentId: string): Promise<{ success: boolean; error?: string }> {
    try {
      // Get attachment info first
      const { data: attachment, error: fetchError } = await supabase
        .from('task_attachments')
        .select('*')
        .eq('id', attachmentId)
        .single();

      if (fetchError) {
        console.error('Error fetching attachment:', fetchError);
        return { success: false, error: fetchError.message };
      }

      // Delete from storage
      const fileName = attachment.file_url.split('/').pop();
      if (fileName) {
        const { error: storageError } = await supabase.storage
          .from('task-attachments')
          .remove([`${attachment.task_id}/${fileName}`]);

        if (storageError) {
          console.error('Storage deletion error:', storageError);
          // Continue with database deletion even if storage deletion fails
        }
      }

      // Delete from database
      const { error: dbError } = await supabase
        .from('task_attachments')
        .delete()
        .eq('id', attachmentId);

      if (dbError) {
        console.error('Database deletion error:', dbError);
        return { success: false, error: dbError.message };
      }

      return { success: true };
    } catch (error: any) {
      console.error('Error deleting attachment:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get file type category
   */
  static getFileTypeCategory(fileType: string): 'image' | 'document' | 'spreadsheet' | 'presentation' | 'archive' | 'text' | 'other' {
    if (SUPPORTED_FILE_TYPES.images.includes(fileType)) return 'image';
    if (SUPPORTED_FILE_TYPES.documents.includes(fileType)) return 'document';
    if (SUPPORTED_FILE_TYPES.spreadsheets.includes(fileType)) return 'spreadsheet';
    if (SUPPORTED_FILE_TYPES.presentations.includes(fileType)) return 'presentation';
    if (SUPPORTED_FILE_TYPES.archives.includes(fileType)) return 'archive';
    if (SUPPORTED_FILE_TYPES.text.includes(fileType)) return 'text';
    return 'other';
  }

  /**
   * Format file size for display
   */
  static formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}
