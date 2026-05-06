import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../../../lib/supabase';
import type { OrganizationDashboard, EmbedMode } from '../../../types/dashboard';

interface DashboardFormProps {
    dashboard?: OrganizationDashboard | null;
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

interface MenuOption {
    id: string;
    title: string;
}

export default function DashboardForm({ dashboard, isOpen, onClose, onSuccess }: DashboardFormProps) {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [mounted, setMounted] = useState(false);
    const [menus, setMenus] = useState<MenuOption[]>([]);

    // Form state
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [workspaceId, setWorkspaceId] = useState('');
    const [reportId, setReportId] = useState('');
    const [menuId, setMenuId] = useState('');
    const [embedMode, setEmbedMode] = useState<EmbedMode>('service_principal');

    useEffect(() => {
        setMounted(true);
        return () => setMounted(false);
    }, []);

    useEffect(() => {
        if (isOpen) {
            fetchMenus();
            if (dashboard) {
                // Edit mode
                setName(dashboard.name);
                setDescription(dashboard.description || '');
                setWorkspaceId(dashboard.workspace_id);
                setReportId(dashboard.report_id);
                setMenuId(dashboard.menu_id || '');
                setEmbedMode(dashboard.embed_mode || 'service_principal');
            } else {
                // Create mode - reset
                setName('');
                setDescription('');
                setWorkspaceId('');
                setReportId('');
                setMenuId('');
                setEmbedMode('service_principal');
            }
            setError(null);
        }
    }, [isOpen, dashboard]);

    const fetchMenus = async () => {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return;

            const { data: profile } = await supabase
                .from('profiles')
                .select('organization_id')
                .eq('id', session.user.id)
                .single();

            if (profile?.organization_id) {
                const { data, error } = await supabase
                    .from('organization_menus')
                    .select('id, title')
                    .eq('organization_id', profile.organization_id)
                    .eq('is_active', true)
                    .order('order_index');

                if (data) setMenus(data);
            }
        } catch (err) {
            console.error("Error fetching menus", err);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) throw new Error("Usuário não autenticado");

            // Get user's org
            const { data: profile } = await supabase
                .from('profiles')
                .select('organization_id')
                .eq('id', session.user.id)
                .single();

            if (!profile?.organization_id) throw new Error("Organização não encontrada");

            const payload = {
                organization_id: profile.organization_id,
                name,
                description,
                workspace_id: workspaceId,
                report_id: reportId,
                menu_id: menuId || null,
                embed_mode: embedMode,
                updated_at: new Date().toISOString(),
            };

            let error;

            if (dashboard?.id) {
                // Update
                const res = await supabase
                    .from('organization_dashboards')
                    .update(payload)
                    .eq('id', dashboard.id);
                error = res.error;
            } else {
                // Insert
                const res = await supabase
                    .from('organization_dashboards')
                    .insert(payload);
                error = res.error;
            }

            if (error) throw error;

            onSuccess();
            onClose();

        } catch (err: any) {
            console.error("Error saving dashboard:", err);
            setError(err.message || "Erro ao salvar dashboard");
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen || !mounted) return null;

