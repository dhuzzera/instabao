
CREATE TABLE public.photo_likes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  photo_id uuid NOT NULL REFERENCES public.photos(id) ON DELETE CASCADE,
  client_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (photo_id, client_id)
);
GRANT SELECT, INSERT, DELETE ON public.photo_likes TO anon, authenticated;
GRANT ALL ON public.photo_likes TO service_role;
ALTER TABLE public.photo_likes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "photo_likes public read" ON public.photo_likes FOR SELECT USING (true);
CREATE POLICY "photo_likes public insert" ON public.photo_likes FOR INSERT WITH CHECK (true);
CREATE POLICY "photo_likes public delete" ON public.photo_likes FOR DELETE USING (true);
CREATE INDEX photo_likes_photo_idx ON public.photo_likes(photo_id);
