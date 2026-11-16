import type { IoMode } from '@agg/contracts';
import { assert } from '../../../shared/domain/domain-error.js';

export interface ContestSettings {
  name: string;
  ioMode: IoMode;
  header: string;
  includeStatements: boolean;
}

export function defaultSettings(name: string): ContestSettings {
  // Themis contests traditionally read BAI1.INP and write BAI1.OUT.
  return { name: name.slice(0, 120) || 'Bộ đề', ioMode: 'FILE', header: '', includeStatements: true };
}

export function changeSettings(current: ContestSettings, changes: Partial<ContestSettings>, brandingAllowed: boolean): ContestSettings {
  const next = { ...current };
  if (changes.name !== undefined) {
    const name = changes.name.trim();
    assert(name.length >= 1 && name.length <= 120, 'settings.invalid_name', 'Tên bộ đề phải từ 1 đến 120 ký tự.');
    next.name = name;
  }
  if (changes.ioMode !== undefined) next.ioMode = changes.ioMode;
  if (changes.includeStatements !== undefined) next.includeStatements = changes.includeStatements;
  if (changes.header !== undefined) {
    const header = changes.header.trim();
    assert(!header || brandingAllowed, 'settings.branding_locked', 'In tên trường lên đề có từ gói Tổ chuyên môn.');
    assert(header.length <= 200, 'settings.invalid_header', 'Tiêu đề in trên đề tối đa 200 ký tự.');
    next.header = header;
  }
  return next;
}
