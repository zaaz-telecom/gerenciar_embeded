import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabaseUrl = process.env.VITE_SUPABASE_URL || 'http://127.0.0.1:54321';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || 'dummy_key';

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
    const { data: dbData, error } = await supabase
        .from('profiles')
        .select(`email, role, organization_role_id`)
        .eq('email', 'iami@teste.com.br');

    console.log(dbData);
}

main();
