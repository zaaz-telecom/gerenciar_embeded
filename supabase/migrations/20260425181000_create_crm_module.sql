-- =====================================================
-- CRM PAP Module — Full Schema
-- =====================================================

-- 1. LOJAS / OPERAÇÕES
CREATE TABLE IF NOT EXISTS public.crm_stores (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  city TEXT,
  state TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT timezone('utc', now()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc', now()) NOT NULL
);

-- 2. CIDADES (mapa de cobertura)
CREATE TABLE IF NOT EXISTS public.crm_cities (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'MA',
  store_id UUID REFERENCES public.crm_stores(id) ON DELETE SET NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT timezone('utc', now()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc', now()) NOT NULL
);

-- 3. PLANOS
CREATE TABLE IF NOT EXISTS public.crm_plans (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  technology TEXT NOT NULL CHECK (technology IN ('fibra', 'radio', 'iptv')),
  base_price DECIMAL(10,2) NOT NULL DEFAULT 0,
  svas TEXT[] DEFAULT '{}',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT timezone('utc', now()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc', now()) NOT NULL
);

-- 4. CAMPANHAS
CREATE TABLE IF NOT EXISTS public.crm_campaigns (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  plan_id UUID NOT NULL REFERENCES public.crm_plans(id) ON DELETE CASCADE,
  price DECIMAL(10,2) NOT NULL,
  city_ids UUID[] DEFAULT '{}',
  starts_at DATE NOT NULL,
  ends_at DATE NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT timezone('utc', now()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc', now()) NOT NULL
);

-- 5. CLIENTES
CREATE TABLE IF NOT EXISTS public.crm_customers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  cpf_cnpj TEXT NOT NULL,
  name TEXT NOT NULL,
  birth_date DATE,
  parent_name TEXT,
  phone_1 TEXT NOT NULL,
  phone_2 TEXT,
  email TEXT,
  created_at TIMESTAMPTZ DEFAULT timezone('utc', now()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc', now()) NOT NULL,
  UNIQUE (organization_id, cpf_cnpj)
);

-- 6. ENDEREÇOS DOS CLIENTES
CREATE TABLE IF NOT EXISTS public.crm_customer_addresses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id UUID NOT NULL REFERENCES public.crm_customers(id) ON DELETE CASCADE,
  zip_code TEXT,
  city_id UUID REFERENCES public.crm_cities(id) ON DELETE SET NULL,
  city_name TEXT,
  neighborhood TEXT,
  street TEXT,
  number TEXT,
  complement TEXT,
  created_at TIMESTAMPTZ DEFAULT timezone('utc', now()) NOT NULL
);

-- 7. CONTATOS / VENDAS (tabela principal)
CREATE TABLE IF NOT EXISTS public.crm_sales (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'adesao' CHECK (type IN ('lead', 'adesao')),
  status TEXT NOT NULL DEFAULT 'rascunho' CHECK (status IN ('rascunho', 'enviada', 'em_validacao', 'aprovada', 'instalada', 'cancelada')),
  seller_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  store_id UUID REFERENCES public.crm_stores(id) ON DELETE SET NULL,
  customer_id UUID REFERENCES public.crm_customers(id) ON DELETE SET NULL,
  address_id UUID REFERENCES public.crm_customer_addresses(id) ON DELETE SET NULL,
  plan_id UUID REFERENCES public.crm_plans(id) ON DELETE SET NULL,
  campaign_id UUID REFERENCES public.crm_campaigns(id) ON DELETE SET NULL,
  selected_svas TEXT[] DEFAULT '{}',
  sale_type TEXT CHECK (sale_type IN ('adesao', 'troca_plano')),
  technology TEXT CHECK (technology IN ('fibra', 'radio', 'iptv')),
  monthly_value DECIMAL(10,2),
  due_day INTEGER CHECK (due_day IN (5, 10, 15, 20, 25)),
  has_comodato BOOLEAN DEFAULT FALSE,
  has_installation_fee BOOLEAN DEFAULT FALSE,
  service_user TEXT CHECK (service_user IN ('titular', 'parente', 'amigo')),
  sale_date DATE,
  notes TEXT,
  lead_interest TEXT,
  mk_contract_id TEXT,
  mk_os_id TEXT,
  bko_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  converted_from_lead_id UUID REFERENCES public.crm_sales(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT timezone('utc', now()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc', now()) NOT NULL
);

-- 8. DOCUMENTOS DA VENDA
CREATE TABLE IF NOT EXISTS public.crm_sale_documents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  sale_id UUID NOT NULL REFERENCES public.crm_sales(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('id_document', 'address_photo', 'other')),
  storage_path TEXT NOT NULL,
  file_name TEXT,
  uploaded_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  uploaded_at TIMESTAMPTZ DEFAULT timezone('utc', now()) NOT NULL
);

-- 9. HISTÓRICO DE STATUS
CREATE TABLE IF NOT EXISTS public.crm_status_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  sale_id UUID NOT NULL REFERENCES public.crm_sales(id) ON DELETE CASCADE,
  from_status TEXT,
  to_status TEXT NOT NULL,
  changed_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  reason TEXT,
  comment TEXT,
  created_at TIMESTAMPTZ DEFAULT timezone('utc', now()) NOT NULL
);

-- 10. COMENTÁRIOS INTERNOS
CREATE TABLE IF NOT EXISTS public.crm_comments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  sale_id UUID NOT NULL REFERENCES public.crm_sales(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  content TEXT NOT NULL,
  is_internal BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT timezone('utc', now()) NOT NULL
);

-- 11. NOTIFICAÇÕES CRM
CREATE TABLE IF NOT EXISTS public.crm_notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  sale_id UUID REFERENCES public.crm_sales(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT,
  type TEXT DEFAULT 'status_change',
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT timezone('utc', now()) NOT NULL
);

-- INDEXES
CREATE INDEX IF NOT EXISTS idx_crm_sales_seller ON public.crm_sales(seller_id);
CREATE INDEX IF NOT EXISTS idx_crm_sales_status ON public.crm_sales(status);
CREATE INDEX IF NOT EXISTS idx_crm_sales_org ON public.crm_sales(organization_id);
CREATE INDEX IF NOT EXISTS idx_crm_sales_customer ON public.crm_sales(customer_id);
CREATE INDEX IF NOT EXISTS idx_crm_customers_cpf ON public.crm_customers(organization_id, cpf_cnpj);
CREATE INDEX IF NOT EXISTS idx_crm_notifications_user ON public.crm_notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_crm_status_log_sale ON public.crm_status_log(sale_id);
CREATE INDEX IF NOT EXISTS idx_crm_cities_org ON public.crm_cities(organization_id);

NOTIFY pgrst, 'reload config';
