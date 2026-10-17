import { acceptDirectBytes, quoteOwner } from "@/lib/guide/media-direct";
import { MAX_DIRECT_VIDEO_BYTES } from "@/lib/guide/media-copy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const owner = await quoteOwner(id);
  if ("status" in owner) return Response.json({ error: owner.error }, { status: owner.status });
  const ticket = request.headers.get("x-media-ticket") || "";
  const declared = Number(request.headers.get("content-length") || "");
  if (Number.isFinite(declared) && declared > MAX_DIRECT_VIDEO_BYTES) {
    return Response.json({ error: "video-large" }, { status: 413 });
  }
  const bytes = new Uint8Array(await request.arrayBuffer());
  if (bytes.length > MAX_DIRECT_VIDEO_BYTES) return Response.json({ error: "video-large" }, { status: 413 });
  const saved = await acceptDirectBytes(owner.id, id, ticket, bytes);
  if ("error" in saved) {
    const status = saved.error === "video-large" ? 413 : saved.error === "store" ? 500 : 400;
    return Response.json({ error: saved.error }, { status });
  }
  return new Response(null, { status: 204 });
}
