import { create } from 'zustand';
import type { Project, ProjectWithVariables, Variable, SimulationResult, SimulationJob } from '../../shared/types.js';

interface AppState {
  projects: Array<Project & { variableCount: number; simulationCount: number; lastSimulationAt: string | null }>;
  currentProject: ProjectWithVariables | null;
  simulations: SimulationResult[];
  currentSimulation: SimulationResult | null;
  queueJobs: SimulationJob[];
  loading: boolean;
  error: string | null;
  setLoading: (v: boolean) => void;
  setError: (v: string | null) => void;
  setProjects: (p: AppState['projects']) => void;
  setCurrentProject: (p: ProjectWithVariables | null) => void;
  addVariable: (v: Variable) => void;
  updateVariable: (v: Variable) => void;
  removeVariable: (id: string) => void;
  setSimulations: (s: SimulationResult[]) => void;
  setCurrentSimulation: (s: SimulationResult | null) => void;
  addSimulation: (s: SimulationResult) => void;
  removeSimulation: (id: string) => void;
  setQueueJobs: (jobs: SimulationJob[]) => void;
  updateQueueJob: (job: SimulationJob) => void;
  addQueueJob: (job: SimulationJob) => void;
  removeQueueJob: (id: string) => void;
  clearFinishedQueueJobs: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  projects: [],
  currentProject: null,
  simulations: [],
  currentSimulation: null,
  queueJobs: [],
  loading: false,
  error: null,
  setLoading: (v) => set({ loading: v }),
  setError: (v) => set({ error: v }),
  setProjects: (p) => set({ projects: p }),
  setCurrentProject: (p) => set({ currentProject: p, currentSimulation: null, simulations: [] }),
  addVariable: (v) =>
    set((s) => ({
      currentProject: s.currentProject ? { ...s.currentProject, variables: [...s.currentProject.variables, v] } : null,
    })),
  updateVariable: (v) =>
    set((s) => ({
      currentProject: s.currentProject
        ? { ...s.currentProject, variables: s.currentProject.variables.map((x) => (x.id === v.id ? v : x)) }
        : null,
    })),
  removeVariable: (id) =>
    set((s) => ({
      currentProject: s.currentProject
        ? { ...s.currentProject, variables: s.currentProject.variables.filter((x) => x.id !== id) }
        : null,
    })),
  setSimulations: (s) => set({ simulations: s, currentSimulation: s[0] || null }),
  setCurrentSimulation: (s) => set({ currentSimulation: s }),
  addSimulation: (s) =>
    set((st) => ({
      simulations: [s, ...st.simulations],
      currentSimulation: s,
    })),
  removeSimulation: (id) =>
    set((st) => ({
      simulations: st.simulations.filter((s) => s.id !== id),
      currentSimulation: st.currentSimulation?.id === id ? null : st.currentSimulation,
    })),
  setQueueJobs: (jobs) => set({ queueJobs: jobs }),
  updateQueueJob: (job) =>
    set((s) => {
      if (s.queueJobs.some(j => j.id === job.id)) {
        return { queueJobs: s.queueJobs.map(j => (j.id === job.id ? job : j)) };
      }
      return { queueJobs: [...s.queueJobs, job] };
    }),
  addQueueJob: (job) =>
    set((s) => {
      if (s.queueJobs.some(j => j.id === job.id)) {
        return { queueJobs: s.queueJobs.map(j => (j.id === job.id ? job : j)) };
      }
      return { queueJobs: [...s.queueJobs, job] };
    }),
  removeQueueJob: (id) =>
    set((s) => ({
      queueJobs: s.queueJobs.filter((j) => j.id !== id),
    })),
  clearFinishedQueueJobs: () =>
    set((s) => ({
      queueJobs: s.queueJobs.filter((j) => j.status === 'queued' || j.status === 'running'),
    })),
}));
