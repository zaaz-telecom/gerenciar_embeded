import { supabase } from '../../lib/supabase';
import type {
    CrmSale, CrmCustomer, CrmCity, CrmPlan, CrmCampaign,
    CrmStore, SaleWizardData, SaleStatus, CrmStatusLog, CrmComment
} from './types';

// ─── Customer ────────────────────────────────────────────────────────────────

export async function searchCustomerByCpf(cpf: string, orgId: string): Promise<CrmCustomer | null> {
    const clean = cpf.replace(/\D/g, '');
    const { data } = await supabase
        .from('crm_customers')
        .select('*')
        .eq('organization_id', orgId)
        .eq('cpf_cnpj', clean)
        .single();
    return data ?? null;
}

export async function upsertCustomer(
    orgId: string,
    data: Partial<CrmCustomer> & { cpf_cnpj: string; name: string; phone_1: string }
): Promise<CrmCustomer> {
    const { data: result, error } = await supabase
        .from('crm_customers')
        .upsert({ ...data, organization_id: orgId, cpf_cnpj: data.cpf_cnpj.replace(/\D/g, '') }, {
            onConflict: 'organization_id,cpf_cnpj',
        })
        .select()
        .single();
    if (error) throw error;
    return result;
}

// ─── Address ─────────────────────────────────────────────────────────────────

export async function createAddress(data: {
    customer_id: string;
    zip_code?: string;
    city_id?: string;
    city_name?: string;
    neighborhood?: string;
    street?: string;
    number?: string;
    complement?: string;
}) {
    const { data: result, error } = await supabase
        .from('crm_customer_addresses')
        .insert(data)
        .select()
        .single();
    if (error) throw error;
    return result;
}

// ─── Sales ───────────────────────────────────────────────────────────────────

export async function createSale(
    orgId: string,
    sellerId: string,
    wizardData: SaleWizardData,
    customerId: string,
    addressId: string,
    status: SaleStatus = 'enviada'
): Promise<CrmSale> {
    const { data, error } = await supabase
        .from('crm_sales')
        .insert({
            organization_id: orgId,
            type: 'adesao',
            status,
            seller_id: sellerId,
            store_id: wizardData.store_id || null,
            customer_id: customerId,
            address_id: addressId,
            plan_id: wizardData.plan_id || null,
            campaign_id: wizardData.campaign_id || null,
            selected_svas: wizardData.selected_svas,
            sale_type: wizardData.sale_type || null,
            technology: wizardData.technology || null,
            monthly_value: wizardData.monthly_value ? parseFloat(wizardData.monthly_value) : null,
            due_day: wizardData.due_day ? parseInt(wizardData.due_day) : null,
            has_comodato: wizardData.has_comodato,
            has_installation_fee: wizardData.has_installation_fee,
            service_user: wizardData.service_user || null,
            sale_date: new Date().toISOString().split('T')[0],
            notes: wizardData.notes || null,
            competitor: wizardData.competitor || null,
            lead_source: wizardData.lead_source || null,
            installation_period: wizardData.installation_period || null,
            needs_extra_router: wizardData.needs_extra_router,
            needs_portability: wizardData.needs_portability,
        })
        .select()
        .single();
    if (error) throw error;

    // Log initial status
    await logStatusChange(data.id, sellerId, null, status);

    return data;
}

export async function createLead(
    orgId: string,
    sellerId: string,
    payload: {
        customer_name: string;
        phone_1: string;
        city_id?: string;
        city_name?: string;
        lead_interest?: string;
        notes?: string;
    }
): Promise<CrmSale> {
    // Create a minimal customer record for the lead
    const { data: customer, error: custErr } = await supabase
        .from('crm_customers')
        .insert({
            organization_id: orgId,
            cpf_cnpj: `lead_${Date.now()}`, // placeholder — updated when converted
            name: payload.customer_name,
            phone_1: payload.phone_1,
        })
        .select()
        .single();
    if (custErr) throw custErr;

    const { data, error } = await supabase
        .from('crm_sales')
        .insert({
            organization_id: orgId,
            type: 'lead',
            status: 'enviada',
            seller_id: sellerId,
            customer_id: customer.id,
            lead_interest: payload.lead_interest || null,
            notes: payload.notes || null,
        })
        .select()
        .single();
    if (error) throw error;
    await logStatusChange(data.id, sellerId, null, 'enviada');
    return data;
}

