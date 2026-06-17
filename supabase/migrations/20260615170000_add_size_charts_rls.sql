-- Migration: Add Row Level Security Policies for size_charts
-- Date: 2026-06-15

ALTER TABLE public.size_charts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read size charts" ON public.size_charts;
CREATE POLICY "Public read size charts" ON public.size_charts FOR SELECT
USING (true);

DROP POLICY IF EXISTS "Write size charts for staff" ON public.size_charts;
CREATE POLICY "Write size charts for staff" ON public.size_charts FOR ALL
USING (
    (product_id IS NULL OR EXISTS (
        SELECT 1 FROM public.products p 
        WHERE p.id = size_charts.product_id 
        AND public.has_tenant_access(auth.uid(), p.tenant_id)
    ))
);
