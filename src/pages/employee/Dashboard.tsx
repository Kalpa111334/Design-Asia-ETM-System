import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Layout from '../../components/Layout';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Task } from '../../types/index';
import { formatCurrency } from '../../utils/currency';
import MeetingRoom from '../../components/MeetingRoom';
import { MeetingSignalingService, SignalingMessage } from '../../services/MeetingSignalingService';

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
import {
	ClockIcon,
	CurrencyDollarIcon,
	CheckCircleIcon,
	ChartBarIcon,
} from '@heroicons/react/outline';
import { ResponsiveCard, ResponsiveGrid, StatCard } from '../../components/ui/ResponsiveComponents';
import { LocationService } from '../../services/LocationService';
import { TaskAutoForwardingService } from '../../services/TaskAutoForwardingService';
import { AlertService } from '../../services/AlertService';
import { calculateEffectiveDurationMs, formatDurationHMS } from '../../utils/time';
import TaskCountdownTimer from '../../components/TaskCountdownTimer';
import AttachmentDisplay from '../../components/AttachmentDisplay';
import { Attachment } from '../../types/attachment';

export default function EmployeeDashboard() {
	const { user } = useAuth();
	const location = useLocation();
	const navigate = useNavigate();
	const [stats, setStats] = useState({
		totalEarnings: 0,
		completedTasks: 0,
		activeTask: null as Task | null,
		averageCompletionTime: 0,
	});
	const [pendingTasks, setPendingTasks] = useState<Task[]>([]);
	const [allTasks, setAllTasks] = useState<Task[]>([]);
	const [loading, setLoading] = useState(true);
	const [activeElapsedMs, setActiveElapsedMs] = useState(0);
	const [incomingInvite, setIncomingInvite] = useState<SignalingMessage | null>(null);
	const [activeMeeting, setActiveMeeting] = useState<{ id: string; type: 'video' | 'audio' | 'screen' } | null>(null);
	const [showAllTasks, setShowAllTasks] = useState(false);

	useEffect(() => {
		// Show a one-time welcome toast after admin approval redirect
		if (sessionStorage.getItem('justApprovedLogin') === '1') {
			try { (window as any).toast?.success?.('Welcome! Your login was approved.'); } catch {}
			// Fallback to react-hot-toast if globally available
			try { const { toast } = require('react-hot-toast'); toast.success('Welcome! Your login was approved.'); } catch {}
			sessionStorage.removeItem('justApprovedLogin');
		}
	}, []);

	useEffect(() => {
		if (user) {
			fetchEmployeeStats();
			fetchPendingTasks();
			fetchAllTasks();
			LocationService.startTracking(user.id);

			return () => {
				LocationService.stopTracking();
			};
		}
	}, [user]);

	// Listen for meeting invites on personal channel and play ringtone
	useEffect(() => {
		if (!user) return;
		let unsubscribe: (() => void) | null = null;
		(async () => {
			unsubscribe = await MeetingSignalingService.subscribePersonal(user.id, (msg) => {
				if (msg.kind === 'invite' && msg.to === user.id) {
					setIncomingInvite(msg);
					try {
						const el = document.getElementById('meeting-invite-audio') as HTMLAudioElement | null;
						el?.play().catch(() => {});
					} catch {}
				}
				if (msg.kind === 'cancel' && activeMeeting && msg.meetingId === activeMeeting.id) {
					setActiveMeeting(null);
				}
			});
		})();
		return () => {
			try { unsubscribe && unsubscribe(); } catch {}
		};
	}, [user, activeMeeting]);

	// Auto-join meeting when redirected with query params
	useEffect(() => {
		const params = new URLSearchParams(location.search);
		const mid = params.get('meetingId');
		const type = (params.get('type') as 'video' | 'audio' | 'screen' | null);
		if (user && mid && type && !activeMeeting) {
			try { MeetingSignalingService.sendAccept(mid, user.id); } catch {}
			setActiveMeeting({ id: mid, type });
			// Clear query params
			navigate('/employee', { replace: true });
		}
	}, [location.search, user, activeMeeting, navigate]);

	// Tick active task duration every second
	useEffect(() => {
		if (!stats.activeTask) return;
		const interval = setInterval(() => {
			setActiveElapsedMs(calculateEffectiveDurationMs(stats.activeTask!));
		}, 1000);
		// Initialize immediately
		setActiveElapsedMs(calculateEffectiveDurationMs(stats.activeTask));
		return () => clearInterval(interval);
	}, [stats.activeTask]);

	const fetchEmployeeStats = async () => {
		try {
			console.log('🔍 DASHBOARD DEBUG: Fetching tasks for user:', user?.id);

			// Method 1: Try using the v_user_tasks view first
			let tasks: any[] = [];
			let error: any = null;

			try {
				const { data: viewTasks, error: viewError } = await supabase
					.from('v_user_tasks')
					.select('*, task_attachments(*)')
					.order('created_at', { ascending: false });

				if (!viewError && viewTasks && viewTasks.length > 0) {
					console.log('🔍 DASHBOARD DEBUG: Successfully fetched tasks using v_user_tasks view:', viewTasks.length);
					tasks = viewTasks;
				} else {
					throw new Error('View method failed');
				}
			} catch (viewError) {
				console.log('🔍 DASHBOARD DEBUG: View method failed, using separate queries');
				
				// Method 2: Fetch tasks assigned directly and via task_assignees
				const { data: directTasks, error: directErr } = await supabase
					.from('tasks')
					.select(`
						*,
						task_attachments(*)
					`)
					.eq('assigned_to', user?.id);

				const { data: viaAssignees, error: assigneesErr } = await supabase
					.from('task_assignees')
					.select('task:tasks(*, task_attachments(*))')
					.eq('user_id', user?.id);

				error = directErr || assigneesErr || null;
				
				if (!error) {
					const primary = directTasks || [];
					const joined = (viaAssignees || []).map((r: any) => r.task).filter(Boolean);
					const byId = new Map<string, any>();
					[...primary, ...joined].forEach((t: any) => byId.set(t.id, t));
					tasks = Array.from(byId.values());
				}
			}

			// Fallback method if primary methods fail
			if ((error || !tasks || tasks.length === 0) && user?.id) {
				console.log('🔍 DASHBOARD DEBUG: Primary methods failed, trying fallback approach');
				
				// Get all task IDs for the user
				const { data: directTasksOnly, error: directError } = await supabase
					.from('tasks')
					.select('id')
					.eq('assigned_to', user.id);

				const { data: assigneeTaskIds, error: assigneeError } = await supabase
					.from('task_assignees')
					.select('task_id')
					.eq('user_id', user.id);

				if (!directError || !assigneeError) {
					const allTaskIds = new Set<string>();
					(directTasksOnly || []).forEach(task => allTaskIds.add(task.id));
					(assigneeTaskIds || []).forEach(item => allTaskIds.add(item.task_id));

					if (allTaskIds.size > 0) {
						// Fetch full task data with attachments
						const { data: allTasksData, error: allTasksError } = await supabase
							.from('tasks')
							.select('*, task_attachments(*)')
							.in('id', Array.from(allTaskIds))
							.order('created_at', { ascending: false });

						if (!allTasksError && allTasksData) {
							tasks = allTasksData;
							error = null;
							console.log('🔍 DASHBOARD DEBUG: Fallback method found tasks:', tasks.length);
						}
					}
				}
			}

			if (error && (!tasks || tasks.length === 0)) throw error;

			if (tasks) {
				const completedTasks = tasks.filter(task => task.status === 'Completed');
				// Find active task (In Progress, Paused, or Not Started with current time between start and end dates)
				const now = new Date();
				const activeTask = tasks.find(task => {
					const startDate = new Date(task.start_date);
					const endDate = new Date(task.end_date);
					return (task.status === 'In Progress' || task.status === 'Paused' || 
							(task.status === 'Not Started' && now >= startDate && now <= endDate));
				});
				const totalEarnings = completedTasks.reduce((sum, task) => sum + (task.price || 0), 0);
				
				// Calculate average completion time
				const completionTimes = completedTasks
					.filter(task => task.started_at && task.completed_at)
					.map(task => {
						const start = new Date(task.started_at!).getTime();
						const end = new Date(task.completed_at!).getTime();
						const pauseDuration = parseIntervalToMs(task.total_pause_duration);
						return (end - start - pauseDuration) / (1000 * 60 * 60); // Convert to hours
					});
				
				const averageTime = completionTimes.length > 0
					? completionTimes.reduce((sum, time) => sum + time, 0) / completionTimes.length
					: 0;
				
			setStats({
					totalEarnings,
					completedTasks: completedTasks.length,
					activeTask,
					averageCompletionTime: Math.round(averageTime * 10) / 10,
				});
			}
		} catch (error) {
			console.error('Error fetching employee stats:', error);
		} finally {
			setLoading(false);
		}
	};

	const fetchAllTasks = async () => {
		if (!user) return;
		
		try {
            const { data: directTasks, error: directErr } = await supabase
                .from('tasks')
                .select(`
                    *,
                    task_attachments(*),
                    task_proofs(*)
                `)
                .eq('assigned_to', user.id)
                .order('created_at', { ascending: false });

            const { data: viaAssignees, error: assigneesErr } = await supabase
                .from('task_assignees')
                .select('task:tasks(*, task_attachments(*), task_proofs(*))')
                .eq('user_id', user.id);

            const error = directErr || assigneesErr || null;
            const tasks = (() => {
                const primary = directTasks || [];
                const joined = (viaAssignees || []).map((r: any) => r.task).filter(Boolean);
                const byId = new Map<string, any>();
                [...primary, ...joined].forEach((t: any) => byId.set(t.id, t));
                return Array.from(byId.values());
            })();

			if (error) throw error;
			setAllTasks(tasks || []);
		} catch (error) {
			console.error('Error fetching all tasks:', error);
		}
	};

	const fetchPendingTasks = async () => {
		if (!user) return;
		
		try {
			const { data, error } = await TaskAutoForwardingService.getPendingTasksForUser(user.id);
			if (error) throw error;
			setPendingTasks(data);
			// One-time per session info alert when there are pending tasks
			const flagKey = `pending-info-shown-${user.id}`;
			if ((data?.length || 0) > 0 && !sessionStorage.getItem(flagKey)) {
				await AlertService.info('You have pending tasks', 'Some tasks were auto-forwarded from yesterday. Please review them.');
				sessionStorage.setItem(flagKey, '1');
			}
		} catch (error) {
			console.error('Error fetching pending tasks:', error);
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

	return (
		<Layout>
			<div className="py-4 sm:py-6">
				<audio id="meeting-invite-audio" src="/ringtone.mp3" preload="auto" />
				<div className="max-w-7xl mx-auto px-2 sm:px-4 md:px-6 lg:px-8">
					<h1 className="text-xl sm:text-2xl font-semibold text-gray-900 mb-4 sm:mb-6">Welcome, {user?.full_name}</h1>

					<div className="bg-white rounded-lg shadow p-4 sm:p-6 mb-4 sm:mb-6">
						<h1 className="text-xl sm:text-2xl font-bold text-gray-800 mb-2 sm:mb-4">Welcome, {user?.full_name}</h1>
						<p className="text-sm sm:text-base text-gray-600">
							Your location is being tracked for work purposes. This helps us ensure your safety and coordinate field work effectively.
						</p>
						<div className="mt-3 sm:mt-4 p-3 sm:p-4 bg-blue-50 rounded-lg">
							<p className="text-xs sm:text-sm text-blue-800">
								📍 Location tracking is active. Your team can see your current location while you're on duty.
							</p>
						</div>
					</div>

					{/* Task Countdown Timer - Big Header Section */}
					{stats.activeTask && (
						<div className="mb-6 sm:mb-8">
							<TaskCountdownTimer 
								task={stats.activeTask}
								onTaskComplete={() => {
									// Refresh stats when task is completed
									fetchEmployeeStats();
								}}
								onTaskPause={() => {
									// Handle task pause
									fetchEmployeeStats();
								}}
								onTaskResume={() => {
									// Handle task resume
									fetchEmployeeStats();
								}}
							/>
						</div>
					)}

					{/* Incoming Meeting Invite */}
					{incomingInvite && !activeMeeting && (
						<div className="mb-4 p-3 rounded-md border bg-yellow-50">
							<div className="text-sm font-medium">Incoming {incomingInvite.payload?.type || 'meeting'} from admin</div>
							<div className="mt-2 flex gap-2">
								<button
									className="px-3 py-2 rounded-md bg-green-600 text-white text-sm"
									onClick={() => {
										// Notify admin that the employee accepted
										try { if (user) { MeetingSignalingService.sendAccept(incomingInvite.meetingId, user.id); } } catch {}
										setActiveMeeting({ id: incomingInvite.meetingId, type: incomingInvite.payload?.type || 'video' });
										setIncomingInvite(null);
									}}
								>
									Accept
								</button>
								<button className="px-3 py-2 rounded-md bg-gray-200 text-sm" onClick={() => setIncomingInvite(null)}>Decline</button>
							</div>
						</div>
					)}

					{activeMeeting && (
						<div className="mb-6">
							<MeetingRoom
								meetingId={activeMeeting.id}
								mode={activeMeeting.type}
								onLeave={() => setActiveMeeting(null)}
							/>
						</div>
					)}

					<ResponsiveGrid cols={{ default: 1, sm: 2, lg: 4 }} gap={4}>
						<StatCard
							icon={<CurrencyDollarIcon className="h-8 w-8" />}
							title="Total Earnings"
							value={formatCurrency(stats.totalEarnings)}
							color="green"
						/>
						<StatCard
							icon={<CheckCircleIcon className="h-8 w-8" />}
							title="Completed Tasks"
							value={stats.completedTasks}
							color="indigo"
						/>
						<StatCard
							icon={<ClockIcon className="h-8 w-8" />}
							title="Avg. Completion Time"
							value={`${stats.averageCompletionTime}h`
							}
							color="blue"
						/>
						<StatCard
							icon={<ChartBarIcon className="h-8 w-8" />}
							title="Current Status"
							value={stats.activeTask ? 'Active Task' : 'No Active Task'}
							color="purple"
						/>
					</ResponsiveGrid>

					{stats.activeTask && (
						<ResponsiveCard className="mt-4 sm:mt-6">
							<h2 className="text-base sm:text-lg font-medium text-gray-900 mb-3 sm:mb-4">Current Active Task</h2>
							<div className="bg-white rounded-lg border border-gray-200 p-3 sm:p-4">
								<div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3">
									<div className="flex-1">
										<h3 className="text-sm sm:text-lg font-medium text-indigo-600">{stats.activeTask.title}</h3>
										<p className="mt-1 text-xs sm:text-sm text-gray-500">{stats.activeTask.description}</p>
										<p className="mt-2 text-sm text-gray-700">Elapsed: {formatDurationHMS(activeElapsedMs)}</p>
									</div>
									<div className="text-left sm:text-right">
										<p className="text-sm font-medium text-gray-900">{formatCurrency(stats.activeTask.price)}</p>
										<p className="mt-1 text-xs sm:text-sm text-gray-500">
											Due: {new Date(stats.activeTask.due_date).toLocaleDateString()}
										</p>
									</div>
								</div>
							</div>
						</ResponsiveCard>
					)}

					{/* Pending Tasks Section */}
					{pendingTasks.length > 0 && (
						<ResponsiveCard className="mt-6">
							<h2 className="text-base sm:text-lg font-medium text-gray-900 mb-3 sm:mb-4">Pending Tasks</h2>
							<p className="text-xs sm:text-sm text-gray-600 mb-3 sm:mb-4">
								These tasks were automatically forwarded from yesterday and need your attention.
							</p>
							<div className="space-y-3">
								{pendingTasks.map((task) => (
									<div key={task.id} className="bg-orange-50 border border-orange-200 rounded-lg p-3 sm:p-4">
										<div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2">
											<div className="flex-1 min-w-0">
												<h3 className="text-sm sm:text-lg font-medium text-orange-800 truncate">{task.title}</h3>
												<p className="mt-1 text-xs sm:text-sm text-orange-600 line-clamp-2">{task.description}</p>
												<div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs sm:text-sm text-orange-600">
													<span className="flex items-center">
														<CurrencyDollarIcon className="h-4 w-4 sm:h-5 sm:w-5 mr-1" />
														{formatCurrency(task.price)}
													</span>
													<span className="flex items-center">
														<ClockIcon className="h-4 w-4 sm:h-5 sm:w-5 mr-1" />
														Due: {new Date(task.due_date).toLocaleDateString()}
													</span>
													{task.original_due_date && (
														<span className="text-[10px] sm:text-xs text-orange-500">
															Originally due: {new Date(task.original_due_date).toLocaleDateString()}
														</span>
													)}
												</div>
												{task.task_attachments && task.task_attachments.length > 0 && (
													<div className="mt-3">
														<AttachmentDisplay attachments={task.task_attachments} />
													</div>
												)}
											</div>
											<div className="sm:ml-4">
												<span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
													Pending
												</span>
											</div>
										</div>
									</div>
								))}
							</div>
						</ResponsiveCard>
					)}

					{/* View All Tasks Section */}
					<ResponsiveCard className="mt-6">
						<div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-4">
							<h2 className="text-base sm:text-lg font-medium text-gray-900">All My Tasks</h2>
							<button
								onClick={() => setShowAllTasks(!showAllTasks)}
								className="w-full sm:w-auto inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
							>
								{showAllTasks ? 'Hide Tasks' : 'View All Tasks'}
							</button>
						</div>
						
						{showAllTasks && (
							<div className="space-y-4">
								{/* Filter buttons */}
								<div className="flex flex-wrap gap-2">
									<button
										onClick={() => setShowAllTasks(false)}
										className="px-3 py-1 text-sm font-medium rounded-md bg-gray-100 text-gray-700 hover:bg-gray-200"
									>
										All Tasks ({allTasks.length})
									</button>
									<button
										onClick={() => setShowAllTasks(false)}
										className="px-3 py-1 text-sm font-medium rounded-md bg-blue-100 text-blue-700 hover:bg-blue-200"
									>
										With Proof ({allTasks.filter(t => t.completion_type === 'with_proof').length})
									</button>
									<button
										onClick={() => setShowAllTasks(false)}
										className="px-3 py-1 text-sm font-medium rounded-md bg-green-100 text-green-700 hover:bg-green-200"
									>
										Without Proof ({allTasks.filter(t => t.completion_type === 'without_proof').length})
									</button>
								</div>

								{/* Tasks list */}
								<div className="space-y-3">
									{allTasks.map((task) => (
										<div key={task.id} className="bg-white border border-gray-200 rounded-lg p-4">
											<div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3">
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <span
                                                            className={`inline-flex items-center px-3 py-1 rounded-full text-xs sm:text-sm font-semibold border
                                                                ${task.priority === 'High' ? 'bg-red-100 text-red-800 border-red-300' : ''}
                                                                ${task.priority === 'Medium' ? 'bg-yellow-100 text-yellow-800 border-yellow-300' : ''}
                                                                ${task.priority === 'Low' ? 'bg-green-100 text-green-800 border-green-300' : ''}`}
                                                        >
                                                            Priority: {task.priority}
                                                        </span>
                                                        <h3 className="text-sm sm:text-lg font-medium text-gray-900 truncate">{task.title}</h3>
                                                    </div>
													<p className="mt-1 text-xs sm:text-sm text-gray-500 line-clamp-2">{task.description}</p>
													<div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs sm:text-sm text-gray-500">
														<span className="flex items-center">
															<CurrencyDollarIcon className="h-4 w-4 mr-1" />
															{formatCurrency(task.price)}
														</span>
														<span className="flex items-center">
															<ClockIcon className="h-4 w-4 mr-1" />
															Due: {new Date(task.due_date).toLocaleDateString()}
														</span>
														{task.completion_type && (
															<span className={`px-2 py-1 rounded-full text-xs font-medium ${
																task.completion_type === 'with_proof' 
																	? 'bg-blue-100 text-blue-800' 
																	: 'bg-green-100 text-green-800'
															}`}>
																{task.completion_type === 'with_proof' ? 'With Proof' : 'Without Proof'}
															</span>
														)}
													</div>
													{task.task_attachments && task.task_attachments.length > 0 && (
														<div className="mt-3">
															<AttachmentDisplay attachments={task.task_attachments} />
														</div>
													)}
												</div>
												<div className="sm:ml-4">
													<span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
														task.status === 'Completed' 
															? 'bg-green-100 text-green-800'
															: task.status === 'In Progress'
															? 'bg-blue-100 text-blue-800'
															: task.status === 'Paused'
															? 'bg-yellow-100 text-yellow-800'
															: 'bg-gray-100 text-gray-800'
													}`}>
														{task.status}
													</span>
												</div>
											</div>
										</div>
									))}
								</div>
							</div>
						)}
					</ResponsiveCard>
				</div>
			</div>
		</Layout>
	);
} 