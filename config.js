import { createClient } from '@supabase/supabase-js';

// WSTAW SWOJE KLUCZE Z SUPABASE (Settings > API)
const supabaseUrl = 'https://YOUR_PROJECT_ID.supabase.co';
const supabaseAnonKey = 'YOUR_ANON_KEY_HERE';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
