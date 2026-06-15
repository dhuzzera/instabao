
-- 1) Roles enum + table
CREATE TYPE public.app_role AS ENUM ('admin', 'moderator');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 2) has_role security-definer helper
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  );
$$;

REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO anon, authenticated;

-- 3) user_roles policies (admins manage; user reads own)
CREATE POLICY "user_roles read own"
  ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "user_roles admin manage"
  ON public.user_roles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 4) First user becomes admin
CREATE OR REPLACE FUNCTION public.bootstrap_first_admin()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin') THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin')
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS bootstrap_first_admin_on_signup ON auth.users;
CREATE TRIGGER bootstrap_first_admin_on_signup
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.bootstrap_first_admin();

-- 5) Lock down events + sponsors writes to admin/moderator
DROP POLICY IF EXISTS "events public insert" ON public.events;
DROP POLICY IF EXISTS "events public update" ON public.events;
DROP POLICY IF EXISTS "events public delete" ON public.events;

CREATE POLICY "events mod insert" ON public.events FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'moderator'));
CREATE POLICY "events mod update" ON public.events FOR UPDATE TO authenticated
  USING      (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'moderator'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'moderator'));
CREATE POLICY "events mod delete" ON public.events FOR DELETE TO authenticated
  USING      (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'moderator'));

DROP POLICY IF EXISTS "sponsors public insert" ON public.sponsors;
DROP POLICY IF EXISTS "sponsors public delete" ON public.sponsors;

CREATE POLICY "sponsors mod insert" ON public.sponsors FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'moderator'));
CREATE POLICY "sponsors mod delete" ON public.sponsors FOR DELETE TO authenticated
  USING      (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'moderator'));

-- 6) Moderators can delete any photo
CREATE OR REPLACE FUNCTION public.delete_my_photo(_photo_id uuid, _client_id text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner text;
  v_path  text;
  v_is_mod boolean;
BEGIN
  v_is_mod := auth.uid() IS NOT NULL AND (
    public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'moderator')
  );

  SELECT client_id, storage_path INTO v_owner, v_path
    FROM public.photos WHERE id = _photo_id;

  IF v_owner IS NULL AND NOT v_is_mod THEN
    RETURN false;
  END IF;

  IF NOT v_is_mod AND v_owner <> _client_id THEN
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

-- 7) Admin RPC: promote/demote moderator by email
CREATE OR REPLACE FUNCTION public.set_moderator_by_email(_email text, _grant boolean)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT id INTO v_user_id FROM auth.users WHERE lower(email) = lower(_email) LIMIT 1;
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'user_not_found';
  END IF;

  IF _grant THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (v_user_id, 'moderator')
    ON CONFLICT DO NOTHING;
    RETURN 'granted';
  ELSE
    DELETE FROM public.user_roles WHERE user_id = v_user_id AND role = 'moderator';
    RETURN 'revoked';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.set_moderator_by_email(text, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_moderator_by_email(text, boolean) TO authenticated;

-- 8) Admin RPC: list moderators (with email)
CREATE OR REPLACE FUNCTION public.list_moderators()
RETURNS TABLE (user_id uuid, email text, role public.app_role, created_at timestamptz)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  RETURN QUERY
    SELECT ur.user_id, u.email::text, ur.role, ur.created_at
      FROM public.user_roles ur
      JOIN auth.users u ON u.id = ur.user_id
     ORDER BY ur.created_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.list_moderators() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_moderators() TO authenticated;
