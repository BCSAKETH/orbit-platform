import { createClient } from '@supabase/supabase-js';

// ─── Read from env vars (set these in Vercel dashboard or .env file) ───────
const SUPABASE_URL  = import.meta.env.VITE_SUPABASE_URL  || '';
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON || '';

if (!SUPABASE_URL || !SUPABASE_ANON) {
  console.warn('[ORBIT] Supabase env vars missing — running in demo mode');
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
  realtime: {
    params: { eventsPerSecond: 10 },
  },
});

export const isConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON);
