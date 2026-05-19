import type { APIRoute } from "astro";
import { supabaseAdmin } from "../../../lib/supabase";

export const POST: APIRoute = async ({ request }) => {
    try {
        const { identifier } = await request.json();

        if (!identifier) {
            return new Response(JSON.stringify({ error: "Identificador não fornecido" }), { status: 400 });
        }

        // --- Resolve domain org (for access control) ---
        let host = (request.headers.get("host") || "")
            .split(":")[0]
            .replace(/^www\./, "");

        const urlObj = new URL(request.url);
        if (urlObj.searchParams.get('tenant') === 'zaaz') host = 'bi.zaaztelecom.com.br';
        if (urlObj.searchParams.get('tenant') === 'online') host = 'online.net.br';

        let domainOrgId: string | null = null;

        if (host && supabaseAdmin) {
            const { data: domainData } = await supabaseAdmin
                .from("organization_domains")
                .select("organization_id")
                .eq("domain", host)
                .maybeSingle();

            domainOrgId = domainData?.organization_id ?? null;
        }

        // --- Lookup user by CPF or email ---
        let email: string | null = null;
        let profileOrgId: string | null = null;

        const cleanedIdentifier = identifier.replace(/\D/g, '');
        const isNumeric = /^\d+$/.test(cleanedIdentifier);

        if (isNumeric) {
            // Padronizar para 11 dígitos caso falte o zero à esquerda
            let cpfToSearch = cleanedIdentifier;
            if (cleanedIdentifier.length === 10) {
                cpfToSearch = '0' + cleanedIdentifier;
            }

            if (cpfToSearch.length === 11) {
                let query = supabaseAdmin!
                    .from('profiles')
                    .select('email, status, organization_id')
                    .eq('cpf', cpfToSearch);

                if (domainOrgId) {
                    query = query.eq('organization_id', domainOrgId);
                }

                const { data: results, error } = await query.limit(1);

                if (error) {
                    console.error("Lookup CPF Error:", error);
                    return new Response(JSON.stringify({ error: "Erro ao consultar identificador" }), { status: 500 });
                }

                const data = results && results.length > 0 ? results[0] : null;

                if (data?.status === 'inactive') {
                    return new Response(JSON.stringify({ error: "Sua conta está inativa. Entre em contato com o administrador." }), { status: 403 });
                }

                if (data?.email) {
                    email = data.email;
                    profileOrgId = data.organization_id ?? null;
                }
            } else {
                return new Response(JSON.stringify({
                    exists: false,
                    error: "CPF inválido. Certifique-se de digitar os 11 números."
                }), { status: 400 });
            }
        } else if (identifier.includes('@')) {
            let query = supabaseAdmin!
                .from('profiles')
                .select('email, status, organization_id')
                .eq('email', identifier.trim().toLowerCase());

            if (domainOrgId) {
                query = query.eq('organization_id', domainOrgId);
            }

            const { data: results, error } = await query.limit(1);

            if (error) {
                console.error("Lookup Email Error:", error);
                return new Response(JSON.stringify({ error: "Erro ao consultar email" }), { status: 500 });
            }

            const data = results && results.length > 0 ? results[0] : null;

            if (data?.status === 'inactive') {
                return new Response(JSON.stringify({ error: "Sua conta está inativa. Entre em contato com o administrador." }), { status: 403 });
            }

            if (data?.email) {
                email = data.email;
                profileOrgId = data.organization_id ?? null;
            }
        }

        if (!email) {
            return new Response(JSON.stringify({
                exists: false,
                error: isNumeric
                    ? "CPF não encontrado no sistema."
                    : "Usuário não encontrado ou não cadastrado no sistema."
            }), { status: 404 });
        }

        // --- Domain access validation ---
        // Only enforce if the domain is mapped to a known org.
        // Unmapped domains (localhost, staging) skip this check to allow development.
        if (domainOrgId && profileOrgId && profileOrgId !== domainOrgId) {
            return new Response(JSON.stringify({
                error: "Você não tem acesso a esta plataforma. Entre em contato com o administrador."
            }), { status: 403 });
        }

        return new Response(JSON.stringify({ email, exists: true }));

    } catch (err) {
        console.error("Internal Auth Lookup Error:", err);
        return new Response(JSON.stringify({ error: "Erro interno no servidor" }), { status: 500 });
    }
};
