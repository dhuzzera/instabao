-- ============================================================
-- Fix all security issues detected by Lovable security scan
-- ============================================================

-- ----------------------------------------------------------------
-- CRITICAL 1: Guest Client IDs Are Publicly Readable
-- The photo_likes table had no RLS, so any client_id was readable
-- and usable to delete another guest's likes/photos.
-- Fix: add SELECT policy to photo_likes (only own rows or mod);
--      delete_my_like already checks client_id server-side, but
--      we also prevent reads leaking other guests' client_ids.
-- ----------------------------------------------------------------

-- Ensure RLS is on (should already be, but be safe)
ALTER TABLE public.photo_likes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "photo_likes public read"  ON public.photo_likes;
DROP POLICY IF EXISTS "photo_likes own read"     ON public.photo_likes;

-- Anyone can read aggregate counts (needed for like counters), but
-- the client_id column is only visible to the owner or a moderator.
-- We achieve this by keeping SELECT open but stripping client_id
-- exposure via a security-invoker view is complex; instead we simply
-- restrict row-level reads to own rows + mods. The realtime channel
-- used in AfterFest only needs photo_id + count, not client_id.
CREATE POLICY "photo_likes own read"
  ON public.photo_likes FOR SELECT
  USING (
    client_id = (current_setting('request.headers', true)::json->>'x-client-id')
    OR (auth.uid() IS NOT NULL AND (
      public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'moderator')
    ))
  );

-- Public insert (guests like photos anonymously)
DROP POLICY IF EXISTS "photo_likes public insert" ON public.photo_likes;
CREATE POLICY "photo_likes public insert"
  ON public.photo_likes FOR INSERT
  WITH CHECK (true);

-- ----------------------------------------------------------------
-- CRITICAL 2: Storage insert policy allows uploads to any path
-- The existing policy validates the folder structure but the regex
-- was case-insensitive (~*) and didn't enforce the uuid strictly.
-- Fix: tighten to case-sensitive exact UUID pattern + valid subfolder.
-- ----------------------------------------------------------------

DROP POLICY IF EXISTS "event-media insert" ON storage.objects;

CREATE POLICY "event-media insert"
ON storage.objects FOR INSERT TO public
WITH CHECK (
  bucket_id = 'event-media'
  -- First folder must be a valid lowercase UUID
  AND (storage.foldername(name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  -- Second folder must be an allowed type
  AND (storage.foldername(name))[2] = ANY (ARRAY['photo', 'sponsor', 'banner'])
  AND (
    -- Guests can only upload photos to active events
    (
      (storage.foldername(name))[2] = 'photo'
      AND EXISTS (
        SELECT 1 FROM public.events e
        WHERE e.id::text = (storage.foldername(name))[1]
          AND e.status = 'active'
      )
    )
    OR
    -- Admins/moderators can upload any allowed type
    (
      auth.uid() IS NOT NULL
      AND (
        public.has_role(auth.uid(), 'admin'::app_role)
        OR public.has_role(auth.uid(), 'moderator'::app_role)
      )
    )
  )
);

-- ----------------------------------------------------------------
-- WARNING 1: Photos Table Accepts Arbitrary External URLs
-- Add a CHECK constraint so image_url must start with the
-- Supabase storage URL for this project (prevents content injection).
-- We use a permissive pattern matching supabase.co storage URLs.
-- ----------------------------------------------------------------

ALTER TABLE public.photos
  DROP CONSTRAINT IF EXISTS photos_image_url_storage_chk;

ALTER TABLE public.photos
  ADD CONSTRAINT photos_image_url_storage_chk
  CHECK (
    image_url ~ '^https://[a-zA-Z0-9]+\.supabase\.co/storage/'
    OR image_url ~ '^https://[a-zA-Z0-9]+\.supabase\.in/storage/'
  );

-- ----------------------------------------------------------------
-- WARNING 2: Sponsors table has no UPDATE policy
-- Admins and moderators need to be able to reorder sponsors.
-- ----------------------------------------------------------------

DROP POLICY IF EXISTS "sponsors mod update" ON public.sponsors;

CREATE POLICY "sponsors mod update"
  ON public.sponsors FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'moderator')
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'moderator')
  );
