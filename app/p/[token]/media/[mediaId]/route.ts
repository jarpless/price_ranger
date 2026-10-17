import { readQuoteMediaFile } from "@/lib/guide/media";
import { mediaBytesResponse } from "@/lib/guide/media-response";
import { readShareOwner } from "@/lib/share";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, context: { params: Promise<{ token: string; mediaId: string }> }) {
  const { token, mediaId } = await context.params;
  const owner = await readShareOwner(token);
  if (!owner) return new Response(null, { status: 404 });
  const poster = new URL(request.url).searchParams.get("poster") === "1";
  const file = await readQuoteMediaFile(owner.userId, owner.quoteId, mediaId, { poster });
  if (!file) return new Response(null, { status: 404 });
  return mediaBytesResponse(file.bytes, file.mime, request);
}
