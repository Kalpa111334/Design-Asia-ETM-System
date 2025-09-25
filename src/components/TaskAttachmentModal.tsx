import React from 'react';
import { XIcon } from '@heroicons/react/outline';
import AttachmentDisplay from './AttachmentDisplay';
import { Attachment } from '../types/attachment';

interface TaskAttachmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  task: {
    id: string;
    title: string;
    task_attachments?: Attachment[];
  } | null;
}

export default function TaskAttachmentModal({ isOpen, onClose, task }: TaskAttachmentModalProps) {
  if (!isOpen || !task) return null;

  const attachments = task.task_attachments || [];
  
  // Debug logging
  console.log('🔍 TaskAttachmentModal - Task:', task);
  console.log('🔍 TaskAttachmentModal - Attachments:', attachments);
  console.log('🔍 TaskAttachmentModal - Attachment count:', attachments.length);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Task Attachments</h2>
            <p className="text-sm text-gray-600 mt-1">{task.title}</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Close modal"
          >
            <XIcon className="h-6 w-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
          {attachments.length > 0 ? (
            <AttachmentDisplay attachments={attachments} />
          ) : (
            <div className="text-center py-8">
              <div className="mx-auto w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Attachments</h3>
              <p className="text-gray-500">This task doesn't have any attachments yet.</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end p-6 border-t border-gray-200">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
