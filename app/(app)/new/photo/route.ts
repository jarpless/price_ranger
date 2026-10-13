import { getSessionUser } from "@/lib/auth";
import { readPendingPhoto } from "@/lib/guide/photos";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return new Response(null, { status: 401 });
  const photo = await readPendingPhoto(user.id);
  if (!photo) return new Response(null, { status: 404 });
  return new Response(Buffer.from(photo.bytes), {
    headers: { "Content-Type": photo.mime, "Cache-Control": "private, max-age=60" },
  });
}
