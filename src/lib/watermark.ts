// Applies an InstaBão watermark to image blobs/URLs using a canvas.
// Returns a JPEG Blob. Falls back to the original blob on failure.

export type WatermarkOptions = {
  eventName?: string | null;
  brand?: string;
};

async function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

export async function watermarkBlob(input: Blob, opts: WatermarkOptions = {}): Promise<Blob> {
  const url = URL.createObjectURL(input);
  try {
    const img = await loadImage(url);
    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return input;
    ctx.drawImage(img, 0, 0);

    const brand = opts.brand ?? "InstaBão";
    const event = (opts.eventName ?? "").trim();
    const W = canvas.width;
    const H = canvas.height;
    const pad = Math.round(Math.min(W, H) * 0.025);
    const fontSizeBrand = Math.max(18, Math.round(Math.min(W, H) * 0.035));
    const fontSizeEvent = Math.max(14, Math.round(fontSizeBrand * 0.6));

    ctx.textBaseline = "bottom";
    ctx.textAlign = "left";

    // Gradient bar background for readability
    const barHeight = fontSizeBrand + fontSizeEvent + pad * 1.6;
    const grad = ctx.createLinearGradient(0, H - barHeight, 0, H);
    grad.addColorStop(0, "rgba(0,0,0,0)");
    grad.addColorStop(1, "rgba(0,0,0,0.55)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, H - barHeight, W, barHeight);

    // Brand text
    ctx.font = `800 ${fontSizeBrand}px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`;
    ctx.fillStyle = "rgba(255,255,255,0.98)";
    ctx.shadowColor = "rgba(0,0,0,0.45)";
    ctx.shadowBlur = Math.round(fontSizeBrand * 0.25);
    ctx.fillText(brand, pad, H - pad - fontSizeEvent - pad * 0.3);

    if (event) {
      ctx.font = `500 ${fontSizeEvent}px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`;
      ctx.fillStyle = "rgba(255,255,255,0.85)";
      ctx.fillText(event, pad, H - pad);
    }

    const out = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), "image/jpeg", 0.92)
    );
    return out ?? input;
  } catch {
    return input;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function watermarkFromUrl(url: string, opts: WatermarkOptions = {}): Promise<Blob> {
  const res = await fetch(url);
  const blob = await res.blob();
  return watermarkBlob(blob, opts);
}
