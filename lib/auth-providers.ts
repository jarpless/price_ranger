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

/** Buttons for providers that are explicitly turned on. Apple stays hidden until NEXT_PUBLIC_ENABLE_APPLE is true. */
export function enabledOAuthButtons(): OAuthButton[] {
  const buttons: OAuthButton[] = [];
  if (flag("NEXT_PUBLIC_AUTH_GOOGLE")) buttons.push(BUTTONS.google);
  if (flag("NEXT_PUBLIC_AUTH_FACEBOOK")) buttons.push(BUTTONS.facebook);
  if (flag("NEXT_PUBLIC_AUTH_AZURE")) buttons.push(BUTTONS.azure);
  if (flag("NEXT_PUBLIC_ENABLE_APPLE")) buttons.push(BUTTONS.apple);
  return buttons;
}

export function passkeyConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}
