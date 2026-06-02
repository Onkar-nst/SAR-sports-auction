import { createClient } from '@supabase/supabase-js';
import { Database } from './supabase-types';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('⚠️ Supabase environment variables are missing. Falling back to local file database.');
}

const isServer = typeof window === 'undefined';

// Ensure the standard client is used across the app
export const supabase = (supabaseUrl && supabaseAnonKey)
  ? createClient<Database>(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true, // Enable Supabase Auth
      },
      global: {
        fetch: (url, options) => {
          if (isServer) {
            return fetch(url, {
              ...options,
              signal: AbortSignal.timeout(5000), // 5s timeout on server side for fast fallback to local DB
            });
          }
          // No timeout on client-side (browser) to allow Auth requests to complete on slower connections or database wakeups
          return fetch(url, options);
        }
      }
    })
  : null;