export async function fetchMySales(sellerId: string): Promise<CrmSale[]> {
    const { data, error } = await supabase
        .from('crm_sales')
        .select(`
            *,
            customer:crm_customers(id, name, cpf_cnpj, phone_1),
            address:crm_customer_addresses(id, city_name, neighborhood, street, number, complement),
            plan:crm_plans(id, name, technology),
            store:crm_stores(id, name),
            campaign:crm_campaigns(id, name, price),
            bko_user:profiles!crm_sales_bko_user_id_fkey(id, full_name)
        `)
        .eq('seller_id', sellerId)
        .order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []) as unknown as CrmSale[];
}

export async function fetchAllSales(orgId: string, filters?: {
    status?: SaleStatus;
    sellerId?: string;
    storeId?: string;
    dateFrom?: string;
    dateTo?: string;
    search?: string;
}): Promise<CrmSale[]> {
    let query = supabase
        .from('crm_sales')
        .select(`
            *,
            seller:profiles!crm_sales_seller_id_fkey(id, full_name, employee_id),
            customer:crm_customers(id, name, cpf_cnpj, phone_1, email),
            address:crm_customer_addresses(id, city_name, neighborhood, street, number),
            plan:crm_plans(id, name, technology, base_price),
            store:crm_stores(id, name),
            campaign:crm_campaigns(id, name, price),
            bko_user:profiles!crm_sales_bko_user_id_fkey(id, full_name)
        `)
        .eq('organization_id', orgId)
        .order('created_at', { ascending: false });

    if (filters?.status) query = query.eq('status', filters.status);
    if (filters?.sellerId) query = query.eq('seller_id', filters.sellerId);
    if (filters?.storeId) query = query.eq('store_id', filters.storeId);
    if (filters?.dateFrom) query = query.gte('created_at', filters.dateFrom);
    if (filters?.dateTo) query = query.lte('created_at', filters.dateTo + 'T23:59:59');

    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []) as unknown as CrmSale[];
}

export async function fetchSaleById(id: string): Promise<CrmSale | null> {
    const { data, error } = await supabase
        .from('crm_sales')
        .select(`
            *,
            seller:profiles!crm_sales_seller_id_fkey(id, name, employee_id),
            customer:crm_customers(*),
            address:crm_customer_addresses(*),
            plan:crm_plans(*),
            store:crm_stores(*),
            campaign:crm_campaigns(*, plan:crm_plans(*)),
            bko_user:profiles!crm_sales_bko_user_id_fkey(id, name)
        `)
        .eq('id', id)
        .single();
    if (error) return null;
    return data as unknown as CrmSale;
}

export async function updateSaleStatus(
    saleId: string,
    newStatus: SaleStatus,
    changedById: string,
    reason?: string,
    comment?: string
): Promise<void> {
    const { data: current } = await supabase
        .from('crm_sales')
        .select('status, seller_id, organization_id')
        .eq('id', saleId)
        .single();

    const updatePayload: Record<string, unknown> = { status: newStatus };
    if (newStatus === 'em_validacao' || newStatus === 'aprovada' || newStatus === 'instalada') {
        updatePayload.bko_user_id = changedById;
    }

    const { error } = await supabase
        .from('crm_sales')
        .update(updatePayload)
        .eq('id', saleId);
    if (error) throw error;

    await logStatusChange(saleId, changedById, current?.status ?? null, newStatus, reason, comment);

    // Send notification to seller
    if (current?.seller_id && ['aprovada', 'cancelada', 'instalada'].includes(newStatus)) {
        const statusMessages: Partial<Record<SaleStatus, string>> = {
            aprovada: 'Sua venda foi aprovada! ✅',
            cancelada: `Sua venda foi cancelada.${reason ? ` Motivo: ${reason}` : ''}`,
            instalada: 'Instalação confirmada! Venda concluída. 🎉',
        };
        await sendNotification(
            current.seller_id,
            saleId,
            statusMessages[newStatus] ?? `Status atualizado: ${newStatus}`,
            reason
        );
    }
}

export async function updateSaleERP(
    saleId: string,
    mkContractId: string,
    mkOsId: string
): Promise<void> {
    const { error } = await supabase
        .from('crm_sales')
        .update({ mk_contract_id: mkContractId, mk_os_id: mkOsId })
        .eq('id', saleId);
    if (error) throw error;
}

// ─── Status Log ──────────────────────────────────────────────────────────────

