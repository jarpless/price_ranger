"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { mediaErrorMessage, MAX_DIRECT_VIDEO_BYTES } from "@/lib/guide/media-copy";
import type { CarouselSlide } from "@/lib/guide/media-slides";

import { IconCamera } from "./icons";
import { MediaCarousel } from "./media-carousel";
import { preparePhoto } from "./prepare-photo";
import { vibrate } from "./feel";
import { posterFromVideo } from "./video-poster";

function isVideo(file: File): boolean {
  return file.type.startsWith("video/") || /\.(mp4|mov|webm|m4v)$/i.test(file.name);
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const step = 0x8000;
  for (let index = 0; index < bytes.length; index += step) {
    binary += String.fromCharCode(...bytes.subarray(index, index + step));
  }
  return btoa(binary);
}

async function putSigned(url: string, file: File): Promise<boolean> {
  const body = new FormData();
  body.append("cacheControl", "3600");
  body.append("", file);
  const response = await fetch(url, { method: "PUT", body, headers: { "x-upsert": "true" } });
  return response.ok;
}

async function putTicket(url: string, file: File, ticket: string): Promise<boolean> {
  const response = await fetch(url, {
    method: "PUT",
    body: file,
    headers: {
      "content-type": file.type || "application/octet-stream",
      "x-media-ticket": ticket,
    },
  });
  return response.ok;
}

type SavedItem = { id: string; kind: "image" | "video"; mime: string; poster: boolean };

