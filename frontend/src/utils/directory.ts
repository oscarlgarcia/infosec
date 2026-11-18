/**
 * Helpers shared by the client and request directory forms.
 *
 * Users often paste paths copied from Explorer with surrounding quotes,
 * forward slashes, or as `file:///C:/...` URLs. Normalizing them here avoids
 * avoidable 400 responses from the backend validator.
 */

export function normalizeLocalPath(value: string): string {
  let path = value.trim().replace(/^["'<]+|["'>]+$/g, '');
  if (!path) return '';
  const fileUrl = path.match(/^file:\/\/\/([A-Za-z]:\/.*)$/i);
  if (fileUrl) path = fileUrl[1];
  if (/^\/[A-Za-z]:\//.test(path)) path = path.slice(1);
  if (/^[A-Za-z]:\//.test(path)) path = path.replace(/\//g, '\\');
  return path;
}

export function isWindowsPath(value: string): boolean {
  return /^(?:[A-Za-z]:\\|\\\\)/.test(value);
}

/** Copies text using the Clipboard API with an execCommand fallback. */
export async function copyText(value: string): Promise<boolean> {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(value);
      return true;
    } catch {
      // Fall back to execCommand when the Clipboard API is unavailable or denied.
    }
  }

  try {
    const textarea = document.createElement('textarea');
    textarea.value = value;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.top = '-1000px';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    const copied = document.execCommand('copy');
    document.body.removeChild(textarea);
    return copied;
  } catch {
    return false;
  }
}

const FIELD_LABELS: Record<string, { es: string; en: string }> = {
  localPath: { es: 'ruta del directorio', en: 'directory path' },
};

const ERROR_MESSAGES: Record<string, { es: string; en: string }> = {
  'Local path is required': {
    es: 'La ruta del directorio es obligatoria.',
    en: 'The directory path is required.',
  },
  'Local path must be a Windows path (C:\\... or \\\\server\\...)': {
    es: 'La ruta debe ser una ruta de Windows (C:\\... o \\\\servidor\\...).',
    en: 'The path must be a Windows path (C:\\... or \\\\server\\...).',
  },
};

export function formatDirectoryError(err: any, language: string): string {
  const isEs = language === 'es';
  const fieldErrors = err?.details?.fieldErrors;
  if (fieldErrors && typeof fieldErrors === 'object') {
    for (const [field, raw] of Object.entries(fieldErrors)) {
      const messages = Array.isArray(raw) ? raw : [];
      const message = String(messages[0] || '').trim();
      if (!message) continue;
      const label = FIELD_LABELS[field]?.[isEs ? 'es' : 'en'] || field;
      const translated = ERROR_MESSAGES[message]?.[isEs ? 'es' : 'en'] || message;
      return isEs
        ? `No se pudo guardar el directorio (${label}): ${translated}`
        : `Could not save the directory (${label}): ${translated}`;
    }
  }
  const message = err?.message || 'Error';
  return ERROR_MESSAGES[message]?.[isEs ? 'es' : 'en'] || message;
}
