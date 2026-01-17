import { 
  LayoutDashboard, 
  Database, 
  Zap, 
  Settings, 
  FileText,
  LogOut
} from 'lucide-react';
import { cn } from '../lib/utils';
import { ThemeToggle } from '../components/ui/ThemeToggle';

interface MainLayoutProps {
  children: React.ReactNode;
  currentPage?: string;
  onNavigate?: (page: string) => void;
  onLogout?: () => void;
}

interface MenuItem {
  id: string;
  label: string;
  icon: React.ElementType;
  path: string;
}

const menuItems: MenuItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, path: '/' },
  { id: 'workspaces', label: 'Workspaces', icon: Database, path: '/workspaces' },
  { id: 'optimize', label: 'Optimize Query', icon: Zap, path: '/optimize' },
  { id: 'history', label: 'History', icon: FileText, path: '/history' },
  { id: 'settings', label: 'Settings', icon: Settings, path: '/settings' },
];

export function MainLayout({ children, currentPage = 'dashboard', onNavigate, onLogout }: MainLayoutProps) {
  const handleMenuClick = (itemId: string) => {
    if (onNavigate) {
      onNavigate(itemId);
    }
  };

  return (
    <div className="flex h-screen bg-background dark:bg-background-dark text-text-main-DEFAULT dark:text-text-main-dark">
      {/* Sidebar */}
      <aside className="w-64 bg-surface dark:bg-surface-dark border-r border-border dark:border-border-dark flex flex-col">
        {/* Logo */}
        <div className="p-6 border-b border-border dark:border-border-dark">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-primary dark:from-primary-dark to-secondary dark:to-secondary-dark rounded-lg flex items-center justify-center">
              <Zap className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold bg-gradient-to-r from-primary dark:from-primary-dark to-secondary dark:to-secondary-dark bg-clip-text text-transparent">
                SQLTuner
              </h1>
              <p className="text-xs text-text-muted-DEFAULT dark:text-text-muted-dark">AI-Powered SQL</p>
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
                onClick={() => handleMenuClick(item.id)}
                className={cn(
                  'w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200',
                  'hover:bg-surface-highlight-DEFAULT dark:hover:bg-surface-highlight-dark group',
                  isActive && 'bg-surface-highlight-DEFAULT dark:bg-surface-highlight-dark border border-primary/30 dark:border-primary-dark/30'
                )}
              >
                <Icon 
                  className={cn(
                    'w-5 h-5 transition-colors',
                    isActive ? 'text-primary dark:text-primary-dark' : 'text-text-muted-DEFAULT dark:text-text-muted-dark group-hover:text-primary dark:group-hover:text-primary-dark'
                  )} 
                />
                <span 
                  className={cn(
                    'font-medium transition-colors',
                    isActive ? 'text-text-main-DEFAULT dark:text-text-main-dark' : 'text-text-muted-DEFAULT dark:text-text-muted-dark group-hover:text-text-main-DEFAULT dark:group-hover:text-text-main-dark'
                  )}
                >
                  {item.label}
                </span>
              </button>
            );
          })}
        </nav>

        {/* User Section */}
        <div className="p-4 border-t border-border dark:border-border-dark">
          <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-surface-highlight-DEFAULT dark:bg-surface-highlight-dark">
            <ThemeToggle />
            <div className="flex-1">
              <p className="text-sm font-medium text-text-main-DEFAULT dark:text-text-main-dark">User</p>
              <p className="text-xs text-text-muted-DEFAULT dark:text-text-muted-dark">user@sqltuner.dev</p>
            </div>
            <button 
              onClick={onLogout}
              className="text-text-muted-DEFAULT dark:text-text-muted-dark hover:text-red-500 dark:hover:text-red-400 transition-colors"
              title="Logout"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  );
}
