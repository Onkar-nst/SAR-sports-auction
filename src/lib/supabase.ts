import { createClient } from '@supabase/supabase-js';
import { Database } from './supabase-types';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('⚠️ Supabase environment variables are missing. Falling back to local file database.');
}

// Supabase integration has been fully disabled.
// The app will now exclusively use the local JSON file database.
export const supabase: any = null;
