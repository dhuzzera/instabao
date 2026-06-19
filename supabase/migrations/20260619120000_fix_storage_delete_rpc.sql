-- Fix: remove direct DELETE FROM storage.objects from RPC functions.
-- Supabase blocks direct writes to storage.objects via SQL.
-- Storage file deletion is handled client-side via the Storage API.

-- Fix delete_my_photo: only deletes the photos row, no storage.objects touch
CREATE OR REPLACE FUNCTION public.delete_my_photo(_photo_id uuid, _client_id text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner  text;
  v_is_mod boolean;
BEGIN
  v_is_mod := auth.uid() IS NOT NULL AND (
    public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'moderator')
  );

  SELECT client_id INTO v_owner
    FROM public.photos WHERE id = _photo_id;

  IF v_owner IS NULL AND NOT v_is_mod THEN
    RETURN false;
  END IF;

  IF NOT v_is_mod AND v_owner <> _client_id THEN
    RETURN false;
  END IF;

  DELETE FROM public.photos WHERE id = _photo_id;
  RETURN true;
END;
$$;

-- Fix delete_event: only deletes the event row (cascade handles photos/sponsors/likes)
CREATE OR REPLACE FUNCTION public.delete_event(_event_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT (
    public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'moderator')
  ) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  DELETE FROM public.events WHERE id = _event_id;
  RETURN true;
END;
$$;
