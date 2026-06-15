DROP POLICY IF EXISTS "event-media insert" ON storage.objects;

CREATE POLICY "event-media insert" ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'event-media'
  AND (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  AND (
    (
      (storage.foldername(name))[2] = 'photo'
      AND EXISTS (
        SELECT 1 FROM public.events e
        WHERE e.id::text = (storage.foldername(name))[1]
          AND e.status = 'active'
      )
    )
    OR (
      auth.uid() IS NOT NULL
      AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'moderator'::app_role))
      AND (storage.foldername(name))[2] = ANY (ARRAY['photo','sponsor','banner'])
    )
  )
);