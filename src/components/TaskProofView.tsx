import React, { useState } from 'react';
import { TaskProof } from '../types/index';
import { 
  EyeIcon, 
  CheckCircleIcon, 
  XCircleIcon,
  ClockIcon,
  UserIcon
} from '@heroicons/react/outline';

interface TaskProofViewProps {
  proofs: TaskProof[];
  onApprove?: (proofId: string) => void;
  onReject?: (proofId: string) => void;
  className?: string;
}

export default function TaskProofView({ 
  proofs, 
  onApprove, 
  onReject, 
  className = '' 
}: TaskProofViewProps) {
  const [selectedProof, setSelectedProof] = useState<TaskProof | null>(null);

  if (!proofs || proofs.length === 0) {
    return null;
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Approved':
        return 'bg-green-100 text-green-800';
      case 'Rejected':
        return 'bg-red-100 text-red-800';
      case 'Pending':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'Approved':
        return <CheckCircleIcon className="h-4 w-4 text-green-600" />;
      case 'Rejected':
        return <XCircleIcon className="h-4 w-4 text-red-600" />;
      case 'Pending':
        return <ClockIcon className="h-4 w-4 text-yellow-600" />;
      default:
        return <ClockIcon className="h-4 w-4 text-gray-600" />;
    }
  };

  return (
    <div className={`space-y-3 ${className}`}>
      <h4 className="text-sm font-medium text-gray-700 flex items-center">
        <EyeIcon className="h-4 w-4 mr-1" />
        Task Proofs ({proofs.length})
      </h4>
      
      <div className="space-y-2">
        {proofs.map((proof) => (
          <div key={proof.id} className="bg-white border border-gray-200 rounded-lg p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2">
                  {getStatusIcon(proof.status)}
                  <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(proof.status)}`}>
                    {proof.status}
                  </span>
                  <span className="text-xs text-gray-500">
                    {new Date(proof.created_at).toLocaleDateString()}
                  </span>
                </div>
                
                {proof.description && (
                  <p className="text-sm text-gray-600 mb-2">{proof.description}</p>
                )}
                
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <UserIcon className="h-3 w-3" />
                  <span>Submitted by: {proof.submitted_by}</span>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setSelectedProof(proof)}
                  className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
                  title="View proof"
                >
                  <EyeIcon className="h-4 w-4" />
                </button>
                
                {proof.status === 'Pending' && onApprove && onReject && (
                  <>
                    <button
                      onClick={() => onApprove(proof.id)}
                      className="p-1 text-green-400 hover:text-green-600 transition-colors"
                      title="Approve proof"
                    >
                      <CheckCircleIcon className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => onReject(proof.id)}
                      className="p-1 text-red-400 hover:text-red-600 transition-colors"
                      title="Reject proof"
                    >
                      <XCircleIcon className="h-4 w-4" />
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Proof Image Modal */}
      {selectedProof && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={() => setSelectedProof(null)} />
            
            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-medium text-gray-900">Task Proof</h3>
                  <button
                    onClick={() => setSelectedProof(null)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <XCircleIcon className="h-6 w-6" />
                  </button>
                </div>
                
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    {getStatusIcon(selectedProof.status)}
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(selectedProof.status)}`}>
                      {selectedProof.status}
                    </span>
                    <span className="text-sm text-gray-500">
                      {new Date(selectedProof.created_at).toLocaleString()}
                    </span>
                  </div>
                  
                  {selectedProof.description && (
                    <div>
                      <h4 className="text-sm font-medium text-gray-700 mb-1">Description</h4>
                      <p className="text-sm text-gray-600">{selectedProof.description}</p>
                    </div>
                  )}
                  
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 mb-2">Proof Image</h4>
                    <img
                      src={selectedProof.image_url}
                      alt="Task proof"
                      className="w-full h-64 object-cover rounded-lg border"
                    />
                  </div>
                  
                  {selectedProof.status === 'Pending' && onApprove && onReject && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          onApprove(selectedProof.id);
                          setSelectedProof(null);
                        }}
                        className="flex-1 inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                      >
                        <CheckCircleIcon className="h-4 w-4 mr-2" />
                        Approve
                      </button>
                      <button
                        onClick={() => {
                          onReject(selectedProof.id);
                          setSelectedProof(null);
                        }}
                        className="flex-1 inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                      >
                        <XCircleIcon className="h-4 w-4 mr-2" />
                        Reject
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}