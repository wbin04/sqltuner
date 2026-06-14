/**
 * DashboardHome - Redesigned Overview Dashboard
 * Hiển thị thống kê, hoạt động gần đây và quick actions
 */
import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Database,
  FlaskConical,
  MessageSquare,
  Zap,
  TrendingUp,
  Clock,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Plus,
  Activity,
  BarChart3,
  Layers,
  Sparkles,
  ChevronRight,
  Code2,
  RefreshCw,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { useAuth } from '../../context/AuthContext';
import { workspaceService } from '../../services/workspaceService';
import { historyService } from '../../services/historyService';
import type { Workspace } from '../../types/workspace';
import type { HistoryLog, ActivityType } from '../../types/history';
import { DbType } from '../../types/workspace';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  if (mins < 1440) return `${Math.floor(mins / 60)}h ago`;
  return `${Math.floor(mins / 1440)}d ago`;
}

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

// ─── Animated Number ──────────────────────────────────────────────────────────

function AnimatedNumber({ value }: { value: number }) {
  return <span className="tabular-nums">{value.toLocaleString()}</span>;
}

// ─── Stat Card ───────────────────────────────────────────────────────────────

interface StatCardProps {
  label: string;
  value: number | string;
  icon: React.ElementType;
  gradient: string;
  trend?: string;
  trendUp?: boolean;
  loading?: boolean;
}

function StatCard({ label, value, icon: Icon, gradient, trend, trendUp, loading }: StatCardProps) {
  return (
    <div className={cn(
      'relative overflow-hidden rounded-2xl p-6 border transition-all duration-300',
      'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800',
      'hover:shadow-xl hover:-translate-y-0.5 group'
    )}>
      {/* Gradient glow bg */}
      <div className={cn('absolute inset-0 opacity-0 group-hover:opacity-5 transition-opacity duration-500 rounded-2xl', gradient)} />

      <div className="relative z-10">
        <div className="flex items-start justify-between mb-4">
          <div className={cn('p-3 rounded-xl bg-gradient-to-br', gradient)}>
            <Icon className="w-5 h-5 text-white" />
          </div>
          {trend && (
            <div className={cn(
              'flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full',
              trendUp
                ? 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950 dark:text-emerald-400'
                : 'text-red-600 bg-red-50 dark:bg-red-950 dark:text-red-400'
            )}>
              <TrendingUp className={cn('w-3 h-3', !trendUp && 'rotate-180')} />
              {trend}
            </div>
          )}
        </div>

        {loading ? (
          <div className="space-y-2">
            <div className="h-8 w-16 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
            <div className="h-4 w-24 bg-slate-100 dark:bg-slate-800 rounded animate-pulse" />
          </div>
        ) : (
          <>
            <p className="text-3xl font-bold text-slate-900 dark:text-slate-100 mb-1">
              {typeof value === 'number' ? <AnimatedNumber value={value} /> : value}
            </p>
            <p className="text-sm text-slate-500 dark:text-slate-400">{label}</p>
          </>
        )}
      </div>

      {/* Bottom accent */}
      <div className={cn('absolute bottom-0 left-0 right-0 h-0.5 opacity-0 group-hover:opacity-100 transition-opacity bg-gradient-to-r', gradient)} />
    </div>
  );
}

// ─── Activity Badge ───────────────────────────────────────────────────────────

const activityConfig: Record<ActivityType, { color: string; bg: string; darkBg: string; label: string; icon: React.ElementType }> = {
  optimization: {
    color: 'text-violet-600 dark:text-violet-400',
    bg: 'bg-violet-50',
    darkBg: 'dark:bg-violet-950/50',
    label: 'Optimization',
    icon: Zap,
  },
  execution: {
    color: 'text-blue-600 dark:text-blue-400',
    bg: 'bg-blue-50',
    darkBg: 'dark:bg-blue-950/50',
    label: 'Execution',
    icon: Code2,
  },
  chat: {
    color: 'text-emerald-600 dark:text-emerald-400',
    bg: 'bg-emerald-50',
    darkBg: 'dark:bg-emerald-950/50',
    label: 'AI Chat',
    icon: MessageSquare,
  },
};

// ─── Activity Item ────────────────────────────────────────────────────────────

