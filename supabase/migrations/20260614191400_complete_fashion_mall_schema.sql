-- 1. DROPAR TRIGGERS E FUNÇÕES ANTIGAS
DROP TRIGGER IF EXISTS tr_on_auth_user_created ON auth.users CASCADE;
DROP TRIGGER IF EXISTS tr_handle_new_user ON auth.users CASCADE;

DROP FUNCTION IF EXISTS public.handle_consortium_purchase() CASCADE;
DROP FUNCTION IF EXISTS public.distribute_commissions() CASCADE;
DROP FUNCTION IF EXISTS public.sync_profile_to_affiliate() CASCADE;
DROP FUNCTION IF EXISTS public.check_admin_before_delete() CASCADE;
DROP FUNCTION IF EXISTS public.handle_new_affiliate_user() CASCADE;
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS public.update_updated_at_column() CASCADE;

-- 2. DROPAR TABELAS ANTERIORES EM CASCADE PARA LIMPEZA COMPLETA
DROP TABLE IF EXISTS public.consortium_draws CASCADE;
DROP TABLE IF EXISTS public.consortium_participants CASCADE;
DROP TABLE IF EXISTS public.consortium_groups CASCADE;
DROP TABLE IF EXISTS public.commissions CASCADE;
DROP TABLE IF EXISTS public.commission_configs CASCADE;
DROP TABLE IF EXISTS public.company_purchases CASCADE;
DROP TABLE IF EXISTS public.company_cashiers CASCADE;
DROP TABLE IF EXISTS public.companies CASCADE;
DROP TABLE IF EXISTS public.customer_coupons CASCADE;
DROP TABLE IF EXISTS public.withdrawals CASCADE;
DROP TABLE IF EXISTS public.wallet_transactions CASCADE;
DROP TABLE IF EXISTS public.order_extras CASCADE;
DROP TABLE IF EXISTS public.mmn_audit CASCADE;
DROP TABLE IF EXISTS public.mmn_levels CASCADE;
DROP TABLE IF EXISTS public.mmn_config CASCADE;
DROP TABLE IF EXISTS public.transactions CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;
DROP TABLE IF EXISTS public.branches CASCADE;
DROP TABLE IF EXISTS public.affiliates CASCADE;
DROP TABLE IF EXISTS public.order_items CASCADE;
DROP TABLE IF EXISTS public.orders CASCADE;
DROP TABLE IF EXISTS public.product_variants CASCADE;
DROP TABLE IF EXISTS public.products CASCADE;
DROP TABLE IF EXISTS public.product_subcategories CASCADE;
DROP TABLE IF EXISTS public.product_categories CASCADE;
DROP TABLE IF EXISTS public.user_body_profiles CASCADE;
DROP TABLE IF EXISTS public.user_profiles CASCADE;
DROP TABLE IF EXISTS public.coupons CASCADE;
DROP TABLE IF EXISTS public.coupon_usages CASCADE;
DROP TABLE IF EXISTS public.organization_ai_credits CASCADE;
DROP TABLE IF EXISTS public.ai_credit_transactions CASCADE;
DROP TABLE IF EXISTS public.ai_generated_assets CASCADE;
DROP TABLE IF EXISTS public.ai_tryon_sessions CASCADE;
DROP TABLE IF EXISTS public.size_charts CASCADE;
DROP TABLE IF EXISTS public.organizations CASCADE;

-- 3. CRIAÇÃO DAS TABELAS REFORMULADAS

-- 3.0. Organizações (Tenants)
CREATE TABLE public.organizations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    domain text,
    mercadopago_access_token text,
    mercadopago_public_key text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Inserir Organização Padrão
INSERT INTO public.organizations (id, name, domain)
VALUES ('5111af72-27a5-41fd-8ed9-8c51b78b4fdd'::uuid, 'Fashion Mall IA', 'fashionmallia.com.br')
ON CONFLICT (id) DO NOTHING;

-- 3.1. Categorias de Produtos
CREATE TABLE public.product_categories (
    id bigserial PRIMARY KEY,
    organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    name text NOT NULL,
    parent_id bigint REFERENCES public.product_categories(id) ON DELETE CASCADE,
    created_at timestamptz DEFAULT now()
);

