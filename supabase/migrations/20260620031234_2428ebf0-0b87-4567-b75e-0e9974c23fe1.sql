
-- 1) Revoke broad table privileges and re-grant explicit columns (excluding client_id) for anon/authenticated
REVOKE ALL ON public.photos FROM anon, authenticated;
REVOKE ALL ON public.photo_likes FROM anon, authenticated;

GRANT SELECT (id, event_id, image_url, storage_path, guest_name, created_at) ON public.photos TO anon, authenticated;
GRANT INSERT (event_id, image_url, storage_path, guest_name, client_id) ON public.photos TO anon, authenticated;

GRANT SELECT (id, photo_id, created_at) ON public.photo_likes TO anon, authenticated;
GRANT INSERT (photo_id, client_id) ON public.photo_likes TO anon, authenticated;

GRANT ALL ON public.photos TO service_role;
GRANT ALL ON public.photo_likes TO service_role;

-- 2) Fix storage insert policy: use storage.foldername(name) not foldername(e.name)
DROP POLICY IF EXISTS "event-media insert" ON storage.objects;
CREATE POLICY "event-media insert" ON storage.objects
FOR INSERT TO anon, authenticated
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

-- 3) Tighten photos insert: image_url must reference the same storage_path (prevents pointing to other objects)
DROP POLICY IF EXISTS "photos public insert" ON public.photos;
CREATE POLICY "photos public insert" ON public.photos
FOR INSERT TO anon, authenticated
WITH CHECK (
  event_id IS NOT NULL
  AND image_url IS NOT NULL
  AND length(image_url) <= 2048
  AND storage_path IS NOT NULL
  AND (storage.foldername(storage_path))[1] = event_id::text
  AND (storage.foldername(storage_path))[2] = 'photo'
  AND image_url LIKE 'https://qalnsfrzjduciqvdgyyn.supabase.co/storage/v1/%' || storage_path || '%'
  AND (client_id IS NULL OR length(client_id) <= 128)
  AND (guest_name IS NULL OR length(guest_name) <= 80)
  AND EXISTS (
    SELECT 1 FROM public.events e
    WHERE e.id = photos.event_id AND e.status = 'active'
  )
);