function ActivityItem({ log }: { log: HistoryLog }) {
  const cfg = activityConfig[log.activity_type] ?? activityConfig.chat;
  const ActivityIcon = cfg.icon;

  const statusIcon = log.result_status === 'success' || log.result_status === 'optimized'
    ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
    : log.result_status === 'error'
      ? <AlertCircle className="w-3.5 h-3.5 text-red-500" />
      : null;

  return (
    <div className={cn(
      'flex items-start gap-4 p-4 rounded-xl transition-all duration-200',
      'hover:bg-slate-50 dark:hover:bg-slate-800/50 group cursor-default'
    )}>
      {/* Icon */}
      <div className={cn('p-2 rounded-lg flex-shrink-0', cfg.bg, cfg.darkBg)}>
        <ActivityIcon className={cn('w-4 h-4', cfg.color)} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className={cn('text-xs font-semibold uppercase tracking-wide', cfg.color)}>
            {cfg.label}
          </span>
          {statusIcon}
          <span className="text-xs text-slate-400 dark:text-slate-500 ml-auto flex-shrink-0">
            {timeAgo(log.timestamp)}
          </span>
        </div>

        <p className="text-sm text-slate-700 dark:text-slate-300 truncate">
          {log.user_prompt || log.sql_query || '—'}
        </p>

        <div className="flex items-center gap-3 mt-1">
          <span className="text-xs text-slate-400 dark:text-slate-500">
            📁 {log.workspace.name}
          </span>
          {log.execution_time_ms != null && (
            <span className="text-xs text-slate-400 dark:text-slate-500">
              ⏱ {log.execution_time_ms}ms
            </span>
          )}
          {log.cost_reduction != null && log.cost_reduction > 0 && (
            <span className="text-xs text-emerald-500 font-medium">
              📉 -{log.cost_reduction.toFixed(0)}% cost
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Workspace Row ────────────────────────────────────────────────────────────

function WorkspaceRow({ ws, onOpen }: { ws: Workspace; onOpen: () => void }) {
  const isSimulation = ws.db_type === DbType.SIMULATION;
  const tableCount = ws.meta_schema?.tables?.length ?? 0;

  return (
    <button
      onClick={onOpen}
      className={cn(
        'w-full flex items-center gap-4 px-4 py-3 rounded-xl transition-all duration-200',
        'hover:bg-slate-50 dark:hover:bg-slate-800/50 group text-left'
      )}
    >
      {/* DB Icon */}
      <div className={cn(
        'w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0',
        isSimulation
          ? 'bg-violet-100 dark:bg-violet-950/50'
          : 'bg-blue-100 dark:bg-blue-950/50'
      )}>
        {isSimulation
          ? <FlaskConical className="w-5 h-5 text-violet-600 dark:text-violet-400" />
          : <Database className="w-5 h-5 text-blue-600 dark:text-blue-400" />
        }
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
            {ws.name}
          </p>
          {isSimulation && (
            <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-violet-100 dark:bg-violet-900/50 text-violet-600 dark:text-violet-400 flex-shrink-0">
              Sandbox
            </span>
          )}
        </div>
        <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
          {tableCount} tables · {ws.db_type.toUpperCase()} · added {timeAgo(ws.created_at)}
        </p>
      </div>

      {/* Arrow */}
      <ChevronRight className="w-4 h-4 text-slate-300 dark:text-slate-600 group-hover:text-slate-500 dark:group-hover:text-slate-400 transition-colors flex-shrink-0" />
    </button>
  );
}

// ─── Mini Bar Chart ───────────────────────────────────────────────────────────

function ActivityBarChart({ data }: { data: { label: string; value: number; color: string }[] }) {
  const max = Math.max(...data.map(d => d.value), 1);
  return (
    <div className="flex items-end gap-1.5 h-16">
      {data.map((d, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-1">
          <div
            className={cn('w-full rounded-t-sm transition-all duration-700', d.color)}
            style={{ height: `${Math.max((d.value / max) * 100, 4)}%` }}
            title={`${d.label}: ${d.value}`}
          />
          <span className="text-[9px] text-slate-400 dark:text-slate-500">{d.label}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Quick Action Button ─────────────────────────────────────────────────────

function QuickAction({
  icon: Icon, label, desc, gradient, onClick
}: {
  icon: React.ElementType; label: string; desc: string; gradient: string; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'group flex items-center gap-4 w-full p-4 rounded-xl border transition-all duration-200',
        'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800',
        'hover:border-slate-300 dark:hover:border-slate-600 hover:shadow-md hover:-translate-y-0.5'
      )}
    >
      <div className={cn('p-2.5 rounded-xl bg-gradient-to-br flex-shrink-0', gradient)}>
        <Icon className="w-5 h-5 text-white" />
      </div>
      <div className="flex-1 text-left">
        <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{label}</p>
        <p className="text-xs text-slate-400 dark:text-slate-500">{desc}</p>
      </div>
      <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-slate-500 dark:group-hover:text-slate-400 transition-colors flex-shrink-0" />
    </button>
  );
}

// ─── Loading Skeleton ─────────────────────────────────────────────────────────

function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-lg bg-slate-200 dark:bg-slate-800', className)} />;
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function DashboardHome() {
  const navigate = useNavigate();
  const { user } = useAuth();

  // API queries
  const { data: workspaces, isLoading: wsLoading } = useQuery({
    queryKey: ['workspaces'],
    queryFn: () => workspaceService.getAll(),
    staleTime: 30_000,
  });

  const { data: historyData, isLoading: histLoading } = useQuery({
    queryKey: ['history-dashboard'],
    queryFn: () => historyService.getHistory({ page: 1, limit: 50 }),
    staleTime: 30_000,
  });

  // Derived stats
  const stats = useMemo(() => {
    const ws = workspaces ?? [];
    const items = historyData?.items ?? [];
    const realCount = ws.filter(w => w.db_type !== DbType.SIMULATION).length;
    const simCount = ws.filter(w => w.db_type === DbType.SIMULATION).length;
    const optimizations = items.filter(i => i.activity_type === 'optimization');
    const avgCostReduction = optimizations.length > 0
      ? optimizations.reduce((sum, i) => sum + (i.cost_reduction ?? 0), 0) / optimizations.length
      : 0;

    return {
      totalWorkspaces: ws.length,
      realConnections: realCount,
      sandboxes: simCount,
      totalQueries: historyData?.total ?? 0,
      optimizations: optimizations.length,
      avgCostReduction: Math.round(avgCostReduction),
    };
  }, [workspaces, historyData]);

  // Activity breakdown for chart (by type from recent 50)
  const chartData = useMemo(() => {
    const items = historyData?.items ?? [];
    return [
      { label: 'Chat', value: items.filter(i => i.activity_type === 'chat').length, color: 'bg-emerald-400 dark:bg-emerald-500' },
      { label: 'Exec', value: items.filter(i => i.activity_type === 'execution').length, color: 'bg-blue-400 dark:bg-blue-500' },
      { label: 'Optim', value: items.filter(i => i.activity_type === 'optimization').length, color: 'bg-violet-400 dark:bg-violet-500' },
    ];
  }, [historyData]);

  const recentActivity = historyData?.items.slice(0, 8) ?? [];
  const recentWorkspaces = (workspaces ?? []).slice(0, 5);

  const userName = user?.email?.split('@')[0] ?? 'there';

  return (
    <div className="min-h-full bg-slate-50 dark:bg-slate-950 overflow-auto">
      <div className="max-w-7xl mx-auto p-6 space-y-6">

        {/* ── Header ── */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
              {getGreeting()}, <span className="bg-blue-600 bg-clip-text text-transparent">{userName}</span>
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Here's what's happening across your workspaces
            </p>
          </div>
          <button
            onClick={() => navigate('/workspaces')}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-xl transition-colors shadow-md shadow-blue-600/20"
          >
            <Plus className="w-4 h-4" />
            New Workspace
          </button>
        </div>

        {/* ── Stat Cards ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="Total Workspaces"
            value={stats.totalWorkspaces}
            icon={Layers}
            gradient="from-blue-500 to-blue-700"
            loading={wsLoading}
          />
          <StatCard
            label="Total Queries"
            value={stats.totalQueries}
            icon={Activity}
            gradient="from-emerald-500 to-teal-700"
            trend="+12%"
            trendUp={true}
            loading={histLoading}
          />
          <StatCard
            label="Optimizations"
            value={stats.optimizations}
            icon={Zap}
            gradient="from-violet-500 to-purple-700"
            loading={histLoading}
          />
          <StatCard
            label="Avg Cost Reduction"
            value={`${stats.avgCostReduction}%`}
            icon={TrendingUp}
            gradient="from-orange-500 to-red-600"
            trend={stats.avgCostReduction > 0 ? `${stats.avgCostReduction}%` : undefined}
            trendUp={true}
            loading={histLoading}
          />
        </div>

        {/* ── Main Grid ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Left: Activity Feed (2/3) */}
          <div className="lg:col-span-2 space-y-6">

            {/* Recent Activity */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-slate-400" />
                  <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Recent Activity</h2>
                </div>
                <button
                  onClick={() => navigate('/history')}
                  className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                >
                  View all <ArrowRight className="w-3 h-3" />
                </button>
              </div>

              <div className="divide-y divide-slate-50 dark:divide-slate-800/50">
                {histLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="flex items-start gap-4 p-4">
                      <Skeleton className="w-8 h-8 rounded-lg flex-shrink-0" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-3 w-20" />
                        <Skeleton className="h-3 w-full" />
                        <Skeleton className="h-3 w-32" />
                      </div>
                    </div>
                  ))
                ) : recentActivity.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <Activity className="w-12 h-12 text-slate-200 dark:text-slate-700 mb-3" />
                    <p className="text-sm font-medium text-slate-500 dark:text-slate-400">No activity yet</p>
                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                      Start querying a workspace to see activity here
                    </p>
                  </div>
                ) : (
                  recentActivity.map(log => <ActivityItem key={log.id} log={log} />)
                )}
              </div>
            </div>
          </div>

          {/* Right: Sidebar (1/3) */}
          <div className="space-y-6">

            {/* Activity breakdown chart */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <BarChart3 className="w-4 h-4 text-slate-400" />
                <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Activity Breakdown</h2>
                <span className="ml-auto text-xs text-slate-400">(last 50)</span>
              </div>
              {histLoading ? (
                <div className="flex items-end gap-1.5 h-16">
                  {[60, 80, 40].map((h, i) => (
                    <div key={i} className="flex-1 animate-pulse bg-slate-200 dark:bg-slate-700 rounded-t-sm" style={{ height: `${h}%` }} />
                  ))}
                </div>
              ) : (
                <ActivityBarChart data={chartData} />
              )}
              <div className="flex gap-4 mt-3">
                {chartData.map(d => (
                  <div key={d.label} className="flex items-center gap-1">
                    <div className={cn('w-2 h-2 rounded-full', d.color)} />
                    <span className="text-[10px] text-slate-400 dark:text-slate-500">{d.label} ({d.value})</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Workspaces */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <Database className="w-4 h-4 text-slate-400" />
                  <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    Workspaces
                    <span className="ml-2 text-xs font-normal text-slate-400">
                      ({stats.realConnections} real · {stats.sandboxes} sandbox)
                    </span>
                  </h2>
                </div>
                <button
                  onClick={() => navigate('/workspaces')}
                  className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                >
                  All <ArrowRight className="w-3 h-3" />
                </button>
              </div>

              <div className="p-2">
                {wsLoading ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-3 p-3">
                      <Skeleton className="w-10 h-10 rounded-xl" />
                      <div className="flex-1 space-y-1.5">
                        <Skeleton className="h-3 w-24" />
                        <Skeleton className="h-2.5 w-40" />
                      </div>
                    </div>
                  ))
                ) : recentWorkspaces.length === 0 ? (
                  <div className="text-center py-8">
                    <Database className="w-10 h-10 text-slate-200 dark:text-slate-700 mx-auto mb-2" />
                    <p className="text-xs text-slate-400 dark:text-slate-500">No workspaces yet</p>
                  </div>
                ) : (
                  recentWorkspaces.map(ws => (
                    <WorkspaceRow
                      key={ws.id}
                      ws={ws}
                      onOpen={() => navigate(`/editor/${ws.id}`)}
                    />
                  ))
                )}
              </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <Sparkles className="w-4 h-4 text-slate-400" />
                <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Quick Actions</h2>
              </div>
              <div className="space-y-2">
                <QuickAction
                  icon={Database}
                  label="Connect Database"
                  desc="Add a real DB connection"
                  gradient="from-blue-500 to-blue-700"
                  onClick={() => navigate('/workspaces')}
                />
                <QuickAction
                  icon={FlaskConical}
                  label="Create Sandbox"
                  desc="Design a simulation schema"
                  gradient="from-violet-500 to-purple-700"
                  onClick={() => navigate('/workspaces')}
                />
                <QuickAction
                  icon={RefreshCw}
                  label="View Full History"
                  desc="Search all past queries"
                  gradient="from-emerald-500 to-teal-700"
                  onClick={() => navigate('/history')}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
