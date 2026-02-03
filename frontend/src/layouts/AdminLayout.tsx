import { ReactNode } from 'react';
import { LayoutDashboard, Users, Brain, Database, Settings, LogOut } from 'lucide-react';
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
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'users', label: 'User Management', icon: Users },
    { id: 'feedback', label: 'AI Training (RLHF)', icon: Brain },
    { id: 'connections', label: 'DB Connections', icon: Database },
    { id: 'settings', label: 'System Config', icon: Settings },
  ];

  return (
    <div className="flex h-screen bg-background-light dark:bg-background-dark">
      {/* Sidebar */}
      <aside className="w-64 bg-purple-50 dark:bg-purple-950/20 border-r border-purple-200 dark:border-purple-800/30 flex flex-col">
        {/* Logo */}
        <div className="p-6 border-b border-purple-200 dark:border-purple-800/30">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl flex items-center justify-center shadow-lg">
              <Settings className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-purple-900 dark:text-purple-100">
                Admin Portal
              </h1>
              <p className="text-xs text-purple-600 dark:text-purple-400">SQLTuner</p>
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
                    ? 'bg-purple-500 text-white shadow-lg shadow-purple-500/30'
                    : 'text-purple-700 dark:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-900/30'
                )}
              >
                <Icon className="w-5 h-5" />
                <span className="font-medium text-sm">{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Admin User Section */}
        <div className="p-4 border-t border-purple-200 dark:border-purple-800/30">
          <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-purple-100 dark:bg-purple-900/30">
            <ThemeToggle />
            <div className="flex-1">
              <p className="text-sm font-medium text-purple-900 dark:text-purple-100">Admin</p>
              <p className="text-xs text-purple-600 dark:text-purple-400">admin@gmail.com</p>
            </div>
            <button 
              onClick={onLogout}
              className="text-purple-600 dark:text-purple-400 hover:text-red-500 dark:hover:text-red-400 transition-colors"
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
