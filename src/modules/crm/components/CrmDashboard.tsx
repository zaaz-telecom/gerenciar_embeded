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
  Filter,
  DollarSign,
  Briefcase
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

    useEffect(() => {
        (async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return;
            const data = await fetchMySales(session.user.id);
            setSales(data);
            setLoading(false);
        })();
    }, []);

    const filteredSales = useMemo(() => {
        return sales.filter(sale => {
            const matchesSearch = (sale.customer as any)?.name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
                                 (sale.customer as any)?.cpf_cnpj?.includes(searchTerm);
            
            if (!matchesSearch) return false;

            if (activeTab === 'leads') return sale.type === 'lead';
            if (activeTab === 'ativas') return sale.type !== 'lead' && !['instalada', 'cancelada'].includes(sale.status);
            if (activeTab === 'historico') return sale.type !== 'lead' && ['instalada', 'cancelada'].includes(sale.status);
            
            return true;
        });
    }, [sales, activeTab, searchTerm]);

    const stats = useMemo(() => {
        const ativas = sales.filter(s => s.type !== 'lead' && !['instalada', 'cancelada'].includes(s.status)).length;
        const aguardandoInstalacao = sales.filter(s => s.status === 'aprovada').length;
        const leads = sales.filter(s => s.type === 'lead').length;
        const valorTotal = sales
            .filter(s => s.status === 'aprovada' || s.status === 'instalada')
            .reduce((acc, s) => acc + (Number(s.monthly_value) || 0), 0);
        
        return { ativas, aguardandoInstalacao, leads, valorTotal };
    }, [sales]);

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

                        <div className="bg-white rounded-[2rem] p-5 border border-slate-200 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group hidden sm:block">
                            <div className="absolute -right-4 -top-4 w-24 h-24 bg-amber-50 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-700" />
                            <div className="relative z-10">
                                <AlertCircle size={20} className="mb-3 text-amber-500" />
                                <div className="text-3xl font-black text-slate-800">{stats.leads}</div>
                                <div className="text-xs text-slate-400 font-bold uppercase tracking-wider">Leads</div>
                            </div>
                        </div>

                        <div className="bg-white rounded-[2rem] p-5 border border-slate-200 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
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
                        
                        <div className="flex p-1.5 bg-slate-100 rounded-2xl min-w-[300px]">
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
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {filteredSales.map((sale) => (
                            <div key={sale.id} className="group bg-white border border-slate-200/60 rounded-[2.5rem] p-6 shadow-sm hover:shadow-xl hover:border-brand/20 transition-all duration-300 relative overflow-hidden">
                                {/* Card Glass Highlight */}
                                <div className="absolute top-0 right-0 w-32 h-32 bg-slate-50 rounded-full blur-3xl -mr-16 -mt-16 opacity-50 group-hover:bg-brand/5 transition-colors" />
                                
                                <div className="relative z-10">
                                    <div className="flex justify-between items-start mb-6">
                                        <div className="min-w-0 flex-1 pr-4">
                                            <h3 className="text-xl font-black text-slate-900 truncate tracking-tight group-hover:text-brand transition-colors">
                                                {(sale.customer as any)?.name || 'Cliente Sem Nome'}
                                            </h3>
                                            <div className="flex items-center gap-3 mt-2">
                                                <StatusBadge status={sale.status} />
                                                <span className="text-[10px] font-black text-slate-400 bg-slate-50 px-2 py-1 rounded-md uppercase tracking-wider">
                                                    ID: {sale.id.slice(0, 8)}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="w-10 h-10 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-300 group-hover:bg-brand/10 group-hover:text-brand transition-all">
                                            <ChevronRight size={24} />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-6 mb-8">
                                        <div className="space-y-4">
                                            <div className="flex items-center gap-3 text-slate-600">
                                                <div className="w-8 h-8 rounded-xl bg-slate-50 flex items-center justify-center">
                                                    <Clock size={16} className="text-slate-400" />
                                                </div>
                                                <div>
                                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-tighter leading-none mb-1">Criado em</p>
                                                    <p className="text-sm font-bold">{new Date(sale.created_at).toLocaleDateString('pt-BR')}</p>
                                                </div>
                                            </div>

                                            {sale.monthly_value && (
                                                <div className="flex items-center gap-3 text-brand">
                                                    <div className="w-8 h-8 rounded-xl bg-brand/5 flex items-center justify-center">
                                                        <DollarSign size={16} />
                                                    </div>
                                                    <div>
                                                        <p className="text-[10px] font-black text-brand/60 uppercase tracking-tighter leading-none mb-1">Valor Mensal</p>
                                                        <p className="text-sm font-black">{formatCurrency(Number(sale.monthly_value))}</p>
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        <div className="space-y-4">
                                            {sale.plan && (
                                                <div className="flex items-center gap-3 text-slate-600">
                                                    <div className="w-8 h-8 rounded-xl bg-slate-50 flex items-center justify-center">
                                                        <Search size={16} className="text-slate-400" />
                                                    </div>
                                                    <div className="min-w-0">
                                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-tighter leading-none mb-1">Produto</p>
                                                        <p className="text-sm font-bold truncate">{(sale.plan as any).name}</p>
                                                    </div>
                                                </div>
                                            )}

                                            {sale.address && (
                                                <div className="flex items-center gap-3 text-slate-600">
                                                    <div className="w-8 h-8 rounded-xl bg-slate-50 flex items-center justify-center">
                                                        <MapPin size={16} className="text-slate-400" />
                                                    </div>
                                                    <div className="min-w-0">
                                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-tighter leading-none mb-1">Localização</p>
                                                        <p className="text-sm font-bold truncate">{(sale.address as any).neighborhood}</p>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Action Grid */}
                                    <div className="grid grid-cols-3 gap-3">
                                        <a 
                                            href={`tel:${(sale.customer as any)?.phone_1}`}
                                            className="flex flex-col items-center justify-center gap-2 bg-slate-50 text-slate-700 py-4 rounded-[1.5rem] hover:bg-slate-100 transition-colors group/btn"
                                        >
                                            <Phone size={18} className="group-hover/btn:scale-110 transition-transform" />
                                            <span className="text-[10px] font-black uppercase tracking-widest">Ligar</span>
                                        </a>
                                        <a 
                                            href={`https://wa.me/55${(sale.customer as any)?.phone_1?.replace(/\D/g, '')}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex flex-col items-center justify-center gap-2 bg-emerald-50 text-emerald-700 py-4 rounded-[1.5rem] hover:bg-emerald-100 transition-colors group/btn"
                                        >
                                            <MessageCircle size={18} className="group-hover/btn:scale-110 transition-transform" />
                                            <span className="text-[10px] font-black uppercase tracking-widest">WhatsApp</span>
                                        </a>
                                        {sale.address && (
                                            <a 
                                                href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${(sale.address as any).street}, ${(sale.address as any).number}, ${(sale.address as any).neighborhood}, ${(sale.address as any).city_name}`)}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="flex flex-col items-center justify-center gap-2 bg-blue-50 text-blue-700 py-4 rounded-[1.5rem] hover:bg-blue-100 transition-colors group/btn"
                                            >
                                                <MapPin size={18} className="group-hover/btn:scale-110 transition-transform" />
                                                <span className="text-[10px] font-black uppercase tracking-widest">Rota</span>
                                            </a>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
