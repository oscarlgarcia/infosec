/**
 * Minimal typed HTTP client for the Request 360 frontend.
 *
 * All endpoints live under the `/api` prefix (see src/index.ts). The access
 * token is read from localStorage using the same key as AuthContext so plain
 * modules can call the API without React hooks.
 */

export const API_BASE = '/api';
const ACCESS_TOKEN_KEY = 'auth_access_token';

export class ApiError extends Error {
  status: number;
  code?: string;
  details?: any;
  duplicates?: any;

  constructor(message: string, status: number, options: { code?: string; details?: any; duplicates?: any } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = options.code;
    this.details = options.details;
    this.duplicates = options.duplicates;
  }
}

export interface RequestOptions extends Omit<RequestInit, 'body'> {
  /** Serialized as JSON and sets the content-type header. */
  json?: any;
  /** Raw body (FormData, string, Blob…). Ignored when `json` is provided. */
  body?: BodyInit | null;
  /** Appended to the query string, skipping null/undefined/empty values. */
  query?: Record<string, string | number | boolean | null | undefined>;
}

export function buildQuery(query?: RequestOptions['query']): string {
  if (!query) return '';
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === null || value === undefined || value === '') continue;
    params.append(key, String(value));
  }
  const serialized = params.toString();
  return serialized ? `?${serialized}` : '';
}

function resolveUrl(path: string, query?: RequestOptions['query']): string {
  const base = path.startsWith('/api') ? path : `${API_BASE}${path.startsWith('/') ? '' : '/'}${path}`;
  return `${base}${buildQuery(query)}`;
}

export function getAccessToken(): string | null {
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

export async function apiRequest<T = any>(path: string, options: RequestOptions = {}): Promise<T> {
  const { json, query, body, ...rest } = options;
  const headers = new Headers(rest.headers);
  const token = getAccessToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);

  let payload: BodyInit | null | undefined = body;
  if (json !== undefined) {
    headers.set('Content-Type', 'application/json');
    payload = JSON.stringify(json);
  }

  const response = await fetch(resolveUrl(path, query), {
    ...rest,
    headers,
    body: payload,
  });

  if (response.status === 204) return undefined as T;

  const contentType = response.headers.get('content-type') || '';
  const parsed = contentType.includes('application/json')
    ? await response.json().catch(() => null)
    : await response.text();

  if (!response.ok) {
    const errorBody = parsed && typeof parsed === 'object' ? (parsed.error || parsed) : null;
    const message =
      errorBody?.message ||
      (typeof parsed === 'string' && parsed) ||
      `Request failed with status ${response.status}`;
    throw new ApiError(message, response.status, {
      code: errorBody?.code,
      details: errorBody?.details,
      duplicates: errorBody?.duplicates,
    });
  }

  return parsed as T;
}

/** Downloads an authenticated file and triggers a browser save. */
export async function apiDownload(path: string, filename: string): Promise<void> {
  const headers = new Headers();
  const token = getAccessToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);
  const response = await fetch(resolveUrl(path), { headers });
  if (!response.ok) {
    throw new ApiError(`Download failed with status ${response.status}`, response.status);
  }
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

/** Opens an authenticated HTML/Markdown response in a new tab. */
export async function apiOpenAuthenticated(path: string): Promise<void> {
  const headers = new Headers();
  const token = getAccessToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);
  const response = await fetch(resolveUrl(path), { headers });
  if (!response.ok) {
    throw new ApiError(`Request failed with status ${response.status}`, response.status);
  }
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank', 'noopener');
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
