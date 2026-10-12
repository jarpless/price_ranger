import { dataBackend } from "./env";

/** The feedback tools are for the owner of this install, not every account. */
export function isOwnerEmail(email: string): boolean {
  const configured = process.env.OWNER_EMAIL?.trim().toLowerCase();
  if (configured) return email.trim().toLowerCase() === configured;
  return dataBackend() === "local";
}
