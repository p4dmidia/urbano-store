-- AUTOMATED CONSORTIUM GROUP ASSIGNMENT
-- This migration creates a trigger to automatically assign users to consortium groups
-- or create new ones when a purchase is confirmed.

CREATE OR REPLACE FUNCTION public.handle_consortium_purchase()
RETURNS trigger AS $$
DECLARE
    v_item RECORD;
    v_group_id uuid;
    v_max_p integer;
    v_group_type text;
    v_lucky_number integer;
    v_group_name text;
    v_exists boolean;
BEGIN
    -- Only process if status changed to 'Pago' (Paid)
    -- This handles both manual updates in Admin and automatic webhook updates.
    IF (OLD.status IS NULL OR OLD.status != 'Pago') AND NEW.status = 'Pago' THEN
        
        -- Loop through order items checking for consortium products
        FOR v_item IN 
            SELECT oi.*, p.name as p_name, pc.name as cat_name
            FROM public.order_items oi
            JOIN public.products p ON oi.product_id = p.id
            LEFT JOIN public.product_categories pc ON p.category_id = pc.id
            WHERE oi.order_id = NEW.id
            AND (pc.name ILIKE '%Consórcio%' OR p.name ILIKE '%Consórcio%')
        LOOP
            -- 1. Determine group size and type
            -- Rule: "Colchão" in name/category -> 18 participants, otherwise -> 12.
            IF v_item.p_name ILIKE '%Colchão%' OR v_item.cat_name ILIKE '%Colchão%' THEN
                v_max_p := 18;
                v_group_type := 'colchao';
            ELSE
                v_max_p := 12;
                v_group_type := 'livre_escolha';
            END IF;

            -- 2. Find an existing 'open' group for this organization and type
            -- Check if user is already in an open group (to avoid double entry in the same group)
            SELECT g.id INTO v_group_id
            FROM public.consortium_groups g
            WHERE g.status = 'open'
            AND g.type = v_group_type
            AND g.max_participants = v_max_p
            AND g.organization_id = NEW.organization_id
            AND g.current_participants < v_max_p
            AND NOT EXISTS (
                SELECT 1 FROM public.consortium_participants cp 
                WHERE cp.group_id = g.id AND cp.user_id = NEW.user_id
            )
            ORDER BY g.created_at ASC
            LIMIT 1;

            -- 3. If no suitable group exists, create a new one
            IF v_group_id IS NULL THEN
                v_group_name := 'Grupo ' || 
                    CASE WHEN v_group_type = 'colchao' THEN 'Premium 18' ELSE 'Master 12' END || 
                    ' - ' || (SELECT count(*) + 1 FROM public.consortium_groups WHERE organization_id = NEW.organization_id);

                INSERT INTO public.consortium_groups (
                    name,
                    type,
                    max_participants,
                    current_participants,
                    status,
                    organization_id
                ) VALUES (
                    v_group_name,
                    v_group_type,
                    v_max_p,
                    0,
                    'open',
                    NEW.organization_id
                ) RETURNING id INTO v_group_id;
            END IF;

            -- 4. Determine Lucky Number
            -- We find the next available number from 1 up to max_participants
            SELECT next_num INTO v_lucky_number
            FROM generate_series(1, v_max_p) next_num
            WHERE next_num NOT IN (
                SELECT lucky_number FROM public.consortium_participants WHERE group_id = v_group_id
            )
            ORDER BY next_num ASC
            LIMIT 1;

            -- 5. Add participant
            IF v_lucky_number IS NOT NULL AND NEW.user_id IS NOT NULL THEN
                INSERT INTO public.consortium_participants (
                    group_id,
                    user_id,
                    lucky_number,
                    status
                ) VALUES (
                    v_group_id,
                    NEW.user_id,
                    v_lucky_number,
                    'active'
                ) ON CONFLICT (group_id, user_id) DO NOTHING;

                -- 6. Update current participant count
                UPDATE public.consortium_groups
                SET current_participants = (
                    SELECT count(*) FROM public.consortium_participants WHERE group_id = v_group_id
                )
                WHERE id = v_group_id;

                -- 7. Close group if it just reached full capacity
                UPDATE public.consortium_groups
                SET status = 'full'
                WHERE id = v_group_id AND current_participants >= max_participants;
            END IF;

        END LOOP;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop trigger if exists and recreate
DROP TRIGGER IF EXISTS tr_on_order_paid_consortium ON public.orders;
CREATE TRIGGER tr_on_order_paid_consortium
    AFTER UPDATE ON public.orders
    FOR EACH ROW
    WHEN (NEW.status = 'Pago')
    EXECUTE FUNCTION public.handle_consortium_purchase();
