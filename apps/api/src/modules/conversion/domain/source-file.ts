import type { SourceKind } from '@agg/contracts';
import { DomainError } from '../../../shared/domain/domain-error.js';

/** An uploaded file as the domain sees it. The bytes are used once, then dropped: originals are never stored. */
export interface SourceFile {
  name: string;
  buffer: Buffer;
}

const ZIP = Buffer.from('PK\u0003\u0004', 'latin1');
const PDF = Buffer.from('%PDF-', 'latin1');
const OLE = Buffer.from('d0cf11e0a1b11ae1', 'hex');

const TEXT_EXTENSIONS = ['txt', 'md', 'markdown', 'text', 'tex', 'html', 'htm', 'rtf', 'csv'];
const IMAGE_SIGNATURES: [string, (b: Buffer) => boolean][] = [
  ['image/png', (b) => b.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex'))],
  ['image/jpeg', (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff],
  ['image/gif', (b) => b.subarray(0, 4).toString('latin1') === 'GIF8'],
  ['image/webp', (b) => b.subarray(0, 4).toString('latin1') === 'RIFF' && b.subarray(8, 12).toString('latin1') === 'WEBP'],
];
const IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'gif', 'webp'];

export const SUPPORTED_EXTENSIONS = ['pdf', 'docx', ...TEXT_EXTENSIONS, ...IMAGE_EXTENSIONS];

const extensionOf = (name: string) => name.toLowerCase().split('.').pop() ?? '';

/** Media type of an image file, from its first bytes. */
export function imageMediaType(buffer: Buffer): string | null {
  return IMAGE_SIGNATURES.find(([, test]) => test(buffer))?.[0] ?? null;
}

/**
 * What an upload is. The extension says what the file claims to be; the first bytes say what it is,
 * so a renamed file gets a clear message instead of an empty result.
 */
export function classifySource(file: SourceFile): SourceKind {
  const ext = extensionOf(file.name);
  const head = file.buffer.subarray(0, 1024);
  if (file.buffer.length === 0) throw DomainError.validation('source.empty', `Tệp "${file.name}" rỗng.`);

  if (ext === 'pdf') {
    if (!head.includes(PDF)) throw mismatch(file.name, 'PDF');
    return 'PDF';
  }
  if (ext === 'docx') {
    if (!head.subarray(0, 4).equals(ZIP)) throw mismatch(file.name, 'Word (.docx)');
    return 'DOCX';
  }
  if (ext === 'doc' || head.subarray(0, 8).equals(OLE)) {
    throw DomainError.validation('source.legacy_doc',
      `"${file.name}" là định dạng Word cũ (.doc). Hãy mở bằng Word và lưu lại dạng .docx hoặc PDF.`);
  }
  if (IMAGE_EXTENSIONS.includes(ext)) {
    if (!imageMediaType(file.buffer)) throw mismatch(file.name, 'ảnh PNG/JPG/GIF/WEBP');
    return 'IMAGE';
  }
  if (TEXT_EXTENSIONS.includes(ext)) {
    // A text file has no NUL bytes; a binary renamed to .txt does.
    if (head.includes(0)) throw mismatch(file.name, 'văn bản');
    return 'TEXT';
  }
  throw DomainError.validation('source.unsupported',
    `Chưa hỗ trợ tệp "${file.name}". Hãy dùng PDF, Word (.docx), văn bản (.txt, .md, .html, .rtf) hoặc ảnh (PNG, JPG).`);
}

function mismatch(name: string, expected: string): DomainError {
  return DomainError.validation('source.invalid',
    `Nội dung tệp "${name}" không phải ${expected} hợp lệ (không khớp đuôi tệp). Hãy lưu lại đúng định dạng rồi tải lên lần nữa.`);
}
