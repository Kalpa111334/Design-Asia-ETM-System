import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Task } from '../../types/index';
import { Link } from 'react-router-dom';
import { PencilIcon } from '@heroicons/react/outline';
import { Link } from 'react-router-dom';
import { formatCurrency } from '../../utils/currency';
import {
  CurrencyDollarIcon,
  UserIcon,
  ClockIcon,
  CalendarIcon,
} from '@heroicons/react/outline';
import { toast } from 'react-hot-toast';

export default function TaskList() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTasks();
  }, []);

  useEffect(() => {
    const channel = supabase
      .channel('tasks-progress-admin')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, (payload: any) => {
        const newRow = payload.new || {};
        const oldRow = payload.old || {};
        // Update list on any relevant change
        setTasks(prev => {
          const exists = prev.some(t => t.id === (newRow.id || oldRow.id));
          if (!exists) return prev;
          return prev.map(t => (t.id === (newRow.id || oldRow.id) ? { ...t, ...newRow } as Task : t));
        });
      })
      .subscribe();

    return () => {
      try { supabase.removeChannel(channel); } catch {}
    };
  }, []);

  async function fetchTasks() {
    try {
      const { data, error } = await supabase.from('tasks').select('*');
      if (error) throw error;
      setTasks(data || []);
    } catch (error) {
      console.error('Error fetching tasks:', error);
      toast.error('Failed to fetch tasks');
    } finally {
      setLoading(false);
    }
  }

  const handleStatusChange = async (taskId: string, newStatus: Task['status']) => {
    try {
      const { error } = await supabase
        .from('tasks')
        .update({ status: newStatus })
        .eq('id', taskId);

      if (error) throw error;

      setTasks(prevTasks => 
        prevTasks.map(t => t.id === taskId ? { ...t, status: newStatus } : t)
      );
      toast.success(`Task status updated to ${newStatus}`);
    } catch (error) {
      console.error('Error updating task status:', error);
      toast.error('Failed to update task status');
    }
  };

  if (loading) {
    return <div>Loading tasks...</div>;
  }

  const sortedTasks = [...tasks].sort((a: any, b: any) => {
    const ap = typeof a.progress_percentage === 'number' ? a.progress_percentage : 0;
    const bp = typeof b.progress_percentage === 'number' ? b.progress_percentage : 0;
    return bp - ap;
  });

  return (
    <div className="space-y-4">
      {sortedTasks.map(task => (
        <TaskListItem
          key={task.id}
          task={task}
          onStatusChange={handleStatusChange}
        />
      ))}
    </div>
  );
}

interface TaskListItemProps {
  task: Task;
  onStatusChange: (taskId: string, newStatus: Task['status']) => void;
}

function TaskListItem({ task, onStatusChange }: TaskListItemProps) {
  const pct = Math.max(0, Math.min(100, Number((task as any).progress_percentage ?? 0)));
  const barColor = pct >= 80 ? 'bg-green-500' : pct >= 40 ? 'bg-yellow-500' : 'bg-red-500';
  return (
    <div className="flex items-center justify-between p-4 border-b">
      <div className="flex items-center">
        <span className="text-lg font-medium">{task.title}</span>
        <span className="ml-4 text-gray-500">
          <span className="text-gray-500 mr-1">LKR</span>
          {formatCurrency(task.price)}
        </span>
        {typeof (task as any).progress_percentage === 'number' && (
          <div className="ml-4 w-32" title={`${pct}%`}>
            <div className="relative w-full bg-gray-200 rounded-full h-2">
              <div
                className={`${barColor} h-2 rounded-full transition-all`}
                style={{ width: `${pct}%` }}
              />
              <span className="absolute inset-0 flex items-center justify-center text-[10px] leading-none text-white">
                {pct}%
              </span>
            </div>
          </div>
        )}
      </div>
      <div className="flex items-center space-x-2">
        <Link
          to={`/admin/tasks/${task.id}`}
          className="px-2 py-1 border border-gray-300 rounded text-gray-700 hover:bg-gray-50 flex items-center"
          title="Edit Task"
        >
          <PencilIcon className="h-4 w-4" />
        </Link>
        <button
          onClick={() => onStatusChange(task.id, task.status === 'In Progress' ? 'Paused' : 'In Progress')}
          className={`px-3 py-1 rounded ${
            task.status === 'In Progress' ? 'bg-yellow-500' : 'bg-green-500'
          } text-white`}
        >
          {task.status === 'In Progress' ? 'Pause' : 'Start'}
        </button>
      </div>
    </div>
  );
} 