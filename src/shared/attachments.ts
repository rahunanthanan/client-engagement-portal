/**
 * Client-side attachment checks give fast feedback only. The server re-validates type, size and
 * content (and in production runs malware scanning before a file is usable: `scanStatus`).
 */
const EXTENSIONS: Record<string, string[]> = {
  'application/pdf': ['.pdf'],
  'image/png': ['.png'],
  'image/jpeg': ['.jpg', '.jpeg'],
};

export interface AttachmentConstraints {
  accept: ReadonlyArray<string>;
  maxSizeMb: number;
}

export function checkAttachment(file: Pick<File, 'name' | 'size' | 'type'>, constraints: AttachmentConstraints): string | undefined {
  const lower = file.name.toLowerCase();
  const allowedExt = constraints.accept.flatMap((type) => EXTENSIONS[type] ?? []);
  if (!constraints.accept.includes(file.type) || !allowedExt.some((ext) => lower.endsWith(ext))) {
    return `"${sanitizeFileName(file.name)}" is not an allowed file type. Allowed: ${allowedExt.join(', ')}.`;
  }
  if (file.size === 0) return `"${sanitizeFileName(file.name)}" is empty.`;
  if (file.size > constraints.maxSizeMb * 1024 * 1024) {
    return `"${sanitizeFileName(file.name)}" is larger than ${constraints.maxSizeMb} MB.`;
  }
  return undefined;
}

/** Display-safe file name: strips paths and control characters, limits length. */
export function sanitizeFileName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? 'file';
  // eslint-disable-next-line no-control-regex
  const cleaned = base.replace(/[\u0000-\u001f\u007f<>:"|?*]/g, '_').trim();
  return cleaned.length > 80 ? `${cleaned.slice(0, 77)}...` : cleaned || 'file';
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
