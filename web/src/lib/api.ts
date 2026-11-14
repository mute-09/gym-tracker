export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

export interface Trainer {
  id: number;
  username: string;
  isAdmin: boolean;
}

export interface MeResponse {
  trainer: Trainer;
}

export interface Client {
  id: number;
  nama: string;
  beratBadan: number | null;
  catatan: string;
  createdAt: string;
  updatedAt: string;
  lastSessionDate: string | null;
  daysAgo: number | null;
}

type UnauthorizedHandler = () => void;

let unauthorizedHandler: UnauthorizedHandler | null = null;

export function setUnauthorizedHandler(handler: UnauthorizedHandler | null) {
  unauthorizedHandler = handler;
}

interface RequestOptions {
  silent?: boolean;
}

async function request<T>(
  path: string,
  init: RequestInit = {},
  options: RequestOptions = {}
): Promise<T> {
  const headers: Record<string, string> = { ...(init.headers as Record<string, string> | undefined) };
  if (init.body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  let response: Response;
  try {
    response = await fetch(path, { ...init, headers, credentials: 'include' });
  } catch {
    throw new ApiError('Tidak bisa menghubungi server', 0);
  }

  if (!response.ok) {
    let message = `HTTP ${response.status}`;
    try {
      const data = (await response.json()) as { error?: string };
      if (data.error) message = data.error;
    } catch {
      // response bukan JSON
    }

    if (response.status === 401 && !options.silent) {
      unauthorizedHandler?.();
    }

    throw new ApiError(message, response.status);
  }

  return (await response.json()) as T;
}

export const api = {
  me: (silent = false) => request<MeResponse>('/api/me', {}, { silent }),

  login: (username: string, password: string) =>
    request<MeResponse>(
      '/api/auth/login',
      { method: 'POST', body: JSON.stringify({ username, password }) },
      { silent: true }
    ),

  logout: () => request<{ ok: boolean }>('/api/auth/logout', { method: 'POST' }, { silent: true }),

  clients: () => request<Client[]>('/api/clients')
};
