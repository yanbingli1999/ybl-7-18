import type {
  Project, ProjectWithVariables, Variable, SimulationResult, CompareRecord,
  CreateProjectDto, UpdateProjectDto, CreateVariableDto, UpdateVariableDto,
  RunSimulationDto, CreateCompareDto, SimulationJob,
} from '../../shared/types.js';

const API_BASE = '/api';

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { error?: string }).error || `请求失败 (${res.status})`);
  }
  return data as T;
}

export type SSEEventHandler = (event: string, data: SimulationJob) => void;

export function createSSEConnection(onEvent: SSEEventHandler): EventSource {
  const es = new EventSource(`${API_BASE}/simulations/queue/events`);
  const eventTypes = ['job-queued', 'job-started', 'job-progress', 'job-completed', 'job-cancelled', 'job-failed'];
  eventTypes.forEach(type => {
    es.addEventListener(type, (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data) as SimulationJob;
        onEvent(type, data);
      } catch {}
    });
  });
  return es;
}

export const api = {
  projects: {
    list: () => request<Array<Project & { variableCount: number; simulationCount: number; lastSimulationAt: string | null }>>('/projects'),
    get: (id: string) => request<ProjectWithVariables>(`/projects/${id}`),
    create: (dto: CreateProjectDto) => request<Project>('/projects', { method: 'POST', body: JSON.stringify(dto) }),
    update: (id: string, dto: UpdateProjectDto) => request<Project>(`/projects/${id}`, { method: 'PUT', body: JSON.stringify(dto) }),
    remove: (id: string) => request<{ success: boolean }>(`/projects/${id}`, { method: 'DELETE' }),
    addVariable: (projectId: string, dto: CreateVariableDto) =>
      request<Variable>(`/projects/${projectId}/variables`, { method: 'POST', body: JSON.stringify(dto) }),
  },
  variables: {
    update: (id: string, dto: UpdateVariableDto) =>
      request<Variable>(`/variables/${id}`, { method: 'PUT', body: JSON.stringify(dto) }),
    remove: (id: string) => request<{ success: boolean }>(`/variables/${id}`, { method: 'DELETE' }),
  },
  simulations: {
    listByProject: (projectId: string) => request<SimulationResult[]>(`/simulations/project/${projectId}`),
    get: (id: string) => request<SimulationResult>(`/simulations/${id}`),
    run: (projectId: string, dto: RunSimulationDto) =>
      request<SimulationJob>(`/simulations/project/${projectId}`, { method: 'POST', body: JSON.stringify(dto) }),
    remove: (id: string) => request<{ success: boolean }>(`/simulations/${id}`, { method: 'DELETE' }),
    queue: {
      list: (projectId: string) => request<SimulationJob[]>(`/simulations/queue/${projectId}`),
      cancel: (jobId: string) => request<{ success: boolean; job: SimulationJob }>(`/simulations/queue/job/${jobId}`, { method: 'DELETE' }),
      clearFinished: (projectId: string) => request<{ success: boolean }>(`/simulations/queue/clear/${projectId}`, { method: 'DELETE' }),
    },
  },
  compare: {
    listByProject: (projectId: string) => request<CompareRecord[]>(`/compare/project/${projectId}`),
    get: (id: string) => request<CompareRecord & { simulations: SimulationResult[] }>(`/compare/${id}`),
    create: (projectId: string, dto: CreateCompareDto) =>
      request<CompareRecord>(`/compare/project/${projectId}`, { method: 'POST', body: JSON.stringify(dto) }),
    remove: (id: string) => request<{ success: boolean }>(`/compare/${id}`, { method: 'DELETE' }),
  },
};
