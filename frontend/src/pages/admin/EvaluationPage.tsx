import { useState, useEffect, useMemo } from 'react';
import { RefreshCw, AlertCircle, ChevronDown, ChevronRight, Search, X, CheckCircle2, XCircle, Filter } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, PieChart, Pie, Cell } from 'recharts';
import { cn } from '../../lib/utils';
import { evaluationService, EvalResults, DetailedResult } from '../../services/evaluationService';

type TabId = 'overview' | 'details' | 'failures';

export function EvaluationPage() {
  const [data, setData] = useState<EvalResults | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [search, setSearch] = useState('');
  const [expandedRow, setExpandedRow] = useState<number | null>(null);
  const [hardnessFilter, setHardnessFilter] = useState<string>('all');
  const [emFilter, setEmFilter] = useState<boolean>(true);
  const [exFilter, setExFilter] = useState<boolean>(true);

  const fetch = async () => {
    try { setLoading(true); setError(null); setData(await evaluationService.getResults()); }
    catch (e: any) { setError(e?.response?.data?.detail || 'Failed to load'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetch(); }, []);

  if (loading) return (
    <div className="p-6 flex items-center justify-center h-full">
      <div className="flex flex-col items-center gap-3">
        <RefreshCw className="w-8 h-8 text-primary dark:text-primary-dark animate-spin" />
        <p className="text-text-muted-DEFAULT dark:text-text-muted-dark">Loading evaluation results...</p>
      </div>
    </div>
  );

  if (error || !data) return (
    <div className="p-6 flex items-center justify-center h-full">
      <div className="flex flex-col items-center gap-3 text-center">
        <AlertCircle className="w-8 h-8 text-red-500" />
        <p className="text-red-600 dark:text-red-400">{error || 'No data'}</p>
        <button onClick={fetch} className="px-4 py-2 bg-primary dark:bg-primary-dark text-white rounded-lg">Retry</button>
      </div>
    </div>
  );

  const tabs: { id: TabId; label: string; count?: number }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'details', label: 'All Results', count: data.detailed_results.length },
    { id: 'failures', label: 'Failed Cases', count: data.failed_cases.length },
  ];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold text-text-main-DEFAULT dark:text-text-main-dark">Evaluation Dashboard</h1>
              {data.interrupted && (
                <span className="px-2 py-1 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-xs font-bold rounded flex items-center gap-1 border border-amber-200 dark:border-amber-800/50">
                  <AlertCircle className="w-3 h-3" />
                  PARTIAL RESULTS
                </span>
              )}
            </div>
            <p className="text-text-muted-DEFAULT dark:text-text-muted-dark mt-1">
              Spider benchmark — {data.total_evaluated} queries evaluated • {new Date(data.timestamp).toLocaleString()}
            </p>
          </div>
        </div>
        <button onClick={fetch} className="px-3 py-2 bg-surface-light dark:bg-surface-dark border border-border-DEFAULT dark:border-border-dark rounded-lg hover:bg-blue-50 dark:hover:bg-slate-800 transition-colors text-text-muted-DEFAULT dark:text-text-muted-dark" title="Refresh">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-surface-light dark:bg-surface-dark rounded-lg border border-border-DEFAULT dark:border-border-dark p-1">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)} className={cn(
            'px-4 py-2 rounded-md text-sm font-medium transition-all flex items-center gap-2',
            activeTab === t.id
              ? 'bg-primary dark:bg-primary-dark text-white shadow-sm'
              : 'text-text-muted-DEFAULT dark:text-text-muted-dark hover:bg-blue-50 dark:hover:bg-slate-800'
          )}>
            {t.label}
            {t.count !== undefined && <span className={cn('px-1.5 py-0.5 rounded-full text-xs', activeTab === t.id ? 'bg-white/20' : 'bg-slate-200 dark:bg-slate-700')}>{t.count}</span>}
          </button>
        ))}
      </div>

      {activeTab === 'overview' && <OverviewTab data={data} />}
      {activeTab === 'details' && (
        <DetailsTab
          results={data.detailed_results}
          search={search}
          setSearch={setSearch}
          expandedRow={expandedRow}
          setExpandedRow={setExpandedRow}
          hardnessFilter={hardnessFilter}
          setHardnessFilter={setHardnessFilter}
          emFilter={emFilter}
          setEmFilter={setEmFilter}
          exFilter={exFilter}
          setExFilter={setExFilter}
        />
      )}
      {activeTab === 'failures' && <FailuresTab cases={data.failed_cases} />}
    </div>
  );
}

