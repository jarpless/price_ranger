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
