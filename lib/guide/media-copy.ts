export const QUOTE_MEDIA_LIMIT = 8;
/** Vercel request bodies top out near 4.5MB. Keep clips under that. */
export const MAX_VIDEO_BYTES = 4_000_000;

export function mediaErrorMessage(code: string): string {
  if (code === "heic") return "That photo is a HEIC file. Send a JPEG instead.";
  if (code === "large") return "That photo is too big. Try a smaller one.";
  if (code === "video-large") return "That clip is too big. Trim it to a few seconds and try again.";
  if (code === "limit") return "This quote already has 8 photos and videos.";
  if (code === "store") return "That didn't save. Try again.";
  if (code === "signin") return "Sign in again, then add the photo.";
  return "Add a photo or a short video.";
}
