import { supabase } from '../lib/supabase';

type Unsubscribe = () => void;

interface TaskSubscriptions {
	channels: ReturnType<typeof supabase.channel>[];
	unsubscribes: Unsubscribe[];
}

/**
 * RealTimeTaskService
 * Centralized realtime subscriptions for tasks and related tables.
 */
export class RealTimeTaskService {
	private static active: Map<string, TaskSubscriptions> = new Map();

	static subscribeAdminTasks(
		key: string,
		onChange: (payload: any) => void
	): Unsubscribe {
		this.unsubscribe(key);

		const ch = supabase
			.channel(`admin_tasks_${Date.now()}`)
			.on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, onChange)
			.subscribe();

		this.active.set(key, { channels: [ch], unsubscribes: [() => { try { ch.unsubscribe(); } catch {} }] });
		return () => this.unsubscribe(key);
	}

	static subscribeEmployeeTasks(
		key: string,
		userId: string,
		onChange: (payload: any) => void,
		onAssigneeChange?: (payload: any) => void
	): Unsubscribe {
		this.unsubscribe(key);

		const channels: ReturnType<typeof supabase.channel>[] = [];
		const unsubs: Unsubscribe[] = [];

		// Tasks where assigned_to = user
		const tasksCh = supabase
			.channel(`user_tasks_${userId}_${Date.now()}`)
			.on(
				'postgres_changes',
				{ event: '*', schema: 'public', table: 'tasks', filter: `assigned_to=eq.${userId}` },
				onChange
			)
			.subscribe();
		channels.push(tasksCh);
		unsubs.push(() => { try { tasksCh.unsubscribe(); } catch {} });

		// Task assignees rows for this user — any change should refresh
		const assigneesCh = supabase
			.channel(`user_task_assignees_${userId}_${Date.now()}`)
			.on(
				'postgres_changes',
				{ event: '*', schema: 'public', table: 'task_assignees', filter: `user_id=eq.${userId}` },
				(payload) => {
					onAssigneeChange?.(payload);
					onChange(payload);
				}
			)
			.subscribe();
		channels.push(assigneesCh);
		unsubs.push(() => { try { assigneesCh.unsubscribe(); } catch {} });

		this.active.set(key, { channels, unsubscribes: unsubs });
		return () => this.unsubscribe(key);
	}

	static subscribeTaskRelatedForAdmin(
		key: string,
		onAnyChange: (payload: any) => void
	): Unsubscribe {
		this.unsubscribe(key);

		const tables = ['task_attachments', 'task_assignees', 'task_proofs', 'time_logs', 'task_locations'];
		const channels: ReturnType<typeof supabase.channel>[] = [];
		const unsubs: Unsubscribe[] = [];

		for (const table of tables) {
			const ch = supabase
				.channel(`admin_${table}_${Date.now()}`)
				.on('postgres_changes', { event: '*', schema: 'public', table }, onAnyChange)
				.subscribe();
			channels.push(ch);
			unsubs.push(() => { try { ch.unsubscribe(); } catch {} });
		}

		this.active.set(key, { channels, unsubscribes: unsubs });
		return () => this.unsubscribe(key);
	}

	// Generic helper to subscribe to a table with optional filter
	private static subscribeTable(
		key: string,
		table: string,
		onChange: (payload: any) => void,
		filter?: string
	): Unsubscribe {
		this.unsubscribe(key);
		const ch = supabase
			.channel(`${table}_${Date.now()}`)
			.on('postgres_changes', { event: '*', schema: 'public', table, ...(filter ? { filter } : {}) } as any, onChange)
			.subscribe();
		this.active.set(key, { channels: [ch], unsubscribes: [() => { try { ch.unsubscribe(); } catch {} }] });
		return () => this.unsubscribe(key);
	}

	// Subscribe to login_pins (admin side). Optional status filter.
	static subscribeLoginPinsAdmin(
		key: string,
		onChange: (payload: any) => void,
		status?: 'pending' | 'approved' | 'rejected' | 'expired'
	): Unsubscribe {
		const filter = status ? `status=eq.${status}` : undefined;
		return this.subscribeTable(key, 'login_pins', onChange, filter);
	}

	// Subscribe to jobs table (admin). Optional status filter.
	static subscribeJobsAdmin(
		key: string,
		onChange: (payload: any) => void,
		status?: 'active' | 'completed' | 'on_hold' | 'cancelled'
	): Unsubscribe {
		const filter = status ? `status=eq.${status}` : undefined;
		return this.subscribeTable(key, 'jobs', onChange, filter);
	}

	// Subscribe to employee_locations (admin) optionally by user_id
	static subscribeEmployeeLocationsAdmin(
		key: string,
		onChange: (payload: any) => void,
		userId?: string
	): Unsubscribe {
		const filter = userId ? `user_id=eq.${userId}` : undefined;
		return this.subscribeTable(key, 'employee_locations', onChange, filter);
	}

	static unsubscribe(key: string) {
		const existing = this.active.get(key);
		if (!existing) return;
		for (const fn of existing.unsubscribes) {
			try { fn(); } catch {}
		}
		this.active.delete(key);
	}
}

export default RealTimeTaskService;

