import { supabase } from '../lib/supabase';

type Unsubscribe = () => void;

export type PostgresEvent = 'INSERT' | 'UPDATE' | 'DELETE' | '*';

export interface TableSubscriptionOptions {
	schema?: string;
	table: string;
	event?: PostgresEvent;
	filter?: string; // e.g. user_id=eq.<uuid>
}

export class RealtimeManager {
	private channels: Map<string, ReturnType<typeof supabase.channel>> = new Map();
	private subs: Map<string, Unsubscribe> = new Map();

	subscribe(
		key: string,
		options: TableSubscriptionOptions,
		handler: (payload: any) => void
	): Unsubscribe {
		this.unsubscribe(key);
		const { schema = 'public', table, event = '*', filter } = options;
		const filterDef: any = { schema, table, event };
		if (filter) (filterDef as any).filter = filter;
		const ch = supabase
			.channel(`${table}_${Date.now()}`)
			.on('postgres_changes' as const, filterDef, handler as any)
			.subscribe();

		this.channels.set(key, ch);
		const unsub = () => { try { ch.unsubscribe(); } catch {} this.channels.delete(key); this.subs.delete(key); };
		this.subs.set(key, unsub);
		return unsub;
	}

	unsubscribe(key: string) {
		const fn = this.subs.get(key);
		if (fn) { try { fn(); } catch {} }
	}

	unsubscribeAll() {
		for (const key of Array.from(this.subs.keys())) this.unsubscribe(key);
	}
}

const realtimeManager = new RealtimeManager();
export default realtimeManager;