-- 3.2. Produtos
CREATE TABLE public.products (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    category_id bigint REFERENCES public.product_categories(id) ON DELETE SET NULL,
    name text NOT NULL,
    description text,
    base_price numeric(10, 2) NOT NULL CHECK (base_price >= 0),
    image_url text,
    is_active boolean DEFAULT true,
    weight numeric(6, 3), -- em kg
    width integer,        -- em cm
    height integer,       -- em cm
    length integer,       -- em cm
    deleted_at timestamptz, -- soft delete
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- 3.3. Variantes de Produtos
CREATE TABLE public.product_variants (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    sku text UNIQUE,
    size text NOT NULL,
    color text NOT NULL,
    additional_price numeric(10, 2) DEFAULT 0.00 CHECK (additional_price >= 0),
    stock_quantity integer DEFAULT 0 CHECK (stock_quantity >= 0),
    variant_image_url text,
    is_active boolean DEFAULT true,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- 3.4. Perfis de Usuários
CREATE TABLE public.user_profiles (
    id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email text NOT NULL UNIQUE,
    full_name text NOT NULL,
    whatsapp text,
    cpf text UNIQUE,
    cnpj text,
    role text NOT NULL CHECK (role IN ('client', 'admin')),
    organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    status text DEFAULT 'active' CHECK (status IN ('active', 'suspended')),
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- 3.5. Perfis Corporais
CREATE TABLE public.user_body_profiles (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    profile_name text NOT NULL,
    is_default boolean DEFAULT false,
    gender text CHECK (gender IN ('male', 'female', 'unisex')),
    height_cm numeric(5, 2) NOT NULL CHECK (height_cm > 0),
    weight_kg numeric(5, 2) NOT NULL CHECK (weight_kg > 0),
    chest_cm numeric(5, 2),
    waist_cm numeric(5, 2),
    hips_cm numeric(5, 2),
    shoulder_cm numeric(5, 2),
    body_shape text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- 3.6. Pedidos
CREATE TABLE public.orders (
    id text PRIMARY KEY,
    organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    user_id uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    customer_name text NOT NULL,
    customer_email text NOT NULL,
    customer_phone text NOT NULL,
    customer_cpf text NOT NULL,
    shipping_address text NOT NULL,
    shipping_cost numeric(10, 2) NOT NULL CHECK (shipping_cost >= 0),
    shipping_method text NOT NULL,
    total_amount numeric(10, 2) NOT NULL CHECK (total_amount >= 0),
    payment_method text NOT NULL,
    payment_id text,
    payment_status text DEFAULT 'pending',
    status text DEFAULT 'Pendente',
    tracking_code text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- 3.7. Itens do Pedido
CREATE TABLE public.order_items (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    order_id text NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    variant_id uuid NOT NULL REFERENCES public.product_variants(id) ON DELETE CASCADE,
    product_name text NOT NULL,
    size_color_label text NOT NULL,
    quantity integer NOT NULL CHECK (quantity > 0),
    unit_price numeric(10, 2) NOT NULL CHECK (unit_price >= 0),
    created_at timestamptz DEFAULT now()
);

-- 3.8. Cupons de Desconto
CREATE TABLE public.coupons (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    code text NOT NULL,
    discount_type text NOT NULL CHECK (discount_type IN ('percentage', 'fixed_value')),
    discount_value numeric(10, 2) NOT NULL CHECK (discount_value > 0),
    min_order_value numeric(10, 2) DEFAULT 0.00 CHECK (min_order_value >= 0),
    max_discount_value numeric(10, 2),
    usage_limit integer,
    used_count integer DEFAULT 0 CHECK (used_count >= 0),
    start_date timestamptz,
    end_date timestamptz,
    is_active boolean DEFAULT true,
    created_at timestamptz DEFAULT now(),
    UNIQUE (organization_id, code)
);

-- 3.9. Histórico de Uso de Cupons
CREATE TABLE public.coupon_usages (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    coupon_id uuid NOT NULL REFERENCES public.coupons(id) ON DELETE CASCADE,
    order_id text NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    discount_applied numeric(10, 2) NOT NULL CHECK (discount_applied >= 0),
    created_at timestamptz DEFAULT now()
);

-- 3.10. Créditos de IA da Loja
CREATE TABLE public.organization_ai_credits (
    organization_id uuid PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
    available_credits integer DEFAULT 0 CHECK (available_credits >= 0),
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- 3.11. Histórico de Transações de Créditos IA
CREATE TABLE public.ai_credit_transactions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    amount integer NOT NULL,
    transaction_type text NOT NULL CHECK (transaction_type IN ('purchase', 'usage_tryon', 'usage_size_rec', 'bonus')),
    description text,
    created_at timestamptz DEFAULT now()
);

-- 3.12. Cache de Ativos Gerados por IA
CREATE TABLE public.ai_generated_assets (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    asset_type text NOT NULL CHECK (asset_type IN ('banner', 'professional_photo', 'virtual_model', 'tryon')),
    prompt_hash text NOT NULL UNIQUE,
    input_parameters jsonb NOT NULL,
    generated_url text,
    status text DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    error_message text,
    created_at timestamptz DEFAULT now()
);

-- 3.13. Sessões do Provador IA
CREATE TABLE public.ai_tryon_sessions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    variant_id uuid NOT NULL REFERENCES public.product_variants(id) ON DELETE CASCADE,
    body_profile_id uuid NOT NULL REFERENCES public.user_body_profiles(id) ON DELETE CASCADE,
    asset_id uuid REFERENCES public.ai_generated_assets(id) ON DELETE SET NULL,
    status text DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- 3.14. Tabela de Medidas (Recomendador de Tamanho)
CREATE TABLE public.size_charts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id uuid REFERENCES public.products(id) ON DELETE CASCADE,
    category_id bigint REFERENCES public.product_categories(id) ON DELETE CASCADE,
    size_label text NOT NULL,
    min_chest_cm numeric(5, 2),
    max_chest_cm numeric(5, 2),
    min_waist_cm numeric(5, 2),
    max_waist_cm numeric(5, 2),
    min_hips_cm numeric(5, 2),
    max_hips_cm numeric(5, 2),
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    CHECK (product_id IS NOT NULL OR category_id IS NOT NULL)
);

-- 4. CRIAÇÃO DOS ÍNDICES DE DESEMPENHO

-- Categorias
CREATE INDEX idx_categories_org ON public.product_categories(organization_id);
CREATE INDEX idx_categories_parent ON public.product_categories(parent_id);

-- Produtos
CREATE INDEX idx_products_org ON public.products(organization_id);
CREATE INDEX idx_products_category ON public.products(category_id);
CREATE INDEX idx_products_active ON public.products(is_active);

-- Variantes
CREATE INDEX idx_variants_product ON public.product_variants(product_id);
CREATE INDEX idx_variants_sku ON public.product_variants(sku);

-- Perfis
CREATE INDEX idx_profiles_org ON public.user_profiles(organization_id);
CREATE INDEX idx_profiles_email ON public.user_profiles(email);

-- Perfis Corporais
CREATE INDEX idx_body_profiles_user ON public.user_body_profiles(user_id);
CREATE INDEX idx_body_profiles_default ON public.user_body_profiles(is_default) WHERE is_default = true;

-- Pedidos e Itens
CREATE INDEX idx_orders_org ON public.orders(organization_id);
CREATE INDEX idx_orders_user ON public.orders(user_id);
CREATE INDEX idx_orders_created ON public.orders(created_at);
CREATE INDEX idx_order_items_order ON public.order_items(order_id);
CREATE INDEX idx_order_items_variant ON public.order_items(variant_id);

-- Cupons
CREATE INDEX idx_coupons_org_code ON public.coupons(organization_id, code);
CREATE INDEX idx_coupon_usages_coupon ON public.coupon_usages(coupon_id);
CREATE INDEX idx_coupon_usages_user ON public.coupon_usages(user_id);

-- Transações IA
CREATE INDEX idx_credit_transactions_org ON public.ai_credit_transactions(organization_id);
CREATE INDEX idx_credit_transactions_user ON public.ai_credit_transactions(user_id);

-- Assets e Sessões IA
CREATE INDEX idx_assets_org ON public.ai_generated_assets(organization_id);
CREATE INDEX idx_assets_hash ON public.ai_generated_assets(prompt_hash);
CREATE INDEX idx_tryon_sessions_user ON public.ai_tryon_sessions(user_id);
CREATE INDEX idx_tryon_sessions_variant ON public.ai_tryon_sessions(variant_id);

-- Recomendador
CREATE INDEX idx_size_charts_product ON public.size_charts(product_id);
CREATE INDEX idx_size_charts_category ON public.size_charts(category_id);

-- 5. CRIAÇÃO DOS TRIGGERS DE ATUALIZAÇÃO AUTOMÁTICA E CADASTRO

-- Função de timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Vinculação dos triggers de timestamp
CREATE TRIGGER trigger_update_organizations_timestamp BEFORE UPDATE ON public.organizations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trigger_update_products_timestamp BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trigger_update_variants_timestamp BEFORE UPDATE ON public.product_variants FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trigger_update_profiles_timestamp BEFORE UPDATE ON public.user_profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trigger_update_body_profiles_timestamp BEFORE UPDATE ON public.user_body_profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trigger_update_orders_timestamp BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trigger_update_ai_credits_timestamp BEFORE UPDATE ON public.organization_ai_credits FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trigger_update_ai_tryon_timestamp BEFORE UPDATE ON public.ai_tryon_sessions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trigger_update_size_charts_timestamp BEFORE UPDATE ON public.size_charts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Função e Trigger de Autocadastro de Usuário a partir do Auth.Users
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
 AS $$
 DECLARE
   v_full_name text;
   v_login text;
   v_org_id uuid;
 BEGIN
   v_login := COALESCE(new.raw_user_meta_data ->> 'login', split_part(new.email, '@', 1));
   v_full_name := TRIM(CONCAT_WS(' ', new.raw_user_meta_data ->> 'nome', new.raw_user_meta_data ->> 'sobrenome'));
   IF v_full_name = '' THEN v_full_name := v_login; END IF;

   -- Buscar Organização (padrão)
   v_org_id := '5111af72-27a5-41fd-8ed9-8c51b78b4fdd'::uuid;

   -- Criar Perfil Simples
   INSERT INTO public.user_profiles (
     id, email, role, full_name, 
     whatsapp, cpf, cnpj, 
     organization_id, status, created_at, updated_at
   ) VALUES (
     new.id, new.email, 
     COALESCE(new.raw_user_meta_data ->> 'role', 'client'),
     v_full_name,
     new.raw_user_meta_data ->> 'whatsapp',
     new.raw_user_meta_data ->> 'cpf',
     new.raw_user_meta_data ->> 'cnpj',
     v_org_id, 'active', new.created_at, new.created_at
   );

   RETURN new;
 END;
 $$;

CREATE TRIGGER tr_on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
