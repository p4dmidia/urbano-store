-- MIGRATION: Fix Referral Network and Consolidate Registration Trigger (V2 - Sponsor Led Org)
-- Este script unifica a lógica de cadastro e garante que a rede permaneça no mesmo tenant do padrinho.

-- 1. Função de Trigger Consolidada e Inteligente
CREATE OR REPLACE FUNCTION public.handle_new_affiliate_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
 AS $function$
 DECLARE
   v_full_name text;
   v_sponsor_id uuid;
   v_sponsor_org_id uuid;
   v_org_id uuid;
   v_sponsor_code text;
   v_error_msg text;
 BEGIN
   -- A. Log de Entrada
   INSERT INTO public.debug_logs (operation, message, metadata) 
   VALUES ('signup_start', 'Iniciando processamento: ' || new.email, new.raw_user_meta_data);

   -- B. Determinar Nome Completo
   v_full_name := TRIM(CONCAT_WS(' ', new.raw_user_meta_data ->> 'nome', new.raw_user_meta_data ->> 'sobrenome'));
   IF v_full_name = '' THEN v_full_name := 'Novo Afiliado'; END IF;

   -- C. Determinar Organização Inicial (metadata ou fallback Classe A)
   BEGIN
     v_org_id := (new.raw_user_meta_data ->> 'organization_id')::uuid;
   EXCEPTION WHEN OTHERS THEN
     v_org_id := NULL;
   END;

   IF v_org_id IS NULL THEN
      SELECT id INTO v_org_id FROM public.organizations WHERE name = 'Classe A' LIMIT 1;
   END IF;

   -- D. Resolver ID do Padrinho (Sponsor) - BUSCA GLOBAL (Ignora Org ID no lookup)
   v_sponsor_code := NULLIF(new.raw_user_meta_data ->> 'sponsor_code', '');
   
   IF v_sponsor_code IS NOT NULL THEN
     -- Buscamos pelo referral_code de forma global
     SELECT id, organization_id INTO v_sponsor_id, v_sponsor_org_id 
     FROM public.affiliates 
     WHERE LOWER(referral_code) = LOWER(v_sponsor_code)
     LIMIT 1;

     IF v_sponsor_id IS NOT NULL THEN
        -- CRITICAL FIX: Se o padrinho existe, o novo usuário PRECISA estar na mesma organização que ele.
        -- Isso resolve o problema de usuários em tenants diferentes (ex: Bella Sousa vs Classe A)
        v_org_id := v_sponsor_org_id;
        
        INSERT INTO public.debug_logs (operation, message) 
        VALUES ('signup_sponsor_found', 'Padrinho vinculado: ' || v_sponsor_code || ' na org: ' || v_org_id);
     ELSE
        INSERT INTO public.debug_logs (operation, message) 
        VALUES ('signup_warning', 'Padrinho não encontrado globalmente para o código: ' || v_sponsor_code);
     END IF;
   END IF;

   -- E. Criar Perfil do Usuário
   BEGIN
     INSERT INTO public.user_profiles (
       id, email, role, cpf, cnpj, registration_type, 
       organization_id, sponsor_id, created_at, updated_at
     )
     VALUES (
       new.id, new.email, 
       COALESCE(new.raw_user_meta_data ->> 'role', 'affiliate'),
       new.raw_user_meta_data ->> 'cpf', new.raw_user_meta_data ->> 'cnpj',
       new.raw_user_meta_data ->> 'registration_type',
       v_org_id, v_sponsor_id,
       new.created_at, new.created_at
     );
   EXCEPTION WHEN OTHERS THEN
     GET STACKED DIAGNOSTICS v_error_msg = MESSAGE_TEXT;
     INSERT INTO public.debug_logs (operation, message, metadata) VALUES ('signup_error_profile', v_error_msg, new.raw_user_meta_data);
     RAISE;
   END;

   -- F. Criar Registro de Afiliado
   BEGIN
     INSERT INTO public.affiliates (
       user_id, email, full_name, referral_code, cpf, cnpj, whatsapp, 
       organization_id, sponsor_id, is_active, created_at, updated_at
     )
     VALUES (
       new.id, new.email, v_full_name,
       new.raw_user_meta_data ->> 'login',
       new.raw_user_meta_data ->> 'cpf', new.raw_user_meta_data ->> 'cnpj',
       new.raw_user_meta_data ->> 'whatsapp',
       v_org_id, v_sponsor_id, true,
       new.created_at, new.updated_at
     );
   EXCEPTION WHEN OTHERS THEN
     GET STACKED DIAGNOSTICS v_error_msg = MESSAGE_TEXT;
     INSERT INTO public.debug_logs (operation, message, metadata) VALUES ('signup_error_affiliate', v_error_msg, new.raw_user_meta_data);
     RAISE;
   END;

   -- G. Criar Configurações Iniciais
   BEGIN
     INSERT INTO public.user_settings (user_id, organization_id, created_at, updated_at)
     VALUES (new.id, v_org_id, new.created_at, new.created_at);
   EXCEPTION WHEN OTHERS THEN NULL; END;
   
   RETURN new;
 END;
 $function$;

-- 2. Recriar Trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_affiliate_user();
