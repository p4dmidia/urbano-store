import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

console.log('Supabase Config:', {
    url: supabaseUrl ? 'Defined' : 'Missing',
    key: supabaseAnonKey ? 'Defined' : 'Missing'
});

if (!supabaseUrl || !supabaseAnonKey) {
    const missing = [];
    if (!supabaseUrl) missing.push('VITE_SUPABASE_URL');
    if (!supabaseAnonKey) missing.push('VITE_SUPABASE_ANON_KEY');
    throw new Error(`Missing Supabase variables: ${missing.join(', ')}. Check Vercel Environment Variables.`);
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
