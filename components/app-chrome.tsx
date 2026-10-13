import { getSessionUser } from "@/lib/auth";
import { buildStamp } from "@/lib/build-info";
import { termsAccepted } from "@/lib/guide/store";

import { AssistantWidget } from "./assistant-widget";
import { ConsoleBuffer } from "./console-buffer";
import { FeedbackCapture } from "./feedback-capture";
import { Hotkeys } from "./hotkeys";
import { SessionBeacon } from "./session-beacon";
import { ShakeReport } from "./shake-report";
import { VersionChip } from "./version-chip";

export async function AppChrome() {
  const stamp = buildStamp();
  const user = await getSessionUser();
  let terms = false;
  if (user) {
    try {
      terms = await termsAccepted(user.id);
    } catch {
      terms = false;
    }
  }

  return (
    <>
      <VersionChip stamp={stamp} />
      <Hotkeys />
      <ConsoleBuffer />
      <AssistantWidget stamp={stamp} signedIn={Boolean(user)} />
      {user ? <FeedbackCapture /> : null}
      {user ? <ShakeReport /> : null}
      {terms ? <SessionBeacon /> : null}
    </>
  );
}
