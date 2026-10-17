export type ShareGrowthAction = "signup" | "download";

/**
 * What a customer share link offers the recipient.
 * Leave this on "signup". "download" is the future "Download the app" option
 * and stays unused until that install link should replace the sign-up card.
 */
export const SHARE_GROWTH_ACTION: ShareGrowthAction = "signup";

export interface ShareGrowthOffer {
  action: ShareGrowthAction;
  href: string;
  label: string;
  detail: string;
}

const offers: Record<ShareGrowthAction, (token: string) => Omit<ShareGrowthOffer, "action">> = {
  signup(token) {
    const next = `/p/${token}`.slice(0, 180);
    return {
      href: `/signin?reason=share&next=${encodeURIComponent(next)}`,
      label: "Save these prices — free",
      detail: "Create a free account to keep this sheet, then price something of your own.",
    };
  },
  download() {
    return {
      href: "/install",
      label: "Download the app",
      detail: "Keep these prices on your phone.",
    };
  },
};

export function shareGrowthOffer(token: string): ShareGrowthOffer {
  const action = SHARE_GROWTH_ACTION;
  return { action, ...offers[action](token) };
}
