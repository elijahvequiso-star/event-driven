import 'server-only';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

let supabaseClient: SupabaseClient | undefined;

export function getSupabaseAdmin(): SupabaseClient {
  if (supabaseClient) return supabaseClient;

  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error(
      'Configure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local before using the app.',
    );
  }

  supabaseClient = createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });
  return supabaseClient;
}
