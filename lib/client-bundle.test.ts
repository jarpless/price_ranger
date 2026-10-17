import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** Modules that hold named-model matchers or the photo prompt. They must stay on the server. */
const SERVER_ONLY = ["lib/market.ts", "lib/guide/vision.ts"];
const MODEL_NAMES = /nintendo|playstation|\bps5\b|xbox|airpods|macbook|joy-?con|iphone\s*13|kitchenaid|Name the main thing in this photo/i;

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (name === "node_modules" || name.startsWith(".")) return [];
    if (statSync(full).isDirectory()) return sourceFiles(full);
    return /\.(tsx?|mjs)$/.test(name) && !name.endsWith(".test.ts") ? [full] : [];
  });
}

function resolveImport(from: string, spec: string): string | null {
  let base: string;
  if (spec.startsWith("@/")) base = path.join(root, spec.slice(2));
  else if (spec.startsWith(".")) base = path.resolve(path.dirname(from), spec);
  else return null;
  for (const candidate of [base, `${base}.ts`, `${base}.tsx`, path.join(base, "index.ts"), path.join(base, "index.tsx")]) {
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  }
  return null;
}

/** Value imports only. `import type` and all-type specifier lists are erased by the compiler. */
function valueImports(source: string): string[] {
  const specs: string[] = [];
  const pattern = /(?:^|\n)\s*(import|export)\s+([\s\S]*?)\s+from\s+["']([^"']+)["']|(?:^|\n)\s*import\s+["']([^"']+)["']/g;
  for (const match of source.matchAll(pattern)) {
    if (match[4]) {
      specs.push(match[4]);
      continue;
    }
    const clause = match[2].trim();
    if (clause.startsWith("type ")) continue;
    const braces = clause.match(/^\{([\s\S]*)\}$/);
    if (braces) {
      const names = braces[1].split(",").map((name) => name.trim()).filter(Boolean);
      if (names.length > 0 && names.every((name) => name.startsWith("type "))) continue;
    }
    specs.push(match[3]);
  }
  return specs;
}

function clientGraph(): Map<string, string> {
  const entries = [...sourceFiles(path.join(root, "components")), ...sourceFiles(path.join(root, "app"))].filter((file) =>
    /^\s*["']use client["']/.test(readFileSync(file, "utf8")),
  );
  const parent = new Map<string, string>();
  const queue = [...entries];
  for (const entry of entries) parent.set(entry, "(client entry)");
  while (queue.length) {
    const file = queue.shift() as string;
    const source = readFileSync(file, "utf8");
    if (/^\s*["']use server["']/.test(source)) continue;
    for (const spec of valueImports(source)) {
      const next = resolveImport(file, spec);
      if (!next || parent.has(next)) continue;
      parent.set(next, file);
      queue.push(next);
    }
  }
  return parent;
}

function chain(parent: Map<string, string>, file: string): string {
  const steps = [path.relative(root, file)];
  let current = parent.get(file);
  while (current && current !== "(client entry)") {
    steps.unshift(path.relative(root, current));
    current = parent.get(current);
  }
  return steps.join(" -> ");
}

test("named-model matchers and the photo prompt never reach a client component", () => {
  const graph = clientGraph();
  assert.ok(graph.size > 20);
  for (const rel of SERVER_ONLY) {
    const file = path.join(root, rel);
    assert.equal(graph.has(file), false, `${rel} is client-reachable: ${graph.has(file) ? chain(graph, file) : ""}`);
  }
  for (const file of graph.keys()) {
    assert.doesNotMatch(readFileSync(file, "utf8"), MODEL_NAMES, chain(graph, file));
  }
});
