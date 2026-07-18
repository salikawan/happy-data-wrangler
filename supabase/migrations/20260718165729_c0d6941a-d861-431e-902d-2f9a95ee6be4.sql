DROP POLICY IF EXISTS "avatars read for signed-in" ON storage.objects;
CREATE POLICY "avatars owner or admin read" ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'avatars'
  AND (
    (storage.foldername(name))[1] = (auth.uid())::text
    OR private.has_role(auth.uid(), 'admin'::app_role)
  )
);