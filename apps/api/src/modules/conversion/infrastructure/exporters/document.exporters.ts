import { Injectable } from '@nestjs/common';
import {
  AlignmentType, BorderStyle, Document, HeadingLevel, Packer, Paragraph, ShadingType, Table, TableCell, TableRow, TextRun, WidthType,
} from 'docx';
import { marked } from 'marked';
import { ContestExporter, type ExportedFile, type ExportModel } from '../../application/ports.js';
import { latexToText } from './latex.js';
import { markdownBlocks, type Block, type Run } from './markdown-blocks.js';
import { contestMarkdown, safeFileName } from './statement-markdown.js';

@Injectable()
export class MarkdownExporter extends ContestExporter {
  readonly format = 'md' as const;

  async export({ settings, problems }: ExportModel): Promise<ExportedFile> {
    return {
      fileName: safeFileName(settings.name, '.md'),
      mimeType: 'text/markdown; charset=utf-8',
      content: Buffer.from(contestMarkdown(settings, problems), 'utf8'),
    };
  }
}

/**
 * Word 97-2003 (.doc): an HTML document with Word's namespaces, which every Word version opens as a document.
 * Writing the binary .doc format is not worth it for what teachers do with the file (print, edit, re-save).
 */
@Injectable()
export class LegacyWordExporter extends ContestExporter {
  readonly format = 'doc' as const;

  async export({ settings, problems }: ExportModel): Promise<ExportedFile> {
    const body = await marked.parse(latexToText(contestMarkdown(settings, problems)), { gfm: true });
    const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="utf-8"><title>${escapeHtml(settings.name)}</title>
<!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View><w:Zoom>100</w:Zoom></w:WordDocument></xml><![endif]-->
<style>
body { font-family: 'Times New Roman', serif; font-size: 13pt; line-height: 1.4; }
h1 { font-size: 18pt; text-align: center; } h2 { font-size: 15pt; margin-top: 18pt; } h3 { font-size: 13pt; }
pre { font-family: Consolas, 'Courier New', monospace; font-size: 11pt; background: #f3f4f6; padding: 6pt; border: 1px solid #d1d5db; }
table { border-collapse: collapse; } td, th { border: 1px solid #9ca3af; padding: 3pt 6pt; }
</style></head><body>${body}</body></html>`;
    return { fileName: safeFileName(settings.name, '.doc'), mimeType: 'application/msword', content: Buffer.from(`﻿${html}`, 'utf8') };
  }
}

@Injectable()
export class DocxExporter extends ContestExporter {
  readonly format = 'docx' as const;

  async export({ settings, problems }: ExportModel): Promise<ExportedFile> {
    const children = markdownBlocks(contestMarkdown(settings, problems)).flatMap(docxBlock);
    const doc = new Document({
      creator: 'GoiDe',
      title: settings.name,
      styles: { default: { document: { run: { font: 'Times New Roman', size: 26 } } } },
      sections: [{ properties: { page: { margin: { top: 1134, bottom: 1134, left: 1134, right: 1134 } } }, children }],
    });
    return {
      fileName: safeFileName(settings.name, '.docx'),
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      content: await Packer.toBuffer(doc),
    };
  }
}

const HEADINGS = [HeadingLevel.TITLE, HeadingLevel.HEADING_1, HeadingLevel.HEADING_2, HeadingLevel.HEADING_3] as const;

function runs(list: Run[]): TextRun[] {
  return list.flatMap((r) =>
    r.text.split('\n').map((part, i) => new TextRun({
      text: part, bold: r.bold, italics: r.italic, break: i > 0 ? 1 : undefined,
      ...(r.code ? { font: 'Consolas', size: 22 } : {}),
    })),
  );
}

function docxBlock(block: Block): (Paragraph | Table)[] {
  switch (block.type) {
    case 'heading':
      return [new Paragraph({
        heading: HEADINGS[Math.min(block.level, 3)],
        alignment: block.level === 1 ? AlignmentType.CENTER : undefined,
        children: runs(block.runs),
        spacing: { before: block.level <= 2 ? 240 : 160, after: 80 },
      })];
    case 'paragraph':
      return [new Paragraph({ children: runs(block.runs), spacing: { after: 120 } })];
    case 'list':
      return block.items.map((item, i) => new Paragraph({
        children: [new TextRun(block.ordered ? `${i + 1}. ` : '• '), ...runs(item)],
        indent: { left: 360 },
        spacing: { after: 60 },
      }));
    case 'code':
      return [new Paragraph({
        shading: { type: ShadingType.CLEAR, fill: 'F3F4F6', color: 'auto' },
        border: { top: line, bottom: line, left: line, right: line },
        children: block.text.split('\n').map((l, i) => new TextRun({ text: l, font: 'Consolas', size: 22, break: i > 0 ? 1 : undefined })),
        spacing: { after: 120 },
      })];
    case 'table':
      return [new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [block.header, ...block.rows].map((row, r) => new TableRow({
          tableHeader: r === 0,
          children: row.map((cell) => new TableCell({
            children: [new Paragraph({ children: runs(r === 0 ? cell.map((c) => ({ ...c, bold: true })) : cell) })],
          })),
        })),
      }), new Paragraph({ children: [] })];
    case 'rule':
      return [new Paragraph({ border: { bottom: line }, children: [] })];
  }
}

const line = { style: BorderStyle.SINGLE, size: 4, color: 'D1D5DB' };

const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
