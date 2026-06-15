
-- Track uploader identity and storage path for ownership-based deletion
ALTER TABLE public.photos
  ADD COLUMN IF NOT EXISTS client_id text,
  ADD COLUMN IF NOT EXISTS storage_path text;

-- Remove unrestricted DELETE policies (ownership enforced via SECURITY DEFINER RPCs)
DROP POLICY IF EXISTS "photos public delete" ON public.photos;
DROP POLICY IF EXISTS "photo_likes public delete" ON public.photo_likes;
DROP POLICY IF EXISTS "event-media public delete" ON storage.objects;

-- RPC: delete one's own like
CREATE OR REPLACE FUNCTION public.delete_my_like(_photo_id uuid, _client_id text)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.photo_likes
   WHERE photo_id = _photo_id
     AND client_id = _client_id;
$$;

-- RPC: delete one's own photo (and the storage object)
CREATE OR REPLACE FUNCTION public.delete_my_photo(_photo_id uuid, _client_id text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner text;
  v_path  text;
BEGIN
  SELECT client_id, storage_path
    INTO v_owner, v_path
    FROM public.photos
   WHERE id = _photo_id;

  IF v_owner IS NULL OR v_owner <> _client_id THEN
    RETURN false;
  END IF;

  IF v_path IS NOT NULL THEN
    DELETE FROM storage.objects
     WHERE bucket_id = 'event-media' AND name = v_path;
  END IF;

  DELETE FROM public.photos WHERE id = _photo_id;
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_my_like(uuid, text)  FROM PUBLIC;
REVOKE ALL ON FUNCTION public.delete_my_photo(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_my_like(uuid, text)  TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.delete_my_photo(uuid, text) TO anon, authenticated;
