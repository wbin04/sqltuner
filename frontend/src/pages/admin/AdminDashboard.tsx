import { useEffect, useState } from 'react';
import { Users, Database, Clock, MessageSquare, RefreshCw, AlertCircle } from 'lucide-react';
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { adminService, DashboardResponse } from '../../services/adminService';

export function AdminDashboard() {
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboard = async () => {
    try {
      setLoading(true);
      setError(null);
      const resp = await adminService.getDashboard();
      setData(resp);
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, []);

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center h-full">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="w-8 h-8 text-primary dark:text-primary-dark animate-spin" />
          <p className="text-text-muted-DEFAULT dark:text-text-muted-dark">Loading overview...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 flex items-center justify-center h-full">
        <div className="flex flex-col items-center gap-3 text-center">
          <AlertCircle className="w-8 h-8 text-red-500" />
          <p className="text-red-600 dark:text-red-400">{error}</p>
          <button
            onClick={fetchDashboard}
            className="px-4 py-2 bg-primary dark:bg-primary-dark text-white rounded-lg hover:bg-primary-hover dark:hover:bg-primary-dark-hover transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const { stats, queries_per_hour, satisfaction_trend, recent_activity } = data;

  const statsCards = [
    {
      title: 'Total Users',
      value: stats.total_users.toLocaleString(),
      subtext: `${stats.active_users} active`,
      icon: Users,
      color: 'from-blue-500 to-blue-600',
    },
    {
      title: 'Total Queries',
      value: stats.total_queries.toLocaleString(),
      subtext: `${stats.total_conversations} conversations`,
      icon: Database,
      color: 'from-cyan-500 to-teal-500',
    },
    {
      title: 'DB Connections',
      value: stats.total_connections.toLocaleString(),
      subtext: 'across all users',
      icon: Clock,
      color: 'from-emerald-500 to-green-600',
    },
    {
      title: 'Feedbacks',
      value: stats.total_feedbacks.toLocaleString(),
      subtext: `👍 ${stats.thumbs_up}  👎 ${stats.thumbs_down}`,
      icon: MessageSquare,
      color: 'from-indigo-500 to-blue-600',
    },
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-text-main-DEFAULT dark:text-text-main-dark">
            System Overview
          </h1>
          <p className="text-text-muted-DEFAULT dark:text-text-muted-dark mt-1">
            Monitor your SQLTuner platform performance
          </p>
        </div>
        <button
          onClick={fetchDashboard}
          className="px-3 py-2 bg-surface-light dark:bg-surface-dark border border-border-DEFAULT dark:border-border-dark rounded-lg hover:bg-blue-50 dark:hover:bg-slate-800 transition-colors text-text-muted-DEFAULT dark:text-text-muted-dark"
          title="Refresh"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statsCards.map((stat) => {
          const Icon = stat.icon;
          return (
            <div
              key={stat.title}
              className="bg-surface-light dark:bg-surface-dark rounded-xl border border-border-DEFAULT dark:border-border-dark p-6 hover:shadow-lg transition-shadow"
            >
              <div className="flex items-start justify-between mb-4">
                <div className={`w-12 h-12 bg-gradient-to-br ${stat.color} rounded-lg flex items-center justify-center shadow-lg`}>
                  <Icon className="w-6 h-6 text-white" />
                </div>
              </div>
              <div>
                <p className="text-sm text-text-muted-DEFAULT dark:text-text-muted-dark mb-1">
                  {stat.title}
                </p>
                <p className="text-3xl font-bold text-text-main-DEFAULT dark:text-text-main-dark mb-2">
                  {stat.value}
                </p>
                <p className="text-xs text-blue-600 dark:text-blue-400">
                  {stat.subtext}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Queries per Hour Chart */}
        <div className="bg-surface-light dark:bg-surface-dark rounded-xl border border-border-DEFAULT dark:border-border-dark p-6">
          <h3 className="text-lg font-semibold text-text-main-DEFAULT dark:text-text-main-dark mb-4">
            Queries per Hour (Last 24h)
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={queries_per_hour}>
              <defs>
                <linearGradient id="colorQueries" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" className="dark:stroke-slate-700" />
              <XAxis 
                dataKey="hour" 
                stroke="#9ca3af" 
                style={{ fontSize: '12px' }}
              />
              <YAxis 
                stroke="#9ca3af" 
                style={{ fontSize: '12px' }}
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: '#1f2937', 
                  border: 'none', 
                  borderRadius: '8px',
                  color: '#fff'
                }}
              />
              <Area 
                type="monotone" 
                dataKey="queries" 
                stroke="#3b82f6" 
                strokeWidth={2}
                fillOpacity={1} 
                fill="url(#colorQueries)" 
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* User Satisfaction Chart */}
        <div className="bg-surface-light dark:bg-surface-dark rounded-xl border border-border-DEFAULT dark:border-border-dark p-6">
          <h3 className="text-lg font-semibold text-text-main-DEFAULT dark:text-text-main-dark mb-4">
            User Satisfaction Trend (Last 7 Days)
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={satisfaction_trend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" className="dark:stroke-slate-700" />
              <XAxis 
                dataKey="date" 
                stroke="#9ca3af" 
                style={{ fontSize: '12px' }}
              />
              <YAxis 
                stroke="#9ca3af" 
                style={{ fontSize: '12px' }}
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: '#1f2937', 
                  border: 'none', 
                  borderRadius: '8px',
                  color: '#fff'
                }}
              />
              <Bar dataKey="thumbs_up" name="Thumbs Up" fill="#10b981" radius={[8, 8, 0, 0]} />
              <Bar dataKey="thumbs_down" name="Thumbs Down" fill="#ef4444" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
          <div className="flex items-center justify-center gap-6 mt-4">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-green-500 rounded"></div>
              <span className="text-sm text-text-muted-DEFAULT dark:text-text-muted-dark">
                Thumbs Up
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-red-500 rounded"></div>
              <span className="text-sm text-text-muted-DEFAULT dark:text-text-muted-dark">
                Thumbs Down
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-surface-light dark:bg-surface-dark rounded-xl border border-border-DEFAULT dark:border-border-dark p-6">
        <h3 className="text-lg font-semibold text-text-main-DEFAULT dark:text-text-main-dark mb-4">
          Recent Activity
        </h3>
        {recent_activity.length === 0 ? (
          <p className="text-sm text-text-muted-DEFAULT dark:text-text-muted-dark text-center py-8">
            No recent activity found
          </p>
        ) : (
          <div className="space-y-3">
            {recent_activity.map((activity, idx) => (
              <div 
                key={idx}
                className="flex items-center justify-between py-3 px-4 rounded-lg hover:bg-surface-highlight-light dark:hover:bg-surface-highlight-dark transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-gradient-to-br from-primary to-cyan-500 dark:from-primary-dark dark:to-cyan-400 rounded-full flex items-center justify-center text-white text-xs font-bold">
                    {activity.user_email.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm text-text-main-DEFAULT dark:text-text-main-dark">
                      <span className="font-medium">{activity.user_email}</span> {activity.action}
                    </p>
                  </div>
                </div>
                <span className="text-xs text-text-muted-DEFAULT dark:text-text-muted-dark">
                  {activity.time}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
