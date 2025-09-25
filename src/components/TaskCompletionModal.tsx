import React, { useState } from 'react';
import { Task } from '../types/index';
import { 
  CheckCircleIcon, 
  CameraIcon, 
  XIcon,
  PhotographIcon 
} from '@heroicons/react/outline';
import CameraCapture from './CameraCapture';

interface TaskCompletionModalProps {
  task: Task;
  isOpen: boolean;
  onClose: () => void;
  onComplete: (completionType: 'with_proof' | 'without_proof', proofData?: { image: string; notes: string }) => void;
}

export default function TaskCompletionModal({ 
  task, 
  isOpen, 
  onClose, 
  onComplete 
}: TaskCompletionModalProps) {
  const [showCamera, setShowCamera] = useState(false);
  const [completionNotes, setCompletionNotes] = useState('');
  const [capturedImage, setCapturedImage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleCompleteWithoutProof = () => {
    onComplete('without_proof');
    onClose();
  };

  const handleCompleteWithProof = () => {
    if (capturedImage) {
      onComplete('with_proof', { 
        image: capturedImage, 
        notes: completionNotes 
      });
      onClose();
    } else {
      setShowCamera(true);
    }
  };

  const handleImageCapture = (imageData: string) => {
    setCapturedImage(imageData);
    setShowCamera(false);
  };

  const resetForm = () => {
    setCapturedImage(null);
    setCompletionNotes('');
    setShowCamera(false);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={handleClose} />
        
        <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
          <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900">Complete Task</h3>
              <button
                onClick={handleClose}
                className="text-gray-400 hover:text-gray-600"
              >
                <XIcon className="h-6 w-6" />
              </button>
            </div>

            <div className="mb-4">
              <h4 className="text-sm font-medium text-gray-700 mb-2">{task.title}</h4>
              <p className="text-sm text-gray-500">{task.description}</p>
            </div>

            {showCamera ? (
              <div className="space-y-4">
                <h4 className="text-sm font-medium text-gray-700">Take Photo Proof</h4>
                <CameraCapture
                  onCapture={handleImageCapture}
                  onClose={() => setShowCamera(false)}
                />
              </div>
            ) : (
              <div className="space-y-4">
                {/* Completion Options */}
                <div className="space-y-3">
                  <button
                    onClick={handleCompleteWithProof}
                    className="w-full flex items-center justify-center px-4 py-3 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  >
                    <CameraIcon className="h-5 w-5 mr-2" />
                    Complete with Proof
                  </button>

                  <button
                    onClick={handleCompleteWithoutProof}
                    className="w-full flex items-center justify-center px-4 py-3 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                  >
                    <CheckCircleIcon className="h-5 w-5 mr-2" />
                    Complete without Proof
                  </button>
                </div>

                {/* Captured Image Preview */}
                {capturedImage && (
                  <div className="space-y-3">
                    <h4 className="text-sm font-medium text-gray-700">Proof Photo</h4>
                    <div className="relative">
                      <img
                        src={capturedImage}
                        alt="Task proof"
                        className="w-full h-48 object-cover rounded-lg border"
                      />
                      <button
                        onClick={() => setCapturedImage(null)}
                        className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                      >
                        <XIcon className="h-4 w-4" />
                      </button>
                    </div>
                    
                    <div>
                      <label htmlFor="completion-notes" className="block text-sm font-medium text-gray-700 mb-1">
                        Completion Notes (Optional)
                      </label>
                      <textarea
                        id="completion-notes"
                        rows={3}
                        value={completionNotes}
                        onChange={(e) => setCompletionNotes(e.target.value)}
                        className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                        placeholder="Add any notes about the task completion..."
                      />
                    </div>

                    <button
                      onClick={() => onComplete('with_proof', { 
                        image: capturedImage, 
                        notes: completionNotes 
                      })}
                      className="w-full flex items-center justify-center px-4 py-3 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                    >
                      <CheckCircleIcon className="h-5 w-5 mr-2" />
                      Submit with Proof
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
