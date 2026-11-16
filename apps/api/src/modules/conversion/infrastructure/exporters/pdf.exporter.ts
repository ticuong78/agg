import { Injectable } from '@nestjs/common';
import PDFDocument from 'pdfkit';
import { ContestExporter, type ExportedFile, type ExportModel } from '../../application/ports.js';
import { markdownBlocks, type Block, type Run } from './markdown-blocks.js';
import { contestMarkdown, safeFileName } from './statement-markdown.js';

/** Full TrueType fonts (not web subsets): Vietnamese diacritics need the complete glyph set in one file. */
const FONTS = {
  regular: require.resolve('@expo-google-fonts/be-vietnam-pro/400Regular/BeVietnamPro_400Regular.ttf'),
  bold: require.resolve('@expo-google-fonts/be-vietnam-pro/700Bold/BeVietnamPro_700Bold.ttf'),
  italic: require.resolve('@expo-google-fonts/be-vietnam-pro/400Regular_Italic/BeVietnamPro_400Regular_Italic.ttf'),
  boldItalic: require.resolve('@expo-google-fonts/be-vietnam-pro/700Bold_Italic/BeVietnamPro_700Bold_Italic.ttf'),
  mono: require.resolve('@expo-google-fonts/jetbrains-mono/400Regular/JetBrainsMono_400Regular.ttf'),
};

const SIZES = { body: 11, h1: 18, h2: 14, h3: 12, code: 9.5 };
const MARGIN = 56;

@Injectable()
export class PdfExporter extends ContestExporter {
  readonly format = 'pdf' as const;

  async export({ settings, problems }: ExportModel): Promise<ExportedFile> {
    const doc = new PDFDocument({ size: 'A4', margin: MARGIN, info: { Title: settings.name, Creator: 'GoiDe' }, bufferPages: true });
    for (const [name, path] of Object.entries(FONTS)) doc.registerFont(name, path);
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    const done = new Promise<Buffer>((resolve) => doc.on('end', () => resolve(Buffer.concat(chunks))));

    const blocks = markdownBlocks(contestMarkdown(settings, problems));
    let firstProblem = true;
    for (const block of blocks) {
      // Each problem starts on a new page, as printed exam papers do.
      if (block.type === 'heading' && block.level === 2 && block.runs.some((r) => r.text.startsWith('Bài '))) {
        if (!firstProblem || doc.y > MARGIN + 1) doc.addPage();
        firstProblem = false;
      }
      write(doc, block);
    }
    pageNumbers(doc);
    doc.end();
    return { fileName: safeFileName(settings.name, '.pdf'), mimeType: 'application/pdf', content: await done };
  }
}

const width = (doc: PDFKit.PDFDocument) => doc.page.width - MARGIN * 2;

function fontOf(run: Run): string {
  if (run.code) return 'mono';
  if (run.bold && run.italic) return 'boldItalic';
  if (run.bold) return 'bold';
  return run.italic ? 'italic' : 'regular';
}

function writeRuns(doc: PDFKit.PDFDocument, runs: Run[], size: number, options: PDFKit.Mixins.TextOptions = {}) {
  const parts = runs.filter((r) => r.text.length);
  if (!parts.length) return;
  parts.forEach((run, i) => {
    doc.font(fontOf(run)).fontSize(run.code ? size - 1 : size).text(run.text, {
      ...options,
      width: width(doc),
      continued: i < parts.length - 1,
      lineGap: 2,
    });
  });
}

function write(doc: PDFKit.PDFDocument, block: Block) {
  switch (block.type) {
    case 'heading': {
      const size = block.level === 1 ? SIZES.h1 : block.level === 2 ? SIZES.h2 : SIZES.h3;
      doc.moveDown(block.level === 3 ? 0.6 : 0.3);
      writeRuns(doc, block.runs.map((r) => ({ ...r, bold: true })), size, { align: block.level === 1 ? 'center' : 'left' });
      doc.moveDown(0.3);
      return;
    }
    case 'paragraph':
      writeRuns(doc, block.runs, SIZES.body, { align: 'justify' });
      doc.moveDown(0.5);
      return;
    case 'list':
      block.items.forEach((item, i) => {
        writeRuns(doc, [{ text: block.ordered ? `${i + 1}. ` : '•  ' }, ...item], SIZES.body, { indent: 12 });
      });
      doc.moveDown(0.5);
      return;
    case 'code': {
      doc.font('mono').fontSize(SIZES.code);
      const text = block.text || ' ';
      const height = doc.heightOfString(text, { width: width(doc) - 16 }) + 12;
      if (doc.y + height > doc.page.height - MARGIN) doc.addPage();
      const top = doc.y;
      doc.save().rect(MARGIN, top, width(doc), height).fillAndStroke('#F3F4F6', '#D1D5DB').restore();
      doc.fillColor('#111827').text(text, MARGIN + 8, top + 6, { width: width(doc) - 16 });
      doc.x = MARGIN;
      doc.y = top + height;
      doc.moveDown(0.6);
      return;
    }
    case 'table': {
      const columns = Math.max(1, block.header.length);
      const colWidth = width(doc) / columns;
      for (const [r, row] of [block.header, ...block.rows].entries()) {
        const cells = row.map((cell) => cell.map((c) => c.text).join(''));
        doc.font(r === 0 ? 'bold' : 'regular').fontSize(SIZES.body - 1.5);
        const height = Math.max(...cells.map((c) => doc.heightOfString(c || ' ', { width: colWidth - 8 }))) + 8;
        if (doc.y + height > doc.page.height - MARGIN) doc.addPage();
        const top = doc.y;
        cells.forEach((cell, c) => {
          const left = MARGIN + c * colWidth;
          doc.save().rect(left, top, colWidth, height).stroke('#9CA3AF').restore();
          doc.fillColor('#111827').text(cell, left + 4, top + 4, { width: colWidth - 8 });
        });
        doc.x = MARGIN;
        doc.y = top + height;
      }
      doc.moveDown(0.8);
      return;
    }
    case 'rule':
      doc.moveTo(MARGIN, doc.y).lineTo(doc.page.width - MARGIN, doc.y).stroke('#D1D5DB');
      doc.moveDown(0.5);
  }
}

function pageNumbers(doc: PDFKit.PDFDocument) {
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    // Writing inside the bottom margin would otherwise make PDFKit start a new page.
    doc.page.margins.bottom = 0;
    doc.font('regular').fontSize(9).fillColor('#6B7280')
      .text(`${i + 1}/${range.count}`, MARGIN, doc.page.height - MARGIN / 2 - 6, { width: width(doc), align: 'center', lineBreak: false });
  }
}
