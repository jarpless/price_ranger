# Supabase email templates

Price Ranger sends account verification through Supabase Auth. SMTP is already Resend, from `support@priceranger.app`. The app does not send this mail itself.

Guest checkout used to call `updateUser({ email })`, which sends the **Change email address** template (`email_change`) and never includes a signup code. Creating an account now signs the guest out, calls `signUp`, and links the guest's prices after the code is verified. That mail uses the **Confirm signup** template.

## What to paste in the Supabase dashboard

Project `vexsmkplsusxlayxhpqb` → Authentication → Email Templates.

1. **Confirm signup** — subject `Verify your Price Ranger account`. Body: `supabase/templates/confirm-signup.html`.
2. **Magic link** — subject `Your Price Ranger sign-in code`. Body: `supabase/templates/magic-link.html`.

Both templates print `{{ .Token }}` (the 6-digit code) and `{{ .ConfirmationURL }}`. Leave the email-change template unused for new accounts.

Also confirm:

- Authentication → Providers → Email is on.
- Email OTP length is 6 (the default).
- Site URL is `https://priceranger.app` and `https://priceranger.app/auth/callback` is an allowed redirect.
- SMTP sender is `support@priceranger.app` via Resend. Do not put the Resend API key in `NEXT_PUBLIC_` variables.

Apple and Google buttons are shown on the sign-in screen. They work after those providers are enabled in Authentication → Providers, with the Apple Services ID and Google client configured there. No extra public env flag is required for the buttons to appear.

Passkeys need Authentication → Passkeys turned on in the same project. The button is on the sign-in screen either way.
