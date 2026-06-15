import { supabase } from "@/integrations/supabase/client";

const BUCKET = "event-media";
// 10 years
const SIGNED_TTL = 60 * 60 * 24 * 365 * 10;

export async function uploadEventFile(
  eventId: string,
  file: File | Blob,
  kind: "photo" | "sponsor" | "banner",
): Promise<string> {
  const ext = (file instanceof File && file.name.split(".").pop()) || "jpg";
  const path = `${eventId}/${kind}/${crypto.randomUUID()}.${ext}`;
  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { contentType: (file as File).type || "image/jpeg", upsert: false });
  if (upErr) throw upErr;
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, SIGNED_TTL);
  if (error || !data) throw error ?? new Error("Failed to sign URL");
  return data.signedUrl;
}
