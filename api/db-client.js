import { createClient } from '@supabase/supabase-js';
import { triggerRestore } from './db-wake.js';

// Use service role key if available (bypasses RLS), otherwise fall back to anon key
// The SQL provided disables RLS on all tables, so the anon key works for this single-user app
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.SUPABASE_SERVICE_ROLE_KEY !== 'PLACEHOLDER_ADD_YOUR_SERVICE_ROLE_KEY'
  ? process.env.SUPABASE_SERVICE_ROLE_KEY
  : process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  supabaseKey,
  {
    global: {
      fetch: async (url, options) => {
        const res = await fetch(url, options);
        if (!res.ok && res.status >= 500) triggerRestore();
        return res;
      },
    },
  }
);

export default supabase;
