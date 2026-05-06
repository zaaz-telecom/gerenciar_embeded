import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase Admin Client
const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = import.meta.env.SUPABASE_SERVICE_ROLE_KEY;

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

export const POST: APIRoute = async ({ request }) => {
    try {
        // 1. Verify User Authentication
        const authHeader = request.headers.get('Authorization');
        if (!authHeader) {
            return new Response(JSON.stringify({ error: 'Missing Authorization header' }), { status: 401 });
        }

        const token = authHeader.replace('Bearer ', '');
        const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

        if (authError || !user) {
            return new Response(JSON.stringify({ error: 'Unauthorized: Invalid token' }), { status: 401 });
        }

        // 2. Parse Request Body
        const { organization_id, group_id, report_id, embed_mode } = await request.json();

        if (!organization_id || !group_id || !report_id) {
            return new Response(JSON.stringify({ error: 'Missing required parameters: organization_id, group_id, report_id' }), { status: 400 });
        }

        const mode = embed_mode || 'service_principal';

        // 3. Verify User belongs to Organization
        const { data: profile, error: profileError } = await supabaseAdmin
            .from('profiles')
            .select('organization_id')
            .eq('id', user.id)
            .single();

        if (profileError || !profile || profile.organization_id !== organization_id) {
             return new Response(JSON.stringify({ error: 'Unauthorized: User does not belong to this organization' }), { status: 403 });
        }

        // 4. Fetch Organization Power BI Credentials
        const { data: settings, error: settingsError } = await supabaseAdmin
            .from('organization_settings')
            .select('pbi_tenant_id, pbi_client_id, pbi_client_secret, pbi_user_email, pbi_user_password')
            .eq('organization_id', organization_id)
            .single();

        if (settingsError || !settings) {
            return new Response(JSON.stringify({ error: 'Power BI settings not found for this organization' }), { status: 404 });
        }

        const { pbi_tenant_id, pbi_client_id, pbi_client_secret } = settings;

        if (!pbi_tenant_id || !pbi_client_id || !pbi_client_secret) {
             return new Response(JSON.stringify({ error: 'Incomplete Power BI configuration for this organization' }), { status: 400 });
        }

        // 5. Route based on embed_mode
        if (mode === 'master_user') {
            return await handleMasterUser(settings, pbi_tenant_id, pbi_client_id, pbi_client_secret, group_id, report_id);
        } else {
            return await handleServicePrincipal(pbi_tenant_id, pbi_client_id, pbi_client_secret, group_id, report_id);
        }

    } catch (error: any) {
        console.error('PBI Embed Error:', error);
        return new Response(JSON.stringify({ error: error.message || 'Internal Server Error' }), { status: 500 });
    }
};

async function handleServicePrincipal(
    tenantId: string, clientId: string, clientSecret: string,
    groupId: string, reportId: string
): Promise<Response> {
    // Get Azure AD Access Token via client_credentials
    const authorityUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
    const adBody = new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: clientId,
        client_secret: clientSecret,
        scope: 'https://analysis.windows.net/powerbi/api/.default',
    });

    const adResponse = await fetch(authorityUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: adBody,
    });

    const adData = await adResponse.json();
    if (!adResponse.ok) {
        throw new Error(`Azure AD Error: ${adData.error_description || adData.error}`);
    }
    const accessToken = adData.access_token;

    // Generate Embed Token
    const embedTokenUrl = `https://api.powerbi.com/v1.0/myorg/groups/${groupId}/reports/${reportId}/GenerateToken`;
    
    const pbiResponse = await fetch(embedTokenUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ accessLevel: 'View' }),
    });

    const pbiData = await pbiResponse.json();
    
    if (!pbiResponse.ok) {
         throw new Error(`Power BI Error: ${JSON.stringify(pbiData)}`);
    }

    return new Response(JSON.stringify({
        accessToken: pbiData.token,
        embedUrl: `https://app.powerbi.com/reportEmbed?reportId=${reportId}&groupId=${groupId}`,
        reportId: reportId,
        expiry: pbiData.expiration,
        tokenType: 'Embed',
    }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
    });
}

async function handleMasterUser(
    settings: any, tenantId: string, clientId: string, clientSecret: string,
    groupId: string, reportId: string
): Promise<Response> {
    const { pbi_user_email, pbi_user_password } = settings;

    if (!pbi_user_email || !pbi_user_password) {
        throw new Error('Master User credentials not configured. Go to Admin Settings to set email and password.');
    }

    // Get Azure AD Access Token via ROPC (Resource Owner Password Credentials)
    const authorityUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
    const ropcBody = new URLSearchParams({
        grant_type: 'password',
        client_id: clientId,
        client_secret: clientSecret,
        scope: 'https://analysis.windows.net/powerbi/api/.default',
        username: pbi_user_email,
        password: pbi_user_password,
    });

    const adResponse = await fetch(authorityUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: ropcBody,
    });

    const adData = await adResponse.json();
    if (!adResponse.ok) {
        const errorMsg = adData.error_description || adData.error || 'Unknown ROPC error';
        // Provide user-friendly error for common MFA/blocked scenarios
        if (errorMsg.includes('AADSTS50076') || errorMsg.includes('AADSTS50079')) {
            throw new Error('A conta Master User possui MFA habilitado. Desabilite o MFA ou use o modo Service Principal.');
        }
        if (errorMsg.includes('AADSTS7000218')) {
            throw new Error('O App Registration não permite fluxo ROPC. Habilite "Allow public client flows" no Azure.');
        }
        if (errorMsg.includes('AADSTS50126')) {
            throw new Error('E-mail ou senha do Master User inválidos. Verifique as credenciais nas Configurações.');
        }
        throw new Error(`Azure AD ROPC Error: ${errorMsg}`);
    }

    const accessToken = adData.access_token;

    // With Master User (User Owns Data), we return the AAD token directly
    // No need to call GenerateToken — the frontend uses TokenType.Aad
    return new Response(JSON.stringify({
        accessToken: accessToken,
        embedUrl: `https://app.powerbi.com/reportEmbed?reportId=${reportId}&groupId=${groupId}`,
        reportId: reportId,
        expiry: adData.expires_on ? new Date(adData.expires_on * 1000).toISOString() : null,
        tokenType: 'Aad',
    }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
    });
}

