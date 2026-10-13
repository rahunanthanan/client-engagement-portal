import { safeReturnTo } from '@/auth/authSlice';
import { checkAttachment, sanitizeFileName } from '../attachments';
import { latestOnly } from '../latestOnly';
import { redact } from '../logger';

describe('safeReturnTo (open-redirect protection)', () => {
  it.each([
    ['/workspace/REQ-2026-000091', '/workspace/REQ-2026-000091'],
    ['/tasks?x=1', '/tasks?x=1'],
    ['https://evil.example/', '/'],
    ['//evil.example/path', '/'],
    ['/\\evil.example', '/'],
    ['javascript:alert(1)', '/'],
    [null, '/'],
  ])('%s -> %s', (input, expected) => {
    expect(safeReturnTo(input)).toBe(expected);
  });
});

describe('attachment constraints', () => {
  const constraints = { accept: ['application/pdf', 'image/png'], maxSizeMb: 1 };
  it('accepts allowed type and size', () => {
    expect(checkAttachment({ name: 'cert.pdf', size: 1000, type: 'application/pdf' }, constraints)).toBeUndefined();
  });
  it('rejects mismatched extension, wrong type, empty and oversized files', () => {
    expect(checkAttachment({ name: 'cert.pdf.exe', size: 10, type: 'application/pdf' }, constraints)).toMatch(/not an allowed file type/);
    expect(checkAttachment({ name: 'a.html', size: 10, type: 'text/html' }, constraints)).toMatch(/not an allowed/);
    expect(checkAttachment({ name: 'a.pdf', size: 0, type: 'application/pdf' }, constraints)).toMatch(/empty/);
    expect(checkAttachment({ name: 'a.png', size: 2 * 1024 * 1024, type: 'image/png' }, constraints)).toMatch(/larger than 1 MB/);
  });
  it('sanitises file names for display', () => {
    expect(sanitizeFileName('C:\\temp\\<script>.pdf')).toBe('_script_.pdf');
  });
});

describe('redacting logger', () => {
  it('redacts sensitive keys recursively', () => {
    expect(redact({ path: '/x', taxIdentificationNumber: 'A1', nested: { accessToken: 't', status: 500 }, values: { a: 1 } })).toEqual({
      path: '/x',
      taxIdentificationNumber: '[redacted]',
      nested: { accessToken: '[redacted]', status: 500 },
      values: '[redacted]',
    });
  });
});

describe('latestOnly (stale-response protection)', () => {
  it('only delivers the result of the most recent call', async () => {
    const resolvers: ((v: string) => void)[] = [];
    const search = latestOnly((q: string, _signal: AbortSignal) => new Promise<string>((resolve) => resolvers.push(() => resolve(q))));
    const first = search('ab');
    const second = search('abc');
    resolvers[1]!('abc');
    resolvers[0]!('ab'); // older response arrives last
    await expect(second).resolves.toEqual({ stale: false, value: 'abc' });
    await expect(first).resolves.toEqual({ stale: true });
  });
});
