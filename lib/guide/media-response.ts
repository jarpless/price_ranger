/** Serves a stored photo or video, including the ranges a player asks for while scrubbing. */
export function mediaBytesResponse(bytes: Uint8Array, mime: string, request: Request): Response {
  const total = bytes.byteLength;
  const headers = {
    "Content-Type": mime,
    "Accept-Ranges": "bytes",
    "Cache-Control": "private, max-age=3600",
    "X-Content-Type-Options": "nosniff",
  };
  const range = request.headers.get("range");
  const match = range ? /^bytes=(\d+)-(\d*)$/.exec(range.trim()) : null;
  if (!match) {
    return new Response(Buffer.from(bytes), {
      headers: { ...headers, "Content-Length": String(total) },
    });
  }
  const start = Number(match[1]);
  const end = match[2] ? Math.min(Number(match[2]), total - 1) : total - 1;
  if (!Number.isFinite(start) || !Number.isFinite(end) || start >= total || end < start) {
    return new Response(null, {
      status: 416,
      headers: { "Content-Range": `bytes */${total}` },
    });
  }
  const slice = bytes.subarray(start, end + 1);
  return new Response(Buffer.from(slice), {
    status: 206,
    headers: {
      ...headers,
      "Content-Range": `bytes ${start}-${end}/${total}`,
      "Content-Length": String(slice.byteLength),
    },
  });
}
