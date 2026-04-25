import React, { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { fetchCities, fetchStores, fetchPlans, fetchAllCampaigns } from '../../crm/service';
import type { CrmCity, CrmStore, CrmPlan, CrmCampaign } from '../../crm/types';

export default function CrmAdminConfig() {
    const [orgId, setOrgId] = useState('');
    const [cities, setCities] = useState<CrmCity[]>([]);
    const [stores, setStores] = useState<CrmStore[]>([]);
    const [plans, setPlans] = useState<CrmPlan[]>([]);
    const [campaigns, setCampaigns] = useState<CrmCampaign[]>([]);
    const [reasons, setReasons] = useState<any[]>([]);
    const [activeTab, setActiveTab] = useState<'cities'|'stores'|'plans'|'campaigns'|'reasons'>('cities');
    const [loading, setLoading] = useState(true);

    const [newItemName, setNewItemName] = useState('');
    const [newCityState, setNewCityState] = useState('CE');
    const [newPlanTech, setNewPlanTech] = useState<'fibra'|'radio'|'iptv'>('fibra');
    const [newPlanPrice, setNewPlanPrice] = useState('');

    const [newCampPlan, setNewCampPlan] = useState('');
    const [newCampPrice, setNewCampPrice] = useState('');
    const [newCampCities, setNewCampCities] = useState<string[]>([]);
    const [newCampStart, setNewCampStart] = useState('');
    const [newCampEnd, setNewCampEnd] = useState('');

    useEffect(() => {
        (async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return;
            const { data: profile } = await supabase.from('profiles').select('organization_id').eq('id', session.user.id).single();
            if (profile) setOrgId(profile.organization_id);
        })();
    }, []);

    useEffect(() => {
        if (orgId) loadData();
    }, [orgId]);

    const loadData = async () => {
        if (!orgId) return;
        setLoading(true);
        setCities(await fetchCities(orgId));
        setStores(await fetchStores(orgId));
        setPlans(await fetchPlans(orgId));
        setCampaigns(await fetchAllCampaigns(orgId));
        const { data: reasonsData } = await supabase.from('crm_cancellation_reasons').select('*').eq('organization_id', orgId).order('label');
        setReasons(reasonsData || []);
        setLoading(false);
    };

    const handleAddCity = async () => {
        if (!newItemName) return;
        await supabase.from('crm_cities').insert({ organization_id: orgId, name: newItemName, state: newCityState });
        setNewItemName('');
        loadData();
    };

    const handleAddStore = async () => {
        if (!newItemName) return;
        await supabase.from('crm_stores').insert({ organization_id: orgId, name: newItemName });
        setNewItemName('');
        loadData();
    };

    const handleAddPlan = async () => {
        if (!newItemName || !newPlanPrice) return;
        await supabase.from('crm_plans').insert({ 
            organization_id: orgId, 
            name: newItemName, 
            technology: newPlanTech,
            base_price: parseFloat(newPlanPrice)
        });
        setNewItemName('');
        setNewPlanPrice('');
        loadData();
    };

    const handleAddCampaign = async () => {
        if (!newItemName || !newCampPlan || !newCampPrice || !newCampStart || !newCampEnd) return;
        await supabase.from('crm_campaigns').insert({
            organization_id: orgId,
            name: newItemName,
            plan_id: newCampPlan,
            price: parseFloat(newCampPrice),
            city_ids: newCampCities,
            starts_at: newCampStart,
            ends_at: newCampEnd
        });
        setNewItemName('');
        setNewCampPrice('');
        setNewCampCities([]);
        setNewCampStart('');
        setNewCampEnd('');
        loadData();
    };

    const handleAddReason = async () => {
        if (!newItemName) return;
        await supabase.from('crm_cancellation_reasons').insert({ organization_id: orgId, label: newItemName });
        setNewItemName('');
        loadData();
    };

    const toggleStatus = async (table: string, id: string, current: boolean) => {
        await supabase.from(table).update({ is_active: !current }).eq('id', id);
        loadData();
    };

    if (loading) return <div className="p-8 text-center text-gray-500">Carregando configurações...</div>;

    return (
        <div className="max-w-5xl mx-auto space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-gray-900">Configurações Base do CRM</h1>
                <p className="text-sm text-gray-500 mt-1">Gerencie as cidades, lojas, planos e campanhas disponíveis para o módulo CRM PAP.</p>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="border-b border-gray-200 px-6 py-4 flex gap-8">
                <button 
                    onClick={() => setActiveTab('cities')} 
                    className={`font-medium pb-4 -mb-4 border-b-2 text-sm transition-colors ${activeTab === 'cities' ? 'border-brand text-brand' : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'}`}
                >
                    Cidades Cobertas
                </button>
                <button 
                    onClick={() => setActiveTab('stores')} 
                    className={`font-medium pb-4 -mb-4 border-b-2 text-sm transition-colors ${activeTab === 'stores' ? 'border-brand text-brand' : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'}`}
                >
                    Lojas/Operações
                </button>
                <button 
                    onClick={() => setActiveTab('plans')} 
                    className={`font-medium pb-4 -mb-4 border-b-2 text-sm transition-colors ${activeTab === 'plans' ? 'border-brand text-brand' : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'}`}
                >
                    Planos
                </button>
                <button 
                    onClick={() => setActiveTab('campaigns')} 
                    className={`font-medium pb-4 -mb-4 border-b-2 text-sm transition-colors ${activeTab === 'campaigns' ? 'border-brand text-brand' : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'}`}
                >
                    Campanhas
                </button>
                <button 
                    onClick={() => setActiveTab('reasons')} 
                    className={`font-medium pb-4 -mb-4 border-b-2 text-sm transition-colors ${activeTab === 'reasons' ? 'border-brand text-brand' : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'}`}
                >
                    Motivos de Recusa
                </button>
            </div>

            <div className="p-6 bg-gray-50/50">
                {activeTab === 'cities' && (
                    <div className="space-y-6 max-w-3xl mx-auto">
                        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                            <h3 className="text-base font-semibold text-gray-900 border-b border-gray-100 pb-3 mb-4">Adicionar Nova Cidade</h3>
                            <div className="flex gap-4 items-end">
                                <div className="flex-1">
                                    <label className="block text-xs font-medium text-gray-700 mb-1">Nome da Cidade</label>
                                    <input 
                                        type="text" placeholder="Ex: Campinas" value={newItemName} onChange={e => setNewItemName(e.target.value)}
                                        className="block w-full rounded-md border-gray-300 shadow-sm focus:border-brand focus:ring-brand sm:text-sm" 
                                    />
                                </div>
                                <div className="w-24">
                                    <label className="block text-xs font-medium text-gray-700 mb-1">Estado</label>
                                    <select 
                                        value={newCityState} 
                                        onChange={e => setNewCityState(e.target.value)} 
                                        className="block w-full rounded-md border-gray-300 shadow-sm focus:border-brand focus:ring-brand sm:text-sm"
                                    >
                                        <option value="CE">CE</option>
                                        <option value="MA">MA</option>
                                        <option value="PI">PI</option>
                                        <option value="SP">SP</option>
                                    </select>
                                </div>
                                <button onClick={handleAddCity} className="inline-flex justify-center rounded-md border border-transparent bg-brand px-6 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand/90 focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-2">Adicionar</button>
                            </div>
                        </div>
                        <ul className="space-y-3">
                            {cities.map(c => (
                                <li key={c.id} className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 flex justify-between items-center transition-all hover:border-gray-300">
                                    <span className={`text-sm font-medium ${!c.is_active ? 'line-through text-gray-400' : 'text-gray-900'}`}>{c.name} - {c.state}</span>
                                    <button onClick={() => toggleStatus('crm_cities', c.id, c.is_active)} className={`text-sm px-3 py-1.5 rounded-md border font-medium whitespace-nowrap ${c.is_active ? 'text-red-600 border-red-200 hover:bg-red-50' : 'text-emerald-600 border-emerald-200 hover:bg-emerald-50'}`}>{c.is_active ? 'Desativar' : 'Ativar'}</button>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}

                {activeTab === 'stores' && (
                    <div className="space-y-6 max-w-3xl mx-auto">
                        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                            <h3 className="text-base font-semibold text-gray-900 border-b border-gray-100 pb-3 mb-4">Adicionar Nova Loja/Operação</h3>
                            <div className="flex gap-4 items-end">
                                <div className="flex-1">
                                    <label className="block text-xs font-medium text-gray-700 mb-1">Nome da Loja</label>
                                    <input 
                                        type="text" placeholder="Ex: Loja Centro" value={newItemName} onChange={e => setNewItemName(e.target.value)}
                                        className="block w-full rounded-md border-gray-300 shadow-sm focus:border-brand focus:ring-brand sm:text-sm" 
                                    />
                                </div>
                                <button onClick={handleAddStore} className="inline-flex justify-center rounded-md border border-transparent bg-brand px-6 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand/90 focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-2">Adicionar</button>
                            </div>
                        </div>
                        <ul className="space-y-3">
                            {stores.map(s => (
                                <li key={s.id} className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 flex justify-between items-center transition-all hover:border-gray-300">
                                    <span className={`text-sm font-medium ${!s.is_active ? 'line-through text-gray-400' : 'text-gray-900'}`}>{s.name}</span>
                                    <button onClick={() => toggleStatus('crm_stores', s.id, s.is_active)} className={`text-sm px-3 py-1.5 rounded-md border font-medium whitespace-nowrap ${s.is_active ? 'text-red-600 border-red-200 hover:bg-red-50' : 'text-emerald-600 border-emerald-200 hover:bg-emerald-50'}`}>{s.is_active ? 'Desativar' : 'Ativar'}</button>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}

                {activeTab === 'plans' && (
                    <div className="space-y-6 max-w-3xl mx-auto">
                        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                            <h3 className="text-base font-semibold text-gray-900 border-b border-gray-100 pb-3 mb-4">Adicionar Novo Plano</h3>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
                                <div>
                                    <label className="block text-xs font-medium text-gray-700 mb-1">Nome do Plano</label>
                                    <input 
                                        type="text" placeholder="Ex: Fibra 500MB" value={newItemName} onChange={e => setNewItemName(e.target.value)}
                                        className="block w-full rounded-md border-gray-300 shadow-sm focus:border-brand focus:ring-brand sm:text-sm" 
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-700 mb-1">Tecnologia</label>
                                    <select value={newPlanTech} onChange={e => setNewPlanTech(e.target.value as any)} className="block w-full rounded-md border-gray-300 shadow-sm focus:border-brand focus:ring-brand sm:text-sm">
                                        <option value="fibra">Fibra</option>
                                        <option value="radio">Rádio</option>
                                        <option value="iptv">IPTV</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-700 mb-1">Valor Padrão (R$)</label>
                                    <input 
                                        type="number" placeholder="0.00" value={newPlanPrice} onChange={e => setNewPlanPrice(e.target.value)}
                                        className="block w-full rounded-md border-gray-300 shadow-sm focus:border-brand focus:ring-brand sm:text-sm" 
                                    />
                                </div>
                            </div>
                            <div className="flex justify-end mt-4">
                                <button onClick={handleAddPlan} className="inline-flex justify-center rounded-md border border-transparent bg-brand px-6 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand/90 focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-2">Adicionar Plano</button>
                            </div>
                        </div>
                        <ul className="space-y-3">
                            {plans.map(p => (
                                <li key={p.id} className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 flex justify-between items-center transition-all hover:border-gray-300">
                                    <div>
                                        <div className={`text-sm font-medium ${!p.is_active ? 'line-through text-gray-400' : 'text-gray-900'}`}>{p.name}</div>
                                        <div className="text-xs text-gray-500 mt-0.5">{p.technology} • R$ {p.base_price.toFixed(2)}</div>
                                    </div>
                                    <button onClick={() => toggleStatus('crm_plans', p.id, p.is_active)} className={`text-sm px-3 py-1.5 rounded-md border font-medium whitespace-nowrap ${p.is_active ? 'text-red-600 border-red-200 hover:bg-red-50' : 'text-emerald-600 border-emerald-200 hover:bg-emerald-50'}`}>{p.is_active ? 'Desativar' : 'Ativar'}</button>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}

                {activeTab === 'campaigns' && (
                    <div className="space-y-8 max-w-3xl mx-auto">
                        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 space-y-6">
                            <h3 className="text-base font-semibold text-gray-900 border-b border-gray-100 pb-3">Nova Campanha</h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-xs font-medium text-gray-700 mb-1">Nome da Campanha</label>
                                    <input 
                                        type="text" placeholder="ex: Black Friday 500M" value={newItemName} onChange={e => setNewItemName(e.target.value)}
                                        className="block w-full rounded-md border-gray-300 shadow-sm focus:border-brand focus:ring-brand sm:text-sm" 
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-700 mb-1">Plano Base</label>
                                    <select 
                                        value={newCampPlan} onChange={e => setNewCampPlan(e.target.value)} 
                                        className="block w-full rounded-md border-gray-300 shadow-sm focus:border-brand focus:ring-brand sm:text-sm"
                                    >
                                        <option value="" disabled>Selecione o Plano Base</option>
                                        {plans.map(p => <option key={p.id} value={p.id}>{p.name} ({p.technology})</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-700 mb-1">Valor Promocional (R$)</label>
                                    <input 
                                        type="number" placeholder="0.00" value={newCampPrice} onChange={e => setNewCampPrice(e.target.value)}
                                        className="block w-full rounded-md border-gray-300 shadow-sm focus:border-brand focus:ring-brand sm:text-sm" 
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-medium text-gray-700 mb-1">Início</label>
                                        <input 
                                            type="date" value={newCampStart} onChange={e => setNewCampStart(e.target.value)}
                                            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-brand focus:ring-brand sm:text-sm text-gray-700" 
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-gray-700 mb-1">Fim</label>
                                        <input 
                                            type="date" value={newCampEnd} onChange={e => setNewCampEnd(e.target.value)}
                                            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-brand focus:ring-brand sm:text-sm text-gray-700" 
                                        />
                                    </div>
                                </div>
                            </div>
                            
                            <div className="border-t border-gray-100 pt-5">
                                <h4 className="text-sm font-medium text-gray-800 mb-3">Cidades Participantes <span className="text-gray-500 font-normal text-xs ml-1">(Opcional, deixe vazio para todas)</span></h4>
                                <div className="flex flex-wrap gap-3">
                                    {cities.map(city => (
                                        <label key={city.id} className="inline-flex items-center gap-2 bg-gray-50 px-3 py-1.5 rounded-md border border-gray-200 cursor-pointer hover:bg-gray-100 transition-colors">
                                            <input 
                                                type="checkbox" 
                                                className="text-brand rounded border-gray-300 focus:ring-brand shadow-sm"
                                                checked={newCampCities.includes(city.id)}
                                                onChange={(e) => {
                                                    if (e.target.checked) setNewCampCities(prev => [...prev, city.id]);
                                                    else setNewCampCities(prev => prev.filter(id => id !== city.id));
                                                }}
                                            />
                                            <span className="text-sm font-medium text-gray-700">{city.name}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>

                            <div className="flex justify-end pt-4 border-t border-gray-100 mt-6">
                                <button onClick={handleAddCampaign} className="inline-flex justify-center rounded-md border border-transparent bg-brand px-6 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand/90 focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-2">Salvar Campanha</button>
                            </div>
                        </div>

                        <ul className="space-y-4">
                            {campaigns.map(camp => (
                                <li key={camp.id} className="bg-white p-5 rounded-lg shadow-sm border border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-6 transition-all hover:border-gray-300">
                                    <div>
                                        <div className={`text-sm font-semibold ${!camp.is_active ? 'line-through text-gray-400' : 'text-gray-900'}`}>
                                            {camp.name} <span className="text-brand font-bold text-lg ml-2">R$ {camp.price.toFixed(2)}</span>
                                        </div>
                                        <div className="text-xs text-gray-500 mt-1.5 flex flex-wrap gap-x-5 gap-y-2">
                                            <span className="flex items-center gap-1">📦 {camp.plan?.name}</span>
                                            <span className="flex items-center gap-1">🗓️ {new Date(camp.starts_at).toLocaleDateString('pt-BR')} até {new Date(camp.ends_at).toLocaleDateString('pt-BR')}</span>
                                            <span className="flex items-center gap-1">📍 {camp.city_ids && camp.city_ids.length > 0 ? camp.city_ids.length + ' cidades' : 'Todas as cidades'}</span>
                                        </div>
                                    </div>
                                    <button onClick={() => toggleStatus('crm_campaigns', camp.id, camp.is_active)} className={`text-sm px-4 py-2 rounded-md border font-medium whitespace-nowrap shadow-sm transition-colors ${camp.is_active ? 'text-red-600 border-red-200 hover:bg-red-50' : 'text-emerald-600 border-emerald-200 hover:bg-emerald-50'}`}>
                                        {camp.is_active ? 'Desativar Campanha' : 'Ativar Campanha'}
                                    </button>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}

                {activeTab === 'reasons' && (
                    <div className="space-y-6 max-w-3xl mx-auto">
                        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                            <h3 className="text-base font-semibold text-gray-900 border-b border-gray-100 pb-3 mb-4">Adicionar Novo Motivo de Recusa</h3>
                            <div className="flex gap-4 items-end">
                                <div className="flex-1">
                                    <label className="block text-xs font-medium text-gray-700 mb-1">Motivo/Label</label>
                                    <input 
                                        type="text" placeholder="Ex: Cliente já possui plano" value={newItemName} onChange={e => setNewItemName(e.target.value)}
                                        className="block w-full rounded-md border-gray-300 shadow-sm focus:border-brand focus:ring-brand sm:text-sm" 
                                    />
                                </div>
                                <button onClick={handleAddReason} className="inline-flex justify-center rounded-md border border-transparent bg-brand px-6 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand/90 focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-2">Adicionar</button>
                            </div>
                        </div>
                        <ul className="space-y-3">
                            {reasons.map(r => (
                                <li key={r.id} className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 flex justify-between items-center transition-all hover:border-gray-300">
                                    <span className={`text-sm font-medium ${!r.is_active ? 'line-through text-gray-400' : 'text-gray-900'}`}>{r.label}</span>
                                    <button onClick={() => toggleStatus('crm_cancellation_reasons', r.id, r.is_active)} className={`text-sm px-3 py-1.5 rounded-md border font-medium whitespace-nowrap ${r.is_active ? 'text-red-600 border-red-200 hover:bg-red-50' : 'text-emerald-600 border-emerald-200 hover:bg-emerald-50'}`}>{r.is_active ? 'Desativar' : 'Ativar'}</button>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
            </div>
        </div>
        </div>
    );
}
