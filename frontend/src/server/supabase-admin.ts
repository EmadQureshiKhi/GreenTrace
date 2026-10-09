import 'server-only';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { serverEnv } from './env';

let admin: SupabaseClient | null = null;

/** Service-role client. Bypasses RLS, so every caller must enforce ownership itself. */
export function supabaseAdmin(): SupabaseClient {
  if (!admin) {
    admin = createClient(serverEnv.supabaseUrl(), serverEnv.supabaseServiceRoleKey(), {
      auth: { persistSession: false, autoRefreshToken: false },
      // Next.js caches server-side fetch() by default; database reads must always be live.
      global: { fetch: (input, init) => fetch(input, { ...init, cache: 'no-store' }) },
    });
  }
  return admin;
}

/** Throws on a Supabase error, returns data otherwise. */
export function must<T>(result: { data: T; error: { message: string } | null }, context: string): T {
  if (result.error) throw new Error(`${context}: ${result.error.message}`);
  return result.data;
}

/** For `.single()` queries: throws on an error or a missing row, returns the row otherwise. */
export function one<T>(result: { data: T | null; error: { message: string } | null }, context: string): T {
  if (result.error) throw new Error(`${context}: ${result.error.message}`);
  if (result.data == null) throw new Error(`${context}: no row returned`);
  return result.data;
}
