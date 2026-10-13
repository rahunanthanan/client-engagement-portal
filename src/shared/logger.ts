/**
 * Redacting logger. Application code never calls `console` directly (enforced by ESLint).
 *
 * - Only structured metadata is logged, never form values.
 * - Keys that look sensitive are replaced with "[redacted]" even if passed by mistake.
 * - In production builds, debug/info are dropped; warnings/errors would be forwarded to an
 *   approved telemetry endpoint (not included in this sample).
 */
import { env } from '@/app/env';

type Level = 'debug' | 'info' | 'warn' | 'error';

const SENSITIVE_KEY = /token|password|secret|authorization|cookie|taxid|tin|dateofbirth|dob|passport|values|email|phone|address/i;

export function redact(meta: Record<string, unknown> | undefined): Record<string, unknown> | undefined {
  if (!meta) return undefined;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(meta)) {
    if (SENSITIVE_KEY.test(key)) out[key] = '[redacted]';
    else if (value && typeof value === 'object' && !Array.isArray(value)) out[key] = redact(value as Record<string, unknown>);
    else out[key] = value;
  }
  return out;
}

const isTest = typeof process !== 'undefined' && process.env?.NODE_ENV === 'test';

function write(level: Level, message: string, meta?: Record<string, unknown>): void {
  if (isTest) return;
  if (!env.isDev && (level === 'debug' || level === 'info')) return;
  const safe = redact(meta);
  console[level](`[cep] ${message}`, safe ?? '');
}

export const logger = {
  debug: (message: string, meta?: Record<string, unknown>) => write('debug', message, meta),
  info: (message: string, meta?: Record<string, unknown>) => write('info', message, meta),
  warn: (message: string, meta?: Record<string, unknown>) => write('warn', message, meta),
  error: (message: string, meta?: Record<string, unknown>) => write('error', message, meta),
};
