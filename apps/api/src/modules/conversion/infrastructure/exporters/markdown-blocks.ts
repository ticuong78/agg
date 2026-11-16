import { marked, type Token, type Tokens } from 'marked';
import { latexToText } from './latex.js';

/** Inline text with the few styles statements use. */
export interface Run {
  text: string;
  bold?: boolean;
  italic?: boolean;
  code?: boolean;
}

/** Format-neutral blocks that the Word and PDF writers lay out. */
export type Block =
  | { type: 'heading'; level: number; runs: Run[] }
  | { type: 'paragraph'; runs: Run[] }
  | { type: 'list'; ordered: boolean; items: Run[][] }
  | { type: 'code'; text: string }
  | { type: 'table'; header: Run[][]; rows: Run[][][] }
  | { type: 'rule' };

/** Markdown (with LaTeX already turned into text) to blocks. */
export function markdownBlocks(markdown: string): Block[] {
  const tokens = marked.lexer(latexToText(markdown), { gfm: true });
  return tokens.flatMap(toBlocks);
}

function toBlocks(token: Token): Block[] {
  switch (token.type) {
    case 'heading':
      return [{ type: 'heading', level: (token as Tokens.Heading).depth, runs: inline((token as Tokens.Heading).tokens) }];
    case 'paragraph':
      return [{ type: 'paragraph', runs: inline((token as Tokens.Paragraph).tokens) }];
    case 'text':
      return [{ type: 'paragraph', runs: inline((token as Tokens.Text).tokens ?? [{ type: 'text', raw: token.raw, text: (token as Tokens.Text).text }]) }];
    case 'list': {
      const list = token as Tokens.List;
      return [{ type: 'list', ordered: list.ordered, items: list.items.map((item) => item.tokens.flatMap((t) => (t.type === 'text' || t.type === 'paragraph') ? inline((t as Tokens.Text).tokens ?? []) : [])) }];
    }
    case 'code':
      return [{ type: 'code', text: (token as Tokens.Code).text }];
    case 'table': {
      const table = token as Tokens.Table;
      return [{ type: 'table', header: table.header.map((c) => inline(c.tokens)), rows: table.rows.map((r) => r.map((c) => inline(c.tokens))) }];
    }
    case 'blockquote':
      return (token as Tokens.Blockquote).tokens.flatMap(toBlocks);
    case 'hr':
      return [{ type: 'rule' }];
    case 'html':
      return [{ type: 'paragraph', runs: [{ text: (token as Tokens.HTML).text.replace(/<[^>]+>/g, '') }] }];
    default:
      return [];
  }
}

function inline(tokens: Token[] | undefined, style: Omit<Run, 'text'> = {}): Run[] {
  if (!tokens) return [];
  return tokens.flatMap((t): Run[] => {
    switch (t.type) {
      case 'strong':
        return inline((t as Tokens.Strong).tokens, { ...style, bold: true });
      case 'em':
        return inline((t as Tokens.Em).tokens, { ...style, italic: true });
      case 'del':
        return inline((t as Tokens.Del).tokens, style);
      case 'codespan':
        return [{ ...style, code: true, text: decode((t as Tokens.Codespan).text) }];
      case 'br':
        return [{ ...style, text: '\n' }];
      case 'link':
        return inline((t as Tokens.Link).tokens, style);
      case 'image':
        return [{ ...style, italic: true, text: '[Hình ảnh]' }];
      case 'text': {
        const text = t as Tokens.Text;
        return text.tokens ? inline(text.tokens, style) : [{ ...style, text: decode(text.text) }];
      }
      case 'escape':
        return [{ ...style, text: (t as Tokens.Escape).text }];
      default:
        return 'text' in t && typeof t.text === 'string' ? [{ ...style, text: decode(t.text) }] : [];
    }
  });
}

const decode = (s: string) =>
  s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');