// ─── Overview Tab ────────────────────────────────────────────────────────────

function OverviewTab({ data }: { data: EvalResults }) {
  const { overall, by_hardness, total_evaluated, config } = data;
  const passCount = data.detailed_results.filter(r => r.ex === 1).length;
  const failCount = total_evaluated - passCount;

  const metricCards = [
    { label: 'Exact Match', value: overall?.['EM (%)'] ?? 0, color: 'text-blue-600 dark:text-blue-400' },
    { label: 'Execution Accuracy', value: overall?.['EX (%)'] ?? 0, color: 'text-emerald-600 dark:text-emerald-400' },
    { label: 'Schema Linkage', value: overall?.['SL_Linkage (%)'] ?? overall?.['SL (%)'] ?? 0, color: 'text-cyan-600 dark:text-cyan-400' },
    { label: 'Soft Label', value: overall?.['SL (Soft Label %)'] ?? 0, color: 'text-purple-600 dark:text-purple-400' },
    { label: 'Avg Latency', value: overall?.avg_latency_s ?? 0, unit: 's', color: 'text-orange-600 dark:text-orange-400' },
  ];

  const hardnessData = ['easy', 'medium', 'hard', 'extra_hard']
    .filter(h => by_hardness[h])
    .map(h => ({ name: h, count: by_hardness[h].count, EM: by_hardness[h].em, EX: by_hardness[h].ex, SL: by_hardness[h].sl }));

  const radarData = hardnessData.map(h => ({ subject: h.name, EM: h.EM, EX: h.EX, SL: h.SL }));

  const pieData = [
    { name: 'Pass', value: passCount, color: '#10b981' },
    { name: 'Fail', value: failCount, color: '#ef4444' },
  ];

  return (
    <div className="space-y-6">
      {/* Config Info */}
      <div className="bg-surface-light dark:bg-surface-dark rounded-xl border border-border-DEFAULT dark:border-border-dark p-4">
        <div className="flex flex-wrap gap-6 text-sm">
          <div><span className="text-text-muted-DEFAULT dark:text-text-muted-dark">Mode: </span><span className="font-medium text-text-main-DEFAULT dark:text-text-main-dark uppercase">{config.mode}</span></div>
          <div><span className="text-text-muted-DEFAULT dark:text-text-muted-dark">Samples: </span><span className="font-medium text-text-main-DEFAULT dark:text-text-main-dark">{total_evaluated}</span></div>
          {config.llm_model && <div><span className="text-text-muted-DEFAULT dark:text-text-muted-dark">Model: </span><span className="font-medium text-text-main-DEFAULT dark:text-text-main-dark">{config.llm_model}</span></div>}
          {config.db_id_filter && <div><span className="text-text-muted-DEFAULT dark:text-text-muted-dark">DB Filter: </span><span className="font-medium text-text-main-DEFAULT dark:text-text-main-dark">{config.db_id_filter}</span></div>}
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {metricCards.map(m => (
          <div key={m.label} className="bg-surface-light dark:bg-surface-dark rounded-xl border border-border-DEFAULT dark:border-border-dark p-5">
            <p className="text-sm text-text-muted-DEFAULT dark:text-text-muted-dark mb-2">{m.label}</p>
            <p className={cn('text-3xl font-bold', m.color)}>
              {(m.value || 0).toFixed(m.unit ? 3 : 1)}<span className="text-lg ml-1">{m.unit || '%'}</span>
            </p>
          </div>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Pass/Fail Pie */}
        <div className="bg-surface-light dark:bg-surface-dark rounded-xl border border-border-DEFAULT dark:border-border-dark p-6">
          <h3 className="text-lg font-semibold text-text-main-DEFAULT dark:text-text-main-dark mb-4">Pass / Fail (EX)</h3>
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={90} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                {pieData.map((e, i) => <Cell key={i} fill={e.color} />)}
              </Pie>
              <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px', color: '#fff' }} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Radar Chart */}
        <div className="bg-surface-light dark:bg-surface-dark rounded-xl border border-border-DEFAULT dark:border-border-dark p-6">
          <h3 className="text-lg font-semibold text-text-main-DEFAULT dark:text-text-main-dark mb-4">Radar — Hardness Profile</h3>
          <ResponsiveContainer width="100%" height={240}>
            <RadarChart data={radarData}>
              <PolarGrid stroke="#64748b" />
              <PolarAngleAxis dataKey="subject" tick={{ fill: '#94a3b8', fontSize: 11 }} />
              <PolarRadiusAxis domain={[0, 100]} tick={{ fill: '#64748b', fontSize: 10 }} />
              <Radar name="EM" dataKey="EM" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.15} />
              <Radar name="EX" dataKey="EX" stroke="#10b981" fill="#10b981" fillOpacity={0.15} />
              <Radar name="SL" dataKey="SL" stroke="#06b6d4" fill="#06b6d4" fillOpacity={0.15} />
              <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px', color: '#fff' }} />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Hardness Bar Chart */}
      <div className="bg-surface-light dark:bg-surface-dark rounded-xl border border-border-DEFAULT dark:border-border-dark p-6">
        <h3 className="text-lg font-semibold text-text-main-DEFAULT dark:text-text-main-dark mb-4">Accuracy by Hardness</h3>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={hardnessData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" className="dark:stroke-slate-700" />
            <XAxis dataKey="name" stroke="#9ca3af" style={{ fontSize: '11px' }} />
            <YAxis stroke="#9ca3af" style={{ fontSize: '11px' }} domain={[0, 100]} />
            <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px', color: '#fff' }} />
            <Bar dataKey="EM" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            <Bar dataKey="EX" fill="#10b981" radius={[4, 4, 0, 0]} />
            <Bar dataKey="SL" fill="#06b6d4" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
        <div className="flex items-center justify-center gap-4 mt-3">
          {[{ l: 'EM', c: 'bg-blue-500' }, { l: 'EX', c: 'bg-emerald-500' }, { l: 'SL', c: 'bg-cyan-500' }].map(x => (
            <div key={x.l} className="flex items-center gap-1.5"><div className={cn('w-3 h-3 rounded', x.c)} /><span className="text-xs text-text-muted-DEFAULT dark:text-text-muted-dark">{x.l}</span></div>
          ))}
        </div>
      </div>

      {/* Hardness Table */}
      <div className="bg-surface-light dark:bg-surface-dark rounded-xl border border-border-DEFAULT dark:border-border-dark overflow-hidden">
        <table className="w-full">
          <thead className="bg-surface-highlight-DEFAULT dark:bg-surface-highlight-dark border-b border-border-DEFAULT dark:border-border-dark">
            <tr>
              {['Hardness', 'Count', 'EM (%)', 'EX (%)', 'SL (%)'].map(h => (
                <th key={h} className="px-6 py-3 text-left text-xs font-semibold text-text-main-DEFAULT dark:text-text-main-dark uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border-DEFAULT dark:divide-border-dark">
            {hardnessData.map(h => (
              <tr key={h.name} className="hover:bg-surface-highlight-light dark:hover:bg-surface-highlight-dark">
                <td className="px-6 py-3 text-sm font-medium text-text-main-DEFAULT dark:text-text-main-dark capitalize">{h.name.replace('_', ' ')}</td>
                <td className="px-6 py-3 text-sm text-text-muted-DEFAULT dark:text-text-muted-dark">{h.count}</td>
                <td className="px-6 py-3 text-sm font-medium text-blue-600 dark:text-blue-400">{(h.EM || 0).toFixed(1)}%</td>
                <td className="px-6 py-3 text-sm font-medium text-emerald-600 dark:text-emerald-400">{(h.EX || 0).toFixed(1)}%</td>
                <td className="px-6 py-3 text-sm font-medium text-cyan-600 dark:text-cyan-400">{(h.SL || 0).toFixed(1)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Details Tab ─────────────────────────────────────────────────────────────

function DetailsTab({ results, search, setSearch, expandedRow, setExpandedRow, hardnessFilter, setHardnessFilter, emFilter, setEmFilter, exFilter, setExFilter }: {
  results: DetailedResult[]; search: string; setSearch: (s: string) => void;
  expandedRow: number | null; setExpandedRow: (i: number | null) => void;
  hardnessFilter: string; setHardnessFilter: (s: string) => void;
  emFilter: boolean; setEmFilter: (b: boolean) => void;
  exFilter: boolean; setExFilter: (b: boolean) => void;
}) {
  const filtered = useMemo(() => {
    let r = results;
    if (hardnessFilter !== 'all') r = r.filter(x => x.hardness === hardnessFilter);
    r = r.filter(x => x.em === (emFilter ? 1 : 0));
    r = r.filter(x => x.ex === (exFilter ? 1 : 0));
    if (search) { const q = search.toLowerCase(); r = r.filter(x => x.question.toLowerCase().includes(q) || x.db_id.toLowerCase().includes(q)); }
    return r;
  }, [results, search, hardnessFilter, emFilter, exFilter]);

  const hardnesses = ['all', ...Array.from(new Set(results.map(r => r.hardness)))];

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted-DEFAULT dark:text-text-muted-dark" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by question or database..." className="w-full pl-9 pr-8 py-2 bg-surface-light dark:bg-surface-dark border border-border-DEFAULT dark:border-border-dark rounded-lg text-sm text-text-main-DEFAULT dark:text-text-main-dark focus:outline-none focus:ring-2 focus:ring-primary/50" />
          {search && <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2"><X className="w-4 h-4 text-text-muted-DEFAULT" /></button>}
        </div>
        <div className="flex items-center gap-2 bg-surface-light dark:bg-surface-dark border border-border-DEFAULT dark:border-border-dark rounded-lg px-3 py-2">
          <Filter className="w-4 h-4 text-text-muted-DEFAULT dark:text-text-muted-dark" />
          <select value={hardnessFilter} onChange={e => setHardnessFilter(e.target.value)} className="bg-transparent text-sm text-text-main-DEFAULT dark:text-text-main-dark focus:outline-none">
            {hardnesses.map(h => <option key={h} value={h}>{h === 'all' ? 'All Hardness' : h.replace('_', ' ')}</option>)}
          </select>
        </div>

        <div className="flex items-center gap-4 bg-surface-light dark:bg-surface-dark border border-border-DEFAULT dark:border-border-dark rounded-lg px-4 py-2">
          <label className="flex items-center gap-2 cursor-pointer group">
            <div className={cn(
              "w-4 h-4 rounded border flex items-center justify-center transition-all",
              emFilter ? "bg-blue-500 border-blue-500 text-white" : "bg-transparent border-slate-300 dark:border-slate-600"
            )}>
              <input type="checkbox" className="hidden" checked={emFilter} onChange={() => setEmFilter(!emFilter)} />
              {emFilter && <CheckCircle2 className="w-3 h-3" />}
            </div>
            <span className={cn("text-sm font-medium transition-colors", emFilter ? "text-blue-600 dark:text-blue-400" : "text-text-muted-DEFAULT dark:text-text-muted-dark")}>EM Success</span>
          </label>

          <div className="w-px h-4 bg-border-DEFAULT dark:bg-border-dark" />

          <label className="flex items-center gap-2 cursor-pointer group">
            <div className={cn(
              "w-4 h-4 rounded border flex items-center justify-center transition-all",
              exFilter ? "bg-emerald-500 border-emerald-500 text-white" : "bg-transparent border-slate-300 dark:border-slate-600"
            )}>
              <input type="checkbox" className="hidden" checked={exFilter} onChange={() => setExFilter(!exFilter)} />
              {exFilter && <CheckCircle2 className="w-3 h-3" />}
            </div>
            <span className={cn("text-sm font-medium transition-colors", exFilter ? "text-emerald-600 dark:text-emerald-400" : "text-text-muted-DEFAULT dark:text-text-muted-dark")}>EX Success</span>
          </label>
        </div>
        <span className="text-sm text-text-muted-DEFAULT dark:text-text-muted-dark whitespace-nowrap">{filtered.length} results</span>
      </div>

      {/* Results List */}
      <div className="space-y-2">
        {filtered.map((r, i) => {
          const isExp = expandedRow === i;
          return (
            <div key={i} className="bg-surface-light dark:bg-surface-dark rounded-xl border border-border-DEFAULT dark:border-border-dark overflow-hidden">
              <button onClick={() => setExpandedRow(isExp ? null : i)} className="w-full px-5 py-3 flex items-center gap-3 text-left hover:bg-surface-highlight-light dark:hover:bg-surface-highlight-dark transition-colors">
                {isExp ? <ChevronDown className="w-4 h-4 text-text-muted-DEFAULT dark:text-text-muted-dark flex-shrink-0" /> : <ChevronRight className="w-4 h-4 text-text-muted-DEFAULT dark:text-text-muted-dark flex-shrink-0" />}
                <span className="text-xs font-mono px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 flex-shrink-0">{r.db_id}</span>
                <span className="text-sm text-text-main-DEFAULT dark:text-text-main-dark flex-1 truncate">{r.question}</span>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <HardnessBadge h={r.hardness} />
                  {r.ex === 1 ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <XCircle className="w-4 h-4 text-red-500" />}
                  <MetricPill label="EM" val={r.em} />
                  <MetricPill label="EX" val={r.ex} />
                  <span className="text-xs text-text-muted-DEFAULT dark:text-text-muted-dark w-14 text-right">{r.latency_s.toFixed(1)}s</span>
                </div>
              </button>
              {isExp && <ExpandedDetail r={r} />}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Failures Tab ────────────────────────────────────────────────────────────

function FailuresTab({ cases }: { cases: EvalResults['failed_cases'] }) {
  const [expandedRow, setExpandedRow] = useState<number | null>(null);

  if (cases.length === 0) return (
    <div className="flex items-center justify-center py-20">
      <div className="text-center"><CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-3" /><p className="text-text-muted-DEFAULT dark:text-text-muted-dark">No failed cases!</p></div>
    </div>
  );

  return (
    <div className="space-y-2">
      <p className="text-sm text-text-muted-DEFAULT dark:text-text-muted-dark">{cases.length} queries failed Execution Accuracy (EX=0)</p>
      {cases.map((c, i) => {
        const isExp = expandedRow === i;
        return (
          <div key={i} className="bg-surface-light dark:bg-surface-dark rounded-xl border border-red-200 dark:border-red-900/40 overflow-hidden">
            <button onClick={() => setExpandedRow(isExp ? null : i)} className="w-full px-5 py-3 flex items-center gap-3 text-left hover:bg-red-50/50 dark:hover:bg-red-950/20 transition-colors">
              {isExp ? <ChevronDown className="w-4 h-4 text-red-400 flex-shrink-0" /> : <ChevronRight className="w-4 h-4 text-red-400 flex-shrink-0" />}
              <XCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
              <span className="text-xs font-mono px-2 py-0.5 rounded bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 flex-shrink-0">{c.db_id}</span>
              <span className="text-sm text-text-main-DEFAULT dark:text-text-main-dark flex-1 truncate">{c.question}</span>
              <span className="text-xs text-text-muted-DEFAULT dark:text-text-muted-dark flex-shrink-0">SL: {(c.sl * 100).toFixed(0)}%</span>
            </button>
            {isExp && (
              <div className="px-5 pb-4 pt-2 space-y-4 border-t border-red-200 dark:border-red-900/30">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <SqlBlock label="Gold SQL" sql={c.gold_sql} variant="gold" />
                  <SqlBlock label="Predicted SQL" sql={c.pred_sql} variant="pred" />
                </div>
                {c.error && (
                  <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/40 rounded-lg p-3">
                    <p className="text-xs font-semibold text-red-700 dark:text-red-300 mb-1">Error Reason</p>
                    <p className="text-sm font-mono text-red-600 dark:text-red-400">{c.error}</p>
                  </div>
                )}
                <div className="flex gap-4 text-xs text-text-muted-DEFAULT dark:text-text-muted-dark">
                  <span>Schema Linkage: <strong className="text-cyan-600 dark:text-cyan-400">{(c.sl * 100).toFixed(1)}%</strong></span>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Shared Components ───────────────────────────────────────────────────────

function ExpandedDetail({ r }: { r: DetailedResult }) {
  return (
    <div className="px-5 pb-4 pt-2 space-y-4 border-t border-border-DEFAULT dark:border-border-dark">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <SqlBlock label="Gold SQL" sql={r.gold_sql} variant="gold" />
        <SqlBlock label="Predicted SQL" sql={r.pred_sql} variant="pred" />
      </div>
      {r.error && (
        <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/40 rounded-lg p-3">
          <p className="text-xs font-semibold text-red-700 dark:text-red-300 mb-1">Error Reason</p>
          <p className="text-sm font-mono text-red-600 dark:text-red-400">{r.error}</p>
        </div>
      )}
      <div className="flex flex-wrap gap-4 text-xs text-text-muted-DEFAULT dark:text-text-muted-dark">
        <span>Exact Match: <strong className={r.em ? 'text-blue-600 dark:text-blue-400' : 'text-red-500'}>{r.em}</strong></span>
        <span>Execution Accuracy: <strong className={r.ex ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'}>{r.ex}</strong></span>
        <span>Schema Linkage: <strong className="text-cyan-600 dark:text-cyan-400">{(r.sl * 100).toFixed(1)}%</strong></span>
        <span>Hardness: <strong>{r.hardness}</strong></span>
        <span>Complexity: <strong>{r.complexity_score.toFixed(1)}</strong></span>
        <span>Latency: <strong>{r.latency_s.toFixed(2)}s</strong></span>
      </div>
    </div>
  );
}

function SqlBlock({ label, sql, variant }: { label: string; sql: string | null; variant: 'gold' | 'pred' }) {
  const bg = variant === 'gold' ? 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/30' : 'bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800/30';
  const labelColor = variant === 'gold' ? 'text-emerald-700 dark:text-emerald-300' : 'text-blue-700 dark:text-blue-300';

  // Basic SQL formatting for readability, especially for Gold SQL which is often a single line
  const formattedSql = useMemo(() => {
    if (!sql) return '(no SQL generated)';
    if (sql.includes('\n')) return sql; // If it has newlines, assume it's already formatted
    return sql
      .replace(/\b(SELECT|FROM|WHERE|JOIN|GROUP BY|ORDER BY|HAVING|LIMIT|UNION|INTERSECT|EXCEPT)\b/g, '\n$1')
      .trim();
  }, [sql]);

  return (
    <div className={cn('rounded-lg border p-3 flex flex-col', bg)}>
      <p className={cn('text-xs font-semibold mb-1.5', labelColor)}>{label}</p>
      <pre className="text-xs font-mono text-text-main-DEFAULT dark:text-text-main-dark whitespace-pre-wrap overflow-x-auto max-h-60 overflow-y-auto flex-1">{formattedSql}</pre>
    </div>
  );
}

function MetricPill({ label, val }: { label: string; val: number }) {
  return (
    <span className={cn('text-xs px-1.5 py-0.5 rounded font-medium', val ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300' : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300')}>
      {label}:{val}
    </span>
  );
}

function HardnessBadge({ h }: { h: string }) {
  const colors: Record<string, string> = {
    easy: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300',
    medium: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300',
    hard: 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300',
    extra_hard: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300',
  };
  return <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium capitalize', colors[h] || 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400')}>{h.replace('_', ' ')}</span>;
}
