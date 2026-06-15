// Rotate an image file by 90/180/270 degrees. Returns a JPEG File.
export async function rotateImage(file: File, degrees: 90 | 180 | 270): Promise<File> {
  if (!file.type.startsWith("image/")) return file;
  const bitmap = await loadBitmap(file);
  const rotated = degrees === 180;
  const w = rotated ? bitmap.width : bitmap.height;
  const h = rotated ? bitmap.height : bitmap.width;
  const canvas = document.createElement("canvas");
  if (degrees === 180) { canvas.width = bitmap.width; canvas.height = bitmap.height; }
  else { canvas.width = h; canvas.height = w; }
  const ctx = canvas.getContext("2d");
  if (!ctx) return file;
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate((degrees * Math.PI) / 180);
  ctx.drawImage(bitmap, -bitmap.width / 2, -bitmap.height / 2);
  const blob: Blob | null = await new Promise(res =>
    canvas.toBlob(b => res(b), "image/jpeg", 0.92),
  );
  if (!blob) return file;
  const name = file.name.replace(/\.[^.]+$/, "") + ".jpg";
  return new File([blob], name, { type: "image/jpeg", lastModified: Date.now() });
}

async function loadBitmap(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if ("createImageBitmap" in window) {
    try { return await createImageBitmap(file); } catch { /* fall through */ }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return img;
  } finally { URL.revokeObjectURL(url); }
}
