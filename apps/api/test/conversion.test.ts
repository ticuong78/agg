import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import JSZip from 'jszip';
import type { Requester } from '../src/shared/application/requester.js';
import { DomainError } from '../src/shared/domain/domain-error.js';
import { Conversion } from '../src/modules/conversion/domain/conversion.js';
import type { ProblemDraft } from '../src/modules/conversion/domain/problem-draft.js';
import { classifySource } from '../src/modules/conversion/domain/source-file.js';
import { TaskCode } from '../src/modules/conversion/domain/task-code.js';
import { ThemisContestExporter } from '../src/modules/conversion/infrastructure/exporters/contest.exporter.js';
import { latexToText } from '../src/modules/conversion/infrastructure/exporters/latex.js';
import { contestMarkdown } from '../src/modules/conversion/infrastructure/exporters/statement-markdown.js';
import { rtfToText } from '../src/modules/conversion/infrastructure/document-reader.js';

const guest: Requester = { kind: 'guest', visitorId: null, ipHash: 'h' };
const user = (id: string): Requester => ({ kind: 'user', userId: id, email: `${id}@x.vn`, role: 'USER', visitorId: null, ipHash: 'h' });

const draft = (over: Partial<ProblemDraft> = {}): ProblemDraft => ({
  title: 'Tổng hai số', statement: 'Tính a + b.', inputFormat: 'Hai số a, b.', outputFormat: 'Tổng.', constraints: '',
  timeLimitMs: 1000, memoryLimitMb: 256, samples: [{ input: '1 2', output: '3' }], warnings: [], ...over,
});

const ready = (drafts: ProblemDraft[] = [draft()], requester: Requester = guest) => {
  const { conversion, accessKey } = Conversion.start({ requester, sources: [{ name: 'de.pdf', kind: 'PDF', sizeBytes: 10, pages: 1 }], retentionDays: 1 });
  conversion.complete('BASIC', drafts, 10, 0);
  return { conversion, accessKey };
};

describe('TaskCode', () => {
  it('accepts Themis task names and normalises case', () => {
    assert.equal(TaskCode.of('bai1').value, 'BAI1');
    assert.throws(() => TaskCode.of('1BAI'));
    assert.throws(() => TaskCode.of('BÀI1'));
  });

  it('reads the task name stated in a statement', () => {
    assert.equal(TaskCode.statedIn('Dữ liệu vào từ tệp DAYSO.INP gồm'), 'DAYSO');
    assert.equal(TaskCode.statedIn('không có tệp'), null);
  });
});

describe('Conversion', () => {
  it('gives unique task codes, preferring the ones the document states', () => {
    const { conversion } = ready([
      draft({ inputFormat: 'Tệp SUM.INP gồm hai số' }),
      draft({ code: 'SUM' }),
      draft(),
    ]);
    assert.deepEqual(conversion.problemList.map((p) => p.code), ['SUM', 'BAI2', 'BAI3']);
  });

  it('keeps at most the tier limit of problems and says so', () => {
    const { conversion: c } = Conversion.start({ requester: guest, sources: [{ name: 'a.txt', kind: 'TEXT', sizeBytes: 1, pages: null }], retentionDays: 1 });
    c.complete('BASIC', [draft(), draft(), draft()], 2, 0);
    assert.equal(c.problemList.length, 2);
    assert.ok(c.problemList[0].openWarnings.some((w) => w.includes('3 bài')));
  });

  it('opens for its guest key or its owner only', () => {
    const { conversion, accessKey } = ready();
    assert.equal(conversion.canBeOpenedBy(guest, accessKey), true);
    assert.equal(conversion.canBeOpenedBy(guest, 'wrong'), false);
    assert.equal(conversion.canBeOpenedBy(user('u1'), null), false);
    conversion.claim('u1', accessKey, 30);
    assert.equal(conversion.canBeOpenedBy(user('u1'), null), true);
    assert.equal(conversion.canBeOpenedBy(guest, accessKey), false);
  });

  it('refuses duplicate codes and reports tasks without tests', () => {
    const { conversion } = ready([draft(), draft({ samples: [] })]);
    const [a, b] = conversion.problemList;
    assert.throws(() => conversion.updateProblem(b.id, { code: a.code }), (e: unknown) => e instanceof DomainError && e.code === 'problem.duplicate_code');
    assert.deepEqual(conversion.tasksWithoutTests(), [b.code]);
    conversion.addTests(b.id, [{ input: '5 5', output: '10', isSample: false, score: 1 }]);
    assert.deepEqual(conversion.tasksWithoutTests(), []);
  });

  it('only accepts a reorder that keeps every problem', () => {
    const { conversion } = ready([draft(), draft()]);
    const ids = conversion.problemList.map((p) => p.id);
    conversion.reorder([ids[1], ids[0]]);
    assert.deepEqual(conversion.problemList.map((p) => p.id), [ids[1], ids[0]]);
    assert.throws(() => conversion.reorder([ids[0]]));
  });

  it('locks the printed header below the school tier', () => {
    const { conversion } = ready();
    assert.throws(() => conversion.updateSettings({ header: 'THPT A' }, false));
    conversion.updateSettings({ header: 'THPT A' }, true);
    assert.equal(conversion.settings.header, 'THPT A');
  });
});

