import { createClient } from '@supabase/supabase-js';

// Hardcoded to YOUR Supabase project — Vercel dashboard env vars were overriding with the wrong project
const url = 'https://crukkzfwqnmsauvhyhdc.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNydWtremZ3cW5tc2F1dmh5aGRjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIzOTYyMjEsImV4cCI6MjA5Nzk3MjIyMX0.fKbYp_crM0Jg5VoELA34CPUciOB83EgAQivK0ycXIEA';

export const supabaseUrl = url;
export const supabaseKey = key;

export const supabase = createClient(url, key, {
  auth: { persistSession: false }
});
export default supabase;