    return createPortal(
        <div className="relative z-9999" aria-labelledby="modal-title" role="dialog" aria-modal="true">
            {/* Background backdrop */}
            <div className="fixed inset-0 bg-black/50 transition-opacity" onClick={onClose}></div>

            <div className="fixed inset-0 z-10 w-screen overflow-y-auto">
                <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
                    <div className="relative transform overflow-hidden rounded-lg bg-white text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg">
                        <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                            <div className="sm:flex sm:items-start">
                                <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left w-full">
                                    <h3 className="text-lg leading-6 font-medium text-gray-900" id="modal-title">
                                        {dashboard ? 'Editar Dashboard' : 'Novo Dashboard'}
                                    </h3>
                                    <div className="mt-4">
                                        <form id="dashboard-form" onSubmit={handleSubmit} className="space-y-4">
                                            <div>
                                                <label htmlFor="name" className="block text-sm font-medium text-gray-700">Nome</label>
                                                <input
                                                    type="text"
                                                    id="name"
                                                    required
                                                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-brand focus:border-brand sm:text-sm"
                                                    value={name}
                                                    onChange={e => setName(e.target.value)}
                                                />
                                            </div>
                                            <div>
                                                <label htmlFor="description" className="block text-sm font-medium text-gray-700">Descrição</label>
                                                <textarea
                                                    id="description"
                                                    rows={2}
                                                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-brand focus:border-brand sm:text-sm"
                                                    value={description}
                                                    onChange={e => setDescription(e.target.value)}
                                                />
                                            </div>
                                            <div className="grid grid-cols-1 gap-y-4 gap-x-4 sm:grid-cols-2">
                                                <div>
                                                    <label htmlFor="workspaceId" className="block text-sm font-medium text-gray-700">Workspace ID</label>
                                                    <input
                                                        type="text"
                                                        id="workspaceId"
                                                        required
                                                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-brand focus:border-brand sm:text-sm"
                                                        value={workspaceId}
                                                        onChange={e => setWorkspaceId(e.target.value)}
                                                    />
                                                </div>
                                                <div>
                                                    <label htmlFor="reportId" className="block text-sm font-medium text-gray-700">Report ID</label>
                                                    <input
                                                        type="text"
                                                        id="reportId"
                                                        required
                                                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-brand focus:border-brand sm:text-sm"
                                                        value={reportId}
                                                        onChange={e => setReportId(e.target.value)}
                                                    />
                                                </div>
                                            </div>
                                            <div>
                                                <label htmlFor="menuId" className="block text-sm font-medium text-gray-700">
                                                    Menu Associado (Grupo)
                                                </label>
                                                <select
                                                    id="menuId"
                                                    className="mt-1 block w-full bg-white border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-brand focus:border-brand sm:text-sm"
                                                    value={menuId}
                                                    onChange={e => setMenuId(e.target.value)}
                                                >
                                                    <option value="">Selecione um menu...</option>
                                                    {menus.map(menu => (
                                                        <option key={menu.id} value={menu.id}>
                                                            {menu.title}
                                                        </option>
                                                    ))}
                                                </select>
                                                <p className="mt-1 text-xs text-gray-500">
                                                    Selecione o menu onde este dashboard será exibido.
                                                </p>
                                            </div>

                                            <div>
                                                <label htmlFor="embedMode" className="block text-sm font-medium text-gray-700">
                                                    Modo de Autenticação
                                                </label>
                                                <select
                                                    id="embedMode"
                                                    className="mt-1 block w-full bg-white border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-brand focus:border-brand sm:text-sm"
                                                    value={embedMode}
                                                    onChange={e => setEmbedMode(e.target.value as EmbedMode)}
                                                >
                                                    <option value="service_principal">Service Principal (App Owns Data)</option>
                                                    <option value="master_user">Master User (Conta Compartilhada)</option>
                                                </select>
                                                <p className="mt-1 text-xs text-gray-500">
                                                    {embedMode === 'master_user'
                                                        ? 'Usa credenciais de usuário Microsoft configuradas nas Configurações. Não consome tokens de embed.'
                                                        : 'Usa Service Principal para gerar tokens de embed. Requer capacidade Embedded ou PPU.'}
                                                </p>
                                            </div>

                                            {error && (
                                                <div className="text-red-600 text-sm">{error}</div>
                                            )}
                                        </form>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                            <button
                                type="submit"
                                form="dashboard-form"
                                disabled={loading}
                                className={`w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-brand text-base font-medium text-white hover:bg-brand-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand sm:ml-3 sm:w-auto sm:text-sm ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
                            >
                                {loading ? 'Salvando...' : 'Salvar'}
                            </button>
                            <button
                                type="button"
                                className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                                onClick={onClose}
                            >
                                Cancelar
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
}
