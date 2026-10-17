export const QUOTE_MEDIA_LIMIT = 8;
/** Photos and any leftover inline upload stay under the Vercel body limit. */
export const MAX_VIDEO_BYTES = 4_000_000;
/**
 * Clips upload straight to the existing price-photo bucket.
 * 50MB matches a common project file limit. A lower bucket cap fails the PUT.
 */
export const MAX_DIRECT_VIDEO_BYTES = 50_000_000;

export function mediaErrorMessage(code: string): string {
  if (code === "heic") return "That photo is a HEIC file. Send a JPEG instead.";
  if (code === "large") return "That photo is too big. Try a smaller one.";
  if (code === "video-large") return "That clip is too long. Try one under 50MB.";
  if (code === "upload") return "That clip didn't upload. Try a shorter one.";
  if (code === "limit") return "This quote already has 8 photos and videos.";
  if (code === "store") return "That didn't save. Try again.";
  if (code === "signin") return "Sign in again, then add the photo.";
  return "Add a photo or a short video.";
}
