import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../../lib/supabase';
import { fetchAllSales, updateSaleStatus, updateSaleERP, buildMkCopyText } from '../service';
import { StatusBadge } from './StatusBadge';
import { CancellationModal } from './CancellationModal';
import type { CrmSale, SaleStatus } from '../types';
import { STATUS_LABELS } from '../types';

export default function SalesList() {
    const [currentUserId, setCurrentUserId] = useState('');
    const [orgId, setOrgId] = useState('');
    const [userStoreId, setUserStoreId] = useState<string | null>(null);
    const [userStoreName, setUserStoreName] = useState<string | null>(null);
    const [isAdmin, setIsAdmin] = useState(false);
    const [sales, setSales] = useState<CrmSale[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedSale, setSelectedSale] = useState<CrmSale | null>(null);
    const [filterStatus, setFilterStatus] = useState<string>('');
    const [searchTerm, setSearchTerm] = useState('');

    // Form inputs for ERP
    const [mkContract, setMkContract] = useState('');
    const [mkOs, setMkOs] = useState('');
    const [savingErp, setSavingErp] = useState(false);
    const [isCancellationModalOpen, setIsCancellationModalOpen] = useState(false);

    useEffect(() => {
        (async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                setLoading(false);
                return;
            }
            setCurrentUserId(session.user.id);
            const { data: profile } = await supabase
                .from('profiles')
                .select('organization_id, role, is_super_admin, crm_store_id, crm_store:crm_stores!profiles_crm_store_id_fkey(id, name)')
                .eq('id', session.user.id)
                .single();
            if (profile) {
                setOrgId(profile.organization_id);
                const isAdminUser = (profile as any).is_super_admin || profile.role === 'admin';
                setIsAdmin(isAdminUser);
                const storeId = (profile as any).crm_store_id ?? null;
                const storeName = (profile as any).crm_store?.name ?? null;
                setUserStoreId(storeId);
                setUserStoreName(storeName);
            } else {
                setLoading(false);
            }
        })();
    }, []);

    useEffect(() => {
        if (orgId) loadData();
    }, [orgId, filterStatus, isAdmin, userStoreId]);

    const loadData = async () => {
        if (!orgId) return;
        setLoading(true);
        try {
            const data = await fetchAllSales(orgId, {
                status: filterStatus ? (filterStatus as SaleStatus) : undefined,
                storeId: (!isAdmin && userStoreId) ? userStoreId : undefined,
            });
            setSales(data);
        } catch (error) {
            console.error('Error loading sales:', error);
        } finally {
            setLoading(false);
        }
    };

    const filteredSales = useMemo(() => {
        if (!searchTerm) return sales;
        const lower = searchTerm.toLowerCase();
        return sales.filter(s => {
            const customer = s.customer as any;
            return (
                customer?.name?.toLowerCase().includes(lower) ||
                customer?.cpf_cnpj?.includes(searchTerm) ||
                s.mk_contract_id?.includes(searchTerm)
            );
        });
    }, [sales, searchTerm]);

    const stats = useMemo(() => {
        return {
            total: sales.length,
            enviada: sales.filter(s => s.status === 'enviada').length,
            em_validacao: sales.filter(s => s.status === 'em_validacao').length,
            aprovada: sales.filter(s => s.status === 'aprovada' || s.status === 'instalada').length,
            cancelada: sales.filter(s => s.status === 'cancelada').length,
        };
    }, [sales]);

    const handleSelectSale = (sale: CrmSale) => {
        setSelectedSale(sale);
        setMkContract(sale.mk_contract_id || '');
        setMkOs(sale.mk_os_id || '');
    };

    const handleStatusChange = async (newStatus: SaleStatus, reason?: string) => {
        if (!selectedSale) return;

        if (newStatus === 'cancelada' && !reason) {
            setIsCancellationModalOpen(true);
            return;
        }

        try {
            if (newStatus === 'aprovada') {
                await updateSaleERP(selectedSale.id, mkContract, mkOs);
            }
            await updateSaleStatus(selectedSale.id, newStatus, currentUserId, reason || undefined);
            // Non-blocking notification or custom toast would be better, but sticking to alert for simplicity or replacing with a cleaner state if needed
            loadData();
            setSelectedSale(prev => prev ? { ...prev, status: newStatus } : null);
            setIsCancellationModalOpen(false);
        } catch (e: any) {
            alert('Erro: ' + e.message);
        }
    };

    const handleSaveErpData = async () => {
        if (!selectedSale) return;
        setSavingErp(true);
        try {
            await updateSaleERP(selectedSale.id, mkContract, mkOs);
            loadData();
            setSelectedSale(prev => prev ? { ...prev, mk_contract_id: mkContract, mk_os_id: mkOs } : null);
        } catch (e: any) {
            alert('Erro: ' + e.message);
        } finally {
            setSavingErp(false);
        }
    };

    const handleCopyMkData = async () => {
        if (!selectedSale) return;
        const text = buildMkCopyText(selectedSale);
        try {
            await navigator.clipboard.writeText(text);
            alert('Dados copiados para a área de transferência!');
        } catch (e) {
            alert('Erro ao copiar dados.');
        }
    };

    return (
        <div className="flex flex-col h-[calc(100vh-64px)] bg-gray-50 overflow-hidden">
            {/* Store scope banner */}
            {!isAdmin && userStoreName && (
                <div className="flex items-center gap-2 px-6 py-2.5 bg-brand/5 border-b border-brand/10">
                    <svg className="w-4 h-4 text-brand flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <span className="text-xs font-semibold text-brand">
                        Exibindo vendas da operação: <span className="font-black">{userStoreName}</span>
                    </span>
                </div>
            )}
            {/* KPI Section */}
            <div className="p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 bg-white border-b border-gray-200">
                <div className="bg-brand/5 border border-brand/10 p-4 rounded-2xl">
                    <p className="text-xs font-semibold text-brand uppercase tracking-wider">Total de Vendas</p>
                    <p className="text-2xl font-bold text-gray-900 mt-1">{stats.total}</p>
                </div>
                <div className="bg-blue-50 border border-blue-100 p-4 rounded-2xl">
                    <p className="text-xs font-semibold text-blue-600 uppercase tracking-wider">Novas (Enviadas)</p>
                    <p className="text-2xl font-bold text-gray-900 mt-1">{stats.enviada}</p>
                </div>
                <div className="bg-amber-50 border border-amber-100 p-4 rounded-2xl">
                    <p className="text-xs font-semibold text-amber-600 uppercase tracking-wider">Em Validação</p>
                    <p className="text-2xl font-bold text-gray-900 mt-1">{stats.em_validacao}</p>
                </div>
                <div className="bg-green-50 border border-green-100 p-4 rounded-2xl">
                    <p className="text-xs font-semibold text-green-600 uppercase tracking-wider">Aprovadas/Instaladas</p>
                    <p className="text-2xl font-bold text-gray-900 mt-1">{stats.aprovada}</p>
                </div>
                <div className="bg-red-50 border border-red-100 p-4 rounded-2xl">
                    <p className="text-xs font-semibold text-red-600 uppercase tracking-wider">Canceladas</p>
                    <p className="text-2xl font-bold text-gray-900 mt-1">{stats.cancelada}</p>
                </div>
            </div>

            {/* Main Content Area */}
            <div className="flex flex-1 overflow-hidden">
                {/* List Side */}
                <div className="w-full lg:w-2/5 flex flex-col border-r border-gray-200 bg-white">
                    <div className="p-4 border-b border-gray-100 space-y-3">
                        <div className="flex items-center gap-2">
                            <div className="relative flex-1">
                                <input
                                    type="text"
                                    placeholder="Buscar por cliente, CPF ou contrato..."
                                    className="w-full pl-9 pr-4 py-2 bg-gray-100 border-none rounded-xl text-sm focus:ring-2 focus:ring-brand/20 transition-all"
                                    value={searchTerm}
                                    onChange={e => setSearchTerm(e.target.value)}
                                />
                                <svg className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                </svg>
                            </div>
                            <select
                                className="bg-gray-100 border-none rounded-xl text-sm focus:ring-2 focus:ring-brand/20 py-2 pl-3 pr-8"
                                value={filterStatus}
                                onChange={e => setFilterStatus(e.target.value)}
                            >
                                <option value="">Todos</option>
                                {Object.entries(STATUS_LABELS).map(([k, v]) => (
                                    <option key={k} value={k}>{v}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto custom-scrollbar">
                        {loading ? (
                            <div className="flex flex-col items-center justify-center h-full space-y-3">
                                <div className="animate-spin w-8 h-8 border-4 border-brand border-t-transparent rounded-full" />
                                <p className="text-sm text-gray-500 font-medium">Carregando vendas...</p>
                            </div>
                        ) : filteredSales.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full p-8 text-center">
                                <div className="bg-gray-50 p-4 rounded-full mb-4">
                                    <svg className="w-12 h-12 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                                    </svg>
                                </div>
                                <p className="text-gray-900 font-semibold">Nenhuma venda encontrada</p>
                                <p className="text-sm text-gray-500 mt-1">Tente ajustar seus filtros ou busca.</p>
                            </div>
                        ) : (
                            <div className="divide-y divide-gray-100">
                                {filteredSales.map(sale => (
                                    <div
                                        key={sale.id}
                                        onClick={() => handleSelectSale(sale)}
                                        className={`p-4 cursor-pointer transition-all hover:bg-gray-50 ${
                                            selectedSale?.id === sale.id ? 'bg-brand/5 border-l-4 border-brand' : 'border-l-4 border-transparent'
                                        }`}
                                    >
                                        <div className="flex justify-between items-start mb-2">
                                            <div className="min-w-0 flex-1">
                                                <p className="font-bold text-gray-900 truncate">
                                                    {sale.type === 'lead' ? '🔍 ' : ''}{(sale.customer as any)?.name || 'Cliente sem nome'}
                                                </p>
                                                <p className="text-xs text-gray-500 mt-0.5">{(sale.customer as any)?.cpf_cnpj || 'Sem CPF'}</p>
                                            </div>
                                            <StatusBadge status={sale.status} />
                                        </div>
                                        <div className="flex items-center justify-between mt-3 text-[10px] sm:text-xs text-gray-500 font-medium">
                                            <div className="flex items-center gap-2">
                                                <span className="bg-gray-100 px-2 py-0.5 rounded text-gray-600">📡 {(sale.plan as any)?.name || 'N/A'}</span>
                                                <span>👤 {(sale.seller as any)?.full_name?.split(' ')[0] || 'Vendedor'}</span>
                                            </div>
                                            <span>{new Date(sale.created_at).toLocaleDateString('pt-BR')}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Detail Side */}
                <div className="hidden lg:flex lg:w-3/5 bg-gray-50/50 flex-col overflow-hidden">
                    {!selectedSale ? (
                        <div className="flex-1 flex flex-col items-center justify-center text-gray-400 p-8 text-center">
                            <div className="bg-white p-6 rounded-3xl shadow-sm mb-6 border border-gray-100">
                                <svg className="w-16 h-16 text-brand/20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                            </div>
                            <h3 className="text-lg font-bold text-gray-900">Detalhes da Venda</h3>
                            <p className="max-w-xs mt-2 text-sm">Selecione um registro na lista ao lado para gerenciar os detalhes e status da venda.</p>
                        </div>
                    ) : (
                        <div className="flex-1 overflow-y-auto p-8 space-y-8 custom-scrollbar">
                            {/* Header Card */}
                            <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 bg-brand/10 rounded-2xl flex items-center justify-center text-brand">
                                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                        </svg>
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-black text-gray-900">{(selectedSale.customer as any)?.name}</h3>
                                        <div className="flex items-center gap-3 mt-1">
                                            <span className="text-sm font-medium text-gray-500">{(selectedSale.customer as any)?.cpf_cnpj}</span>
                                            <StatusBadge status={selectedSale.status} />
                                        </div>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Protocolo CRM</p>
                                    <p className="text-sm font-mono text-gray-900">#{selectedSale.id.split('-')[0].toUpperCase()}</p>
                                </div>
                            </div>

                            {/* BKO Actions Panel */}
                            <div className="bg-white border border-gray-100 rounded-3xl p-6 shadow-sm space-y-6 relative overflow-hidden">
                                <div className="relative z-10">
                                    <div className="flex items-center gap-2 mb-4">
                                        <div className="w-2 h-2 bg-brand rounded-full animate-pulse"></div>
                                        <h4 className="text-xs font-bold uppercase tracking-[0.2em] text-gray-400">Painel de Controle BKO</h4>
                                    </div>
                                    
                                    <div className="flex flex-wrap gap-3">
                                        {['enviada', 'em_validacao'].includes(selectedSale.status) && (
                                            <>
                                                {selectedSale.status === 'enviada' && (
                                                    <button onClick={() => handleStatusChange('em_validacao')} className="px-4 py-2 bg-gray-50 hover:bg-gray-100 border border-gray-200 text-gray-700 text-sm font-bold rounded-xl transition-all flex items-center gap-2">
                                                        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" /></svg>
                                                        Iniciar Validação
                                                    </button>
                                                )}
                                                <button 
                                                    onClick={() => handleStatusChange('aprovada')} 
                                                    disabled={!mkContract.trim() || !mkOs.trim()}
                                                    title={(!mkContract.trim() || !mkOs.trim()) ? "Preencha o Contrato MK e a O.S. para aprovar" : ""}
                                                    className="px-5 py-2 bg-emerald-500 hover:bg-emerald-600 disabled:bg-gray-300 disabled:cursor-not-allowed disabled:shadow-none text-white text-sm font-black rounded-xl transition-all shadow-lg shadow-emerald-100 flex items-center gap-2"
                                                >
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                                                    Aprovar Venda
                                                </button>
                                                <button onClick={() => handleStatusChange('cancelada')} className="px-4 py-2 bg-white hover:bg-red-50 border border-red-100 text-red-600 text-sm font-bold rounded-xl transition-all">
                                                    Recusar/Cancelar
                                                </button>
                                            </>
                                        )}
                                        {selectedSale.status === 'aprovada' && (
                                            <>
                                                <button onClick={() => handleStatusChange('instalada')} className="px-5 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-black rounded-xl transition-all shadow-lg shadow-emerald-100 flex items-center gap-2">
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                                    Confirmar Instalação
                                                </button>
                                                <button onClick={() => handleStatusChange('cancelada')} className="px-4 py-2 bg-white hover:bg-red-50 border border-red-100 text-red-600 text-sm font-bold rounded-xl transition-all">
                                                    Cancelar
                                                </button>
                                            </>
                                        )}
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6 pt-6 border-t border-gray-50">
                                        <div className="space-y-2">
                                            <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400">Contrato MK</label>
                                            <input
                                                type="text"
                                                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-900 focus:bg-white focus:ring-2 focus:ring-brand/10 focus:border-brand focus:outline-none transition-all placeholder-gray-400"
                                                value={mkContract}
                                                onChange={e => setMkContract(e.target.value)}
                                                placeholder="ID do Contrato"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400">Ordem de Serviço</label>
                                            <div className="flex gap-2">
                                                <input
                                                    type="text"
                                                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-900 focus:bg-white focus:ring-2 focus:ring-brand/10 focus:border-brand focus:outline-none transition-all placeholder-gray-400"
                                                    value={mkOs}
                                                    onChange={e => setMkOs(e.target.value)}
                                                    placeholder="ID da O.S."
                                                />
                                                <button
                                                    onClick={handleSaveErpData}
                                                    disabled={savingErp}
                                                    className="px-6 bg-brand hover:bg-brand-dark text-white font-bold rounded-xl transition-all shadow-lg shadow-brand/20 disabled:opacity-50"
                                                >
                                                    {savingErp ? '...' : 'Salvar'}
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Detailed Info Sections */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm space-y-4">
                                    <h4 className="text-sm font-bold text-gray-900 border-b border-gray-50 pb-2">Informações do Cliente</h4>
                                    <div className="space-y-4">
                                        <div className="group relative">
                                            <p className="text-[10px] font-bold text-gray-400 uppercase flex items-center justify-between">
                                                Nome Completo
                                                <button onClick={() => navigator.clipboard.writeText((selectedSale.customer as any)?.name)} className="opacity-0 group-hover:opacity-100 text-brand p-1.5 hover:bg-brand/10 rounded-lg transition-all shadow-sm bg-white border border-gray-100">
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" /></svg>
                                                </button>
                                            </p>
                                            <p className="text-sm font-medium text-gray-700">{(selectedSale.customer as any)?.name}</p>
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="group">
                                                <p className="text-[10px] font-bold text-gray-400 uppercase flex items-center justify-between">
                                                    CPF/CNPJ
                                                    <button onClick={() => navigator.clipboard.writeText((selectedSale.customer as any)?.cpf_cnpj)} className="opacity-0 group-hover:opacity-100 text-brand p-1.5 hover:bg-brand/10 rounded-lg transition-all shadow-sm bg-white border border-gray-100">
                                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" /></svg>
                                                    </button>
                                                </p>
                                                <p className="text-sm font-medium text-gray-700">{(selectedSale.customer as any)?.cpf_cnpj}</p>
                                            </div>
                                            <div className="group">
                                                <p className="text-[10px] font-bold text-gray-400 uppercase flex items-center justify-between">
                                                    Telefone
                                                    <button onClick={() => navigator.clipboard.writeText((selectedSale.customer as any)?.phone_1)} className="opacity-0 group-hover:opacity-100 text-brand p-1.5 hover:bg-brand/10 rounded-lg transition-all shadow-sm bg-white border border-gray-100">
                                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" /></svg>
                                                    </button>
                                                </p>
                                                <p className="text-sm font-medium text-gray-700">{(selectedSale.customer as any)?.phone_1}</p>
                                            </div>
                                        </div>
                                        <div className="group">
                                            <p className="text-[10px] font-bold text-gray-400 uppercase flex items-center justify-between">
                                                Endereço Completo
                                                <button 
                                                    onClick={() => {
                                                        const addr = selectedSale.address as any;
                                                        navigator.clipboard.writeText(`${addr.street}, ${addr.number} - ${addr.neighborhood}, ${addr.city_name}`);
                                                    }} 
                                                    className="opacity-0 group-hover:opacity-100 text-brand p-1.5 hover:bg-brand/10 rounded-lg transition-all shadow-sm bg-white border border-gray-100"
                                                >
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" /></svg>
                                                </button>
                                            </p>
                                            <p className="text-sm font-medium text-gray-700">
                                                {(selectedSale.address as any)?.street}, {(selectedSale.address as any)?.number}
                                            </p>
                                            <p className="text-xs text-gray-500">
                                                {(selectedSale.address as any)?.neighborhood}, {(selectedSale.address as any)?.city_name}
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm space-y-4">
                                    <h4 className="text-sm font-bold text-gray-900 border-b border-gray-50 pb-2">Comercial & Origem</h4>
                                    <div className="space-y-3">
                                        <div className="group">
                                            <p className="text-[10px] font-bold text-gray-400 uppercase flex items-center justify-between">
                                                Vendedor
                                                <button onClick={() => navigator.clipboard.writeText((selectedSale.seller as any)?.full_name)} className="opacity-0 group-hover:opacity-100 text-brand p-1.5 hover:bg-brand/10 rounded-lg transition-all shadow-sm bg-white border border-gray-100">
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" /></svg>
                                                </button>
                                            </p>
                                            <p className="text-sm font-medium text-gray-700">{(selectedSale.seller as any)?.full_name}</p>
                                            <p className="text-xs text-gray-500">Loja: {(selectedSale.store as any)?.name || 'N/A'}</p>
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-bold text-gray-400 uppercase">Concorrente Citado</p>
                                            <p className="text-sm font-medium text-brand">{(selectedSale as any).competitor || 'Nenhum'}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Plan Detail Card */}
                            <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm">
                                <h4 className="text-sm font-bold text-gray-900 border-b border-gray-50 pb-2 mb-4">Plano Escolhido</h4>
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <div className="p-3 bg-brand/5 rounded-2xl text-brand">
                                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                            </svg>
                                        </div>
                                        <div>
                                            <p className="text-lg font-black text-gray-900">{(selectedSale.plan as any)?.name}</p>
                                            <p className="text-sm text-gray-500 uppercase font-bold tracking-wider">{(selectedSale as any).technology} • R$ {selectedSale.monthly_value?.toFixed(2)}/mês</p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[10px] font-bold text-gray-400 uppercase">Vencimento</p>
                                        <p className="text-lg font-bold text-gray-900">Dia {selectedSale.due_day}</p>
                                    </div>
                                </div>
                            </div>

                            {selectedSale.notes && (
                                <div className="bg-amber-50 rounded-3xl p-6 border border-amber-100 shadow-sm">
                                    <h4 className="text-xs font-bold text-amber-900 uppercase tracking-widest mb-2">Observações Importantes</h4>
                                    <p className="text-sm text-amber-800 leading-relaxed whitespace-pre-wrap">{selectedSale.notes}</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            <CancellationModal
                isOpen={isCancellationModalOpen}
                onClose={() => setIsCancellationModalOpen(false)}
                onConfirm={(reason) => handleStatusChange('cancelada', reason)}
                orgId={orgId}
            />

            <style dangerouslySetInnerHTML={{ __html: `
                .custom-scrollbar::-webkit-scrollbar {
                    width: 6px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: transparent;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: #e2e8f0;
                    border-radius: 10px;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                    background: #cbd5e1;
                }
            `}} />
        </div>
    );
}
