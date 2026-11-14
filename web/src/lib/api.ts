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

export interface MuscleGroup {
  id: number;
  nama: string;
}

export interface PlanDayOption {
  id: number;
  planId: number;
  planNama: string;
  weekNumber: number | null;
  label: string;
  urutan: number;
}

export interface TopSet {
  berat: number | null;
  reps: number | null;
}

export interface LastSummary {
  session: { id: number; tanggal: string; catatan: string } | null;
  daysAgo: number | null;
  muscles: MuscleGroup[];
  exercises: { namaExercise: string; topSet: TopSet | null }[];
}

export interface SessionSet {
  id: number;
  sessionExerciseId: number;
  setNumber: number;
  berat: number | null;
  reps: number | null;
}

export interface SessionExercise {
  id: number;
  sessionId: number;
  namaExercise: string;
  urutan: number;
  sets: SessionSet[];
}

export interface Session {
  id: number;
  clientId: number;
  tanggal: string;
  planDayId: number | null;
  catatan: string;
  createdAt: string;
  updatedAt: string;
  muscles: MuscleGroup[];
  exercises: SessionExercise[];
}

export interface NewSession {
  tanggal: string;
  planDayId: number | null;
  catatan: string;
  muscleGroupIds: number[];
  exercises: { namaExercise: string; sets: { berat: number; reps: number }[] }[];
}

export interface NewClient {
  nama: string;
  beratBadan: number | null;
  catatan?: string;
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

  clients: () => request<Client[]>('/api/clients'),

  client: (id: number) => request<Client>(`/api/clients/${id}`),

  createClient: (payload: NewClient) =>
    request<Client>('/api/clients', { method: 'POST', body: JSON.stringify(payload) }),

  updateClient: (id: number, payload: NewClient) =>
    request<Client>(`/api/clients/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload)
    }),

  muscleGroups: () => request<MuscleGroup[]>('/api/muscle-groups'),

  clientPlanDays: (id: number) => request<PlanDayOption[]>(`/api/clients/${id}/plan-days`),

  lastSummary: (id: number) => request<LastSummary>(`/api/clients/${id}/last-summary`),

  sessions: (id: number) => request<Session[]>(`/api/clients/${id}/sessions`),

  session: (id: number) => request<Session>(`/api/sessions/${id}`),

  createSession: (id: number, payload: NewSession) =>
    request<Session>(`/api/clients/${id}/sessions`, {
      method: 'POST',
      body: JSON.stringify(payload)
    }),

  updateSession: (id: number, payload: NewSession) =>
    request<Session>(`/api/sessions/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload)
    }),

  deleteSession: (id: number) =>
    request<{ ok: boolean }>(`/api/sessions/${id}`, { method: 'DELETE' })
};
