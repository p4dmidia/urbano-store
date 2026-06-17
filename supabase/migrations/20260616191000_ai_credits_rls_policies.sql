-- Migração para adicionar políticas RLS para créditos de IA e transações
-- Data: 2026-06-16

-- Permite leitura pública dos créditos da organização/loja
DROP POLICY IF EXISTS "Read tenant credits" ON public.organization_ai_credits;
CREATE POLICY "Read tenant credits" ON public.organization_ai_credits FOR SELECT
USING (true);

-- Permite que os usuários leiam suas próprias transações de créditos
DROP POLICY IF EXISTS "Read own transactions" ON public.ai_credit_transactions;
CREATE POLICY "Read own transactions" ON public.ai_credit_transactions FOR SELECT
USING (auth.uid() = user_id);
