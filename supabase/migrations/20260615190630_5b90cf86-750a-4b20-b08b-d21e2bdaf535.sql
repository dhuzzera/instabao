
-- 1) Fix mutable search_path on trigger function
CREATE OR REPLACE FUNCTION public.generate_event_short_code()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  code TEXT;
  chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  exists_count INT;
BEGIN
  LOOP
    code := '';
    FOR i IN 1..6 LOOP
      code := code || substr(chars, floor(random() * length(chars))::int + 1, 1);
    END LOOP;
    SELECT COUNT(*) INTO exists_count FROM public.events WHERE short_code = code;
    EXIT WHEN exists_count = 0;
  END LOOP;
  NEW.short_code := code;
  RETURN NEW;
END;
$function$;

-- 2) Restrict EXECUTE on SECURITY DEFINER admin functions
REVOKE EXECUTE ON FUNCTION public.set_moderator_by_email(text, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_moderator_by_email(text, boolean) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.list_moderators() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_moderators() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated, service_role;

-- delete_my_photo / delete_my_like remain callable by anon (guests need them);
-- the functions perform ownership checks via client_id.

-- 3) Tighten storage policies on event-media bucket
DROP POLICY IF EXISTS "event-media public insert" ON storage.objects;
CREATE POLICY "event-media insert"
ON storage.objects FOR INSERT TO public
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
      AND (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'moderator'::app_role))
      AND (storage.foldername(name))[2] = ANY (ARRAY['photo','sponsor','banner'])
    )
  )
);

DROP POLICY IF EXISTS "event-media public read" ON storage.objects;
CREATE POLICY "event-media admin read"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'event-media'
  AND (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'moderator'::app_role))
);
