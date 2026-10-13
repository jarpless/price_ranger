# Price Ranger design system

Every rule below is a constraint, with the product reason and the app it is borrowed from. The goal is a tool that feels like Cash App, Venmo, or Airbnb: one accent, one type ramp, one primary button, and no decorative motion.

## Type

One ramp. Do not introduce a new size for a single screen.

| Token | Size / line | Use |
| --- | --- | --- |
| `text-caption` | 13 / 16 | Meta under a row. 13px is the iOS footnote, so it reads as secondary without dropping to a tiny label. |
| `text-body` | 16 / 24 | Reading text and every input. 16px is the smallest size that does not trigger iOS input zoom. |
| `text-title` | 24 / 32 | Row titles and the sidebar wordmark. |
| `text-display` | 32 / 40, 40 / 48 from `lg` | The one screen title. |
| `text-price` | 40 / 48 | The number. It is the product, the way the amount is the product in Venmo and Cash App. |

Screen titles use Fraunces. Everything else uses Outfit. A second display size would make the legal pages and the price screen look like different products.

Headlines may wrap on word boundaries. `text-balance` keeps a two-line title even, which is how iOS large titles behave on a narrow phone. Button labels never wrap. They use `whitespace-nowrap`, a 48px height, and a 192px minimum width from the `lg` breakpoint. If a label cannot fit at 320px, the words get shorter. “Price something” became “Price” in the tab bar and “New price” on the button. “See your price” became “See price”. “Upgrade to keep access” became “Upgrade”.

## Space

The spacing grid is 8px. Page padding is 16px on compact widths and 40px from `lg`. Vertical rhythm between a title and its body is 8px. Between sections it is 24px. Touch targets are 48px tall, which is on the grid and above the 44pt Apple HIG minimum.

Compact widths (under 1024px) keep a bottom tab bar. That is the HIG compact-width pattern, including at 768px. The column stops at 36rem so a tablet-width browser does not stretch cards to the edges. From 1024px the sidebar appears and the content column is 60rem, centered in the remaining width. A single price stays in a 40rem measure, because the amount is one sentence, the way Venmo centers a payment. The new-price page keeps the form at 40rem and uses the rest of the column for the three steps. A list (home) uses the full 60rem and splits into a list plus a plan rail, the same job as Airbnb’s sidebar summary.

## Color

| Token | Hex | Role |
| --- | --- | --- |
| Pine | `#1e4636` | The only action color. Cash App uses one green; we use one pine. |
| Pine deep | `#132e24` | Pressed pine and the presentation backdrop. |
| Cream | `#f3eee4` | The page. Warm paper, closer to Airbnb’s off-white than to pure white. |
| Paper | `#fffdf8` | Cards and the tab bar. |
| Ink | `#1c1915` | Text. Near-black, which is what HIG uses instead of `#000`. |
| Muted | `#5e564e` | Secondary text on cream. |
| Line | `#e3dacd` | Hairline borders. |
| Danger | `#8d3b32` | Errors, on `#f8e8e4`. |

Gold `#c6a15b` is not a text color. On cream it fails WCAG AA (the contrast is about 2:1). It stays in the logo artwork only. Focus rings are 2px pine, because gold also fails the 3:1 non-text contrast rule on cream. “Save” and “Sign out” in the pine header are cream, not gold.

## Elevation

Three levels, and no more.

- **0, the page.** Cream, no shadow.
- **1, a card.** A hairline plus `0 1px 2px rgba(28, 25, 21, 0.06)`. This is the Airbnb card: the border does the work, the shadow only separates the card from the page.
- **2, a sheet.** The assistant and the bottom dock. The dock uses an upward shadow so it reads as sitting on top of the page. The assistant uses a larger shadow because it is a temporary sheet, like an iOS share sheet.

The pulsing gold badge on the old assistant button is gone. A pulse reads as a marketing sticker, not as a control.

## Buttons

One height: 48px. One radius: 16px. One label line.

- **Primary.** Pine fill, cream label. One per screen, in the dock.
- **Secondary.** Paper fill, line border. Used inside “Change it”.
- **Ghost.** No fill, pine label. “Try a sample”, “Not yet”, “Sign out”.

Pressed state is 72% opacity, not a brightness filter. A brightness filter muddies the pine. Opacity is the HIG pressed state.

## Thumb zone

On widths under 1024px the primary action is fixed just above the tab bar, inside the natural thumb reach. The tab bar is 64px. The dock is 64px including its padding. The assistant is a 48px circle on the left, 12px above the dock when a dock is on screen and 12px above the tab bar when it is not. It never sits on the primary button. One tap opens it. On `/ask` it opens by itself, which is the deep link.

The back control is a 48px chevron at the top left on any screen that is not Home, Menu, or the intro. A rightward swipe that starts within 24px of the left edge and travels at least 72px calls the same back action. Both are the iOS edge-swipe pattern. Steps are separate navigations. Each one fades in and shifts 12px over 180ms. The shift is a margin, not a transform: a transform on the page would become the containing block for the dock and pull the primary button out of the thumb zone for the length of the animation. `prefers-reduced-motion: reduce` removes that animation and skips `navigator.vibrate`. Where vibration exists, a primary press vibrates for 10ms.

## Fewest taps

Counts are in-app taps for someone who already accepted the terms. Typing is not a tap. The system photo picker is not a tap. The intro stays four taps (Next, Next, the terms checkbox, Continue) because the checkbox is required.

| Path | Before | After |
| --- | --- | --- |
| Photo to a shareable link | 7. New price, choose a path, add a photo, See your price, Continue, Looks good, Send it. | 3. New price, Add photo (the form submits itself), Send. |
| Typed description to a shareable link | 7. Same, with typing in place of the photo and an extra See your price. | 3. New price, See price, Send. |
| Sample to a shareable link | 4. Try a sample, Continue, Looks good, Send it. | 2. Try a sample, Send. |

Item is the default path, shown as Item / Job / Check on the capture screen. Changing it is an extra tap only when the default is wrong. Adjust is behind “Change it” on the price screen, so it is not a required step. Send is the primary button on that screen.

## Install and shortcuts

The app is a standalone PWA. `app/manifest.ts` sets the name, pine theme color, cream background, 192 and 512 icons, and shortcuts for `/new` (“New price”) and `/ask` (“Ask Price Ranger”). A small service worker handles navigations so Chrome can offer install. The menu row “Get the app on your phone” opens instructions for iPhone Safari, iPhone Chrome, and Android Chrome, and uses `beforeinstallprompt` when the browser provides it. “Shortcuts” explains how to paste those two URLs into the Shortcuts app and attach one to the Action Button.

## What we stopped doing

- A gold label on a cream page.
- A 64px assistant with a pulsing badge over the tab bar.
- A different button height on every step (48, 56, and 64 were all in use).
- A five-step progress row whose labels truncated.
- A path screen that existed only to ask a question the capture screen can default.
