import React, { useEffect } from 'react';
import { TaskStatusService } from '../services/TaskStatusService';

interface TaskStatusUpdaterProps {
  intervalMs?: number;
  onStatusUpdate?: (updatedCount: number) => void;
  onTimeCompletion?: (completedCount: number) => void;
}

export default function TaskStatusUpdater({ 
  intervalMs = 60000, // Default 1 minute
  onStatusUpdate,
  onTimeCompletion 
}: TaskStatusUpdaterProps) {
  useEffect(() => {
    const updateTaskStatuses = async () => {
      try {
        // Update all task statuses based on dates
        const statusResult = await TaskStatusService.updateAllTaskStatuses();
        if (statusResult.success && statusResult.updatedCount > 0) {
          onStatusUpdate?.(statusResult.updatedCount);
        }

        // Update tasks based on time completion
        const timeResult = await TaskStatusService.updateTasksByTimeCompletion();
        if (timeResult.success && timeResult.completedCount > 0) {
          onTimeCompletion?.(timeResult.completedCount);
        }
      } catch (error) {
        console.error('Error in task status updater:', error);
      }
    };

    // Run immediately
    updateTaskStatuses();

    // Set up interval
    const interval = setInterval(updateTaskStatuses, intervalMs);

    return () => clearInterval(interval);
  }, [intervalMs, onStatusUpdate, onTimeCompletion]);

  return null; // This component doesn't render anything
}


























