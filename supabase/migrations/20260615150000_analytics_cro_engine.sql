-- Migration: Analytics & CRO Engine Database Schema
-- Date: 2026-06-15

-- 1. Create analytics_events table
CREATE TABLE IF NOT EXISTS public.analytics_events (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    user_id uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    session_id text NOT NULL,
    event_type text NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamptz DEFAULT now()
);

-- 2. Create analytics_product_metrics table
CREATE TABLE IF NOT EXISTS public.analytics_product_metrics (
    product_id uuid PRIMARY KEY REFERENCES public.products(id) ON DELETE CASCADE,
    organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    views integer DEFAULT 0,
    tryons integer DEFAULT 0,
    cart_additions integer DEFAULT 0,
    purchases integer DEFAULT 0,
    conversion_rate numeric(5, 2) DEFAULT 0.00,
    vton_rate numeric(5, 2) DEFAULT 0.00,
    score integer DEFAULT 0,
    updated_at timestamptz DEFAULT now()
);

-- 3. Create analytics_variant_metrics table
CREATE TABLE IF NOT EXISTS public.analytics_variant_metrics (
    variant_id uuid PRIMARY KEY REFERENCES public.product_variants(id) ON DELETE CASCADE,
    organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    size text,
    color text,
    conversions integer DEFAULT 0,
    updated_at timestamptz DEFAULT now()
);

-- 4. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_analytics_events_lookup 
    ON public.analytics_events (organization_id, event_type, created_at);

CREATE INDEX IF NOT EXISTS idx_analytics_events_session 
    ON public.analytics_events (session_id);

-- 5. Create trigger function to update metrics in real-time
CREATE OR REPLACE FUNCTION public.update_analytics_metrics_on_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_prod_id uuid;
    v_org_id uuid;
    v_meta jsonb;
    v_item record;
    v_views integer;
    v_tryons integer;
    v_additions integer;
    v_purchases integer;
BEGIN
    v_meta := NEW.metadata;
    v_org_id := NEW.organization_id;

    -- 1. product_view
    IF NEW.event_type = 'product_view' THEN
        v_prod_id := (v_meta->>'product_id')::uuid;
        IF v_prod_id IS NOT NULL THEN
            INSERT INTO public.analytics_product_metrics (product_id, organization_id, views, updated_at)
            VALUES (v_prod_id, v_org_id, 1, now())
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
            INSERT INTO public.analytics_product_metrics (product_id, organization_id, tryons, updated_at)
            VALUES (v_prod_id, v_org_id, 1, now())
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
            INSERT INTO public.analytics_product_metrics (product_id, organization_id, cart_additions, updated_at)
            VALUES (v_prod_id, v_org_id, 1, now())
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
                INSERT INTO public.analytics_product_metrics (product_id, organization_id, purchases, updated_at)
                VALUES (v_prod_id, v_org_id, v_item.quantity, now())
                ON CONFLICT (product_id) 
                DO UPDATE SET purchases = analytics_product_metrics.purchases + v_item.quantity, updated_at = now();
            END IF;

            IF v_item.variant_id IS NOT NULL THEN
                INSERT INTO public.analytics_variant_metrics (variant_id, organization_id, size, color, conversions, updated_at)
                SELECT v_item.variant_id, v_org_id, size, color, v_item.quantity, now()
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

-- 6. Bind trigger to events table
DROP TRIGGER IF EXISTS trg_analytics_events_aggregator ON public.analytics_events;
CREATE TRIGGER trg_analytics_events_aggregator
    AFTER INSERT ON public.analytics_events
    FOR EACH ROW
    EXECUTE FUNCTION public.update_analytics_metrics_on_event();

