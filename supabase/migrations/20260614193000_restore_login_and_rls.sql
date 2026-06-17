-- Migration: Restore login column and configure RLS policies for Fashion Mall IA
-- Date: 2026-06-14

-- 1. Restore the 'login' column to 'user_profiles'
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS login text;

-- 2. Update the 'handle_new_user' trigger function to populate 'login'
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
     id, email, login, role, full_name, 
     whatsapp, cpf, cnpj, 
     organization_id, status, created_at, updated_at
   ) VALUES (
     new.id, new.email, v_login,
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

-- 3. Enable RLS on tables
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_body_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coupon_usages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_ai_credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_credit_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_generated_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_tryon_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.size_charts ENABLE ROW LEVEL SECURITY;

-- 4. Create RLS Policies

-- user_profiles Policies
DROP POLICY IF EXISTS "Leitura de perfis" ON public.user_profiles;
CREATE POLICY "Leitura de perfis" ON public.user_profiles FOR SELECT
USING (auth.uid() = id OR EXISTS (
    SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND role = 'admin'
));

DROP POLICY IF EXISTS "Escrita de perfis" ON public.user_profiles;
CREATE POLICY "Escrita de perfis" ON public.user_profiles FOR UPDATE
USING (auth.uid() = id);

-- user_body_profiles Policies
DROP POLICY IF EXISTS "Acesso total perfis corporais" ON public.user_body_profiles;
CREATE POLICY "Acesso total perfis corporais" ON public.user_body_profiles FOR ALL
USING (auth.uid() = user_id);

-- orders Policies
DROP POLICY IF EXISTS "Leitura de pedidos" ON public.orders;
CREATE POLICY "Leitura de pedidos" ON public.orders FOR SELECT
USING (auth.uid() = user_id OR EXISTS (
    SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND role = 'admin' AND organization_id = orders.organization_id
));

DROP POLICY IF EXISTS "Escrita de pedidos" ON public.orders;
CREATE POLICY "Escrita de pedidos" ON public.orders FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

-- order_items Policies
DROP POLICY IF EXISTS "Leitura de itens do pedido" ON public.order_items;
CREATE POLICY "Leitura de itens do pedido" ON public.order_items FOR SELECT
USING (EXISTS (
    SELECT 1 FROM public.orders WHERE id = order_items.order_id AND (user_id = auth.uid() OR EXISTS (
        SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND role = 'admin' AND organization_id = order_items.organization_id
    ))
));

-- products Policies
DROP POLICY IF EXISTS "Leitura publica de produtos" ON public.products;
CREATE POLICY "Leitura publica de produtos" ON public.products FOR SELECT
USING (is_active = true);

DROP POLICY IF EXISTS "Escrita de produtos para admins" ON public.products;
CREATE POLICY "Escrita de produtos para admins" ON public.products FOR ALL
USING (EXISTS (
    SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND role = 'admin' AND organization_id = products.organization_id
));

-- product_variants Policies
DROP POLICY IF EXISTS "Leitura publica de variantes" ON public.product_variants;
CREATE POLICY "Leitura publica de variantes" ON public.product_variants FOR SELECT
USING (is_active = true);

DROP POLICY IF EXISTS "Escrita de variantes para admins" ON public.product_variants;
CREATE POLICY "Escrita de variantes para admins" ON public.product_variants FOR ALL
USING (EXISTS (
    SELECT 1 FROM public.products p JOIN public.user_profiles u ON p.organization_id = u.organization_id WHERE p.id = product_variants.product_id AND u.id = auth.uid() AND u.role = 'admin'
));

-- product_categories Policies
DROP POLICY IF EXISTS "Leitura publica de categorias" ON public.product_categories;
CREATE POLICY "Leitura publica de categorias" ON public.product_categories FOR SELECT
USING (true);

DROP POLICY IF EXISTS "Escrita de categorias para admins" ON public.product_categories;
CREATE POLICY "Escrita de categorias para admins" ON public.product_categories FOR ALL
USING (EXISTS (
    SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND role = 'admin' AND organization_id = product_categories.organization_id
));
