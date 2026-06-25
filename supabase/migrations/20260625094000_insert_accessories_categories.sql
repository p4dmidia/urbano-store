-- Insert Acessórios and subcategories
DO $$
DECLARE
    accessories_id bigint;
    tenant_id_val uuid := '5111af72-27a5-41fd-8ed9-8c51b78b4fdd';
BEGIN
    -- Check if Acessórios already exists
    SELECT id INTO accessories_id FROM public.product_categories WHERE name = 'Acessórios' AND tenant_id = tenant_id_val LIMIT 1;
    
    IF accessories_id IS NULL THEN
        INSERT INTO public.product_categories (tenant_id, name, parent_id)
        VALUES (tenant_id_val, 'Acessórios', null)
        RETURNING id INTO accessories_id;
    END IF;
    
    -- Insert subcategories if they do not exist
    IF NOT EXISTS (SELECT 1 FROM public.product_categories WHERE name = 'Óculos' AND parent_id = accessories_id) THEN
        INSERT INTO public.product_categories (tenant_id, name, parent_id)
        VALUES (tenant_id_val, 'Óculos', accessories_id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.product_categories WHERE name = 'Joias' AND parent_id = accessories_id) THEN
        INSERT INTO public.product_categories (tenant_id, name, parent_id)
        VALUES (tenant_id_val, 'Joias', accessories_id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.product_categories WHERE name = 'Bolsas' AND parent_id = accessories_id) THEN
        INSERT INTO public.product_categories (tenant_id, name, parent_id)
        VALUES (tenant_id_val, 'Bolsas', accessories_id);
    END IF;
END $$;
