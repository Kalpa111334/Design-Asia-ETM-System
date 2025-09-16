import React, { useState, useRef, useCallback } from 'react';
import { 
  CloudUploadIcon, 
  DocumentIcon, 
  PhotographIcon, 
  XIcon,
  TrashIcon,
  EyeIcon,
  DownloadIcon
} from '@heroicons/react/outline';
import { Attachment, AttachmentUploadProgress, MAX_FILES_PER_TASK } from '../../types/attachment';
import { AttachmentService } from '../../services/AttachmentService';
import toast from 'react-hot-toast';

interface FileAttachmentUploaderProps {
  taskId?: string;
  attachments: Attachment[];
  onAttachmentsChange: (attachments: Attachment[]) => void;
  maxFiles?: number;
  disabled?: boolean;
}

export default function FileAttachmentUploader({
  taskId,
  attachments = [],
  onAttachmentsChange,
  maxFiles = MAX_FILES_PER_TASK,
  disabled = false
}: FileAttachmentUploaderProps) {
  const [uploadProgress, setUploadProgress] = useState<AttachmentUploadProgress[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const fileArray = Array.from(files);
    
    // Check if adding these files would exceed the limit
    if (attachments.length + fileArray.length > maxFiles) {
      toast.error(`Maximum ${maxFiles} files allowed. You can add ${maxFiles - attachments.length} more files.`);
      return;
    }

    // Validate files
    const validation = AttachmentService.validateFiles(fileArray);
    if (!validation.isValid) {
      toast.error(validation.errors.join('\n'));
      return;
    }

    // If no taskId (creating new task), just add to local state
    if (!taskId) {
      const newAttachments: Attachment[] = fileArray.map(file => ({
        file_name: file.name,
        file_size: file.size,
        file_type: file.type,
        file_url: URL.createObjectURL(file), // Temporary URL for preview
        uploaded_by: undefined
      }));
      
      onAttachmentsChange([...attachments, ...newAttachments]);
      return;
    }

    // Upload files
    const progressItems: AttachmentUploadProgress[] = fileArray.map(file => ({
      file,
      progress: 0,
      status: 'uploading'
    }));
    setUploadProgress(progressItems);

    const uploadedAttachments: Attachment[] = [];

    for (let i = 0; i < fileArray.length; i++) {
      const file = fileArray[i];
      
      try {
        const result = await AttachmentService.uploadFile(file, taskId, (progress) => {
          setUploadProgress(prev => prev.map((item, index) => 
            index === i ? { ...item, progress } : item
          ));
        });

        if (result.success && result.data) {
          uploadedAttachments.push(result.data);
          setUploadProgress(prev => prev.map((item, index) => 
            index === i ? { ...item, status: 'completed', progress: 100 } : item
          ));
        } else {
          setUploadProgress(prev => prev.map((item, index) => 
            index === i ? { ...item, status: 'error', error: result.error } : item
          ));
          toast.error(`Failed to upload ${file.name}: ${result.error}`);
        }
      } catch (error: any) {
        setUploadProgress(prev => prev.map((item, index) => 
          index === i ? { ...item, status: 'error', error: error.message } : item
        ));
        toast.error(`Failed to upload ${file.name}: ${error.message}`);
      }
    }

    // Update attachments list
    if (uploadedAttachments.length > 0) {
      onAttachmentsChange([...attachments, ...uploadedAttachments]);
    }

    // Clear upload progress after a delay
    setTimeout(() => setUploadProgress([]), 2000);
  }, [taskId, attachments, maxFiles, onAttachmentsChange]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    if (disabled) return;
    
    const files = e.dataTransfer.files;
    handleFileSelect(files);
  }, [handleFileSelect, disabled]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (!disabled) setIsDragOver(true);
  }, [disabled]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleFileSelect(e.target.files);
    // Reset input value to allow selecting the same file again
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeAttachment = async (attachment: Attachment) => {
    if (attachment.id && taskId) {
      // Delete from server
      const result = await AttachmentService.deleteAttachment(attachment.id);
      if (!result.success) {
        toast.error(`Failed to delete ${attachment.file_name}: ${result.error}`);
        return;
      }
    }
    
    // Remove from local state
    onAttachmentsChange(attachments.filter(a => a !== attachment));
    toast.success(`${attachment.file_name} removed successfully`);
  };

  const getFileIcon = (fileType: string) => {
    const category = AttachmentService.getFileTypeCategory(fileType);
    
    switch (category) {
      case 'image':
        return <PhotographIcon className="h-8 w-8 text-blue-500" />;
      case 'document':
      case 'text':
        return <DocumentIcon className="h-8 w-8 text-red-500" />;
      default:
        return <DocumentIcon className="h-8 w-8 text-gray-500" />;
    }
  };

  const canAddMoreFiles = attachments.length < maxFiles;

  return (
    <div className="space-y-4">
      {/* Upload Area */}
      <div
        className={`relative border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
          isDragOver 
            ? 'border-indigo-500 bg-indigo-50' 
            : 'border-gray-300 hover:border-gray-400'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => !disabled && fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip,.rar"
          onChange={handleFileInputChange}
          className="hidden"
          disabled={disabled}
        />
        
        <CloudUploadIcon className="mx-auto h-12 w-12 text-gray-400" />
        <div className="mt-4">
          <p className="text-sm text-gray-600">
            <span className="font-medium text-indigo-600 hover:text-indigo-500">
              Click to upload
            </span>
            {' '}or drag and drop
          </p>
          <p className="text-xs text-gray-500 mt-1">
            Photos, PDFs, documents, spreadsheets up to 10MB each
          </p>
          <p className="text-xs text-gray-500">
            Maximum {maxFiles} files ({attachments.length}/{maxFiles} used)
          </p>
        </div>
      </div>

      {/* Upload Progress */}
      {uploadProgress.length > 0 && (
        <div className="space-y-2">
          {uploadProgress.map((item, index) => (
            <div key={index} className="bg-gray-50 rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700 truncate">
                  {item.file.name}
                </span>
                <span className="text-xs text-gray-500">
                  {AttachmentService.formatFileSize(item.file.size)}
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className={`h-2 rounded-full transition-all duration-300 ${
                    item.status === 'completed' 
                      ? 'bg-green-500' 
                      : item.status === 'error' 
                      ? 'bg-red-500' 
                      : 'bg-indigo-500'
                  }`}
                  style={{ width: `${item.progress}%` }}
                />
              </div>
              {item.status === 'error' && item.error && (
                <p className="text-xs text-red-600 mt-1">{item.error}</p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Attachments List */}
      {attachments.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-gray-700">Attached Files</h4>
          <div className="space-y-2">
            {attachments.map((attachment, index) => (
              <div key={index} className="flex items-center justify-between bg-white border rounded-lg p-3">
                <div className="flex items-center space-x-3 flex-1 min-w-0">
                  {getFileIcon(attachment.file_type)}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {attachment.file_name}
                    </p>
                    <p className="text-xs text-gray-500">
                      {AttachmentService.formatFileSize(attachment.file_size)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  {attachment.file_url && (
                    <button
                      onClick={() => window.open(attachment.file_url, '_blank')}
                      className="p-1 text-gray-400 hover:text-gray-600"
                      title="View file"
                    >
                      <EyeIcon className="h-4 w-4" />
                    </button>
                  )}
                  <button
                    onClick={() => removeAttachment(attachment)}
                    className="p-1 text-gray-400 hover:text-red-600"
                    title="Remove file"
                    disabled={disabled}
                  >
                    <TrashIcon className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* File Type Info */}
      <div className="text-xs text-gray-500">
        <p className="font-medium mb-1">Supported file types:</p>
        <div className="grid grid-cols-2 gap-1">
          <div>• Images: JPG, PNG, GIF, WebP</div>
          <div>• Documents: PDF, DOC, DOCX</div>
          <div>• Spreadsheets: XLS, XLSX</div>
          <div>• Presentations: PPT, PPTX</div>
          <div>• Text: TXT, CSV</div>
          <div>• Archives: ZIP, RAR</div>
        </div>
      </div>
    </div>
  );
}
