/**
 * Formats without a math renderer (Word, PDF) get LaTeX turned into readable text:
 * $1 \le n \le 10^6$ -> 1 ≤ n ≤ 10⁶, $a_i$ -> aᵢ, \frac{a}{b} -> a/b. Markdown keeps the LaTeX as written.
 */

const SYMBOLS: Record<string, string> = {
  le: '≤', leq: '≤', ge: '≥', geq: '≥', ne: '≠', neq: '≠', times: '×', cdot: '·', div: '÷', pm: '±',
  dots: '…', ldots: '…', cdots: '⋯', infty: '∞', to: '→', rightarrow: '→', leftarrow: '←', Rightarrow: '⇒',
  sum: '∑', prod: '∏', in: '∈', notin: '∉', subset: '⊂', cup: '∪', cap: '∩', forall: '∀', exists: '∃',
  alpha: 'α', beta: 'β', gamma: 'γ', delta: 'δ', epsilon: 'ε', lambda: 'λ', mu: 'μ', pi: 'π', sigma: 'σ', theta: 'θ',
  omega: 'ω', Delta: 'Δ', Sigma: 'Σ', lfloor: '⌊', rfloor: '⌋', lceil: '⌈', rceil: '⌉', mid: '|', quad: ' ', qquad: '  ',
  lbrace: '{', rbrace: '}', approx: '≈', equiv: '≡', bmod: 'mod', mod: 'mod', log: 'log', max: 'max', min: 'min', gcd: 'gcd',
};

const SUPERSCRIPT: Record<string, string> = {
  '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹', '+': '⁺', '-': '⁻', n: 'ⁿ', i: 'ⁱ',
};
const SUBSCRIPT: Record<string, string> = {
  '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄', '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉', '+': '₊', '-': '₋',
  i: 'ᵢ', j: 'ⱼ', k: 'ₖ', n: 'ₙ', m: 'ₘ', x: 'ₓ',
};

function script(value: string, table: Record<string, string>, mark: string): string {
  const chars = [...value];
  return chars.every((c) => table[c]) ? chars.map((c) => table[c]).join('') : `${mark}(${value})`;
}

function mathToText(tex: string): string {
  let s = tex;
  for (let i = 0; i < 3; i++) {
    s = s
      .replace(/\\(?:frac|dfrac|tfrac)\s*\{([^{}]*)\}\s*\{([^{}]*)\}/g, '($1)/($2)')
      .replace(/\\sqrt\s*\{([^{}]*)\}/g, '√($1)')
      .replace(/\\(?:text|mathrm|mathbf|mathit|operatorname)\s*\{([^{}]*)\}/g, '$1')
      .replace(/\^\s*\{([^{}]*)\}/g, (_, v: string) => script(v, SUPERSCRIPT, '^'))
      .replace(/_\s*\{([^{}]*)\}/g, (_, v: string) => script(v, SUBSCRIPT, '_'));
  }
  return s
    .replace(/\^([A-Za-z0-9])/g, (_, v: string) => script(v, SUPERSCRIPT, '^'))
    .replace(/_([A-Za-z0-9])/g, (_, v: string) => script(v, SUBSCRIPT, '_'))
    .replace(/\\([A-Za-z]+)/g, (m, name: string) => SYMBOLS[name] ?? m)
    .replace(/\\([{}%$&#_ ,;!])/g, '$1')
    .replace(/[{}]/g, '')
    .replace(/\(([A-Za-z0-9]+)\)\/\(([A-Za-z0-9]+)\)/g, '$1/$2')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/** Replaces $...$ and $$...$$ spans in Markdown text by their plain-text reading. */
export function latexToText(text: string): string {
  return text
    .replace(/\$\$([\s\S]+?)\$\$/g, (_, tex: string) => mathToText(tex))
    .replace(/(?<!\\)\$([^$\n]+?)(?<!\\)\$/g, (_, tex: string) => mathToText(tex));
}
