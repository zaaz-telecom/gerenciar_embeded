// CRM Module Types
export type SaleStatus = 'rascunho' | 'contato_inicial' | 'viabilidade_ok' | 'enviada' | 'em_validacao' | 'aprovada' | 'instalada' | 'cancelada';
export type SaleType = 'lead' | 'adesao';
export type Technology = 'fibra' | 'radio' | 'iptv';
export type DueDay = 5 | 10 | 15 | 20 | 25;
export type ServiceUser = 'titular' | 'parente' | 'amigo';
export type SaleContractType = 'adesao' | 'troca_plano';
export type DocType = 'id_document' | 'address_photo' | 'other';

export interface CrmStore {
    id: string;
    organization_id: string;
    name: string;
    city?: string;
    state?: string;
    is_active: boolean;
    created_at: string;
    updated_at: string;
}

export interface CrmCity {
    id: string;
    organization_id: string;
    name: string;
    state: string;
    store_id?: string;
    store?: CrmStore;
    is_active: boolean;
    created_at: string;
    updated_at: string;
}

export interface CrmPlan {
    id: string;
    organization_id: string;
    name: string;
    technology: Technology;
    base_price: number;
    svas: string[];
    is_active: boolean;
    created_at: string;
    updated_at: string;
}

export interface CrmCampaign {
    id: string;
    organization_id: string;
    name: string;
    plan_id: string;
    plan?: CrmPlan;
    price: number;
    city_ids: string[];
    starts_at: string;
    ends_at: string;
    is_active: boolean;
    created_at: string;
    updated_at: string;
}

export interface CrmCancellationReason {
    id: string;
    organization_id: string;
    label: string;
    is_active: boolean;
    created_at: string;
}

export interface CrmCustomer {
    id: string;
    organization_id: string;
    cpf_cnpj: string;
    name: string;
    birth_date?: string;
    parent_name?: string;
    phone_1: string;
    phone_2?: string;
    email?: string;
    created_at: string;
    updated_at: string;
}

export interface CrmCustomerAddress {
    id: string;
    customer_id: string;
    zip_code?: string;
    city_id?: string;
    city_name?: string;
    neighborhood?: string;
    street?: string;
    number?: string;
    complement?: string;
}

export interface CrmSale {
    id: string;
    organization_id: string;
    type: SaleType;
    status: SaleStatus;
    seller_id: string;
    seller?: { id: string; name: string; employee_id?: string };
    store_id?: string;
    store?: CrmStore;
    customer_id?: string;
    customer?: CrmCustomer;
    address_id?: string;
    address?: CrmCustomerAddress;
    plan_id?: string;
    plan?: CrmPlan;
    campaign_id?: string;
    campaign?: CrmCampaign;
    selected_svas: string[];
    sale_type?: SaleContractType;
    technology?: Technology;
    monthly_value?: number;
    due_day?: DueDay;
    has_comodato: boolean;
    has_installation_fee: boolean;
    service_user?: ServiceUser;
    sale_date?: string;
    notes?: string;
    lead_interest?: string;
    lead_priority?: 'baixa' | 'media' | 'alta';
    last_contact_at?: string;
    mk_contract_id?: string;
    mk_os_id?: string;
    bko_user_id?: string;
    bko_user?: { id: string; name: string };
    converted_from_lead_id?: string;
    created_at: string;
    updated_at: string;
}


export interface CrmStatusLog {
    id: string;
    sale_id: string;
    from_status?: string;
    to_status: string;
    changed_by: string;
    changer?: { id: string; name: string };
    reason?: string;
    comment?: string;
    created_at: string;
}

export interface CrmComment {
    id: string;
    sale_id: string;
    author_id: string;
    author?: { id: string; name: string };
    content: string;
    is_internal: boolean;
    created_at: string;
}

export interface CrmNotification {
    id: string;
    user_id: string;
    sale_id?: string;
    title: string;
    body?: string;
    type: string;
    is_read: boolean;
    created_at: string;
}

export interface CrmSaleDocument {
    id: string;
    sale_id: string;
    type: DocType;
    storage_path: string;
    file_name?: string;
    uploaded_at: string;
}

// Wizard form state
export interface SaleWizardData {
    // Step 1: Customer Search
    cpf_cnpj: string;
    existingCustomerId?: string;
    // Step 2: Customer Data
    customer_name: string;
    birth_date: string;
    parent_name: string;
    phone_1: string;
    phone_2: string;
    email: string;
    // Step 3: Address
    zip_code: string;
    city_id: string;
    city_name: string;
    neighborhood: string;
    street: string;
    address_number: string;
    complement: string;
    // Step 4: Plan & Campaign
    technology: Technology | '';
    plan_id: string;
    campaign_id: string;
    selected_svas: string[];
    monthly_value: string;
    // Step 5: Sale Details
    sale_type: SaleContractType | '';
    due_day: string;
    has_comodato: boolean;
    has_installation_fee: boolean;
    service_user: ServiceUser | '';
    store_id: string;
    sale_date: string;
    notes: string;
    competitor: string;
    lead_source: string;
    installation_period: string;
    needs_extra_router: boolean;
    needs_portability: boolean;
    // Step 6: Documents
    address_photo_file?: File;
    converted_from_lead_id?: string;
}


export const INITIAL_WIZARD_DATA: SaleWizardData = {
    cpf_cnpj: '',
    customer_name: '',
    birth_date: '',
    parent_name: '',
    phone_1: '',
    phone_2: '',
    email: '',
    zip_code: '',
    city_id: '',
    city_name: '',
    neighborhood: '',
    street: '',
    address_number: '',
    complement: '',
    technology: '',
    plan_id: '',
    campaign_id: '',
    selected_svas: [],
    monthly_value: '',
    sale_type: '',
    due_day: '',
    has_comodato: false,
    has_installation_fee: false,
    service_user: '',
    store_id: '',
    sale_date: new Date().toISOString().split('T')[0],
    notes: '',
    competitor: '',
    lead_source: '',
    converted_from_lead_id: undefined,

    installation_period: '',
    needs_extra_router: false,
    needs_portability: false,
};

export const STATUS_LABELS: Record<SaleStatus, string> = {
    rascunho: 'Rascunho',
    contato_inicial: 'Contato Inicial',
    viabilidade_ok: 'Viabilidade OK',
    enviada: 'Enviada',
    em_validacao: 'Em Validação',
    aprovada: 'Aprovada',
    instalada: 'Instalada',
    cancelada: 'Cancelada',
};

export const STATUS_COLORS: Record<SaleStatus, string> = {
    rascunho: 'bg-gray-100 text-gray-600',
    contato_inicial: 'bg-indigo-100 text-indigo-700',
    viabilidade_ok: 'bg-cyan-100 text-cyan-700',
    enviada: 'bg-blue-100 text-blue-700',
    em_validacao: 'bg-amber-100 text-amber-700',
    aprovada: 'bg-green-100 text-green-700',
    instalada: 'bg-emerald-100 text-emerald-800',
    cancelada: 'bg-red-100 text-red-700',
};


export const TECHNOLOGY_LABELS: Record<Technology, string> = {
    fibra: 'Fibra Óptica',
    radio: 'Rádio',
    iptv: 'IPTV',
};
