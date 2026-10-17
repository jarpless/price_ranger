const COLOR_FN = /(?:oklch|oklab|lab|lch|color-mix|color)\(/gi;

function closeParen(value: string, open: number): number {
  let depth = 0;
  for (let index = open; index < value.length; index += 1) {
    const char = value[index];
    if (char === "(") depth += 1;
    else if (char === ")") {
      depth -= 1;
      if (depth === 0) return index;
    }
  }
  return -1;
}

/** Replace modern CSS colors with whatever `convert` returns, so a screenshot engine can paint them. */
export function rewriteModernColor(value: string, convert: (expr: string) => string): string {
  if (!value || !/(?:oklch|oklab|lab|lch|color-mix|color)\(/i.test(value)) return value;
  let out = "";
  let index = 0;
  while (index < value.length) {
    COLOR_FN.lastIndex = index;
    const match = COLOR_FN.exec(value);
    if (!match || match.index < index) {
      out += value.slice(index);
      break;
    }
    const open = match.index + match[0].length - 1;
    const close = closeParen(value, open);
    if (close < 0) {
      out += value.slice(match.index);
      break;
    }
    out += value.slice(index, match.index);
    const expr = value.slice(match.index, close + 1);
    const next = convert(expr);
    out += next || expr;
    index = close + 1;
  }
  return out;
}
