import type { APIRoute } from "astro";
import { supabaseAdmin } from "../../../lib/supabase";

/**
 * GET /api/auth/tenant
 *
 * Returns the organization associated with the current request's domain.
 * Used by the login page to load the correct branding before authentication.
 * Works automatically for any domain registered in the organization_domains table.
 */
export const GET: APIRoute = async ({ request }) => {
    try {
        if (!supabaseAdmin) {
            return new Response(JSON.stringify({ error: "Server misconfiguration" }), { status: 500 });
        }

        // Extract host, stripping port and www prefix
        const host = (request.headers.get("host") || "")
            .split(":")[0]
            .replace(/^www\./, "");

        if (!host) {
            return new Response(JSON.stringify({ error: "Host header missing" }), { status: 400 });
        }

        // Lookup organization by domain
        const { data, error } = await supabaseAdmin
            .from("organization_domains")
            .select(`
                organization_id,
                organizations (
                    id,
                    name,
                    logo_url,
                    accent_color
                )
            `)
            .eq("domain", host)
            .maybeSingle();

        if (error) {
            console.error("Tenant lookup error:", error);
            return new Response(JSON.stringify({ error: "Erro ao consultar tenant" }), { status: 500 });
        }

        if (!data?.organizations) {
            // Domain not mapped — return a generic fallback so the login page still works
            return new Response(JSON.stringify({
                found: false,
                org: null,
            }), { status: 200 });
        }

        const org = Array.isArray(data.organizations)
            ? data.organizations[0]
            : data.organizations;

        return new Response(JSON.stringify({
            found: true,
            org: {
                id: org.id,
                name: org.name,
                logo_url: org.logo_url,
                accent_color: org.accent_color,
            },
        }), {
            status: 200,
            headers: {
                // Cache for 5 minutes — org branding rarely changes
                "Cache-Control": "public, max-age=300",
                "Content-Type": "application/json",
            },
        });

    } catch (err) {
        console.error("Tenant API error:", err);
        return new Response(JSON.stringify({ error: "Erro interno" }), { status: 500 });
    }
};
