import React, { useEffect, useState } from 'react';
import { TaskAutoForwardingService } from '../services/TaskAutoForwardingService';
import { useAuth } from '../contexts/AuthContext';

interface TaskAutoForwarderProps {
  onTasksForwarded?: (count: number) => void;
}

export default function TaskAutoForwarder({ onTasksForwarded }: TaskAutoForwarderProps) {
  const { user } = useAuth();
  const [lastCheck, setLastCheck] = useState<Date | null>(null);

  useEffect(() => {
    // Only run auto-forwarding for admin users
    if (!user || user.role !== 'admin') return;

    const checkAndForwardTasks = async () => {
      try {
        const result = await TaskAutoForwardingService.forwardExpectedTasks();
        if (result.success && result.forwardedCount > 0) {
          console.log(`Auto-forwarded ${result.forwardedCount} tasks to Pending status`);
          onTasksForwarded?.(result.forwardedCount);
        }
        setLastCheck(new Date());
      } catch (error) {
        console.error('Error in auto-forwarding:', error);
      }
    };

    // Run immediately on component mount
    checkAndForwardTasks();

    // Set up interval to check every hour
    const interval = setInterval(checkAndForwardTasks, 60 * 60 * 1000); // 1 hour

    return () => clearInterval(interval);
  }, [user, onTasksForwarded]);

  // This component doesn't render anything, it just runs in the background
  return null;
}
