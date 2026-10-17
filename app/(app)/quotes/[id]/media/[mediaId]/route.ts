import { getSessionUser } from "@/lib/auth";
import { readQuoteMediaFile } from "@/lib/guide/media";
import { mediaBytesResponse } from "@/lib/guide/media-response";
import { getData } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, context: { params: Promise<{ id: string; mediaId: string }> }) {
  const user = await getSessionUser();
  if (!user) return new Response(null, { status: 401 });
  const { id, mediaId } = await context.params;
  const quote = await (await getData()).getQuote(user.id, id);
  if (!quote) return new Response(null, { status: 404 });
  const poster = new URL(request.url).searchParams.get("poster") === "1";
  const file = await readQuoteMediaFile(user.id, id, mediaId, { poster });
  if (!file) return new Response(null, { status: 404 });
  return mediaBytesResponse(file.bytes, file.mime, request);
}
