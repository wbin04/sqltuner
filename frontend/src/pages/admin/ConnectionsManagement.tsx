import { useState, useEffect } from 'react';
import { Search, Database, Server, HardDrive, RefreshCw, AlertCircle, Table2 } from 'lucide-react';
import { cn } from '../../lib/utils';
import { adminService, AdminConnection } from '../../services/adminService';

export function ConnectionsManagement() {
  const [connections, setConnections] = useState<AdminConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchConnections = async (search?: string) => {
    try {
      setLoading(true);
      setError(null);
      const data = await adminService.getConnections(search || undefined);
      setConnections(data);
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Failed to load connections');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConnections();
  }, []);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchConnections(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const totalConnections = connections.length;
  const postgresCount = connections.filter(c => c.db_type === 'postgres').length;
  const mysqlCount = connections.filter(c => c.db_type === 'mysql').length;
  const simulationCount = connections.filter(c => c.db_type === 'simulation').length;

  const getDbTypeIcon = (type: string) => {
    switch (type) {
      case 'postgres': return <Server className="w-4 h-4" />;
      case 'mysql': return <Database className="w-4 h-4" />;
      case 'simulation': return <HardDrive className="w-4 h-4" />;
      default: return <Database className="w-4 h-4" />;
    }
  };

  const getDbTypeBadge = (type: string) => {
    switch (type) {
      case 'postgres':
        return 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300';
      case 'mysql':
        return 'bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300';
      case 'simulation':
        return 'bg-cyan-100 dark:bg-cyan-900/30 text-cyan-800 dark:text-cyan-300';
      default:
        return 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300';
    }
  };

  if (loading && connections.length === 0) {
    return (
      <div className="p-6 flex items-center justify-center h-full">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="w-8 h-8 text-primary dark:text-primary-dark animate-spin" />
          <p className="text-text-muted-DEFAULT dark:text-text-muted-dark">Loading connections...</p>
        </div>
      </div>
    );
  }

  if (error && connections.length === 0) {
    return (
      <div className="p-6 flex items-center justify-center h-full">
        <div className="flex flex-col items-center gap-3 text-center">
          <AlertCircle className="w-8 h-8 text-red-500" />
          <p className="text-red-600 dark:text-red-400">{error}</p>
          <button
            onClick={() => fetchConnections()}
            className="px-4 py-2 bg-primary dark:bg-primary-dark text-white rounded-lg hover:bg-primary-hover dark:hover:bg-primary-dark-hover transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-text-main-DEFAULT dark:text-text-main-dark">
            Database Connections
          </h1>
          <p className="text-text-muted-DEFAULT dark:text-text-muted-dark mt-1">
            Overview of all database connections across the platform
          </p>
        </div>
        <button
          onClick={() => fetchConnections(searchQuery)}
          className="px-3 py-2 bg-surface-light dark:bg-surface-dark border border-border-DEFAULT dark:border-border-dark rounded-lg hover:bg-blue-50 dark:hover:bg-slate-800 transition-colors text-text-muted-DEFAULT dark:text-text-muted-dark"
          title="Refresh"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-surface-light dark:bg-surface-dark rounded-lg border border-border-DEFAULT dark:border-border-dark p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-lg flex items-center justify-center">
              <Database className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-2xl font-bold text-text-main-DEFAULT dark:text-text-main-dark">
                {totalConnections}
              </p>
              <p className="text-sm text-text-muted-DEFAULT dark:text-text-muted-dark">Total</p>
            </div>
          </div>
        </div>
        <div className="bg-surface-light dark:bg-surface-dark rounded-lg border border-border-DEFAULT dark:border-border-dark p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-500/10 rounded-lg flex items-center justify-center">
              <Server className="w-5 h-5 text-blue-500" />
            </div>
            <div>
              <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                {postgresCount}
              </p>
              <p className="text-sm text-text-muted-DEFAULT dark:text-text-muted-dark">PostgreSQL</p>
            </div>
          </div>
        </div>
        <div className="bg-surface-light dark:bg-surface-dark rounded-lg border border-border-DEFAULT dark:border-border-dark p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-orange-500/10 rounded-lg flex items-center justify-center">
              <Database className="w-5 h-5 text-orange-500" />
            </div>
            <div>
              <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                {mysqlCount}
              </p>
              <p className="text-sm text-text-muted-DEFAULT dark:text-text-muted-dark">MySQL</p>
            </div>
          </div>
        </div>
        <div className="bg-surface-light dark:bg-surface-dark rounded-lg border border-border-DEFAULT dark:border-border-dark p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-cyan-500/10 rounded-lg flex items-center justify-center">
              <HardDrive className="w-5 h-5 text-cyan-500" />
            </div>
            <div>
              <p className="text-2xl font-bold text-cyan-600 dark:text-cyan-400">
                {simulationCount}
              </p>
              <p className="text-sm text-text-muted-DEFAULT dark:text-text-muted-dark">Simulation</p>
            </div>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="bg-surface-light dark:bg-surface-dark rounded-xl border border-border-DEFAULT dark:border-border-dark p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-text-muted-DEFAULT dark:text-text-muted-dark" />
          <input
            type="text"
            placeholder="Search by connection name or user email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-background-light dark:bg-background-dark border border-border-DEFAULT dark:border-border-dark rounded-lg text-text-main-DEFAULT dark:text-text-main-dark placeholder:text-text-muted-DEFAULT dark:placeholder:text-text-muted-dark focus:outline-none focus:ring-2 focus:ring-primary/50 dark:focus:ring-primary-dark/50"
          />
        </div>
      </div>

      {/* Connections Table */}
      <div className="bg-surface-light dark:bg-surface-dark rounded-xl border border-border-DEFAULT dark:border-border-dark overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-surface-highlight-DEFAULT dark:bg-surface-highlight-dark border-b border-border-DEFAULT dark:border-border-dark">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-text-main-DEFAULT dark:text-text-main-dark uppercase tracking-wider">
                  Connection
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-text-main-DEFAULT dark:text-text-main-dark uppercase tracking-wider">
                  Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-text-main-DEFAULT dark:text-text-main-dark uppercase tracking-wider">
                  Owner
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-text-main-DEFAULT dark:text-text-main-dark uppercase tracking-wider">
                  Host
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-text-main-DEFAULT dark:text-text-main-dark uppercase tracking-wider">
                  Database
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-text-main-DEFAULT dark:text-text-main-dark uppercase tracking-wider">
                  Tables
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-text-main-DEFAULT dark:text-text-main-dark uppercase tracking-wider">
                  Created
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-DEFAULT dark:divide-border-dark">
              {connections.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-text-muted-DEFAULT dark:text-text-muted-dark">
                    No connections found
                  </td>
                </tr>
              ) : (
                connections.map((conn) => (
                  <tr 
                    key={conn.id}
                    className="hover:bg-surface-highlight-light dark:hover:bg-surface-highlight-dark transition-colors"
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-lg flex items-center justify-center text-white">
                          {getDbTypeIcon(conn.db_type)}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-text-main-DEFAULT dark:text-text-main-dark">
                            {conn.name}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={cn(
                        'inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium capitalize',
                        getDbTypeBadge(conn.db_type)
                      )}>
                        {getDbTypeIcon(conn.db_type)}
                        {conn.db_type}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 bg-gradient-to-br from-primary to-cyan-500 dark:from-primary-dark dark:to-cyan-400 rounded-full flex items-center justify-center text-white text-xs font-bold">
                          {conn.user_email.charAt(0).toUpperCase()}
                        </div>
                        <span className="text-sm text-text-muted-DEFAULT dark:text-text-muted-dark">
                          {conn.user_email}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-text-muted-DEFAULT dark:text-text-muted-dark">
                      {conn.host ? `${conn.host}:${conn.port || 5432}` : (
                        <span className="text-slate-400 dark:text-slate-600 italic">local</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-text-main-DEFAULT dark:text-text-main-dark">
                      {conn.db_name || (
                        <span className="text-slate-400 dark:text-slate-600 italic">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1.5">
                        <Table2 className="w-4 h-4 text-text-muted-DEFAULT dark:text-text-muted-dark" />
                        <span className="text-sm font-medium text-text-main-DEFAULT dark:text-text-main-dark">
                          {conn.tables_count}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-text-muted-DEFAULT dark:text-text-muted-dark whitespace-nowrap">
                      {new Date(conn.created_at).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
