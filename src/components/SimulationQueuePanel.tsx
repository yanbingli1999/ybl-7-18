import { X, Play, Clock, Loader2, CheckCircle2, XCircle, AlertCircle, ListOrdered, Timer, Zap } from 'lucide-react';
import type { SimulationJob } from '../../shared/types.js';
import { formatNumber } from '../../shared/monteCarlo.js';

interface Props {
  jobs: SimulationJob[];
  onCancel: (jobId: string) => void;
  onDismiss: (jobId: string) => void;
  onClearFinished: () => void;
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}m ${remainingSeconds}s`;
}

function StatusBadge({ status }: { status: SimulationJob['status'] }) {
  const config: Record<SimulationJob['status'], { text: string; className: string }> = {
    queued: { text: '排队中', className: 'bg-monte-muted/20 text-monte-muted border-monte-muted/30' },
    running: { text: '运行中', className: 'bg-monte-accent/20 text-monte-accent border-monte-accent/50 animate-pulse-glow' },
    completed: { text: '已完成', className: 'bg-monte-safe/20 text-monte-safe border-monte-safe/40' },
    failed: { text: '失败', className: 'bg-monte-danger/20 text-monte-danger border-monte-danger/40' },
    cancelled: { text: '已取消', className: 'bg-monte-warn/20 text-monte-warn border-monte-warn/40' },
  };
  const { text, className } = config[status];
  return (
    <span className={`badge border ${className}`}>
      {status === 'running' && <Zap className="w-3 h-3 mr-1" />}
      {text}
    </span>
  );
}

export default function SimulationQueuePanel({ jobs, onCancel, onDismiss, onClearFinished }: Props) {
  const runningJob = jobs.find(j => j.status === 'running');
  const queuedJobs = jobs.filter(j => j.status === 'queued');
  const finishedJobs = jobs.filter(j => j.status === 'completed' || j.status === 'failed' || j.status === 'cancelled');
  const hasActive = runningJob || queuedJobs.length > 0;

  if (jobs.length === 0) return null;

  return (
    <div className="card border-monte-accent/20">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          <ListOrdered className="w-5 h-5 text-monte-accent" />
          运行队列
          {hasActive && (
            <span className="badge bg-monte-accent/20 text-monte-accent border border-monte-accent/30 ml-1 animate-pulse-glow">
              {queuedJobs.length + (runningJob ? 1 : 0)} 个任务
            </span>
          )}
        </h3>
        {finishedJobs.length > 0 && (
          <button onClick={onClearFinished} className="text-xs text-monte-muted hover:text-white transition-colors">
            清除已完成
          </button>
        )}
      </div>

      <div className="space-y-4">
        {runningJob && (
          <div className="p-5 rounded-xl bg-gradient-to-r from-monte-accent/15 via-monte-accent/5 to-monte-accent2/10 border-2 border-monte-accent/50 shadow-glow relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-monte-accent via-monte-accent2 to-monte-accent animate-pulse" />
            
            <div className="flex items-start justify-between gap-3 mb-4">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-monte-accent/20 flex items-center justify-center flex-shrink-0">
                  <Loader2 className="w-5 h-5 text-monte-accent animate-spin" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-base font-semibold text-white truncate">{runningJob.runName || '模拟运行'}</span>
                    <StatusBadge status="running" />
                  </div>
                  <div className="text-xs text-monte-muted">
                    {formatNumber(runningJob.iterations, 0)} 次迭代 · 阈值 {formatNumber(runningJob.threshold, 0)}
                  </div>
                </div>
              </div>
              <button
                onClick={() => onCancel(runningJob.id)}
                className="p-2 rounded-lg text-monte-danger hover:bg-monte-danger/15 transition-colors flex-shrink-0"
                title="取消运行"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="h-3 bg-monte-bg rounded-full overflow-hidden mb-3">
              <div
                className="h-full bg-gradient-to-r from-monte-accent via-monte-accent2 to-purple-400 transition-all duration-300 rounded-full relative"
                style={{ width: `${runningJob.progress}%` }}
              >
                <div className="absolute inset-0 bg-white/20 animate-pulse" />
              </div>
            </div>

            <div className="flex items-center justify-between text-xs">
              <span className="text-monte-accent font-mono font-bold text-sm">{runningJob.progress}%</span>
              <div className="flex items-center gap-4 text-monte-muted">
                {runningJob.elapsedMs != null && (
                  <span className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" />
                    已用 {formatDuration(runningJob.elapsedMs)}
                  </span>
                )}
                {runningJob.estimatedRemainingMs != null && runningJob.estimatedRemainingMs > 0 && (
                  <span className="flex items-center gap-1">
                    <Timer className="w-3.5 h-3.5" />
                    预计还需 {formatDuration(runningJob.estimatedRemainingMs)}
                  </span>
                )}
              </div>
            </div>
          </div>
        )}

        {queuedJobs.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs text-monte-muted font-semibold uppercase tracking-wider px-1">
              <Clock className="w-3.5 h-3.5" />
              排队等待 ({queuedJobs.length})
            </div>
            {queuedJobs.map((job, idx) => (
              <div
                key={job.id}
                className="flex items-center justify-between p-3.5 rounded-lg bg-monte-card/60 border border-monte-border/70 hover:border-monte-accent/40 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="w-7 h-7 rounded-lg bg-monte-border flex items-center justify-center text-xs font-mono font-semibold text-monte-muted flex-shrink-0">
                    {idx + 1}
                  </span>
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-slate-200 truncate">{job.runName || '模拟运行'}</div>
                    <div className="text-xs text-monte-muted">
                      {formatNumber(job.iterations, 0)} 次迭代 · 阈值 {formatNumber(job.threshold, 0)}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <StatusBadge status={job.status} />
                  <button
                    onClick={() => onCancel(job.id)}
                    className="p-1.5 rounded-md text-monte-muted hover:text-monte-danger hover:bg-monte-danger/10 transition-colors"
                    title="取消排队"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {finishedJobs.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2 text-xs text-monte-muted font-semibold uppercase tracking-wider">
                <CheckCircle2 className="w-3.5 h-3.5" />
                最近完成
              </div>
              <span className="text-xs text-monte-muted/60">{finishedJobs.length} 条</span>
            </div>
            {finishedJobs.slice(-5).reverse().map(job => (
              <div
                key={job.id}
                className="flex items-center justify-between p-3 rounded-lg bg-monte-bg/30 border border-monte-border/30 opacity-75 hover:opacity-100 transition-opacity"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  {job.status === 'completed' && <CheckCircle2 className="w-4 h-4 text-monte-safe flex-shrink-0" />}
                  {job.status === 'failed' && <AlertCircle className="w-4 h-4 text-monte-danger flex-shrink-0" />}
                  {job.status === 'cancelled' && <XCircle className="w-4 h-4 text-monte-warn flex-shrink-0" />}
                  <div className="min-w-0">
                    <div className="text-sm text-slate-300 truncate">{job.runName || '模拟运行'}</div>
                    <div className="text-xs text-monte-muted">
                      {job.status === 'completed' && job.elapsedMs != null && `耗时 ${formatDuration(job.elapsedMs)}`}
                      {job.status === 'failed' && (job.error || '执行失败')}
                      {job.status === 'cancelled' && '用户取消'}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <StatusBadge status={job.status} />
                  <button
                    onClick={() => onDismiss(job.id)}
                    className="p-1 rounded-md text-monte-muted hover:text-white hover:bg-monte-border transition-colors"
                    title="移除"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