-- 7. Create Rebuild function to aggregate historic events on demand
CREATE OR REPLACE FUNCTION public.rebuild_analytics_metrics(p_org_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Limpar métricas existentes da organização
    DELETE FROM public.analytics_product_metrics WHERE organization_id = p_org_id;
    DELETE FROM public.analytics_variant_metrics WHERE organization_id = p_org_id;

    -- Recalcular visualizações
    INSERT INTO public.analytics_product_metrics (product_id, organization_id, views, updated_at)
    SELECT 
        (metadata->>'product_id')::uuid as product_id,
        p_org_id,
        count(*) as views,
        now()
    FROM public.analytics_events
    WHERE event_type = 'product_view'
      AND organization_id = p_org_id
      AND (metadata->>'product_id') IS NOT NULL
    GROUP BY 1
    ON CONFLICT (product_id) DO UPDATE SET views = EXCLUDED.views, updated_at = now();

    -- Recalcular tryons
    INSERT INTO public.analytics_product_metrics (product_id, organization_id, tryons, updated_at)
    SELECT 
        coalesce((e.metadata->>'product_id')::uuid, pv.product_id) as product_id,
        p_org_id,
        count(*) as tryons,
        now()
    FROM public.analytics_events e
    LEFT JOIN public.product_variants pv ON pv.id = (e.metadata->>'variant_id')::uuid
    WHERE e.event_type = 'vton_render_completed'
      AND e.organization_id = p_org_id
    GROUP BY 1
    ON CONFLICT (product_id) DO UPDATE SET tryons = EXCLUDED.tryons, updated_at = now();

    -- Recalcular cart additions
    INSERT INTO public.analytics_product_metrics (product_id, organization_id, cart_additions, updated_at)
    SELECT 
        coalesce((e.metadata->>'product_id')::uuid, pv.product_id) as product_id,
        p_org_id,
        count(*) as cart_additions,
        now()
    FROM public.analytics_events e
    LEFT JOIN public.product_variants pv ON pv.id = (e.metadata->>'variant_id')::uuid
    WHERE e.event_type = 'add_to_cart'
      AND e.organization_id = p_org_id
    GROUP BY 1
    ON CONFLICT (product_id) DO UPDATE SET cart_additions = EXCLUDED.cart_additions, updated_at = now();

    -- Recalcular purchases
    INSERT INTO public.analytics_product_metrics (product_id, organization_id, purchases, updated_at)
    SELECT 
        pv.product_id,
        p_org_id,
        sum(oi.quantity) as purchases,
        now()
    FROM public.analytics_events e
    JOIN public.order_items oi ON oi.order_id = e.metadata->>'order_id'
    JOIN public.product_variants pv ON pv.id = oi.variant_id
    WHERE e.event_type = 'payment_completed'
      AND e.organization_id = p_org_id
    GROUP BY 1
    ON CONFLICT (product_id) DO UPDATE SET purchases = EXCLUDED.purchases, updated_at = now();

    -- Recalcular variant conversions
    INSERT INTO public.analytics_variant_metrics (variant_id, organization_id, size, color, conversions, updated_at)
    SELECT 
        oi.variant_id,
        p_org_id,
        pv.size,
        pv.color,
        sum(oi.quantity) as conversions,
        now()
    FROM public.analytics_events e
    JOIN public.order_items oi ON oi.order_id = e.metadata->>'order_id'
    JOIN public.product_variants pv ON pv.id = oi.variant_id
    WHERE e.event_type = 'payment_completed'
      AND e.organization_id = p_org_id
    GROUP BY 1, 2, 3
    ON CONFLICT (variant_id) DO UPDATE SET conversions = EXCLUDED.conversions, updated_at = now();

    -- Atualizar taxas e scores
    UPDATE public.analytics_product_metrics
    SET 
        conversion_rate = round(coalesce((purchases::numeric / nullif(views, 0)) * 100, 0.00), 2),
        vton_rate = round(coalesce((tryons::numeric / nullif(views, 0)) * 100, 0.00), 2),
        score = least(100, round((coalesce(views, 0) * 0.05) + (coalesce(tryons, 0) * 0.25) + (coalesce(cart_additions, 0) * 0.5) + (coalesce(purchases, 0) * 5.0)))
    WHERE organization_id = p_org_id;

    RETURN true;
END;
$$;

-- 8. Enable Row Level Security (RLS)
ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analytics_product_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analytics_variant_metrics ENABLE ROW LEVEL SECURITY;

-- 9. Create Security Policies
DROP POLICY IF EXISTS "Public insert analytics events" ON public.analytics_events;
CREATE POLICY "Public insert analytics events" 
    ON public.analytics_events FOR INSERT 
    WITH CHECK (true);

DROP POLICY IF EXISTS "Service role select analytics events" ON public.analytics_events;
CREATE POLICY "Service role select analytics events" 
    ON public.analytics_events FOR SELECT 
    USING (true);

DROP POLICY IF EXISTS "Select analytics product metrics" ON public.analytics_product_metrics;
CREATE POLICY "Select analytics product metrics" 
    ON public.analytics_product_metrics FOR SELECT 
    USING (true);

DROP POLICY IF EXISTS "Select analytics variant metrics" ON public.analytics_variant_metrics;
CREATE POLICY "Select analytics variant metrics" 
    ON public.analytics_variant_metrics FOR SELECT 
    USING (true);
