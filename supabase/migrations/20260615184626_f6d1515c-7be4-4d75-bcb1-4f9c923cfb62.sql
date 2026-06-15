ALTER TABLE public.events ADD COLUMN short_code TEXT;

CREATE UNIQUE INDEX idx_events_short_code ON public.events(short_code);

CREATE OR REPLACE FUNCTION public.generate_event_short_code()
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER event_short_code_trigger
BEFORE INSERT ON public.events
FOR EACH ROW
WHEN (NEW.short_code IS NULL)
EXECUTE FUNCTION public.generate_event_short_code();