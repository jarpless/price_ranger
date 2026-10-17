import Image from "next/image";

/**
 * inverse: one-color cream knockout. Holes show whatever is behind it.
 * dark: pine field, paper ranger on a pine seal. For tan, cream, and paper.
 * light: paper field, pine ranger on a paper seal. For the dark green sidebar.
 * At 48px and below the mark drops the banner words and uses thicker strokes.
 */
export type LogoTone = "inverse" | "dark" | "light";

const full: Record<LogoTone, string> = {
  inverse: "/brand/emblems/badge-inverse.svg",
  dark: "/brand/emblems/badge-dark.svg",
  light: "/brand/emblems/badge-light.svg",
};

const small: Record<LogoTone, string> = {
  inverse: "/brand/icons/badge-simplified-inverse.svg",
  dark: "/brand/icons/badge-simplified-dark.svg",
  light: "/brand/icons/badge-simplified-light.svg",
};

/** Sign-in lockup. The badge sits on a pine plate, and the name is ink beside it. */
export function LogoLockup() {
  return (
    <div className="mx-auto mb-8 flex w-fit max-w-full items-center gap-4 rounded-3xl border border-line bg-paper px-4 py-4 shadow-card">
      <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-pine p-1.5">
        <Logo tone="light" width={48} height={48} className="h-12 w-12" alt="" />
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
  const src = width <= 48 && height <= 48 ? small[tone] : full[tone];
  return (
    <Image
      src={src}
      alt={alt}
      width={width}
      height={height}
      className={className}
      priority={priority}
    />
  );
}
