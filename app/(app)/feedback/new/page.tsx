"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

import { captureShot } from "@/components/capture-shot";
import { FeedbackComposer } from "@/components/feedback-composer";

function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  return fetch(dataUrl).then((response) => response.blob());
}

function NewFeedback() {
  const pathname = usePathname();
  const router = useRouter();
  const params = useSearchParams();
  const shake = params.get("shake") === "1";
  const storedShot = shake || params.get("shot") === "1";
  const [shot, setShot] = useState<{ preview: string; blob: Blob } | null>(null);
  const [error, setError] = useState("");
  const [route, setRoute] = useState(pathname);

  useEffect(() => {
    let cancel = false;
    async function run() {
      try {
        const storedRoute = window.sessionStorage.getItem("pr-feedback-route");
        if (storedRoute) {
          setRoute(storedRoute);
          window.sessionStorage.removeItem("pr-feedback-route");
        }
        const stored = window.sessionStorage.getItem("pr-feedback-shot");
        if (storedShot && stored) {
          const blob = await dataUrlToBlob(stored);
          if (!cancel) setShot({ preview: stored, blob });
          window.sessionStorage.removeItem("pr-feedback-shot");
          return;
        }
        const captured = await captureShot(null);
        if (!cancel) setShot(captured);
      } catch (caught) {
        if (!cancel) setError(caught instanceof Error ? caught.message : "Could not take a screenshot.");
      }
    }
    void run();
    return () => {
      cancel = true;
    };
  }, [shake, storedShot]);

  if (shot) {
    return (
      <FeedbackComposer
        preview={shot.preview}
        blob={shot.blob}
        source={shake ? "shake" : "mobile"}
        route={route}
        onClose={() => router.back()}
      />
    );
  }

  return (
    <div className="mx-auto max-w-[40rem]">
      <h1 className="font-serif text-display">Send feedback</h1>
      <p className="mt-2 text-body text-muted">{error || "Taking a screenshot of this screen."}</p>
    </div>
  );
}

export default function NewFeedbackPage() {
  return (
    <Suspense fallback={<p className="text-body text-muted">Taking a screenshot of this screen.</p>}>
      <NewFeedback />
    </Suspense>
  );
}
