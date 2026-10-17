import type { LandingExampleId } from "@/lib/landing-examples";

/**
 * Original splash illustrations. Flat studio drawings in the Ridgeline palette:
 * cream paper, pine, walnut, and brass. No logos or maker marks.
 */

function Ground({ cx = 200, rx = 116 }: { cx?: number; rx?: number }) {
  return <ellipse cx={cx} cy="250" rx={rx} ry="10" fill="#1e4636" fillOpacity="0.1" />;
}

function Dresser() {
  return (
    <svg viewBox="0 0 400 280" className="h-full w-full" aria-hidden="true">
      <Ground cx={208} rx={128} />
      <path d="M112 234h14l-4 20h-16z" fill="#4a3426" />
      <path d="M236 234h14l6 20h-16z" fill="#4a3426" />
      <path d="M286 208h12l6 28h-14z" fill="#3e2c20" />
      <path d="M262 114 L310 86 L310 206 L262 234 Z" fill="#6b4b33" />
      <path d="M98 114h164v120H98z" fill="#8f6243" />
      <path d="M98 114 L146 86 L310 86 L262 114 Z" fill="#c6a36e" />
      <path d="M160 100 L230 96" stroke="#a07d49" strokeWidth="1.5" strokeLinecap="round" opacity="0.45" />
      <path d="M172 106 L248 100" stroke="#e8d7b8" strokeWidth="1.5" strokeLinecap="round" opacity="0.55" />
      <g>
        {[0, 1, 2].map((row) =>
          [0, 1].map((col) => {
            const x = 112 + col * 72;
            const y = 128 + row * 32;
            return (
              <g key={`${row}-${col}`}>
                <rect x={x} y={y} width="64" height="26" rx="2" fill="#f4eadc" />
                <rect x={x + 22} y={y + 11.5} width="20" height="3.5" rx="1.5" fill="#3e2c1e" />
              </g>
            );
          }),
        )}
      </g>
    </svg>
  );
}

