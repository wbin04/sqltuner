import { ReactNode } from 'react';
import { LayoutDashboard, Users, Brain, Database, Settings, LogOut, FlaskConical } from 'lucide-react';
import { cn } from '../lib/utils';
import { ThemeToggle } from '../components/ui/ThemeToggle';

interface AdminLayoutProps {
  children: ReactNode;
  currentPage: string;
  onNavigate: (page: string) => void;
  onLogout: () => void;
}

export function AdminLayout({ children, currentPage, onNavigate, onLogout }: AdminLayoutProps) {
  const menuItems = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'evaluation', label: 'Evaluation Dashboard', icon: FlaskConical },
    { id: 'users', label: 'User Management', icon: Users },
    { id: 'connections', label: 'DB Connections', icon: Database },
    // add here
    { id: 'feedback', label: 'AI Training (RLHF)', icon: Brain },
    { id: 'settings', label: 'System Config', icon: Settings },
  ];

  return (
    <div className="flex h-screen bg-background-light dark:bg-background-dark">
      {/* Sidebar */}
      <aside className="w-64 bg-blue-50 dark:bg-slate-900/60 border-r border-blue-200 dark:border-slate-700/50 flex flex-col">
        {/* Logo */}
        <div className="p-6 border-b border-blue-200 dark:border-slate-700/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/25">
              <Settings className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                Admin Portal
              </h1>
              <p className="text-xs text-blue-600 dark:text-blue-400">SQLTuner</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-1">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentPage === item.id;

            return (
              <button
                key={item.id}
                onClick={() => onNavigate(item.id)}
                className={cn(
                  'w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all',
                  isActive
                    ? 'bg-primary dark:bg-primary-dark text-white shadow-lg shadow-blue-500/30'
                    : 'text-slate-700 dark:text-slate-300 hover:bg-blue-100 dark:hover:bg-slate-800/60'
                )}
              >
                <Icon className="w-5 h-5" />
                <span className="font-medium text-sm">{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Admin User Section */}
        <div className="p-4 border-t border-blue-200 dark:border-slate-700/50">
          <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-blue-100 dark:bg-slate-800/60">
            <ThemeToggle />
            <div className="flex-1">
              <p className="text-sm font-medium text-slate-900 dark:text-slate-100">Admin</p>
              <p className="text-xs text-blue-600 dark:text-blue-400">admin@gmail.com</p>
            </div>
            <button
              onClick={onLogout}
              className="text-slate-500 dark:text-slate-400 hover:text-red-500 dark:hover:text-red-400 transition-colors"
              title="Logout"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Topbar */}
        <header className="h-16 border-b border-border-DEFAULT dark:border-border-dark bg-surface-light dark:bg-surface-dark px-6 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-text-muted-DEFAULT dark:text-text-muted-dark">
            <span>Admin</span>
            <span>/</span>
            <span className="text-text-main-DEFAULT dark:text-text-main-dark font-medium capitalize">
              {currentPage}
            </span>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-sm text-text-muted-DEFAULT dark:text-text-muted-dark">
              {new Date().toLocaleDateString('en-US', {
                weekday: 'short',
                year: 'numeric',
                month: 'short',
                day: 'numeric'
              })}
            </div>
          </div>
        </header>

        {/* Page Content */}
        <div className="flex-1 overflow-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
