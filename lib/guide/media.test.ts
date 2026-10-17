import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { forPublic } from "../share";
import { acceptDirectBytes, finishDirectVideo, prepareDirectVideo } from "./media-direct";
import { addQuoteMedia, firstAlbumImage, listQuoteMedia, readQuoteMediaFile, removeQuoteMedia } from "./media";
import { MAX_DIRECT_VIDEO_BYTES } from "./media-copy";
import { classifyUpload } from "./media-file";
import { issueDirectTicket, readDirectTicket } from "./media-ticket";
import { mediaBytesResponse } from "./media-response";
import { saveQuotePhoto } from "./photos";

function jpeg(size = 64): Uint8Array {
  const bytes = new Uint8Array(size);
  bytes[0] = 0xff;
  bytes[1] = 0xd8;
  bytes[2] = 0xff;
  bytes[3] = 0xd9;
  return bytes;
}

function mp4(): Uint8Array {
  const bytes = new Uint8Array(64);
  bytes.set([0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d], 0);
  return bytes;
}

function webm(): Uint8Array {
  const bytes = new Uint8Array(64);
  bytes.set([0x1a, 0x45, 0xdf, 0xa3], 0);
  return bytes;
}

test("photos and short videos are accepted, and other files are not", () => {
  const photo = classifyUpload(jpeg());
  assert.equal("kind" in photo && photo.kind, "image");
  const film = classifyUpload(mp4());
  assert.equal("mime" in film && film.mime, "video/mp4");
  const clip = classifyUpload(webm());
  assert.equal("kind" in clip && clip.kind, "video");
  const heic = new Uint8Array(32);
  heic.set([0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, 0x68, 0x65, 0x69, 0x63]);
  assert.deepEqual(classifyUpload(heic), { error: "heic" });
  assert.deepEqual(classifyUpload(new Uint8Array(64)), { error: "unsupported" });
  const huge = new Uint8Array(4_000_001);
  huge.set([0x1a, 0x45, 0xdf, 0xa3], 0);
  assert.deepEqual(classifyUpload(huge), { error: "video-large" });
  const head = mp4();
  const longer = classifyUpload(head, "video/mp4", { maxVideoBytes: MAX_DIRECT_VIDEO_BYTES, byteLength: 20_000_000 });
  assert.equal("mime" in longer && longer.mime, "video/mp4");
  const over = classifyUpload(head, "video/mp4", { maxVideoBytes: MAX_DIRECT_VIDEO_BYTES, byteLength: 50_000_001 });
  assert.deepEqual(over, { error: "video-large" });
});

test("a direct-upload ticket is bound to one clip and expires", () => {
  const claim = {
    userId: "user-1",
    quoteId: "quote-1",
    mediaId: "clip123",
    name: "album-quote-1-clip123",
    mime: "video/mp4",
    bytes: 64,
  };
  const ticket = issueDirectTicket(claim);
  const read = readDirectTicket(ticket);
  assert.equal(read?.mediaId, "clip123");
  assert.equal(read?.bytes, 64);
  const [payload, sig] = ticket.split(".");
  assert.equal(readDirectTicket(`${payload}x.${sig}`), null);
  const expired = issueDirectTicket(claim, Date.now() - 11 * 60 * 1000);
  assert.equal(readDirectTicket(expired), null);
  const path = issueDirectTicket({ ...claim, name: "../secret" });
  assert.equal(readDirectTicket(path), null);
});

test("a video response honors a byte range", async () => {
  const bytes = mp4();
  const response = mediaBytesResponse(bytes, "video/mp4", new Request("http://local/v", { headers: { range: "bytes=4-7" } }));
  assert.equal(response.status, 206);
  assert.equal(response.headers.get("Content-Range"), `bytes 4-7/${bytes.length}`);
  const body = new Uint8Array(await response.arrayBuffer());
  assert.deepEqual(body, bytes.subarray(4, 8));
  const missing = mediaBytesResponse(bytes, "video/mp4", new Request("http://local/v", { headers: { range: "bytes=80-" } }));
  assert.equal(missing.status, 416);
});

