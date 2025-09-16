import { Task } from '../types/index';

// Helper function to parse interval string to milliseconds
function parseIntervalToMs(intervalStr: string | number | null | undefined): number {
  if (!intervalStr) return 0;
  if (typeof intervalStr === 'number') return intervalStr; // Handle legacy number format
  if (typeof intervalStr === 'string') {
    // Parse PostgreSQL interval format like "123 seconds" or "1:23:45"
    const match = intervalStr.match(/(\d+)\s*seconds?/);
    if (match) return parseInt(match[1]) * 1000;
    
    // Handle HH:MM:SS format
    const timeMatch = intervalStr.match(/(\d+):(\d+):(\d+)/);
    if (timeMatch) {
      const hours = parseInt(timeMatch[1]);
      const minutes = parseInt(timeMatch[2]);
      const seconds = parseInt(timeMatch[3]);
      return (hours * 3600 + minutes * 60 + seconds) * 1000;
    }
  }
  return 0;
}

export function calculateEffectiveDurationMs(task: Pick<Task, 'status' | 'started_at' | 'completed_at' | 'total_pause_duration' | 'last_pause_at'>, nowDate: Date = new Date()): number {
	if (!task.started_at) return 0;
	const start = new Date(task.started_at).getTime();
	const end = task.completed_at ? new Date(task.completed_at).getTime() : nowDate.getTime();
	let paused = parseIntervalToMs(task.total_pause_duration);
	if (task.status === 'Paused' && task.last_pause_at) {
		paused += Math.max(0, end - new Date(task.last_pause_at).getTime());
	}
	return Math.max(0, end - start - paused);
}

export function formatDuration(ms: number): string {
	const totalSeconds = Math.floor(ms / 1000);
	const hours = Math.floor(totalSeconds / 3600);
	const minutes = Math.floor((totalSeconds % 3600) / 60);
	const seconds = totalSeconds % 60;
	if (hours > 0) {
		return `${hours}h ${minutes}m`;
	}
	if (minutes > 0) {
		return `${minutes}m ${seconds}s`;
	}
	return `${seconds}s`;
}

export function formatDurationHMS(ms: number): string {
	const totalSeconds = Math.floor(ms / 1000);
	const hours = Math.floor(totalSeconds / 3600).toString().padStart(2, '0');
	const minutes = Math.floor((totalSeconds % 3600) / 60).toString().padStart(2, '0');
	const seconds = (totalSeconds % 60).toString().padStart(2, '0');
	return `${hours}:${minutes}:${seconds}`;
}
