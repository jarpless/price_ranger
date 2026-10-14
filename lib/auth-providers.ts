export const OAUTH_PROVIDERS = ["google", "facebook", "azure", "apple"] as const;

export type OAuthProvider = (typeof OAUTH_PROVIDERS)[number];

export interface OAuthButton {
  id: OAuthProvider;
  label: string;
}

const BUTTONS: Record<OAuthProvider, OAuthButton> = {
  google: { id: "google", label: "Continue with Google" },
  facebook: { id: "facebook", label: "Continue with Facebook" },
  azure: { id: "azure", label: "Continue with Microsoft" },
  apple: { id: "apple", label: "Continue with Apple" },
};

function flag(name: string): boolean {
  return process.env[name] === "true";
}

/**
 * Apple and Google are always offered on the sign-in screen.
 * They succeed after the provider is enabled in the Supabase dashboard.
 * Facebook and Microsoft stay behind flags.
 */
export function enabledOAuthButtons(): OAuthButton[] {
  const buttons: OAuthButton[] = [BUTTONS.apple, BUTTONS.google];
  if (flag("NEXT_PUBLIC_AUTH_FACEBOOK")) buttons.push(BUTTONS.facebook);
  if (flag("NEXT_PUBLIC_AUTH_AZURE")) buttons.push(BUTTONS.azure);
  return buttons;
}

export function passkeyConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}
