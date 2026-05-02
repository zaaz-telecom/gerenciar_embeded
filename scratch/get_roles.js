const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabaseUrl = process.env.VITE_SUPABASE_URL || 'http://127.0.0.1:54321';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || 'dummy_key';

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
    const { data: dbData, error } = await supabase
        .from('organization_dashboards')
        .select(`
            *,
            organization_role_dashboards (
                organization_role_id
            )
        `)
        .limit(5);

    console.log(JSON.stringify(dbData, null, 2));
    if (error) {
        console.error("Error", error);
    }
}

main();
