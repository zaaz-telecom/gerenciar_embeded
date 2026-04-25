import React, { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { fetchCities, createLead } from '../service';
import type { CrmCity } from '../types';
import { formatPhone } from '../../../utils/formatters';

export default function LeadForm() {
    const [loading, setLoading] = useState(false);
    const [orgId, setOrgId] = useState('');
    const [sellerId, setSellerId] = useState('');
    const [cities, setCities] = useState<CrmCity[]>([]);

    const [data, setData] = useState({
        customer_name: '',
        phone_1: '',
        city_id: '',
        lead_interest: '',
        notes: ''
    });

    useEffect(() => {
        (async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return;
            setSellerId(session.user.id);
            const { data: profile } = await supabase.from('profiles').select('organization_id').eq('id', session.user.id).single();
            if (profile) {
                setOrgId(profile.organization_id);
                setCities(await fetchCities(profile.organization_id));
            }
        })();
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!orgId || !sellerId) return;
        
        setLoading(true);
        try {
            await createLead(orgId, sellerId, {
                ...data,
                city_name: cities.find(c => c.id === data.city_id)?.name
            });
            alert('Lead registrado com sucesso!');
            window.location.href = '/crm';
        } catch (err: any) {
            alert('Erro ao registrar lead: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="w-full max-w-2xl mx-auto p-6 md:p-8 bg-white shadow-sm rounded-xl border border-gray-200">
            <h2 className="text-xl font-bold text-gray-900 mb-6">Registrar Novo Lead</h2>
            
            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Nome do Contato *</label>
                    <input
                        type="text"
                        required
                        className="w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:ring-brand focus:border-brand"
                        value={data.customer_name}
                        onChange={e => setData(p => ({ ...p, customer_name: e.target.value }))}
                    />
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">WhatsApp/Telefone *</label>
                        <input
                            type="text"
                            required
                            className="w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:ring-brand focus:border-brand"
                            value={data.phone_1}
                            onChange={e => setData(p => ({ ...p, phone_1: formatPhone(e.target.value) }))}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Cidade (Opcional)</label>
                        <select
                            className="w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:ring-brand focus:border-brand"
                            value={data.city_id}
                            onChange={e => setData(p => ({ ...p, city_id: e.target.value }))}
                        >
                            <option value="">Selecione...</option>
                            {cities.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Nível de Interesse / Produto</label>
                    <input
                        type="text"
                        className="w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:ring-brand focus:border-brand"
                        placeholder="Ex: Muito interessado na Fibra 500MB"
                        value={data.lead_interest}
                        onChange={e => setData(p => ({ ...p, lead_interest: e.target.value }))}
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Observações Gerais</label>
                    <textarea
                        className="w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:ring-brand focus:border-brand"
                        rows={3}
                        value={data.notes}
                        onChange={e => setData(p => ({ ...p, notes: e.target.value }))}
                    />
                </div>

                <div className="pt-4 flex justify-end gap-3">
                    <a href="/crm" className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-md transition-colors font-medium">
                        Cancelar
                    </a>
                    <button
                        type="submit"
                        disabled={loading}
                        className="px-6 py-2 bg-brand text-white font-medium rounded-md hover:bg-brand/90 transition-colors shadow-sm disabled:opacity-50"
                    >
                        {loading ? 'Salvando...' : 'Salvar Lead'}
                    </button>
                </div>
            </form>
        </div>
    );
}
