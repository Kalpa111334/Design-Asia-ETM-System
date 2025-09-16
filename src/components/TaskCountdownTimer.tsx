import React, { useState, useEffect } from 'react';
import { Task } from '../types/index';
import { ClockIcon, PlayIcon, PauseIcon, CheckCircleIcon } from '@heroicons/react/outline';
import { TaskStatusService } from '../services/TaskStatusService';
import { AlertService } from '../services/AlertService';
import { TimeAssigningUtils } from '../utils/timeAssigning';
import TaskCompletionModal from './TaskCompletionModal';

interface TaskCountdownTimerProps {
  task: Task;
  onTaskComplete?: () => void;
  onTaskPause?: () => void;
  onTaskResume?: () => void;
}

export default function TaskCountdownTimer({ 
  task, 
  onTaskComplete, 
  onTaskPause, 
  onTaskResume 
}: TaskCountdownTimerProps) {
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [elapsedTime, setElapsedTime] = useState<number>(0);
  const [showCompletionModal, setShowCompletionModal] = useState(false);

  // Calculate time left based on task's time_assigning and current status
  useEffect(() => {
    if (!task.time_assigning) return;

    // Validate and sanitize time values
    const timeAssigning = Math.max(0, Math.min(task.time_assigning, 1440)); // Max 24 hours
    const actualTime = task.actual_time ? Math.max(0, Math.min(task.actual_time, 1440)) : 0; // Max 24 hours
    
    const totalTimeMs = timeAssigning * 60 * 1000; // Convert minutes to milliseconds
    const startTime = task.started_at ? new Date(task.started_at).getTime() : Date.now();
    const currentTime = Date.now();
    const alreadyElapsed = actualTime * 60 * 1000; // Convert minutes to ms
    const remainingTime = Math.max(0, totalTimeMs - alreadyElapsed);

    setTimeLeft(remainingTime);
    setElapsedTime(alreadyElapsed);

    // Auto-start if task is in progress and not paused
    if (task.status === 'In Progress' && !task.last_pause_at) {
      setIsRunning(true);
    } else if (task.status === 'Paused') {
      setIsPaused(true);
    }
  }, [task]);

  // Timer countdown effect
  useEffect(() => {
    let interval: NodeJS.Timeout;

    if (isRunning && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft(prev => {
          const newTime = prev - 1000;
          setElapsedTime(prev => prev + 1000);
          
          if (newTime <= 0) {
            setIsRunning(false);
            handleComplete();
            return 0;
          }
          return newTime;
        });
      }, 1000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isRunning, timeLeft, onTaskComplete]);

  const formatTime = (ms: number): string => {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (hours > 0) {
      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  const formatElapsedTime = (ms: number): string => {
    const totalMinutes = Math.floor(ms / (1000 * 60));
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  const handleStart = async () => {
    try {
      const result = await TaskStatusService.startTask(task.id);
      if (result.success) {
        setIsRunning(true);
        setIsPaused(false);
        onTaskResume?.();
        await AlertService.success('Task Started', 'Task has been started successfully!');
      } else {
        await AlertService.error('Error', result.error || 'Failed to start task');
      }
    } catch (error) {
      await AlertService.error('Error', 'Failed to start task');
    }
  };

  const handlePause = async () => {
    try {
      const result = await TaskStatusService.pauseTask(task.id);
      if (result.success) {
        setIsRunning(false);
        setIsPaused(true);
        onTaskPause?.();
        await AlertService.info('Task Paused', 'Task has been paused');
      } else {
        await AlertService.error('Error', result.error || 'Failed to pause task');
      }
    } catch (error) {
      await AlertService.error('Error', 'Failed to pause task');
    }
  };

  const handleComplete = () => {
    setShowCompletionModal(true);
  };

  const handleTaskCompletion = async (completionType: 'with_proof' | 'without_proof', proofData?: { image: string; notes: string }) => {
    try {
      let result;
      
      if (completionType === 'with_proof' && proofData) {
        result = await TaskStatusService.completeTaskWithProof(task.id, proofData.image, proofData.notes);
      } else {
        result = await TaskStatusService.completeTask(task.id);
      }

      if (result.success) {
        setIsRunning(false);
        setShowCompletionModal(false);
        onTaskComplete?.();
        await AlertService.success('Task Completed', 'Congratulations! Task has been completed successfully!');
      } else {
        await AlertService.error('Error', result.error || 'Failed to complete task');
      }
    } catch (error) {
      await AlertService.error('Error', 'Failed to complete task');
    }
  };

  const getStatusColor = () => {
    if (task.status === 'Completed') return 'bg-green-500';
    if (task.status === 'Paused') return 'bg-yellow-500';
    if (task.status === 'In Progress') return 'bg-blue-500';
    return 'bg-gray-500';
  };

  const getStatusText = () => {
    if (task.status === 'Completed') return 'Completed';
    if (task.status === 'Paused') return 'Paused';
    if (task.status === 'In Progress') return 'In Progress';
    if (task.status === 'Not Started') return 'Ready to Start';
    return 'Waiting';
  };

  const progressPercentage = task.time_assigning 
    ? Math.min(100, Math.max(0, (elapsedTime / (Math.max(1, task.time_assigning) * 60 * 1000)) * 100))
    : 0;

  return (
    <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-xl shadow-2xl p-8 text-white">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <div className="p-3 bg-white bg-opacity-20 rounded-lg">
            <ClockIcon className="h-8 w-8" />
          </div>
          <div>
            <h2 className="text-2xl font-bold">Task Timer</h2>
            <p className="text-indigo-100">{task.title}</p>
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          <div className={`w-3 h-3 rounded-full ${getStatusColor()}`}></div>
          <span className="text-sm font-medium">{getStatusText()}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        {/* Time Remaining */}
        <div className="text-center">
          <div className="text-4xl font-bold mb-2">
            {formatTime(timeLeft)}
          </div>
          <div className="text-indigo-200 text-sm">Time Remaining</div>
        </div>

        {/* Elapsed Time */}
        <div className="text-center">
          <div className="text-4xl font-bold mb-2">
            {formatElapsedTime(elapsedTime)}
          </div>
          <div className="text-indigo-200 text-sm">Elapsed Time</div>
        </div>

        {/* Total Time */}
        <div className="text-center">
          <div className="text-4xl font-bold mb-2">
            {TimeAssigningUtils.formatTimeFromMinutes(task.time_assigning || 0)}
          </div>
          <div className="text-indigo-200 text-sm">Total Time</div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="mb-6">
        <div className="flex justify-between text-sm text-indigo-200 mb-2">
          <span>Progress</span>
          <span>{Math.round(progressPercentage)}%</span>
        </div>
        <div className="w-full bg-white bg-opacity-20 rounded-full h-3">
          <div 
            className="bg-white rounded-full h-3 transition-all duration-300 ease-out"
            style={{ 
              width: `${Math.min(100, Math.max(0, progressPercentage))}%`,
              '--progress-width': `${Math.min(100, Math.max(0, progressPercentage))}%`
            } as React.CSSProperties}
          ></div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex justify-center space-x-4">
        {task.status === 'Not Started' && (
          <button
            onClick={handleStart}
            className="flex items-center space-x-2 bg-white bg-opacity-20 hover:bg-opacity-30 px-6 py-3 rounded-lg font-medium transition-all duration-200"
          >
            <PlayIcon className="h-5 w-5" />
            <span>Start Task</span>
          </button>
        )}

        {task.status === 'In Progress' && (
          <button
            onClick={handlePause}
            className="flex items-center space-x-2 bg-yellow-500 hover:bg-yellow-600 px-6 py-3 rounded-lg font-medium transition-all duration-200"
          >
            <PauseIcon className="h-5 w-5" />
            <span>Pause Task</span>
          </button>
        )}

        {task.status === 'Paused' && (
          <button
            onClick={handleStart}
            className="flex items-center space-x-2 bg-green-500 hover:bg-green-600 px-6 py-3 rounded-lg font-medium transition-all duration-200"
          >
            <PlayIcon className="h-5 w-5" />
            <span>Resume Task</span>
          </button>
        )}

        {task.status === 'Completed' && (
          <div className="flex items-center space-x-2 bg-green-500 px-6 py-3 rounded-lg font-medium">
            <CheckCircleIcon className="h-5 w-5" />
            <span>Task Completed</span>
          </div>
        )}

        {(task.status === 'In Progress' || task.status === 'Paused') && timeLeft <= 0 && (
          <button
            onClick={handleComplete}
            className="flex items-center space-x-2 bg-green-500 hover:bg-green-600 px-6 py-3 rounded-lg font-medium transition-all duration-200"
          >
            <CheckCircleIcon className="h-5 w-5" />
            <span>Complete Task</span>
          </button>
        )}
      </div>

      {/* Task Details */}
      <div className="mt-6 pt-6 border-t border-white border-opacity-20">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <div className="text-indigo-200">Priority</div>
            <div className="font-medium">{task.priority}</div>
          </div>
          <div>
            <div className="text-indigo-200">Due Date</div>
            <div className="font-medium">{new Date(task.due_date).toLocaleDateString()}</div>
          </div>
          <div>
            <div className="text-indigo-200">Start Date</div>
            <div className="font-medium">{new Date(task.start_date).toLocaleDateString()}</div>
          </div>
          <div>
            <div className="text-indigo-200">End Date</div>
            <div className="font-medium">{new Date(task.end_date).toLocaleDateString()}</div>
          </div>
        </div>
      </div>

      {/* Task Completion Modal */}
      <TaskCompletionModal
        task={task}
        isOpen={showCompletionModal}
        onClose={() => setShowCompletionModal(false)}
        onComplete={handleTaskCompletion}
      />
    </div>
  );
}
