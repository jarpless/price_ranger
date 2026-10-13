import { getSessionUser } from "@/lib/auth";
import { readQuotePhoto } from "@/lib/guide/photos";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return new Response(null, { status: 401 });
  const { id } = await context.params;
  const photo = await readQuotePhoto(user.id, id);
  if (!photo) return new Response(null, { status: 404 });
  return new Response(Buffer.from(photo.bytes), {
    headers: { "Content-Type": photo.mime, "Cache-Control": "private, max-age=3600" },
  });
}
