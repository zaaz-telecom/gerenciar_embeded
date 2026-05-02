import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../../lib/supabase';
import { fetchMySales } from '../service';
import { StatusBadge } from './StatusBadge';
import type { CrmSale, SaleStatus } from '../types';
import { 
  Plus, 
  Phone, 
  MessageCircle, 
  MapPin, 
  Search, 
  TrendingUp, 
  Clock, 
  CheckCircle,
  AlertCircle,
  ChevronRight,
  ChevronLeft,
  Filter,
  DollarSign,
  Briefcase,
  Flame,
  Zap,
  Lightbulb
} from 'lucide-react';

type TabType = 'leads' | 'ativas' | 'historico';

const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { 
        style: 'currency', 
        currency: 'BRL' 
    }).format(value);
};

export default function CrmDashboard() {
    const [sales, setSales] = useState<CrmSale[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<TabType>('ativas');
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    useEffect(() => {
        setCurrentPage(1);
    }, [activeTab, searchTerm]);

    useEffect(() => {
        (async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return;
            const data = await fetchMySales(session.user.id);
            setSales(data);
            setLoading(false);

            // Check for initial tab
            const urlParams = new URLSearchParams(window.location.search);
            const tab = urlParams.get('tab');
            if (tab === 'leads' || tab === 'ativas' || tab === 'historico') {
                setActiveTab(tab as TabType);
            }
        })();
    }, []);


    const isHotLead = (sale: CrmSale) => {
        if (sale.type !== 'lead') return false;
        const createdAt = new Date(sale.created_at);
        const now = new Date();
        const diffInHours = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60);
        return diffInHours < 24 && (sale.status === 'rascunho' || sale.status === 'contato_inicial');
    };

    const filteredSales = useMemo(() => {
        return sales.filter(sale => {
            const matchesSearch = (sale.customer as any)?.name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
                                 (sale.customer as any)?.cpf_cnpj?.includes(searchTerm);
            
            if (!matchesSearch) return false;

            if (activeTab === 'leads') return sale.type === 'lead';
            if (activeTab === 'ativas') return sale.type !== 'lead' && !['instalada', 'cancelada'].includes(sale.status);
            if (activeTab === 'historico') return sale.type !== 'lead' && ['instalada', 'cancelada'].includes(sale.status);
            
            return true;
        }).sort((a, b) => {
            // Hot leads first in the leads tab
            if (activeTab === 'leads') {
                const aHot = isHotLead(a);
                const bHot = isHotLead(b);
                if (aHot && !bHot) return -1;
                if (!aHot && bHot) return 1;
            }
            return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        });
    }, [sales, activeTab, searchTerm]);

    const stats = useMemo(() => {
        const ativas = sales.filter(s => s.type !== 'lead' && !['instalada', 'cancelada'].includes(s.status)).length;
        const aguardandoInstalacao = sales.filter(s => s.status === 'aprovada').length;
        const leads = sales.filter(s => s.type === 'lead').length;
        const hotLeads = sales.filter(s => isHotLead(s)).length;
        const valorTotal = sales
            .filter(s => s.status === 'aprovada' || s.status === 'instalada')
            .reduce((acc, s) => acc + (Number(s.monthly_value) || 0), 0);
        
        return { ativas, aguardandoInstalacao, leads, hotLeads, valorTotal };
    }, [sales]);

    const paginatedSales = useMemo(() => {
        const startIndex = (currentPage - 1) * itemsPerPage;
        return filteredSales.slice(startIndex, startIndex + itemsPerPage);
    }, [filteredSales, currentPage]);

    const totalPages = Math.ceil(filteredSales.length / itemsPerPage);

    if (loading) return (
        <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
            <div className="relative w-12 h-12">
                <div className="absolute inset-0 border-4 border-brand/20 rounded-full"></div>
                <div className="absolute inset-0 border-4 border-brand border-t-transparent rounded-full animate-spin"></div>
            </div>
            <p className="text-sm font-medium text-gray-500 animate-pulse">Carregando painel...</p>
        </div>
    );

    return (
        <div className="min-h-screen bg-[#F8FAFC] pb-20">
            {/* Header Section */}
            <div className="sticky top-0 z-30 bg-white/60 backdrop-blur-2xl border-b border-slate-200/60 px-4 py-4 sm:px-8">
                <div className="max-w-6xl mx-auto space-y-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-2xl font-black text-slate-900 tracking-tight sm:text-3xl">Meu Painel</h1>
                            <p className="text-[11px] uppercase font-black text-brand tracking-[0.2em] mt-1 flex items-center gap-2">
                                <span className="w-2 h-2 bg-brand rounded-full animate-pulse" />
                                CRM Vendedor Ativo
                            </p>
                        </div>
                        <a
                            href="/crm/nova-venda"
                            className="group flex items-center gap-2 bg-brand text-white px-5 py-3 rounded-2xl font-bold shadow-xl shadow-brand/25 hover:shadow-brand/40 hover:-translate-y-0.5 active:translate-y-0 transition-all"
                        >
                            <Plus size={20} strokeWidth={3} className="group-hover:rotate-90 transition-transform" />
                            <span className="hidden sm:inline">Nova Venda</span>
                        </a>
                    </div>

                    {/* KPI Cards Grid */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className="bg-gradient-to-br from-brand to-indigo-600 rounded-[2rem] p-5 text-white shadow-xl shadow-brand/20 relative overflow-hidden group">
                            <div className="absolute -right-4 -top-4 w-24 h-24 bg-white/10 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-700" />
                            <div className="relative z-10">
                                <TrendingUp size={20} className="mb-3 opacity-80" />
                                <div className="text-3xl font-black">{stats.ativas + stats.leads}</div>
                                <div className="text-xs opacity-80 font-bold uppercase tracking-wider">Total Geral</div>
                            </div>
                        </div>

                        <div className="bg-white rounded-[2rem] p-5 border border-slate-200 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
                            <div className="absolute -right-4 -top-4 w-24 h-24 bg-emerald-50 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-700" />
                            <div className="relative z-10">
                                <CheckCircle size={20} className="mb-3 text-emerald-500" />
                                <div className="text-3xl font-black text-slate-800">{stats.aguardandoInstalacao}</div>
                                <div className="text-xs text-slate-400 font-bold uppercase tracking-wider">Para Instalar</div>
                            </div>
                        </div>

                        <div className="bg-white rounded-[2rem] p-5 border border-slate-200 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
                            <div className="absolute -right-4 -top-4 w-24 h-24 bg-orange-50 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-700" />
                            <div className="relative z-10">
                                <div className="flex items-center justify-between mb-3">
                                    <Flame size={20} className="text-orange-500" />
                                    {stats.hotLeads > 0 && (
                                        <span className="bg-orange-500 text-white text-[10px] px-2 py-0.5 rounded-full animate-bounce">URGENTE</span>
                                    )}
                                </div>
                                <div className="text-3xl font-black text-slate-800">{stats.hotLeads}</div>
                                <div className="text-xs text-slate-400 font-bold uppercase tracking-wider">Leads Quentes</div>
                            </div>
                        </div>

                        <div className="bg-white rounded-[2rem] p-5 border border-slate-200 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group hidden lg:block">
                            <div className="absolute -right-4 -top-4 w-24 h-24 bg-blue-50 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-700" />
                            <div className="relative z-10">
                                <DollarSign size={20} className="mb-3 text-brand" />
                                <div className="text-xl font-black text-slate-800 truncate">{formatCurrency(stats.valorTotal)}</div>
                                <div className="text-xs text-slate-400 font-bold uppercase tracking-wider">Faturado</div>
                            </div>
                        </div>
                    </div>

                    {/* Navigation & Search */}
                    <div className="flex flex-col md:flex-row gap-4">
                        <div className="flex-1 relative">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                            <input 
                                type="text"
                                placeholder="Buscar por cliente, CPF..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full bg-slate-100 border-2 border-transparent focus:border-brand/20 focus:bg-white rounded-2xl py-3 pl-12 pr-4 text-sm font-medium transition-all outline-none"
                            />
                        </div>
                        
                        <div className="flex p-1.5 bg-slate-100 rounded-2xl w-full md:w-auto">
                            {(['ativas', 'leads', 'historico'] as const).map((tab) => (
                                <button
                                    key={tab}
                                    onClick={() => setActiveTab(tab)}
                                    className={`flex-1 py-2.5 text-xs font-black rounded-xl transition-all uppercase tracking-widest ${
                                        activeTab === tab 
                                        ? 'bg-white text-brand shadow-md' 
                                        : 'text-slate-500 hover:text-slate-700'
                                    }`}
                                >
                                    {tab === 'ativas' ? 'Vendas' : tab}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Content Section */}
            <div className="max-w-6xl mx-auto p-4 sm:p-8">
                {filteredSales.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-32 text-center space-y-6">
                        <div className="w-24 h-24 bg-white rounded-[2.5rem] shadow-sm flex items-center justify-center text-slate-200 border border-slate-100">
                            <Briefcase size={48} />
                        </div>
                        <div className="max-w-xs">
                            <p className="text-xl font-black text-slate-800">Tudo limpo por aqui!</p>
                            <p className="text-slate-500 mt-2 font-medium">Não encontramos nenhum registro nesta categoria com os filtros atuais.</p>
                        </div>
                    </div>
                ) : (
                    <div className="flex flex-col gap-4">
                        {paginatedSales.map((sale) => {
                            const hot = isHotLead(sale);
                            return (
                                <div key={sale.id} className={`group bg-white border ${hot ? 'border-orange-200 shadow-orange-100/50' : 'border-slate-200/60'} rounded-2xl p-4 md:p-5 shadow-sm hover:shadow-md hover:border-brand/20 transition-all duration-300 relative overflow-hidden flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between`}>
                                    {/* Card Glass Highlight */}
                                    <div className={`absolute top-0 right-0 w-32 h-32 ${hot ? 'bg-orange-50' : 'bg-slate-50'} rounded-full blur-3xl -mr-16 -mt-16 opacity-50 group-hover:bg-brand/5 transition-colors pointer-events-none`} />
                                    
                                    {/* Client Info */}
                                    <div className="relative z-10 flex-1 min-w-0 w-full lg:w-auto">
                                        <div className="flex items-center gap-2 mb-1.5">
                                            {hot && (
                                                <span className="flex items-center gap-1 bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest animate-pulse">
                                                    <Flame size={12} /> Quente
                                                </span>
                                            )}
                                            <h3 className="text-lg font-black text-slate-900 truncate group-hover:text-brand transition-colors">
                                                {(sale.customer as any)?.name || 'Cliente Sem Nome'}
                                            </h3>
                                        </div>
                                        <div className="flex flex-wrap items-center gap-2">
                                            <StatusBadge status={sale.status} />
                                            <span className="text-[10px] font-black text-slate-400 bg-slate-50 px-2 py-1 rounded-md uppercase tracking-wider border border-slate-100">
                                                ID: {sale.id.slice(0, 8)}
                                            </span>
                                            {sale.type === 'lead' && (
                                                <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-1 rounded-md max-w-full truncate flex items-center border border-amber-100/50" title={hot ? "Gatilho de Urgência..." : "Gatilho de Prova Social..."}>
                                                    <Lightbulb size={12} className="inline mr-1 shrink-0" />
                                                    <span className="truncate">{hot ? "Urgência: Podem instalar hoje!" : "Prova Social: Vizinhos já migraram."}</span>
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Details Grid */}
                                    <div className="relative z-10 flex-none grid grid-cols-2 md:flex md:flex-row md:items-center gap-4 w-full lg:w-auto text-sm md:divide-x md:divide-slate-100">
                                        <div className="md:px-4">
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-tighter mb-0.5 flex items-center gap-1"><Clock size={10}/> Criado em</p>
                                            <p className="font-bold text-slate-700">{new Date(sale.created_at).toLocaleDateString('pt-BR')}</p>
                                        </div>
                                        {sale.monthly_value && (
                                            <div className="md:px-4">
                                                <p className="text-[10px] font-black text-brand/60 uppercase tracking-tighter mb-0.5 flex items-center gap-1"><DollarSign size={10}/> Valor</p>
                                                <p className="font-bold text-brand">{formatCurrency(Number(sale.monthly_value))}</p>
                                            </div>
                                        )}
                                        {sale.plan && (
                                            <div className="md:px-4">
                                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-tighter mb-0.5 flex items-center gap-1"><Search size={10}/> Produto</p>
                                                <p className="font-bold text-slate-700 truncate max-w-[120px]" title={(sale.plan as any).name}>{(sale.plan as any).name}</p>
                                            </div>
                                        )}
                                        {sale.address && (
                                            <div className="md:px-4">
                                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-tighter mb-0.5 flex items-center gap-1"><MapPin size={10}/> Bairro</p>
                                                <p className="font-bold text-slate-700 truncate max-w-[120px]" title={(sale.address as any).neighborhood}>{(sale.address as any).neighborhood}</p>
                                            </div>
                                        )}
                                    </div>

                                    {/* Actions Grid */}
                                    <div className="relative z-10 flex-none flex items-center gap-2 w-full lg:w-auto pt-2 lg:pt-0 border-t border-slate-100 lg:border-t-0 mt-2 lg:mt-0 lg:pl-2">
                                        <a href={`tel:${(sale.customer as any)?.phone_1}`} className="flex-1 lg:flex-none p-2.5 bg-slate-50 text-slate-600 rounded-xl hover:bg-slate-100 hover:text-slate-900 transition-colors flex items-center justify-center" title="Ligar">
                                            <Phone size={18} />
                                        </a>
                                        <a href={`https://wa.me/55${(sale.customer as any)?.phone_1?.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer" className="flex-1 lg:flex-none p-2.5 bg-emerald-50 text-emerald-600 rounded-xl hover:bg-emerald-100 hover:text-emerald-700 transition-colors flex items-center justify-center" title="WhatsApp">
                                            <MessageCircle size={18} />
                                        </a>
                                        {sale.type === 'lead' ? (
                                            <a href={`/crm/nova-venda?leadId=${sale.id}`} className="flex-[2] lg:flex-none px-4 py-2.5 bg-brand text-white rounded-xl hover:bg-brand/90 transition-colors shadow-sm flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-wider" title="Converter">
                                                <Zap size={14} className="fill-current" /> <span className="lg:hidden xl:inline">Converter</span>
                                            </a>
                                        ) : sale.address && (
                                            <a href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${(sale.address as any).street}, ${(sale.address as any).number}, ${(sale.address as any).neighborhood}, ${(sale.address as any).city_name}`)}`} target="_blank" rel="noopener noreferrer" className="flex-[2] lg:flex-none px-4 py-2.5 bg-blue-50 text-blue-700 rounded-xl hover:bg-blue-100 hover:text-blue-800 transition-colors flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-wider" title="Rota">
                                                <MapPin size={14} /> <span className="lg:hidden xl:inline">Rota</span>
                                            </a>
                                        )}
                                    </div>
                                </div>
                            );
                        })}

                        {/* Pagination Controls */}
                        {totalPages > 1 && (
                            <div className="mt-8 flex items-center justify-between border-t border-slate-200/60 pt-6">
                                <p className="text-sm text-slate-500 font-medium hidden sm:block">
                                    Mostrando <span className="font-bold text-slate-900">{((currentPage - 1) * itemsPerPage) + 1}</span> até <span className="font-bold text-slate-900">{Math.min(currentPage * itemsPerPage, filteredSales.length)}</span> de <span className="font-bold text-slate-900">{filteredSales.length}</span> registros
                                </p>
                                <div className="flex items-center gap-2 w-full sm:w-auto justify-center">
                                    <button
                                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                        disabled={currentPage === 1}
                                        className="p-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                    >
                                        <ChevronLeft size={20} />
                                    </button>
                                    <div className="flex items-center gap-1 px-2">
                                        {[...Array(totalPages)].map((_, i) => {
                                            const page = i + 1;
                                            if (totalPages > 5 && (page < currentPage - 2 || page > currentPage + 2) && page !== 1 && page !== totalPages) {
                                                if (page === currentPage - 3 || page === currentPage + 3) {
                                                    return <span key={page} className="text-slate-400 px-1">...</span>;
                                                }
                                                return null;
                                            }
                                            return (
                                                <button
                                                    key={page}
                                                    onClick={() => setCurrentPage(page)}
                                                    className={`w-9 h-9 flex items-center justify-center rounded-xl text-sm font-bold transition-all ${
                                                        currentPage === page
                                                        ? 'bg-brand text-white shadow-md shadow-brand/20'
                                                        : 'text-slate-600 hover:bg-slate-100'
                                                    }`}
                                                >
                                                    {page}
                                                </button>
                                            );
                                        })}
                                    </div>
                                    <button
                                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                        disabled={currentPage === totalPages}
                                        className="p-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                    >
                                        <ChevronRight size={20} />
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

