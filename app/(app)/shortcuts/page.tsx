import { ShortcutLinks } from "@/components/shortcut-links";

export const metadata = { title: "Shortcuts" };

export default function ShortcutsPage() {
  return (
    <div className="lg:grid lg:grid-cols-2 lg:gap-12">
      <div>
        <h1 className="font-serif text-display lg:text-[2.5rem] lg:leading-[3rem]">Shortcuts</h1>
        <p className="mt-3 max-w-xl text-body leading-6 text-muted">
          Add New price or Ask Price Ranger to the Shortcuts app or the Action Button. Each one is a normal link.
        </p>
        <ShortcutLinks />
      </div>
      <ol className="mt-8 space-y-4 text-body leading-6 lg:mt-16">
        <li>
          <span className="font-semibold">1. Copy a link.</span> Use New price or Ask Price Ranger above.
        </li>
        <li>
          <span className="font-semibold">2. Open Shortcuts.</span> Tap the plus button, add Open URLs, and paste the link.
        </li>
        <li>
          <span className="font-semibold">3. Name it.</span> “New price” or “Ask Price Ranger” matches the app shortcuts.
        </li>
        <li>
          <span className="font-semibold">4. Action Button.</span> In Settings, choose Action Button, then Shortcut, then the one you just made.
        </li>
      </ol>
    </div>
  );
}