async function logStatusChange(
    saleId: string,
    changedBy: string,
    fromStatus: string | null,
    toStatus: string,
    reason?: string,
    comment?: string
) {
    await supabase.from('crm_status_log').insert({
        sale_id: saleId,
        from_status: fromStatus,
        to_status: toStatus,
        changed_by: changedBy,
        reason: reason ?? null,
        comment: comment ?? null,
    });
}

export async function fetchStatusLog(saleId: string): Promise<CrmStatusLog[]> {
    const { data } = await supabase
        .from('crm_status_log')
        .select('*, changer:profiles!crm_status_log_changed_by_fkey(id, full_name)')
        .eq('sale_id', saleId)
        .order('created_at', { ascending: true });
    return (data ?? []) as unknown as CrmStatusLog[];
}

// ─── Comments ─────────────────────────────────────────────────────────────────

export async function fetchComments(saleId: string): Promise<CrmComment[]> {
    const { data } = await supabase
        .from('crm_comments')
        .select('*, author:profiles!crm_comments_author_id_fkey(id, full_name)')
        .eq('sale_id', saleId)
        .order('created_at', { ascending: true });
    return (data ?? []) as unknown as CrmComment[];
}

export async function addComment(saleId: string, authorId: string, content: string): Promise<CrmComment> {
    const { data, error } = await supabase
        .from('crm_comments')
        .insert({ sale_id: saleId, author_id: authorId, content })
        .select('*, author:profiles!crm_comments_author_id_fkey(id, full_name)')
        .single();
    if (error) throw error;
    return data as unknown as CrmComment;
}

// ─── Notifications ────────────────────────────────────────────────────────────

async function sendNotification(userId: string, saleId: string, title: string, body?: string) {
    await supabase.from('crm_notifications').insert({
        user_id: userId,
        sale_id: saleId,
        title,
        body: body ?? null,
        type: 'status_change',
    });
}

export async function fetchCrmNotifications(userId: string) {
    const { data } = await supabase
        .from('crm_notifications')
        .select('*')
        .eq('user_id', userId)
        .eq('is_read', false)
        .order('created_at', { ascending: false })
        .limit(20);
    return data ?? [];
}

export async function markCrmNotificationsRead(userId: string) {
    await supabase
        .from('crm_notifications')
        .update({ is_read: true })
        .eq('user_id', userId)
        .eq('is_read', false);
}

// ─── Cities / Plans / Campaigns ───────────────────────────────────────────────

export async function fetchCities(orgId: string): Promise<CrmCity[]> {
    const { data } = await supabase
        .from('crm_cities')
        .select('*, store:crm_stores(id, name)')
        .eq('organization_id', orgId)
        .eq('is_active', true)
        .order('name');
    return (data ?? []) as unknown as CrmCity[];
}

export async function fetchStores(orgId: string): Promise<CrmStore[]> {
    const { data } = await supabase
        .from('crm_stores')
        .select('*')
        .eq('organization_id', orgId)
        .eq('is_active', true)
        .order('name');
    return (data ?? []) as CrmStore[];
}

export async function fetchPlans(orgId: string, technology?: string): Promise<CrmPlan[]> {
    let q = supabase
        .from('crm_plans')
        .select('*')
        .eq('organization_id', orgId)
        .eq('is_active', true)
        .order('name');
    if (technology) q = q.eq('technology', technology);
    const { data } = await q;
    return (data ?? []) as CrmPlan[];
}

export async function fetchActiveCampaign(
    planId: string,
    cityId: string
): Promise<CrmCampaign | null> {
    const today = new Date().toISOString().split('T')[0];
    const { data } = await supabase
        .from('crm_campaigns')
        .select('*, plan:crm_plans(*)')
        .eq('plan_id', planId)
        .eq('is_active', true)
        .lte('starts_at', today)
        .gte('ends_at', today)
        .contains('city_ids', [cityId])
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
    return data as unknown as CrmCampaign ?? null;
}

export async function fetchAllCampaigns(orgId: string): Promise<CrmCampaign[]> {
    const { data } = await supabase
        .from('crm_campaigns')
        .select('*, plan:crm_plans(id, name, technology)')
        .eq('organization_id', orgId)
        .order('created_at', { ascending: false });
    return (data ?? []) as unknown as CrmCampaign[];
}

// ─── Cancellation Reasons ────────────────────────────────────────────────────

