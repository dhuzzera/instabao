-- Add instagram handle field to sponsors table
ALTER TABLE public.sponsors
  ADD COLUMN IF NOT EXISTS instagram text;
