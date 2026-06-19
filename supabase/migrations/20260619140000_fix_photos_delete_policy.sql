-- The "photos public delete" policy was dropped in a previous migration
-- (ownership moved to SECURITY DEFINER RPCs), but no replacement was added
-- for authenticated admins/moderators doing direct deletes via the client.
-- This restores DELETE access for moderators + own-client-id deletes.

-- Allow admins/moderators to delete any photo directly
DROP POLICY IF EXISTS "photos mod delete" ON public.photos;
CREATE POLICY "photos mod delete"
  ON public.photos FOR DELETE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'moderator')
  );

-- Allow guests to delete their own photos (matched by client_id)
-- This covers the case where delete is called from the upload page
DROP POLICY IF EXISTS "photos own delete" ON public.photos;
CREATE POLICY "photos own delete"
  ON public.photos FOR DELETE TO anon, authenticated
  USING (client_id IS NOT NULL AND client_id = current_setting('request.headers', true)::json->>'x-client-id');
