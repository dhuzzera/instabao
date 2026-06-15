
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

  DELETE FROM storage.objects
   WHERE bucket_id = 'event-media'
     AND name IN (SELECT storage_path FROM public.photos WHERE event_id = _event_id AND storage_path IS NOT NULL);

  DELETE FROM public.events WHERE id = _event_id;
  RETURN true;
END;
$$;
