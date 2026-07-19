/**
 * Tiny CLI-ish simulator for the weight system. Lets you sanity-check that the model behaves the way you'd expect over many feedback rounds.
 * Not bundled into production builds (Vite tree-shakes unimported modules). To use, open the dev console and run:
 * const sim = await import('./src/dev/weightSim.ts'); sim.runSim();
 * You can also pass custom options: sim.runSim({ count: 10, days: 60, spinsPerDay: 6 }) 
 */

import { applyFeedback } from '../domain-logic/weight-logic/weight-feedback-response-logic';
import { MILLISECONDS_PER_DAY } from '../domain-logic/weight-logic/recency-boost-logic';
import { getEffectiveWeight } from '../domain-logic/weight-logic/effective-weight-logic';
import { newActivity } from '../domain-logic/activity-logic/activity-factory';
import { pickFromWeightedPool } from '../domain-logic/weighted-selection-logic';
import { makeRng } from '../utils/random-utils';
import type { Activity, FeedbackAction } from '../domain-logic/types';

interface SimRow {
	name: string;
	finalWeight: number;
	finalEffective: number;
	accepts: number;
	rejects: number;
}

interface SimOptions {
	/** Number of activities to seed. */
	count: number;
	/** Total simulated days the loop will span. */
	days: number;
	/** Number of spins per simulated day. */
	spinsPerDay: number;
	/**
	 * Preference profile per activity index. value > 0  → probability of accepting (0–1) value < 0  → probability of rejecting (0 to −1) value = 0  → roughly even accept/skip/reject 
 */
	preferenceProfile: number[];
	seed?: string;
}

const defaults: SimOptions = {
	count: 8,
	days: 30,
	spinsPerDay: 4,
	preferenceProfile: [0.9, 0.7, 0.4, 0.1, -0.3, -0.6, -0.9, 0],
	seed: 'demo',
};

/** Run a stochastic simulation, printing the final per-activity stats. */
export function runSim(opts: Partial<SimOptions> = {}): SimRow[] {
	const options: SimOptions = { ...defaults, ...opts };
	const rng = makeRng(options.seed);
	const start = Date.now();
	let now = start;

	const activities: Activity[] = Array.from({ length: options.count }, (_, i) =>
		newActivity(
			`sim-${i}`,
			`Activity ${i} (pref=${options.preferenceProfile[i] ?? 0})`,
			now,
			'default',
		),
	);
	const profiles = options.preferenceProfile;

	const totalSpins = options.days * options.spinsPerDay;
	for (let spinIndex = 0; spinIndex < totalSpins; spinIndex++) {
		now += MILLISECONDS_PER_DAY / options.spinsPerDay;

		const weighted = activities.map((activity) => ({
			item: activity,
			weight: getEffectiveWeight(activity, now, {}),
		}));
		const winner = pickFromWeightedPool(weighted, rng);
		if (!winner) break;

		const activityIndex = activities.indexOf(winner);
		const preference = profiles[activityIndex] ?? 0;
		const roll = rng();

		let action: FeedbackAction;
		if (preference > 0) {
			action = roll < preference ? 'accept' : roll < preference + 0.2 ? 'skip' : 'reject';
		}
		else if (preference < 0) {
			action = roll < -preference ? 'reject' : roll < -preference + 0.2 ? 'skip' : 'accept';
		}
		else {
			action = roll < 0.34 ? 'accept' : roll < 0.67 ? 'skip' : 'reject';
		}

		const poolTotal = weighted.reduce((sum, entry) => sum + entry.weight, 0);
		activities[activityIndex] = applyFeedback(winner, action, now, {
			totalEffectiveWeight: poolTotal,
			numTotalActivities: activities.length,
		});
	}

	const rows: SimRow[] = activities.map((activity) => ({
		name: activity.name,
		finalWeight: round(activity.weight),
		finalEffective: round(getEffectiveWeight(activity, now, {})),
		accepts: activity.acceptCount,
		rejects: activity.rejectCount,
	}));

	console.table(rows);
	return rows;
}

function round(value: number): number {
	return Math.round(value * 100) / 100;
}
