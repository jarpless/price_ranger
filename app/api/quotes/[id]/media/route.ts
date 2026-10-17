import { getSessionUser } from "@/lib/auth";
import { addQuoteMedia, removeQuoteMedia } from "@/lib/guide/media";
import { MAX_VIDEO_BYTES } from "@/lib/guide/media-copy";
import { getData } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function ownerId(quoteId: string): Promise<{ id: string } | Response> {
  const user = await getSessionUser();
  if (!user) return Response.json({ error: "signin" }, { status: 401 });
  const quote = await (await getData()).getQuote(user.id, quoteId);
  if (!quote) return Response.json({ error: "missing" }, { status: 404 });
  return { id: user.id };
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const owner = await ownerId(id);
  if (owner instanceof Response) return owner;
  const form = await request.formData();
  const incoming = form.get("file");
  if (!(incoming instanceof File) || incoming.size < 32) {
    return Response.json({ error: "unsupported" }, { status: 400 });
  }
  if (incoming.size > MAX_VIDEO_BYTES) {
    const video = incoming.type.startsWith("video/") || /\.(mp4|mov|webm|m4v)$/i.test(incoming.name);
    return Response.json({ error: video ? "video-large" : "large" }, { status: 413 });
  }
  const posterFile = form.get("poster");
  const poster = posterFile instanceof File && posterFile.size > 32 ? new Uint8Array(await posterFile.arrayBuffer()) : null;
  const result = await addQuoteMedia(owner.id, id, {
    bytes: new Uint8Array(await incoming.arrayBuffer()),
    hinted: incoming.type,
    poster,
  });
  if ("error" in result) {
    const status = result.error === "limit" ? 409 : result.error === "store" ? 500 : 400;
    return Response.json(result, { status });
  }
  return Response.json(result, { status: 201 });
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const owner = await ownerId(id);
  if (owner instanceof Response) return owner;
  const mediaId = new URL(request.url).searchParams.get("id") || "";
  const removed = await removeQuoteMedia(owner.id, id, mediaId);
  if (!removed) return Response.json({ error: "missing" }, { status: 404 });
  return Response.json({ ok: true });
}
