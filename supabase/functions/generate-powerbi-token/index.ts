
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.0.0"

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
    // Handle CORS preflight request
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        // 1. Authenticate User
        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_ANON_KEY') ?? '',
            { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
        )

        const {
            data: { user },
        } = await supabaseClient.auth.getUser()

        if (!user) {
            throw new Error('User not authenticated')
        }

        // 2. Parse Input
        const { organization_id, group_id, report_id, embed_mode } = await req.json()
        if (!organization_id || !group_id || !report_id) {
            throw new Error('Missing organization_id, group_id, or report_id')
        }

        const mode = embed_mode || 'service_principal'

        // 3. Retrieve Credentials Securely (via Service Role)
        const supabaseAdmin = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        const { data: creds, error: credsError } = await supabaseAdmin
            .rpc('get_decrypted_powerbi_creds', { org_id: organization_id })
            .single()

        if (credsError || !creds) {
            console.error('Creds Error:', credsError)
            throw new Error('Failed to retrieve credentials for this organization')
        }

        const { pbi_tenant_id, pbi_client_id, client_secret } = creds

        // 4. Route based on embed_mode
        if (mode === 'master_user') {
            // Fetch master user credentials from organization_settings
            const { data: settings, error: settingsError } = await supabaseAdmin
                .from('organization_settings')
                .select('pbi_user_email, pbi_user_password')
                .eq('organization_id', organization_id)
                .single()

            if (settingsError || !settings?.pbi_user_email || !settings?.pbi_user_password) {
                throw new Error('Master User credentials not configured for this organization')
            }

            return await handleMasterUser(
                pbi_tenant_id, pbi_client_id, client_secret,
                settings.pbi_user_email, settings.pbi_user_password,
                group_id, report_id
            )
        } else {
            return await handleServicePrincipal(
                pbi_tenant_id, pbi_client_id, client_secret,
                group_id, report_id
            )
        }

    } catch (error) {
        return new Response(
            JSON.stringify({ error: error.message }),
            {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 400,
            }
        )
    }
})

async function handleServicePrincipal(
    tenantId: string, clientId: string, clientSecret: string,
    groupId: string, reportId: string
): Promise<Response> {
    // Get Microsoft Access Token via client_credentials
    const tokenResponse = await fetch(
        `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
        {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
                grant_type: 'client_credentials',
                client_id: clientId,
                client_secret: clientSecret,
                scope: 'https://analysis.windows.net/powerbi/api/.default',
            }),
        }
    )

    const tokenData = await tokenResponse.json()
    if (!tokenResponse.ok) {
        throw new Error(`Failed to get MS Access Token: ${JSON.stringify(tokenData)}`)
    }

    const accessToken = tokenData.access_token

    // Generate Power BI Embed Token
    const embedUrl = `https://api.powerbi.com/v1.0/myorg/groups/${groupId}/reports/${reportId}/GenerateToken`

    const embedResponse = await fetch(embedUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
            accessLevel: 'View',
        }),
    })

    const embedData = await embedResponse.json()
    if (!embedResponse.ok) {
        throw new Error(`Failed to get Embed Token: ${JSON.stringify(embedData)}`)
    }

    return new Response(
        JSON.stringify({
            embedToken: embedData.token,
            tokenId: embedData.tokenId,
            expiration: embedData.expiration,
            tokenType: 'Embed',
        }),
        {
            headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
            status: 200,
        }
    )
}

async function handleMasterUser(
    tenantId: string, clientId: string, clientSecret: string,
    userEmail: string, userPassword: string,
    groupId: string, reportId: string
): Promise<Response> {
    // Get Azure AD Access Token via ROPC
    const tokenResponse = await fetch(
        `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
        {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
                grant_type: 'password',
                client_id: clientId,
                client_secret: clientSecret,
                scope: 'https://analysis.windows.net/powerbi/api/.default',
                username: userEmail,
                password: userPassword,
            }),
        }
    )

    const tokenData = await tokenResponse.json()
    if (!tokenResponse.ok) {
        const errorMsg = tokenData.error_description || tokenData.error || 'Unknown ROPC error'
        if (errorMsg.includes('AADSTS50076') || errorMsg.includes('AADSTS50079')) {
            throw new Error('A conta Master User possui MFA habilitado. Desabilite o MFA ou use o modo Service Principal.')
        }
        if (errorMsg.includes('AADSTS7000218')) {
            throw new Error('O App Registration não permite fluxo ROPC. Habilite "Allow public client flows" no Azure.')
        }
        if (errorMsg.includes('AADSTS50126')) {
            throw new Error('E-mail ou senha do Master User inválidos.')
        }
        throw new Error(`Azure AD ROPC Error: ${errorMsg}`)
    }

    const accessToken = tokenData.access_token

    // Return AAD token directly — no GenerateToken needed
    return new Response(
        JSON.stringify({
            embedToken: accessToken,
            expiration: tokenData.expires_on ? new Date(tokenData.expires_on * 1000).toISOString() : null,
            tokenType: 'Aad',
        }),
        {
            headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
            status: 200,
        }
    )
}
