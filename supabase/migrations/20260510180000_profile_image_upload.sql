-- Profile image storage bucket + upload RPC
BEGIN;

-- 1. Storage bucket for profile images
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowedMimeTypes)
VALUES (
  'profile-images',
  'profile-images',
  false,
  5 * 1024 * 1024,  -- 5MB
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- 2. Storage policies
DROP POLICY IF EXISTS "Anyone can view profile images" ON storage.objects;
CREATE POLICY "Anyone can view profile images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'profile-images');

DROP POLICY IF EXISTS "Users can upload own profile image" ON storage.objects;
CREATE POLICY "Users can upload own profile image"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'profile-images'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "Users can update own profile image" ON storage.objects;
CREATE POLICY "Users can update own profile image"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'profile-images')
  WITH CHECK (
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- 3. RPC to upload profile image (updates profiles.avatar_url too)
CREATE OR REPLACE FUNCTION public.upload_profile_image(file_name TEXT, mime_type TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  path TEXT;
  url TEXT;
BEGIN
  -- Build path: user_id/filename
  path := auth.uid()::text || '/' || file_name;

  -- Upload to storage
  INSERT INTO storage.objects (bucket_id, name, owner, mime_type)
  VALUES ('profile-images', path, auth.uid(), mime_type)
  ON CONFLICT (bucket_id, name) DO UPDATE
    SET owner = auth.uid(), mime_type = mime_type;

  -- Get public URL
  SELECT fullname INTO url
  FROM storage.objects
  WHERE bucket_id = 'profile-images' AND name = path;

  -- Update profiles.avatar_url
  UPDATE public.profiles
  SET avatar_url = url
  WHERE id = auth.uid();

  RETURN url;
END;
$$;

COMMIT;