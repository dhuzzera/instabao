
CREATE POLICY "event-media public read" ON storage.objects FOR SELECT USING (bucket_id = 'event-media');
CREATE POLICY "event-media public insert" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'event-media');
CREATE POLICY "event-media public delete" ON storage.objects FOR DELETE USING (bucket_id = 'event-media');
