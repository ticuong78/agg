import { Injectable } from '@nestjs/common';
import type { ExportFormat } from '@agg/contracts';
import { ContestExporter, ExporterRegistry } from '../../application/ports.js';
import { ThemisContestExporter } from './contest.exporter.js';
import { DocxExporter, LegacyWordExporter, MarkdownExporter } from './document.exporters.js';
import { PdfExporter } from './pdf.exporter.js';

@Injectable()
export class DefaultExporterRegistry extends ExporterRegistry {
  private readonly byFormat: Map<ExportFormat, ContestExporter>;

  constructor(contest: ThemisContestExporter, md: MarkdownExporter, docx: DocxExporter, doc: LegacyWordExporter, pdf: PdfExporter) {
    super();
    this.byFormat = new Map([contest, md, docx, doc, pdf].map((e) => [e.format, e]));
  }

  get(format: ExportFormat): ContestExporter {
    const exporter = this.byFormat.get(format);
    if (!exporter) throw new Error(`No exporter for ${format}`);
    return exporter;
  }
}

export const EXPORTERS = [ThemisContestExporter, MarkdownExporter, DocxExporter, LegacyWordExporter, PdfExporter];
