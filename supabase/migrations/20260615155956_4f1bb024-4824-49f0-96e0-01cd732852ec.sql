
CREATE TABLE public.events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  event_date DATE,
  banner_url TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.events TO anon, authenticated;
GRANT ALL ON public.events TO service_role;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "events public read" ON public.events FOR SELECT USING (true);
CREATE POLICY "events public insert" ON public.events FOR INSERT WITH CHECK (true);
CREATE POLICY "events public update" ON public.events FOR UPDATE USING (true);
CREATE POLICY "events public delete" ON public.events FOR DELETE USING (true);

CREATE TABLE public.photos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  guest_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX photos_event_created_idx ON public.photos(event_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.photos TO anon, authenticated;
GRANT ALL ON public.photos TO service_role;
ALTER TABLE public.photos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "photos public read" ON public.photos FOR SELECT USING (true);
CREATE POLICY "photos public insert" ON public.photos FOR INSERT WITH CHECK (true);
CREATE POLICY "photos public delete" ON public.photos FOR DELETE USING (true);

CREATE TABLE public.sponsors (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX sponsors_event_idx ON public.sponsors(event_id, position);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sponsors TO anon, authenticated;
GRANT ALL ON public.sponsors TO service_role;
ALTER TABLE public.sponsors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sponsors public read" ON public.sponsors FOR SELECT USING (true);
CREATE POLICY "sponsors public insert" ON public.sponsors FOR INSERT WITH CHECK (true);
CREATE POLICY "sponsors public delete" ON public.sponsors FOR DELETE USING (true);

ALTER PUBLICATION supabase_realtime ADD TABLE public.photos;
ALTER PUBLICATION supabase_realtime ADD TABLE public.sponsors;
ALTER TABLE public.photos REPLICA IDENTITY FULL;
ALTER TABLE public.sponsors REPLICA IDENTITY FULL;
