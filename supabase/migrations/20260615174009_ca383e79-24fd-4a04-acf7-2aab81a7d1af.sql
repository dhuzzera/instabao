
-- 1. Prevent duplicate likes from the same client on the same photo
CREATE UNIQUE INDEX IF NOT EXISTS photo_likes_photo_client_uniq
  ON public.photo_likes(photo_id, client_id);

-- 2. Replace "always true" insert policies with minimal sanity checks
DROP POLICY IF EXISTS "photo_likes public insert" ON public.photo_likes;
CREATE POLICY "photo_likes public insert" ON public.photo_likes
  FOR INSERT TO public
  WITH CHECK (photo_id IS NOT NULL AND length(client_id) BETWEEN 1 AND 128);

DROP POLICY IF EXISTS "photos public insert" ON public.photos;
CREATE POLICY "photos public insert" ON public.photos
  FOR INSERT TO public
  WITH CHECK (
    event_id IS NOT NULL
    AND image_url IS NOT NULL AND length(image_url) <= 2048
    AND (client_id IS NULL OR length(client_id) <= 128)
    AND (guest_name IS NULL OR length(guest_name) <= 80)
    AND EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_id AND e.status = 'active')
  );

-- 3. Tighten storage upload policy: must be event-media bucket, first folder = uuid (event id),
--    second folder = photo/sponsor/banner.
DROP POLICY IF EXISTS "event-media public insert" ON storage.objects;
CREATE POLICY "event-media public insert" ON storage.objects
  FOR INSERT TO public
  WITH CHECK (
    bucket_id = 'event-media'
    AND (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    AND (storage.foldername(name))[2] IN ('photo','sponsor','banner')
  );

-- 4. Revoke execute on admin-only SECURITY DEFINER helpers from anon/public
REVOKE EXECUTE ON FUNCTION public.set_moderator_by_email(text, boolean) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.list_moderators() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_moderator_by_email(text, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_moderators() TO authenticated;

-- has_role is only referenced by policies scoped to authenticated; no need to expose to anon
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