export function QuoteMedia({
  quoteId,
  initialSlides,
  editable = false,
  density = "hero",
  priceOnPhoto = false,
  addLabel = "Add photos",
  beside = null,
}: {
  quoteId: string;
  initialSlides: CarouselSlide[];
  editable?: boolean;
  density?: "hero" | "strip";
  /** After a photo lands, submit the surrounding form. One tap, same as the old camera button. */
  priceOnPhoto?: boolean;
  addLabel?: string;
  /** Sits next to the Add button, e.g. "+ Add context". */
  beside?: React.ReactNode;
}) {
  const router = useRouter();
  const [slides, setSlides] = useState(initialSlides);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState("");
  const incoming = useRef(initialSlides);
  incoming.current = initialSlides;
  const signature = initialSlides.map((slide) => `${slide.id}:${slide.poster ? "1" : "0"}`).join("|");

  useEffect(() => {
    setSlides(incoming.current);
  }, [signature]);

  function remember(item: SavedItem) {
    const title = slides[0]?.alt.replace(/ video$/, "") || "Photo";
    setSlides((current) => [
      ...current,
      {
        id: item.id,
        kind: item.kind,
        src: `/quotes/${quoteId}/media/${item.id}`,
        poster: item.poster ? `/quotes/${quoteId}/media/${item.id}?poster=1` : null,
        mime: item.mime,
        alt: item.kind === "video" ? `${title} video` : title,
      },
    ]);
  }

  async function uploadVideo(file: File): Promise<string | null> {
    if (file.size > MAX_DIRECT_VIDEO_BYTES) return "video-large";
    if (file.size < 32) return "unsupported";
    const head = new Uint8Array(await file.slice(0, 64).arrayBuffer());
    const poster = await posterFromVideo(file);
    const signResponse = await fetch(`/api/quotes/${quoteId}/media/sign`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ mime: file.type, bytes: file.size, head: bytesToBase64(head) }),
    });
    if (signResponse.status === 401) return "signin";
    const signed = (await signResponse.json().catch(() => ({}))) as {
      error?: string;
      id?: string;
      mime?: string;
      ticket?: string;
      upload?: { mode?: string; url?: string };
    };
    if (!signResponse.ok || !signed.ticket || !signed.upload?.url || !signed.id) return signed.error || "store";
    const sent = signed.upload.mode === "signed" ? await putSigned(signed.upload.url, file) : await putTicket(signed.upload.url, file, signed.ticket);
    if (!sent) return "upload";
    let posterBody: string | undefined;
    if (poster && poster.size > 32 && poster.size <= 1_500_000) {
      posterBody = bytesToBase64(new Uint8Array(await poster.arrayBuffer()));
    }
    const done = await fetch(`/api/quotes/${quoteId}/media/complete`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ticket: signed.ticket, poster: posterBody }),
    });
    if (done.status === 401) return "signin";
    const data = (await done.json().catch(() => ({}))) as { error?: string; item?: SavedItem };
    if (!done.ok || !data.item) return data.error || "upload";
    remember(data.item);
    return null;
  }

  async function uploadImage(file: File): Promise<string | null> {
    const prepared = await preparePhoto(file);
    if ("error" in prepared) return prepared.error === "unread" ? "unreadable" : prepared.error;
    const body = new FormData();
    body.set("file", prepared.file);
    const response = await fetch(`/api/quotes/${quoteId}/media`, { method: "POST", body });
    if (response.status === 401) return "signin";
    const data = (await response.json().catch(() => ({}))) as { error?: string; item?: SavedItem };
    if (!response.ok || !data.item) return data.error || "unsupported";
    remember(data.item);
    return null;
  }

  async function onPick(list: FileList | null, input: HTMLInputElement) {
    const files = list ? [...list] : [];
    const form = input.form;
    input.value = "";
    if (!files.length) return;
    vibrate();
    setNotice("");
    let sawImage = false;
    let failed = false;
    for (let position = 0; position < files.length; position += 1) {
      const file = files[position]!;
      setBusy(files.length > 1 ? `Adding ${position + 1} of ${files.length}` : "Adding…");
      const error = isVideo(file) ? await uploadVideo(file) : await uploadImage(file);
      if (error) {
        setNotice(mediaErrorMessage(error));
        failed = true;
        break;
      }
      if (!isVideo(file)) sawImage = true;
    }
    setBusy("");
    if (priceOnPhoto && sawImage && !failed && form) {
      form.requestSubmit();
      return;
    }
    if (priceOnPhoto && !failed && !sawImage && form) {
      const description = String(new FormData(form).get("description") || "").trim();
      if (!description) setNotice("Add a few words, or a photo.");
    }
    router.refresh();
  }

  async function onRemove(id: string) {
    setSlides((current) => current.filter((slide) => slide.id !== id));
    const response = await fetch(`/api/quotes/${quoteId}/media?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    if (!response.ok) setNotice("That didn't come off. Try again.");
    router.refresh();
  }

  const emptyLabel = addLabel;
  const control = editable ? (
    <label
      className={`flex cursor-pointer items-center justify-center gap-2 rounded-2xl border border-line bg-paper font-semibold text-ink ${density === "strip" ? "h-10 px-3 text-sm" : "h-12 px-4 text-base"}`}
    >
      <IconCamera className={density === "strip" ? "h-4 w-4" : "h-5 w-5"} />
      {busy || (slides.length ? "Add more" : emptyLabel)}
      <input
        type="file"
        accept="image/*,video/mp4,video/webm,video/quicktime,.mov,.m4v"
        multiple
        className="sr-only"
        disabled={Boolean(busy)}
        aria-label={slides.length ? "Add more photos or a video" : `${emptyLabel} or a video`}
        onChange={(event) => void onPick(event.target.files, event.target)}
      />
    </label>
  ) : null;
  const controlRow =
    control && beside ? (
      <div className="flex gap-2">
        <div className="min-w-0 flex-1">{control}</div>
        <div className="min-w-0 flex-1">{beside}</div>
      </div>
    ) : (
      control
    );

  return (
    <div data-quote-media="" data-media-count={slides.length}>
      {slides.length ? (
        <MediaCarousel slides={slides} density={density} onRemove={editable ? onRemove : undefined} />
      ) : editable ? (
        priceOnPhoto ? (
          controlRow
        ) : (
          <div className={density === "strip" ? "" : "rounded-2xl border border-dashed border-line bg-paper px-4 py-5 text-center"}>
            {density === "hero" ? <p className="text-body text-muted">Add photos or a short video for the buyer.</p> : null}
            <div className={density === "hero" ? "mt-3" : ""}>{controlRow}</div>
          </div>
        )
      ) : null}
      {slides.length && control ? <div className="mt-3">{controlRow}</div> : null}
      {notice ? (
        <p role="alert" className="mt-3 rounded-2xl bg-[#f8e8e4] px-4 py-3 text-body text-danger">
          {notice}
        </p>
      ) : null}
    </div>
  );
}
