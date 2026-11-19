import { parseAppMode } from '@agg/contracts';

/**
 * GD-3: true unless APP_MODE is exactly `full` (an invalid value already stopped startup in config/environment.ts).
 * The one place every reader of the mode goes through, so the guard, the exports and the AI client cannot drift.
 */
export const isMvpMode = (config: { get<T = string>(key: string): T | undefined }): boolean =>
  parseAppMode(config.get<string>('APP_MODE')) !== 'full';