test("a shared sheet keeps safe media ids and drops the rest", () => {
  const shared = forPublic({
    title: "Oak table",
    subtitle: "ada@example.com",
    photo: null,
    options: [],
    media: [
      { id: "abc123", kind: "image" },
      { id: "clip1", kind: "video" },
      { id: "../secret", kind: "image" },
      { id: "ok", kind: "file" as "image" },
    ],
  });
  assert.deepEqual(shared.media, [
    { id: "abc123", kind: "image" },
    { id: "clip1", kind: "video" },
  ]);
  assert.doesNotMatch(JSON.stringify(shared), /ada@example.com|secret/);
});

test("quote media reuses the price photo store and keeps the original photo first", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "pr-media-"));
  const previous = process.env.GUIDE_PHOTO_DIR;
  process.env.GUIDE_PHOTO_DIR = dir;
  try {
    const userId = "user-media";
    const quoteId = "quote-media";
    await saveQuotePhoto(userId, quoteId, jpeg(), "image/jpeg");
    const added = await addQuoteMedia(userId, quoteId, { bytes: mp4(), hinted: "video/mp4", poster: jpeg(80) });
    assert.equal("item" in added, true);
    if (!("item" in added)) return;
    assert.equal(added.item.kind, "video");
    assert.equal(added.item.poster, true);
    const list = await listQuoteMedia(userId, quoteId);
    assert.deepEqual(
      list.map((item) => item.kind),
      ["image", "video"],
    );
    assert.equal(list[0]?.id, "cover");
    const video = await readQuoteMediaFile(userId, quoteId, added.item.id);
    assert.equal(video?.mime, "video/mp4");
    const poster = await readQuoteMediaFile(userId, quoteId, added.item.id, { poster: true });
    assert.equal(poster?.mime, "image/jpeg");
    assert.equal(await removeQuoteMedia(userId, quoteId, "cover"), true);
    const after = await listQuoteMedia(userId, quoteId);
    assert.equal(after.some((item) => item.id === "cover"), false);
    assert.equal(await removeQuoteMedia(userId, quoteId, added.item.id), true);
    assert.equal((await listQuoteMedia(userId, quoteId)).length, 0);

    for (let index = 0; index < 8; index += 1) {
      const result = await addQuoteMedia(userId, quoteId, { bytes: jpeg() });
      assert.equal("item" in result, true);
    }
    const limited = await addQuoteMedia(userId, quoteId, { bytes: jpeg() });
    assert.deepEqual(limited, { error: "limit" });

    const directUser = "user-direct";
    const directQuote = "quote-direct";
    const clip = new Uint8Array(4_100_000);
    clip.set([0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, 0x6d, 0x70, 0x34, 0x32], 0);
    const started = await prepareDirectVideo(directUser, directQuote, {
      mime: "video/mp4",
      bytes: clip.length,
      head: clip.subarray(0, 64),
    });
    assert.equal("ticket" in started, true);
    if (!("ticket" in started)) return;
    assert.equal(started.signedUrl, null);
    const accepted = await acceptDirectBytes(directUser, directQuote, started.ticket, clip);
    assert.deepEqual(accepted, { ok: true });
    const finished = await finishDirectVideo(directUser, directQuote, { ticket: started.ticket, poster: jpeg(80) });
    assert.equal("item" in finished && finished.item.kind, "video");
    assert.equal("item" in finished && finished.item.poster, true);
    const again = await finishDirectVideo(directUser, directQuote, { ticket: started.ticket, poster: jpeg(80) });
    assert.equal("item" in again && again.item.id, "item" in finished ? finished.item.id : "");
    const album = await listQuoteMedia(directUser, directQuote);
    assert.equal(album.length, 1);
    assert.equal(album[0]?.mime, "video/mp4");
    const named = await firstAlbumImage(directUser, directQuote);
    assert.equal(named, null);
    await addQuoteMedia(directUser, directQuote, { bytes: jpeg() });
    const image = await firstAlbumImage(directUser, directQuote);
    assert.equal(image?.mime, "image/jpeg");
    const tampered = await acceptDirectBytes(directUser, directQuote, `${started.ticket}nope`, clip);
    assert.equal("error" in tampered, true);
  } finally {
    if (previous === undefined) delete process.env.GUIDE_PHOTO_DIR;
    else process.env.GUIDE_PHOTO_DIR = previous;
    await rm(dir, { recursive: true, force: true });
  }
});
