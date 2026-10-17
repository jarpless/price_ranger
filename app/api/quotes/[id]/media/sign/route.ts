import { decodeMediaHead, prepareDirectVideo, quoteOwner } from "@/lib/guide/media-direct";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function jsonError(error: string, status: number) {
  return Response.json({ error }, { status });
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const owner = await quoteOwner(id);
  if ("status" in owner) return jsonError(owner.error, owner.status);
  const body = (await request.json().catch(() => null)) as { mime?: unknown; bytes?: unknown; head?: unknown } | null;
  const head = decodeMediaHead(body?.head);
  const bytes = body?.bytes;
  const mime = typeof body?.mime === "string" ? body.mime.slice(0, 80) : "";
  if (!head || typeof bytes !== "number") return jsonError("unsupported", 400);
  const prepared = await prepareDirectVideo(owner.id, id, { mime, bytes, head });
  if ("error" in prepared) {
    const status = prepared.error === "limit" ? 409 : prepared.error === "store" ? 500 : prepared.error === "video-large" ? 413 : 400;
    return jsonError(prepared.error, status);
  }
  const upload = prepared.signedUrl
    ? { mode: "signed" as const, url: prepared.signedUrl }
    : { mode: "ticket" as const, url: `/api/quotes/${id}/media/direct` };
  return Response.json({
    id: prepared.id,
    mime: prepared.mime,
    ticket: prepared.ticket,
    upload,
  });
}
