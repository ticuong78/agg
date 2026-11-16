import { Injectable } from '@nestjs/common';
import JSZip from 'jszip';
import mammoth from 'mammoth';
import { DomainError } from '../../../shared/domain/domain-error.js';
import type { SourceKind } from '@agg/contracts';
import { DocumentReader } from '../application/ports.js';
import type { DocumentBlock, ExamDocument } from '../domain/exam-document.js';
import type { SourceFile } from '../domain/source-file.js';
import { inlineEquations } from './omml.js';

/**
 * Reads .docx through mammoth (HTML keeps tables, which often hold sample tests), .pdf through unpdf,
 * text formats as they are. Copied from OnlineJudge (importing context) and extended to text, HTML and RTF.
 */
@Injectable()
export class TextLayerReader extends DocumentReader {
  async read(file: SourceFile, kind: SourceKind): Promise<{ document: ExamDocument | null; pages: number | null }> {
    if (kind === 'DOCX') {
      const { value } = await mammoth.convertToHtml({ buffer: await withPlainEquations(file.buffer) });
      return { document: { fileName: file.name, blocks: htmlToBlocks(value) }, pages: null };
    }
    if (kind === 'PDF') {
      const { extractText, getDocumentProxy } = await import('unpdf');
      const pdf = await getDocumentProxy(new Uint8Array(file.buffer));
      const { text, totalPages } = await extractText(pdf, { mergePages: true });
      return { document: { fileName: file.name, blocks: lines(text) }, pages: totalPages };
    }
    if (kind === 'TEXT' || kind === 'PASTED') {
      const raw = file.buffer.toString('utf8').replace(/^﻿/, '');
      const ext = file.name.toLowerCase().split('.').pop();
      if (ext === 'html' || ext === 'htm') return { document: { fileName: file.name, blocks: htmlToBlocks(raw) }, pages: null };
      if (ext === 'rtf') return { document: { fileName: file.name, blocks: lines(rtfToText(raw)) }, pages: null };
      return { document: { fileName: file.name, blocks: lines(raw) }, pages: null };
    }
    throw DomainError.validation('source.unsupported', 'Không đọc được chữ từ loại tệp này.');
  }
}

const lines = (text: string): DocumentBlock[] =>
  text.replace(/\r\n?/g, '\n').split('\n').map((line) => ({ kind: 'paragraph' as const, text: line }));

/** Plain text of a simple RTF file: destinations and control words dropped, \par as line breaks, \uN as characters. */
export function rtfToText(rtf: string): string {
  return rtf
    .replace(/\\u(-?\d+)\??/g, (_, n: string) => String.fromCharCode((Number(n) + 65536) % 65536))
    .replace(/\\'([0-9a-f]{2})/gi, (_, h: string) => String.fromCharCode(parseInt(h, 16)))
    .replace(/\\(par|line)\b ?/g, '\n')
    .replace(/\{\\\*[^{}]*\}/g, '')
    .replace(/\\[a-z]+-?\d* ?/gi, '')
    .replace(/[{}]/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** mammoth drops Word equations; turn them into text runs first (only when the document has any). */
async function withPlainEquations(buffer: Buffer): Promise<Buffer> {
  const zip = await JSZip.loadAsync(buffer);
  const part = zip.file('word/document.xml');
  const xml = await part?.async('string');
  if (!xml || !xml.includes('<m:oMath')) return buffer;
  zip.file('word/document.xml', inlineEquations(xml));
  return zip.generateAsync({ type: 'nodebuffer' });
}

/** Minimal converter for mammoth's (simple, well-formed) HTML output. */
export function htmlToBlocks(html: string): DocumentBlock[] {
  const blocks: DocumentBlock[] = [];
  const tokens = html.match(/<[^>]+>|[^<]+/g) ?? [];
  let text = '';
  let tableDepth = 0;
  let rows: string[][] = [];
  let row: string[] | null = null;
  let cell: string[] | null = null;
  // Where the current <sup>/<sub> started in `text`.
  let scriptStart = -1;

  const flushParagraph = () => {
    const value = decode(text);
    text = '';
    if (cell) {
      cell.push(value);
    } else if (value.trim()) {
      blocks.push({ kind: 'paragraph', text: value });
    }
  };

  for (const token of tokens) {
    if (!token.startsWith('<')) {
      text += token;
      continue;
    }
    const tag = /^<\/?\s*([a-z0-9]+)/i.exec(token)?.[1]?.toLowerCase() ?? '';
    const closing = token.startsWith('</');
    switch (tag) {
      // Word superscript/subscript runs: 10<sup>6</sup> must not read as "106".
      case 'sup': case 'sub':
        if (!closing) scriptStart = text.length;
        else if (scriptStart >= 0) {
          text = text.slice(0, scriptStart) + script(tag === 'sup' ? '^' : '_', text.slice(scriptStart));
          scriptStart = -1;
        }
        break;
      case 'br':
        text += '\n';
        break;
      case 'p': case 'h1': case 'h2': case 'h3': case 'h4': case 'h5': case 'h6': case 'li':
        if (closing) flushParagraph();
        else if (text.trim()) flushParagraph();
        break;
      case 'img':
        if (!cell) blocks.push({ kind: 'image' });
        break;
      case 'table':
        if (!closing) {
          if (tableDepth++ === 0) rows = [];
        } else if (--tableDepth === 0) {
          blocks.push({ kind: 'table', rows });
        }
        break;
      case 'tr':
        if (tableDepth !== 1) break;
        if (!closing) row = [];
        else if (row) {
          rows.push(row);
          row = null;
        }
        break;
      case 'td': case 'th':
        if (tableDepth !== 1) break;
        if (!closing) cell = [];
        else if (cell) {
          if (text.trim()) flushParagraph();
          row?.push(cell.join('\n'));
          cell = null;
        }
        break;
    }
  }
  if (text.trim()) flushParagraph();
  return blocks;
}

/** 10^6, 10^{18}, a_i, a_{i+1}: plain text that also reads as LaTeX. */
function script(mark: '^' | '_', inner: string): string {
  const value = inner.trim();
  if (!value) return inner;
  return decode(value).length === 1 ? `${mark}${value}` : `${mark}{${value}}`;
}

function decode(s: string): string {
  return s
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&amp;/g, '&');
}
