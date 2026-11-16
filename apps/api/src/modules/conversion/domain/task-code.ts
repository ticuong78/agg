import { assert } from '../../../shared/domain/domain-error.js';
import { fold } from './exam-parser.js';

const PATTERN = /^[A-Z][A-Z0-9_]{0,15}$/;

/**
 * Value object: the Themis task name. It names the task folder and the test files (BAI1 -> BAI1.INP, BAI1.OUT),
 * and the file contestants submit (BAI1.CPP), so it must be a plain identifier.
 */
export class TaskCode {
  private constructor(readonly value: string) {}

  static of(raw: string): TaskCode {
    const value = raw.trim().toUpperCase();
    assert(PATTERN.test(value), 'problem.invalid_code',
      'Mã bài chỉ gồm chữ cái không dấu, chữ số và dấu gạch dưới, bắt đầu bằng chữ cái, tối đa 16 ký tự (ví dụ BAI1, DAYSO).');
    return new TaskCode(value);
  }

  /** Best-effort code from free text ("Dãy số đẹp" -> DAYSODEP); null when nothing usable is left. */
  static suggestFrom(text: string): string | null {
    const ascii = fold(text).toUpperCase().replace(/[^A-Z0-9]+/g, '').slice(0, 12);
    return /^[A-Z]/.test(ascii) ? ascii : null;
  }

  /** Task name stated by the document itself: BAI1.INP, "SUM.OUT", "Tên chương trình: DAYSO.CPP". */
  static statedIn(text: string): string | null {
    const match = /(?<![\p{L}\d_])([A-Za-z][A-Za-z0-9_]{0,15})\.(?:inp|out|cpp|pas|py)(?![\p{L}\d])/iu.exec(text);
    return match ? match[1].toUpperCase() : null;
  }
}
