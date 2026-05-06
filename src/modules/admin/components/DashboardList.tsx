import React, { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import type { OrganizationDashboard } from '../../../types/dashboard';
import DashboardForm from './DashboardForm';

export default function DashboardList() {
    const [dashboards, setDashboards] = useState<OrganizationDashboard[]>([]);
    const [loading, setLoading] = useState(true);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingDashboard, setEditingDashboard] = useState<OrganizationDashboard | null>(null);

    const fetchDashboards = async () => {
        try {
            setLoading(true);
            const { data: { session } } = await supabase.auth.getSession();

            if (!session) return;

            // Get user's org
            const { data: profile } = await supabase
                .from('profiles')
                .select('organization_id')
                .eq('id', session.user.id)
                .single();

            if (!profile?.organization_id) return;

            const { data, error } = await supabase
                .from('organization_dashboards')
                .select('*')
                .eq('organization_id', profile.organization_id)
                .order('created_at', { ascending: false });

            if (error) throw error;
            setDashboards(data || []);
        } catch (error) {
            console.error("Error fetching dashboards:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchDashboards();
    }, []);

    const handleAdd = () => {
        setEditingDashboard(null);
        setIsFormOpen(true);
    };

    const handleEdit = (dashboard: OrganizationDashboard) => {
        setEditingDashboard(dashboard);
        setIsFormOpen(true);
    };

    const handleDelete = async (id: string, name: string) => {
        if (!confirm(`Tem certeza que deseja excluir o dashboard "${name}"?`)) return;

        try {
            const { error } = await supabase
                .from('organization_dashboards')
                .delete()
                .eq('id', id);

            if (error) throw error;

            setDashboards(dashboards.filter(d => d.id !== id));
        } catch (error) {
            console.error("Error deleting dashboard:", error);
            alert("Erro ao excluir dashboard");
        }
    };

    const handleFormSuccess = () => {
        fetchDashboards();
    };

    return (
        <>
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
                    <div>
                        <h2 className="text-base font-semibold text-text-primary flex items-center gap-2">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-brand" viewBox="0 0 20 20" fill="currentColor">
                                <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" />
                            </svg>
                            Meus Dashboards
                        </h2>
                        <p className="text-xs text-text-secondary mt-1">
                            Gerencie os relatórios disponíveis para seus usuários.
                        </p>
                    </div>
                    <button
                        onClick={handleAdd}
                        className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-brand hover:bg-brand-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand transition-colors"
                    >
                        <svg className="-ml-1 mr-2 h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                        </svg>
                        Novo Dashboard
                    </button>
                </div>

                <div className="overflow-x-auto">
                    {loading ? (
                        <div className="p-6 text-center text-gray-500 text-sm">Carregando...</div>
                    ) : dashboards.length === 0 ? (
                        <div className="p-6 text-center text-gray-500 text-sm">
                            Nenhum dashboard cadastrado. Clique em "Novo Dashboard" para começar.
                        </div>
                    ) : (
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nome</th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">IDs (Workspace/Report)</th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Modo</th>
                                    <th scope="col" className="relative px-6 py-3"><span className="sr-only">Ações</span></th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {dashboards.map((dashboard) => (
                                    <tr key={dashboard.id} className="hover:bg-gray-50">
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="text-sm font-medium text-text-primary">{dashboard.name}</div>
                                            {dashboard.description && (
                                                <div className="text-xs text-gray-500">{dashboard.description}</div>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex flex-col sm:flex-row sm:items-center gap-2 text-xs text-gray-500">
                                                <span><span className="font-semibold">W:</span> {dashboard.workspace_id}</span>
                                                <span className="hidden sm:inline text-gray-300">|</span>
                                                <span><span className="font-semibold">R:</span> {dashboard.report_id}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex flex-col gap-1">
                                                {dashboard.embed_mode === 'master_user' ? (
                                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 w-fit">
                                                        <svg className="mr-1 h-3 w-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 8a6 6 0 01-7.743 5.743L10 14l-1 1-1 1H6v2H2v-4l4.257-4.257A6 6 0 1118 8zm-6-4a1 1 0 100 2 2 2 0 012 2 1 1 0 102 0 4 4 0 00-4-4z" clipRule="evenodd" /></svg>
                                                        Master User
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 w-fit">
                                                        <svg className="mr-1 h-3 w-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                                                        Service Principal
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                            <button onClick={() => handleEdit(dashboard)} className="text-brand hover:text-brand-dark mr-4">Editar</button>
                                            <button onClick={() => handleDelete(dashboard.id, dashboard.name)} className="text-red-600 hover:text-red-900">Excluir</button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>

            <DashboardForm
                isOpen={isFormOpen}
                onClose={() => setIsFormOpen(false)}
                onSuccess={handleFormSuccess}
                dashboard={editingDashboard}
            />
        </>
    );
}
