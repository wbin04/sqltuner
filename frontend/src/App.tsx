import { useState } from 'react';
import { Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { MainLayout } from './layouts/MainLayout';
import { AdminLayout } from './layouts/AdminLayout';
import { DashboardHome } from './pages/DashboardHome';
import { QueryEditor } from './pages/QueryEditor';
import { LoginPage } from './pages/LoginPage';
import { AdminDashboard } from './pages/admin/AdminDashboard';
import { FeedbackReview } from './pages/admin/FeedbackReview';
import { UserManagement } from './pages/admin/UserManagement';

type AdminPage = 'dashboard' | 'users' | 'feedback' | 'connections' | 'settings';

function AppContent() {
  const [currentAdminPage, setCurrentAdminPage] = useState<AdminPage>('dashboard');
  const { isAuthenticated, logout, user } = useAuth();

  const ProtectedUserLayout = () => {
    if (!isAuthenticated) {
      return <Navigate to="/login" replace />;
    }
    return (
      <MainLayout onLogout={logout}>
        <Outlet />
      </MainLayout>
    );
  };

  const ProtectedAdminLayout = () => {
    if (!isAuthenticated) {
      return <Navigate to="/login" replace />;
    }
    // Check if user is admin
    if (user?.role !== 'admin') {
      return <Navigate to="/optimize" replace />;
    }
    return (
      <AdminLayout 
        currentPage={currentAdminPage} 
        onNavigate={(page) => setCurrentAdminPage(page as AdminPage)}
        onLogout={logout}
      >
        {renderAdminPage()}
      </AdminLayout>
    );
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
    <Routes>
      <Route path="/login" element={
        isAuthenticated ? (
          user?.role === 'admin' 
            ? <Navigate to="/admin" replace /> 
            : <Navigate to="/optimize" replace />
        ) : (
          <LoginPage />
        )
      } />
      
      {/* Admin Routes */}
      <Route path="/admin/*" element={<ProtectedAdminLayout />} />
      
      {/* User Routes */}
      <Route element={<ProtectedUserLayout />}>
        <Route path="/dashboard" element={<DashboardHome />} />
        <Route path="/workspaces" element={<DashboardHome />} />
        <Route path="/optimize" element={<QueryEditor />} />
        <Route path="/history" element={
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-text-main-DEFAULT dark:text-text-main-dark mb-2">History</h2>
              <p className="text-text-muted-DEFAULT dark:text-text-muted-dark">Coming soon...</p>
            </div>
          </div>
        } />
        <Route path="/settings" element={
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-text-main-DEFAULT dark:text-text-main-dark mb-2">Settings</h2>
              <p className="text-text-muted-DEFAULT dark:text-text-muted-dark">Coming soon...</p>
            </div>
          </div>
        } />
      </Route>

      <Route path="/" element={<Navigate to="/optimize" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
