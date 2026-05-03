
-- Create the chat-images storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('chat-images', 'chat-images', true);

-- Allow anyone to view chat images
CREATE POLICY "Chat images are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'chat-images');

-- Allow authenticated users to upload
CREATE POLICY "Authenticated users can upload chat images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'chat-images' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Allow users to delete own uploads
CREATE POLICY "Users can delete own chat images"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'chat-images' AND auth.uid()::text = (storage.foldername(name))[1]);
