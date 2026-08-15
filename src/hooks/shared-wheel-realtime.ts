/** Subscribes to live Postgres changes on `shared_activities` for one shared wheel. No-op when sharedWheelID is null. */

import { useEffect } from 'react';
import { requireSupabase } from '../services/supabase-client';
import { rowToSharedActivity, type SharedActivityRow } from '../services/cloud/shared-activity-service';
import type { Activity } from '../domain-logic/types';

export type SharedActivityChange =
	| { type: 'upsert'; activity: Activity }
	| { type: 'delete'; activityID: string };

export function useSharedWheelRealtimeSync(
	sharedWheelID: string | null,
	onChange: (change: SharedActivityChange) => void,
): void {
	useEffect(() => {
		if (!sharedWheelID) return;
		const supabase = requireSupabase();
		const channel = supabase
			.channel(`shared-activities-${sharedWheelID}`)
			.on(
				'postgres_changes',
				{
					event: '*',
					schema: 'public',
					table: 'shared_activities',
					filter: `wheel_id=eq.${sharedWheelID}`,
				},
				(payload) => {
					if (payload.eventType === 'DELETE') {
						const oldRow = payload.old as Partial<SharedActivityRow>;
						if (oldRow.id) onChange({ type: 'delete', activityID: oldRow.id });
						return;
					}
					const activity = rowToSharedActivity(payload.new as SharedActivityRow);
					onChange({ type: 'upsert', activity });
				},
			)
			.subscribe();

		return () => {
			void supabase.removeChannel(channel);
		};
	}, [sharedWheelID, onChange]);
}
