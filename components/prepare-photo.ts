const MAX_EDGE = 1600;
const MAX_BYTES = 3_500_000;

function isHeic(file: File): boolean {
  return /heic|heif/i.test(file.type) || /\.(heic|heif)$/i.test(file.name);
}

export type PreparedPhoto = { file: File } | { error: "heic" | "large" | "unread" };

/** Shrink a phone photo to a JPEG before it hits the server action body limit. */
export async function preparePhoto(file: File): Promise<PreparedPhoto> {
  const heic = isHeic(file);
  let bitmap: ImageBitmap | null = null;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    bitmap = null;
  }
  if (!bitmap) {
    if (heic) return { error: "heic" };
    if (file.size > MAX_BYTES) return { error: "large" };
    if (!file.type.startsWith("image/")) return { error: "unread" };
    return { file };
  }
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    return file.size > MAX_BYTES ? { error: "large" } : { file };
  }
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.82));
  if (!blob) return { error: "unread" };
  if (blob.size > MAX_BYTES) return { error: "large" };
  return { file: new File([blob], "photo.jpg", { type: "image/jpeg" }) };
}
