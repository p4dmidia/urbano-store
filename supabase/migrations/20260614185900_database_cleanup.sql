-- 1. Dropar triggers e triggers de conciliação
DROP TRIGGER IF EXISTS tr_on_order_paid_consortium ON public.orders;
DROP TRIGGER IF EXISTS trigger_distribute_commissions ON public.orders;
DROP TRIGGER IF EXISTS on_profile_update ON public.user_profiles;

-- 2. Dropar funções órfãs
DROP FUNCTION IF EXISTS public.handle_consortium_purchase();
DROP FUNCTION IF EXISTS public.distribute_commissions();
DROP FUNCTION IF EXISTS public.sync_profile_to_affiliate();
DROP FUNCTION IF EXISTS public.check_admin_before_delete();

-- 3. Dropar tabelas inativas e dependências do MMN e Consórcio
DROP TABLE IF EXISTS public.consortium_draws CASCADE;
DROP TABLE IF EXISTS public.consortium_participants CASCADE;
DROP TABLE IF EXISTS public.consortium_groups CASCADE;
DROP TABLE IF EXISTS public.commissions CASCADE;
DROP TABLE IF EXISTS public.commission_configs CASCADE;
DROP TABLE IF EXISTS public.company_purchases CASCADE;
DROP TABLE IF EXISTS public.company_cashiers CASCADE;
DROP TABLE IF EXISTS public.companies CASCADE;
DROP TABLE IF EXISTS public.customer_coupons CASCADE;
DROP TABLE IF EXISTS public.withdrawals CASCADE;
DROP TABLE IF EXISTS public.wallet_transactions CASCADE;
DROP TABLE IF EXISTS public.order_extras CASCADE;
DROP TABLE IF EXISTS public.mmn_audit CASCADE;
DROP TABLE IF EXISTS public.mmn_levels CASCADE;
DROP TABLE IF EXISTS public.mmn_config CASCADE;
DROP TABLE IF EXISTS public.transactions CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;
DROP TABLE IF EXISTS public.branches CASCADE;
DROP TABLE IF EXISTS public.affiliates CASCADE;

-- 4. Simplificar a função de trigger handle_new_affiliate_user()
CREATE OR REPLACE FUNCTION public.handle_new_affiliate_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
 AS $function$
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

   -- Criar Perfil Simples (Sem patrocinador/referrer)
   INSERT INTO public.user_profiles (
     id, email, role, full_name, login, 
     whatsapp, cpf, cnpj, registration_type, 
     organization_id, status, rank, created_at, updated_at
   ) VALUES (
     new.id, new.email, 
     COALESCE(new.raw_user_meta_data ->> 'role', 'client'),
     v_full_name, v_login,
     new.raw_user_meta_data ->> 'whatsapp',
     new.raw_user_meta_data ->> 'cpf',
     new.raw_user_meta_data ->> 'cnpj',
     'client',
     v_org_id, 'active', 'Cliente', new.created_at, new.created_at
   );

   -- Criar Configurações Iniciais de Saldo
   INSERT INTO public.user_settings (user_id, organization_id, created_at, updated_at)
   VALUES (new.id, v_org_id, new.created_at, new.created_at);
   
   RETURN new;
 END;
 $function$;
