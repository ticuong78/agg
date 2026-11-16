import { Injectable } from '@nestjs/common';
import JSZip from 'jszip';
import { ContestExporter, type ExportedFile, type ExportModel } from '../../application/ports.js';
import type { ProblemState } from '../../domain/problem.js';
import { formatSeconds } from '../../domain/statement.js';
import { contestMarkdown, safeFileName } from './statement-markdown.js';

/**
 * Themis contest archive. A .contest file is a plain ZIP that Themis unpacks into its ThemisContest folder:
 *
 *   Tasks/<CODE>/Test01/<CODE>.INP, <CODE>.OUT    one folder per task, one sub-folder per test
 *   Contestants/                                  empty: contestants' submissions go here
 *
 * Next to it (outside Tasks, so Themis does not mistake them for tests) the archive carries the statements and a
 * read-me with the limits of each task. See docs/THEMIS-FORMAT.md for what is verified and what is not.
 */
@Injectable()
export class ThemisContestExporter extends ContestExporter {
  readonly format = 'contest' as const;

  async export({ settings, problems }: ExportModel): Promise<ExportedFile> {
    const zip = new JSZip();
    const tasks = zip.folder('Tasks')!;
    for (const problem of problems) {
      const task = tasks.folder(problem.code)!;
      const width = Math.max(2, String(problem.tests.length).length);
      problem.tests.forEach((test, i) => {
        const folder = task.folder(`Test${String(i + 1).padStart(width, '0')}`)!;
        folder.file(`${problem.code}.INP`, crlf(test.input));
        folder.file(`${problem.code}.OUT`, crlf(test.output));
      });
    }
    zip.folder('Contestants');
    if (settings.includeStatements) zip.file('DeBai.md', contestMarkdown(settings, problems));
    zip.file('DOC-TRUOC.txt', crlf(readMe(settings.name, problems)));

    const content = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE', compressionOptions: { level: 6 } });
    return { fileName: safeFileName(settings.name, '.contest'), mimeType: 'application/zip', content };
  }
}

/** Themis runs on Windows; test files with CRLF line ends behave the same in every compare mode. */
const crlf = (text: string) => text.replace(/\r?\n/g, '\r\n');

function readMe(name: string, problems: ProblemState[]): string {
  const rows = problems.map((p) => `- ${p.code}: ${p.title} | ${p.tests.length ? `${p.tests.length} test` : 'CHƯA CÓ TEST: hãy thêm trong Themis'} | ${formatSeconds(p.timeLimitMs)} giây | ${p.memoryLimitMb} MB`);
  return [
    `Bộ đề: ${name}`,
    '',
    'Cách dùng với Themis:',
    '1. Mở Themis, chọn mở tệp .contest này (hoặc giải nén rồi trỏ thư mục bài thi tới thư mục Tasks).',
    '2. Themis nhận mỗi thư mục trong Tasks là một bài, mỗi thư mục TestXX là một test.',
    '3. Kiểm tra giới hạn thời gian và bộ nhớ của từng bài theo bảng dưới đây.',
    '',
    'Danh sách bài:',
    ...rows,
    '',
    'Đề bài đầy đủ nằm trong tệp DeBai.md (nếu đã bật "Kèm đề bài").',
    '',
  ].join('\n');
}
