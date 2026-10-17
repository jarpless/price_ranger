import Image from "next/image";

/**
 * inverse: one-color cream ranger badge, for pine and other green.
 * dark: two-color ranger badge, for near-black.
 * light: two-color ranger badge, for cream, paper, and tan.
 */
export type LogoTone = "inverse" | "dark" | "light";

const sources: Record<LogoTone, string> = {
  inverse: "/brand/emblems/badge-inverse.svg",
  dark: "/brand/emblems/badge-dark.svg",
  light: "/brand/emblems/badge-light.svg",
};

/** Sign-in lockup. The badge sits on a pine plate, and the name is ink beside it. */
export function LogoLockup() {
  return (
    <div className="mx-auto mb-8 flex w-fit max-w-full items-center gap-4 rounded-3xl border border-line bg-paper px-4 py-4 shadow-card">
      <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-pine p-1.5">
        <Logo tone="inverse" width={48} height={48} className="h-12 w-12" alt="" />
      </span>
      <span className="pr-2 font-serif text-title leading-8 text-ink">Price Ranger</span>
    </div>
  );
}

export function Logo({
  tone = "light",
  alt = "",
  width,
  height,
  className,
  priority = false,
}: {
  tone?: LogoTone;
  alt?: string;
  width: number;
  height: number;
  className?: string;
  priority?: boolean;
}) {
  return (
    <Image
      src={sources[tone]}
      alt={alt}
      width={width}
      height={height}
      className={className}
      priority={priority}
    />
  );
}
