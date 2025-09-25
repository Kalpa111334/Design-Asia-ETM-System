import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Layout from '../../components/Layout';
import EnhancedTaskForm from '../../components/admin/EnhancedTaskForm';
import TaskProofView from '../../components/TaskProofView';
import { supabase } from '../../lib/supabase';
import { Task, User, TaskProof } from '../../types/index';
import { ArrowLeftIcon } from '@heroicons/react/outline';
import toast from 'react-hot-toast';
import { formatCurrency } from '../../utils/currency';

export default function TaskView() {
  const { taskId } = useParams<{ taskId: string }>();
  const navigate = useNavigate();
  const [task, setTask] = useState<Task | null>(null);
  const [assignedUser, setAssignedUser] = useState<User | null>(null);
  const [proofs, setProofs] = useState<TaskProof[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (taskId) {
      fetchTaskDetails();
    }
  }, [taskId]);

  useEffect(() => {
    if (!taskId) return;
    const channel = supabase
      .channel(`task-view-${taskId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks', filter: `id=eq.${taskId}` }, (payload: any) => {
        const newRow = payload.new || {};
        setTask(prev => (prev ? { ...prev, ...newRow } as Task : newRow));
      })
      .subscribe();

    return () => {
      try { supabase.removeChannel(channel); } catch {}
    };
  }, [taskId]);

  async function fetchTaskDetails() {
    try {
      // Fetch task details
      const { data: taskData, error: taskError } = await supabase
        .from('tasks')
        .select('*')
        .eq('id', taskId)
        .single();

      if (taskError) throw taskError;
      setTask(taskData);

      if (taskData.assigned_to) {
        // Fetch assigned user details
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('*')
          .eq('id', taskData.assigned_to)
          .single();

        if (userError) throw userError;
        setAssignedUser(userData);
      }

      // Fetch task proofs
      const { data: proofsData, error: proofsError } = await supabase
        .from('task_proofs')
        .select('*')
        .eq('task_id', taskId)
        .order('created_at', { ascending: false });

      if (proofsError) throw proofsError;
      setProofs(proofsData || []);
    } catch (error) {
      console.error('Error fetching task details:', error);
      toast.error('Failed to fetch task details');
    } finally {
      setLoading(false);
    }
  }
  async function handleUpdateTask(formData: any) {
    try {
      if (!task) return;
      setLoading(true);

      const updates: any = {
        title: formData.title,
        description: formData.description,
        priority: formData.priority,
        assigned_to: formData.assigned_to,
        due_date: formData.due_date,
        price: formData.price,
        status: formData.status,
        time_assigning: formData.time_assigning,
        estimated_time: formData.estimated_time,
        progress_percentage: formData.progress_percentage,
        completion_type: formData.completion_type,
        updated_at: new Date().toISOString()
      };

      const { error } = await supabase
        .from('tasks')
        .update(updates)
        .eq('id', task.id);

      if (error) throw error;

      toast.success('Task updated successfully');
      setEditing(false);
      await fetchTaskDetails();
    } catch (error) {
      console.error('Error updating task:', error);
      toast.error('Failed to update task');
    } finally {
      setLoading(false);
    }
  }



  const handleApproveProof = async (proofId: string) => {
    try {
      const { error } = await supabase
        .from('task_proofs')
        .update({
          status: 'Approved',
          reviewed_by: (await supabase.auth.getUser()).data.user?.id,
          reviewed_at: new Date().toISOString()
        })
        .eq('id', proofId);

      if (error) throw error;

      toast.success('Proof approved successfully');
      fetchTaskDetails(); // Refresh the data
    } catch (error) {
      console.error('Error approving proof:', error);
      toast.error('Failed to approve proof');
    }
  };

  const handleRejectProof = async (proofId: string) => {
    try {
      const rejectionReason = prompt('Please provide a reason for rejection:');
      if (!rejectionReason) return;

      const { error } = await supabase
        .from('task_proofs')
        .update({
          status: 'Rejected',
          reviewed_by: (await supabase.auth.getUser()).data.user?.id,
          reviewed_at: new Date().toISOString(),
          rejection_reason: rejectionReason
        })
        .eq('id', proofId);

      if (error) throw error;

      toast.success('Proof rejected successfully');
      fetchTaskDetails(); // Refresh the data
    } catch (error) {
      console.error('Error rejecting proof:', error);
      toast.error('Failed to reject proof');
    }
  };

  const handleRequestReassign = async () => {
    try {
      if (!task) return;
      const { error } = await supabase
        .from('tasks')
        .update({ status: 'Not Started', updated_at: new Date().toISOString() })
        .eq('id', task.id);

      if (error) throw error;

      toast.success('Reassign request sent to employee');
      fetchTaskDetails();
    } catch (error) {
      console.error('Error requesting reassignment:', error);
      toast.error('Failed to request reassignment');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Not Started':
        return 'bg-gray-100 text-gray-800';
      case 'In Progress':
        return 'bg-blue-100 text-blue-800';
      case 'Paused':
        return 'bg-yellow-100 text-yellow-800';
      case 'Completed':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-pink-500"></div>
        </div>
      </Layout>
    );
  }

  if (!task) {
    return (
      <Layout>
        <div className="text-center py-12">
          <p className="text-gray-500">Task not found</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-2 sm:px-4 md:px-6 lg:px-8">
        <div className="mb-4 sm:mb-6">
          <button
            onClick={() => navigate('/admin/tasks')}
            className="inline-flex items-center text-gray-600 hover:text-gray-900 touch-manipulation transform active:scale-95 transition-transform"
          >
            <ArrowLeftIcon className="h-5 w-5 mr-2" />
            Back to Tasks
          </button>
        </div>

        <div className="bg-white shadow overflow-hidden sm:rounded-lg">
          <div className="px-4 py-5 sm:px-6">
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 justify-between items-start sm:items-center">
              <h3 className="text-lg leading-6 font-medium text-gray-900">
                Task Details
              </h3>
              <span
                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(
                  task.status
                )}`}
              >
                {task.status}
              </span>
            </div>
          </div>
          <div className="border-t border-gray-200 px-4 py-5 sm:px-6">
            <div className="flex justify-end mb-4">
              {!editing ? (
                <button
                  onClick={() => setEditing(true)}
                  className="inline-flex items-center px-3 py-1.5 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  Edit Task
                </button>
              ) : (
                <button
                  onClick={() => setEditing(false)}
                  className="inline-flex items-center px-3 py-1.5 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-300"
                >
                  Cancel
                </button>
              )}
            </div>

            {editing ? (
              <div className="mt-2">
                <EnhancedTaskForm
                  isEdit
                  initialData={{
                    ...task,
                    progress_percentage: (task as any).progress_percentage,
                  }}
                  onSubmit={handleUpdateTask}
                />
              </div>
            ) : (
            <dl className="grid grid-cols-1 gap-x-4 gap-y-8 sm:grid-cols-2">
              <div className="sm:col-span-1">
                <dt className="text-sm font-medium text-gray-500">Title</dt>
                <dd className="mt-1 text-sm text-gray-900">{task.title}</dd>
              </div>
              <div className="sm:col-span-1">
                <dt className="text-sm font-medium text-gray-500">Assigned To</dt>
                <dd className="mt-1 text-sm text-gray-900">
                  {assignedUser?.full_name || 'Unassigned'}
                </dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-sm font-medium text-gray-500">Description</dt>
                <dd className="mt-1 text-sm text-gray-900">{task.description}</dd>
              </div>
              <div className="sm:col-span-1">
                <dt className="text-sm font-medium text-gray-500">Due Date</dt>
                <dd className="mt-1 text-sm text-gray-900">
                  {new Date(task.due_date).toLocaleDateString()}
                </dd>
              </div>
              <div className="sm:col-span-1">
                <dt className="text-sm font-medium text-gray-500">Price</dt>
                <dd className="mt-1 text-sm text-gray-900">
                  {formatCurrency(task.price)}
                </dd>
              </div>
            </dl>
            )}
          </div>
        </div>


        <TaskProofView
          proofs={proofs}
          onApprove={handleApproveProof}
          onReject={handleRejectProof}
        />

        {proofs.some(p => p.status === 'Rejected') && (
          <div className="mt-4">
            <button
              onClick={handleRequestReassign}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              Request Re-Assignment
            </button>
          </div>
        )}
      </div>
    </Layout>
  );
} 