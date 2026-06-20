
-- 1) Hide client_id from public reads (column-level privilege)
REVOKE SELECT (client_id) ON public.photos FROM anon, authenticated;
REVOKE SELECT (client_id) ON public.photo_likes FROM anon, authenticated;

-- 2) RPC so a guest can fetch their own liked photo ids
CREATE OR REPLACE FUNCTION public.my_liked_photo_ids(_event_id uuid, _client_id text)
RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT pl.photo_id
    FROM public.photo_likes pl
    JOIN public.photos p ON p.id = pl.photo_id
   WHERE p.event_id = _event_id AND pl.client_id = _client_id;
$$;
GRANT EXECUTE ON FUNCTION public.my_liked_photo_ids(uuid, text) TO anon, authenticated;

-- 3) Restrict photo image_url to this project's Supabase storage origin
DROP POLICY IF EXISTS "photos public insert" ON public.photos;
CREATE POLICY "photos public insert" ON public.photos
FOR INSERT
WITH CHECK (
  event_id IS NOT NULL
  AND image_url IS NOT NULL
  AND length(image_url) <= 2048
  AND image_url LIKE 'https://qalnsfrzjduciqvdgyyn.supabase.co/storage/v1/%'
  AND ((client_id IS NULL) OR (length(client_id) <= 128))
  AND ((guest_name IS NULL) OR (length(guest_name) <= 80))
  AND EXISTS (
    SELECT 1 FROM public.events e
    WHERE e.id = photos.event_id AND e.status = 'active'
  )
);

-- 4) Fix the storage insert policy join bug (e.name -> name)
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
      AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'moderator'))
      AND (storage.foldername(name))[2] = ANY (ARRAY['photo','sponsor','banner'])
    )
  )
);

-- 5) Sponsors UPDATE policy for admins/moderators
DROP POLICY IF EXISTS "sponsors mod update" ON public.sponsors;
CREATE POLICY "sponsors mod update" ON public.sponsors
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'moderator'))
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'moderator'));
