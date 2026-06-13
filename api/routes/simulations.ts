import { Router, Request, Response } from 'express';
import { createStore } from '../storage/fileStore.js';
import { runMonteCarloSimulationAsync } from '../../shared/monteCarlo.js';
import type { SimulationResult, Variable, RunSimulationDto, Project, SimulationJob } from '../../shared/types.js';
import { v4 as uuidv4 } from 'uuid';

const router = Router();
const simulationsStore = createStore<SimulationResult>('simulations');
const variablesStore = createStore<Variable>('variables');
const projectsStore = createStore<Project>('projects');

class SimulationQueue {
  private jobs: Map<string, SimulationJob> = new Map();
  private order: string[] = [];
  private processing = false;
  private controllers: Map<string, AbortController> = new Map();
  private sseClients: Set<Response> = new Set();

  enqueue(projectId: string, dto: RunSimulationDto): SimulationJob {
    const job: SimulationJob = {
      id: uuidv4(),
      projectId,
      iterations: Math.max(100, Math.min(100000, Number(dto.iterations) || 10000)),
      threshold: Number(dto.threshold) ?? 0,
      runName: dto.runName,
      status: 'queued',
      progress: 0,
    };
    this.jobs.set(job.id, job);
    this.order.push(job.id);
    this.broadcast('job-queued', job);
    this.processNext();
    return this.getJobSnapshot(job.id)!;
  }

  cancel(jobId: string): SimulationJob | null {
    const job = this.jobs.get(jobId);
    if (!job) return null;
    if (job.status === 'completed' || job.status === 'failed' || job.status === 'cancelled') return null;

    if (job.status === 'running') {
      const ctrl = this.controllers.get(jobId);
      if (ctrl) ctrl.abort();
    }

    job.status = 'cancelled';
    job.completedAt = new Date().toISOString();
    this.broadcast('job-cancelled', job);
    return this.getJobSnapshot(job.id);
  }

  getJobs(projectId: string): SimulationJob[] {
    const result: SimulationJob[] = [];
    for (const id of this.order) {
      const job = this.jobs.get(id);
      if (job && job.projectId === projectId) {
        result.push(this.getJobSnapshot(id)!);
      }
    }
    return result;
  }

  getJob(jobId: string): SimulationJob | null {
    return this.getJobSnapshot(jobId);
  }

  addSSEClient(res: Response): void {
    this.sseClients.add(res);
    res.on('close', () => {
      this.sseClients.delete(res);
    });
  }

  removeCompletedJobs(projectId: string): void {
    for (const [id, job] of this.jobs) {
      if (job.projectId === projectId && (job.status === 'completed' || job.status === 'failed' || job.status === 'cancelled')) {
        this.jobs.delete(id);
        this.order = this.order.filter(oid => oid !== id);
      }
    }
  }

  private getJobSnapshot(jobId: string): SimulationJob | null {
    const job = this.jobs.get(jobId);
    if (!job) return null;
    return { ...job };
  }

  private async processNext(): Promise<void> {
    if (this.processing) return;

    const nextId = this.order.find(id => {
      const job = this.jobs.get(id);
      return job && job.status === 'queued';
    });

    if (!nextId) return;

    this.processing = true;
    const job = this.jobs.get(nextId)!;
    const controller = new AbortController();
    this.controllers.set(job.id, controller);

    job.status = 'running';
    job.startedAt = new Date().toISOString();
    job.progress = 0;
    this.broadcast('job-started', job);

    const variables = variablesStore.filter(v => v.projectId === job.projectId);
    const startTime = Date.now();

    try {
      const result = await runMonteCarloSimulationAsync(job.projectId, variables, {
        iterations: job.iterations,
        threshold: job.threshold,
        runName: job.runName,
        signal: controller.signal,
        onProgress: (progress: number) => {
          const elapsed = Date.now() - startTime;
          const estimatedTotal = progress > 0 ? (elapsed / progress) * 100 : 0;
          job.progress = progress;
          job.elapsedMs = elapsed;
          job.estimatedRemainingMs = Math.max(0, Math.round(estimatedTotal - elapsed));
          this.broadcast('job-progress', this.getJobSnapshot(job.id)!);
        },
      });

      job.status = 'completed';
      job.progress = 100;
      job.completedAt = new Date().toISOString();
      job.elapsedMs = Date.now() - startTime;
      job.estimatedRemainingMs = 0;
      job.result = result;

      projectsStore.update(job.projectId, { updatedAt: new Date().toISOString() });
      simulationsStore.create(result);

      this.broadcast('job-completed', this.getJobSnapshot(job.id)!);
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        job.status = 'cancelled';
        job.completedAt = new Date().toISOString();
        this.broadcast('job-cancelled', this.getJobSnapshot(job.id)!);
      } else {
        job.status = 'failed';
        job.error = err?.message || '模拟执行失败';
        job.completedAt = new Date().toISOString();
        this.broadcast('job-failed', this.getJobSnapshot(job.id)!);
      }
    } finally {
      this.controllers.delete(job.id);
      this.processing = false;
      this.processNext();
    }
  }

  private broadcast(event: string, data: SimulationJob): void {
    const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const client of this.sseClients) {
      try {
        client.write(payload);
      } catch {}
    }
  }
}

const queue = new SimulationQueue();

router.get('/queue/events', (req: Request, res: Response) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.write(`event: connected\ndata: {}\n\n`);
  queue.addSSEClient(res);
});

router.get('/queue/:projectId', (req: Request, res: Response) => {
  const jobs = queue.getJobs(req.params.projectId);
  res.json(jobs);
});

router.delete('/queue/clear/:projectId', (req: Request, res: Response) => {
  queue.removeCompletedJobs(req.params.projectId);
  res.json({ success: true });
});

router.delete('/queue/job/:jobId', (req: Request, res: Response) => {
  const job = queue.cancel(req.params.jobId);
  if (!job) {
    res.status(404).json({ error: '任务不存在或无法取消' });
    return;
  }
  res.json({ success: true, job });
});

router.get('/project/:projectId', (req: Request, res: Response) => {
  const projectId = req.params.projectId;
  const sims = simulationsStore
    .filter(s => s.projectId === projectId)
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  res.json(sims);
});

router.get('/:id', (req: Request, res: Response) => {
  const sim = simulationsStore.getById(req.params.id);
  if (!sim) {
    res.status(404).json({ error: '模拟结果不存在' });
    return;
  }
  res.json(sim);
});

router.post('/project/:projectId', (req: Request, res: Response) => {
  const projectId = req.params.projectId;
  const project = projectsStore.getById(projectId);
  if (!project) {
    res.status(404).json({ error: '项目不存在' });
    return;
  }

  const variables = variablesStore.filter(v => v.projectId === projectId);
  if (variables.length === 0) {
    res.status(400).json({ error: '请先添加至少一个变量' });
    return;
  }

  const dto = req.body as RunSimulationDto;
  const job = queue.enqueue(projectId, dto);
  res.status(201).json(job);
});

router.delete('/:id', (req: Request, res: Response) => {
  const existing = simulationsStore.getById(req.params.id);
  if (!existing) {
    res.status(404).json({ error: '模拟结果不存在' });
    return;
  }

  simulationsStore.delete(req.params.id);
  res.json({ success: true });
});

export default router;
