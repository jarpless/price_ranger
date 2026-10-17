import Image from "next/image";

/**
 * inverse: one-color cream knockout. Holes show whatever is behind it.
 * dark: pine field, paper ranger on a pine seal. For tan, cream, and paper.
 * light: paper field, same pine seal and paper ranger. For the dark green sidebar.
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

/** Sign-in lockup. The full badge sits beside the name, with no app-icon plate. */
export function LogoLockup() {
  return (
    <div className="mx-auto mb-8 flex w-fit max-w-full items-center gap-4">
      <Logo tone="dark" width={72} height={72} className="h-[4.5rem] w-[4.5rem] shrink-0" alt="" priority />
      <span className="font-serif text-title leading-8 text-ink">Price Ranger</span>
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
