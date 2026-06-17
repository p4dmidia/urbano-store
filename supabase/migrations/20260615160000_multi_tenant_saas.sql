-- Migration: Multi-Tenant SaaS & RBAC Architecture
-- Date: 2026-06-15

-- 1. Create plans table
CREATE TABLE IF NOT EXISTS public.plans (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL UNIQUE,
    monthly_price numeric(10, 2) NOT NULL DEFAULT 0.00,
    yearly_price numeric(10, 2) NOT NULL DEFAULT 0.00,
    max_products integer NOT NULL DEFAULT -1, -- -1 = unlimited
    max_renders integer NOT NULL DEFAULT -1,  -- -1 = unlimited
    max_storage bigint NOT NULL DEFAULT -1,   -- -1 = unlimited
    features text[] DEFAULT '{}'::text[],
    created_at timestamptz DEFAULT now()
);

-- Seed default plans
INSERT INTO public.plans (id, name, monthly_price, yearly_price, max_products, max_renders, max_storage, features)
VALUES 
  ('a111af72-27a5-41fd-8ed9-8c51b78b4fa1'::uuid, 'Starter', 99.00, 990.00, 100, 500, 100000000, '{vton}'),
  ('b111af72-27a5-41fd-8ed9-8c51b78b4fb2'::uuid, 'Growth', 199.00, 1990.00, 1000, 5000, 500000000, '{vton,outfit_engine}'),
  ('c111af72-27a5-41fd-8ed9-8c51b78b4fc3'::uuid, 'Pro', 499.00, 4990.00, -1, -1, -1, '{vton,outfit_engine,analytics,vip_support}')
ON CONFLICT (id) DO NOTHING;

-- 2. Rename organizations to tenants and add columns
ALTER TABLE IF EXISTS public.organizations RENAME TO tenants;

ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS slug text UNIQUE;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS logo_url text;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'past_due'));
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS plan_id uuid REFERENCES public.plans(id) ON DELETE SET NULL;

-- Backfill default tenant slug and plan
UPDATE public.tenants 
SET slug = 'classe-a', plan_id = 'c111af72-27a5-41fd-8ed9-8c51b78b4fc3'::uuid
WHERE id = '5111af72-27a5-41fd-8ed9-8c51b78b4fdd'::uuid;

-- Ensure constraints and trigger update
DROP TRIGGER IF EXISTS trigger_update_organizations_timestamp ON public.tenants;
CREATE TRIGGER trigger_update_tenants_timestamp BEFORE UPDATE ON public.tenants FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. Rename organization_id to tenant_id on existing tables
ALTER TABLE public.product_categories RENAME COLUMN organization_id TO tenant_id;
ALTER TABLE public.products RENAME COLUMN organization_id TO tenant_id;
ALTER TABLE public.user_profiles RENAME COLUMN organization_id TO tenant_id;
ALTER TABLE public.orders RENAME COLUMN organization_id TO tenant_id;
ALTER TABLE public.order_items RENAME COLUMN organization_id TO tenant_id;
ALTER TABLE public.coupons RENAME COLUMN organization_id TO tenant_id;
ALTER TABLE public.analytics_events RENAME COLUMN organization_id TO tenant_id;
ALTER TABLE public.analytics_product_metrics RENAME COLUMN organization_id TO tenant_id;
ALTER TABLE public.analytics_variant_metrics RENAME COLUMN organization_id TO tenant_id;

-- Renames for other optional/ai tables if they exist
ALTER TABLE IF EXISTS public.ai_credit_transactions RENAME COLUMN organization_id TO tenant_id;
ALTER TABLE IF EXISTS public.ai_generated_assets RENAME COLUMN organization_id TO tenant_id;
ALTER TABLE IF EXISTS public.organization_ai_credits RENAME COLUMN organization_id TO tenant_id;

-- Add tenant_id directly to product_variants for better database isolation
ALTER TABLE public.product_variants ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE;

-- Backfill tenant_id in variants from parent product
UPDATE public.product_variants pv
SET tenant_id = p.tenant_id
FROM public.products p
WHERE pv.product_id = p.id;

ALTER TABLE public.product_variants ALTER COLUMN tenant_id SET NOT NULL;

