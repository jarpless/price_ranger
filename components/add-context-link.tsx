import { PendingLink } from "./pending-link";

/** "+ Add context" opens the file, text, and transcript reader. Always paired with the Add photo button. */
export function AddContextLink({ compact = false }: { compact?: boolean }) {
  return (
    <PendingLink
      href="/new/context"
      data-add-context=""
      className={`flex w-full min-w-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-2xl border border-line bg-paper font-semibold text-ink ${compact ? "h-12 text-base" : "h-16 text-lg"}`}
    >
      <span aria-hidden className={`leading-none text-pine ${compact ? "text-lg" : "text-xl"}`}>
        +
      </span>
      Add context
    </PendingLink>
  );
}
