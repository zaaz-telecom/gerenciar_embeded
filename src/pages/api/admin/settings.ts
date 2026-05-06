import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = import.meta.env.SUPABASE_SERVICE_ROLE_KEY;

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});

export const GET: APIRoute = async ({ request }) => {
    try {
        const authHeader = request.headers.get('Authorization');
        if (!authHeader) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });

        const token = authHeader.replace('Bearer ', '');
        const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
        if (authError || !user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });

        const { data: profile } = await supabaseAdmin
            .from('profiles')
            .select('role, organization_id')
            .eq('id', user.id)
            .single();

        if (!profile || profile.role !== 'admin') return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 });

        const { data: settings } = await supabaseAdmin
            .from('organization_settings')
            .select('*')
            .eq('organization_id', profile.organization_id)
            .single();

        if (settings) {
            // Mask sensitive fields
            if (settings.pbi_client_secret) {
                settings.pbi_client_secret = '••••••••••••••••';
            }
            if (settings.pbi_user_password) {
                settings.pbi_user_password = '••••••••••••••••';
            }
        }

        return new Response(JSON.stringify(settings || {}), { status: 200 });

    } catch (error: any) {
        return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }
};

export const POST: APIRoute = async ({ request }) => {
    try {
        const authHeader = request.headers.get('Authorization');
        if (!authHeader) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });

        const token = authHeader.replace('Bearer ', '');
        const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
        if (authError || !user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });

        const { data: profile } = await supabaseAdmin
            .from('profiles')
            .select('role, organization_id')
            .eq('id', user.id)
            .single();

        if (!profile || profile.role !== 'admin') return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 });

        const body = await request.json();
        
        // If masked values are sent, don't update them
        if (body.pbi_client_secret === '••••••••••••••••') {
            delete body.pbi_client_secret;
        }
        if (body.pbi_user_password === '••••••••••••••••') {
            delete body.pbi_user_password;
        }

        const updates = {
            ...body,
            organization_id: profile.organization_id,
            updated_at: new Date().toISOString()
        };

        const { error } = await supabaseAdmin
            .from('organization_settings')
            .upsert(updates);

        if (error) throw error;

        return new Response(JSON.stringify({ success: true }), { status: 200 });

    } catch (error: any) {
        return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }
};
