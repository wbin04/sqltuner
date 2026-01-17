import { Users, Database, Clock, MessageSquare } from 'lucide-react';
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

// Mock Data
const statsData = [
  {
    title: 'Total Users',
    value: '1,234',
    icon: Users,
    change: '+12% from last month',
    color: 'from-blue-500 to-blue-600',
  },
  {
    title: 'Queries Today',
    value: '8,547',
    icon: Database,
    change: '+23% from yesterday',
    color: 'from-green-500 to-green-600',
  },
  {
    title: 'Avg Response Time',
    value: '1.2s',
    icon: Clock,
    change: '-8% improvement',
    color: 'from-orange-500 to-orange-600',
  },
  {
    title: 'Pending Reviews',
    value: '42',
    icon: MessageSquare,
    change: '12 new today',
    color: 'from-purple-500 to-purple-600',
  },
];

const queriesPerHourData = [
  { hour: '00:00', queries: 120 },
  { hour: '03:00', queries: 80 },
  { hour: '06:00', queries: 150 },
  { hour: '09:00', queries: 450 },
  { hour: '12:00', queries: 680 },
  { hour: '15:00', queries: 520 },
  { hour: '18:00', queries: 380 },
  { hour: '21:00', queries: 240 },
];

const satisfactionData = [
  { date: 'Mon', thumbsUp: 120, thumbsDown: 15 },
  { date: 'Tue', thumbsUp: 150, thumbsDown: 12 },
  { date: 'Wed', thumbsUp: 180, thumbsDown: 20 },
  { date: 'Thu', thumbsUp: 165, thumbsDown: 10 },
  { date: 'Fri', thumbsUp: 200, thumbsDown: 18 },
  { date: 'Sat', thumbsUp: 140, thumbsDown: 8 },
  { date: 'Sun', thumbsUp: 110, thumbsDown: 5 },
];

export function AdminDashboard() {
  return (
    <div className="p-6 space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold text-text-main-DEFAULT dark:text-text-main-dark">
          System Overview
        </h1>
        <p className="text-text-muted-DEFAULT dark:text-text-muted-dark mt-1">
          Monitor your SQLTuner platform performance
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statsData.map((stat) => {
          const Icon = stat.icon;
          return (
            <div
              key={stat.title}
              className="bg-surface-DEFAULT dark:bg-surface-dark rounded-xl border border-border-DEFAULT dark:border-border-dark p-6 hover:shadow-lg transition-shadow"
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
                <p className="text-xs text-green-600 dark:text-green-400">
                  {stat.change}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Queries per Hour Chart */}
        <div className="bg-surface-DEFAULT dark:bg-surface-dark rounded-xl border border-border-DEFAULT dark:border-border-dark p-6">
          <h3 className="text-lg font-semibold text-text-main-DEFAULT dark:text-text-main-dark mb-4">
            Queries per Hour (Today)
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={queriesPerHourData}>
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
        <div className="bg-surface-DEFAULT dark:bg-surface-dark rounded-xl border border-border-DEFAULT dark:border-border-dark p-6">
          <h3 className="text-lg font-semibold text-text-main-DEFAULT dark:text-text-main-dark mb-4">
            User Satisfaction Trend (This Week)
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={satisfactionData}>
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
              <Bar dataKey="thumbsUp" fill="#10b981" radius={[8, 8, 0, 0]} />
              <Bar dataKey="thumbsDown" fill="#ef4444" radius={[8, 8, 0, 0]} />
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
      <div className="bg-surface-DEFAULT dark:bg-surface-dark rounded-xl border border-border-DEFAULT dark:border-border-dark p-6">
        <h3 className="text-lg font-semibold text-text-main-DEFAULT dark:text-text-main-dark mb-4">
          Recent Activity
        </h3>
        <div className="space-y-3">
          {[
            { user: 'john@example.com', action: 'submitted feedback', time: '2 minutes ago' },
            { user: 'sarah@example.com', action: 'executed query optimization', time: '5 minutes ago' },
            { user: 'mike@example.com', action: 'connected new database', time: '12 minutes ago' },
            { user: 'emma@example.com', action: 'corrected SQL suggestion', time: '18 minutes ago' },
          ].map((activity, idx) => (
            <div 
              key={idx}
              className="flex items-center justify-between py-3 px-4 rounded-lg hover:bg-surface-highlight-DEFAULT dark:hover:bg-surface-highlight-dark transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-gradient-to-br from-primary to-secondary dark:from-primary-dark dark:to-secondary-dark rounded-full flex items-center justify-center text-white text-xs font-bold">
                  {activity.user.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="text-sm text-text-main-DEFAULT dark:text-text-main-dark">
                    <span className="font-medium">{activity.user}</span> {activity.action}
                  </p>
                </div>
              </div>
              <span className="text-xs text-text-muted-DEFAULT dark:text-text-muted-dark">
                {activity.time}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
