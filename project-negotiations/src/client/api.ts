import type {
  CaseBriefing,
  CaseSummary,
  DebriefReport,
  PreparationInput,
  SendMessageRequest,
  SendMessageResponse as SharedSendMessageResponse,
  SessionView,
  SkillSummary,
} from '@shared/types';

type SendMessageResponse = Omit<SharedSendMessageResponse, 'session'> & { session: SessionView };

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    ...init,
  });
  const text = await res.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error(`Unexpected response from ${path}`);
    }
  }
  if (!res.ok) {
    const message =
      data && typeof data === 'object' && 'error' in data && typeof (data as { error: unknown }).error === 'string'
        ? (data as { error: string }).error
        : `Request failed (${res.status})`;
    throw new Error(message);
  }
  return data as T;
}

export const api = {
  listCases: () => request<{ cases: CaseSummary[] }>('/api/cases'),
  getCase: (id: string) => request<{ case: CaseBriefing }>(`/api/cases/${encodeURIComponent(id)}`),
  createSession: (caseId: string) =>
    request<{ session: SessionView }>('/api/sessions', {
      method: 'POST',
      body: JSON.stringify({ caseId }),
    }),
  getSession: (id: string) => request<{ session: SessionView }>(`/api/sessions/${encodeURIComponent(id)}`),
  savePreparation: (id: string, preparation: PreparationInput) =>
    request<{ session: SessionView }>(`/api/sessions/${encodeURIComponent(id)}/preparation`, {
      method: 'POST',
      body: JSON.stringify({ preparation }),
    }),
  sendMessage: (id: string, input: SendMessageRequest) =>
    request<SendMessageResponse>(`/api/sessions/${encodeURIComponent(id)}/messages`, {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  walkAway: (id: string) =>
    request<SendMessageResponse>(`/api/sessions/${encodeURIComponent(id)}/walk-away`, { method: 'POST' }),
  finalize: (id: string) =>
    request<{ session: SessionView; debrief: DebriefReport }>(`/api/sessions/${encodeURIComponent(id)}/finalize`, {
      method: 'POST',
    }),
  getDebrief: (id: string) =>
    request<{ debrief: DebriefReport }>(`/api/sessions/${encodeURIComponent(id)}/debrief`),
  getSkills: () => request<{ skills: SkillSummary[] }>('/api/skills'),
};
