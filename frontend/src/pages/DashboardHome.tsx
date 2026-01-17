import React from 'react';
import { 
  Database, 
  FlaskConical, 
  Activity, 
  Clock, 
  AlertCircle,
  CheckCircle2,
  TrendingUp,
  Zap
} from 'lucide-react';
import { cn } from '../lib/utils';
import type { Workspace } from '../types';

// Mock Data
const mockWorkspaces: Workspace[] = [
  {
    id: '1',
    name: 'Production DB',
    type: 'real',
    tableCount: 45,
    lastSync: '2026-01-17T10:30:00Z',
    status: 'active',
    description: 'Main production database'
  },
  {
    id: '2',
    name: 'Analytics Warehouse',
    type: 'real',
    tableCount: 128,
    lastSync: '2026-01-17T09:15:00Z',
    status: 'active',
    description: 'Data warehouse for analytics'
  },
  {
    id: '3',
    name: 'Test Sandbox',
    type: 'simulation',
    tableCount: 12,
    lastSync: '2026-01-16T14:20:00Z',
    status: 'idle',
    description: 'Testing environment'
  },
  {
    id: '4',
    name: 'Customer DB Mirror',
    type: 'real',
    tableCount: 67,
    lastSync: '2026-01-17T11:00:00Z',
    status: 'active',
    description: 'Customer database replica'
  },
];

// Hero Card Component
interface HeroCardProps {
  title: string;
  description: string;
  icon: React.ElementType;
  gradient: string;
  onClick: () => void;
}

function HeroCard({ title, description, icon: Icon, gradient, onClick }: HeroCardProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'relative overflow-hidden rounded-xl p-8 text-left transition-all duration-300',
        'bg-surface dark:bg-surface-dark border border-border dark:border-border-dark',
        'hover:scale-[1.02] hover:border-primary/50 dark:hover:border-primary-dark/50 hover:shadow-lg hover:shadow-primary/20 dark:hover:shadow-primary-dark/20',
        'group'
      )}
    >
      {/* Gradient Background */}
      <div className={cn(
        'absolute inset-0 opacity-0 group-hover:opacity-10 transition-opacity duration-300',
        gradient
      )} />
      
      {/* Content */}
      <div className="relative z-10">
        <div className="mb-4">
          <div className={cn(
            'inline-flex p-3 rounded-lg',
            'bg-gradient-to-br',
            gradient
          )}>
            <Icon className="w-8 h-8 text-white" />
          </div>
        </div>
        
        <h3 className="text-2xl font-bold text-text-main-DEFAULT dark:text-text-main-dark mb-2">
          {title}
        </h3>
        <p className="text-text-muted-DEFAULT dark:text-text-muted-dark">
          {description}
        </p>
      </div>

      {/* Glow Effect */}
      <div className={cn(
        'absolute bottom-0 left-0 right-0 h-1',
        'bg-gradient-to-r opacity-0 group-hover:opacity-100 transition-opacity',
        gradient
      )} />
    </button>
  );
}

// Workspace Card Component
interface WorkspaceCardProps {
  workspace: Workspace;
}