describe('Themis .contest export', () => {
  it('writes Tasks/<CODE>/TestNN/<CODE>.INP|OUT and an empty Contestants folder', async () => {
    const { conversion } = ready([draft({ code: 'SUM', samples: [{ input: '1 2\n', output: '3\n' }, { input: '4 5\n', output: '9\n' }] })]);
    const s = conversion.snapshot();
    const file = await new ThemisContestExporter().export({ settings: s.settings, problems: s.problems });
    const zip = await JSZip.loadAsync(file.content);
    const names = Object.keys(zip.files);
    assert.ok(names.includes('Tasks/SUM/Test01/SUM.INP'));
    assert.ok(names.includes('Tasks/SUM/Test02/SUM.OUT'));
    assert.ok(names.includes('Contestants/'));
    assert.ok(names.includes('DOC-TRUOC.txt'));
    assert.equal(await zip.file('Tasks/SUM/Test02/SUM.OUT')!.async('string'), '9\r\n');
    assert.ok(file.fileName.endsWith('.contest'));
  });
});

describe('Statements', () => {
  it('names the Themis files in file mode', () => {
    const { conversion } = ready([draft({ code: 'SUM' })]);
    const s = conversion.snapshot();
    const md = contestMarkdown(s.settings, s.problems);
    assert.match(md, /SUM\.INP/);
    assert.match(md, /SUM\.\\\*/);
  });

  it('turns LaTeX into readable text for Word and PDF', () => {
    assert.equal(latexToText('$1 \\le n \\le 10^6$'), '1 ≤ n ≤ 10⁶');
    assert.equal(latexToText('$a_i$ và $\\frac{a}{b}$'), 'aᵢ và a/b');
    assert.equal(latexToText('$10^{18}$'), '10¹⁸');
  });

  it('reads plain text out of RTF', () => {
    assert.equal(rtfToText('{\\rtf1\\ansi{\\fonttbl\\f0 Arial;}\\f0 B\\u224?i 1\\par T\\u7893?ng}'), 'Arial;Bài 1\nTổng');
  });
});

describe('Source files', () => {
  it('checks the bytes, not only the extension', () => {
    assert.equal(classifySource({ name: 'de.pdf', buffer: Buffer.from('%PDF-1.7 ...') }), 'PDF');
    assert.throws(() => classifySource({ name: 'de.pdf', buffer: Buffer.from('hello') }), (e: unknown) => e instanceof DomainError && e.code === 'source.invalid');
    assert.throws(() => classifySource({ name: 'de.doc', buffer: Buffer.from('x') }), (e: unknown) => e instanceof DomainError && e.code === 'source.legacy_doc');
    assert.equal(classifySource({ name: 'anh.png', buffer: Buffer.from('89504e470d0a1a0a0000', 'hex') }), 'IMAGE');
    assert.equal(classifySource({ name: 'de.txt', buffer: Buffer.from('Bài 1') }), 'TEXT');
    assert.throws(() => classifySource({ name: 'de.exe', buffer: Buffer.from('MZ') }));
  });
});
