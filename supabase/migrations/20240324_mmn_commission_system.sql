-- MMN COMMISSION SYSTEM - CLASSE A
-- Migration: 20240324_mmn_commission_system

-- 1. Create Commissions Log Table
CREATE TABLE IF NOT EXISTS public.commissions (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id uuid REFERENCES public.organizations(id),
    user_id uuid REFERENCES auth.users(id),
    order_id text REFERENCES public.orders(id), -- Alterado para text para compatibilidade
    amount numeric NOT NULL,
    level integer NOT NULL,
    commission_type text, -- 'percent', 'money'
    description text,
    created_at timestamp with time zone DEFAULT now()
);

-- RLS for Commissions
ALTER TABLE public.commissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own commissions" 
ON public.commissions FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all commissions" 
ON public.commissions FOR SELECT 
USING (
    EXISTS (
        SELECT 1 FROM public.user_profiles 
        WHERE id = auth.uid() AND role = 'admin'
    )
);

-- 2. Commission Distribution Function
CREATE OR REPLACE FUNCTION public.distribute_commissions()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_affiliate RECORD;
    v_current_sponsor_id uuid;
    v_config RECORD;
    v_level_config jsonb;
    v_commission_amount numeric;
    v_gen_count integer := 0;
    v_active_gens integer;
BEGIN
    -- Only process if status changed to 'Pago'
    IF (OLD.status IS NULL OR OLD.status != 'Pago') AND NEW.status = 'Pago' THEN
        
        -- Avoid duplicate processing
        IF EXISTS (SELECT 1 FROM public.commissions WHERE order_id = NEW.id) THEN
            RETURN NEW;
        END IF;

        -- Get configuration (Default to 'geral')
        SELECT * INTO v_config FROM public.commission_configs WHERE key = 'geral';
        IF v_config IS NULL THEN
            -- If no config, we can't distribute
            RETURN NEW;
        END IF;

        v_active_gens := v_config.active_generations;

        -- Identify the initial affiliate (the one who referred the sale)
        -- priority 1: referral_code in the order
        IF NEW.referral_code IS NOT NULL AND NEW.referral_code != '' THEN
            SELECT * INTO v_affiliate FROM public.affiliates 
            WHERE referral_code = NEW.referral_code 
            AND organization_id = NEW.organization_id;
        END IF;

        -- priority 2: buyer's sponsor in user_profiles
        IF v_affiliate IS NULL AND NEW.user_id IS NOT NULL THEN
            SELECT a.* INTO v_affiliate 
            FROM public.affiliates a
            JOIN public.user_profiles p ON p.sponsor_id = a.id
            WHERE p.id = NEW.user_id;
        END IF;

        -- If no sponsor found, no commission to distribute
        IF v_affiliate IS NULL THEN
            RETURN NEW;
        END IF;

        v_current_sponsor_id := v_affiliate.id;

        -- Distribute through levels
        WHILE v_gen_count < v_active_gens AND v_current_sponsor_id IS NOT NULL LOOP
            v_gen_count := v_gen_count + 1;
            
            -- Find commission value for this specific level in the JSON array
            -- Format: [{"level": 1, "value": 10}, ...]
            SELECT (lvl->>'value')::numeric INTO v_commission_amount
            FROM jsonb_array_elements(v_config.levels) AS lvl
            WHERE (lvl->>'level')::integer = v_gen_count;

            IF v_commission_amount IS NOT NULL AND v_commission_amount > 0 THEN
                
                -- Calculate actual money amount
                IF v_config.type = 'percent' THEN
                    v_commission_amount := NEW.total_amount * (v_commission_amount / 100);
                END IF;

                -- Get the auth.user_id of the sponsor
                SELECT user_id INTO v_affiliate.user_id FROM public.affiliates WHERE id = v_current_sponsor_id;

                IF v_affiliate.user_id IS NOT NULL THEN
                    -- Update balances
                    UPDATE public.user_settings 
                    SET 
                        total_earnings = total_earnings + v_commission_amount,
                        available_balance = available_balance + v_commission_amount,
                        updated_at = now()
                    WHERE user_id = v_affiliate.user_id;

                    -- Log the commission
                    INSERT INTO public.commissions (
                        organization_id,
                        user_id,
                        order_id,
                        amount,
                        level,
                        commission_type,
                        description
                    ) VALUES (
                        NEW.organization_id,
                        v_affiliate.user_id,
                        NEW.id,
                        v_commission_amount,
                        v_gen_count,
                        v_config.type,
                        'Comissão de Geração ' || v_gen_count || ' - Pedido ' || NEW.id
                    );
                END IF;
            END IF;

            -- Move to next sponsor in hierarchy
            SELECT sponsor_id INTO v_current_sponsor_id 
            FROM public.affiliates 
            WHERE id = v_current_sponsor_id;
            
            -- Security check for infinite loops or broken trees
            IF v_gen_count > 20 THEN EXIT; END IF;
        END LOOP;
    END IF;

    RETURN NEW;
END;
$$;

-- 3. Create Trigger
DROP TRIGGER IF EXISTS trigger_distribute_commissions ON public.orders;
CREATE TRIGGER trigger_distribute_commissions
    AFTER UPDATE ON public.orders
    FOR EACH ROW
    EXECUTE FUNCTION public.distribute_commissions();
