import { getSessionUser } from "@/lib/auth";
import { buildStamp } from "@/lib/build-info";
import { termsAccepted } from "@/lib/guide/store";
import { assistantAllowance } from "@/lib/usage";

import { AssistantWidget } from "./assistant-widget";
import { ConsoleBuffer } from "./console-buffer";
import { Hotkeys } from "./hotkeys";
import { SessionBeacon } from "./session-beacon";
import { ShakeReport } from "./shake-report";

export async function AppChrome() {
  const stamp = buildStamp();
  const user = await getSessionUser();
  let terms = false;
  let allowance = null;
  if (user) {
    try {
      terms = await termsAccepted(user.id);
    } catch {
      terms = false;
    }
    try {
      allowance = await assistantAllowance(user);
    } catch {
      allowance = null;
    }
  }

  return (
    <>
      <Hotkeys />
      <ConsoleBuffer />
      <AssistantWidget stamp={stamp} signedIn={Boolean(user)} allowance={allowance} />
      {user ? <ShakeReport /> : null}
      {terms ? <SessionBeacon /> : null}
    </>
  );
}
