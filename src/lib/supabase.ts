import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase client config missing. Ensure PUBLIC_SUPABASE_URL and PUBLIC_SUPABASE_ANON_KEY are set in .env', {
    hasUrl: !!supabaseUrl,
    hasKey: !!supabaseAnonKey
  });
}

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-key'
);

// Server-only admin client — only create when the key is available
const supabaseServiceKey = import.meta.env.SUPABASE_SERVICE_ROLE_KEY;

export const supabaseAdmin = supabaseServiceKey
  ? createClient(supabaseUrl || 'https://placeholder.supabase.co', supabaseServiceKey)
  : null; // Never expose admin client to the browser
