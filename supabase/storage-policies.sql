-- ============================================================================
-- Candor Storage Bucket Policies
-- Run this in Supabase SQL Editor AFTER creating the "photos" bucket.
--
-- These policies restrict who can upload/delete files in the photos bucket.
-- Since we use the anon key (no JWT auth), we can't enforce wallet ownership
-- at the storage level. But we can restrict file types and sizes.
-- ============================================================================

-- Allow public read access to all files in the photos bucket
CREATE POLICY "Public read access"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'photos');

-- Allow uploads — restrict to image MIME types only
CREATE POLICY "Allow image uploads"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'photos'
    AND (storage.foldername(name))[1] != ''
    AND (
      LOWER(storage.extension(name)) IN ('jpg', 'jpeg', 'png', 'webp')
    )
  );

-- Allow file replacement (for avatar updates)
CREATE POLICY "Allow file updates"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'photos');

-- Allow file deletion (for avatar replacement flow)
CREATE POLICY "Allow file deletion"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'photos');