export async function fetchCancellationReasons(orgId: string): Promise<CrmCancellationReason[]> {
    const { data } = await supabase
        .from('crm_cancellation_reasons')
        .select('*')
        .eq('organization_id', orgId)
        .eq('is_active', true)
        .order('label');
    return (data ?? []) as unknown as CrmCancellationReason[];
}

export async function upsertCancellationReason(
    orgId: string,
    data: { id?: string; label: string; is_active?: boolean }
): Promise<void> {
    const { error } = await supabase
        .from('crm_cancellation_reasons')
        .upsert({ ...data, organization_id: orgId });
    if (error) throw error;
}

export async function deleteCancellationReason(id: string): Promise<void> {
    const { error } = await supabase
        .from('crm_cancellation_reasons')
        .update({ is_active: false })
        .eq('id', id);
    if (error) throw error;
}

// ─── Offline Draft (IndexedDB) ────────────────────────────────────────────────

const DB_NAME = 'crm_offline';
const STORE_NAME = 'drafts';

function openDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, 1);
        req.onupgradeneeded = () => req.result.createObjectStore(STORE_NAME, { keyPath: 'id' });
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

export async function saveDraftLocally(draft: { id: string;[key: string]: unknown }) {
    const db = await openDB();
    return new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).put({ ...draft, savedAt: Date.now() });
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
}

export async function loadDrafts(): Promise<unknown[]> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const req = tx.objectStore(STORE_NAME).getAll();
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

export async function deleteDraft(id: string) {
    const db = await openDB();
    return new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).delete(id);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function formatCpf(value: string): string {
    const d = value.replace(/\D/g, '').slice(0, 11);
    return d
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
}

export function formatPhone(value: string): string {
    const d = value.replace(/\D/g, '').slice(0, 11);
    if (d.length <= 10) return d.replace(/(\d{2})(\d{4})(\d{0,4})/, '($1) $2-$3');
    return d.replace(/(\d{2})(\d{5})(\d{0,4})/, '($1) $2-$3');
}

export async function fetchAddressByCep(cep: string): Promise<{
    logradouro: string;
    bairro: string;
    localidade: string;
    uf: string;
} | null> {
    const clean = cep.replace(/\D/g, '');
    if (clean.length !== 8) return null;
    try {
        const res = await fetch(`https://viacep.com.br/ws/${clean}/json/`);
        const data = await res.json();
        if (data.erro) return null;
        return data;
    } catch {
        return null;
    }
}

export function buildMkCopyText(sale: CrmSale): string {
    const c = sale.customer;
    const a = sale.address;
    const p = sale.plan;
    const lines = [
        `=== DADOS PARA MK SOLUTIONS ===`,
        ``,
        `CLIENTE`,
        `Nome: ${c?.name ?? '—'}`,
        `CPF/CNPJ: ${c?.cpf_cnpj ?? '—'}`,
        `Telefone: ${c?.phone_1 ?? '—'}${c?.phone_2 ? ` / ${c.phone_2}` : ''}`,
        `E-mail: ${c?.email ?? '—'}`,
        ``,
        `ENDEREÇO`,
        `CEP: ${a?.zip_code ?? '—'}`,
        `Cidade: ${a?.city_name ?? '—'}`,
        `Bairro: ${a?.neighborhood ?? '—'}`,
        `Logradouro: ${a?.street ?? '—'}, ${a?.number ?? 'S/N'}${a?.complement ? ` - ${a.complement}` : ''}`,
        ``,
        `PLANO`,
        `Plano: ${p?.name ?? '—'}`,
        `Tecnologia: ${sale.technology ?? '—'}`,
        `Valor Mensal: R$ ${sale.monthly_value?.toFixed(2) ?? '—'}`,
        `Vencimento: Dia ${sale.due_day ?? '—'}`,
        `Tipo: ${sale.sale_type === 'adesao' ? 'Nova Adesão' : 'Troca de Plano'}`,
        `Comodato: ${sale.has_comodato ? 'Sim' : 'Não'}`,
        `Taxa de Instalação: ${sale.has_installation_fee ? 'Sim' : 'Não'}`,
        ``,
        `VENDEDOR`,
        `Nome: ${sale.seller?.name ?? '—'}`,
        `Loja: ${sale.store?.name ?? '—'}`,
        `Data da Venda: ${sale.sale_date ?? '—'}`,
    ];
    return lines.join('\n');
}
