import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL  = import.meta.env.VITE_SUPABASE_URL  || '';
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON || '';

export const isConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON);

// Use a dummy URL when env vars are missing so createClient doesn't throw
export const supabase = createClient(
  SUPABASE_URL  || 'https://lwysjeoxybteixpqkylu.supabase.co',
  SUPABASE_ANON || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx3eXNqZW94eWJ0ZWl4cHFreWx1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMyNDM3MTIsImV4cCI6MjA4ODgxOTcxMn0.zKUKQN4NHhsLj0tzdan0oH8Pwzhj6hzN81nQKLOOZ2k',
  {
    auth: { persistSession: true, autoRefreshToken: true },
    realtime: { params: { eventsPerSecond: 10 } },
  }
);
