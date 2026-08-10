import type {
  ContactDto,
  ProjectDetailDto,
  ProjectListItemDto,
  StageDefinitionDto,
  UserDto,
} from '../shared/types';

/** Thrown for any non-2xx response, carrying the server's message. */
export class ApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api${path}`, {
    ...init,
    headers: init?.body instanceof FormData ? undefined : { 'Content-Type': 'application/json' },
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new ApiError(body.error ?? 'Request failed', response.status);
  }
  return response.status === 204 ? (undefined as T) : ((await response.json()) as T);
}

const get = <T>(path: string) => request<T>(path);
const post = <T>(path: string, body?: unknown) =>
  request<T>(path, { method: 'POST', body: JSON.stringify(body ?? {}) });
const patch = <T>(path: string, body: unknown) =>
  request<T>(path, { method: 'PATCH', body: JSON.stringify(body) });
const put = <T>(path: string, body: unknown) =>
  request<T>(path, { method: 'PUT', body: JSON.stringify(body) });
const del = <T>(path: string) => request<T>(path, { method: 'DELETE' });

const qs = (params: Record<string, string | undefined>) => {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) if (value) search.set(key, value);
  const string = search.toString();
  return string ? `?${string}` : '';
};

export const api = {
  auth: {
    me: () => get<UserDto>('/auth/me'),
    login: (email: string, password: string) => post<UserDto>('/auth/login', { email, password }),
    logout: () => post<{ ok: true }>('/auth/logout'),
  },

  users: {
    list: () => get<UserDto[]>('/users'),
    create: (data: { name: string; email: string; password: string }) =>
      post<UserDto>('/users', data),
    update: (id: string, data: Partial<{ name: string; email: string; password: string; active: boolean }>) =>
      patch<UserDto>(`/users/${id}`, data),
  },

  contacts: {
    list: (search?: string, includeHidden?: boolean) =>
      get<ContactDto[]>(`/contacts${qs({ search, includeHidden: includeHidden ? 'true' : undefined })}`),
    get: (id: string) =>
      get<ContactDto & { projects: { id: string; caseNumber: string; propertyStreetAddress: string | null; role: string }[] }>(
        `/contacts/${id}`,
      ),
    create: (data: Partial<ContactDto> & { name: string }) => post<ContactDto>('/contacts', data),
    update: (id: string, data: Partial<ContactDto>) => patch<ContactDto>(`/contacts/${id}`, data),
  },

  config: {
    stages: (projectType?: string) => get<StageDefinitionDto[]>(`/config/stages${qs({ projectType })}`),
    createStage: (projectType: string, name: string) =>
      post<StageDefinitionDto>('/config/stages', { projectType, name }),
    updateStage: (id: string, data: { name?: string; sortOrder?: number; hidden?: boolean }) =>
      patch<StageDefinitionDto>(`/config/stages/${id}`, data),
    addField: (
      stageId: string,
      data: { label: string; type: string; required?: boolean; options?: string[] | null },
    ) => post<unknown>(`/config/stages/${stageId}/fields`, data),
    updateField: (
      id: string,
      data: Partial<{ label: string; required: boolean; hidden: boolean; sortOrder: number }>,
    ) => patch<unknown>(`/config/fields/${id}`, data),
  },

  projects: {
    list: (params: { status?: string; search?: string; type?: string }) =>
      get<ProjectListItemDto[]>(`/projects${qs(params)}`),
    get: (id: string) => get<ProjectDetailDto>(`/projects/${id}`),
    create: (data: Record<string, unknown>) => post<ProjectDetailDto>('/projects', data),
    update: (id: string, data: Record<string, unknown>) =>
      patch<ProjectDetailDto>(`/projects/${id}`, data),
    linkContact: (id: string, contactId: string, role: 'TENANT' | 'OCCUPANT') =>
      post<{ ok: true }>(`/projects/${id}/contacts`, { contactId, role }),
    unlinkContact: (id: string, contactId: string, role: string) =>
      del<{ ok: true }>(`/projects/${id}/contacts/${contactId}/${role}`),
    setFieldValue: (
      id: string,
      stageId: string,
      fieldId: string,
      value: Record<string, unknown>,
    ) => put<ProjectDetailDto>(`/projects/${id}/stages/${stageId}/fields/${fieldId}`, value),
    setStageComplete: (id: string, stageId: string, completed: boolean) =>
      post<{ ok: true }>(`/projects/${id}/stages/${stageId}/complete`, { completed }),
    close: (id: string, reason: string, detail?: string) =>
      post<{ ok: true }>(`/projects/${id}/close`, { reason, detail }),
    reopen: (id: string) => post<{ ok: true }>(`/projects/${id}/reopen`),
  },

  files: {
    upload: async (file: File) => {
      const form = new FormData();
      form.append('file', file);
      return request<{ id: string; filename: string; mimeType: string; size: number }>('/files', {
        method: 'POST',
        body: form,
      });
    },
    url: (id: string) => `/api/files/${id}`,
  },
};
