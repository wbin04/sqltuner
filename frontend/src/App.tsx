import { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';
import { MainLayout } from './layouts/MainLayout';
import { AdminLayout } from './layouts/AdminLayout';
import { DashboardHome } from './pages/DashboardHome';
import { QueryEditor } from './pages/QueryEditor';
import { LoginPage } from './pages/LoginPage';
import { AdminDashboard } from './pages/admin/AdminDashboard';
import { FeedbackReview } from './pages/admin/FeedbackReview';
import { UserManagement } from './pages/admin/UserManagement';

type Page = 'dashboard' | 'workspaces' | 'optimize' | 'history' | 'settings';
type AdminPage = 'dashboard' | 'users' | 'feedback' | 'connections' | 'settings';

function App() {
  const [currentPage, setCurrentPage] = useState<Page>('dashboard');
  const [currentAdminPage, setCurrentAdminPage] = useState<AdminPage>('dashboard');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // Check authentication on mount
    const authStatus = localStorage.getItem('isAuthenticated') === 'true';
    setIsAuthenticated(authStatus);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('isAuthenticated');
    localStorage.removeItem('userRole');
    setIsAuthenticated(false);
    navigate('/login');
  };

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard':
      case 'workspaces':
        return <DashboardHome />;
      case 'optimize':
        return <QueryEditor />;
      case 'history':
        return (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-text-main-DEFAULT dark:text-text-main-dark mb-2">History</h2>
              <p className="text-text-muted-DEFAULT dark:text-text-muted-dark">Coming soon...</p>
            </div>
          </div>
        );
      case 'settings':
        return (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-text-main-DEFAULT dark:text-text-main-dark mb-2">Settings</h2>
              <p className="text-text-muted-DEFAULT dark:text-text-muted-dark">Coming soon...</p>
            </div>
          </div>
        );
      default:
        return <DashboardHome />;
    }
  };

  const renderAdminPage = () => {
    switch (currentAdminPage) {
      case 'dashboard':
        return <AdminDashboard />;
      case 'users':
        return <UserManagement />;
      case 'feedback':
        return <FeedbackReview />;
      case 'connections':
      case 'settings':
        return (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-text-main-DEFAULT dark:text-text-main-dark mb-2">
                {currentAdminPage.charAt(0).toUpperCase() + currentAdminPage.slice(1)}
              </h2>
              <p className="text-text-muted-DEFAULT dark:text-text-muted-dark">Coming soon...</p>
            </div>
          </div>
        );
      default:
        return <AdminDashboard />;
    }
  };

  return (
    <ThemeProvider>
      <Routes>
        <Route path="/login" element={
          isAuthenticated ? (
            localStorage.getItem('userRole') === 'admin' 
              ? <Navigate to="/admin" replace /> 
              : <Navigate to="/optimize" replace />
          ) : (
            <LoginPage onLoginSuccess={() => setIsAuthenticated(true)} />
          )
        } />
        
        {/* Admin Routes */}
        <Route path="/admin/*" element={
          !isAuthenticated ? (
            <Navigate to="/login" replace />
          ) : (
            <AdminLayout 
              currentPage={currentAdminPage} 
              onNavigate={(page) => setCurrentAdminPage(page as AdminPage)}
              onLogout={handleLogout}
            >
              {renderAdminPage()}
            </AdminLayout>
          )
        } />
        
        {/* User Routes */}
        <Route path="/*" element={
          !isAuthenticated ? (
            <Navigate to="/login" replace />
          ) : (
            <MainLayout 
              currentPage={currentPage} 
              onNavigate={(page) => setCurrentPage(page as Page)}
              onLogout={handleLogout}
            >
              {renderPage()}
            </MainLayout>
          )
        } />

        <Route path="/" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </ThemeProvider>
  );
}

export default App;