function WorkspaceCard({ workspace }: WorkspaceCardProps) {
  const statusConfig = {
    active: { icon: CheckCircle2, color: 'text-green-400', bgColor: 'bg-green-400/10' },
    idle: { icon: Clock, color: 'text-yellow-400', bgColor: 'bg-yellow-400/10' },
    error: { icon: AlertCircle, color: 'text-red-400', bgColor: 'bg-red-400/10' },
  };

  const config = statusConfig[workspace.status];
  const StatusIcon = config.icon;

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
    return `${Math.floor(diffMins / 1440)}d ago`;
  };

  return (
    <div className={cn(
      'bg-surface dark:bg-surface-dark border border-border dark:border-border-dark rounded-lg p-6',
      'hover:border-primary/30 dark:hover:border-primary-dark/30 hover:shadow-lg hover:shadow-primary/10 dark:hover:shadow-primary-dark/10',
      'transition-all duration-300 cursor-pointer',
      'hover:scale-[1.01]'
    )}>
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-lg font-semibold text-text-main-DEFAULT dark:text-text-main-dark">
              {workspace.name}
            </h3>
            {workspace.type === 'simulation' && (
              <span className="px-2 py-0.5 text-xs font-medium rounded bg-secondary/20 dark:bg-secondary-dark/20 text-secondary dark:text-secondary-dark border border-secondary/30 dark:border-secondary-dark/30">
                Sandbox
              </span>
            )}
          </div>
          {workspace.description && (
            <p className="text-sm text-text-muted-DEFAULT dark:text-text-muted-dark">
              {workspace.description}
            </p>
          )}
        </div>
        
        {/* Status Badge */}
        <div className={cn('p-2 rounded-lg', config.bgColor)}>
          <StatusIcon className={cn('w-4 h-4', config.color)} />
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 pt-4 border-t border-border dark:border-border-dark">
        <div>
          <p className="text-xs text-text-muted-DEFAULT dark:text-text-muted-dark mb-1">Tables</p>
          <p className="text-xl font-bold text-text-main-DEFAULT dark:text-text-main-dark">{workspace.tableCount}</p>
        </div>
        <div>
          <p className="text-xs text-text-muted-DEFAULT dark:text-text-muted-dark mb-1">Last Sync</p>
          <p className="text-sm font-medium text-text-main-DEFAULT dark:text-text-main-dark">
            {formatDate(workspace.lastSync)}
          </p>
        </div>
      </div>
    </div>
  );
}

// Stat Card Component
interface StatCardProps {
  label: string;
  value: string | number;
  icon: React.ElementType;
  trend?: string;
}

function StatCard({ label, value, icon: Icon, trend }: StatCardProps) {
  return (
    <div className="bg-surface dark:bg-surface-dark border border-border dark:border-border-dark rounded-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="p-2 rounded-lg bg-primary/10 dark:bg-primary-dark/10">
          <Icon className="w-5 h-5 text-primary dark:text-primary-dark" />
        </div>
        {trend && (
          <div className="flex items-center gap-1 text-green-400 text-sm">
            <TrendingUp className="w-4 h-4" />
            <span>{trend}</span>
          </div>
        )}
      </div>
      <p className="text-text-muted-DEFAULT dark:text-text-muted-dark text-sm mb-1">{label}</p>
      <p className="text-3xl font-bold text-text-main-DEFAULT dark:text-text-main-dark">{value}</p>
    </div>
  );
}

// Main Dashboard Component
export function DashboardHome() {
  return (
    <div className="min-h-screen bg-background dark:bg-background-dark p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <header className="space-y-2">
          <h1 className="text-4xl font-bold text-text-main-DEFAULT dark:text-text-main-dark">
            Workspace Hub
          </h1>
          <p className="text-text-muted-DEFAULT dark:text-text-muted-dark text-lg">
            Manage your database connections and optimization workspaces
          </p>
        </header>

        {/* Hero Section - Quick Actions */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <HeroCard
            title="Connect Real Database"
            description="Connect to your production or staging database for real-time optimization"
            icon={Database}
            gradient="from-primary to-blue-600"
            onClick={() => console.log('Connect Real DB')}
          />
          <HeroCard
            title="Create Sandbox"
            description="Spin up a simulation environment to test queries safely"
            icon={FlaskConical}
            gradient="from-secondary to-purple-600"
            onClick={() => console.log('Create Sandbox')}
          />
        </section>

        {/* Stats Overview */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <StatCard
            label="Total Workspaces"
            value={mockWorkspaces.length}
            icon={Database}
          />
          <StatCard
            label="Active Connections"
            value={mockWorkspaces.filter(w => w.status === 'active').length}
            icon={Activity}
            trend="+2"
          />
          <StatCard
            label="Queries Optimized"
            value="1,234"
            icon={Zap}
            trend="+15%"
          />
        </section>

        {/* Workspaces Grid */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-text-main-DEFAULT dark:text-text-main-dark">
              Your Workspaces
            </h2>
            <button className="px-4 py-2 bg-primary dark:bg-primary-dark hover:bg-primary-hover dark:hover:bg-primary-dark-hover rounded-lg text-white font-medium transition-colors">
              + New Workspace
            </button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {mockWorkspaces.map((workspace) => (
              <WorkspaceCard key={workspace.id} workspace={workspace} />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
