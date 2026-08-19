// Supabase client for the CRM tables.
//
// The rest of the dashboard talks to Supabase with the anon key (lib/supabase.ts).
// The CRM cannot: its three tables have RLS enabled with no policy for anon or
// authenticated, so that key sees zero rows — by design, since lead data should
// not be readable from the browser. Every CRM query therefore runs server-side
// with the service-role key, behind the gt_session check in src/proxy.ts.
//
// Never import this from a client component. There is a runtime guard below,
// but the real protection is that SUPABASE_SERVICE_ROLE_KEY has no NEXT_PUBLIC_
// prefix, so Next will not bundle it for the browser.

import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/** False until SUPABASE_SERVICE_ROLE_KEY is added to .env.local. */
export function crmConfigured(): boolean {
  return !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY)
}

let cached: SupabaseClient | null = null

export function crmDb(): SupabaseClient {
  if (typeof window !== 'undefined') {
    throw new Error('crmDb() is server-only — it carries the service-role key')
  }
  if (!crmConfigured()) {
    throw new Error(
      'CRM is not configured. Add SUPABASE_SERVICE_ROLE_KEY to .env.local ' +
        '(Supabase → project figvcskjslkvomoxubuq → Settings → API).'
    )
  }
  if (!cached) {
    cached = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } }
    )
  }
  return cached
}
