-- Migration: Create product-images storage bucket, set RLS policies, and add logistics columns
-- Date: 2026-06-15

-- 1. Create the product-images bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('product-images', 'product-images', true)
ON CONFLICT (id) DO NOTHING;

-- 2. Drop existing policies to prevent conflicts
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
DROP POLICY IF EXISTS "Admin Upload Access" ON storage.objects;
DROP POLICY IF EXISTS "Admin Update Access" ON storage.objects;
DROP POLICY IF EXISTS "Admin Delete Access" ON storage.objects;

-- 3. Create RLS storage policies
-- Allow public access to view images
CREATE POLICY "Public Access" ON storage.objects
  FOR SELECT USING (bucket_id = 'product-images');

-- Allow admins to upload/manage images
CREATE POLICY "Admin Upload Access" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'product-images' AND public.is_admin(auth.uid()));

-- Allow admins to update images
CREATE POLICY "Admin Update Access" ON storage.objects
  FOR UPDATE USING (bucket_id = 'product-images' AND public.is_admin(auth.uid()));

-- Allow admins to delete images
CREATE POLICY "Admin Delete Access" ON storage.objects
  FOR DELETE USING (bucket_id = 'product-images' AND public.is_admin(auth.uid()));

-- 4. Add logistics and shipping columns to products table
ALTER TABLE public.products 
ADD COLUMN IF NOT EXISTS weight NUMERIC DEFAULT 0.5,
ADD COLUMN IF NOT EXISTS length INTEGER DEFAULT 16,
ADD COLUMN IF NOT EXISTS width INTEGER DEFAULT 11,
ADD COLUMN IF NOT EXISTS height INTEGER DEFAULT 2,
ADD COLUMN IF NOT EXISTS origin_zip TEXT DEFAULT '82820-160';

-- 5. Add shipping columns to orders table
ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS shipping_cost NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS shipping_method TEXT,
ADD COLUMN IF NOT EXISTS tracking_code TEXT;

-- 6. Add comments for documentation
COMMENT ON COLUMN public.products.weight IS 'Peso do produto em kg';
COMMENT ON COLUMN public.products.length IS 'Comprimento do produto em cm';
COMMENT ON COLUMN public.products.width IS 'Largura do produto em cm';
COMMENT ON COLUMN public.products.height IS 'Altura do produto em cm';
COMMENT ON COLUMN public.products.origin_zip IS 'CEP de origem/saída do produto';
