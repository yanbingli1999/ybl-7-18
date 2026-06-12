import { X, Play, Clock, Loader2, CheckCircle2, XCircle, AlertCircle, ListOrdered, Timer } from 'lucide-react';
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

function StatusIcon({ status }: { status: SimulationJob['status'] }) {
  switch (status) {
    case 'queued':
      return <Clock className="w-4 h-4 text-monte-muted" />;
    case 'running':
      return <Loader2 className="w-4 h-4 text-monte-accent animate-spin" />;
    case 'completed':
      return <CheckCircle2 className="w-4 h-4 text-monte-safe" />;
    case 'failed':
      return <AlertCircle className="w-4 h-4 text-monte-danger" />;
    case 'cancelled':
      return <XCircle className="w-4 h-4 text-monte-warn" />;
  }
}

function StatusLabel({ status }: { status: SimulationJob['status'] }) {
  const labels: Record<SimulationJob['status'], { text: string; color: string }> = {
    queued: { text: '排队中', color: 'text-monte-muted' },
    running: { text: '运行中', color: 'text-monte-accent' },
    completed: { text: '已完成', color: 'text-monte-safe' },
    failed: { text: '失败', color: 'text-monte-danger' },
    cancelled: { text: '已取消', color: 'text-monte-warn' },
  };
  const { text, color } = labels[status];
  return <span className={`text-xs font-medium ${color}`}>{text}</span>;
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

      <div className="space-y-3">
        {runningJob && (
          <div className="p-4 rounded-xl bg-gradient-to-r from-monte-accent/10 to-monte-accent2/5 border border-monte-accent/30">
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="flex items-center gap-2 min-w-0">
                <StatusIcon status="running" />
                <div className="min-w-0">
                  <div className="text-sm font-medium text-white truncate">{runningJob.runName || '模拟运行'}</div>
                  <div className="text-xs text-monte-muted">{formatNumber(runningJob.iterations, 0)} 次迭代</div>
                </div>
              </div>
              <button
                onClick={() => onCancel(runningJob.id)}
                className="p-1.5 rounded-md text-monte-danger hover:bg-monte-danger/15 transition-colors flex-shrink-0"
                title="取消运行"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="h-2.5 bg-monte-bg rounded-full overflow-hidden mb-2">
              <div
                className="h-full bg-gradient-to-r from-monte-accent to-monte-accent2 transition-all duration-300 rounded-full"
                style={{ width: `${runningJob.progress}%` }}
              />
            </div>

            <div className="flex items-center justify-between text-xs">
              <span className="text-monte-accent font-mono font-semibold">{runningJob.progress}%</span>
              <div className="flex items-center gap-3 text-monte-muted">
                {runningJob.elapsedMs != null && (
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    已用 {formatDuration(runningJob.elapsedMs)}
                  </span>
                )}
                {runningJob.estimatedRemainingMs != null && runningJob.estimatedRemainingMs > 0 && (
                  <span className="flex items-center gap-1">
                    <Timer className="w-3 h-3" />
                    预计剩余 {formatDuration(runningJob.estimatedRemainingMs)}
                  </span>
                )}
              </div>
            </div>
          </div>
        )}

        {queuedJobs.length > 0 && (
          <div className="space-y-2">
            <div className="text-xs text-monte-muted font-semibold uppercase tracking-wider px-1">
              排队中 ({queuedJobs.length})
            </div>
            {queuedJobs.map((job, idx) => (
              <div
                key={job.id}
                className="flex items-center justify-between p-3 rounded-lg bg-monte-bg/50 border border-monte-border/50"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-5 h-5 rounded-full bg-monte-border flex items-center justify-center text-[10px] font-mono text-monte-muted flex-shrink-0">
                    {idx + 1}
                  </span>
                  <StatusIcon status={job.status} />
                  <div className="min-w-0">
                    <div className="text-sm text-white truncate">{job.runName || '模拟运行'}</div>
                    <div className="text-xs text-monte-muted">{formatNumber(job.iterations, 0)} 次迭代 · 阈值 {formatNumber(job.threshold, 0)}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <StatusLabel status={job.status} />
                  <button
                    onClick={() => onCancel(job.id)}
                    className="p-1 rounded-md text-monte-muted hover:text-monte-danger hover:bg-monte-danger/10 transition-colors"
                    title="取消排队"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {finishedJobs.length > 0 && (
          <div className="space-y-2">
            <div className="text-xs text-monte-muted font-semibold uppercase tracking-wider px-1">
              最近完成 ({finishedJobs.length})
            </div>
            {finishedJobs.slice(-5).reverse().map(job => (
              <div
                key={job.id}
                className="flex items-center justify-between p-2.5 rounded-lg bg-monte-bg/30 border border-monte-border/30"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <StatusIcon status={job.status} />
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
                  <StatusLabel status={job.status} />
                  <button
                    onClick={() => onDismiss(job.id)}
                    className="p-1 rounded-md text-monte-muted hover:text-white hover:bg-monte-border transition-colors"
                    title="移除"
                  >
                    <X className="w-3 h-3" />
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
