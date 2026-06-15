import { supabase } from "@/integrations/supabase/client";

const BUCKET = "event-media";
// 10 years
const SIGNED_TTL = 60 * 60 * 24 * 365 * 10;

export type UploadResult = { url: string; path: string };

const MAX_ATTEMPTS = 4;

function isRetriable(err: unknown): boolean {
  const msg = (err as { message?: string } | null)?.message?.toLowerCase() ?? "";
  const status = (err as { status?: number; statusCode?: number } | null)?.status
    ?? (err as { statusCode?: number } | null)?.statusCode;
  if (status && (status === 408 || status === 425 || status === 429 || status >= 500)) return true;
  return /network|timeout|fetch|failed to fetch|temporar|connection|reset|abort/.test(msg);
}

async function withRetry<T>(fn: () => Promise<T>, label: string): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (attempt === MAX_ATTEMPTS || !isRetriable(err)) throw err;
      const delay = Math.min(8000, 400 * 2 ** (attempt - 1)) + Math.random() * 250;
      console.warn(`[upload] ${label} falhou (tentativa ${attempt}/${MAX_ATTEMPTS}), tentando de novo em ${Math.round(delay)}ms`, err);
      await new Promise(r => setTimeout(r, delay));
    }
  }
  throw lastErr;
}

export async function uploadEventFile(
  eventId: string,
  file: File | Blob,
  kind: "photo" | "sponsor" | "banner",
): Promise<UploadResult> {
  const ext = (file instanceof File && file.name.split(".").pop()) || "jpg";
  const path = `${eventId}/${kind}/${crypto.randomUUID()}.${ext}`;
  await withRetry(async () => {
    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(path, file, { contentType: (file as File).type || "image/jpeg", upsert: false });
    if (error) throw error;
  }, "upload");
  const data = await withRetry(async () => {
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(path, SIGNED_TTL);
    if (error || !data) throw error ?? new Error("Failed to sign URL");
    return data;
  }, "signUrl");
  return { url: data.signedUrl, path };
}

