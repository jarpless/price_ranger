import { getSessionUser } from "@/lib/auth";
import { buildStamp } from "@/lib/build-info";
import { isOwnerEmail } from "@/lib/owner";
import { getPreferences } from "@/lib/store/basecamp";

import { AssistantWidget } from "./assistant-widget";
import { ConsoleBuffer } from "./console-buffer";
import { FeedbackCapture } from "./feedback-capture";
import { Hotkeys } from "./hotkeys";
import { VersionChip } from "./version-chip";

export async function AppChrome() {
  const stamp = buildStamp();
  const user = await getSessionUser();
  let feedback = false;
  if (user && isOwnerEmail(user.email)) {
    try {
      feedback = (await getPreferences(user.id)).feedbackEnabled;
    } catch {
      feedback = false;
    }
  }

  return (
    <>
      <VersionChip stamp={stamp} />
      <Hotkeys />
      <ConsoleBuffer />
      <AssistantWidget stamp={stamp} signedIn={Boolean(user)} />
      {feedback ? <FeedbackCapture stamp={stamp} /> : null}
    </>
  );
}
