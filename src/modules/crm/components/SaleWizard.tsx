import React, { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { fetchCities, fetchPlans, fetchStores, fetchAddressByCep, searchCustomerByCpf, upsertCustomer, createAddress, createSale, saveDraftLocally, createLead } from '../service';
import type { CrmCity, CrmPlan, CrmStore, SaleWizardData, Technology } from '../types';
import { INITIAL_WIZARD_DATA, TECHNOLOGY_LABELS } from '../types';
import { formatCpfCnpj, formatPhone, formatCep } from '../../../utils/formatters';
import { isValidCpfCnpj } from '../../../utils/validators';

const STEPS = [
    { id: 'lead', title: 'Contato Inicial' },
    { id: 'search', title: 'Busca Cliente' },
    { id: 'data', title: 'Dados' },
    { id: 'address', title: 'Endereço' },
    { id: 'plan', title: 'Plano' },
    { id: 'details', title: 'Detalhes' },
    { id: 'docs', title: 'Documentos' },
    { id: 'review', title: 'Revisão' },
];

export default function SaleWizard() {
    const [currentStep, setCurrentStep] = useState(0);
    const [data, setData] = useState<SaleWizardData>(INITIAL_WIZARD_DATA);
    const [loading, setLoading] = useState(false);
    const [formError, setFormError] = useState('');
    const [orgId, setOrgId] = useState('');
    const [sellerId, setSellerId] = useState('');
    
    // Lookups
    const [cities, setCities] = useState<CrmCity[]>([]);
    const [stores, setStores] = useState<CrmStore[]>([]);
    const [plans, setPlans] = useState<CrmPlan[]>([]);
    
    useEffect(() => {
        (async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return;
            setSellerId(session.user.id);
            const { data: profile } = await supabase.from('profiles').select('organization_id').eq('id', session.user.id).single();
            if (profile) {
                setOrgId(profile.organization_id);
                const [citiesData, storesData, plansData] = await Promise.all([
                    fetchCities(profile.organization_id),
                    fetchStores(profile.organization_id),
                    fetchPlans(profile.organization_id)
                ]);
                setCities(citiesData);
                setStores(storesData);
                setPlans(plansData);


                // Check for lead conversion
                const urlParams = new URLSearchParams(window.location.search);
                const leadId = urlParams.get('leadId');
                if (leadId) {
                    const { data: lead, error: leadErr } = await supabase
                        .from('crm_sales')
                        .select('*, crm_customers(*)')
                        .eq('id', leadId)
                        .single();
                    
                    if (lead) {
                        const customerData = Array.isArray((lead as any).crm_customers) 
                            ? (lead as any).crm_customers[0] 
                            : (lead as any).crm_customers;
                            
                        const plan = plansData.find(p => p.id === lead.plan_id);
                        
                        updateData({
                            customer_name: customerData?.name || '',
                            phone_1: customerData?.phone_1 || '',
                            lead_interest: lead.lead_interest || '',
                            notes: lead.notes || '',
                            plan_id: lead.plan_id || '',
                            technology: plan?.technology || '',
                            monthly_value: plan ? plan.base_price.toString() : '',
                            converted_from_lead_id: lead.id
                        });
                    }
                }
            }
        })();
    }, []);



    const updateData = (fields: Partial<SaleWizardData>) => {
        const newFields = { ...fields };
        if (newFields.cpf_cnpj) newFields.cpf_cnpj = formatCpfCnpj(newFields.cpf_cnpj);
        if (newFields.phone_1) newFields.phone_1 = formatPhone(newFields.phone_1);
        if (newFields.phone_2) newFields.phone_2 = formatPhone(newFields.phone_2);
        if (newFields.zip_code) newFields.zip_code = formatCep(newFields.zip_code);
        setData(prev => ({ ...prev, ...newFields }));
    };

    const handleNext = async () => {
        setFormError('');
        if (currentStep === 0) {
            if (!data.customer_name || !data.phone_1) {
                setFormError('Por favor, preencha Nome e Telefone do contato.');
                return;
            }
        }
        
        if (currentStep === 1) {
            const cleanCpf = data.cpf_cnpj.replace(/\D/g, '');
            if (cleanCpf.length < 11) {
                setFormError('Por favor, informe o CPF/CNPJ completo.');
                return;
            }
            if (!isValidCpfCnpj(data.cpf_cnpj)) {
                setFormError('O CPF/CNPJ informado não é válido. Verifique os números e tente novamente.');
                return;
            }
            // Realiza a busca automática se o usuário apenas clicar em continuar
            setLoading(true);
            const existing = await searchCustomerByCpf(cleanCpf, orgId);
            if (existing) {
                updateData({
                    existingCustomerId: existing.id,
                    customer_name: existing.name,
                    birth_date: existing.birth_date || '',
                    parent_name: existing.parent_name || '',
                    phone_1: existing.phone_1 || data.phone_1,
                    phone_2: existing.phone_2 || '',
                    email: existing.email || '',
                });
            }
            setLoading(false);
        }

        setCurrentStep(p => Math.min(STEPS.length - 1, p + 1));
    };

    const handlePrev = () => {
        setFormError('');
        setCurrentStep(p => Math.max(0, p - 1));
    };

    const handleCepSearch = async () => {
        const cleanCep = data.zip_code.replace(/\D/g, '');
        if (cleanCep.length === 8) {
            setLoading(true);
            const addr = await fetchAddressByCep(cleanCep);
            if (addr) {
                const matchedCity = cities.find(c => c.name.toLowerCase() === addr.localidade.toLowerCase());
                
                if (matchedCity) {
                    updateData({
                        street: addr.logradouro,
                        neighborhood: addr.bairro,
                        city_name: addr.localidade,
                        city_id: matchedCity.id
                    });
                } else {
                    alert(`Atenção: A cidade '${addr.localidade}' retornada pelo CEP não está na sua lista de cidades de cobertura!`);
                    updateData({
                        street: addr.logradouro,
                        neighborhood: addr.bairro,
                        city_name: addr.localidade,
                        city_id: ''
                    });
                }
            }
            setLoading(false);
        }
    };

    const handleCpfSearch = async () => {
        setFormError('');
        const cleanCpf = data.cpf_cnpj.replace(/\D/g, '');
        if (cleanCpf.length >= 11 && orgId) {
            if (!isValidCpfCnpj(data.cpf_cnpj)) {
                setFormError('O CPF/CNPJ informado não é válido.');
                return;
            }
            setLoading(true);
            const existing = await searchCustomerByCpf(cleanCpf, orgId);
            if (existing) {
                updateData({
                    existingCustomerId: existing.id,
                    customer_name: existing.name,
                    birth_date: existing.birth_date || '',
                    parent_name: existing.parent_name || '',
                    phone_1: existing.phone_1,
                    phone_2: existing.phone_2 || '',
                    email: existing.email || '',
                });
            }
            setLoading(false);
            handleNext();
        }
    };

    const handleSubmit = async () => {
        if (!orgId || !sellerId) return;
        setLoading(true);
        try {
            // 1. Upsert Customer
            const customer = await upsertCustomer(orgId, {
                id: data.existingCustomerId,
                cpf_cnpj: data.cpf_cnpj.replace(/\D/g, ''),
                name: data.customer_name,
                birth_date: data.birth_date || undefined,
                parent_name: data.parent_name || undefined,
                phone_1: data.phone_1,
                phone_2: data.phone_2 || undefined,
                email: data.email || undefined,
            });

            // 2. Create Address
            const address = await createAddress({
                customer_id: customer.id,
                zip_code: data.zip_code,
                city_id: data.city_id || undefined,
                city_name: data.city_name,
                neighborhood: data.neighborhood,
                street: data.street,
                number: data.address_number,
                complement: data.complement,
            });

            // 3. Create Sale
            const sale = await createSale(orgId, sellerId, data, customer.id, address.id, 'enviada');

            // 4. If converted from lead, update lead status
            if (data.converted_from_lead_id) {
                await supabase
                    .from('crm_sales')
                    .update({ status: 'aprovada' }) // Mark lead as processed (or similar)
                    .eq('id', data.converted_from_lead_id);
            }


            // 4. Handle docs here if needed
            
            alert('Venda registrada com sucesso!');
            window.location.href = '/crm';
        } catch (e: any) {
            alert('Erro ao salvar: ' + e.message);
        } finally {
            setLoading(false);
        }
    };

    const handleSaveLead = async () => {
        setFormError('');
        if (!orgId || !sellerId) return;
        if (!data.customer_name || !data.phone_1) {
            setFormError('Por favor, preencha o Nome e Telefone do contato.');
            return;
        }
        setLoading(true);
        try {
            await createLead(orgId, sellerId, {
                customer_name: data.customer_name,
                phone_1: data.phone_1,
                city_id: data.city_id || undefined,
                city_name: data.city_id ? cities.find(c => c.id === data.city_id)?.name : undefined,
                lead_interest: data.lead_interest || undefined,
                lead_priority: data.lead_priority || 'media',
                plan_id: data.plan_id || undefined,
                notes: data.notes || undefined,
            });
            alert('Lead salvo com sucesso!');
            window.location.href = '/crm';
        } catch (e: any) {
            alert('Erro ao salvar lead: ' + e.message);
        } finally {
            setLoading(false);
        }
    };

    const handleWhatsappShare = () => {
        const plan = plans.find(p => p.id === data.plan_id);
        const text = `*Resumo da sua Solicitação - TatuTec*\n\n` +
            `*Cliente:* ${data.customer_name}\n` +
            `*CPF/CNPJ:* ${data.cpf_cnpj}\n` +
            `*Endereço:* ${data.street}, ${data.address_number} - ${data.neighborhood}\n` +
            `*Plano:* ${plan?.name || 'Não selecionado'}\n` +
            `*Valor Mensal:* R$ ${data.monthly_value}\n` +
            `*Vencimento:* Dia ${data.due_day}\n\n` +
            `Seus dados foram enviados para análise! Em breve entraremos em contato para agendar a instalação.`;
        
        const encodedText = encodeURIComponent(text);
        const phone = data.phone_1.replace(/\D/g, '');
        window.open(`https://wa.me/55${phone}?text=${encodedText}`, '_blank');
    };

    const saveDraft = async () => {
        try {
            await saveDraftLocally({ id: `draft_${Date.now()}`, ...data });
            alert('Rascunho salvo localmente (offline)!');
        } catch (e) {
            console.error('Save draft error:', e);
        }
    };

    return (
        <div className="w-full max-w-4xl mx-auto p-6 md:p-8 bg-white shadow-sm rounded-xl border border-gray-200">
            {/* Progress */}
            <div className="mb-8">
                <div className="flex justify-between items-center mb-2">
                    {STEPS.map((step, i) => (
                        <div key={step.id} className="flex flex-col items-center flex-1">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${
                                i === currentStep ? 'bg-brand text-white ring-4 ring-brand/20' :
                                i < currentStep ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-400'
                            }`}>
                                {i < currentStep ? '✓' : i + 1}
                            </div>
                            <span className="text-[10px] sm:text-xs mt-2 font-medium text-gray-500 hidden sm:block">{step.title}</span>
                        </div>
                    ))}
                </div>
                <div className="h-2 bg-gray-100 rounded-full w-full overflow-hidden">
                    <div className="h-full bg-brand transition-all duration-300" style={{ width: `${(currentStep / (STEPS.length - 1)) * 100}%` }} />
                </div>
            </div>

            {/* Content */}
            <div className="py-4">
                {currentStep === 0 && (
                    <div className="space-y-4">
                        <h2 className="text-xl font-bold text-gray-900">Contato Inicial (Lead)</h2>
                        <div className="bg-blue-50 border border-blue-100 p-4 rounded-xl mb-4">
                            <p className="text-sm text-blue-800">
                                Preencha os dados iniciais. Se o cliente estiver com pressa, você pode salvar apenas como <strong>Lead</strong> agora e continuar a venda depois.
                            </p>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Nome do Contato *</label>
                            <input
                                type="text"
                                required
                                className="w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:ring-brand focus:border-brand"
                                value={data.customer_name}
                                onChange={e => updateData({ customer_name: e.target.value })}
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
                                    onChange={e => updateData({ phone_1: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Prioridade</label>
                                <select
                                    className="w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:ring-brand focus:border-brand"
                                    value={data.lead_priority}
                                    onChange={e => updateData({ lead_priority: e.target.value as any })}
                                >
                                    <option value="baixa">Baixa</option>
                                    <option value="media">Média</option>
                                    <option value="alta">Alta</option>
                                </select>
                            </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Cidade (Opcional)</label>
                                <select
                                    className="w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:ring-brand focus:border-brand"
                                    value={data.city_id}
                                    onChange={e => updateData({ city_id: e.target.value })}
                                >
                                    <option value="">Selecione...</option>
                                    {cities.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Plano de Interesse</label>
                                <select
                                    className="w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:ring-brand focus:border-brand"
                                    value={data.plan_id}
                                    onChange={e => {
                                        const selectedPlan = plans.find(p => p.id === e.target.value);
                                        updateData({ 
                                            plan_id: e.target.value,
                                            monthly_value: selectedPlan ? selectedPlan.base_price.toString() : ''
                                        });
                                    }}
                                >
                                    <option value="">Selecione um plano...</option>
                                    {plans.map(p => <option key={p.id} value={p.id}>{p.name} - R$ {p.base_price}</option>)}
                                </select>
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Outros Interesses / Detalhes</label>
                            <input
                                type="text"
                                className="w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:ring-brand focus:border-brand"
                                placeholder="Ex: Quer instalar no final de semana"
                                value={data.lead_interest}
                                onChange={e => updateData({ lead_interest: e.target.value })}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Observações Gerais</label>
                            <textarea
                                className="w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:ring-brand focus:border-brand"
                                rows={3}
                                value={data.notes}
                                onChange={e => updateData({ notes: e.target.value })}
                            />
                        </div>
                    </div>
                )}

                {currentStep === 1 && (
                    <div className="space-y-4">
                        <h2 className="text-xl font-bold text-gray-900">Buscar Cliente</h2>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">CPF/CNPJ</label>
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    className="flex-1 rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:ring-brand focus:border-brand"
                                    value={data.cpf_cnpj}
                                    onChange={e => updateData({ cpf_cnpj: e.target.value })}
                                    placeholder="Digite apenas números"
                                />
                                <button
                                    onClick={handleCpfSearch}
                                    disabled={loading || data.cpf_cnpj.replace(/\D/g, '').length < 11}
                                    className="px-4 py-2 bg-brand text-white rounded-md disabled:opacity-50"
                                >
                                    Buscar
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {currentStep === 2 && (
                    <div className="space-y-4">
                        <h2 className="text-xl font-bold text-gray-900">Dados do Cliente</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Nome Completo *</label>
                                <input
                                    type="text"
                                    className="w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:ring-brand focus:border-brand"
                                    value={data.customer_name}
                                    onChange={e => updateData({ customer_name: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">RG</label>
                                <input
                                    type="text"
                                    className="w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:ring-brand focus:border-brand"
                                    value={data.rg || ''}
                                    onChange={e => updateData({ rg: e.target.value })}
                                />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Telefone Principal *</label>
                                <input
                                    type="text"
                                    className="w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:ring-brand focus:border-brand"
                                    value={data.phone_1}
                                    onChange={e => updateData({ phone_1: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Telefone Secundário</label>
                                <input
                                    type="text"
                                    className="w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:ring-brand focus:border-brand"
                                    value={data.phone_2}
                                    onChange={e => updateData({ phone_2: e.target.value })}
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Nome da Mãe</label>
                            <input
                                type="text"
                                className="w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:ring-brand focus:border-brand"
                                value={data.parent_name}
                                onChange={e => updateData({ parent_name: e.target.value })}
                            />
                        </div>
                    </div>
                )}

                {currentStep === 3 && (
                    <div className="space-y-4">
                        <h2 className="text-xl font-bold text-gray-900">Endereço de Instalação</h2>
                        <div className="flex gap-2">
                            <div className="flex-1">
                                <label className="block text-sm font-medium text-gray-700 mb-1">CEP</label>
                                <input
                                    type="text"
                                    className="w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:ring-brand focus:border-brand"
                                    value={data.zip_code}
                                    onChange={e => updateData({ zip_code: e.target.value })}
                                    onBlur={handleCepSearch}
                                />
                            </div>
                            <div className="flex-1">
                                <label className="block text-sm font-medium text-gray-700 mb-1">Cidade</label>
                                <select 
                                    className="w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:ring-brand focus:border-brand"
                                    value={data.city_id}
                                    onChange={e => updateData({ city_id: e.target.value })}
                                >
                                    <option value="">Selecione...</option>
                                    {cities.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                            </div>
                        </div>
                        <div className="grid grid-cols-3 gap-4">
                            <div className="col-span-2">
                                <label className="block text-sm font-medium text-gray-700 mb-1">Logradouro *</label>
                                <input
                                    type="text"
                                    className="w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:ring-brand focus:border-brand"
                                    value={data.street}
                                    onChange={e => updateData({ street: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Número *</label>
                                <input
                                    type="text"
                                    className="w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:ring-brand focus:border-brand"
                                    value={data.address_number}
                                    onChange={e => updateData({ address_number: e.target.value })}
                                />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Bairro *</label>
                                <input
                                    type="text"
                                    className="w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:ring-brand focus:border-brand"
                                    value={data.neighborhood}
                                    onChange={e => updateData({ neighborhood: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Complemento</label>
                                <input
                                    type="text"
                                    className="w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:ring-brand focus:border-brand"
                                    value={data.complement}
                                    onChange={e => updateData({ complement: e.target.value })}
                                />
                            </div>
                        </div>
                        <div className="mt-4">
                            <label className="block text-sm font-medium text-gray-700 mb-1">Loja/Operação</label>
                            <select 
                                className="w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:ring-brand focus:border-brand"
                                value={data.store_id}
                                onChange={e => updateData({ store_id: e.target.value })}
                            >
                                <option value="">Selecione...</option>
                                {stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                            </select>
                        </div>
                    </div>
                )}

                {currentStep === 4 && (
                    <div className="space-y-4">
                        <h2 className="text-xl font-bold text-gray-900">Configuração do Plano</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Tecnologia</label>
                                <select 
                                    className="w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:ring-brand focus:border-brand"
                                    value={data.technology}
                                    onChange={e => updateData({ technology: e.target.value as Technology })}
                                >
                                    <option value="">Selecione...</option>
                                    {Object.entries(TECHNOLOGY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Plano</label>
                                <select 
                                    className="w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:ring-brand focus:border-brand"
                                    value={data.plan_id}
                                    onChange={e => {
                                        const selectedPlan = plans.find(p => p.id === e.target.value);
                                        updateData({ 
                                            plan_id: e.target.value,
                                            monthly_value: selectedPlan ? selectedPlan.base_price.toString() : ''
                                        });
                                    }}
                                >
                                    <option value="">Selecione...</option>
                                    {plans.filter(p => !data.technology || p.technology === data.technology).map(p => (
                                        <option key={p.id} value={p.id}>{p.name} - R$ {p.base_price}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </div>
                )}

                {currentStep === 5 && (
                    <div className="space-y-4">
                        <h2 className="text-xl font-bold text-gray-900">Detalhes Comerciais</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Vencimento</label>
                                <select 
                                    className="w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:ring-brand focus:border-brand"
                                    value={data.due_day}
                                    onChange={e => updateData({ due_day: e.target.value })}
                                >
                                    <option value="">Selecione...</option>
                                    {[5,10,15,20,25].map(d => <option key={d} value={d}>Dia {d}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Origem da Venda</label>
                                <select 
                                    className="w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:ring-brand focus:border-brand"
                                    value={data.lead_source}
                                    onChange={e => updateData({ lead_source: e.target.value })}
                                >
                                    <option value="">Selecione...</option>
                                    <option value="redes_sociais">Redes Sociais</option>
                                    <option value="indicacao">Indicação</option>
                                    <option value="panfleto">Panfleto / Rua</option>
                                    <option value="loja">Passagem na Loja</option>
                                    <option value="telemarketing">Telemarketing</option>
                                    <option value="outros">Outros</option>
                                </select>
                            </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Período de Instalação</label>
                                <select 
                                    className="w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:ring-brand focus:border-brand"
                                    value={data.installation_period}
                                    onChange={e => updateData({ installation_period: e.target.value })}
                                >
                                    <option value="">Selecione...</option>
                                    <option value="manha">Manhã (08h - 12h)</option>
                                    <option value="tarde">Tarde (13h - 18h)</option>
                                    <option value="integral">Integral (Comercial)</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Concorrente Atual</label>
                                <input
                                    type="text"
                                    placeholder="Ex: Vivo, Claro, Provedor Local..."
                                    className="w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:ring-brand focus:border-brand"
                                    value={data.competitor}
                                    onChange={e => updateData({ competitor: e.target.value })}
                                />
                            </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                            <div className="space-y-3">
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        className="h-5 w-5 rounded border-gray-300 text-brand focus:ring-brand"
                                        checked={data.has_comodato}
                                        onChange={e => updateData({ has_comodato: e.target.checked })}
                                    />
                                    <span className="font-medium text-gray-700">Comodato</span>
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        className="h-5 w-5 rounded border-gray-300 text-brand focus:ring-brand"
                                        checked={data.has_installation_fee}
                                        onChange={e => updateData({ has_installation_fee: e.target.checked })}
                                    />
                                    <span className="font-medium text-gray-700">Tem Taxa de Instalação</span>
                                </label>
                            </div>
                            <div className="space-y-3">
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        className="h-5 w-5 rounded border-gray-300 text-brand focus:ring-brand"
                                        checked={data.needs_extra_router}
                                        onChange={e => updateData({ needs_extra_router: e.target.checked })}
                                    />
                                    <span className="font-medium text-gray-700">Precisa de Ponto Extra / Mesh</span>
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        className="h-5 w-5 rounded border-gray-300 text-brand focus:ring-brand"
                                        checked={data.needs_portability}
                                        onChange={e => updateData({ needs_portability: e.target.checked })}
                                    />
                                    <span className="font-medium text-gray-700">Precisa de Portabilidade / Cancelamento</span>
                                </label>
                            </div>
                        </div>
                        <div className="mt-4">
                            <label className="block text-sm font-medium text-gray-700 mb-1">Observações Gerais</label>
                            <textarea
                                className="w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:ring-brand focus:border-brand"
                                rows={3}
                                value={data.notes}
                                onChange={e => updateData({ notes: e.target.value })}
                            />
                        </div>
                    </div>
                )}

                {currentStep === 6 && (
                    <div className="space-y-6">
                        <h2 className="text-xl font-bold text-gray-900">Upload de Documentos</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="border border-gray-200 rounded-xl p-4 bg-gray-50">
                                <label className="block text-sm font-medium text-gray-900 mb-2">RG / CNH</label>
                                <input
                                    type="file"
                                    accept="image/*,.pdf"
                                    className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-brand/10 file:text-brand hover:file:bg-brand/20"
                                    onChange={e => {
                                        const file = e.target.files?.[0];
                                        if (file) updateData({ document_photo_file: file });
                                    }}
                                />
                                <p className="text-xs text-gray-500 mt-2">Envie a foto frente e verso do documento de identificação.</p>
                            </div>
                            <div className="border border-gray-200 rounded-xl p-4 bg-gray-50">
                                <label className="block text-sm font-medium text-gray-900 mb-2">Comprovante de Residência</label>
                                <input
                                    type="file"
                                    accept="image/*,.pdf"
                                    className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-brand/10 file:text-brand hover:file:bg-brand/20"
                                    onChange={e => {
                                        const file = e.target.files?.[0];
                                        if (file) updateData({ address_photo_file: file });
                                    }}
                                />
                                <p className="text-xs text-gray-500 mt-2">Envie uma conta de luz, água ou fatura recente.</p>
                            </div>
                        </div>
                    </div>
                )}

                {currentStep === 7 && (
                    <div className="space-y-6">
                        <h2 className="text-xl font-bold text-gray-900">Revisão Final</h2>
                        <div className="bg-gray-50 rounded-xl p-4 text-sm space-y-3 border border-gray-200">
                            <div>
                                <span className="text-gray-500 block">Cliente:</span>
                                <span className="font-medium text-gray-900">{data.customer_name} ({data.cpf_cnpj})</span>
                            </div>
                            <div>
                                <span className="text-gray-500 block">Endereço:</span>
                                <span className="font-medium text-gray-900">{data.street}, {data.address_number} - {data.neighborhood}</span>
                            </div>
                            <div>
                                <span className="text-gray-500 block">Plano Selecionado:</span>
                                <span className="font-medium text-gray-900">{plans.find(p => p.id === data.plan_id)?.name || 'Não selecionado'} - R$ {data.monthly_value}</span>
                            </div>
                        </div>

                        <button
                            onClick={handleWhatsappShare}
                            className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-green-500 text-white font-bold rounded-xl hover:bg-green-600 transition-all shadow-md hover:shadow-lg active:scale-95"
                        >
                            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.246 2.248 3.484 5.232 3.484 8.412-.003 6.557-5.338 11.892-11.893 11.892-1.997-.001-3.951-.5-5.688-1.448l-6.309 1.656zm6.29-4.143c1.589.943 3.385 1.44 5.212 1.441l.006.003c5.446 0 9.877-4.431 9.88-9.876.002-2.641-1.026-5.124-2.894-6.992-1.868-1.868-4.35-2.895-6.992-2.895-5.445 0-9.877 4.432-9.88 9.878-.001 1.81.474 3.578 1.375 5.12l-.293-.53-1.011 3.693 3.788-.994zm11.366-7.4c-.312-.156-1.848-.912-2.134-1.017-.286-.104-.494-.156-.703.156-.208.312-.807 1.017-.989 1.225-.182.208-.364.234-.676.078-.312-.156-1.318-.486-2.51-1.548-.928-.827-1.554-1.85-1.737-2.162-.182-.312-.02-.481.136-.636.141-.139.312-.364.468-.546.156-.182.208-.312.312-.52.104-.208.052-.39-.026-.546-.078-.156-.703-1.693-.963-2.313-.253-.603-.51-.52-.703-.53-.182-.01-.39-.012-.598-.012-.208 0-.546.078-.832.39-.286.312-1.092 1.067-1.092 2.604s1.118 3.021 1.274 3.229c.156.208 2.199 3.359 5.328 4.71.745.322 1.326.514 1.778.658.748.238 1.428.204 1.966.124.598-.088 1.848-.755 2.108-1.485.26-.73.26-1.353.182-1.485-.077-.13-.286-.208-.598-.364z"/>
                            </svg>
                            Enviar Resumo via WhatsApp
                        </button>
                    </div>
                )}
            </div>

            {formError && (
                <div className="mt-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm font-medium flex items-center gap-2">
                    <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    {formError}
                </div>
            )}

            {/* Actions */}
            <div className="mt-6 flex items-center justify-between pt-4 border-t border-gray-100">
                <button
                    onClick={saveDraft}
                    className="text-sm font-medium text-gray-500 hover:text-gray-700 px-4 py-2 hover:bg-gray-100 rounded-lg transition-colors hidden sm:block"
                >
                    Salvar Rascunho
                </button>
                <div className="flex gap-2 w-full sm:w-auto justify-end flex-wrap">
                    {currentStep > 0 && (
                        <button
                            onClick={handlePrev}
                            className="px-6 py-2 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors"
                        >
                            Voltar
                        </button>
                    )}
                    
                    {currentStep === 0 && (
                        <button
                            onClick={handleSaveLead}
                            disabled={loading}
                            className="px-6 py-2 bg-slate-800 text-white font-medium rounded-lg hover:bg-slate-700 transition-colors shadow-sm disabled:opacity-50"
                        >
                            {loading ? 'Salvando...' : 'Salvar Apenas como Lead'}
                        </button>
                    )}

                    {currentStep < STEPS.length - 1 ? (
                        <button
                            onClick={handleNext}
                            className="px-6 py-2 bg-brand text-white font-medium rounded-lg hover:bg-brand/90 transition-colors shadow-sm"
                        >
                            {currentStep === 0 ? 'Continuar Venda' : 'Continuar'}
                        </button>
                    ) : (
                        <button
                            onClick={handleSubmit}
                            disabled={loading}
                            className="px-6 py-2 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 transition-colors shadow-sm disabled:opacity-50"
                        >
                            {loading ? 'Enviando...' : 'Finalizar Venda'}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
