-- MIGRATION: Fix Referral Network V3 (STRICT Multi-Tenant)
-- Este script garante que o padrinho deve pertencer à MESMA organização que o novo usuário.

CREATE OR REPLACE FUNCTION public.handle_new_affiliate_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
 AS $function$
 DECLARE
   v_full_name text;
   v_sponsor_id uuid;
   v_org_id uuid;
   v_sponsor_code text;
   v_error_msg text;
 BEGIN
   -- A. Log de Entrada
   INSERT INTO public.debug_logs (operation, message, metadata) 
   VALUES ('signup_start', 'Tentativa de cadastro: ' || new.email, new.raw_user_meta_data);

   -- B. Determinar Nome Completo
   v_full_name := TRIM(CONCAT_WS(' ', new.raw_user_meta_data ->> 'nome', new.raw_user_meta_data ->> 'sobrenome'));
   IF v_full_name = '' THEN v_full_name := 'Novo Afiliado'; END IF;

   -- C. Determinar Organização (Obrigatório e Estrito)
   BEGIN
     v_org_id := (new.raw_user_meta_data ->> 'organization_id')::uuid;
   EXCEPTION WHEN OTHERS THEN
     v_org_id := NULL;
   END;

   -- Fallback apenas se não vier no metadado (segurança básica)
   IF v_org_id IS NULL THEN
      SELECT id INTO v_org_id FROM public.organizations WHERE name = 'Classe A' LIMIT 1;
   END IF;

   -- D. Resolver ID do Padrinho (Sponsor) - APENAS NA MESMA ORGANIZAÇÃO
   v_sponsor_code := NULLIF(new.raw_user_meta_data ->> 'sponsor_code', '');
   
   IF v_sponsor_code IS NOT NULL THEN
     -- Buscamos pelo referral_code EXIGINDO a mesma organização
     SELECT id INTO v_sponsor_id 
     FROM public.affiliates 
     WHERE LOWER(referral_code) = LOWER(v_sponsor_code)
     AND organization_id = v_org_id -- <--- REGRA DE ISOLAMENTO
     LIMIT 1;

     IF v_sponsor_id IS NOT NULL THEN
        INSERT INTO public.debug_logs (operation, message) 
        VALUES ('signup_sponsor_found', 'Padrinho vinculado com sucesso: ' || v_sponsor_code || ' na org: ' || v_org_id);
     ELSE
        -- Se não for da mesma org, não vinculamos (impede mistura de redes)
        INSERT INTO public.debug_logs (operation, message) 
        VALUES ('signup_warning', 'Padrinho NÃO CONECTADO: O código ' || v_sponsor_code || ' não pertence a esta organização.');
     END IF;
   END IF;

   -- E. Criar Perfil do Usuário
   INSERT INTO public.user_profiles (id, email, role, cpf, cnpj, registration_type, organization_id, sponsor_id, created_at, updated_at)
   VALUES (new.id, new.email, COALESCE(new.raw_user_meta_data ->> 'role', 'affiliate'), new.raw_user_meta_data ->> 'cpf', new.raw_user_meta_data ->> 'cnpj', new.raw_user_meta_data ->> 'registration_type', v_org_id, v_sponsor_id, new.created_at, new.created_at);

   -- F. Criar Registro de Afiliado
   INSERT INTO public.affiliates (user_id, email, full_name, referral_code, cpf, cnpj, whatsapp, organization_id, sponsor_id, is_active, created_at, updated_at)
   VALUES (new.id, new.email, v_full_name, new.raw_user_meta_data ->> 'login', new.raw_user_meta_data ->> 'cpf', new.raw_user_meta_data ->> 'cnpj', new.raw_user_meta_data ->> 'whatsapp', v_org_id, v_sponsor_id, true, new.created_at, new.updated_at);

   -- G. Criar Configurações Iniciais
   BEGIN
     INSERT INTO public.user_settings (user_id, organization_id, created_at, updated_at)
     VALUES (new.id, v_org_id, new.created_at, new.created_at);
   EXCEPTION WHEN OTHERS THEN NULL; END;
   
   RETURN new;
 END;
 $function$;
