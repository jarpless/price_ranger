import { VERSION_LABEL } from "./version";

export type AppEnv = "local" | "preview" | "prod";

export interface BuildStamp {
  label: string;
  sha: string;
  env: AppEnv;
}

export function appEnv(): AppEnv {
  const value = process.env.VERCEL_ENV;
  if (value === "production") return "prod";
  if (value === "preview") return "preview";
  return "local";
}

export function shortSha(): string {
  const sha = process.env.VERCEL_GIT_COMMIT_SHA || process.env.GIT_COMMIT_SHA || "";
  if (!sha) return "dev";
  return sha.slice(0, 7);
}

export function buildStamp(): BuildStamp {
  return {
    label: VERSION_LABEL,
    sha: shortSha(),
    env: appEnv(),
  };
}

export function stampText(stamp: BuildStamp = buildStamp()): string {
  return `${stamp.label} · ${stamp.sha} · ${stamp.env}`;
}
