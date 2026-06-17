-- Migração para desativar temporariamente a cota diária de 3 usos sem deletar a funcionalidade
CREATE OR REPLACE FUNCTION public.deduct_tryon_credit(p_tenant_id uuid, p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_available_credits integer;
    v_user_uses_today integer;
BEGIN
    -- 1. Verificar cota diária do usuário (3 usos max no dia UTC atual)
    SELECT count(*)::integer INTO v_user_uses_today
    FROM public.ai_credit_transactions
    WHERE user_id = p_user_id
      AND transaction_type = 'usage_tryon'
      AND created_at >= date_trunc('day', now());

    -- Cota diária desativada temporariamente (false AND)
    IF false AND v_user_uses_today >= 3 THEN
        RETURN jsonb_build_object('status', 'error', 'message', 'Você atingiu o limite de 3 provadores gerados por dia.');
    END IF;

    -- 2. Obter e bloquear o saldo de créditos do lojista (tenant)
    SELECT available_credits INTO v_available_credits
    FROM public.organization_ai_credits
    WHERE tenant_id = p_tenant_id
    FOR UPDATE;

    IF v_available_credits IS NULL OR v_available_credits <= 0 THEN
        RETURN jsonb_build_object('status', 'error', 'message', 'Esta loja não possui créditos de IA disponíveis.');
    END IF;

    -- 3. Deduzir o crédito do lojista
    UPDATE public.organization_ai_credits
    SET available_credits = available_credits - 1
    WHERE tenant_id = p_tenant_id;

    -- 4. Registrar a transação no extrato
    INSERT INTO public.ai_credit_transactions (tenant_id, user_id, amount, transaction_type, description)
    VALUES (p_tenant_id, p_user_id, -1, 'usage_tryon', 'Uso do Provador Virtual IA');

    RETURN jsonb_build_object(
        'status', 'success',
        'remaining_credits', v_available_credits - 1,
        'user_uses_today', v_user_uses_today + 1
    );
END;
$$;
