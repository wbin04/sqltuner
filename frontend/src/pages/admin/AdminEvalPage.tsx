import { useState, useEffect, useMemo } from 'react';
import { RefreshCw, AlertCircle, Database, Play, Upload, ChevronDown, ChevronRight, CheckCircle2, XCircle, Search, X } from 'lucide-react';
import { cn } from '../../lib/utils';
import { adminEvalService, SpiderDBInfo, UserAccountInfo, EvalReport, EvalStatusMap } from '../../services/adminEvalService';

type ViewMode = 'list' | 'results';

export function AdminEvalPage() {
  const [databases, setDatabases] = useState<SpiderDBInfo[]>([]);
  const [users, setUsers] = useState<UserAccountInfo[]>([]);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [schemaLoaded, setSchemaLoaded] = useState<Record<string, boolean>>({});
  const [schemaLoading, setSchemaLoading] = useState<Record<string, boolean>>({});
  const [evalRunning, setEvalRunning] = useState<Record<string, boolean>>({});
  const [evalProgress, setEvalProgress] = useState<Record<string, {current: number, total: number}>>({});
  const [evalLimits, setEvalLimits] = useState<Record<string, string>>({});
  const [statuses, setStatuses] = useState<EvalStatusMap>({});
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [selectedDb, setSelectedDb] = useState<string | null>(null);
  const [report, setReport] = useState<EvalReport | null>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [expandedRow, setExpandedRow] = useState<number | null>(null);

  const init = async () => {
    try {
      setLoading(true); setError(null);
      const [dbs, usrs, sts] = await Promise.all([
        adminEvalService.listSpiderDatabases(),
        adminEvalService.listUsersForEval(),
        adminEvalService.getAllStatus(),
      ]);
      setDatabases(dbs); setUsers(usrs); setStatuses(sts);
      // Ensure eval user exists and select it
      const evalUser = await adminEvalService.ensureEvalUser();
      const allUsers = await adminEvalService.listUsersForEval();
      setUsers(allUsers);
      setSelectedUserId(evalUser.id);
    } catch (e: any) { setError(e?.response?.data?.detail || 'Failed to load'); }
    finally { setLoading(false); }
  };

  useEffect(() => { init(); }, []);

  const handleLoadSchema = async (dbId: string) => {
    if (!selectedUserId) return;
    setSchemaLoading(p => ({ ...p, [dbId]: true }));
    try {
      await adminEvalService.loadSchema(dbId, selectedUserId);
      setSchemaLoaded(p => ({ ...p, [dbId]: true }));
    } catch (e: any) { alert(`Schema load failed: ${e?.response?.data?.detail || e.message}`); }
    finally { setSchemaLoading(p => ({ ...p, [dbId]: false })); }
  };

  const handleRunEval = async (dbId: string) => {
    if (!selectedUserId || !schemaLoaded[dbId]) return;
    setEvalRunning(p => ({ ...p, [dbId]: true }));
    try {
      const limit = evalLimits[dbId] ? parseInt(evalLimits[dbId]) : undefined;
      await adminEvalService.runEvaluation(dbId, selectedUserId, limit);
      const sts = await adminEvalService.getAllStatus();
      setStatuses(sts);
    } catch (e: any) { alert(`Eval failed: ${e?.response?.data?.detail || e.message}`); }
    finally { setEvalRunning(p => ({ ...p, [dbId]: false })); }
  };

  const handleViewResults = async (dbId: string) => {
    setSelectedDb(dbId); setReportLoading(true); setViewMode('results');
    try {
      const r = await adminEvalService.getResults(dbId);
      setReport(r);
    } catch (e: any) { alert(`Load results failed: ${e?.response?.data?.detail || e.message}`); setViewMode('list'); }
    finally { setReportLoading(false); }
  };

  useEffect(() => {
    let interval: NodeJS.Timeout;
    const runningDbs = Object.keys(evalRunning).filter(dbId => evalRunning[dbId]);
    if (runningDbs.length > 0) {
      interval = setInterval(() => {
        runningDbs.forEach(async (dbId) => {
          try {
            const prog = await adminEvalService.getProgress(dbId);
            if (prog && prog.total > 0) {
              setEvalProgress(p => ({ ...p, [dbId]: prog }));
            }
          } catch (e) {
            // ignore
          }
        });
      }, 2000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [evalRunning]);

  if (loading) return (
    <div className="p-6 flex items-center justify-center h-full">
      <RefreshCw className="w-8 h-8 text-primary dark:text-primary-dark animate-spin" />
    </div>
  );

  if (error) return (
    <div className="p-6 flex items-center justify-center h-full">
      <div className="flex flex-col items-center gap-3">
        <AlertCircle className="w-8 h-8 text-red-500" />
        <p className="text-red-600 dark:text-red-400">{error}</p>
        <button onClick={init} className="px-4 py-2 bg-primary dark:bg-primary-dark text-white rounded-lg">Retry</button>
      </div>
    </div>
  );

  const filteredDbs = databases.filter(d =>
    !search || d.db_id.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <>
      <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-text-main-DEFAULT dark:text-text-main-dark">Evaluation Runner</h1>
          <p className="text-text-muted-DEFAULT dark:text-text-muted-dark mt-1">Per-database Spider evaluation control</p>
        </div>
        <button onClick={init} className="px-3 py-2 bg-surface-light dark:bg-surface-dark border border-border-DEFAULT dark:border-border-dark rounded-lg hover:bg-blue-50 dark:hover:bg-slate-800 transition-colors">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* User selector */}
      <div className="bg-surface-light dark:bg-surface-dark rounded-xl border border-border-DEFAULT dark:border-border-dark p-4">
        <div className="flex items-center gap-4">
          <label className="text-sm font-medium text-text-main-DEFAULT dark:text-text-main-dark whitespace-nowrap">Eval Account:</label>
          <select value={selectedUserId} onChange={e => setSelectedUserId(e.target.value)}
            className="flex-1 max-w-md px-3 py-2 bg-background-light dark:bg-background-dark border border-border-DEFAULT dark:border-border-dark rounded-lg text-sm text-text-main-DEFAULT dark:text-text-main-dark focus:outline-none focus:ring-2 focus:ring-primary/50">
            <option value="">-- Select user --</option>
            {users.map(u => <option key={u.id} value={u.id}>{u.email} ({u.role})</option>)}
          </select>
          <span className="text-xs text-text-muted-DEFAULT dark:text-text-muted-dark">Connection owner for schema loading</span>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted-DEFAULT dark:text-text-muted-dark" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Filter databases..."
          className="w-full pl-9 pr-8 py-2 bg-surface-light dark:bg-surface-dark border border-border-DEFAULT dark:border-border-dark rounded-lg text-sm text-text-main-DEFAULT dark:text-text-main-dark focus:outline-none focus:ring-2 focus:ring-primary/50" />
        {search && <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2"><X className="w-4 h-4 text-text-muted-DEFAULT" /></button>}
      </div>

      {/* Database list */}
      <div className="space-y-2">
        {filteredDbs.map(db => {
          const st = statuses[db.db_id];
          const isLoaded = schemaLoaded[db.db_id];
          const isLoadingSchema = schemaLoading[db.db_id];
          const isRunning = evalRunning[db.db_id];

          return (
            <div key={db.db_id} className="bg-surface-light dark:bg-surface-dark rounded-xl border border-border-DEFAULT dark:border-border-dark p-4">
              <div className="flex items-center gap-4">
                <Database className="w-5 h-5 text-blue-500 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-text-main-DEFAULT dark:text-text-main-dark">{db.db_id}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                      {db.question_count} questions
                    </span>
                    {!db.has_sqlite && <span className="text-xs text-red-500">No SQLite</span>}
                    {isLoaded && <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
                    {st?.has_results && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300">
                        Evaluated: {st.total_evaluated}
                      </span>
                    )}
                  </div>
                  {st?.overall && (
                    <div className="flex gap-3 mt-1 text-xs text-text-muted-DEFAULT dark:text-text-muted-dark">
                      <span>EM: <strong className="text-blue-600 dark:text-blue-400">{st.overall['EM (%)']?.toFixed(1)}%</strong></span>
                      <span>EX: <strong className="text-emerald-600 dark:text-emerald-400">{st.overall['EX (%)']?.toFixed(1)}%</strong></span>
                    </div>
                  )}
                </div>

                {/* Limit input */}
                <div className="flex items-center gap-1">
                  <label className="text-xs text-text-muted-DEFAULT dark:text-text-muted-dark">Limit:</label>
                  <input type="number" min="1" max={db.question_count}
                    placeholder="All"
                    value={evalLimits[db.db_id] || ''}
                    onChange={e => setEvalLimits(p => ({ ...p, [db.db_id]: e.target.value }))}
                    className="w-16 px-2 py-1 text-xs bg-background-light dark:bg-background-dark border border-border-DEFAULT dark:border-border-dark rounded text-text-main-DEFAULT dark:text-text-main-dark" />
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2">
                  <button onClick={() => handleLoadSchema(db.db_id)}
                    disabled={!selectedUserId || !db.has_sqlite || isLoadingSchema}
                    className={cn("px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all",
                      isLoadingSchema ? "bg-amber-100 dark:bg-amber-900/30 text-amber-700" :
                      isLoaded ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-200" :
                      "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-900/50",
                      (!selectedUserId || !db.has_sqlite) && "opacity-50 cursor-not-allowed"
                    )}>
                    {isLoadingSchema ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
                    {isLoadingSchema ? 'Loading...' : isLoaded ? 'Reload Schema' : 'Load Schema'}
                  </button>

                  <button onClick={() => handleRunEval(db.db_id)}
                    disabled={!isLoaded || isRunning}
                    className={cn("px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all",
                      isRunning ? "bg-amber-500 text-white" :
                      "bg-primary dark:bg-primary-dark text-white hover:opacity-90",
                      !isLoaded && "opacity-50 cursor-not-allowed"
                    )}>
                    {isRunning ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
                    {isRunning ? (evalProgress[db.db_id] ? `${evalProgress[db.db_id].current}/${evalProgress[db.db_id].total}` : 'Running...') : 'Evaluate'}
                  </button>

                  {st?.has_results && (
                    <button onClick={() => handleViewResults(db.db_id)}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all">
                      View Results
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      {filteredDbs.length === 0 && (
        <div className="text-center py-12 text-text-muted-DEFAULT dark:text-text-muted-dark">No databases found</div>
      )}
    </div>

    {viewMode === 'results' && selectedDb && (
      <ResultsView
        dbId={selectedDb} report={report} loading={reportLoading}
        onBack={() => { setViewMode('list'); setReport(null); setSelectedDb(null); }}
        search={search} setSearch={setSearch}
        expandedRow={expandedRow} setExpandedRow={setExpandedRow}
      />
    )}
    </>
  );
}

// ── Results View ─────────────────────────────────────────────────────────────

function ResultsView({ dbId, report, loading, onBack, search, setSearch, expandedRow, setExpandedRow }: {
  dbId: string; report: EvalReport | null; loading: boolean; onBack: () => void;
  search: string; setSearch: (s: string) => void;
  expandedRow: number | null; setExpandedRow: (i: number | null) => void;
}) {
  if (loading) return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 sm:p-6" onClick={onBack}>
      <RefreshCw className="w-8 h-8 text-primary dark:text-primary-dark animate-spin" />
    </div>
  );
  if (!report) return null;

  const overall = report.overall;
  const details = report.detailed_results || [];

  const filtered = useMemo(() => {
    if (!search) return details;
    const q = search.toLowerCase();
    return details.filter(r => r.question.toLowerCase().includes(q));
  }, [details, search]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onBack}></div>
      <div className="relative w-full max-w-6xl max-h-[90vh] bg-surface-light dark:bg-surface-dark rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex-shrink-0 border-b border-border-DEFAULT dark:border-border-dark p-6 flex items-center justify-between bg-surface-light dark:bg-surface-dark z-10">
          <div>
            <h2 className="text-2xl font-bold text-text-main-DEFAULT dark:text-text-main-dark">Results: {dbId}</h2>
            <p className="text-text-muted-DEFAULT dark:text-text-muted-dark text-sm">{report.total_evaluated} evaluated • {new Date(report.timestamp).toLocaleString()}</p>
          </div>
          <button onClick={onBack} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors">
            <X className="w-6 h-6 text-text-muted-DEFAULT dark:text-text-muted-dark" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-background-light dark:bg-background-dark">

      {/* Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { label: 'Exact Match', value: overall?.['EM (%)'] ?? 0, color: 'text-blue-600 dark:text-blue-400' },
          { label: 'Execution Acc', value: overall?.['EX (%)'] ?? 0, color: 'text-emerald-600 dark:text-emerald-400' },
          { label: 'Schema Linkage', value: overall?.['SL_Linkage (%)'] ?? 0, color: 'text-cyan-600 dark:text-cyan-400' },
          { label: 'Soft Label', value: overall?.['SL (Soft Label %)'] ?? 0, color: 'text-purple-600 dark:text-purple-400' },
          { label: 'Avg Latency', value: overall?.avg_latency_s ?? 0, unit: 's', color: 'text-orange-600 dark:text-orange-400' },
        ].map(m => (
          <div key={m.label} className="bg-surface-light dark:bg-surface-dark rounded-xl border border-border-DEFAULT dark:border-border-dark p-4">
            <p className="text-xs text-text-muted-DEFAULT dark:text-text-muted-dark mb-1">{m.label}</p>
            <p className={cn('text-2xl font-bold', m.color)}>
              {(m.value || 0).toFixed(m.unit ? 3 : 1)}<span className="text-sm ml-1">{m.unit || '%'}</span>
            </p>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted-DEFAULT dark:text-text-muted-dark" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search questions..."
          className="w-full pl-9 pr-8 py-2 bg-surface-light dark:bg-surface-dark border border-border-DEFAULT dark:border-border-dark rounded-lg text-sm text-text-main-DEFAULT dark:text-text-main-dark focus:outline-none focus:ring-2 focus:ring-primary/50" />
        {search && <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2"><X className="w-4 h-4 text-text-muted-DEFAULT" /></button>}
      </div>

      <p className="text-sm text-text-muted-DEFAULT dark:text-text-muted-dark">{filtered.length} results</p>

      {/* Detail list */}
      <div className="space-y-2">
        {filtered.map((r, i) => {
          const isExp = expandedRow === i;
          return (
            <div key={i} className="bg-surface-light dark:bg-surface-dark rounded-xl border border-border-DEFAULT dark:border-border-dark overflow-hidden">
              <button onClick={() => setExpandedRow(isExp ? null : i)}
                className="w-full px-4 py-3 flex items-center gap-3 text-left hover:bg-surface-highlight-light dark:hover:bg-surface-highlight-dark transition-colors">
                {isExp ? <ChevronDown className="w-4 h-4 text-text-muted-DEFAULT flex-shrink-0" /> : <ChevronRight className="w-4 h-4 text-text-muted-DEFAULT flex-shrink-0" />}
                <span className="text-sm text-text-main-DEFAULT dark:text-text-main-dark flex-1 truncate">{r.question}</span>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {r.ex === 1 ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <XCircle className="w-4 h-4 text-red-500" />}
                  <span className={cn('text-xs px-1.5 py-0.5 rounded font-medium', r.em ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700' : 'bg-red-100 dark:bg-red-900/30 text-red-700')}>EM:{r.em}</span>
                  <span className={cn('text-xs px-1.5 py-0.5 rounded font-medium', r.ex ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700' : 'bg-red-100 dark:bg-red-900/30 text-red-700')}>EX:{r.ex}</span>
                  <span className="text-xs text-text-muted-DEFAULT dark:text-text-muted-dark">{r.latency_s.toFixed(1)}s</span>
                </div>
              </button>
              {isExp && (
                <div className="px-4 pb-4 pt-2 space-y-3 border-t border-border-DEFAULT dark:border-border-dark">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <SqlBlock label="Gold SQL" sql={r.gold_sql} variant="gold" />
                    <SqlBlock label="Predicted SQL" sql={r.pred_sql} variant="pred" />
                  </div>
                  {r.error && (
                    <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/40 rounded-lg p-3">
                      <p className="text-xs font-semibold text-red-700 dark:text-red-300 mb-1">Error</p>
                      <p className="text-sm font-mono text-red-600 dark:text-red-400">{r.error}</p>
                    </div>
                  )}
                  {r.error === 'no_sql_generated' && r.llm_raw && (
                    <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/40 rounded-lg p-3">
                      <p className="text-xs font-semibold text-amber-700 dark:text-amber-300 mb-1">Raw LLM Output (Debug)</p>
                      <pre className="text-xs font-mono text-amber-700 dark:text-amber-400 whitespace-pre-wrap overflow-y-auto max-h-48">{r.llm_raw}</pre>
                    </div>
                  )}
                  <div className="flex gap-4 text-xs text-text-muted-DEFAULT dark:text-text-muted-dark">
                    <span>Hardness: <strong>{r.hardness}</strong></span>
                    <span>Complexity: <strong>{r.complexity_score.toFixed(1)}</strong></span>
                    <span>SL: <strong className="text-cyan-600">{((r.sl_linkage || r.sl) * 100).toFixed(1)}%</strong></span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
    </div>
    </div>
  );
}

function SqlBlock({ label, sql, variant }: { label: string; sql: string | null; variant: 'gold' | 'pred' }) {
  const bg = variant === 'gold' ? 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/30' : 'bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800/30';
  const lc = variant === 'gold' ? 'text-emerald-700 dark:text-emerald-300' : 'text-blue-700 dark:text-blue-300';
  const formatted = useMemo(() => {
    if (!sql) return '(no SQL generated)';
    if (sql.includes('\n')) return sql;
    return sql.replace(/\b(SELECT|FROM|WHERE|JOIN|GROUP BY|ORDER BY|HAVING|LIMIT|UNION|INTERSECT|EXCEPT)\b/g, '\n$1').trim();
  }, [sql]);
  return (
    <div className={cn('rounded-lg border p-3', bg)}>
      <p className={cn('text-xs font-semibold mb-1', lc)}>{label}</p>
      <pre className="text-xs font-mono text-text-main-DEFAULT dark:text-text-main-dark whitespace-pre-wrap overflow-x-auto max-h-48 overflow-y-auto">{formatted}</pre>
    </div>
  );
}