-- 4. Create new multi-tenant tables: tenant_users, subscriptions, tenant_usage, billing_events
CREATE TABLE IF NOT EXISTS public.tenant_users (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    role text NOT NULL CHECK (role IN ('owner', 'manager', 'staff')),
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    UNIQUE (tenant_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.subscriptions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    plan_id uuid NOT NULL REFERENCES public.plans(id),
    status text NOT NULL CHECK (status IN ('active', 'past_due', 'canceled', 'trialing')),
    billing_interval text NOT NULL CHECK (billing_interval IN ('month', 'year')),
    current_period_start timestamptz NOT NULL DEFAULT now(),
    current_period_end timestamptz NOT NULL,
    cancel_at_period_end boolean DEFAULT false,
    payment_gateway text CHECK (payment_gateway IN ('mercadopago', 'stripe')),
    gateway_subscription_id text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.tenant_usage (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    billing_period_start timestamptz NOT NULL,
    billing_period_end timestamptz NOT NULL,
    renders_total integer DEFAULT 0,
    renders_month integer DEFAULT 0,
    cache_hits integer DEFAULT 0,
    estimated_ai_cost numeric(10, 4) DEFAULT 0.0000,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    UNIQUE (tenant_id, billing_period_start, billing_period_end)
);

CREATE TABLE IF NOT EXISTS public.billing_events (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid REFERENCES public.tenants(id) ON DELETE SET NULL,
    event_type text NOT NULL,
    amount numeric(10, 2),
    currency text DEFAULT 'BRL',
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamptz DEFAULT now()
);

-- Backfill admin user roles as owners in tenant_users
INSERT INTO public.tenant_users (tenant_id, user_id, role)
SELECT tenant_id, id, 'owner'
FROM public.user_profiles
WHERE role = 'admin'
ON CONFLICT (tenant_id, user_id) DO NOTHING;

-- Update user_profiles.role check to support super_admin
ALTER TABLE public.user_profiles DROP CONSTRAINT IF EXISTS user_profiles_role_check;
ALTER TABLE public.user_profiles ADD CONSTRAINT user_profiles_role_check CHECK (role IN ('client', 'admin', 'super_admin'));

-- Seed default active subscription for the default tenant
INSERT INTO public.subscriptions (tenant_id, plan_id, status, billing_interval, current_period_start, current_period_end)
VALUES (
    '5111af72-27a5-41fd-8ed9-8c51b78b4fdd'::uuid, 
    'c111af72-27a5-41fd-8ed9-8c51b78b4fc3'::uuid, 
    'active', 
    'month', 
    now(), 
    now() + interval '1 month'
) ON CONFLICT DO NOTHING;

-- Seed initial usage row for the default tenant
INSERT INTO public.tenant_usage (tenant_id, billing_period_start, billing_period_end)
VALUES (
    '5111af72-27a5-41fd-8ed9-8c51b78b4fdd'::uuid, 
    date_trunc('month', now()), 
    date_trunc('month', now()) + interval '1 month'
) ON CONFLICT DO NOTHING;

-- 5. Helper Functions for RBAC & Tenant isolation bypassing recursion
CREATE OR REPLACE FUNCTION public.is_super_admin(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_profiles 
    WHERE id = p_user_id AND role = 'super_admin'
  );
$$;

CREATE OR REPLACE FUNCTION public.get_user_tenant(p_user_id uuid)
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT tenant_id FROM public.user_profiles 
  WHERE id = p_user_id;
$$;

CREATE OR REPLACE FUNCTION public.get_tenant_user_role(p_user_id uuid, p_tenant_id uuid)
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT role FROM public.tenant_users 
  WHERE user_id = p_user_id AND tenant_id = p_tenant_id;
$$;

CREATE OR REPLACE FUNCTION public.has_tenant_access(p_user_id uuid, p_tenant_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT 
    public.is_super_admin(p_user_id) OR
    EXISTS (
      SELECT 1 FROM public.tenant_users 
      WHERE user_id = p_user_id AND tenant_id = p_tenant_id
    );
$$;

-- Drop legacy helpers
DROP FUNCTION IF EXISTS public.is_admin(user_id uuid) CASCADE;
DROP FUNCTION IF EXISTS public.get_user_org(user_id uuid) CASCADE;

-- 6. Recreate Analytics Engine Trigger & Function with tenant_id references
DROP TRIGGER IF EXISTS trg_analytics_events_aggregator ON public.analytics_events;
DROP FUNCTION IF EXISTS public.update_analytics_metrics_on_event() CASCADE;
DROP FUNCTION IF EXISTS public.rebuild_analytics_metrics(p_org_id uuid) CASCADE;

CREATE OR REPLACE FUNCTION public.update_analytics_metrics_on_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_prod_id uuid;
    v_tenant_id uuid;
    v_meta jsonb;
    v_item record;
    v_views integer;
    v_tryons integer;
    v_additions integer;
    v_purchases integer;
BEGIN
    v_meta := NEW.metadata;
    v_tenant_id := NEW.tenant_id;

    -- 1. product_view
    IF NEW.event_type = 'product_view' THEN
        v_prod_id := (v_meta->>'product_id')::uuid;
        IF v_prod_id IS NOT NULL THEN
            INSERT INTO public.analytics_product_metrics (product_id, tenant_id, views, updated_at)
            VALUES (v_prod_id, v_tenant_id, 1, now())
            ON CONFLICT (product_id) 
            DO UPDATE SET views = analytics_product_metrics.views + 1, updated_at = now();
        END IF;
    END IF;

    -- 2. vton_render_completed
    IF NEW.event_type = 'vton_render_completed' THEN
        v_prod_id := (v_meta->>'product_id')::uuid;
        IF v_prod_id IS NULL AND (v_meta->>'variant_id') IS NOT NULL THEN
            SELECT product_id INTO v_prod_id
            FROM public.product_variants
            WHERE id = (v_meta->>'variant_id')::uuid;
        END IF;
        
        IF v_prod_id IS NOT NULL THEN
            INSERT INTO public.analytics_product_metrics (product_id, tenant_id, tryons, updated_at)
            VALUES (v_prod_id, v_tenant_id, 1, now())
            ON CONFLICT (product_id) 
            DO UPDATE SET tryons = analytics_product_metrics.tryons + 1, updated_at = now();
        END IF;
    END IF;

    -- 3. add_to_cart
    IF NEW.event_type = 'add_to_cart' THEN
        v_prod_id := (v_meta->>'product_id')::uuid;
        IF v_prod_id IS NULL AND (v_meta->>'variant_id') IS NOT NULL THEN
            SELECT product_id INTO v_prod_id
            FROM public.product_variants
            WHERE id = (v_meta->>'variant_id')::uuid;
        END IF;

        IF v_prod_id IS NOT NULL THEN
            INSERT INTO public.analytics_product_metrics (product_id, tenant_id, cart_additions, updated_at)
            VALUES (v_prod_id, v_tenant_id, 1, now())
            ON CONFLICT (product_id) 
            DO UPDATE SET cart_additions = analytics_product_metrics.cart_additions + 1, updated_at = now();
        END IF;
    END IF;

    -- 4. payment_completed
    IF NEW.event_type = 'payment_completed' THEN
        FOR v_item IN 
            SELECT variant_id, quantity 
            FROM public.order_items 
            WHERE order_id = v_meta->>'order_id'
        LOOP
            SELECT product_id INTO v_prod_id
            FROM public.product_variants
            WHERE id = v_item.variant_id;

            IF v_prod_id IS NOT NULL THEN
                INSERT INTO public.analytics_product_metrics (product_id, tenant_id, purchases, updated_at)
                VALUES (v_prod_id, v_tenant_id, v_item.quantity, now())
                ON CONFLICT (product_id) 
                DO UPDATE SET purchases = analytics_product_metrics.purchases + v_item.quantity, updated_at = now();
            END IF;

            IF v_item.variant_id IS NOT NULL THEN
                INSERT INTO public.analytics_variant_metrics (variant_id, tenant_id, size, color, conversions, updated_at)
                SELECT v_item.variant_id, v_tenant_id, size, color, v_item.quantity, now()
                FROM public.product_variants
                WHERE id = v_item.variant_id
                ON CONFLICT (variant_id)
                DO UPDATE SET conversions = analytics_variant_metrics.conversions + v_item.quantity, updated_at = now();
            END IF;
        END LOOP;
    END IF;

    -- 5. Recalculate Rates and Score
    IF v_prod_id IS NOT NULL THEN
        SELECT views, tryons, cart_additions, purchases INTO v_views, v_tryons, v_additions, v_purchases
        FROM public.analytics_product_metrics
        WHERE product_id = v_prod_id;

        UPDATE public.analytics_product_metrics
        SET 
            conversion_rate = round(coalesce((v_purchases::numeric / nullif(v_views, 0)) * 100, 0.00), 2),
            vton_rate = round(coalesce((v_tryons::numeric / nullif(v_views, 0)) * 100, 0.00), 2),
            score = least(100, round((coalesce(v_views, 0) * 0.05) + (coalesce(v_tryons, 0) * 0.25) + (coalesce(v_additions, 0) * 0.5) + (coalesce(v_purchases, 0) * 5.0)))
        WHERE product_id = v_prod_id;
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_analytics_events_aggregator
    AFTER INSERT ON public.analytics_events
    FOR EACH ROW
    EXECUTE FUNCTION public.update_analytics_metrics_on_event();

CREATE OR REPLACE FUNCTION public.rebuild_analytics_metrics(p_tenant_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    DELETE FROM public.analytics_product_metrics WHERE tenant_id = p_tenant_id;
    DELETE FROM public.analytics_variant_metrics WHERE tenant_id = p_tenant_id;

    -- Views
    INSERT INTO public.analytics_product_metrics (product_id, tenant_id, views, updated_at)
    SELECT 
        (metadata->>'product_id')::uuid as product_id,
        p_tenant_id,
        count(*) as views,
        now()
    FROM public.analytics_events
    WHERE event_type = 'product_view'
      AND tenant_id = p_tenant_id
      AND (metadata->>'product_id') IS NOT NULL
    GROUP BY 1
    ON CONFLICT (product_id) DO UPDATE SET views = EXCLUDED.views, updated_at = now();

    -- Tryons
    INSERT INTO public.analytics_product_metrics (product_id, tenant_id, tryons, updated_at)
    SELECT 
        coalesce((e.metadata->>'product_id')::uuid, pv.product_id) as product_id,
        p_tenant_id,
        count(*) as tryons,
        now()
    FROM public.analytics_events e
    LEFT JOIN public.product_variants pv ON pv.id = (e.metadata->>'variant_id')::uuid
    WHERE e.event_type = 'vton_render_completed'
      AND e.tenant_id = p_tenant_id
    GROUP BY 1
    ON CONFLICT (product_id) DO UPDATE SET tryons = EXCLUDED.tryons, updated_at = now();

    -- Cart Additions
    INSERT INTO public.analytics_product_metrics (product_id, tenant_id, cart_additions, updated_at)
    SELECT 
        coalesce((e.metadata->>'product_id')::uuid, pv.product_id) as product_id,
        p_tenant_id,
        count(*) as cart_additions,
        now()
    FROM public.analytics_events e
    LEFT JOIN public.product_variants pv ON pv.id = (e.metadata->>'variant_id')::uuid
    WHERE e.event_type = 'add_to_cart'
      AND e.tenant_id = p_tenant_id
    GROUP BY 1
    ON CONFLICT (product_id) DO UPDATE SET cart_additions = EXCLUDED.cart_additions, updated_at = now();

    -- Purchases
    INSERT INTO public.analytics_product_metrics (product_id, tenant_id, purchases, updated_at)
    SELECT 
        pv.product_id,
        p_tenant_id,
        sum(oi.quantity) as purchases,
        now()
    FROM public.analytics_events e
    JOIN public.order_items oi ON oi.order_id = e.metadata->>'order_id'
    JOIN public.product_variants pv ON pv.id = oi.variant_id
    WHERE e.event_type = 'payment_completed'
      AND e.tenant_id = p_tenant_id
    GROUP BY 1
    ON CONFLICT (product_id) DO UPDATE SET purchases = EXCLUDED.purchases, updated_at = now();

    -- Variant conversions
    INSERT INTO public.analytics_variant_metrics (variant_id, tenant_id, size, color, conversions, updated_at)
    SELECT 
        oi.variant_id,
        p_tenant_id,
        pv.size,
        pv.color,
        sum(oi.quantity) as conversions,
        now()
    FROM public.analytics_events e
    JOIN public.order_items oi ON oi.order_id = e.metadata->>'order_id'
    JOIN public.product_variants pv ON pv.id = oi.variant_id
    WHERE e.event_type = 'payment_completed'
      AND e.tenant_id = p_tenant_id
    GROUP BY 1, 2, 3
    ON CONFLICT (variant_id) DO UPDATE SET conversions = EXCLUDED.conversions, updated_at = now();

    -- Rates and Scores
    UPDATE public.analytics_product_metrics
    SET 
        conversion_rate = round(coalesce((purchases::numeric / nullif(views, 0)) * 100, 0.00), 2),
        vton_rate = round(coalesce((tryons::numeric / nullif(views, 0)) * 100, 0.00), 2),
        score = least(100, round((coalesce(views, 0) * 0.05) + (coalesce(tryons, 0) * 0.25) + (coalesce(cart_additions, 0) * 0.5) + (coalesce(purchases, 0) * 5.0)))
    WHERE tenant_id = p_tenant_id;

    RETURN true;
END;
$$;

-- 7. Update Row-Level Security (RLS) policies for Tenants, Subscriptions, Usage, Products, Orders
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_events ENABLE ROW LEVEL SECURITY;

-- Drop legacys RLS policies
DROP POLICY IF EXISTS "Leitura de perfis" ON public.user_profiles;
DROP POLICY IF EXISTS "Escrita de perfis" ON public.user_profiles;
DROP POLICY IF EXISTS "Leitura de pedidos" ON public.orders;
DROP POLICY IF EXISTS "Escrita de pedidos" ON public.orders;
DROP POLICY IF EXISTS "Leitura de itens do pedido" ON public.order_items;
DROP POLICY IF EXISTS "Leitura publica de produtos" ON public.products;
DROP POLICY IF EXISTS "Escrita de produtos para admins" ON public.products;
DROP POLICY IF EXISTS "Leitura publica de variantes" ON public.product_variants;
DROP POLICY IF EXISTS "Escrita de variantes para admins" ON public.product_variants;
DROP POLICY IF EXISTS "Leitura publica de categorias" ON public.product_categories;
DROP POLICY IF EXISTS "Escrita de categorias para admins" ON public.product_categories;

-- Tenants Policies
CREATE POLICY "Select active tenants" ON public.tenants FOR SELECT USING (status = 'active');
CREATE POLICY "Full access to super admin" ON public.tenants FOR ALL USING (public.is_super_admin(auth.uid()));

-- Tenant Users Policies
CREATE POLICY "Read tenant users" ON public.tenant_users FOR SELECT USING (public.has_tenant_access(auth.uid(), tenant_id));
CREATE POLICY "Manage tenant users" ON public.tenant_users FOR ALL USING (
    public.is_super_admin(auth.uid()) OR 
    (public.has_tenant_access(auth.uid(), tenant_id) AND public.get_tenant_user_role(auth.uid(), tenant_id) = 'owner')
);

-- Subscriptions Policies
CREATE POLICY "Read subscriptions" ON public.subscriptions FOR SELECT USING (public.has_tenant_access(auth.uid(), tenant_id));
CREATE POLICY "Manage subscriptions for super admin" ON public.subscriptions FOR ALL USING (public.is_super_admin(auth.uid()));

-- Usage Policies
CREATE POLICY "Read tenant usage" ON public.tenant_usage FOR SELECT USING (public.has_tenant_access(auth.uid(), tenant_id));
CREATE POLICY "Manage usage" ON public.tenant_usage FOR ALL USING (public.is_super_admin(auth.uid()));

-- Billing Events Policies
CREATE POLICY "Read billing events" ON public.billing_events FOR SELECT USING (public.has_tenant_access(auth.uid(), tenant_id));

-- Products Policies
CREATE POLICY "Public read products" ON public.products FOR SELECT USING (is_active = true OR deleted_at IS NULL);
CREATE POLICY "Write products for staff" ON public.products FOR ALL USING (public.has_tenant_access(auth.uid(), tenant_id));

-- Product Variants Policies
CREATE POLICY "Public read variants" ON public.product_variants FOR SELECT USING (is_active = true);
CREATE POLICY "Write variants for staff" ON public.product_variants FOR ALL USING (public.has_tenant_access(auth.uid(), tenant_id));

-- Product Categories Policies
CREATE POLICY "Public read categories" ON public.product_categories FOR SELECT USING (true);
CREATE POLICY "Write categories for staff" ON public.product_categories FOR ALL USING (public.has_tenant_access(auth.uid(), tenant_id));

-- User Profiles Policies
CREATE POLICY "Read user profiles" ON public.user_profiles FOR SELECT USING (auth.uid() = id OR public.has_tenant_access(auth.uid(), tenant_id));
CREATE POLICY "Write user profiles" ON public.user_profiles FOR UPDATE USING (auth.uid() = id OR (public.has_tenant_access(auth.uid(), tenant_id) AND public.get_tenant_user_role(auth.uid(), tenant_id) IN ('owner', 'manager')));

-- Orders Policies
CREATE POLICY "Read orders" ON public.orders FOR SELECT USING (auth.uid() = user_id OR public.has_tenant_access(auth.uid(), tenant_id));
CREATE POLICY "Write orders" ON public.orders FOR ALL USING (auth.uid() IS NOT NULL OR public.has_tenant_access(auth.uid(), tenant_id));

-- Order Items Policies
CREATE POLICY "Read order items" ON public.order_items FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.orders o 
    WHERE o.id = order_items.order_id 
      AND (o.user_id = auth.uid() OR public.has_tenant_access(auth.uid(), o.tenant_id))
  )
);

-- Analytics Metrics Policies
CREATE POLICY "Public read product metrics" ON public.analytics_product_metrics FOR SELECT USING (true);
CREATE POLICY "Public read variant metrics" ON public.analytics_variant_metrics FOR SELECT USING (true);