function Camera() {
  return (
    <svg viewBox="0 0 400 280" className="h-full w-full" aria-hidden="true">
      <Ground rx={102} />
      <path d="M118 146c-22 10-30 40-16 74" fill="none" stroke="#6b4b33" strokeWidth="8" strokeLinecap="round" />
      <path d="M286 140c20 12 26 42 12 72" fill="none" stroke="#6b4b33" strokeWidth="8" strokeLinecap="round" />
      <rect x="112" y="118" width="180" height="96" rx="18" fill="#241f1c" />
      <rect x="112" y="90" width="180" height="40" rx="12" fill="#e6dfd2" />
      <path d="M156 94h92l-14-28h-64z" fill="#f7f3ec" />
      <rect x="184" y="72" width="32" height="14" rx="3" fill="#1e4636" />
      <rect x="196" y="76" width="8" height="6" rx="1" fill="#c6a15b" />
      <rect x="128" y="136" width="148" height="62" rx="8" fill="#3a332c" />
      <circle cx="214" cy="168" r="38" fill="#120f0d" />
      <circle cx="198" cy="168" r="38" fill="#1c1915" />
      <circle cx="198" cy="168" r="28" fill="#322c28" />
      <circle cx="198" cy="168" r="21" fill="none" stroke="#c6a15b" strokeWidth="3" />
      <circle cx="198" cy="168" r="12" fill="#16382c" />
      <ellipse cx="193" cy="163" rx="4.5" ry="2.6" fill="#fffdf8" fillOpacity="0.6" />
      <circle cx="268" cy="106" r="8" fill="#c6a15b" />
      <circle cx="268" cy="106" r="3.2" fill="#6d5428" />
      <circle cx="142" cy="106" r="7" fill="#d9d0c3" stroke="#5e564e" strokeWidth="1.5" />
      <path d="M154 100h16" stroke="#5e564e" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function Spokes({ cx, cy }: { cx: number; cy: number }) {
  return (
    <g stroke="#b7aea0" strokeWidth="1.1">
      {Array.from({ length: 16 }, (_, index) => {
        const angle = (Math.PI * 2 * index) / 16 + 0.18;
        return <line key={index} x1={cx} y1={cy} x2={cx + Math.cos(angle) * 38} y2={cy + Math.sin(angle) * 38} />;
      })}
    </g>
  );
}

function Wheel({ cx, cy }: { cx: number; cy: number }) {
  return (
    <g>
      <circle cx={cx} cy={cy} r="54" fill="#f7f4ee" stroke="#1c1915" strokeWidth="5" />
      <Spokes cx={cx} cy={cy} />
      <circle cx={cx} cy={cy} r="39" fill="none" stroke="#c6a15b" strokeWidth="1.4" />
      <circle cx={cx} cy={cy} r="6" fill="#1e4636" />
      <circle cx={cx} cy={cy} r="2.4" fill="#f3eee4" />
    </g>
  );
}

function Bike() {
  return (
    <svg viewBox="0 0 400 280" className="h-full w-full" aria-hidden="true">
      <Ground rx={140} />
      <Wheel cx={108} cy={176} />
      <Wheel cx={300} cy={176} />
      <g fill="none" stroke="#1e4636" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M152 96 L176 168" />
        <path d="M152 96 L240 100" />
        <path d="M176 168 L252 130" />
        <path d="M176 168 L108 176" />
        <path d="M156 108 L108 176" />
        <path d="M252 130 L300 176" />
      </g>
      <circle cx="176" cy="168" r="13" fill="none" stroke="#5e564e" strokeWidth="2.5" />
      <path d="M176 168 L196 192" stroke="#1c1915" strokeWidth="3.5" strokeLinecap="round" />
      <rect x="190" y="190" width="14" height="5" rx="1.5" fill="#c6a15b" transform="rotate(18 197 192)" />
      <path d="M116 94c24-14 58-8 68 6-20 5-48 3-68-2z" fill="#1c1915" />
      <path d="M240 100c24-20 62-16 74 6 8 16-4 30-22 24" fill="none" stroke="#1c1915" strokeWidth="5" strokeLinecap="round" />
    </svg>
  );
}

function Chair() {
  return (
    <svg viewBox="0 0 400 280" className="h-full w-full" aria-hidden="true">
      <Ground rx={112} />
      <path d="M176 196l-6 48" stroke="#5c4030" strokeWidth="8" strokeLinecap="round" />
      <path d="M268 190l10 46" stroke="#5c4030" strokeWidth="8" strokeLinecap="round" />
      <rect x="152" y="56" width="124" height="124" rx="28" fill="#5c3b2c" />
      <rect x="168" y="72" width="92" height="90" rx="20" fill="#6e4a36" />
      <path d="M186 90c18-8 40-4 50 14" fill="none" stroke="#f3eee4" strokeOpacity="0.35" strokeWidth="4" strokeLinecap="round" />
      <path d="M270 146c18 4 28 18 24 38l-30 4v-42z" fill="#4a3228" />
      <rect x="126" y="162" width="176" height="44" rx="14" fill="#7b5340" />
      <path d="M148 192h136" stroke="#4a3226" strokeWidth="2" strokeLinecap="round" opacity="0.45" />
      <path d="M108 154c-10 8-14 26-8 46h52v-40c0-12-16-16-44-6z" fill="#8d5e44" />
      <path d="M118 168c8 2 16 10 16 20" fill="none" stroke="#f3eee4" strokeOpacity="0.28" strokeWidth="3" strokeLinecap="round" />
      <path d="M146 204l-10 44" stroke="#6b4e35" strokeWidth="8" strokeLinecap="round" />
      <path d="M278 202l12 42" stroke="#6b4e35" strokeWidth="8" strokeLinecap="round" />
    </svg>
  );
}

export function LandingArt({ id }: { id: LandingExampleId }) {
  if (id === "dresser") return <Dresser />;
  if (id === "camera") return <Camera />;
  if (id === "bike") return <Bike />;
  return <Chair />;
}
