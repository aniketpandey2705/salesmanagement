import { createClient } from '@supabase/supabase-js';

// These should be configured in your environment variables (.env.local)
// VITE_SUPABASE_URL=your_supabase_url
// VITE_SUPABASE_ANON_KEY=your_supabase_anon_key

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'placeholder_anon_key';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
