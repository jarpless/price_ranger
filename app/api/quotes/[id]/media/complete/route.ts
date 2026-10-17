import { finishDirectVideo, quoteOwner } from "@/lib/guide/media-direct";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function posterFromBase64(value: unknown): Uint8Array | null {
  if (typeof value !== "string" || value.length < 32 || value.length > 2_000_000) return null;
  const bytes = Buffer.from(value, "base64");
  if (bytes.length < 32 || bytes.length > 1_500_000) return null;
  return new Uint8Array(bytes);
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const owner = await quoteOwner(id);
  if ("status" in owner) return Response.json({ error: owner.error }, { status: owner.status });
  const body = (await request.json().catch(() => null)) as { ticket?: unknown; poster?: unknown } | null;
  const ticket = typeof body?.ticket === "string" ? body.ticket : "";
  if (!ticket || ticket.length > 4_000) return Response.json({ error: "unsupported" }, { status: 400 });
  const result = await finishDirectVideo(owner.id, id, {
    ticket,
    poster: posterFromBase64(body?.poster),
  });
  if ("error" in result) {
    const status = result.error === "limit" ? 409 : result.error === "store" ? 500 : result.error === "upload" ? 409 : 400;
    return Response.json({ error: result.error }, { status });
  }
  return Response.json(result, { status: 201 });
}
