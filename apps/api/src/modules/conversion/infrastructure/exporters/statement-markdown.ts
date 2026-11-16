import type { ContestSettings } from '../../domain/contest-settings.js';
import type { ProblemState } from '../../domain/problem.js';
import { ioLine, SECTION_TITLES } from '../../domain/statement.js';

/**
 * The statements as one Markdown document: the common source of the .md, .doc, .docx and .pdf exports
 * and of the statement put inside the .contest archive.
 */
export function contestMarkdown(settings: ContestSettings, problems: ProblemState[]): string {
  const head = [settings.header ? `**${settings.header}**\n` : '', `# ${settings.name}\n`].filter(Boolean).join('\n');
  const summary = [
    '| Bài | Tên bài | Tệp chương trình | Dữ liệu vào | Kết quả | Thời gian | Bộ nhớ |',
    '| --- | --- | --- | --- | --- | --- | --- |',
    ...problems.map((p, i) => {
      const io = settings.ioMode === 'FILE' ? [`${p.code}.INP`, `${p.code}.OUT`] : ['Bàn phím', 'Màn hình'];
      return `| ${i + 1} | ${escapeCell(p.title)} | ${p.code}.\\* | ${io[0]} | ${io[1]} | ${p.timeLimitMs / 1000} giây | ${p.memoryLimitMb} MB |`;
    }),
  ].join('\n');
  return [head, summary, ...problems.map((p, i) => problemMarkdown(p, i, settings))].join('\n\n') + '\n';
}

export function problemMarkdown(p: ProblemState, index: number, settings: ContestSettings): string {
  const parts = [`## Bài ${index + 1}. ${p.title} (${p.code})`, `*${ioLine(p, settings.ioMode).replace('\n', ' · ').replace(/\*/g, '\\*')}*`];
  if (p.statement.trim()) parts.push(p.statement.trim());
  for (const field of ['inputFormat', 'outputFormat', 'constraints'] as const) {
    if (p[field].trim()) parts.push(`### ${SECTION_TITLES[field]}\n\n${p[field].trim()}`);
  }
  const samples = p.tests.filter((t) => t.isSample);
  samples.forEach((t, i) => {
    const label = samples.length > 1 ? `Ví dụ ${i + 1}` : 'Ví dụ';
    const [inName, outName] = settings.ioMode === 'FILE' ? [`${p.code}.INP`, `${p.code}.OUT`] : ['Input', 'Output'];
    parts.push(`### ${label}\n\n**${inName}**\n\n\`\`\`\n${t.input.trimEnd()}\n\`\`\`\n\n**${outName}**\n\n\`\`\`\n${t.output.trimEnd()}\n\`\`\``);
  });
  return parts.join('\n\n');
}

const escapeCell = (s: string) => s.replace(/\|/g, '\\|');

/** A file name safe on Windows (where Themis runs), keeping Vietnamese letters. */
export function safeFileName(name: string, extension: string): string {
  const base = name.replace(/[\\/:*?"<>|\u0000-\u001f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80) || 'bo-de';
  return `${base}${extension}`;
}
