import React, { useEffect, useState } from 'react';
import { PowerBIEmbed } from 'powerbi-client-react';
import { models } from 'powerbi-client';
import { supabase } from '../lib/supabase';

interface EmbedConfig {
    accessToken: string;
    embedUrl: string;
    reportId: string;
    canExportData: boolean;
    tokenType: 'Embed' | 'Aad';
}

export const DashboardEmbed: React.FC = () => {
    const [config, setConfig] = useState<EmbedConfig | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const loadConfig = async () => {
            try {
                // Determine Dashboard Context from URL
                const searchParams = new URLSearchParams(window.location.search);
                const dashboardId = searchParams.get('id');

                let targetWorkspaceId: string | undefined;
                let targetReportId: string | undefined;
                let targetEmbedMode: string | undefined;

                // If specific dashboard requested, fetch its config
                if (dashboardId) {
                    const { data: { session } } = await supabase.auth.getSession();
                    if (session) {
                        const { data: dashboard, error: dbError } = await supabase
                            .from('organization_dashboards')
                            .select('workspace_id, report_id, embed_mode')
                            .eq('id', dashboardId)
                            .single();

                        if (!dbError && dashboard) {
                            targetWorkspaceId = dashboard.workspace_id;
                            targetReportId = dashboard.report_id;
                            targetEmbedMode = dashboard.embed_mode;
                        }
                    }
                }


                // If we don't have a dashboardId, maybe we just want to load the "default" report configured in ENV?
                // But the API requires organization_id.

                const { data: { session } } = await supabase.auth.getSession();
                if (!session) throw new Error("Usuário não autenticado");

                const { data: profile } = await supabase
                    .from('profiles')
                    .select(`
                        organization_id, 
                        can_export_data, 
                        role, 
                        organization_role_id,
                        organization_roles (
                            can_export_data
                        )
                    `)
                    .eq('id', session.user.id)
                    .single();

                if (!profile?.organization_id) {
                    throw new Error("Usuário sem organização vinculada.");
                }

                const payload: any = {
                    organization_id: profile.organization_id
                };


                if (targetWorkspaceId && targetReportId) {
                    payload.group_id = targetWorkspaceId;
                    payload.report_id = targetReportId;
                } else if (!dashboardId) {
                    // Try to find the "first" dashboard for this org only if no specific ID was requested
                    let dashboardsQuery = supabase
                        .from('organization_dashboards')
                        .select('workspace_id, report_id, embed_mode')
                        .eq('organization_id', profile.organization_id);

                    if (profile.role !== 'admin') {
                        if (profile.organization_role_id) {
                            const { data: roleDashboards } = await supabase
                                .from('organization_role_dashboards')
                                .select('dashboard_id')
                                .eq('organization_role_id', profile.organization_role_id);

                            if (roleDashboards && roleDashboards.length > 0) {
                                const allowedIds = roleDashboards.map(d => d.dashboard_id);
                                dashboardsQuery = dashboardsQuery.in('id', allowedIds);
                            } else {
                                dashboardsQuery = dashboardsQuery.eq('id', 'invalid_id_placeholder'); // Force no results
                            }
                        } else {
                            dashboardsQuery = dashboardsQuery.eq('id', 'invalid_id_placeholder'); // Force no results
                        }
                    }

                    const { data: firstDash } = await dashboardsQuery
                        .order('created_at', { ascending: true })
                        .limit(1)
                        .maybeSingle();

                    if (firstDash) {
                        payload.group_id = firstDash.workspace_id;
                        payload.report_id = firstDash.report_id;
                        if (!targetEmbedMode) targetEmbedMode = firstDash.embed_mode;
                    }
                }

                // Final validation before API call
                if (!payload.organization_id || !payload.group_id || !payload.report_id) {
                    // If we requested a specific ID and fell through here, it means it wasn't valid/found.
                    // If we didn't request an ID and found no default, same issue.
                    throw new Error("Dashboard não encontrado ou configuração incompleta.");
                }

                // Add embed_mode to payload
                if (targetEmbedMode) {
                    payload.embed_mode = targetEmbedMode;
                }

                const response = await fetch('/api/pbi/token', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${session.access_token}`
                    },
                    body: JSON.stringify(payload)
                });

                const data = await response.json();
                if (!response.ok) throw new Error(data.error || "Erro ao obter token");

                // Check for export permission across:
                // 1. Admin status (always allowed)
                // 2. Direct profile override
                // 3. Organization role permission
                const roleExport = Array.isArray(profile.organization_roles) 
                    ? profile.organization_roles[0]?.can_export_data 
                    : (profile.organization_roles as any)?.can_export_data;

                setConfig({
                    ...data,
                    tokenType: data.tokenType || 'Embed',
                    canExportData: profile.role === 'admin' || profile.can_export_data === true || roleExport === true
                });
            } catch (err: any) {
                console.error("Error loading dashboard:", err);
                setError(err.message);
            }
        };

        loadConfig();
    }, []);

    if (error) {
        return (
            <div className="flex h-64 items-center justify-center rounded-lg border border-red-200 bg-red-50 text-red-700 p-4">
                <p>Ocorreu um erro ao carregar o dashboard: {error}</p>
            </div>
        );
    }

    if (!config) {
        return (
            <div className="flex h-64 animate-pulse items-center justify-center rounded-lg border border-gray-200 bg-gray-50 text-gray-400">
                <p>Carregando Power BI...</p>
            </div>
        );
    }

    return (
        <div className="h-full w-full overflow-hidden bg-white">
            <PowerBIEmbed
                embedConfig={{
                    type: 'report',
                    id: config.reportId,
                    embedUrl: config.embedUrl,
                    accessToken: config.accessToken,
                    tokenType: config.tokenType === 'Aad' ? models.TokenType.Aad : models.TokenType.Embed,
                    settings: {
                        panes: {
                            filters: { visible: false, expanded: false },
                            pageNavigation: { visible: false },
                        },
                        // background: models.BackgroundType.Transparent,
                        commands: !config.canExportData ? [
                            {
                                exportData: {
                                    displayOption: models.CommandDisplayOption.Hidden
                                }
                            }
                        ] : undefined,
                    },
                }}
                cssClassName="h-full w-full"
            />
        </div>
    );
};
