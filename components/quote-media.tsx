"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { mediaErrorMessage, MAX_VIDEO_BYTES } from "@/lib/guide/media-copy";
import type { CarouselSlide } from "@/lib/guide/media-slides";

import { IconCamera } from "./icons";
import { MediaCarousel } from "./media-carousel";
import { preparePhoto } from "./prepare-photo";
import { vibrate } from "./feel";
import { posterFromVideo } from "./video-poster";

function isVideo(file: File): boolean {
  return file.type.startsWith("video/") || /\.(mp4|mov|webm|m4v)$/i.test(file.name);
}

export function QuoteMedia({
  quoteId,
  initialSlides,
  editable = false,
  density = "hero",
}: {
  quoteId: string;
  initialSlides: CarouselSlide[];
  editable?: boolean;
  density?: "hero" | "strip";
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

  async function uploadOne(file: File): Promise<string | null> {
    let payload = file;
    let poster: File | null = null;
    if (isVideo(file)) {
      if (file.size > MAX_VIDEO_BYTES) return "video-large";
      poster = await posterFromVideo(file);
    } else {
      const prepared = await preparePhoto(file);
      if ("error" in prepared) return prepared.error === "unread" ? "unreadable" : prepared.error;
      payload = prepared.file;
    }
    const body = new FormData();
    body.set("file", payload);
    if (poster) body.set("poster", poster);
    const response = await fetch(`/api/quotes/${quoteId}/media`, { method: "POST", body });
    if (response.status === 401) return "signin";
    const data = (await response.json().catch(() => ({}))) as {
      error?: string;
      item?: { id: string; kind: "image" | "video"; mime: string; poster: boolean };
    };
    if (!response.ok || !data.item) return data.error || "unsupported";
    const item = data.item;
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
    return null;
  }

  async function onPick(list: FileList | null, input: HTMLInputElement) {
    const files = list ? [...list] : [];
    input.value = "";
    if (!files.length) return;
    vibrate();
    setNotice("");
    for (let position = 0; position < files.length; position += 1) {
      setBusy(files.length > 1 ? `Adding ${position + 1} of ${files.length}` : "Adding…");
      const error = await uploadOne(files[position]!);
      if (error) {
        setNotice(mediaErrorMessage(error));
        break;
      }
    }
    setBusy("");
    router.refresh();
  }

  async function onRemove(id: string) {
    setSlides((current) => current.filter((slide) => slide.id !== id));
    const response = await fetch(`/api/quotes/${quoteId}/media?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    if (!response.ok) setNotice("That didn't come off. Try again.");
    router.refresh();
  }

  const control = editable ? (
    <label
      className={`flex cursor-pointer items-center justify-center gap-2 rounded-2xl border border-line bg-paper font-semibold text-ink ${density === "strip" ? "h-10 px-3 text-sm" : "h-12 px-4 text-base"}`}
    >
      <IconCamera className={density === "strip" ? "h-4 w-4" : "h-5 w-5"} />
      {busy || (slides.length ? "Add more" : "Add photos")}
      <input
        type="file"
        accept="image/*,video/mp4,video/webm,video/quicktime,.mov,.m4v"
        multiple
        className="sr-only"
        disabled={Boolean(busy)}
        aria-label={slides.length ? "Add more photos or a video" : "Add photos or a video"}
        onChange={(event) => void onPick(event.target.files, event.target)}
      />
    </label>
  ) : null;

  return (
    <div data-quote-media="" data-media-count={slides.length}>
      {slides.length ? (
        <MediaCarousel slides={slides} density={density} onRemove={editable ? onRemove : undefined} />
      ) : editable ? (
        <div className={density === "strip" ? "" : "rounded-2xl border border-dashed border-line bg-paper px-4 py-5 text-center"}>
          {density === "hero" ? <p className="text-body text-muted">Add photos or a short video for the buyer.</p> : null}
          <div className={density === "hero" ? "mt-3" : ""}>{control}</div>
        </div>
      ) : null}
      {slides.length && control ? <div className="mt-3">{control}</div> : null}
      {notice ? (
        <p role="alert" className="mt-3 rounded-2xl bg-[#f8e8e4] px-4 py-3 text-body text-danger">
          {notice}
        </p>
      ) : null}
    </div>
  );
}
