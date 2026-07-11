/**
 * Singleton Supabase client, mirroring how `db` is a singleton in activity-service.ts.
 * The anon key is safe to ship in the client bundle: RLS on the database is what
 * enforces privacy, not secrecy of this key.
 *
 * The client is optional: signed-out/local-only usage (IndexedDB) must keep working
 * even when VITE_SUPABASE_URL/VITE_SUPABASE_ANON_KEY aren't configured, so this never
 * throws at module load time when they're missing.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export const isSupabaseConfigured = Boolean(
	import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY,
);

export const supabase: SupabaseClient | null = isSupabaseConfigured
	? createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY)
	: null;

/**
 * Callers reach this only through paths gated on `isSupabaseConfigured`
 * (sign-in is refused when unconfigured, so no signed-in userId can exist to
 * reach a cloud service otherwise). The throw here is a defensive backstop.
 */
export function requireSupabase(): SupabaseClient {
	if (!supabase) throw new Error('Supabase is not configured (missing VITE_SUPABASE_URL/VITE_SUPABASE_ANON_KEY)');
	return supabase;
}
