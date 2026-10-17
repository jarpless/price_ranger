import type { TourAction } from "./tours";

export function visibleSpotlight(selector: string): HTMLElement | null {
  const nodes = [...document.querySelectorAll<HTMLElement>(`[data-spotlight="${CSS.escape(selector)}"]`)];
  return nodes.find((node) => node.getClientRects().length > 0) ?? null;
}

function labelOf(node: Element): string {
  return (node.textContent || "").replace(/\s+/g, " ").trim();
}

function setNativeValue(input: HTMLInputElement | HTMLTextAreaElement, value: string) {
  const proto = input instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

function labeled(nodes: HTMLElement[], labels: string[]): HTMLElement | null {
  return nodes.find((node) => labels.includes(labelOf(node))) ?? null;
}

/**
 * Runs one tour action against the live page.
 * Returns a short reason when the control is missing. Returns null after it runs.
 */
export function runTourAction(action: TourAction): string | null {
  const root = visibleSpotlight(action.spotlight);
  if (!root) return "That control isn't on this screen yet.";

  if (action.kind === "fill") {
    const input =
      root instanceof HTMLInputElement || root instanceof HTMLTextAreaElement
        ? root
        : root.querySelector("input, textarea");
    if (!(input instanceof HTMLInputElement || input instanceof HTMLTextAreaElement)) {
      return "That field isn't on this screen yet.";
    }
    setNativeValue(input, action.value || "");
    return null;
  }

  if (action.requires === "group") {
    const group = [...document.querySelectorAll<HTMLElement>("[data-spotlight^='group-']")].some(
      (node) => node.getClientRects().length > 0,
    );
    if (!group) return "Create a group first. Then I can add a price.";
  }

  const labels = action.labels || [];
  let target: HTMLElement | null = null;
  if (labels.length > 0) {
    const nodes = [root, ...root.querySelectorAll<HTMLElement>("button, a")].filter((node) =>
      action.requires === "group" ? !node.closest("form") : true,
    );
    target = labeled(nodes, labels);
  } else if (root instanceof HTMLButtonElement || root instanceof HTMLAnchorElement) {
    target = root;
  } else {
    target = root.querySelector("button, a");
  }
  if (!target) return "I couldn't find that control yet.";
  target.click();
  return null;
}
