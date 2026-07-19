/** Subscribes to live Postgres changes on `shared_activities` for one shared wheel. No-op when sharedWheelId is null. */

import { useEffect } from 'react';
import { requireSupabase } from '../services/supabase-client';
import { rowToSharedActivity } from '../services/cloud/shared-activity-service';
import type { Activity } from '../domain-logic/types';

export type SharedActivityChange =
	| { type: 'upsert'; activity: Activity }
	| { type: 'delete'; activityId: string };

interface SharedActivityRealtimeRow {
	id: string;
	wheel_id: string;
	name: string;
	weight: number;
	created_at: string;
	accept_count: number;
	reject_count: number;
	streak: number;
	last_accept_delta: number | null;
	tag_ids: string[];
}

export function useSharedWheelRealtimeSync(
	sharedWheelId: string | null,
	onChange: (change: SharedActivityChange) => void,
): void {
	useEffect(() => {
		if (!sharedWheelId) return;
		const supabase = requireSupabase();
		const channel = supabase
			.channel(`shared-activities-${sharedWheelId}`)
			.on(
				'postgres_changes',
				{
					event: '*',
					schema: 'public',
					table: 'shared_activities',
					filter: `wheel_id=eq.${sharedWheelId}`,
				},
				(payload) => {
					if (payload.eventType === 'DELETE') {
						const oldRow = payload.old as Partial<SharedActivityRealtimeRow>;
						if (oldRow.id) onChange({ type: 'delete', activityId: oldRow.id });
						return;
					}
					const activity = rowToSharedActivity(payload.new as SharedActivityRealtimeRow);
					onChange({ type: 'upsert', activity });
				},
			)
			.subscribe();

		return () => {
			void supabase.removeChannel(channel);
		};
	}, [sharedWheelId, onChange]);
}
