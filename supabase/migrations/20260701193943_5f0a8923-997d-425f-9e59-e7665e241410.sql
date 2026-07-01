
CREATE POLICY "avatars read for signed-in" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id='avatars');
CREATE POLICY "avatars owner write" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id='avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "avatars owner update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id='avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "avatars owner delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id='avatars' AND ((storage.foldername(name))[1] = auth.uid()::text OR public.has_role(auth.uid(),'admin')));
CREATE POLICY "avatars admin write any" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id='avatars' AND public.has_role(auth.uid(),'admin'));
