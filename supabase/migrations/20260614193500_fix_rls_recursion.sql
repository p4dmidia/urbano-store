-- Migration: Fix infinite recursion in RLS policies using SECURITY DEFINER helpers
-- Date: 2026-06-14

-- 1. Create SECURITY DEFINER helpers that bypass RLS
CREATE OR REPLACE FUNCTION public.is_admin(user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_profiles 
    WHERE id = user_id AND role = 'admin'
  );
$$;

CREATE OR REPLACE FUNCTION public.get_user_org(user_id uuid)
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT organization_id FROM public.user_profiles 
  WHERE id = user_id;
$$;

-- 2. Drop existing recursive policies to avoid conflicts
DROP POLICY IF EXISTS "Leitura de perfis" ON public.user_profiles;
DROP POLICY IF EXISTS "Escrita de perfis" ON public.user_profiles;
DROP POLICY IF EXISTS "Acesso total perfis corporais" ON public.user_body_profiles;
DROP POLICY IF EXISTS "Leitura de pedidos" ON public.orders;
DROP POLICY IF EXISTS "Escrita de pedidos" ON public.orders;
DROP POLICY IF EXISTS "Leitura de itens do pedido" ON public.order_items;
DROP POLICY IF EXISTS "Leitura publica de produtos" ON public.products;
DROP POLICY IF EXISTS "Escrita de produtos para admins" ON public.products;
DROP POLICY IF EXISTS "Leitura publica de variantes" ON public.product_variants;
DROP POLICY IF EXISTS "Escrita de variantes para admins" ON public.product_variants;
DROP POLICY IF EXISTS "Leitura publica de categorias" ON public.product_categories;
DROP POLICY IF EXISTS "Escrita de categorias para admins" ON public.product_categories;

-- 3. Recreate RLS Policies using helper functions

-- user_profiles Policies
CREATE POLICY "Leitura de perfis" ON public.user_profiles FOR SELECT
USING (auth.uid() = id OR public.is_admin(auth.uid()));

CREATE POLICY "Escrita de perfis" ON public.user_profiles FOR UPDATE
USING (auth.uid() = id);

-- user_body_profiles Policies
CREATE POLICY "Acesso total perfis corporais" ON public.user_body_profiles FOR ALL
USING (auth.uid() = user_id);

-- orders Policies
CREATE POLICY "Leitura de pedidos" ON public.orders FOR SELECT
USING (auth.uid() = user_id OR (public.is_admin(auth.uid()) AND public.get_user_org(auth.uid()) = organization_id));

CREATE POLICY "Escrita de pedidos" ON public.orders FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

-- order_items Policies
CREATE POLICY "Leitura de itens do pedido" ON public.order_items FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.orders o 
    WHERE o.id = order_items.order_id 
      AND (o.user_id = auth.uid() OR (public.is_admin(auth.uid()) AND o.organization_id = public.get_user_org(auth.uid())))
  )
);

-- products Policies
CREATE POLICY "Leitura publica de produtos" ON public.products FOR SELECT
USING (is_active = true);

CREATE POLICY "Escrita de produtos para admins" ON public.products FOR ALL
USING (public.is_admin(auth.uid()) AND public.get_user_org(auth.uid()) = organization_id);

-- product_variants Policies
CREATE POLICY "Leitura publica de variantes" ON public.product_variants FOR SELECT
USING (is_active = true);

CREATE POLICY "Escrita de variantes para admins" ON public.product_variants FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.products p 
    WHERE p.id = product_variants.product_id 
      AND p.organization_id = public.get_user_org(auth.uid()) 
      AND public.is_admin(auth.uid())
  )
);

-- product_categories Policies
CREATE POLICY "Leitura publica de categorias" ON public.product_categories FOR SELECT
USING (true);

CREATE POLICY "Escrita de categorias para admins" ON public.product_categories FOR ALL
USING (public.is_admin(auth.uid()) AND public.get_user_org(auth.uid()) = organization_id);
