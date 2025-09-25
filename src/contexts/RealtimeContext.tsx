import React, { createContext, useContext, useMemo } from 'react';
import realtimeManager, { RealtimeManager, TableSubscriptionOptions } from '../services/RealtimeManager';

type Unsubscribe = () => void;

interface RealtimeContextValue {
	manager: RealtimeManager;
	subscribe: (key: string, opts: TableSubscriptionOptions, handler: (payload: any) => void) => Unsubscribe;
	unsubscribe: (key: string) => void;
	unsubscribeAll: () => void;
}

const RealtimeContext = createContext<RealtimeContextValue | null>(null);

export function RealtimeProvider({ children }: { children: React.ReactNode }) {
	const value = useMemo<RealtimeContextValue>(() => ({
		manager: realtimeManager,
		subscribe: (key, opts, handler) => realtimeManager.subscribe(key, opts, handler),
		unsubscribe: (key) => realtimeManager.unsubscribe(key),
		unsubscribeAll: () => realtimeManager.unsubscribeAll(),
	}), []);

	return (
		<RealtimeContext.Provider value={value}>
			{children}
		</RealtimeContext.Provider>
	);
}

export function useRealtime() {
	const ctx = useContext(RealtimeContext);
	if (!ctx) throw new Error('useRealtime must be used within RealtimeProvider');
	return ctx;
}


