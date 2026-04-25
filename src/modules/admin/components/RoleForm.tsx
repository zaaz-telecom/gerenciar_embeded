import React, { useEffect, useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../../../lib/supabase';
import type { OrganizationRole, OrganizationDashboard, AppPermissions } from '../../../types/dashboard';
import { DEFAULT_PERMISSIONS, mergePermissions } from '../../../utils/permissions';

interface JobTitle {
    id: string;
    title: string;
    department?: { name: string } | null;
    sector?: { name: string } | null;
    department_id?: string | null;
    is_active: boolean;
}

interface RoleFormProps {
    role?: OrganizationRole | null;
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

type Tab = 'geral' | 'permissoes' | 'cargos' | 'dashboards';

const TABS: { key: Tab; label: string; icon: string }[] = [
    { key: 'geral', label: 'Geral', icon: '📋' },
    { key: 'permissoes', label: 'Permissões', icon: '🔐' },
    { key: 'cargos', label: 'Cargos', icon: '👥' },
    { key: 'dashboards', label: 'Dashboards', icon: '📊' },
];

const PRESET_COLORS = [
    '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6',
    '#EC4899', '#06B6D4', '#F97316', '#6366F1', '#14B8A6',
    '#D946EF', '#0EA5E9',
];

export default function RoleForm({ role, isOpen, onClose, onSuccess }: RoleFormProps) {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [mounted, setMounted] = useState(false);
    const [activeTab, setActiveTab] = useState<Tab>('geral');

    // Data Sources
    const [dashboards, setDashboards] = useState<OrganizationDashboard[]>([]);
    const [allJobTitles, setAllJobTitles] = useState<JobTitle[]>([]);
    const [usedJobTitleIds, setUsedJobTitleIds] = useState<Set<string>>(new Set());

    // Form State
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [pbiRoles, setPbiRoles] = useState('');
    const [color, setColor] = useState('#3B82F6');
    const [canExportData, setCanExportData] = useState(false);
    const [selectedDashboardIds, setSelectedDashboardIds] = useState<string[]>([]);
    const [selectedJobTitleIds, setSelectedJobTitleIds] = useState<string[]>([]);
    const [permissions, setPermissions] = useState<AppPermissions>(DEFAULT_PERMISSIONS);

    // Filters
    const [jobTitleSearch, setJobTitleSearch] = useState('');
    const [dashboardSearch, setDashboardSearch] = useState('');

    useEffect(() => {
        setMounted(true);
        return () => setMounted(false);
    }, []);

    useEffect(() => {
        if (isOpen) {
            setActiveTab('geral');
            fetchDashboards();
            fetchJobTitles();
            if (role) {
                setName(role.name);
                setDescription(role.description || '');
                setPbiRoles(role.pbi_roles || '');
                setColor(role.color || '#3B82F6');
                setCanExportData(role.can_export_data);
                setPermissions(mergePermissions(role.permissions));
                fetchRoleDashboards(role.id);
                fetchRoleJobTitles(role.id);
            } else {
                setName('');
                setDescription('');
                setPbiRoles('');
                setColor('#3B82F6');
                setCanExportData(false);
                setSelectedDashboardIds([]);
                setSelectedJobTitleIds([]);
                setPermissions(DEFAULT_PERMISSIONS);
            }
            setError(null);
            setJobTitleSearch('');
            setDashboardSearch('');
        }
    }, [isOpen, role]);

    const fetchDashboards = async () => {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (session) {
                const { data: profile } = await supabase.from('profiles').select('organization_id').eq('id', session.user.id).single();
                if (profile?.organization_id) {
                    const { data } = await supabase
                        .from('organization_dashboards')
                        .select('*')
                        .eq('organization_id', profile.organization_id);
                    if (data) setDashboards(data);
                }
            }
        } catch (err) {
            console.error(err);
        }
    };

    const fetchJobTitles = async () => {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return;
            const orgId = session.user.user_metadata.organization_id;

            const { data: titles } = await supabase
                .from('job_titles')
                .select('id, title, is_active, department_id, department:departments(name), sector:sectors(name)')
                .eq('organization_id', orgId)
                .eq('is_active', true)
                .order('title');

            if (titles) setAllJobTitles(titles as JobTitle[]);

            // Fetch which job titles are already used by OTHER roles
            const { data: usedData } = await supabase
                .from('organization_role_job_titles')
                .select('job_title_id, organization_role_id');

            if (usedData) {
                const usedByOthers = new Set(
                    usedData
                        .filter(u => u.organization_role_id !== role?.id)
                        .map(u => u.job_title_id)
                );
                setUsedJobTitleIds(usedByOthers);
            }
        } catch (err) {
            console.error(err);
        }
    };

    const fetchRoleDashboards = async (roleId: string) => {
        try {
            const { data } = await supabase
                .from('organization_role_dashboards')
                .select('dashboard_id')
                .eq('organization_role_id', roleId);
            if (data) setSelectedDashboardIds(data.map(d => d.dashboard_id));
        } catch (err) {
            console.error(err);
        }
    };

    const fetchRoleJobTitles = async (roleId: string) => {
        try {
            const { data } = await supabase
                .from('organization_role_job_titles')
                .select('job_title_id')
                .eq('organization_role_id', roleId);
            if (data) setSelectedJobTitleIds(data.map(d => d.job_title_id));
        } catch (err) {
            console.error(err);
        }
    };

    const handleDashboardToggle = (dashboardId: string) => {
        setSelectedDashboardIds(prev =>
            prev.includes(dashboardId)
                ? prev.filter(id => id !== dashboardId)
                : [...prev, dashboardId]
        );
    };

    const handleJobTitleToggle = (jobTitleId: string) => {
        setSelectedJobTitleIds(prev =>
            prev.includes(jobTitleId)
                ? prev.filter(id => id !== jobTitleId)
                : [...prev, jobTitleId]
        );
    };

    const handlePermissionChange = (resource: keyof AppPermissions, action: string, value: boolean) => {
        setPermissions(prev => ({
            ...prev,
            [resource]: {
                ...prev[resource],
                [action]: value
            }
        }));
    };

    const handleSelectAllPermissions = (resource: keyof AppPermissions, selectAll: boolean) => {
        if (resource === 'organization') {
            setPermissions(prev => ({
                ...prev,
                organization: { manage_settings: selectAll }
            }));
        } else {
            setPermissions(prev => ({
                ...prev,
                [resource]: {
                    view: selectAll,
                    create: selectAll,
                    edit: selectAll,
                    delete: selectAll,
                }
            }));
        }
    };

    const handleSelectAllGlobalPermissions = (selectAll: boolean) => {
        setPermissions({
            users: { view: selectAll, create: selectAll, edit: selectAll, delete: selectAll },
            processes: { view: selectAll, create: selectAll, edit: selectAll, delete: selectAll },
            indicators: { view: selectAll, create: selectAll, edit: selectAll, delete: selectAll },
            profiles: { view: selectAll, create: selectAll, edit: selectAll, delete: selectAll },
            contracts: { view: selectAll, create: selectAll, edit: selectAll, delete: selectAll },
            crm: { view: selectAll, create: selectAll, edit: selectAll, delete: selectAll },
            crm_admin: { view_all: selectAll, manage: selectAll, configure: selectAll },
            organization: { manage_settings: selectAll },
        });
    };

    // Available job titles (not used by other roles)
    const availableJobTitles = useMemo(() => {
        return allJobTitles.filter(jt =>
            !usedJobTitleIds.has(jt.id) || selectedJobTitleIds.includes(jt.id)
        );
    }, [allJobTitles, usedJobTitleIds, selectedJobTitleIds]);

    // Group by department
    const groupedJobTitles = useMemo(() => {
        const search = jobTitleSearch.toLowerCase();
        const filtered = availableJobTitles.filter(jt =>
            !search || jt.title.toLowerCase().includes(search)
        );
        const groups: Record<string, JobTitle[]> = {};
        filtered.forEach(jt => {
            const deptName = (jt.department as any)?.name || 'Sem Departamento';
            if (!groups[deptName]) groups[deptName] = [];
            groups[deptName].push(jt);
        });
        return groups;
    }, [availableJobTitles, jobTitleSearch]);

    const filteredDashboards = useMemo(() => {
        if (!dashboardSearch) return dashboards;
        const search = dashboardSearch.toLowerCase();
        return dashboards.filter(d => d.name.toLowerCase().includes(search));
    }, [dashboards, dashboardSearch]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) throw new Error("Usuário não autenticado");

            const { data: profile } = await supabase
                .from('profiles')
                .select('organization_id')
                .eq('id', session.user.id)
                .single();

            if (!profile?.organization_id) throw new Error("Organização não encontrada");

            // 1. Upsert Role
            const rolePayload = {
                organization_id: profile.organization_id,
                name,
                description,
                pbi_roles: pbiRoles || null,
                color,
                can_export_data: canExportData,
                permissions,
                updated_at: new Date().toISOString(),
            };

            let savedRoleId = role?.id;

            if (role?.id) {
                const { error: updateError } = await supabase
                    .from('organization_roles')
                    .update(rolePayload)
                    .eq('id', role.id);
                if (updateError) throw updateError;
            } else {
                const { data: insertedRole, error: insertError } = await supabase
                    .from('organization_roles')
                    .insert(rolePayload)
                    .select()
                    .single();
                if (insertError) throw insertError;
                savedRoleId = insertedRole.id;
            }

            if (!savedRoleId) throw new Error("Erro ao salvar perfil");

            // 2. Update Role Dashboards
            await supabase
                .from('organization_role_dashboards')
                .delete()
                .eq('organization_role_id', savedRoleId);

            if (selectedDashboardIds.length > 0) {
                const { error: junctionError } = await supabase
                    .from('organization_role_dashboards')
                    .insert(selectedDashboardIds.map(dashboardId => ({
                        organization_role_id: savedRoleId!,
                        dashboard_id: dashboardId
                    })));
                if (junctionError) throw junctionError;
            }

            // 3. Update Role Job Titles
            await supabase
                .from('organization_role_job_titles')
                .delete()
                .eq('organization_role_id', savedRoleId);

            if (selectedJobTitleIds.length > 0) {
                const { error: jtError } = await supabase
                    .from('organization_role_job_titles')
                    .insert(selectedJobTitleIds.map(jobTitleId => ({
                        organization_role_id: savedRoleId!,
                        job_title_id: jobTitleId
                    })));
                if (jtError) throw jtError;
            }

            onSuccess();
            onClose();

        } catch (err: any) {
            console.error("Error saving role:", err);
            setError(err.message || "Erro ao salvar perfil");
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen || !mounted) return null;

    return createPortal(
        <div className="relative z-9999" aria-labelledby="modal-title" role="dialog" aria-modal="true">
            <div className="fixed inset-0 bg-black/50 transition-opacity" onClick={onClose}></div>

            <div className="fixed inset-0 z-10 w-screen overflow-y-auto">
                <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
                    <div
                        className="relative transform overflow-hidden rounded-xl bg-white text-left shadow-2xl transition-all sm:my-8 sm:w-full sm:max-w-5xl"
                        style={{ borderTop: `3px solid ${color}` }}
                    >
                        {/* Header */}
                        <div className="bg-white px-6 pt-5 pb-0">
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-3">
                                    <div
                                        className="w-3 h-3 rounded-full shrink-0"
                                        style={{ backgroundColor: color }}
                                    />
                                    <h3 className="text-lg leading-6 font-semibold text-gray-900" id="modal-title">
                                        {role ? 'Editar Perfil' : 'Novo Perfil'}
                                    </h3>
                                </div>
                                <button
                                    type="button"
                                    onClick={onClose}
                                    className="text-gray-400 hover:text-gray-600 transition-colors"
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>

                            {/* Tabs */}
                            <div className="flex border-b border-gray-200">
                                {TABS.map(tab => (
                                    <button
                                        key={tab.key}
                                        type="button"
                                        onClick={() => setActiveTab(tab.key)}
                                        className={`
                                            flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium transition-all relative
                                            ${activeTab === tab.key
                                                ? 'text-gray-900'
                                                : 'text-gray-500 hover:text-gray-700'
                                            }
                                        `}
                                    >
                                        <span>{tab.icon}</span>
                                        <span>{tab.label}</span>
                                        {tab.key === 'cargos' && selectedJobTitleIds.length > 0 && (
                                            <span className="ml-1 inline-flex items-center justify-center w-5 h-5 text-xs font-bold rounded-full bg-brand/10 text-brand">
                                                {selectedJobTitleIds.length}
                                            </span>
                                        )}
                                        {tab.key === 'dashboards' && selectedDashboardIds.length > 0 && (
                                            <span className="ml-1 inline-flex items-center justify-center w-5 h-5 text-xs font-bold rounded-full bg-blue-50 text-blue-600">
                                                {selectedDashboardIds.length}
                                            </span>
                                        )}
                                        {activeTab === tab.key && (
                                            <span
                                                className="absolute bottom-0 left-0 right-0 h-0.5 rounded-t"
                                                style={{ backgroundColor: color }}
                                            />
                                        )}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Tab Content */}
                        <form id="role-form" onSubmit={handleSubmit}>
                            <div className="px-6 py-5 min-h-[380px] max-h-[60vh] overflow-y-auto">

                                {/* TAB: Geral */}
                                {activeTab === 'geral' && (
                                    <div className="space-y-5 animate-fadeIn">
                                        <div className="grid grid-cols-1 gap-y-4 sm:grid-cols-2 sm:gap-x-4">
                                            <div>
                                                <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">Nome do Perfil</label>
                                                <input
                                                    type="text"
                                                    id="name"
                                                    required
                                                    className="block w-full border border-gray-300 rounded-lg shadow-sm py-2.5 px-3 focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand sm:text-sm transition-shadow"
                                                    value={name}
                                                    onChange={e => setName(e.target.value)}
                                                    placeholder="Ex: Comercial, Financeiro..."
                                                />
                                            </div>
                                            <div>
                                                <label htmlFor="pbiRoles" className="block text-sm font-medium text-gray-700 mb-1">Papéis Power BI (Roles)</label>
                                                <input
                                                    type="text"
                                                    id="pbiRoles"
                                                    placeholder="ex: Sales, Manager (separados por vírgula)"
                                                    className="block w-full border border-gray-300 rounded-lg shadow-sm py-2.5 px-3 focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand sm:text-sm transition-shadow"
                                                    value={pbiRoles}
                                                    onChange={e => setPbiRoles(e.target.value)}
                                                />
                                            </div>
                                        </div>

                                        <div>
                                            <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">Descrição</label>
                                            <textarea
                                                id="description"
                                                rows={3}
                                                className="block w-full border border-gray-300 rounded-lg shadow-sm py-2.5 px-3 focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand sm:text-sm transition-shadow"
                                                value={description}
                                                onChange={e => setDescription(e.target.value)}
                                                placeholder="Descreva as responsabilidades deste perfil..."
                                            />
                                        </div>

                                        {/* Color Picker */}
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2">Cor de Identificação</label>
                                            <div className="flex items-center gap-3">
                                                <div className="flex gap-1.5 flex-wrap">
                                                    {PRESET_COLORS.map(c => (
                                                        <button
                                                            key={c}
                                                            type="button"
                                                            onClick={() => setColor(c)}
                                                            className={`
                                                                w-7 h-7 rounded-full transition-all border-2
                                                                ${color === c ? 'border-gray-800 scale-110 shadow-md' : 'border-transparent hover:scale-105'}
                                                            `}
                                                            style={{ backgroundColor: c }}
                                                            title={c}
                                                        />
                                                    ))}
                                                </div>
                                                <div className="flex items-center gap-2 ml-2 pl-3 border-l border-gray-200">
                                                    <input
                                                        type="color"
                                                        value={color}
                                                        onChange={e => setColor(e.target.value)}
                                                        className="w-8 h-8 rounded-md border border-gray-300 cursor-pointer p-0"
                                                    />
                                                    <span className="text-xs text-gray-400 font-mono">{color}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* TAB: Permissões */}
                                {activeTab === 'permissoes' && (
                                    <div className="space-y-4 animate-fadeIn">
                                        <div className="flex items-center justify-between">
                                            <h4 className="text-sm font-medium text-gray-900">Permissões de Acesso por Módulo</h4>
                                            <div className="flex gap-2">
                                                <button
                                                    type="button"
                                                    onClick={() => handleSelectAllGlobalPermissions(true)}
                                                    className="text-xs text-brand hover:text-brand-dark font-medium px-2 py-1 rounded hover:bg-brand/5 transition-colors"
                                                >
                                                    Marcar Todos
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => handleSelectAllGlobalPermissions(false)}
                                                    className="text-xs text-gray-500 hover:text-gray-700 font-medium px-2 py-1 rounded hover:bg-gray-100 transition-colors"
                                                >
                                                    Desmarcar Todos
                                                </button>
                                            </div>
                                        </div>

                                        <div className="border border-gray-200 rounded-lg overflow-hidden">
                                            <table className="min-w-full divide-y divide-gray-200">
                                                <thead className="bg-gray-50">
                                                    <tr>
                                                        <th scope="col" className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Módulo</th>
                                                        <th scope="col" className="px-3 py-2.5 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-16">Ver</th>
                                                        <th scope="col" className="px-3 py-2.5 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-16">Criar</th>
                                                        <th scope="col" className="px-3 py-2.5 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-16">Editar</th>
                                                        <th scope="col" className="px-3 py-2.5 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-16">Excluir</th>
                                                        <th scope="col" className="px-3 py-2.5 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-20">Ações</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="bg-white divide-y divide-gray-100">
                                                    {[
                                                        { key: 'users', label: 'Usuários', icon: '👤' },
                                                        { key: 'processes', label: 'Processos', icon: '⚙️' },
                                                        { key: 'indicators', label: 'Indicadores', icon: '📈' },
                                                        { key: 'profiles', label: 'Perfis de Acesso', icon: '🛡️' },
                                                        { key: 'contracts', label: 'Contratos', icon: '📄' },
                                                    ].map((module) => {
                                                        const modulePerms = permissions[module.key as keyof AppPermissions] as any;
                                                        const allChecked = modulePerms.view && modulePerms.create && modulePerms.edit && modulePerms.delete;
                                                        return (
                                                            <tr key={module.key} className="hover:bg-gray-50/50 transition-colors">
                                                                <td className="px-4 py-2.5 whitespace-nowrap text-sm font-medium text-gray-900">
                                                                    <span className="mr-1.5">{module.icon}</span>
                                                                    {module.label}
                                                                </td>
                                                                {['view', 'create', 'edit', 'delete'].map((action) => (
                                                                    <td key={action} className="px-3 py-2.5 whitespace-nowrap text-center">
                                                                        <input
                                                                            type="checkbox"
                                                                            className="h-4 w-4 rounded border-gray-300 text-brand focus:ring-brand cursor-pointer"
                                                                            checked={modulePerms[action]}
                                                                            onChange={(e) => handlePermissionChange(module.key as keyof AppPermissions, action, e.target.checked)}
                                                                        />
                                                                    </td>
                                                                ))}
                                                                <td className="px-3 py-2.5 text-center">
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => handleSelectAllPermissions(module.key as keyof AppPermissions, !allChecked)}
                                                                        className={`text-xs px-2 py-0.5 rounded-full transition-colors ${allChecked
                                                                            ? 'bg-green-50 text-green-600 hover:bg-green-100'
                                                                            : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
                                                                        }`}
                                                                    >
                                                                        {allChecked ? '✓ Todos' : 'Todos'}
                                                                    </button>
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                                    {/* CRM — Vendedor */}
                                                    <tr className="hover:bg-gray-50/50 transition-colors bg-blue-50/30">
                                                        <td className="px-4 py-2.5 whitespace-nowrap text-sm font-medium text-gray-900">
                                                            <span className="mr-1.5">🤝</span>
                                                            CRM — Vendedor
                                                        </td>
                                                        {['view', 'create', 'edit', 'delete'].map((action) => (
                                                            <td key={action} className="px-3 py-2.5 whitespace-nowrap text-center">
                                                                <input
                                                                    type="checkbox"
                                                                    className="h-4 w-4 rounded border-gray-300 text-brand focus:ring-brand cursor-pointer"
                                                                    checked={(permissions.crm as any)[action]}
                                                                    onChange={(e) => handlePermissionChange('crm', action, e.target.checked)}
                                                                />
                                                            </td>
                                                        ))}
                                                        <td className="px-3 py-2.5 text-center">
                                                            <button
                                                                type="button"
                                                                onClick={() => handleSelectAllPermissions('crm', !(permissions.crm.view && permissions.crm.create && permissions.crm.edit && permissions.crm.delete))}
                                                                className={`text-xs px-2 py-0.5 rounded-full transition-colors ${
                                                                    permissions.crm.view && permissions.crm.create && permissions.crm.edit && permissions.crm.delete
                                                                        ? 'bg-green-50 text-green-600 hover:bg-green-100'
                                                                        : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
                                                                }`}
                                                            >
                                                                {permissions.crm.view && permissions.crm.create && permissions.crm.edit && permissions.crm.delete ? '✓ Todos' : 'Todos'}
                                                            </button>
                                                        </td>
                                                    </tr>
                                                    {/* CRM — Gestão (BKO/Supervisor) */}
                                                    <tr className="bg-blue-50/30">
                                                        <td className="px-4 py-2.5 whitespace-nowrap text-sm font-medium text-gray-900">
                                                            <span className="mr-1.5">🏢</span>
                                                            CRM — Gestão
                                                        </td>
                                                        <td colSpan={5} className="px-3 py-2.5">
                                                            <div className="flex items-center gap-6 flex-wrap">
                                                                <label className="flex items-center gap-2 cursor-pointer">
                                                                    <input
                                                                        type="checkbox"
                                                                        className="h-4 w-4 rounded border-gray-300 text-brand focus:ring-brand"
                                                                        checked={permissions.crm_admin.view_all}
                                                                        onChange={(e) => handlePermissionChange('crm_admin', 'view_all', e.target.checked)}
                                                                    />
                                                                    <span className="text-sm text-gray-700">Ver todas as vendas</span>
                                                                </label>
                                                                <label className="flex items-center gap-2 cursor-pointer">
                                                                    <input
                                                                        type="checkbox"
                                                                        className="h-4 w-4 rounded border-gray-300 text-brand focus:ring-brand"
                                                                        checked={permissions.crm_admin.manage}
                                                                        onChange={(e) => handlePermissionChange('crm_admin', 'manage', e.target.checked)}
                                                                    />
                                                                    <span className="text-sm text-gray-700">Gerenciar vendas (BKO)</span>
                                                                </label>
                                                                <label className="flex items-center gap-2 cursor-pointer">
                                                                    <input
                                                                        type="checkbox"
                                                                        className="h-4 w-4 rounded border-gray-300 text-brand focus:ring-brand"
                                                                        checked={permissions.crm_admin.configure}
                                                                        onChange={(e) => handlePermissionChange('crm_admin', 'configure', e.target.checked)}
                                                                    />
                                                                    <span className="text-sm text-gray-700">Configurar CRM (planos, cidades)</span>
                                                                </label>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                    <tr className="bg-gray-50/50">
                                                        <td className="px-4 py-2.5 whitespace-nowrap text-sm font-medium text-gray-900">
                                                            <span className="mr-1.5">⚙️</span>
                                                            Configurações
                                                        </td>
                                                        <td colSpan={5} className="px-3 py-2.5 text-left">
                                                            <div className="flex items-center">
                                                                <input
                                                                    type="checkbox"
                                                                    id="perm-settings"
                                                                    className="h-4 w-4 rounded border-gray-300 text-brand focus:ring-brand cursor-pointer mr-2"
                                                                    checked={permissions.organization.manage_settings}
                                                                    onChange={(e) => handlePermissionChange('organization', 'manage_settings', e.target.checked)}
                                                                />
                                                                <label htmlFor="perm-settings" className="text-sm text-gray-700 cursor-pointer">
                                                                    Gerenciar Configurações da Organização
                                                                </label>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                )}

                                {/* TAB: Cargos */}
                                {activeTab === 'cargos' && (
                                    <div className="space-y-4 animate-fadeIn">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <h4 className="text-sm font-medium text-gray-900">Cargos Associados</h4>
                                                <p className="text-xs text-gray-500 mt-0.5">
                                                    Ao associar cargos, os colaboradores com esses cargos receberão este perfil automaticamente.
                                                </p>
                                            </div>
                                            <span className="text-xs font-medium px-2.5 py-1 rounded-full" style={{ backgroundColor: `${color}15`, color }}>
                                                {selectedJobTitleIds.length} selecionados
                                            </span>
                                        </div>

                                        {/* Selected pills */}
                                        {selectedJobTitleIds.length > 0 && (
                                            <div className="flex flex-wrap gap-1.5">
                                                {selectedJobTitleIds.map(id => {
                                                    const jt = allJobTitles.find(j => j.id === id);
                                                    if (!jt) return null;
                                                    return (
                                                        <span
                                                            key={id}
                                                            className="inline-flex items-center gap-1 pl-2.5 pr-1 py-1 rounded-full text-xs font-medium text-white transition-colors"
                                                            style={{ backgroundColor: color }}
                                                        >
                                                            {jt.title}
                                                            <button
                                                                type="button"
                                                                onClick={() => handleJobTitleToggle(id)}
                                                                className="ml-0.5 rounded-full p-0.5 hover:bg-white/20 transition-colors"
                                                            >
                                                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                                                                </svg>
                                                            </button>
                                                        </span>
                                                    );
                                                })}
                                            </div>
                                        )}

                                        {/* Search */}
                                        <div className="relative">
                                            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                            </svg>
                                            <input
                                                type="text"
                                                placeholder="Buscar cargo..."
                                                className="block w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg shadow-sm text-sm focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand transition-shadow"
                                                value={jobTitleSearch}
                                                onChange={e => setJobTitleSearch(e.target.value)}
                                            />
                                        </div>

                                        {/* Grouped list */}
                                        <div className="border border-gray-200 rounded-lg max-h-64 overflow-y-auto divide-y divide-gray-100">
                                            {Object.keys(groupedJobTitles).length === 0 ? (
                                                <div className="p-6 text-sm text-gray-500 text-center">
                                                    {jobTitleSearch ? 'Nenhum cargo encontrado.' : 'Nenhum cargo disponível.'}
                                                </div>
                                            ) : (
                                                Object.entries(groupedJobTitles).map(([dept, titles]) => (
                                                    <div key={dept}>
                                                        <div className="px-3 py-1.5 bg-gray-50 text-xs font-medium text-gray-500 uppercase tracking-wider sticky top-0">
                                                            {dept}
                                                        </div>
                                                        {titles.map(jt => {
                                                            const isSelected = selectedJobTitleIds.includes(jt.id);
                                                            return (
                                                                <label
                                                                    key={jt.id}
                                                                    className={`
                                                                        flex items-center px-4 py-2.5 cursor-pointer transition-colors
                                                                        ${isSelected ? 'bg-brand/5' : 'hover:bg-gray-50'}
                                                                    `}
                                                                >
                                                                    <input
                                                                        type="checkbox"
                                                                        className="h-4 w-4 rounded border-gray-300 text-brand focus:ring-brand mr-3"
                                                                        checked={isSelected}
                                                                        onChange={() => handleJobTitleToggle(jt.id)}
                                                                    />
                                                                    <div className="flex-1 min-w-0">
                                                                        <span className="text-sm text-gray-900">{jt.title}</span>
                                                                        {(jt.sector as any)?.name && (
                                                                            <span className="ml-2 text-xs text-gray-400">• {(jt.sector as any).name}</span>
                                                                        )}
                                                                    </div>
                                                                    {isSelected && (
                                                                        <svg className="w-4 h-4 text-brand shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                                                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                                                        </svg>
                                                                    )}
                                                                </label>
                                                            );
                                                        })}
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* TAB: Dashboards */}
                                {activeTab === 'dashboards' && (
                                    <div className="space-y-5 animate-fadeIn">
                                        {/* Export Toggle */}
                                        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-100">
                                            <div className="flex flex-col">
                                                <span className="text-sm font-medium text-gray-900">Exportar Dados</span>
                                                <span className="text-xs text-gray-500">Permitir que usuários deste perfil exportem dados do Power BI</span>
                                            </div>
                                            <button
                                                type="button"
                                                className={`${canExportData ? 'bg-brand' : 'bg-gray-200'} relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-2`}
                                                role="switch"
                                                aria-checked={canExportData}
                                                onClick={() => setCanExportData(!canExportData)}
                                            >
                                                <span className={`${canExportData ? 'translate-x-5' : 'translate-x-0'} pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out`}></span>
                                            </button>
                                        </div>

                                        {/* Dashboard search */}
                                        <div>
                                            <div className="flex items-center justify-between mb-2">
                                                <label className="block text-sm font-medium text-gray-700">Dashboards Permitidos</label>
                                                <span className="text-xs text-gray-500">{selectedDashboardIds.length} selecionados</span>
                                            </div>
                                            {dashboards.length > 3 && (
                                                <div className="relative mb-2">
                                                    <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                                    </svg>
                                                    <input
                                                        type="text"
                                                        placeholder="Buscar dashboard..."
                                                        className="block w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg shadow-sm text-sm focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand transition-shadow"
                                                        value={dashboardSearch}
                                                        onChange={e => setDashboardSearch(e.target.value)}
                                                    />
                                                </div>
                                            )}
                                            <div className="border border-gray-200 rounded-lg max-h-60 overflow-y-auto divide-y divide-gray-100">
                                                {filteredDashboards.length === 0 ? (
                                                    <div className="p-6 text-sm text-gray-500 text-center">
                                                        {dashboardSearch ? 'Nenhum dashboard encontrado.' : 'Nenhum dashboard disponível.'}
                                                    </div>
                                                ) : (
                                                    filteredDashboards.map(dash => (
                                                        <label
                                                            key={dash.id}
                                                            className={`
                                                                flex items-center px-4 py-3 cursor-pointer transition-colors
                                                                ${selectedDashboardIds.includes(dash.id) ? 'bg-blue-50/50' : 'hover:bg-gray-50'}
                                                            `}
                                                        >
                                                            <input
                                                                type="checkbox"
                                                                className="h-4 w-4 rounded border-gray-300 text-brand focus:ring-brand mr-3"
                                                                checked={selectedDashboardIds.includes(dash.id)}
                                                                onChange={() => handleDashboardToggle(dash.id)}
                                                            />
                                                            <div className="flex-1 min-w-0">
                                                                <span className="text-sm font-medium text-gray-700 block">{dash.name}</span>
                                                                {dash.description && (
                                                                    <span className="text-xs text-gray-500 block mt-0.5">{dash.description}</span>
                                                                )}
                                                            </div>
                                                        </label>
                                                    ))
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Error */}
                            {error && (
                                <div className="mx-6 mb-3 text-red-600 text-sm bg-red-50 p-3 rounded-lg border border-red-100 flex items-center gap-2">
                                    <svg className="w-4 h-4 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                                    </svg>
                                    {error}
                                </div>
                            )}
                        </form>

                        {/* Footer */}
                        <div className="bg-gray-50 px-6 py-3 flex justify-between items-center border-t border-gray-100">
                            <div className="flex items-center gap-2 text-xs text-gray-400">
                                {name && (
                                    <>
                                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
                                        <span>{name}</span>
                                    </>
                                )}
                            </div>
                            <div className="flex gap-3">
                                <button
                                    type="button"
                                    className="inline-flex justify-center rounded-lg border border-gray-300 shadow-sm px-4 py-2 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand transition-colors"
                                    onClick={onClose}
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    form="role-form"
                                    disabled={loading}
                                    className={`inline-flex justify-center rounded-lg border border-transparent shadow-sm px-5 py-2 text-sm font-medium text-white transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand ${loading ? 'opacity-50 cursor-not-allowed' : 'hover:shadow-md'}`}
                                    style={{ backgroundColor: color }}
                                >
                                    {loading ? (
                                        <span className="flex items-center gap-2">
                                            <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                            </svg>
                                            Salvando...
                                        </span>
                                    ) : 'Salvar'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
}
