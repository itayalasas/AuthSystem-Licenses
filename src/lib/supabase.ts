import { createClient } from '@supabase/supabase-js';
import { ConfigService } from './config';

let supabaseInstance: ReturnType<typeof createClient> | null = null;

export async function initializeSupabase() {
  if (supabaseInstance) return supabaseInstance;

  await ConfigService.initialize();

  const supabaseUrl = ConfigService.getVariable('VITE_SUPABASE_URL');
  const supabaseAnonKey = ConfigService.getVariable('VITE_SUPABASE_ANON_KEY');

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase configuration');
  }

  supabaseInstance = createClient(supabaseUrl, supabaseAnonKey);
  return supabaseInstance;
}

export function getSupabase() {
  if (!supabaseInstance) {
    throw new Error('Supabase not initialized. Call initializeSupabase() first.');
  }
  return supabaseInstance;
}

export const supabase = new Proxy({} as ReturnType<typeof createClient>, {
  get(_target, prop) {
    if (!supabaseInstance) {
      throw new Error('Supabase not initialized. Call initializeSupabase() first.');
    }
    return (supabaseInstance as any)[prop];
  }
});
