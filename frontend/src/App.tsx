import { useState } from 'react';
import { Routes, Route, Navigate, Outlet, useLocation } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { MainLayout } from './layouts/MainLayout';
import { AdminLayout } from './layouts/AdminLayout';
import { DashboardHome } from './pages/DashboardHome';
import { LoginPage } from './pages/LoginPage';
import { WorkspacesPage } from './pages/WorkspacesPage';
import { EditorPage } from './pages/EditorPage';
import { HistoryPage } from './pages/HistoryPage';
import { AdminDashboard } from './pages/admin/AdminDashboard';
import { FeedbackReview } from './pages/admin/FeedbackReview';
import { UserManagement } from './pages/admin/UserManagement';
import { SimulationDesigner } from './pages/SimulationDesigner';
import { SchemaEditor } from './pages/TableEditor';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

type AdminPage = 'dashboard' | 'users' | 'feedback' | 'connections' | 'settings';

function LoginRoute() {
  const { isAuthenticated, user } = useAuth();
  const location = useLocation();

  if (isAuthenticated) {
    if (location.pathname === '/login') {
      return <Navigate to={user?.role === 'admin' ? '/admin' : '/workspaces'} replace />;
    }
    return null;
  }

  return <LoginPage />;
}

function AppContent() {
  const [currentAdminPage, setCurrentAdminPage] = useState<AdminPage>('dashboard');
  const { isAuthenticated, isLoading, logout, user } = useAuth();

  const ProtectedUserLayout = () => {
    if (isLoading) {
      return (
        <div className="flex items-center justify-center h-screen">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
        </div>
      );
    }
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
    if (isLoading) {
      return (
        <div className="flex items-center justify-center h-screen">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
        </div>
      );
    }
    if (!isAuthenticated) {
      return <Navigate to="/login" replace />;
    }
    // Check if user is admin
    if (user?.role !== 'admin') {
      return <Navigate to="/workspaces" replace />;
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
      <Route path="/login" element={<LoginRoute />} />
      
      {/* Admin Routes */}
      <Route path="/admin/*" element={<ProtectedAdminLayout />} />
      
      {/* User Routes */}
      <Route element={<ProtectedUserLayout />}>
        <Route path="/dashboard" element={<DashboardHome />} />
        <Route path="/workspaces" element={<WorkspacesPage />} />
        <Route path="/history" element={<HistoryPage />} />
        <Route path="/settings" element={
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-text-main-DEFAULT dark:text-text-main-dark mb-2">Settings</h2>
              <p className="text-text-muted-DEFAULT dark:text-text-muted-dark">Coming soon...</p>
            </div>
          </div>
        } />
      </Route>

      {/* Editor Route - Outside MainLayout for full-screen experience */}
      <Route path="/editor/:workspaceId" element={
        isLoading ? (
          <div className="flex items-center justify-center h-screen">
            <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
          </div>
        ) : isAuthenticated ? (
          <EditorPage />
        ) : (
          <Navigate to="/login" replace />
        )
      } />

      {/* Simulation Designer Route - Outside MainLayout for full-screen experience */}
      <Route path="/simulation/:workspaceId" element={
        isLoading ? (
          <div className="flex items-center justify-center h-screen">
            <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
          </div>
        ) : isAuthenticated ? (
          <SimulationDesigner />
        ) : (
          <Navigate to="/login" replace />
        )
      } />

      {/* Schema Editor Route - For editing schema of any workspace (real or simulation) */}
      <Route path="/schema-editor/:workspaceId" element={
        isLoading ? (
          <div className="flex items-center justify-center h-screen">
            <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
          </div>
        ) : isAuthenticated ? (
          <SchemaEditor />
        ) : (
          <Navigate to="/login" replace />
        )
      } />

      <Route path="/" element={<Navigate to="/workspaces" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AppContent />
        <ToastContainer
          position="top-right"
          autoClose={3000}
          hideProgressBar={false}
          newestOnTop={false}
          closeOnClick
          rtl={false}
          pauseOnFocusLoss
          draggable
          pauseOnHover
          theme="light"
        />
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
