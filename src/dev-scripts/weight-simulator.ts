/**
 * Tiny CLI-ish simulator for the weight system. Lets you sanity-check that
 * the model behaves the way you'd expect over many feedback rounds.
 *
 * Not bundled into production builds (Vite tree-shakes unimported modules).
 * To use, open the dev console and run:
 *
 *   const sim = await import('./src/dev/weightSim.ts');
 *   sim.runSim();
 *
 * You can also pass custom options:
 *   sim.runSim({ count: 10, days: 60, spinsPerDay: 6 })
 */

import { applyFeedback, DAY_MS, getEffectiveWeight, newActivity } from '../domain-logic/weight-logic';
import { pick } from '../domain-logic/weighted-selection-logic';
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
   * Preference profile per activity index.
   *  value > 0  → probability of accepting (0–1)
   *  value < 0  → probability of rejecting (0 to −1)
   *  value = 0  → roughly even accept/skip/reject
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
  const o: SimOptions = { ...defaults, ...opts };
  const rng = makeRng(o.seed);
  const start = Date.now();
  let now = start;

  const activities: Activity[] = Array.from({ length: o.count }, (_, i) =>
    newActivity(`sim-${i}`, `Activity ${i} (pref=${o.preferenceProfile[i] ?? 0})`, now, 'default'),
  );
  const profiles = o.preferenceProfile;

  const totalSpins = o.days * o.spinsPerDay;
  for (let s = 0; s < totalSpins; s++) {
    now += DAY_MS / o.spinsPerDay;

    const weighted = activities.map((a) => ({
      item: a,
      weight: getEffectiveWeight(a, now, {}),
    }));
    const winner = pick(weighted, rng);
    if (!winner) break;

    const idx = activities.indexOf(winner);
    const pref = profiles[idx] ?? 0;
    const r = rng();

    let action: FeedbackAction;
    if (pref > 0) {
      action = r < pref ? 'accept' : r < pref + 0.2 ? 'skip' : 'reject';
    } else if (pref < 0) {
      action = r < -pref ? 'reject' : r < -pref + 0.2 ? 'skip' : 'accept';
    } else {
      action = r < 0.34 ? 'accept' : r < 0.67 ? 'skip' : 'reject';
    }

    const poolTotal = weighted.reduce((sum, x) => sum + x.weight, 0);
    activities[idx] = applyFeedback(winner, action, now, {
      totalEffectiveWeight: poolTotal,
      numTotalActivities: activities.length,
    });
  }

  const rows: SimRow[] = activities.map((a) => ({
    name: a.name,
    finalWeight: round(a.weight),
    finalEffective: round(getEffectiveWeight(a, now, {})),
    accepts: a.acceptCount,
    rejects: a.rejectCount,
  }));

  console.table(rows);
  return rows;
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}
