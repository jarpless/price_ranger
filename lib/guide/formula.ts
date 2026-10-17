/**
 * A small formula language for quote columns.
 * Numbers, column names, + - * /, parentheses, and a leading minus.
 * There is no eval, no function calls, and no property access.
 */

export type FormulaNode =
  | { type: "num"; value: number }
  | { type: "ref"; name: string }
  | { type: "neg"; value: FormulaNode }
  | { type: "bin"; op: "+" | "-" | "*" | "/"; left: FormulaNode; right: FormulaNode };

export type FormulaResult = { ok: true; value: number } | { ok: false; error: string };

const MAX_LENGTH = 180;
const MAX_DEPTH = 24;

export function parseFormula(source: string): { ok: true; ast: FormulaNode } | { ok: false; error: string } {
  const text = source.trim();
  if (!text) return { ok: false, error: "Enter a formula, such as qty * rate." };
  if (text.length > MAX_LENGTH) return { ok: false, error: "That formula is too long." };
  if (/[;{}[\]`]|=>|\bfunction\b|\beval\b/.test(text)) {
    return { ok: false, error: "Use numbers, column names, and + - * / only." };
  }
  try {
    const parser = new Parser(text);
    const ast = parser.parse();
    return { ok: true, ast };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "That formula could not be read." };
  }
}

export function evaluateFormula(source: string, scope: Record<string, number>): FormulaResult {
  const parsed = parseFormula(source);
  if (!parsed.ok) return parsed;
  return evalNode(parsed.ast, scope, 0);
}

export function formulaRefs(source: string): string[] {
  const parsed = parseFormula(source);
  if (!parsed.ok) return [];
  const names = new Set<string>();
  walk(parsed.ast, (node) => {
    if (node.type === "ref") names.add(node.name);
  });
  return [...names];
}

export function explainFormula(source: string, labels: Record<string, string> = {}): string {
  const parsed = parseFormula(source);
  if (!parsed.ok) return parsed.error;
  const phrase = describe(parsed.ast, labels);
  return `${phrase}. The amount is that result.`;
}

export interface FormulaColumnHint {
  id: string;
  label: string;
  type: "text" | "number" | "money" | "formula";
}

/** A local recommendation used when no model is configured, and as a check on model output. */
export function suggestFormula(
  columns: FormulaColumnHint[],
  targetId: string,
): { formula: string; explanation: string } {
  const numeric = columns.filter(
    (column) => column.id !== targetId && (column.type === "number" || column.type === "money"),
  );
  const ids = new Set(numeric.map((column) => column.id));
  const markup = columns.find(
    (column) => column.id !== targetId && /markup|margin/i.test(`${column.id} ${column.label}`),
  );
  let formula = "0";
  if (ids.has("hours") && ids.has("rate") && markup) formula = `hours * rate * (1 + ${markup.id} / 100)`;
  else if (ids.has("hours") && ids.has("rate")) formula = "hours * rate";
  else if (ids.has("qty") && ids.has("rate") && markup) formula = `qty * rate * (1 + ${markup.id} / 100)`;
  else if (ids.has("qty") && ids.has("rate")) formula = "qty * rate";
  else if (numeric.length >= 2) formula = numeric.map((column) => column.id).join(" * ");
  else if (numeric.length === 1) formula = numeric[0].id;
  const labels = Object.fromEntries(columns.map((column) => [column.id, column.label]));
  const explanation =
    formula === "0"
      ? "Add a number column such as qty, hours, or rate, then the amount can multiply them."
      : explainFormula(formula, labels);
  return { formula, explanation };
}

function walk(node: FormulaNode, visit: (node: FormulaNode) => void) {
  visit(node);
  if (node.type === "neg") walk(node.value, visit);
  if (node.type === "bin") {
    walk(node.left, visit);
    walk(node.right, visit);
  }
}

function describe(node: FormulaNode, labels: Record<string, string>): string {
  if (node.type === "num") return trimNumber(node.value);
  if (node.type === "ref") return labels[node.name] || node.name;
  if (node.type === "neg") return `minus ${describe(node.value, labels)}`;
  const word = node.op === "+" ? "plus" : node.op === "-" ? "minus" : node.op === "*" ? "times" : "divided by";
  return `${describe(node.left, labels)} ${word} ${describe(node.right, labels)}`;
}

function trimNumber(value: number): string {
  if (Number.isInteger(value)) return String(value);
  return String(Math.round(value * 10000) / 10000);
}

function evalNode(node: FormulaNode, scope: Record<string, number>, depth: number): FormulaResult {
  if (depth > MAX_DEPTH) return { ok: false, error: "That formula is nested too deep." };
  if (node.type === "num") return { ok: true, value: node.value };
  if (node.type === "ref") {
    if (!Object.prototype.hasOwnProperty.call(scope, node.name)) {
      return { ok: false, error: `There is no column named ${node.name}.` };
    }
    const value = scope[node.name];
    if (!Number.isFinite(value)) return { ok: false, error: `${node.name} is not a number yet.` };
    return { ok: true, value };
  }
  if (node.type === "neg") {
    const inner = evalNode(node.value, scope, depth + 1);
    if (!inner.ok) return inner;
    return { ok: true, value: -inner.value };
  }
  const left = evalNode(node.left, scope, depth + 1);
  if (!left.ok) return left;
  const right = evalNode(node.right, scope, depth + 1);
  if (!right.ok) return right;
  let value = 0;
  if (node.op === "+") value = left.value + right.value;
  else if (node.op === "-") value = left.value - right.value;
  else if (node.op === "*") value = left.value * right.value;
  else if (right.value === 0) return { ok: false, error: "That formula divides by zero." };
  else value = left.value / right.value;
  if (!Number.isFinite(value)) return { ok: false, error: "That formula did not produce a number." };
  return { ok: true, value };
}

class Parser {
  private index = 0;

  constructor(private readonly source: string) {}

  parse(): FormulaNode {
    const node = this.expression();
    this.skip();
    if (this.index < this.source.length) throw new Error("Use numbers, column names, and + - * / only.");
    return node;
  }

  private expression(): FormulaNode {
    let node = this.term();
    for (;;) {
      this.skip();
      const op = this.source[this.index];
      if (op !== "+" && op !== "-") return node;
      this.index += 1;
      node = { type: "bin", op, left: node, right: this.term() };
    }
  }

  private term(): FormulaNode {
    let node = this.unary();
    for (;;) {
      this.skip();
      const op = this.source[this.index];
      if (op !== "*" && op !== "/") return node;
      this.index += 1;
      node = { type: "bin", op, left: node, right: this.unary() };
    }
  }

  private unary(): FormulaNode {
    this.skip();
    if (this.source[this.index] === "-") {
      this.index += 1;
      return { type: "neg", value: this.unary() };
    }
    return this.primary();
  }

  private primary(): FormulaNode {
    this.skip();
    const char = this.source[this.index];
    if (!char) throw new Error("The formula ends early.");
    if (char === "(") {
      this.index += 1;
      const node = this.expression();
      this.skip();
      if (this.source[this.index] !== ")") throw new Error("Add a closing parenthesis.");
      this.index += 1;
      return node;
    }
    if (char >= "0" && char <= "9" || char === ".") return { type: "num", value: this.number() };
    if (/[A-Za-z_]/.test(char)) return { type: "ref", name: this.name() };
    if (char === "%") throw new Error("Use / 100 for a percent. For example, markup / 100.");
    throw new Error("Use numbers, column names, and + - * / only.");
  }

  private number(): number {
    const start = this.index;
    while (/[0-9.]/.test(this.source[this.index] || "")) this.index += 1;
    const raw = this.source.slice(start, this.index);
    if (!/^\d+(\.\d+)?$/.test(raw) && !/^\d*\.\d+$/.test(raw)) {
      throw new Error("That number could not be read.");
    }
    if ((this.source[this.index] || "").match(/[A-Za-z_]/)) {
      throw new Error("Put a space or an operator after the number.");
    }
    const value = Number(raw);
    if (!Number.isFinite(value) || Math.abs(value) > 1_000_000_000) throw new Error("That number is too large.");
    return value;
  }

  private name(): string {
    const start = this.index;
    while (/[A-Za-z0-9_]/.test(this.source[this.index] || "")) this.index += 1;
    const name = this.source.slice(start, this.index);
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name) || name.length > 32) {
      throw new Error("Column names use letters, numbers, and underscores.");
    }
    this.skip();
    if (this.source[this.index] === "(") throw new Error("Formulas cannot call functions.");
    return name;
  }

  private skip() {
    while (this.source[this.index] === " " || this.source[this.index] === "\t") this.index += 1;
  }
}
