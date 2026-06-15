ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS photo_seconds integer NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS sponsor_seconds integer NOT NULL DEFAULT 7,
  ADD COLUMN IF NOT EXISTS photos_per_block integer NOT NULL DEFAULT 5;

ALTER TABLE public.events
  ADD CONSTRAINT events_photo_seconds_chk CHECK (photo_seconds BETWEEN 2 AND 30),
  ADD CONSTRAINT events_sponsor_seconds_chk CHECK (sponsor_seconds BETWEEN 2 AND 30),
  ADD CONSTRAINT events_photos_per_block_chk CHECK (photos_per_block BETWEEN 1 AND 50);