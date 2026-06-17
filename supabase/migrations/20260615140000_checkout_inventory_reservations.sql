-- Migration: Checkout Inventory Reservations and Atomic Stock Hold System
-- Date: 2026-06-15

-- 1. Create inventory_reservations table
CREATE TABLE IF NOT EXISTS public.inventory_reservations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    variant_id uuid NOT NULL REFERENCES public.product_variants(id) ON DELETE CASCADE,
    session_id text NOT NULL,
    quantity integer NOT NULL CHECK (quantity > 0),
    reserved_until timestamptz NOT NULL,
    status text DEFAULT 'active' CHECK (status IN ('active', 'completed', 'released')),
    order_id text REFERENCES public.orders(id) ON DELETE SET NULL,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- 2. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_reservations_lookup 
    ON public.inventory_reservations (variant_id, status, reserved_until);

CREATE INDEX IF NOT EXISTS idx_reservations_session 
    ON public.inventory_reservations (session_id, variant_id, status);

CREATE INDEX IF NOT EXISTS idx_reservations_order 
    ON public.inventory_reservations (order_id);

-- 3. Create Function to get available stock in real time
CREATE OR REPLACE FUNCTION public.get_available_stock(p_variant_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_total_stock integer;
    v_reserved_stock integer;
BEGIN
    -- Obter estoque total da variante
    SELECT stock_quantity INTO v_total_stock
    FROM public.product_variants
    WHERE id = p_variant_id;
    
    IF v_total_stock IS NULL THEN
        RETURN 0;
    END IF;

    -- Somar reservas ativas que ainda não expiraram
    SELECT coalesce(sum(quantity), 0) INTO v_reserved_stock
    FROM public.inventory_reservations
    WHERE variant_id = p_variant_id
      AND status = 'active'
      AND reserved_until > now();
      
    RETURN max(0, v_total_stock - v_reserved_stock);
END;
$$;

-- 4. Create Function to atomically reserve stock (prevents race conditions)
CREATE OR REPLACE FUNCTION public.reserve_stock_atomic(
    p_org_id uuid,
    p_variant_id uuid,
    p_session_id text,
    p_quantity integer,
    p_minutes integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_stock_quantity integer;
    v_available integer;
    v_expires_at timestamptz;
    v_res_id uuid;
BEGIN
    -- Bloquear linha da variante para evitar concorrência simultânea (Race Condition)
    SELECT stock_quantity INTO v_stock_quantity
    FROM public.product_variants
    WHERE id = p_variant_id
    FOR UPDATE;
    
    IF v_stock_quantity IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Variante não encontrada.');
    END IF;
    
    -- Calcular estoque disponível excluindo as reservas ativas desta mesma sessão
    -- para evitar dupla contagem se o usuário re-adicionar ou ajustar quantidade
    SELECT coalesce(sum(quantity), 0) INTO v_available
    FROM public.inventory_reservations
    WHERE variant_id = p_variant_id
      AND status = 'active'
      AND reserved_until > now()
      AND session_id <> p_session_id;
      
    v_available := v_stock_quantity - v_available;
    
    IF v_available < p_quantity THEN
        RETURN jsonb_build_object('success', false, 'message', 'Estoque insuficiente. Disponível: ' || v_available);
    END IF;
    
    v_expires_at := now() + (p_minutes || ' minutes')::interval;
    
    -- Limpar reservas ativas anteriores do mesmo item para esta sessão
    DELETE FROM public.inventory_reservations
    WHERE session_id = p_session_id 
      AND variant_id = p_variant_id 
      AND status = 'active';
    
    -- Criar nova reserva ativa
    INSERT INTO public.inventory_reservations (
        organization_id, variant_id, session_id, quantity, reserved_until, status
    )
    VALUES (
        p_org_id, p_variant_id, p_session_id, p_quantity, v_expires_at, 'active'
    )
    RETURNING id INTO v_res_id;
    
    RETURN jsonb_build_object(
        'success', true, 
        'reservation_id', v_res_id, 
        'reserved_until', to_jsonb(v_expires_at)
    );
END;
$$;

-- 5. Create Function to release stock reservation
CREATE OR REPLACE FUNCTION public.release_stock_reservation(
    p_variant_id uuid,
    p_session_id text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE public.inventory_reservations
    SET status = 'released', 
        updated_at = now()
    WHERE variant_id = p_variant_id
      AND session_id = p_session_id
      AND status = 'active';
      
    RETURN true;
END;
$$;

-- 6. Create Function to atomically confirm payment and decrement stock
CREATE OR REPLACE FUNCTION public.confirm_order_payment(
    p_order_id text,
    p_payment_id text,
    p_status_detail text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_item record;
    v_order_status text;
BEGIN
    -- Bloquear e ler linha do pedido
    SELECT status INTO v_order_status
    FROM public.orders
    WHERE id = p_order_id
    FOR UPDATE;
    
    IF v_order_status IS NULL THEN
        RETURN false;
    END IF;
    
    -- Se já estiver pago, ignorar reprocessamento
    IF v_order_status = 'Pago' THEN
        RETURN true;
    END IF;
    
    -- Decrementar estoque real para cada item no pedido e fechar reservas
    FOR v_item IN 
        SELECT variant_id, quantity 
        FROM public.order_items 
        WHERE order_id = p_order_id
    LOOP
        -- Decrementar estoque físico da variante
        UPDATE public.product_variants
        SET stock_quantity = max(0, stock_quantity - v_item.quantity),
            updated_at = now()
        WHERE id = v_item.variant_id;
        
        -- Marcar qualquer reserva ativa ligada a este pedido ou sessão de usuário como concluída
        UPDATE public.inventory_reservations
        SET status = 'completed', 
            updated_at = now()
        WHERE variant_id = v_item.variant_id
          AND (order_id = p_order_id OR session_id = (SELECT user_id::text FROM public.orders WHERE id = p_order_id))
          AND status = 'active';
    END LOOP;
    
    -- Atualizar pedido para pago
    UPDATE public.orders
    SET status = 'Pago',
        payment_status = 'paid',
        payment_id = p_payment_id,
        payment_status_detail = p_status_detail,
        updated_at = now()
    WHERE id = p_order_id;
    
    RETURN true;
END;
$$;

-- 7. Enable RLS and create security policies
ALTER TABLE public.inventory_reservations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Leitura publica de reservas" ON public.inventory_reservations;
CREATE POLICY "Leitura publica de reservas" 
    ON public.inventory_reservations FOR SELECT 
    USING (true);

DROP POLICY IF EXISTS "Escrita de reservas pelo sistema" ON public.inventory_reservations;
CREATE POLICY "Escrita de reservas pelo sistema" 
    ON public.inventory_reservations FOR ALL 
    USING (true)
    WITH CHECK (true);
