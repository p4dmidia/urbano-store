-- Migration: Add age, body_type, and fit_preference to user_body_profiles
-- Date: 2026-06-15

ALTER TABLE public.user_body_profiles ADD COLUMN IF NOT EXISTS age integer;
ALTER TABLE public.user_body_profiles ADD COLUMN IF NOT EXISTS body_type text; -- 'slim' | 'medium' | 'muscular' | 'plus_size'
ALTER TABLE public.user_body_profiles ADD COLUMN IF NOT EXISTS fit_preference text; -- 'tight' | 'normal' | 'loose'
