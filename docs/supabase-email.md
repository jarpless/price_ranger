# Supabase email templates

Price Ranger sends account verification through Supabase Auth. SMTP is already Resend, from `support@priceranger.app`. The app does not send this mail itself.

Guest checkout used to call `updateUser({ email })`, which sends the **Change email address** template (`email_change`) and never includes a signup code. Creating an account now signs the guest out, calls `signUp`, and links the guest's prices after the code is verified. That mail uses the **Confirm signup** template.

## What to paste in the Supabase dashboard

Project `vexsmkplsusxlayxhpqb` → Authentication → Email Templates. Paste both templates. A message that contains only a link, with no 8-digit code, means the dashboard body is still the default template.

1. **Confirm signup** — subject `{{ .Token }} is your Price Ranger code`. Body: the full file `supabase/templates/confirm-signup.html`.
2. **Magic link** — subject `{{ .Token }} is your Price Ranger code`. Body: the full file `supabase/templates/magic-link.html`.

Both files print `{{ .Token }}` in the inbox preview and in a bordered box, and they keep `{{ .ConfirmationURL }}` as the link. Leave the email-change template unused for new accounts. This repo does not write those templates into the live project.

Also confirm:

- Authentication → Providers → Email is on.
- Do not change Authentication → Email → OTP length. This app does not write templates or auth settings into the live project. The templates in this repo include `{{ .Token }}` and `{{ .ConfirmationURL }}`. `/signin/sent` asks for that 8-digit code and still accepts the link. `verifyOtp` with type `signup` signs the person in.
- Site URL is `https://priceranger.app` and `https://priceranger.app/auth/callback` is an allowed redirect.
- SMTP sender is `support@priceranger.app` via Resend. Do not put the Resend API key in `NEXT_PUBLIC_` variables.

Apple and Google buttons are shown on the sign-in screen. They work after those providers are enabled in Authentication → Providers, with the Apple Services ID and Google client configured there. No extra public env flag is required for the buttons to appear.

Passkeys need Authentication → Passkeys turned on in the same project. The button is on the sign-in screen either way.
