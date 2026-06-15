
-- 1) Fix event-media INSERT policy: use foldername(name), not foldername(e.name)
DROP POLICY IF EXISTS "event-media insert" ON storage.objects;

CREATE POLICY "event-media insert"
ON storage.objects
FOR INSERT
TO public
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
      AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'moderator'))
      AND (storage.foldername(name))[2] = ANY (ARRAY['photo','sponsor','banner'])
    )
  )
);

-- 2) Allow admins/moderators to update and delete files in event-media via storage API
DROP POLICY IF EXISTS "event-media mod delete" ON storage.objects;
CREATE POLICY "event-media mod delete"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'event-media'
  AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'moderator'))
);

DROP POLICY IF EXISTS "event-media mod update" ON storage.objects;
CREATE POLICY "event-media mod update"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'event-media'
  AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'moderator'))
)
WITH CHECK (
  bucket_id = 'event-media'
  AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'moderator'))
);

-- 3) Prevent duplicate likes per (photo, client)
-- Dedupe any existing duplicates first (keep earliest)
DELETE FROM public.photo_likes a
USING public.photo_likes b
WHERE a.photo_id = b.photo_id
  AND a.client_id = b.client_id
  AND a.created_at > b.created_at;

CREATE UNIQUE INDEX IF NOT EXISTS photo_likes_photo_client_uidx
  ON public.photo_likes (photo_id, client_id);
