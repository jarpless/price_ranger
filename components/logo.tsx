import Image from "next/image";

export type LogoTone = "ink" | "light";
export type LogoVariant = "full" | "mark";

const sources: Record<LogoVariant, Record<LogoTone, string>> = {
  full: {
    ink: "/images/logo-full.svg",
    light: "/images/logo-full-light.svg",
  },
  mark: {
    ink: "/images/logo-mark.svg",
    light: "/images/logo-mark-light.svg",
  },
};

/**
 * Sign-in lockup for cream pages. The traced wordmark is a near-black square, so at a large
 * size on cream it reads as a blot. The light mark sits on a pine plate (the same contrast as
 * the header), and the name is ink in the display serif. Gold stays out of the letters.
 */
export function LogoLockup() {
  return (
    <div className="mx-auto mb-8 flex w-fit max-w-full items-center gap-4 rounded-3xl border border-line bg-paper px-4 py-4 shadow-card">
      <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-pine p-2">
        <Logo tone="light" width={48} height={48} className="h-12 w-12" alt="" />
      </span>
      <span className="pr-2 font-serif text-title leading-8 text-ink">Price Ranger</span>
    </div>
  );
}

export function Logo({
  tone = "ink",
  variant = "mark",
  alt = "",
  width,
  height,
  className,
  priority = false,
}: {
  /** Ink on cream and paper. Light on pine and other dark surfaces. */
  tone?: LogoTone;
  variant?: LogoVariant;
  alt?: string;
  width: number;
  height: number;
  className?: string;
  priority?: boolean;
}) {
  return (
    <Image
      src={sources[variant][tone]}
      alt={alt}
      width={width}
      height={height}
      className={className}
      priority={priority}
    />
  );
}
