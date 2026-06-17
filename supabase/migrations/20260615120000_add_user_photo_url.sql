-- Migration: Add user_photo_url column to user_body_profiles and set storage policies
-- Date: 2026-06-15

ALTER TABLE public.user_body_profiles ADD COLUMN IF NOT EXISTS user_photo_url text;

-- Allow authenticated users to upload photos to storage bucket 'product-images' inside body-profiles folder
DROP POLICY IF EXISTS "Users Upload Body Profiles" ON storage.objects;
CREATE POLICY "Users Upload Body Profiles" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'product-images' 
    AND (auth.role() = 'authenticated')
    AND (name LIKE 'profiles/%' OR name LIKE 'body-profiles/%')
  );

-- Allow authenticated users to manage their own uploads
DROP POLICY IF EXISTS "Users Manage Own Body Profiles" ON storage.objects;
CREATE POLICY "Users Manage Own Body Profiles" ON storage.objects
  FOR ALL USING (
    bucket_id = 'product-images' 
    AND (auth.role() = 'authenticated')
    AND (name LIKE 'profiles/%' OR name LIKE 'body-profiles/%')
  );
