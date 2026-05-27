import type { APIRoute } from "astro";
import { supabaseAdmin } from "../../../lib/supabase-admin";
import { sendPasswordResetEmail } from "../../../lib/resend";

export const POST: APIRoute = async ({ request }) => {
    try {
        const body = await request.json();
        const { email /*, captchaToken */ } = body;

        if (!email) {
            return new Response(
                JSON.stringify({ error: "Email é obrigatório." }),
                { status: 400, headers: { 'Content-Type': 'application/json' } }
            );
        }

        // Check if user is activated AND active before sending reset link
        const { data: profile } = await supabaseAdmin
            .from('profiles')
            .select('id, is_activated, status, organization_id')
            .eq('email', email.trim().toLowerCase())
            .maybeSingle();

        // If not activated, inactive (or not found), silently return success to prevent email enumeration
        if (!profile?.is_activated || profile?.status === 'inactive') {
            return new Response(
                JSON.stringify({
                    success: true,
                    message: "Se o email estiver cadastrado, você receberá um link de redefinição."
                }),
                { status: 200, headers: { 'Content-Type': 'application/json' } }
            );
        }

        const baseUrl = new URL(request.url).origin;

        // Generate a recovery link via Supabase Admin API
        const { data: resetData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
            type: 'recovery',
            email: email.trim().toLowerCase(),
            options: {
                redirectTo: `${baseUrl}/update-password`,
            },
        });

        if (linkError) {
            console.error("Erro ao gerar link de reset:", linkError);
            // Return success regardless to prevent email enumeration
            return new Response(
                JSON.stringify({
                    success: true,
                    message: "Se o email estiver cadastrado, você receberá um link de redefinição."
                }),
                { status: 200, headers: { 'Content-Type': 'application/json' } }
            );
        }

        const actionLink = resetData?.properties?.action_link || '';
        const resetUrl = actionLink 
            ? `${baseUrl}/auth/confirm?token_url=${encodeURIComponent(actionLink)}`
            : `${baseUrl}/login`;

        if (actionLink) {
            // Send the branded email via Resend instead of Supabase's built-in
            await sendPasswordResetEmail(
                email.trim().toLowerCase(),
                resetUrl,
                profile.organization_id
            );
        }

        // Log password reset event
        const ipAddress = request.headers.get('x-forwarded-for')
            || request.headers.get('x-real-ip')
            || 'unknown';
        const userAgent = request.headers.get('user-agent') || 'unknown';

        if (profile) {
            await supabaseAdmin.from('auth_events').insert({
                organization_id: profile.organization_id,
                user_id: profile.id,
                event_type: 'PASSWORD_RESET',
                ip_address: ipAddress,
                user_agent: userAgent,
            });
        }

        return new Response(
            JSON.stringify({
                success: true,
                message: "Se o email estiver cadastrado, você receberá um link de redefinição."
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
    } catch (err: any) {
        console.error("Erro inesperado:", err);
        return new Response(
            JSON.stringify({ error: "Erro interno do servidor." }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
    }
};
