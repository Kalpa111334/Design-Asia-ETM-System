import React from 'react';
import { Attachment } from '../types/attachment';
import { AttachmentService } from '../services/AttachmentService';
import { 
  DocumentIcon, 
  PhotographIcon, 
  EyeIcon, 
  DownloadIcon 
} from '@heroicons/react/outline';

interface AttachmentDisplayProps {
  attachments: Attachment[];
  className?: string;
}

export default function AttachmentDisplay({ attachments, className = '' }: AttachmentDisplayProps) {
  if (!attachments || attachments.length === 0) {
    return null;
  }

  const getFileIcon = (fileType: string) => {
    const category = AttachmentService.getFileTypeCategory(fileType);
    
    switch (category) {
      case 'image':
        return <PhotographIcon className="h-5 w-5 text-blue-500" />;
      case 'document':
      case 'text':
        return <DocumentIcon className="h-5 w-5 text-red-500" />;
      default:
        return <DocumentIcon className="h-5 w-5 text-gray-500" />;
    }
  };

  return (
    <div className={`space-y-2 ${className}`}>
      <h4 className="text-sm font-medium text-gray-700 flex items-center">
        <DocumentIcon className="h-4 w-4 mr-1" />
        Attached Files ({attachments.length})
      </h4>
      <div className="space-y-2">
        {attachments.map((attachment, index) => (
          <div key={attachment.id || index} className="flex items-center justify-between bg-gray-50 border rounded-lg p-3">
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
                <>
                  <button
                    onClick={() => window.open(attachment.file_url, '_blank')}
                    className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
                    title="View file"
                  >
                    <EyeIcon className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => {
                      const link = document.createElement('a');
                      link.href = attachment.file_url;
                      link.download = attachment.file_name;
                      link.click();
                    }}
                    className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
                    title="Download file"
                  >
                    <DownloadIcon className="h-4 w-4" />
                  </button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}