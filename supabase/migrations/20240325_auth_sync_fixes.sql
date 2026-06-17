-- Secure functions to update and delete users from admin panel
-- Migration: 20240325_auth_sync_fixes

-- 1. Function to update user email in auth.users
CREATE OR REPLACE FUNCTION public.admin_update_user_email(target_user_id uuid, new_email text)
RETURNS void AS $$
DECLARE
    v_admin_org_id uuid;
BEGIN
    SELECT organization_id INTO v_admin_org_id FROM public.user_profiles WHERE id = auth.uid() AND role = 'admin';
    IF v_admin_org_id IS NULL THEN
        RAISE EXCEPTION 'Apenas administradores autorizados podem realizar esta ação.';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.user_profiles WHERE id = target_user_id AND organization_id = v_admin_org_id) THEN
        RAISE EXCEPTION 'Você só pode alterar dados de usuários da sua própria organização.';
    END IF;

    UPDATE auth.users SET email = new_email, email_confirmed_at = now(), updated_at = now() WHERE id = target_user_id;
    UPDATE public.user_profiles SET email = new_email WHERE id = target_user_id AND organization_id = v_admin_org_id;
    UPDATE public.affiliates SET email = new_email WHERE user_id = target_user_id AND organization_id = v_admin_org_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Function to update user metadata in auth.users
CREATE OR REPLACE FUNCTION public.admin_update_user_metadata(target_user_id uuid, new_metadata jsonb)
RETURNS void AS $$
DECLARE
    v_admin_org_id uuid;
BEGIN
    SELECT organization_id INTO v_admin_org_id FROM public.user_profiles WHERE id = auth.uid() AND role = 'admin';
    IF v_admin_org_id IS NULL THEN
        RAISE EXCEPTION 'Apenas administradores autorizados podem realizar esta ação.';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.user_profiles WHERE id = target_user_id AND organization_id = v_admin_org_id) THEN
        RAISE EXCEPTION 'Você só pode alterar dados de usuários da sua própria organização.';
    END IF;

    UPDATE auth.users SET raw_user_meta_data = raw_user_meta_data || new_metadata, updated_at = now() WHERE id = target_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Function to delete user entirely (Clean up)
CREATE OR REPLACE FUNCTION public.admin_delete_user(target_user_id uuid)
RETURNS void AS $$
DECLARE
    v_admin_org_id uuid;
BEGIN
    -- Check if the executor is an admin
    SELECT organization_id INTO v_admin_org_id FROM public.user_profiles WHERE id = auth.uid() AND role = 'admin';
    IF v_admin_org_id IS NULL THEN
        RAISE EXCEPTION 'Apenas administradores autorizados podem excluir usuários.';
    END IF;

    -- Safeguard: Ensure target belongs to same org
    IF NOT EXISTS (SELECT 1 FROM public.user_profiles WHERE id = target_user_id AND organization_id = v_admin_org_id) THEN
        RAISE EXCEPTION 'Você só pode excluir usuários da sua própria organização.';
    END IF;
    
    -- Safeguard: Do not allow deleting admins via this RPC
    IF EXISTS (SELECT 1 FROM public.user_profiles WHERE id = target_user_id AND role = 'admin') THEN
        RAISE EXCEPTION 'Não é permitido excluir administradores pelo painel.';
    END IF;

    -- Cleanup public tables explicitly to avoid constraint issues
    DELETE FROM public.commissions WHERE user_id = target_user_id;
    DELETE FROM public.user_settings WHERE user_id = target_user_id;
    DELETE FROM public.affiliates WHERE user_id = target_user_id;
    DELETE FROM public.user_profiles WHERE id = target_user_id;

    -- Finally delete from auth.users (This is the most critical part)
    DELETE FROM auth.users WHERE id = target_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Enable DELETE RLS Policy for admins just in case
DROP POLICY IF EXISTS "Admins can delete any affiliate" ON public.affiliates;
CREATE POLICY "Admins can delete any affiliate" ON public.affiliates
    FOR DELETE USING (
        EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND role = 'admin')
    );

DROP POLICY IF EXISTS "Admins can delete any profile" ON public.user_profiles;
CREATE POLICY "Admins can delete any profile" ON public.user_profiles
    FOR DELETE USING (
        EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND role = 'admin')
    );

GRANT EXECUTE ON FUNCTION public.admin_update_user_email(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_user_metadata(uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_user_delete(uuid) TO authenticated; -- Alias or fix name
CREATE OR REPLACE FUNCTION public.admin_update_user_delete(target_user_id uuid) RETURNS void AS $$ BEGIN PERFORM public.admin_delete_user(target_user_id); END; $$ LANGUAGE plpgsql;
GRANT EXECUTE ON FUNCTION public.admin_delete_user(uuid) TO authenticated;
